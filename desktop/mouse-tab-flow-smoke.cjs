'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){for(let n=0;n<120;n++){if(await f())return;await sleep(50);}throw Error('Tab-flow timeout: '+label);}
module.exports=async({win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),before=new Set(browser.tabs.keys());
 const saved=await js('JSON.parse(JSON.stringify({theme:MouseTest.model.theme,slots:MouseTest.model.slots,active:MouseTest.model.active,tree:MouseTest.model.tree,aiOpen:MouseTest.model.aiOpen,libraryOpen:MouseTest.model.libraryOpen}))');
 async function activate(id){
  const selector='.tab-item[data-tab="'+id+'"] .tab-title';
  const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});
  await until(()=>js(`document.querySelector('.tab-item.active')?.dataset.tab===${JSON.stringify(id)}`),'real tab click');await sleep(90);
 }
 async function check(){
  const g=await js(`(()=>{const b=document.querySelector('.toolbar'),s=document.querySelector('#tabstrip'),a=s.querySelector('.active'),f=document.querySelector('.mouse-tab-flow'),n=document.querySelector('#new-tab'),ar=a.getBoundingClientRect(),fr=f.getBoundingClientRect(),nr=n.getBoundingClientRect();return{bottom:fr.bottom,barBottom:b.getBoundingClientRect().bottom,center:fr.x+fr.width/2,activeCenter:ar.x+ar.width/2,width:fr.width,activeWidth:ar.width,fill:getComputedStyle(f).fill,line:getComputedStyle(b).borderBottomColor,rim:getComputedStyle(n,'::before').backgroundColor,mask:getComputedStyle(n,'::before').maskImage,scroll:s.scrollWidth,client:s.clientWidth,pointer:getComputedStyle(f).pointerEvents,burrow:[nr.width,nr.height],plus: n.querySelector('.burrow-plus').getBoundingClientRect().width,hit:document.elementFromPoint(ar.x+ar.width/2,ar.y+ar.height/2)?.closest('.tab-item')===a}})()`);
  assert.ok(Math.abs(g.bottom-g.barBottom)<.05);assert.ok(Math.abs(g.center-g.activeCenter)<.05);assert.ok(g.width>=g.activeWidth&&g.width<=g.activeWidth+20.05);assert.equal(g.fill,g.line);assert.equal(g.rim,g.line);assert.match(g.mask,/burrow-rim.svg/);assert.equal(g.pointer,'none');assert.equal(g.hit,true);assert.ok(g.scroll<=g.client+1);assert.deepEqual(g.burrow,[36,29]);assert.equal(g.plus,12);return g;
 }
 try{
  for(let i=0;i<28;i++)await browser.command('open',{url:'mouse://start',lane:'main'});
  await until(()=>js('document.querySelectorAll(".tab-item").length>=28'),'compact tabs');
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);
   for(const width of [800,1100,1440]){
    win.setSize(width,900);await sleep(240);
    const ids=await js('[...document.querySelectorAll(".tab-item")].map(e=>e.dataset.tab)');
    for(const i of [0,Math.floor(ids.length/2),ids.length-1]){await activate(ids[i]);await check();}
   }
  }
  for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.renderTabs()`);await sleep(200);
   const ids=await js('[...document.querySelectorAll(".tab-item")].map(e=>e.dataset.tab)');if(ids.length)await activate(ids[Math.floor(ids.length/2)]);
   console.log('MOUSE_619_TAB_FLOW_THEME',theme,JSON.stringify(await check()));
   const clip=await js('(()=>{const r=document.querySelector(".toolbar").getBoundingClientRect();return{x:0,y:0,width:Math.floor(innerWidth),height:Math.ceil(r.bottom+8)}})()');
   await fs.writeFile('mouse-619-tab-flow-'+theme+'.png',(await win.capturePage(clip)).toPNG());
  }
  console.log('MOUSE_619_ACTIVE_TAB_FLOW_MATCHED_RIM_BOTH_THEMES_PASS');
 }finally{
  for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});
  await js(`Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);win.setBounds(bounds);
 }
};
