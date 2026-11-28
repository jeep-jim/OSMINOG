'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function bind(directory,platform,arch,wrapper){
 const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
 const accepted=read('mouse-638-acceptance.json'),processes=read('mouse-638-feedback-processes.json'),report=read('mouse-638-feedback.json');
 for(const value of [accepted,processes,report]){assert.equal(value.version,'6.0.45');assert.equal(value.platform,platform);assert.equal(value.arch,arch);}
 assert.equal(accepted.ok,true);assert.equal(report.ok,true);assert.equal(report.restored,true);
 assert.equal(processes.reportSha256,sha(path.join(directory,'mouse-638-feedback.json')));
 assert.equal(processes.write.pid,report.pid);assert.equal(processes.read.pid,report.restart.pid);assert.notEqual(processes.write.pid,processes.read.pid);
 for(const phase of ['write','read']){const p=processes[phase];assert.equal(p.exitCode,0);assert.equal(p.logSha256,sha(path.join(directory,p.log)));assert.equal(p.reportSha256,sha(path.join(directory,p.report)));}
 const artifact={file:'mouse-638-acceptance.json',sha256:sha(path.join(directory,'mouse-638-acceptance.json')),
  report:{file:'mouse-638-feedback.json',sha256:processes.reportSha256},processes:{file:'mouse-638-feedback-processes.json',sha256:sha(path.join(directory,'mouse-638-feedback-processes.json'))},
  webStore:{id:accepted.webStore.id,version:accepted.webStore.version,file:'mouse-638-webstore.crx',sha256:sha(path.join(directory,'mouse-638-webstore.crx'))}};
 assert.equal(artifact.webStore.sha256,accepted.webStore.sha256);assert.equal(accepted.webStore.independentCRX3.sha256,artifact.webStore.sha256);
 assert.equal(accepted.webStore.independentCRX3.developerVerified,true);assert.equal(accepted.webStore.independentCRX3.publisherVerified,true);
 if(wrapper){assert.equal(wrapper.acceptanceSha256,artifact.sha256);assert.equal(wrapper.reportSha256,artifact.report.sha256);}
 return artifact;
}
module.exports={bind};
