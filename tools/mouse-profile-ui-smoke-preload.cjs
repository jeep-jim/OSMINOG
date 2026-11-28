'use strict';
// Test-only bridge. It is loaded only by the owned native profile fixture.
const {contextBridge, ipcRenderer} = require('electron');
const prefix = '--mouse-profile-smoke-channel=';
const channel = process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
if (process.isMainFrame && /^mouse:profile-smoke:[a-f0-9]{32}$/.test(channel || '')) {
  contextBridge.exposeInMainWorld('MouseProfileSmokeNative', Object.freeze({
    profile: (action, payload = {}) => ipcRenderer.invoke(channel, 'profile', {action, payload}),
    openFlash: () => ipcRenderer.invoke(channel, 'open-flash')
  }));
}
