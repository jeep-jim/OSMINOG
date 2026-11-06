'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[ext]||'application/octet-stream');res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser,page;const errors=[],passed=[];
 const check=name=>{passed.push(name);console.log('PASS '+name)};
 try{
  fs.mkdirSync('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});await page.route('https://**',route=>route.abort());
  await page.addInitScript(()=>{if(window!==window.top)return;const store={},listeners=[],event={addListener(){},removeListener(){}};window.__store=store;
   window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.23'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:structuredClone(store[keys])}:{...structuredClone(store)};cb?.(v);return Promise.resolve(v)},set:(values,cb)=>{const changes={};for(const [key,value] of Object.entries(values)){if(JSON.stringify(value)!==JSON.stringify(store[key]))changes[key]={oldValue:structuredClone(store[key]),newValue:structuredClone(value)};store[key]=structuredClone(value)}cb?.();if(Object.keys(changes).length)queueMicrotask(()=>listeners.forEach(fn=>fn(changes,'local')));return Promise.resolve()},remove:async key=>{delete store[key]}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>{window.__opened=x.url;return{id:2,...x}}},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}};
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
  await page.waitForFunction(()=>!!window.OSMINOGWorkdesk&&!!window.OSMINOGWorkspacePolish&&!!window.OSMINOGWindowsFolders);
  const ids=await page.evaluate(async()=>{
   await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();
   state.language='ru';state.theme='light';applyTheme();const p=project();p.name='Клиентские материалы';p.objects=[];p.osminogFolders=[];p.groups=[];state.selected=[];state.ui.layersTab='layers';
   const inbox=OSMINOGWindowsFolders.create({name:'Входящие',rename:false}),shots=OSMINOGWindowsFolders.create({name:'Скриншоты',rename:false});inbox.screenX=360;inbox.screenY=320;shots.screenX=520;shots.screenY=320;shots.desktopSize='small';
   OSMINOGWindowsFolders.create({name:'Документы клиента',parentId:inbox.id,desktopVisible:false,rename:false});
   const text=createObject('text',{name:'Заметка',text:'Встреча с клиентом',x:150,y:120,w:360,h:160});
   const brief=createObject('brief',{name:'Сохранённый текст',text:'Проверка материала из папки',x:20,y:20,w:300,h:150});brief.osminogFolderId=inbox.id;inbox.members.push(brief.id);
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;canvas.getContext('2d').fillRect(0,0,64,48);const src=canvas.toDataURL();
   const image=createObject('image',{name:'Скриншот',src,x:600,y:140,w:300,h:220});image.osminogFolderId=shots.id;shots.members.push(image.id);
   let h=2166136261;for(let i=0;i<src.length;i++)h=Math.imul(h^src.charCodeAt(i),16777619);image.searchIndex={signature:src.length+':'+(h>>>0)+':0',text:'',at:Date.now()};
   const file=createObject('file',{name:'Памятка.txt',fileName:'Памятка.txt',mime:'text/plain',src:'data:text/plain;base64,dGVzdA==',x:10,y:20,w:200,h:100});file.osminogFolderId=inbox.id;inbox.members.push(file.id);
   const audio=createObject('file',{name:'Запись.wav',fileName:'Запись.wav',mime:'audio/wav',src:'data:audio/wav;base64,',x:10,y:20,w:200,h:100});audio.osminogFolderId=shots.id;shots.members.push(audio.id);
   await chrome.storage.local.set({osminogCollectorV1:{projectId:p.id,folderId:shots.id,enabled:false}});state.selected=[];renderAll(true);OSMINOGWindowsFolders.refresh();
   return{inbox:inbox.id,shots:shots.id,text:text.id,brief:brief.id,image:image.id,file:file.id,audio:audio.id};
  });
  await page.waitForFunction(id=>OSMINOGLibrary.destination().folderId===id,ids.shots);
  for(const selector of ['#workspaceBrowserMode','[data-mode="browser"]','[data-tool="browser"]','#libraryCalendar'])assert.equal(await page.locator(selector).count(),0,selector);
  assert.equal(await page.evaluate(()=>typeof OSMINOGBrowserApp?.open),'function');
  assert.equal(await page.locator('script[src="osminog-browser-app.js"]').count(),1);check('restored BrowserApp loads once; retired canvas browser mode and redundant calendar remain absent');
  // A fresh workspace starts with Layers closed. Exercise its actual UI opener.
  await page.locator('#layersToggle').click();await page.waitForSelector('#layersPanel.open');
  await page.waitForSelector(`[data-stored-id="${ids.brief}"]`);assert.equal(await page.locator('#layerList .cl-stored').count(),4);
  await page.locator('#layerSearch').fill('Встреча');assert.equal(await page.locator('#layerList .clean-layer[data-id]').count(),1);await page.locator('#layerSearch').fill('');check('canvas text content and folder-stored text/files appear in Layers without moving objects');
  await page.locator('#layersPanel .panel-tabs button').nth(2).click();assert.equal(await page.locator('.bc-folder-row').count(),3);
  const rect=await page.locator('.bc-folder-row').first().boundingBox();assert(rect.width>160&&rect.height>=60,JSON.stringify(rect));
  await page.waitForSelector('.bc-folder-row[data-capture="true"]');
  await page.screenshot({path:'artifacts/workspace-423-folders-light.png'});check('styled folder hierarchy and configured capture destination');
  const counter=`.osminog-win-folder-icon[data-win-folder-id="${ids.shots}"]>small`;
  await page.waitForFunction(id=>document.querySelector(`.osminog-win-folder-icon[data-win-folder-id="${id}"]>small`)?.textContent==='2',ids.shots);
  assert(await page.locator(counter).isVisible());assert.equal(await page.locator(counter).evaluate(el=>getComputedStyle(el).display),'block');check('small desktop folder icon has visible source-of-truth count');
  await page.locator('#librarySearch').click();
  const edge=await page.evaluate(()=>({header:document.querySelector('#app .topbar').getBoundingClientRect().bottom,search:document.querySelector('#osminogLibrary').getBoundingClientRect().top}));assert(Math.abs(edge.header-edge.search)<2,JSON.stringify(edge));
  assert.equal(await page.locator('#osminogLibrary>header [data-delete-selected]').count(),1);
  await page.locator('[data-kind]').selectOption('text');assert.equal(await page.locator('.lib-card').count(),3);
  await page.locator('[data-kind]').selectOption('media');assert.equal(await page.locator('.lib-card').count(),2);
  await page.locator('[data-kind]').selectOption('file');assert.equal(await page.locator('.lib-card').count(),0);
  await page.locator('[data-kind]').selectOption('media');await page.locator('[data-select-all]').check();assert(await page.locator('[data-delete-selected]').isEnabled());
  await page.screenshot({path:'artifacts/workspace-423-search-light.png'});check('header-aligned search, header deletion and text/media/file filtering');
  await page.locator('[data-delete-selected]').click();await page.locator('.workdeskConfirm [data-confirm-cancel]').click();assert.equal(await page.locator('.lib-card').count(),2);
  await page.locator('[data-delete-selected]').click();await page.locator('.workdeskConfirm [data-confirm-cancel]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.lib-card').length===0);
  await page.waitForFunction(id=>document.querySelector(`.osminog-win-folder-icon[data-win-folder-id="${id}"]>small`)?.textContent==='0',ids.shots);
  await page.locator('#osminogLibrary [data-close]').click();await page.evaluate(()=>document.querySelector('#undo').click());
  await page.waitForFunction(id=>document.querySelector(`.osminog-win-folder-icon[data-win-folder-id="${id}"]>small`)?.textContent==='2',ids.shots);check('cancel, keyboard-confirmed bulk deletion, Undo and live folder counters');
  await page.locator('#layersPanel .panel-tabs button').first().click();await page.locator(`[data-stored-id="${ids.brief}"]`).click();await page.waitForSelector('#workdeskViewer[open]');
  assert.equal(await page.locator('#workdeskText').inputValue(),'Проверка материала из папки');
  const modal=await page.locator('#workdeskViewer').boundingBox();assert(modal.x>50&&Math.abs(modal.x+modal.width/2-720)<3,JSON.stringify(modal));
  assert.equal(await page.evaluate(id=>objects().find(o=>o.id===id).osminogFolderId,ids.brief),ids.inbox);
  await page.screenshot({path:'artifacts/workspace-423-note-centered.png'});await page.locator('#workdeskClose').click();
  await page.evaluate(id=>OSMINOGWindowsFolders.openObject(id),ids.image);await page.waitForSelector('#workdeskViewer[open]');assert(await page.locator('#workdeskEditImage').isVisible());await page.locator('#workdeskClose').click();
  await page.evaluate(id=>OSMINOGWindowsFolders.openObject(id),ids.file);await page.waitForSelector('#osminogDocumentEditor');const doc=await page.locator('#osminogDocumentEditor').boundingBox();assert(Math.abs(doc.x+doc.width/2-720)<3,JSON.stringify(doc));await page.locator('[data-doc-close]').click();check('folder notes, images and files open centered and keep folder membership');
  const legacy=await page.evaluate(()=>{const o=createObject('browser',{name:'Сохранённая ссылка',url:'https://example.com/material',x:400,y:500,w:350,h:180});renderAll(true);return o.id});
  assert.equal(await page.locator(`.canvas-object[data-id="${legacy}"] iframe`).count(),0);await page.locator(`.canvas-object[data-id="${legacy}"] [data-open-saved-link]`).click();assert.equal(await page.evaluate(()=>window.__opened),'https://example.com/material');
  assert.equal(await page.evaluate(async()=>{try{await OSMINOGWorkspacePolish.openExternal('javascript:alert(1)');return false}catch{return true}}),true);check('legacy browser data becomes a safe external link, never an embedded browser');
  // Read computed colors after both themes: an old browser object's white fill
  // must not leave the retained link text white-on-white in the dark workspace.
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{state.theme=theme;applyTheme()},theme);
   const colors=await page.locator(`.canvas-object[data-id="${legacy}"] .desk-link-card`).evaluate(el=>{
    const c=getComputedStyle(el),title=getComputedStyle(el.querySelector('strong')),url=getComputedStyle(el.querySelector('span'));
    return{background:c.backgroundColor,title:title.color,url:url.color};
   });
   const luminance=value=>{const numbers=value.match(/[\d.]+/g).map(Number);assert(numbers.length>=3,'Expected opaque RGB color: '+value);if(numbers.length>3)assert.equal(numbers[3],1,'Expected opaque background/text');return numbers.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)};
   const bg=luminance(colors.background);for(const name of ['title','url']){const fg=luminance(colors[name]);assert((Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)>=4.5,theme+' link contrast '+JSON.stringify(colors))}
  }
  check('retained external links have readable text and URL contrast in light and dark themes');
  await page.evaluate(()=>{state.theme='dark';applyTheme();const g=document.createElement('div');g.className='ai-canvas-ghost active';g.id='workspace-test-eye';g.style.cssText='opacity:1;visibility:visible;transform:translate3d(900px,600px,0);';g.innerHTML='<div class="ai-ghost-wisp"><i></i><i></i><b></b></div><small>Готовлю ответ</small>';document.body.append(g);OSMINOGWorkspacePolish.pointEye(g,100,100);OSMINOGWorkspacePolish.pointEye(g,140,112)});
  assert.equal(await page.locator('#workspace-test-eye').evaluate(el=>el.style.getPropertyValue('--eye-x')),'7px');
  assert.equal(await page.locator('#workspace-test-eye .ai-ghost-wisp b').evaluate(el=>getComputedStyle(el).display),'none');
  await page.locator('#librarySearch').click();await page.screenshot({path:'artifacts/workspace-423-search-dark-eye.png'});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#workspace-test-eye .ai-ghost-wisp').evaluate(el=>getComputedStyle(el).animationName),'none');check('red lens, directional gaze, no tentacles and reduced-motion preference');
  await page.setViewportSize({width:480,height:900});await page.waitForTimeout(100);const mobile=await page.locator('#osminogLibrary').boundingBox();assert(mobile.x>=-1&&mobile.x+mobile.width<=481,JSON.stringify(mobile));await page.screenshot({path:'artifacts/workspace-423-search-mobile.png'});check('search fits narrow viewport');
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/workspace-423-results.json',JSON.stringify({passed,errors},null,2));
 }catch(error){if(page)await page.screenshot({path:'artifacts/workspace-423-failure.png'}).catch(()=>{});throw error}
 finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
