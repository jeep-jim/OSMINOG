'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const budget=require('../osminog-canvas-budget.js');
const source=fs.readFileSync(path.join(__dirname,'../editor.js'),'utf8');
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name)}
function region(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,`${start} region exists`);return source.slice(a,b)}

test('viewport overscan stays 320 screen pixels at different zoom levels',()=>{
  assert.deepEqual(budget.viewportBounds({x:100,y:-100,scale:2},800,600),{left:-210,top:-110,right:510,bottom:510});
  assert.equal(budget.viewportBounds({x:0,y:0,scale:.25},800,600).right,4480);
});
test('rotated bounds retain objects that intersect through their rotated edge',()=>{
  const bounds={left:0,top:0,right:100,bottom:100};
  const object={x:110,y:0,w:10,h:100,rotation:0};
  assert.equal(budget.intersects(object,bounds),false);
  assert.equal(budget.intersects({...object,rotation:90},bounds),true);
});
test('unknown legacy geometry and an unmeasured viewport stay reachable',()=>{
  assert.equal(budget.viewportBounds({x:0,y:0,scale:1},0,0),null);
  assert.equal(budget.intersects({x:'unknown'},{left:0,top:0,right:10,bottom:10}),true);
  assert.equal(budget.intersects({x:1e8,y:1e8,w:10,h:10},null),true);
});
test('all visible objects remain eligible without a fixed item cap',()=>{
  const items=Array.from({length:600},(_,i)=>({id:String(i),x:i%20,y:Math.floor(i/20),w:1,h:1}));
  assert.equal(items.filter(o=>budget.intersects(o,{left:0,top:0,right:100,bottom:100})).length,600);
});
test('content keys share media values and ignore geometry while detecting real content changes',()=>{
  const image={id:'image',type:'image',src:'data:image/png;base64,'+'A'.repeat(4*1024*1024),x:0,y:0};
  image.toJSON=()=>{throw Error('media must not be serialized by the renderer')};
  const context={language:'ru',renderer:()=>{},workdesk:'1'};
  const before=budget.contentKey(image,context);image.x=500;
  assert(budget.sameContent(before,budget.contentKey(image,context)));
  image.src+='B';assert(!budget.sameContent(before,budget.contentKey(image,context)));
});
test('content keys detect replaced objects, mutable comments, language and renderer changes',()=>{
  const object={type:'note',text:'body',comments:[{text:'before'}]},context={language:'ru',renderer:()=>{}};
  const before=budget.contentKey(object,context);
  assert(!budget.sameContent(before,budget.contentKey({...object},context)));
  object.comments[0].text='after';assert(!budget.sameContent(before,budget.contentKey(object,context)));
  object.comments[0].text='before';assert(!budget.sameContent(before,budget.contentKey(object,{...context,language:'en'})));
  assert(!budget.sameContent(before,budget.contentKey(object,{...context,renderer:()=>{}})));
  assert.equal(budget.contentKey({type:'vector'},context),null);
});

