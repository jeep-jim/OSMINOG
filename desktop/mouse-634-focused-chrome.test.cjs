'use strict';
// These reject incomplete native receipts; they do not replace the installed
// fullscreen controls, native corner pixels or display screenshots.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {focusedChromeReadback,assertFocusedGeometry,assertChromeSurfaces,focusedProbeBounds,DOCK_CLEARANCE}=require('./mouse-634-focused-chrome-smoke.cjs');
const {chromeGradientReference,assertChromeReference,sampleChromeReference,reusePreModalChromeReference}=require('./mouse-634-chrome-reference.cjs');
const {downloadNativeBounds}=require('./mouse-630-feedback-smoke.cjs');
const rect=(x,y,width,height)=>({x,y,width,height,right:x+width,bottom:y+height});
test('Mac native chrome fixture clears the measured Dock shadow without changing sample tolerances',()=>{
 const bounds={x:4,y:29,width:1016,height:676},workArea={x:0,y:25,width:1024,height:684};
 const adjusted=focusedProbeBounds(bounds,workArea,[800,600],'darwin');assert.deepEqual(adjusted,{x:4,y:29,width:1016,height:648});assert.equal(workArea.y+workArea.height-adjusted.y-adjusted.height,DOCK_CLEARANCE);assert.deepEqual(bounds,{x:4,y:29,width:1016,height:676});
});
test('a smaller Mac work area moves the fixture up only while the real minimum size still fits',()=>{
 const workArea={x:-1100,y:25,width:1024,height:640},bounds={x:-1096,y:65,width:1016,height:600},adjusted=focusedProbeBounds(bounds,workArea,[800,600],'darwin');assert.deepEqual(adjusted,{x:-1096,y:33,width:1016,height:600});assert.equal(adjusted.y+adjusted.height,workArea.y+workArea.height-DOCK_CLEARANCE);
 assert.throws(()=>focusedProbeBounds(bounds,{...workArea,height:620},[800,600],'darwin'),/cannot hold/);
});
test('Windows and Linux retain the caller window geometry and an already-clear Mac window stays unchanged',()=>{
 const bounds={x:4,y:29,width:1016,height:676},workArea={x:0,y:25,width:1024,height:684};for(const platform of ['win32','linux'])assert.deepEqual(focusedProbeBounds(bounds,workArea,[800,600],platform),bounds);
 const clear={...bounds,height:600};assert.deepEqual(focusedProbeBounds(clear,workArea,[800,600],'darwin'),clear);
});
function scene(mode){
 const focused=mode!=='grid',end=focused?780:774;
 const state={padding:{top:6,bottom:focused?0:6,left:0,right:0},header:{bounds:rect(0,0,1000,50)},footer:{bounds:rect(0,780,1000,20)},focusPane:mode==='pane'?'p1':'',focusAI:mode==='ai',aiId:'chat',aiPreviewId:'preview',panels:[],native:[]};
 function add(key,tabId,pane,bottom){const slot=rect(pane.x,pane.y+28,pane.width,pane.height-28);state.panels.push({key,tabId,pane,slot,radius:{topLeft:12,topRight:12,bottomLeft:bottom,bottomRight:bottom}});state.native.push({tabId,visible:true,attached:true,parentVisible:true,cachedVisible:true,roundBottom:bottom,bounds:downloadNativeBounds(slot,true)});}
 if(mode==='pane')add('pane:p1','main',rect(0,56,1000,end-56),0);
 else{if(mode==='grid')add('pane:p1','main',rect(0,56,600,end-56),12);const x=mode==='ai'?0:606,width=1000-x;add('ai','chat',rect(x,56,width,342),12);add('ai-preview','preview',rect(x,404,width,end-404),mode==='ai'?0:12);}
 return state;
}
test('fullscreen proof distinguishes the lower focused page from restored grid and upper AI chat',()=>{
 for(const mode of ['grid','pane','ai'])assertFocusedGeometry(scene(mode),mode);
 const onlyChat=scene('ai');onlyChat.aiPreviewId='';onlyChat.panels.splice(1);onlyChat.native.splice(1);const row=onlyChat.panels[0];row.pane=rect(0,56,1000,724);row.slot=rect(0,84,1000,696);row.radius.bottomLeft=row.radius.bottomRight=0;onlyChat.native[0].bounds=downloadNativeBounds(row.slot,true);onlyChat.native[0].roundBottom=0;assertFocusedGeometry(onlyChat,'ai');
});
test('fullscreen gate rejects the old bottom gap, rounded focused bottom, square upper chat and hidden native page',()=>{
 for(const [mode,change]of [
  ['pane',v=>{v.padding.bottom=6;}],['pane',v=>{v.panels[0].radius.bottomLeft=12;}],['pane',v=>{v.native[0].roundBottom=12;}],['pane',v=>{v.panels[0].slot.bottom-=6;}],['pane',v=>{v.native[0].bounds.height--;}],['pane',v=>{v.native[0].attached=false;}],
  ['ai',v=>{v.panels[0].radius.bottomRight=0;}],['ai',v=>{v.native[0].roundBottom=0;}],['grid',v=>{v.padding.bottom=0;}],['grid',v=>{v.panels[0].radius.bottomLeft=0;}],['grid',v=>{v.panels[0].pane.y=50;}]
 ]){const wrong=scene(mode);change(wrong);assert.throws(()=>assertFocusedGeometry(wrong,mode));}
});
test('matching chrome requires the same gradient, opaque base, blur and both exposed sample levels',()=>{
 const a={backgroundImage:'linear-gradient(rgb(240, 243, 247), rgb(230, 233, 237))',backgroundColor:'rgb(243, 245, 249)',backdropFilter:'blur(12px)',opacity:'1',points:[{fraction:.1},{fraction:.9}]},state={header:a,footer:structuredClone(a)};assertChromeSurfaces(state);
 for(const change of [v=>{v.footer.backgroundImage='none';},v=>{v.footer.backgroundColor='rgb(255, 255, 255)';},v=>{v.footer.backdropFilter='none';},v=>{v.footer.opacity='.9';},v=>{v.footer.points.pop();}]){const wrong=structuredClone(state);change(wrong);assert.throws(()=>assertChromeSurfaces(wrong));}
});
function referenceFixture(){
 const style={backgroundImage:'linear-gradient(rgb(240, 243, 247), rgb(230, 233, 237))',backgroundColor:'rgb(243, 245, 249)',backdropFilter:'blur(12px)',opacity:'1'},header={tagName:'HEADER',id:'toolbar',getBoundingClientRect:()=>rect(0,0,400,50)},footer={tagName:'FOOTER',id:'statusbar',getBoundingClientRect:()=>rect(0,780,400,20)},button={tagName:'BUTTON',id:'foreground',parentElement:header,childNodes:[]},transparent={tagName:'DIV',id:'empty-wrap',parentElement:header,childNodes:[]};
 const doc={querySelector:s=>s==='.toolbar'?header:footer,elementFromPoint:x=>x<106?button:transparent};
 const getComputedStyle=(node,pseudo)=>pseudo?{content:'none'}:node===header||node===footer?style:{backgroundImage:'none',backgroundColor:'rgba(0, 0, 0, 0)'};
 const value=vm.runInNewContext('('+chromeGradientReference.toString()+')([.5,1.5,2.5])',{document:doc,getComputedStyle});return JSON.parse(JSON.stringify(value));
}
test('retained footer references skip real foreground controls and preserve every original depth',()=>{
 const reference=referenceFixture();assertChromeReference(reference,[.5,1.5,2.5]);assert.deepEqual(reference.references.map(row=>row.point.x),[106,106,106]);assert.deepEqual(reference.references.map(row=>row.hit),['empty-wrap','empty-wrap','empty-wrap']);assert.deepEqual(reference.references.map(row=>row.point.y),[1.25,3.75,6.25]);
 const wrong=structuredClone(reference);wrong.references.pop();assert.throws(()=>assertChromeReference(wrong,[.5,1.5,2.5]));
 const mismatch=structuredClone(reference);mismatch.footer.backgroundImage='none';assert.throws(()=>assertChromeReference(mismatch,[.5,1.5,2.5]));
});
test('retained footer reference RGB is decoded from the same PNG representation at recorded coordinates',()=>{
 const reference=referenceFixture(),size={width:800,height:1600},pixels=Buffer.alloc(size.width*size.height*4),image={getSize:()=>size,toBitmap:()=>pixels},viewport={width:400,height:800};
 for(const [index,row]of reference.references.entries()){const x=Math.floor(row.point.x*2),y=Math.floor(row.point.y*2);pixels.set([247-index,243-index,240-index,255],(y*size.width+x)*4);}
 const sampled=sampleChromeReference(image,viewport,reference);assert.deepEqual(sampled.references.map(row=>row.rgba),[[240,243,247,255],[239,242,246,255],[238,241,245,255]]);assert.deepEqual(sampled.references.map(row=>[row.pixelX,row.pixelY]),[[212,2],[212,7],[212,12]]);
 pixels[(2*size.width+212)*4+3]=0;assert.throws(()=>sampleChromeReference(image,viewport,reference));
});
function preModalFixture(){
 const before=referenceFixture();before.references=before.references.map((row,index)=>({...row,pixelX:Math.floor(row.point.x*2),pixelY:Math.floor(row.point.y*2),rgba:[240-index,243-index,247-index,255]}));
 return{before,current:{...referenceFixture(),references:[]},modal:{open:true,hidden:false,phase:'open'}};
}
test('retained Nora footer uses its archived pre-modal pixels when the modal makes the toolbar inert',()=>{
 const {before,current,modal}=preModalFixture(),result=reusePreModalChromeReference(before,current,modal,[.5,1.5,2.5]);
 assert.deepEqual(result,before);assert.notEqual(result,before);assert.notEqual(result.references[0],before.references[0]);
 assert.deepEqual(result.references[0].rgba,[240,243,247,255]);assert.deepEqual(current.references,[]);
});
test('pre-modal footer pixels cannot be borrowed across changed geometry, theme, paint or modal state',()=>{
 for(const change of [v=>{v.current.header.bounds.width--;},v=>{v.current.footer.bounds.y--;},v=>{v.current.header.background='rgb(10, 20, 30)';},v=>{v.current.footer.backgroundImage='none';},v=>{v.current.header.backdropFilter='none';},v=>{v.current.footer.opacity='.9';},v=>{v.modal.open=false;},v=>{v.modal.hidden=true;},v=>{v.modal.phase='opening';}]){
  const value=preModalFixture();change(value);assert.throws(()=>reusePreModalChromeReference(value.before,value.current,value.modal,[.5,1.5,2.5]));
 }
});
test('pre-modal footer references require all original depths and decoded opaque PNG coordinates',()=>{
 for(const change of [v=>{v.before.references.pop();},v=>{delete v.before.references[0].rgba;},v=>{v.before.references[0].rgba[3]=254;},v=>{v.before.references[0].rgba[0]=NaN;},v=>{v.before.references[0].pixelX=-1;},v=>{v.before.references[0].pixelY=.5;}]){
  const value=preModalFixture();change(value);assert.throws(()=>reusePreModalChromeReference(value.before,value.current,value.modal,[.5,1.5,2.5]));
 }
});

