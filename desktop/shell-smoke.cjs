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
 // Tab activation and close have separate hit targets, including the narrow rail.
 assert.equal(await run("document.querySelectorAll('#native-browser .native-eye').length"),0);
 for(const width of [80,220]){
  await run(`document.querySelector('#native-browser').style.setProperty('--rail-width','${width}px')`);await frame();
  assert.equal(await run(`(()=>{const tabs=[...document.querySelectorAll('.native-tabs .native-tab,.native-ai-tabs .native-tab')];return tabs.every(t=>{const close=t.querySelector('.native-tab-close');if(!close)return true;const select=t.firstElementChild,a=select.getBoundingClientRect(),b=close.getBoundingClientRect(),m=select.querySelector('.native-tab-mark').getBoundingClientRect();return a.right<=b.left+.5&&m.left>=a.left&&m.right<=a.right+.5&&document.elementFromPoint(m.x+m.width/2,m.y+m.height/2)?.closest('button')===select&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===close})})()`),true,`Separate tab hit targets at rail width ${width}`);
 }
 await run("document.querySelector('#native-browser').style.setProperty('--rail-width','80px')");await frame();
 console.log('SHELL_TAB_HIT_TARGETS_PASS');
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
 assert.equal(await run(`document.querySelector('.native-release-notes').textContent.includes(${JSON.stringify(require('./release-notes.cjs').notes.split('\n')[0])})`),true);
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
 assert.equal(await run("document.querySelector('#native-browser [data-do=chat]')===null"),true);
 assert.equal(await run("getComputedStyle(document.querySelector('#bridgePanel')).display"),'none');
 await run("document.querySelector('#native-browser [data-do=context]').click()");await frame();
 assert.equal(await run("document.querySelector('.native-access').hidden"),false);
 await run("document.querySelector('[data-do=allow-all]').click()");await frame();assert.equal(browser.contextScope,null);
 await run("document.querySelector('[data-do=deny-all]').click()");await frame();assert.deepEqual(browser.contextScope,[]);
 assert.equal(await run("document.querySelector('.native-access textarea')===null"),true);
 await run("document.querySelector('.native-access [data-do=dismiss]').click()");await frame();
 console.log('BROWSER_ONLY_SHELL_AND_SESSION_SCOPE_PASS');
 await run('OSMINOGNativeBrowser.canvas()');await frame();assert.equal(await run("document.querySelectorAll('#native-browser #viewport').length"),1);assert.equal(await run("document.querySelectorAll('#viewport').length"),1);
 await run('OSMINOGNativeBrowser.open();OSMINOGNativeBrowser.split(4)');await frame();assert.equal(await run("!!document.querySelector('.native-canvas #viewport')"),true);
 win.setSize(900,650);await frame();await fs.writeFile('shell-smoke-compact.png',(await win.webContents.capturePage()).toPNG());assert.equal(await run("(()=>{const r=document.querySelector('#native-browser').getBoundingClientRect();return [...document.querySelectorAll('.native-scroll,.native-ai')].some(e=>{const b=e.getBoundingClientRect();return b.right>r.right+1||b.bottom>r.bottom+1})})()"),false);
 await browser.save();const saved=(await browser.store.get('browserSessions')).browserSessions;assert.equal(saved[browser.project].length,2);assert.equal(saved[browser.project][1].lane,'side');
 browser.session.protocol.unhandle('https');
 await require('./direct-smoke.cjs')(win,browser);

 // Original submenus remain functional in the header; documents are editable and persisted.
 win.focus();win.webContents.focus();await frame();
 await run("document.querySelector('[data-tool-native=text]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");await frame();
 console.log('TOOL_MENU_STATE',await run("JSON.stringify({hidden:document.querySelector('#deskMore').hidden,parent:document.querySelector('#deskMore').parentElement.id,api:typeof OSMINOGWorkdeskMenus?.open,focus:document.activeElement?.outerHTML?.slice(0,160),nativeTools:document.querySelectorAll('[data-native-group]').length})"));assert.equal(await run("document.querySelector('#deskMore').hidden"),false);await fs.writeFile('shell-smoke-tool-menu.png',(await win.webContents.capturePage()).toPNG());
 assert.equal(await run("document.querySelector('#deskMore').parentElement.id"),'native-browser');
 assert.equal(browser.panels.length,0);
 const toolRect=await run("(()=>{const r=document.querySelector('[data-tool-native=text]').getBoundingClientRect(),m=document.querySelector('#deskMore').getBoundingClientRect();return{bottom:r.bottom,top:m.top}})()");assert.ok(toolRect.top>=toolRect.bottom);
 const hover=await run("(()=>{const r=document.querySelector('[data-tool-native=text]').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
 win.webContents.sendInputEvent({type:'mouseMove',...hover});await new Promise(r=>setTimeout(r,300));
 win.webContents.sendInputEvent({type:'mouseMove',x:4,y:300});await new Promise(r=>setTimeout(r,450));
 assert.equal(await run("document.querySelector('#deskMore').hidden"),true);
 await run("document.querySelector('[data-tool-native=text]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");await frame();
 const beforeDocs=await run('objects().length');
 await run("document.querySelector('#deskMore [data-desk=markdown]').click()");await frame();
 assert.equal(await run('objects().length'),beforeDocs+1);assert.equal(await run("document.querySelector('#workdeskViewer').open"),true);
 await run("document.querySelector('#workdeskText').value='Native Markdown content';document.querySelector('#workdeskText').dispatchEvent(new Event('input',{bubbles:true}));OSMINOGWorkdesk.close()");await frame();
 assert.equal(await run("objects().some(o=>o.text==='Native Markdown content'&&o.noteFormat==='markdown')"),true);
 await run('globalThis.beforeCreateView={...state.view};state.view.x+=10000;state.view.y+=10000;applyView()');await frame();
 const pointCreate=await run("(()=>{const r=document.querySelector('.native-canvas #viewport').getBoundingClientRect();return{x:Math.round(r.x+20),y:Math.round(r.y+20)}})()");
 win.webContents.sendInputEvent({type:'mouseDown',...pointCreate,button:'right',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...pointCreate,button:'right',clickCount:1});await new Promise(r=>setTimeout(r,160));await frame();
 assert.equal(await run("document.querySelector('.native-create-menu').hidden"),false);await fs.writeFile('shell-smoke-create-menu.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('[data-native-create=note]').click()");await frame();
 assert.equal(await run('objects().length'),beforeDocs+2);assert.equal(await run("document.querySelector('#workdeskViewer').open"),true);
 await run("OSMINOGWorkdesk.close()");await run('state.view=beforeCreateView;applyView()');await frame();
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
 // Eyelids clip the pupil; the surrounding icon never scales during a blink.
 await run("document.querySelector('.native-update').hidden=false");await frame();
 const eye=await run(`(()=>{const e=document.querySelector('.native-update-symbol .native-logo'),r=e.getBoundingClientRect();const a=e.getAnimations({subtree:true}).find(a=>a.animationName==='native-eye-blink');if(!a)throw Error('Blink animation missing');a.pause();a.currentTime=Number(a.effect.getTiming().duration)*.465;return{width:r.width,height:r.height}})()`);await frame();
 const closed=await run(`(()=>{const e=document.querySelector('.native-update-symbol .native-logo'),r=e.getBoundingClientRect();return{width:r.width,height:r.height,transform:getComputedStyle(e).transform,clip:getComputedStyle(e,'::before').clipPath,pupil:getComputedStyle(e,'::before').backgroundImage}})()`);
 assert.equal(closed.width,eye.width);assert.equal(closed.height,eye.height);assert.equal(closed.transform,'none');assert.match(closed.clip,/47%/);assert.match(closed.pupil,/radial-gradient/);
 await fs.writeFile('update-eye-closed.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('.native-update').hidden=true;document.querySelector('.native-update-symbol .native-logo').getAnimations({subtree:true}).forEach(a=>a.play())");await frame();
 console.log('INNER_EYELID_BLINK_PASS');
 await require('./files-smoke.cjs')(win,browser);
 await require('./control-smoke.cjs')(win,browser);
 console.log('SHELL_SMOKE_PASS');
};


