'use strict';
const base=require('./package.json').build;
const {win,nsis,publish,...shared}=base;
module.exports={
  ...shared,
  extends:null,
  directories:{...base.directories,output:'dist-mac'},
  extraMetadata:{main:'mac-main.cjs',version:'5.0.3'},
  files:[...base.files,'mac-main.cjs','mac-platform.cjs','mac-smoke.cjs','mac-layout-smoke.cjs','mac-updates.cjs'],
  artifactName:'Trader-OS-${version}-mac-${arch}.${ext}',
  publish:null,
  mac:{
    target:[{target:'dmg',arch:['arm64']},{target:'zip',arch:['arm64']}],
    category:'public.app-category.productivity',
    icon:'icons/trader-os-mac.png',
    minimumSystemVersion:'13.0',
    identity:'-',
    hardenedRuntime:true,
    entitlements:'mac-entitlements.plist',
    entitlementsInherit:'mac-entitlements.plist',
    notarize:false
  },
  dmg:{title:'Trader OS — Apple Silicon',sign:false,contents:[{x:150,y:170,type:'file'},{x:410,y:170,type:'link',path:'/Applications'}]}
};
