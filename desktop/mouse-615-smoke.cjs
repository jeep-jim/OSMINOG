'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){for(let i=0;i<120;i++){if(await f())return;await sleep(50);}throw Error('Mouse615 timeout: '+label);}
module.exports=async({win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),theme=await js('MouseTest.model.theme'),beforeIds=new Set(browser.state().tabs.map(t=>t.id));
 const point=selector=>js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 const move=async selector=>{const p=await point(selector);win.webContents.sendInputEvent({type:'mouseMove',...p});await sleep(180);return p;};
 const click=async selector=>{const p=await move(selector);win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});};
 try{
  win.show();win.focus();win.setSize(1440,960);await sleep(200);
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);await move('#version-button');
   const look=await js(`(()=>{const b=document.querySelector('#new-tab'),c=getComputedStyle(b),m=b.querySelector('.burrow-mouse'),r=b.getBoundingClientRect();return{r:[r.width,r.height],round:c.borderTopLeftRadius,bottomRound:c.borderBottomLeftRadius,borderBottom:c.borderBottomWidth,shadow:c.boxShadow,opacity:getComputedStyle(m).opacity,label:b.getAttribute('aria-label'),children:b.children.length}})()`);
   assert.deepEqual(look.r,[28,30]);assert.equal(look.round,'14px');assert.equal(look.bottomRound,'0px');assert.equal(look.borderBottom,'0px');assert.equal(look.shadow,'none');assert.equal(look.opacity,'1');assert.equal(look.label,'Новая вкладка');assert.equal(look.children,1);
   await fs.writeFile('mouse-615-burrow-'+theme+'.png',(await win.capturePage()).toPNG());
   await move('#new-tab');assert.equal(await js('getComputedStyle(document.querySelector(".burrow-mouse")).opacity'),'0');assert.equal(await js('getComputedStyle(document.querySelector("#new-tab")).boxShadow'),'none');
   await fs.writeFile('mouse-615-burrow-hover-'+theme+'.png',(await win.capturePage()).toPNG());
   await move('#version-button');assert.equal(await js('getComputedStyle(document.querySelector(".burrow-mouse")).opacity'),'1');
   for(const width of [800,1100,1440]){
    win.setSize(width,900);await sleep(180);
    const g=await js(`(()=>{const lib=document.querySelector('#footer-library'),r=lib.getBoundingClientRect(),a=document.querySelector('#ai-toggle').getBoundingClientRect(),left=document.querySelector('#footer-left').getBoundingClientRect(),buttons=[...lib.querySelectorAll('button')],footer=document.querySelector('#statusbar');return{count:buttons.length,actions:buttons.map(b=>b.dataset.action),gap:a.left-r.right,space:r.left-left.right,right:document.querySelector('[data-action=quit]').getBoundingClientRect().right,width:innerWidth,overflow:footer.scrollWidth-footer.clientWidth,duplicate:['history-button','downloads-button'].some(id=>document.querySelectorAll('#'+id).length!==1)}})()`);
    assert.equal(g.count,3);assert.deepEqual(g.actions,['history','bookmarks','downloads']);assert.equal(g.duplicate,false);assert.ok(g.space>=0,'groups may not overlap: '+JSON.stringify(g));assert.ok(g.gap>=12,'library needs its own space');assert.ok(g.right<=g.width+1);assert.ok(g.overflow<=1,'footer must fit: '+JSON.stringify(g));if(width===1440)assert.ok(g.gap>=110,'owner requested leftward separation');
   }
   for(const action of ['history','bookmarks','downloads']){
    await click('#footer-library [data-action="'+action+'"]');
    await until(()=>js(`document.querySelector('#library-dialog').open&&document.querySelector('[data-library="${action}"]').getAttribute('aria-pressed')==='true'`),'original '+action+' action');
    await click('#library-close');await until(()=>js('!document.querySelector("#library-dialog").open'),'library close');
   }
  }
  const count=await js('MouseTest.model.state.tabs.length');await click('#new-tab');await until(()=>js('MouseTest.model.state.tabs.length').then(n=>n===count+1),'burrow real pointer creates tab');
  assert.equal(await js('MouseTest.model.state.tabs.find(t=>t.id===MouseTest.model.slots[MouseTest.model.active]).internal'),true);
  console.log('MOUSE_615_ARCH_BUTTON_HOVER_AND_SEPARATE_FOOTER_BOTH_THEMES_PASS');
 }finally{
  await js('MouseTest.browsing.close()').catch(()=>{});
  for(const t of browser.state().tabs)if(!beforeIds.has(t.id))await browser.command('close',{id:t.id});
  await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);win.setBounds(bounds);
 }
};
