'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse/tab-flow.js'),'utf8');
const {usesTabBox,tabBoxReadback,assertTabBox}=require('./mouse-tab-flow-smoke.cjs').fixtures;

test('Mac tab paint owns no asynchronous overlay geometry after title or drag changes',()=>{
 const document={documentElement:{dataset:{}},querySelector(){assert.fail('Mac must not mount a second painted geometry layer');}};
 vm.runInNewContext(source,{MouseNative:{platform:'darwin'},document,ResizeObserver:class{constructor(){assert.fail('No overlay resize observer');}},MutationObserver:class{constructor(){assert.fail('No overlay metadata observer');}},requestAnimationFrame(){assert.fail('No deferred overlay movement');}});
 assert.equal(document.documentElement.dataset.platform,'darwin');
});

test('the retained SVG initialization stays available to the other existing platform releases',()=>{
 for(const platform of ['win32','linux']){
  const mounted=[],resized=[],mutated=[],frames=[];
  const node=()=>({classList:{add(){}},setAttribute(){},append(){}}),bar={prepend(value){mounted.push(value);}},strip={addEventListener(){}};
  const document={documentElement:{dataset:{platform}},querySelector:selector=>selector==='.toolbar'?bar:strip,createElementNS:node};
  vm.runInNewContext(source,{MouseNative:{platform},document,ResizeObserver:class{observe(value){resized.push(value);}},MutationObserver:class{observe(value){mutated.push(value);}},requestAnimationFrame(fn){frames.push(fn);return 1;},window:{addEventListener(){}}});
  assert.equal(mounted.length,1);assert.deepEqual(resized,[bar,strip]);assert.deepEqual(mutated,[strip]);assert.equal(frames.length,1);assert.equal(document.documentElement.dataset.platform,platform);
 }
});

test('the new retained native oracle is limited to the actual Mac643 identity',()=>{
 assert.equal(usesTabBox({platform:'darwin',version:'6.0.44'}),true);
 for(const identity of [{platform:'darwin',version:'6.0.42'},{platform:'win32',version:'6.0.44'},{platform:'linux',version:'6.0.44'},{platform:'darwin',version:'6.0.440'},null,{}])assert.equal(usesTabBox(identity),false);
});

function proof(){return{
 paintOwner:'tab-box',platform:'darwin',version:'6.0.44',platformAttribute:'darwin',paneMode:'rounded',viewport:800,tab:'selected',
 bounds:{x:320,y:4,width:180,height:32,right:500,bottom:36},barBounds:{x:0,y:0,width:800,height:40,right:800,bottom:40},
 fill:'rgb(255, 255, 255)',expectedFill:'rgb(255, 255, 255)',ink:'rgb(27, 38, 56)',expectedInk:'rgb(27, 38, 56)',flowAbsent:true,
 corners:[9,9,9,9],allTabCorners:[[9,9,9,9],[9,9,9,9]],toolbarBorderWidth:0,rimDisplay:'none',rimContent:'none',scroll:580,client:580,burrow:[36,23],plus:14,hit:true
};}

test('native tab-box oracle rejects separator-colored paint, a second layer, broken contrast and moved bounds',()=>{
 assert.doesNotThrow(()=>assertTabBox(proof()));
 for(const mutate of [g=>{g.fill='rgb(199, 207, 223)';},g=>{g.flowAbsent=false;},g=>{g.ink='rgb(255, 255, 255)';},g=>{g.bounds.bottom=41;},g=>{g.bounds.width=0;},g=>{g.bounds.right=NaN;},g=>{g.hit=false;},g=>{g.scroll=g.client+2;},g=>{g.platformAttribute='';},g=>{g.paintOwner='svg';}]){
  const g=proof();mutate(g);assert.throws(()=>assertTabBox(g),{code:'ERR_ASSERTION'});
 }
});

test('square-mode proof checks all visible tab corners, not only the selected tab',()=>{
 const g=proof();g.paneMode='square';g.corners=[0,0,0,0];g.allTabCorners=[[0,0,0,0],[0,0,0,0]];assert.doesNotThrow(()=>assertTabBox(g));
 g.allTabCorners[1][3]=3;assert.throws(()=>assertTabBox(g),/Every square-mode top tab/);
});

test('serialized measurement compares the actual tab to the root surface outside custom toolbar inheritance',()=>{
 const g=proof(),node=(bounds,style={})=>({getBoundingClientRect:()=>bounds,style,...style});
 const rootStyle={backgroundColor:g.expectedFill,color:g.expectedInk};
 const active=node(g.bounds,{dataset:{tab:g.tab},borderTopLeftRadius:'9px',borderTopRightRadius:'9px',borderBottomRightRadius:'9px',borderBottomLeftRadius:'9px',backgroundColor:g.fill,color:g.ink});
 active.closest=()=>active;
 const bar=node(g.barBounds,{backgroundColor:'rgb(0, 0, 0)',color:'rgb(255, 255, 255)',borderBottomWidth:'0px'}),nora=node({width:36,height:23});
 const strip={querySelector:()=>active,querySelectorAll:()=>[active],scrollWidth:580,clientWidth:580};
 let probe;
 const document={documentElement:{dataset:{platform:'darwin',paneMode:'rounded'}},querySelector:selector=>({'.toolbar':bar,'#tabstrip':strip,'#desktops-button':nora,'#new-tab .burrow-plus':node({width:14}),'.mouse-tab-flow':null}[selector]),createElement(){probe={style:{},remove(){}};return probe;},body:{append(value){assert.equal(value,probe);}},elementFromPoint:()=>active};
 const value=vm.runInNewContext('('+tabBoxReadback.toString()+')()',{MouseNative:{platform:'darwin',version:'6.0.44'},document,innerWidth:800,getComputedStyle:(value,pseudo)=>value===probe?rootStyle:pseudo?{display:'none',content:'none'}:value});
 assert.equal(probe.style.background,'var(--panel)');assert.equal(probe.style.color,'var(--text)');
 assert.equal(value.expectedFill,g.expectedFill);assert.equal(value.expectedInk,g.expectedInk);assert.doesNotThrow(()=>assertTabBox(JSON.parse(JSON.stringify(value))));
});

test('Mac polish loads after the component sheets it refines',()=>{
 const html=fs.readFileSync(path.join(__dirname,'mouse/index.html'),'utf8'),sheets=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 const current=sheets.indexOf('mac-workspace-polish.css');assert.ok(current>sheets.indexOf('appearance.css'));assert.ok(current>sheets.indexOf('settings-glass.css'));assert.ok(current>sheets.indexOf('tone-input.css'));assert.ok(current>sheets.indexOf('address-tools.css'));
});
