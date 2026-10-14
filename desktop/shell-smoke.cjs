'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async(win,browser)=>{
 await browser.session.protocol.handle('https',()=>new Response('<html><link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="><title>Native shell fixture</title><body><h1>Native page fixture</h1><p>Stable page for layout checks.</p></body></html>',{headers:{'Content-Type':'text/html'}}));
 const run=code=>win.webContents.executeJavaScript(code),frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 await run('OSMINOGStateReady');await run('(async()=>{createProject();await OSMINOGNativeBrowser.open();const p=viewportCenter();OSMINOGEditorAPI.create("text",{name:"Shell test",text:"Рабочий стол нового браузера",x:p.x-110,y:p.y-45,w:220,h:90,fill:"#96a3bc",fontSize:18})})()');await frame();
 assert.equal(await run("document.querySelectorAll('.native-cell').length"),4);assert.equal(await run("!!document.querySelector('.native-canvas #viewport')"),true);
 await run("OSMINOGNativeBrowser.open('https://example.com/')");await frame();const id=browser.state().tabs[0].id;assert.equal(browser.get(id).lane,'main');assert.equal(await run(`OSMINOGNativeBrowser.state().slots.filter(x=>x===${JSON.stringify(id)}).length`),1);
 await run("OSMINOGNativeBrowser.open('https://example.org/','side')");await frame();assert.equal(browser.state().tabs.filter(t=>t.lane==='side').length,1);
 assert.equal(await run("document.querySelectorAll('.native-tabs .native-tab').length"),2);assert.equal(await run("document.querySelectorAll('.native-ai-tabs .native-tab').length"),1);
 // Compact pane controls and 3-area geometry are real DOM, not screenshots.
 await run('OSMINOGNativeBrowser.split(3)');await frame();assert.equal(await run("document.querySelectorAll('.native-cell').length"),3);
 assert.equal(await run("(()=>{const c=[...document.querySelectorAll('.native-cell')].map(e=>e.getBoundingClientRect());return c[0].height>c[1].height&&Math.abs(c[1].x-c[2].x)<2&&c[2].y>c[1].y})()"),true);
 assert.equal(await run("document.querySelector('.native-nav').hidden"),true);
 assert.equal(await run("document.querySelectorAll('.native-pane-nav input').length"),1);
 await run('OSMINOGNativeBrowser.split(4)');await frame();
 // Metadata storms preserve DOM identity, cursor, draft and the canvas parent.
 await run(`(()=>{globalThis.savedPaneInput=document.querySelector('.native-pane-nav input');globalThis.savedCanvasParent=document.querySelector('#viewport').parentElement;savedPaneInput.focus();savedPaneInput.value='https://draft.invalid/keep';savedPaneInput.setSelectionRange(8,13)})()`);
 for(let i=0;i<100;i++){browser.get(id).title='Background title '+i;browser.emit()}
 await frame();
 assert.equal(await run("document.querySelector('.native-pane-nav input')===savedPaneInput"),true);
 assert.equal(await run("document.querySelector('#viewport').parentElement===savedCanvasParent"),true);
 assert.equal(await run("savedPaneInput.value"),'https://draft.invalid/keep');
 assert.equal(await run("savedPaneInput.selectionStart"),8);
 console.log('SHELL_INCREMENTAL_METADATA_PASS');

 const wc=browser.get(id).view.webContents;if(wc.isLoadingMainFrame())await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture page load timeout')),30000);wc.once('did-stop-loading',()=>{clearTimeout(timer);resolve()})});
 // Real favicon events update the existing rail item without rebuilding it.
 browser.get(id).view.webContents.emit('page-favicon-updated',{},['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=']);await frame();
 for(let i=0;i<60&&!(await run("document.querySelector('.native-tabs .native-tab-mark img')"+'!==null'));i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(await run("document.querySelector('.native-tabs .native-tab-mark img')?.getAttribute('src')"),'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=');
 // Palette is separate for each theme and persisted through the native store.
 await run("document.querySelector('#native-browser [data-do=palette]').click()");await frame();assert.equal(browser.panels.length,0);
 await run("document.querySelector('[data-appearance-theme=dark]').click()");await frame();
 await run("(()=>{const input=document.querySelector('[data-color=accent]');input.value='#72aaff';input.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await new Promise(r=>setTimeout(r,250));assert.equal((await browser.store.get('browserAppearance')).browserAppearance.dark.accent,'#72aaff');
 assert.equal(await run("document.querySelector('#native-browser').style.getPropertyValue('--accent')"),'#72aaff');
 await run("document.querySelector('[data-appearance-theme=light]').click()");await frame();
 assert.notEqual(await run("document.querySelector('#native-browser').style.getPropertyValue('--accent')"),'#72aaff');
 await run("document.querySelector('[data-appearance-theme=dark]').click()");await frame();
 assert.equal(await run("document.querySelector('#native-browser').style.getPropertyValue('--accent')"),'#72aaff');
 await fs.writeFile('shell-smoke-palette.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('[data-do=palette-reset]').click();document.querySelector('.native-palette [data-do=dismiss]').click()");await frame();
 console.log('SHELL_PALETTE_AND_FAVICON_PASS');
 await run("document.querySelector('#native-browser [data-do=updates]').click()");await frame();
 assert.equal(await run("document.querySelector('.native-update').hidden"),false);
 assert.equal(await run("document.querySelector('.native-release-notes').textContent.includes('Новое в 0.3.7')"),true);
 assert.equal(await run("document.querySelector('.native-update').getBoundingClientRect().height < innerHeight-20"),true);
 await fs.writeFile('shell-smoke-updates.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('.native-update [data-do=dismiss]').click()");await frame();

 // All three themes use the existing persisted editor setting.
 for(const theme of ['dark','ocean','light']){await run(`(async()=>{state.theme=${JSON.stringify(theme)};applyTheme();await persist()})()`);await frame();const sources=await require('electron').desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1440,height:960}});const source=sources.find(s=>s.id===win.getMediaSourceId());if(!source||source.thumbnail.isEmpty())throw Error('Composed screenshot missing');await fs.writeFile(`shell-smoke-${theme}.png`,source.thumbnail.toPNG())}
 await run("document.querySelector('#native-browser [data-do=theme]').click()");await frame();assert.equal(await run('state.theme'),'dark');
 await run("OSMINOGNativeBrowser.canvas()");await frame();assert.equal(await run("document.querySelectorAll('.native-cell').length"),1);
 await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await frame();assert.equal(await run("document.querySelectorAll('.native-cell').length"),4);
 await run("document.querySelector('#native-browser [data-do=files]').click()");await frame();assert.equal(await run("!!document.querySelector('.native-layers #layersPanel')"),true);
 assert.equal(await run("state.ui.layersTab"),'files');await fs.writeFile('shell-smoke-files.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('#layersCollapse').click()");await frame();assert.equal(await run("document.querySelector('.native-layers').classList.contains('is-collapsed')"),true);
 await run("document.querySelector('#native-browser [data-do=files]').click()");
 await run("document.querySelector('#native-browser [data-do=chat]').click()");await frame();assert.equal(await run("document.querySelector('.native-chat').hidden"),false);
 await run('OSMINOGNativeBrowser.canvas()');await frame();assert.equal(await run("document.querySelectorAll('#native-browser #viewport').length"),1);assert.equal(await run("document.querySelectorAll('#viewport').length"),1);
 await run('OSMINOGNativeBrowser.open();OSMINOGNativeBrowser.split(4)');await frame();assert.equal(await run("!!document.querySelector('.native-canvas #viewport')"),true);
 win.setSize(900,650);await frame();await fs.writeFile('shell-smoke-compact.png',(await win.webContents.capturePage()).toPNG());assert.equal(await run("(()=>{const r=document.querySelector('#native-browser').getBoundingClientRect();return [...document.querySelectorAll('.native-scroll,.native-ai')].some(e=>{const b=e.getBoundingClientRect();return b.right>r.right+1||b.bottom>r.bottom+1})})()"),false);
 await browser.save();const saved=(await browser.store.get('browserSessions')).browserSessions;assert.equal(saved[browser.project].length,2);assert.equal(saved[browser.project][1].lane,'side');
 browser.session.protocol.unhandle('https');
 // Test the actual sandboxed preload and IPC on local responses at provider origins.
 // No external account, live AI request or production bypass is involved.
 await browser.session.protocol.handle('https',()=>new Response(`<html><body><main><h1>Fresh native connector fixture</h1><form onsubmit="return false"><input type="file" accept=".txt,.png" multiple onchange="window.contextFile=this.files[0];for(const f of this.files){const s=document.createElement('span');s.textContent=f.name;document.querySelector('form').append(s)}"><textarea style="width:400px;height:100px;position:fixed;bottom:80px" aria-label="Message"></textarea><button type="button" aria-label="Send" style="position:fixed;bottom:30px;width:32px;height:32px" onclick="window.sent=document.querySelector('textarea').value">Go</button></form></main></body></html>`,{headers:{'Content-Type':'text/html'}}));
 try{
  await run("OSMINOGNativeBrowser.open('https://chatgpt.com/osminog-local-fixture','side')");await frame();
  const t=browser.state().tabs.find(t=>t.url==='https://chatgpt.com/osminog-local-fixture'),wc=browser.get(t.id).view.webContents;
  if(wc.isLoading())await new Promise(r=>wc.once('did-finish-load',r));
  await browser.command('context-scope',{ids:['@canvas']});await browser.command('context-enable',{id:t.id,enabled:true});await frame();
  assert.equal(await run(`OSMINOGNativeBrowser.state().side`),t.id);
  await wc.executeJavaScript(`document.querySelector('textarea').value='Native user prompt';document.querySelector('textarea').focus()`);win.focus();wc.focus();
  const point=await wc.executeJavaScript("(()=>{const r=document.querySelector('button').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
  wc.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
  let sent='';for(let i=0;i<240&&!sent;i++){await new Promise(r=>setTimeout(r,50));sent=await wc.executeJavaScript('window.sent||""')}
  if(!sent)console.log('CONTEXT_FAILURE',await wc.executeJavaScript("JSON.stringify({url:location.href,draft:document.querySelector('textarea')?.value,notice:document.getElementById('osminog-context-status')?.textContent,focus:document.hasFocus()})"));
  assert.equal(sent,'Native user prompt');assert.match(await wc.executeJavaScript('window.contextFile.text()'),/Рабочий стол нового браузера/);
  assert.equal(await wc.executeJavaScript('typeof window.OSMINOGNative'), 'undefined');
  await browser.command('context-enable',{id:t.id,enabled:false});
  console.log('ORIGINAL_CONTEXT_NATIVE_SMOKE_PASS');
 }finally{browser.session.protocol.unhandle('https')}

 // Original submenus remain functional in the header; documents are editable and persisted.
 await run("document.querySelector('[data-tool-native=text]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");await frame();
 assert.equal(await run("document.querySelector('#deskMore').hidden"),false);
 assert.equal(await run("document.querySelector('#deskMore').parentElement.id"),'native-browser');
 assert.equal(browser.panels.length,0);
 const toolRect=await run("(()=>{const r=document.querySelector('[data-tool-native=text]').getBoundingClientRect(),m=document.querySelector('#deskMore').getBoundingClientRect();return{bottom:r.bottom,top:m.top}})()");assert.ok(toolRect.top>=toolRect.bottom);
 const beforeDocs=await run('objects().length');
 await run("document.querySelector('#deskMore [data-desk=markdown]').click()");await frame();
 assert.equal(await run('objects().length'),beforeDocs+1);assert.equal(await run("document.querySelector('#workdeskViewer').open"),true);
 await run("document.querySelector('#workdeskText').value='Native Markdown content';document.querySelector('#workdeskText').dispatchEvent(new Event('input',{bubbles:true}));OSMINOGWorkdesk.close()");await frame();
 assert.equal(await run("objects().some(o=>o.text==='Native Markdown content'&&o.noteFormat==='markdown')"),true);
 const pointCreate=await run("(()=>{const r=document.querySelector('.native-canvas #viewport').getBoundingClientRect();return{x:Math.round(r.x+20),y:Math.round(r.y+20)}})()");
 win.webContents.sendInputEvent({type:'mouseDown',...pointCreate,button:'right',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...pointCreate,button:'right',clickCount:1});await new Promise(r=>setTimeout(r,160));await frame();
 assert.equal(await run("document.querySelector('.native-create-menu').hidden"),false);
 await run("document.querySelector('[data-native-create=note]').click()");await frame();
 assert.equal(await run('objects().length'),beforeDocs+2);assert.equal(await run("document.querySelector('#workdeskViewer').open"),true);
 await run("OSMINOGWorkdesk.close()");await frame();
 assert.equal(await run("document.querySelectorAll('.native-tile > .native-tool-rail').length"),0);
 console.log('HEADER_TOOL_MENUS_AND_RIGHT_CLICK_DOCUMENTS_PASS');
 const previous=browser.project;
 await run("document.querySelector('#native-browser [data-do=home]').click()");await frame();assert.equal(await run("document.querySelector('#native-browser').hidden"),true);
 await run(`openProject(${JSON.stringify(previous)})`);await frame();await frame();assert.equal(await run("document.querySelector('#native-browser').hidden"),false);
 await run("(()=>{document.querySelector('[data-do=new-desktop]').click();document.querySelector('.native-desktop-dialog form').requestSubmit();createObject('text',{name:'Second desktop',text:'Only N2'});})()");await frame();
 assert.equal(await run("project().desktops.length"),2);
 assert.equal(await run("desktopObjects().some(o=>o.name==='Shell test')"),false);
 assert.equal(await run("markdownExport({all:true}).includes('Рабочий стол нового браузера')&&markdownExport({all:true}).includes('Only N2')"),true);
 await run("OSMINOGNativeBrowser.switchDesktop('main')");await frame();
 assert.equal(await run("desktopObjects().some(o=>o.name==='Shell test')"),true);
 assert.equal(await run("desktopObjects().some(o=>o.name==='Second desktop')"),false);
 assert.equal(await run("!!document.querySelector('.native-ai-footer [data-do=stop-ai]')"),true);
 console.log('DESKTOP_TABS_AND_FULL_CONTEXT_PASS');
 await run("OSMINOGNativeBrowser.split(4)");
 for(let i=0;i<6;i++)await run(`OSMINOGNativeBrowser.open('https://example.com/extra-${i}')`);
 await frame();assert((await run("document.querySelectorAll('.native-cell').length"))>4);
 await run("document.querySelector('.native-pane-picker').click()");await frame();
 assert.equal(browser.panels.length,0);
 assert(await run("(()=>{const m=document.querySelector('.native-pane-menu');return m.getBoundingClientRect().width>=280&&m.innerText.includes('example.com')&&m.querySelectorAll('[aria-pressed=true]').length===1})()"));
 await run("document.querySelector('.native-pane-options button[aria-pressed=false]:last-child').click()");await frame();
 assert(await run("document.querySelector('.native-pane-menu').hidden"));assert(browser.panels.length>0);
 console.log('READABLE_TILE_PICKER_PASS');

 assert(await run("(()=>{const e=document.querySelector('.native-scroll');return e.scrollHeight>e.clientHeight})()"));
 await run("(()=>{const e=document.querySelector('.native-scroll');e.scrollTop=e.scrollHeight})()");await frame();
 assert(browser.panels.every(p=>!p.clip||p.clip.height>0));
 await run("(()=>{document.querySelector('.native-scroll').scrollTop=0;const cells=[...document.querySelectorAll('.native-cell')];const from=cells.find(c=>c.dataset.paneId==='@canvas');const target=cells.find(c=>c!==from);globalThis.expectedCanvasSlot=Number(target.dataset.dropIndex);const dt=new DataTransfer();from.querySelector('header').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));})()");await frame();
 assert(await run("OSMINOGNativeBrowser.state().slots[expectedCanvasSlot]==='@canvas'"));
 console.log('SCROLLING_TILES_AND_CANVAS_DRAG_PASS');
 // Regressions from 0.3.3: native pages track resized rows, and both close controls destroy them.
 const width=await run("document.querySelector('.native-cell').getBoundingClientRect().width");
 await run("document.querySelector('.native-resize-x').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");await frame();
 assert((await run("document.querySelector('.native-cell').getBoundingClientRect().width"))>width);
 const height=await run("document.querySelector('.native-cell').getBoundingClientRect().height");
 await run("document.querySelector('.native-resize-y').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");await frame();
 assert((await run("document.querySelector('.native-cell').getBoundingClientRect().height"))>height);
 const closed=await run("(()=>{const c=document.querySelector('.native-cell:has(.native-pane-close)'),id=c.dataset.paneId;c.querySelector('.native-pane-close').click();return id})()");await frame();
 assert(!browser.state().tabs.some(t=>t.id===closed));assert.equal(await run(`document.querySelectorAll('[data-tab-id="${closed}"]').length`),0);
 const closedRail=await run("(()=>{const c=document.querySelector('.native-tabs .native-tab:has(.native-tab-close)'),id=c.dataset.tabId;c.querySelector('.native-tab-close').click();return id})()");await frame();
 assert(!browser.state().tabs.some(t=>t.id===closedRail));assert.equal(await run(`document.querySelectorAll('[data-pane-id="${closedRail}"]').length`),0);
 await run("document.querySelector('.native-canvas-collapse').click()");await frame();assert.equal(await run("document.querySelectorAll('.native-canvas').length"),0);
 await new Promise(r=>setTimeout(r,250));assert.equal((await browser.store.get('browserShell')).browserShell[browser.project].canvasHidden,true);
 await run("OSMINOGNativeBrowser.open()");await frame();assert.equal(await run("document.querySelectorAll('.native-canvas').length"),0);
 await run("document.querySelector('.native-tabs [data-tab-id=\"@canvas\"] > button').click()");await frame();assert.equal(await run("document.querySelectorAll('.native-canvas #viewport').length"),1);
 assert(await run("markdownExport({all:true}).includes('Рабочий стол нового браузера')"));
 console.log('TILE_RESIZE_CLOSE_COLLAPSE_PASS');
 // Expanded canvas must render actual content, and its inspector follows the canvas tile.
 await run("OSMINOGNativeBrowser.canvas()");await frame();
 assert((await run("document.querySelector('#viewport').getBoundingClientRect().height"))>400);
 await run("fitToContent()");await frame();
 assert(await run("(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return [...document.querySelectorAll('#objects .canvas-object')].some(e=>{const b=e.getBoundingClientRect();return b.width>1&&b.height>1&&b.right>r.left&&b.left<r.right&&b.bottom>r.top&&b.top<r.bottom})})()"));
 await run("document.querySelector('[data-tool-native=shape]').click()");await frame();
 assert.equal(await run("document.querySelector('.native-properties').closest('.native-tile').dataset.paneId"),'@canvas');
 assert(await run("(()=>{const a=document.querySelector('.native-canvas').getBoundingClientRect(),b=document.querySelector('.native-properties').getBoundingClientRect();return b.left>a.right&&b.top<a.top})()"));
 await run("document.querySelector('[data-tool-native=select]').click()");await frame();
 await run("OSMINOGNativeBrowser.split(4)");await frame();
 const beforeEmpty=await run("document.querySelectorAll('.native-empty-close').length");
 if(beforeEmpty){await run("document.querySelector('.native-empty-close').click()");await frame();assert.equal(await run("document.querySelectorAll('.native-empty-close').length"),beforeEmpty-1)}
 await run("document.querySelector('[data-do=layouts]').click()");await frame();assert.equal(await run("document.querySelectorAll('.native-layout-options strong').length"),4);
 await run("document.querySelector('.native-layout-menu [data-do=dismiss]').click()");await frame();
 const homeProject=browser.project;await run("document.querySelector('.native-top [data-do=home]').click()");await frame();
 assert(await run("['viewport','world','objects','connections','ink'].every(id=>document.getElementById(id).getClientRects().length===0)"));
 await run(`openProject(${JSON.stringify(homeProject)})`);await frame();await frame();

 await run("OSMINOGNativeBrowser.split(4)");await frame();
 assert(await run("document.querySelectorAll('.native-tools button span').length===0"));
 assert(await run("(()=>{const a=document.querySelector('.native-top').getBoundingClientRect(),b=document.querySelector('.native-tools').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2})()"));
 assert.equal(await run("getComputedStyle(document.querySelector('#app')).display"),'none');
 await run("document.querySelector('.native-tile-resize-xy').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");await frame();
 const tileGeometry=await run("(()=>{const a=document.querySelector('.native-tile').getBoundingClientRect(),b=document.querySelector('.native-grid').getBoundingClientRect(),n=document.querySelectorAll('.native-tile')[1]?.getBoundingClientRect();return {tileWidth:a.width,gridWidth:b.width,tileHeight:a.height,availableHeight:document.querySelector('.native-scroll').clientHeight,bottom:a.bottom,nextTop:n?.top}})()");
 console.log('ADAPTIVE_TILE_GEOMETRY',JSON.stringify(tileGeometry));
 assert(Math.abs(tileGeometry.tileWidth-tileGeometry.gridWidth)<2&&Math.abs(tileGeometry.tileHeight-tileGeometry.availableHeight)<2&&(tileGeometry.nextTop===undefined||tileGeometry.nextTop>tileGeometry.bottom),JSON.stringify(tileGeometry));
 console.log('EXTERNAL_TOOL_DOCK_AND_ADAPTIVE_TILES_PASS');
 console.log('CANVAS_FULLSCREEN_LOCAL_DOCK_AND_HOME_PASS');
 await require('./files-smoke.cjs')(win,browser);
 await require('./control-smoke.cjs')(win,browser);
 console.log('SHELL_SMOKE_PASS');
};


