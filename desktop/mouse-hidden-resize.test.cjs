'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Model the Chromium NativeViewHost boundary, not BrowserWorkspace's workaround:
// attached hidden hosts retain their old native size; detached WebContentsView
// bounds explicitly resize WebContents, and showing applies the current size.
function fixture({clip=false}={}){
 const events=[];
 class View{
  constructor(){this.children=[];this.parent=null;this.visible=true;this.bounds={x:0,y:0,width:1,height:1};}
  addChildView(view,index=this.children.length){
   if(view.parent){const old=view.parent.children.indexOf(view);view.parent.children.splice(old,1);}
   this.children.splice(Math.min(index,this.children.length),0,view);view.parent=this;events.push({type:'add',parent:this,view,index});view.applyTree();
  }
  removeChildView(view){const index=this.children.indexOf(view);if(index<0)return;this.children.splice(index,1);view.parent=null;events.push({type:'remove',parent:this,view,index});}
  getBounds(){return{...this.bounds};}
  setBounds(bounds){
   this.beforeBounds?.(bounds);this.bounds={...bounds};events.push({type:'bounds',view:this,bounds:{...bounds},attached:this.hasWidget()});
   this.afterBounds?.(bounds);this.applyTree();
  }
  setVisible(value){this.visible=value;events.push({type:'visibility',view:this,value});this.applyTree();}
  getVisible(){return this.visible;}
  setBorderRadius(){}
  hasWidget(){return!!this.widget||!!this.parent?.hasWidget();}
  isDrawn(){return this.visible&&(!this.parent||this.parent.isDrawn());}
  applyTree(){
   if(this.webContents&&(!this.hasWidget()||this.isDrawn()))this.nativeSize={width:this.bounds.width,height:this.bounds.height};
   for(const child of this.children)child.applyTree();
  }
 }
 const module={exports:{}},source=fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8');
 vm.runInNewContext(source,{module,exports:module.exports,require:id=>id==='electron'?{View,WebContentsView:View}:require(id),__dirname,URL,setTimeout,clearTimeout},{filename:'browser.cjs'});
 const root=new View();root.widget=true;
 const win={closed:false,isDestroyed(){return this.closed;},getContentSize:()=>[1200,900],contentView:root};
 const b=Object.assign(Object.create(module.exports.BrowserWorkspace.prototype),{win,tabs:new Map(),providers:new Map(),project:'owner',panels:[],disposed:false});
 const view=new View(),wc={id:41,dead:false,isDestroyed(){return this.dead;},document:{timeOrigin:1234,cookie:'owned-cookie',form:'unsaved text',scroll:83,chunks:[1,2]},capturePage:async()=>({...view.nativeSize})};view.webContents=wc;
 const page={id:'page',project:'owner',lane:'main',view,visible:false,navigationEpoch:7,url:'https://owned.test/'};
 b.tabs.set(page.id,page);const before=new View(),after=new View();root.addChildView(before);root.addChildView(view);root.addChildView(after);
 const initial={id:page.id,x:40,y:68,width:505,height:273,...(clip?{clip:{x:40,y:68,width:505,height:273}}:{})};
 b.layout([initial]);b.mouseSurfaceHold='owned-transition';b.layout([initial]);
 const parent=page.clipView||root;
 if(clip){parent.addChildView(new View(),0);parent.addChildView(new View());}
 events.length=0;
 return{b,win,root,page,view,wc,events,parent,initial,View,reset(){events.length=0;},resize(height){return{...initial,y:96,height,...(clip?{clip:{x:40,y:96,width:505,height}}:{})};}};
}

test('hidden resized desktop pages receive fresh native dimensions under the same hold and parent order',async()=>{
 for(const clip of [false,true])for(const height of [245,301]){
  const f=fixture({clip}),order=f.parent.children.slice(),roots=f.root.children.slice(),document=f.wc.document,original={...document,chunks:document.chunks.slice()},old=await f.wc.capturePage();
  assert.deepEqual(old,{width:505,height:273});assert.equal(f.view.visible,false);
  f.b.layout([f.resize(height)]);
  assert.deepEqual(await f.wc.capturePage(),{width:505,height},'The real-size model stays stale when the old attached-hidden resize path is used');
  assert.equal(f.page.view,f.view);assert.equal(f.view.webContents,f.wc);assert.equal(f.wc.document,document);assert.deepEqual(document,original);assert.equal(f.page.navigationEpoch,7);
  assert.equal(f.b.mouseSurfaceHold,'owned-transition');assert.equal(f.view.visible,false);assert.equal(f.page.visible,false);assert.equal(f.view.parent,f.parent);assert.deepEqual(f.parent.children,order);assert.deepEqual(f.root.children,roots);
  const moves=f.events.filter(event=>event.view===f.view&&['remove','add'].includes(event.type));assert.deepEqual(moves.map(event=>event.type),['remove','add']);assert.equal(moves[0].index,moves[1].index);assert.equal(moves[0].parent,moves[1].parent);
  assert.equal(f.events.find(event=>event.view===f.view&&event.type==='bounds').attached,false);assert.equal(f.events.filter(event=>event.type==='visibility').length,0,'Resize never exposes a native view or changes the hold');
  document.chunks.push(3);assert.deepEqual(f.wc.document.chunks,[1,2,3],'The same background consumer remains live');
 }
});

