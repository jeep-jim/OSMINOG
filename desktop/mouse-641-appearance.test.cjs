'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const A=require('./mouse/appearance.js');
const root=theme=>({dataset:{theme},style:{values:new Map(),getPropertyValue(name){return this.values.get(name)||'';},setProperty(name,value){this.values.set(name,value);},removeProperty(name){this.values.delete(name);}}});
const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
const write=(current,theme,name,changes,options)=>A.update(current,A.changeSurface(current,theme,name,changes),options).settings;

test('surface customizations persist independently for each bar and theme through a fresh loader',()=>{
 const storage=memory(),target=root('light');let current=A.read(storage);
 current=write(current,'light','top',{mode:'solid',color:'#E9D8FF',opacity:68},{storage,target});
 current=write(current,'dark','top',{mode:'gradient',color:'#174A70',endColor:'#51376B',angle:45,opacity:82},{storage,target});
 current=write(current,'dark','bottom',{mode:'solid',color:'#1E5148',opacity:47},{storage,target});
 current=write(current,'dark','workspace',{mode:'gradient',color:'#445577',endColor:'#667788',angle:90},{storage,target});
 assert.equal(A.getSurface(current,'light','top').opacity,68);assert.equal(A.getSurface(current,'dark','top').opacity,82);assert.equal(A.getSurface(current,'dark','bottom').opacity,47);
 assert.equal(target.style.getPropertyValue('--mouse-top-background'),'rgba(233, 216, 255, 0.68)');assert.equal(target.dataset.surfaceBottom,undefined);
 target.dataset.theme='dark';A.apply(current,target);assert.equal(target.dataset.surfaceTop,'custom');assert.equal(target.dataset.surfaceBottom,'custom');assert.equal(target.dataset.surfaceWorkspace,'custom');assert.match(target.style.getPropertyValue('--mouse-top-background'),/^linear-gradient\(45deg in srgb,/);
 const reloaded=A.read(storage);assert.deepEqual(reloaded,current);assert.equal(reloaded.paneMode,'rounded');assert.equal(reloaded.whiteTone,55);
 const context=vm.createContext({document:{documentElement:root('dark')},localStorage:storage});vm.runInContext(fs.readFileSync(require.resolve('./mouse/appearance.js'),'utf8'),context);assert.equal(context.document.documentElement.style.getPropertyValue('--mouse-bottom-background'),'rgba(30, 81, 72, 0.47)');
});

test('reset restores the untouched640 surface cascade only for the selected theme',()=>{
 const storage=memory(),target=root('dark');let current=write(A.DEFAULTS,'dark','top',{color:'#663399'},{storage,target});
 current=write(current,'light','bottom',{color:'#DFEBFF'},{storage,target});current=A.update(current,{whiteTone:0,paneMode:'square'},{storage,target}).settings;
 current=A.update(current,A.resetSurfaces(current,'dark'),{storage,target}).settings;
 assert.equal(current.surfaces.dark,undefined);assert.equal(current.surfaces.light.bottom.color,'#DFEBFF');assert.equal(target.dataset.surfaceTop,undefined);assert.equal(target.style.getPropertyValue('--mouse-top-background'),'');assert.equal(target.dataset.paneMode,'square');assert.equal(target.style.getPropertyValue('--text-primary'),'#A0A0A0');
 target.dataset.theme='light';A.apply(current,target);assert.equal(target.dataset.surfaceBottom,'custom');
 current=A.update(current,A.resetSurfaces(current,'light'),{storage,target}).settings;assert.deepEqual(current,{paneMode:'square',whiteTone:0});assert.equal(target.style.getPropertyValue('--mouse-bottom-background'),'');
});

test('private surface changes and theme reset never replace normal-profile storage',()=>{
 const storage=memory(),target=root('dark'),normal=write(A.DEFAULTS,'dark','bottom',{color:'#174A70'},{storage,target}),saved=storage.getItem(A.KEY);
 let privateValue=write(normal,'dark','top',{color:'#883355',opacity:0},{storage,target,privateMode:true});assert.equal(target.dataset.surfaceTop,'custom');assert.equal(storage.getItem(A.KEY),saved);
 privateValue=A.update(privateValue,A.resetSurfaces(privateValue,'dark'),{storage,target,privateMode:true}).settings;assert.equal(storage.getItem(A.KEY),saved);assert.equal(privateValue.surfaces,undefined);assert.deepEqual(A.read(storage),normal);
});

test('arbitrary CSS, script strings, unknown surface keys and invalid numeric writes fail before painting or saving',()=>{
 const storage=memory(),target=root('dark');storage.setItem(A.KEY,'unchanged');
 for(const values of [{color:'url(https://example.test)'},{color:'#fff'},{color:'#112233;opacity:0'},{endColor:'var(--text)'},{mode:'conic-gradient'},{angle:NaN},{angle:360},{angle:-1},{angle:2.5},{opacity:101},{opacity:-1},{opacity:'50'},{opacity:Infinity},{css:'display:none'}])assert.throws(()=>write(A.DEFAULTS,'dark','top',values,{storage,target}));
 for(const surfaces of [null,[],{system:{}},{light:{unknown:{}}},{light:{top:{mode:'solid',color:'#112233',endColor:'#445566',angle:90,opacity:50,css:'none'}}}])assert.throws(()=>A.update(A.DEFAULTS,{surfaces},{storage,target}));
 assert.equal(storage.getItem(A.KEY),'unchanged');assert.equal(target.style.getPropertyValue('--mouse-top-background'),'');
});

test('legacy data and corrupt optional surfaces preserve independent white tone and safe defaults',()=>{
 assert.deepEqual(A.normalize({whiteTone:71,paneMode:'square'}),{whiteTone:71,paneMode:'square'});
 const restored=A.normalize({whiteTone:71,surfaces:{light:{top:{color:'red',endColor:'url(x)',angle:Infinity,opacity:-10,mode:'url(x)'},bottom:[]},system:{workspace:{color:'#FFFFFF'}}}});
 assert.deepEqual(restored.surfaces.light.top,{...A.SURFACE_DEFAULTS.light.top,opacity:0});assert.equal(restored.surfaces.system,undefined);assert.equal(restored.surfaces.light.bottom,undefined);assert.equal(restored.whiteTone,71);
});

test('background opacity does not lower foreground opacity and protective control surfaces provide readable text',()=>{
 const storage=memory(),target=root('dark');let value=write(A.DEFAULTS,'dark','top',{mode:'gradient',color:'#FFFFFF',endColor:'#000000',opacity:0},{storage,target});
 assert.match(target.style.getPropertyValue('--mouse-top-background'),/rgba\(255, 255, 255, 0\)/);assert.equal(target.style.getPropertyValue('opacity'),'');
 const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)),lum=color=>{const values=color.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*values[0]+.7152*values[1]+.0722*values[2];};
 for(const theme of ['light','dark'])for(const whiteTone of [0,55,100])for(const color of ['#000000','#FFFFFF','#F700D6','#11BBAA']){
  value={...value,whiteTone};value=write(value,theme,'top',{mode:'gradient',color,endColor:'#FFFFFF',opacity:100},{storage,target});const palette=A.surfaceInk(value,theme,'top'),ink=lum(rgb(palette.ink)),control=palette.control.match(/[\d.]+/g).map(Number),backdrop=rgb(color),background=lum(control.slice(0,3).map((n,i)=>n*control[3]+backdrop[i]*(1-control[3])));
  assert.ok((Math.max(ink,background)+.05)/(Math.min(ink,background)+.05)>=4.5,JSON.stringify({theme,whiteTone,color,palette}));
 }
});

