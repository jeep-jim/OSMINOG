'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {EventEmitter}=require('node:events');
const {createContext,runInContext}=require('node:vm');
const {install}=require('./mouse-media-player.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function documentFixture(){
 const doc={all:[],querySelectorAll:s=>{assert.equal(s,'audio,video');return doc.all}};
 class Media {
  constructor(){Object.assign(this,{isConnected:true,srcObject:null,error:null,readyState:4,ended:false,paused:false,duration:15,currentTime:2,
                                ownerDocument:doc,seekable:{length:1,start:()=>1,end:()=>12}})}
  pause(){this.paused=true;this.pauseCalls=(this.pauseCalls||0)+1}
  async play(){if(this.blocked)throw Error('fixture rejected');this.paused=false}
 }
 class Video extends Media {}
 const navigator={mediaSession:{metadata:null}};
 const world=createContext({document:doc,navigator,HTMLMediaElement:Media,HTMLVideoElement:Video});
 return{doc,navigator,add(video=false){const e=video?new Video():new Media();doc.all.push(e);return e},run:code=>runInContext(code,world)};
}
function fixture(t){
 const ipc={}, sent=[], ops=[], pages=[], win=new EventEmitter(), powerMonitor=new EventEmitter();
 win.webContents={isDestroyed:()=>false,send:(channel,arg)=>sent.push([channel,arg])};
 let priv=false;
 const bank={members:Object.create(null),items:[{id:'work'},{id:'spare'}],active:'work'};
 const browser={tabs:new Map(),mouseDesktops:{bank},project:'p',emit(){},make(tabId,desk,props={}){
  const page={id:tabId,project:'p',...props};let dom=documentFixture(), destroyed=false;
  const wc=new EventEmitter();
  Object.assign(wc,{getURL:()=>page.fakeURL||'https://media.example/path?token=never_emit',getTitle:()=>page.fakeTitle||'Source title',isDestroyed:()=>destroyed,
   executeJavaScriptInIsolatedWorld(world,scripts,userGesture){
    assert.equal(world,1294);assert.equal(userGesture,false);assert.equal(scripts.length,1);
    ops.push(tabId);return dom.run(scripts[0].code)
   }});
  page.view={webContents:wc};
  page.replace=()=>{dom=documentFixture();return dom};
  page.close=()=>{destroyed=true;browser.tabs.delete(tabId);wc.emit('destroyed')};
  Object.defineProperty(page,'doc',{get:()=>dom});
  browser.tabs.set(tabId,page);bank.members[tabId]=desk;pages.push(page);return page;
 }};
 const control=install({win,browser,ipcMain:{handle:(ch,fn)=>ipc[ch]=fn},
    trusted:e=>{if(e!=='shell')throw Error('Untrusted frame')},isPrivate:()=>priv,powerMonitor});
 t.after(()=>control.dispose());
 const call=(act,args,event='shell')=>ipc['mouse:media-player'](event,act,args);
 return{bank,browser,call,ops,sent,powerMonitor,control,privacy:v=>{priv=v}};
}
async function start(f,page){page.view.webContents.emit('media-started-playing');await flush();return(await f.call('state')).player}

