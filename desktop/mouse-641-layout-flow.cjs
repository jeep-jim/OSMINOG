'use strict';
// Installed641 workspace actions. Setup only supplies owned pages and desktops;
// every split, chooser, insertion, move and divider resize uses native input.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const L=require('./mouse/layout.js');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function dragReadback(){
 const m=MouseTest.model,indicator=document.querySelector('#mouse-insert-indicator'),target=document.querySelector('.mouse-drop-insert'),neighbor=document.querySelector('.mouse-drop-neighbor');
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility==='visible';
 return{desktopId:m.desktopId,active:m.swapDrag===true,bodyDragging:document.body.classList.contains('mouse-tab-dragging'),ghost:visible(document.querySelector('#mouse-drag-label')),
  affordance:{visible:!!indicator&&visible(indicator.querySelector('.insert-badge')),axis:indicator?.dataset.axis||'',text:indicator?.textContent||'',svg:!!indicator?.querySelector('svg'),target:target?.dataset.pane||'',edge:target?.dataset.insertEdge||'',neighbor:neighbor?.dataset.pane||'',bounds:indicator?rect(indicator):null},
  edge:[...document.querySelectorAll('.mouse-drag-edge')].map(e=>({id:e.id,hover:e.dataset.hover==='true',bounds:rect(e)})),desktops:[...document.querySelectorAll('[data-drag-desk]')].map(e=>({id:e.dataset.dragDesk,active:e.dataset.active==='true'}))};
}
function installEdgeObservation({edgeId,destination,timeoutMs=9000}){
 globalThis.__mouse641HeldEdge?.dispose();
 const value={schema:1,clock:'renderer performance.now',edgeId,destination,originDesktop:MouseTest.model.desktopId,armedAtMs:performance.now(),hoverAtMs:null,switchedAtMs:null,elapsedMs:null,ok:false};
 let frame=0,finished=false,resolve;const promise=new Promise(done=>{resolve=done;});
 const finish=error=>{if(finished)return;finished=true;cancelAnimationFrame(frame);if(error)value.error=error;else value.ok=true;resolve({...value});};
 function check(){
  const now=performance.now(),m=MouseTest.model,edge=document.getElementById(edgeId);
  if(value.hoverAtMs===null&&m.swapDrag===true&&edge?.dataset.hover==='true')value.hoverAtMs=now;
  if(m.desktopId===destination&&!m.switching){value.switchedAtMs=now;value.elapsedMs=value.hoverAtMs===null?null:now-value.hoverAtMs;finish(value.hoverAtMs===null?'Desktop changed without an observed held edge hover':m.swapDrag!==true?'Desktop changed after the drag ended':null);return;}
  if(now-value.armedAtMs>=timeoutMs){finish('Held desktop edge observation timed out');return;}frame=requestAnimationFrame(check);
 }
 globalThis.__mouse641HeldEdge={promise,dispose:()=>finish('Held desktop edge observer disposed')};frame=requestAnimationFrame(check);return true;
}
function assertHeader(pane){
 const b=pane.bounds,h=pane.header.bounds;assert.equal(pane.header.visible,true);assert.equal(pane.header.opacity,1);assert.equal(pane.header.visibility,'visible');assert.notEqual(pane.header.display,'none');
 assert.ok(h.height>=28&&h.width>0&&h.x>=b.x-1&&h.y>=b.y-1&&h.x+h.width<=b.x+b.width+1&&h.y+h.height<=b.y+b.height+1,'Even a tiny pane contains its whole visible header');
}
const order=state=>L.leaves(state.tree).map(id=>state.slots[id]||'');

