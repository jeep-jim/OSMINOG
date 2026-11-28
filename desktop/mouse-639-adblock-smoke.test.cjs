'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {fixturePage,createHTTPFixture,pageReadback,settingsReadback,inputProbe,noraReadback,settingsCaptureReadback,settingsGuestOverlaps,settingsPixelContrast,settingsFrameAcceptance,assertPage,SCRIPT,COLORS,PREFIX,sha}=require('./mouse-639-adblock-smoke.cjs').fixtures;
const smoke=fs.readFileSync(path.join(__dirname,'mouse-639-adblock-smoke.cjs'),'utf8');
function actualFunction(start,end){const a=smoke.indexOf(start),b=smoke.indexOf(end,a);assert.ok(a>=0&&b>a);return smoke.slice(a,b).trim();}

test('the owned real HTTP fixture records each delivered script and never serves cacheable responses',async()=>{
 const owned=await createHTTPFixture();try{
  const token='owned-native-token';
  for(const [route,body]of [['page',fixturePage()],['allowed-script.js',SCRIPT.allowed],['advertising-script.js',SCRIPT.advertising]]){
   const response=await fetch(owned.base+PREFIX+route+'?token='+token);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(await response.text(),body);
  }
  assert.deepEqual(owned.hits.map(row=>({sequence:row.sequence,kind:row.kind,token:row.token})),[{sequence:1,kind:'page',token},{sequence:2,kind:'allowed',token},{sequence:3,kind:'advertising',token}]);
  for(const row of owned.hits){const body=row.kind==='page'?fixturePage():SCRIPT[row.kind];assert.equal(row.bodySha256,sha(body));assert.equal(row.bytes,Buffer.byteLength(body));assert.equal(row.status,200);}
  for(const url of [owned.base+'/unowned',owned.base+PREFIX+'page',owned.base+PREFIX+'page?token=../escape'])assert.equal((await fetch(url)).status,404);
  assert.equal(owned.hits.length,3);
 }finally{await owned.close();}
});

test('the unchanged fixture page attempts both scripts and distinguishes a blocked request from an executed advertisement',()=>{
 for(const blocked of [false,true]){
  const regions=new Map([['#allowed-result',{style:{}}],['#advertising-result',{style:{}}],['#result-text',{}]]),requested=[];
  const context={URLSearchParams,location:{search:'?token=unit-probe'},document:{querySelector:key=>regions.get(key),createElement:tag=>{assert.equal(tag,'script');return{};},head:{append(script){requested.push(script.src);const kind=script.src.includes('allowed-script')?'allowed':'advertising';if(blocked&&kind==='advertising')script.onerror();else{vm.runInContext(SCRIPT[kind],context);script.onload();}}}}};
  vm.createContext(context);const inline=fixturePage().match(/<script>([\s\S]+)<\/script>/)[1];vm.runInContext(inline,context);
  const result=JSON.parse(JSON.stringify(context.mouse639));assert.equal(result.token,'unit-probe');assert.equal(requested.length,2);assert.ok(requested.includes(PREFIX+'advertising-script.js?token=unit-probe'));
  assertPage(result,{page:1,allowed:1,advertising:blocked?0:1},blocked);
  assert.equal(regions.get('#advertising-result').style.background,'rgb('+COLORS[blocked?'blocked':'advertising']+')');
 }
});

test('native outcome assertions reject hidden advertising hits, missing control execution and synthetic success states',()=>{
 const good={attempted:{allowed:1,advertising:1},executed:{allowed:1,advertising:0},settled:{allowed:'load',advertising:'error'}};
 assertPage(good,{page:1,allowed:1,advertising:0},true);
 assert.throws(()=>assertPage(good,{page:1,allowed:1,advertising:1},true));
 for(const value of [{...good,executed:{allowed:0,advertising:0}},{...good,attempted:{allowed:1,advertising:0}},{...good,settled:{allowed:'load',advertising:'load'}}])assert.throws(()=>assertPage(value,{page:1,allowed:1,advertising:0},true));
});

