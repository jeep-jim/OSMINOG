'use strict';
// Presentation-only state fixtures. Real updater transport, package verification,
// installation and relaunch remain covered by the separate installed update gate.
const assert=require('node:assert/strict');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const PHASES=Object.freeze(['current','available','downloading','ready','installing','error']);
const ACTIONS=Object.freeze(['update-download','update-install','update-open','update-check']);

function snapshot(phase,version){
 assert.ok(PHASES.includes(phase));
 return{phase,currentVersion:version,latestVersion:version,availableVersion:phase==='current'?'':version,percent:phase==='downloading'?46:phase==='ready'||phase==='installing'?100:0,canInstall:phase==='ready'||phase==='installing',error:phase==='error'?'Owned visual fixture: update unavailable.':''};
}
function readback(hitTarget){
 const d=document.querySelector('#update-dialog'),logo=d.querySelector('#update-mouse'),meter=d.querySelector('#update-ring-meter'),r=d.getBoundingClientRect(),style=getComputedStyle(d),backdrop=getComputedStyle(d,'::backdrop');
 const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height}},visible=e=>{const c=getComputedStyle(e),b=e.getBoundingClientRect();return!e.hidden&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0&&b.width>0&&b.height>0;};
 const selectors=['#update-download','#update-install','#update-open','#update-check','#update-minimize','#update-dialog [data-close-dialog]'];
 return{open:d.open,modal:d.matches(':modal'),phase:d.dataset.phase,theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},bounds:rect(d),viewport:{width:innerWidth,height:innerHeight},radius:style.borderTopLeftRadius,
  overflow:{clientWidth:d.clientWidth,clientHeight:d.clientHeight,scrollWidth:d.scrollWidth,scrollHeight:d.scrollHeight},backdrop:{backgroundColor:backdrop.backgroundColor,opacity:backdrop.opacity},surfaces:{ring:style.backgroundColor,core:getComputedStyle(d,'::before').backgroundColor},
  logo:{bounds:rect(logo),visible:visible(logo),complete:logo.complete,naturalWidth:logo.naturalWidth,naturalHeight:logo.naturalHeight,src:logo.getAttribute('src')},
  status:{text:d.querySelector('#update-status').textContent,bounds:rect(d.querySelector('#update-status'))},progress:{hidden:d.querySelector('#update-progress').hidden,value:d.querySelector('#update-progress').value},
  meter:meter?{pathLength:meter.getAttribute('pathLength'),dasharray:meter.getAttribute('stroke-dasharray'),progressVisible:d.dataset.progressVisible,opacity:getComputedStyle(meter).opacity}:null,
  controls:selectors.map(selector=>{const e=document.querySelector(selector);return{selector,visible:visible(e),hidden:e.hidden,disabled:e.disabled===true,label:e.getAttribute('aria-label')||e.textContent.trim(),bounds:rect(e),radius:getComputedStyle(e).borderTopLeftRadius,hit:hitTarget(e,{})}})};
}
function presentationWitnesses(value){
 const color=name=>{const match=value.surfaces[name].match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);assert.ok(match,'The existing update '+name+' surface is opaque');return match.slice(1).map(Number);},d=value.bounds;
 // Sample the real flat ring/core, clear of the logo, text, controls and shadows.
 // No witness element or artificial color is inserted into the production UI.
 return[{name:'update circle ring',point:{x:d.x+d.width*.5,y:d.y+d.height*.055},expectedRGB:color('ring')},{name:'update circle core',point:{x:d.x+d.width*.25,y:d.y+d.height*.5},expectedRGB:color('core')}];
}
function assertPresentation(value,phase,theme){
 const near=(a,b,label)=>assert.ok(Math.abs(a-b)<=1.1,label+': '+a+' / '+b),d=value.bounds;
 assert.equal(value.open,true);assert.equal(value.modal,true);assert.equal(value.phase,phase);assert.equal(value.theme,theme);assert.equal(value.appearance.paneMode,'square');
 assert.ok(d.width>=360&&d.height>=360);near(d.width,d.height,'The update window remains a circle in square workspace mode');
 const radius=parseFloat(value.radius);assert.ok(Number.isFinite(radius)&&(value.radius.includes('%')?radius>=49.9:radius>=d.width/2-1.1),'Circular update border radius');
 assert.ok(d.x>=0&&d.y>=0&&d.x+d.width<=value.viewport.width+1&&d.y+d.height<=value.viewport.height+1,'The complete circle stays in the viewport');
 for(const axis of ['Width','Height'])assert.ok(value.overflow['scroll'+axis]<=value.overflow['client'+axis]+1,'Update circle has no '+axis.toLowerCase()+' overflow');
 const color=value.backdrop.backgroundColor.match(/^rgba?\(([^)]+)\)$/);assert.ok(color,'Computed update backdrop color is available');const rgba=color[1].split(',').map(Number),alpha=rgba.length===4?rgba[3]:1;
 assert.ok(rgba.slice(0,3).every(v=>v<=20)&&alpha*Number(value.backdrop.opacity)>=.75,'Update backdrop is strongly darkened');
 const logo=value.logo;assert.equal(logo.visible,true);assert.equal(logo.complete,true);assert.ok(logo.naturalWidth>0&&logo.naturalHeight>0);assert.equal(logo.src,'mouse-update.svg');assert.ok(logo.bounds.width>=150&&logo.bounds.height>=150);
 near(logo.bounds.x+logo.bounds.width/2,d.x+d.width/2,'The original Mouse logo is horizontally centered');
 near(logo.bounds.y+logo.bounds.height/2,d.y+d.height/2,'The original Mouse logo is vertically centered');
 assert.ok(value.status.text.trim().length>0);assert.equal(value.progress.hidden,phase!=='downloading');if(phase==='downloading')assert.equal(value.progress.value,46);
 const percent=phase==='downloading'?46:['ready','installing'].includes(phase)?100:0;assert.equal(value.meter?.pathLength,'100');assert.equal(value.meter.dasharray,percent+' 100');assert.equal(value.meter.progressVisible,String(percent>0));
 const witnesses=presentationWitnesses(value);assert.deepEqual(witnesses.map(w=>w.expectedRGB),theme==='dark'?[[34,40,50],[21,26,34]]:[[230,232,236],[250,250,250]],'Update circle surfaces follow the actual theme');
 const expected=new Set(['#update-check','#update-minimize','#update-dialog [data-close-dialog]',...(phase==='available'?['#update-download']:phase==='ready'?['#update-install','#update-open']:[])]);
 assert.equal(value.controls.length,6);
 for(const control of value.controls){
  assert.equal(control.visible,expected.has(control.selector),'State-specific control visibility: '+control.selector);
  if(!control.visible)continue;
  assert.ok(control.label.trim().length>0,'Visible controls have accessible labels');
  const disabled=control.selector==='#update-check'&&['downloading','installing'].includes(phase);assert.equal(control.disabled,disabled);
  if(['#update-minimize','#update-dialog [data-close-dialog]'].includes(control.selector)){near(control.bounds.width,control.bounds.height,'Circular close/minimize control');const radius=parseFloat(control.radius);assert.ok(Number.isFinite(radius)&&(control.radius.includes('%')?radius>=49.9:radius>=control.bounds.width/2-1.1),'Close/minimize control has a circular border');}
  if(!disabled){assert.equal(control.hit.ready,true,'The actual ring control is exposed to native input: '+control.selector);const x=control.hit.x-(d.x+d.width/2),y=control.hit.y-(d.y+d.height/2);assert.ok(Math.hypot(x,y)<=d.width/2+1.1,'Control hit point belongs to the circle');}
  assert.ok(control.bounds.x>=d.x-1.1&&control.bounds.y>=d.y-1.1&&control.bounds.x+control.bounds.width<=d.x+d.width+1.1&&control.bounds.y+control.bounds.height<=d.y+d.height+1.1,'Visible control stays inside update bounds');
 }
 const ring=value.controls.filter(c=>ACTIONS.some(id=>c.selector==='#'+id)&&c.visible);
 for(const control of ring){const cx=control.bounds.x+control.bounds.width/2-(d.x+d.width/2),cy=control.bounds.y+control.bounds.height/2-(d.y+d.height/2);assert.ok(Math.hypot(cx,cy)>=d.width*.29,'Update actions occupy the circular rim');}
 return value;
}

