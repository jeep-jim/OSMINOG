'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {contour}=require('./mouse/burrow-motion.js');
const near=(a,b,epsilon=.002)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);

// Sample SVG independently of the production geometry: each cubic is evaluated
// from its four control points, while H/V and closure become straight edges.
function samplePath(d,steps=24){
 const tokens=d.match(/[A-Za-z]|-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g),points=[];let i=0,x=0,y=0,start;
 const add=(nx,ny)=>{x=nx;y=ny;points.push({x,y});};
 while(i<tokens.length){const cmd=tokens[i++];
  if(cmd==='M'){add(Number(tokens[i++]),Number(tokens[i++]));start={x,y};}
  else if(cmd==='H')add(Number(tokens[i++]),y);
  else if(cmd==='V')add(x,Number(tokens[i++]));
  else if(cmd==='C'){
   const ax=x,ay=y,bx=Number(tokens[i++]),by=Number(tokens[i++]),cx=Number(tokens[i++]),cy=Number(tokens[i++]),dx=Number(tokens[i++]),dy=Number(tokens[i++]);
   for(let t=1;t<=steps;t++){const u=t/steps,v=1-u;add(v*v*v*ax+3*v*v*u*bx+3*v*u*u*cx+u*u*u*dx,v*v*v*ay+3*v*v*u*by+3*v*u*u*cy+u*u*u*dy);}
  }else if(cmd==='Z')add(start.x,start.y);else throw Error('Unknown SVG command '+cmd);
 }
 return points;
}
function properIntersection(a,b,c,d){
 const side=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),eps=1e-8;
 return side(a,b,c)*side(a,b,d)<-eps&&side(c,d,a)*side(c,d,b)<-eps;
}

test('the fixed Nora arch keeps its original symmetric silhouette without self-intersections',()=>{
 for(const width of [320,701,1000,987.25])for(const height of [80,240,440,580]){
  const s=contour({width,height}),points=samplePath(s.d),closed=[...points,points[0]];
  assert.ok(!/NaN|Infinity/.test(s.d));near(s.start+s.end,width);near(s.left+s.right,width);
  for(let i=0;i<points.length;i++){
   const p=points[i],mirror=points[points.length-1-i];near(p.x+mirror.x,width);near(p.y,mirror.y);
   assert.ok(p.x>=-.002&&p.x<=width+.002&&p.y>=-.002&&p.y<=height+.002,JSON.stringify({width,height,p}));
  }
  near(points[0].y,height);near(points.at(-1).y,height);assert.ok(points.some(p=>Math.abs(p.y)<.002));
  for(let i=1;i<closed.length;i++)for(let j=i+2;j<closed.length;j++)assert.equal(properIntersection(closed[i-1],closed[i],closed[j-1],closed[j]),false,JSON.stringify({width,height,i,j}));
 }
});