test('workspace linear-gradient coordinates follow CSS axes, alpha and sidebar dim',()=>{
 const storage=memory(),target=root('light'),bounds={x:20,y:40,width:400,height:200};let value=write(A.DEFAULTS,'light','workspace',{mode:'gradient',color:'#FF0000',endColor:'#0000FF',angle:90,opacity:100},{storage,target});
 const g=A.workspaceGradient(value,'light',bounds);for(const[key,expected]of Object.entries({x0:20,y0:140,x1:420,y1:140}))assert.ok(Math.abs(g[key]-expected)<1e-8,key);assert.equal(g.start,'#FF0000');assert.equal(g.end,'#0000FF');
 value=write(value,'light','workspace',{angle:180},{storage,target});const vertical=A.workspaceGradient(value,'light',bounds);assert.ok(Math.abs(vertical.y0-40)<1e-8);assert.ok(Math.abs(vertical.y1-240)<1e-8);
 value=write(value,'light','workspace',{angle:0},{storage,target});const up=A.workspaceGradient(value,'light',bounds);assert.equal(up.y0,240);assert.equal(up.y1,40);
 const dimmed=A.workspaceGradient(value,'light',bounds,{dim:.14});assert.equal(dimmed.start,'#DB0000');assert.equal(dimmed.end,'#0000DB');assert.equal(A.workspaceColor(value,'light',{dim:.14}),'#6E006E');
 value=write(value,'light','workspace',{opacity:0},{storage,target});assert.equal(A.workspaceGradient(value,'light',bounds).start,'#F3F5F9');assert.equal(A.workspaceGradient(A.DEFAULTS,'light',bounds),undefined);assert.equal(A.workspaceColor(A.DEFAULTS,'dark'),undefined);
 value=write(value,'light','workspace',{mode:'solid'},{storage,target});assert.equal(A.workspaceGradient(value,'light',bounds),undefined);
});

