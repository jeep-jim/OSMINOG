'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
module.exports=async(win)=>{
 const {dialog}=require('electron'),original=dialog.showSaveDialog,dir=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-export-'));let destination='',canceled=false;
 const run=s=>win.webContents.executeJavaScript(s),frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 dialog.showSaveDialog=async(_win,options)=>{destination=path.join(dir,options.defaultPath);return{canceled,filePath:destination}};
 try{
  await run("(()=>{const o=createObject('text',{name:'Chosen object',text:'Selected export only'});state.selected=[o.id];renderInspector();document.querySelector('[data-native-properties]').click()})()");await frame();
  assert.equal(await run("document.querySelector('.native-properties').hidden"),false);
  assert.equal(await run("!!document.querySelector('.native-properties [data-prop=fontSize]')"),true);
  await fs.writeFile('shell-smoke-properties.png',(await win.webContents.capturePage()).toPNG());
  await run("document.querySelector('[data-native-properties]').click();document.querySelector('[data-native-save]').click()");await frame();
  await fs.writeFile('shell-smoke-save-as.png',(await win.webContents.capturePage()).toPNG());
  for(const extension of ['txt','pdf']){
   await run(`(()=>{document.querySelector('[data-file-name]').value='Проверка ${extension}';document.querySelector('[data-file-format]').value='${extension}';document.querySelector('[data-file-save]').click()})()`);
   let text='';for(let n=0;n<300;n++){text=await run("document.querySelector('[data-file-status]').textContent");if(text.startsWith('Сохранён'))break;await new Promise(r=>setTimeout(r,50))}
   assert.match(text,/^Сохранён/);const bytes=await fs.readFile(destination);if(extension==='txt'){assert.match(bytes.toString(),/Selected export only/);assert.doesNotMatch(bytes.toString(),/Рабочий стол нового браузера/)}else assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  }
  canceled=true;await run("document.querySelector('[data-file-save]').click()");await new Promise(r=>setTimeout(r,150));assert.equal(await run("document.querySelector('[data-file-status]').textContent"),'Сохранение отменено.');
  await run("document.querySelector('[data-close-save]').click()");await frame();
  console.log('SELECTED_SAVE_AS_AND_PROPERTIES_SMOKE_PASS');
 }finally{dialog.showSaveDialog=original;await fs.rm(dir,{recursive:true,force:true})}
};