function controllerFixture({deferReady=false,deferPlay=false,effectTimingCache=false,timelineLag=0,startNow=0,trace=false}={}){
 let now=startNow,lag=timelineLag,footerTop=772,viewportWidth=1280,viewportHeight=800,contentHeight=440,reads=0,writes=0,clockReads=0,rafId=0,rafRequests=0;const created=[],animations=[],observers=[],listeners=new Map(),settled=[],rafs=new Map(),readiness=[];
 class Animation{
  constructor(node,frames,options){this.node=node;this.keyframes=frames;this.options=options;this.rate=1;this.pendingRate=null;this.hold=0;this.started=now;this.running=false;this.cancelled=false;this.willChangeAtCreation=node.style.willChange;this.ready=deferReady?new Promise(resolve=>readiness.push(()=>resolve(this))):Promise.resolve(this);this.newFinished();this.effect={getComputedTiming:()=>({progress:this.effectState().progress})};animations.push(this);}
  newFinished(){this.finished=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});this.completed=false;}
  get currentTime(){return Math.max(0,Math.min(this.options.duration,this.hold+(this.running?(now-this.started)*this.rate:0)));}
  set currentTime(value){this.hold=value;this.started=now;}
  get startTime(){return this.pending||!this.running?null:this.started-this.hold/this.rate;}
  set startTime(value){this.started=value;this.hold=0;this.pending=false;this.running=true;this.resolvePlay?.(this);this.resolvePlay=null;}
  get playState(){return this.cancelled?'idle':this.completed?'finished':this.running||this.pending?'running':'paused';}
  get playbackRate(){return this.rate;}
  set playbackRate(rate){const value=this.currentTime;this.pendingRate=null;this.rate=rate;this.hold=value;this.started=now;}
  get effectivePlaybackRate(){return this.pendingRate??this.rate;}
  // Chromium152 TimingCalculations::CalculatePhase/Timing::CalculateTimings:
  // an exact end is after/non-current when forwards, active/current backwards.
  // AnimationEffect::UpdateInheritedTime caches by time and idle state, without
  // a rate key. A rate-only update can therefore retain the previous phase.
  effectState(){const time=this.currentTime;if(!effectTimingCache||this.effectTime!==time||this.effectIdle!==this.cancelled){const phase=time<=0&&this.rate<0?'before':time>=this.options.duration&&this.rate>=0?'after':'active';this.effectTime=time;this.effectIdle=this.cancelled;this.effectTiming={phase,isCurrent:!this.cancelled&&(phase==='active'||phase==='before'&&this.rate>0||phase==='after'&&this.rate<0),progress:Math.max(0,Math.min(1,time/this.options.duration))};}return this.effectTiming;}
  pause(){this.hold=this.currentTime;this.running=false;}
  updatePlaybackRate(rate){if(deferPlay&&(this.running||this.pending)){this.pendingRate=rate;return;}this.playbackRate=rate;}
  play(){const value=this.currentTime;if(this.completed)this.newFinished();this.hold=value;this.started=now;if(deferPlay){if(!this.pending)this.ready=new Promise(resolve=>{this.resolvePlay=resolve;});this.pending=true;this.running=false;}else this.running=true;}
  browserReady(){if(!this.pending||this.cancelled)return;if(this.pendingRate!==null)this.playbackRate=this.pendingRate;this.pending=false;this.running=true;this.started=now;this.resolvePlay?.(this);this.resolvePlay=null;}
  cancel(){this.running=false;this.cancelled=true;if(!this.completed)this.reject(Object.assign(Error('cancelled'),{name:'AbortError'}));}
  advance(){if(!this.running||this.cancelled)return;const value=this.currentTime;if(this.rate>0?value>=this.options.duration:value<=0){this.hold=value;this.running=false;this.completed=true;this.resolve(this);}}
 }
 class Node{
  constructor(){this.style=new Proxy({setProperty(k,v){this[k]=v;}},{set(object,key,value){writes++;object[key]=value;return true;}});this.dataset={};this.attrs=new Map();this.children=[];this.hidden=false;this.inert=false;this.parentNode=null;}
  setAttribute(k,v){writes++;this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}removeAttribute(k){writes++;this.attrs.delete(k);}
  append(...nodes){for(const node of nodes){node.parentNode?.removeChild(node);this.children.push(node);node.parentNode=this;}}
  removeChild(node){this.children.splice(this.children.indexOf(node),1);node.parentNode=null;}
  insertBefore(node,before){node.parentNode?.removeChild(node);const at=this.children.indexOf(before);this.children.splice(at<0?this.children.length:at,0,node);node.parentNode=this;}
  animate(frames,options){return new Animation(this,frames,options);}
 }
 const path=new Node(),clip=new Node(),local=new Node(),glass=new Node(),tray=new Node(),content=new Node(),footer=new Node(),button=new Node(),toolbar=new Node();
 local.append(path);tray.append(local,glass,content);local.querySelector=s=>s===':scope>path'?path:s==='clipPath path'?clip:null;tray.querySelector=s=>s==='.desk-burrow-shape'?local:s==='.desk-glass'?glass:null;
 tray.getBoundingClientRect=()=>{reads++;return{width:Math.min(1000,viewportWidth-12)};};footer.getBoundingClientRect=()=>{reads++;return{top:footerTop};};toolbar.getBoundingClientRect=()=>{reads++;return{bottom:40};};
 content.getBoundingClientRect=()=>{reads++;return{height:contentHeight};};
 Object.defineProperty(content,'scrollHeight',{get(){throw Error('Nora must fit natural content rather than a scroller');}});
 const body=new Node(),classes=new Set();body.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};
 const media={matches:false,addEventListener(_type,fn){this.change=fn;}};
 const ctx={console,performance:{now(){clockReads++;return now;}},document:{body,timeline:{get currentTime(){return now-lag;}},createElementNS(){const node=new Node();created.push(node);return node;},createElement(){const node=new Node();created.push(node);return node;},querySelector:s=>s==='.toolbar'?toolbar:created.find(n=>'#'+n.id===s)},window:{addEventListener:(type,fn)=>listeners.set(type,fn)},matchMedia:()=>media,getComputedStyle:()=>{reads++;return{borderTopWidth:'1px'};},ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}},requestAnimationFrame(fn){rafRequests++;rafs.set(++rafId,fn);return rafId;},cancelAnimationFrame(id){rafs.delete(id);},innerWidth:viewportWidth,innerHeight:viewportHeight};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./mouse/burrow-motion.js'),'utf8'),ctx);
 const motion=ctx.createMouseBurrowMotion({tray,content,footer,button,trace,settled:opened=>settled.push(opened)});
 const at=async time=>{assert.ok(time>=now);now=time;for(const animation of animations){animation.advance();if(effectTimingCache)animation.effectState();}await Promise.resolve();};
 const paint=async(time=now)=>{await at(time);const pending=[...rafs.values()];rafs.clear();for(const callback of pending)callback(now);await Promise.resolve();};
 const warm=async()=>{await Promise.resolve();await Promise.resolve();await paint();await paint();};
 return{motion,tray,content,footer,classes,settled,created,animations,local,path,clip,at,paint,warm,ready(){for(const resolve of readiness.splice(0))resolve();},async playReady(){lag=0;for(const animation of animations)animation.browserReady();await Promise.resolve();await Promise.resolve();},get queuedFrames(){return rafs.size;},get frameRequests(){return rafRequests;},get clockReads(){return clockReads;},get time(){return now;},counts:()=>({reads,writes}),resize({width=viewportWidth,top=footerTop,height=viewportHeight}={}){viewportWidth=width;viewportHeight=height;footerTop=top;ctx.innerWidth=width;ctx.innerHeight=height;listeners.get('resize')();},observed(){observers[0]([{target:tray,contentRect:{width:Math.min(1000,viewportWidth-12),height:440}},{target:footer,contentRect:{width:viewportWidth,height:28}}]);},changeContent(height){contentHeight=height;observers[0]([{target:content,contentRect:{width:800,height}}]);},reduced(value){media.matches=value;media.change();}};
}

