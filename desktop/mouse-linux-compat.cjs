'use strict';

// Electron 44.5.0 / Chromium 152 enables this newer NativeViewHost layer path
// on Linux, while Windows keeps the legacy clipping-window implementation.
// The installed Linux gate observed a hidden-resized view return its correct
// capturePage pixels but disappear from OS output after reattachment. Keep the
// same native owners and hidden-resize sequence on the established path until
// a later pinned Electron version passes the unchanged OS-pixel regression.
const ELECTRON_VERSION='44.5.0',FEATURE='NativeViewHostManagesLayers';

function configure(app,{platform=process.platform,electronVersion=process.versions.electron}={}){
 if(platform!=='linux'||electronVersion!==ELECTRON_VERSION)return false;
 if(app.isReady())throw Error('Linux native view compatibility must be configured before ready');
 const value=app.commandLine.getSwitchValue('disable-features'),features=value.split(',').map(item=>item.trim());
 if(!features.includes(FEATURE))app.commandLine.appendSwitch('disable-features',value?(value+','+FEATURE):FEATURE);
 return true;
}

module.exports={configure,ELECTRON_VERSION,FEATURE};
