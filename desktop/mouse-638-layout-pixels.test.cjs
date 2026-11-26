'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('./mouse/layout.js'),MouseAppearance=require('./mouse/appearance.js');
const tree=()=>({axis:'x',ratio:1/3,a:{id:'p1'},b:{axis:'y',ratio:.37,a:{id:'p2'},b:{id:'p3'}}});

test('fractional persisted splits partition whole native pixels with one square seam and unchanged ratios',()=>{
 const value=tree(),before=JSON.stringify(value),result=L.pixelLayout(value,1001,701,1);
 assert.deepEqual(result.panes,[{id:'p1',x:0,y:0,width:333,height:701},{id:'p2',x:334,y:0,width:667,height:259},{id:'p3',x:334,y:260,width:667,height:441}]);
 assert.deepEqual(result.branches,[{path:'',axis:'x',a:333,b:667,gap:1},{path:'b',axis:'y',a:259,b:441,gap:1}]);
 assert.equal(JSON.stringify(value),before);
 assert.deepEqual(L.pixelLayout(value,1001,701,6).panes,[{id:'p1',x:0,y:0,width:332,height:701},{id:'p2',x:338,y:0,width:663,height:257},{id:'p3',x:338,y:263,width:663,height:438}]);
});

test('all supported grid counts have non-overlapping integer endpoints inside their original viewport',()=>{
 for(const count of [1,2,3,4,6,8,9,12])for(const gap of [1,6])for(const [width,height]of [[1001,701],[1279,813],[2048,1182]]){
  const value=L.preset(count),mutate=node=>{if(!node.id){node.ratio=node.axis==='x'?.314159:.618034;mutate(node.a);mutate(node.b);}};mutate(value);
  const snapshot=JSON.stringify(value),result=L.pixelLayout(value,width,height,gap);assert.equal(result.panes.length,count);assert.equal(JSON.stringify(value),snapshot);
  assert.equal(Math.min(...result.panes.map(p=>p.x)),0);assert.equal(Math.min(...result.panes.map(p=>p.y)),0);
  assert.equal(Math.max(...result.panes.map(p=>p.x+p.width)),width);assert.equal(Math.max(...result.panes.map(p=>p.y+p.height)),height);
  for(const p of result.panes){for(const field of ['x','y','width','height'])assert.ok(Number.isInteger(p[field])&&p[field]>=0);assert.ok(p.x+p.width<=width&&p.y+p.height<=height);for(const q of result.panes)if(p!==q)assert.ok(p.x+p.width<=q.x||q.x+q.width<=p.x||p.y+p.height<=q.y||q.y+q.height<=p.y);}
 }
 for(const values of [[NaN,10,1],[10,Infinity,1],[10,10,-1]])assert.throws(()=>L.pixelLayout(tree(),...values),/Invalid pixel/);
});

test('production renderer writes snapped bases only after dimensions, topology or split ratios change',()=>{
 const m={tree:tree(),appearance:{paneMode:'square'}},writes=[],rect={width:1001,height:701};
 const branch=path=>({dataset:{path},children:[{style:new Proxy({},{set(o,k,v){writes.push([path,'a',k,v]);o[k]=v;return true;}})},{},{style:new Proxy({},{set(o,k,v){writes.push([path,'b',k,v]);o[k]=v;return true;}})}]});
 const nodes=[branch(''),branch('b')],stage={getBoundingClientRect:()=>rect,querySelectorAll:()=>nodes};let aiSnaps=0;
 const source=fs.readFileSync(require.resolve('./mouse/browser.js'),'utf8'),start=source.indexOf(' function snapPaneLayout(){'),end=source.indexOf('\n function renderTree(){',start);assert.ok(start>=0&&end>start);
 const context=vm.createContext({m,L,MouseAppearance,$:selector=>{assert.equal(selector,'#stage');return stage;},aiPreviewUI:{snap(){aiSnaps++;}}});vm.runInContext(source.split('\n').find(line=>line.trimStart().startsWith('function visibleTree('))+'\n'+source.slice(start,end),context);
 context.snapPaneLayout();assert.deepEqual(writes,[['','a','flex','0 0 333px'],['','b','flex','0 0 667px'],['b','a','flex','0 0 259px'],['b','b','flex','0 0 441px']]);writes.length=0;
 for(let i=0;i<20;i++)context.snapPaneLayout();assert.deepEqual(writes,[],'Metadata-only requests do not repaint unchanged branch geometry');
 rect.width=1002;context.snapPaneLayout();assert.deepEqual(writes,[['','a','flex','0 0 334px']]);writes.length=0;
 m.appearance.paneMode='rounded';context.snapPaneLayout();assert.equal(nodes[0].children[0].style.flex,'0 0 332px');assert.equal(nodes[0].children[2].style.flex,'0 0 664px');assert.equal(nodes[1].children[0].style.flex,'0 0 257px');
 assert.ok(aiSnaps>=23);
});

test('fractional native menu inset rounds outwards so the outer stage starts on a whole DIP',()=>{
 const source=fs.readFileSync(require.resolve('./mouse/browser.js'),'utf8'),start=source.indexOf(" let chromeKey='';const chrome="),end=source.indexOf(';N.onChrome(chrome)',start);assert.ok(start>=0&&end>start);
 const writes=[],fullscreens=[];let layouts=0;
 const context=vm.createContext({nativeFullscreen:false,chromeControls:{fullscreen:value=>fullscreens.push(value)},document:{body:{style:{setProperty:(key,value)=>writes.push([key,value])}}},requestLayout:()=>layouts++});
 vm.runInContext(source.slice(start,end)+';globalThis.applyChrome=chrome;',context);
 const {ChromeReveal}=require('./mouse/chrome-model.cjs'),model=new ChromeReveal(),inset=model.update({fullscreen:true,menuVisible:true,menuHeight:25.5,contentTopGap:.25});assert.equal(inset,25.25);
 context.applyChrome({fullscreen:true,inset});assert.deepEqual(writes,[['--chrome-inset','26px']]);assert.equal(layouts,1);
 context.applyChrome({fullscreen:true,inset:25.75});assert.equal(layouts,1,'The same snapped safe area does not cause another layout');
 context.applyChrome({fullscreen:false,inset:-1});assert.deepEqual(writes.at(-1),['--chrome-inset','0px']);assert.deepEqual(fullscreens,[true,false]);assert.equal(layouts,2);
});
