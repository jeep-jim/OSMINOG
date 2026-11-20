'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateGeometry,geometryPoints,validateNative,validateLinuxMasks}=require('./mouse-633-workspace-geometry.cjs');
// Synthetic measured rectangles only: native OS painting is verified by the
// shared installed smoke and its independently decoded archived frames.
function fixture(ai=false,totalWidth=1000){
 const width=ai?totalWidth-366:totalWidth,geometry={viewport:{width:totalWidth,height:800},workspace:{x:0,y:40,width:totalWidth,height:732},toolbar:{x:0,y:0,width:totalWidth,height:40},footer:{x:0,y:772,width:totalWidth,height:28},stage:{x:0,y:46,width,height:720},padding:{top:6,right:0,bottom:6,left:0},panes:[],dividers:[{axis:'y',bounds:{x:0,y:403,width,height:6}}],ai:ai?{id:'ai',bounds:{x:totalWidth-360,y:46,width:360,height:720},slot:{x:totalWidth-360,y:74,width:360,height:692},radii:[12,12,12,12],divider:{x:totalWidth-366,y:46,width:6,height:720}}:null};
 for(const [row,count]of [[0,4],[1,3]]){const paneWidth=(width-6*(count-1))/count,y=row?409:46;for(let i=0;i<count;i++){const x=(paneWidth+6)*i,id='page-'+geometry.panes.length;geometry.panes.push({id,bounds:{x,y,width:paneWidth,height:357},slot:{x,y:y+28,width:paneWidth,height:329},radii:[12,12,12,12],roundTop:12,roundBottom:12});if(i<count-1)geometry.dividers.push({axis:'x',bounds:{x:x+paneWidth,y,width:6,height:357}});}}
 return geometry;
}
function native(geometry){return[...geometry.panes,...(geometry.ai?[geometry.ai]:[])].map((pane,index)=>{const r=pane.slot,bounds={x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.x+r.width)-Math.round(r.x),height:Math.round(r.y+r.height)-Math.round(r.y)};return{id:pane.id,webContentsId:index+1,bounds,actualBounds:{...bounds},visible:true,viewVisible:true,parentVisible:true,attached:true};});}
test('current workspace verifies equal vertical/divider gaps, flush sides and every corner with and without AI',()=>{
 for(const ai of [false,true]){const geometry=fixture(ai);assert.equal(validateGeometry(geometry,{ai}),true);assert.equal(validateNative(geometry,native(geometry)),true);const points=geometryPoints(geometry,[199,207,223],[255,255,255]);assert.equal(points.filter(p=>p.kind==='workspace-gap').length,6);for(const pane of [...geometry.panes,...(ai?[geometry.ai]:[])]){assert.equal(points.filter(p=>p.id===pane.id&&p.kind==='pane-top-interior').length,2);assert.ok(points.filter(p=>p.id===pane.id&&p.kind==='pane-top-cutout').length>=12);}}
});
test('old zero external radii, missing gaps, horizontal padding and incorrect sidebars fail the actual geometry predicate',()=>{
 const changes=[g=>{g.padding.top=0;},g=>{g.padding.bottom=5;},g=>{g.padding.left=6;},g=>{g.stage.x=6;},g=>{g.stage.width-=6;},g=>{g.dividers[0].bounds.height=5;},g=>{g.panes[0].radii[0]=0;},g=>{g.panes.at(-1).roundBottom=0;},g=>{g.panes[0].slot.width-=1;}];
 for(const change of changes){const geometry=fixture();change(geometry);assert.throws(()=>validateGeometry(geometry));}
 for(const change of [g=>{g.ai.radii[2]=0;},g=>{g.ai.bounds.y+=1;},g=>{g.ai.bounds.width-=6;},g=>{g.ai.divider.width=1;}]){const geometry=fixture(true);change(geometry);assert.throws(()=>validateGeometry(geometry,{ai:true}));}
});
test('top interior samples avoid a fractionally covered header edge and remain above controls',()=>{
 const geometry=fixture();geometry.panes[0].bounds.y=272.4;
 const points=geometryPoints(geometry,[199,207,223],[255,255,255]).filter(point=>point.id==='page-0'&&point.kind==='pane-top-interior');
 assert.equal(points.length,2);for(const point of points){assert.equal(point.point.y,273.5);assert.ok(Math.floor(point.point.y)>=geometry.panes[0].bounds.y);assert.ok(point.point.y<geometry.panes[0].bounds.y+2);}
});
test('top interior pixels stay in the straight header span at one and two device pixels per CSS pixel',()=>{
 for(const fraction of [0,1/64,.046875,.375,.609375,.96875]){
  const geometry=fixture(),bounds={x:767+fraction,y:46+fraction,width:274.4375,height:565.078125};geometry.panes[0].bounds=bounds;
  const points=geometryPoints(geometry,[199,207,223],[255,255,255]).filter(point=>point.id==='page-0'&&point.kind==='pane-top-interior');
  for(const point of points)for(const scale of [1,2]){const x=Math.floor(point.point.x*scale)/scale,y=Math.floor(point.point.y*scale)/scale;assert.ok(x>=bounds.x+12);assert.ok(x+1/scale<=bounds.x+bounds.width-12);assert.ok(y>=bounds.y);assert.ok(point.point.y<bounds.y+2);}
 }
 const measured=fixture();measured.panes[0].bounds={x:767.609375,y:46,width:274.4375,height:565.078125};
 const right=geometryPoints(measured,[199,207,223],[255,255,255]).find(point=>point.id==='page-0'&&point.kind==='pane-top-interior'&&point.side==='right');assert.deepEqual(right.point,{x:1029.5,y:46.5});
});
test('outer CSS quantization must still reach the identical native endpoint',()=>{
 const insetRight=(geometry,amount)=>{for(const pane of geometry.panes)if(Math.abs(pane.bounds.x+pane.bounds.width-geometry.stage.width)<1e-6)for(const key of ['bounds','slot'])pane[key].width-=amount;};
 const actual=fixture(false,1443);insetRight(actual,1/32);
 for(const key of ['bounds','slot'])Object.assign(actual.panes.at(-1)[key],{x:1048.046875,width:394.921875});
 assert.equal(validateGeometry(actual),true);const views=native(actual);assert.equal(views.at(-1).bounds.x+views.at(-1).bounds.width,1443);assert.equal(validateNative(actual,views),true);
 const wholePixel=fixture(false,1443);insetRight(wholePixel,1);assert.throws(()=>validateGeometry(wholePixel),/outer pane right/);
 const crossesNativeEndpoint=fixture(false,1443.5);insetRight(crossesNativeEndpoint,1/32);assert.throws(()=>validateGeometry(crossesNativeEndpoint),/outer pane right/);
});
test('actual view endpoints and native visibility cannot be substituted by valid DOM geometry',()=>{
 for(const change of [n=>{n[0].actualBounds.height-=1;},n=>{n[0].bounds.x+=1;},n=>{n[0].visible=false;},n=>{n[0].attached=false;},n=>{n[0].id='unrelated';}]){const geometry=fixture(),rows=native(geometry);change(rows);assert.throws(()=>validateNative(geometry,rows));}
});
test('X11 proof requires mapped owned masks with the actual empty input shape query',()=>{
 const state={backend:'X11 Shape',supported:true,ownedParent:true,reason:'ready',error:0,queryError:0,paneCount:7,cornerCount:14,corners:Array.from({length:14},(_,i)=>({window:i+1,exists:true,mapped:true,overrideRedirect:true,inputRectangles:0}))};
 assert.equal(validateLinuxMasks(state,7),true);
 for(const change of [s=>{s.supported=false;},s=>{s.ownedParent=false;},s=>{s.queryError=3;},s=>{s.cornerCount=12;},s=>{s.corners[0].inputRectangles=1;},s=>{s.corners[0].mapped=false;}]){const altered=structuredClone(state);change(altered);assert.throws(()=>validateLinuxMasks(altered,7));}
});
