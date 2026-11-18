'use strict';
// Measures the installed, painted burrow in the existing 622 native fixture.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=({win,js})=>{
 const frames=[];let result;
 async function capture(theme,state){
  await js(`new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{const tray=document.querySelector('#desktop-tray');if(tray.open&&!tray.hidden&&tray.dataset.motion==='open')return resolve();if(performance.now()-start>5000)return reject(Error('Burrow did not settle for geometry capture'));requestAnimationFrame(poll);};poll();})`);
  const measured=await js(`(()=>{
   const tray=document.querySelector('#desktop-tray'),path=tray.querySelector('.desk-burrow-shape>path'),bar=document.querySelector('#statusbar'),outline=document.querySelector('#mouse-dock-outline'),fill=document.querySelector('#mouse-dock-fill');
   const r=tray.getBoundingClientRect(),footer=bar.getBoundingClientRect(),line=getComputedStyle(outline),border=getComputedStyle(bar),matrix=path.getScreenCTM(),length=path.getTotalLength();
   const count=Math.ceil(length*Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))*3),points=[];
   for(let i=0;i<=count;i++){const p=path.getPointAtLength(length*i/count).matrixTransform(matrix);points.push({x:p.x-r.left,y:p.y-r.top});}
   const top=Math.min(...points.map(p=>p.y)),depths=[2,6,12,20,32,48,64];
   const profile=right=>depths.map(depth=>{let best,delta=Infinity;for(const p of points){if(right?p.x<r.width*.7:p.x>r.width*.3)continue;const d=Math.abs(p.y-top-depth);if(d<delta){best=p;delta=d;}}if(!best||delta>.75)throw Error('Missing rendered curve sample');return right?r.width-best.x:best.x;});
   const start=path.getPointAtLength(0).matrixTransform(matrix),end=path.getPointAtLength(length).matrixTransform(matrix);
   const edgeMatrix=outline.getScreenCTM(),edgeStart=outline.getPointAtLength(0).matrixTransform(edgeMatrix),edgeEnd=outline.getPointAtLength(outline.getTotalLength()).matrixTransform(edgeMatrix),probe=document.createElement('i');probe.style.color='var(--line)';document.body.append(probe);const edge=getComputedStyle(probe).color;probe.style.color='var(--panel)';const panel=getComputedStyle(probe).color;probe.remove();
   return{width:r.width,height:r.height,left:r.left,right:r.right,bottom:r.bottom,footerTop:footer.top,viewport:{width:innerWidth,height:innerHeight},topCurve:{depths,left:profile(false),right:profile(true)},stroke:line.stroke,footerBorder:edge,footerBorderWidth:parseFloat(border.borderTopWidth),footerImage:border.borderImageSource,endpoints:{left:start.y,right:end.y},surface:{fill:getComputedStyle(fill).fill,panel,opacity:getComputedStyle(fill).opacity,start:{x:edgeStart.x,y:edgeStart.y},end:{x:edgeEnd.x,y:edgeEnd.y},localStroke:getComputedStyle(path).stroke}};
  })()`);
  assert.equal(measured.stroke,measured.footerBorder,theme+' '+state+' outline matches the actual footer border color');
  assert.ok(measured.footerBorderWidth>0,'The footer still has its original border box');
  assert.ok(Math.abs(measured.bottom-measured.footerTop)<=1,'Burrow meets the footer without an overlap');
  const baseline=measured.footerTop+measured.footerBorderWidth/2;
  for(const side of ['left','right'])assert.ok(Math.abs(measured.endpoints[side]-baseline)<=.05,theme+' '+state+' '+side+' outline meets the centre of the actual footer stroke');
  for(const end of ['start','end'])assert.ok(Math.abs(measured.surface[end].y-baseline)<=.05,'The shared dock outline is attached to the footer');
  assert.ok(Math.abs(measured.surface.start.x)<.05&&Math.abs(measured.surface.end.x-measured.viewport.width)<.05,'One outline spans the complete footer');
  assert.equal(measured.surface.fill,measured.surface.panel,'The menu and footer share one solid surface fill');
  assert.equal(Number(measured.surface.opacity),1,'The common surface is opaque');
  for(let i=0;i<measured.topCurve.depths.length;i++)assert.ok(Math.abs(measured.topCurve.left[i]-measured.topCurve.right[i])<=.75,'Left and right curves are exact reflections');
  assert.ok(measured.topCurve.left[0]-measured.topCurve.left.at(-1)>15,'Upper-left corner remains rounded');
  assert.ok(measured.topCurve.right[0]-measured.topCurve.right.at(-1)>15,'Upper-right corner remains rounded');
  const image=await win.capturePage();await fs.writeFile('mouse-623-'+state+'-'+theme+'.png',image.toPNG());
  const size=image.getSize(),pixels=image.toBitmap(),sx=size.width/measured.viewport.width,sy=size.height/measured.viewport.height;
  const rgb=(x,y)=>{const ix=Math.floor(x*sx),iy=Math.floor(y*sy);assert.ok(ix>=0&&ix<size.width&&iy>=0&&iy<size.height,'Seam sample lies inside the native capture');const i=(iy*size.width+ix)*4;return[pixels[i+2],pixels[i+1],pixels[i]];};
  const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),inside=[],outside=[],join=[];
  for(const fraction of [.2,.35,.65,.8]){
   const x=measured.left+measured.width*fraction,seam=rgb(x,baseline+.5),below=rgb(x,baseline+2.5),delta=difference(seam,below);
   inside.push({x,seam,below,delta});assert.ok(delta<=6,theme+' '+state+' has no footer line inside the burrow: '+JSON.stringify(inside.at(-1)));
   const above=rgb(x,baseline-2),rows=[-1,-.5,0,.5,1].map(offset=>({offset,rgb:rgb(x,baseline+offset)}));
   // The same opaque path fills both the menu and footer. Adjacent rows have
   // the same pixels, with no second panel edge or translucency discontinuity.
   assert.ok(difference(above,below)<=6,theme+' '+state+' shares the same fill above and below the join');
   for(const row of rows)for(let channel=0;channel<3;channel++)assert.ok(row.rgb[channel]>=Math.min(above[channel],below[channel])-6&&row.rgb[channel]<=Math.max(above[channel],below[channel])+6,theme+' '+state+' has a one-pixel seam at '+row.offset+'px: '+JSON.stringify({above,below,row}));
   join.push({x,above,below,rows});
  }
  for(const x of [measured.left/2,(measured.right+measured.viewport.width)/2]){
   const seam=rgb(x,measured.footerTop+.5),below=rgb(x,measured.footerTop+2.5),delta=difference(seam,below);
   outside.push({x,seam,below,delta});assert.ok(delta>8,theme+' '+state+' preserves the footer border outside the burrow');
  }
  frames.push({theme,state,...measured,baseline,pixels:{inside,outside,join}});
 }
 async function finish(){
  assert.equal(frames.length,6,'Three burrow states are captured in both themes');
  for(const theme of ['light','dark']){
   const compact=frames.find(f=>f.theme===theme&&f.state==='compact');assert.ok(compact);
   for(const state of ['modes','preview']){
    const expanded=frames.find(f=>f.theme===theme&&f.state===state);assert.ok(expanded);
    assert.ok(expanded.height>compact.height+60,theme+' '+state+' actually expands the burrow');
    assert.ok(Math.abs(expanded.width-compact.width)<1,'Only burrow height changes between states');
    for(const side of ['left','right'])for(let i=0;i<compact.topCurve.depths.length;i++){
     const delta=Math.abs(compact.topCurve[side][i]-expanded.topCurve[side][i]);
     assert.ok(delta<=1,theme+' '+state+' '+side+' curve changed at '+compact.topCurve.depths[i]+'px: '+delta);
    }
   }
  }
  result={version:'6.0.23',fixedTopCurves:true,seamFree:true,outlineMatchesFooter:true,themes:['light','dark'],states:['compact','modes','preview'],frames};
  await fs.writeFile('mouse-623-verification.json',JSON.stringify(result,null,2)+'\n');
  console.log('MOUSE_623_BURROW_GEOMETRY_AND_SEAM_PASS');
 }
 async function verifyTabs({browser,bank,click,activate,root,native,until,sleep}){
  const chip=id=>'.desk-tab-chip[data-tab="'+id+'"]';
  const snapshot=()=>js('MouseNative.desktops("previews",{preferences:MouseTest.prefs()})');
  const order=()=>js('[...document.querySelectorAll(".desk-peek-tabs>.desk-tab-chip[data-tab]")].map(e=>e.dataset.tab)');
  async function drag(from,to,bottom=false){
   await activate();const points=await js(`(()=>{const point=(selector,bottom)=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=bottom?r.bottom-3:r.top+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Chip drag endpoint is covered: '+selector);return{x,y};};return{a:point(${JSON.stringify(from)},false),b:point(${JSON.stringify(to)},${bottom})};})()`),o=win.getContentBounds();
   const a={x:Math.round(o.x+points.a.x),y:Math.round(o.y+points.a.y)},b={x:Math.round(o.x+points.b.x),y:Math.round(o.y+points.b.y)};
   assert.equal(native.testMouse(a.x,a.y,0),true);
   try{await sleep(80);for(let i=1;i<=12;i++){assert.equal(native.testMouse(a.x+(b.x-a.x)*i/12,a.y+(b.y-a.y)*i/12,1),true);await sleep(30);if(i===2)await until(()=>js('!!document.querySelector(".desk-chip-ghost")'),'real native chip drag');}await sleep(100);}
   finally{native.testMouse(b.x,b.y,2);}await sleep(240);
  }
  try{
   await js('MouseTest.switchDesktop("desk-5")');assert.equal(browser.state().tabs.length,0,'Lifecycle fixture uses an empty desk');
   for(let i=0;i<4;i++)await js(`MouseTest.openPage(${JSON.stringify(root+'/lifecycle/'+i)})`);
   await until(()=>browser.state().tabs.length===4&&browser.state().tabs.every(t=>!browser.get(t.id).loading&&t.favicon?.endsWith('/favicon.png')),'four local pages and real favicons');
   // Arrange this fixture explicitly: ordinary state updates preserve empty slots.
   await js('MouseTest.changeLayout(3)');const prepared=(await snapshot()).items.find(d=>d.id==='desk-5');assert.equal(prepared.count,4);assert.equal(prepared.paneCount,3);assert.equal(prepared.hiddenCount,1);
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
 async function verifyAgentEntry({browser,agentHost,click,until}){
  assert.equal(agentHost.state().enabled,false,'Entry probe starts with the agent disconnected');
  assert.equal(await js(`document.querySelectorAll('#ai-select option[value="mouse://agent"]').length`),1);
  assert.equal(await js(`document.querySelectorAll('.ai-preset-card[data-ai-url="mouse://agent"]').length`),1);
  const before=new Set(browser.state().tabs.map(t=>t.id));let start;
  try{
   await js('MouseTest.openPage("mouse://start")');
   await until(()=>{start=browser.state().tabs.find(t=>!before.has(t.id)&&t.internal);return!!start;},'internal start page for Agent entry');
   const pane=await js('MouseTest.model.active'),selector='.pane[data-pane="'+pane+'"] .home-agent-open';
   await until(()=>js(`!!document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().width`),'Agent Mouse start service is visible');
   const layoutExpression='JSON.stringify((({mode,tree,slots,active,tabOrder,aiId,aiSessions,aiOpen,aiWidth})=>({mode,tree,slots,active,tabOrder,aiId,aiSessions,aiOpen,aiWidth}))(MouseTest.prefs()))';
   const ids=browser.state().tabs.map(t=>t.id).sort(),layout=await js(layoutExpression);await click(selector);
   await until(()=>js('MouseTest.model.agentOpen===true&&!document.querySelector("#agent-panel").hidden'),'start entry opens the Agent service panel');
   assert.equal(await js(layoutExpression),layout,'Agent service entry preserves the existing mode and exact layout');
   assert.equal(agentHost.state().enabled,false,'Opening Agent Mouse does not enable its connection');
   assert.deepEqual(browser.state().tabs.map(t=>t.id).sort(),ids,'Agent entry preserves existing tabs');
   await until(()=>js('(()=>{const i=document.querySelector("#agent-panel .agent-presence img.agent-mouse-icon");return!!i&&i.complete&&i.naturalWidth>0;})()'),'coloured Agent mouse asset paints');
   const icon=await js('(()=>{const i=document.querySelector("#agent-panel .agent-presence img.agent-mouse-icon");return{src:i.getAttribute("src"),color:i.dataset.agentColor,filter:getComputedStyle(i).filter};})()');
   assert.ok(['orange','cyan','green','violet','coral'].includes(icon.color));assert.equal(icon.src,'agent-mouse-'+icon.color+'.svg');assert.equal(icon.filter,'none','Agent mascot keeps its own colours');
   result.agentEntry={startService:true,aiPreset:true,aiSelect:true,disabledUntilEnabled:true,mascotLoaded:true,color:icon.color};
   await fs.writeFile('mouse-623-verification.json',JSON.stringify(result,null,2)+'\n');console.log('MOUSE_623_AGENT_ENTRY_ASSET',JSON.stringify(result.agentEntry));
  }finally{if(start)await js(`MouseNative.browser('close',{id:${JSON.stringify(start.id)}})`).catch(()=>{});}
 }
 return{capture,finish,verifyTabs,verifyAgentEntry};
};
