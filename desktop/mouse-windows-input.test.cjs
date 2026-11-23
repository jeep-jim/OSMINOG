'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWindowsInput}=require('./mouse-windows-input.cjs');
const runtime={platform:'win32',env:{CI:'true',MOUSE_TEST_PROFILE:'C:\\Temp\\Профиль Mouse',MOUSE_WINDOWS_TEST_PYTHON:'C:\\Python\\python.exe',MOUSE_WINDOWS_TEST_DRIVER:'C:\\Source files\\mouse-windows-verify.py'}};

test('Windows OS driver converts DIP once and preserves Unicode paths as arguments',()=>{
 const calls=[],coordinates=[];
 const driver=createWindowsInput({runtime,screen:{dipToScreenPoint:p=>{coordinates.push(p);return{x:p.x*2-1920,y:p.y*2};}},spawnSync:(...args)=>{calls.push(args);return{status:0,stdout:'MOUSE_WINDOWS_INPUT_OK\n'};}});
 assert.equal(driver.testClick(150.1,81.8),true);
 assert.deepEqual(coordinates,[{x:150,y:82}]);
 assert.deepEqual(calls[0][1],[runtime.env.MOUSE_WINDOWS_TEST_DRIVER,'--input','click','-1620','164']);
 assert.equal(calls[0][2].timeout,7000);assert.equal(calls[0][2].windowsHide,true);assert.equal(calls[0][2].shell,undefined);
 driver.testKey('CTRL+ALT+S');assert.deepEqual(calls[1][1],[runtime.env.MOUSE_WINDOWS_TEST_DRIVER,'--input','key','CTRL+ALT+S']);
 assert.equal(driver.testRightClick(300,100),true);assert.deepEqual(calls[2][1],[runtime.env.MOUSE_WINDOWS_TEST_DRIVER,'--input','right-click','-1320','200']);
 driver.testKey('HOME');assert.deepEqual(calls[3][1],[runtime.env.MOUSE_WINDOWS_TEST_DRIVER,'--input','key','HOME']);
});

test('Native input cannot run in an ordinary profile or with relative verifier paths',()=>{
 for(const changed of [{platform:'linux'}, {env:{...runtime.env,CI:'false'}}, {env:{...runtime.env,MOUSE_TEST_PROFILE:'profile'}}, {env:{...runtime.env,MOUSE_WINDOWS_TEST_DRIVER:'relative.py'}}]){
  assert.throws(()=>createWindowsInput({runtime:{...runtime,...changed}}));
 }
});

test('OS input failure, missing acknowledgement and child timeout cannot pass',()=>{
 for(const result of [{status:1,stdout:'MOUSE_WINDOWS_INPUT_OK'},{status:0,stdout:''},{status:null,error:Error('timeout')}]){
  const driver=createWindowsInput({runtime,screen:{dipToScreenPoint:p=>p},spawnSync:()=>result});
  assert.throws(()=>driver.testClick(10,20),/native input failed/);
 }
});

test('Invalid coordinates and unknown pointer phases never reach User32',()=>{
 let calls=0;const driver=createWindowsInput({runtime,screen:{dipToScreenPoint:p=>p},spawnSync:()=>{calls++;return{status:0,stdout:'MOUSE_WINDOWS_INPUT_OK'};}});
 assert.throws(()=>driver.testClick(Infinity,0),/finite/);assert.throws(()=>driver.testMouse(0,0,3),/phase/);assert.equal(calls,0);
});

test('Native dialog buttons keep actual owner PID and convert physical bounds once',()=>{
 const observed=[],entry={title:'Установить расширение',pid:410,windowTitle:'Install extension',bounds:{x:400,y:600,width:200,height:60}};
 const driver=createWindowsInput({runtime:{...runtime,pid:410},screen:{screenToDipPoint:p=>({x:p.x/2,y:p.y/2})},spawnSync:(...args)=>{observed.push(args);return{status:0,stdout:'MOUSE_WINDOWS_DIALOG_BUTTONS '+JSON.stringify([entry])+'\nMOUSE_WINDOWS_INPUT_OK\n'};}});
 assert.deepEqual(driver.testDialogButtons(),[{...entry,source:'User32',nativePhysicalBounds:entry.bounds,bounds:{x:200,y:300,width:100,height:30}}]);assert.equal(observed[0][1].at(-1),'410');
});

test('A foreign PID or absent native button receipt cannot authorize a dialog click',()=>{
 for(const output of ['MOUSE_WINDOWS_INPUT_OK\n','MOUSE_WINDOWS_DIALOG_BUTTONS [{"pid":999,"title":"Install","bounds":{"x":1,"y":1,"width":20,"height":10}}]\nMOUSE_WINDOWS_INPUT_OK\n']){
  const driver=createWindowsInput({runtime:{...runtime,pid:410},screen:{screenToDipPoint:p=>p},spawnSync:()=>({status:0,stdout:output})});assert.throws(()=>driver.testDialogButtons());
 }
});
