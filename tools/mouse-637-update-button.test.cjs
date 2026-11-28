'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const D=require('./mouse-637-update-button.cjs');
const {MouseUpdates,releaseTarget}=require('../desktop/mouse-update.cjs');
const vm=require('node:vm');
const {nativeHitTarget}=require('../desktop/mouse-smoke-hit-target.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const names={darwin:'mac-arm64.dmg',win32:'Windows-x64.exe',linux:'Linux-x64.AppImage'};
function candidate(platform,bytes=Buffer.from('owned new package')){
 const target=releaseTarget({platform,arch:platform==='darwin'?'arm64':'x64'}),name='Mouse-Browser-6.0.44-'+names[platform];
 return{name,version:D.TO,size:bytes.length,sha256:sha(bytes),path:path.join(os.tmpdir(),name),url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/'+target.tagFor(D.TO)+'/'+name};
}
function input(platform){return{version:D.TO,fromVersion:D.FROM,reportPrefix:D.PREFIX,
 executable:path.join(os.tmpdir(),'owned-app'),profile:path.join(os.tmpdir(),'owned-profile'),output:os.tmpdir(),state:path.join(os.tmpdir(),'state.json'),python:process.execPath,
 baseline:{source:D.SOURCE,updaterBlobSHA:D.UPDATER_BLOB,size:123,sha256:'a'.repeat(64)},ownerSentinel:{name:'mouse637-update-owner.txt',sha256:'b'.repeat(64)},candidate:candidate(platform),...(platform==='linux'?{packageFormat:'appimage'}:{})};}

test('the current packaged updater is byte-identical to the published636 module pinned by the probe',()=>{
 const bytes=sync.readFileSync(path.join(__dirname,'../desktop/mouse-update.cjs'));
 assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),D.UPDATER_BLOB);
});

test('native probe accepts only exact current/predecessor, platform name, canonical package and owned profile contract',()=>{
 for(const platform of Object.keys(names)){
  assert.equal(D.validateInput(input(platform),platform),true);
  for(const modify of [x=>x.version='6.0.37',x=>x.fromVersion='6.0.35',x=>x.baseline.updaterBlobSHA='a'.repeat(40),x=>x.baseline.source='a'.repeat(40),x=>x.profile='relative',x=>x.python='python',x=>x.ownerSentinel.name='../owner.txt',x=>x.candidate.url+='?fixture=1',x=>x.candidate.name='Mouse-Browser-6.0.37-'+names[platform],x=>x.candidate.size=0]){
   const value=input(platform);modify(value);assert.throws(()=>D.validateInput(value,platform));
  }
 }
});

test('fixture transport preserves fetch options and refuses every unlisted URL',async()=>{
 const options={headers:{Accept:'application/json'},signal:new AbortController().signal},calls=[],requests=[];
 const response=new Response('{}');const transport=D.fixtureTransport(async(...args)=>{calls.push(args);return response;},{'https://canonical.invalid/channel':'http://127.0.0.1:1234/channel'},requests);
 assert.equal(await transport('https://canonical.invalid/channel',options),response);assert.equal(calls[0][0],'http://127.0.0.1:1234/channel');assert.equal(calls[0][1],options);assert.equal(requests[0].url,'https://canonical.invalid/channel');
 for(const url of ['https://canonical.invalid/channel?x=1','file:///etc/passwd','https://other.invalid/package'])await assert.rejects(()=>transport(url,options),/Unexpected updater transport URL/);
 assert.equal(calls.length,1);
});

