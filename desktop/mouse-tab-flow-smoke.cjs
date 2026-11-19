'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){for(let n=0;n<120;n++){if(await f())return;await sleep(50);}throw Error('Tab-flow timeout: '+label);}
module.exports=async({win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),before=new Set(browser.state().tabs.map(t=>t.id)),checks=[];
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
  await fs.writeFile('mouse-619-tab-flow.json',JSON.stringify({version:'6.0.19',visualVersion:'6.0.28',activeTabFlow:true,nativeSelection:true,decorativeRimAbsent:true,toolbarStrokeAbsent:true,supersededDecorativeRim:true,themes:['light','dark'],checks},null,2)+'\n');
  console.log('MOUSE_628_ACTIVE_TAB_FLOW_BORDERLESS_BOTH_THEMES_PASS');
 }finally{
  for(const t of browser.state().tabs)if(!before.has(t.id))await browser.command('close',{id:t.id});
  await js(`Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);win.setBounds(bounds);
 }
};
