'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {install}=require('./mouse-linux-corners.cjs');

function fixture(){
 const win=new EventEmitter(),calls=[],handle=Buffer.from([1,0,0,0]);let visible=true,minimized=false,destroyed=false,size=[1000,800],fail=false;
 Object.assign(win,{getNativeWindowHandle:()=>handle,isDestroyed:()=>destroyed,isVisible:()=>visible,isMinimized:()=>minimized,getContentSize:()=>size});
 const native={paneCorners(parent,rects,geometry){assert.equal(parent,handle);calls.push({rects:structuredClone(rects),geometry});return fail?0:rects.length;},paneCornersState:()=>({backend:'X11 Shape'})};
 const screen=new EventEmitter(),browser={disposed:false,mouseSurfaceHold:null},paint=install(win,browser,{native,screen});
 return{win,screen,browser,paint,calls,native,setVisible:v=>visible=v,setMinimized:v=>minimized=v,setDestroyed:v=>destroyed=v,setSize:v=>size=v,setFail:v=>fail=v};
}
const panes=[{x:0,y:80,width:450,height:300,color:'#c7cfdf'}];
test('Linux corner chrome skips unchanged layouts and retries a native failure without touching page bounds',()=>{
 const f=fixture();assert.equal(f.paint(panes),1);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{rects:panes,geometry:{width:1000,height:800}});
 f.paint(structuredClone(panes));assert.equal(f.calls.length,1);
 f.setSize([1200,900]);f.paint(panes);assert.equal(f.calls.length,2);assert.equal(f.calls[1].geometry.width,1200);
 f.setFail(true);const dark=[{...panes[0],color:'#43536b'}];f.paint(dark);f.paint(dark);assert.equal(f.calls.length,4,'A missing WM/Shape acknowledgement is not cached');f.setFail(false);f.paint(dark);f.paint(dark);assert.equal(f.calls.length,5);f.paint.dispose();
});
test('Linux corner children clear for Nora, hide, minimize and disposal; only live selection returns',()=>{
 const f=fixture();f.paint(panes);f.setVisible(false);f.win.emit('hide');assert.deepEqual(f.calls.at(-1).rects,[]);
 f.setVisible(true);f.win.emit('show');assert.deepEqual(f.calls.at(-1).rects,panes);
 f.browser.mouseSurfaceHold='nora';f.paint([]);f.win.emit('show');assert.deepEqual(f.calls.at(-1).rects,[]);
 f.browser.mouseSurfaceHold=null;f.paint(panes);f.setMinimized(true);f.win.emit('minimize');assert.deepEqual(f.calls.at(-1).rects,[]);
 f.setMinimized(false);f.win.emit('restore');assert.deepEqual(f.calls.at(-1).rects,panes);
 f.paint.dispose();const n=f.calls.length;assert.deepEqual(f.calls.at(-1).rects,[]);for(const event of ['hide','show','minimize','restore','move']){assert.equal(f.win.listenerCount(event),0);f.win.emit(event);}f.paint(panes);assert.equal(f.calls.length,n);
});
test('a disposed private workspace cannot repaint its corner masks into the normal workspace',()=>{
 const f=fixture(),privateBrowser={disposed:false},privatePaint=install(f.win,privateBrowser,{native:f.native,screen:f.screen});
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8'),{module,exports:module.exports,clearTimeout,require:id=>id==='electron'?{}:require(id)});
 const page={id:'page',project:'p',view:{setBounds(){},setVisible(){},getVisible:()=>false},visible:false};f.win.contentView={children:[],removeChildView(){},addChildView(){}};
 Object.assign(f.browser,{win:f.win,project:'p',mouseRoundedPanes:true,tabs:new Map([['page',page]]),providers:new Map(),layout:module.exports.BrowserWorkspace.prototype.layout,make:()=>page});
 const gate=new(require('./mouse-overlays.cjs').OverlayGate)(f.browser,f.win);f.browser.layout([{id:'page',...panes[0],roundBottom:12,roundColor:panes[0].color}]);gate.blocked=true;gate.hide();assert.equal(f.browser.mouseSurfaceHold,null,'Real private entry blocks OverlayGate without inventing a Nora hold');assert.deepEqual(f.calls.at(-1).rects,[]);
 privatePaint(panes);let n=f.calls.length;gate.hide();f.win.emit('show');assert.equal(f.calls.length,n,'An inactive normal gate and show observer cannot clear the private owner');
 Object.assign(privateBrowser,{mouseCornerMask:privatePaint,tabs:new Map(),providers:new Map()});module.exports.BrowserWorkspace.prototype.dispose.call(privateBrowser);
 assert.equal(privateBrowser.disposed,true);assert.deepEqual(f.calls.at(-1).rects,[]);f.paint([{...panes[0],x:450}]);n=f.calls.length;
 f.win.emit('show');assert.equal(f.calls.length,n,'The removed private observer does not clear the restored normal chrome');assert.equal(f.win.listenerCount('show'),1);f.paint.dispose();
});
test('a failed new workspace paint invalidates the shared native owner and display movement rechecks scale',()=>{
 const f=fixture();f.paint(panes);const other=install(f.win,{disposed:false},{native:f.native,screen:f.screen});f.setFail(true);other([{...panes[0],x:450}]);f.setFail(false);let n=f.calls.length;f.paint(panes);assert.equal(f.calls.length,n+1,'Native failure may have removed the previous shared trim');
 n=f.calls.length;f.win.emit('move');assert.equal(f.calls.length,n+1,'The native layer sees scale-only moves even with identical DIP geometry');assert.deepEqual(f.calls.at(-1).geometry,{width:1000,height:800});
 f.screen.emit('display-metrics-changed',{}, {},['scaleFactor']);assert.equal(f.calls.length,n+2,'A stationary window also rechecks a changed monitor scale');f.screen.emit('display-metrics-changed',{}, {},['rotation']);assert.equal(f.calls.length,n+2);
 other.dispose();assert.equal(f.calls.length,n+2,'Disposing an inactive mask does not destroy the owner');f.paint.dispose();assert.equal(f.screen.listenerCount('display-metrics-changed'),0);
});
test('X11 shape geometry preserves twelve DIP arcs and bounds at normal and fractional scales',{skip:process.platform!=='linux'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-linux-corners-'));
 try{
  const source=path.join(temp,'geometry.cc'),binary=path.join(temp,'geometry');
  fs.writeFileSync(source,`#include <cassert>\n#include <cmath>\n#include "pane-corners-linux-geometry.h"\nusing namespace mouse_linux_corners;\nbool painted(const Shape& s,int x,int y){for(const auto& r:s.runs)if(y>=r.y&&y<r.y+r.height&&x>=r.x&&x<r.x+r.width)return true;return false;}\nint main(){Pane p{100,80,400,300,0xc7cfdf};for(double scale:{.5,1.,1.25,1.5,2.,3.,8.})for(bool right:{false,true}){auto s=corner(p,scale,scale,right);assert(s.width>0&&s.width<=96&&s.height>0&&s.height<=96);assert(s.rx==12*scale&&s.ry==12*scale);assert(s.x>=std::floor(p.x*scale));assert(s.x+s.width<=std::ceil((p.x+p.width)*scale));assert(s.y+s.height<=std::ceil((p.y+p.height)*scale));assert(s.y==std::floor((p.y+p.height-12)*scale));for(const auto& r:s.runs)assert(r.x>=0&&r.y>=0&&r.x+r.width<=s.width&&r.y+r.height<=s.height);double ix=(right?p.x+p.width-10:p.x+10)*scale-s.x,iy=(p.y+p.height-5)*scale-s.y;assert(!painted(s,std::floor(ix),std::floor(iy)));double ox=(right?p.x+p.width-1:p.x+1)*scale-s.x,oy=(p.y+p.height-1)*scale-s.y;assert(painted(s,std::floor(ox),std::floor(oy)));}auto l=corner(p,1,1,false),r=corner(p,1,1,true);assert(l.width==12&&l.height==12&&r.width==12&&r.height==12);for(int y=0;y<12;y++)for(int x=0;x<12;x++)assert(painted(l,x,y)==painted(r,11-x,y));assert(same(p,p));auto q=p;q.color=0x43536b;assert(!same(p,q));q=p;q.x+=.25;assert(!same(p,q));assert(pixel(0xc7cfdf,0xff0000,0xff00,0xff,24)==0xc7cfdf);assert(pixel(0xc7cfdf,0xff0000,0xff00,0xff,32)==0xffc7cfdfUL);assert(pixel(0,0xff0000,0xff00,0xff,32)==0xff000000UL);assert(pixel(0xff0000,0xf800,0x7e0,0x1f,16)==0xf800);assert(pixel(0x00ff00,0xf800,0x7e0,0x1f,16)==0x7e0);assert(pixel(0x0000ff,0xf800,0x7e0,0x1f,16)==0x1f);assert(pixel(0xff0000,0xff,0xff00,0xff0000,24)==0xff);}\n`);
  cp.execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Werror','-I',path.join(__dirname,'mouse-native'),source,'-o',binary],{stdio:'pipe',timeout:30000});cp.execFileSync(binary,[],{stdio:'pipe',timeout:5000});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('the compiled Linux corner addon fails closed without X11 and accepts no fabricated parent',{skip:process.platform!=='linux'||!fs.existsSync(path.join(__dirname,'mouse-platform.node'))},()=>{
 const script=`const a=require('node:assert/strict'),n=require(${JSON.stringify(path.join(__dirname,'mouse-platform.node'))});a.equal(typeof n.paneCorners,'function');a.equal(typeof n.paneCornersState,'function');const h=Buffer.from([255,255,255,255]);a.equal(n.paneCorners(h,[{x:0,y:0,width:100,height:100,color:'#c7cfdf'}],{width:100,height:100}),0);a.equal(n.paneCornersState(h).supported,false);a.equal(n.paneCornersState(h).reason,'x11-unavailable');a.equal(n.paneCorners(Buffer.alloc(0),[],{}),0);`;
 cp.execFileSync(process.execPath,['-e',script],{env:{...process.env,DISPLAY:'',WAYLAND_DISPLAY:''},stdio:'pipe',timeout:10000});
});
