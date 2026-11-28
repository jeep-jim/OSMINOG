'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {MouseProfileContext}=require('./mouse-profile-context.cjs');
const {exportWorkspace}=require('./mouse-config-sync.cjs');
async function fixture(t){const base=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-profile-context-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));return base;}
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
test('first login preserves legacy bytes, while logout opens a clean guest separate from both accounts',async t=>{
 const base=await fixture(t),legacy=Buffer.from(JSON.stringify({legacy:true,quadroPreferences:{theme:'dark'},cookies:'legacy local only'}));
 await fs.writeFile(path.join(base,'workspace.json'),legacy);await fs.writeFile(path.join(base,'Cookies'),'legacy site session');
 const original=new MouseProfileContext(base);assert.equal(original.active,null);assert.equal(original.directory,base);assert.equal(original.guestIsolated,false);
 const state=exportWorkspace({quadroPreferences:{theme:'dark'}});await original.seed(2,state);await original.select(2);
 assert.equal(original.active,null);assert.equal(original.directory,base,'open Chromium profile must not change in place');assert.equal(original.guestIsolated,true);
 assert.match(original.guestGeneration,/^[a-f0-9]{32}$/);assert.deepEqual(await read(original.marker),{v:3,accountId:2,guestIsolated:true,guestGeneration:original.guestGeneration});
 const alice=new MouseProfileContext(base);assert.equal(alice.active,2);assert.equal(alice.directory,path.join(base,'mouse-accounts','2'));assert.equal(alice.base,base);assert.equal(alice.namespace,original.namespace);
 const a=await read(path.join(alice.directory,'workspace.json'));assert.equal(a.quadroPreferences.theme,'dark');assert.equal(a.cookies,undefined);
 await fs.writeFile(path.join(alice.directory,'Cookies'),'Alice site session');await fs.writeFile(path.join(alice.directory,'mouse-passwords.json'),'Alice local credentials');
 await alice.select(null);assert.equal(alice.active,2);assert.equal(alice.directory,path.join(base,'mouse-accounts','2'));
 const guest=new MouseProfileContext(base);assert.equal(guest.active,null);assert.equal(guest.guestIsolated,true);assert.equal(guest.directory,path.join(base,'mouse-guests',guest.guestGeneration));assert.notEqual(guest.guestGeneration,original.guestGeneration);assert.equal(guest.directoryFor(null),guest.directory);
 assert.deepEqual(await fs.readdir(guest.directory),[],'neither legacy nor account data is copied to the new guest');
 await fs.writeFile(path.join(guest.directory,'workspace.json'),JSON.stringify({quadroPreferences:{theme:'light'}}));await fs.writeFile(path.join(guest.directory,'Cookies'),'independent guest session');
 await guest.seed(3,exportWorkspace(await read(path.join(guest.directory,'workspace.json'))));await guest.select(3);
 const bob=new MouseProfileContext(base);assert.notEqual(bob.directory,alice.directory);assert.equal((await read(path.join(bob.directory,'workspace.json'))).quadroPreferences.theme,'light');assert.equal(await fs.readFile(path.join(alice.directory,'Cookies'),'utf8'),'Alice site session');
 await assert.rejects(fs.stat(path.join(bob.directory,'Cookies')),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(bob.directory,'mouse-passwords.json')),{code:'ENOENT'});
 await bob.select(null);const restored=new MouseProfileContext(base);assert.notEqual(restored.directory,guest.directory);assert.notEqual(restored.guestGeneration,guest.guestGeneration);assert.deepEqual(await fs.readdir(restored.directory),[],'second logout cannot expose a previous guest session');assert.equal(await fs.readFile(path.join(guest.directory,'Cookies'),'utf8'),'independent guest session','old guest files remain on disk');
 assert.deepEqual(await fs.readFile(path.join(base,'workspace.json')),legacy);assert.equal(await fs.readFile(path.join(base,'Cookies'),'utf8'),'legacy site session');
});
test('locked startup can commit clean guest before creating any account pages',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);await c.select(7);const locked=new MouseProfileContext(base);await fs.writeFile(path.join(locked.directory,'Cookies'),'locked account');
 await locked.select(null,{isolateGuest:true,freshGuest:true});assert.equal(locked.active,7);assert.equal(locked.directory,path.join(base,'mouse-accounts','7'));
 const restarted=new MouseProfileContext(base);assert.equal(restarted.active,null);assert.equal(restarted.directory,path.join(base,'mouse-guests',restarted.guestGeneration));assert.notEqual(restarted.guestGeneration,c.guestGeneration);assert.deepEqual(await fs.readdir(restarted.directory),[]);assert.equal(await fs.readFile(path.join(locked.directory,'Cookies'),'utf8'),'locked account');
 const freshBase=await fixture(t),fresh=new MouseProfileContext(freshBase);await fresh.select(null,{isolateGuest:true,freshGuest:true});assert.equal(new MouseProfileContext(freshBase).directory,path.join(freshBase,'mouse-guests',fresh.guestGeneration));
});
test('v1 account migration retains its exact directory and upgrades to isolated guest on logout',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base),directory=c.directoryFor(9);await fs.writeFile(path.join(directory,'Cookies'),'v1 account session');await fs.writeFile(c.marker,JSON.stringify({v:1,accountId:9}));
 const migrated=new MouseProfileContext(base);assert.equal(migrated.active,9);assert.equal(migrated.directory,directory);assert.equal(migrated.guestIsolated,true);assert.deepEqual(await read(c.marker),{v:1,accountId:9},'read alone does not rewrite the old marker');
 await migrated.select(null);assert.deepEqual(await read(c.marker),{v:3,accountId:null,guestIsolated:true,guestGeneration:migrated.guestGeneration});assert.match(migrated.guestGeneration,/^[a-f0-9]{32}$/);assert.equal(new MouseProfileContext(base).directory,path.join(base,'mouse-guests',migrated.guestGeneration));assert.equal(await fs.readFile(path.join(directory,'Cookies'),'utf8'),'v1 account session');
});
test('v1 guest and never-authenticated v2 guest preserve the published legacy profile',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);await fs.writeFile(c.marker,JSON.stringify({v:1,accountId:null}));
 const guest=new MouseProfileContext(base);assert.equal(guest.active,null);assert.equal(guest.directory,base);assert.equal(guest.guestIsolated,false);
 await guest.select(null);assert.deepEqual(await read(c.marker),{v:3,accountId:null,guestIsolated:false,guestGeneration:null});assert.equal(new MouseProfileContext(base).directory,base);
});
test('v2 guest migration retains its data on ordinary restart, then replaces the selected guest after logout',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base),legacyGuest=path.join(base,'mouse-guest');await fs.mkdir(legacyGuest);await fs.writeFile(path.join(legacyGuest,'Cookies'),'v2 guest cookies');await fs.writeFile(c.marker,JSON.stringify({v:2,accountId:null,guestIsolated:true}));
 const migrated=new MouseProfileContext(base);assert.equal(migrated.directory,legacyGuest);assert.equal(migrated.guestGeneration,null);await migrated.select(null);assert.deepEqual(await read(c.marker),{v:3,accountId:null,guestIsolated:true,guestGeneration:null});assert.equal(new MouseProfileContext(base).directory,legacyGuest);
 await migrated.select(5);const account=new MouseProfileContext(base);assert.equal(account.directory,path.join(base,'mouse-accounts','5'));await account.select(null);const next=new MouseProfileContext(base);assert.match(next.guestGeneration,/^[a-f0-9]{32}$/);assert.equal(next.directory,path.join(base,'mouse-guests',next.guestGeneration));assert.deepEqual(await fs.readdir(next.directory),[]);assert.equal(await fs.readFile(path.join(legacyGuest,'Cookies'),'utf8'),'v2 guest cookies');
});
test('ordinary guest restart preserves its generation, while explicit fresh guest rotates even before profile activation',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);await c.select(null,{freshGuest:true});const guest=new MouseProfileContext(base);await fs.writeFile(path.join(guest.directory,'Cookies'),'pending registration guest');await guest.select(null);
 const same=new MouseProfileContext(base);assert.equal(same.directory,guest.directory);assert.equal(same.guestGeneration,guest.guestGeneration);assert.equal(await fs.readFile(path.join(same.directory,'Cookies'),'utf8'),'pending registration guest');
 await same.select(null,{isolateGuest:true,freshGuest:true});const clean=new MouseProfileContext(base);assert.notEqual(clean.guestGeneration,guest.guestGeneration);assert.deepEqual(await fs.readdir(clean.directory),[]);assert.equal(await fs.readFile(path.join(guest.directory,'Cookies'),'utf8'),'pending registration guest');
});
test('stale contexts and queued selections cannot clear committed guest isolation',async t=>{
 const base=await fixture(t),first=new MouseProfileContext(base),stale=new MouseProfileContext(base);
 await Promise.all([first.select(11),stale.select(null,{isolateGuest:false})]);assert.equal(first.guestIsolated,true);assert.equal(stale.guestIsolated,true);assert.deepEqual(await read(first.marker),{v:3,accountId:null,guestIsolated:true,guestGeneration:stale.guestGeneration});assert.notEqual(first.guestGeneration,stale.guestGeneration);
 const old=stale.guestGeneration;await first.select(12);await stale.select(null);const current=new MouseProfileContext(base);assert.equal(current.directory,path.join(base,'mouse-guests',current.guestGeneration));assert.notEqual(current.guestGeneration,old);
 await first.select(null,{isolateGuest:false});assert.deepEqual(await read(first.marker),{v:3,accountId:null,guestIsolated:true,guestGeneration:current.guestGeneration});assert.equal(first.guestGeneration,current.guestGeneration);
});
test('failed selector commit cannot switch the running profile or claim isolation was saved',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base),rename=fs.rename;let fail=true;
 t.mock.method(fs,'rename',async(...args)=>{if(fail&&args[1]===c.marker)throw Object.assign(Error('injected selector commit failure'),{code:'EIO'});return rename(...args);});
 await assert.rejects(c.select(4),{code:'EIO'});assert.equal(c.active,null);assert.equal(c.directory,base);assert.equal(c.guestIsolated,false);assert.equal(c.guestGeneration,null);assert.equal(new MouseProfileContext(base).directory,base);assert.deepEqual(await fs.readdir(c.control),[]);
 fail=false;await c.select(4);assert.equal(c.guestIsolated,true);assert.equal(new MouseProfileContext(base).active,4);
});
test('profile selectors reject traversal, malformed IDs, symlink directories and unsafe marker files',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);for(const id of ['../other',0,-1,1.5,Infinity,undefined])assert.throws(()=>c.directoryFor(id));
 await assert.rejects(c.seed(null,exportWorkspace({})));for(const options of [null,[],{isolateGuest:'yes'},{isolateGuest:0},{freshGuest:'yes'},{freshGuest:true,isolateGuest:false},{unknown:true}])await assert.rejects(c.select(null,options));
 const profiles=path.join(base,'mouse-accounts');await fs.mkdir(profiles);await fs.symlink(base,path.join(profiles,'2'));assert.throws(()=>c.directoryFor(2));
 await assert.rejects(c.select(3,{freshGuest:true}));await fs.symlink(base,path.join(base,'mouse-guests'));await assert.rejects(c.select(3));assert.equal(c.guestIsolated,false);await assert.rejects(fs.stat(c.marker),{code:'ENOENT'});
 await fs.symlink(path.join(base,'missing'),c.marker);assert.throws(()=>new MouseProfileContext(base));
});
test('selectors reject malformed fields and an account marker that disables guest isolation',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);
 for(const value of [null,[],{v:3,accountId:null,guestIsolated:true},{v:2,accountId:null},{v:2,guestIsolated:true},{v:2,accountId:null,guestIsolated:1},{v:2,accountId:1,guestIsolated:false},{v:2,accountId:'1',guestIsolated:true},{v:2,accountId:null,guestIsolated:true,extra:1},{v:1,accountId:null,guestIsolated:true}]){await fs.writeFile(c.marker,JSON.stringify(value));assert.throws(()=>new MouseProfileContext(base),JSON.stringify(value));}
 await fs.writeFile(c.marker,' '.repeat(1025));assert.throws(()=>new MouseProfileContext(base));
});
test('v3 generation paths reject traversal, aliases, malformed types and symlink generations',async t=>{
 const base=await fixture(t),c=new MouseProfileContext(base);
 for(const generation of ['../mouse-accounts/2','a'.repeat(31),'A'.repeat(32),'0'.repeat(32)+'/..',false,{},[],undefined]){await fs.writeFile(c.marker,JSON.stringify({v:3,accountId:null,guestIsolated:true,guestGeneration:generation}));assert.throws(()=>new MouseProfileContext(base));}
 await fs.writeFile(c.marker,JSON.stringify({v:3,accountId:null,guestIsolated:false,guestGeneration:'1'.repeat(32)}));assert.throws(()=>new MouseProfileContext(base));
 const guests=path.join(base,'mouse-guests'),generation='2'.repeat(32);await fs.mkdir(guests);await fs.symlink(base,path.join(guests,generation));await fs.writeFile(c.marker,JSON.stringify({v:3,accountId:null,guestIsolated:true,guestGeneration:generation}));assert.throws(()=>new MouseProfileContext(base));
});
