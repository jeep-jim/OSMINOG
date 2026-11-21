'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {percent,description,task,summary,createMouseDownloadActivity,createMouseCaptureFeedback}=require('./mouse/activity-feedback.js');
const row=(id,extra={})=>({id,filename:id+'.zip',tabId:'tab-a',desk:'desk-a',state:'downloading',received:25,total:100,createdAt:1000,updatedAt:1000,expiresAt:0,...extra});
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

test('native byte ratios stay exact, unknown totals stay indeterminate, and only completed is terminal',()=>{
 assert.equal(percent(row('a')),25);assert.equal(percent(row('a',{received:101})),100);
 for(const total of [0,-1,NaN,Infinity,undefined,'100'])assert.equal(percent(row('a',{total})),null);
 for(const received of [-1,NaN,Infinity,undefined,'10'])assert.equal(percent(row('a',{received})),0);
 const received=task(row('a',{received:100}),false);assert.equal(received.percent,100);assert.equal(received.phase,'running','receiving all bytes does not impersonate native done');
 assert.equal(percent(row('a',{state:'completed',total:0,received:0})),100);
});

test('concurrent transfers use a byte-weighted total and never invent a percentage for unknown sizes',()=>{
 const large=row('large',{total:900,received:90}),small=row('small',{total:100,received:50}),original=JSON.stringify([large,small]);
 const value=summary([large,small]);assert.ok(Math.abs(value.percent-14)<1e-12);assert.equal(value.count,2);assert.equal(value.state,'downloading');assert.strictEqual(value.item,large);assert.equal(JSON.stringify([large,small]),original);
 assert.equal(summary([large,row('unknown',{total:0,received:5000})]).percent,null);
 assert.equal(summary([row('over',{received:200}),row('second',{received:0})]).percent,50,'one overshooting transfer cannot fill another transfer');
});

test('paused transfers stay active without pretending to transfer, and terminal summaries choose the newest event',()=>{
 const paused=row('paused',{state:'paused',received:20}),downloading=row('running',{received:99});
 assert.equal(summary([paused]).state,'paused');assert.equal(summary([paused]).count,1);
 const mixed=summary([paused,downloading]);assert.equal(mixed.state,'downloading');assert.strictEqual(mixed.item,downloading);assert.equal(mixed.percent,59.5);
 assert.equal(summary([row('start',{state:'started'}),paused]).state,'started');
 const done=row('done',{state:'completed',updatedAt:1100}),cancelled=row('cancel',{state:'cancelled',updatedAt:1200});
 assert.deepEqual(summary([cancelled,done]),{state:'cancelled',count:0,percent:25,item:cancelled});
 assert.deepEqual(summary([]),{state:'idle',count:0,percent:null,item:null});
});

test('pane tasks carry exact ownership and privacy with no URL, filesystem path or native object',()=>{
 const input=row('download-1',{url:'https://private.invalid/a',path:'/private/private-file',nativeObject:{secret:true}});
 const result=task(input,true,'en');assert.equal(result.id,'download:download-1');assert.equal(result.taskId,'download-1');assert.equal(result.tabId,'tab-a');assert.equal(result.desk,'desk-a');assert.equal(result.privateMode,true);assert.equal(result.estimated,false);assert.equal(result.received,25);assert.equal(result.total,100);
 for(const key of ['url','path','nativeObject'])assert.equal(Object.hasOwn(result,key),false);
 for(const [state,phase]of [['completed','completed'],['cancelled','stopped'],['error','error'],['paused','running']])assert.equal(task(row('a',{state}),false).phase,phase);
 assert.match(description(row('a',{received:2048,total:4096}),'en'),/^Downloading · 2\.0 KB \/ 4\.0 KB$/);
 assert.match(description(row('a',{state:'paused'}),'ru'),/^Пауза · /);
});