test('serialized readbacks observe real page and private settings values without changing them',()=>{
 const checkbox={checked:true,disabled:true,getBoundingClientRect:()=>({x:12,y:24,width:20,height:20}),closest:()=>({textContent:'Block ads'})};
 const context={MouseTest:{model:{privateMode:true,controlSettings:{blockAds:true}}},document:{documentElement:{dataset:{theme:'light'}},querySelector:selector=>selector==='[data-setting="blockAds"]'?checkbox:selector==='#settings-dialog'?{open:true}:{textContent:'Local filter lists are ready'}}};
 const value=JSON.parse(JSON.stringify(vm.runInNewContext('('+settingsReadback.toString()+')()',context)));
 assert.equal(value.checked,true);assert.equal(value.disabled,true);assert.equal(value.privateMode,true);assert.equal(value.stored,true);assert.equal(value.theme,'light');assert.equal(checkbox.checked,true);
 const page={location:{href:'http://127.0.0.1:1/'+PREFIX+'page?token=owned'},performance:{timeOrigin:1000},mouse639:{token:'owned',attempted:{allowed:1,advertising:1},executed:{allowed:1,advertising:0},settled:{allowed:'load',advertising:'error'}},document:{title:'Owned fixture',querySelector:()=>({getBoundingClientRect:()=>({x:24,y:80,width:200,height:42})})},getComputedStyle:()=>({backgroundColor:'rgb(42, 178, 93)'})};
 const read=JSON.parse(JSON.stringify(vm.runInNewContext('('+pageReadback.toString()+')()',page)));assert.equal(read.token,'owned');assert.deepEqual(read.executed,page.mouse639.executed);assert.equal(read.regions.length,2);
});

test('native click probe is a passive observer and retains actual event trust across shell reloads',()=>{
 const messages=[],listeners=[],target={contains:value=>value===target};
 const context={console:{log:value=>messages.push(value)},document:{querySelector:()=>target,addEventListener:(type,callback,options)=>listeners.push({type,callback,options}),removeEventListener(){}}};
 vm.runInNewContext('('+inputProbe.toString()+')('+JSON.stringify('#private-button')+','+JSON.stringify('owned-ticket')+')',context);
 assert.equal(messages.length,0);assert.equal(listeners[0].options.capture,true);assert.equal(listeners[0].options.once,true);
 for(const trusted of [false,true])listeners[0].callback({type:'click',isTrusted:trusted,target,clientX:11,clientY:22});
 assert.deepEqual(messages.map(value=>JSON.parse(value.slice(16)).trusted),[false,true]);assert.ok(messages.every(value=>JSON.parse(value.slice(16)).matches));
});

