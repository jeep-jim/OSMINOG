'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const CRX=require('./mouse-extension-crx.cjs'),{packageZip}=require('./mouse-document-fixtures.cjs');
const {EventEmitter}=require('node:events'),{Readable}=require('node:stream');
// Only this unit harness admits a private developer signature. Production has
// no injected verifier, no publisher bypass, and the native acceptance downloads
// a real Google-signed CRX. These tests cover manager transactions, not CWS trust.
function privatePackage(){
 const varint=value=>{const out=[];do{let b=value&127;value=Math.floor(value/128);if(value)b|=128;out.push(b);}while(value);return Buffer.from(out);},field=(n,b)=>Buffer.concat([varint(n*8+2),varint(b.length),b]);
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pub=publicKey.export({type:'spki',format:'der'}),hash=crypto.createHash('sha256').update(pub).digest(),id=hash.subarray(0,16).toString('hex').replace(/[\da-f]/g,c=>String.fromCharCode(97+parseInt(c,16))),header=field(1,hash.subarray(0,16)),size=Buffer.alloc(4);size.writeUInt32LE(header.length);
 const archive=packageZip({'manifest.json':JSON.stringify({manifest_version:3,name:'Owned manager unit fixture',version:'1.2.3',permissions:['storage'],host_permissions:['https://owned.example/*'],action:{default_popup:'popup.html'},background:{service_worker:'background.js'}}),'popup.html':'<title>Owned fixture</title>','background.js':'void 0;'}),signature=crypto.sign('SHA256',Buffer.concat([Buffer.from('CRX3 SignedData\0'),size,header,archive]),privateKey),protobuf=Buffer.concat([field(3,Buffer.concat([field(1,pub),field(2,signature)])),field(10000,header)]),prefix=Buffer.alloc(12);prefix.write('Cr24');prefix.writeUInt32LE(3,4);prefix.writeUInt32LE(protobuf.length,8);return{id,bytes:Buffer.concat([prefix,protobuf,archive])};
}
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse638-manager-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const unit=privatePackage(),module={exports:{}},calls=[],loaded=new Map();let available=true,response=1,valid=true,onConfirm=()=>{},onRegistryWrite=()=>{},onChanged=()=>{},loadId=unit.id;
 const shim={...CRX,verifyCrx:(bytes,id)=>CRX.verifyCrx(bytes,id,{requirePublisher:false}),downloadCrx:async({fetch,id,chromeVersion,signal})=>{calls.push(['download']);const response=await fetch(CRX.downloadURL(id,chromeVersion),{redirect:'manual',credentials:'omit',cache:'no-store',signal}),parts=[];assert.equal(response.status,200);for await(const part of response.body)parts.push(Buffer.from(part));const bytes=Buffer.concat(parts);assert.deepEqual(bytes,unit.bytes);const result=CRX.verifyCrx(bytes,unit.id,{requirePublisher:false});return{...result,bytes,evidence:{...result.evidence,requestedURL:'https://clients2.google.com/owned-unit-only',downloadURL:'https://clients2.googleusercontent.com/owned-unit-only',downloadedAt:new Date().toISOString()}};}};
 const storeFS={...fs,rename:async(...args)=>{const result=await fs.rename(...args);if(args[1]===path.join(root,'web-store','registry.json'))await onRegistryWrite();return result;}};
 vm.runInNewContext('(function(require,module,exports){'+fsSync.readFileSync(path.join(__dirname,'mouse-web-store-manager.cjs'),'utf8')+'\n})',{Buffer,Map,Set,Promise,structuredClone,process,Date})(name=>name==='./mouse-extension-crx.cjs'?shim:name==='node:fs/promises'?storeFS:require(name),module,module.exports);
 const session={fetch:async()=>assert.fail('Manager must use the manual Chromium transport'),extensions:{loadExtension:async(folder,options)=>{calls.push(['load',folder,options]);const ext={id:loadId,path:folder,manifest:JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'))};loaded.set(loadId,ext);return ext;},getExtension:id=>loaded.get(id),removeExtension:id=>{calls.push(['unload',id]);loaded.delete(id);}}},dialog={showMessageBox:async(_win,options)=>{calls.push(['consent',options]);await onConfirm();return{response};}};
 const requests=[],request=options=>{requests.push(options);const req=new EventEmitter();req.abort=()=>req.emit('abort');req.end=()=>queueMicrotask(()=>{const body=Readable.from([unit.bytes]);Object.assign(body,{statusCode:200,headers:{'content-length':String(unit.bytes.length)}});req.emit('response',body);});return req;};
 const create=()=>module.exports.createStoreManager({session,dialog,storage:root,isAvailable:()=>available,onChanged:()=>onChanged(),chromeVersion:'152.0.0.0',request});
 return{root,id:unit.id,bytes:unit.bytes,calls,loaded,create,requests,session,guard:()=>valid,set available(v){available=v;},set response(v){response=v;},set valid(v){valid=v;},set onConfirm(v){onConfirm=v;},set onRegistryWrite(v){onRegistryWrite=v;},set onChanged(v){onChanged=v;},set loadId(v){loadId=v;}};
}
test('store install shows the signed manifest, uses the verified ID and restores pin/disable state',async t=>{
 const f=await fixture(t),manager=f.create();assert.equal((await manager.restore()).length,0);const rows=await manager.installStore(f.id),row=rows[0];assert.equal(row.id,f.id);assert.equal(row.name,'Owned manager unit fixture');assert.equal(row.source,'chrome-web-store');assert.equal(row.enabled,true);
 assert.deepEqual(f.calls.map(c=>c[0]),['download','consent','load']);assert.match(f.calls[1][1].message,/Owned manager unit fixture 1.2.3/);assert.match(f.calls[1][1].detail,/https:\/\/owned.example\/\*/);assert.deepEqual(JSON.parse(JSON.stringify(f.calls[2][2])),{allowFileAccess:false});assert.equal(manager.storeEvidence(f.id).installedFilesVerified,3);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].session,f.session);assert.equal(f.requests[0].redirect,'manual');assert.equal(f.requests[0].credentials,'omit');assert.equal(f.requests[0].useSessionCookies,false);
 await manager.setPinned(f.id,true);await manager.setEnabled(f.id,false);const restored=f.create(),saved=(await restored.restore())[0];assert.equal(saved.pinned,true);assert.equal(saved.enabled,false);assert.equal(saved.error,undefined);assert.equal(f.calls.filter(c=>c[0]==='load').length,1);
 await restored.setEnabled(f.id,true);assert.equal(restored.chromiumId(f.id),f.id);const page=await restored.openPage(f.id,value=>value);assert.equal(page.url,'chrome-extension://'+f.id+'/popup.html');const directory=f.loaded.get(f.id).path;
 await restored.remove(f.id);assert.equal(restored.state().length,0);assert.ok((await fs.stat(path.join(directory,'manifest.json'))).isFile(),'User-owned package bytes survive removing the active registry entry');
});
test('cancel, page navigation and privacy transition after consent never execute an extension',async t=>{
 const f=await fixture(t),manager=f.create();f.response=0;await assert.rejects(manager.installStore(f.id),/отменена/);f.response=1;f.onConfirm=()=>{f.valid=false;};await assert.rejects(manager.installStore(f.id,{valid:f.guard}),/Страница установки/);
 f.valid=true;f.onConfirm=()=>{f.available=false;};await assert.rejects(manager.installStore(f.id),/обычном режиме/);assert.equal(f.calls.filter(c=>c[0]==='load').length,0);assert.equal(manager.state().length,0);
});
test('Chromium ID mismatch removes the rejected extension and leaves no active registry',async t=>{
 const f=await fixture(t),manager=f.create();f.loadId='b'.repeat(32);await assert.rejects(manager.installStore(f.id),/ID загруженного/);assert.equal(f.loaded.size,0);assert.equal(manager.state().length,0);assert.deepEqual(await fs.readdir(path.join(f.root,'web-store','packages')),[]);
});
test('restoration re-verifies signed bytes and every unpacked byte before loading',async t=>{
 const f=await fixture(t),manager=f.create();await manager.installStore(f.id);const registry=path.join(f.root,'web-store','registry.json'),saved=await fs.readFile(registry,'utf8'),folder=f.loaded.get(f.id).path,original=await fs.readFile(path.join(folder,'background.js'));
 await fs.writeFile(path.join(folder,'background.js'),'changed');const after=f.calls.filter(c=>c[0]==='load').length,failed=(await f.create().restore())[0];assert.equal(failed.enabled,false);assert.equal(failed.error,'load_failed');assert.equal(f.calls.filter(c=>c[0]==='load').length,after);assert.equal(await fs.readFile(registry,'utf8'),saved);
 await fs.writeFile(path.join(folder,'background.js'),original);await fs.writeFile(path.join(folder,'unexpected.js'),'untrusted extra file');assert.equal((await f.create().restore())[0].error,'load_failed');await fs.unlink(path.join(folder,'unexpected.js'));
 const crx=path.join(path.dirname(folder),'extension.crx'),bytes=await fs.readFile(crx);bytes[bytes.length-30]^=1;await fs.writeFile(crx,bytes);assert.equal((await f.create().restore())[0].error,'load_failed');assert.equal(f.calls.filter(c=>c[0]==='load').length,after);
});
test('failed atomic registry commit unloads the new extension instead of reporting an installed success',async t=>{
 const f=await fixture(t),manager=f.create();await manager.restore();await fs.mkdir(path.join(f.root,'web-store','registry.json'));await assert.rejects(manager.installStore(f.id));assert.equal(manager.state().length,0);assert.equal(f.loaded.size,0);assert.deepEqual(await fs.readdir(path.join(f.root,'web-store','packages')),[]);
});

test('navigation, privacy or abort during the real registry rename rolls back disk, loaded state and package before completion',async t=>{
 for(const reason of ['navigation','privacy','abort']){
  const f=await fixture(t),manager=f.create(),controller=new AbortController();await manager.restore();let commits=0;const persisted=[];
  f.onRegistryWrite=async()=>{persisted.push(JSON.parse(await fs.readFile(path.join(f.root,'web-store','registry.json'),'utf8')).length);if(reason==='navigation')f.valid=false;else if(reason==='privacy')f.available=false;else controller.abort();};
  await assert.rejects(manager.installStore(f.id,{valid:f.guard,signal:controller.signal,onCommit:()=>{commits++;}}),reason==='privacy'?/обычном режиме/:/Страница установки/);
  assert.equal(commits,0);assert.deepEqual(persisted,[1,0]);assert.equal(f.loaded.size,0);assert.equal(manager.chromiumId(f.id),null);assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.root,'web-store','registry.json'),'utf8')),[]);assert.deepEqual(await fs.readdir(path.join(f.root,'web-store','packages')),[]);
  f.available=true;f.valid=true;assert.equal(manager.state().length,0);assert.equal((await f.create().restore()).length,0);
 }
});

