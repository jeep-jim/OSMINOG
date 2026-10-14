'use strict';
const fs=require('node:fs'),path=require('node:path');
function startup({app,dialog}){
 let file;try{const dir=app.getPath('userData');fs.mkdirSync(dir,{recursive:true});file=path.join(dir,'startup.log');if(fs.existsSync(file)&&fs.statSync(file).size>1024*1024)fs.renameSync(file,file+'.previous')}catch{}
 const log=(stage,error)=>{const line=`${new Date().toISOString()} ${stage}${error?' '+String(error.stack||error).slice(0,6000):''}\n`;try{if(file)fs.appendFileSync(file,line)}catch{}console.error(line.trim())};
 let failed=false;
 const fail=error=>{if(failed)return;failed=true;log('STARTUP_FAILED',error);dialog.showErrorBox('OSMINOG — ошибка запуска',`Не удалось запустить браузер. Данные проекта не удалены.\n\n${String(error?.message||error).slice(0,700)}\n\nЖурнал: ${file||'недоступен'}`);app.exit(1)};
 log('START '+app.getVersion());return{log,fail,file};
}
function showWindow(win){if(!win||win.isDestroyed())return false;if(win.isMinimized())win.restore();win.show();win.focus();return true}
module.exports={startup,showWindow};
