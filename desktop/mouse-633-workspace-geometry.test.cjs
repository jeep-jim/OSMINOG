'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateGeometry,geometryPoints,validateNative,validateLinuxMasks}=require('./mouse-633-workspace-geometry.cjs');
// Synthetic measured rectangles only: native OS painting is verified by the
// shared installed smoke and its independently decoded archived frames.
function fixture(ai=false){
 const width=ai?634:1000,geometry={viewport:{width:1000,height:800},workspace:{x:0,y:40,width:1000,height:732},toolbar:{x:0,y:0,width:1000,height:40},footer:{x:0,y:772,width:1000,height:28},stage:{x:0,y:46,width,height:720},padding:{top:6,right:0,bottom:6,left:0},panes:[],dividers:[{axis:'y',bounds:{x:0,y:403,width,height:6}}],ai:ai?{id:'ai',bounds:{x:640,y:46,width:360,height:720},slot:{x:640,y:74,width:360,height:692},radii:[12,12,12,12],divider:{x:634,y:46,width:6,height:720}}:null};
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
test('actual view endpoints and native visibility cannot be substituted by valid DOM geometry',()=>{
 for(const change of [n=>{n[0].actualBounds.height-=1;},n=>{n[0].bounds.x+=1;},n=>{n[0].visible=false;},n=>{n[0].attached=false;},n=>{n[0].id='unrelated';}]){const geometry=fixture(),rows=native(geometry);change(rows);assert.throws(()=>validateNative(geometry,rows));}
});
test('X11 proof requires mapped owned masks with the actual empty input shape query',()=>{
 const state={backend:'X11 Shape',supported:true,ownedParent:true,reason:'ready',error:0,queryError:0,paneCount:7,cornerCount:14,corners:Array.from({length:14},(_,i)=>({window:i+1,exists:true,mapped:true,overrideRedirect:true,inputRectangles:0}))};
 assert.equal(validateLinuxMasks(state,7),true);
 for(const change of [s=>{s.supported=false;},s=>{s.ownedParent=false;},s=>{s.queryError=3;},s=>{s.cornerCount=12;},s=>{s.corners[0].inputRectangles=1;},s=>{s.corners[0].mapped=false;}]){const altered=structuredClone(state);change(altered);assert.throws(()=>validateLinuxMasks(altered,7));}
});
