'use strict';

// Copy only the committed address of a live, owned page. The shell cannot use
// this channel to read the clipboard, copy arbitrary text, or select a page in
// the other (normal/private) workspace.
function install({ipcMain,trusted,getBrowser,isTransition=()=>false,clipboard}){
 ipcMain.handle('mouse:address',async(event,action,args={})=>{
  trusted(event);
  if(action!=='copy'||!args||typeof args!=='object'||typeof args.id!=='string'||args.id.length>100||typeof args.url!=='string'||args.url.length>8192)throw Error('Адрес страницы недоступен');
  if(isTransition())throw Error('Дождитесь переключения рабочего пространства');
  const browser=getBrowser();
  if(!browser||browser.disposed)throw Error('Страница уже закрыта');
  const page=browser.get(args.id),wc=page?.view?.webContents;
  if(!page||page.documentId||page.managedExtension||!wc||wc.isDestroyed())throw Error('Сначала откройте сайт');
  const address=wc.getURL();let url;
  try{url=new URL(address);}catch{throw Error('Сначала откройте сайт');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Адрес нельзя скопировать');
  if(address!==args.url)throw Error('Адрес изменился. Нажмите копирование ещё раз.');
  if(isTransition()||getBrowser()!==browser)throw Error('Рабочее пространство изменилось');
  await clipboard.writeText(address);
  return{copied:true};
 });
}
module.exports={install};
