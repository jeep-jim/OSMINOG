'use strict';
const assert=require('node:assert/strict');
module.exports=async({app,win,log})=>{
 const mode=process.argv.find(x=>x.startsWith('--mouse-close-test='))?.split('=')[1];
 assert.ok(['normal','fullscreen','quit','fullscreen-quit'].includes(mode));
 // Native macOS fullscreen transitions emit hide/show events while moving Spaces.
 // Prohibit the application's hide() call instead; require real process exit and
 // leave-full-screen in the outer verifier, not an incidental Cocoa visibility event.
 win.hide=()=>{console.error('MOUSE_UNEXPECTED_HIDE');app.exit(1)};
 if(mode.startsWith('fullscreen')){
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Enter fullscreen timed out')),10000);win.once('enter-full-screen',()=>{clearTimeout(timer);resolve()});win.setFullScreen(true)});
  assert.equal(win.isFullScreen(),true);log('MOUSE_NATIVE_FULLSCREEN_ENTERED');
 }
 // Change state immediately before closing, after any fullscreen transition:
 // the debounce has not elapsed, so only the exit flush can preserve this value.
 await win.webContents.executeJavaScript('MouseTest.setTheme("light");MouseTest.model.aiWidth=419');
 log('MOUSE_CLOSE_TEST_READY '+mode);
 if(mode.endsWith('quit'))app.quit();else win.close();
};
