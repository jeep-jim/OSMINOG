'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createPointerTools}=require('./mouse-615-smoke.cjs');

function fixture({coveredAfterHover=false,removedAfterHover=false}={}){
 let left=1410,hovered=false,closed=false,queries=0;
 const events=[],waits=[],hits=[],rects=[],cover={tagName:'HEADER',className:''};
 const bounds=()=>({x:left,y:67.390625,left,top:67.390625,width:30,height:30,right:left+30,bottom:97.390625});
 const element={tagName:'BUTTON',className:'',parentElement:null,disabled:false,
  scrollIntoView(){},getBoundingClientRect(){const r=bounds();rects.push({...r});return r;},
  getClientRects:()=>[bounds()],matches:()=>false,contains:target=>target===element};
 const document={
  defaultView:{innerWidth:1440,innerHeight:900,getComputedStyle:()=>({pointerEvents:'auto',visibility:'visible',display:'grid',opacity:'1',overflowX:'visible',overflowY:'visible'})},
  querySelector(selector){if(selector==='#library-close'){queries++;return hovered&&removedAfterHover?null:element;}return null;},
  elementFromPoint(x,y){const r=bounds(),hit=!(hovered&&coveredAfterHover)&&x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;hits.push({x,y,left,hit});return hit?element:cover;}
 };
 element.ownerDocument=document;const context=vm.createContext({document});
 const tools=createPointerTools({
  js:async source=>vm.runInContext(source,context),
  wait:async ms=>{waits.push(ms);left=1394;hovered=true;},
  sendInputEvent:event=>{events.push(event);if(event.type==='mouseUp'&&document.elementFromPoint(event.x,event.y)===element)closed=true;}
 });
 return{tools,events,waits,hits,rects,closed:()=>closed,queries:()=>queries};
}

test('retained native close remeasures the moving button after its existing hover wait',async()=>{
 // Recorded 641 geometry: the 160 ms entrance moves the 30 px button from 1410
 // to 1394. Its old centre 1425 is one pixel beyond the final right edge 1424.
 const f=fixture();await f.tools.click('#library-close');
 assert.deepEqual(f.waits,[180],'No new wait or enlarged delay is introduced');
 assert.equal(f.queries(),2,'The actual DOM target is measured again after hover');
 assert.deepEqual(f.events.map(({type,x,y})=>({type,x,y})),[
  {type:'mouseMove',x:1425,y:82},{type:'mouseMove',x:1409,y:82},
  {type:'mouseDown',x:1409,y:82},{type:'mouseUp',x:1409,y:82}
 ]);
 assert.ok(f.hits.some(hit=>hit.left===1410&&hit.x===1425&&hit.hit));
 assert.ok(f.hits.some(hit=>hit.left===1394&&hit.x===1409&&hit.hit));
 assert.equal(f.closed(),true,'The real input sequence reaches the button at its current position');
 for(const event of f.events.filter(event=>event.type!=='mouseMove')){assert.equal(event.button,'left');assert.equal(event.clickCount,1);}
});

test('retained native click refuses a target covered after hover and sends no DOWN or UP',async()=>{
 const f=fixture({coveredAfterHover:true});
 await assert.rejects(f.tools.click('#library-close'),/Mouse615 pointer target unavailable: #library-close.*covered or clipped/);
 assert.deepEqual(f.waits,[180]);assert.equal(f.queries(),2);assert.deepEqual(f.events.map(event=>event.type),['mouseMove']);assert.equal(f.closed(),false);
});

test('retained native click refuses a target removed during hover',async()=>{
 const f=fixture({removedAfterHover:true});
 await assert.rejects(f.tools.click('#library-close'),/Mouse615 pointer target unavailable: #library-close.*missing/);
 assert.deepEqual(f.waits,[180]);assert.deepEqual(f.events.map(event=>event.type),['mouseMove']);assert.equal(f.closed(),false);
});
