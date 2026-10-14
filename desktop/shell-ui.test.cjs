'use strict';
// Real editor DOM with a deterministic host transport. Native content has a separate smoke test.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.join(__dirname,'board',decodeURIComponent(req.url.split('?')[0]));try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))}catch{res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1600,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{globalThis.startupLeaks=[];const checkStartup=()=>{if(document.documentElement?.classList.contains('native-ready'))return;for(const id of ['app','workdeskTools','inspector','layersPanel']){const e=document.getElementById(id);if(e?.getClientRects().length&&getComputedStyle(e).visibility==='visible')startupLeaks.push(id)}requestAnimationFrame(checkStartup)};requestAnimationFrame(checkStartup);const mem={};globalThis.testMemory=mem;let notify=()=>{},project='',tabs=[],sessions=[],activeProvider='';const state=()=>({project,tabs,sessions,activeProvider});globalThis.OSMINOGNative={version:'0.3.0',onChanged(){},onBrowser:f=>notify=f,onProvider(){},onUpdate(){},updateState:async()=>({phase:'idle',currentVersion:'0.3.0'}),get:async k=>typeof k==='string'?{[k]:mem[k]}:Array.isArray(k)?Object.fromEntries(k.map(k=>[k,mem[k]])):{...k,...mem},set:async x=>Object.assign(mem,x),remove:async()=>{},runtime:async()=>({ok:false,error:'Fixture transport'}),open:async()=>{},browser:async(action,a={})=>{if(action==='project')project=a.id;if(action==='state'||action==='project')return state();if(action==='layout'){globalThis.testPanels=a.panels;return true}if(action==='open'){const t={id:crypto.randomUUID(),url:a.url,title:new URL(a.url).hostname,lane:a.lane};tabs.push(t);notify(state());return{id:t.id}}if(action==='close'){tabs=tabs.filter(t=>t.id!==a.id);notify(state());return state()}if(action==='provider'){const t={id:crypto.randomUUID(),url:'https://'+a.provider+'.com/',title:a.provider,session:true,provider:a.provider};sessions.push(t);activeProvider=t.id;notify(state());return state()}if(action==='activate-provider'){activeProvider=a.id;return state()}if(action==='close-provider'){sessions=sessions.filter(t=>t.id!==a.id);notify(state());return state()}if(action==='context')return (a.ids||tabs.map(t=>t.id)).map(id=>({id,title:'Fixture page',url:'https://example.com/',text:'Fixture body'}));if(action==='copy-context'){globalThis.testCopied=a.text;return true}return state()}}});
 try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/editor.html');await page.waitForFunction(()=>globalThis.OSMINOGNativeBrowser?.state().visible);await page.locator('#native-browser').waitFor({state:'visible'});await page.addStyleTag({content:'::-webkit-scrollbar{width:16px;height:16px}'});
 await page.evaluate(()=>{OSMINOGEditorAPI.create('text',{name:'Рабочий план',text:'Новый браузер для работы\nХолст · вкладки · ИИ',x:6050,y:4100,w:420,h:180});return OSMINOGNativeBrowser.open('https://example.com/')});
 await page.evaluate(()=>OSMINOGNativeBrowser.open('https://developer.mozilla.org/'));await page.evaluate(()=>OSMINOGNativeBrowser.openProvider('chatgpt'));
 assert.equal(await page.locator('.native-cell').count(),4);assert.equal(await page.locator('.native-canvas #viewport').count(),1);assert.equal(await page.locator('.native-tabs .native-tab').count(),3);assert.equal(await page.locator('.native-ai-tabs .native-tab').count(),1);
 // The tile picker must show readable titles and safely cover native web views.
 const originalPane=await page.locator('.native-cell:has(.native-pane-picker)').first().getAttribute('data-pane-id');
 await page.locator('.native-pane-picker').first().click();await page.waitForFunction(()=>testPanels.length===0);
 assert(await page.locator('.native-pane-menu').evaluate(e=>e.getBoundingClientRect().width>=280));
 await page.screenshot({path:'shell-picker-036.png'});
 assert.match(await page.locator('.native-pane-options').innerText(),/example.com/);
 assert.equal(await page.locator('.native-pane-options [aria-pressed=true]').count(),1);
 await page.locator('.native-pane-options button').filter({hasText:'developer.mozilla.org'}).click();
 assert.equal(await page.locator('.native-pane-menu').isVisible(),false);
 assert.notEqual(await page.locator('.native-cell:has(.native-pane-picker)').first().getAttribute('data-pane-id'),originalPane);
 await page.locator('.native-pane-picker').first().click();await page.keyboard.press('Escape');await page.waitForFunction(()=>testPanels.length>0);
 await page.locator('.native-pane-picker').first().click();await page.locator('.native-top').click({position:{x:1,y:1}});assert.equal(await page.locator('.native-pane-menu').isVisible(),false);
 await page.locator('[data-do=theme]').click();await page.locator('[data-do=theme]').click();await page.locator('[data-do=theme]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await page.screenshot({path:'shell-dark.png'});
 await page.locator('.native-ai-footer [data-do=context]').click();await page.locator('.native-context').first().waitFor({state:'visible'});await page.waitForFunction(()=>testPanels.length===0);assert.match(await page.locator('.native-context textarea[aria-label="Контекст для передачи ИИ"]').inputValue(),/Рабочий план/);await page.locator('[data-do=copy]').click();assert.match(await page.evaluate(()=>testCopied),/Fixture body/);
 await page.locator('.native-pane-full').last().click();assert.equal(await page.locator('.native-cell').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.native-cell').count(),4);
 await page.locator('[data-do=files]').click();assert.equal(await page.locator('.native-layers #layersPanel').count(),1);await page.locator('[data-do=files]').click();
 await page.locator('[data-do=chat]').click();assert.equal(await page.locator('.native-chat').isVisible(),true);
 await page.evaluate(()=>OSMINOGNativeBrowser.canvas());assert.equal(await page.locator('#native-browser #viewport').count(),1);assert.equal(await page.locator('#viewport').count(),1);await page.evaluate(()=>OSMINOGNativeBrowser.open());assert.equal(await page.locator('.native-canvas #viewport').count(),1);
 await page.locator('[data-do=theme]').click();await page.screenshot({path:'shell-ocean.png'});await page.locator('[data-do=theme]').click();await page.screenshot({path:'shell-light.png'});
 await page.setViewportSize({width:900,height:650});await page.screenshot({path:'shell-compact.png'});const overflow=await page.evaluate(()=>{const r=document.querySelector('#native-browser').getBoundingClientRect();return [...document.querySelectorAll('.native-scroll,.native-ai')].some(e=>{const b=e.getBoundingClientRect();return b.right>r.right+1||b.bottom>r.bottom+1})});assert.equal(overflow,false);
 // Regression: resizing remains available when central tabs extend beyond four tiles.
 await page.setViewportSize({width:1600,height:980});await page.keyboard.press('Escape');
 for(let i=0;i<5;i++)await page.evaluate(i=>OSMINOGNativeBrowser.open('https://example.com/extra-'+i),i);
 const cells=page.locator('.native-cell'),beforeWidth=(await cells.first().boundingBox()).width;
 const divider=page.locator('.native-resize-x');await divider.focus();await page.keyboard.press('ArrowRight');
 assert.ok((await cells.first().boundingBox()).width>beforeWidth+10);
 const grip=await divider.boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+30);await page.mouse.down();await page.mouse.move(grip.x+65,grip.y+30);await page.mouse.up();
 assert.ok((await cells.first().boundingBox()).width>beforeWidth+40);
 const heights=await cells.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
 const rowGrip=page.locator('.native-resize-y').first(),r=await rowGrip.boundingBox();
 await page.mouse.move(r.x+35,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+35,r.y+65);await page.mouse.up();
 assert.ok((await cells.first().boundingBox()).height>heights[0]+40);
 assert.ok(Math.abs((await cells.nth(4).boundingBox()).height-heights[4])<2);
 await page.evaluate(()=>OSMINOGNativeBrowser.open());assert.ok((await cells.first().boundingBox()).height>heights[0]+40);
 // Both close controls remove the same live tab, list item, and tile without a blank hole.
 const firstId=await page.locator('.native-cell[data-pane-id]:has(.native-pane-close)').first().getAttribute('data-pane-id');
 await page.locator(`.native-tabs [data-tab-id="${firstId}"]`).hover();await page.locator(`.native-tabs [data-tab-id="${firstId}"] .native-tab-close`).click();
 await page.waitForFunction(id=>!OSMINOGNativeBrowser.state().data.tabs.some(t=>t.id===id),firstId);
 assert.equal(await page.locator(`.native-cell[data-pane-id="${firstId}"]`).count(),0);
 const second=page.locator('.native-cell:has(.native-pane-close)').first(),secondId=await second.getAttribute('data-pane-id');await second.locator('.native-pane-close').click();
 await page.waitForFunction(id=>!OSMINOGNativeBrowser.state().data.tabs.some(t=>t.id===id),secondId);
 assert.equal(await page.locator(`.native-tabs [data-tab-id="${secondId}"]`).count(),0);
 assert.equal(await page.locator('.native-cell[data-pane-id=""]').count(),0);
 // Collapse preserves the exact canvas and its contents; reopening does not displace another tab.
 const tabIds=await page.evaluate(()=>{globalThis.originalViewport=document.querySelector('#viewport');return OSMINOGNativeBrowser.state().data.tabs.map(t=>t.id)});
 await page.locator('.native-canvas-collapse').click();assert.equal(await page.locator('.native-canvas').count(),0);
 await page.evaluate(()=>OSMINOGNativeBrowser.open());assert.equal(await page.locator('.native-canvas').count(),0);
 await page.waitForFunction(()=>Object.values(testMemory.browserShell||{}).some(p=>p.canvasHidden&&p.rowHeights[4]?.length));
 await page.locator('.native-tabs [data-tab-id="@canvas"] > button').click();assert.equal(await page.locator('.native-canvas #viewport').count(),1);
 assert.equal(await page.evaluate(()=>originalViewport===document.querySelector('#viewport')),true);
 assert.deepEqual(await page.evaluate(()=>OSMINOGNativeBrowser.state().data.tabs.map(t=>t.id)),tabIds);
 // Resizing a lower row in the asymmetric 3-pane layout spans both columns.
 await page.evaluate(()=>OSMINOGNativeBrowser.split(3));assert.equal(await page.locator('.native-resize-spanned').count(),1);
 assert.ok(await page.locator('.native-resize-y').count()>1);
 await page.locator('.native-resize-y').nth(1).focus();await page.keyboard.press('ArrowDown');
 await page.screenshot({path:'shell-tiles-fixed.png'});
 // 0.3.5: empty cells stay removed; the final empty state can be cleared too.
 await page.evaluate(()=>OSMINOGNativeBrowser.split(4));
 await page.evaluate(async()=>{for(const t of [...OSMINOGNativeBrowser.state().data.tabs])await OSMINOGNative.browser('close',{id:t.id})});
 const emptyCount=await page.locator('.native-empty-close').count();assert.ok(emptyCount>0);
 for(let i=0;i<emptyCount;i++)await page.locator('.native-empty-close').first().click();
 assert.equal(await page.locator('.native-cell').count(),1);
 await page.evaluate(()=>OSMINOGNativeBrowser.open());assert.equal(await page.locator('.native-empty-close').count(),0);
 await page.locator('.native-pane-full').click();
 assert.ok((await page.locator('#viewport').boundingBox()).height>600,'Expanded canvas must have a real height');
 assert.equal(await page.locator('.native-tabs [data-tab-id="@canvas"] .native-logo').count(),0);
 // Check tools by actual mouse input, not just API-created objects.
 for(const tool of ['text','note','node','shape','pen']){
  await page.locator(`[data-tool-native="${tool}"]`).click();
  assert.equal(await page.evaluate(()=>state.tool),tool);
  await page.evaluate(i=>{state.view={x:-20000-i*3000,y:-20000,scale:1};applyView()},['text','note','node','shape','pen'].indexOf(tool));
  const view=await page.locator('#viewport').boundingBox(),before=await page.evaluate(()=>objects().length);
  const x=view.x+view.width/2,y=view.y+view.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  if(tool==='shape'||tool==='pen')await page.mouse.move(x+85,y+65,{steps:8});
  await page.mouse.up();
await page.waitForFunction(n=>objects().length>n,before);
  assert.equal(await page.evaluate(()=>objects().at(-1).type),tool==='pen'?'ink':tool);if(tool==='text')await page.keyboard.type('Text input works');
  const canvas=await page.locator('.native-canvas').boundingBox(),panel=await page.locator('.native-properties').boundingBox();
  assert.ok(panel.x>canvas.x+canvas.width&&panel.y<canvas.y,'Properties must be adjacent to the canvas');
 }
 await page.locator('[data-tool-native="hand"]').click();const panBefore=await page.evaluate(()=>({...state.view}));
 let v=await page.locator('#viewport').boundingBox();await page.mouse.move(v.x+40,v.y+70);await page.mouse.down();await page.mouse.move(v.x+100,v.y+115,{steps:5});await page.mouse.up();assert.ok((await page.evaluate(()=>state.view.x))>panBefore.x+30);
 await page.locator('[data-tool-native="select"]').click();assert.equal(await page.evaluate(()=>state.tool),'select');
 // Image tool uses the real local file input and creates a local image object.
 await page.locator('[data-tool-native="image"]').click();const beforeImage=await page.evaluate(()=>objects().length);
 await page.locator('#fileInput').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')});
 await page.waitForFunction(n=>objects().length>n,beforeImage);assert.equal(await page.evaluate(()=>objects().at(-1).type),'image');
 // Properties follow the canvas even when a webpage is placed to its left.
 await page.keyboard.press('Escape');await page.evaluate(()=>OSMINOGNativeBrowser.split(2));await page.evaluate(()=>OSMINOGNativeBrowser.open('https://example.com/tool-neighbor'));
 await page.locator('.native-cell[data-pane-id="@canvas"] > header').dragTo(page.locator('.native-cell').nth(1));
 await page.locator('[data-tool-native="shape"]').click();
 const localDock=await page.locator('.native-properties').evaluate(e=>e.closest('.native-tile').dataset.paneId);assert.equal(localDock,'@canvas');
 const dockRect=await page.locator('.native-properties').boundingBox(),canvasRect=await page.locator('.native-canvas').boundingBox();assert.ok(dockRect.x>canvasRect.x+canvasRect.width);
 // Home hides every canvas drawing layer, and opening the project preserves its data.
 const savedProject=await page.evaluate(()=>project().id),savedCount=await page.evaluate(()=>objects().length);
 await page.locator('.native-top [data-do=home]').click();await page.waitForFunction(()=>document.querySelector('#native-browser').hidden);
 for(const selector of ['#viewport','#objects','#connections','#ink'])assert.equal(await page.locator(selector).isVisible(),false);
 await page.screenshot({path:'shell-home-035.png'});
 await page.evaluate(id=>openProject(id),savedProject);await page.waitForFunction(()=>OSMINOGNativeBrowser.state().visible);
 assert.equal(await page.evaluate(()=>objects().length),savedCount);
 // Top action row, labelled layouts, and a persistent eye mascot replace the download arrow.
 await page.locator('[data-do=layouts]').click();assert.equal(await page.locator('.native-layout-options strong').count(),4);await page.screenshot({path:'shell-layouts-035.png'});await page.locator('.native-layout-menu [data-do=dismiss]').click();
 await page.locator('[data-do=updates]').click();const updateButton=await page.locator('[data-do=update-run]').boundingBox(),notes=await page.locator('.native-release').boundingBox();assert.ok(updateButton.y<notes.y);assert.equal(await page.locator('.native-update-symbol .native-logo').count(),1);await page.screenshot({path:'shell-updates-035.png'});await page.locator('.native-update [data-do=dismiss]').first().click();
 await page.locator('.native-cell[data-pane-id="@canvas"] .native-pane-full').click();await page.evaluate(()=>fitToContent());await page.locator('#canvasBoardColor').fill('#aabbcc');assert.equal(await page.locator('#viewport').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(170, 187, 204)');await page.screenshot({path:'shell-canvas-035.png'});
 assert.equal(await page.locator('.native-tile > .native-tool-rail').count(),0);
 assert.equal(await page.locator('.native-rail-top [data-do=new]').evaluate(e=>getComputedStyle(e,'::after').content),'none');
 // 0.3.6: tools are centered icons, docks are outside the canvas and scroll independently.
 const toolbar=await page.locator('.native-tools').boundingBox(),header=await page.locator('.native-top').boundingBox();
 assert.ok(Math.abs(toolbar.x+toolbar.width/2-header.x-header.width/2)<2);
 assert.equal(await page.locator('.native-tools button span').count(),0);
 assert.equal(await page.locator('.native-properties').evaluate(e=>!!e.closest('.native-cell')),false);
 await page.locator('[data-panel-native=canvas]').click();
 const scrollable=page.locator('#inspectorBody');
 await page.setViewportSize({width:1600,height:650});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.ok(await scrollable.evaluate(e=>e.scrollHeight>e.clientHeight+20));
 const sr=await scrollable.boundingBox();await page.mouse.move(sr.x+sr.width/2,sr.y+sr.height/2);await page.mouse.wheel(0,550);await page.waitForFunction(()=>document.querySelector('#inspectorBody').scrollTop>30);
 await page.locator('[data-panel-native=history]').click();assert.equal(await page.locator('.native-properties #activityPanel').isVisible(),true);
 await page.locator('[data-panel-native=properties]').click();assert.equal(await scrollable.isVisible(),true);
 await page.locator('[data-do=files]').click();
 const layers=await page.locator('.native-layers').boundingBox(),view=await page.locator('#viewport').boundingBox();assert.ok(layers.x<view.x&&layers.x+layers.width<=view.x+2);
 await page.locator('[data-do=files]').click();
 await page.evaluate(()=>{const c=viewportCenter();OSMINOGEditorAPI.create('shape',{x:c.x,y:c.y,w:80,h:80});renderInspector()});
 assert.equal(await page.locator('[data-gv2=open]').count(),0);
 assert.equal(await page.locator('#app').isVisible(),false);assert.deepEqual(await page.evaluate(()=>startupLeaks),[]);
 // Drag a single tile to the full available width and height; neighbors flow below, never disappear.
 await page.setViewportSize({width:1600,height:980});await page.evaluate(()=>OSMINOGNativeBrowser.split(4));await page.locator('[data-tool-native=select]').click();
 await page.evaluate(()=>OSMINOGNativeBrowser.open('https://example.com/reflow-test'));
 const tile=page.locator('.native-tile').first();const idsBefore=await page.locator('.native-cell').evaluateAll(es=>es.map(e=>e.dataset.paneId));
 const area=await page.locator('.native-scroll').boundingBox(),tileStart=await tile.boundingBox(),handle=await tile.locator('.native-tile-resize-xy').boundingBox();
 await page.mouse.move(handle.x+8,handle.y+8);await page.mouse.down();await page.mouse.move(handle.x+8+area.width-tileStart.width,handle.y+8+area.height-tileStart.height,{steps:14});await page.mouse.up();
 area.width=await page.locator('.native-grid').evaluate(e=>e.clientWidth);const fullTile=await tile.boundingBox(),nextTile=await page.locator('.native-tile').nth(1).boundingBox();
 assert.ok(Math.abs(fullTile.width-area.width)<2);assert.ok(Math.abs(fullTile.height-area.height)<2);assert.ok(nextTile.y>=fullTile.y+fullTile.height+10);
 assert.deepEqual(await page.locator('.native-cell').evaluateAll(es=>es.map(e=>e.dataset.paneId)),idsBefore);
 await page.evaluate(()=>OSMINOGNativeBrowser.open());assert.ok(Math.abs((await tile.boundingBox()).width-area.width)<2);
 // Shrinking returns a neighbor to the same row. Full-width tile remains responsive to window resizing.
 const h=await tile.locator('.native-tile-resize-x').boundingBox();await page.mouse.move(h.x+5,h.y+40);await page.mouse.down();await page.mouse.move(h.x+5-area.width*.6,h.y+40,{steps:10});await page.mouse.up();
 assert.ok(Math.abs((await tile.boundingBox()).y-(await page.locator('.native-tile').nth(1).boundingBox()).y)<2);
 await tile.locator('.native-tile-resize-x').dblclick();await page.setViewportSize({width:1400,height:850});await page.waitForFunction(()=>Math.abs(document.querySelector('.native-tile').getBoundingClientRect().width-document.querySelector('.native-grid').clientWidth)<2);
 assert.ok(Math.abs((await tile.boundingBox()).width-(await page.locator('.native-grid').boundingBox()).width)<2);
 await page.screenshot({path:'shell-adaptive-036.png'});
 // A right-column tile snaps at the visible edge without dragging beyond the window.
 await page.evaluate(()=>OSMINOGNativeBrowser.split(4));
 const rightTile=page.locator('.native-tile').nth(1),edge=await rightTile.locator('.native-tile-resize-x').boundingBox(),edgeArea=await page.locator('.native-scroll').boundingBox();
 await page.mouse.move(edge.x+1,edge.y+30);await page.mouse.down();await page.mouse.move(edgeArea.x+edgeArea.width+4,edge.y+30,{steps:5});await page.mouse.up();
 assert.ok(Math.abs((await rightTile.boundingBox()).width-(await page.locator('.native-grid').boundingBox()).width)<2);
 // A newly opened tool stays outside the desktop after it moves to another tile.
 await page.evaluate(()=>OSMINOGNativeBrowser.split(2));await page.locator('[data-tool-native=shape]').click();await page.screenshot({path:'shell-dock-036.png'});assert.ok((await page.locator('#viewport').boundingBox()).width>250);
 const relevant=errors.filter(e=>!/fabric|PDFLib|fontkit/.test(e));assert.deepEqual(relevant,[]);console.log('SHELL_UI_PASS');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

