'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const channel = process.argv.find(value => value.startsWith('--mouse-flash-channel='))?.slice('--mouse-flash-channel='.length);
const actions = new Set(['config', 'choose-source', 'resume-source', 'choose-destination', 'read-block', 'source-hash', 'bind-peer', 'write-block', 'complete-file', 'finish', 'pause', 'list-resumable', 'identity-sign', 'identity-verify', 'signal', 'copy-invite']);
if (process.isMainFrame) contextBridge.exposeInMainWorld('MouseFlashNative', Object.freeze({
  call(action, payload = {}) {
    if (!actions.has(action)) return Promise.reject(new Error('Unsupported Flash action'));
    if (!/^mouse:flash-native:[a-f0-9]{32}$/.test(channel || '')) return Promise.reject(new Error('Flash window is not configured'));
    return ipcRenderer.invoke(channel, action, payload);
  }
}));