test('plays/pause/seeks only original native media, stable originating tab and moving desk',async t=>{
 const f=fixture(t), p=f.browser.make('tab-1','work'), unrelated=f.browser.make('tab-2','spare');
 const a=p.doc.add(true), b=unrelated.doc.add();
 assert.equal((await f.call('state')).player,null);
 const s=await start(f,p);assert.equal(s.kind,'video');assert.equal(s.tabId,'tab-1');assert.equal(s.originDeskId,'work');
 assert.equal(s.title,'Source title');assert.equal(JSON.stringify(s).includes('token'),false);
 f.bank.active='spare';
 f.bank.members['tab-1']='spare';f.browser.emit();assert.equal((await f.call('state')).player.deskId,'spare');
 assert.equal((await f.call('state')).player.originDeskId,'work');
 assert.deepEqual(await f.call('return',{id:s.id}),{desk:'spare',id:'tab-1'});
 assert.equal((await f.call('pause',{id:s.id})).player.paused,true);assert.equal(a.paused,true);assert.equal(b.paused,false);
 assert.equal((await f.call('resume',{id:s.id})).player.paused,false);
 await f.call('seek',{id:s.id,seconds:8});assert.equal(a.currentTime,8);assert.equal(b.currentTime,2);
 await assert.rejects(f.call('seek',{id:s.id,seconds:14}),/позиция/);
 assert.equal(f.sent.at(-1)[0],'mouse:media-player-state');
 assert.equal(f.ops.includes('tab-2'),false);
});
test('reject invalid sender/id/code, ambiguous/media stream and synthetic navigation',async t=>{
 const f=fixture(t), p=f.browser.make('tab','work');
 const a=p.doc.add(), other=p.doc.add(true);
 assert.equal(await start(f,p),null);
 other.paused=true;a.srcObject={liveStream:'not exposed'};
 assert.equal(await start(f,p),null);
 a.srcObject=null;const s=await start(f,p);
 await assert.rejects(f.call('state',{},'guest'),/Untrusted/);
 await assert.rejects(f.call('exec',{id:s.id,code:'bad'}),/Неизвестное/);
 await assert.rejects(f.call('seek',{id:s.id,seconds:'2'}),/позиция/);
 await assert.rejects(f.call('pause',{id:'00000000-0000-4000-8000-000000000000'}),/вкладка/);
 assert.equal(a.pauseCalls,undefined);
 p.view.webContents.emit('did-start-navigation',{},'https://media.example/#same',true,true);
 assert.equal((await f.call('state')).player.id,s.id);
 p.view.webContents.emit('did-start-navigation',{},{isMainFrame:true,isSameDocument:false});
 assert.equal((await f.call('state')).player,null);
 const second=p.replace().add();
 await assert.rejects(f.call('pause',{id:s.id}),/вкладка/);
 p.view.webContents.emit('did-navigate',{},'https://media.example/next');
 assert.notEqual((await start(f,p)).id,s.id);assert.equal(second.pauseCalls,undefined);
});
test('browser autoplay refusal is surfaced and streams/unknown duration do not claim seek',async t=>{
 const f=fixture(t), p=f.browser.make('tab','work'), a=p.doc.add();
 a.duration=Infinity;
 const s=await start(f,p);assert.equal(s.duration,null);assert.equal(s.canSeek,false);
 await f.call('pause',{id:s.id});a.blocked=true;
 await assert.rejects(f.call('resume',{id:s.id}),/Сайт не разрешил/);
 await assert.rejects(f.call('seek',{id:s.id,seconds:2}),/Перемотка/);
 assert.equal((await f.call('state')).player.paused,true);
 a.ended=true;p.view.webContents.emit('media-paused');await flush();assert.equal((await f.call('state')).player,null);
});
test('privacy, lock, close, denied tabs and dismiss clear UI without pausing',async t=>{
 const f=fixture(t), p=f.browser.make('tab','work'), a=p.doc.add();
 const x=f.browser.make('ai','work',{provider:'ai'}), y=f.browser.make('internal','work',{internal:true}), z=f.browser.make('preview','work',{previewOf:'chat'});
 for(const tab of [x,y,z]){tab.doc.add();assert.equal(await start(f,tab),null)}
 assert.equal(f.ops.length,0);
 let s=await start(f,p);
 f.privacy(true);f.control.clear();assert.deepEqual((await f.call('state')).player,null);assert.equal((await f.call('state')).available,false);
 await assert.rejects(f.call('pause',{id:s.id}),/вкладка/);assert.equal(a.paused,false);
 f.privacy(false);f.control.resume();s=await start(f,p);assert.ok(s);
 f.powerMonitor.emit('lock-screen');assert.equal((await f.call('state')).player,null);
 f.powerMonitor.emit('unlock-screen');s=await start(f,p);assert.ok(s);
 await f.call('dismiss',{id:s.id});assert.equal((await f.call('state')).player,null);assert.equal(a.paused,false);
 p.close();assert.equal((await f.call('state')).player,null);
});
test('switch while a read is pending cannot resurrect previous navigation or private context',async t=>{
 const f=fixture(t), p=f.browser.make('tab','work');p.doc.add();
 const wc=p.view.webContents, prev=wc.executeJavaScriptInIsolatedWorld;let resume;
 wc.executeJavaScriptInIsolatedWorld=(...args)=>new Promise(resolve=>{resume=()=>resolve(prev(...args))});
 wc.emit('media-started-playing');f.privacy(true);f.control.clear();f.privacy(false);f.control.resume();
 resume();await flush();assert.equal((await f.call('state')).player,null);
});

