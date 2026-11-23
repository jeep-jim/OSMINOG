'use strict';

const fs=require('node:fs'),path=require('node:path');
const mouse=require('./mouse-build.cjs');
const {mac,dmg,...shared}=mouse;
// The upstream AppImage launcher can silently add --no-sandbox. Supply our
// own entrypoint after packing; AppImage staging copies it over that template.
// An incompatible host must report an error instead of disabling isolation.
const APP_RUN=`#!/bin/sh
set -eu
if [ -z "\${APPDIR:-}" ]; then
 APPDIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
fi
export APPDIR
export LD_LIBRARY_PATH="$APPDIR/usr/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export XDG_DATA_DIRS="$APPDIR/usr/share\${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}:/usr/local/share:/usr/share"
exec "$APPDIR/mouse-browser" "$@"
`;

module.exports={
 ...shared,
 appId:'black.mouse.browser.linux',
 executableName:'mouse-browser',
 directories:{...mouse.directories,output:'dist-mouse-linux'},
 extraMetadata:{...mouse.extraMetadata,description:'Mouse Browser — mouse.black — local multi-pane browser for Linux x64'},
 // Both release formats use the channel's x64 name; builder otherwise expands
 // this architecture as x86_64 for AppImage and amd64 for deb.
 artifactName:'Mouse-Browser-${version}-Linux-x64.${ext}',
 files:[...mouse.files.filter(file=>!['mouse-native-menu.node','mouse-screen-capture.node'].includes(file)),
  'mouse-platform.node','mouse-linux*.cjs','!mouse-linux*.test.cjs'],
 asarUnpack:['mouse-platform.node'],
 extraResources:[],
 afterPack:async({appOutDir,electronPlatformName})=>{
  if(electronPlatformName!=='linux')throw Error('Mouse Linux package requires the Linux target');
  await fs.promises.writeFile(path.join(appOutDir,'AppRun'),APP_RUN,{mode:0o755});
 },
 linux:{target:[{target:'AppImage',arch:['x64']},{target:'deb',arch:['x64']}],
  executableName:'mouse-browser',category:'Network',icon:'icons/mouse-browser-light.png',
  synopsis:'Mouse Browser multi-pane browser',description:'Mouse Browser — mouse.black',
  desktop:{entry:{Name:'Mouse Browser',StartupWMClass:'mouse-browser',Categories:'Network;WebBrowser;'}},
  executableArgs:[]},
 appImage:{executableArgs:[]},
 deb:{packageName:'mouse-browser',maintainer:'Mouse Browser',
  // Electron links both libraries directly. Keep the pre-t64 name as an
  // alternative for Ubuntu 22.04 while selecting native ALSA on Ubuntu 24.04.
  depends:['libgtk-3-0','libnotify4','libnss3','libx11-6','libxext6','libxss1','libxtst6','xdg-utils','libatspi2.0-0','libuuid1','libsecret-1-0','libgbm1','libasound2t64 | libasound2']},
 publish:null
};
