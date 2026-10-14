'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{template}=require('./context-menu.cjs');
test('link, image and editable context menus call the owning webContents',()=>{
 const calls=[],wc={downloadURL:u=>calls.push(['download',u]),copyImageAt:(x,y)=>calls.push(['image',x,y]),paste:()=>calls.push(['paste'])},clipboard={writeText:s=>calls.push(['text',s])};
 const link=template(wc,{linkURL:'https://example.com/file.pdf'},{clipboard,open:u=>calls.push(['open',u])});link.find(x=>x.label==='Копировать адрес ссылки').click();link.find(x=>x.label==='Сохранить файл по ссылке…').click();
 const image=template(wc,{mediaType:'image',srcURL:'https://example.com/image.png',x:5,y:6},{clipboard});image.find(x=>x.label==='Копировать изображение').click();
 const edit=template(wc,{isEditable:true,editFlags:{canPaste:true,canCopy:false}},{clipboard});assert.equal(edit.find(x=>x.label==='Копировать').enabled,false);edit.find(x=>x.label==='Вставить').click();
 assert.deepEqual(calls,[['text','https://example.com/file.pdf'],['download','https://example.com/file.pdf'],['image',5,6],['paste']]);
 assert.equal(template(wc,{linkURL:'javascript:alert(1)'},{clipboard}).some(x=>/Сохранить|Открыть/.test(x.label)),false);
});
