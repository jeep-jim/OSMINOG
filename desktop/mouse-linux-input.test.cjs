'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLinuxInput}=require('./mouse-linux-input.cjs');
const runtime={platform:'linux',pid:410,env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/owned-test-profile',DISPLAY:':99'}};
function driver({pid='410',properties='_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_DIALOG\nWM_TRANSIENT_FOR(WINDOW): window id # 0x400012'}={}){
 const calls=[],input=createLinuxInput({runtime,spawnSync:(command,args)=>{calls.push({command,args});let stdout='';if(command==='/usr/bin/xprop')stdout=properties;else if(args[0]==='getactivewindow')stdout='12345\n';else if(args[0]==='getwindowpid')stdout=pid+'\n';else if(args[0]==='getwindowname')stdout='Установить расширение из Chrome Web Store?\n';return{status:0,stdout};}});return{input,calls};
}
test('Linux native consent readback requires the actual active owned transient dialog',()=>{
 const {input,calls}=driver();assert.deepEqual(input.testFocusedDialog(),{pid:410,window:'12345',title:'Установить расширение из Chrome Web Store?',source:'XTest',nativeType:'_NET_WM_WINDOW_TYPE_DIALOG',transient:true});
 input.testKey('Tab');input.testKey('Return');assert.deepEqual(calls.slice(-2).map(c=>c.args),[['key','--clearmodifiers','Tab'],['key','--clearmodifiers','Return']]);
});
test('Linux native consent refuses foreign windows and ordinary browser windows',()=>{
 for(const options of [{pid:'999'},{properties:'_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_NORMAL\nWM_TRANSIENT_FOR: not found.'},{properties:'_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_DIALOG'}]){
  const {input,calls}=driver(options);assert.throws(()=>input.testFocusedDialog());assert.ok(calls.every(c=>c.args[0]!=='key'));
 }
});
