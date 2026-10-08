'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
    const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!name.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(name,(e,data)=>{if(e)return res.writeHead(404).end();const ext=path.extname(name);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.mjs':'text/javascript'})[ext]||'application/octet-stream');res.end(data)});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const passed=[];
  const check=(label,fn)=>{fn();passed.push(label);console.log('PASS',label)};
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM||undefined,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});
    await page.route('https://**',r=>r.abort());
    const init=()=>{
      if(location.href==='about:blank'){for(const name of ['localStorage','sessionStorage']){const m=new Map();Object.defineProperty(window,name,{value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}})}}
      const store={},event={addListener(){},removeListener(){}};window.__store=store;
      window.chrome={runtime:{getURL:p=>new URL(p,location.href==='about:blank'?'https://osminog.test/editor.html':location.href).href,getManifest:()=>({version:'4.0.8'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},
        storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:store[keys]}:{...store};cb?.(v);return Promise.resolve(v)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async()=>{}},onChanged:event},
        tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>{window.__opened=x.url}},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}};
    };
    await page.addInitScript(init);
    if(process.env.OFFLINE_TEST_ORIGIN)await page.route('https://osminog.test/**',async r=>{const name=path.resolve(root,'.'+new URL(r.request().url()).pathname);if(!name.startsWith(root+path.sep)||!fs.existsSync(name))return r.fulfill({status:404,body:''});return r.fulfill({contentType:({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(name)]||'application/octet-stream',body:fs.readFileSync(name)})});
    if(process.env.OFFLINE_TEST_ORIGIN){await page.evaluate(init);await page.setContent(fs.readFileSync(path.join(root,'editor.html'),'utf8').replace('<head>','<head><base href="https://osminog.test/">'));}else await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
    await page.waitForFunction(()=>!!window.OSMINOGCanvasUX);
    await page.evaluate(async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();state.language='ru';applyLanguage();state.theme='dark';project().name='Проверка рабочей доски';sessionStorage.setItem('osminogIntroDismissedV1','1');state.view={x:0,y:0,scale:1};applyTheme();renderAll(true);applyView()});
    await page.waitForTimeout(200);
    const toolbar=await page.locator('#workdeskTools').boundingBox();
    check('floating toolbar below canvas, outside header',()=>{assert(toolbar.y>900);assert(toolbar.x>=8);assert(toolbar.x+toolbar.width<=1592)});
    
    assert.equal(await page.locator('#workdeskTools .desk-tool-chevron').count(),0);passed.push('toolbar has no small arrows');
    assert.equal(await page.locator('#workdeskTools [data-desk-group]:not(:has(svg))').count(),0);
    await page.locator('[data-desk-group=text]').click();
    assert.equal(await page.evaluate(()=>state.tool),'text');assert.equal(await page.locator('#deskMore').isVisible(),false);assert.equal(await page.locator('#workdeskViewer').isVisible(),false);
    assert.equal(await page.locator('[data-desk-group=text]').getAttribute('aria-pressed'),'true');
    passed.push('T button immediately activates inline text and current-state dot');
    const anchor=await page.evaluate(()=>worldPoint(420,310));await page.mouse.click(420,310);
    let id=await page.evaluate(()=>state.selected[0]);const field=page.locator(`.canvas-object[data-id="${id}"] [data-field=text]`);
    assert.equal(await field.getAttribute('contenteditable'),'true');assert(await field.evaluate(el=>document.activeElement===el));assert.equal(await field.innerText(),'');
    await page.keyboard.insertText('Текст прямо на холсте');await page.keyboard.press('Enter');await page.keyboard.insertText('Без карточек и блокнотов');
    let o=await page.evaluate(id=>structuredClone(objects().find(o=>o.id===id)),id);
    check('click anchors editable text at exact canvas position',()=>{assert(Math.abs(o.x-anchor.x)<.01);assert(Math.abs(o.y-anchor.y)<.01);assert.equal(o.type,'text');assert.equal(o.fillEnabled,false);assert.equal(o.strokeEnabled,false);assert.equal(o.padding,0)});
    check('typing Cyrillic and newline persists actual content',()=>{assert.match(o.text,/Текст прямо на холсте\nБез карточек и блокнотов/);assert(o.h>=60);assert(o.w>200)});
    await page.waitForTimeout(500);assert.equal(await page.evaluate(id=>__store[STORAGE_KEY].projects.find(p=>p.id===state.activeProject).objects.find(o=>o.id===id).text,id),o.text);
    passed.push('text saved through original project persistence');
    await page.keyboard.press('Escape');assert.equal(await field.getAttribute('contenteditable'),'false');
    await page.locator('[data-canvas-text-prop=fontSize]').fill('42');await page.locator('[data-canvas-text-prop=fontFamily]').selectOption('Georgia, serif');
    assert.equal(await field.evaluate(el=>getComputedStyle(el).fontSize),'42px');assert.match(await field.evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
    passed.push('right inspector changes size and font without replacing text');
    await page.locator('[data-desk-group=text]').click();const before=await page.evaluate(()=>objects().length);await field.click();assert.equal(await page.evaluate(()=>objects().length),before);assert(await field.evaluate(el=>el===document.activeElement));
    passed.push('T click edits an existing text object instead of duplicating it');
    await page.keyboard.press('Escape');await page.locator('[data-desk-group=text]').click();await page.mouse.click(800,460);await page.keyboard.press('Escape');await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>objects().length),before);passed.push('unused empty text insertion is discarded');
    await page.locator('[data-desk-group=pen]').click();await page.locator('[data-desk-group=pen]').click({button:'right'});
    assert(await page.locator('#deskMore').isVisible());assert.equal(await page.locator('#deskMore [data-desk=pen]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#deskMore [data-desk]:not(:has(svg))').count(),0);
    const menu=await page.locator('#deskMore').boundingBox();assert(menu.y+menu.height<toolbar.y);passed.push('secondary menus open above toolbar, with SVG icons and active dot');
    await page.keyboard.press('Escape');await page.locator('[data-desk-group=text]').click({button:'right'});await page.locator('#deskMore [data-desk=note]').click();assert(await page.locator('#workdeskViewer').isVisible());await page.locator('#workdeskText').fill('Блокнот остаётся отдельным инструментом');await page.locator('#workdeskClose').click();
    passed.push('notebook preserved as an explicit secondary action');
    await page.evaluate(()=>{document.querySelector('#bridgePanel').hidden=false;document.querySelector('#layersToggle').click();document.querySelector('#inspector').classList.remove('collapsed')});await page.waitForTimeout(250);
    const ui=await page.evaluate(()=>({chat:document.querySelector('#bridgePanel').hidden,layers:state.layersOpen,collapsed:document.querySelector('#inspector').className,center:viewportCenter(),scale:state.view.scale}));
    await page.keyboard.press('Control+Backslash');
    let rect=await page.locator('#viewport').boundingBox();assert.deepEqual(rect,{x:0,y:0,width:1600,height:1000});assert.equal(await page.locator('.topbar').isVisible(),false);assert.equal(await page.locator('#workdeskTools').isVisible(),false);assert.equal(await page.locator('#bridgePanel').isVisible(),false);assert.equal(await page.locator('#inspector').isVisible(),false);assert.equal(await page.locator('#layersPanel').isVisible(),false);
    let view=await page.evaluate(()=>({center:viewportCenter(),scale:state.view.scale}));assert.deepEqual(view.center,ui.center);assert.equal(view.scale,ui.scale);
    passed.push('Ctrl+Backslash yields full app viewport with no UI and same world center');
    await page.keyboard.press('Control+Backslash');
    assert.deepEqual(await page.evaluate(()=>({chat:document.querySelector('#bridgePanel').hidden,layers:state.layersOpen,collapsed:document.querySelector('#inspector').className})),{chat:ui.chat,layers:ui.layers,collapsed:ui.collapsed});
    passed.push('second shortcut restores exact chat, layers and properties states');
    await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'Backslash',key:'/',ctrlKey:true,bubbles:true,cancelable:true})));
    assert(await page.evaluate(()=>document.body.classList.contains('osminog-focus')));await page.keyboard.press('Escape');assert(!await page.evaluate(()=>document.body.classList.contains('osminog-focus')));passed.push('physical key works with alternate layout; Escape restores UI');
    await page.evaluate(()=>{document.querySelector('#bridgePanel').hidden=true;if(state.layersOpen)document.querySelector('#layersToggle').click();document.querySelector('#inspector').classList.add('collapsed');setTool('select');state.view={x:0,y:0,scale:1};applyView()});await page.waitForTimeout(200);
    await page.locator('[data-desk-group=text]').click();await page.mouse.click(200,190);id=await page.evaluate(()=>state.selected[0]);await page.keyboard.insertText('Курсор сохраняется');await page.keyboard.press('Control+Backslash');await page.keyboard.insertText(' и в чистом режиме');await page.keyboard.press('Control+Backslash');await page.keyboard.insertText(' после возврата');
    o=await page.evaluate(id=>objects().find(o=>o.id===id),id);assert.equal(o.text,'Курсор сохраняется и в чистом режиме после возврата');passed.push('focus-mode toggle preserves text caret and draft');await page.keyboard.press('Escape');
    const zoom=await page.evaluate(()=>{const p=worldPoint(500,300);zoomAt(500,300,.005);return {before:p,after:worldPoint(500,300),scale:state.view.scale,label:document.querySelector('#zoomLabel').textContent}});
    assert.equal(zoom.scale,.005);assert.equal(zoom.label,'0.5%');assert(Math.abs(zoom.before.x-zoom.after.x)<.01);assert(Math.abs(zoom.before.y-zoom.after.y)<.01);passed.push('0.5% zoom with stable pointer anchor and readable label');
    const far=await page.evaluate(()=>{createObject('shape',{x:-45000,y:-28000,w:200,h:100});createObject('shape',{x:55000,y:36000,w:300,h:200});document.querySelector('#inspector').classList.add('collapsed');fitToContent();return {view:state.view,center:viewportCenter()}});
    assert(far.view.scale<.02);assert(far.view.scale>=.005);passed.push('fit includes distant positive and negative coordinates below old 12% cap');
    await page.evaluate(()=>{state.view={x:44000,y:27000,scale:1};applyView();setTool('text')});const farAnchor=await page.evaluate(()=>worldPoint(400,250));await page.mouse.click(400,250);await page.keyboard.insertText('Дальний участок');o=await page.evaluate(()=>selectedObjects()[0]);assert.equal(o.x,farAnchor.x);assert.equal(o.y,farAnchor.y);passed.push('text can be placed far outside the old 12000×8000 plane');await page.keyboard.press('Escape');
    await page.evaluate(()=>{state.view={x:0,y:0,scale:1};applyView();setTool('pen')});await page.mouse.move(350,550);await page.mouse.down();await page.mouse.move(550,630,{steps:15});await page.mouse.up();
    const ink=await page.evaluate(()=>{const o=objects().findLast(o=>o.type==='ink'),p=document.querySelector(`[data-id="${o.id}"] .ink-path`),q=p.getPointAtLength(p.getTotalLength()/2),s=new DOMPoint(q.x,q.y).matrixTransform(p.getScreenCTM());return {id:o.id,x:s.x,y:s.y,count:objects().length}});
    await page.locator('#canvasEraser').click();await page.mouse.click(ink.x,ink.y);assert.equal(await page.evaluate(id=>objects().some(o=>o.id===id),ink.id),false);await page.locator('#canvasUndo').click();assert.equal(await page.evaluate(id=>objects().some(o=>o.id===id),ink.id),true);assert.equal(await page.evaluate(()=>objects().length),ink.count);passed.push('eraser removes only a drawn stroke; one undo restores it');
    await page.locator('#canvasToolsClose').click();assert.equal(await page.locator('#workdeskTools').isVisible(),false);await page.locator('#canvasToolsRestore').click();assert.equal(await page.locator('#workdeskTools').isVisible(),true);passed.push('toolbar can hide and reopen without losing tool state');
    await page.evaluate(()=>{project().objects=objects().filter(o=>o.x>-1000&&o.x<4000);document.querySelector('#inspector').classList.remove('collapsed');const text=objects().find(o=>o.type==='text');text.x=160;text.y=230;const notebook=objects().find(o=>o.type==='note');if(notebook){notebook.x=650;notebook.y=480;}state.selected=[text.id];setTool('select');state.view={x:20,y:0,scale:1};renderAll(true);applyView()});
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'artifacts/canvas-ux-dark-408.png')});
    await page.evaluate(()=>{state.theme='light';applyTheme();renderAll(true)});assert.equal(await page.evaluate(()=>objects().find(o=>o.type==='text'&&o.textColorMode==='auto').textColor),'#202633');passed.push('default text stays readable in both themes');await page.screenshot({path:path.join(root,'artifacts/canvas-ux-light-408.png')});
    await page.keyboard.press('Control+Backslash');await page.screenshot({path:path.join(root,'artifacts/canvas-ux-focus-408.png')});await page.keyboard.press('Control+Backslash');
    for(const size of [{width:900,height:700},{width:390,height:844}]){
      await page.setViewportSize(size);await page.waitForTimeout(200);const t=await page.locator('#workdeskTools').boundingBox();assert(t&&t.x>=0&&t.x+t.width<=size.width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    passed.push('dock contained at desktop, tablet and 390px mobile widths');
    assert.deepEqual(errors,[]);passed.push('no JavaScript page errors');
    fs.writeFileSync(path.join(root,'artifacts/canvas-ux-408-results.json'),JSON.stringify({passed:passed.length,checks:passed,errors},null,2));
    console.log(`PASS ${passed.length} checks`);
  } finally {await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
