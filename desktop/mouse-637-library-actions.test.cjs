'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const {create,metadata}=require('./mouse-637-library-actions.cjs');
const deferred=()=>{let resolve;return{promise:new Promise(done=>resolve=done),resolve:value=>resolve(value)};};
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse637-files-test-')),shell=new EventEmitter(),menus=[],drags=[];let down=true,available=true,valid=true;
 shell.mainFrame={processId:12,routingId:21};shell.isDestroyed=()=>false;shell.startDrag=value=>drags.push(value);
 const win={webContents:shell,isDestroyed:()=>false,getContentBounds:()=>({width:1200,height:800})};
 const icon={isEmpty:()=>false},app={getPath:()=>root,getFileIcon:async()=>icon},Menu={buildFromTemplate:items=>{const menu={items,popup(options){this.options=options;},closePopup(){this.options?.callback();}};menus.push(menu);return menu;}};
 const service=create({app,win,Menu,nativeImage:{createFromBuffer:()=>({isEmpty:()=>true})},primaryDown:()=>down,isAvailable:()=>available});
 // dispose removes drag directories asynchronously; Windows can briefly lock
 // one while this fixture removes its parent. Keep teardown failures observable.
 t.after(async()=>{service.dispose();await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});});
 return{root,shell,menus,drags,service,icon,setDown:value=>down=value,setAvailable:value=>available=value,setValid:value=>valid=value,valid:()=>valid};
}
test('native archive drag contains actual readable file bytes without changing the source',async t=>{
 const f=await fixture(t),data=Buffer.from('Actual local text\nwith Unicode: Мышь'),source=path.join(f.root,'source.txt');await fs.writeFile(source,data);
 const result=await f.service.drag({filename:'../../saved.txt',read:()=>fs.readFile(source),valid:f.valid});assert.deepEqual(result,{started:true});assert.equal(f.drags.length,1);const payload=f.drags[0];assert.deepEqual(Object.keys(payload).sort(),['file','icon']);assert.notEqual(payload.file,source);assert.equal(path.basename(payload.file),'saved.txt');assert.deepEqual(await fs.readFile(payload.file),data);assert.deepEqual(await fs.readFile(source),data);assert.equal(payload.icon,f.icon);assert.ok(path.dirname(payload.file).startsWith(f.root+path.sep));
});
test('completed downloads drag their existing file and reject missing files and symlinks',async t=>{
 const f=await fixture(t),file=path.join(f.root,'download.bin');await fs.writeFile(file,Buffer.from([0,17,128,255]));await f.service.drag({file,valid:f.valid});assert.equal(f.drags[0].file,file);assert.deepEqual(await fs.readFile(file),Buffer.from([0,17,128,255]));
 await assert.rejects(f.service.drag({file:path.join(f.root,'missing.bin'),valid:f.valid}),/перемещён или удалён/);await assert.rejects(f.service.drag({file:f.root,valid:f.valid}),/перемещён или удалён/);
 if(process.platform!=='win32'){const link=path.join(f.root,'linked.bin');await fs.symlink(file,link);await assert.rejects(f.service.drag({file:link,valid:f.valid}),/перемещён или удалён/);}
 assert.equal(f.drags.length,1);
});
test('a released native button cannot begin reading a library file',async t=>{
 const f=await fixture(t);f.setDown(false);let reads=0;await assert.rejects(f.service.drag({filename:'data.txt',read:async()=>{reads++;return Buffer.from('secret');},valid:f.valid}),/Начните перетаскивание/);assert.equal(reads,0);assert.equal(f.drags.length,0);
});
for(const reason of ['pointer','privacy','navigation','removed','frame'])test('pending archive drag is cancelled after '+reason+' changes',async t=>{
 const f=await fixture(t),read=deferred();const work=f.service.drag({filename:'data.txt',read:()=>read.promise,valid:f.valid});
 if(reason==='pointer')f.setDown(false);else if(reason==='privacy')f.setAvailable(false);else if(reason==='navigation')f.shell.emit('did-start-navigation');else if(reason==='removed')f.setValid(false);else f.shell.mainFrame={processId:13,routingId:22};
 read.resolve(Buffer.from('must not leave the archive'));await assert.rejects(work,/Перенос отменён/);assert.equal(f.drags.length,0);assert.deepEqual(await fs.readdir(f.root),[]);
});
test('native context menu reports real entry type/time and preserves its concrete action IDs',async t=>{
 const f=await fixture(t),row={title:'Заметка',filename:'owned.txt',type:'text',at:1700000000000};
 const wait=f.service.menu({row,kind:'captures',locale:'en',x:1100,y:400,valid:f.valid,actions:[{id:'preview',label:'Preview'},{id:'copy',label:'Copy'},{id:'remove',label:'Delete local copy'}]});const menu=f.menus[0];assert.deepEqual(menu.items.filter(item=>item.click).map(item=>item.id),['mouse-library-preview','mouse-library-copy','mouse-library-remove']);assert.equal(menu.items[0].label,'Заметка');assert.equal(menu.items[1].label,'Type: TXT · Text');assert.ok(menu.items.slice(0,3).every(item=>item.enabled===false));menu.items.find(item=>item.id==='mouse-library-copy').click();menu.options.callback();const result=await wait;assert.equal(result.action,'copy');assert.equal(result.metadata.createdAt,'2023-11-14T22:13:20.000Z');assert.equal(result.metadata.name,row.title);assert.equal(result.metadata.type,'TXT · Text');
});
test('stale native menu callbacks cannot act on a removed record or another shell document',async t=>{
 const f=await fixture(t),args={row:{filename:'image.png',type:'image',at:0},kind:'captures',x:700,y:120,valid:f.valid,actions:[{id:'remove',label:'Remove'}]};
 const removed=f.service.menu(args);f.setValid(false);f.menus[0].items.at(-1).click();f.menus[0].options.callback();assert.deepEqual(await removed,{action:''});f.setValid(true);
 const navigated=f.service.menu(args);f.shell.emit('did-start-navigation');f.menus[1].items.at(-1).click();assert.deepEqual(await navigated,{action:''});
 assert.throws(()=>f.service.menu({...args,x:1200}),/положение/);assert.throws(()=>f.service.menu({...args,y:NaN}),/положение/);assert.equal(metadata({filename:'report.PDF',at:0},'downloads','en').type,'PDF');
});
