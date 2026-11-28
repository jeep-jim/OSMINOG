'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function bind(directory,platform,arch,wrapper){
 const file='mouse-641-workspace-acceptance.json',raw=fs.readFileSync(path.join(directory,file)),accepted=JSON.parse(raw);
 assert.equal(accepted.schema,1);assert.equal(accepted.version,'6.0.44');assert.equal(accepted.platform,platform);assert.equal(accepted.arch,arch);assert.equal(accepted.ok,true);
 const seen=new Set();assert.ok(Array.isArray(accepted.artifacts)&&accepted.artifacts.length>10);
 for(const artifact of accepted.artifacts){assert.match(artifact.file,/^mouse-(637|641)-[a-z0-9.-]+$/);assert.ok(!artifact.file.includes('..'));assert.ok(!seen.has(artifact.file));seen.add(artifact.file);const bytes=fs.readFileSync(path.join(directory,artifact.file));assert.equal(artifact.sha256,sha(bytes));assert.equal(artifact.bytes,bytes.length);}
 const report='mouse-641-workspace.json',processes='mouse-641-workspace-processes.json',processRaw=fs.readFileSync(path.join(directory,processes));
 if(wrapper){const actual=JSON.parse(processRaw);assert.deepEqual(wrapper,{...actual,acceptanceSha256:sha(raw)});}
 return{file,sha256:sha(raw),report:{file:report,sha256:sha(fs.readFileSync(path.join(directory,report)))},processes:{file:processes,sha256:sha(processRaw)}};
}
module.exports={bind};
