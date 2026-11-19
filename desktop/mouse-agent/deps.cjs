'use strict';
const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module');
const allowed=new Set(['chrome-remote-interface','node-pty','ws','fs-extra','chokidar',
 '@modelcontextprotocol/sdk/client/index.js','@modelcontextprotocol/sdk/client/stdio.js',
 '@modelcontextprotocol/sdk/server/index.js','@modelcontextprotocol/sdk/server/stdio.js',
 '@modelcontextprotocol/sdk/types.js']);
module.exports=name=>{
 if(!allowed.has(name))throw Error('Unsupported agent dependency');
 // utilityProcess may not expose resourcesPath; __dirname still points through app.asar.
 const asar=__dirname.split(path.sep+'app.asar'+path.sep)[0];
 const root=process.resourcesPath||(asar!==__dirname?asar:'');
 // Keep the private runtime's actual node_modules directory. SDK package exports
 // and its transitive dependencies must resolve normally, without NODE_PATH or
 // changing global module lookup. The flat layout is only a legacy fallback.
 const packaged=root&&path.join(root,'mouse-agent-node_modules');
 if(packaged&&fs.existsSync(path.join(packaged,'node_modules')))
  return createRequire(path.join(packaged,'runtime.cjs'))(name);
 const legacy=packaged&&path.join(packaged,name);
 if(legacy&&fs.existsSync(legacy))return require(legacy);
 return createRequire(path.join(__dirname,'runtime.cjs'))(name);
};