for(const platform of Object.keys(names))test('actual636 '+platform+' updater selects637, validates download and delegates unchanged install',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse637-button-contract-')),bytes=Buffer.from('owned exact candidate '+platform),c=candidate(platform,bytes),target=releaseTarget({platform,arch:platform==='darwin'?'arm64':'x64'});
 const original={...Object.fromEntries(['check','download','verified','install','open'].map(name=>[name,MouseUpdates.prototype[name]]))},calls=[],requests=[],instances=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url==='http://127.0.0.1:1234/channel')return Response.json(D.channelFor(c,platform));if(url==='http://127.0.0.1:1234/package')return new Response(bytes);throw Error('Unapproved fixture transport');};
 const prepared=[],installer={prepare:async(...args)=>{prepared.push(args);},install:async()=>{prepared.push('installed');}};
 const app={getVersion:()=>D.FROM,getPath:key=>{assert.equal(key,'temp');return root;}},u=new MouseUpdates({app,fetcher,installer,target});
 const restore=D.attachTransport(MouseUpdates,{[target.channel]:'http://127.0.0.1:1234/channel',[c.url]:'http://127.0.0.1:1234/package'},requests,value=>instances.push(value));
 try{
  for(const name of ['download','verified','install','open'])assert.equal(MouseUpdates.prototype[name],original[name]);
  assert.equal(u.installer,installer);assert.equal(u.app,app);assert.equal(u.state.currentVersion,D.FROM);
  const available=await u.run('check');assert.equal(available.phase,'available');assert.equal(available.availableVersion,D.TO);assert.equal(available.channel,'static');assert.equal(instances[0],u);
  const ready=await u.run('download');assert.equal(ready.phase,'ready');assert.equal(ready.canInstall,true);assert.deepEqual(await fs.readFile(u.file),bytes);
  await u.run('install');assert.equal(prepared[0][0],u.file);assert.equal(prepared[0][1].hash,c.sha256);assert.equal(prepared[0][1].url,c.url);assert.equal(prepared[1],'installed');
  assert.deepEqual(requests.map(row=>row.url),[target.channel,c.url]);assert.equal(calls.length,2);assert.equal(u.app.getVersion(),D.FROM);
 }finally{restore();assert.equal(MouseUpdates.prototype.check,original.check);await fs.rm(root,{recursive:true,force:true});}
});

test('transport fixture cannot bypass checksum failure or manufacture an upgrade for an already-current app',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse637-button-rejection-')),bytes=Buffer.from('original checked bytes'),c=candidate('darwin',bytes),target=releaseTarget();let prepared=false;
 const fetcher=async url=>url.endsWith('/channel')?Response.json(D.channelFor(c,'darwin')):new Response(Buffer.alloc(bytes.length,65));
 const restore=D.attachTransport(MouseUpdates,{[target.channel]:'http://127.0.0.1:1234/channel',[c.url]:'http://127.0.0.1:1234/package'},[],()=>{});
 try{
  const u=new MouseUpdates({app:{getVersion:()=>D.FROM,getPath:()=>root},fetcher,installer:{prepare:()=>{prepared=true;},install(){}}});
  await u.run('check');await assert.rejects(()=>u.run('download'),/SHA-256/);assert.equal(u.state.phase,'error');assert.equal(prepared,false);assert.equal(u.file,null);
  const current=new MouseUpdates({app:{getVersion:()=>D.TO,getPath:()=>root},fetcher});const result=await current.run('check');assert.equal(result.phase,'current');assert.equal(result.availableVersion,'');assert.equal(current.candidate,null);
 }finally{restore();await fs.rm(root,{recursive:true,force:true});}
});