test('Nora slides a fixed final contour using transform and opacity animation only',async()=>{
 const f=controllerFixture(),opened=f.motion.open(),initial=f.motion.sample(),panel=f.created.find(node=>node.className==='desk-burrow-panel');
 assert.equal(initial.kind,'slide');assert.equal(initial.height,440);assert.equal(initial.width,1000);assert.equal(f.tray.style.height,'440px');assert.equal(f.content.inert,true);assert.equal(f.animations.length,2);assert.equal(f.animations[0].node,panel);
 assert.deepEqual(JSON.parse(JSON.stringify(f.animations[0].keyframes)),[{transform:'translate3d(0,100%,0)'},{transform:'translate3d(0,0,0)'}]);assert.deepEqual(JSON.parse(JSON.stringify(f.animations[1].keyframes)),[{opacity:0},{opacity:.12}]);
 await f.warm();
 const counts=f.counts(),path=f.path.getAttribute('d'),clip=f.clip.getAttribute('d');let previous=0;
 for(const time of [30,60,100,150,200,250]){await f.at(time);const sample=f.motion.sample();assert.ok(sample.progress>previous&&sample.progress<1);previous=sample.progress;assert.equal(sample.height,440);assert.equal(sample.width,1000);assert.equal(sample.geometryWrites,initial.geometryWrites);assert.equal(sample.measurements,initial.measurements);assert.equal(f.path.getAttribute('d'),path);assert.equal(f.clip.getAttribute('d'),clip);assert.deepEqual(f.counts(),counts,'Animation sampling performs no geometry/style writes or layout reads');}
 await f.at(300);assert.equal(await opened,true);assert.equal(f.content.inert,false);assert.equal(f.motion.progress,1);assert.equal(f.motion.isSettled,true);assert.equal(panel.style.willChange,'');assert.equal(panel.style.transform,'translate3d(0,0,0)');assert.equal(f.tray.dataset.motion,'open');assert.deepEqual(f.settled,[true]);
 const closing=f.motion.close();assert.equal(f.content.inert,true);await f.warm();await f.at(450);assert.equal(f.motion.sample().height,440);assert.ok(f.motion.progress>0&&f.motion.progress<1);await f.at(600);assert.equal(await closing,true);assert.equal(f.tray.dataset.motion,'closed');assert.equal(f.motion.sample().height,440);f.motion.release();assert.equal(f.motion.sample(),null);assert.equal(f.classes.has('mouse-dock-active'),false);
});

