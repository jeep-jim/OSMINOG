'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const RELEASE_URL = 'https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/macos-v5.0.2-arm64';
const SCRIPTS = Object.freeze({
  newTab: `document.querySelector('[data-action="new-tab"]')?.click()`,
  address: `(()=>{const e=document.querySelector('#address-input');e?.focus();e?.select()})()`,
  closeTab: `(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return}document.querySelector('#tabstrip .tab.active [data-close]')?.click()})()`,
  reload: `document.querySelector('[data-action="reload"]')?.click()`,
  back: `document.querySelector('[data-action="back"]')?.click()`
});
function menuTemplate({invoke,download}) {
  return [
    {label:'Trader OS',submenu:[{role:'about'},{type:'separator'},{label:'Загрузить версию для Mac…',click:download},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
    {label:'Файл',submenu:[{label:'Новая вкладка',accelerator:'Cmd+T',click:()=>invoke('newTab')},{label:'Адрес или поиск',accelerator:'Cmd+L',click:()=>invoke('address')},{label:'Закрыть вкладку',accelerator:'Cmd+W',click:()=>invoke('closeTab')}]},
    {label:'Правка',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
    {label:'Вид',submenu:[{label:'Обновить страницу',accelerator:'Cmd+R',click:()=>invoke('reload')},{label:'Назад',accelerator:'Cmd+[',click:()=>invoke('back')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
    {label:'Окно',submenu:[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]}
  ];
}
function install(electron) {
  const {app,BrowserWindow,Menu,shell}=electron;
  if(process.platform!=='darwin')throw Error('The macOS entry point requires macOS');
  // An explicit, stable Mac profile. Never touch Windows, Chrome or Safari profiles.
  app.setPath('userData',path.join(app.getPath('appData'),'Trader OS'));
  if(process.env.CI && process.env.TRADER_MAC_TEST_PROFILE){
    if(!path.isAbsolute(process.env.TRADER_MAC_TEST_PROFILE))throw Error('CI profile must be absolute');
    app.setPath('userData',process.env.TRADER_MAC_TEST_PROFILE);
  }
  const entry=pathToFileURL(path.join(__dirname,'trader/index.html')).href;
  let mainWindow=null,quitting=false;
  const isShell=win=>!!win&&!win.isDestroyed()&&win.webContents.getURL().split('#')[0]===entry;
  const show=()=>{if(!mainWindow||mainWindow.isDestroyed())return;if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus()};
  const invoke=async name=>{if(!Object.hasOwn(SCRIPTS,name)||!isShell(mainWindow))return;show();await mainWindow.webContents.executeJavaScript(SCRIPTS[name]).catch(error=>console.error('MAC_MENU_ERROR',error.message))};
  app.on('before-quit',()=>{quitting=true});
  app.on('activate',show);
  app.on('browser-window-created',(_event,win)=>{
    if(mainWindow)return;
    mainWindow=win;
    if(typeof win.setWindowButtonPosition==='function')win.setWindowButtonPosition({x:14,y:18});
    win.on('close',event=>{if(!quitting){event.preventDefault();win.hide()}});
    win.webContents.on('did-finish-load',()=>{
      if(!isShell(win))return;
      void win.webContents.insertCSS('.topbar{padding-left:90px!important;padding-right:12px!important}').catch(error=>console.error('MAC_CHROME_ERROR',error.message));
    });
  });
  app.whenReady().then(()=>{
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate({invoke,download:()=>shell.openExternal(RELEASE_URL)})));
  });
  return {getWindow:()=>mainWindow,isShell,invoke};
}
module.exports={install,menuTemplate,SCRIPTS,RELEASE_URL};
