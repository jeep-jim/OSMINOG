'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Windows Mouse NSIS identity, runtime, version and profile preservation',()=>{
 const win=require('./mouse-windows-build.cjs'),mac=require('./mouse-build.cjs');
 assert.equal(win.productName,'Mouse Browser');assert.equal(win.extraMetadata.main,'mouse-main.cjs');
 assert.equal(win.extraMetadata.version,'6.0.29');assert.equal(win.appId,'black.mouse.browser.windows');
 assert.notEqual(win.appId,mac.appId);assert.deepEqual(win.win.target,[{target:'nsis',arch:['x64']}]);
 assert.equal(win.nsis.deleteAppDataOnUninstall,false);assert.equal(win.nsis.perMachine,false);
 assert.equal(win.nsis.allowToChangeInstallationDirectory,true);assert.equal(win.publish,null);
 assert.equal(win.mac,undefined);assert.equal(win.dmg,undefined);
 assert.ok(!win.files.includes('mouse-native-menu.node'));assert.ok(win.files.includes('mouse-mcp-fs.node'));
 const filters=win.extraResources.find(x=>x.from==='mouse-agent/node_modules').filter;
 assert.ok(!filters.some(x=>/^!node-pty\/prebuilds\/win32-(?:\*|x64)/.test(x)));
 assert.ok(filters.includes('!node-pty/prebuilds/darwin-*/**/*'));
 assert.equal(mac.extraMetadata.version,win.extraMetadata.version);
});
test('Windows ICO contains complete PNG images with matching shell directory sizes',()=>{
 const data=require('./mouse-windows-icon.cjs').ico();assert.equal(data.readUInt16LE(0),0);
 assert.equal(data.readUInt16LE(2),1);assert.equal(data.readUInt16LE(4),5);
 let end=86;
 for(let i=0;i<5;i++){
  const pos=6+i*16,size=data[pos]||256,length=data.readUInt32LE(pos+8),start=data.readUInt32LE(pos+12);
  assert.equal(start,end);assert.equal(data.subarray(start,start+8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(start+16),size);assert.equal(data.readUInt32BE(start+20),size);
  end=start+length;
 }
 assert.equal(end,data.length);
});
