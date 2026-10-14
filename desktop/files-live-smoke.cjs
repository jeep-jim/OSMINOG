'use strict';
const fixtures={"docx": "UEsDBBQAAAAIAGVITl306AV6XQAAAH0AAAARAAAAd29yZC9kb2N1bWVudC54bWyzKbdKyU8uzU3NK1GoyM3JK7Yqt1UqLcqzKs8vSlGysym3SspPqQTRBSCiCESU2F2YcmHfhc1AvOnCvosNChf2X2wAc7YC6a0X9trogxSByCIwWQAmIQbpIyy0AwBQSwECFAMUAAAACABlSE5d9OgFel0AAAB9AAAAEQAAAAAAAAAAAAAAgAEAAAAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAEAAQA/AAAAjAAAAAAA", "xlsx": "UEsDBBQAAAAIAGVITl2IXCuaUwAAAGEAAAAPAAAAeGwvd29ya2Jvb2sueG1ssynPL8pOys/PVqjIzckrtiqyVSotyrMqSs0pVrKzKc5ITS0phtIKeYm5qbZKFxZc2HCx8WL7xYkXm5QUiqwyU2yVijxTDJX07Wz0YRr0YcbaAQBQSwMEFAAAAAgAZUhOXdTErVk/AAAAVwAAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc7MJSs1JLMnMzyvOyCwotrNB5ip4ptgqFXmmGCophCQWpaeW2CqV5xdlF2ekppYU64MpQ72K3BwlfTsbfVRzAFBLAwQUAAAACABlSE5dthj0nGYAAACNAAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbLMpzy/KLs5ITS2xswFTLokliXY2RfnlCkW2SoZKdjbJIIajoZJCia1SZl5OZl5qcEkRUDyz2M6mxO7CwovNF/YA4QYbfaAR+iBR/WSoLmeQ/jI7EyMDG/0yiLg+0GQgiWSVPsIFAFBLAQIUAxQAAAAIAGVITl2IXCuaUwAAAGEAAAAPAAAAAAAAAAAAAACAAQAAAAB4bC93b3JrYm9vay54bWxQSwECFAMUAAAACABlSE5d1MStWT8AAABXAAAAGgAAAAAAAAAAAAAAgAGAAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAMUAAAACABlSE5dthj0nGYAAACNAAAAGAAAAAAAAAAAAAAAgAH3AAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsFBgAAAAADAAMAywAAAJMBAAAAAA=="};
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async(win,browser,pdfBytes)=>{
 const run=s=>win.webContents.executeJavaScript(s),pause=()=>new Promise(r=>setTimeout(r,100));
 await run(`(()=>{const o=createObject('file',{name:'Проверка.pdf',fileName:'Проверка.pdf',mime:'application/pdf',src:'data:application/pdf;base64,${pdfBytes.toString('base64')}'});OSMINOGWorkdesk.open(o.id)})()`);
 let pdfStatus='';for(let i=0;i<150;i++){pdfStatus=await run("document.querySelector('#osminogDocumentEditor [data-doc-status]')?.textContent||''");if(pdfStatus.includes('ревизия'))break;await pause()}
 assert.match(pdfStatus,/ревизия/);assert.equal([...browser.tabs.values()].some(t=>t.visible),false);
 await fs.writeFile('shell-smoke-pdf.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('[data-doc-close]').click()");
 for(const kind of ['docx','xlsx']){
  await run(`(()=>{const o=createObject('file',{name:'Проверка.${kind}',fileName:'Проверка.${kind}',mime:'application/octet-stream',src:'data:application/octet-stream;base64,${fixtures[kind]}'});state.selected=[o.id];globalThis.officeTestId=o.id;OSMINOGWorkdesk.open(o.id)})()`);
  let text='';for(let i=0;i<100;i++){text=await run("document.querySelector('#osminogOfficeViewer')?.textContent||''");if(text.includes('Просмотр содержимого'))break;await pause()}
  assert.match(text,kind==='docx'?/Договор проверен/:/Сумма.*420/);
  assert.equal([...browser.tabs.values()].some(t=>t.visible),false,'Native web pages must not cover document modal');
  await fs.writeFile('shell-smoke-'+kind+'.png',(await win.webContents.capturePage()).toPNG());
  await run("document.querySelector('#osminogOfficeViewer').close()");
 }
 require('electron').clipboard.clear();
 // Copy the selected XLSX with actual keyboard input, paste into a separate Chromium page.
 await run("document.activeElement?.blur();getSelection().removeAllRanges();document.body.tabIndex=-1;document.body.focus()");win.webContents.focus();
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['control']});
 for(let i=0;i<100;i++){if(require('electron').clipboard.availableFormats().some(x=>/FileName|DropFiles|CF_HDROP/i.test(x)))break;await pause()}
 await run("OSMINOGNativeBrowser.open('https://clipboard.example/','side')");
 const tab=[...browser.tabs.values()].find(t=>t.url.includes('clipboard.example')),wc=tab.view.webContents;
 for(let i=0;i<100&&wc.isLoading();i++)await pause();
 await wc.executeJavaScript(`document.body.innerHTML='<textarea style="width:300px;height:150px"></textarea>';window.pasted=[];document.addEventListener('paste',async e=>{window.pasted=await Promise.all([...e.clipboardData.files].map(async f=>({name:f.name,bytes:Array.from(new Uint8Array(await f.arrayBuffer()))})));e.preventDefault()});document.querySelector('textarea').focus()`);
 wc.focus();wc.sendInputEvent({type:'keyDown',keyCode:'V',modifiers:['control']});wc.sendInputEvent({type:'keyUp',keyCode:'V',modifiers:['control']});
 let pasted=[];for(let i=0;i<100;i++){pasted=await wc.executeJavaScript('window.pasted');if(pasted.length)break;await pause()}
 assert.equal(pasted[0]?.name,'Проверка.xlsx');assert.deepEqual(Buffer.from(pasted[0].bytes),Buffer.from(fixtures.xlsx,'base64'));
 const board=await run('OSMINOGCollectBrowserContext()');browser.context.update(board);const context=await browser.context.refresh();assert(context.canvas.objects.some(o=>o.fileName==='Проверка.xlsx'));assert(context.tabs.some(t=>t.id===tab.id));assert(!JSON.stringify(context).includes(fixtures.xlsx));
 console.log('OFFICE_VIEWERS_NATIVE_FILE_COPY_AND_LIVE_CONTEXT_PASS');
 await browser.command('close',{id:tab.id});
};