class Node{
  constructor(id='',type='image'){this.dataset={id,type};this.children=[];this.parent=null;this.isConnected=false;this.livePreview=false;this.focus=false}
  append(el){el.remove();this.children.push(el);el.parent=this;el.isConnected=true}
  insertBefore(el,before){if(el===before)return;el.remove();const i=before?this.children.indexOf(before):-1;this.children.splice(i<0?this.children.length:i,0,el);el.parent=this;el.isConnected=true}
  replaceWith(next){const parent=this.parent,index=parent.children.indexOf(this);next.remove();parent.children[index]=next;next.parent=parent;next.isConnected=true;this.parent=null;this.isConnected=false}
  remove(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1)}this.parent=null;this.isConnected=false}
  querySelector(){return this.livePreview?{}:null}
  matches(){return this.focus}
  closest(){return this.dataset.id?this:null}
}
function rendererFixture(items){
  const root=new Node('root'),viewport={clientWidth:800,clientHeight:600},app={hidden:false};
  const p={id:'project',activeDesktop:'main',objects:items};
  const frames=[],counts={built:0,updated:0};let frameId=0;
  const state={view:{x:0,y:0,scale:1},selected:[],language:'ru',drag:null,activeEditable:null};
  const context=vm.createContext({
    OSMINOGCanvasBudget:budget,WeakMap,Map,Set,Node,counts,state,
    document:{body:{dataset:{workdesk:'1'}},activeElement:null},objectHTML:()=>'',
    $:selector=>({'#objects':root,'#viewport':viewport,'#app':app})[selector],
    $$:(_selector,container)=>[...container.children],
    project:()=>p,desktopObjects:()=>p.objects.filter(o=>!o.osminogFolderId&&(o.osminogDesktopId||'main')===p.activeDesktop),
    requestAnimationFrame:fn=>{frames.push(fn);return ++frameId}
  });
  vm.runInContext(region('const canvasRenderRecords=new WeakMap();','function objectBar('),context);
  vm.runInContext(`
    buildObjectElement=function(object){const el=new Node(object.id,object.type);counts.built++;canvasRenderRecords.set(el,{object,content:canvasContentKey(object)});return el};
    updateObjectElement=function(){counts.updated++};
  `,context);
  return {context,root,viewport,app,p,state,counts,frames,flush(){const batch=frames.splice(0);for(const frame of batch)frame()}};
}
const makeImage=(id,x=0)=>({id,type:'image',x,y:0,w:100,h:100,src:'data:fixture,'+id});
test('real renderObjects mounts only nearby candidates while retaining the complete model and offscreen selection',()=>{
  const items=Array.from({length:1200},(_,i)=>makeImage('item-'+i,i*1000)),f=rendererFixture(items);
  f.state.selected=['item-900'];f.context.renderObjects();
  assert.deepEqual(f.root.children.map(n=>n.dataset.id),['item-0','item-1','item-900']);
  assert.equal(f.p.objects.length,1200);assert.equal(f.p.objects,items);
  assert.deepEqual(f.state.selected,['item-900']);
});
test('panning coalesces to one frame and mounts distant objects without losing data',()=>{
  const f=rendererFixture(Array.from({length:1200},(_,i)=>makeImage('item-'+i,i*1000)));
  f.context.renderObjects();assert(!f.root.children.some(n=>n.dataset.id==='item-800'));
  f.state.view.x=-800000;for(let i=0;i<12;i++)f.context.scheduleCanvasViewport();
  assert.equal(f.frames.length,1);f.flush();
  assert(f.root.children.some(n=>n.dataset.id==='item-800'));
  assert(!f.root.children.some(n=>n.dataset.id==='item-0'));
  assert.equal(f.p.objects.length,1200);f.context.scheduleCanvasViewport();assert.equal(f.frames.length,0);
});
test('hidden or fully covered canvases do not eagerly mount distant image libraries',()=>{
  const f=rendererFixture(Array.from({length:1200},(_,i)=>makeImage('item-'+i,i*1000)));
  f.app.hidden=true;f.context.renderObjects(true);assert.equal(f.counts.built,0);
  f.app.hidden=false;f.viewport.clientWidth=0;f.context.renderObjects(true);assert.equal(f.counts.built,0);
  f.state.selected=['item-100'];f.context.renderObjects();assert.equal(f.root.children.length,1);
  assert.equal(f.root.children[0].dataset.id,'item-100');
  f.viewport.clientWidth=800;f.context.scheduleCanvasViewport();f.flush();assert.equal(f.root.children.length,3);
  assert.equal(f.p.objects.length,1200);
});
test('focus, drag and running previews remain mounted outside the viewport',()=>{
  const f=rendererFixture([makeImage('focus'),makeImage('drag',200),{...makeImage('preview',400),type:'code'}]);
  f.context.renderObjects();const [focused,,preview]=f.root.children;
  f.context.document.activeElement=focused;preview.livePreview=true;f.state.drag={items:[{id:'drag'}]};
  f.state.view.x=-10000;f.context.renderObjects();
  assert.deepEqual(f.root.children.map(n=>n.dataset.id),['focus','drag','preview']);
});
test('forced redraw preserves unchanged images and replaces only changed content or object identities',()=>{
  const f=rendererFixture([makeImage('a'),makeImage('b',200)]);f.context.renderObjects();
  const first=[...f.root.children];f.context.renderObjects(true);f.context.renderObjects(true);
  assert.equal(f.counts.built,2);assert.equal(f.root.children[0],first[0]);assert.equal(f.root.children[1],first[1]);
  f.p.objects[0].src='data:replacement';f.context.renderObjects(true);
  assert.equal(f.counts.built,3);assert.notEqual(f.root.children[0],first[0]);assert.equal(f.root.children[1],first[1]);
  f.p.objects[1]={...f.p.objects[1]};f.context.renderObjects();assert.equal(f.counts.built,4);
});
test('complex vector and code tools keep their existing explicit rebuild semantics',()=>{
  const f=rendererFixture([{...makeImage('v'),type:'vector'},{...makeImage('c',200),type:'code'}]);
  f.context.renderObjects();f.context.renderObjects();assert.equal(f.counts.built,2);
  f.context.renderObjects(true);assert.equal(f.counts.built,4);
});

