'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {selectNativeLayout}=require('./mouse-start-smoke.cjs');

function fixture({show=true,apply=true,bounds={x:100,y:200,width:500,height:300},staleViewport=false}={}){
 const events=[],service={lastMenu:null,lastTarget:null},saved=[],state={count:1,axis:'',select:'1',expanded:'true'};
 let windowBounds={...bounds};const workArea={x:0,y:25,width:1024,height:684};
 class Menu extends EventEmitter{
  constructor(){super();this.shown=false;this.items=[{id:'mouse-context-layout-1',enabled:true,visible:true,type:'checkbox',checked:true},{id:'mouse-context-layout-2-x',enabled:true,visible:true,type:'checkbox',checked:false}];}
  popup(){events.push('popup');if(show)setImmediate(()=>{this.shown=true;events.push('shown');this.emit('menu-will-show');});}
  closePopup(){if(!this.shown)return;this.shown=false;events.push('closed');this.emit('menu-will-close');}
 }
 const popup=Menu.prototype.popup;
 const wait=async(fn,label)=>{for(let i=0;i<20;i++){if(await fn())return;await new Promise(setImmediate);}throw Error('Timed out '+label);};
 const nativeInput={
  async testClick(x,y){assert.deepEqual({x,y},{x:windowBounds.x+42,y:windowBounds.y+82});assert.ok(x>=workArea.x&&x<workArea.x+workArea.width&&y>=workArea.y&&y<workArea.y+workArea.height);events.push('pointer');service.lastMenu=new Menu();service.lastTarget={kind:'layout',desk:'desk-3'};service.lastMenu.popup();return true;},
  testKey(key){assert.equal(service.lastMenu.shown,true,'No OS key may precede menu-will-show');events.push(key);if(key==='ENTER')setImmediate(()=>{service.lastMenu.closePopup();if(apply)Object.assign(state,{count:2,axis:'x',select:'2',expanded:'false'});});return true;}
 };
 const options={Menu,service,nativeInput,platform:'darwin',overlayGate:{blocked:false},wait,pause:async()=>{},save:async facts=>saved.push(structuredClone(facts)),screen:{getDisplayMatching:()=>({id:1,bounds:{x:0,y:0,width:1024,height:768},workArea})},
  app:{focus:()=>events.push('app-focus')},win:{show(){},focus(){},isFocused:()=>true,getContentBounds:()=>({...windowBounds}),getBounds:()=>({...windowBounds}),setBounds(value){windowBounds={...value};events.push('bounds');},getMinimumSize:()=>[720,480],webContents:{focus(){}}},
  js:async code=>code.includes('nativeHitTarget')?{ready:true,x:42,y:82}:code.includes('innerWidth')?{width:staleViewport?bounds.width:windowBounds.width,height:staleViewport?bounds.height:windowBounds.height}:{...state}};
 return{options,events,saved,Menu,popup};
}

test('native layout keys wait for the actual menu show event after a real pointer click',async()=>{
 const f=fixture(),result=await selectNativeLayout(f.options);
 assert.equal(result.ok,true);assert.deepEqual(f.events,['app-focus','pointer','popup','shown','HOME','DOWN','ENTER','closed']);
 assert.deepEqual(result.after,{count:2,axis:'x',select:'2',expanded:'false'});assert.equal(result.input.source,'CGEvent');assert.equal(f.Menu.prototype.popup,f.popup);assert.equal(f.saved[0].ok,true);
});
test('a menu object without actual menu-will-show cannot receive selection keys or pass',async()=>{
 const f=fixture({show:false});await assert.rejects(selectNativeLayout(f.options),/actually shown/);
 assert.ok(!f.events.includes('HOME'));assert.equal(f.saved[0].ok,false);assert.equal(f.Menu.prototype.popup,f.popup);
});
test('closing a native menu without applying the required two-pane topology remains a failure',async()=>{
 const f=fixture({apply:false});await assert.rejects(selectNativeLayout(f.options),/applies and closes/);
 assert.ok(f.events.includes('closed'));assert.equal(f.saved[0].after.count,1);assert.equal(f.saved[0].ok,false);assert.equal(f.Menu.prototype.popup,f.popup);
});
test('an oversized off-screen legacy window is fitted before OS input and restored afterward',async()=>{
 const bounds={x:-416,y:-192,width:1440,height:960},f=fixture({bounds}),result=await selectNativeLayout(f.options);
 assert.deepEqual(result.geometry.before.window,bounds);assert.deepEqual(result.geometry.requested,{x:4,y:29,width:1016,height:676});
 assert.deepEqual(result.input.point,{x:46,y:111});assert.deepEqual(result.geometry.restored,bounds);assert.deepEqual(f.options.win.getBounds(),bounds);
 assert.equal(f.events[0],'bounds');assert.equal(f.events.at(-1),'bounds');assert.equal(result.ok,true);
});
test('an off-screen fixture cannot send native input before its actual renderer viewport fits',async()=>{
 const bounds={x:-416,y:-192,width:1440,height:960},f=fixture({bounds,staleViewport:true});
 await assert.rejects(selectNativeLayout(f.options),/on-screen viewport/);assert.ok(!f.events.includes('pointer'));assert.equal(f.saved[0].ok,false);assert.deepEqual(f.options.win.getBounds(),bounds);
});
test('a fitted window is restored and diagnostics retained when the native menu never opens',async()=>{
 const bounds={x:-416,y:-192,width:1440,height:960},f=fixture({bounds,show:false});
 await assert.rejects(selectNativeLayout(f.options),/actually shown/);assert.deepEqual(f.saved[0].geometry.restored,bounds);assert.equal(f.saved[0].ok,false);assert.ok(!f.events.includes('HOME'));
});
