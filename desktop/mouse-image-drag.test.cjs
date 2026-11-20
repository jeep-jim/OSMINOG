'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('installed image drag loads each platform native guard and rejects a released button before file access',async()=>{
 for(const platform of ['darwin','win32','linux']){
  const expected=platform==='darwin'?'./mouse-native-menu.node':'./mouse-mcp-fs.node',loaded=[],handlers=new Map(),module={exports:{}};let queried=0;
  const native={primaryDown:()=>{queried++;return false;}},electron={nativeImage:{createFromBuffer:()=>assert.fail('No image is read without the native button')}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./mouse-image-drag.cjs'),'utf8'),{module,exports:module.exports,process:{platform},require(name){if(name==='electron')return electron;if(name.endsWith('.node')){loaded.push(name);assert.equal(name,expected);return native;}return require(name);},setTimeout,clearTimeout},{filename:'mouse-image-drag.cjs'});
  const frame={},wc={mainFrame:frame,isDestroyed:()=>false},page={visible:true,view:{webContents:wc}},browser={tabs:new Map([['owned',page]])};
  const service=module.exports.install({app:{getPath:()=>assert.fail('No filesystem path is needed before the gesture is authorized')},win:{isDestroyed:()=>false},ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},getBrowser:()=>browser,isTransition:()=>false});
  assert.deepEqual(loaded,[expected]);await assert.rejects(handlers.get('mouse:image-drag')({sender:wc,senderFrame:frame},{src:'data:image/png;base64,AAAA'}),/Начните перетаскивание/);assert.equal(queried,1);service.dispose();
 }
});
