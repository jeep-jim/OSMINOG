'use strict';
// Current637 removal acceptance. Historical installed636 acceptance is separate.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {pageHTML,sha256}=require('./mouse-631-smoke-helpers.cjs');
const {CONTRACT,REPORT,SELECTORS,APP_PATHS,RESOURCE_PATHS,CODE_PATHS,CODE_EVIDENCE,AI_CATALOG,removalReadback,assertReadback,assertPackage,assertPageCookie}=require('./mouse-637-agent-removal-contract.cjs');
async function packagedEvidence(app){
 const appPath=app.getAppPath(),resourcesPath=process.resourcesPath;
 const exists=async filename=>{try{await fs.stat(filename);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
 const paths=[];for(const [root,base,names]of [['app',appPath,APP_PATHS],['resources',resourcesPath,RESOURCE_PATHS]])for(const name of names)paths.push({root,path:name,exists:await exists(path.join(base,name))});
 const forbiddenPatterns=['mouse-agent/','mouse:agent','MouseAgent','node-pty','@modelcontextprotocol/sdk','@xterm/'];
 const code=[];for(const name of CODE_PATHS){const raw=await fs.readFile(path.join(appPath,name)),source=raw.toString('utf8');const evidenceFile=CODE_EVIDENCE[CODE_PATHS.indexOf(name)];await fs.writeFile(evidenceFile,raw);code.push({path:name,evidenceFile,bytes:raw.length,sha256:sha256(raw),forbidden:forbiddenPatterns.filter(token=>source.includes(token))});}
 const value={appPath,resourcesPath,paths,code};assertPackage(value);return value;
}
module.exports=async function verifyAgentRemoval(ctx,{fixture,click,screenCapture}){
 const {app,win}=ctx,started=Date.now(),originalTheme=await fixture.js('MouseTest.model.theme');
 const facts={schema:1,contract:CONTRACT,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,
  source:'Installed package paths and executable bytes, actual shell/preload readbacks and retained owned native pages',physicalUserDeviceVerified:false,ok:false,restored:false,
  runtime:{contextHasAgentHost:Object.hasOwn(ctx,'agentHost'),contextAgentHostType:typeof ctx.agentHost},themes:[],captures:[]};
 let server,error;
 try{
  assert.equal(facts.version,'6.0.39');assert.equal(facts.packaged,true);assert.equal(facts.runtime.contextHasAgentHost,false);assert.equal(facts.runtime.contextAgentHostType,'undefined');
  facts.package=await packagedEvidence(app);
  server=http.createServer((req,res)=>{const route=/^\/page\/(201|202)\/$/.exec(new URL(req.url,'http://127.0.0.1').pathname);if(!route){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(pageHTML(Number(route[1])));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});facts.fixtureOrigin='http://127.0.0.1:'+server.address().port;
  const records=[];for(const index of [201,202])records.push(await fixture.open(facts.fixtureOrigin+'/page/'+index+'/',index));await fixture.setLayout(records);
  facts.pages={before:await Promise.all(records.map(fixture.identity)),after:[]};
  for(let i=0;i<records.length;i++)assertPageCookie(facts.pages.before[i],facts.fixtureOrigin,records[i].index);
  facts.pageAPIs=[];for(const record of records)facts.pageAPIs.push({tabId:record.id,...await fixture.pageJS(record,'({mouseAgentType:typeof globalThis.MouseAgent,progressType:typeof globalThis.browser?.setProgress})')});
  for(const page of facts.pageAPIs){assert.equal(page.mouseAgentType,'undefined');assert.equal(page.progressType,'function');}
  for(const theme of ['light','dark']){
   if(await fixture.js('MouseTest.model.theme')!==theme)await click('#theme-button');await fixture.until(()=>fixture.js(`MouseTest.model.theme===${JSON.stringify(theme)}`),'637 removal theme '+theme);
   await click('#settings-button');await fixture.until(()=>fixture.js('MouseTest.settingsUI.isOpen()'),'637 removal browser settings');
   const read=await fixture.js(`(${removalReadback.toString()})(${JSON.stringify(SELECTORS)})`);assertReadback(read);
   const native=records.map(fixture.nativeState);assert.ok(native.every(row=>row.visible&&row.cachedVisible&&row.parentVisible&&row.attached));
   const capture=await screenCapture('mouse-637-agent-removed-'+theme+'.png','agent removed '+theme);facts.themes.push({...read,native,capture:capture.filename});facts.captures.push(capture.filename);
   await click('#settings-dialog [data-close-dialog]');await fixture.until(()=>fixture.js('!MouseTest.settingsUI.isOpen()'),'637 removal settings closes');
  }
  facts.pages.after=await Promise.all(records.map(fixture.identity));for(let i=0;i<records.length;i++){assertPageCookie(facts.pages.after[i],facts.fixtureOrigin,records[i].index);fixture.assertIdentity(facts.pages.before[i],facts.pages.after[i]);}
 }catch(cause){error=cause;facts.error={message:cause.message,stack:cause.stack};}
 finally{
  try{if(await fixture.js('MouseTest.model.theme')!==originalTheme)await click('#theme-button');await fixture.until(()=>fixture.js(`MouseTest.model.theme===${JSON.stringify(originalTheme)}`),'637 removal original theme');facts.restored=true;}catch(cause){facts.cleanupError=cause.message;error||=cause;}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  facts.elapsedMs=Date.now()-started;facts.ok=!error&&facts.restored;await fs.writeFile(REPORT,JSON.stringify(facts,null,2)+'\n');
 }
 if(error)throw error;console.log('MOUSE_637_AGENT_REMOVAL_PASS');return{...facts,reportFile:REPORT,reportSha256:sha256(await fs.readFile(REPORT))};
};
module.exports.packagedEvidence=packagedEvidence;