test('reversal keeps the same animation player, exact transform progress and fixed dimensions',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.warm();await f.at(140);const before=f.motion.sample(),player=f.animations[0],closing=f.motion.close();assert.equal(await opening,false);near(f.motion.progress,before.progress);assert.equal(f.animations[0],player);assert.equal(f.animations.length,2);assert.equal(f.tray.dataset.motion,'closing');
 await f.at(180);const reversing=f.motion.sample(),reopening=f.motion.open();assert.equal(await closing,false);near(f.motion.progress,reversing.progress);assert.equal(f.motion.sample().height,before.height);assert.equal(f.animations.length,2);assert.equal(f.frameRequests,2,'Reversing an existing player never repeats startup preparation');await f.at(480);assert.equal(await reopening,true);assert.deepEqual(f.settled,[true]);
});

test('unchanged sync does not remeasure; content expansion grows Nora above its fixed footer',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.warm();await f.at(300);await opening;const initial=f.motion.sample(),counts=f.counts();
 for(let i=0;i<1000;i++)f.motion.sync();assert.deepEqual(f.counts(),counts);assert.equal(f.motion.sample().height,440);assert.equal(f.motion.sample().geometryWrites,initial.geometryWrites);
 f.resize({width:950,top:700,height:728});const resized=f.motion.sample();assert.equal(resized.width,938);assert.equal(resized.height,440);near(resized.baseline,700);near(resized.left+resized.width/2,475);assert.equal(resized.geometryWrites,initial.geometryWrites+1);
 f.observed();assert.equal(f.motion.sample().geometryWrites,resized.geometryWrites,'Duplicate ResizeObserver notification does not rewrite the SVG');
 f.changeContent(580);const expanded=f.motion.sample();assert.equal(expanded.height,580);assert.equal(expanded.contentHeight,580);assert.equal(expanded.fits,true);assert.equal(expanded.baseline,resized.baseline);assert.ok(expanded.baseline-expanded.height<resized.baseline-resized.height);assert.equal(f.animations.length,2,'Content growth does not restart open animation');assert.equal(f.motion.progress,1);
 f.changeContent(310);const collapsed=f.motion.sample();assert.equal(collapsed.height,310);assert.equal(collapsed.baseline,expanded.baseline);assert.equal(collapsed.fits,true);assert.equal(f.animations.length,2);
});

