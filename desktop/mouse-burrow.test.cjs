'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {contour,surface}=require('./mouse/burrow-motion.js');
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

test('burrow is mirror symmetric at every scale and remains a simple attached shape while stretching',()=>{
 for(const width of [320,701,1000,987.25])for(const expandedHeight of [80,240,580])for(const progress of [.00001,.0001,.001,.005,.01,.025,.05,.1,.25,.5,.75,1]){
  const height=expandedHeight*progress,s=contour({width,height,progress}),points=samplePath(s.d),closed=[...points,points[0]];
  assert.ok(!/NaN|Infinity/.test(s.d));near(s.start+s.end,width);near(s.left+s.right,width);
  for(let i=0;i<points.length;i++){
   const p=points[i],mirror=points[points.length-1-i];near(p.x+mirror.x,width);near(p.y,mirror.y);
   assert.ok(p.x>=-.002&&p.x<=width+.002&&p.y>=-.002&&p.y<=height+.002,JSON.stringify({width,height,progress,p}));
  }
  near(points[0].y,height);near(points.at(-1).y,height);assert.ok(points.some(p=>Math.abs(p.y)<.002));
  for(let i=1;i<closed.length;i++)for(let j=i+2;j<closed.length;j++)assert.equal(properIntersection(closed[i-1],closed[i],closed[j-1],closed[j]),false,JSON.stringify({width,height,progress,i,j}));
 }
});

test('the dock is a single outline from viewport edge to viewport edge, with the menu sharing exact clipping coordinates',()=>{
 for(const progress of [0,.01,.2,.65,1]){
  const shape=contour({width:1000,height:420*progress,progress}),opts={viewportWidth:1281,viewportHeight:800,baseline:772.5,left:140.5,shape},s=surface(opts),points=samplePath(s.outline),local=samplePath(shape.d);
  assert.equal((s.outline.match(/M/g)||[]).length,1);assert.equal((s.fill.match(/M/g)||[]).length,1);assert.equal((s.fill.match(/Z/g)||[]).length,1);
  near(points[0].x,0);near(points[0].y,opts.baseline);near(points.at(-1).x,opts.viewportWidth);near(points.at(-1).y,opts.baseline);
  // The first outline segment is the footer; the local bump begins at point 1.
  for(let i=0;i<local.length;i++){near(points[i+1].x,local[i].x+opts.left);near(points[i+1].y,local[i].y+opts.baseline-shape.height);}
  const fill=samplePath(s.fill);near(fill.at(-3).x,opts.viewportWidth);near(fill.at(-3).y,opts.viewportHeight);near(fill.at(-2).x,0);near(fill.at(-2).y,opts.viewportHeight);near(fill.at(-1).y,opts.baseline);
 }
});

function controllerFixture(){
 let now=0,nextFrame=0,contentHeight=240,footerTop=772,viewportWidth=1280;const frames=new Map(),created=[],observers=[],listeners=new Map(),settled=[];
 class Node{
  constructor(){this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.attrs=new Map();this.children=[];this.hidden=false;this.inert=false;}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}removeAttribute(k){this.attrs.delete(k);}
  toggleAttribute(k,force){const has=force===undefined?!this.attrs.has(k):force;if(has)this.attrs.set(k,'');else this.attrs.delete(k);return has;}
  append(...nodes){this.children.push(...nodes);}getBoundingClientRect(){return{};}
 }
 const path=new Node(),clip=new Node(),local=new Node(),tray=new Node(),content=new Node(),footer=new Node(),button=new Node();
 local.querySelector=s=>s===':scope>path'?path:s==='clipPath path'?clip:null;tray.querySelector=s=>s==='.desk-burrow-shape'?local:null;
 tray.getBoundingClientRect=()=>({width:Math.min(1000,viewportWidth-12)});footer.getBoundingClientRect=()=>({top:footerTop});Object.defineProperty(content,'scrollHeight',{get:()=>contentHeight});
 const body=new Node(),classes=new Set();body.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};
 const media={matches:false,addEventListener(_type,fn){this.change=fn;}};
 const ctx={console,document:{body,createElementNS(_ns,_tag){const node=new Node();created.push(node);return node;},createElement(){const node=new Node();created.push(node);return node;},querySelector:s=>s==='.toolbar'?{getBoundingClientRect:()=>({bottom:40})}:created.find(n=>'#'+n.id===s)},window:{addEventListener:(type,fn)=>listeners.set(type,fn)},performance:{now:()=>now},matchMedia:()=>media,getComputedStyle:()=>({borderTopWidth:'1px'}),ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}},requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),innerWidth:viewportWidth,innerHeight:800};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./mouse/burrow-motion.js'),'utf8'),ctx);
 const motion=ctx.createMouseBurrowMotion({tray,content,footer,button,settled:opened=>settled.push(opened)});
 const at=time=>{now=time;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);};
 return{motion,tray,content,footer,classes,frames,settled,created,at,get time(){return now;},height(value){contentHeight=value;motion.sync();},resize({width=viewportWidth,top=footerTop}={}){viewportWidth=width;footerTop=top;ctx.innerWidth=width;listeners.get('resize')();},reduced(value){media.matches=value;media.change();}};
}

