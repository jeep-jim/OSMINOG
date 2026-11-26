'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname;
const retiredFiles=['agent-tools.cjs','mcp-host.cjs','mcp-stdio.cjs','mcp-smoke.cjs','orchestrator.cjs','orchestrator-smoke.cjs','direct-chat.cjs','original-actions.cjs','action-policy.cjs','control.cjs','control-plan.cjs','provider.cjs','session-transport.cjs','module-transport.cjs','browser-context.cjs'];

test('the Mouse startup dependency graph contains no Agent runtime, connector or model worker',()=>{
 const seen=new Set(),pending=['mouse-main.cjs','mouse-preload.cjs','mouse-page-preload.cjs'];
 while(pending.length){
  const name=pending.pop();if(seen.has(name))continue;seen.add(name);
  assert.ok(!name.startsWith('mouse-agent/'),name);assert.ok(!retiredFiles.includes(name),name);
  const source=fs.readFileSync(path.join(root,name),'utf8');
  assert.doesNotMatch(source,/mouse:agent(?:-state|-open)?|mouse:terminal-data|AgentHost|AgentConversation|McpManager/,'retired capability in '+name);
  for(const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){
   const dependency=match[1];assert.doesNotMatch(dependency,/^(?:node-pty|chrome-remote-interface|@modelcontextprotocol\/)/,name);
   if(!dependency.startsWith('./')||/\.node$/.test(dependency))continue;
   const relative=path.relative(root,path.resolve(root,path.dirname(name),dependency));
   // Installed CI harnesses are verified separately from normal startup.
   if(/smoke|\.test\./.test(relative)||!/[.](?:cjs|js)$/.test(relative))continue;
   assert.ok(fs.existsSync(path.join(root,relative)),'missing runtime dependency '+relative);pending.push(relative);
  }
 }
 assert.ok(seen.has('browser.cjs'));assert.ok(seen.has('mouse-install-update.cjs'));
 assert.ok(seen.has('mouse-progress-bridge.cjs'));assert.ok(seen.has('mouse-capture-archive.cjs'));
 assert.equal(fs.existsSync(path.join(root,'mouse-agent')),false);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'mouse-main.cjs'),'utf8'),/agentHost|utilityProcess|mouse-agent/);
});

test('the actual shell preload exposes browser APIs without Agent, terminal or connector capabilities',async()=>{
 const exposed=[],calls=[],listeners=[];
 vm.runInNewContext(fs.readFileSync(path.join(root,'mouse-preload.cjs'),'utf8'),{
  process:{isMainFrame:true,platform:'linux',arch:'x64',argv:[]},
  require(name){assert.equal(name,'electron');return{
   contextBridge:{exposeInMainWorld:(name,api)=>exposed.push({name,api})},
   ipcRenderer:{invoke:async(...args)=>{calls.push(args);return{ok:true};},on:(...args)=>listeners.push(args),removeListener(){}}
  };}
 },{timeout:1000});
 assert.deepEqual(exposed.map(item=>item.name),['MouseNative']);const api=exposed[0].api;
 for(const name of ['agent','onAgent','onTerminal','onAgentOpen','mediaPlayer','onMediaPlayer'])assert.equal(Object.hasOwn(api,name),false,name);
 for(const name of ['browser','update','progress','archive','library','extensions','adBlockExceptions','pageArrange'])assert.equal(typeof api[name],'function',name);
 await api.browser('state');await api.update('state');await api.progress('state');
 assert.deepEqual(calls.map(call=>call[0]),['mouse:browser','mouse:update','mouse:progress']);
 assert.equal(listeners.length,0);assert.equal(Object.isFrozen(api),true);
});

test('all Mouse packages omit retired Agent code, dependencies and vendor assets',()=>{
 for(const config of ['mouse-build.cjs','mouse-windows-build.cjs','mouse-linux-build.cjs']){
  const build=require('./'+config),files=build.files.filter(file=>typeof file==='string'&&!file.startsWith('!'));
  for(const retired of retiredFiles)assert.ok(!files.includes(retired),config+': '+retired);
  assert.ok(!files.some(file=>/^(?:mouse-agent|runtime-chat)\//.test(file)),config);
  assert.deepEqual(build.extraResources,[],config+' must not bundle a private Agent runtime');
  assert.doesNotMatch(build.extraMetadata.description,/agent/i);
  for(const retained of ['browser.cjs','mouse-main.cjs','mouse-preload.cjs','mouse-update.cjs','mouse-install-update.cjs','mouse-progress.cjs','mouse-capture-archive.cjs'])assert.ok(files.includes(retained),retained);
  if(config==='mouse-build.cjs')assert.ok(!build.asarUnpack.includes('mouse-platform.node'));
  else assert.ok(files.includes('mouse-platform.node'));
 }
 for(const name of fs.readdirSync(path.join(root,'mouse'),{recursive:true}))assert.doesNotMatch(name,/(?:^|\/)agent(?:-|\/)/,'retired renderer asset '+name);
});

test('the shared native boundary retains browser functions without Agent file-write or PTY exports',()=>{
 const windows=fs.readFileSync(path.join(root,'mouse-native/platform-windows.cc'),'utf8'),linux=fs.readFileSync(path.join(root,'mouse-native/platform-linux.cc'),'utf8');
 const names=[...windows.matchAll(/\{"([^"]+)",nullptr,/g)].map(match=>match[1]);
 assert.deepEqual(names,['openRoot','openRead','primaryDown','paneCorners','paneCornersState','launchUpdateHelper','updateHelperStatus','stopUpdateHelper','releaseUpdateHelper']);
 for(const source of [windows,linux])assert.doesNotMatch(source,/ownProcess|stopProcessTree|openTemp|write_file|mouse-local-|MCP|node-pty/);
 assert.match(windows,/FILE_FLAG_OPEN_REPARSE_POINT/);assert.match(windows,/regular\(stat\)/);
 assert.match(linux,/XQueryPointer/);assert.match(linux,/installMouseLinuxPaneCorners/);
});