test('window resize changes fixed geometry once without replacing or rewinding the slide',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.warm();await f.at(110);const before=f.motion.sample();f.resize({width:680,top:222,height:250});const next=f.motion.sample();near(next.progress,before.progress);assert.equal(next.height,170);assert.equal(next.contentHeight,440);assert.equal(next.fits,false);assert.equal(next.width,668);assert.equal(f.animations.length,2);assert.equal(next.geometryWrites,before.geometryWrites+1);await f.at(300);assert.equal(await opening,true);
 const writes=f.motion.sample().geometryWrites;f.changeContent(500);assert.equal(f.motion.sample().geometryWrites,writes);assert.equal(f.motion.sample().contentHeight,500,'Clamped content diagnostics remain current');assert.equal(f.motion.sample().fits,false);
});

test('reduced motion settles immediately and interrupted release has no stale completion',async()=>{
 const f=controllerFixture();f.reduced(true);assert.equal(await f.motion.open(),true);assert.equal(f.animations.length,0);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);assert.equal(await f.motion.close(),true);assert.equal(f.motion.progress,0);f.motion.release();
 f.reduced(false);const opening=f.motion.open();await f.warm();await f.at(100);assert.ok(f.motion.progress>0&&f.motion.progress<1);f.reduced(true);assert.equal(await opening,true);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);
 f.reduced(false);const closing=f.motion.close();await f.at(140);f.motion.release();assert.equal(await closing,false);const counts=f.counts();f.motion.sync();f.observed();await f.at(1000);assert.deepEqual(f.counts(),counts);assert.equal(f.motion.sample(),null);assert.equal(f.tray.dataset.motion,'closed');assert.ok(f.animations.every(a=>a.cancelled));
});

test('initial layer readiness and slow preparation do not consume the300ms slide',async()=>{
 const f=controllerFixture({deferReady:true}),opened=f.motion.open();
 assert.deepEqual(f.animations.map(a=>a.willChangeAtCreation),['transform','opacity']);assert.ok(f.animations.every(a=>!a.running));
 await f.at(115);assert.equal(f.motion.progress,0);assert.equal(f.frameRequests,0,'paused-player readiness precedes preparation frames');f.ready();await Promise.resolve();await Promise.resolve();
 await f.paint(130);assert.equal(f.motion.progress,0);assert.ok(f.animations.every(a=>!a.running));
 await f.paint(160);assert.ok(f.animations.every(a=>a.running));assert.deepEqual(f.animations.map(a=>a.startTime),[160,160]);assert.equal(f.motion.progress,0,'the second preparation frame starts both players from zero');assert.equal(f.frameRequests,2);assert.equal(f.queuedFrames,0);
 const counts=f.counts();await f.at(190);near(f.motion.progress,.1);await f.at(459);assert.ok(f.motion.progress<1);assert.deepEqual(f.counts(),counts);await f.at(460);assert.equal(await opened,true);assert.equal(f.motion.progress,1);assert.equal(f.frameRequests,2,'there is no per-frame animation callback');
});

test('a fresh closing player commits its full-size layers before starting its unchanged300ms slide',async()=>{
 const f=controllerFixture({deferReady:true}),opened=f.motion.open();f.ready();await f.warm();await f.at(300);assert.equal(await opened,true);
 const closing=f.motion.close(),players=f.animations.slice(-2),panel=players[0].node;
 assert.equal(f.animations.length,4,'a settled opening released its players');assert.deepEqual(players.map(a=>a.willChangeAtCreation),['transform','opacity']);
 assert.ok(players.every(a=>!a.running));assert.equal(f.motion.progress,1);assert.equal(panel.style.transform,'translate3d(0,0,0)');assert.equal(f.content.inert,true);
 await f.at(415);assert.equal(f.motion.progress,1);assert.equal(f.frameRequests,2,'closing waits for its own paused-player readiness');f.ready();await Promise.resolve();await Promise.resolve();
 await f.paint(430);assert.equal(f.motion.progress,1);assert.ok(players.every(a=>!a.running),'the first preparation frame cannot consume closing motion');
 await f.paint(460);assert.ok(players.every(a=>a.running&&a.playbackRate===-1&&a.currentTime===300));assert.equal(f.frameRequests,4);assert.equal(f.queuedFrames,0);
 assert.ok(players.every(a=>a.options.duration===300&&a.options.easing==='cubic-bezier(.22,.8,.25,1)'),'preparation does not alter duration or easing');
 const counts=f.counts();await f.at(490);near(f.motion.progress,.9);await f.at(759);assert.ok(f.motion.progress>0);assert.deepEqual(f.counts(),counts);await f.at(760);assert.equal(await closing,true);assert.equal(f.motion.progress,0);assert.equal(f.frameRequests,4);
});

