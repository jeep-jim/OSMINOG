'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {nativeStaticFrameMatch}=require('./mouse-smoke-frames.cjs');
const localModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-628-local-smoke.cjs'),'utf8'),{module:localModule,require:name=>name.startsWith('node:')?require(name):{}},{filename:'mouse-628-local-smoke.cjs'});
const {localSettingsThemeProbe,readLocalSettingsThemeProbe}=localModule.exports,plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const rect={x:704,y:138,width:320,height:58},panelRect={x:704,y:46,width:320,height:600},style={display:'flex',visibility:'visible',opacity:'1',backgroundImage:'none',backgroundColor:'rgb(250, 249, 253)'},pageStyle={display:'flex',visibility:'visible',opacity:'1'},panelStyle={...pageStyle},hits=[];
 const panel={hidden:false,dataset:{view:'settings'},getBoundingClientRect:()=>({...panelRect})},page={hidden:false,localName:'section',parentElement:panel},child={},header={parentElement:page,getBoundingClientRect:()=>({...rect}),contains:node=>node===child};let modal=null;
 const scope={innerWidth:1024,innerHeight:684,getComputedStyle:e=>e===page?pageStyle:e===panel?panelStyle:style,document:{documentElement:{dataset:{theme:'light'}},querySelector:selector=>selector===':modal'?modal:({'#agent-panel':panel,'#agent-settings-page':page,'#agent-settings-page>header':header}[selector]||null),elementFromPoint(x,y){hits.push({x,y});return x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height?header:page;}}};
 return{scope,rect,panelRect,style,pageStyle,panelStyle,page,panel,header,child,hits,setModal:value=>{modal=value;}};
}
test('Local theme probe measures the actual inline header inside its panel',()=>{
 const f=fixture(),value=plain(localSettingsThemeProbe(f.scope));assert.deepEqual(value,{source:'computed opaque inline settings header',selector:'#agent-settings-page>header',theme:'light',page:{selector:'#agent-settings-page',hidden:false,modal:false},panel:{selector:'#agent-panel',view:'settings',bounds:{x:704,y:46,width:320,height:600}},elementBounds:{x:704,y:138,width:320,height:58},inset:12,bounds:{x:716,y:150,width:296,height:34},css:'rgb(250, 249, 253)'});
 assert.equal(f.hits.length,5);assert.ok(f.hits.every(p=>p.x>716&&p.x<1012&&p.y>150&&p.y<184));
 f.scope.document.documentElement.dataset.theme='dark';f.style.backgroundColor='rgb(24, 25, 34)';assert.equal(localSettingsThemeProbe(f.scope).theme,'dark');assert.equal(localSettingsThemeProbe(f.scope).css,'rgb(24, 25, 34)');
 f.scope.document.elementFromPoint=()=>f.child;assert.equal(localSettingsThemeProbe(f.scope).page.modal,false,'text and buttons owned by the inline header remain legitimate hits');
});
test('Local theme probe rejects hidden, external, modal or translucent settings',()=>{
 for(const change of [f=>{f.page.hidden=true;},f=>{f.panel.hidden=true;},f=>{f.page.localName='dialog';},f=>{f.panel.dataset.view='chat';},f=>{f.page.parentElement={};},f=>{f.header.parentElement={};},f=>{f.setModal({});},f=>{f.scope.document.querySelector=()=>null;}]){const f=fixture();change(f);assert.throws(()=>localSettingsThemeProbe(f.scope),/visible inline header/);}
 for(const change of [f=>{f.style.display='none';},f=>{f.style.visibility='hidden';},f=>{f.style.opacity='.9';},f=>{f.pageStyle.opacity='.9';},f=>{f.panelStyle.visibility='hidden';},f=>{f.style.backgroundImage='linear-gradient(white,black)';},f=>{f.rect.x=-1;},f=>{f.rect.x=705;},f=>{f.rect.y=-1;},f=>{f.rect.y=650;},f=>{f.rect.width=24;},f=>{f.rect.height=NaN;},f=>{f.panelRect.x=705;},f=>{f.panelRect.height=100;},f=>{f.scope.innerWidth=NaN;}]){const f=fixture();change(f);assert.throws(()=>localSettingsThemeProbe(f.scope),/visible opaque chrome/);}
 for(const color of ['transparent','rgba(24, 25, 34, 0.5)','rgb(256, 0, 0)','rgb(1.5, 2, 3)']){const f=fixture();f.style.backgroundColor=color;assert.throws(()=>localSettingsThemeProbe(f.scope),/opaque RGB theme colour/);}
 const f=fixture();f.style.backgroundColor='rgba(24, 25, 34, 1)';assert.equal(localSettingsThemeProbe(f.scope).css,f.style.backgroundColor);
});
test('Local theme probe checks all five hit points and refuses a covered corner',()=>{
 const f=fixture();f.scope.document.elementFromPoint=(x,y)=>x===864&&y===167?f.header:f.page;assert.throws(()=>localSettingsThemeProbe(f.scope),/covered or clipped/,'a visible centre does not certify the full header probe');
 f.scope.document.elementFromPoint=()=>({});assert.throws(()=>localSettingsThemeProbe(f.scope),/covered or clipped/,'an unrelated top-layer element cannot be accepted');
});
test('Local renderer probe returns its real error message and stack to the main process',async()=>{
 const f=fixture(),execute=source=>Promise.resolve(vm.runInNewContext(source,f.scope));assert.deepEqual(plain(await readLocalSettingsThemeProbe(execute)),plain(localSettingsThemeProbe(f.scope)));
 f.scope.document.elementFromPoint=()=>f.page;
 await assert.rejects(readLocalSettingsThemeProbe(execute),error=>{assert.equal(error.message,'Local settings theme probe: Local settings header is covered or clipped');assert.equal(error.rendererError.name,'Error');assert.equal(error.rendererError.message,'Local settings header is covered or clipped');assert.match(error.rendererError.stack,/localSettingsThemeProbe/);return true;});
});
test('The inline theme sample retains the native pixel comparison against the current theme',()=>{
 const f=fixture();Object.assign(f.rect,{x:0,y:0,width:64,height:48});Object.assign(f.panelRect,{x:0,y:0,width:64,height:48});f.scope.innerWidth=64;f.scope.innerHeight=48;const probe=plain(localSettingsThemeProbe(f.scope)),rgb=[250,249,253],size={width:64,height:48},data=Buffer.alloc(size.width*size.height*4);
 for(let i=0;i<data.length;i+=4){data[i]=253;data[i+1]=249;data[i+2]=250;data[i+3]=255;}
 const at=(x,y)=>(y*size.width+x)*4;data[at(14,14)]=100;data[at(15,14)]=140;
 const reference={...size,data},candidate={...size,data:Buffer.from(data)},check=value=>nativeStaticFrameMatch({reference,candidate:value,viewport:size,mapping:{scaleX:1,scaleY:1,originX:0,originY:0},regions:[{label:'inline heading',bounds:probe.bounds}],background:{...probe,rgb}});
 assert.equal(check(candidate).accepted,true);const stale={...size,data:Buffer.from(data)};for(let y=12;y<36;y++)for(let x=12;x<52;x++){const i=at(x,y);stale.data[i]=34;stale.data[i+1]=25;stale.data[i+2]=24;}
 const rejected=check(stale);assert.equal(rejected.accepted,false);assert.ok(rejected.reasons.includes('native display does not match the current theme'));assert.equal(rejected.tolerance,2);
});
