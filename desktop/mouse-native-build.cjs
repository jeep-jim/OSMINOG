'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
if(process.platform==='win32'&&process.arch==='x64'){
 // Node-API and the host's libuv descriptor conversion keep the addon shared by
 // Node and Electron. node-gyp supplies headers, the Windows import library,
 // the executable-name delay-load hook, and locates MSVC.
 const candidates=[process.env.npm_config_node_gyp,
  path.join(path.dirname(process.execPath),'node_modules/npm/node_modules/node-gyp/bin/node-gyp.js'),
  process.env.npm_execpath&&path.resolve(path.dirname(process.env.npm_execpath),'../node_modules/node-gyp/bin/node-gyp.js')].filter(Boolean);
 try{candidates.push(require.resolve('node-gyp/bin/node-gyp.js'));}catch{}
 const gyp=candidates.find(file=>fs.existsSync(file));if(!gyp)throw Error('The pinned Node installation must include npm and node-gyp');
 const root=path.join(__dirname,'mouse-native/native-win');
 cp.execFileSync(process.execPath,[gyp,'rebuild','--directory',root,'--arch=x64','--target='+process.versions.node],{stdio:'inherit',cwd:__dirname});
 fs.copyFileSync(path.join(root,'build/Release/mouse_platform.node'),path.join(__dirname,'mouse-platform.node'));
 const native=require('./mouse-platform.node');for(const name of ['openRoot','openRead','primaryDown','paneCorners','paneCornersState','launchUpdateHelper','updateHelperStatus','stopUpdateHelper','releaseUpdateHelper'])if(typeof native[name]!=='function')throw Error('Missing Windows native export: '+name);
 console.log('MOUSE_WINDOWS_NATIVE_X64_BUILT');
 return;
}
const include=path.resolve(path.dirname(process.execPath),'../include/node');
if(!fs.existsSync(path.join(include,'node_api.h')))throw Error('Pinned Node distribution headers missing: '+include);
if(process.platform==='linux'&&process.arch==='x64'){
 cp.execFileSync('g++',['-std=c++17','-shared','-fPIC','-I',include,'mouse-native/platform-linux.cc','mouse-native/pane-corners-linux.cc','-lX11','-lXext','-o','mouse-platform.node'],{stdio:'inherit',cwd:__dirname});
 const native=require('./mouse-platform.node');for(const name of ['primaryDown','paneCorners','paneCornersState'])if(typeof native[name]!=='function')throw Error('Missing Linux native export: '+name);
 console.log('MOUSE_LINUX_NATIVE_X64_BUILT');return;
}
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Build on macOS Apple Silicon, Windows x64 or Linux x64');
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','mouse-native-menu.mm','-o','mouse-native-menu.node'],{stdio:'inherit',cwd:__dirname});
const native=require('./mouse-native-menu.node');for(const name of ['primaryDown','testMouse','install','state','reveal','release','testPointer','testClick','testRightClick','testKey','testDialogButtons','paneCorners'])if(typeof native[name]!=='function')throw Error('Missing macOS native export: '+name);
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','-framework','ScreenCaptureKit','-framework','CoreMedia','-framework','CoreVideo','-framework','CoreImage','mouse-screen-capture.mm','-o','mouse-screen-capture.node'],{stdio:'inherit',cwd:__dirname});