test('fresh closing remains a current effect at the end boundary before and during pending browser play',async()=>{
 const f=controllerFixture({deferPlay:true,effectTimingCache:true}),panel=f.created.find(node=>node.className==='desk-burrow-panel');
 // Independently reproduce the previously observed endpoint classification:
 // fill:both keeps the visual endpoint, but does not make it compositor-current.
 const after=panel.animate([],{duration:300,fill:'both'});after.finished.catch(()=>{});after.pause();after.currentTime=300;assert.deepEqual(after.effectState(),{phase:'after',isCurrent:false,progress:1});after.updatePlaybackRate(-1);after.play();assert.equal(after.pending,true);assert.equal(after.effectivePlaybackRate,-1);assert.equal(after.effectState().isCurrent,false,'a late rate change does not refresh unchanged endpoint timing');after.cancel();
 f.reduced(true);assert.equal(await f.motion.open(),true);f.reduced(false);const closing=f.motion.close(),players=f.animations.slice(-2);
 assert.ok(players.every(a=>a.effectState().phase==='active'&&a.effectState().isCurrent),'both fresh closing effects must be current at their first end-boundary sample');
 await f.at(115);assert.equal(f.motion.progress,1);await f.warm();assert.ok(players.every(a=>a.pending&&a.currentTime===300&&a.effectState().isCurrent),'pending play retains compositor eligibility without consuming duration');
 await f.at(155);assert.equal(f.motion.progress,1);await f.playReady();assert.ok(players.every(a=>a.playbackRate===-1&&a.effectState().isCurrent));await f.at(205);near(f.motion.progress,250/300);await f.at(454);assert.ok(f.motion.progress>0);await f.at(455);assert.equal(await closing,true);assert.equal(f.motion.progress,0);
});

test('live reversal retains its player and pending effective rate until browser readiness',async()=>{
 const f=controllerFixture({deferPlay:true,effectTimingCache:true}),opened=f.motion.open();await f.warm();await f.playReady();await f.at(300);await opened;
 const closing=f.motion.close();await f.warm();await f.playReady();await f.at(420);const players=f.animations.slice(-2),before=f.motion.progress,frames=f.frameRequests,reopened=f.motion.open();assert.equal(await closing,false);
 assert.ok(players.every(a=>a.pending&&a.playbackRate===-1&&a.effectivePlaybackRate===1),'live reversal queues its new rate instead of seeking a running player');assert.equal(f.animations.length,4);assert.equal(f.frameRequests,frames);near(f.motion.progress,before);assert.ok(players.every(a=>a.effectState().isCurrent));
 await f.at(470);near(f.motion.progress,before);await f.playReady();assert.ok(players.every(a=>a.playbackRate===1&&a.pendingRate===null));near(f.motion.progress,before);await f.at(590);assert.equal(await reopened,true);assert.equal(f.motion.progress,1);
});