test('a rejected final commit restores the previous disabled pinned registry and keeps its original package',async t=>{
 const f=await fixture(t),manager=f.create();await manager.installStore(f.id);await manager.setPinned(f.id,true);await manager.setEnabled(f.id,false);
 const registry=path.join(f.root,'web-store','registry.json'),before=await fs.readFile(registry,'utf8'),packages=await fs.readdir(path.join(f.root,'web-store','packages'));let commitCalls=0;
 await assert.rejects(manager.installStore(f.id,{onCommit:()=>{commitCalls++;assert.equal(f.loaded.size,1);throw Error('Owned final context changed');}}),/Owned final context changed/);
 assert.equal(commitCalls,1);assert.equal(await fs.readFile(registry,'utf8'),before);assert.deepEqual(await fs.readdir(path.join(f.root,'web-store','packages')),packages);assert.equal(f.loaded.size,0);assert.equal(manager.state()[0].enabled,false);assert.equal(manager.state()[0].pinned,true);
});

test('Store completion observes the actual loaded ID and persisted registry before later owner changes, including already loaded entries',async t=>{
 const f=await fixture(t),manager=f.create();await manager.restore();const order=[];
 f.onChanged=()=>{order.push('changed');f.valid=false;};
 await manager.installStore(f.id,{valid:f.guard,onCommit:()=>{order.push('commit');assert.equal(f.guard(),true);assert.equal(manager.chromiumId(f.id),f.id);assert.equal(JSON.parse(fsSync.readFileSync(path.join(f.root,'web-store','registry.json'),'utf8'))[0].id,f.id);}});
 assert.deepEqual(order,['commit','changed']);assert.equal(f.loaded.size,1);assert.equal(manager.state()[0].enabled,true);f.valid=true;
 let alreadyLoaded=0;await manager.installStore(f.id,{valid:f.guard,onCommit:()=>{alreadyLoaded++;assert.equal(manager.chromiumId(f.id),f.id);}});assert.equal(alreadyLoaded,1);assert.equal(f.calls.filter(call=>call[0]==='download').length,1);
});
