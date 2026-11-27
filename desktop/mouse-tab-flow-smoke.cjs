'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){for(let n=0;n<120;n++){if(await f())return;await sleep(50);}throw Error('Tab-flow timeout: '+label);}
function usesTabBox(identity){return identity?.platform==='darwin'&&identity?.version==='6.0.43';}
function tabBoxReadback(){
 const bar=document.querySelector('.toolbar'),strip=document.querySelector('#tabstrip'),active=strip.querySelector('.tab-item.active'),nora=document.querySelector('#desktops-button');
 const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const a=rect(active),b=rect(bar),n=rect(nora),style=getComputedStyle(active),rim=getComputedStyle(nora,'::before');
 const probe=document.createElement('i');probe.style.background='var(--panel)';probe.style.color='var(--text)';document.body.append(probe);const expectedFill=getComputedStyle(probe).backgroundColor,expectedInk=getComputedStyle(probe).color;probe.remove();
 return{paintOwner:'tab-box',platform:MouseNative.platform,version:MouseNative.version,platformAttribute:document.documentElement.dataset.platform,paneMode:document.documentElement.dataset.paneMode,
  viewport:innerWidth,tab:active.dataset.tab,bounds:a,barBounds:b,fill:style.backgroundColor,expectedFill,ink:style.color,expectedInk,flowAbsent:!document.querySelector('.mouse-tab-flow'),
  corners:[style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomRightRadius,style.borderBottomLeftRadius].map(parseFloat),
  allTabCorners:[...strip.querySelectorAll('.tab-item')].map(node=>{const s=getComputedStyle(node);return[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(parseFloat);}),
  toolbarBorderWidth:parseFloat(getComputedStyle(bar).borderBottomWidth),rimDisplay:rim.display,rimContent:rim.content,scroll:strip.scrollWidth,client:strip.clientWidth,burrow:[n.width,n.height],plus:document.querySelector('#new-tab .burrow-plus').getBoundingClientRect().width,
  hit:document.elementFromPoint(a.x+a.width/2,a.y+a.height/2)?.closest('.tab-item')===active};
}
function assertTabBox(g){
 assert.ok(usesTabBox(g),'Current Mac643 identity');assert.equal(g.platformAttribute,'darwin');assert.equal(g.paintOwner,'tab-box');assert.equal(g.flowAbsent,true,'The tab itself owns its paint without a second geometry layer');
 assert.equal(g.fill,g.expectedFill,'The selected tab matches the root theme surface, not the separator');assert.equal(g.ink,g.expectedInk,'Selected-tab text retains contrast when the toolbar is customized');
 for(const key of ['x','y','width','height','right','bottom'])assert.ok(Number.isFinite(g.bounds[key])&&Number.isFinite(g.barBounds[key]),'Finite '+key);
 assert.ok(g.bounds.width>0&&g.bounds.height>0);assert.ok(g.bounds.x>=g.barBounds.x-.05&&g.bounds.right<=g.barBounds.right+.05);assert.ok(g.bounds.y>=g.barBounds.y-.05&&g.bounds.bottom<=g.barBounds.bottom+.05);
 assert.ok(['rounded','square'].includes(g.paneMode));assert.ok(g.allTabCorners.length>0);
 for(const radii of g.allTabCorners){assert.equal(radii.length,4);for(const radius of radii){assert.ok(Number.isFinite(radius)&&radius>=0);if(g.paneMode==='square')assert.equal(radius,0,'Every square-mode top tab has square corners');}}
 assert.equal(g.toolbarBorderWidth,0);assert.ok(g.rimDisplay==='none'||g.rimContent==='none','The Nora button has no decorative rim');assert.equal(g.hit,true);assert.ok(g.scroll<=g.client+1);assert.deepEqual(g.burrow,[36,23]);assert.equal(g.plus,14);
}
module.exports=async({win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),before=new Set(browser.state().tabs.map(t=>t.id)),checks=[],identity=await js('({platform:MouseNative.platform,version:MouseNative.version})'),tabBox=usesTabBox(identity);
 const saved=await js('JSON.parse(JSON.stringify({theme:MouseTest.model.theme,slots:MouseTest.model.slots,active:MouseTest.model.active,tree:MouseTest.model.tree,tabOrder:MouseTest.model.tabOrder,aiOpen:MouseTest.model.aiOpen,libraryOpen:MouseTest.model.libraryOpen}))');
 async function activate(id){
  const selector='.tab-item[data-tab="'+id+'"]';
  win.focus();win.webContents.focus();
  const center=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing tab');const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...center});await sleep(90);
  // Compact tabs reveal the existing close button on hover. Click an actually
  // exposed title point, never the covered centre or a programmatic .click().
  const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();for(const x of [r.right-3,r.x+r.width*.75,r.x+r.width/2]){const p={x:Math.round(x),y:Math.round(r.y+r.height/2)},hit=document.elementFromPoint(p.x,p.y);if(hit?.closest('.tab-title')?.closest('.tab-item')===e)return p;}throw Error('No exposed tab-title point '+JSON.stringify({width:r.width,density:document.querySelector('#tabstrip').dataset.density}));})()`);
  console.log('MOUSE_619_TAB_FLOW_CLICK',JSON.stringify({id,...p,...await js('({width:innerWidth,density:document.querySelector("#tabstrip").dataset.density})')}));
  win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});await sleep(35);win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});
  await until(()=>js(`document.querySelector('.tab-item.active')?.dataset.tab===${JSON.stringify(id)}`),'real tab click');await sleep(90);
 }
 async function check(theme){
  if(tabBox){const g=await js('('+tabBoxReadback.toString()+')()');assertTabBox(g);checks.push({theme,...g});return g;}
  const g=await js(`(()=>{const b=document.querySelector('.toolbar'),s=document.querySelector('#tabstrip'),a=s.querySelector('.active'),f=document.querySelector('.mouse-tab-flow'),n=document.querySelector('#desktops-button'),ar=a.getBoundingClientRect(),fr=f.getBoundingClientRect(),nr=n.getBoundingClientRect(),flow=getComputedStyle(f),rim=getComputedStyle(n,'::before'),probe=document.createElement('i');probe.style.color='var(--line)';document.body.append(probe);const expectedFill=getComputedStyle(probe).color;probe.remove();return{viewport:innerWidth,tab:a.dataset.tab,flowTab:f.dataset.tab,bottom:fr.bottom,barBottom:b.getBoundingClientRect().bottom,center:fr.x+fr.width/2,activeCenter:ar.x+ar.width/2,width:fr.width,activeWidth:ar.width,fill:flow.fill,expectedFill,stroke:flow.stroke,toolbarBorderWidth:parseFloat(getComputedStyle(b).borderBottomWidth),rimDisplay:rim.display,rimContent:rim.content,scroll:s.scrollWidth,client:s.clientWidth,pointer:flow.pointerEvents,burrow:[nr.width,nr.height],plus:document.querySelector('#new-tab .burrow-plus').getBoundingClientRect().width,hit:document.elementFromPoint(ar.x+ar.width/2,ar.y+ar.height/2)?.closest('.tab-item')===a}})()`);
  // 628 removes the old divider/rim requirement. The active tab still flows
  // into the toolbar, tracks real selection and leaves every tab clickable.
  assert.ok(Math.abs(g.bottom-g.barBottom)<.05);assert.ok(Math.abs(g.center-g.activeCenter)<.05);assert.ok(g.width>=g.activeWidth&&g.width<=g.activeWidth+20.05);assert.equal(g.flowTab,g.tab);assert.equal(g.fill,g.expectedFill);assert.equal(g.stroke,'none');assert.equal(g.toolbarBorderWidth,0);assert.ok(g.rimDisplay==='none'||g.rimContent==='none','The Nora button has no decorative rim');assert.equal(g.pointer,'none');assert.equal(g.hit,true);assert.ok(g.scroll<=g.client+1);assert.deepEqual(g.burrow,[36,23]);assert.equal(g.plus,14);checks.push({theme,...g});return g;
 }
 try{
  for(let i=0;i<28;i++)await browser.command('open',{url:'mouse://start',lane:'main'});
  await until(()=>js('document.querySelectorAll(".tab-item").length>=28'),'compact tabs');
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);
   for(const width of [800,1100,1440]){
    win.setSize(width,900);await sleep(240);
    const ids=await js('[...document.querySelectorAll(".tab-item")].map(e=>e.dataset.tab)');
    for(const i of [0,Math.floor(ids.length/2),ids.length-1]){await activate(ids[i]);await check(theme);}
   }
  }
  for(const t of browser.state().tabs)if(!before.has(t.id))await browser.command('close',{id:t.id});
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.renderTree()`);await sleep(200);
   const ids=await js('[...document.querySelectorAll(".tab-item")].map(e=>e.dataset.tab)');if(ids.length)await activate(ids[Math.floor(ids.length/2)]);
   console.log('MOUSE_619_TAB_FLOW_THEME',theme,JSON.stringify(await check(theme)));
   const clip=await js('(()=>{const r=document.querySelector(".toolbar").getBoundingClientRect();return{x:0,y:0,width:Math.floor(innerWidth),height:Math.ceil(r.bottom+8)}})()');
   await fs.writeFile('mouse-619-tab-flow-'+theme+'.png',(await win.capturePage(clip)).toPNG());
  }
  await fs.writeFile('mouse-619-tab-flow.json',JSON.stringify({version:'6.0.19',visualVersion:tabBox?'6.0.43':'6.0.28',installedIdentity:identity,activeTabFlow:!tabBox,...(tabBox?{activeTabBox:true,paintOwner:'tab-box'}:{}),nativeSelection:true,decorativeRimAbsent:true,toolbarStrokeAbsent:true,supersededDecorativeRim:true,themes:['light','dark'],checks},null,2)+'\n');
  console.log(tabBox?'MOUSE_643_ACTIVE_TAB_BOX_BOTH_THEMES_PASS':'MOUSE_628_ACTIVE_TAB_FLOW_BORDERLESS_BOTH_THEMES_PASS');
 }finally{
  for(const t of browser.state().tabs)if(!before.has(t.id))await browser.command('close',{id:t.id});
  await js(`MouseTest.returnToGrid();Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);win.setBounds(bounds);
 }
};
module.exports.fixtures={usesTabBox,tabBoxReadback,assertTabBox};
