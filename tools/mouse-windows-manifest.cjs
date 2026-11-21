'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const desktop=path.resolve(__dirname,'../desktop'),out=path.join(desktop,'dist-mouse-windows');
const version=require(path.join(desktop,'mouse-windows-build.cjs')).extraMetadata.version;
const name=`Mouse-Browser-${version}-Windows-x64.exe`,installer=path.join(out,name);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Manifest requires the actual Windows x64 builder');
const evidencePath=path.join(desktop,'mouse-windows-verification.json');
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
if(evidence.ok!==true||evidence.version!==version||evidence.platform!=='win32'||evidence.arch!=='x64')throw Error('Installed Windows verification incomplete');
for(const name of ['mouse-windows-audit.json','mouse-windows-agent-audit.json']){
 const audit=JSON.parse(fs.readFileSync(path.join(desktop,name),'utf8'));
 if(audit.error||!audit.metadata||audit.metadata.vulnerabilities.high||audit.metadata.vulnerabilities.critical)throw Error('Production dependency audit failed: '+name);
}
const size=fs.statSync(installer).size;if(size<50*1024*1024||size>500*1024*1024)throw Error('Installer size outside expected range');
const installerHash=sha(installer),signature=evidence.authenticode?.installer;
if(evidence.installerSha256!==installerHash||evidence.installerBytes!==size||signature?.source!=='Get-AuthenticodeSignature'||signature.sha256!==installerHash||typeof signature.status!=='string'||!signature.status)throw Error('Measured installer signature is not bound to the verified package');
const signing=signature.status==='NotSigned'?'unsigned':signature.status==='Valid'?'signed':'invalid';
const source=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(source))throw Error('Source commit missing');
const metadata={version,productName:'Mouse Browser',platform:'win32',arch:'x64',source,
 runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,
 tests:['installed-public-search-real-query','stable-download-and-capture-dom','agent-messenger-native-streaming','current-desktop-native-layout-menu','pinned-pane-layout-preservation','owner-upper-privacy-right-screenshot-controls'],
 signing,authenticode:signature,ownerDeviceVerified:false,
 package:{name,size,sha256:installerHash},
 verification:{file:path.basename(evidencePath),sha256:sha(evidencePath),result:evidence},
 updateChannel:'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json'};
fs.writeFileSync(path.join(out,'mouse-windows-build.json'),JSON.stringify(metadata,null,2)+'\n');
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),metadata.package.sha256+'  '+name+'\n');
console.log(JSON.stringify({source,version,package:metadata.package,verified:true},null,2));