function layoutFixture(){
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8'),{module,exports:module.exports,clearTimeout,require:id=>id==='electron'?{}:require(id)});
 let masks=[],boundsCalls=0;const view={setBounds(){boundsCalls++;},setVisible(){},getVisible:()=>true},tab={id:'t',project:'p',view,visible:true},host={win:{isDestroyed:()=>false,getContentSize:()=>[900,700],contentView:{}},mouseRoundedPanes:true,mouseCornerMask:items=>masks=items,tabs:new Map([['t',tab]]),providers:new Map(),project:'p'};
 return{paint:panels=>module.exports.BrowserWorkspace.prototype.layout.call(host,panels),get masks(){return masks;},get boundsCalls(){return boundsCalls;}};
}
test('native layout admits only typed finite gradient fields and repaints color without changing page geometry',()=>{
 const f=layoutFixture(),base={id:'t',x:50,y:80,width:400,height:300,roundBottom:12,roundColor:'#345678'},gradient={x0:0,y0:40,x1:800,y1:700,start:'#123456',end:'#ABCDEF'};
 f.paint([{...base,roundGradient:gradient}]);assert.deepEqual(JSON.parse(JSON.stringify(f.masks[0].gradient)),gradient);assert.equal(f.boundsCalls,1);
 f.paint([{...base,roundGradient:{...gradient,start:'#FF0000'}}]);assert.equal(f.masks[0].gradient.start,'#FF0000');assert.equal(f.boundsCalls,1);
 for(const wrong of [{...gradient,x0:NaN},{...gradient,x1:1e100},{...gradient,start:'url(x)'},{...gradient,end:'#fff'},{...gradient,x0:0,y0:0,x1:0,y1:0},{...gradient,css:'black'},[]]){f.paint([{...base,roundGradient:wrong}]);assert.equal(f.masks[0].gradient,undefined);assert.equal(f.masks[0].color,'#345678');}
});

test('shared native gradient sampler matches sRGB stops at both corners and fractional display coordinates',{skip:process.platform!=='linux'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mouse641-gradient-'));
 try{const source=path.join(temp,'gradient.cc'),binary=path.join(temp,'gradient');fs.writeFileSync(source,'#include <cassert>\n#include "pane-corner-gradient.h"\n#include "pane-corners-linux-geometry.h"\nusing namespace mouse_corner_gradient;\nint main(){Gradient g{true,0,0,100,0,0xff0000,0x0000ff};assert(sample(g,0,50,0)==0xff0000);assert(sample(g,100,50,0)==0x0000ff);assert(sample(g,50,0,0)==0x800080);assert(sample(g,-20,0,0)==0xff0000);assert(sample(g,120,0,0)==0x0000ff);assert(sample(g,1,0,0)!=sample(g,99,0,0));assert(sample(g,20.5/1.25,0,0)==0xd5002a);Gradient off{};assert(sample(off,0,0,0x123456)==0x123456);assert(!same(g,off));Gradient sameG=g;assert(same(g,sameG));sameG.x0=1;assert(!same(g,sameG));mouse_linux_corners::Pane a{0,40,300,200,0x345678},b=a;assert(mouse_linux_corners::same(a,b));b.gradient=g;assert(!mouse_linux_corners::same(a,b));}\n');cp.execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Werror','-I',path.join(__dirname,'mouse-native'),source,'-o',binary],{stdio:'pipe',timeout:30000});cp.execFileSync(binary,[],{stdio:'pipe',timeout:5000});}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
