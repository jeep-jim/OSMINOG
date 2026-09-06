const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');

(async()=>{
 const http=require('http'),root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Security-Policy',"script-src 'self'; object-src 'self';");res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 fs.mkdirSync('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);await page.route('https://**',r=>r.abort());
 await page.addInitScript((manifest)=>{
   const data={};const event={addListener(){},removeListener(){},hasListener(){return false}};
   const storage={get(keys,cb){let r={};if(typeof keys==='string')r={[keys]:data[keys]};else if(Array.isArray(keys))for(const k of keys)r[k]=data[k];else r={...(keys||{}),...data};cb?.(r);return Promise.resolve(r)},set(values,cb){Object.assign(data,values);cb?.();return Promise.resolve()},remove(keys,cb){for(const key of [].concat(keys))delete data[key];cb?.();return Promise.resolve()}};
   window.chrome={runtime:{id:'test-osminog',getManifest:()=>manifest,getURL:p=>location.origin+'/'+p,onMessage:event,onConnect:event,lastError:null,sendMessage:async()=>({ok:false,error:'Chrome service mocked for local verification'}),connect:()=>({onMessage:event,onDisconnect:event,postMessage(){}})},storage:{local:storage,sync:storage,onChanged:event},permissions:{contains:async()=>false,request:async()=>false,onAdded:event,onRemoved:event},tabs:{query:async()=>[],onActivated:event,onRemoved:event,onUpdated:event},identity:{getRedirectURL:()=>location.origin+'/auth'},i18n:{getMessage:k=>k}};
   window.confirm=()=>true;
 },JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))));
 await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`,{waitUntil:'load'});await page.evaluate(()=>document.querySelector('#osminogStorageOnboarding')?.close());
 await page.waitForTimeout(1200);
 await page.evaluate(()=>{createProject();sessionStorage.setItem('osminogIntroDismissedV1','1');renderAll()});
 console.log('startup errors',errors);
 console.log('ready',await page.evaluate(()=>({canvas:!!window.OSMINOGEditorAPI,graphics:!!window.OSMINOGGraphicsStudio,apps:window.OSMINOGDesktopV3?.apps()})));
 const textButton=page.locator('[data-dock-key="core:text"]');await textButton.click();
 await page.locator('[data-new-text]').click();
 const field=page.locator('.canvas-object [contenteditable][data-placeholder]');await field.fill('Пояснение для всех ИИ');
 const newText=await page.evaluate(()=>objects().find(o=>o.text==='Пояснение для всех ИИ'));
 assert.ok(newText?.id,'text object created');
 const read=await page.evaluate(id=>OSMINOGDocuments.tool('document_read',{id}),newText.id);assert.equal(read.text,'Пояснение для всех ИИ');
 await page.locator('[data-dock-key="core:graphics"]').click();await page.waitForTimeout(300);
 await page.evaluate(()=>{document.documentElement.dataset.theme='ocean'});
 const first=await page.evaluate(()=>{
   const root=document.querySelector('#osminogGraphicsStudio'),r=s=>root.querySelector(s).getBoundingClientRect().toJSON();
   return{stage:r('.graphics-studio-stage'),tools:r('.graphics-studio-tools'),inspector:r('.graphics-studio-inspector'),details:[...root.querySelectorAll('.graphics-studio-inspector details')].map(d=>({height:d.getBoundingClientRect().height,scroll:d.scrollHeight,open:d.open})),status:OSMINOGGraphicsStudio.status()};
 });
 assert.ok(first.tools.y>=first.stage.bottom-1,'tools must be below stage');
 assert.ok(first.details.filter(x=>x.open).every(x=>x.height>=x.scroll-2),'open details must not shrink');
 assert.equal(first.status.document.transparent,true);
 await page.screenshot({path:'artifacts/graphics-layout.png'});
 console.log('layout',first);
 // Keyboard shortcuts and drawing are exercised through actual pointer events.
 await page.locator('#osminogGraphicsStudio').focus();await page.keyboard.press('b');
 await page.locator('[data-gfx-brush="width"]').evaluate(el=>{el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}))});
 const brush=await page.evaluate(()=>({w:OSMINOGGraphicsStudio.canvas().freeDrawingBrush.width,d:OSMINOGGraphicsStudio.canvas().freeDrawingBrush.decimate}));assert.equal(brush.w,9);
 const stage=await page.locator('.graphics-studio-stage').boundingBox();
 await page.mouse.move(stage.x+60,stage.y+70);await page.mouse.down();await page.mouse.move(stage.x+160,stage.y+120,{steps:15});await page.mouse.move(stage.x+230,stage.y+70,{steps:15});await page.mouse.up();
 const paths=await page.evaluate(()=>OSMINOGGraphicsStudio.canvas().getObjects().filter(o=>o.type.toLowerCase()==='path').length);assert.equal(paths,1);
 // Text can be created by the tool and formatted in the inspector.
 await page.locator('[data-gfx-tool="text"]').click();await page.mouse.click(stage.x+90,stage.y+190);await page.keyboard.type('Проба текста');await page.keyboard.press('Escape');
 await page.locator('[data-gfx-prop="fontWeight"]').selectOption('700');
 assert.equal(await page.evaluate(()=>OSMINOGGraphicsStudio.canvas().getObjects().find(o=>o.type.toLowerCase().includes('text')).fontWeight),700);
 // Group and ungroup uses Fabric 6, with position preservation.
 const grouping=await page.evaluate(async()=>{
   const c=OSMINOGGraphicsStudio.canvas(),a=new fabric.Rect({left:10,top:10,width:30,height:40,fill:'#ff0000'}),b=new fabric.Rect({left:80,top:20,width:40,height:30,fill:'#00ff00'});c.add(a,b);c.setActiveObject(new fabric.ActiveSelection([a,b],{canvas:c}));
   const before=[a,b].map(o=>o.getBoundingRect());
   const group=await OSMINOGGraphicsStudio.edit({scope:'studio',action:'group'});
   const grouped=c.getObjects().map(o=>o.type);const ungroup=await OSMINOGGraphicsStudio.edit({scope:'studio',action:'ungroup'});
   const after=[a,b].map(o=>o.getBoundingRect());return{group,ungroup,grouped,before,after};
 });assert.equal(grouping.group.ok,true);assert.equal(grouping.ungroup.ok,true);assert.deepEqual(grouping.after,grouping.before);
 // Undo must restore both the background and objects.
 await page.locator('[data-gfx-bg-transparent]').uncheck();await page.locator('[data-gfx-action="undo"]').click();await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>OSMINOGGraphicsStudio.status().document.transparent),true);
 // Synthetic paper/blue-ink fixture, generated in the browser for deterministic pixel assertions.
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=100;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,200,100);x.fillStyle='#1836a0';x.fillRect(40,30,80,30);return c.toDataURL('image/png')});
 await page.locator('[data-gfx-file]').setInputFiles({name:'paper-fixture.png',mimeType:'image/png',buffer:Buffer.from(fixture.split(',')[1],'base64')});
 await page.waitForFunction(()=>OSMINOGGraphicsStudio.canvas().getActiveObject()?.type.toLowerCase()==='image');
 const removed=await page.evaluate(()=>OSMINOGGraphicsStudio.edit({scope:'studio',action:'remove_white'}));assert.equal(removed.ok,true,removed.error);
 const alpha=await page.evaluate(()=>{const o=OSMINOGGraphicsStudio.canvas().getActiveObject(),c=document.createElement('canvas');c.width=200;c.height=100;const x=c.getContext('2d');x.drawImage(o.getElement(),0,0);return{paper:x.getImageData(0,0,1,1).data[3],ink:[...x.getImageData(50,40,1,1).data]}});
 assert.equal(alpha.paper,0);assert.deepEqual(alpha.ink,[24,54,160,255]);
 await page.locator('[data-gfx-action="undo"]').click();await page.waitForTimeout(150);
 await page.locator('[data-gfx-action="redo"]').click();await page.waitForTimeout(150);
 assert.ok((await page.evaluate(()=>OSMINOGGraphicsStudio.status().document.objects)).length>=3);
 // Eraser is a true alpha cutout and must survive PNG/desktop roundtrip.
 await page.locator('[data-gfx-tool="eraser"]').click();
 const eraserStage=await page.locator('.graphics-studio-stage').boundingBox();
 await page.mouse.move(eraserStage.x+110,eraserStage.y+105);await page.mouse.down();await page.mouse.move(eraserStage.x+155,eraserStage.y+105,{steps:12});await page.mouse.up();
 const erased=await page.evaluate(()=>{const c=OSMINOGGraphicsStudio.canvas();return{alpha:c.toCanvasElement(1).getContext('2d').getImageData(125,105,1,1).data[3],last:c.getObjects().at(-1).globalCompositeOperation}});
 assert.equal(erased.alpha,0);assert.equal(erased.last,'destination-out');
 const svg=await page.evaluate(()=>BriefCraftBridge.executeTool('graphics_edit',{scope:'studio',action:'export_svg'}));assert.equal(svg.ok,false);assert.ok(svg.error.includes('PNG'));
 // Out-of-view content must survive export; checkerboard must not enter the PNG.
 const info=await page.evaluate(async()=>{
   const c=OSMINOGGraphicsStudio.canvas();c.discardActiveObject();c.setViewportTransform([0.35,0,0,0.35,-180,50]);
   const expected=c.getObjects().filter(o=>o.name!=='__node').map(o=>({type:o.type,path:o.path,text:o.text}));
   const result=await OSMINOGGraphicsStudio.edit({scope:'studio',action:'export_to_canvas'});
   const o=objects().find(o=>o.id===result.created?.[0]?.id);return{result,object:o,expected,vt:c.viewportTransform};
 });assert.equal(info.result.ok,true,info.result.error);assert.equal(info.object.graphicsDocument.version,1);assert.deepEqual(info.vt,[0.35,0,0,0.35,-180,50]);
 fs.writeFileSync('artifacts/graphics-export.png',Buffer.from(info.object.src.split(',')[1],'base64'));
 const restored=await page.evaluate(async()=>{const result=await OSMINOGGraphicsStudio.openSelection();return{result,objects:OSMINOGGraphicsStudio.canvas().getObjects().map(o=>({type:o.type,path:o.path,text:o.text})),transparent:OSMINOGGraphicsStudio.status().document.transparent}});
 assert.equal(restored.result.ok,true);assert.deepEqual(restored.objects,info.expected);assert.equal(restored.transparent,true);
 await page.screenshot({path:'artifacts/graphics-with-drawing.png'});
 // Short viewport: scrolling must reach all inspector controls, footer remains outside stage.
 await page.setViewportSize({width:1100,height:760});await page.waitForTimeout(250);
 const compact=await page.evaluate(()=>{const root=document.querySelector('#osminogGraphicsStudio'),tools=root.querySelector('.graphics-studio-tools').getBoundingClientRect(),stage=root.querySelector('.graphics-studio-stage').getBoundingClientRect(),ins=root.querySelector('.graphics-studio-inspector');ins.scrollTop=ins.scrollHeight;return{toolsY:tools.y,stageBottom:stage.bottom,scrollHeight:ins.scrollHeight,height:ins.clientHeight,scrollTop:ins.scrollTop}});
 assert.ok(compact.toolsY>=compact.stageBottom-1);assert.ok(compact.scrollTop>0);
 await page.screenshot({path:'artifacts/graphics-compact.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync('artifacts/verification.json',JSON.stringify({checks:'passed',textRead:read,layout:first,brush,grouping,alpha,erased,roundtrip:{created:info.result.created,objects:restored.objects.length,transparent:restored.transparent},compact,errors},null,2));
 await browser.close();server.close();console.log('ALL CHECKS PASSED');
})().catch(error=>{console.error(error);process.exit(1)});