// Explicitly synthetic geometry/IPC fixture. Execute the actual nested click,
// its serialized main/DOM functions, nativeHitTarget and shared deadline loop;
// this is not a claim of AppKit delivery or installed updater acceptance.
function windowFixture(options={}){
 const source=sync.readFileSync(path.join(__dirname,'mouse-637-update-button.cjs'),'utf8');
 const begin=source.indexOf('  async function click(selector'),end=source.indexOf('  async function snapshot(',begin);
 assert.ok(begin>0&&end>begin);const clickSource=source.slice(begin,end);
 const untilSource=source.slice(source.indexOf(' async function until('),source.indexOf('\n let fixture,'));
 const platform=options.platform||'darwin',timeline=[],posts=[],changes=[],copies=value=>JSON.parse(JSON.stringify(value));
 let now=0,closed=false,focused=false,bounds=copies(options.bounds||{x:80,y:-31,width:1440,height:960});
 let full=!!options.fullScreen,simple=!!options.simpleFullScreen,maximized=!!options.maximized,pending=null;
 const display=copies(options.display||{id:8,bounds:{x:0,y:0,width:1600,height:900},workArea:{x:0,y:25,width:1600,height:802},scaleFactor:1});
 const minimumSize=options.minimumSize||[800,600],viewport={width:bounds.width,height:bounds.height};
 const processStub={platform,pid:41177,env:{CI:'true',MOUSE_TEST_PROFILE:'/synthetic-owned-profile'}};
 const geometry=()=>({ ...bounds });
 const frame=callback=>{now+=16;if(!options.staleRenderer)Object.assign(viewport,{width:bounds.width,height:bounds.height});callback(now);};
 const win={id:1,isDestroyed:()=>false,getBounds:geometry,getContentBounds:geometry,getMinimumSize:()=>[...minimumSize],
  isFullScreen:()=>full,isSimpleFullScreen:()=>simple,isMaximized:()=>maximized,isMinimized:()=>false,isVisible:()=>true,isFocused:()=>focused,
  show(){timeline.push('show');},focus(){focused=true;timeline.push('focus');},
  setFullScreen(value){assert.equal(value,false);changes.push('leave-fullscreen');pending={mode:'full',ticks:2};},
  setSimpleFullScreen(value){assert.equal(value,false);changes.push('leave-simple-fullscreen');pending={mode:'simple',ticks:2};},
  unmaximize(){assert.equal(full||simple,false);changes.push('unmaximize');pending={mode:'maximized',ticks:2};},
  setBounds(value,animate){assert.equal(animate,false);assert.equal(full||simple||maximized,false);changes.push(copies(value));pending={mode:'bounds',bounds:copies(value),ticks:options.boundsDelay||2};},
  webContents:{getURL:()=>'/synthetic-owned-app/mouse/index.html',getZoomFactor:()=>1,focus(){timeline.push('web-focus');}}};
 const untouched={setBounds(){throw Error('Unrelated window must not be resized');}};
 const electron={app:{isPackaged:true,getVersion:()=>D.FROM,focus(){timeline.push('app-focus');}},BrowserWindow:{getAllWindows:()=>[win,untouched]},
  screen:{getDisplayMatching(rect){assert.deepEqual(copies(rect),bounds);return copies(display);},dipToScreenPoint(point){timeline.push('windows-dip-conversion');return{x:point.x*2,y:point.y*2};}}};
 const elements=new Map(),defaultStyle={pointerEvents:'auto',visibility:'visible',display:'block',opacity:'1',overflowX:'visible',overflowY:'visible'};
 const document={defaultView:{get innerWidth(){return viewport.width;},get innerHeight(){return viewport.height;},getComputedStyle:()=>defaultStyle},
  querySelector:selector=>elements.get(selector),elementFromPoint:(x,y)=>[...elements.values()].find(element=>{const r=element.getBoundingClientRect();return x>=r.left&&x<r.left+r.width&&y>=r.top&&y<r.top+r.height;})};
 for(const [selector,vertical] of [['#version-button',1],['#update-download',.4],['#update-install',.6]]){
  const element={id:selector.slice(1),tagName:'BUTTON',className:'',ownerDocument:document,parentElement:null,disabled:false,
   matches:()=>false,contains:value=>value===element,scrollIntoView(){timeline.push('scroll '+selector);},
   getBoundingClientRect:()=>({left:viewport.width-193,top:vertical===1?viewport.height-24:viewport.height*vertical,width:40,height:20})};
  element.getClientRects=()=>[element.getBoundingClientRect()];elements.set(selector,element);
 }
 const events=[],renderer=vm.createContext({document,requestAnimationFrame:frame,get innerWidth(){return viewport.width;},get innerHeight(){return viewport.height;},devicePixelRatio:display.scaleFactor,__mouse637ButtonClicks:events});
 const shell=async expression=>{if(closed)throw Error('Read after inspector close');const hit=expression.includes('nativeHitTarget');timeline.push(hit?'hit-target':'renderer');if(hit)options.onHit?.({bounds,display,viewport,timeline});return copies(await vm.runInContext(expression,renderer));};
 win.webContents.executeJavaScript=shell;
 const main=vm.createContext({process:processStub,require:name=>name==='electron'?electron:require(name),__mouse637Button:{win},Date:{now:()=>now}});
 const evaluate=async(_client,expression)=>{
  if(closed)throw Error('Read after inspector close');
  if(expression.includes('ownedMacWindow')&&expression.endsWith('("read",null)')){
   if(pending&&--pending.ticks===0){if(pending.mode==='bounds'){if(!options.neverSettle)bounds=copies(pending.bounds);}else if(pending.mode==='full')full=false;else if(pending.mode==='simple')simple=false;else maximized=false;pending=null;}
   options.onRead?.({bounds,display,viewport,timeline});
  }
  return copies(await vm.runInContext(expression,main));
 };
 const until=new Function('deadline','Date','sleep',untilSource+';return until;')(options.deadline||1500,{now:()=>now},async ms=>{assert.equal(ms,100);now+=ms;});
 const facts={oldProcess:{pid:41177},nativeInputs:[]},client={async close(){closed=true;timeline.push('close-inspector');}},save=async()=>{timeline.push('save');};
 const native=async value=>{
  posts.push(copies(value));timeline.push('native '+value.action);
  if(options.nativeError)throw options.nativeError;
  const logical=platform==='win32'?{x:value.x/2,y:value.y/2}:value;
  const visible=logical.x>=display.workArea.x&&logical.x<display.workArea.x+display.workArea.width&&logical.y>=display.workArea.y&&logical.y<display.workArea.y+display.workArea.height;
  const target=document.elementFromPoint(logical.x-bounds.x,logical.y-bounds.y);
  if(visible&&target&&!options.missingTrusted)events.push({selector:options.wrongTarget?'#unrelated-button':'#'+target.id,trusted:!options.untrusted,type:'click',button:0});
  return options.nativeResult||{ok:true,foregroundVerified:true};
 };
 const click=new Function('evaluate','client','rq','until','shell','nativeHitTarget','native','facts','save','process','assert','prepareMacPredecessorWindow','ownedMacWindow','macTargetPoint',clickSource+';return click;')(
  evaluate,client,'globalThis.require',until,shell,nativeHitTarget,native,facts,save,processStub,assert,D.prepareMacPredecessorWindow,D.ownedMacWindow,D.macTargetPoint);
 return{click,facts,posts,changes,timeline,display,viewport,processStub,win,main,electron,get bounds(){return bounds;},get now(){return now;}};
}