// The fixture implements only ordinary DOM text, attributes, tree membership,
// and a deterministic clock. It never simulates a browser presentation frame.
function fixture({privateMode=false,items=[],payloadPrivate=privateMode,locale='ru',handler}={}){
 let time=1000,sequence=0,snapshot={privateMode:payloadPrivate,items},listener=null,unsubscribed=0,changed=0,calls=0;
 const timers=new Map();
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.className='';this.hidden=false;this.textWrites=0;this._text='';this.layoutReads=0;this.style={values:{},setProperty(name,value){this.values[name]=value;}};}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.textWrites++;this._text=String(value);for(const child of this.children)child.parentNode=null;this.children=[];}
  get classList(){return{add:name=>{if(!this.className.split(/\s+/).includes(name))this.className=(this.className+' '+name).trim();}};}
  setAttribute(name,value){this.attributes[name]=String(value);if(name==='class')this.className=String(value);if(name==='id')this.id=String(value);if(name==='hidden')this.hidden=true;}
  getAttribute(name){return this.attributes[name]??null;}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentNode=this;}}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
  querySelector(selector){const match=node=>selector[0]==='.'?node.className.split(/\s+/).includes(selector.slice(1)):selector[0]==='#'?node.id===selector.slice(1):node.tagName===selector.toUpperCase();for(const child of this.children){if(match(child))return child;const nested=child.querySelector(selector);if(nested)return nested;}return null;}
  get offsetWidth(){this.layoutReads++;return this.hidden?0:100;}
  set innerHTML(html){
   this.textContent='';const stack=[this];
   for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('</')){stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1)._text+=token;continue;}
    const match=/^<([\w-]+)([^>]*)>/.exec(token);if(!match)continue;const node=new Element(match[1]);
    for(const attr of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g))node.setAttribute(attr[1],attr[2]??'');
    stack.at(-1).append(node);if(!/\/$/.test(match[2])&&!['input','img','br'].includes(match[1]))stack.push(node);
   }
  }
 }
 const root=new Element('html'),footer=new Element('footer'),button=new Element('button'),stage=new Element('section'),canvas=new Element('canvas');root.dataset.private=String(privateMode);button.id='downloads-button';footer.append(button);root.append(footer,stage);stage.append(canvas);
 const document={documentElement:root,querySelector:selector=>root.querySelector(selector),createElement:tag=>new Element(tag)};
 const setTimer=(callback,delay)=>{const id=++sequence;timers.set(id,{at:time+delay,callback});return id;},clearTimer=id=>timers.delete(id);
 const N={library:action=>{assert.equal(action,'download-activity');calls++;return handler?handler():structuredClone(snapshot);},onLibrary:fn=>{listener=fn;return()=>{unsubscribed++;listener=null;};}};
 const api=createMouseDownloadActivity({N,document,locale:()=>locale,now:()=>time,setTimer,clearTimer,changed:()=>changed++});
 return{api,document,button,stage,canvas,footer,timers,setTimer,clearTimer,get now(){return time;},get calls(){return calls;},get changed(){return changed;},get unsubscribed(){return unsubscribed;},get live(){return footer.querySelector('.mouse-activity-announcement');},setSnapshot(value){snapshot=value;},emit(){listener?.();},setMode(value){root.dataset.private=String(value);api.render();},advance(to){assert.ok(to>=time);for(;;){const next=[...timers].filter(([,timer])=>timer.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].callback();}time=to;}};
}

test('the renderer displays active bytes, pause and completion without replaying identical announcements',async()=>{
 const f=fixture({items:[row('file')]});await flush();assert.equal(f.calls,1);assert.equal(f.button.dataset.downloadState,'downloading');assert.equal(f.button.style.values['--download-progress'],'25');assert.equal(f.button.getAttribute('aria-busy'),'true');assert.equal(f.button.querySelector('.mouse-download-label').textContent,'25%');
 const writes=f.live.textWrites;await f.api.refresh();assert.equal(f.live.textWrites,writes,'the same state never announces every byte update');
 f.setSnapshot({privateMode:false,items:[row('file',{state:'paused',received:40,updatedAt:1100})]});await f.api.refresh();assert.equal(f.button.getAttribute('aria-busy'),'false');assert.equal(f.button.querySelector('.mouse-download-label').textContent,'Пауза');assert.match(f.live.textContent,/Пауза/);
 f.setSnapshot({privateMode:false,items:[row('file',{state:'completed',updatedAt:1200,expiresAt:2000})]});await f.api.refresh();assert.equal(f.button.dataset.active,'false');assert.equal(f.button.querySelector('.mouse-download-label').textContent,'Готово');assert.equal(f.api.tasks()[0].phase,'completed');f.api.destroy();
});