function historyFixture(){
  const p={id:'one',objects:[{id:'photo',src:'data:image/png;base64,'+'B'.repeat(4*1024*1024),x:1}],connections:[],groups:[],ink:[],canvas:{grid:'dots'},osminogFolders:[{id:'folder',members:['photo']}]};
  Object.defineProperty(p.objects[0],'toJSON',{value:()=>{throw Error('bulk history must not serialize image data')}});
  const state={projects:[p],history:[],future:[],language:'ru',selected:[],selectedConnection:null};
  const context=vm.createContext({state,project:()=>p,renderAll(){},queuePersist(){},updateHistoryButtons(){},syncLiveWebSnapshots(){},logChange(){}});
  vm.runInContext(region('function historyCopy(value){','globalThis.OSMINOGSnapshotProjects='),context);
  vm.runInContext(region('function undo(){','function updateHistoryButtons(){'),context);
  return {p,state,context};
}
test('bulk undo shares media strings but copies mutable metadata and folder membership without JSON',()=>{
  const f=historyFixture(),snapshot=f.context.snapshotProjects(['one']);
  assert.equal(typeof snapshot,'object');assert.equal(snapshot.projects[0].objects[0].src,f.p.objects[0].src);
  assert.notEqual(snapshot.projects[0].objects,f.p.objects);assert.notEqual(snapshot.projects[0].objects[0],f.p.objects[0]);
  f.p.objects[0].x=50;f.p.osminogFolders[0].members.length=0;
  assert.equal(snapshot.projects[0].objects[0].x,1);assert.equal(snapshot.projects[0].osminogFolders[0].members[0],'photo');
  f.state.history.push(snapshot);f.context.undo();assert.equal(f.p.objects[0].x,1);assert.equal(f.p.osminogFolders[0].members[0],'photo');
  f.context.redo();assert.equal(f.p.objects[0].x,50);assert.equal(f.p.osminogFolders[0].members.length,0);
});
test('legacy serialized bulk history still restores through undo',()=>{
  const f=historyFixture(),snapshot=f.context.snapshotProjects(['one']);
  f.state.history.push(JSON.stringify(snapshot));f.p.objects=[];f.context.undo();
  assert.equal(f.p.objects[0].id,'photo');assert.equal(f.state.future.length,1);
});
test('connection endpoints use the render index and preserve group geometry',()=>{
  let scans=0;const objects=[{id:'a',x:10,y:20,w:100,h:50},{id:'b',x:300,y:150,w:30,h:40}];
  const context=vm.createContext({OSMINOG_GOOGLE_MODULE_ID:'module',osminogModulePortPoint:()=>({x:8,y:9}),desktopObjects:()=>{scans++;return objects}});
  vm.runInContext(region('function osminogConnectionEndpoint(', 'function clearMagneticTarget('),context);
  const port=source.match(/function connectionPortPoint\([^\n]+/);assert(port);vm.runInContext(port[0],context);
  const index=new Map(objects.map(o=>[o.id,o]));
  const grouped=context.osminogConnectionEndpoint('a','se',['a','b','absent'],index);
  assert.equal(grouped.x,330);assert.equal(grouped.y,190);assert.equal(scans,0);
  assert.equal(context.osminogConnectionEndpoint('absent','e',[],index),null);
  assert.equal(context.osminogConnectionEndpoint('module','e',[],index).x,8);
});
console.log(`Canvas/undo budget: ${passed} checks passed`);
