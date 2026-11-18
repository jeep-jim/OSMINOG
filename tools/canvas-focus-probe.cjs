'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
  const root=path.resolve(process.env.OSMINOG_PROBE_ROOT||path.join(__dirname,'..')),server=http.createServer((req,res)=>{
    const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!name.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(name,(e,data)=>{if(e)return res.writeHead(404).end();const ext=path.extname(name);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.mjs':'text/javascript'})[ext]||'application/octet-stream');res.end(data)});
  });
  let browser,page;const passed=[],errors=[];
  const mode=process.argv[2]||'after-click';
  assert(['after-click','before-click','after-input'].includes(mode),'Unknown probe mode');
  const outputDir=path.resolve(process.env.OSMINOG_PROBE_OUTPUT||path.join(__dirname,'probe-artifacts'));
  fs.mkdirSync(outputDir,{recursive:true});
  const sourceHashes={"tests/canvas-ux-408.cjs":"ce7fc2c6d0837e6bbc605f290733b271d99a710d384f9d795e2682061d2cd620","editor.js":"47d59c66da6fff242d55ec39c9d6845dd502851fdceb707179f24cdd061c3535","editor.html":"18e8cf62bd879cfefc4fddb15683892b3065e18ba731e8bd6c39401a9fa6f158","osminog-canvas-ux.js":"646faafbd4c7d3e1f85bedecd22eca137c7bdd3b7e87b60139dc2d6ea1a71f06","osminog-canvas-budget.js":"0bbaf97d2f690ef88a572a66206e2d9e89f0d6d0ac9c5488ab0dd7b69ebb9c50","osminog-canvas-ux.css":"6d42b181d9ac644c7e6461e5d208941f334bb7cbcd07bc5c5876a8dc688daba1","editor.css":"3f553504a9b3f096b0f7eb21fdd4e49b02f02dbf306a14b35fbaff8a5ea67ef4"};
  for(const [name,expected] of Object.entries(sourceHashes))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),expected,'Probe needs unchanged d6b1 source: '+name);
  const check=(label,fn)=>{fn();passed.push(label);console.log('PASS',label)};
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM||undefined,args:['--no-sandbox']});
    page=await browser.newPage({viewport:{width:1600,height:1000}});
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
    await page.evaluate(()=>setTool('text'));
    assert.equal(await page.evaluate(()=>state.tool),'text');assert.equal(await page.locator('#deskMore').isVisible(),false);assert.equal(await page.locator('#workdeskViewer').isVisible(),false);
    passed.push('text tool remains available to keyboard and canvas editing');
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
    await page.locator('#canvasSettings').click();
    assert.equal(await page.locator('#inspector').isVisible(),true);
    await page.locator('[data-canvas-text-prop=fontSize]').fill('42');await page.locator('[data-canvas-text-prop=fontFamily]').selectOption('Georgia, serif');
    assert.equal(await field.evaluate(el=>getComputedStyle(el).fontSize),'42px');assert.match(await field.evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
    passed.push('right inspector changes size and font without replacing text');
    await page.evaluate(()=>setTool('text'));const before=await page.evaluate(()=>objects().length);await field.click();assert.equal(await page.evaluate(()=>objects().length),before);assert(await field.evaluate(el=>el===document.activeElement));
    passed.push('T click edits an existing text object instead of duplicating it');
    await page.keyboard.press('Escape');await page.evaluate(()=>setTool('text'));await page.mouse.click(800,460);await page.keyboard.press('Escape');await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>objects().length),before);passed.push('unused empty text insertion is discarded');
    await page.evaluate(()=>setTool('pen'));await page.locator('[data-desk-group=magic]').click({button:'right'});
    assert(await page.locator('#deskMore').isVisible());assert.equal(await page.locator('#deskMore [data-desk=pen]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#deskMore [data-desk]:not(:has(svg))').count(),0);
    const menu=await page.locator('#deskMore').boundingBox();assert(menu.y+menu.height<toolbar.y);passed.push('secondary menus open above toolbar, with SVG icons and active dot');
    await page.keyboard.press('Escape');await page.evaluate(()=>OSMINOGWorkdesk.addText('markdown'));assert(await page.locator('#workdeskViewer').isVisible());await page.locator('#workdeskText').fill('Блокнот остаётся отдельным инструментом');await page.locator('#workdeskClose').click();
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
    await page.evaluate(()=>setTool('text'));await page.mouse.click(200,190);id=await page.evaluate(()=>state.selected[0]);await page.keyboard.insertText('Курсор сохраняется');await page.keyboard.press('Control+Backslash');await page.keyboard.insertText(' и в чистом режиме');await page.keyboard.press('Control+Backslash');await page.keyboard.insertText(' после возврата');
    o=await page.evaluate(id=>objects().find(o=>o.id===id),id);assert.equal(o.text,'Курсор сохраняется и в чистом режиме после возврата');passed.push('focus-mode toggle preserves text caret and draft');await page.keyboard.press('Escape');
    const zoom=await page.evaluate(()=>{const p=worldPoint(500,300);zoomAt(500,300,.005);return {before:p,after:worldPoint(500,300),scale:state.view.scale,label:document.querySelector('#zoomLabel').textContent}});
    assert.equal(zoom.scale,.005);assert.equal(zoom.label,'0.5%');assert(Math.abs(zoom.before.x-zoom.after.x)<.01);assert(Math.abs(zoom.before.y-zoom.after.y)<.01);passed.push('0.5% zoom with stable pointer anchor and readable label');
    const far=await page.evaluate(()=>{createObject('shape',{x:-45000,y:-28000,w:200,h:100});createObject('shape',{x:55000,y:36000,w:300,h:200});document.querySelector('#inspector').classList.add('collapsed');fitToContent();return {view:state.view,center:viewportCenter()}});
    assert(far.view.scale<.02);assert(far.view.scale>=.005);passed.push('fit includes distant positive and negative coordinates below old 12% cap');

    // Finish earlier viewport callbacks before arming this explicit scheduler probe.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
    const probeBefore=await page.evaluate(()=>({selected:[...state.selected],activeId:state.activeEditable?.closest('.canvas-object')?.dataset.id,activeConnected:!!state.activeEditable?.isConnected,focused:document.activeElement?.outerHTML.slice(0,100),mounted:[...document.querySelectorAll('#objects>.canvas-object')].map(e=>e.dataset.id)}));
    await page.evaluate(()=>{
      const log=[];window.__canvasProbeLog=log;
      const brief=el=>el?{tag:el.tagName,id:el.id,objectId:el.closest?.('.canvas-object')?.dataset.id,field:el.dataset?.field}:null;
      const snap=kind=>log.push({kind,at:performance.now(),selected:[...state.selected],active:brief(document.activeElement),activeEditable:brief(state.activeEditable)});
      for(const type of ['focusin','focusout','blur','input'])document.addEventListener(type,e=>{log.push({kind:type,target:brief(e.target),at:performance.now(),selected:[...state.selected],active:brief(document.activeElement)})},true);
      const nativeInsert=Node.prototype.insertBefore;
      Node.prototype.insertBefore=function(node,ref){
        if(this.id==='objects')log.push({kind:'insertBefore-before',node:brief(node),ref:brief(ref),active:brief(document.activeElement),at:performance.now()});
        const value=nativeInsert.call(this,node,ref);
        if(this.id==='objects')log.push({kind:'insertBefore-after',node:brief(node),ref:brief(ref),active:brief(document.activeElement),at:performance.now()});
        return value;
      };
      // BEGIN HELD_RAF_SCHEDULER: extracted unchanged by the focused unit test.
      function heldRafScheduler(nativeRequest,nativeCancel,record,receiver){
        const held=new Map();let holding=true;
        return {
          request(callback){
            if(!holding)return nativeRequest(callback);
            // Allocate an actual browser handle, then cancel its placeholder.
            // Never guess a numeric range that could collide with native IDs.
            const id=nativeRequest(()=>{});nativeCancel(id);
            if(held.has(id))throw new Error('Native RAF reused an outstanding held handle');
            held.set(id,callback);record({kind:'held-raf',id,callback:String(callback).slice(0,180)});return id;
          },
          cancel(id){
            const removed=held.delete(id);nativeCancel(id);
            if(removed)record({kind:'cancel-held-raf',id});
          },
          flush(at){
            holding=false;
            for(const id of [...held.keys()]){
              const callback=held.get(id);if(!held.delete(id))continue;
              record({kind:'run-held-raf',id});callback.call(receiver,at);
            }
          }
        };
      }
      // END HELD_RAF_SCHEDULER
      const realRAF=window.requestAnimationFrame.bind(window),realCancelRAF=window.cancelAnimationFrame.bind(window);
      const scheduler=heldRafScheduler(realRAF,realCancelRAF,event=>log.push({...event,at:performance.now()}),window);
      window.requestAnimationFrame=callback=>scheduler.request(callback);
      window.cancelAnimationFrame=id=>scheduler.cancel(id);
      window.__flushCanvasProbe=()=>new Promise(resolve=>{
        realRAF(at=>{snap('before-held-raf');scheduler.flush(at);queueMicrotask(()=>{snap('after-held-raf-microtasks');resolve()})});
      });
      state.view={x:44000,y:27000,scale:1};applyView();setTool('text');snap('after-far-view');
    });
    const farAnchor=await page.evaluate(()=>worldPoint(400,250));
    if(mode==='before-click')await page.evaluate(()=>__flushCanvasProbe());
    await page.mouse.click(400,250);
    const clicked=await page.evaluate(()=>({selected:[...state.selected],activeId:state.activeEditable?.closest('.canvas-object')?.dataset.id,activeConnected:!!state.activeEditable?.isConnected,activeIsField:document.activeElement===state.activeEditable,objects:objects().filter(o=>o.type==='text').map(o=>({id:o.id,text:o.text,x:o.x,y:o.y})),mounted:[...document.querySelectorAll('#objects>.canvas-object')].map(e=>e.dataset.id)}));
    if(mode==='after-click')await page.evaluate(()=>__flushCanvasProbe());
    await page.keyboard.insertText('Дальний участок');
    if(mode==='after-input')await page.evaluate(()=>__flushCanvasProbe());
    const outcome=await page.evaluate(()=>({selected:[...state.selected],selectedObject:selectedObjects()[0]||null,activeId:state.activeEditable?.closest('.canvas-object')?.dataset.id,activeConnected:!!state.activeEditable?.isConnected,activeIsField:document.activeElement===state.activeEditable,objects:objects().filter(o=>o.type==='text').map(o=>({id:o.id,text:o.text,x:o.x,y:o.y})),log:window.__canvasProbeLog}));
    const report={probe:'controlled-RAF-order-on-unchanged-d6b1-source',mode,browserVersion:browser.version(),sourceHashes,nativeRunCauseProven:false,before:probeBefore,clicked,farAnchor,outcome,errors};
    fs.writeFileSync(path.join(outputDir,'probe-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PROBE',JSON.stringify({mode,browserVersion:report.browserVersion,before:probeBefore,clicked,outcome:{selected:outcome.selected,object:outcome.selectedObject?{id:outcome.selectedObject.id,text:outcome.selectedObject.text,x:outcome.selectedObject.x,y:outcome.selectedObject.y}:null,activeConnected:outcome.activeConnected,activeIsField:outcome.activeIsField},events:outcome.log.map(e=>({kind:e.kind,node:e.node?.objectId,ref:e.ref?.objectId,target:e.target?.objectId,active:e.active?.objectId,callback:e.callback})),errors}));

    assert.deepEqual(errors,[],'No page errors in controlled probe');
    assert(probeBefore.activeConnected&&probeBefore.activeId,'Fixture retains the previous activeEditable');
    assert(clicked.activeIsField&&clicked.selected.length===1,'Click created and focused one real text object');
    const createdId=clicked.selected[0];
    assert(clicked.mounted.includes(probeBefore.activeId)&&clicked.mounted.includes(createdId),'Old and new text nodes are both mounted before controlled RAF');
    assert(outcome.log.some(e=>e.kind==='held-raf'&&e.callback.includes('renderObjects')),'Actual scheduled viewport redraw was held');
    if(mode==='after-click'){
      assert.equal(outcome.selectedObject,null,'Expected candidate: pending redraw discards blank fresh text before input');
      assert(!outcome.objects.some(o=>o.id===createdId),'The empty object was removed from the real model');
      assert(outcome.log.some(e=>e.kind==='insertBefore-before'&&e.node?.objectId===createdId&&e.active?.objectId===createdId),'Actual renderObjects moved the focused new node');
      assert(outcome.log.some(e=>e.kind==='focusout'&&e.target?.objectId===createdId),'The moved field emitted native focusout');
    }else{
      assert.equal(outcome.selectedObject?.text,'Дальний участок','Control retains the actual typed text');
      assert.equal(outcome.selectedObject.x,farAnchor.x);assert.equal(outcome.selectedObject.y,farAnchor.y);
    }
    console.log('CAUSAL CHECK',mode,mode==='after-click'?'candidate reproduced':'control retained');
  } catch(error) {
    const failure={mode,message:error.message,stack:error.stack,errors,nativeRunCauseProven:false};
    try{if(page){failure.dom=await page.evaluate(()=>({selected:typeof state==='undefined'?null:[...state.selected],active:document.activeElement?.outerHTML.slice(0,500),log:window.__canvasProbeLog||[]}));await page.screenshot({path:path.join(outputDir,'probe-'+mode+'-failure.png')})}}catch(snapshotError){failure.snapshotError=snapshotError.message}
    fs.writeFileSync(path.join(outputDir,'probe-'+mode+'-failure.json'),JSON.stringify(failure,null,2)+'\n');
    throw error;
  } finally {await browser?.close();await new Promise(r=>server.listening?server.close(r):r())}
})().catch(e=>{console.error(e);process.exitCode=1});