test('unknown size remains visibly indeterminate and multiple transfers retain their count',async()=>{
 const f=fixture({items:[row('known'),row('stream',{total:0})]});await flush();assert.equal(f.button.dataset.indeterminate,'true');assert.equal(f.button.dataset.downloadCount,'2');assert.equal(f.button.querySelector('.mouse-download-label').textContent,'2 · …');assert.equal(f.button.style.values['--download-progress'],'0');assert.match(f.button.title,/Активных: 2/);f.api.destroy();
});

test('privacy mismatches expose neither tasks nor filename announcements and exact private sessions work',async()=>{
 const f=fixture({privateMode:true,payloadPrivate:false,items:[row('normal-secret')]});await flush();assert.deepEqual(f.api.tasks(),[]);assert.equal(f.button.dataset.downloadState,'idle');assert.equal(f.live.textContent,'');assert.equal(f.button.title.includes('normal-secret'),false);
 f.setSnapshot({privateMode:true,items:[row('private-secret')]});await f.api.refresh();assert.equal(f.api.tasks()[0].privateMode,true);assert.match(f.live.textContent,/private-secret/);
 f.setMode(false);assert.deepEqual(f.api.tasks(),[]);assert.equal(f.button.dataset.downloadState,'idle');assert.equal(f.live.textContent,'');assert.equal(f.button.getAttribute('aria-label').includes('private-secret'),false);f.api.destroy();
});

test('untrusted filenames remain literal text and pane dismissal does not hide the ongoing global transfer',async()=>{
 const filename='<img src=x onerror=alert(1)>.zip',f=fixture({items:[row('file',{filename})]});await flush();assert.ok(f.live.textContent.endsWith(filename));assert.equal(f.live.querySelector('img'),null);assert.equal(f.api.tasks()[0].label,filename);
 f.api.dismiss('download:file');assert.deepEqual(f.api.tasks(),[]);assert.equal(f.button.dataset.active,'true');assert.equal(f.button.dataset.downloadCount,'1');f.api.destroy();
});

test('terminal expiry clears visible and accessible metadata without another library IPC',async()=>{
 const f=fixture({items:[row('expired-secret')]});await flush();f.setSnapshot({privateMode:false,items:[row('expired-secret',{state:'completed',expiresAt:1500})]});await f.api.refresh();const calls=f.calls;assert.match(f.live.textContent,/expired-secret/);assert.equal(f.timers.size,1);
 f.advance(1499);assert.equal(f.api.tasks().length,1);f.advance(1500);assert.deepEqual(f.api.tasks(),[]);assert.equal(f.button.dataset.downloadState,'idle');assert.equal(f.button.querySelector('.mouse-download-label').hidden,true);assert.equal(f.live.textContent,'');assert.equal(f.button.title.includes('expired-secret'),false);assert.equal(f.calls,calls);assert.equal(f.timers.size,0);f.api.destroy();
});

test('library event bursts serialize requests and obtain one fresh snapshot after an in-flight request',async()=>{
 const requests=[];let active=0,peak=0;const f=fixture({handler:()=>{active++;peak=Math.max(peak,active);return new Promise(resolve=>requests.push(value=>{active--;resolve(value);}));}});await flush();assert.equal(f.calls,1);
 for(let i=0;i<20;i++)f.emit();assert.equal(f.calls,1);requests.shift()({privateMode:false,items:[row('older')]});await flush();assert.equal(f.calls,2);assert.equal(peak,1);
 requests.shift()({privateMode:false,items:[row('latest')]});await flush();assert.equal(f.calls,2);assert.equal(f.api.tasks()[0].taskId,'latest');f.api.destroy();
});

test('destroy unsubscribes, clears metadata and timers, and a late native response cannot resurrect the indicator',async()=>{
 let resolve;const f=fixture({handler:()=>new Promise(done=>{resolve=done;})});await flush();const live=f.live;f.api.destroy();assert.equal(f.unsubscribed,1);assert.equal(f.live,null);assert.equal(live.parentNode,null);assert.equal(f.button.dataset.downloadState,'idle');assert.equal(f.timers.size,0);
 resolve({privateMode:false,items:[row('late-secret')]});await flush();assert.deepEqual(f.api.tasks(),[]);assert.equal(f.button.title.includes('late-secret'),false);const calls=f.calls;f.emit();await f.api.refresh();assert.equal(f.calls,calls);
});

