'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createMouseExtensions,inspectManifest}=require('./mouse-extensions.cjs');
const manifest={manifest_version:3,name:'Fixture',version:'1.0',permissions:['storage'],content_scripts:[{matches:['https://example.com/*'],js:['safe.js']}]};
test('conservative Manifest V3 admits bounded sites but rejects privileged/executable capabilities',()=>{
 assert.deepEqual(inspectManifest(JSON.stringify(manifest)).sites,['https://example.com/*']);
 for(const change of [{manifest_version:2},{permissions:['nativeMessaging']},{host_permissions:['<all_urls>']},
 {host_permissions:['https://*.example.com/*']},{background:{service_worker:'x.js'}},{optional_permissions:['tabs']},
 {content_scripts:[{matches:['https://example.com/*'],world:'MAIN'}]},{host_permissions:['file:///*']}])
  assert.throws(()=>inspectManifest(JSON.stringify({...manifest,...change})));
});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-ext-unit-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),storage=path.join(root,'managed');await fs.mkdir(source);
 await fs.writeFile(path.join(source,'manifest.json'),JSON.stringify(manifest));await fs.writeFile(path.join(source,'safe.js'),'void 0');
 const calls=[];let available=true,decision=1,onConfirm=()=>{};
 const session={storagePath:path.join(root,'session'),extensions:{loadExtension:async(p,o)=>{calls.push(['load',p,o]);return{id:'native-id'};},
 removeExtension:id=>calls.push(['remove',id])}};
 const dialog={showOpenDialog:async()=>({canceled:false,filePaths:[source]}),showMessageBox:async(_win,o)=>{
  calls.push(['consent',o]);await onConfirm();return{response:decision};}};
 const create=()=>createMouseExtensions({session,dialog,storage,isAvailable:()=>available});
 return {source,storage,calls,create,set available(x){available=x},set decision(x){decision=x},set confirm(x){onConfirm=x}};
}
test('explicit consent, verified managed copy, pin and enable survive restoring; removing keeps bytes',async t=>{
 const f=await fixture(t),m=f.create();
 assert.deepEqual(await m.restore(),[]);
 const [row]=await m.install(),id=row.id; assert.equal(row.enabled,true);assert.equal(row.pinned,false);
 const [consent,load]=f.calls;assert.equal(consent[0],'consent');assert.match(consent[1].detail,/storage.*\nСайты: https:\/\/example\.com/);
 assert.equal(load[1],path.join(f.storage,'packages',id));assert.deepEqual(load[2],{allowFileAccess:false});
 await m.setPinned(id,true);await m.setEnabled(id,false);
 const r=f.create();assert.deepEqual(await r.restore(),[{...row,enabled:false,pinned:true}]);await r.setEnabled(id,true);
 assert.deepEqual(await r.remove(id),[]);assert.equal(await fs.readFile(path.join(load[1],'safe.js'),'utf8'),'void 0');
});
test('cancel and entering private after prompt cannot load; session must be persistent',async t=>{
 const f=await fixture(t),m=f.create();f.decision=0;assert.deepEqual(await m.install(),[]);
 f.decision=1;f.confirm=()=>{f.available=false};
 await assert.rejects(m.install(),/обычном режиме/);
 assert.equal(f.calls.filter(c=>c[0]==='load').length,0);assert.deepEqual(m.state(),[]);
 assert.throws(()=>createMouseExtensions({session:{extensions:{loadExtension(){},removeExtension(){}}},storage:f.storage}),/постоянный/);
});
test('source changes after consent or managed changes before restore fail closed; never load symlink',async t=>{
 const f=await fixture(t),m=f.create();f.confirm=()=>fs.writeFile(path.join(f.source,'safe.js'),'changed');
 await assert.rejects(m.install(),/изменилось/);
 assert.equal(f.calls.filter(c=>c[0]==='load').length,0);
 f.confirm=()=>{};const [row]=await m.install();
 const target=path.join(f.storage,'packages',row.id,'safe.js');
 await fs.writeFile(target,'changed managed content');
 const n=f.create();const [restored]=await n.restore();assert.equal(restored.enabled,false);assert.equal(restored.error,'load_failed');
 assert.equal(f.calls.filter(c=>c[0]==='load').length,1);
 if(process.platform!=='win32'){
  await fs.symlink(path.join(f.source,'safe.js'),path.join(f.source,'linked.js'));
  await assert.rejects(n.install(),/обычные файлы/);
 }
});
test('only a bounded manifest-selected PNG is exposed, never paths or raw manifest data',async t=>{
 const f=await fixture(t),m=f.create();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCSsAAAAASUVORK5CYII=','base64');
 await fs.writeFile(path.join(f.source,'icon.png'),png);
 await fs.writeFile(path.join(f.source,'manifest.json'),JSON.stringify({...manifest,icons:{'32':'icon.png'}}));
 const [row]=await m.install();assert.equal(row.icon,'data:image/png;base64,'+png.toString('base64'));assert.ok(!Object.hasOwn(row,'path'));
 assert.equal(inspectManifest(JSON.stringify({...manifest,icons:{'32':'../icon.png'}})).iconRel,undefined);
});
test('opens only a declared managed HTML resource for an enabled registered extension',async t=>{
 const f=await fixture(t);const id='a'.repeat(32);const registry=new Map();
 const browserSession={storagePath:f.storage,extensions:{
  loadExtension:async folder=>{const e={id,path:folder};registry.set(id,e);return e;},
  getExtension:key=>registry.get(key),removeExtension:key=>registry.delete(key)
 }};
 const m=createMouseExtensions({storage:f.storage,session:browserSession,dialog:{
  showOpenDialog:async()=>({filePaths:[f.source]}),showMessageBox:async()=>({response:1})
 },isAvailable:()=>allowed});
 let allowed=true;
 await fs.mkdir(path.join(f.source,'ui'));
 await fs.writeFile(path.join(f.source,'ui','panel.html'),'<title>Fixture</title>');
 await fs.writeFile(path.join(f.source,'manifest.json'),JSON.stringify({...manifest,action:{default_popup:'ui/panel.html'}}));
 const [row]=await m.install();
 assert.equal(row.actionPopup,true);
 const info=await m.openPage(row.id,x=>x);
 assert.deepEqual(info,{url:'chrome-extension://'+id+'/ui/panel.html',extensionId:id});
 assert.ok(Object.isFrozen(info));
 registry.delete(id);
 await assert.rejects(m.openPage(row.id,()=>assert.fail()),/не загружено/);
 registry.set(id,{id,path:'/different'});
 await assert.rejects(m.openPage(row.id,()=>assert.fail()),/не загружено/);
 await m.setEnabled(row.id,false);
 await assert.rejects(m.openPage(row.id,()=>assert.fail()),/включите/);
 await m.setEnabled(row.id,true);
 allowed=false;
 await assert.rejects(m.openPage(row.id,()=>assert.fail()),/обычном режиме/);
 allowed=true;
 await fs.writeFile(path.join(f.storage,'packages',row.id,'ui/panel.html'),'<title>tampered</title>');
 await assert.rejects(m.openPage(row.id,()=>assert.fail()),/изменились/);
});
test('only strict relative packaged HTML action declarations may be opened',()=>{
 for(const value of ['https://example.com/a.html','../a.html','/a.html','a/../b.html','%2e%2e/a.html','a.html?x','a.html#x','a.svg','a.js','a\\b.html'])
   assert.equal(inspectManifest(JSON.stringify({...manifest,action:{default_popup:value}})).popupRel,null,value);
 assert.equal(inspectManifest(JSON.stringify({...manifest,action:{default_popup:'a/b.html'}})).popupRel,'a/b.html');
});
