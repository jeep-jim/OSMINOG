'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'board');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync(root,{withFileTypes:true})){
 if(file.isFile()&&/\.(js|css|html|json)$/.test(file.name))fs.copyFileSync(path.join(root,file.name),path.join(out,file.name));
 if(file.isDirectory()&&['vendor','icons','assets','fonts','_locales'].includes(file.name))fs.cpSync(path.join(root,file.name),path.join(out,file.name),{recursive:true});
}
fs.copyFileSync(path.join(__dirname,'adapter.js'),path.join(out,'desktop-adapter.js'));
const file=path.join(out,'editor.html');let html=fs.readFileSync(file,'utf8');html=html.replace('<head>','<head><script src="desktop-adapter.js"></script>');html=html.replace('<script src="osminog-storage-onboarding.js"></script>','');fs.writeFileSync(file,html);
