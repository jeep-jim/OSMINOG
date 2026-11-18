'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {geometry,motion}=require('./mouse/liquid-burrow.js');

// Generic SVG sampling: these helpers do not reconstruct the product contour.
function points(d){
 const tokens=d.match(/[a-zA-Z]|-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g),out=[];let i=0,p={x:0,y:0};
 const number=()=>{const n=Number(tokens[i++]);assert.ok(Number.isFinite(n));return n;};
 while(i<tokens.length){
  const command=tokens[i++],from={...p};
  if(command==='M'){p={x:number(),y:number()};out.push({...p});continue;}
  if(command==='C'){
   const a={x:number(),y:number()},b={x:number(),y:number()},end={x:number(),y:number()};
   for(let n=1;n<=20;n++){const t=n/20,u=1-t;out.push({x:u*u*u*from.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*end.x,y:u*u*u*from.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*end.y});}p=end;
  }else if(command==='H'||command==='V'){
   p=command==='H'?{x:number(),y:p.y}:{x:p.x,y:number()};for(let n=1;n<=20;n++)out.push({x:from.x+(p.x-from.x)*n/20,y:from.y+(p.y-from.y)*n/20});
  }else throw Error('Unexpected contour command '+command);
 }
 return out;
}
function fixture(reduced=false){
 let time=0,id=0;const callbacks=new Map(),painted=[];
 const controller=motion({paint:(g,s)=>painted.push({g,s:{...s}}),now:()=>time,request:fn=>{callbacks.set(++id,fn);return id;},cancel:key=>callbacks.delete(key),reduced:()=>reduced});
 function step(ms=16){time+=ms;const work=[...callbacks.values()];callbacks.clear();for(const fn of work)fn(time);}
 function finish(){for(let i=0;callbacks.size&&i<100;i++)step();assert.equal(callbacks.size,0,'Motion stops scheduling after completion');}
 controller.measure({width:940,height:320,referenceHeight:500},{immediate:true});
 return{controller,painted,callbacks,step,finish};
}

test('liquid contour remains mirrored and connected to one fixed footer baseline throughout growth',()=>{
 for(const width of [320,793.5,940])for(const height of [180,320,510]){
  let previousHeight=-1,previousWidth=-1;
  for(let n=0;n<=20;n++){
   const g=geometry({width,height,referenceHeight:510,progress:n/20}),sample=points(g.d),first=sample[0],last=sample.at(-1);
   assert.ok(Math.abs(first.y-height)<.001&&Math.abs(last.y-height)<.001);
   assert.ok(Math.abs(first.x+last.x-width)<.002,'Footer ends remain centred');
   assert.ok(g.visibleHeight>=previousHeight&&g.right-g.left>=previousWidth,'Height and footprint grow without a detached slide');
   previousHeight=g.visibleHeight;previousWidth=g.right-g.left;
   for(let i=0;i<sample.length;i++){
    const a=sample[i],b=sample[sample.length-1-i];assert.ok(Math.abs(a.x+b.x-width)<.003&&Math.abs(a.y-b.y)<.003,'Mirrored independently sampled SVG points');
    assert.ok(a.x>=-.002&&a.x<=width+.002&&a.y>=g.top-.002&&a.y<=height+.002,'Contour stays above the footer baseline');
   }
   assert.match(g.clip,new RegExp('L[^A-Z]+ '+String(Math.round((height+1)*1000)/1000).replace('.','\\.')+'H'));
  }
 }
});

test('fully open compact and expanded contours retain the same upper corner geometry',()=>{
 const shapes=[260,390,530].map(height=>({height,sample:points(geometry({width:940,height,referenceHeight:560,progress:1}).d)}));
 const upper=shape=>shape.sample.filter(p=>p.x<470&&p.y<560*.18+.001).map(p=>({x:p.x,y:p.y}));
 const reference=upper(shapes[0]);assert.ok(reference.length>20);for(const shape of shapes.slice(1)){const actual=upper(shape);assert.equal(actual.length,reference.length);actual.forEach((p,i)=>{assert.ok(Math.abs(p.x-reference[i].x)<1e-9);assert.ok(Math.abs(p.y-reference[i].y)<1e-9);});}
});

test('actual motion emits intermediate opening and closing geometry before completing',async()=>{
 const f=fixture(),open=f.controller.open();assert.equal(f.controller.state().phase,'opening');f.step(160);assert.ok(f.controller.state().progress>0&&f.controller.state().progress<1);f.finish();assert.equal(await open,true);assert.equal(f.controller.state().phase,'open');
 const boundary=f.painted.length,close=f.controller.close();f.step(160);assert.equal(f.controller.state().phase,'closing');assert.ok(f.controller.state().progress>0&&f.controller.state().progress<1);f.finish();assert.equal(await close,true);assert.equal(f.controller.state().phase,'closed');assert.equal(f.controller.state().progress,0);
 for(const group of [f.painted.slice(0,boundary),f.painted.slice(boundary)])assert.ok(new Set(group.map(p=>Math.round(p.g.visibleHeight))).size>=3);
 for(const {g}of f.painted){const p=points(g.d);assert.equal(p[0].y,p.at(-1).y);assert.ok(Math.abs(p[0].y-g.height)<.001);}
});

test('reversing an unfinished opening resolves the superseded transaction without a late reopen',async()=>{
 const f=fixture(),open=f.controller.open();f.step(180);const from=f.controller.state().progress,close=f.controller.close();assert.equal(await open,false);assert.equal(f.controller.state().progress,from);f.finish();assert.equal(await close,true);assert.equal(f.controller.state().phase,'closed');f.step(2000);assert.equal(f.controller.state().phase,'closed');
});

