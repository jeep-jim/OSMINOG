'use strict';
const assert=require('node:assert/strict');
module.exports=async({app,win,log})=>{
 const mode=process.argv.find(x=>x.startsWith('--quadro-close-test='))?.split('=')[1];
 assert.ok(['normal','fullscreen','quit','fullscreen-quit'].includes(mode));
 // A preference changed immediately before closing must not be lost to its debounce timer.
 await win.webContents.executeJavaScript('QuadroTest.setTheme("light");QuadroTest.model.aiWidth=419');
 win.on('hide',()=>{console.error('QUADRO_UNEXPECTED_HIDE');app.exit(1)});
 if(mode.startsWith('fullscreen')){
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Enter fullscreen timed out')),10000);win.once('enter-full-screen',()=>{clearTimeout(timer);resolve()});win.setFullScreen(true)});
  assert.equal(win.isFullScreen(),true);log('QUADRO_NATIVE_FULLSCREEN_ENTERED');
 }
 log('QUADRO_CLOSE_TEST_READY '+mode);
 if(mode.endsWith('quit'))app.quit();else win.close();
};