test('optional native media-session metadata includes bounded text only; absence falls back to tab title',async t=>{
 const f=fixture(t), p=f.browser.make('tab','work');p.doc.add();
 const session=p.doc.navigator.mediaSession;
 session.metadata={title:'Синтезатор\u202e '+ 'а'.repeat(175),artist:'  Дуэт\nА  ',get artwork(){assert.fail('artwork must not be read')}};
 let s=await start(f,p);
 assert.equal(s.trackTitle.length,150);assert.equal(s.trackTitle.includes('\u202e'),false);
 assert.equal(s.artist,'Дуэт А');assert.equal(s.title,'Source title');
 assert.equal(JSON.stringify(s).includes('artwork'),false);
 session.metadata={title:'https://cdn.example/private?key=not_seen',artist:'blob:example'};
 s=await start(f,p);assert.equal(s.trackTitle,undefined);assert.equal(s.artist,undefined);assert.equal(s.title,'Source title');
 session.metadata=null;s=await start(f,p);assert.equal(s.title,'Source title');assert.equal(s.trackTitle,undefined);
});

function holdNextRead(page){
 const wc=page.view.webContents,execute=wc.executeJavaScriptInIsolatedWorld.bind(wc);let release,held=false;
 wc.executeJavaScriptInIsolatedWorld=(...args)=>{
  if(!held&&args[1][0].code.includes(')("read",')){
   held=true;return new Promise(resolve=>{release=()=>resolve(execute(...args))});
  }
  return execute(...args);
 };
 return()=>{assert.ok(held,'The real isolated read is pending');release()};
}
test('a native play signal during refresh preserves replacement media and controls its new track',async t=>{
 const f=fixture(t),p=f.browser.make('tab','work'),unrelated=f.browser.make('other','spare');
 const original=p.doc.add(),other=unrelated.doc.add();p.doc.navigator.mediaSession.metadata={title:'First track'};
 const before=await start(f,p),release=holdNextRead(p);
 p.view.webContents.emit('media-paused');
 original.isConnected=false;
 const replacement=p.doc.add();p.doc.navigator.mediaSession.metadata={title:'Replacement track',artist:'Owned artist'};
 for(let i=0;i<5;i++)p.view.webContents.emit('media-started-playing');
 release();await flush();await flush();
 const after=(await f.call('state')).player;
 assert.ok(after,'A replacement native play signal must survive the pending read');
 assert.notEqual(after.id,before.id);assert.equal(after.trackTitle,'Replacement track');assert.equal(after.artist,'Owned artist');
 assert.ok(f.sent.every(([,state])=>state.player),'The widget is not cleared between the old read and native replacement discovery');
 assert.equal(f.ops.length,3,'Duplicate native events coalesce into one additional discovery');
 await f.call('pause',{id:after.id});assert.equal(replacement.paused,true);
 assert.equal(original.pauseCalls,undefined);assert.equal(other.paused,false);assert.equal(f.ops.includes('other'),false);
});
test('a new track on the same media element refreshes metadata without replacing its identity',async t=>{
 const f=fixture(t),p=f.browser.make('tab','work');p.doc.add();
 const before=await start(f,p),release=holdNextRead(p);
 p.view.webContents.emit('media-paused');p.doc.navigator.mediaSession.metadata={title:'Next track'};
 p.view.webContents.emit('media-started-playing');release();await flush();await flush();
 const after=(await f.call('state')).player;
 assert.equal(after.id,before.id);assert.equal(after.trackTitle,'Next track');
});
for(const revoke of ['privacy','navigation','dismiss'])test('queued native media discovery is revoked by '+revoke,async t=>{
 const f=fixture(t),p=f.browser.make('tab','work'),original=p.doc.add();
 const before=await start(f,p),release=holdNextRead(p);
 p.view.webContents.emit('media-paused');original.isConnected=false;p.doc.add();p.view.webContents.emit('media-started-playing');
 if(revoke==='privacy'){f.privacy(true);f.control.clear();f.privacy(false);f.control.resume()}
 else if(revoke==='navigation'){p.view.webContents.emit('did-start-navigation',{},{isMainFrame:true,isSameDocument:false});p.view.webContents.emit('did-navigate')}
 else await f.call('dismiss',{id:before.id});
 release();await flush();await flush();
 assert.equal((await f.call('state')).player,null);assert.equal(f.ops.length,2);
});
