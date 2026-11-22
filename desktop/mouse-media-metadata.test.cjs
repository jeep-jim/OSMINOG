'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');

// This observes DOM writes made by the shipped pane synchronizer. It is not a
// presentation/compositor simulation; the installed-app media smoke covers
// the complete renderer and native WebContentsView hierarchy separately.
function renderer(){
 const writes=[],mounts={home:0,documents:0,layouts:0},homeMounts=[],nodes=new Map();
 function node(name){
  const values={textContent:'',title:'',value:'',disabled:false,hidden:false},attrs=new Map(),children=new Map(),classes=new Set();
  const result={name,children,getAttribute:key=>attrs.get(key)??null,setAttribute(key,value){attrs.set(key,String(value));writes.push({node:name,key,value});},querySelector:key=>children.get(key)||null,replaceChildren(){writes.push({node:name,key:'children'});},prepend(){writes.push({node:name,key:'children'});},classList:{toggle(key,enabled){if(classes.has(key)===enabled)return;enabled?classes.add(key):classes.delete(key);writes.push({node:name,key:'class',value:key});}}};
  for(const key of Object.keys(values))Object.defineProperty(result,key,{get:()=>values[key],set(value){values[key]=value;writes.push({node:name,key,value});}});
  result.dataset=new Proxy({},{set(target,key,value){target[key]=value;writes.push({node:name,key:'data-'+key,value});return true;}});nodes.set(name,result);return result;
 }
 const panes=Array.from({length:4},(_,i)=>{const p=node('p'+(i+1));p.dataset.pane=p.name;for(const selector of ['.page-slot','.pane-pin','[data-pane-action=remove]','.pane-address input','.pane-title','.pane-icon','[data-pane-action=back]','[data-pane-action=forward]','.pane-name','.page-slot>.empty>.mouse-mascot','.page-slot>.empty','.empty h2','[data-pane-action=open]'])p.children.set(selector,node(p.name+'/'+selector));return p;});
 const globals=new Map(['#address-input','.navigation [data-action=back]','.navigation [data-action=forward]','.navigation [data-action=reload]','#ai-preview-pane','#ai-panel','#ai-preview-title','[data-action=ai-preview-back]','[data-action=ai-preview-forward]'].map(selector=>[selector,node(selector)]));
 const reloads=panes.map(p=>{const b=node(p.name+'/reload');b.closest=()=>p;b.children.set('.mouse-reload-glyph',node(p.name+'/glyph'));return b;});
 const document={activeElement:null,querySelector:selector=>globals.get(selector),querySelectorAll:selector=>selector==='.pane'?panes:selector.includes('reload')?reloads:[],createElement:()=>node('new'),addEventListener(){},removeEventListener(){}};
 const tabs=Array.from({length:10},(_,i)=>({id:'tab-'+i,title:'Title '+i,url:'https://fixture.test/'+i,lane:'main',loading:false,internal:false}));
 const m={pinnedPanes:{},ready:true,desktopId:'desk',state:{tabs},active:'p1',slots:Object.fromEntries(panes.map((p,i)=>[p.name,tabs[i].id])),aiId:''};
 const context={document,m,aiPreviewUI:null,performance:{now:()=>0},setTimeout,clearTimeout,MouseNative:{platform:'darwin'},$:(selector)=>globals.get(selector),tab:id=>m.state.tabs.find(t=>t.id===id),selected:()=>m.state.tabs.find(t=>t.id===m.slots[m.active]),favicon:()=>node('favicon'),el:()=>node('mascot'),home:{mount:(slot,pane,enabled)=>{mounts.home++;homeMounts.push({slot,pane,enabled});}},documentsUI:{mount:()=>mounts.documents++},prefs:()=>({slots:m.slots}),reconcile(){},renderTabs(){},syncAIIcon(){},applySide:()=>mounts.layouts++,desktopUI:{render(){}},progressUI:{render(){}},save(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'mouse/mouse-616-ui.js'),'utf8'),context);context.chromeControls=context.createMouseChromeControls({model:m,tab:context.tab,doc:document});
 const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),begin=source.indexOf('const paneBindings='),end=source.indexOf('function changeLayout(',begin),receive=source.indexOf('function receiveState('),receiveEnd=source.indexOf('N.onState(receiveState)',receive),preview=source.indexOf('function syncAIPreview('),previewEnd=source.indexOf('function applySide(',preview);
 let revision=1;m.state={...m.state,desktopId:'desk',snapshot:{epoch:'unit-media',revision}};const receiver=source.slice(source.indexOf('function createStateReceiver('),source.indexOf('\n const resizeHUD'));
 assert.ok(begin>=0&&end>begin&&receive>=0&&receiveEnd>receive&&preview>=0&&previewEnd>preview);vm.runInContext(receiver+'\nstateReceiver.init(m.state,m.desktopId);\n'+source.slice(begin,end)+'\n'+source.slice(preview,previewEnd)+'\n'+source.slice(receive,receiveEnd),context);
 context.syncPaneLabels();context.syncAIPreview();writes.length=homeMounts.length=0;for(const key of Object.keys(mounts))mounts[key]=0;
 const notify=state=>context.receiveState({...state,snapshot:{epoch:'unit-media',revision:++revision}});
 return{m,document,panes,nodes,writes,mounts,homeMounts,sync:context.syncPaneLabels,syncPreview:context.syncAIPreview,receive:notify,change(index,fields){const next=m.state.tabs.map(t=>({...t}));Object.assign(next[index],fields);notify({desktopId:'desk',tabs:next});}};
}

