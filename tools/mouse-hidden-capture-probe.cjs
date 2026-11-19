'use strict';
// Standalone diagnostic only. It does not import Mouse, alter its profile or
// turn a stale capture into passing evidence. Six fresh native views compare
// documented View operations; the later visible control is reported separately.
const {app,BrowserWindow,WebContentsView,View,screen,desktopCapturer,systemPreferences}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomUUID,createHash}=require('node:crypto');
const OUT=path.resolve(process.argv.find(value=>value.startsWith('--out='))?.slice(6)||'mouse-hidden-capture-probe-output');
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(path.join(OUT,'profile'),{recursive:true});
app.setPath('userData',path.join(OUT,'profile'));
app.setName('Mouse hidden capture probe');
const started=performance.now(),BACKOFF=[16,32,64,128,256,256,256];
const WIDTH=505,OLD=process.platform==='win32'?295:273,NEXT=OLD-28;
const OLD_COLOR=[209,53,87,255],NEW_COLOR=[39,192,161,255],TOP=[247,214,56,255],BOTTOM=[52,98,226,255];
const report={diagnosticOnly:true,source:process.env.MOUSE_PROBE_SOURCE||null,platform:process.platform,arch:process.arch,
 versions:process.versions,budgetMs:85000,requested:{width:WIDTH,oldHeight:OLD,newHeight:NEXT},
 documentedAPIs:['https://www.electronjs.org/docs/latest/api/view','https://www.electronjs.org/docs/latest/api/web-contents'],
 scope:'Native hidden resize; no release acceptance, image cropping, scaling, page reload or replacement',variants:[],requests:[]};
let win,server,finished=false;
const hash=data=>createHash('sha256').update(data).digest('hex');
const elapsed=()=>Math.round((performance.now()-started)*1000)/1000;
function save(){fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify(report,null,2)+'\n');}
function log(value){const line=JSON.stringify({at:elapsed(),...value});console.log(line);fs.appendFileSync(path.join(OUT,'probe.log'),line+'\n');}
function finish(code,error){if(finished)return;finished=true;clearTimeout(watchdog);report.elapsedMs=elapsed();report.completed=code===0;if(error)report.error={message:String(error.message||error),stack:error.stack};save();log({finished:true,code});try{server?.closeAllConnections();server?.close();win?.destroy();}catch{}app.exit(code);}
const watchdog=setTimeout(()=>finish(2,Error('Probe exceeded its fixed 85-second budget')),85000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}

function html(id){return `<!doctype html><meta charset="utf-8"><title>Hidden resize ${id}</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:rgb(${OLD_COLOR.slice(0,3)})}
@media(max-height:${NEXT+2}px){body{background:rgb(${NEW_COLOR.slice(0,3)})}}
#top,#bottom{position:fixed;left:0;right:0;height:16px}#top{top:0;background:rgb(${TOP.slice(0,3)})}#bottom{bottom:0;background:rgb(${BOTTOM.slice(0,3)})}
input{position:absolute;left:30px;top:40px;width:300px}p{position:absolute;left:30px;top:80px}</style>
<div id="top"></div><input id="kept" value="preserved-${id}"><p>Responsive native viewport</p><div id="bottom"></div>
<script>window.probe={identity:${JSON.stringify(id)},timeOrigin:performance.timeOrigin,resizes:[],visibility:[],stream:0};
function observe(kind){const row={at:performance.now(),innerWidth,innerHeight,visibility:document.visibilityState,hidden:document.hidden};probe[kind].push(row);}
addEventListener('resize',()=>observe('resizes'));document.addEventListener('visibilitychange',()=>observe('visibility'));observe('visibility');
(async()=>{const response=await fetch('/stream/${id}');const reader=response.body.getReader();while(true){const row=await reader.read();if(row.done)break;probe.stream+=row.value.length;probe.lastStreamAt=performance.now();}})().catch(error=>probe.streamError=String(error));</script>`;}

