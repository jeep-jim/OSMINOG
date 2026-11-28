'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {MouseProfileContext}=require('./mouse-profile-context.cjs');
const {exportWorkspace}=require('./mouse-config-sync.cjs');
test('account A, account B and legacy guest retain separate config, Chromium and credential directories',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-profile-context-'));try{
  await fs.writeFile(path.join(base,'workspace.json'),JSON.stringify({legacy:true,quadroPreferences:{theme:'dark'},cookies:'local only'}));
  const guest=new MouseProfileContext(base);assert.equal(guest.active,null);assert.equal(guest.directory,base);
  const state=exportWorkspace({quadroPreferences:{theme:'dark'}});await guest.seed(2,state);await guest.select(2);
  const alice=new MouseProfileContext(base);assert.equal(alice.active,2);assert.notEqual(alice.directory,base);const a=JSON.parse(await fs.readFile(path.join(alice.directory,'workspace.json')));assert.equal(a.quadroPreferences.theme,'dark');assert.equal(a.cookies,undefined);
  await alice.seed(3,exportWorkspace({}));await alice.select(3);const bob=new MouseProfileContext(base);assert.notEqual(bob.directory,alice.directory);assert.equal(JSON.parse(await fs.readFile(path.join(bob.directory,'workspace.json'))).quadroPreferences.theme,'light');
  await bob.select(null);assert.equal(new MouseProfileContext(base).directory,base);assert.equal(JSON.parse(await fs.readFile(path.join(base,'workspace.json'))).cookies,'local only');
 }finally{await fs.rm(base,{recursive:true,force:true});}
});
test('profile selectors reject traversal, malformed IDs, symlink directories and unsafe marker files',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-profile-invalid-'));try{
  const c=new MouseProfileContext(base);for(const id of ['../other',0,-1,1.5,Infinity])assert.throws(()=>c.directoryFor(id));
  const profiles=path.join(base,'mouse-accounts');await fs.mkdir(profiles);await fs.symlink(base,path.join(profiles,'2'));assert.throws(()=>c.directoryFor(2));
  await fs.symlink(path.join(base,'missing'),c.marker);assert.throws(()=>new MouseProfileContext(base));
 }finally{await fs.rm(base,{recursive:true,force:true});}
});
