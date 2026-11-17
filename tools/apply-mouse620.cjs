'use strict';
// One-use transport for owner-reviewed source changes. Deleted before candidate PR.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process'),assert=require('node:assert/strict');
cp.execFileSync('git',['merge-base','--is-ancestor','579aef7751afbd6a4fea6e28c7ac3e793d0bd13e','HEAD']);
const data=Buffer.from([1,2,3].map(i=>fs.readFileSync('tools/mouse620-payload-br'+i+'.txt','utf8').trim()).join(''),'base64');
assert.equal(crypto.createHash('sha256').update(data).digest('hex'),'4b9e38df2057116a9f9d10bdf1a3700d8a6ea59e075609265e9488e6666ed213','Transport checksum mismatch');
const rows=JSON.parse(zlib.brotliDecompressSync(data).toString('utf8')),results=[];
const blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
for(const item of rows){
 const p=item.path;assert.ok(typeof p==='string'&&!p.includes('..')&&(p.startsWith('desktop/')||['MOUSE_BROWSER_ROADMAP.md','.github/workflows/mouse-macos.yml','.github/workflows/mouse620-source.yml','tools/mouse-verify.py','tools/mouse-update-verify.py'].includes(p)),p);
 const old=fs.existsSync(p)?fs.readFileSync(p):null;assert.equal(old?blob(old):null,item.before,'Unexpected current source: '+p);
 if(item.delete){assert.equal(p,'.github/workflows/mouse620-source.yml');results.push([p,null]);continue;}
 let out=item.new;
 if(out===undefined){const chars=Array.from(old.toString('utf8'));let tail=chars.length;const parts=[];
  for(const [a,b,value]of [...item.edits].reverse()){assert.ok(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&0<=a&&a<=b&&b<=tail);parts.unshift(value,chars.slice(b,tail).join(''));tail=a;}
  parts.unshift(chars.slice(0,tail).join(''));out=parts.join('');
 }
 assert.equal(crypto.createHash('sha256').update(out).digest('hex'),item.after,'Applied source mismatch: '+p);results.push([p,out]);
}
// All source expectations and destination hashes pass before the first write.
for(const [p,value]of results){if(value===null)fs.unlinkSync(p);else{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);}}
console.log('MOUSE620_EXACT_SOURCE_APPLIED',results.length);
