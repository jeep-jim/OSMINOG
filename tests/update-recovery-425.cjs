'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../osminog-update-recovery.js'),'utf8');
const KEY='briefCraftReopenAfterUpdateV1',url='chrome-extension://fixture/editor.html';
function fixture(){
 const handlers={},timers=[],data={[KEY]:{at:Date.now(),url:'editor.html'}},calls=[];let tabs=[{id:3,url}],fail=false;
 const event=name=>({addListener:fn=>handlers[name]=fn});
 const chrome={runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,getManifest:()=>({version:'4.0.25'}),onMessage:event('message'),onStartup:event('startup'),onInstalled:event('installed')},storage:{local:{get:async k=>({[k]:data[k]}),remove:async k=>delete data[k]}},tabs:{query:async()=>tabs,update:async(id,p)=>{calls.push(['update',id,p]);if(fail)throw Error('tab vanished');return{id,...p}},create:async p=>{calls.push(['create',p]);const t={id:9,...p};tabs.push(t);return t},onRemoved:event('removed')}};
 const ctx={chrome,Date,console:{warn(){}},setTimeout:fn=>{timers.push(fn);return fn},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1)}};
 vm.runInNewContext(source,ctx);
 return{data,calls,handlers,fail:()=>fail=true,tabs:t=>tabs=t,async step(){const fn=timers.shift();if(fn)await fn();await new Promise(r=>setImmediate(r))},async ready(sender={id:'fixture',url,tab:{id:9}}){return new Promise(r=>{const accepted=handlers.message({type:'OSMINOG_EDITOR_READY',version:'4.0.25'},sender,r);if(!accepted)r(null)})}};
}
test('old disappearing tab cannot consume the reopen marker; new editor ACK does',async()=>{const f=fixture();await f.step();assert.equal(f.calls[0][0],'update');assert(f.data[KEY]);f.tabs([]);await f.step();assert.equal(f.calls[1][0],'create');assert(f.data[KEY]);await f.ready();assert.equal(f.data[KEY],undefined)});
test('a failed tab activation preserves the request and retries without losing it',async()=>{const f=fixture();f.fail();await f.step();assert(f.data[KEY]);f.tabs([]);await f.step();assert.equal(f.calls.at(-1)[0],'create');assert(f.data[KEY])});
test('foreign pages cannot acknowledge recovery; repeated lifecycle events do not duplicate tabs',async()=>{const f=fixture();await f.ready({id:'fixture',url:'https://example.com'});assert(f.data[KEY]);f.tabs([]);f.handlers.startup();f.handlers.installed();await f.step();await f.step();assert.equal(f.calls.filter(c=>c[0]==='create').length,1)});
test('expired requests do not reopen an unwanted workspace',async()=>{const f=fixture();f.data[KEY].at=Date.now()-700000;await f.step();assert.equal(f.calls.length,0);assert.equal(f.data[KEY],undefined)});
