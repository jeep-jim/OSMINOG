'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {parseBookmarks,parsePasswords,parseCSV,decodeFile,BrowserImportService,MAX_FILE_BYTES}=require('./mouse-browser-import.cjs');
const {CredentialStore}=require('./mouse-credentials.cjs'),{Library}=require('./mouse-library.cjs');
// AES is only the test implementation of the OS adapter. Production uses
// Electron safeStorage; these tests do not claim to verify a system keychain.
function encryption(){const key=crypto.randomBytes(32);return{isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptString(bytes){const cipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');}};}
const row=(extra={})=>({origin:'https://example.test',username:'fixture-user',password:'fixture-only-Password-123',title:'Example',...extra});
async function fixture(t,options={}){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'mouse633-import-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));let saved={},clipboardText='',timer,privateMode=false,choice=1,selected='';const app=new EventEmitter(),powerMonitor=new EventEmitter(),win=new EventEmitter();win.isDestroyed=()=>false;app.getPath=()=>folder;
 const store=new CredentialStore({file:path.join(folder,'mouse-credentials.enc'),safeStorage:encryption(),platform:'linux'}),library=await new Library({get:async()=>saved,set:async value=>{saved=structuredClone(value);}}).init();
 const prompts=[],clipboard={writeText:async value=>{clipboardText=value;},readText:async()=>clipboardText,clear:async()=>{clipboardText='';}},dialog={showOpenDialog:async(_win,input)=>{prompts.push(input);return selected?{canceled:false,filePaths:[selected]}:{canceled:true,filePaths:[]};},showMessageBox:async(_win,input)=>{prompts.push(input);return{response:choice};}};
 const handlers=new Map(),ipcMain={handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)};let notified=0;
 const service=new BrowserImportService({app,win,browser:{},library,ipcMain,trusted:event=>{if(event!=='owned')throw Error('untrusted');},dialog,clipboard,powerMonitor,isPrivate:()=>privateMode,notify:()=>{notified++;},store,setTimer:(fn,delay)=>{assert.equal(delay,30000);timer=fn;return{unref(){}};},clearTimer:()=>{timer=null;},...options});
 t.after(()=>service.dispose());t.after(()=>clearTimeout(library.timer));
 return{folder,store,library,service,app,powerMonitor,win,prompts,clipboard,dialog,handlers,get notified(){return notified;},get saved(){return saved;},get clip(){return clipboardText;},set clip(v){clipboardText=v;},get timer(){return timer;},expire(){const callback=timer;timer=null;return callback?.();},private(value){privateMode=value;},choose(value){choice=value;},async select(name,content){selected=path.join(folder,name);await fs.writeFile(selected,content);return selected;}};
}
test('HTML bookmark exports decode entities and ignore executable schemes, embedded credentials and scripts',()=>{
 const value=parseBookmarks('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.test/?a=1&amp;b=2">A &amp; B &#x1F42D;</A><A HREF=javascript:alert(1)>bad</A><A HREF="https://name:password@example.test/">bad</A><script><A HREF="https://hidden.test">hidden</A></script></DL>');
 assert.deepEqual(value.records,[{url:'https://example.test/?a=1&b=2',title:'A & B 🐭'}]);assert.equal(value.skipped,2);assert.equal(value.total,3);
});
test('Chromium nested bookmark JSON preserves source order; unrelated JSON and malformed input are rejected',()=>{
 const value=parseBookmarks(JSON.stringify({roots:{bookmark_bar:{type:'folder',children:[{type:'url',url:'https://one.test',name:'One'},{type:'folder',children:[{type:'url',url:'https://two.test',name:'Two'}]}]},other:{type:'folder',children:[]}}}));
 assert.deepEqual(value.records.map(x=>x.url),['https://one.test/','https://two.test/']);assert.throws(()=>parseBookmarks('{"data":[]}'),/не файл закладок/);assert.throws(()=>parseBookmarks('{broken'),/Некорректный JSON/);assert.throws(()=>parseBookmarks('ordinary text'),/HTML/);
});
test('Chrome, Firefox and Safari CSV headers preserve quoted passwords, commas, Unicode and multiline fields',()=>{
 const parsed=parsePasswords('\uFEFFname,url,username,password,note\r\nExample,https://example.test/login,"a,b","line1\r\nline2""quoted""",ignored\r\nBad,javascript:alert(1),u,p,ignored\r\n');
 assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].username,'a,b');assert.equal(parsed.records[0].password,'line1\r\nline2"quoted"');assert.equal(parsed.records[0].origin,'https://example.test');assert.equal(parsed.skipped,1);
 assert.equal(parsePasswords('url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged\nhttps://firefox.test,имя,секрет,,,,1,2,3').records[0].username,'имя');
 assert.equal(parsePasswords('Title,URL,Username,Password,Notes,OTPAuth\nSafari,https://safari.test,u,p,,').records[0].title,'Safari');
 assert.throws(()=>parseCSV('url,username,password\n"unfinished'),/кавычка/);assert.throws(()=>parsePasswords('url,username\nhttps://example.test,u'),/столбцы/);assert.throws(()=>parsePasswords('url,username,password,password\nhttps://example.test,u,p,p'),/повторяются/);
});
test('encoding and input limits reject unsupported or oversized exports before persistence',()=>{
 assert.equal(decodeFile(Buffer.concat([Buffer.from([255,254]),Buffer.from('Сайт','utf16le')])),'Сайт');assert.throws(()=>decodeFile(Buffer.from([255,255,255])),/UTF/);
 assert.throws(()=>parseBookmarks('x'.repeat(MAX_FILE_BYTES+1)),/16 МБ/);assert.throws(()=>parseCSV('url,username,password\n'+'https://e.test,u,p\n'.repeat(10001)),/10000/);
});
test('native bookmark picker imports to the real Library, deduplicates, preserves existing titles and survives reload',async t=>{
 const f=await fixture(t);f.library.bookmark('https://old.test','Owner title');await f.library.flush();
 await f.select('export.html','<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><A HREF="https://old.test">Replacement</A><A HREF="https://new.test">New</A><A HREF="https://new.test">Duplicate</A><A HREF="file:///private">Invalid</A></DL>');
 const result=await f.service.handle('bookmarks');assert.deepEqual(result,{ok:true,canceled:false,imported:1,duplicates:2,conflicts:0,skipped:1,total:4});assert.equal(f.notified,1);assert.equal(f.library.data.bookmarks.find(x=>x.url==='https://old.test/').title,'Owner title');
 const reloaded=await new Library({get:async()=>f.saved,set:async()=>{}}).init();assert.deepEqual(reloaded.data.bookmarks.map(x=>x.url),['https://new.test/','https://old.test/']);
});
test('credential store persists encrypted bytes only, returns metadata only and never silently replaces a login',async t=>{
 const f=await fixture(t);assert.deepEqual(await f.store.merge([row()]),{imported:1,duplicates:0,conflicts:0});
 const bytes=await fs.readFile(f.store.file);assert.equal(bytes.includes(Buffer.from(row().password)),false);assert.equal(bytes.includes(Buffer.from(row().username)),false);if(process.platform!=='win32')assert.equal((await fs.stat(f.store.file)).mode&0o777,0o600);
 assert.deepEqual(await f.store.merge([row(),row({password:'different-fixture-password'}),row({username:'other'})]),{imported:1,duplicates:1,conflicts:1});
 const fresh=new CredentialStore({file:f.store.file,safeStorage:f.store.safeStorage,platform:'linux'}),list=await fresh.list();assert.equal(list.total,2);assert.equal('password' in list.items[0],false);assert.doesNotMatch(JSON.stringify(list),/fixture-only-Password|different-fixture-password/);
 let actual;await fresh.withPassword(list.items[0].id,value=>{actual=value;});assert.equal(actual,row().password);
});
test('unavailable or basic_text OS storage rejects writes with no plaintext fallback',async t=>{
 const f=await fixture(t);for(const safeStorage of [{isEncryptionAvailable:()=>false},{...encryption(),getSelectedStorageBackend:()=> 'basic_text'},{...encryption(),getSelectedStorageBackend:()=> 'unknown'}]){
  const store=new CredentialStore({file:f.store.file,safeStorage,platform:'linux'});assert.equal((await store.status()).available,false);await assert.rejects(store.merge([row()]),/без шифрования/);
 }assert.equal(await fs.stat(f.store.file).then(()=>true,()=>false),false);
});
test('ciphertext corruption and a cancelled atomic write preserve the prior bytes',async t=>{
 const f=await fixture(t);await f.store.merge([row()]);const before=await fs.readFile(f.store.file),original=f.store.safeStorage.encryptString;let invalid=false;
 f.store.safeStorage.encryptString=value=>{invalid=true;return original(value);};const guard=()=>{if(invalid){const e=Error('cancelled');e.code='MOUSE_IMPORT_CANCELLED';throw e;}};
 await assert.rejects(f.store.merge([row({username:'later'})],guard),/cancelled/);assert.deepEqual(await fs.readFile(f.store.file),before);assert.equal((await fs.readdir(f.folder)).some(x=>x.endsWith('.tmp')),false);
 await fs.writeFile(f.store.file,Buffer.from('corrupted-fixture'));assert.equal((await f.store.status()).available,false);await assert.rejects(f.store.merge([row()]),/расшифровать/);assert.equal((await fs.readFile(f.store.file)).toString(),'corrupted-fixture');
});
test('password picker cancellation and confirmation disclose no passwords and do not import prematurely',async t=>{
 const f=await fixture(t);assert.equal((await f.service.handle('passwords')).canceled,true);assert.equal((await f.store.status()).count,0);
 await f.select('passwords.csv','name,url,username,password\nExample,https://example.test,fixture-user,fixture-only-Password-123');f.choose(0);assert.equal((await f.service.handle('passwords')).canceled,true);assert.equal((await f.store.status()).count,0);
 f.choose(1);const result=await f.service.handle('passwords');assert.equal(result.imported,1);assert.doesNotMatch(JSON.stringify({result,prompts:f.prompts}),/fixture-only-Password-123/);const metadata=await f.service.handle('credentials/list');assert.equal(metadata.items[0].username,'fixture-user');assert.equal('password' in metadata.items[0],false);
});
test('only the trusted shell and ordinary mode can import or access credentials, including mid-dialog transitions',async t=>{
 const f=await fixture(t);await assert.rejects(async()=>f.handlers.get('mouse:import')('foreign','state'),/untrusted/);f.private(true);
 for(const action of ['state','bookmarks','passwords','credentials/list','credentials/copy','credentials/remove'])await assert.rejects(f.service.handle(action,{id:'x'}),/обычном окне/);
 f.private(false);await f.select('passwords.csv','url,username,password\nhttps://example.test,u,p');f.dialog.showMessageBox=async()=>{f.private(true);return{response:1};};await assert.rejects(f.service.handle('passwords'),/отменено/);assert.equal((await f.store.status()).count,0);
});
test('a lock invalidates a pending file chooser even after the window becomes usable again',async t=>{
 const f=await fixture(t);await f.select('export.html','<DL><A HREF="https://example.test">Example</A></DL>');const original=f.dialog.showOpenDialog;
 f.dialog.showOpenDialog=async(...args)=>{const answer=await original(...args);f.powerMonitor.emit('lock-screen');return answer;};await assert.rejects(f.service.handle('bookmarks'),/отменено/);assert.equal(f.library.data.bookmarks.length,0);
});
test('explicit password copy clears after 30 seconds only if unchanged, and lock/quit clear owned clipboard',async t=>{
 const f=await fixture(t);await f.store.merge([row()]);const id=(await f.store.list()).items[0].id;
 assert.deepEqual(await f.service.handle('credentials/copy',{id}),{copied:true,clearAfterSeconds:30});assert.equal(f.clip,row().password);await f.expire();assert.equal(f.clip,'');
 await f.service.handle('credentials/copy',{id});f.clip='new human clipboard';await f.expire();assert.equal(f.clip,'new human clipboard');
 await f.service.handle('credentials/copy',{id});f.powerMonitor.emit('lock-screen');await f.service.flush();assert.equal(f.clip,'');await f.service.handle('credentials/copy',{id});f.app.emit('before-quit');await f.service.flush();assert.equal(f.clip,'');
 // A cancelled quit must invalidate pending work without disabling the still
 // open application's import service. Final window close releases the IPC.
 assert.equal(f.handlers.has('mouse:import'),true);assert.equal((await f.service.handle('state')).passwords.count,1);await f.service.handle('credentials/copy',{id});assert.equal(f.clip,row().password);
 f.win.emit('closed');await f.service.flush();assert.equal(f.clip,'');assert.equal(f.handlers.has('mouse:import'),false);
});
test('asynchronous clipboard writes finish before copy succeeds, and a stale expiry cannot erase a new copy',async t=>{
 const f=await fixture(t);await f.store.merge([row()]);const id=(await f.store.list()).items[0].id;await f.service.handle('credentials/copy',{id});const previousExpiry=f.timer;
 let entered,release,settled=false;const started=new Promise(resolve=>{entered=resolve;}),pendingWrite=new Promise(resolve=>{release=resolve;}),write=f.clipboard.writeText;
 f.clipboard.writeText=async value=>{entered();await pendingWrite;await write(value);};const copy=f.service.handle('credentials/copy',{id});copy.then(()=>{settled=true;});await started;assert.equal(settled,false);assert.equal(f.clip,'');
 const oldCleanup=previousExpiry();release();assert.deepEqual(await copy,{copied:true,clearAfterSeconds:30});await oldCleanup;assert.equal(f.clip,row().password);await f.expire();assert.equal(f.clip,'');
});
test('private transition, lock and close cancel a pending asynchronous secret write and flush its cleanup',async t=>{
 for(const transition of ['private','lock','close']){
  const f=await fixture(t);await f.store.merge([row()]);const id=(await f.store.list()).items[0].id;
  let entered,release;const started=new Promise(resolve=>{entered=resolve;}),pendingWrite=new Promise(resolve=>{release=resolve;}),write=f.clipboard.writeText;
  f.clipboard.writeText=async value=>{entered();await pendingWrite;await write(value);};const copy=f.service.handle('credentials/copy',{id}),rejected=assert.rejects(copy,/отменено/);await started;
  if(transition==='private'){f.private(true);f.service.cancelPending();}else if(transition==='lock')f.powerMonitor.emit('lock-screen');else f.win.emit('closed');
  release();await rejected;await f.service.flush();assert.equal(f.clip,'');assert.equal(f.timer,null);if(transition==='close')assert.equal(f.handlers.has('mouse:import'),false);
 }
});
test('a rejected asynchronous clipboard write is reported without secret text and does not block a later copy',async t=>{
 const f=await fixture(t);await f.store.merge([row()]);const id=(await f.store.list()).items[0].id,write=f.clipboard.writeText;
 f.clipboard.writeText=async()=>{throw Error('adapter failure '+row().password);};await assert.rejects(f.service.handle('credentials/copy',{id}),error=>{assert.match(error.message,/Не удалось скопировать/);assert.equal(error.message.includes(row().password),false);return true;});assert.equal(f.clip,'');
 f.clipboard.writeText=write;assert.deepEqual(await f.service.handle('credentials/copy',{id}),{copied:true,clearAfterSeconds:30});assert.equal(f.clip,row().password);
});
test('removing a password requires the native confirmation and persists without rewriting other entries',async t=>{
 const f=await fixture(t);await f.store.merge([row(),row({username:'second'})]);const id=(await f.store.list()).items[0].id;
 f.choose(0);assert.deepEqual(await f.service.handle('credentials/remove',{id}),{removed:false});assert.equal((await f.store.status()).count,2);
 f.choose(1);assert.deepEqual(await f.service.handle('credentials/remove',{id}),{removed:true});assert.equal((await f.store.list()).items[0].username,'second');assert.doesNotMatch(JSON.stringify(f.prompts),/fixture-only-Password/);
});
