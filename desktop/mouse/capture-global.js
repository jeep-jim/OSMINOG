'use strict';
(async()=>{
 const N=globalThis.MouseNative;
 document.documentElement.dataset.theme=N.theme;
 const editor=createMouseCapture({N,show:async d=>d.showModal(),restore:()=>{void N.close();},locale:()=> 'ru'});
 try{
  await editor.open('initial');
  document.querySelector('#capture-dialog>header strong').textContent=N.platform==='win32'?'Скриншот экрана Windows':'Скриншот экрана Mac';
  document.querySelector('#capture-dialog footer span').textContent='Выделите область и добавьте разметку. Esc или × — закрыть без сохранения. '+(N.platform==='win32'?'Ctrl+A':'⌘A')+' — обычное выделение текста.';
  if(N.test)globalThis.MouseCaptureTest=editor;
  globalThis.MouseCaptureFeedback=()=>editor.feedback();document.documentElement.dataset.captureReady='true';
 }catch(error){document.documentElement.dataset.captureReady='error';document.body.textContent='Не удалось открыть снимок. Закройте окно и повторите. Не сохранённые снимки не записываются на диск.';}
})();
