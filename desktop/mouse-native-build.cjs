'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
if(process.platform==='win32'&&process.arch==='x64'){
 // This addon uses only the stable Node-API. node-gyp supplies the Windows
 // import library and Electron-compatible delay-load hook, and locates MSVC.
 const candidates=[process.env.npm_config_node_gyp,
  path.join(path.dirname(process.execPath),'node_modules/npm/node_modules/node-gyp/bin/node-gyp.js'),
  process.env.npm_execpath&&path.resolve(path.dirname(process.env.npm_execpath),'../node_modules/node-gyp/bin/node-gyp.js')].filter(Boolean);
 try{candidates.push(require.resolve('node-gyp/bin/node-gyp.js'));}catch{}
 const gyp=candidates.find(file=>fs.existsSync(file));if(!gyp)throw Error('The pinned Node installation must include npm and node-gyp');
 const root=path.join(__dirname,'mouse-agent/native-win');
 cp.execFileSync(process.execPath,[gyp,'rebuild','--directory',root,'--arch=x64','--target='+process.versions.node],{stdio:'inherit',cwd:__dirname});
 fs.copyFileSync(path.join(root,'build/Release/mouse_mcp_fs.node'),path.join(__dirname,'mouse-mcp-fs.node'));
 const native=require('./mouse-mcp-fs.node');for(const name of ['openRoot','openDir','openRead','openTemp','stat','list','commit','remove','ownProcess','stopProcessTree','primaryDown'])if(typeof native[name]!=='function')throw Error('Missing Windows native export: '+name);
 console.log('MOUSE_WINDOWS_NATIVE_X64_BUILT');
 return;
}
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Build on macOS Apple Silicon');
const include=path.resolve(path.dirname(process.execPath),'../include/node');
if(!fs.existsSync(path.join(include,'node_api.h')))throw Error('Pinned Node distribution headers missing: '+include);
cp.execFileSync('xcrun',['clang++','-std=c++17','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'mouse-agent/mcp-fs-native.cc','-o','mouse-mcp-fs.node'],{stdio:'inherit',cwd:__dirname});
if(!process.argv.includes('--mcp-only')){
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','mouse-native-menu.mm','-o','mouse-native-menu.node'],{stdio:'inherit',cwd:__dirname});
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','-framework','ScreenCaptureKit','-framework','CoreMedia','-framework','CoreVideo','-framework','CoreImage','mouse-screen-capture.mm','-o','mouse-screen-capture.node'],{stdio:'inherit',cwd:__dirname});
}
