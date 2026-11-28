'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function bind(directory,platform,arch,wrapper){
 const file='mouse-643-polish-acceptance.json',raw=fs.readFileSync(path.join(directory,file)),accepted=JSON.parse(raw);
 assert.equal(accepted.schema,1);assert.equal(accepted.version,'6.0.45');assert.equal(accepted.platform,platform);assert.equal(accepted.arch,arch);assert.equal(accepted.ok,true);
 assert.ok(Array.isArray(accepted.artifacts)&&accepted.artifacts.length>=8);const seen=new Set();
 for(const item of accepted.artifacts){assert.match(item.file,/^mouse-643-[a-z0-9.-]+$/);assert.ok(!item.file.includes('..'));assert.ok(!seen.has(item.file));seen.add(item.file);const data=fs.readFileSync(path.join(directory,item.file));assert.equal(item.sha256,sha(data));assert.equal(item.bytes,data.length);}
 const report='mouse-643-polish.json',processes='mouse-643-polish-processes.json',processRaw=fs.readFileSync(path.join(directory,processes));
 if(wrapper)assert.deepEqual(wrapper,{...JSON.parse(processRaw),acceptanceSha256:sha(raw)});
 return{file,sha256:sha(raw),report:{file:report,sha256:sha(fs.readFileSync(path.join(directory,report)))},processes:{file:processes,sha256:sha(processRaw)}};
}
module.exports={bind};
