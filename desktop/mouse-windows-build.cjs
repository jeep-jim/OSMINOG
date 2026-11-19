'use strict';
// The Windows product uses the same Mouse runtime as macOS. Keep the historical
// Trader OS installer identity and the existing Mac update channel independent.
const mouse=require('./mouse-build.cjs');
const {mac,dmg,...shared}=mouse;
const agentResources=mouse.extraResources.filter(item=>item.from!=='mouse-agent/node_modules');
module.exports={
 ...shared,
 appId:'black.mouse.browser.windows',
 directories:{...mouse.directories,output:'dist-mouse-windows'},
 extraMetadata:{...mouse.extraMetadata,description:'Mouse Browser — mouse.black — local multi-pane browser for Windows x64'},
 artifactName:'Mouse-Browser-${version}-Windows-${arch}.${ext}',
 files:[...mouse.files.filter(file=>!['mouse-native-menu.node','mouse-screen-capture.node'].includes(file)),
  'icons/mouse-browser.ico','mouse-windows*.cjs','!mouse-windows*.test.cjs'],
 asarUnpack:['mouse-mcp-fs.node'],
 extraResources:[...agentResources,{from:'mouse-agent/node_modules',to:'mouse-agent-node_modules/node_modules',filter:[
  '**/*','!**/test/**','!**/tests/**','!node-pty/prebuilds/darwin-*/**/*',
  '!node-pty/prebuilds/linux-*/**/*','!node-pty/prebuilds/win32-arm64/**/*',
  '!node-pty/prebuilds/win32-ia32/**/*'
 ]}],
 win:{target:[{target:'nsis',arch:['x64']}],icon:'icons/mouse-browser.ico',
  signAndEditExecutable:true,verifyUpdateCodeSignature:false},
 nsis:{oneClick:false,perMachine:false,allowElevation:false,
  allowToChangeInstallationDirectory:true,deleteAppDataOnUninstall:false,
  installerIcon:'icons/mouse-browser.ico',uninstallerIcon:'icons/mouse-browser.ico',
  installerHeaderIcon:'icons/mouse-browser.ico',shortcutName:'Mouse Browser',
  uninstallDisplayName:'Mouse Browser',createDesktopShortcut:true,createStartMenuShortcut:true,
  runAfterFinish:true},
 publish:null
};