test('synthetic actual click prepares the published636 oversized Mac window before measuring its button',async()=>{
 const f=windowFixture(),row=await f.click('#version-button');
 assert.deepEqual(f.changes,[{x:80,y:25,width:1440,height:802}]);
 assert.deepEqual(f.posts,[{action:'click',pid:41177,x:1347,y:813}]);
 assert.equal(row.event.trusted,true);assert.equal(f.facts.windowPreparations[0].before.windowBounds.y,-31);
 assert.equal(f.facts.windowPreparations[0].before.windowBounds.height,960);
 assert.equal(row.geometry.display.workArea.height,802);assert.equal(row.geometry.coordinateSpace,'quartz-screen-points');
});

test('synthetic all three update controls remeasure geometry and retain one native post each, with inspector closed before Install',async()=>{
 const f=windowFixture();
 await f.click('#version-button');await f.click('#update-download');const install=await f.click('#update-install',{disconnect:true});
 assert.equal(f.changes.length,1);assert.equal(f.posts.length,3);
 assert.deepEqual(f.facts.nativeInputs.map(row=>row.selector),['#version-button','#update-download','#update-install']);
 assert.deepEqual(f.facts.windowPreparations.map(row=>row.selector),['#version-button','#update-download','#update-install']);
 for(const row of f.facts.nativeInputs){assert.equal(row.geometry.pid,41177);assert.deepEqual(row.point,row.geometry.point);assert.equal(row.geometry.hit.viewport.height,802);}
 assert.equal(f.facts.inspectorClosedBeforeInstall,true);assert.equal(install.event,undefined);
 assert.ok(f.timeline.lastIndexOf('hit-target')<f.timeline.indexOf('close-inspector'));
 assert.ok(f.timeline.indexOf('close-inspector')<f.timeline.lastIndexOf('native click'));
});

