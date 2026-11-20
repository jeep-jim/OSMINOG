'use strict';
// Execute the shipped UI functions against a small DOM and fake native bridge.
// This verifies state/call semantics; installed-app pixels remain a native gate.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'mouse',name),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

function dom(){
 const htmlWrites=[],document={activeElement:null};
 const decode=value=>String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
 function simple(element,selector){
  if(element.nodeType!==1)return false;
  const plain=selector.replace(/\[[^\]]*\]/g,'');
  const tag=/^[a-z][\w-]*/i.exec(plain);if(tag&&element.localName!==tag[0].toLowerCase())return false;
  for(const match of plain.matchAll(/([.#])([\w-]+)/g))if(match[1]==='#'?element.id!==match[2]:!element.className.split(/\s+/).includes(match[2]))return false;
  for(const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(match[2]===undefined?element.getAttribute(match[1])===null:element.getAttribute(match[1])!==match[2])return false;
  return true;
 }
 function matches(element,selector){
  const parts=selector.trim().split(/\s+/);let current=element;if(!simple(current,parts.pop()))return false;
  while(parts.length){const part=parts.pop();current=current.parentElement;while(current&&!simple(current,part))current=current.parentElement;if(!current)return false;}return true;
 }
 function descendants(node){const out=[];for(const child of node.children){out.push(child,...descendants(child));}return out;}
 class Element{
  constructor(tag){this.nodeType=1;this.localName=tag.toLowerCase();this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.id='';this.className='';this.hidden=false;this.disabled=false;this.checked=false;this.open=false;this.readOnly=false;this.value='';this._text='';this.style={values:{},setProperty(name,value){this.values[name]=value;}};this.clientWidth=360;this.clientHeight=170;this.scrollHeight=170;this.scrollTop=0;}
  get parentNode(){return this.parentElement;}
  get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
  get classList(){return{contains:name=>this.className.split(/\s+/).includes(name),add:name=>{if(!this.className.split(/\s+/).includes(name))this.className=(this.className+' '+name).trim();},remove:name=>{this.className=this.className.split(/\s+/).filter(v=>v!==name).join(' ');},toggle:(name,force)=>{const next=force??!this.className.split(/\s+/).includes(name);if(next)this.classList.add(name);else this.classList.remove(name);return next;}};}
  setAttribute(name,value){value=String(value);this.attributes[name]=value;if(name==='id')this.id=value;else if(name==='class')this.className=value;else if(name==='value')this.value=value;else if(name==='type')this.type=value;else if(['hidden','disabled','checked','open'].includes(name))this[name]=true;else if(name==='readonly')this.readOnly=true;else if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
  getAttribute(name){if(name==='id')return this.id||null;if(name==='class')return this.className||null;if(name.startsWith('data-')){const key=name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return Object.hasOwn(this.dataset,key)?this.dataset[key]:null;}return Object.hasOwn(this.attributes,name)?this.attributes[name]:null;}
  removeAttribute(name){delete this.attributes[name];if(['hidden','disabled','checked','open'].includes(name))this[name]=false;}
  append(...nodes){for(const node of nodes){if(typeof node==='string'){this._text+=node;continue;}node.remove();node.parentElement=this;this.children.push(node);}}
  prepend(node){node.remove();node.parentElement=this;this.children.unshift(node);}
  before(node){const parent=this.parentElement,index=parent.children.indexOf(this);node.remove();node.parentElement=parent;parent.children.splice(index,0,node);}
  after(node){const parent=this.parentElement,index=parent.children.indexOf(this);node.remove();node.parentElement=parent;parent.children.splice(index+1,0,node);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.parentElement=null;}
  replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
  querySelectorAll(selector){return descendants(this).filter(element=>matches(element,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  contains(element){for(let node=element;node;node=node.parentElement)if(node===this)return true;return false;}
  get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value);}
  set innerHTML(value){
   htmlWrites.push({element:this,value});this.replaceChildren();const stack=[this],voids=new Set(['input','img','br','meta','link']);
   for(const token of String(value).match(/<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('</')){stack.pop();continue;}
    if(!token.startsWith('<')){stack.at(-1)._text+=decode(token);continue;}
    const match=/^<([\w-]+)([^>]*)>/.exec(token);if(!match)continue;const element=new Element(match[1]);
    for(const attr of match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s=]+)))?/g))element.setAttribute(attr[1],decode(attr[2]??attr[3]??attr[4]??''));
    stack.at(-1).append(element);if(!voids.has(element.localName)&&!token.endsWith('/>'))stack.push(element);
   }
  }
  focus(){document.activeElement=this;}
  scrollIntoView(){this.scrolled=true;}
  click(){if(this.disabled)return;return this.onclick?.({target:this,preventDefault(){}});}
  change(checked){if(this.disabled)return;this.checked=checked;return this.onchange?.({target:this});}
  submit(){return this.onsubmit?.({target:this,preventDefault(){}});}
  getContext(){return{font:'',measureText:()=>({width:7})};}
 }
 document.body=new Element('body');document.createElement=tag=>new Element(tag);document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.activeElement=document.body;
 const workspace=document.createElement('main');workspace.id='workspace';document.body.append(workspace);return{document,htmlWrites};
}
const file=(name='src/main.js',extra={})=>({path:name,name:name.split('/').at(-1),type:'file',depth:name.split('/').length,size:4,modifiedAt:100,...extra});
const initial=(extra={})=>({enabled:false,autonomous:false,running:false,connected:0,desk:'desk-1',port:0,connectionUrl:'',folder:'/project',terminal:false,pending:null,logs:[],local:{connected:true,writeAllowed:false,commandsAllowed:false,busy:false,tree:{entries:[file()],truncated:false},dev:{enabled:false,running:false,command:'',autoRestart:false}},...extra});
function fixture(start=initial()){
 const {document,htmlWrites}=dom(),calls=[],messages=[],handlers=new Map(),subscriptions=new Map(),timers=new Map(),terminalEvents=[];let current=copy(start),timerId=0;
 const model={desktopId:'desk-1',agentOpen:true,privateMode:false,focusPane:'',focusAI:false,libraryOpen:false},listener=(name,fn)=>{subscriptions.set(name,fn);return()=>subscriptions.delete(name);};
 const N={agent:async(action,args={})=>{calls.push({action,args:copy(args)});return handlers.has(action)?handlers.get(action)(args):copy(current);},onAgent:fn=>listener('state',fn),onTerminal:fn=>listener('terminal',fn),onAgentOpen:fn=>listener('open',fn)};
 const window={events:new Map(),addEventListener(name,fn){this.events.set(name,fn);},removeEventListener(name){this.events.delete(name);}};
 class Terminal{constructor(){this.cols=0;this.rows=0;terminalEvents.push(['create']);}open(){terminalEvents.push(['open']);}onData(fn){this.input=fn;terminalEvents.push(['onData',fn]);}write(value){terminalEvents.push(['write',value]);}resize(cols,rows){this.cols=cols;this.rows=rows;terminalEvents.push(['resize',cols,rows]);}focus(){terminalEvents.push(['focus']);}dispose(){terminalEvents.push(['dispose']);}}
 const context={document,window,navigator:{clipboard:{writeText:async value=>messages.push('clipboard:'+value)}},Terminal,ResizeObserver:class{observe(){}disconnect(){terminalEvents.push(['observer-disconnect']);}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(source('local-workspace.js'),context);vm.runInContext(source('agent-onboarding.js'),context);vm.runInContext(source('agent-ui.js'),context);
 const activated=[],ui=context.createMouseAgentUI({N,model,layout(){},status:message=>messages.push(message),activateTab:id=>activated.push(id)}),$=selector=>document.querySelector(selector);
 return{ui,model,N,document,htmlWrites,calls,messages,handlers,subscriptions,terminalEvents,activated,$,state:()=>copy(current),emit(next){current=copy(next);subscriptions.get('state')(copy(current));},async ready(){await tick();calls.length=0;},rows(){return document.querySelectorAll('.agent-local-entry');},row(name){return this.rows().find(e=>e.dataset.path===name);},flush:tick,runTimers(){const all=[...timers.values()];timers.clear();for(const t of all)t.fn();},dispose(){ui.dispose();}};
}

test('Local is integrated before Agent UI; folder selection lives in Local and preview is read-only',async()=>{
 const html=source('index.html');assert.ok(html.indexOf('src="local-workspace.js"')<html.indexOf('src="agent-ui.js"'));assert.ok(html.indexOf('href="local-workspace.css"')<html.indexOf('href="mouse-628.css"'));
 const f=fixture();await f.ready();assert.ok(f.$('#agent-local-workspace').contains(f.$('#agent-folder')));assert.equal(f.$('#agent-model-settings').contains(f.$('#agent-folder')),false);assert.equal(f.$('.agent-local-file-content').readOnly,true);assert.ok(f.$('#agent-local-tree [data-local-path="src/main.js"]'),'the native fixture selector resolves a real generated row');
 assert.equal(f.$('#agent-stop').disabled,false,'The read-only MCP child can be stopped before the agent gateway is enabled');assert.equal(f.$('#agent-local-refresh').disabled,false);assert.equal(f.$('#agent-local-write').disabled,true);assert.equal(f.$('#agent-local-commands').disabled,true);assert.equal(f.$('#agent-terminal-start').disabled,true);assert.equal(f.$('#agent-local-dev-start').disabled,true);f.dispose();
});
test('Ollama onboarding is optional, reads only after a click and changes model settings only after selection',async()=>{
 const f=fixture();await f.ready();assert.deepEqual(f.calls,[]);f.ui.focus();assert.equal(f.$('#agent-ollama-setup').open,true);assert.equal(f.$('#agent-panel').getAttribute('aria-label'),'Агент Маус');
 f.$('#agent-endpoint').value='https://chosen.example/v1/';f.$('#agent-model').value='owner-model';f.$('#agent-key').value='fixture-session-key';
 const name='model:<img onerror=fixture>';f.handlers.set('ollama-models',async()=>({available:true,models:[{name,size:5}]}));await f.$('#agent-ollama-check').click();assert.equal(f.$('#agent-endpoint').value,'https://chosen.example/v1/');assert.equal(f.$('#agent-model').value,'owner-model');assert.equal(f.$('#agent-key').value,'fixture-session-key');assert.equal(f.$('#agent-ollama-models-label').hidden,false);assert.equal(f.$('#agent-ollama-models option').textContent,name);assert.equal(f.document.querySelectorAll('img').length,1);
 f.$('#agent-ollama-use').click();assert.equal(f.$('#agent-endpoint').value,'http://127.0.0.1:11434/v1/');assert.equal(f.$('#agent-model').value,name);assert.equal(f.$('#agent-key').value,'');assert.deepEqual(f.calls.map(x=>x.action),['ollama-models']);assert.equal(f.state().enabled,false);assert.equal(f.$('#agent-autonomous').checked,false);f.dispose();
});
test('unavailable and empty Ollama states cannot fabricate a usable model or silently change an API',async()=>{
 const f=fixture();await f.ready();f.$('#agent-endpoint').value='https://chosen.example/v1/';f.$('#agent-model').value='owner-model';
 f.handlers.set('ollama-models',async()=>({available:false,reason:'Offline fixture',models:[]}));await f.$('#agent-ollama-check').click();assert.equal(f.$('#agent-ollama-use').hidden,true);assert.equal(f.$('#agent-ollama-status').textContent,'Offline fixture');
 f.handlers.set('ollama-models',async()=>({available:true,models:[]}));await f.$('#agent-ollama-check').click();assert.equal(f.$('#agent-ollama-use').hidden,true);assert.match(f.$('#agent-ollama-status').textContent,/Скачайте/);assert.equal(f.$('#agent-model').value,'owner-model');assert.equal(f.$('#agent-endpoint').value,'https://chosen.example/v1/');f.dispose();
});
test('Ollama help uses only the native named help route; a late probe cannot resurrect a disposed panel',async()=>{
 const f=fixture();await f.ready();for(const page of ['download','models','guide'])await f.$('[data-ollama-page="'+page+'"]').click();assert.deepEqual(f.calls,[{action:'ollama-help',args:{page:'download'}},{action:'ollama-help',args:{page:'models'}},{action:'ollama-help',args:{page:'guide'}}]);
 const wait=deferred();f.handlers.set('ollama-models',()=>wait.promise);const checking=f.$('#agent-ollama-check').click();await f.flush();assert.equal(f.$('#agent-ollama-check').disabled,true);const model=f.$('#agent-model');f.dispose();wait.resolve({available:true,models:[{name:'late'}]});await checking;assert.equal(model.value,'');assert.equal(f.$('#agent-panel'),null);
});
test('settings sidebar hides the agent surface without revoking its session; section links grant no permissions',async()=>{
 const f=fixture(initial({enabled:true,desk:'desk-1',local:{...initial().local,commandsAllowed:false,writeAllowed:false}}));await f.ready();f.model.settingsOpen=true;f.ui.sync();assert.equal(f.$('#agent-panel').hidden,true);assert.deepEqual(f.calls,[]);
 f.model.settingsOpen=false;f.ui.focusSettings('permissions');assert.equal(f.$('#agent-panel').hidden,false);assert.equal(f.$('#agent-local-workspace').open,true);assert.equal(f.$('#agent-local-workspace').scrolled,true);assert.equal(f.$('#agent-local-write').checked,false);assert.equal(f.$('#agent-local-commands').checked,false);assert.deepEqual(f.calls,[]);f.ui.focusSettings('ollama');assert.equal(f.$('#agent-ollama-setup').open,true);f.dispose();
});
test('human preview uses structuredContent only and treats filenames/content as literal data',async()=>{
 const name='src/<img onerror=attack>.js',f=fixture(initial({local:{...initial().local,tree:{entries:[file(name)]}}}));await f.ready();
 const content='<script>attack()</script>\nexport const value = 7;';f.handlers.set('local-call',async args=>({structuredContent:{path:args.arguments.path,content,bytes:Buffer.byteLength(content)},content:[{type:'text',text:'wrong transport fallback'}]}));
 f.row(name).click();await f.flush();assert.deepEqual(f.calls,[{action:'local-call',args:{name:'read_file',arguments:{path:name}}}]);assert.equal(f.$('.agent-local-file-name').textContent,name);assert.equal(f.$('.agent-local-file-content').value,content);assert.equal(f.$('.agent-local-preview').hidden,false);assert.equal(f.document.querySelectorAll('script').length,0);assert.equal(f.document.querySelectorAll('img').length,1);assert.ok(f.htmlWrites.every(write=>!write.value.includes(content)));assert.equal(f.$('.agent-local-file-content').readOnly,true);f.dispose();
});
test('file changes require explicit preview refresh, while close removes all cached preview text',async()=>{
 const f=fixture();await f.ready();let revision=0;f.handlers.set('local-call',async args=>({structuredContent:{path:args.arguments.path,content:'revision-'+(++revision),bytes:10}}));f.row('src/main.js').click();await f.flush();assert.equal(f.$('.agent-local-file-content').value,'revision-1');
 const next=f.state();next.local.tree.entries[0].modifiedAt++;f.emit(next);assert.match(f.$('.agent-local-file-status').textContent,/Файл изменился/);assert.equal(f.calls.length,1,'Filesystem notification does not silently replace a human preview');
 f.$('#agent-local-file-refresh').click();await f.flush();assert.equal(f.$('.agent-local-file-content').value,'revision-2');assert.equal(f.calls.length,2);f.$('#agent-local-file-close').click();assert.equal(f.$('.agent-local-preview').hidden,true);assert.equal(f.$('.agent-local-file-content').value,'');assert.equal(f.$('.agent-local-file-name').textContent,'');f.dispose();
});
test('directory folding hides descendants and blocked entries never call the file bridge',async()=>{
 const f=fixture(initial({local:{...initial().local,tree:{entries:[file('src',{type:'directory'}),file(),file('link',{type:'blocked'})]}}}));await f.ready();assert.equal(f.row('src').getAttribute('aria-expanded'),'true');
 f.row('src').click();assert.equal(f.row('src').getAttribute('aria-expanded'),'false');assert.equal(f.row('src/main.js'),undefined);f.row('src').click();assert.ok(f.row('src/main.js'));assert.equal(f.row('link').disabled,true);f.row('link').click();await f.flush();assert.deepEqual(f.calls,[]);f.dispose();
});
test('empty-folder status updates on reconnect instead of retaining the disconnected label',async()=>{
 const s=initial({folder:'',local:{...initial().local,connected:false,tree:null}}),f=fixture(s);await f.ready();assert.match(f.$('.agent-local-empty').textContent,/Выберите папку/);
 f.emit(initial({folder:'/empty',local:{...initial().local,tree:{entries:[],truncated:false}}}));assert.equal(f.$('.agent-local-empty').textContent,'Папка пуста');f.dispose();
});
test('late reads cannot revive a closed, replaced, revoked or disposed preview',async()=>{
 for(const change of ['close','folder','revoke','dispose']){
  const f=fixture();await f.ready();const result=deferred();f.handlers.set('local-call',()=>result.promise);f.row('src/main.js').click();await f.flush();const preview=f.$('.agent-local-preview'),content=f.$('.agent-local-file-content');
  if(change==='close')f.$('#agent-local-file-close').click();else if(change==='folder')f.emit({...f.state(),folder:'/different'});else if(change==='revoke')f.emit({...f.state(),enabled:false,local:{...f.state().local,connected:false,tree:null}});else f.dispose();
  result.resolve({structuredContent:{path:'src/main.js',content:'old secret',bytes:10}});await f.flush();assert.equal(preview.hidden,true,change);assert.equal(content.value,'',change);if(change!=='dispose')f.dispose();
 }
 const f=fixture(initial({local:{...initial().local,tree:{entries:[file('a.txt'),file('b.txt')]}}}));await f.ready();const a=deferred(),b=deferred();f.handlers.set('local-call',args=>args.arguments.path==='a.txt'?a.promise:b.promise);f.row('a.txt').click();f.row('b.txt').click();b.resolve({structuredContent:{path:'b.txt',content:'new selection',bytes:13}});await f.flush();a.resolve({structuredContent:{path:'a.txt',content:'obsolete selection',bytes:18}});await f.flush();assert.equal(f.$('.agent-local-file-name').textContent,'b.txt');assert.equal(f.$('.agent-local-file-content').value,'new selection');f.dispose();
});
test('revoked and private host snapshots clear preview before a different desk is shown',async()=>{
 const f=fixture(initial({enabled:true}));await f.ready();f.handlers.set('local-call',async()=>({structuredContent:{path:'src/main.js',content:'private fixture text',bytes:20}}));f.row('src/main.js').click();await f.flush();assert.equal(f.$('.agent-local-preview').hidden,false);
 f.emit({...f.state(),enabled:false,local:{...f.state().local,connected:false,tree:null}});f.model.desktopId='desk-2';f.ui.sync();assert.equal(f.$('.agent-local-file-content').value,'');assert.equal(f.$('.agent-local-preview').hidden,true);
 f.model.privateMode=true;f.emit({...f.state(),folder:'',local:null,desk:''});assert.equal(f.$('#agent-panel').hidden,true);assert.equal(f.$('.agent-local-file-content').value,'');f.dispose();
});
test('autonomy, file write and terminal permission remain independent actual controls',async()=>{
 const f=fixture();await f.ready();f.$('#agent-local-write').change(true);f.$('#agent-local-commands').change(true);await f.flush();assert.deepEqual(f.calls,[],'disabled grants cannot be clicked before enable');
 f.handlers.set('enable',async args=>({...f.state(),enabled:true,autonomous:args.autonomous,connectionUrl:'ws://fixture',port:args.port}));f.$('#agent-autonomous').change(true);f.$('#agent-enable').click();await f.flush();assert.deepEqual(f.calls[0],{action:'enable',args:{port:9222,autonomous:true}});assert.equal(f.$('#agent-autonomous').disabled,true);assert.equal(f.$('#agent-local-write').checked,false);assert.equal(f.$('#agent-local-commands').checked,false);assert.equal(f.$('#agent-terminal-start').disabled,true);
 f.handlers.set('local-permissions',async args=>({...f.ui.state(),local:{...f.ui.state().local,writeAllowed:args.write,commandsAllowed:args.commands}}));f.$('#agent-local-commands').change(true);await f.flush();assert.deepEqual(f.calls.at(-1),{action:'local-permissions',args:{write:false,commands:true}});assert.equal(f.$('#agent-terminal-start').disabled,false);assert.equal(f.$('#agent-local-auto').disabled,true);
 f.$('#agent-local-write').change(true);await f.flush();assert.deepEqual(f.calls.at(-1),{action:'local-permissions',args:{write:true,commands:true}});assert.equal(f.$('#agent-local-auto').disabled,false);f.dispose();
});
test('managed dev command is explicit, keeps its restart opt-in, and streams through the existing terminal',async()=>{
 const f=fixture(initial({enabled:true,local:{...initial().local,writeAllowed:true,commandsAllowed:true}}));await f.ready();f.$('#agent-local-dev-form').submit();await f.flush();assert.equal(f.calls.length,0);assert.equal(f.document.activeElement,f.$('#agent-local-dev-command'));
 f.$('#agent-local-dev-command').value=' npm run dev -- --host 127.0.0.1 ';f.$('#agent-local-auto').change(true);f.handlers.set('local-dev',async args=>({...f.state(),local:{...f.state().local,dev:{enabled:true,running:true,command:args.command,autoRestart:args.autoRestart}}}));f.$('#agent-local-dev-form').submit();await f.flush();assert.deepEqual(f.calls.at(-1),{action:'local-dev',args:{command:'npm run dev -- --host 127.0.0.1',enabled:true,autoRestart:true}});assert.ok(f.terminalEvents.some(e=>e[0]==='open'));assert.equal(f.$('#agent-local-dev-stop').disabled,false);f.subscriptions.get('terminal')('actual dev stdout');assert.ok(f.terminalEvents.some(e=>e[0]==='write'&&e[1]==='actual dev stdout'));
 f.$('#agent-local-dev-stop').click();await f.flush();assert.equal(f.calls.at(-1).action,'local-dev-stop');f.dispose();
});
test('Agent Stop before enable closes read-only Local, while localhost and existing approvals keep their routes',async()=>{
 const f=fixture();await f.ready();f.handlers.set('stop',async()=>({...f.state(),enabled:false,local:{...f.state().local,connected:false,tree:null}}));f.$('#agent-stop').click();await f.flush();assert.equal(f.calls.at(-1).action,'stop');assert.equal(f.$('#agent-stop').disabled,true);
 f.$('#agent-local-port').value='5173';f.$('.agent-localhost').submit();await f.flush();assert.deepEqual(f.calls.at(-1),{action:'localhost',args:{port:5173}});
 f.emit({...f.state(),enabled:true,pending:{id:'own-approval',summary:'Run the selected command'}});f.$('#agent-allow').click();await f.flush();assert.deepEqual(f.calls.at(-1),{action:'approve',args:{id:'own-approval',allow:true}});f.subscriptions.get('open')({id:'new-localhost-tab'});assert.deepEqual(f.activated,['new-localhost-tab']);f.dispose();assert.equal(f.subscriptions.size,0);
});
test('Agent Stop remains available during the read-only Local handshake before enable',async()=>{
 const f=fixture(initial({enabled:false,local:{...initial().local,connected:false,busy:true,tree:null}}));await f.ready();assert.equal(f.$('#agent-stop').disabled,false,'A pending MCP child can be cancelled');assert.equal(f.$('#agent-folder').disabled,true);assert.equal(f.$('#agent-local-refresh').disabled,true);assert.equal(f.$('#agent-local-write').disabled,true);
 f.handlers.set('stop',async()=>({...f.state(),local:{...f.state().local,busy:false}}));f.$('#agent-stop').click();await f.flush();assert.equal(f.calls.at(-1).action,'stop');assert.equal(f.$('#agent-stop').disabled,true);f.dispose();
});
test('permission changes stay serialized and existing terminal input stops when its session ends',async()=>{
 const f=fixture(initial({enabled:true}));await f.ready();const permission=deferred();f.handlers.set('local-permissions',()=>permission.promise);f.$('#agent-local-commands').change(true);assert.equal(f.$('#agent-local-write').disabled,true);f.$('#agent-local-write').change(true);assert.equal(f.calls.length,1);
 permission.resolve({...f.state(),local:{...f.state().local,commandsAllowed:true}});await f.flush();assert.equal(f.$('#agent-local-write').checked,false);assert.equal(f.$('#agent-terminal-start').disabled,false);
 f.handlers.set('terminal-start',async()=>({...f.ui.state(),terminal:true}));f.$('#agent-terminal-start').click();await f.flush();assert.equal(f.calls.at(-1).action,'terminal-start');const input=f.terminalEvents.find(e=>e[0]==='onData')[1];input('pwd\r');await f.flush();assert.deepEqual(f.calls.at(-1),{action:'terminal-input',args:{data:'pwd\r'}});
 f.emit({...f.ui.state(),enabled:false,terminal:false,local:{...f.ui.state().local,connected:false,commandsAllowed:false,writeAllowed:false,tree:null}});const count=f.calls.length;input('must not be sent\r');await f.flush();assert.equal(f.calls.length,count);assert.equal(f.$('#agent-terminal-start').disabled,true);f.dispose();
});

test('runner accepts exactly the four Local tool names and forwards structured results as untrusted data',async()=>{
 const {run,parse}=require('./mouse-agent/runner.cjs'),{TOOLS}=require('./mouse-agent/mcp-files.cjs'),names=['read_file','write_file','list_directory','search_files'],calls=[],seen=[];let closed=0,index=0;
 const results={read_file:{path:'project.txt',content:'untrusted file content',bytes:22,sha256:'a'.repeat(64)},write_file:{path:'project.txt',bytes:7,sha256:'b'.repeat(64)},list_directory:{path:'.',entries:[file('<unsafe>.txt')],truncated:false},search_files:{query:'needle',entries:[file('needle.txt')],truncated:false}};
 class Controller{async connect(){return this;}async localTools(){return{tools:TOOLS,readOnly:false};}async localFile(name,args){calls.push({name,args});return{structuredContent:results[name],content:[{type:'text',text:'wrong fallback'}]};}async close(){closed++;}}
 const actions=[{action:'read_file',args:{path:'project.txt'}},{action:'write_file',args:{path:'project.txt',content:'changed',expectedSha256:'a'.repeat(64)}},{action:'list_directory',args:{path:'.',depth:2,limit:20}},{action:'search_files',args:{path:'.',query:'needle',limit:20}},{action:'done',args:{text:'Fixture done'}}];
 for(const name of names)assert.equal(parse(JSON.stringify({action:name,args:{}})).action,name);for(const name of ['delete_file','rename_file','exec'])assert.throws(()=>parse(JSON.stringify({action:name,args:{}})),/неподдерживаемое действие/);
 await run({task:'Fixture',cdp:'unused'},{Controller,complete:async(_config,messages)=>{seen.push(copy(messages));return JSON.stringify(actions[index++]);}});
 assert.deepEqual(calls.map(c=>c.name),names);assert.deepEqual(calls.map(c=>c.args),actions.slice(0,4).map(a=>a.args));assert.equal(closed,1);assert.match(seen[0][0].content,/Editing permission is ON/);assert.match(seen[0][0].content,/Never use terminal to bypass denied file access/);
 for(let i=1;i<seen.length;i++){const result=seen[i].at(-1).content;assert.match(result,/^UNTRUSTED TOOL RESULT/);assert.deepEqual(JSON.parse(result.slice(result.indexOf(': ')+2)),results[names[i-1]]);assert.doesNotMatch(result,/wrong fallback/);}
});
test('runner describes unavailable Local honestly and does not replace a denied file call with terminal access',async()=>{
 const {run}=require('./mouse-agent/runner.cjs');let step=0,terminal=0;const turns=[];
 class Controller{async connect(){return this;}async localTools(){throw Error('no workspace');}async localFile(){throw Error('Editing permission denied');}async terminal(){terminal++;throw Error('Must not be called');}async close(){}}
 const actions=[{action:'write_file',args:{path:'one.txt',content:'data'}},{action:'done',args:{text:'Cannot edit until permission is granted'}}];
 await run({task:'Fixture',cdp:'unused'},{Controller,complete:async(_config,messages)=>{turns.push(copy(messages));return JSON.stringify(actions[step++]);}});assert.match(turns[0][0].content,/No Local MCP workspace is connected/);assert.match(turns[1].at(-1).content,/Editing permission denied/);assert.equal(terminal,0);
});
test('runner rejects a Local reply without structuredContent instead of inventing ok:true',async()=>{
 const {run}=require('./mouse-agent/runner.cjs');let step=0,result;
 class Controller{async connect(){return this;}async localTools(){return{tools:[{name:'read_file'}],readOnly:true};}async localFile(){return{content:[{type:'text',text:'unstructured reply'}]};}async close(){}}
 await run({task:'Fixture',cdp:'unused'},{Controller,complete:async(_config,messages)=>{if(step++) {result=messages.at(-1).content;return JSON.stringify({action:'done',args:{text:'Missing tool result'}});}return JSON.stringify({action:'read_file',args:{path:'one.txt'}});}});assert.match(result,/"error":/);assert.doesNotMatch(result,/"ok":true/);
});
