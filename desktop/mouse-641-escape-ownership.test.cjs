'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'mouse',file),'utf8'),start=read('start.js'),browser=read('browser.js');
const pickerStart=start.indexOf(" searchPicker.addEventListener('close'"),pickerEnd=start.indexOf(' async function chooseSearch(',pickerStart);
assert.ok(pickerStart>=0&&pickerEnd>pickerStart,'The real picker close and keyboard handlers are required');
const pickerHandlers=start.slice(pickerStart,pickerEnd),escapeHandler=browser.match(/^ document\.addEventListener\('keydown',e=>\{.*\}\);$/m)?.[0],returnToGrid=browser.match(/^ function returnToGrid\(\)\{.*\}$/m)?.[0];
assert.ok(escapeHandler&&returnToGrid,'The real document keyboard handler and grid transition are required');

// Run the production handlers in DOM event order. Only event delivery, dialog
// presentation and native window calls are adapted; view selection uses the real
// returnToGrid. A close event may be delivered after the key has bubbled.
function fixture({closeDelivery='deferred',classicTabId='owned-start'}={}){
 const calls=[],pending=[],listeners=new Map(),m={classicTabId,tree:{axis:'x',ratio:.4,a:{id:'p1'},b:{id:'p2'}},slots:{p1:'saved-left',p2:'saved-right'},active:'p2',focusPane:'',focusAI:false,settingsOpen:false,libraryOpen:false},saved=structuredClone({tree:m.tree,slots:m.slots,active:m.active});
 let documentKey;
 const document={body:{tagName:'BODY'},activeElement:null,addEventListener(type,handler){assert.equal(type,'keydown');assert.equal(documentKey,undefined);documentKey=handler;},querySelector(selector){assert.equal(selector,'dialog[open]:not([data-nonmodal])');return picker.open?picker:null;}};
 const anchor={isConnected:true,expanded:'true',setAttribute(name,value){assert.equal(name,'aria-expanded');this.expanded=value;},focus(){if(this.isConnected)document.activeElement=this;}};
 const options=['google','bing','duckduckgo','yandex'].map(engine=>({dataset:{searchEngine:engine},focus(){document.activeElement=this;}}));
 const picker={open:true,addEventListener(type,handler){listeners.set(type,handler);},querySelectorAll(selector){assert.equal(selector,'[data-search-engine]');return options;},close(){if(!this.open)return;this.open=false;calls.push('picker.close');const deliver=()=>listeners.get('close')();if(closeDelivery==='immediate')deliver();else pending.push(deliver);}};
 const context=vm.createContext({m,document,searchPicker:picker,searchAnchor:anchor,N:{window:async action=>{calls.push(action);}},safe:fn=>fn(),setStatus:message=>assert.fail(message),
  renderTree(){calls.push('renderTree');if(!m.classicTabId){anchor.isConnected=false;document.activeElement=document.body;}},applySide(){calls.push('applySide');},
  restorePane(){calls.push('restorePane');m.focusPane='';m.focusAI=false;},settingsUI:{close(){calls.push('settings.close');m.settingsOpen=false;}},browsing:{close(){calls.push('library.close');m.libraryOpen=false;}}});
 vm.runInContext(pickerHandlers+'\n'+returnToGrid+'\n'+escapeHandler,context);document.activeElement=options[1];
 function key(name,{throughPicker=true,cancelled=false}={}){
  const event={key:name,target:document.activeElement,defaultPrevented:cancelled,cancelBubble:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;}};
  if(throughPicker)listeners.get('keydown')(event);if(!event.cancelBubble)documentKey(event);return event;
 }
 const flushClose=()=>{while(pending.length)pending.shift()();};
 const preserved=()=>assert.deepEqual({tree:m.tree,slots:m.slots,active:m.active},saved,'Escape must preserve saved grid identity and assignments');
 return{m,calls,document,anchor,picker,options,key,flushClose,preserved};
}

for(const closeDelivery of ['immediate','deferred'])test('picker Escape closes only the picker and restores its existing anchor ('+closeDelivery+' close)',()=>{
 const f=fixture({closeDelivery}),event=f.key('Escape');
 assert.equal(event.defaultPrevented,true);assert.equal(f.picker.open,false);assert.equal(f.m.classicTabId,'owned-start','A consumed modal Escape must not also leave the classic start page');
 f.flushClose();assert.equal(f.document.activeElement,f.anchor);assert.equal(f.anchor.isConnected,true);assert.equal(f.anchor.expanded,'false');assert.deepEqual(f.calls,['picker.close']);f.preserved();
});
test('a separate unhandled Escape after picker closure still returns the classic page to the saved grid',()=>{
 const f=fixture();f.picker.close();f.flushClose();f.calls.length=0;
 const event=f.key('Escape',{throughPicker:false});assert.equal(event.defaultPrevented,true);assert.equal(f.m.classicTabId,'');assert.deepEqual(f.calls,['renderTree','applySide']);f.preserved();
});
test('an Escape already cancelled by another control cannot acquire view ownership after the modal closes',()=>{
 const f=fixture();f.picker.close();f.flushClose();f.calls.length=0;
 f.key('Escape',{throughPicker:false,cancelled:true});assert.equal(f.m.classicTabId,'owned-start');assert.equal(f.document.activeElement,f.anchor);assert.deepEqual(f.calls,[]);f.preserved();
});
test('an open modal still blocks the document Escape fallback before native dialog cancellation',()=>{
 const f=fixture(),event=f.key('Escape',{throughPicker:false});assert.equal(event.defaultPrevented,false);assert.equal(f.m.classicTabId,'owned-start');assert.deepEqual(f.calls,[]);
 f.picker.close();f.flushClose();assert.equal(f.document.activeElement,f.anchor);assert.equal(f.m.classicTabId,'owned-start');f.preserved();
});
test('unhandled Escape without a modal retains pane, sidebar and window fallback behavior',()=>{
 for(const [state,expected]of [[{},['exit-fullscreen']],[{focusPane:'p2'},['restorePane','pane-restore']],[{settingsOpen:true},['settings.close']],[{libraryOpen:true},['library.close']]]){
  const f=fixture({classicTabId:''});Object.assign(f.m,state);f.picker.open=false;
  const event=f.key('Escape',{throughPicker:false});assert.equal(event.defaultPrevented,true);assert.deepEqual(f.calls,expected);f.preserved();
 }
});
test('picker navigation keys retain their own focus handling without closing or switching the view',()=>{
 const f=fixture(),event=f.key('ArrowDown');assert.equal(event.defaultPrevented,true);assert.equal(f.document.activeElement,f.options[2]);assert.equal(f.picker.open,true);assert.equal(f.m.classicTabId,'owned-start');assert.deepEqual(f.calls,[]);f.preserved();
});