test('synthetic already reachable Mac window keeps its bounds and profile minimum size',async()=>{
 const original={x:100,y:60,width:1000,height:650},f=windowFixture({bounds:original});
 await f.click('#version-button');assert.deepEqual(f.bounds,original);assert.deepEqual(f.changes,[]);
 assert.deepEqual(f.win.getMinimumSize(),[800,600]);assert.equal(f.posts.length,1);
});

test('synthetic negative-origin Retina display keeps Quartz points without multiplying scaleFactor',async()=>{
 const f=windowFixture({bounds:{x:-1520,y:-31,width:1440,height:960},display:{id:19,bounds:{x:-1600,y:0,width:1600,height:900},workArea:{x:-1600,y:25,width:1600,height:802},scaleFactor:2}});
 const row=await f.click('#version-button');assert.deepEqual(row.point,{x:-253,y:813});
 assert.equal(row.geometry.display.id,19);assert.equal(row.geometry.display.scaleFactor,2);assert.equal(row.geometry.hit.viewport.devicePixelRatio,2);
 assert.equal(f.timeline.includes('windows-dip-conversion'),false);assert.equal(f.posts.length,1);
});

test('fit planner rounds inward at fractional work-area edges and refuses an impossible unchanged minimum',()=>{
 const geometry={windowBounds:{x:-1900,y:-1000,width:1440,height:960},minimumSize:[800,600],display:{bounds:{x:-1601,y:-901,width:1602,height:902},workArea:{x:-1600.25,y:-899.5,width:1600,height:899}}};
 assert.deepEqual(D.fitMacWindowBounds(geometry),{x:-1600,y:-899,width:1440,height:898});
 assert.throws(()=>D.fitMacWindowBounds({...geometry,minimumSize:[1600,600]}),/unchanged predecessor minimum size/);
 for(const changed of [x=>x.display.workArea.height=NaN,x=>x.display.workArea.x=-1700,x=>x.minimumSize=[800,-1]]){
  const value=structuredClone(geometry);changed(value);assert.throws(()=>D.fitMacWindowBounds(value));
 }
});

test('synthetic Mac work area below published minimum fails before resizing or posting and retains its attempt',async()=>{
 const f=windowFixture({display:{id:8,bounds:{x:0,y:0,width:900,height:600},workArea:{x:0,y:25,width:900,height:550},scaleFactor:1}});
 await assert.rejects(()=>f.click('#version-button'),/unchanged predecessor minimum size/);
 assert.equal(f.posts.length,0);assert.deepEqual(f.changes,[]);
 assert.deepEqual(f.facts.windowPreparations[0].before.minimumSize,[800,600]);assert.equal(f.facts.windowPreparations[0].before.display.workArea.height,550);
});

for(const mode of ['fullScreen','simpleFullScreen'])test('synthetic '+mode+' transition completes before unmaximize, fit and fresh target',async()=>{
 const f=windowFixture({[mode]:true,maximized:true});await f.click('#version-button');
 assert.equal(f.changes[0],mode==='fullScreen'?'leave-fullscreen':'leave-simple-fullscreen');assert.equal(f.changes[1],'unmaximize');
 assert.deepEqual(f.changes[2],{x:80,y:25,width:1440,height:802});assert.equal(f.changes.length,3);assert.equal(f.posts.length,1);
 const after=f.facts.windowPreparations[0].after;assert.equal(after.fullScreen,false);assert.equal(after.simpleFullScreen,false);assert.equal(after.maximized,false);
});

for(const mode of ['neverSettle','staleRenderer'])test('synthetic '+mode+' respects the original shared deadline and posts no input',async()=>{
 const f=windowFixture({[mode]:true,deadline:250});await assert.rejects(()=>f.click('#version-button'),/predecessor window and renderer fit live work area/);
 assert.equal(f.changes.length,1);assert.equal(f.posts.length,0);assert.equal(f.timeline.includes('hit-target'),false);assert.ok(f.now>=250&&f.now<400);
 const receipt=f.facts.windowPreparations[0];assert.equal(receipt.requested.height,802);assert.ok(receipt.lastObserved);
 if(mode==='staleRenderer'){assert.equal(receipt.viewport.height,960);assert.equal(receipt.lastObserved.contentBounds.height,802);}
 else assert.equal(receipt.lastObserved.windowBounds.height,960);
});