module.exports=async function verifyUpdateUI({app,updates,browser,fixture,click,capture,theme,facts,records}){
 assert.ok(updates&&typeof updates.set==='function');assert.equal(updates.task,null,'Visual update fixture starts without a running updater task');
 const originalState=updates.state,savedState=structuredClone(originalState),candidate=updates.candidate,file=updates.file;
 const original=await fixture.js('({theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},dialogOpen:document.querySelector("#update-dialog").open})');assert.equal(original.dialogOpen,false);assert.equal(original.appearance.paneMode,'square');
 const report={schema:1,version:app.getVersion(),source:'UI-owned state fixtures with real installed controls, trusted native open/close and OS screenshots',visualStateFixture:true,transportExercised:false,installationExercised:false,samples:[],restored:false,ok:false};facts.updateDialog=report;
 const read=()=>fixture.js('('+readback.toString()+')('+nativeHitTarget.toString()+')');
 const present=async phase=>{updates.set(snapshot(phase,app.getVersion()));await fixture.until(()=>fixture.js('document.querySelector("#update-dialog").dataset.phase==='+JSON.stringify(phase)),'update visual fixture phase '+phase);await fixture.frame();};
 const live=()=>records.map(record=>{assert.equal(browser.get(record.id),record.page);const state=fixture.nativeState(record);for(const key of ['visible','parentVisible','cachedVisible','attached'])assert.equal(state[key],true);return state;});
 try{
  for(const color of ['light','dark']){
   await theme(color);const before=await Promise.all(records.map(fixture.identity)),nativeBefore=live();await present('available');
   const sample={theme:color,appearance:'square',before:{identities:before,native:nativeBefore},openInput:await click('#version-button'),states:[]};report.samples.push(sample);
   await fixture.until(()=>fixture.js('document.querySelector("#update-dialog").open'),'native update circle opens');
   for(const phase of PHASES){
    await present(phase);const value=assertPresentation(await read(),phase,color);sample.states.push(value);
    if(phase===(color==='light'?'available':'ready')){sample.capture={filename:'mouse-637-update-burrow-'+color+'.png',phase};await capture(sample.capture.filename,presentationWitnesses(value));}
    assert.equal(updates.task,null,'Visual state fixture never starts update transport or installation');assert.equal(updates.candidate,candidate);assert.equal(updates.file,file);
   }
   sample.dismissAction=color==='light'?'close':'minimize';sample.dismissInput=await click(color==='light'?'#update-dialog [data-close-dialog]':'#update-minimize');
   await fixture.until(()=>fixture.js('!document.querySelector("#update-dialog").open'),'native update dialog closes');
   await fixture.until(()=>records.every(record=>record.page.visible),'native pages return after update '+sample.dismissAction);await fixture.frame();
   const after=await Promise.all(records.map(fixture.identity));for(let i=0;i<before.length;i++)fixture.assertIdentity(before[i],after[i]);sample.after={identities:after,native:live(),dialogOpen:false};
  }
 }finally{
  // Restore the exact state keys and original object; fixture-only fields must
  // not survive into the real updater or the next installed acceptance stage.
  updates.state=originalState;for(const key of Object.keys(originalState))delete originalState[key];updates.set(savedState);await fixture.js('document.querySelector("#update-dialog").close();true');
  await theme(original.theme);await fixture.frame();assert.deepEqual(updates.state,savedState);assert.equal(updates.candidate,candidate);assert.equal(updates.file,file);assert.equal(updates.task,null);
  const restored=await fixture.js('({theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},dialogOpen:document.querySelector("#update-dialog").open})');assert.deepEqual(restored,original);report.restored=true;
 }
 report.ok=true;return report;
};
module.exports.fixtures={PHASES,ACTIONS,snapshot,readback,presentationWitnesses,assertPresentation};
