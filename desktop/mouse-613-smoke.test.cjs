'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {measureRegrownTabs,assertRegrownTabs}=require('./mouse-613-smoke.cjs');
function fixture({grip='after',stripWidth=658,count=10}={}){
 const node=(id,width,style={})=>({id,className:id==='grip'?'mouse-window-drag-handle':'',width,style:{display:'block',visibility:'visible',position:'static',marginLeft:'0px',marginRight:'0px',...style},rect:{left:0,right:0,width:0},getBoundingClientRect(){return{...this.rect};}});
 const privateButton=node('private-button',28,{marginLeft:'1px',marginRight:'2px'}),handle=node('grip',26,{marginLeft:'3px',marginRight:'5px'}),plus=node('new-tab',28,{marginLeft:'1px',marginRight:'2px'}),strip=node('tabstrip',stripWidth,{marginLeft:'2px',marginRight:'3px',columnGap:'4px',width:stripWidth+'px'}),absolute=node('traffic-space',80,{position:'absolute'}),fixed=node('fixed-overlay',70,{position:'fixed'}),hidden=node('hidden-control',40,{display:'none',marginLeft:'7px',marginRight:'9px'});
 const tabWidth=Math.min(230,(stripWidth-4*(count-1))/count);strip.dataset={density:tabWidth<24?'micro':tabWidth<55?'icons':tabWidth<105?'compact':'normal'};strip.querySelectorAll=selector=>{assert.equal(selector,'.tab-item');return Array.from({length:count},()=>({getBoundingClientRect:()=>({width:tabWidth})}));};
 const controls=grip==='before'?[privateButton,handle,strip,plus]:grip==='all-before'?[privateButton,handle,plus,strip]:[privateButton,strip,plus,handle];
 // The toolbar's content interval is [24,801]: 800px border box at x10,
 // left border2/padding12 and right border1/padding8. The outer controls
 // total31+34+31px, three gaps18px and strip margins5px leave658px.
 let left=24;for(const e of controls){left+=parseFloat(e.style.marginLeft);e.rect={left,right:left+e.width,width:e.width};left+=e.width+parseFloat(e.style.marginRight)+6;}
 absolute.rect={left:700,right:780,width:80};fixed.rect={left:740,right:810,width:70};
 const toolbar=node('toolbar',800,{borderRightWidth:'1px',paddingRight:'8px',columnGap:'6px'});toolbar.rect={left:10,right:810,width:800};toolbar.children=[absolute,hidden,...controls,fixed];
 const scope={getComputedStyle:e=>e.style,document:{querySelector:selector=>({'#tabstrip':strip,'.toolbar':toolbar,'#new-tab':plus}[selector]||null)}};
 return{scope,strip,plus,handle,toolbar,hidden,absolute,fixed};
}
test('native tab oracle independently reserves the grip before or after the strip',()=>{
 for(const grip of ['before','after']){const f=fixture({grip}),result=measureRegrownTabs(f.scope);assert.equal(result.available,658);assert.equal(result.expected,62.2);assert.equal(result.min,62.2);assert.equal(result.max,62.2);assert.equal(result.count,10);assert.equal(result.density,'compact');assert.doesNotThrow(()=>assertRegrownTabs(result));
  assert.equal(result.trailing.span,grip==='after'?71:31);assert.equal(result.trailing.leadingGap,6);assert.deepEqual(result.trailing.controls.map(c=>c.id),grip==='after'?['new-tab','grip']:['new-tab']);
 }
});
test('no trailing control means no extra leading gap and left controls remain reserved',()=>{
 const result=measureRegrownTabs(fixture({grip:'all-before'}).scope);assert.equal(result.available,658);assert.equal(result.expected,62.2);assert.deepEqual(result.trailing,{left:null,right:null,span:0,leadingGap:0,controls:[]});assert.doesNotThrow(()=>assertRegrownTabs(result));
});
test('an undersized strip moves its trailing controls too but cannot shrink its expected interval',()=>{
 const full=measureRegrownTabs(fixture().scope),small=measureRegrownTabs(fixture({stripWidth:400}).scope);
 assert.equal(small.strip.width,400);assert.equal(small.trailing.left,full.trailing.left-258);assert.equal(small.trailing.right,full.trailing.right-258);assert.equal(small.trailing.span,full.trailing.span);assert.equal(small.available,full.available);assert.equal(small.expected,full.expected);
 assert.throws(()=>assertRegrownTabs(small),/tabs must regrow after closing the overflow test tabs/);
 const tolerance=measureRegrownTabs(fixture({stripWidth:638}).scope);assert.doesNotThrow(()=>assertRegrownTabs(tolerance),'the retained two-pixel tolerance is unchanged');
 assert.throws(()=>assertRegrownTabs(measureRegrownTabs(fixture({stripWidth:637}).scope)),/tabs must regrow/,'more than two pixels of missing width per tab still fails');
});
test('hidden in-flow grip still consumes space while overlays and display-none controls do not',()=>{
 const f=fixture();f.handle.style.visibility='hidden';const result=measureRegrownTabs(f.scope);assert.equal(result.available,658);assert.deepEqual(result.trailing.controls.map(c=>c.id),['new-tab','grip']);assert.equal(result.trailing.controls[1].visibility,'hidden');assert.doesNotThrow(()=>assertRegrownTabs(result));
});
test('the oracle retains maximum tab width and rejects an incorrect density',()=>{
 const capped=measureRegrownTabs(fixture({stripWidth:464,count:2}).scope);assert.equal(capped.available,658);assert.equal(capped.expected,230);assert.doesNotThrow(()=>assertRegrownTabs(capped));
 const wrong=measureRegrownTabs(fixture().scope);wrong.density='normal';assert.throws(()=>assertRegrownTabs(wrong),/compact/);
});
test('the serialized installed measurement uses only renderer geometry and its report is uploaded',()=>{
 const f=fixture(),result=JSON.parse(JSON.stringify(vm.runInNewContext('('+measureRegrownTabs.toString()+')()',f.scope)));assert.equal(result.available,658);assert.equal(result.expected,62.2);assert.doesNotThrow(()=>assertRegrownTabs(result));
 assert.doesNotMatch(measureRegrownTabs.toString(),/MouseTabOrder|tabstripAvailableWidth|MouseTest|require\(/);
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/mouse-macos.yml'),'utf8');assert.match(workflow,/name: mouse-arm64-verification[\s\S]*desktop\/mouse-613-\*\.json/);
});