test('track titles update only the owning labels and do not remount any pane content',()=>{
 const f=renderer();for(let i=0;i<30;i++)f.change(0,{title:'Track '+i+' · Artist'});
 assert.ok(f.writes.length>0);assert.ok(f.writes.every(write=>write.node==='p1'||write.node.startsWith('p1/')||write.node==='#address-input'),'Another pane receives no DOM mutation for this title');
 assert.deepEqual(f.mounts,{home:0,documents:0,layouts:0});assert.equal(f.nodes.get('p1/.pane-title').textContent,'Track 29 · Artist');
 f.writes.length=0;f.sync();assert.deepEqual(f.writes,[],'An identical metadata pass writes neither DOM properties nor attributes');
});

test('media metadata preserves an actively edited address and adjacent document mounting',()=>{
 const f=renderer();f.change(1,{internal:true,documentId:'document',documentKind:'text',revision:1,dirty:true});const mounts={...f.mounts};f.writes.length=0;
 const input=f.nodes.get('p2/.pane-address input');input.value='unfinished address';f.document.activeElement=input;
 f.change(0,{title:'Next song',loading:true});f.change(0,{loading:false});
 assert.equal(input.value,'unfinished address');assert.equal(f.mounts.documents,mounts.documents,'An adjacent editor is not remounted by media/loading metadata');assert.equal(f.mounts.home,mounts.home);
 f.change(1,{revision:2});assert.equal(f.mounts.documents,mounts.documents+1,'A real document revision still reaches the document owner');
});

test('track changes leave an existing AI preview untouched while its own title stays current',()=>{
 const f=renderer();f.m.aiId='chat';f.m.state.tabs.push({id:'chat',lane:'side',url:'https://chat.test/',title:'Chat'},{id:'preview',lane:'side',previewOf:'chat',url:'https://page.test/',title:'Preview'});f.syncPreview();f.writes.length=0;
 for(let i=0;i<30;i++)f.change(0,{title:'Track '+i});
 assert.equal(f.m.aiPreviewId,'preview');assert.equal(f.nodes.get('#ai-preview-title').textContent,'Preview');assert.ok(f.writes.every(write=>!write.node.includes('ai-preview')&&write.node!=='#ai-panel'),'Unrelated media metadata does not mutate the preview');assert.equal(f.mounts.layouts,0);
 f.writes.length=0;f.change(11,{title:'Updated preview'});assert.equal(f.nodes.get('#ai-preview-title').textContent,'Updated preview');assert.deepEqual(f.writes,[{node:'#ai-preview-title',key:'textContent',value:'Updated preview'}]);assert.equal(f.mounts.layouts,0);
});

