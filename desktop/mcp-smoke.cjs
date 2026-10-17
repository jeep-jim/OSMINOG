'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
module.exports=async(win,browser)=>{
 const run=code=>win.webContents.executeJavaScript(code),frame=()=>new Promise(r=>setTimeout(r,150));
 await run('(async()=>{createProject();await OSMINOGNativeBrowser.open()})()');await frame();
 assert.equal(await run("document.querySelectorAll('.native-agent-options [data-mcp-client]').length"),2);
 assert.equal(await run("document.querySelectorAll('.native-side-empty .native-providers img').length"),4);
 await fs.writeFile('shell-smoke-agent-picker.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('[data-mcp-client=codex]').click()");await frame();
 assert(await run("document.querySelector('.native-agent-dialog textarea').value.includes('[mcp_servers.osminog]')"));
 await fs.writeFile('shell-smoke-agent-connect.png',(await win.webContents.capturePage()).toPNG());
 await run("document.querySelector('.native-agent-dialog [data-access]').click()");await frame();assert(browser.mcp.state().enabled);
 await run("document.querySelector('.native-agent-dialog').close();OSMINOGNative.browser('autopilot-config',{autoExecute:true})");
 const site=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><title>MCP fixture</title><body><h1>MCP fixture</h1><label>Search<input type="search" aria-label="Search"></label></body></html>')});await new Promise(r=>site.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,[path.join(__dirname,'mcp-stdio.cjs'),browser.mcp.file],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['pipe','pipe','pipe']});let errors='',buffer='',next=0;const waits=new Map();child.stderr.on('data',c=>errors+=c);child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);waits.get(m.id)?.(m)}});
 const send=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>reject(Error('MCP timeout '+method+' '+errors)),12000);waits.set(id,m=>{clearTimeout(timer);waits.delete(id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')});
 const tool=async(name,args={})=>{const r=await send('tools/call',{name,arguments:args});assert(!r.isError,JSON.stringify(r));return JSON.parse(r.content.find(c=>c.type==='text').text)};
 try{
  assert((await send('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'OSMINOG-installed-smoke',version:'1'}})).capabilities.tools);
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');assert((await send('tools/list')).tools.length>=12);
  const opened=await tool('browser_open',{url:'http://127.0.0.1:'+site.address().port});assert(opened.id);const page=await tool('browser_read',{id:opened.id,includeScreenshot:false});
  const wc=browser.get(opened.id).view.webContents,box=await wc.executeJavaScript("(()=>{const r=document.querySelector('input').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  const clicked=await tool('browser_act',{id:opened.id,snapshot:page.snapshot,actions:[{type:'click',...box}]});
  await tool('browser_act',{id:opened.id,snapshot:clicked.observation.snapshot,actions:[{type:'type',text:'Honda'}]});assert.equal(await wc.executeJavaScript("document.querySelector('input').value"),'Honda');
  const created=await tool('canvas_create',{type:'shape',properties:{x:100,y:100,w:80,h:80,shapeKind:'ellipse',fill:'#ff0000',name:'MCP circle'}});assert(created.ok);assert(await run("objects().some(o=>o.name==='MCP circle')"));
  assert.equal(browser.mcp.state().clients[0].name,'OSMINOG-installed-smoke');
  await tool('write_file',{name:'mcp-test.txt',content:'Written through MCP',mime:'text/plain'});assert(await run("objects().some(o=>o.name==='mcp-test.txt'||o.fileName==='mcp-test.txt')"));
  console.log('INSTALLED_MCP_STDIO_DOM_TYPE_CANVAS_FILE_PASS');
 }finally{child.kill();for(const resolve of waits.values())resolve({error:{message:'Test ended'}});site.closeAllConnections();await new Promise(r=>site.close(r));await browser.mcp.disable()}
 assert.equal(browser.mcp.state().clients.length,0);console.log('MCP_DISABLE_PASS');
};