test('synthetic stale renderer after preparation cannot reuse its old offscreen target',async()=>{
 const f=windowFixture({onHit({viewport}){viewport.height=960;}});
 await assert.rejects(()=>f.click('#version-button'),/Fresh predecessor target must match the settled renderer viewport/);
 assert.equal(f.posts.length,0);assert.equal(f.changes.length,1);
 const target=f.facts.windowPreparations[0].target;assert.equal(target.hit.y,946);assert.equal(target.hit.viewport.height,960);assert.equal(target.contentBounds.height,802);
});

for(const change of ['window','display'])test('synthetic '+change+' movement after fresh hit is rejected before the native post',async()=>{
 const f=windowFixture({onRead({bounds,display,timeline}){if(timeline.includes('hit-target')){if(change==='window')bounds.y=100;else display.workArea.height=700;}}});
 await assert.rejects(()=>f.click('#version-button'),/Actual predecessor window and content must fit the live work area/);
 assert.equal(f.posts.length,0);assert.equal(f.changes.length,1);assert.ok(f.facts.windowPreparations[0].target);
});

test('synthetic target is never clamped to a different point when rounding would put it outside content',async()=>{
 const f=windowFixture();await f.click('#version-button');const geometry=f.facts.windowPreparations[0].after;
 const hit={ready:true,x:geometry.contentBounds.width-.1,y:50,viewport:{width:geometry.contentBounds.width,height:geometry.contentBounds.height}};
 assert.throws(()=>D.macTargetPoint(geometry,hit,geometry),/Native predecessor target must be on-screen/);
 assert.equal(hit.x,1439.9);
});

for(const mode of ['missingTrusted','untrusted','wrongTarget'])test('synthetic '+mode+' receipt still fails the unchanged trusted click gate without replay',async()=>{
 const f=windowFixture({[mode]:true,deadline:500});await assert.rejects(()=>f.click('#version-button'),/trusted update click #version-button/);
 assert.equal(f.posts.length,1);assert.equal(f.facts.nativeInputs.length,1);assert.equal(f.facts.nativeInputs[0].event,undefined);
 assert.equal(f.facts.nativeInputs[0].geometry.point.y,813);
});

test('synthetic native helper rejection remains failure and retains prepared geometry without replay',async()=>{
 for(const options of [{nativeResult:{ok:false}},{nativeError:Error('synthetic native post rejection')}]){
  const f=windowFixture(options);await assert.rejects(()=>f.click('#version-button'));
  assert.equal(f.posts.length,1);assert.equal(f.facts.nativeInputs.length,0);assert.equal(f.facts.windowPreparations[0].target.point.y,813);
 }
});

test('serialized Mac preparation refuses missing CI ownership and other applications before mutation',()=>{
 for(const change of [f=>f.processStub.env.CI='false',f=>f.processStub.env.MOUSE_TEST_PROFILE='relative',f=>f.electron.app.isPackaged=false,f=>f.electron.app.getVersion=()=>D.TO,f=>f.win.isDestroyed=()=>true,f=>f.win.webContents.getURL=()=>'/another-app/index.html']){
  const f=windowFixture();change(f);
  assert.throws(()=>vm.runInContext('('+D.ownedMacWindow.toString()+')("set-bounds",{x:0,y:25,width:800,height:600})',f.main),/Expected owned installed CI Mac predecessor window/);
  assert.deepEqual(f.changes,[]);assert.equal(f.posts.length,0);
 }
});

for(const platform of ['win32','linux'])test('synthetic '+platform+' click retains its original coordinate conversion without Mac preparation',async()=>{
 const f=windowFixture({platform,bounds:{x:80,y:25,width:1200,height:700}}),row=await f.click('#version-button');
 assert.deepEqual(row.point,platform==='win32'?{x:2214,y:1422}:{x:1107,y:711});
 assert.equal(f.posts.length,1);assert.deepEqual(f.changes,[]);assert.equal(f.facts.windowPreparations,undefined);assert.equal(row.geometry,undefined);
 assert.equal(f.timeline.includes('windows-dip-conversion'),platform==='win32');
});
