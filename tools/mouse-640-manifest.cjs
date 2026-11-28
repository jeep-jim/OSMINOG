'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function bind(directory,platform,arch){
 const file='mouse-640-settings-acceptance.json',raw=fs.readFileSync(path.join(directory,file)),accepted=JSON.parse(raw);
 assert.equal(accepted.version,'6.0.45');assert.equal(accepted.platform,platform);assert.equal(accepted.arch,arch);assert.equal(accepted.ok,true);
 assert.deepEqual(accepted.themes,['light','dark']);assert.equal(accepted.nativeCaptures.length,6);
 const seen=new Set();for(const artifact of accepted.artifacts){assert.match(artifact.file,/^mouse-(637|640)-[a-z0-9.-]+$/);assert.ok(!artifact.file.includes('..'));assert.ok(!seen.has(artifact.file));seen.add(artifact.file);const bytes=fs.readFileSync(path.join(directory,artifact.file));assert.equal(artifact.sha256,sha(bytes));assert.equal(artifact.bytes,bytes.length);}
 for(const name of ['mouse-637-features.json','mouse-637-features-write.json',...accepted.nativeCaptures,...accepted.nativeCaptures.map(name=>name.replace('.png','-display.png'))])assert.ok(seen.has(name),'Missing independently checked settings evidence '+name);
 return{file,sha256:sha(raw),report:{file:'mouse-637-features.json',sha256:sha(fs.readFileSync(path.join(directory,'mouse-637-features.json')))}};
}
module.exports={bind};
