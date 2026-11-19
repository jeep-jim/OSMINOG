'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Build on macOS Apple Silicon');
const include=path.resolve(path.dirname(process.execPath),'../include/node');
if(!fs.existsSync(path.join(include,'node_api.h')))throw Error('Pinned Node distribution headers missing: '+include);
cp.execFileSync('xcrun',['clang++','-std=c++17','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'mouse-agent/mcp-fs-native.cc','-o','mouse-mcp-fs.node'],{stdio:'inherit',cwd:__dirname});
if(!process.argv.includes('--mcp-only')){
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','mouse-native-menu.mm','-o','mouse-native-menu.node'],{stdio:'inherit',cwd:__dirname});
cp.execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch','arm64','-mmacosx-version-min=13.0','-bundle','-undefined','dynamic_lookup','-I',include,'-include','QuartzCore/QuartzCore.h','-framework','Cocoa','-framework','CoreGraphics','-framework','QuartzCore','-framework','ScreenCaptureKit','-framework','CoreMedia','-framework','CoreVideo','-framework','CoreImage','mouse-screen-capture.mm','-o','mouse-screen-capture.node'],{stdio:'inherit',cwd:__dirname});
}