async function startServer(){
 server=http.createServer((req,res)=>{
  const match=/^\/(page|stream)\/([a-f0-9-]+)$/.exec(req.url||'');
  if(!match){res.writeHead(404);res.end();return;}
  const [,kind,id]=match;report.requests.push({kind,id,at:elapsed()});
  if(kind==='page'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':'hidden_probe='+id+'; Path=/; SameSite=Strict'});res.end(html(id));return;}
  res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});let n=0;res.write('0\n');
  const timer=setInterval(()=>res.write(String(++n)+'\n'),50);res.on('close',()=>clearInterval(timer));
 });
 await bounded(new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)),2000,'HTTP listen');
 return 'http://127.0.0.1:'+server.address().port;
}

function nativeState(view,parent){return{at:elapsed(),webContentsId:view.webContents.id,viewBounds:view.getBounds(),parentBounds:parent.getBounds(),
 viewVisible:view.getVisible(),parentVisible:parent.getVisible(),parentIndex:parent.children.indexOf(view),
 siblings:parent.children.map(child=>child===view?'owned':child.constructor.name),windowVisible:win.isVisible(),
 focused:view.webContents.isFocused(),beingCaptured:view.webContents.isBeingCaptured()};}
async function state(view,parent){
 const native=nativeState(view,parent);
 const dom=await bounded(view.webContents.executeJavaScript(`(()=>{const box=id=>{const b=document.getElementById(id).getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height}};return{...probe,innerWidth,innerHeight,clientHeight:document.documentElement.clientHeight,visibility:document.visibilityState,hidden:document.hidden,field:document.getElementById('kept').value,cookie:document.cookie,url:location.href,background:getComputedStyle(document.body).backgroundColor,top:box('top'),bottom:box('bottom')}})()`),1000,'Page state');
 return{native,dom};
}
function imageFacts(image,name,height){
 if(image.isEmpty())return{empty:true};
 const scales=image.getScaleFactors(),scale=Math.max(...scales),size=image.getSize(scale),png=image.toPNG({scaleFactor:scale});
 if(png.length<24||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid native PNG');
 const width=png.readUInt32BE(16),pixelHeight=png.readUInt32BE(20),bitmap=image.toBitmap({scaleFactor:scale});
 const read=(x,y)=>{x=Math.min(width-1,Math.max(0,Math.floor(x*scale)));y=Math.min(pixelHeight-1,Math.max(0,Math.floor(y*scale)));const i=(y*width+x)*4;return[bitmap[i+2],bitmap[i+1],bitmap[i],bitmap[i+3]];};
 const expectedBody=height===OLD?OLD_COLOR:NEW_COLOR;
 const points=[{x:8,y:5,color:TOP},{x:8,y:32,color:expectedBody},{x:8,y:height-20,color:expectedBody},{x:8,y:height-8,color:BOTTOM}];
 const probes=points.map(point=>({...point,actual:read(point.x,point.y)}));
 const exactDimensions=width===Math.round(WIDTH*scale)&&pixelHeight===Math.round(height*scale)&&size.width===width&&size.height===pixelHeight;
 const freshPixels=bitmap.length===width*pixelHeight*4&&probes.every(p=>p.actual.every((value,i)=>Math.abs(value-p.color[i])<=2));
 fs.writeFileSync(path.join(OUT,name),png);
 return{filename:name,sha256:hash(png),bytes:png.length,scales,scale,representation:size,png:{width,height:pixelHeight},bitmapBytes:bitmap.length,probes,exactDimensions,freshPixels,freshViewport:exactDimensions&&freshPixels};
}
async function readFrame(view,name,height,timeout=1500){const begin=elapsed();try{return{startedAt:begin,...imageFacts(await bounded(view.webContents.capturePage(undefined,{stayHidden:true,stayAwake:false}),timeout,'Native capture'),name,height),finishedAt:elapsed()};}catch(error){return{startedAt:begin,finishedAt:elapsed(),error:String(error.message||error)};}}
async function displayFrame(name){
 try{if(process.platform==='darwin'){const permission=systemPreferences.getMediaAccessStatus('screen');if(permission!=='granted')return{available:false,reason:'Screen permission not already granted; no prompt requested',permission};}
  const display=screen.getDisplayMatching(win.getBounds()),sources=await bounded(desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}}),1500,'Display thumbnail');
  const source=sources.find(item=>String(item.display_id)===String(display.id));if(!source||source.thumbnail.isEmpty())return{available:false,reason:'No matching nonempty display thumbnail'};
  const png=source.thumbnail.toPNG();fs.writeFileSync(path.join(OUT,name),png);return{available:true,source:'desktopCapturer.getSources screen thumbnail',filename:name,sha256:hash(png),pixelSize:source.thumbnail.getSize(),display:{id:display.id,bounds:display.bounds,scaleFactor:display.scaleFactor},windowBounds:win.getBounds(),contentBounds:win.getContentBounds()};
 }catch(error){return{available:false,error:String(error.message||error)};}
}

