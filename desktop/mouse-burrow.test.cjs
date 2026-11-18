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

function controllerFixture(){
 let now=0,footerTop=772,viewportWidth=1280,viewportHeight=800,reads=0,writes=0;const created=[],animations=[],observers=[],listeners=new Map(),settled=[];
 class Animation{
  constructor(node,frames,options){this.node=node;this.keyframes=frames;this.options=options;this.rate=1;this.hold=0;this.started=now;this.running=false;this.cancelled=false;this.newFinished();this.effect={getComputedTiming:()=>({progress:Math.max(0,Math.min(1,this.currentTime/options.duration))})};animations.push(this);}
  newFinished(){this.finished=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});this.completed=false;}
  get currentTime(){return Math.max(0,Math.min(this.options.duration,this.hold+(this.running?(now-this.started)*this.rate:0)));}
  set currentTime(value){this.hold=value;this.started=now;}
  pause(){this.hold=this.currentTime;this.running=false;}
  updatePlaybackRate(rate){const value=this.currentTime;this.rate=rate;this.hold=value;this.started=now;}
  play(){if(this.completed)this.newFinished();this.started=now;this.running=true;}
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
 Object.defineProperty(content,'scrollHeight',{get(){throw Error('Nora motion must not measure content height');}});
 const body=new Node(),classes=new Set();body.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};
 const media={matches:false,addEventListener(_type,fn){this.change=fn;}};
 const ctx={console,document:{body,createElementNS(){const node=new Node();created.push(node);return node;},createElement(){const node=new Node();created.push(node);return node;},querySelector:s=>s==='.toolbar'?toolbar:created.find(n=>'#'+n.id===s)},window:{addEventListener:(type,fn)=>listeners.set(type,fn)},matchMedia:()=>media,getComputedStyle:()=>{reads++;return{borderTopWidth:'1px'};},ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}},requestAnimationFrame(){throw Error('Nora must use compositor animation, not an animation RAF loop');},cancelAnimationFrame(){throw Error('No Nora animation RAF should exist');},innerWidth:viewportWidth,innerHeight:viewportHeight};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./mouse/burrow-motion.js'),'utf8'),ctx);
 const motion=ctx.createMouseBurrowMotion({tray,content,footer,button,settled:opened=>settled.push(opened)});
 const at=async time=>{assert.ok(time>=now);now=time;for(const animation of animations)animation.advance();await Promise.resolve();};
 return{motion,tray,content,footer,classes,settled,created,animations,local,path,clip,at,get time(){return now;},counts:()=>({reads,writes}),resize({width=viewportWidth,top=footerTop,height=viewportHeight}={}){viewportWidth=width;viewportHeight=height;footerTop=top;ctx.innerWidth=width;ctx.innerHeight=height;listeners.get('resize')();},observed(){observers[0]([{target:tray,contentRect:{width:Math.min(1000,viewportWidth-12),height:440}},{target:footer,contentRect:{width:viewportWidth,height:28}}]);},reduced(value){media.matches=value;media.change();}};
}

