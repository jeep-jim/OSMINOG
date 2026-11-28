'use strict';
// This service owns one isolated local view. Browser pages receive no file or signal capabilities.
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {randomBytes} = require('node:crypto');
const {FlashFiles, FREE_LIMIT, BLOCK_BYTES, validateManifest} = require('./mouse-flash-files.cjs');
const {trustedFrame} = require('./trust.cjs');
const CHANNEL = 'mouse:flash-native';
const FILE_ACTIONS = new Map([['read-block', 'readBlock'], ['source-hash', 'sourceHash'], ['bind-peer', 'bindPeer'], ['write-block', 'writeBlock'], ['complete-file', 'completeFile'], ['finish', 'finish'], ['pause', 'pause']]);
function need(value, message) { if (!value) throw new Error(message); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function stunOnly(values) {
  need(Array.isArray(values) && values.length <= 8, 'Invalid STUN configuration');
  return values.map(value => {
    need(typeof value === 'string' && value.length <= 256 && /^stuns?:[^\s/@?#]+$/i.test(value), 'Only direct STUN discovery is supported');
    return {urls: value};
  });
}
class FlashService {
  constructor({electron, directory, canOpen = () => true, broker = null, stunServers = [], allowLoopback = false, identity = null, choosePaths = null, beforeLoad = null, account = null}) {
    this.e = electron; this.directory = directory; this.canOpen = canOpen;
    this.broker = broker; this.stunServers = stunOnly(stunServers); this.allowLoopback = allowLoopback;
    this.providedIdentity = identity; this.choosePaths = choosePaths; this.beforeLoad = beforeLoad; this.account = account;
    this.channel = CHANNEL + ':' + randomBytes(16).toString('hex');
    this.entry = pathToFileURL(path.join(__dirname, 'mouse/flash/index.html')).href;
    this.window = null; this.context = null; this.opening = null; this.stopping = null; this.disposed = false;
    this.e.ipcMain.handle(this.channel, (event, action, payload) => this.handle(event, action, payload));
  }
  live(context) { return !this.disposed && this.context === context && context.active && this.canOpen() && context.window && !context.window.isDestroyed(); }
  assertLive(context) { need(this.live(context), 'Flash is paused or unavailable in this browser mode'); }
  async device() {
    if (this.providedIdentity) return typeof this.providedIdentity === 'function' ? await this.providedIdentity() : this.providedIdentity;
    const {safeStorage} = this.e;
    need(safeStorage?.isEncryptionAvailable(), 'Protected device storage is unavailable. Flash cannot start.');
    const {loadIdentity} = require('./mouse-flash-identity.cjs');
    return loadIdentity({directory: path.join(this.directory, 'identity'), name: os.hostname().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100) || 'Mouse',
      protect: value => safeStorage.encryptString(value), unprotect: value => safeStorage.decryptString(value)});
  }
  async open(options = {}) {
    need(!this.disposed && this.canOpen(), 'Flash is unavailable in this browser mode');
    if (options.parentWindow) {
      this.panelWanted = true;
      if (options.bounds) this.pendingBounds = require('./mouse-flash-panel.cjs').panelBounds(options.bounds, options.parentWindow);
    }
    if (this.window && !this.window.isDestroyed()) {
      if (options.parentWindow) need(this.window.parentWindow === options.parentWindow, 'Flash belongs to another window');
      if (options.bounds) this.setPanelBounds(options.bounds);
      if (options.theme) this.setAppearance(options.theme);
      this.window.show(); this.window.focus(); return {ok: true};
    }
    if (this.opening) return this.opening;
    this.opening = this._open(options).finally(() => { this.opening = null; }); return this.opening;
  }
  setPanelBounds(bounds) {
    need(bounds && ['x','y','width','height'].every(key => Number.isFinite(bounds[key]) && Math.abs(bounds[key]) <= 32768) && bounds.width >= 0 && bounds.height >= 0, 'Invalid Flash panel bounds');
    if (this.window?.parentWindow) this.window.setBounds(bounds);
    this.pendingBounds = bounds; return {ok: true};
  }
  setPanelVisible(visible) {
    need(typeof visible === 'boolean', 'Invalid Flash visibility');
    this.panelWanted = visible;
    if (this.window?.parentWindow) visible ? this.window.show() : this.window.hide();
    return {ok: true};
  }
  setAppearance(theme) {
    need(['light', 'dark'].includes(theme), 'Invalid Flash theme');
    this.theme = theme;
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send(this.channel + ':appearance', {theme});
    return {ok: true};
  }
  async _open({parentWindow = null, bounds = null, theme = 'dark'} = {}) {
    await this.stopping;
    need(!this.disposed && this.canOpen(), 'Flash is unavailable in this browser mode');
    const identity = await this.device();
    const files = await new FlashFiles({stateDirectory: path.join(this.directory, 'transfers')}).initialize();
    let signal;
    try {
      const {NativeSignalClient} = require('./mouse-flash-signaling.cjs');
      signal = this.broker ? new NativeSignalClient({broker: this.broker, allowLoopback: this.allowLoopback}) : null;
      need(!this.disposed && this.canOpen(), 'Flash is unavailable in this browser mode');
      const partition = 'mouse-flash-' + randomBytes(16).toString('hex');
      const ses = this.e.session.fromPartition(partition, {cache: false});
      ses.setPermissionCheckHandler(() => false); ses.setPermissionRequestHandler((_wc, _permission, done) => done(false));
      ses.on('will-download', event => event.preventDefault());
      // No HTTP/file navigation or renderer fetch is needed: the bounded native proxy owns signaling.
      ses.webRequest.onBeforeRequest({urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']}, (_details, done) => done({cancel: true}));
      // The native channel is a capability scoped to this particular local view.
      this.e.ipcMain.removeHandler(this.channel); this.channel = CHANNEL + ':' + randomBytes(16).toString('hex');
      this.e.ipcMain.handle(this.channel, (event, action, payload) => this.handle(event, action, payload));
      const webPreferences = {preload: path.join(__dirname, 'mouse-flash-preload.cjs'), partition,
          additionalArguments: ['--mouse-flash-channel=' + this.channel],
          sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, webviewTag: false};
      const win = parentWindow ? new (require('./mouse-flash-panel.cjs').FlashPanelHost)({electron: this.e, parentWindow, webPreferences, bounds}) :
        new this.e.BrowserWindow({title: 'Mouse Flash', width: 900, height: 830, minWidth: 620, minHeight: 560,
          show: false, backgroundColor: '#10151e', autoHideMenuBar: true, webPreferences});
      this.theme = ['light', 'dark'].includes(theme) ? theme : 'dark';
      const context = {window: win, files, identity, signal, signalIds: new Set(), sourceIds: new Set(), receiveIds: new Set(),
        active: true, pending: 0, dialog: false, blocker: null};
      this.window = win; this.context = context;
      context.accounts = new (require('./mouse-flash-accounts.cjs').FlashAccounts)({provider: this.account, identity, broker: this.broker,
        assertLive: () => this.assertLive(context), isListening: () => !win.parentWindow || win.visible,
        ownsInvite: invite => context.hostRoomId === invite.roomId});
      win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
      win.webContents.on('will-navigate', event => event.preventDefault());
      win.webContents.on('will-redirect', event => event.preventDefault());
      win.webContents.on('will-attach-webview', event => event.preventDefault());
      win.webContents.on('render-process-gone', () => { void this.pause(); });
      win.on('closed', () => { if (this.context === context) void this.pause(); });
      if (this.beforeLoad) await this.beforeLoad(win);
      await win.loadURL(this.entry); this.assertLive(context);
      if (win.parentWindow && this.pendingBounds) win.setBounds(this.pendingBounds);
      if (!win.parentWindow || this.panelWanted !== false) win.show();
      return {ok: true};
    } catch (error) {
      await files.close(); if (this.context) await this.pause(); throw error;
    }
  }
  keepAwake(context) {
    if (context.blocker == null && this.e.powerSaveBlocker) context.blocker = this.e.powerSaveBlocker.start('prevent-app-suspension');
  }
  releaseAwake(context) {
    if (context.blocker != null) { this.e.powerSaveBlocker.stop(context.blocker); context.blocker = null; }
  }
  async select(context, kind) {
    need(!context.dialog, 'A file selection is already open'); context.dialog = true;
    try {
      this.assertLive(context);
      const result = this.choosePaths ? await this.choosePaths(kind) : await this.e.dialog.showOpenDialog(context.window.parentWindow || context.window, {
        title: kind === 'source' ? 'Mouse Flash — что отправить' : 'Mouse Flash — папка для получения',
        buttonLabel: kind === 'source' ? 'Выбрать' : 'Получить сюда',
        properties: kind === 'source' ? ['openFile', 'openDirectory', 'multiSelections', 'dontAddToRecent'] : ['openDirectory', 'createDirectory', 'dontAddToRecent']
      });
      this.assertLive(context);
      need(result && !result.canceled && Array.isArray(result.filePaths) && result.filePaths.length > 0, 'Выбор отменён');
      return result.filePaths;
    } finally { context.dialog = false; }
  }
  async handle(event, action, payload = {}) {
    const context = this.context;
    need(context && trustedFrame(event, context.window, this.entry), 'Untrusted Flash caller'); this.assertLive(context);
    need(typeof action === 'string' && plain(payload), 'Invalid Flash request');
    need(context.pending < 12, 'Too many concurrent Flash requests'); context.pending++;
    try {
      const result = await this.dispatch(context, action, payload);
      this.assertLive(context); return result;
    } finally { context.pending--; }
  }
  async dispatch(context, action, payload) {
    if (action === 'config') return {device: context.identity.identity, broker: this.broker, stunServers: this.stunServers,
      freeLimitBytes: FREE_LIMIT, blockBytes: BLOCK_BYTES, panel: !!context.window.parentWindow, theme: this.theme, account: await context.accounts.snapshot()};
    if (action === 'account-devices') return context.accounts.lookup(payload.accountId);
    if (action === 'account-send') return context.accounts.send(payload);
    if (action === 'account-presence') return context.accounts.presence();
    if (action === 'account-incoming') return context.accounts.incoming();
    if (action === 'account-verify') return context.accounts.verifyPeer(payload);
    if (action === 'identity-sign') return context.identity.sign(payload.transcriptHash);
    if (action === 'identity-verify') return require('./mouse-flash-identity.cjs').verify(payload);
    if (action === 'copy-invite') {
      need(typeof payload.text === 'string' && payload.text.length <= 8192 && payload.text.startsWith('mouse-flash://join#'), 'Invalid invitation');
      this.e.clipboard.writeText(payload.text); return {ok: true};
    }
    if (action === 'signal') {
      need(context.signal, 'Flash invitation service is not configured');
      const opening = ['create', 'join'].includes(payload.operation);
      if (opening) need(context.signalIds.size === 0 && !context.signalOpening && !context.transferring, 'Pause the previous Flash connection first');
      if (opening) context.signalOpening = true;
      let result;
      try { result = await context.signal.call(payload); } finally { if (opening) context.signalOpening = false; }
      if (['create', 'join'].includes(payload.operation)) {
        if (!this.live(context)) { await context.signal.call({operation: 'close', signalId: result.signalId}).catch(() => {}); throw new Error('Flash is paused'); }
        context.signalIds.add(result.signalId);
        if (payload.operation === 'create') context.hostRoomId = result.roomId;
      } else if (payload.operation === 'close') { context.signalIds.delete(payload.signalId); context.hostRoomId = null; }
      return result;
    }
    if (action === 'list-resumable') return context.files.listResumable();
    if (action === 'list-completed') return context.files.listCompleted();
    if (action === 'choose-source' || action === 'resume-source') {
      need(context.sourceIds.size === 0 && context.receiveIds.size === 0, 'Pause the previous selection first');
      const result = action === 'choose-source' ? await context.files.prepareSource(await this.select(context, 'source')) : await context.files.resumeSource(payload.transferId);
      context.sourceIds.add(result.sourceId); return result;
    }
    if (action === 'choose-destination') {
      need(context.receiveIds.size === 0 && context.sourceIds.size === 0, 'Pause the previous receive first');
      validateManifest(payload.manifest, FREE_LIMIT);
      const chosen = await this.select(context, 'destination');
      const result = await context.files.prepareReceive({manifest: payload.manifest, manifestHash: payload.manifestHash,
        peerDeviceId: payload.peerDeviceId, resume: payload.resume === true, destination: chosen[0]});
      context.receiveIds.add(result.receiveId); context.transferring = true; this.keepAwake(context); return result;
    }
    const method = FILE_ACTIONS.get(action); need(method, 'Unsupported Flash action');
    if (payload.sourceId) need(context.sourceIds.has(payload.sourceId), 'Unknown source capability');
    if (payload.receiveId) need(context.receiveIds.has(payload.receiveId), 'Unknown receive capability');
    need(!!payload.sourceId !== !!payload.receiveId, 'Exactly one file capability is required');
    const result = await context.files[method](payload);
    if (action === 'bind-peer') { context.transferring = true; this.keepAwake(context); }
    if (action === 'finish' || action === 'pause') {
      context.sourceIds.delete(payload.sourceId); context.receiveIds.delete(payload.receiveId);
      if (!context.sourceIds.size && !context.receiveIds.size) { context.transferring = false; this.releaseAwake(context); }
    }
    return result;
  }
  pause() {
    const context = this.context;
    if (!context) return this.stopping || Promise.resolve();
    context.active = false; this.context = null; this.window = null;
    if (!context.window.isDestroyed()) context.window.destroy(); this.releaseAwake(context);
    this.stopping = Promise.allSettled([context.files.close(), context.signal?.dispose()])
      .then(() => {}).finally(() => { this.stopping = null; }); return this.stopping;
  }
  async dispose() { this.disposed = true; await this.pause(); this.e.ipcMain.removeHandler(this.channel); }
}
module.exports = {FlashService, stunOnly, CHANNEL};