test('reopen, release, immediate close and reduced motion cancel every fresh closing preparation stage',async()=>{
 for(const stage of ['ready','first-frame','second-frame'])for(const action of ['reopen','release','immediate','reduce']){
  const f=controllerFixture({deferReady:true}),opened=f.motion.open();f.ready();await f.warm();await f.at(300);await opened;const closing=f.motion.close();
  if(stage!=='ready'){f.ready();await Promise.resolve();await Promise.resolve();if(stage==='second-frame')await f.paint(316);}
  if(action==='reopen'){assert.equal(await f.motion.open(),true);assert.equal(await closing,false);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);assert.equal(f.tray.dataset.motion,'open');}
  else if(action==='release'){f.motion.release();assert.equal(await closing,false);assert.equal(f.motion.sample(),null);}
  else if(action==='immediate'){assert.equal(await f.motion.close({immediate:true}),true);assert.equal(await closing,false);assert.equal(f.motion.progress,0);}
  else{f.reduced(true);assert.equal(await closing,true);assert.equal(f.motion.progress,0);}
  assert.equal(f.queuedFrames,0);assert.ok(f.animations.every(a=>a.cancelled));const requests=f.frameRequests,counts=f.counts();f.ready();await f.paint(1000);await f.paint(1100);assert.equal(f.frameRequests,requests,'cancelled closing preparation cannot schedule stale frames');assert.deepEqual(f.counts(),counts,'late readiness cannot overwrite the new endpoint');
 }
});

test('repeated close during preparation preserves the open endpoint, then live reversal reuses those players',async()=>{
 for(const stage of ['ready','first-frame','second-frame']){
  const f=controllerFixture({deferReady:true}),opened=f.motion.open();f.ready();await f.warm();await f.at(300);await opened;const closing=f.motion.close(),players=f.animations.slice(-2);
  if(stage!=='ready'){f.ready();await Promise.resolve();await Promise.resolve();if(stage==='second-frame')await f.paint(316);}
  const repeated=f.motion.close();assert.equal(await closing,false);assert.equal(f.motion.progress,1,'another close cannot jump from an unstarted slide to closed');assert.equal(f.tray.dataset.motion,'closing');assert.equal(f.animations.length,4);assert.ok(players.every(a=>!a.cancelled&&!a.running));
  f.ready();await f.warm();const started=f.time;await f.at(started+150);near(f.motion.progress,.5);const requests=f.frameRequests,reopening=f.motion.open();assert.equal(await repeated,false);near(f.motion.progress,.5);assert.equal(f.animations.length,4);assert.equal(f.frameRequests,requests,'reversal of running closing players has no preparation delay');assert.ok(players.every(a=>a.running&&a.playbackRate===1));
  await f.at(started+300);assert.equal(await reopening,true);assert.equal(f.motion.progress,1);assert.equal(f.queuedFrames,0);
 }
});

test('a stale document timeline cannot backdate a pending browser play into its endpoint',async()=>{
 const f=controllerFixture({deferPlay:true,timelineLag:300,startNow:1000}),opened=f.motion.open();await f.warm();
 assert.equal(f.motion.progress,0,'the old frame timestamp must not bypass pending play');assert.ok(f.animations.every(a=>a.pending&&a.startTime===null));
 await f.at(1040);assert.equal(f.motion.progress,0);await f.playReady();assert.deepEqual(f.animations.map(a=>a.startTime),[1040,1040]);
 await f.at(1056);near(f.motion.progress,16/300);await f.at(1339);assert.ok(f.motion.progress<1);await f.at(1340);assert.equal(await opened,true);
});

test('startup tracing is opt-in, bounded and records real pending and ready clocks without a frame loop',async()=>{
 const normal=controllerFixture(),normalOpen=normal.motion.open();await normal.warm();await normal.at(300);await normalOpen;assert.equal(normal.motion.diagnostics().enabled,false);assert.equal(normal.motion.diagnostics().events.length,0);assert.equal(normal.clockReads,0,'production animations do not collect trace timings');
 const f=controllerFixture({deferPlay:true,timelineLag:300,startNow:1000,trace:true}),opened=f.motion.open();await f.warm();let report=f.motion.diagnostics();const pending=report.events.find(row=>row.event==='play-pending');assert.equal(pending.performanceNow,1000);assert.equal(pending.documentTime,700);assert.equal(pending.movement.currentTime,0);assert.equal(pending.movement.startTime,null);assert.equal(pending.movement.pending,true);
 await f.at(1040);await f.playReady();report=f.motion.diagnostics();const ready=report.events.find(row=>row.event==='play-ready');assert.equal(ready.documentTime,1040);assert.equal(ready.movement.startTime,1040);assert.equal(ready.shade.startTime,1040);assert.equal(ready.movement.pending,false);const count=report.events.length;
 await f.at(1056);assert.equal(f.motion.diagnostics().events.length,count,'sampling animation progress creates no additional trace records');await f.at(1340);await opened;f.reduced(true);
 for(let i=0;i<40;i++){await f.motion.close();await f.motion.open();}
 assert.equal(f.motion.diagnostics().events.length,32);assert.equal(f.frameRequests,2);
});