async function variant(base,topology,action){
 const id=randomUUID(),name=topology+'-'+action,row={name,id,topology,action,startedAt:elapsed(),captures:[],nativeSamples:[],events:[],note:'Native getVisible reports drawable flags, not proof against all transient on-screen visibility. Display is a sampled thumbnail.'};
 report.variants.push(row);save();log({variant:name,phase:'start'});
 const parent=topology==='clip'?new View():win.contentView,view=new WebContentsView({webPreferences:{partition:'mouse-hidden-probe-'+id,backgroundThrottling:true,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 const wc=view.webContents;let sampler;
 const bounds=height=>({x:topology==='clip'?0:24,y:topology==='clip'?0:height===NEXT?100:72,width:WIDTH,height});
 try{
  if(topology==='clip'){parent.setBounds({x:24,y:72,width:WIDTH,height:OLD});win.contentView.addChildView(parent);}
  view.setBounds(bounds(OLD));parent.addChildView(view);view.setVisible(true);if(topology==='clip')parent.setVisible(true);
  for(const event of ['did-start-navigation','did-finish-load','focus','blur','render-process-gone'])wc.on(event,(_event,...args)=>row.events.push({at:elapsed(),event,details:args.map(value=>typeof value==='object'?JSON.stringify(value):value)}));
  await bounded(wc.loadURL(base+'/page/'+id),5000,'Fixture load');await delay(150);
  row.initial=await state(view,parent);row.initialFrame=await readFrame(view,name+'-initial.png',OLD);
  if(!row.initialFrame.freshViewport)throw Error('Visible initial control does not match its known old viewport');
  view.setVisible(false);if(topology==='clip')parent.setVisible(false);await delay(30);
  row.hiddenBefore=await state(view,parent);const index=parent.children.indexOf(view);row.savedParentIndex=index;
  // The first changed bounds MUST be assigned while GetWidget() is absent.
  // All remove/set/add calls are synchronous, on the same still-hidden view.
  if(action==='detach'){
   parent.removeChildView(view);row.detached=nativeState(view,parent);
   if(topology==='clip')parent.setBounds({x:24,y:100,width:WIDTH,height:NEXT});
   view.setBounds(bounds(NEXT));row.detachedResized=nativeState(view,parent);
   parent.addChildView(view,index);
  }else{
   if(topology==='clip')parent.setBounds({x:24,y:100,width:WIDTH,height:NEXT});
   view.setBounds(bounds(NEXT));
  }
  row.hiddenAfterResize=await state(view,parent);
  if(parent.children[index]!==view||view.getVisible()||(topology==='clip'&&parent.getVisible()))throw Error('Hidden identity or parent index changed');
  sampler=setInterval(()=>{if(row.nativeSamples.length<1000&&!wc.isDestroyed())row.nativeSamples.push(nativeState(view,parent));},10);
  const deadline=performance.now()+2500;
  for(let attempt=0;attempt<8&&performance.now()<deadline;attempt++){
   const capture={attempt:attempt+1,before:await state(view,parent)};row.captures.push(capture);
   if(action==='invalidate'){capture.invalidatedAt=elapsed();wc.invalidate();}
   capture.frame=await readFrame(view,name+'-hidden-'+(attempt+1)+'.png',NEXT,Math.max(1,Math.min(1500,deadline-performance.now())));
   capture.after=await state(view,parent);save();
   if(capture.frame.error?.includes('timed out'))break;
   if(attempt<7&&performance.now()<deadline)await delay(Math.min(BACKOFF[attempt],Math.max(0,deadline-performance.now())));
  }
  clearInterval(sampler);sampler=null;
  row.hiddenAfter=await state(view,parent);row.hiddenDisplay=await displayFrame(name+'-hidden-display.png');
  row.firstFreshAttempt=row.captures.find(c=>c.frame?.freshViewport&&c.after.dom.innerHeight===NEXT)?.attempt||null;
  const first=row.initial.dom,last=row.hiddenAfter.dom;
  row.preserved={sameWebContents:row.initial.native.webContentsId===row.hiddenAfter.native.webContentsId,sameDocument:first.identity===last.identity&&first.timeOrigin===last.timeOrigin&&first.url===last.url,form:first.field===last.field,cookie:first.cookie===last.cookie,streamContinued:last.stream>row.hiddenBefore.dom.stream,parentIndex:row.hiddenAfter.native.parentIndex===index,oneNavigation:report.requests.filter(r=>r.kind==='page'&&r.id===id).length===1,hiddenViewStayedHidden:row.nativeSamples.every(s=>s.viewVisible===false),hiddenParentStayedHidden:topology!=='clip'||row.nativeSamples.every(s=>s.parentVisible===false)};
  // Positive control only; never counted as hidden success or a recovery.
  if(topology==='clip')parent.setVisible(true);view.setVisible(true);await delay(100);
  row.visibleControl={state:await state(view,parent),frame:await readFrame(view,name+'-visible-control.png',NEXT)};
  row.finishedAt=elapsed();row.observed=true;log({variant:name,firstFreshAttempt:row.firstFreshAttempt,preserved:row.preserved,visibleControlFresh:row.visibleControl.frame.freshViewport});
 }catch(error){row.error={message:String(error.message||error),stack:error.stack};log({variant:name,error:row.error.message});}
 finally{clearInterval(sampler);try{parent.removeChildView(view);if(topology==='clip')win.contentView.removeChildView(parent);if(!wc.isDestroyed())wc.close({waitForBeforeUnload:false});}catch(error){row.cleanupError=String(error.message||error);}save();}
}

app.whenReady().then(async()=>{
 if(process.versions.electron!=='44.5.0')throw Error('Expected exact Electron 44.5.0');
 if(!['darwin','win32'].includes(process.platform))throw Error('This native diagnostic is intended only for macOS and Windows runners');
 report.displays=screen.getAllDisplays().map(display=>({id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor}));
 const base=await startServer();
 win=new BrowserWindow({width:700,height:440,useContentSize:true,show:true,backgroundColor:'#17243a',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await bounded(win.loadURL('data:text/html,'+encodeURIComponent('<style>body{background:#17243a;color:white;font:20px sans-serif}h1{font-size:20px}</style><h1>Mouse hidden resize diagnostic</h1>')),5000,'Shell load');win.show();win.focus();await delay(100);
 for(const topology of ['direct','clip'])for(const action of ['baseline','invalidate','detach'])await variant(base,topology,action);
 report.summary=report.variants.map(row=>({name:row.name,firstFreshAttempt:row.firstFreshAttempt,preserved:row.preserved,error:row.error?.message||null,visibleControlFresh:row.visibleControl?.frame.freshViewport===true}));
 const failed=report.variants.some(row=>row.error||row.cleanupError);finish(failed?1:0,failed?Error('One or more probe cases could not complete; inspect per-case facts'):null);
}).catch(error=>finish(1,error));
