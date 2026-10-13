'use strict';
const {dialog,BrowserWindow}=require('electron'),fs=require('node:fs/promises'),path=require('node:path');
async function saveFile(win,args){
 if(!args||typeof args.name!=='string'||typeof args.extension!=='string'||!/^[a-z0-9]{1,12}$/i.test(args.extension))throw Error('Неверное имя или формат файла');
 const name=path.basename(args.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')).slice(0,180)||'OSMINOG';
 let data;if(args.pdf){if(typeof args.html!=='string'||args.html.length>16000000)throw Error('Документ слишком большой')}else{if(!(args.data instanceof Uint8Array)||args.data.byteLength>32*1024*1024)throw Error('Файл превышает лимит 32 МБ');data=Buffer.from(args.data)}
 const chosen=await dialog.showSaveDialog(win,{title:'Сохранить как…',defaultPath:name.endsWith('.'+args.extension)?name:name+'.'+args.extension,filters:[{name:args.extension.toUpperCase(),extensions:[args.extension]}]});
 if(chosen.canceled||!chosen.filePath)return{canceled:true};
 if(args.pdf){
  const pdf=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false,partition:'osminog-export-'+Date.now()}});
  try{pdf.webContents.setWindowOpenHandler(()=>({action:'deny'}));pdf.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));await pdf.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(args.html));data=await pdf.webContents.printToPDF({printBackground:true})}finally{pdf.destroy()}
 }
 await fs.writeFile(chosen.filePath,data);return{saved:true,name:path.basename(chosen.filePath)};
}
module.exports={saveFile};
