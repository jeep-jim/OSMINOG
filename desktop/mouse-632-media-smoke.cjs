'use strict';
// Owned local media fixture. This checks the complete packaged event -> state
// -> DOM -> native-view path, without an external music account. Invoking a
// registered MediaSession callback is labelled separately from OS media keys.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http');
const {createFixture,pageHTML,bounded,sleep}=require('./mouse-631-smoke-helpers.cjs');

function tone(){
 const rate=8000,samples=rate*8,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*120),44+i*2);return buffer;
}
function mediaPage(index){
 const script=`<script>
 const audio=document.createElement('audio');audio.volume=.1;audio.src='/tone.wav?track=0';document.body.append(audio);
 const play=document.createElement('button'),next=document.createElement('button');play.id='media-play';play.textContent='Start local audio';next.id='media-next';next.textContent='Next local track';for(const [i,b]of [play,next].entries()){b.style.cssText='position:fixed;left:'+(8+i*48)+'%;top:166px;font-size:12px;z-index:1';document.body.append(b);}
 const state=globalThis.mouse632={track:0,events:[],endedEvents:[],actions:{},audio};
 function advance(source){state.track++;state.events.push({track:state.track,source,at:performance.now()});document.title='Mouse632 Track '+state.track+' · local artist';navigator.mediaSession.metadata=new MediaMetadata({title:'Track '+state.track,artist:'Owned local fixture',album:'Mouse632'});audio.src='/tone.wav?track='+state.track;return audio.play();}
 state.advance=advance;play.onclick=()=>audio.play();next.onclick=()=>advance('site-button');audio.addEventListener('ended',event=>{state.endedEvents.push({track:state.track,isTrusted:event.isTrusted,ended:audio.ended,currentTime:audio.currentTime,duration:audio.duration,at:performance.now()});advance('automatic-ended');});
 state.actions.nexttrack=()=>advance('media-session-handler');navigator.mediaSession.setActionHandler('nexttrack',state.actions.nexttrack);
 </script>`;
 return pageHTML(index).replace('</body>',script+'</body>');
}

