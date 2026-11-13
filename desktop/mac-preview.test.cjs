'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {menuTemplate,SCRIPTS,RELEASE_URL}=require('./mac-platform.cjs');
test('Mac actions are fixed shell actions, not arbitrary page code',()=>{
  const invoked=[];const menus=menuTemplate({invoke:name=>invoked.push(name),download:()=>{}});
  for(const menu of menus)for(const item of menu.submenu||[])if(item.accelerator){item.click();assert.ok(Object.hasOwn(SCRIPTS,invoked.at(-1)))}
  assert.ok(menus.some(menu=>menu.submenu.some(item=>item.role==='paste')));
  assert.ok(menus.some(menu=>menu.submenu.some(item=>item.role==='quit')));
  assert.match(RELEASE_URL,/\/OSMINOG-Releases\/releases\/tag\/macos-/);
});
test('Mac package does not inherit Windows targets or update publication',()=>{
  const config=require('./mac-build.cjs');
  assert.equal(config.publish,null);assert.equal(config.win,undefined);assert.equal(config.nsis,undefined);
  assert.equal(config.extraMetadata.main,'mac-main.cjs');assert.equal(config.mac.identity,'-');
  assert.equal(config.mac.notarize,false);assert.deepEqual(config.mac.target.map(x=>x.arch),[['arm64'],['arm64']]);
});
test('Mac preview cannot call the Windows updater or quit/install',async()=>{
  const {EventEmitter}=require('node:events');const updater=new EventEmitter();
  for(const name of ['checkForUpdates','downloadUpdate','quitAndInstall'])updater[name]=()=>assert.fail('Windows updater must never be called');
  const {ManualMacUpdates}=require('./mac-updates.cjs');
  const updates=new ManualMacUpdates({updater,version:'5.0.2',packaged:true,save:async()=>{},emit:()=>{}});
  for(const action of ['check','download','install'])await assert.rejects(()=>updates[action](),/macOS/);
});
