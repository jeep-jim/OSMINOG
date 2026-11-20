'use strict';
// Current633 geometry supplement. Its points are archived separately from the
// historical629 bottom-corner probes and use the same real OS captures.
const assert=require('node:assert/strict');
const GAP=6,RADIUS=12,AI_COLOR=[211,92,53];
function workspaceReadback(){
 const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const radii=element=>{const s=getComputedStyle(element);return['TopLeft','TopRight','BottomRight','BottomLeft'].map(corner=>parseFloat(s['border'+corner+'Radius']));};
 const visible=element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&!element.hidden;};
 const workspace=document.querySelector('#workspace'),style=getComputedStyle(workspace),ai=document.querySelector('#ai-panel');
 return{viewport:{width:innerWidth,height:innerHeight},workspace:rect(workspace),toolbar:rect(document.querySelector('.toolbar')),footer:rect(document.querySelector('#statusbar')),stage:rect(document.querySelector('#stage')),padding:Object.fromEntries(['Top','Right','Bottom','Left'].map(side=>[side.toLowerCase(),parseFloat(style['padding'+side])])),panes:[...document.querySelectorAll('#stage .pane')].map(element=>({id:MouseTest.model.slots[element.dataset.pane],bounds:rect(element),slot:rect(element.querySelector('.page-slot')),radii:radii(element),roundTop:parseFloat(element.style.getPropertyValue('--pane-round-top')),roundBottom:parseFloat(element.style.getPropertyValue('--pane-round-bottom'))})),dividers:[...document.querySelectorAll('#stage .divider')].filter(visible).map(element=>({axis:element.dataset.axis,bounds:rect(element)})),ai:visible(ai)?{id:MouseTest.model.aiId,bounds:rect(ai),slot:rect(document.querySelector('#ai-slot')),radii:radii(ai),divider:rect(document.querySelector('.ai-divider'))}:null};
}
const right=r=>r.x+r.width,bottom=r=>r.y+r.height;
function near(actual,expected,label){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-6,label+': '+actual+' != '+expected);}
function outerNear(actual,expected,label){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1/16&&Math.round(actual)===Math.round(expected),label+': '+actual+' != '+expected);}
function validateGeometry(geometry,{ai=false}={}){
 const {workspace:w,stage,viewport,padding,panes,dividers}=geometry;
 assert.deepEqual(padding,{top:GAP,right:0,bottom:GAP,left:0},'Only vertical workspace padding matches the pane gap');
 near(w.x,0,'workspace left');near(right(w),viewport.width,'workspace right');near(w.y,bottom(geometry.toolbar),'workspace follows toolbar');near(bottom(w),geometry.footer.y,'workspace ends at footer');
 near(stage.x,0,'stage left');near(stage.y,w.y+GAP,'stage top gap');near(bottom(stage),bottom(w)-GAP,'stage bottom gap');
 assert.equal(panes.length,7);assert.equal(new Set(panes.map(p=>p.id)).size,7);assert.ok(dividers.length>=6&&dividers.some(d=>d.axis==='x')&&dividers.some(d=>d.axis==='y'));
 for(const divider of dividers){assert.ok(['x','y'].includes(divider.axis));near(divider.bounds[divider.axis==='x'?'width':'height'],GAP,'pane divider thickness');}
 for(const pane of panes){assert.deepEqual(pane.radii,[RADIUS,RADIUS,RADIUS,RADIUS]);near(pane.roundTop,RADIUS,'pane top radius');near(pane.roundBottom,RADIUS,'pane bottom radius');assert.ok(pane.bounds.width>24&&pane.bounds.height>40);assert.ok(pane.bounds.x>=stage.x&&right(pane.bounds)<=right(stage)+1e-6&&pane.bounds.y>=stage.y&&bottom(pane.bounds)<=bottom(stage)+1e-6);near(pane.slot.x,pane.bounds.x,'native slot left');near(right(pane.slot),right(pane.bounds),'native slot right');near(bottom(pane.slot),bottom(pane.bounds),'native slot bottom');assert.ok(pane.slot.y>pane.bounds.y);}
 // Nested CSS layout quantizes fractional lengths; the four aggregate edges
 // may differ by a subpixel but must still reach the exact native endpoint.
 outerNear(Math.min(...panes.map(p=>p.bounds.x)),stage.x,'outer pane left');outerNear(Math.max(...panes.map(p=>right(p.bounds))),right(stage),'outer pane right');outerNear(Math.min(...panes.map(p=>p.bounds.y)),stage.y,'outer pane top');outerNear(Math.max(...panes.map(p=>bottom(p.bounds))),bottom(stage),'outer pane bottom');
 assert.equal(!!geometry.ai,ai,'requested AI scene');
 if(ai){const panel=geometry.ai;assert.deepEqual(panel.radii,[RADIUS,RADIUS,RADIUS,RADIUS]);near(panel.bounds.y,w.y+GAP,'AI top gap');near(bottom(panel.bounds),bottom(w)-GAP,'AI bottom gap');near(right(panel.bounds),viewport.width,'AI right is flush');near(panel.bounds.x-right(stage),GAP,'AI divider gap');near(panel.divider.width,GAP,'AI divider thickness');near(panel.divider.x,right(stage),'AI divider position');near(panel.slot.x,panel.bounds.x,'AI native left');near(right(panel.slot),right(panel.bounds),'AI native right');near(bottom(panel.slot),bottom(panel.bounds),'AI native bottom');}
 else near(right(stage),viewport.width,'outer right is flush without a sidebar');
 return true;
}
function geometryPoints(geometry,line,panel){
 const points=[],w=geometry.workspace;
 for(const edge of ['top','bottom'])for(const fraction of [.2,.5,.8])points.push({kind:'workspace-gap',edge,point:{x:w.x+w.width*fraction,y:edge==='top'?w.y+GAP/2:bottom(w)-GAP/2},expected:line});
 for(const pane of [...geometry.panes,...(geometry.ai?[geometry.ai]:[])])for(const side of ['left','right']){
  const r=pane.bounds;
  for(const u of [.65,1.6,3])for(const v of [.65,1.6,3])if(Math.hypot(RADIUS-u,RADIUS-v)>13.5)points.push({kind:'pane-top-cutout',id:pane.id,side,paneBounds:r,point:{x:side==='left'?r.x+u:right(r)-u,y:r.y+v},expected:line});
  // Use a full pixel in the straight header span, above its buttons. The
  // circle's tangent and a fractional top edge can contain antialiased pixels.
  points.push({kind:'pane-top-interior',id:pane.id,side,paneBounds:r,point:{x:side==='left'?Math.ceil(r.x+RADIUS)+.5:Math.floor(right(r)-RADIUS)-.5,y:Math.ceil(r.y)+.5},expected:panel});
 }
 return points;
}
function nativePanel(page,win){
 const view=page.view.getBounds(),clip=page.clipView?.getBounds()||null,parent=page.clipView||page.view;
 return{id:page.id,webContentsId:page.view.webContents.id,bounds:{...page.bounds},actualBounds:{x:view.x+(clip?.x||0),y:view.y+(clip?.y||0),width:view.width,height:view.height},visible:page.visible===true,viewVisible:page.view.getVisible(),parentVisible:parent.getVisible(),attached:win.contentView.children.includes(parent)};
}
function validateNative(geometry,native){
 const expected=[...geometry.panes,...(geometry.ai?[geometry.ai]:[])];assert.equal(native.length,expected.length);
 for(const pane of expected){const page=native.find(row=>row.id===pane.id);assert.ok(page&&page.visible&&page.viewVisible&&page.parentVisible&&page.attached);const slot=pane.slot,rounded={x:Math.round(slot.x),y:Math.round(slot.y),width:Math.round(right(slot))-Math.round(slot.x),height:Math.round(bottom(slot))-Math.round(slot.y)};assert.deepEqual(page.bounds,rounded);assert.deepEqual(page.actualBounds,rounded);}
 return true;
}
function validateLinuxMasks(state,count){
 assert.equal(state?.backend,'X11 Shape');assert.equal(state.supported,true);assert.equal(state.ownedParent,true);assert.ok(['ready','cached'].includes(state.reason));assert.equal(state.error,0);assert.equal(state.queryError,0);assert.equal(state.paneCount,count);assert.equal(state.cornerCount,count*2);assert.equal(state.corners.length,count*2);assert.equal(new Set(state.corners.map(corner=>corner.window)).size,count*2);
 assert.ok(state.corners.every(corner=>corner.exists===true&&corner.mapped===true&&corner.overrideRedirect===true&&corner.inputRectangles===0),'Every actual X11 corner has an empty input shape');return true;
}
module.exports={GAP,RADIUS,AI_COLOR,workspaceReadback,validateGeometry,geometryPoints,nativePanel,validateNative,validateLinuxMasks};
