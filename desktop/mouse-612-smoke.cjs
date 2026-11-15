'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await sleep(50);}throw Error('Mouse612 timeout: '+label);}
module.exports=async({win,browser,app})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const saved=await js('JSON.parse(JSON.stringify({aiId:QuadroTest.model.aiId,aiOpen:QuadroTest.model.aiOpen,aiSites:QuadroTest.model.aiSites,aiSessions:QuadroTest.model.aiSessions,theme:QuadroTest.model.theme,libraryOpen:QuadroTest.model.libraryOpen,active:QuadroTest.model.active}))');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>AI navigation '+req.url+'</title><h1>AI fixture</h1><script>window.marker="keep"</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;let aiId='';
 try{
  await js('QuadroTest.model.aiOpen=true;QuadroTest.model.aiId="";QuadroTest.model.libraryOpen=false;QuadroTest.applySide()');
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}')`);
   const cards=await js(`Promise.all([...document.querySelectorAll('.ai-preset-card')].map(async b=>{const i=b.querySelector('img');await i.decode();return {name:b.textContent,src:i.src,w:i.naturalWidth,h:i.naturalHeight,url:b.dataset.aiUrl}}))`);
   assert.deepEqual(cards.map(c=>c.name),['ChatGPT','Claude','Gemini','DeepSeek']);
   for(const c of cards){assert.ok(c.src.startsWith('file:')&&c.src.includes('/providers/'));assert.ok(c.w>=16&&c.h>=16);}
   const color=await js('(()=>{const c=getComputedStyle(document.querySelector("#ai-toggle"));return[c.color,c.borderTopColor,document.querySelector("#ai-toggle").getAttribute("aria-pressed")]})()');
   assert.equal(color[0],theme==='light'?'rgb(0, 115, 143)':'rgb(83, 217, 255)');assert.equal(color[1],color[0]);assert.equal(color[2],'true');
   assert.equal(await js('document.querySelector("[data-action=ai-back]").disabled'),true);
   await sleep(150);await fs.writeFile('mouse-612-ai-'+theme+'.png',(await win.capturePage()).toPNG());
  }
  const originalCommand=browser.command.bind(browser),clicked=[];
  try{
   browser.command=(action,args={})=>{if(action==='open'&&args.lane==='side'&&/^https:\/\/(chatgpt.com|claude.ai|gemini.google.com|chat.deepseek.com)\/$/.test(args.url)){clicked.push(args.url);return originalCommand(action,{...args,url:root+'/provider/'+clicked.length});}return originalCommand(action,args);};
   for(let i=0;i<4;i++){await js(`document.querySelectorAll('.ai-preset-card')[${i}].click()`);await until(()=>clicked.length===i+1,'preset click');await until(()=>js('!!QuadroTest.model.aiId'),'preset selected');const id=await js('QuadroTest.model.aiId');await until(()=>!browser.get(id).loading,'preset loaded');await originalCommand('close',{id});await js('QuadroTest.model.aiId="";QuadroTest.applySide()');}
   assert.equal(clicked.length,4);
  }finally{browser.command=originalCommand;}
  await js(`QuadroTest.openAI(${JSON.stringify(root+'/first')})`);aiId=await js('QuadroTest.model.aiId');await until(()=>!browser.get(aiId).loading,'first loaded');
  const mainIds=await js('QuadroTest.model.state.tabs.filter(t=>t.lane!=="side").map(t=>t.id)');
  await browser.command('navigate',{id:aiId,url:root+'/second'});await until(()=>!browser.get(aiId).loading&&browser.get(aiId).view.webContents.getURL().endsWith('/second'),'second loaded');
  await until(()=>js('!document.querySelector("[data-action=ai-back]").disabled'),'back enabled');
  await js('document.querySelector("[data-action=ai-back]").click()');await until(()=>browser.get(aiId).view.webContents.getURL().endsWith('/first'),'back exact AI');
  await until(()=>js('!document.querySelector("[data-action=ai-forward]").disabled'),'forward enabled');await js('document.querySelector("[data-action=ai-forward]").click()');await until(()=>browser.get(aiId).view.webContents.getURL().endsWith('/second'),'forward exact AI');
  assert.deepEqual(await js('QuadroTest.model.state.tabs.filter(t=>t.lane!=="side").map(t=>t.id)'),mainIds);
  await js('document.querySelectorAll(".tab-item").forEach((e,i)=>{e.dataset.oldDisplay=e.style.display;e.style.display=i?"none":""})');await sleep(100);
  const gap=await js('(()=>{const a=document.querySelector(".tab-item").getBoundingClientRect(),b=document.querySelector("#new-tab").getBoundingClientRect();return b.left-a.right})()');assert.ok(gap>=0&&gap<=14,'plus must immediately follow last tab: '+gap);
  await js('document.querySelectorAll(".tab-item").forEach(e=>e.style.display=e.dataset.oldDisplay||"")');
  console.log('MOUSE_612_AI_LOGOS_NAV_ACTIVE_AND_ADJACENT_PLUS_PASS');
 }finally{
  if(aiId&&browser.tabs.has(aiId))await browser.command('close',{id:aiId});
  await js(`Object.assign(QuadroTest.model,${JSON.stringify(saved)});QuadroTest.setTheme(${JSON.stringify(saved.theme)});QuadroTest.renderAISites();QuadroTest.renderTree();QuadroTest.applySide();QuadroTest.save()`);
  server.close();
 }
 const {BrowserWindow,session}=require('electron'),{MemoryStore}=require('./mouse-private-core.cjs'),{installWorkspace,installShellRecovery}=require('./mouse-stability.cjs');
 const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}}),mem=new MemoryStore({});
 const b=new (require('./browser.cjs').BrowserWorkspace)(w,mem,{session:session.fromPartition('mouse612-smoke-'+Date.now(),{cache:false}),privateMode:true});installWorkspace(b);
 const shell='data:text/html,<title>Mouse stability fixture</title>';let recovered=false;
 installShellRecovery({win:w,entry:shell,current:()=>({browser:b}),isClosing:()=>false,report:m=>{if(m==='SHELL_RECOVERY_LOADED')recovered=true;}});
 try{
  await w.loadURL(shell);b.project='safety';
  for(let i=0;i<12;i++){const t=b.make('https://example.invalid/',b.project);t.view.webContents.close({waitForBeforeUnload:false});await until(()=>!b.tabs.has(t.id),'closed guest removed');assert.doesNotThrow(()=>b.state());await b.save();b.layout([]);}
  w.webContents.forcefullyCrashRenderer();await until(()=>recovered,'host recovers');assert.equal(w.isDestroyed(),false);assert.ok(await w.webContents.executeJavaScript('document.title==="Mouse stability fixture"'));
  for(let i=0;i<4;i++)b.make('https://example.invalid/',b.project);b.dispose();assert.equal(b.tabs.size,0);assert.equal(b.providers.size,0);assert.doesNotThrow(()=>b.state());
  console.log('MOUSE_612_DESTROYED_GUESTS_DISPOSE_AND_SHELL_RECOVERY_PASS');
 }finally{b.dispose();w.destroy();mem.destroy();}
};