test('close, release and reduced motion cancel every pending preparation stage',async()=>{
 for(const stage of ['ready','first-frame','second-frame'])for(const action of ['close','release','reduce']){
  const f=controllerFixture({deferReady:true}),opening=f.motion.open();
  if(stage!=='ready'){f.ready();await Promise.resolve();await Promise.resolve();if(stage==='second-frame')await f.paint(16);}
  if(action==='close'){assert.equal(await f.motion.close(),true);assert.equal(await opening,false);assert.equal(f.motion.progress,0);}
  else if(action==='release'){f.motion.release();assert.equal(await opening,false);assert.equal(f.motion.sample(),null);}
  else{f.reduced(true);assert.equal(await opening,true);assert.equal(f.motion.progress,1);}
  assert.equal(f.queuedFrames,0);assert.ok(f.animations.every(a=>a.cancelled));const requests=f.frameRequests,counts=f.counts();f.ready();await f.paint(1000);await f.paint(1100);assert.equal(f.frameRequests,requests,'late ready cannot schedule another startup');assert.deepEqual(f.counts(),counts,'a cancelled preparation cannot mutate the hidden or settled panel');
 }
});

test('desktop preview IPC and image insertion wait for a completed opening and matching generation',async()=>{
 const source=fs.readFileSync(require.resolve('./mouse/desktops.js'),'utf8'),start=source.indexOf(' async function open(){'),end=source.indexOf('\n function clearPreviewDOM',start);assert.ok(start>=0&&end>start);
 for(const scenario of ['open','cancelled','stale','reverse','late-hint','cancelled-hint']){
  let finish,finishHint;const hintReady=scenario.endsWith('hint')?new Promise(resolve=>{finishHint=resolve;}):Promise.resolve();const calls=[],motionDone=new Promise(resolve=>{finish=resolve;}),tray={hidden:scenario!=='reverse',open:scenario==='reverse',showModal(){this.open=true;},focus(){}},ctx={opening:false,epoch:0,gesture:{ready:hintReady},tray,content:{inert:false},button:{setAttribute(){}},m:{state:{desktops:{items:[]}}},state:{items:[]},backdrop:{show:async()=>true},motion:{goal:0,open:()=>{calls.push('motion');return motionDone;}},render:()=>calls.push('render'),layout:()=>calls.push('layout'),refreshPreviews:ticket=>calls.push('preview '+ticket),close:async()=>{},status:message=>{throw Error(message);}};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end)+';globalThis.testOpen=open;',ctx);const opened=ctx.testOpen();await new Promise(setImmediate);
  if(finishHint){assert.equal(tray.hidden,true,'Hint state must resolve before the final contour is measured');assert.equal(calls.includes('motion'),false);if(scenario==='cancelled-hint')ctx.epoch++;finishHint();await new Promise(setImmediate);if(scenario==='cancelled-hint'){await opened;assert.equal(calls.length,0);continue;}}
  assert.ok(calls.includes('motion'),scenario+' reaches its deferred motion');assert.equal(calls.some(call=>call.startsWith('preview')),false,'starting motion must not request or render fresh images');
  if(scenario==='stale')ctx.epoch++;finish(scenario!=='cancelled');await opened;
  assert.equal(calls.filter(call=>call.startsWith('preview')).length,['open','reverse','late-hint'].includes(scenario)?1:0,'only the completed current opening may refresh its preview');
 }
});