module.exports=async ctx=>{
 const facts={version:ctx.app.getVersion(),platform:process.platform,arch:process.arch,source:'packaged Electron; local HTTP audio; real page title events; native view instrumentation and OS pixels',budgetMs:55000,physicalMediaKeysVerified:false,externalMusicAccountVerified:false,scenarios:[],captures:[],ok:false,restored:false};
 const save=()=>fs.writeFile('mouse-632-media.json',JSON.stringify(facts,null,2)+'\n');
 let fixture,server,error,cleanupError,readFailure,activeScenario;const restore=[];
 try{
  fixture=await createFixture(ctx,'media632',facts.budgetMs);const {browser,win,bank}=fixture;
  const audio=tone(),requests={pages:0,media:0};
  server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),match=url.pathname.match(/^\/page\/(\d+)\/$/);res.setHeader('Cache-Control','no-store');if(url.pathname==='/tone.wav'){requests.media++;res.writeHead(200,{'Content-Type':'audio/wav'});res.end(audio);return;}if(match){requests.pages++;res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});const index=Number(match[1]);res.end(index===0?mediaPage(index):pageHTML(index));return;}res.writeHead(204);res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,records=[];for(let i=0;i<4;i++)records.push(await fixture.open(base+'/page/'+i+'/',i));await fixture.setLayout(records);
  const music=records[0],typing=records[1];
  async function click(record,selector){const rect=await fixture.pageJS(record,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`),bounds=record.page.bounds,origin=win.getContentBounds();assert.equal(ctx.nativeInput.testClick(Math.round(origin.x+bounds.x+rect.x),Math.round(origin.y+bounds.y+rect.y)),true);await fixture.frame();}
  await click(music,'#media-play');await fixture.until(()=>fixture.pageJS(music,'mouse632.audio.currentTime>0&&!mouse632.audio.paused'),'local audio really plays',6000);
  let titleEvents=0;const onTitle=()=>titleEvents++;music.page.view.webContents.on('page-title-updated',onTitle);restore.push(()=>music.page.view.webContents.removeListener('page-title-updated',onTitle));
  const operations=[];function watch(owner,method,label){if(typeof owner?.[method]!=='function')return;const original=owner[method];owner[method]=function(...args){operations.push({at:performance.now(),label,method,...(method==='setVisible'?{visible:args[0]}:{})});return original.apply(this,args);};restore.push(()=>{owner[method]=original;});}
  watch(browser,'layout','workspace');watch(win.contentView,'addChildView','window');watch(win.contentView,'removeChildView','window');watch(browser,'mouseCornerMask','corner-mask');
  for(const page of [...browser.tabs.values(),...browser.providers.values()]){watch(page.view.webContents,'capturePage',page.id);for(const [view,label]of [[page.view,page.id],[page.clipView,page.id+' clip']])if(view){watch(view,'setBounds',label);watch(view,'setVisible',label);watch(view,'addChildView',label);watch(view,'removeChildView',label);}}
  await fixture.js(`(()=>{const records=[];const observer=new MutationObserver(batch=>{for(const mutation of batch){const pane=mutation.target.nodeType===1?mutation.target.closest('.pane'):mutation.target.parentElement?.closest('.pane');if(pane)records.push({pane:pane.dataset.pane,type:mutation.type,attribute:mutation.attributeName,tag:mutation.target.nodeName});}});observer.observe(document.querySelector('#stage'),{subtree:true,childList:true,attributes:true,characterData:true});globalThis.__mouse632Media={records,observer};})()`);
  const settle=async()=>{await sleep(450);await fixture.frame();};
  const mediaState=()=>fixture.pageJS(music,'(()=>{const audio=mouse632.audio,ranges=value=>Array.from({length:value.length},(_,i)=>({start:value.start(i),end:value.end(i)}));return{track:mouse632.track,events:mouse632.events,endedEvents:mouse632.endedEvents,paused:audio.paused,currentTime:audio.currentTime,duration:audio.duration,readyState:audio.readyState,networkState:audio.networkState,seeking:audio.seeking,ended:audio.ended,buffered:ranges(audio.buffered),seekable:ranges(audio.seekable),error:audio.error?{code:audio.error.code,message:audio.error.message}:null};})()');
  readFailure=async()=>({scenario:activeScenario,media:await mediaState(),requests:{...requests},titleEvents,operations:operations.slice()});
  async function scenario(name,trigger,{typingFocused=false,advanceTimeoutMs=5000,naturalEnd=false}={}){
   activeScenario=name;
   await settle();const before=await Promise.all(records.map(record=>fixture.identity(record))),nativeBefore=records.map(fixture.nativeState),beforeMedia=await mediaState(),beforeTitles=titleEvents;
   await fixture.js('__mouse632Media.records.length=0');operations.length=0;
   let progressed;if(trigger)await trigger();await fixture.until(async()=>{progressed=await mediaState();return progressed.track>beforeMedia.track;},name+' advances the real media fixture',advanceTimeoutMs);await fixture.until(()=>music.page.title.startsWith('Mouse632 Track '+progressed.track+' ·'),name+' reaches main page state');await settle();
   const current=await mediaState(),mutations=await fixture.js('__mouse632Media.records.slice()'),after=await Promise.all(records.map(record=>fixture.identity(record))),nativeAfter=records.map(fixture.nativeState),pane=await fixture.js(`Object.keys(MouseTest.model.slots).find(key=>MouseTest.model.slots[key]===${JSON.stringify(music.id)})`);
   assert.ok(titleEvents>beforeTitles,'A real page-title-updated event reached the BrowserWorkspace');assert.equal(current.paused,false,'Audio resumes after switching its source');assert.deepEqual(nativeAfter,nativeBefore);
   if(naturalEnd){const ended=current.endedEvents.slice(beforeMedia.endedEvents.length);assert.equal(ended.length,1,'Exactly one real audio end advances this scenario');assert.equal(current.events.at(-1).source,'automatic-ended');assert.equal(ended[0].track,beforeMedia.track);assert.equal(ended[0].isTrusted,true,'The browser produced the ended event');assert.equal(ended[0].ended,true);assert.ok(Number.isFinite(ended[0].duration)&&ended[0].duration>0&&ended[0].currentTime>=ended[0].duration-.05,'The decoded audio played to its natural end');}
   for(let i=0;i<records.length;i++)fixture.assertIdentity(before[i],after[i]);
   assert.deepEqual(operations,[],'Track metadata never hides, resizes, detaches, captures, or lays out the live native pages');assert.ok(mutations.length>0,'The changing title visibly reaches its owning shell labels');assert.ok(mutations.every(mutation=>mutation.pane===pane),'Unrelated pane subtrees receive no media-title DOM mutations');
   const focus=typingFocused?await fixture.pageJS(typing,'document.activeElement===document.querySelector("#field")'):null;if(typingFocused)assert.equal(focus,true,'Another page keeps its editing focus during an automatic/media callback change');
   facts.scenarios.push({name,source:current.events.at(-1).source,mediaBefore:beforeMedia,mediaAfter:current,titleEvents:titleEvents-beforeTitles,operations:operations.slice(),mutations,identitiesBefore:before,identitiesAfter:after,nativeBefore,nativeAfter,typingFocused:focus});await save();
  }
  await scenario('native site next-button',()=>click(music,'#media-next'));
  await click(typing,'#field');await fixture.until(()=>fixture.pageJS(typing,'document.activeElement===document.querySelector("#field")'),'another live page owns the form focus');
  // Let the eight-second WAV finish naturally. Seeking to its final 80 ms
  // couples this regression to media seek support and can miss the 5 s bound.
  await scenario('automatic audio ended',null,{typingFocused:true,advanceTimeoutMs:12000,naturalEnd:true});
  await scenario('registered MediaSession nexttrack callback',()=>fixture.pageJS(music,'mouse632.actions.nexttrack().then(()=>true)'),{typingFocused:true});
  // A burst exercises coalescing while the other pane remains actively edited.
  await scenario('repeated title and media metadata burst',()=>fixture.pageJS(music,`(()=>{for(let i=0;i<20;i++){mouse632.track++;document.title='Mouse632 Track '+mouse632.track+' · burst';navigator.mediaSession.metadata=new MediaMetadata({title:'Track '+mouse632.track});}mouse632.events.push({track:mouse632.track,source:'metadata-burst',at:performance.now()});return true;})()`),{typingFocused:true});
  for(const theme of ['light','dark']){await fixture.js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await settle();facts.captures.push({theme,...await fixture.captureContent('mouse-632-media-'+theme+'.png',records)});}
  facts.requests=requests;assert.equal(requests.pages,4,'No live fixture document was reloaded by track changes');assert.ok(requests.media>=4);facts.audio=await mediaState();facts.pages=records.map(record=>({id:record.id,desk:bank.members[record.id],webContentsId:record.page.view.webContents.id}));facts.elapsedMs=performance.now()-fixture.started;
 }catch(cause){error=cause;facts.error={message:cause.message,stack:cause.stack};if(cause.capture)facts.failureCapture=cause.capture;if(readFailure)try{facts.failureMedia=await readFailure();}catch(probeError){facts.failureMediaError=probeError.message;}await save();}
 finally{
  for(const undo of restore.reverse())try{undo();}catch{}
  if(fixture){await fixture.js('globalThis.__mouse632Media?.observer.disconnect();delete globalThis.__mouse632Media').catch(()=>{});try{facts.cleanup=await bounded(fixture.cleanup(),22000,'media fixture cleanup');facts.restored=true;}catch(cause){cleanupError=cause;facts.cleanupError={message:cause.message,stack:cause.stack};}}
  if(server){server.closeAllConnections();await bounded(new Promise(resolve=>server.close(resolve)),2000,'media HTTP shutdown').catch(cause=>{cleanupError??=cause;facts.serverCleanupError=cause.message;});}
  facts.ok=!error&&!cleanupError&&facts.restored;await save();
 }
 if(error)throw error;if(cleanupError)throw cleanupError;console.log('MOUSE_632_STATIONARY_MEDIA_PASS');
};
