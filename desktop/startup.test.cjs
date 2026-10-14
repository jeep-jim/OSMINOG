'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{showWindow}=require('./startup.cjs');
test('second launch makes an existing hidden or minimized window visible',()=>{const called=[];assert.equal(showWindow({isDestroyed:()=>false,isMinimized:()=>true,restore:()=>called.push('restore'),show:()=>called.push('show'),focus:()=>called.push('focus')}),true);assert.deepEqual(called,['restore','show','focus']);assert.equal(showWindow(),false)});