test('Mac native 639 input keeps the exact CI/profile guard and retained flag allowlist',()=>{
 const code=fs.readFileSync(path.join(__dirname,'mouse-native-menu.mm'),'utf8'),body=code.match(/static bool nativeInputProbeAllowed\(\)\{([\s\S]*?)\n\}/)[1];
 assert.match(body,/const char\* ci=std::getenv\("CI"\),\*profile=std::getenv\("MOUSE_TEST_PROFILE"\);/);
 const flags=[...body.matchAll(/containsObject:@"([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(flags,['--mouse-smoke-write','--mouse-645-smoke','--mouse-645-read','--mouse-645-account-smoke','--mouse-631-smoke','--mouse-633-smoke','--mouse-634-smoke','--mouse-635-smoke','--mouse-636-retained-smoke','--mouse-636-smoke','--mouse-637-smoke','--mouse-637-features-smoke','--mouse-637-features-restore-read','--mouse-638-feedback-smoke','--mouse-638-feedback-restore-read','--mouse-639-adblock-smoke','--mouse-639-adblock-read','--mouse-641-workspace-smoke','--mouse-641-workspace-read','--mouse-642-controls-smoke','--mouse-642-controls-read','--mouse-643-polish-smoke','--mouse-643-polish-read','--mouse-644-sync-smoke','--mouse-644-sync-read']);
 // Evaluate the actual C++ predicate with only its platform syntax translated;
 // this is a guard contract test, not a claim of executing AppKit on Linux.
 const expression=body.match(/return ([\s\S]*?);/)[1].replace('std::strcmp(ci,"true")==0','ci==="true"').replace(/\[NSProcessInfo\.processInfo\.arguments containsObject:@"([^"]+)"\]/g,(_,flag)=>'args.includes('+JSON.stringify(flag)+')');
 const allowed=vm.runInNewContext('(ci,profile,args)=>!!('+expression+')');
 for(const flag of flags){
  assert.equal(allowed('true','/owned/ci-profile',[flag]),true,flag);
  for(const ci of [null,'','false','TRUE','1'])assert.equal(allowed(ci,'/owned/ci-profile',[flag]),false);
  for(const profile of [null,'','relative/profile','C:\\profile'])assert.equal(allowed('true',profile,[flag]),false);
 }
 for(const args of [[],['--mouse-639'],['--mouse-639-adblock'],['--mouse-639-adblock-smoke-extra'],['--mouse-unknown-smoke'],['--mouse-643-polish'],['--mouse-643-polish-smoke-extra'],['--mouse-643-polish-read=1'],['prefix--mouse-643-polish-smoke'],['--mouse-644-sync'],['--mouse-644-sync-smoke-extra'],['--mouse-644-sync-read=1'],['--mouse-645'],['--mouse-645-smoke-extra'],['--mouse-645-read=1'],['--mouse-645-account-smoke-extra'],['--mouse-645-account-smoke=1']])assert.equal(allowed('true','/owned/ci-profile',args),false);
 const clickBody=code.match(/static napi_value testClick\([^\n]+\{([\s\S]*?)\n\}/)[1];
 assert.match(clickBody,/^\n if\(!nativeInputProbeAllowed\(\)\)\{napi_throw_error\(e,nullptr,"Click probe is CI smoke-only"\);return nullptr;\}/);
});

function noraScene(){
 const content={inert:false},tray={open:true,hidden:false,dataset:{motion:'open'},querySelector:()=>content},ui={isOpen:true,isPreparing:false,holdsNative:true,motion:{isSettled:true}},model={switching:false,desktopId:'desk-0'};
 const context={document:{querySelector:selector=>selector==='#desktop-tray'?tray:null},MouseTest:{desktopUI:ui,model}};
 return{content,tray,ui,model,context,read:()=>vm.runInNewContext('('+noraReadback.toString()+')()',context)};
}
test('Nora readback rejects modal-open before its actual animation, input and native hold settle',()=>{
 const f=noraScene();assert.equal(f.read().ready,true);
 for(const [target,key,bad]of [[f.tray,'open',false],[f.tray,'hidden',true],[f.tray.dataset,'motion','opening'],[f.content,'inert',true],[f.ui,'isOpen',false],[f.ui,'isPreparing',true],[f.ui,'holdsNative',false],[f.ui.motion,'isSettled',false]]){
  const saved=target[key];target[key]=bad;assert.equal(f.read().ready,false,key);target[key]=saved;
 }
 assert.equal(f.read().ready,true);
 f.tray.dataset.motion='opening';f.content.inert=true;f.ui.isPreparing=true;assert.equal(f.read().open,true);assert.equal(f.read().ready,false);
 const missing=vm.runInNewContext('('+noraReadback.toString()+')()',{document:{querySelector:()=>null}});assert.equal(missing.ready,false);
});

test('the actual desk switch waits for settled Nora before one native transition without scrolling or reactivation',async()=>{
 const f=noraScene(),calls=[],waits=[];let ready=false;
 const click=async(selector,options)=>{
  calls.push({selector,options});
  if(selector==='#desktops-button'){f.tray.dataset.motion='opening';f.content.inert=true;f.ui.isPreparing=true;f.ui.motion.isSettled=false;return{ticket:'unit-open'};}
  assert.equal(ready,true);assert.equal(f.read().ready,true);assert.equal(options.activate,false);assert.equal(options.scroll,false);
  f.model.desktopId='desk-1';f.tray.open=false;return{ticket:'unit-switch'};
 };
 const until=async(check,label)=>{
  waits.push(label);
  if(label==='Nora fully open'){
   assert.equal(await check(),false,'open=true during preparation is insufficient');
   f.tray.dataset.motion='open';f.content.inert=false;f.ui.isPreparing=false;f.ui.motion.isSettled=true;f.ui.holdsNative=false;
   assert.equal(await check(),false,'the native-page hold is still required');f.ui.holdsNative=true;
   assert.equal(await check(),true);ready=true;
  }else assert.equal(await check(),true);
 };
 const switchDesk=vm.runInNewContext('('+actualFunction('async function switchDesk(','\n async function togglePrivate(')+')',{click,until,noraReadback,js:async source=>vm.runInNewContext(source,f.context)});
 assert.equal((await switchDesk('desk-1')).ticket,'unit-switch');
 assert.deepEqual(calls.map(value=>value.selector),['#desktops-button','.desktop-card[data-desk="desk-1"] .desk-open']);
 assert.deepEqual(waits,['Nora fully open','native desk switch']);
});

test('an exposed Nora click still requires foreground focus, native delivery and a trusted matching event',async()=>{
 for(const mode of ['success','unfocused','inactive-mac','hidden-mac','driver-failure','untrusted','wrong-target']){
  const pending=new Map(),part={inputs:[]},facts={},calls=[];let polls=0;
  const forbidden=()=>{throw Error('An open Nora must not be refocused or shown again');};
  const win={show:forbidden,focus:forbidden,isFocused:()=>mode!=='unfocused',isVisible:()=>mode!=='hidden-mac',webContents:{focus:forbidden},getContentBounds:()=>({x:10,y:20})};
  const context={app:{focus:forbidden,isActive:()=>mode!=='inactive-mac'},win,process:{pid:123,platform:mode.endsWith('-mac')?'darwin':'linux'},fixture:{frame:async()=>{calls.push('frame');}},facts,part,pending,assert,inputProbe,nativeHitTarget:function nativeHitTarget(){},randomUUID:()=> 'unit-click',
   js:async source=>{assert.doesNotMatch(source,/scrollIntoView/);if(source.includes('function nativeHitTarget'))return{ready:true,x:40,y:50};assert.ok(source.includes('function inputProbe'));calls.push('observer');},
   until:async(check,label)=>{polls++;if(!await check())throw Error(label);},
   nativeInput:{testClick:async(x,y)=>{calls.push('native');assert.deepEqual([x,y],[50,70]);if(mode==='driver-failure')return false;pending.get('unit-click').events.push({type:'click',trusted:mode!=='untrusted',matches:mode!=='wrong-target'});return true;}}};
  const click=vm.runInNewContext('('+actualFunction('async function click(','\n function nativeState(')+')',context);
  if(mode==='success'){assert.equal((await click('.desk-open',{activate:false,scroll:false})).ticket,'unit-click');assert.deepEqual(calls,['frame','observer','native']);assert.equal(polls,3);assert.equal(pending.size,0);}
  else{await assert.rejects(click('.desk-open',{activate:false,scroll:false}));if(['unfocused','inactive-mac','hidden-mac'].includes(mode))assert.deepEqual(calls,[]);else assert.equal(calls.filter(value=>value==='native').length,1);}
 }
});

test('settings capture visibility allows the disabled private switch but rejects clipping and DOM coverage',()=>{
 const bounds={x:1148,y:425,width:31,height:18},ui={open:true,checked:true,disabled:true,privateMode:true,bounds},body={scrollLeft:0,scrollTop:210,getBoundingClientRect:()=>({x:820,y:105,width:380,height:655})},panel={querySelector:()=>body,getBoundingClientRect:()=>({x:820,y:44,width:380,height:716})};
 const input={isConnected:true,disabled:true,contains:node=>node===input};let covered=false;
 const context={document:{querySelector:selector=>selector==='#settings-dialog'?panel:input,elementFromPoint:()=>covered?panel:input},getComputedStyle:(_element,pseudo)=>pseudo?{transform:'matrix(1, 0, 0, 1, 13, 0)'}:{display:'block',visibility:'visible',opacity:'.45',backgroundColor:'rgb(42, 79, 210)'},innerWidth:1200,innerHeight:794};
 const read=vm.runInNewContext('('+settingsCaptureReadback.toString()+')',context);
 assert.equal(read(()=>ui).visible,true);assert.equal(read(()=>ui).ui.disabled,true);assert.equal(input.disabled,true);
 covered=true;assert.equal(read(()=>ui).visible,false);covered=false;
 bounds.y=755;assert.equal(read(()=>ui).visible,false);bounds.y=425;input.isConnected=false;assert.equal(read(()=>ui).visible,false);
});

test('the settings sidebar rejects actual overlapping attached guests and respects native clipping and visibility',()=>{
 const panel={x:820,y:44,width:380,height:716},view=bounds=>({getBounds:()=>bounds,getVisible:()=>true});
 const guest={id:'owned-page',bounds:{x:0,y:74,width:814,height:686},view:view({x:0,y:74,width:1200,height:686})};
 assert.equal(settingsGuestOverlaps([guest],[guest.view],panel).length,1,'cached narrowed page bounds must not hide the actual full-width native surface');
 guest.clipView=view({x:0,y:74,width:814,height:686});assert.deepEqual(settingsGuestOverlaps([guest],[guest.clipView],panel),[],'the clipping view owns actual window coordinates');
 guest.clipView=view({x:810,y:74,width:20,height:686});assert.equal(settingsGuestOverlaps([guest],[guest.clipView],panel).length,1);
 assert.deepEqual(settingsGuestOverlaps([guest],[],panel),[]);guest.clipView.getVisible=()=>false;assert.deepEqual(settingsGuestOverlaps([guest],[guest.clipView],panel),[]);
 guest.clipView.getVisible=()=>true;guest.view.getVisible=()=>false;assert.deepEqual(settingsGuestOverlaps([guest],[guest.clipView],panel),[]);
});

function settingsState(){return{snapshot:{ui:{open:true,checked:false,disabled:false,privateMode:false,status:'off',bounds:{x:10,y:10,width:10,height:10}},panel:{x:8,y:0,width:42,height:40},body:{x:8,y:2,width:42,height:38},scroll:{x:0,y:100},style:{thumbTransform:'none'},visible:true},guests:[]};}
function checkboxBitmap(size,bounds,blank=false){const pixels=Buffer.alloc(size.width*size.height*4);for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){const i=(y*size.width+x)*4,thumb=!blank&&x>=bounds.x&&x<bounds.x+bounds.width/2&&y>=bounds.y&&y<bounds.y+bounds.height;pixels[i]=thumb?255:232;pixels[i+1]=thumb?255:240;pixels[i+2]=thumb?255:243;pixels[i+3]=255;}return pixels;}

test('UI frame acceptance rejects the recorded blank guest background, moving geometry and stale status',()=>{
 const size={width:50,height:40},mapping={originX:0,originY:0,scaleX:1,scaleY:1},before=settingsState();
 const blank=settingsPixelContrast(checkboxBitmap(size,before.snapshot.ui.bounds,true),size,mapping,before.snapshot.ui.bounds);
 assert.deepEqual(blank.shades,Array(16).fill(715));assert.equal(blank.contrast,0);assert.equal(settingsFrameAcceptance(before,structuredClone(before),blank).accepted,false);
 const painted=settingsPixelContrast(checkboxBitmap(size,before.snapshot.ui.bounds),size,mapping,before.snapshot.ui.bounds);assert.equal(painted.opaque,true);assert.ok(painted.contrast>=20);
 assert.equal(settingsFrameAcceptance(before,structuredClone(before),painted).accepted,true);
 for(const mutate of [s=>s.snapshot.ui.bounds.y++,s=>s.snapshot.ui.status='ready',s=>s.snapshot.scroll.y++,s=>s.snapshot.style.thumbTransform='matrix(1,0,0,1,13,0)',s=>s.snapshot.visible=false,s=>s.guests.push({id:'covering-guest'})]){const after=structuredClone(before);mutate(after);assert.equal(settingsFrameAcceptance(before,after,painted).accepted,false);}
 assert.equal(settingsFrameAcceptance({...before,guests:[{id:'covering-guest'}]},before,painted).accepted,false);
 assert.equal(settingsFrameAcceptance(before,before,{...painted,contrast:19}).accepted,false);assert.equal(settingsFrameAcceptance(before,before,{...painted,contrast:20}).accepted,true);
 assert.equal(settingsPixelContrast(checkboxBitmap(size,before.snapshot.ui.bounds),size,{...mapping,originX:100},before.snapshot.ui.bounds).opaque,false);
});

test('the actual OS capture retries blank and changing UI frames, binds the accepted state and stops at six attempts',async()=>{
 for(const permanentlyBlank of [false,true]){
  const size={width:50,height:40},header=Buffer.alloc(24),state=settingsState(),part={captures:[]},writes=[];header.writeUInt32BE(size.width,16);header.writeUInt32BE(size.height,20);let acquisitions=0;
  const display={bounds:{x:0,y:0,...size},workArea:{x:0,y:0,...size},scaleFactor:1},geometry={cropPixels:{x:0,y:0,...size},mapping:{originX:0,originY:0,scaleX:1,scaleY:1}};
  const context={phase:'write',part,facts:{},assert,Buffer,process:{pid:123,platform:'darwin'},sha,settingsPixelContrast,settingsFrameAcceptance,
   fixture:{frame:async()=>{}},screen:{getDisplayMatching:()=>display},win:{getBounds:()=>display.bounds,getContentBounds:()=>display.bounds},screenCropGeometry:()=>geometry,
   readSettingsCapture:async()=>structuredClone(state),until:async check=>{for(let i=0;i<10;i++)if(await check())return;throw Error('readiness timed out');},
   bounded:async operation=>await operation,sleep:async()=>{},save:async()=>{},fs:{writeFile:async(name,bytes)=>{writes.push({name,bytes});}},
   globalCapture:{permission:()=> 'granted',acquire:async()=>{acquisitions++;if(acquisitions===2)state.snapshot.ui.bounds.x=12;return{kind:'screen',backend:'unit-readback',base:'data:image/png;base64,'+header.toString('base64')};}},
   nativeImage:{createFromBuffer:()=>({crop:()=>({toPNG:()=>header,toBitmap:()=>checkboxBitmap(size,state.snapshot.ui.bounds,permanentlyBlank||acquisitions===1)})})}};
  const capture=vm.runInNewContext('('+actualFunction('async function capture(','\n async function openSettings(')+')',context);
  if(permanentlyBlank){await assert.rejects(capture('initial-off',{settings:true}));assert.equal(acquisitions,6);assert.equal(part.captures[0].accepted,false);}
  else{assert.equal(await capture('initial-off',{settings:true}),'mouse-639-adblock-write-initial-off.png');assert.equal(acquisitions,3);assert.equal(part.captures[0].accepted,true);assert.equal(part.captures[0].ui.bounds.x,12);assert.deepEqual(Array.from(part.captures[0].uiAttempts,row=>row.accepted),[false,false,true]);}
  assert.equal(writes.length,2,'only the final actual window/display buffers are written');assert.equal(part.captures[0].uiAttempts.length,acquisitions);
 }
});

test('the actual settings receipt uses the UI readback bound to the accepted OS frame',async()=>{
 const accepted=settingsState().snapshot.ui,part={captures:[],ui:[]};accepted.bounds.x=12;
 const settingsShot=vm.runInNewContext('('+actualFunction('async function settingsShot(','\n async function changeEnabled(')+')',{assert,part,openSettings:async()=>{},capture:async(name,options)=>{assert.equal(options.settings,true);part.captures.push({ui:accepted});return name+'.png';}});
 assert.equal(await settingsShot('initial-off'),accepted);assert.equal(part.ui[0].bounds,accepted.bounds);assert.equal(part.ui[0].capture,'initial-off.png');
});
