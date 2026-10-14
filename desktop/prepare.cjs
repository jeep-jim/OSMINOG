'use strict';
require('./build-icons.cjs');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'board');
const background=fs.readFileSync(path.join(root,'background.js'),'utf8'),start=background.indexOf('function bcMachineInstructions('),end=background.indexOf('function bcThreadKey(');
if(start<0||end<start)throw Error('Shared chat protocol boundaries changed');
fs.writeFileSync(path.join(__dirname,'protocol.cjs'),"'use strict';\n"+background.slice(start,end)+'\nmodule.exports={bcDecoratePrompt,bcToolPrompt,bcParseAssistant};\n');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync(root,{withFileTypes:true})){
 if(file.isFile()&&/\.(js|css|html|json)$/.test(file.name))fs.copyFileSync(path.join(root,file.name),path.join(out,file.name));
 if(file.isDirectory()&&['vendor','icons','assets','fonts','_locales'].includes(file.name))fs.cpSync(path.join(root,file.name),path.join(out,file.name),{recursive:true});
}
fs.copyFileSync(path.join(__dirname,'adapter.js'),path.join(out,'desktop-adapter.js'));
for(const name of ['browser-ui.js','browser-ui.css','update-ui.js','control-ui.js','files-ui.js','tools-ui.js','direct-canvas.js','documents-ui.js','presence-ui.js'])fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
const file=path.join(out,'editor.html');let html=fs.readFileSync(file,'utf8');html=html.replace('<html', '<html data-native-desktop="true"').replace('<head>','<head><style>html[data-native-desktop] #app{display:none!important}html[data-native-desktop]:not(.native-ready) body>*{visibility:hidden!important}html[data-native-desktop] body{background:#111722}html[data-native-desktop] body::before{content:"OSMINOG";position:fixed;inset:0;display:grid;place-items:center;color:#b5c2d5;font:16px system-ui}html[data-native-desktop].native-ready body::before{display:none}</style><script src="desktop-adapter.js"></script><link rel="stylesheet" href="browser-ui.css">');html=html.replace('<script src="osminog-storage-onboarding.js"></script>','');html=html.replace('</body>','<script src="update-ui.js"></script><script src="browser-ui.js"></script><script src="files-ui.js"></script><script src="tools-ui.js"></script><script src="direct-canvas.js"></script><script src="documents-ui.js"></script><script src="presence-ui.js"></script></body>');html=html.replace('<title>OSMINOG — Visual workspace</title>','<title>OSMINOG — браузер</title>');fs.writeFileSync(file,html);