test('unchanged, position-only and visible layouts never detach native pages',async()=>{
 const f=fixture(),next=f.resize(245);f.b.layout([next]);f.reset();
 for(let i=0;i<100;i++)f.b.layout([next]);
 assert.equal(f.events.length,0,'Repeated metadata-driven layouts do no native geometry work');
 f.b.layout([{...next,x:60,y:120}]);assert.deepEqual(await f.wc.capturePage(),{width:505,height:245});assert.equal(f.events.filter(event=>['remove','add','visibility'].includes(event.type)).length,0);
 f.b.mouseSurfaceHold=null;f.b.layout([{...next,width:510}]);assert.equal(f.view.visible,true);assert.deepEqual(await f.wc.capturePage(),{width:510,height:245});
 f.reset();f.b.layout([{...next,width:520}]);assert.deepEqual(await f.wc.capturePage(),{width:520,height:245});assert.equal(f.events.filter(event=>['remove','add','visibility'].includes(event.type)).length,0);
});

test('a hidden resize never steals a view from an unexpected parent',()=>{
 const f=fixture(),foreign=new f.View();foreign.widget=true;foreign.addChildView(f.view);f.reset();
 f.b.layout([f.resize(245)]);
 assert.equal(f.view.parent,foreign);assert.equal(foreign.children[0],f.view);assert.equal(f.root.children.includes(f.view),false);assert.equal(f.events.filter(event=>['remove','add'].includes(event.type)).length,0);
 assert.equal(f.view.visible,false);assert.equal(f.b.mouseSurfaceHold,'owned-transition');
});

test('failed hidden native resize restores the same parent index without caching successful geometry',()=>{
 for(const clip of [false,true])for(const phase of ['beforeBounds','afterBounds']){
  const f=fixture({clip}),order=f.parent.children.slice(),signature=f.page.layoutSignature,bounds=f.page.bounds,reason=Error('native resize refused');
  f.view[phase]=()=>{throw reason;};assert.throws(()=>f.b.layout([f.resize(245)]),error=>error===reason);
  assert.equal(f.view.parent,f.parent);assert.deepEqual(f.parent.children,order);assert.equal(f.page.layoutSignature,signature);assert.equal(f.page.bounds,bounds);assert.equal(f.view.visible,false);assert.equal(f.b.mouseSurfaceHold,'owned-transition');
  assert.deepEqual(f.events.filter(event=>event.view===f.view&&['remove','add'].includes(event.type)).map(event=>event.type),['remove','add']);
 }
});

test('destroyed native owners cannot be reattached or receive a successful geometry cache',()=>{
 for(const lifetime of ['page','window','workspace']){
  const f=fixture(),signature=f.page.layoutSignature,bounds=f.page.bounds;
  f.view.afterBounds=()=>{if(lifetime==='page')f.wc.dead=true;if(lifetime==='window')f.win.closed=true;if(lifetime==='workspace')f.b.disposed=true;};
  assert.throws(()=>f.b.layout([f.resize(245)]),/closed during hidden viewport resize/);
  assert.equal(f.view.parent,null);assert.equal(f.root.children.includes(f.view),false);assert.equal(f.page.layoutSignature,signature);assert.equal(f.page.bounds,bounds);assert.equal(f.events.filter(event=>event.view===f.view&&event.type==='add').length,0);
 }
});

test('unselected desktops and foreign projects never enter the hidden resize path',()=>{
 const f=fixture(),other={id:'other',project:'foreign',view:new f.View(),visible:false};other.view.webContents={isDestroyed:()=>false};other.view.setVisible(false);f.b.tabs.set(other.id,other);f.root.addChildView(other.view);
 f.b.mouseDesktops={bank:{active:'desk-1',members:{page:'desk-2',other:'desk-1'}}};f.reset();
 f.b.layout([f.resize(245),{id:other.id,x:0,y:0,width:200,height:200}]);
 assert.equal(f.events.filter(event=>['remove','add','bounds'].includes(event.type)).length,0);assert.equal(f.view.visible,false);assert.equal(other.view.visible,false);assert.equal(f.b.mouseSurfaceHold,'owned-transition');
});
