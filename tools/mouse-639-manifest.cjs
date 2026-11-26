'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function bind(directory,platform,arch,wrapper){
 const bytes=name=>{assert.match(name,/^mouse-639-[a-z0-9.-]+$/);assert.ok(!name.includes('..'));return fs.readFileSync(path.join(directory,name));};
 const read=name=>JSON.parse(bytes(name));
 const accepted=read('mouse-639-acceptance.json'),processes=read('mouse-639-adblock-processes.json'),report=read('mouse-639-adblock.json');
 for(const value of [accepted,processes,report]){assert.equal(value.version,'6.0.41');assert.equal(value.platform,platform);assert.equal(value.arch,arch);}
 assert.equal(accepted.ok,true);assert.equal(accepted.syntheticFilters,true);assert.equal(report.ok,true);assert.equal(report.restored,true);
 assert.deepEqual(accepted.cases.map(value=>value.name),['default-off','enabled-first','enabled-second-tab','enabled-other-desktop','enabled-private','disabled-again','restart-enabled']);
 assert.equal(processes.reportSha256,sha(bytes('mouse-639-adblock.json')));assert.equal(processes.profile,report.profile);
 assert.equal(processes.write.pid,report.pid);assert.equal(processes.read.pid,report.restart.pid);assert.notEqual(processes.write.pid,processes.read.pid);
 assert.deepEqual(accepted.processes,{writePid:processes.write.pid,readPid:processes.read.pid});
 for(const phase of ['write','read']){const p=processes[phase];assert.equal(p.exitCode,0);assert.equal(p.log,'mouse-639-adblock-'+phase+'.log');assert.equal(p.report,phase==='write'?'mouse-639-adblock-write.json':'mouse-639-adblock.json');assert.equal(p.logSha256,sha(bytes(p.log)));assert.equal(p.reportSha256,sha(bytes(p.report)));}
 const seen=new Set();assert.ok(Array.isArray(accepted.artifacts));
 for(const artifact of accepted.artifacts){assert.ok(!seen.has(artifact.file));seen.add(artifact.file);const data=bytes(artifact.file);assert.equal(artifact.sha256,sha(data));assert.equal(artifact.bytes,data.length);}
 for(const name of ['mouse-639-adblock.json','mouse-639-adblock-write.json','mouse-639-adblock-processes.json','mouse-639-adblock-cache.json','mouse-639-adblock-cache-easylist.json','mouse-639-adblock-cache-ruadlist.json','mouse-639-adblock-http-write.json','mouse-639-adblock-http-read.json','mouse-639-adblock-fixture.html','mouse-639-adblock-write.log','mouse-639-adblock-read.log'])assert.ok(seen.has(name),'Missing independently read artifact '+name);
 const artifact={file:'mouse-639-acceptance.json',sha256:sha(bytes('mouse-639-acceptance.json')),
  report:{file:'mouse-639-adblock.json',sha256:processes.reportSha256},
  processes:{file:'mouse-639-adblock-processes.json',sha256:sha(bytes('mouse-639-adblock-processes.json'))},
  cache:{file:'mouse-639-adblock-cache.json',sha256:sha(bytes('mouse-639-adblock-cache.json'))},artifacts:accepted.artifacts};
 assert.equal(processes.cacheSeedSha256,artifact.cache.sha256);
 if(wrapper){assert.equal(wrapper.acceptanceSha256,artifact.sha256);assert.equal(wrapper.reportSha256,artifact.report.sha256);assert.equal(wrapper.cacheSeedSha256,artifact.cache.sha256);}
 return artifact;
}
module.exports={bind};
