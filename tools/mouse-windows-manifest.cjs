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
const feedback638=require('./mouse-638-manifest.cjs').bind(desktop,'win32','x64',evidence.checks?.feedback638);
if(!evidence.checks?.adblock639)throw Error('Installed AdBlock639 wrapper missing');
const adblock639=require('./mouse-639-manifest.cjs').bind(desktop,'win32','x64',evidence.checks.adblock639);
const settings640=require('./mouse-640-manifest.cjs').bind(desktop,'win32','x64');
const workspace641=require('./mouse-641-manifest.cjs').bind(desktop,'win32','x64',evidence.checks?.workspace641);
if(!evidence.checks?.feedback638)throw Error('Installed Windows638 feedback wrapper missing');
for(const name of ['mouse-windows-audit.json']){
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
 tests:['native641-classic-grid-and-workspace-flows','native641-site-exclusions-restart','native641-theme-surfaces-and-library','native641-headers-always-visible','native641-media-player-removed-site-audio-retained','settings-glass-navigation-search','native-adblock-network-ui-restart','real-641-to-642-profile-preserving-replacement','combined637-native-features','real-641-to-642-native-update-button','real-629-to-642-profile-preserving-install','new-tab-compositor-pixels','square-grid-one-pixel-separators','native-rounded-drag-seams','live-website-white-tone','chrome-web-store-direct-install','tile-search-removed','live-desktop-switch-performance','stable-download-and-capture-dom','current-desktop-native-layout-menu','pinned-pane-layout-preservation','owner-upper-privacy-right-screenshot-controls','agent-removed-no-runtime-ui-or-ipc'],
 feedback638,adblock639,settings640,workspace641,
 signing,authenticode:signature,ownerDeviceVerified:false,
 package:{name,size,sha256:installerHash},
 verification:{file:path.basename(evidencePath),sha256:sha(evidencePath),result:evidence},
 updateChannel:'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json'};
fs.writeFileSync(path.join(out,'mouse-windows-build.json'),JSON.stringify(metadata,null,2)+'\n');
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),metadata.package.sha256+'  '+name+'\n');
console.log(JSON.stringify({source,version,package:metadata.package,verified:true},null,2));
