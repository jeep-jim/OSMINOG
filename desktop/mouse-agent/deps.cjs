'use strict';
const path=require('node:path'),fs=require('node:fs');
module.exports=name=>{
 const packaged=process.resourcesPath&&path.join(process.resourcesPath,'mouse-agent-node_modules',name);
 return require(packaged&&fs.existsSync(packaged)?packaged:path.join(__dirname,'node_modules',name));
};
