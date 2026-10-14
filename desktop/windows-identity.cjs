'use strict';
const fs=require('node:fs'),path=require('node:path');
const APP_ID='com.osminog.desktop.preview';
function installIdentity({app,shell,platform=process.platform,executable=process.execPath}){
 const source=path.join(__dirname,'icons',platform==='win32'?'osminog-eye.ico':'osminog-eye.png');
 if(platform!=='win32')return source;
 // Windows shell reads icons outside app.asar; refresh only shortcuts targeting this executable.
 const icon=path.join(app.getPath('userData'),'osminog-taskbar.ico');fs.copyFileSync(source,icon);
 app.setAppUserModelId(APP_ID);
 const directories=[app.getPath('desktop'),path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs'),path.join(app.getPath('appData'),'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar')];
 const expected=path.resolve(executable).toLowerCase();
 for(const directory of directories){let entries;try{entries=fs.readdirSync(directory,{withFileTypes:true})}catch{continue}
  const files=entries.flatMap(e=>e.isFile()?[path.join(directory,e.name)]:e.isDirectory()&&/osminog/i.test(e.name)?readDirectory(path.join(directory,e.name)).map(n=>path.join(directory,e.name,n)):[]);
  for(const file of files){if(!file.toLowerCase().endsWith('.lnk'))continue;try{const link=shell.readShortcutLink(file);if(path.resolve(link.target).toLowerCase()!==expected)continue;shell.writeShortcutLink(file,'update',{icon,iconIndex:0,appUserModelId:APP_ID})}catch{}}
 }
 return icon;
}
function readDirectory(directory){try{return fs.readdirSync(directory)}catch{return[]}}
function applyTaskbar(win,icon,executable=process.execPath){win.setAppDetails({appId:APP_ID,appIconPath:icon,appIconIndex:0,relaunchCommand:`"${executable}"`,relaunchDisplayName:'OSMINOG'});win.setIcon(icon)}
module.exports={installIdentity,applyTaskbar,APP_ID};
