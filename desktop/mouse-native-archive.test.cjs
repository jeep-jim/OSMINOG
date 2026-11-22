'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('the Windows browser archive reads held native handles and rejects hardlinks and junctions',{skip:process.platform!=='win32'},()=>{
 const native=require('./mouse-platform.node'),root=fs.mkdtempSync(path.join(os.tmpdir(),'Mouse browser archive '));
 let parent,reader;
 try{
  const folder=path.join(root,'ordinary'),outside=path.join(root,'outside');fs.mkdirSync(folder);fs.mkdirSync(outside);
  const file=path.join(folder,'capture.txt');fs.writeFileSync(file,'owned browser capture');
  parent=native.openRoot(folder);reader=native.openRead(parent,'capture.txt');
  assert.equal(fs.readFileSync(reader,'utf8'),'owned browser capture');fs.closeSync(reader);reader=undefined;
  for(const component of ['../outside','..','capture.txt:stream','CON'])assert.throws(()=>native.openRead(parent,component),/component/);
  fs.linkSync(file,path.join(folder,'capture-link.txt'));
  assert.throws(()=>native.openRead(parent,'capture-link.txt'),/ordinary files|hardlinks/);
  assert.throws(()=>native.openRead(parent,'capture.txt'),/ordinary files|hardlinks/);
  const junction=path.join(root,'junction');fs.symlinkSync(outside,junction,'junction');
  assert.throws(()=>native.openRoot(junction),/symlink|non-directory/);
  assert.throws(()=>native.openRead(parent,'absent.txt'),/cannot be read/);
  for(const removed of ['openDir','openTemp','commit','remove','list','ownProcess','stopProcessTree'])assert.equal(typeof native[removed],'undefined',removed);
 }finally{
  if(reader!==undefined)fs.closeSync(reader);if(parent!==undefined)fs.closeSync(parent);fs.rmSync(root,{recursive:true,force:true});
 }
});