// Synthetic DOM reproduces the archived Linux/Windows HEADER hit underneath
// the actual pointer-events:none active-tab silhouette; pixels remain a native gate.
test('focused chrome excludes painted tab-flow SVG even when native hit testing returns the header',()=>{
 const rectOf=(id,tagName,bounds)=>({id,tagName,getBoundingClientRect:()=>bounds,querySelectorAll:()=>[]}),header=rectOf('toolbar','HEADER',rect(0,0,1200,40)),footer=rectOf('statusbar','FOOTER',rect(0,792,1200,28)),flow=rectOf('','svg',rect(30,4,250,36)),workspace=rectOf('workspace','MAIN',rect(0,40,1200,752)),scrim=rectOf('mouse-dock-scrim','DIV',rect(0,0,0,0)),tray={open:false,dataset:{motion:'closed'}};scrim.hidden=true;header.querySelectorAll=()=>[flow];
 const nodes={'.toolbar':header,'#statusbar':footer,'#workspace':workspace,'#mouse-dock-scrim':scrim,'#desktop-tray':tray},document={querySelector:s=>nodes[s]||null,elementFromPoint:(x,y)=>y<40?header:footer},getComputedStyle=node=>node===flow?{display:'block',visibility:'visible',opacity:'1'}:node===workspace?{paddingTop:'6px',paddingBottom:'6px',paddingLeft:'0px',paddingRight:'0px'}:node===scrim?{opacity:'0',backgroundColor:'rgb(0, 0, 0)'}:{backgroundImage:'linear-gradient(white, silver)',backgroundColor:'rgb(243, 245, 249)',backdropFilter:'blur(12px)',opacity:'1'},MouseTest={model:{theme:'light',slots:{}},progressUI:{panels:()=>[]}};
 const context={document,getComputedStyle,MouseTest},result=JSON.parse(JSON.stringify(vm.runInNewContext('('+focusedChromeReadback.toString()+')()',context)));
 assert.deepEqual(result.header.occluders,[{selector:'.mouse-tab-flow',bounds:rect(30,4,250,36)}]);assert.deepEqual(result.header.points.map(p=>p.point),[{x:284,y:4},{x:284,y:36}]);assert.deepEqual(result.header.points.map(p=>p.hit),['toolbar','toolbar']);assert.deepEqual(result.footer.points.map(p=>p.point.x),[100,100]);
 tray.open=true;tray.id='desktop-tray';document.elementFromPoint=()=>tray;
 const before={name:'ai-restored-light',header:result.header,footer:result.footer},opened=JSON.parse(JSON.stringify(vm.runInNewContext('('+focusedChromeReadback.toString()+')(reference)',{...context,reference:before})));
 assert.equal(opened.header.pointSource,'pre-modal-layout');assert.equal(opened.header.referenceStage,'ai-restored-light');assert.deepEqual(opened.header.points,result.header.points.map(p=>({...p,actualModalHit:'desktop-tray'})));assert.deepEqual(opened.footer.points,result.footer.points.map(p=>({...p,actualModalHit:'desktop-tray'})));
 assert.throws(()=>vm.runInNewContext('('+focusedChromeReadback.toString()+')()',context),/measured pre-modal points/);const stale=structuredClone(before);stale.header.bounds.width--;assert.throws(()=>vm.runInNewContext('('+focusedChromeReadback.toString()+')(reference)',{...context,reference:stale}),/changed the measured underlying chrome/);
});
