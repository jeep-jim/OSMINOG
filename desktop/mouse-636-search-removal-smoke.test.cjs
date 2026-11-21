'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const S=require('./mouse-636-search-removal-smoke.cjs');
const goodUI=()=>({ready:true,searchButton:false,workspace:false,script:false,style:false,api:false,onSearch:false,globalController:false,testController:false,bodyOpen:false,footer:[...S.FOOTER],footerLabel:'Эмодзи, масштаб, история, закладки, загрузки и скриншот',addressInputs:2});
test('636 removal requires every removed UI/API surface absent while retaining all six footer actions',()=>{
 S.assertUI(goodUI());for(const key of ['searchButton','workspace','script','style','api','onSearch','globalController','testController','bodyOpen'])assert.throws(()=>S.assertUI({...goodUI(),[key]:true}),key);
 assert.throws(()=>S.assertUI({...goodUI(),addressInputs:0}));assert.throws(()=>S.assertUI({...goodUI(),footer:['emoji','history','bookmarks','downloads','screenshot']}));
});
test('negative IPC proof refuses unavailable introspection and detects handlers and listeners independently',()=>{
 const ipcMain=new EventEmitter();assert.throws(()=>S.hostReadback({ipcMain,browser:{}}),/actual invoke-handler registry/);ipcMain._invokeHandlers=new Map();
 S.assertHost(S.hostReadback({ipcMain,browser:{}}));ipcMain._invokeHandlers.set('mouse:tile-search',()=>{});assert.throws(()=>S.assertHost(S.hostReadback({ipcMain,browser:{}})));ipcMain._invokeHandlers.clear();
 for(const channel of ['mouse:tile-search','mouse:search-state']){ipcMain.on(channel,()=>{});assert.throws(()=>S.assertHost(S.hostReadback({ipcMain,browser:{}})));ipcMain.removeAllListeners(channel);}
 assert.throws(()=>S.assertHost(S.hostReadback({ipcMain,browser:{mouseTileSearch:{}}})));
});
test('native inventory catches an unowned SERP even when it uses the ordinary page preload',()=>{
 const session={},wc=(id,preload='page-pointer-preload.cjs')=>({id,session,isDestroyed:()=>false,getType:()=>id===1?'window':'browserView',getURL:()=>id===1?'file:///shell':'https://www.bing.com/search?q=x',getLastWebPreferences:()=>({preload})});
 const shell=wc(1),page=wc(2),source=wc(3),rows=[shell,page],browser={session,tabs:new Map([['a',{view:{webContents:page}}]]),providers:new Map()},electron={BrowserWindow:{getAllWindows:()=>[{isDestroyed:()=>false,webContents:shell}]},webContents:{getAllWebContents:()=>rows}};
 S.assertInventory(S.nativeInventory({browser,electron}));rows.push(source);assert.deepEqual(S.nativeInventory({browser,electron}).unownedIds,[3]);assert.throws(()=>S.assertInventory(S.nativeInventory({browser,electron})));
 rows.pop();page.getLastWebPreferences=()=>({preload:'/app/mouse-search-page-preload.cjs'});assert.deepEqual(S.nativeInventory({browser,electron}).searchPreloadIds,[2]);assert.throws(()=>S.assertInventory(S.nativeInventory({browser,electron})));
});
test('ordinary selected engines preserve the entire original Unicode query and reject wrong domains or extra parameters',()=>{
 const query='обычный поиск & + C++';for(const [engine,[host,pathname,param]]of Object.entries(S.ENGINES)){const url=new URL('https://'+host+pathname);url.searchParams.set(param,query);S.assertEngineURL(engine,query,url.href);assert.throws(()=>S.assertEngineURL(engine,query,url.href+'&other=1'));assert.throws(()=>S.assertEngineURL(engine,query,url.href.replace(host,'example.com')));assert.throws(()=>S.assertEngineURL(engine,query+'x',url.href));}
});
function submitted(){const requestedURL='https://www.bing.com/search?q=original',actualURL='http://127.0.0.1:1234/captured/60?engine=bing';return{engine:'bing',query:'original',requestedURL,capturedResolvedURL:requestedURL,actualURL,navigationMode:'owned-request-substitution',externalEngineVerified:false,loads:[{requestedURL,actualURL}],before:{id:'ordinary',webContentsId:4},after:{id:'ordinary',webContentsId:4,url:actualURL},samePageObject:true,sameWebContents:true,nativeKey:{accepted:true},keyboard:[{type:'keydown',key:'Enter',isTrusted:true},{type:'submit',isTrusted:true,value:'original'}],navigation:[{type:'did-navigate',url:actualURL}]};}
test('ordinary proof requires native submission, unchanged tab ownership and an actual committed fixture URL',()=>{
 S.assertSubmission(submitted());for(const mutate of [row=>row.keyboard[1].isTrusted=false,row=>row.keyboard.push(row.keyboard[1]),row=>row.after.webContentsId=8,row=>row.samePageObject=false,row=>row.navigation=[],row=>row.capturedResolvedURL+='x',row=>row.externalEngineVerified=true]){const row=submitted();mutate(row);assert.throws(()=>S.assertSubmission(row));}
});
test('current package removes runtime and retired search smokes but keeps ordinary search and the new absence proof',async()=>{
 const build=require('./mouse-build.cjs'),sourceRoot=__dirname;
 for(const file of S.REMOVED_FILES){await assert.rejects(fs.access(path.join(sourceRoot,file)),{code:'ENOENT'});assert.ok(!build.files.includes(file),file);}
 for(const file of S.RETIRED_SMOKES)assert.ok(build.files.includes('!'+file),file);
 assert.ok(build.files.includes('mouse-search.cjs'));assert.ok(build.files.includes('mouse-636-*.cjs'));assert.ok(build.files.includes('!mouse-636-*.test.cjs'));
 const pkg=JSON.parse(await fs.readFile(path.join(sourceRoot,'package.json'),'utf8')),lock=JSON.parse(await fs.readFile(path.join(sourceRoot,'package-lock.json'),'utf8'));assert.equal(pkg.dependencies?.cheerio,undefined);assert.equal(pkg.overrides?.cheerio,undefined);assert.equal(lock.packages?.['node_modules/cheerio'],undefined);
});
test('installed package receipt binds raw wiring bytes and detects a runtime file or IPC left behind',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse636-removal-'));
 try{
  for(const file of ['mouse-main.cjs','mouse-preload.cjs','mouse/browser.js','mouse/index.html','mouse-search.cjs']){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.copyFile(path.join(__dirname,file),path.join(root,file));}
  const good=await S.packageReadback(root);S.assertPackage(good);const changed=structuredClone(good);changed.wiring[0].text+=' ';assert.throws(()=>S.assertPackage(changed));
  await fs.writeFile(path.join(root,'mouse-search-service.cjs'),'legacy');const legacy=await S.packageReadback(root);assert.throws(()=>S.assertPackage(legacy));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