test('height changes animate geometry while keeping the open state and fixed local endpoint baseline',async()=>{
 const f=fixture();await f.controller.open({immediate:true});f.painted.length=0;f.controller.measure({height:510});assert.equal(f.controller.state().animating,true);f.step(150);assert.ok(f.controller.state().height>320&&f.controller.state().height<510);f.finish();assert.equal(f.controller.state().height,510);assert.equal(f.controller.state().phase,'open');
 for(const {g}of f.painted){const sample=points(g.d);assert.ok(Math.abs(sample[0].y-g.height)<.001);assert.ok(Math.abs(sample.at(-1).y-g.height)<.001);}
});

test('reduced motion and immediate privacy cleanup finish without queued animation frames',async()=>{
 const reduced=fixture(true);assert.equal(await reduced.controller.open(),true);assert.equal(reduced.controller.state().phase,'open');assert.equal(reduced.callbacks.size,0);assert.equal(await reduced.controller.close(),true);assert.equal(reduced.controller.state().phase,'closed');
 const f=fixture(),pending=f.controller.open();f.step(100);f.controller.reset();assert.equal(await pending,false);assert.equal(f.controller.state().phase,'closed');assert.equal(f.callbacks.size,0);f.step(2000);assert.equal(f.controller.state().phase,'closed');
});

// Execute the actual desktop wrappers with the real motion controller. The DOM
// and layout boundaries are spies; cancellation and close completion are not
// reimplemented here. Including open() exercises the production reversal path.
const desktopSource=fs.readFileSync(path.join(__dirname,'mouse/desktops.js'),'utf8');
function productionSection(start,end){const a=desktopSource.indexOf(start),b=desktopSource.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Production desktop section exists: '+start);return desktopSource.slice(a,b);}
const wrapperSource=[
 productionSection(' async function open(){','\n function clearPreviewDOM'),
 productionSection(' function finishClose(){','\n function close(options='),
 productionSection(' function close(options=','\n tray.addEventListener')
].join('\n');
async function closeFixture(hidden=false){
 const animation=fixture();if(!hidden)await animation.controller.open({immediate:true});
 const tray={hidden,open:!hidden,close(){this.open=false;}},attributes=new Map();let finishes=0;
 const context={Promise,motion:animation.controller,tray,button:{setAttribute:(name,value)=>attributes.set(name,value)},history:{hide(){}},closePeek(){},showModes(){},backdrop:{hide(){}},clearPreviewDOM(){},footer:{style:{removeProperty(){}}},layout(){},onFinishClose(){finishes++;}};
 vm.runInNewContext('let closing=null,closeTicket=0,epoch=0,opening=false;\n'+wrapperSource+'\nconst productFinishClose=finishClose;finishClose=()=>{onFinishClose();return productFinishClose();};globalThis.api={open,close};',context,{filename:'mouse/desktops.js actual close wrapper',timeout:1000});
 return{...animation,...context.api,tray,attributes,finishes:()=>finishes};
}

test('actual desktop close wrapper resolves true after one finish and shares concurrent close requests',async()=>{
 const f=await closeFixture(),pending=f.close();assert.equal(f.close(),pending,'The same pending close is shared');f.step(160);assert.equal(f.finishes(),0);assert.equal(f.tray.hidden,false);assert.equal(f.controller.state().phase,'closing');
 f.finish();assert.equal(await pending,true);assert.equal(f.finishes(),1);assert.equal(f.tray.hidden,true);assert.equal(f.tray.open,false);assert.equal(f.attributes.get('aria-expanded'),'false');f.step(2000);assert.equal(f.finishes(),1,'No late duplicate finish');
});

test('actual desktop close wrapper resolves true when the tray is already hidden',async()=>{
 const f=await closeFixture(true);assert.equal(await f.close(),true);assert.equal(f.finishes(),1);assert.equal(f.controller.state().phase,'closed');assert.equal(f.callbacks.size,0);assert.equal(f.tray.hidden,true);
});

test('immediate privacy close resets the actual pending wrapper to false without a late finish',async()=>{
 const f=await closeFixture(),pending=f.close();f.step(160);assert.equal(f.finishes(),0);
 assert.equal(await f.close({immediate:true}),true);assert.equal(await pending,false,'The earlier caller must cancel its following action');assert.equal(f.finishes(),1,'Only immediate cleanup finishes the tray');assert.equal(f.tray.hidden,true);assert.equal(f.controller.state().phase,'closed');f.finish();f.step(2000);assert.equal(f.finishes(),1);assert.equal(f.callbacks.size,0);
});

test('actual reopen reverses a pending close and returns false to the earlier caller',async()=>{
 const f=await closeFixture(),pending=f.close();f.step(160);const reopening=f.open();assert.equal(await pending,false);assert.equal(f.finishes(),0,'Superseded close cannot hide the reopening tray');
 f.finish();await reopening;assert.equal(f.controller.state().phase,'open');assert.equal(f.tray.hidden,false);assert.equal(f.tray.open,true);assert.equal(f.attributes.get('aria-expanded'),'true');f.step(2000);assert.equal(f.finishes(),0);
 const subsequent=f.close();f.finish();assert.equal(await subsequent,true);assert.equal(f.finishes(),1,'A later deliberate close remains functional');
});
