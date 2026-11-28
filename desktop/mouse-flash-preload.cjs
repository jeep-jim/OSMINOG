'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const channel = process.argv.find(value => value.startsWith('--mouse-flash-channel='))?.slice('--mouse-flash-channel='.length);
const actions = new Set(['config', 'choose-source', 'resume-source', 'choose-destination', 'read-block', 'source-hash', 'bind-peer', 'write-block', 'complete-file', 'finish', 'pause', 'list-resumable', 'list-completed', 'identity-sign', 'identity-verify', 'signal', 'copy-invite']);
for (const action of ['account-devices', 'account-send', 'account-presence', 'account-incoming', 'account-verify']) actions.add(action);
if (process.isMainFrame) contextBridge.exposeInMainWorld('MouseFlashNative', Object.freeze({
  call(action, payload = {}) {
    if (!actions.has(action)) return Promise.reject(new Error('Unsupported Flash action'));
    if (!/^mouse:flash-native:[a-f0-9]{32}$/.test(channel || '')) return Promise.reject(new Error('Flash window is not configured'));
    return ipcRenderer.invoke(channel, action, payload);
  },
  onAppearance(callback) {
    if (typeof callback !== 'function' || !/^mouse:flash-native:[a-f0-9]{32}$/.test(channel || '')) throw Error('Invalid Flash appearance listener');
    const listener = (_event, value) => { if (value && ['light', 'dark'].includes(value.theme)) callback({theme: value.theme}); };
    ipcRenderer.on(channel + ':appearance', listener);
    return () => ipcRenderer.removeListener(channel + ':appearance', listener);
  }
}));
