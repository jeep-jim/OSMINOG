'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,pkg=require('./package.json'),lock=require('./package-lock.json');
const pins={'@xterm/xterm':'6.0.0','chrome-remote-interface':'0.33.3','node-pty':'1.1.0','ws':'8.23.0','@modelcontextprotocol/sdk':'1.32.2','fs-extra':'11.4.1','chokidar':'4.0.3'};
for(const [name,version]of Object.entries(pins)){
 if(pkg.dependencies[name]!==version||lock.packages['node_modules/'+name]?.version!==version||require(path.join(root,'node_modules',name,'package.json')).version!==version)throw Error('Agent dependency mismatch: '+name);
}
for(const name of ['@modelcontextprotocol/sdk/client/index.js','@modelcontextprotocol/sdk/server/index.js','fs-extra','chokidar'])require('./deps.cjs')(name);
const out=path.join(root,'../mouse/agent-vendor');fs.mkdirSync(out,{recursive:true});
for(const [src,dst]of [['lib/xterm.js','xterm.js'],['css/xterm.css','xterm.css'],['LICENSE','LICENSE.txt']])fs.copyFileSync(path.join(root,'node_modules/@xterm/xterm',src),path.join(out,dst));
if(process.platform==='darwin'){
 const dir=path.join(root,'node_modules/node-pty/prebuilds/darwin-'+process.arch),helper=path.join(dir,'spawn-helper');if(fs.existsSync(helper))fs.chmodSync(helper,0o755);
}
if(process.platform==='win32'){
 if(process.arch!=='x64')throw Error('Mouse Windows runtime requires x64');
 const dir=path.join(root,'node_modules/node-pty/prebuilds/win32-x64');
 for(const file of ['conpty.node','conpty/conpty.dll','conpty/OpenConsole.exe'])if(!fs.existsSync(path.join(dir,file)))throw Error('Windows terminal runtime missing: '+file);
}
if(['darwin','win32'].includes(process.platform))require('./deps.cjs')('node-pty');
console.log('MOUSE_622_AGENT_DEPENDENCIES_PREPARED');
