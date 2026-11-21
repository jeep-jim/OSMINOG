'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {selectNativeLayout}=require('./mouse-start-smoke.cjs');

function fixture({show=true,apply=true}={}){
 const events=[],service={lastMenu:null,lastTarget:null},saved=[],state={count:1,axis:'',select:'1',expanded:'true'};
 class Menu extends EventEmitter{
  constructor(){super();this.shown=false;this.items=[{id:'mouse-context-layout-1',enabled:true,visible:true,type:'checkbox',checked:true},{id:'mouse-context-layout-2-x',enabled:true,visible:true,type:'checkbox',checked:false}];}
  popup(){events.push('popup');if(show)setImmediate(()=>{this.shown=true;events.push('shown');this.emit('menu-will-show');});}
  closePopup(){if(!this.shown)return;this.shown=false;events.push('closed');this.emit('menu-will-close');}
 }
 const popup=Menu.prototype.popup;
 const wait=async(fn,label)=>{for(let i=0;i<20;i++){if(await fn())return;await new Promise(setImmediate);}throw Error('Timed out '+label);};
 const nativeInput={
  async testClick(x,y){assert.deepEqual({x,y},{x:142,y:282});events.push('pointer');service.lastMenu=new Menu();service.lastTarget={kind:'layout',desk:'desk-3'};service.lastMenu.popup();return true;},
  testKey(key){assert.equal(service.lastMenu.shown,true,'No OS key may precede menu-will-show');events.push(key);if(key==='ENTER')setImmediate(()=>{service.lastMenu.closePopup();if(apply)Object.assign(state,{count:2,axis:'x',select:'2',expanded:'false'});});return true;}
 };
 const options={Menu,service,nativeInput,platform:'darwin',overlayGate:{blocked:false},wait,pause:async()=>{},save:async facts=>saved.push(structuredClone(facts)),
  app:{focus:()=>events.push('app-focus')},win:{show(){},focus(){},isFocused:()=>true,getContentBounds:()=>({x:100,y:200}),webContents:{focus(){}}},
  js:async code=>code.includes('nativeHitTarget')?{ready:true,x:42,y:82}:{...state}};
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
