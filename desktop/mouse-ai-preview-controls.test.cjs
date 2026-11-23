'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('./mouse/layout.js'),read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),flush=()=>new Promise(setImmediate);
function fixture(){
 const nodes=new Map(),writes=[],effects=[],tabs=[{id:'preview',previewOf:'chat',lane:'side',url:'https://source.test/article',title:'Article',favicon:'https://source.test/icon.svg'},{id:'main1',url:'https://music.test/',title:'Track one'},{id:'main2',url:'https://work.test/',title:'Work'}];
 const model={tree:L.preset(2),slots:{p1:'main1',p2:'main2'},pinnedPanes:{},aiPreviewId:'preview',aiPreviewRatio:.5,locale:'ru'},doc={activeElement:null,querySelector:s=>nodes.get(s),createElement:tag=>node(tag)};
 function node(name){
  const events=new Map(),attrs=new Map(),classes=new Set(),values={value:'',title:'',disabled:false,hidden:false,textContent:''},n={name,children:[],clientWidth:400,clientHeight:400,rect:{top:40,width:400,height:400},getBoundingClientRect(){return this.rect;},getAttribute:k=>attrs.get(k)??null,setAttribute(k,v){attrs.set(k,v);writes.push([name,k,v]);},addEventListener(k,fn){events.set(k,fn);},fire(k,event={}){return events.get(k)?.(event);},replaceChildren(...children){this.children=children;writes.push([name,'children']);},querySelector:s=>nodes.get(name+'/'+s),focus(){doc.activeElement=n;n.fire('focus');},blur(){if(doc.activeElement===n)doc.activeElement=null;n.fire('blur');},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)}};
  n.style=new Proxy({},{set(target,key,value){target[key]=value;writes.push([name,'style.'+key,value]);return true;}});n.dataset=new Proxy({},{set(target,key,value){target[key]=value;writes.push([name,'data.'+key,value]);return true;}});
  for(const key of Object.keys(values))Object.defineProperty(n,key,{get:()=>values[key],set(value){values[key]=value;writes.push([name,key,value]);}});
  nodes.set(name,n);return n;
 }
 for(const name of ['#ai-panel','#ai-chat-pane','#ai-preview-pane','#ai-preview-divider','#ai-preview-pane/.pane-head','#ai-preview-address-input','#ai-preview-icon','#ai-preview-target','#ai-slot','#ai-preview-slot','#ai-preview-address'])node(name);
 nodes.get('#ai-panel').rect.height=806;nodes.get('#ai-preview-divider').rect.height=6;nodes.get('#ai-slot').clientHeight=nodes.get('#ai-preview-slot').clientHeight=372;
 const context={MouseLayout:L,document:doc};vm.createContext(context);vm.runInContext(read('mouse/ai-preview-ui.js'),context);
 const ui=context.createMouseAIPreviewUI({model,doc,tab:id=>tabs.find(t=>t.id===id),favicon:page=>{effects.push(['favicon',page.id,page.favicon]);return{src:page.favicon};},beginDrag:(event,spec)=>effects.push(['drag',spec.kind,spec.divider]),save:reason=>effects.push(['save',reason]),layout:()=>effects.push(['layout']),navigate:async(id,url)=>effects.push(['navigate',id,url]),move:async(pane,id)=>effects.push(['move',pane,id]),error:message=>effects.push(['error',message])});
 ui.sync();writes.length=effects.length=0;return{nodes,writes,effects,tabs,model,doc,ui};
}
function key(value,extra={}){return{key:value,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};}

test('lower pane metadata owns its address and favicon without rewriting unrelated media updates',()=>{
 const f=fixture(),input=f.nodes.get('#ai-preview-address-input'),icon=f.nodes.get('#ai-preview-icon');
 assert.equal(input.value,f.tabs[0].url);assert.equal(icon.children[0].src,f.tabs[0].favicon);
 for(let i=0;i<30;i++){f.tabs[1].title='Track '+i;f.ui.sync();}
 assert.deepEqual(f.writes,[]);assert.deepEqual(f.effects,[],'No layout, save or icon request is caused by another page title');
 f.tabs[0].title='Updated article';f.ui.sync();assert.deepEqual(f.writes,[['#ai-preview-address-input','title','Updated article']]);assert.deepEqual(f.effects,[]);
 f.writes.length=0;f.tabs[0].url='https://source.test/next';f.tabs[0].favicon='data:image/png;base64,fixture';f.ui.sync();assert.equal(input.value,f.tabs[0].url);assert.equal(icon.children[0].src,f.tabs[0].favicon);assert.equal(f.effects.filter(e=>e[0]==='favicon').length,1);
});