test('capture feedback remains a canvas sibling and repeated actions replace the old lifetime',async()=>{
 const f=fixture();await flush();const feedback=createMouseCaptureFeedback({stage:f.stage,document:f.document,locale:()=> 'en',setTimer:f.setTimer,clearTimer:f.clearTimer}),node=f.stage.querySelector('.capture-shutter-feedback');
 assert.equal(node.hidden,true);assert.equal(f.stage.children[0],f.canvas);assert.equal(f.canvas.children.length,0);assert.equal(node.getAttribute('aria-hidden'),'true');
 feedback.show('capture');assert.equal(node.hidden,false);assert.equal(f.stage.dataset.captureFeedback,'capture');assert.equal(node.querySelector('strong').textContent,'Screenshot ready');
 f.advance(1500);feedback.show('save');assert.equal(node.querySelector('strong').textContent,'PNG saved');f.advance(2050);assert.equal(node.hidden,false,'the old capture timer cannot erase a newer confirmation');f.advance(2900);assert.equal(node.hidden,true);assert.equal(f.stage.dataset.captureFeedback,undefined);
 feedback.show('copy');assert.equal(node.querySelector('strong').textContent,'Copied');feedback.clear();assert.equal(node.hidden,true);assert.equal(f.timers.size,0);feedback.destroy();assert.deepEqual(f.stage.children,[f.canvas]);f.api.destroy();
});

test('unsupported capture events never create a success cue and explicit clear cancels pending feedback',async()=>{
 const f=fixture();await flush();const feedback=createMouseCaptureFeedback({stage:f.stage,document:f.document,setTimer:f.setTimer,clearTimer:f.clearTimer}),node=f.stage.querySelector('.capture-shutter-feedback');
 for(const kind of ['error','cancelled','pending',null])feedback.show(kind);assert.equal(node.hidden,true);assert.equal(f.timers.size,0);
 feedback.show('capture');assert.match(node.querySelector('strong').textContent,/Снимок готов/);feedback.clear();f.advance(10000);assert.equal(node.hidden,true);assert.equal(f.stage.dataset.captureFeedback,undefined);feedback.destroy();f.api.destroy();
});


test('completion bounce occurs once for a native event while the unread badge survives item expiry',async()=>{
 const f=fixture({items:[row('file')]});await flush();f.setSnapshot({privateMode:false,items:[row('file',{state:'completed',expiresAt:2200})],unreadCount:1,completedSerial:1});await f.api.refresh();assert.equal(f.button.dataset.completionBounce,'true');assert.equal(f.button.querySelector('.mouse-download-badge').textContent,'1');assert.equal(f.button.querySelector('.mouse-download-badge').hidden,false);
 f.advance(1700);assert.equal(f.button.dataset.completionBounce,'false');await f.api.refresh();assert.equal(f.button.dataset.completionBounce,'false','an identical snapshot cannot replay completion');f.advance(2200);assert.equal(f.button.dataset.downloadState,'idle');assert.equal(f.button.querySelector('.mouse-download-badge').hidden,false);assert.equal(f.api.snapshot().unreadCount,1);
 f.setSnapshot({privateMode:false,items:[],unreadCount:0,completedSerial:1});await f.api.refresh();assert.equal(f.button.querySelector('.mouse-download-badge').hidden,true);f.api.destroy();
});
test('initial completed downloads and privacy mismatches never replay completion or leak badge counts',async()=>{
 const f=fixture({privateMode:true,payloadPrivate:false});await flush();f.setSnapshot({privateMode:false,items:[row('hidden',{state:'completed'})],unreadCount:7,completedSerial:9});await f.api.refresh();assert.equal(f.button.dataset.unreadCount,'0');assert.equal(f.api.snapshot().unreadCount,0);assert.notEqual(f.button.dataset.completionBounce,'true');
 f.setSnapshot({privateMode:true,items:[],unreadCount:2,completedSerial:2});await f.api.refresh();assert.equal(f.button.dataset.unreadCount,'2');assert.notEqual(f.button.dataset.completionBounce,'true');f.setMode(false);assert.equal(f.button.dataset.unreadCount,'0');f.api.destroy();
});