module.exports=async function layoutFlow({ctx,fixture,records,part,grid,click,hit,capture,nativeInput,source,until,js,inputProbe,stage=()=>{},remainingMs=()=>15000}){
 const {app,win,browser}=ctx,report={schema:1,source:'Installed native split, chooser, held drag and divider controls',ok:false,headers:[]};
 part.layout=report;
 const mark=(name,detail={})=>{report.stage=name;stage(name,detail);};
 const nativeButton=process.platform==='darwin'?require('./mouse-native-menu.node'):require('./mouse-platform.node');
 const absolute=p=>{const b=win.getContentBounds();return{x:Math.round(b.x+p.x),y:Math.round(b.y+p.y)};};
 const panePoint=async(id,fx=.5,fy=.5)=>js(`(()=>{const r=document.querySelector('.pane[data-pane="'+${JSON.stringify(id)}+'"]').getBoundingClientRect();return{x:r.x+r.width*${fx},y:r.y+r.height*${fy}};})()`);
 // The renderer owns this wait. A Node timer in the parent can stop servicing
 // callbacks during Windows OLE; it must never be needed to send mouse-up.
 const waitShell=(condition,label,ms=9000)=>js(`new Promise((resolve,reject)=>{const end=performance.now()+${Math.min(ms,9000)};function check(){if(${condition})return resolve(true);if(performance.now()>=end)return reject(Error(${JSON.stringify(label)}));requestAnimationFrame(check);}check();})`);
 async function drag(selector,record,to,{during,arrangement=true,finish=null,edgeWatch=null}={}){
  const evaluate=record?s=>fixture.pageJS(record,s):js;app.focus({steal:true});win.focus();(record?.page.view.webContents||win.webContents).focus();
  const from=await hit(selector,record);await evaluate('('+inputProbe.toString()+')('+JSON.stringify(selector)+')');
  const row={id:randomUUID(),selector,tabId:record?.id||null,pid:process.pid,source,action:'drag',from,to:{...to},at:Date.now(),events:[],released:false,points:[]};part.inputs.push(row);let current=from;
  if(process.platform==='win32'&&record){
   const gesture=require('./mouse-641-native-drag.cjs').createNativeDrag({from,to,finish,remainingMs:remainingMs()},{screen:require('electron').screen});
   if(edgeWatch)await js('('+installEdgeObservation.toString()+')('+JSON.stringify(edgeWatch)+')');
   row.to={...finish||to};mark('html-child-start',{inputId:row.id,kind:gesture.plan.kind,nonce:gesture.plan.nonce});
   // Attach both outcomes immediately. Even a blocked observer never owns the
   // child's motion or release; the child executes its complete fixed plan.
   const completion=gesture.run().then(value=>{row.nativeDrag=value;return null;},error=>{row.nativeDrag=error.nativeDrag;return error;});let observationError;
   try{
    await waitShell('MouseTest.model.swapDrag===true','641 actual native HTML drag starts');mark('html-drag-observed',{inputId:row.id,mouseDown:nativeButton.primaryDown()});
    if(during)await during({row,waitShell,independent:true,observedElapsed:gesture.parentElapsedNs,edgeObservation:()=>js('__mouse641HeldEdge.promise')});
    else{await waitShell('!!document.querySelector(".pane.mouse-drop-target[data-pane=p2]")','641 actual native HTML pane target');assert.equal(nativeButton.primaryDown(),true,'The real HTML drop target must be observed before UP');}
   }catch(error){observationError=error;row.observationError=String(error.message||error);mark('html-observation-failed',{inputId:row.id,error:row.observationError});}
   const childError=await completion;row.released=row.nativeDrag?.released===true;row.finishedAt=Date.now();
   row.points=(row.nativeDrag?.events||[]).flatMap((event,index)=>event.phase===1?[{...row.nativeDrag.coordinates.samples[index].logical,at:event.at}]:[]);
   mark('html-child-exited',{inputId:row.id,exitCode:row.nativeDrag?.exitCode,released:row.released,error:childError?.message||null});
   if(edgeWatch)await js('__mouse641HeldEdge?.dispose();delete globalThis.__mouse641HeldEdge;true');
   if(observationError)throw observationError;if(childError)throw childError;
   row.events=await evaluate('__mouse641Input.events');
  }else{
   const move=async point=>{current={x:Math.round(point.x),y:Math.round(point.y)};assert.equal(await nativeInput.testMouse(current.x,current.y,1),true);row.points.push({...current,at:Date.now()});await sleep(20);};
   try{
    assert.equal(await nativeInput.testMouse(from.x,from.y,0),true);
    if(arrangement){await move({x:from.x+12,y:from.y+7});await until(()=>js('MouseTest.model.swapDrag===true'),'641 actual drag starts');}
    const start={...current};for(let i=1;i<=12;i++)await move({x:start.x+(to.x-start.x)*i/12,y:start.y+(to.y-start.y)*i/12});
    if(during)await during({row,move});row.to={...current};
   }finally{
    try{row.events=await evaluate('__mouse641Input.events');}
    finally{assert.equal(await nativeInput.testMouse(current.x,current.y,2),true);row.released=true;row.finishedAt=Date.now();}
   }
  }
  assert.ok(row.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.matches),'Native drag started on the owned visible target');
  try{await until(()=>js('!MouseTest.model.swapDrag&&!MouseTest.model.drag&&!MouseTest.model.switching'),'641 released drag settles');}
  finally{try{row.events=await evaluate('__mouse641Input.events');}catch(error){row.eventReadbackError=String(error.message);}}
  await fixture.frame();return row;
 }
 async function divider(path,point){return drag('.divider[data-path="'+path+'"]',null,absolute(point),{arrangement:false});}
 const before=await grid(),originDesk=before.desktopId,third=await fixture.open(part.origin+'/page/4/',4);report.fixture={originDesk,third:await fixture.identity(third)};
 // A new blank pane must offer the familiar home and an explicit tab choice.
 await click('.pane[data-pane="p1"] .pane-address input');const splitInput=await click('#footer-left [data-action="split-x"]');let empty;
 await until(async()=>{const state=await grid();empty=state.panes.find(p=>!state.slots[p.id]);return empty?.home.visible;},'641 new empty pane is home');
 report.empty={input:splitInput,after:await grid(),paneId:empty.id,home:empty.home,capture:await capture('empty-pane')};
 assert.equal(empty.home.search,true);assert.equal(empty.home.favorites,true);assert.ok(empty.home.tabs.some(t=>t.id===third.id&&t.visible));
 const choice=await click('.pane[data-pane="'+empty.id+'"] [data-home-tab="'+third.id+'"]');await until(async()=>(await grid()).slots[empty.id]===third.id,'641 chooser uses existing page');
 report.chooser={input:choice,selectedId:third.id,paneId:empty.id,after:await grid(),identity:await fixture.identity(third)};fixture.assertIdentity(report.fixture.third,report.chooser.identity);
 // Restore the two-pane fixture, then drag an unplaced top tab into the seam.
 await fixture.setLayout(records);const insertedBefore=await grid(),target=insertedBefore.panes.find(p=>p.id==='p2'),to=absolute({x:target.bounds.x+2,y:target.bounds.y+target.bounds.height/2});
 let insertionDuring,insertionCapture;
 const insertInput=await drag('.tab-item[data-tab="'+third.id+'"] .tab-title',null,to,{during:async()=>{
  await until(async()=>{insertionDuring=await js('('+dragReadback.toString()+')()');return insertionDuring.affordance.visible&&insertionDuring.affordance.target==='p2'&&insertionDuring.affordance.edge==='left'&&!!insertionDuring.affordance.neighbor;},'641 visible split-gap insertion affordance');
  assert.equal(nativeButton.primaryDown(),true);insertionCapture=await capture('insert-gap-held');
 }});
 await until(async()=>{const value=await grid();return order(value).length===3&&order(value)[1]===third.id;},'641 insertion adds pane between two existing panes');
 const inserted=await grid();report.insertion={input:insertInput,insertedId:third.id,before:insertedBefore,after:inserted,beforeOrder:order(insertedBefore),afterOrder:order(inserted),affordance:insertionDuring.affordance,whileHeld:insertionDuring,capture:insertionCapture,afterCapture:await capture('inserted-pane')};assert.deepEqual(order(inserted),[records[0].id,third.id,records[1].id]);
 // Start a real HTML drag in empty website content and exchange page placement.
 mark('blank-drag-setup');await fixture.setLayout(records);const blankBefore=await fixture.identity(records[0]),blankGrid=await grid();
 const blankInput=await drag('#blank-drag',records[0],absolute(await panePoint('p2')));let blankAfter;
 await until(async()=>{blankAfter=await grid();return blankAfter.slots.p2===records[0].id;},'641 blank website drag changes placement');
 report.blankDrag={input:blankInput,before:blankBefore,after:await fixture.identity(records[0]),beforePane:'p1',afterPane:'p2',gridBefore:blankGrid,gridAfter:blankAfter,capture:await capture('blank-drag-moved')};fixture.assertIdentity(report.blankDrag.before,report.blankDrag.after);
 // Prepare one empty destination, then let the still-held native drag switch it.
 const desks=fixture.bank.items,index=desks.findIndex(d=>d.id===originDesk),direction=index<desks.length-1?1:-1,destination=desks[index+direction]?.id;assert.ok(destination&&destination!==originDesk);
 mark('edge-carry-setup');await fixture.switchDesk(destination);await js('Object.assign(MouseTest.model,{tree:{id:"p1"},slots:{p1:""},active:"p1",classicTabId:"",aiOpen:false,focusAI:false,focusPane:"",libraryOpen:false});MouseTest.renderTree();MouseTest.applySide();MouseTest.save();MouseTest.requestLayout();');await fixture.frame();
 const destinationPoint=absolute(await panePoint('p1'));
 await fixture.switchDesk(originDesk);await fixture.setLayout(records);const carryBefore=await fixture.identity(records[0]);
 const edge=await js(`(()=>{const r=document.querySelector('#workspace').getBoundingClientRect();return{x:${direction}>0?r.right-8:r.left+8,y:r.top+r.height/2}})()`);let held,hoverMs,carryCapture;
 const carryInput=await drag('#blank-drag',records[0],absolute(edge),{finish:destinationPoint,edgeWatch:{destination,edgeId:direction>0?'mouse-drag-edge-right':'mouse-drag-edge-left'},during:async({move,independent,observedElapsed,edgeObservation})=>{
  const hoverStarted=Date.now(),condition=`MouseTest.model.desktopId===${JSON.stringify(destination)}&&!MouseTest.model.switching`;
  let edgeTiming;if(independent){edgeTiming=await edgeObservation();assert.equal(edgeTiming.ok,true,edgeTiming.error);hoverMs=edgeTiming.elapsedMs;assert.ok(hoverMs>=600,'The renderer must observe a real edge hover before the desktop switch');}else{await until(()=>js(condition),'641 held drag switches workspace edge',12000);hoverMs=Date.now()-hoverStarted;}
  held={...await js('('+dragReadback.toString()+')()'),mouseDown:nativeButton.primaryDown(),sourceMembership:fixture.bank.members[records[0].id],originDesk,sourceTabId:records[0].id,observerPid:process.pid,observedAt:Date.now()};
  if(independent){held.observedElapsedNs=observedElapsed();held.edgeObservation=edgeTiming;}
  assert.equal(held.desktopId,destination);assert.equal(held.active,true);assert.equal(held.mouseDown,true);assert.equal(held.sourceMembership,originDesk,'Live source stays owned by its original desk while held');mark('edge-switched-while-held',{inputId:part.inputs.at(-1).id,held});
  carryCapture=await capture('desk-edge-held',{synchronous:!!independent});held.captureFinishedAt=Date.now();held.mouseDownAfterCapture=nativeButton.primaryDown();held.sourceMembershipAfterCapture=fixture.bank.members[records[0].id];
  if(independent){held.captureElapsedNs=observedElapsed();assert.equal(held.mouseDownAfterCapture,true,'Held display capture must finish before native UP');assert.equal(held.sourceMembershipAfterCapture,originDesk,'Source ownership must remain unchanged through the held display capture');mark('edge-held-capture-finished',{inputId:part.inputs.at(-1).id,held});}
  else await move(absolute(await panePoint('p1')));
 }});
 try{await until(()=>fixture.bank.members[records[0].id]===destination,'641 released drag transfers exact source');}
 catch(cause){
  let ui=null;try{ui=await js('('+dragReadback.toString()+')()');}catch(error){ui={readbackError:String(error.message)};}
  console.error('MOUSE_641_EDGE_DROP_DIAGNOSTIC',JSON.stringify({originDesk,destination,membership:fixture.bank.members[records[0].id],ui,release:carryInput?.released,inputs:part.inputs.slice(-3).map(value=>({action:value.action,selector:value.selector,events:value.events?.filter(event=>['dragstart','dragend','pointerup','pointercancel'].includes(event.type))}))}));
  throw cause;
 }
 report.edgeCarry={input:carryInput,before:carryBefore,after:await fixture.identity(records[0]),whileHeld:held,hoverMs,direction,capture:carryCapture,afterCapture:await capture('desk-edge-dropped')};
 for(const key of ['id','index','webContentsId','url','navigationEpoch','identity','timeOrigin','field','scrollX','scrollY','cookie'])assert.deepEqual(report.edgeCarry.after[key],carryBefore[key]);assert.equal(report.edgeCarry.after.desk,destination);
 // Scoped cleanup of this movement uses the regular checked desktop mutation.
 await js(`MouseTest.mutateDesktopTabs('move-tab',{id:${JSON.stringify(records[0].id)},sourceDesk:${JSON.stringify(destination)},desk:${JSON.stringify(originDesk)},placement:{pane:'p1',edge:''}})`);await fixture.switchDesk(originDesk);records[0].desk=originDesk;await fixture.setLayout(records);
 // Both width and height are reduced with actual dividers, in each theme.
 const tree={axis:'x',ratio:.5,a:{id:'p1'},b:{axis:'y',ratio:.5,a:{id:'p2'},b:{id:'p3'}}},slots={p1:records[0].id,p2:records[1].id,p3:third.id};
 for(const theme of ['light','dark']){
  if(await js('MouseTest.model.theme')!==theme)await click('#theme-button');await until(()=>js('MouseTest.model.theme==='+JSON.stringify(theme)),'641 header theme');
  await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:'p3',classicTabId:'',aiOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save();`);await fixture.frame();
  const stage=await js('(()=>{const r=document.querySelector("#stage").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()');
  const tinyInputs=[await divider('',{x:stage.x+stage.width-140,y:stage.y+stage.height/2}),await divider('b',{x:stage.x+stage.width-70,y:stage.y+stage.height-100})];await fixture.frame();
  let state=await grid(),pane=state.panes.find(p=>p.id==='p3');assertHeader(pane);assert.ok(pane.bounds.width<=150&&pane.bounds.height<=110);report.headers.push({theme,stage:'tiny',inputs:tinyInputs,pane,native:fixture.nativeState(third),capture:await capture('header-tiny-'+theme)});
  const resizedInputs=[await divider('',{x:stage.x+stage.width-210,y:stage.y+stage.height/2}),await divider('b',{x:stage.x+stage.width-105,y:stage.y+stage.height-140})];await fixture.frame();state=await grid();pane=state.panes.find(p=>p.id==='p3');assertHeader(pane);report.headers.push({theme,stage:'resized',inputs:resizedInputs,pane,native:fixture.nativeState(third),capture:await capture('header-resized-'+theme)});
 }
 await fixture.setLayout(records);report.ok=true;return report;
};
module.exports.fixtures={dragReadback,installEdgeObservation,assertHeader,order};
