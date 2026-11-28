'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');

// Keep the filesystem bundle/executable names understood by published updaters.
// Finder and Dock obtain the short user-facing name through native localization.
// This runs before signing; no installed application or user profile is edited.
async function localizeMacName({appOutDir,electronPlatformName}){
 if(electronPlatformName!=='darwin')return;
 const resources=path.join(appOutDir,'Mouse Browser.app','Contents','Resources');
 const languages=new Set(['en.lproj','ru.lproj','Base.lproj']);
 for(const item of fs.readdirSync(resources,{withFileTypes:true}))if(item.isDirectory()&&item.name.endsWith('.lproj'))languages.add(item.name);
 for(const language of languages){
  const directory=path.join(resources,language),file=path.join(directory,'InfoPlist.strings');
  fs.mkdirSync(directory,{recursive:true});
  const values=fs.existsSync(file)?JSON.parse(cp.execFileSync('/usr/bin/plutil',['-convert','json','-o','-',file],{encoding:'utf8'})):{};
  values.CFBundleName='Mouse';values.CFBundleDisplayName='Mouse';
  fs.writeFileSync(file,JSON.stringify(values));
  cp.execFileSync('/usr/bin/plutil',['-convert','binary1',file]);
 }
}
module.exports={localizeMacName};
