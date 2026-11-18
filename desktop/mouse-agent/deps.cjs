'use strict';
const path=require('node:path'),fs=require('node:fs');
const allowed=new Set(['chrome-remote-interface','node-pty','ws']);
module.exports=name=>{
 if(!allowed.has(name))throw Error('Unsupported agent dependency');
 // utilityProcess may not expose resourcesPath; __dirname still points through app.asar.
 const asar=__dirname.split(path.sep+'app.asar'+path.sep)[0];
 const root=process.resourcesPath||(asar!==__dirname?asar:'');
 const packaged=root&&path.join(root,'mouse-agent-node_modules',name);
 return require(packaged&&fs.existsSync(packaged)?packaged:path.join(__dirname,'node_modules',name));
};
