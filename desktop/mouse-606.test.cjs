'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const brand=require('./mouse-brand.cjs'),{png,pixels}=require('./quadro-icon.cjs');
test('exact supplied mouse source, no generated replacement or cross artwork',()=>{
 assert.equal(brand.name,'Mouse Browser');assert.equal(brand.width,22);assert.equal(brand.height,30);
 assert.equal(crypto.createHash('sha256').update(Buffer.from(brand.sourcePNG,'base64')).digest('hex'),brand.sourceSHA256);
 assert.equal(brand.pixels.join('').replaceAll('0','').length,175);
 const light=pixels(64),dark=pixels(64,{dark:true});for(let i=0;i<light.length;i+=4){assert.equal(light[i+3],dark[i+3]);if(light[i+3]){assert.equal(light[i],0);assert.equal(dark[i],255);}}
 assert.equal(png(1024).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('Mouse product preserves profile/appID while changing all shipped app artwork',()=>{
 const c=require('./quadro-build.cjs');assert.equal(c.productName,'Mouse Browser');assert.equal(c.extraMetadata.version,'6.0.7');assert.equal(c.appId,require('./package.json').build.appId);assert.match(c.artifactName,/^Mouse-Browser-/);assert.equal(c.mac.icon,'icons/mouse-browser-light.png');assert.ok(c.files.includes('mouse-native-menu.node'));
 const main=fs.readFileSync('quadro-main.cjs','utf8');assert.match(main,/app\.setPath\('userData',path.join\(app.getPath\('appData'\),'Trader OS'\)\)/);assert.match(main,/app\.setName\('Mouse Browser'\)/);assert.doesNotMatch(main,/kiosk:true|simpleFullscreen:true|alwaysOnTop:true/);
 assert.match(main,/frame:false,fullscreenable:true/);assert.doesNotMatch(main,/titleBarStyle:'hidden'/);
});
test('single compact AI toolbar, icons precede provider names, no assistant label',()=>{
 const html=fs.readFileSync('quadro/index.html','utf8'),over=fs.readFileSync('quadro/overlays.js','utf8');
 assert.doesNotMatch(html,/class="ai-head"|<strong>ИИ-чат|ИИ помощник/);assert.match(html,/id="ai-provider-icon"[\s\S]+id="ai-select"/);assert.match(over,/b\.append\(icon,text\)/);
});
test('menu module never disables Apple menu or edits macOS defaults',()=>{
 const code=fs.readFileSync('mouse-native-menu.mm','utf8');assert.match(code,/p&=~\(NSApplicationPresentationHideMenuBar\|NSApplicationPresentationDisableAppleMenu\)/);assert.match(code,/NSNormalWindowLevel/);assert.doesNotMatch(code,/setMenuBarVisible:NO|setBool:|setObject:|NSApplicationPresentationDisableForceQuit/);
 const {ChromeReveal}=require('./quadro/chrome-model.cjs'),m=new ChromeReveal();assert.equal(m.update({fullscreen:true,menuVisible:false,menuHeight:30}),0);assert.equal(m.update({fullscreen:true,menuVisible:true,menuHeight:30}),30);assert.equal(m.update({fullscreen:true,menuVisible:true,menuHeight:38,contentTopGap:38}),0);
});
test('new updater recognizes both Mouse filename and legacy compatible Quadro alias',()=>{
 const {selectRelease}=require('./quadro-update.cjs'),tag='quadro-macos-v6.0.6-arm64';
 const asset=prefix=>({name:prefix+'-6.0.6-mac-arm64.dmg',state:'uploaded',size:123,digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/'+tag+'/'+prefix+'-6.0.6-mac-arm64.dmg'});
 assert.match(selectRelease([{tag_name:tag,assets:[asset('Quadro-Browser'),asset('Mouse-Browser')]}],'6.0.5').name,/^Mouse/);
 assert.match(selectRelease([{tag_name:tag,assets:[asset('Quadro-Browser')]}],'6.0.5').name,/^Quadro/);
});
test('screen capture preserves regular Mac application and Dock/menu policy',()=>{
 const code=fs.readFileSync('quadro-global-capture.cjs','utf8');
 assert.match(code,/skipTaskbar:false/);assert.doesNotMatch(code,/skipTaskbar:true/);
 assert.match(code,/skipTransformProcessType:true/);assert.match(code,/setActivationPolicy\('regular'\)/);
 assert.doesNotMatch(code,/setActivationPolicy\('accessory'\)|dock\.hide/);
});
