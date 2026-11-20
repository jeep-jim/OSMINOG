'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {DocumentService}=require('./mouse-documents.cjs');
test('viewer host rejects draft and save without opening dialogs or changing original bytes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse632-viewer-')),file=path.join(directory,'original.txt'),original=Buffer.from('Original document\n');let saveDialogs=0,messageDialogs=0;
 const service=new DocumentService({readOnly:true,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[file]}),showSaveDialog:async()=>{saveDialogs++;throw Error('Viewer must not offer writes');},showMessageBox:async()=>{messageDialogs++;throw Error('Viewer must not have dirty edits');}}});
 try{
  await fs.writeFile(file,original);const record=await service.handle('open');assert.equal(record.readOnly,true);assert.equal(record.dirty,false);assert.deepEqual(Buffer.from(service.read(record.id).bytes),original);
  for(const action of ['draft','save'])await assert.rejects(service.handle(action,{id:record.id,expectedRevision:0,draft:{text:'changed'},bytes:new Uint8Array(Buffer.from('changed'))}),error=>error.code==='MOUSE_DOCUMENT_READ_ONLY');
  assert.throws(()=>service.draft(record.id,{text:'changed'},0),error=>error.code==='MOUSE_DOCUMENT_READ_ONLY');await assert.rejects(service.save({id:record.id,expectedRevision:0,bytes:new Uint8Array([0])}),error=>error.code==='MOUSE_DOCUMENT_READ_ONLY');
  assert.equal(service.state().documents[0].dirty,false);assert.equal(service.state().documents[0].revision,0);assert.deepEqual(await fs.readFile(file),original);assert.equal(saveDialogs,0);
  await service.prepareExit(()=>{throw Error('A viewer must not request an export');});await service.closeDocument(record.id,()=>{throw Error('A viewer must not request an export');});assert.equal(service.records.size,0);assert.equal(messageDialogs,0);assert.deepEqual(await fs.readdir(directory),['original.txt']);
 }finally{service.dispose();await fs.rm(directory,{recursive:true,force:true});}
});
