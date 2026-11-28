'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function bind(directory,platform,arch,wrapper){
 const file='mouse-644-sync-acceptance.json',raw=fs.readFileSync(path.join(directory,file)),accepted=JSON.parse(raw);
 assert.equal(accepted.schema,1);assert.equal(accepted.version,'6.0.44');assert.equal(accepted.platform,platform);assert.equal(accepted.arch,arch);assert.equal(accepted.ok,true);
 assert.equal(platform,'darwin');assert.equal(arch,'arm64');assert.equal(accepted.physicalUserDeviceVerified,false);assert.equal(accepted.liveGitHubVerified,false);
 assert.deepEqual(accepted.checks,['native644-filter-subscriptions-and-conditional-refresh','native644-page-theme-sync-and-restoration','native644-private-isolation-and-restart']);
 assert.ok(Array.isArray(accepted.artifacts)&&accepted.artifacts.length>=8);const seen=new Set();
 for(const item of accepted.artifacts){assert.match(item.file,/^mouse-644-[a-z0-9.-]+$/);assert.ok(!item.file.includes('..'));assert.ok(!seen.has(item.file));seen.add(item.file);const data=fs.readFileSync(path.join(directory,item.file));assert.equal(item.sha256,sha(data));assert.equal(item.bytes,data.length);}
 const report='mouse-644-sync.json',processes='mouse-644-sync-processes.json',processRaw=fs.readFileSync(path.join(directory,processes));
 for(const name of [report,processes,'mouse-644-sync-write.json','mouse-644-sync-write.log','mouse-644-sync-read.log'])assert.ok(seen.has(name),'Required644 evidence is absent: '+name);
 if(wrapper)assert.deepEqual(wrapper,{...JSON.parse(processRaw),acceptanceSha256:sha(raw)});
 return{file,sha256:sha(raw),report:{file:report,sha256:sha(fs.readFileSync(path.join(directory,report)))},processes:{file:processes,sha256:sha(processRaw)}};
}
module.exports={bind};
