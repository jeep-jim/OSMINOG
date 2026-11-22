'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const desktop=path.resolve(__dirname,'../desktop'),out=path.join(desktop,'dist-mouse-linux');
const version=require(path.join(desktop,'mouse-linux-build.cjs')).extraMetadata.version;
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(process.platform!=='linux'||process.arch!=='x64')throw Error('Manifest requires the native Linux x64 builder');
const file=path.join(desktop,'mouse-linux-verification.json'),evidence=JSON.parse(fs.readFileSync(file,'utf8'));
if(evidence.ok!==true||evidence.version!==version||evidence.platform!=='linux'||evidence.arch!=='x64')throw Error('Installed Linux verification incomplete');
const source=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim();
if(evidence.source!==source||String(evidence.runId)!==process.env.GITHUB_RUN_ID||String(evidence.runAttempt)!==process.env.GITHUB_RUN_ATTEMPT)throw Error('Linux evidence belongs to another source run');
for(const name of ['mouse-linux-audit.json']){const audit=JSON.parse(fs.readFileSync(path.join(desktop,name),'utf8'));if(audit.error||!audit.metadata||audit.metadata.vulnerabilities.high||audit.metadata.vulnerabilities.critical)throw Error('Production dependency audit failed: '+name);}
const packages={};for(const extension of ['AppImage','deb']){const name=`Mouse-Browser-${version}-Linux-x64.${extension}`,target=path.join(out,name);packages[name]={size:fs.statSync(target).size,sha256:sha(target)};}
if(JSON.stringify(packages)!==JSON.stringify(evidence.packages))throw Error('Linux package bytes changed after installed acceptance');
const metadata={version,productName:'Mouse Browser',platform:'linux',arch:'x64',source,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,
 tests:['real-636-to-637-profile-preserving-replacement','combined637-native-features','real-636-to-637-native-update-button','tile-search-removed','live-desktop-switch-performance','stable-download-and-capture-dom','current-desktop-native-layout-menu','pinned-pane-layout-preservation','owner-upper-privacy-right-screenshot-controls','agent-removed-no-runtime-ui-or-ipc'],
 signing:'unsigned',ownerDeviceVerified:false,packages,verification:{file:path.basename(file),sha256:sha(file),result:evidence},
 updateChannel:require('../desktop/mouse-update.cjs').LINUX_CHANNEL};
fs.writeFileSync(path.join(out,'mouse-linux-build.json'),JSON.stringify(metadata,null,2)+'\n');
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),Object.entries(packages).map(([name,value])=>value.sha256+'  '+name+'\n').join(''));
console.log(JSON.stringify({source,version,packages,verified:true},null,2));