test('opening grows from zero, locks controls until settled, and closing retracts before release',async()=>{
 const f=controllerFixture(),svg=f.created.find(n=>n.id==='mouse-dock-surface');assert.equal(svg.hasAttribute('hidden'),true);const opened=f.motion.open();assert.equal(svg.hasAttribute('hidden'),false);assert.equal(f.motion.progress,0);assert.equal(f.content.inert,true);assert.equal(f.motion.sample().height,0);assert.equal(f.classes.has('mouse-dock-active'),true);
 let previous=0;for(let t=16;t<640;t+=16){f.at(t);const s=f.motion.sample();assert.ok(s.height>=previous);assert.ok(s.progress>0&&s.progress<1);near(s.baseline,772.5);near(s.left+s.width/2,640);assert.equal(f.content.inert,true);previous=s.height;}
 f.at(640);assert.equal(await opened,true);assert.equal(f.content.inert,false);assert.equal(f.motion.sample().height,240);assert.deepEqual(f.settled,[true]);
 const closing=f.motion.close();assert.equal(f.content.inert,true);assert.equal(f.classes.has('mouse-dock-active'),true);f.at(890);assert.ok(f.motion.sample().height>0&&f.motion.sample().height<240);f.at(1140);assert.equal(await closing,true);assert.equal(f.motion.sample().height,0);assert.deepEqual(f.settled,[true,false]);f.motion.release();assert.equal(svg.hasAttribute('hidden'),true);assert.equal(f.classes.has('mouse-dock-active'),false);assert.equal(f.frames.size,0);
});

test('reversing an unfinished motion preserves geometry and cancels only the replaced completion',async()=>{
 const f=controllerFixture(),first=f.motion.open();f.at(220);const before=f.motion.sample();const close=f.motion.close();const reversed=f.motion.sample();near(reversed.height,before.height);near(reversed.progress,before.progress);assert.equal(await first,false);
 f.at(320);const beforeReopen=f.motion.sample();const reopen=f.motion.open();near(f.motion.sample().height,beforeReopen.height);assert.equal(await close,false);f.at(1200);assert.equal(await reopen,true);assert.equal(f.motion.progress,1);assert.deepEqual(f.settled,[true]);
});

test('late preview or modes height retargets smoothly, keeps its footer anchor, and releases no stale animation',async()=>{
 const f=controllerFixture(),opening=f.motion.open();f.at(640);await opening;f.height(510);near(f.motion.sample().height,240);f.at(790);assert.ok(f.motion.sample().height>240&&f.motion.sample().height<510);
 const before=f.motion.sample().height;f.height(360);near(f.motion.sample().height,before);f.resize({width:950,top:700});near(f.motion.sample().baseline,700.5);near(f.motion.sample().left+f.motion.sample().width/2,475);f.at(1090);near(f.motion.sample().height,360);
 const closing=f.motion.close();f.at(1200);f.motion.release();assert.equal(await closing,false);assert.equal(f.frames.size,0);f.height(500);f.at(1900);assert.equal(f.motion.sample(),null);assert.equal(f.tray.dataset.motion,'closed');assert.equal(f.classes.has('mouse-dock-active'),false);
});

test('reduced motion completes immediately and changing preference completes an in-flight opening',async()=>{
 const f=controllerFixture();f.reduced(true);assert.equal(await f.motion.open(),true);assert.equal(f.motion.progress,1);assert.equal(f.frames.size,0);assert.equal(f.content.inert,false);assert.equal(await f.motion.close(),true);assert.equal(f.motion.progress,0);
 f.motion.release();f.reduced(false);const pending=f.motion.open();f.at(180);assert.ok(f.motion.progress>0&&f.motion.progress<1);f.reduced(true);assert.equal(await pending,true);assert.equal(f.motion.progress,1);assert.equal(f.content.inert,false);f.at(400);assert.equal(f.frames.size,0);
});