test('replacing a selected page still mounts its new content and requests native layout',()=>{
 const f=renderer();f.change(0,{internal:true});assert.equal(f.mounts.home,1);assert.equal(f.mounts.layouts,1);
 f.change(0,{internal:false});assert.equal(f.mounts.home,2);assert.equal(f.mounts.layouts,2);
});

test('retained internal pages mount ordinary home while the same IDs still support localhost and documents',()=>{
 const f=renderer(),id=f.m.state.tabs[1].id;f.change(1,{internal:true,url:'mouse://start'});
 assert.equal(f.homeMounts.at(-1).pane,'p2');assert.equal(f.homeMounts.at(-1).enabled,true);
 f.change(2,{internal:true,url:'mouse://start'});assert.equal(f.homeMounts.at(-1).pane,'p3');assert.equal(f.homeMounts.at(-1).enabled,true);
 f.homeMounts.length=0;for(let i=0;i<20;i++)f.change(0,{title:'Track '+i});assert.deepEqual(f.homeMounts,[]);
 f.m.mode='support';f.sync();assert.deepEqual(f.homeMounts,[],'Web preset metadata does not replace an existing start page');
 f.change(1,{internal:false,url:'http://127.0.0.1:5173/'});assert.equal(f.m.state.tabs[1].id,id);assert.equal(f.homeMounts.at(-1).pane,'p2');assert.equal(f.homeMounts.at(-1).enabled,false);
 f.change(1,{internal:true,documentId:'document',documentKind:'text',revision:1});assert.equal(f.m.state.tabs[1].id,id);assert.equal(f.homeMounts.at(-1).enabled,false,'A document on the same ID is never covered by the start page');
});

function chrome(platform){
 const win=new EventEmitter(),sent=[];let fullscreen=false,maximized=false,dead=false;
 Object.assign(win,{isDestroyed:()=>dead,isFullScreen:()=>fullscreen,isMaximized:()=>maximized,isFocused:()=>true,getBounds:()=>({x:0,y:0,width:900,height:700}),getNativeWindowHandle:()=>Buffer.alloc(1),webContents:{isDestroyed:()=>dead,send:(channel,value)=>sent.push({channel,value})}});
 const module={exports:{}},native={install(){},state:()=>({appActive:true,held:false,menuHeight:24}),release:()=>({appActive:true,held:false,menuHeight:24})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-mac-chrome.cjs'),'utf8'),{module,process:{platform},Buffer,require:id=>id==='electron'?{screen:{getCursorScreenPoint:()=>({x:300,y:400}),getDisplayMatching:()=>({bounds:{x:0,y:0,width:1000,height:800}})}}:id==='./mouse-native-menu.node'?native:require(id),setInterval:()=>({unref(){}}),clearInterval(){},Date},{filename:'mouse-mac-chrome.cjs'});
 const api=module.exports.install(win);return{win,sent,api,setFullscreen:value=>{fullscreen=value;},setMaximized:value=>{maximized=value;},destroy:()=>{dead=true;}};
}

for(const platform of ['darwin','win32'])test(platform+' focus/resize notifications publish only actual chrome state changes',()=>{
 const f=chrome(platform);f.win.emit('focus');assert.equal(f.sent.length,1);for(let i=0;i<30;i++){f.win.emit('focus');f.win.emit('resize');}assert.equal(f.sent.length,1);
 f.setFullscreen(true);f.win.emit('enter-full-screen');assert.equal(f.sent.length,2);assert.equal(f.sent.at(-1).value.fullscreen,true);
 f.setFullscreen(false);f.win.emit('leave-full-screen');assert.equal(f.sent.length,3);f.destroy();f.win.emit('focus');assert.equal(f.sent.length,3);
});
