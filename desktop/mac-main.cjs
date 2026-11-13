'use strict';
// The Windows entry point and its native browser engine remain unchanged.
const electron=require('electron');
require('./mac-platform.cjs').install(electron);
// Select the platform update adapter before constructing the shared main runtime.
require('./updates.cjs').Updates=require('./mac-updates.cjs').ManualMacUpdates;
require('./main.cjs');
if(process.argv.some(arg=>arg.startsWith('--mac-smoke-'))){
  electron.app.whenReady().then(()=>require('./mac-smoke.cjs')(electron)).catch(error=>{console.error(error);electron.app.exit(1)});
}
