'use strict';
// Measures the installed, painted burrow in the existing 622 native fixture.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {chromeGradientReference,assertChromeReference,sampleChromeReference,reusePreModalChromeReference}=require('./mouse-634-chrome-reference.cjs');
module.exports=({win,js})=>{
 const frames=[],footerReferences=[],offsets=[.25,1.25,2.25];let result,baseline;
 async function prepareReference(theme){
  const before=await js(`(()=>{const tray=document.querySelector('#desktop-tray');return{theme:document.documentElement.dataset.theme,viewport:{width:innerWidth,height:innerHeight},modal:{open:tray.open,hidden:tray.hidden,phase:tray.dataset.motion},reference:(${chromeGradientReference.toString()})(${JSON.stringify(offsets)})};})()`);
  assert.equal(before.theme,theme);assert.deepEqual(before.modal,{open:false,hidden:true,phase:'closed'},'The actual 623 footer reference is captured before opening Nora');
  assert.ok(!footerReferences.some(row=>row.theme===theme),'Each theme has one actual pre-modal reference');assertChromeReference(before.reference,offsets);
  const image=await win.capturePage(),png=image.toPNG(),capture='mouse-623-footer-reference-'+theme+'.png',reference=sampleChromeReference(image,before.viewport,before.reference);
  await fs.writeFile(capture,png);baseline={theme,viewport:before.viewport,capture,bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),source:'BrowserWindow.capturePage before modal Nora',reference};footerReferences.push(baseline);
  await fs.writeFile('mouse-623-footer-references.json',JSON.stringify({footerReferences},null,2)+'\n');
  return structuredClone(baseline);
 }
 async function capture(theme,state){
  await js(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{const tray=document.querySelector('#desktop-tray');if(tray.open&&!tray.hidden&&tray.dataset.motion==='open')return resolve();if(performance.now()-start>5000)return reject(Error('Burrow did not settle for geometry capture'));requestAnimationFrame(poll);};poll();})`);
  const control=state==='preview'?'.desk-preview-close':state==='modes'?'#desk-modes .desk-mode:last-child':'.desktop-card[aria-current="true"] .desk-preview-button';
  const measured=await js(`(()=>{
   const tray=document.querySelector('#desktop-tray'),path=document.querySelector('#mouse-dock-outline'),bar=document.querySelector('#statusbar'),fill=document.querySelector('#mouse-dock-fill'),content=tray.querySelector('.desk-content'),control=document.querySelector(${JSON.stringify(control)});
   const r=tray.getBoundingClientRect(),footer=bar.getBoundingClientRect(),line=getComputedStyle(path),border=getComputedStyle(bar),matrix=path.getScreenCTM(),length=path.getTotalLength();
   // This settled profile is measured once per captured state, never in the
   // animation recorder. The retained path describes the borderless silhouette.
   const count=Math.ceil(length*Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))*3),points=[];
   for(let i=0;i<=count;i++){const p=path.getPointAtLength(length*i/count).matrixTransform(matrix);points.push({x:p.x-r.left,y:p.y-r.top});}
   const top=Math.min(...points.map(p=>p.y)),depths=[2,6,12,20,32,48,64];
   const profile=right=>depths.map(depth=>{let best,delta=Infinity;for(const p of points){if(right?p.x<r.width*.7:p.x>r.width*.3)continue;const d=Math.abs(p.y-top-depth);if(d<delta){best=p;delta=d;}}if(!best||delta>.75)throw Error('Missing rendered curve sample');return right?r.width-best.x:best.x;});
   const start=path.getPointAtLength(0).matrixTransform(matrix),end=path.getPointAtLength(length).matrixTransform(matrix),probe=document.createElement('i');probe.style.color='var(--panel)';document.body.append(probe);const panel=getComputedStyle(probe).color;probe.remove();
   const contentRect=content.getBoundingClientRect(),target=control.getBoundingClientRect(),hit=(${nativeHitTarget.toString()})(control),sample=MouseTest.desktopUI.motion.sample();
   return{theme:document.documentElement.dataset.theme,modal:{open:tray.open,hidden:tray.hidden,phase:tray.dataset.motion},width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,footerTop:footer.top,footerHeight:footer.height,viewport:{width:innerWidth,height:innerHeight},topCurve:{depths,left:profile(false),right:profile(true)},stroke:line.stroke,footerBackground:border.backgroundColor,footerBorderWidth:parseFloat(border.borderTopWidth),footerImage:border.borderImageSource,footerShadow:border.boxShadow,paths:sample.paths,geometryWrites:sample.geometryWrites,endpoints:{left:start.y,right:end.y},surface:{fill:getComputedStyle(fill).fill,panel,opacity:getComputedStyle(fill).opacity,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}},content:{overflow:getComputedStyle(content).overflowY,scrollTop:content.scrollTop,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,height:contentRect.height,naturalHeight:sample.contentHeight,availableHeight:sample.availableHeight,fits:sample.fits,visibleHeight:Math.max(0,Math.min(target.bottom,contentRect.bottom,r.bottom)-Math.max(target.top,contentRect.top,r.top)),targetHeight:target.height,accessible:hit.ready}};
  })()`);
  // Keep the retained borderless silhouette and all seam probes. The 634 owner
  // request gives the footer the same gradient as the upper toolbar.
  // showModal makes the toolbar inert and the Nora scrim dims its pixels.
  // Reuse the real pre-modal PNG only while its geometry and CSS stay identical.
  const reference=await js(`(${chromeGradientReference.toString()})(${JSON.stringify(offsets)})`);assert.ok(baseline&&baseline.theme===theme,'A matching 623 pre-modal theme reference is required');assert.equal(measured.theme,theme);assert.deepEqual(measured.viewport,baseline.viewport,'Nora retains the pre-modal viewport');
  const chromeReference=reusePreModalChromeReference(baseline.reference,reference,measured.modal,offsets);
  assert.equal(measured.stroke,'none',theme+' '+state+' silhouette has no decorative stroke');assert.equal(measured.footerBorderWidth,0,'The footer has no top stroke');assert.equal(measured.footerImage,'none');assert.equal(measured.footerShadow,'none');assert.equal(measured.footerBackground,reference.header.background);
  assert.ok(Math.abs(measured.bottom-measured.footerTop)<=1,'The content-fit panel ends at the footer');
  for(const side of ['left','right'])assert.ok(Math.abs(measured.endpoints[side]-measured.footerTop)<=1,theme+' '+state+' '+side+' silhouette meets the footer');
  assert.ok(Math.abs(measured.surface.start.x-measured.left)<.05&&Math.abs(measured.surface.end.x-measured.right)<.05,'The borderless shape occupies the panel width');
  assert.equal(measured.surface.fill,measured.surface.panel);assert.equal(Number(measured.surface.opacity),1);assert.equal(measured.content.overflow,'visible');assert.equal(measured.content.scrollTop,0);assert.ok(measured.content.scrollHeight<=measured.content.clientHeight+1,'Nora has no internal vertical scroll range');assert.equal(measured.content.fits,true,'Every content state fits above the footer');assert.ok(Math.abs(measured.height-measured.content.naturalHeight)<=1&&Math.abs(measured.height-measured.content.height)<=1,'The panel height follows its natural content');assert.equal(measured.content.accessible,true,theme+' '+state+' control is reachable without scrolling');assert.ok(measured.content.targetHeight>0&&measured.content.visibleHeight>=measured.content.targetHeight-1,'The complete control is visible');
  for(let i=0;i<measured.topCurve.depths.length;i++)assert.ok(Math.abs(measured.topCurve.left[i]-measured.topCurve.right[i])<=.75,'Left and right curves remain reflections');
  assert.ok(measured.topCurve.left[0]-measured.topCurve.left.at(-1)>15,'Upper-left corner remains rounded');assert.ok(measured.topCurve.right[0]-measured.topCurve.right.at(-1)>15,'Upper-right corner remains rounded');
  const image=await win.capturePage();await fs.writeFile('mouse-623-'+state+'-'+theme+'.png',image.toPNG());
  const size=image.getSize(),pixels=image.toBitmap(),sx=size.width/measured.viewport.width,sy=size.height/measured.viewport.height;
  const footerPixels=[.15,.3,.7,.85].flatMap(fraction=>offsets.map((depth,referenceIndex)=>{const x=measured.viewport.width*fraction,y=measured.footerTop+depth,ix=Math.floor(x*sx),iy=Math.floor(y*sy);assert.ok(ix>=0&&ix<size.width&&iy>=0&&iy<size.height);const i=(iy*size.width+ix)*4,rgb=[pixels[i+2],pixels[i+1],pixels[i]],background=chromeReference.references[referenceIndex].rgba.slice(0,3);assert.ok(rgb.every((value,c)=>Math.abs(value-background[c])<=3),theme+' '+state+' footer matches the actual toolbar gradient at '+JSON.stringify({x,y,rgb,background}));return{x,y,rgb,referenceIndex};}));
  frames.push({theme,state,...measured,chromeReference,chromeReferenceCapture:baseline.capture,footerPixels});
 }
 async function finish(){
  assert.equal(frames.length,6,'Three content-fit states are captured in both themes');
  assert.deepEqual(footerReferences.map(row=>row.theme),['light','dark'],'Both themes retain their actual pre-modal PNG reference');
  for(const theme of ['light','dark']){
   const compact=frames.find(f=>f.theme===theme&&f.state==='compact');assert.ok(compact);
   for(const state of ['modes','preview']){
    const other=frames.find(f=>f.theme===theme&&f.state===state);assert.ok(other);assert.ok(other.height>compact.height+16&&other.top<compact.top-16,theme+' '+state+' grows upward to fit added content');assert.ok(Math.abs(other.width-compact.width)<.05,theme+' '+state+' keeps its width');
    assert.notDeepEqual(other.paths,compact.paths,theme+' '+state+' has the measured taller silhouette');assert.ok(other.geometryWrites>compact.geometryWrites,theme+' content growth updates the shape');
    assert.equal(other.footerTop,compact.footerTop);assert.equal(other.footerHeight,compact.footerHeight);assert.deepEqual(other.footerPixels,compact.footerPixels,theme+' footer keeps its actual background pixels');
    for(const side of ['left','right'])for(let i=0;i<compact.topCurve.depths.length;i++)assert.ok(Math.abs(compact.topCurve[side][i]-other.topCurve[side][i])<=1,theme+' '+state+' keeps its upper '+side+' curve');
   }
  }
  result={version:'6.0.23',fixedTopCurves:true,contentFit:true,noInternalScroll:true,footerStrokeAbsent:true,footerStationary:true,controlsReachable:true,supersededOldGeometry:true,geometryVersion:'6.0.28',themes:['light','dark'],states:['compact','modes','preview'],footerReferences,frames};
  await fs.writeFile('mouse-623-verification.json',JSON.stringify(result,null,2)+'\n');
  console.log('MOUSE_628_BURROW_CONTENT_FIT_CONTROLS_PASS');
 }
 async function verifyTabs({browser,bank,click,activate,root,native,until,sleep}){
  const chip=id=>'.desk-tab-chip[data-tab="'+id+'"]';
  const snapshot=()=>js('MouseNative.desktops("previews",{preferences:MouseTest.prefs()})');
  const order=()=>js('[...document.querySelectorAll(".desk-peek-tabs>.desk-tab-chip[data-tab]")].map(e=>e.dataset.tab)');
  async function drag(from,to,bottom=false){
   await activate();const points=await js(`(()=>{const from=document.querySelector(${JSON.stringify(from)}),to=document.querySelector(${JSON.stringify(to)});from.scrollIntoView({block:'center',inline:'nearest'});to.scrollIntoView({block:'nearest',inline:'nearest'});const point=(element,bottom)=>{const hit=(${nativeHitTarget.toString()})(element,{yFraction:bottom?.9:.5});if(!hit.ready)throw Error('Chip drag endpoint is covered: '+JSON.stringify(hit));return{x:hit.x,y:hit.y};};return{a:point(from,false),b:point(to,${bottom})};})()`),o=win.getContentBounds();
   const a={x:Math.round(o.x+points.a.x),y:Math.round(o.y+points.a.y)},b={x:Math.round(o.x+points.b.x),y:Math.round(o.y+points.b.y)};
   assert.equal(native.testMouse(a.x,a.y,0),true);
   try{await sleep(80);for(let i=1;i<=12;i++){assert.equal(native.testMouse(a.x+(b.x-a.x)*i/12,a.y+(b.y-a.y)*i/12,1),true);await sleep(30);if(i===2)await until(()=>js('!!document.querySelector(".desk-chip-ghost")'),'real native chip drag');}await sleep(100);}
   finally{native.testMouse(b.x,b.y,2);}await sleep(240);
  }
  try{
   await js('MouseTest.switchDesktop("desk-5")');assert.equal(browser.state().tabs.length,0,'Lifecycle fixture uses an empty desk');
   for(let i=0;i<4;i++)await js(`MouseTest.openPage(${JSON.stringify(root+'/lifecycle/'+i)},MouseTest.model.active)`);
   await until(()=>browser.state().tabs.length===4&&browser.state().tabs.every(t=>!browser.get(t.id).loading&&t.favicon?.endsWith('/favicon.png')),'four local pages and real favicons');
   // Arrange this fixture explicitly: ordinary state updates preserve empty slots.
   await js('MouseTest.changeLayout(3);MouseLayout.leaves(MouseTest.model.tree).forEach((pane,i)=>MouseTest.model.slots[pane]=MouseTest.model.state.tabs.filter(t=>t.lane!=="side")[i].id);MouseTest.renderTree();MouseTest.applySide();MouseTest.save()');const prepared=(await snapshot()).items.find(d=>d.id==='desk-5');assert.equal(prepared.count,4);assert.equal(prepared.paneCount,3);assert.equal(prepared.hiddenCount,1);
   const records=new Map();for(const t of browser.state().tabs){const wc=browser.get(t.id).view.webContents,identity=await wc.executeJavaScript('window.identity');assert.equal(typeof identity,'number','Fixture script is loaded');records.set(t.id,{wc,identity});}
   const pane=await js('(()=>{const pane=document.querySelector(".pane").dataset.pane;return{pane,id:MouseTest.model.slots[pane]};})()'),closed=records.get(pane.id).wc;
   await click('.pane[data-pane="'+pane.pane+'"] [data-pane-action=remove]');
   await until(()=>closed.isDestroyed()&&!browser.tabs.has(pane.id),'pane close destroys its real page');
   let all=await snapshot(),desk=all.items.find(d=>d.id==='desk-5');assert.equal(desk.count,3);assert.equal(desk.paneCount,2);assert.equal(desk.hiddenCount,1);assert.ok(!desk.preview.tabs.some(t=>t.id===pane.id));assert.equal(bank.members[pane.id],undefined);
   await click('#desktops-button');await click('[data-desk="desk-5"] .desk-preview-button');
   await until(()=>js('document.querySelectorAll(".desk-peek-tabs>.desk-tab-chip[data-tab]").length===3'),'all live tabs appear once as chips');
   assert.match(await js('document.querySelector(".desk-peek-heading>span").textContent'),/2 окна · 1 в фоне/);
   await until(()=>js('[...document.querySelectorAll(".desk-peek-tabs .desk-chip-favicon")].length===3&&[...document.querySelectorAll(".desk-peek-tabs .desk-chip-favicon")].every(i=>i.complete&&i.naturalWidth>0&&i.currentSrc.startsWith("data:image/"))'),'real favicon pixels on every chip');
   await until(()=>js('!!document.querySelector(".desk-peek-image .desk-page-image")'),'large preview image for stability proof');
   const initial=await order(),stable=initial[0];
   await js(`globalThis.__mouse623Nodes={chip:document.querySelector(${JSON.stringify(chip(stable))}),image:document.querySelector('.desk-peek-image .desk-page-image'),card:document.querySelector('[data-desk="desk-5"]')}`);
   for(let i=0;i<20;i++)await records.get(stable).wc.executeJavaScript(`document.title=${JSON.stringify('623 metadata '+i)}`);
   await until(()=>js(`document.querySelector(${JSON.stringify(chip(stable))})?.title.includes('623 metadata 19')`),'actual title events reach the existing chip');
   assert.deepEqual(await js(`({chip:__mouse623Nodes.chip===document.querySelector(${JSON.stringify(chip(stable))}),image:__mouse623Nodes.image===document.querySelector('.desk-peek-image .desk-page-image'),card:__mouse623Nodes.card===document.querySelector('[data-desk="desk-5"]')})`),{chip:true,image:true,card:true},'Metadata updates retain chip, image and card nodes');
   const reordered=[initial.at(-1),...initial.slice(0,-1)];
   await drag(chip(initial.at(-1))+' .desk-chip-select',chip(initial[0])+' .desk-chip-select');
   await until(async()=>JSON.stringify(await order())===JSON.stringify(reordered),'native chip reorder');
   assert.deepEqual(bank.current().layout.tabOrder.filter(id=>reordered.includes(id)),reordered);
   all=await snapshot();const targetCount=all.items.find(d=>d.id==='desk-1').count,moved=reordered.at(-1);
   await drag(chip(moved)+' .desk-chip-select','.desktop-card[data-desk="desk-1"]',true);
   await until(()=>bank.members[moved]==='desk-1','native cross-desktop chip move');
   assert.equal(await js('MouseTest.model.desktopId'),'desk-5','Moving a chip does not switch desktops');assert.equal(bank.active,'desk-5');
   all=await snapshot();assert.equal(all.items.find(d=>d.id==='desk-1').count,targetCount+1);assert.equal(all.items.find(d=>d.id==='desk-5').count,2);
   const remaining=await order();assert.equal(remaining.length,2);assert.ok(!remaining.includes(moved));const closedChip=remaining[0],closedChipPage=records.get(closedChip).wc;
   await click(chip(closedChip)+' .desk-chip-close');await until(()=>closedChipPage.isDestroyed()&&!browser.tabs.has(closedChip),'chip close destroys its real page');
   all=await snapshot();desk=all.items.find(d=>d.id==='desk-5');assert.equal(desk.count,1);assert.equal(bank.members[closedChip],undefined);assert.ok(!desk.preview.tabs.some(t=>t.id===closedChip));
   await until(()=>js('document.querySelectorAll(".desk-peek-tabs>.desk-tab-chip[data-tab]").length===1'),'closed chip disappears from the preview');
   for(const [id,record]of records){if(id===pane.id||id===closedChip)continue;assert.equal(browser.get(id).view.webContents,record.wc);assert.equal(await record.wc.executeJavaScript('window.identity'),record.identity,'Chip operations preserve the loaded page instance');}
   result.tabLifecycle={closedPageDestroyed:true,closedCountRemoved:true,metadataNodesStable:true,chipReorder:true,chipTransfer:true,faviconsPainted:true,pageIdentityPreserved:true};
   await fs.writeFile('mouse-623-verification.json',JSON.stringify(result,null,2)+'\n');console.log('MOUSE_623_TAB_LIFECYCLE_CHIPS_STABILITY_PASS');
  }finally{
   const o=win.getContentBounds();try{native.testMouse(o.x+10,o.y+60,2);}catch{}
   await js('delete globalThis.__mouse623Nodes;MouseTest.desktopUI.close({immediate:true})').catch(()=>{});
  }
 }
 return{prepareReference,capture,finish,verifyTabs};
};
