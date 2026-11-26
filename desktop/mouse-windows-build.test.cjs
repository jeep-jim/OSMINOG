'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Windows Mouse NSIS identity, runtime, version and profile preservation',()=>{
 const win=require('./mouse-windows-build.cjs'),mac=require('./mouse-build.cjs');
 assert.equal(win.productName,'Mouse Browser');assert.equal(win.extraMetadata.main,'mouse-main.cjs');
 assert.equal(win.extraMetadata.version,'6.0.41');assert.equal(win.appId,'black.mouse.browser.windows');
 assert.notEqual(win.appId,mac.appId);assert.deepEqual(win.win.target,[{target:'nsis',arch:['x64']}]);
 assert.equal(win.nsis.deleteAppDataOnUninstall,false);assert.equal(win.nsis.perMachine,false);
 assert.equal(win.nsis.allowToChangeInstallationDirectory,true);assert.equal(win.publish,null);
 for(const icon of [win.win.icon,win.nsis.installerIcon,win.nsis.uninstallerIcon,win.nsis.installerHeaderIcon])assert.equal(icon,'icons/mouse-browser.ico');
 assert.ok(win.files.includes('icons/mouse-browser.ico'));assert.equal(win.nsis.createDesktopShortcut,true);
 assert.equal(win.mac,undefined);assert.equal(win.dmg,undefined);
 assert.ok(!win.files.includes('mouse-native-menu.node'));assert.ok(win.files.includes('mouse-platform.node'));
 assert.deepEqual(win.extraResources,[]);assert.deepEqual(win.asarUnpack,['mouse-platform.node']);
 assert.equal(mac.extraMetadata.version,win.extraMetadata.version);
});
test('Windows ICO contains complete PNG images with matching shell directory sizes',()=>{
 const data=require('./mouse-windows-icon.cjs').ico();assert.equal(data.readUInt16LE(0),0);
 const sizes=[16,20,24,32,40,48,64,96,128,256];
 assert.equal(data.readUInt16LE(2),1);assert.equal(data.readUInt16LE(4),sizes.length);
 let end=6+sizes.length*16;
 for(let i=0;i<sizes.length;i++){
  const pos=6+i*16,size=data[pos]||256,length=data.readUInt32LE(pos+8),start=data.readUInt32LE(pos+12);
  assert.equal(size,sizes[i]);
  assert.equal(start,end);assert.equal(data.subarray(start,start+8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(start+16),size);assert.equal(data.readUInt32BE(start+20),size);
  end=start+length;
 }
 assert.equal(end,data.length);
});
test('Windows small shell icons retain smooth edges, complete padding and both mouse ears at each DPI',()=>{
 const {smoothPixels}=require('./mouse-icon.cjs');
 for(const size of [16,20,24,32,40,48,64,96,128,256]){
  const data=smoothPixels(size,{app:true});let fractionalAlpha=0,antialiasedInk=0,leftEar=0,rightEar=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4,alpha=data[i+3],grey=data[i];
   if(x===0||y===0||x===size-1||y===size-1)assert.equal(alpha,0,`${size}px outer padding`);
   if(alpha>0&&alpha<255)fractionalAlpha++;
   if(alpha===255&&grey>0&&grey<241)antialiasedInk++;
   if(y<size*.45&&alpha===255&&grey<200){if(x<size/2)leftEar++;else rightEar++;}
  }
  assert.ok(fractionalAlpha>0,`${size}px background edge is antialiased`);
  assert.ok(antialiasedInk>0,`${size}px mouse edge is antialiased`);
  assert.ok(leftEar>0&&rightEar>0,`${size}px retains both ears`);
  assert.equal(leftEar,rightEar,`${size}px scaling preserves equal ears`);
 }
});
test('Windows smooth footer SVG retains every approved cell without a redesigned mascot',()=>{
 const fs=require('node:fs'),plain=fs.readFileSync('mouse/mouse-head.svg','utf8'),smooth=fs.readFileSync('mouse/mouse-head-smooth.svg','utf8');
 assert.equal(smooth.replace('shape-rendering="geometricPrecision"','shape-rendering="crispEdges"'),plain);
});
