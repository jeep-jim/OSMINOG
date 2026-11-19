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
