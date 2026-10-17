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
for(const name of ['shell-polish.css','shell-polish.js','agent-connections.js','tile-layout.js','address-suggestions.js','browser-ui.js','browser-ui.css','update-ui.js','control-ui.js','files-ui.js','tools-ui.js','direct-canvas.js','workspace-tools.js','documents-ui.js','presence-ui.js','pointer-ui.js','workspace-presence-ui.js','welcome.js','welcome.css','capture-editor.js','code-format.js','code-project-ui.js','code-workspace.js','creation-tools.css'])fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
const file=path.join(out,'editor.html');let html=fs.readFileSync(file,'utf8');html=html.replace('<html', '<html data-native-desktop="true"').replace('<head>','<head><style>html[data-native-desktop] #app{display:none!important}html[data-native-desktop]:not(.native-ready) body>*{visibility:hidden!important}html[data-native-desktop] body{background:#111722}</style><script src="desktop-adapter.js"></script><link rel="stylesheet" href="browser-ui.css"><link rel="stylesheet" href="welcome.css"><link rel="stylesheet" href="creation-tools.css"><link rel="stylesheet" href="shell-polish.css">');html=html.replace('<script src="osminog-storage-onboarding.js"></script>','');html=html.replace(/<body([^>]*)>/,(_,attrs)=>'<body'+attrs+'>'+fs.readFileSync(path.join(__dirname,'welcome.html'),'utf8'));html=html.replace('</body>','<script src="update-ui.js"></script><script src="tile-layout.js"></script><script src="browser-ui.js"></script><script src="address-suggestions.js"></script><script src="agent-connections.js"></script><script src="welcome.js"></script><script src="capture-editor.js"></script><script src="code-format.js"></script><script src="code-editor.bundle.js"></script><script src="code-project-ui.js"></script><script src="code-workspace.js"></script><script src="files-ui.js"></script><script src="tools-ui.js"></script><script src="direct-canvas.js"></script><script src="workspace-tools.js"></script><script src="documents-ui.js"></script><script src="presence-ui.js"></script><script src="pointer-ui.js"></script><script src="workspace-presence-ui.js"></script><script src="shell-polish.js"></script></body>');html=html.replace('<title>OSMINOG — Visual workspace</title>','<title>OSMINOG — браузер</title>');fs.writeFileSync(file,html);




const pointer=fs.readFileSync(path.join(__dirname,'pointer-ui.js'),'utf8').split("if(typeof module")[0];
fs.writeFileSync(path.join(__dirname,'page-pointer-preload.cjs'),pointer+'\n'+fs.readFileSync(path.join(__dirname,'page-preload.cjs'),'utf8'));

require('esbuild').buildSync({entryPoints:[path.join(__dirname,'code-editor.mjs')],bundle:true,format:'iife',platform:'browser',minify:true,legalComments:'eof',outfile:path.join(out,'code-editor.bundle.js')});

const licenseRoots=['codemirror',...fs.readdirSync(path.join(__dirname,'node_modules/@codemirror')).map(n=>'@codemirror/'+n),...fs.readdirSync(path.join(__dirname,'node_modules/@lezer')).map(n=>'@lezer/'+n),'crelt','style-mod','w3c-keyname'];
fs.writeFileSync(path.join(out,'code-editor.LICENSES.txt'),licenseRoots.map(name=>{const dir=path.join(__dirname,'node_modules',name);const file=['LICENSE','LICENSE.txt'].find(f=>fs.existsSync(path.join(dir,f)));return file?name+'\n'+fs.readFileSync(path.join(dir,file),'utf8'):name;}).join('\n\n'));
