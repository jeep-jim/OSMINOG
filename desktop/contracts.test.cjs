const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{Store}=require('./storage.cjs');
test('durable serialized writes, defaults, deletion and readable backup',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-'));try{const s=new Store(dir);await Promise.all([s.set({a:1}),s.set({b:2})]);assert.deepEqual(await new Store(dir).get(null),{a:1,b:2});await s.remove('a');assert.deepEqual(await s.get({a:3,b:0}),{a:3,b:2});assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'workspace.json.bak'),'utf8')),{a:1,b:2})}finally{await fs.rm(dir,{recursive:true,force:true})}});
test('corruption never silently resets a workspace',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-'));try{await fs.writeFile(path.join(dir,'workspace.json'),'broken');const s=new Store(dir);await assert.rejects(s.set({a:1}));assert.equal(await fs.readFile(path.join(dir,'workspace.json'),'utf8'),'broken')}finally{await fs.rm(dir,{recursive:true,force:true})}});

test('Windows identity repairs only shortcuts targeting this executable',async()=>{
 require('./build-icons.cjs');const {installIdentity,applyTaskbar,APP_ID}=require('./windows-identity.cjs');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-identity-'));
 try{const folders={userData:path.join(dir,'profile'),desktop:path.join(dir,'desktop'),appData:path.join(dir,'roaming')};for(const p of Object.values(folders))await fs.mkdir(p,{recursive:true});const own=path.join(folders.desktop,'OSMINOG.lnk'),other=path.join(folders.desktop,'Other.lnk');await fs.writeFile(own,'fixture');await fs.writeFile(other,'fixture');const exe=path.join(dir,'OSMINOG.exe'),writes=[];let details;
  const icon=installIdentity({platform:'win32',executable:exe,app:{getPath:k=>folders[k],setAppUserModelId:id=>assert.equal(id,APP_ID)},shell:{readShortcutLink:f=>({target:f===own?exe:path.join(dir,'Other.exe')}),writeShortcutLink:(...args)=>writes.push(args)}});
  applyTaskbar({setAppDetails:d=>details=d,setIcon:i=>assert.equal(i,icon)},icon,exe);
  assert.equal(writes.length,1);assert.equal(writes[0][0],own);assert.equal(writes[0][1],'update');assert.equal(writes[0][2].appUserModelId,APP_ID);assert.equal(details.appIconPath,icon);assert.equal(details.relaunchCommand,`"${exe}"`);assert.ok((await fs.stat(icon)).size>1000);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('metadata cache avoids full project reads, bounds retention, invalidates and returns independent objects',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-cache-'));try{
  const s=new Store(dir);await s.set({project:{image:'x'.repeat(2*1024*1024)},prefs:{locale:'ru'}});
  let reads=0;const read=s.read.bind(s);s.read=()=>{reads++;return read()};
  for(let i=0;i<20;i++){const p=await s.get('prefs');assert.equal(p.prefs.locale,'ru');p.prefs.locale='bad'}
  assert.equal(reads,0);assert(!s.cache.has('project'));assert(s.cacheBytes<=1048576);
  await new Store(dir).set({prefs:{locale:'en'}});assert.equal((await s.get('prefs')).prefs.locale,'en');assert.equal(reads,1);
  await s.remove('prefs');assert.deepEqual(await s.get({prefs:{locale:'default'}}),{prefs:{locale:'default'}});
  await fs.writeFile(s.file,'corrupted');await assert.rejects(s.get('prefs'));assert.equal(await fs.readFile(s.file,'utf8'),'corrupted');
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('resource report counts shared processes once and omits sensitive URL paths',()=>{
 const {report}=require('./resources.cjs'),wc={isDestroyed:()=>false,getOSProcessId:()=>12};
 const r=report({getAppMetrics:()=>[{pid:12,type:'Tab',memory:{workingSetSize:2048},cpu:{percentCPUUsage:1}}]},null,{tabs:new Map([['a',{url:'https://example.com/private?token=secret',visible:true,view:{webContents:wc}}],['b',{url:'https://example.org/account',view:{webContents:wc}}]])});
 assert.equal(r.totalWorkingSetKB,2048);assert.equal(r.processes[0].labels.length,2);assert(!JSON.stringify(r).includes('secret'));assert(!JSON.stringify(r).includes('/account'));
});
