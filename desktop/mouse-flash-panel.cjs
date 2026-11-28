'use strict';
// One trusted local WebContentsView. It never shares the browser page session.
const {EventEmitter} = require('node:events');
function panelBounds(value, parent) {
  if (!value || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key]) && Math.abs(value[key]) <= 32768) || value.width < 0 || value.height < 0) throw Error('Invalid Flash panel bounds');
  const size = parent.getContentSize();
  const left = Math.max(0, Math.min(size[0], Math.floor(value.x))), top = Math.max(0, Math.min(size[1], Math.floor(value.y)));
  const right = Math.max(left, Math.min(size[0], Math.ceil(value.x + value.width))), bottom = Math.max(top, Math.min(size[1], Math.ceil(value.y + value.height)));
  return {x: left, y: top, width: right - left, height: bottom - top};
}
class FlashPanelHost extends EventEmitter {
  constructor({electron, parentWindow, webPreferences, bounds}) {
    super();
    if (!parentWindow || parentWindow.isDestroyed() || !parentWindow.contentView || typeof parentWindow.getContentSize !== 'function') throw Error('A live parent window is required');
    this.parentWindow = parentWindow; this.destroyed = false; this.attached = false; this.visible = false;
    this.bounds = panelBounds(bounds, parentWindow);
    this.view = new electron.WebContentsView({webPreferences}); this.webContents = this.view.webContents;
    this.view.setBackgroundColor('#10151e'); this.view.setVisible(false); this.view.setBounds(this.bounds);
    this.parentClosed = () => this.destroy(); this.parentResized = () => { if (!this.isDestroyed()) this.setBounds(this.bounds); };
    parentWindow.on('closed', this.parentClosed); parentWindow.on('resize', this.parentResized);
    this.webContents.once('destroyed', () => this.destroy());
  }
  isDestroyed() { return this.destroyed || this.parentWindow.isDestroyed() || this.webContents.isDestroyed(); }
  loadURL(url) { return this.webContents.loadURL(url); }
  setBounds(bounds) {
    if (this.isDestroyed()) return;
    this.bounds = panelBounds(bounds, this.parentWindow); this.view.setBounds(this.bounds);
    this.view.setVisible(this.visible && this.bounds.width > 0 && this.bounds.height > 0);
  }
  show() {
    if (this.isDestroyed()) return;
    this.visible = true;
    // Adding again puts this child above restored page views, inside its own clipped bounds.
    this.parentWindow.contentView.addChildView(this.view); this.attached = true;
    this.setBounds(this.bounds);
  }
  hide() {
    if (this.destroyed) return;
    this.visible = false; this.view.setVisible(false);
    if (this.attached && !this.parentWindow.isDestroyed()) this.parentWindow.contentView.removeChildView(this.view);
    this.attached = false;
  }
  focus() { if (!this.isDestroyed() && this.visible) this.webContents.focus(); }
  destroy() {
    if (this.destroyed) return;
    this.hide(); this.destroyed = true;
    this.parentWindow.removeListener('closed', this.parentClosed); this.parentWindow.removeListener('resize', this.parentResized);
    // BaseWindow/WebContentsView does not own WebContents lifetime automatically.
    if (!this.webContents.isDestroyed()) this.webContents.close({waitForBeforeUnload: false});
    this.emit('closed');
  }
}
module.exports = {FlashPanelHost, panelBounds};
