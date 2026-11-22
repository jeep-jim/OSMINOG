'use strict';

// Keep the retained fixture's single activation sequence and existing wait.
// A key window alone does not establish that its macOS application is active.
async function focusNativeInputWindow({app,win,until,platform=process.platform}){
 app.focus({steal:true});win.show();win.focus();win.webContents.focus();
 let readiness;
 await until(()=>{
  const windowFocused=win.isFocused();
  if(platform!=='darwin'){readiness={windowFocused};return windowFocused;}
  const appActive=app.isActive(),visible=win.isVisible();
  readiness={windowFocused,appActive,visible};
  return windowFocused===true&&appActive===true&&visible===true;
 },'634 window focus');
 return readiness;
}

module.exports={focusNativeInputWindow};