test('editing and submitting a lower URL stays bound to that live preview; Escape restores its current URL',async()=>{
 const f=fixture(),input=f.nodes.get('#ai-preview-address-input'),head=f.nodes.get('#ai-preview-pane/.pane-head');input.focus();input.value=' unfinished query ';
 f.tabs[0].url='https://source.test/redirect';f.ui.sync();assert.equal(input.value,' unfinished query ');assert.equal(head.classList.contains('address-editing'),true);
 const composing=key('Escape',{isComposing:true});input.fire('keydown',composing);assert.equal(input.value,' unfinished query ');assert.equal(composing.prevented,false);
 const escape=key('Escape');input.fire('keydown',escape);assert.equal(input.value,f.tabs[0].url);assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);assert.equal(f.doc.activeElement,null);assert.equal(head.classList.contains('address-editing'),false);
 input.focus();input.value='  https://example.test/new  ';const submit=key('Enter');f.nodes.get('#ai-preview-address').onsubmit(submit);await flush();
 assert.equal(submit.prevented,true);assert.deepEqual(f.effects.filter(e=>e[0]==='navigate'),[['navigate','preview','https://example.test/new']]);assert.equal(f.doc.activeElement,null);
});

test('vertical resize controls adjust the split, reserve chrome and footer space, and reset by double click',()=>{
 for(const gap of [6,1]){
  const f=fixture(),divider=f.nodes.get('#ai-preview-divider');divider.rect.height=gap;f.nodes.get('#ai-panel').rect.height=800+gap;
  divider.onpointerdown({button:0});assert.equal(f.effects[0][0],'drag');assert.equal(f.effects[0][1],'ai-preview');assert.equal(f.effects[0][2],divider);
  assert.equal(f.ui.resize(40+560),.7);assert.equal(f.nodes.get('#ai-chat-pane').style.flex,'0 0 560px');assert.equal(divider.getAttribute('aria-valuenow'),'70');assert.equal(f.effects.some(e=>e[0]==='save'),false,'Pointer movements commit together on endDrag');
  const up=key('ArrowUp');divider.onkeydown(up);assert.equal(up.prevented,true);assert.ok(Math.abs(f.model.aiPreviewRatio-.67)<1e-12);assert.deepEqual(f.effects.at(-1),['save','ai-preview-resize']);
  f.nodes.get('#ai-slot').clientHeight=f.nodes.get('#ai-preview-slot').clientHeight=100;
  divider.onkeydown(key('Home'));assert.equal(f.model.aiPreviewRatio,.415);divider.onkeydown(key('End'));assert.equal(f.model.aiPreviewRatio,.585,'Each owner retains its actual toolbar/footer plus page area');
  divider.ondblclick();assert.equal(f.model.aiPreviewRatio,.5);assert.equal(divider.getAttribute('aria-valuenow'),'50');
  f.model.switching=true;divider.onkeydown(key('ArrowDown'));assert.equal(f.model.aiPreviewRatio,.5);
 }
});

test('move chooser exposes current unlocked panes and captures the selected preview identity',async()=>{
 const f=fixture(),target=f.nodes.get('#ai-preview-target');f.model.pinnedPanes={p1:'main1'};f.ui.sync();
 assert.deepEqual(target.children.map(o=>[o.value,o.disabled]),[['',true],['p1',true],['p2',false]]);
 target.value='p2';target.onchange();assert.equal(target.value,'');f.model.aiPreviewId='different';await flush();assert.deepEqual(f.effects.filter(e=>e[0]==='move'),[['move','p2','preview']]);
 f.model.aiPreviewId='preview';f.model.pinnedPanes.p2='main2';f.ui.sync();assert.equal(target.disabled,true);
 f.model.aiPreviewId='';f.ui.sync();assert.equal(f.nodes.get('#ai-preview-divider').hidden,true);assert.equal(f.nodes.get('#ai-chat-pane').style.flex,'1 1 0%');assert.equal(f.nodes.get('#ai-preview-address-input').disabled,true);
});

