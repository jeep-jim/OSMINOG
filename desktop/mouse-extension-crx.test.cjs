'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const CRX=require('./mouse-extension-crx.cjs'),{packageZip}=require('./mouse-document-fixtures.cjs');
const varint=value=>{const out=[];do{let b=value&127;value=Math.floor(value/128);if(value)b|=128;out.push(b);}while(value);return Buffer.from(out);};
const field=(n,bytes)=>Buffer.concat([varint(n*8+2),varint(bytes.length),bytes]);
const manifest={manifest_version:3,name:'Owned signed fixture',version:'1.0',action:{default_popup:'popup.html'}};
function signed({algorithm='rsa',files={'manifest.json':JSON.stringify(manifest),'popup.html':'<title>Owned fixture</title>'},additional=false}={}){
 const pair=crypto.generateKeyPairSync(algorithm,algorithm==='rsa'?{modulusLength:2048}:{namedCurve:'prime256v1'}),pub=pair.publicKey.export({type:'spki',format:'der'}),hash=crypto.createHash('sha256').update(pub).digest(),id=hash.subarray(0,16).toString('hex').replace(/[\da-f]/g,c=>String.fromCharCode(97+parseInt(c,16))),header=field(1,hash.subarray(0,16)),size=Buffer.alloc(4);size.writeUInt32LE(header.length);
 const archive=packageZip(files),data=Buffer.concat([Buffer.from('CRX3 SignedData\0'),size,header,archive]),sig=crypto.sign('SHA256',data,pair.privateKey),proof=field(algorithm==='rsa'?2:3,Buffer.concat([field(1,pub),field(2,sig)]));
 const protobuf=Buffer.concat([proof,...(additional?[field(2,Buffer.concat([field(1,pub),field(2,Buffer.alloc(sig.length))]))]:[]),field(10000,header)]),prefix=Buffer.alloc(12);prefix.write('Cr24');prefix.writeUInt32LE(3,4);prefix.writeUInt32LE(protobuf.length,8);return{id,bytes:Buffer.concat([prefix,protobuf,archive]),pub,files};
}
test('real RSA and ECDSA developer signatures bind ID, signed header and every ZIP byte',()=>{
 for(const algorithm of ['rsa','ec']){const data=signed({algorithm}),result=CRX.verifyCrx(data.bytes,data.id,{requirePublisher:false});assert.equal(result.evidence.developerVerified,true);assert.equal(result.evidence.publisherVerified,false);assert.equal(result.publicKey,data.pub.toString('base64'));assert.equal(CRX.archiveFiles(result.archive).get('popup.html').toString(),data.files['popup.html']);
  assert.throws(()=>CRX.verifyCrx(data.bytes,data.id),{code:'CRX_PROOF'},'A valid private fixture is never a trusted Chrome Store package');
  const changed=Buffer.from(data.bytes);changed[changed.length-25]^=1;assert.throws(()=>CRX.verifyCrx(changed,data.id,{requirePublisher:false}),{code:'CRX_SIGNATURE'});
  assert.throws(()=>CRX.verifyCrx(data.bytes,'a'.repeat(32),{requirePublisher:false}),{code:'CRX_ID'});
 }
});
test('every supplied proof must verify, and old CRX/duplicate or truncated signed headers fail',()=>{
 const invalid=signed({additional:true});assert.throws(()=>CRX.verifyCrx(invalid.bytes,invalid.id,{requirePublisher:false}),{code:'CRX_SIGNATURE'});
 const data=signed();for(const mutate of [b=>b.writeUInt32LE(2,4),b=>b.writeUInt32LE(CRX.LIMITS.header+1,8),b=>b.writeUInt32LE(b.length,8)]){const b=Buffer.from(data.bytes);mutate(b);assert.throws(()=>CRX.verifyCrx(b,data.id,{requirePublisher:false}));}
 for(const length of [0,10,30,100])assert.throws(()=>CRX.verifyCrx(data.bytes.subarray(0,length),data.id,{requirePublisher:false}));
});
test('extracts a verified ordinary package and injects only the verified ID key',async t=>{
 const data=signed(),root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse638-crx-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const crx=CRX.verifyCrx(data.bytes,data.id,{requirePublisher:false});const folder=path.join(root,'extension'),m=await CRX.extractVerified(crx,folder);
 assert.equal(m.key,data.pub.toString('base64'));assert.equal(await fs.readFile(path.join(folder,'popup.html'),'utf8'),data.files['popup.html']);
 const mismatch=signed({files:{'manifest.json':JSON.stringify({...manifest,key:'different'})}});await assert.rejects(CRX.extractVerified(CRX.verifyCrx(mismatch.bytes,mismatch.id,{requirePublisher:false}),path.join(root,'wrong')),{code:'CRX_ID'});await assert.rejects(fs.stat(path.join(root,'wrong')),{code:'ENOENT'});
});
test('rejects ZIP traversal, Windows aliases, case collisions, symlinks, native payload and oversized output',()=>{
 for(const name of ['../escape.js','/escape.js','a\\b.js','a/../b.js','NUL.txt','con/a.js','name./a.js','space /a.js','x.exe']){
  assert.throws(()=>CRX.archiveFiles(packageZip({'manifest.json':JSON.stringify(manifest),[name]:'x'})),name);
 }
 assert.throws(()=>CRX.archiveFiles(packageZip({'manifest.json':'{}','MANIFEST.JSON':'{}'})),{code:'CRX_PATH'});
 assert.throws(()=>CRX.archiveFiles(packageZip({'manifest.json':'{}','file':'x','file/name':'y'})),{code:'CRX_PATH'});
 const symbolic=packageZip({'manifest.json':'{}'}),e=symbolic.length-22,central=symbolic.readUInt32LE(e+16);symbolic.writeUInt32LE(0xa1ff0000,central+38);assert.throws(()=>CRX.archiveFiles(symbolic),{code:'CRX_ZIP'});
 const oversized=packageZip({'manifest.json':'{}'}),end=oversized.length-22,c=oversized.readUInt32LE(end+16);oversized.writeUInt32LE(CRX.LIMITS.file+1,c+24);assert.throws(()=>CRX.archiveFiles(oversized),{code:'CRX_ZIP'});
 const emptyDir=packageZip({'manifest.json':'{}','_locales/':''});assert.equal(CRX.archiveFiles(emptyDir).size,1,'Empty DEFLATE directory records used by Chrome Web Store are valid');
});
test('ZIP integrity rejects mismatched CRC, compressed payload and local/central filenames',()=>{
 for(const mutate of [b=>b[30]^=1,b=>b.writeUInt32LE(123,14),b=>b[43]^=1]){const b=packageZip({'manifest.json':'{}'});mutate(b);assert.throws(()=>CRX.archiveFiles(b));}
});
test('download selects exact Google HTTPS endpoints, no credentials, and refuses cross-origin redirect',async()=>{
 const url=new URL(CRX.downloadURL('a'.repeat(32),'152.0.0.0'));assert.equal(url.origin,'https://clients2.google.com');assert.equal(url.searchParams.get('acceptformat'),'crx3');assert.equal(new URLSearchParams(url.searchParams.get('x')).get('id'),'a'.repeat(32));
 for(const url of ['https://clients2.google.com.evil.test/a','http://clients2.google.com/a','https://u:p@clients2.google.com/a','https://clients2.google.com:444/a','file:///a'])assert.equal(CRX.allowedDownloadURL(url),false,url);
 const calls=[];await assert.rejects(CRX.downloadCrx({id:'a'.repeat(32),chromeVersion:'152.0.0.0',fetch:async(url,options)=>{calls.push({url,options});return new Response(null,{status:302,headers:{location:'https://example.com/file.crx'}});}}),{code:'CRX_ORIGIN'});
 assert.equal(calls.length,1);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'manual');
});
test('oversized/invalid downloads never reach extraction',async()=>{
 for(const response of [new Response('html',{status:200}),new Response('',{status:200,headers:{'content-length':String(CRX.LIMITS.download+1)}}),new Response(null,{status:404})])await assert.rejects(CRX.downloadCrx({id:'a'.repeat(32),chromeVersion:'152.0.0.0',fetch:async()=>response}));
});
