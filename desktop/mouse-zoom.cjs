'use strict';
// Shared page scale only; browser chrome and screenshot coordinates are not zoomed.
const KEY='mouseGlobalZoom';
function scale(value){const n=Number(value);if(!Number.isFinite(n)||n<.25||n>5)throw Error('Масштаб должен быть от 25% до 500%');return Math.round(n*100)/100;}
async function install({browser,store,ipcMain,trusted,win}){
 const saved=(await store.get(KEY))[KEY];let factor=1,queue=Promise.resolve(),disposed=false;
 try{if(saved!==undefined)factor=scale(saved);}catch{}
 const pages=()=>[...browser.tabs.values(),...browser.providers.values()];
 function apply(t){const wc=t.view.webContents;if(wc.isDestroyed())return;wc.setZoomMode?.('isolated');wc.setZoomFactor(factor);}
 function publish(){if(!win.isDestroyed())win.webContents.send('mouse:zoom-state',{factor});}
 function set(value){factor=scale(value);for(const t of pages())apply(t);const valueAtSave=factor;queue=queue.catch(()=>{}).then(()=>store.set({[KEY]:valueAtSave}));publish();return{factor};}
 function attach(t){apply(t);t.view.webContents.on('did-finish-load',()=>{if(!disposed)apply(t)});t.view.webContents.on('zoom-changed',(_event,direction)=>{if(!disposed)set(Math.max(.25,Math.min(5,factor+(direction==='in'?.1:-.1))));});}
 for(const t of pages())attach(t);const make=browser.make.bind(browser);browser.make=(...args)=>{const t=make(...args);attach(t);return t;};
 ipcMain.handle('mouse:zoom',async(event,action,args={})=>{trusted(event);if(disposed)throw Error('Рабочее пространство закрыто');if(action==='state')return{factor};if(action!=='set')throw Error('Unknown zoom action');const result=set(args.factor);await queue;return result;});
 const oldDispose=browser.dispose.bind(browser);browser.dispose=()=>{disposed=true;oldDispose();};
 return{state:()=>({factor}),set,flush:()=>queue};
}
module.exports={install,scale,KEY};