function renderer(){
 const model={desktopId:'desk-3',tree:L.preset(2),slots:{p1:'other'},pinnedPanes:{},aiId:'chat',aiPreviewId:'preview',focusAI:true,focusPane:''},events=[],page={id:'preview',lane:'side',previewOf:'chat'},context={m:model,L,deskSwitch:Promise.resolve(),tab:id=>id===page.id?page:null,restorePane:()=>{events.push('restore');model.focusAI=false;model.focusPane='';},N:{window:async action=>events.push(action)},mutateDesktopTabs:async(action,args)=>{events.push([action,args.id,args.pane]);return{moved:true};}};
 const source=read('mouse/browser.js'),start=source.indexOf(' async function moveAIPreview('),end=source.indexOf('\n async function removePane(',start);assert.ok(start>=0&&end>start);vm.createContext(context);vm.runInContext(source.slice(start,end),context);return{model,events,context,page,move:context.moveAIPreview};
}
test('moving from AI fullscreen first restores the main panes and keeps the captured preview identity',async()=>{
 const f=renderer();assert.deepEqual(JSON.parse(JSON.stringify(await f.move('p2'))),{moved:true});assert.deepEqual(f.events,['restore','pane-restore',['detach-preview','preview','p2']]);assert.equal(f.model.focusAI,false);assert.equal(f.page.previewOf,'chat','The trusted desktop service owns the native relation change');
});
test('a stale, pinned or switched preview never reaches the desktop mutation',async()=>{
 const pinned=renderer();pinned.model.pinnedPanes={p2:''};await assert.rejects(pinned.move('p2'),/незакреплённое/);assert.deepEqual(pinned.events,[]);
 const stale=renderer();await assert.rejects(stale.move('p2','old-preview'),/больше не принадлежит/);assert.deepEqual(stale.events,[]);
 const switched=renderer();switched.context.N.window=async()=>{switched.model.desktopId='desk-1';};await assert.rejects(switched.move('p2'),/уже изменился/);assert.deepEqual(switched.events,['restore']);
 let release;const queued=renderer();queued.model.switching=true;queued.context.deskSwitch=new Promise(resolve=>release=()=>{queued.model.switching=false;queued.model.desktopId='desk-1';resolve();});const pending=queued.move('p2');release();await assert.rejects(pending,/больше не принадлежит/);assert.deepEqual(queued.events,[]);
});

test('lower reload observes its own loading state, independently of the chat and active main page',()=>{
 const attrs=new Map(),classes=new Set(),model={slots:{p1:'main'},active:'p1',aiId:'chat',aiPreviewId:'preview'},tabs={main:{loading:true},chat:{loading:true},preview:{loading:false}};
 const button={dataset:{action:'ai-preview-reload'},disabled:false,glyph:null,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)},querySelector(){return this.glyph;},replaceChildren(glyph){this.glyph=glyph;},closest:()=>null};
 const doc={querySelectorAll:selector=>selector.includes('reload')?[button]:[],createElement:()=>({setAttribute(){}}),addEventListener(){},removeEventListener(){}},context={document:doc,clearTimeout,setTimeout,performance:{now:()=>0}};vm.createContext(context);vm.runInContext(read('mouse/mouse-616-ui.js'),context);
 const controls=context.createMouseChromeControls({model,tab:id=>tabs[id],doc});assert.equal(button.dataset.loading,'false');assert.equal(attrs.get('aria-busy'),'false');tabs.preview.loading=true;controls.sync();assert.equal(button.dataset.loading,'true');assert.equal(attrs.get('aria-busy'),'true');delete tabs.preview;controls.sync();assert.equal(button.disabled,true);assert.equal(button.dataset.loading,'false');controls.dispose();
});