test('Nora slides a fixed final contour using transform and opacity animation only',async()=>{
 const f=controllerFixture(),opened=f.motion.open(),initial=f.motion.sample(),panel=f.created.find(node=>node.className==='desk-burrow-panel');
 assert.equal(initial.kind,'slide');assert.equal(initial.height,440);assert.equal(initial.width,1000);assert.equal(f.tray.style.height,'440px');assert.equal(f.content.inert,true);assert.equal(f.animations.length,2);assert.equal(f.animations[0].node,panel);
 assert.deepEqual(JSON.parse(JSON.stringify(f.animations[0].keyframes)),[{transform:'translate3d(0,100%,0)'},{transform:'translate3d(0,0,0)'}]);assert.deepEqual(JSON.parse(JSON.stringify(f.animations[1].keyframes)),[{opacity:0},{opacity:.12}]);
 const counts=f.counts(),path=f.path.getAttribute('d'),clip=f.clip.getAttribute('d');let previous=0;
 for(const time of [30,60,100,150,200,250]){await f.at(time);const sample=f.motion.sample();assert.ok(sample.progress>previous&&sample.progress<1);previous=sample.progress;assert.equal(sample.height,440);assert.equal(sample.width,1000);assert.equal(sample.geometryWrites,initial.geometryWrites);assert.equal(sample.measurements,initial.measurements);assert.equal(f.path.getAttribute('d'),path);assert.equal(f.clip.getAttribute('d'),clip);assert.deepEqual(f.counts(),counts,'Animation sampling performs no geometry/style writes or layout reads');}
 await f.at(300);assert.equal(await opened,true);assert.equal(f.content.inert,false);assert.equal(f.motion.progress,1);assert.equal(f.motion.isSettled,true);assert.equal(panel.style.willChange,'');assert.equal(panel.style.transform,'translate3d(0,0,0)');assert.equal(f.tray.dataset.motion,'open');assert.deepEqual(f.settled,[true]);
 const closing=f.motion.close();assert.equal(f.content.inert,true);await f.at(450);assert.equal(f.motion.sample().height,440);assert.ok(f.motion.progress>0&&f.motion.progress<1);await f.at(600);assert.equal(await closing,true);assert.equal(f.tray.dataset.motion,'closed');assert.equal(f.motion.sample().height,440);f.motion.release();assert.equal(f.motion.sample(),null);assert.equal(f.classes.has('mouse-dock-active'),false);
});

test('reversal keeps the same animation player, exact transform progress and fixed dimensions',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.at(140);const before=f.motion.sample(),player=f.animations[0],closing=f.motion.close();assert.equal(await opening,false);near(f.motion.progress,before.progress);assert.equal(f.animations[0],player);assert.equal(f.animations.length,2);assert.equal(f.tray.dataset.motion,'closing');
 await f.at(180);const reversing=f.motion.sample(),reopening=f.motion.open();assert.equal(await closing,false);near(f.motion.progress,reversing.progress);assert.equal(f.motion.sample().height,before.height);assert.equal(f.animations.length,2);await f.at(480);assert.equal(await reopening,true);assert.deepEqual(f.settled,[true]);
});

test('preview/modes/history sync never remeasure or resize the open panel',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.at(300);await opening;const initial=f.motion.sample(),counts=f.counts();
 for(let i=0;i<1000;i++)f.motion.sync();assert.deepEqual(f.counts(),counts);assert.equal(f.motion.sample().height,440);assert.equal(f.motion.sample().geometryWrites,initial.geometryWrites);
 f.resize({width:950,top:700,height:728});const resized=f.motion.sample();assert.equal(resized.width,938);assert.equal(resized.height,440);near(resized.baseline,700);near(resized.left+resized.width/2,475);assert.equal(resized.geometryWrites,initial.geometryWrites+1);
 f.observed();assert.equal(f.motion.sample().geometryWrites,resized.geometryWrites,'Duplicate ResizeObserver notification does not rewrite the SVG');
});

test('window resize changes fixed geometry once without replacing or rewinding the slide',async()=>{
 const f=controllerFixture(),opening=f.motion.open();await f.at(110);const before=f.motion.sample();f.resize({width:680,top:222,height:250});const next=f.motion.sample();near(next.progress,before.progress);assert.equal(next.height,170);assert.equal(next.width,668);assert.equal(f.animations.length,2);assert.equal(next.geometryWrites,before.geometryWrites+1);await f.at(300);assert.equal(await opening,true);
});

test('reduced motion settles immediately and interrupted release has no stale completion',async()=>{
 const f=controllerFixture();f.reduced(true);assert.equal(await f.motion.open(),true);assert.equal(f.animations.length,0);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);assert.equal(await f.motion.close(),true);assert.equal(f.motion.progress,0);f.motion.release();
 f.reduced(false);const opening=f.motion.open();await f.at(100);assert.ok(f.motion.progress>0&&f.motion.progress<1);f.reduced(true);assert.equal(await opening,true);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);
 f.reduced(false);const closing=f.motion.close();await f.at(140);f.motion.release();assert.equal(await closing,false);const counts=f.counts();f.motion.sync();f.observed();await f.at(1000);assert.deepEqual(f.counts(),counts);assert.equal(f.motion.sample(),null);assert.equal(f.tray.dataset.motion,'closed');assert.ok(f.animations.every(a=>a.cancelled));
});
