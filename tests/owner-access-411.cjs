'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const nodes=new Map(),node=s=>{if(!nodes.has(s))nodes.set(s,{hidden:false,value:'',focus(){}});return nodes.get(s)};
 const modal={isConnected:true,querySelector:node,addEventListener(){}};
 const store={briefCraftModulesV1:{github:{token:'fixture-token',connected:true}},osminogOwnerAuthV1:{totpSecret:'JBSWY3DPEHPK3PXP'}};let checks=0;
 const c=vm.createContext({console,TextEncoder,Uint8Array,crypto:crypto.webcrypto,Date,document:{createElement:()=>modal,body:{append(){}},dispatchEvent(){}},CustomEvent:class{},chrome:{storage:{local:{get:async()=>structuredClone(store),set:async v=>Object.assign(store,structuredClone(v))}},runtime:{sendMessage:async()=>{checks++;return{ok:true,name:'jeep-jim',owner:{ok:true,repositories:['jeep-jim/OSMINOG','jeep-jim/OSMINOG-Releases']}}}}}});
 const src=fs.readFileSync('osminog-owner-guard.js','utf8').replace('globalThis.OSMINOGOwnerGuard={require,isUnlocked,lock,ownerToken};','globalThis.OSMINOGOwnerGuard={require,isUnlocked,lock,ownerToken,totp};');vm.runInContext(src,c);
 const pending=c.OSMINOGOwnerGuard.require();await new Promise(r=>setImmediate(r));node('[data-owner-code]').value=await c.OSMINOGOwnerGuard.totp(store.osminogOwnerAuthV1.totpSecret);await node('[data-owner-submit]').onclick();assert.equal(await pending,true);assert.equal(checks,1);assert.equal(store.osminogOwnerGrantV1.verified,true);assert.equal(store.osminogOwnerGrantV1.user,'jeep-jim');
 c.OSMINOGOwnerGuard.lock();const pending2=c.OSMINOGOwnerGuard.require();await new Promise(r=>setImmediate(r));node('[data-owner-token-change]').onclick();node('[data-owner-token]').value='replacement-fixture';await node('[data-owner-submit]').onclick();assert.equal(store.osminogOwnerAuthV1.totpSecret,'JBSWY3DPEHPK3PXP');assert.equal(node('[data-owner-setup-step]').hidden,true);node('[data-owner-cancel]').onclick();assert.equal(await pending2,false);
 const g=fs.readFileSync('gpt-presence.js','utf8'),a=g.indexOf('  function executionMode('),b=g.indexOf('  function visualArtifactProfile',a),ec=vm.createContext({activeThread:()=>null,activeThreadId:"main",pinnedContexts:[]});vm.runInContext(g.slice(a,b),ec);assert.equal(ec.executionMode('А что если я дам доступ к GitHub и мы продолжим разработку OSMINOG? Это возможно?'),'chat');
 console.log('PASS saved-token login refreshes grant, reconnect preserves TOTP, discussion is not a mutation.');
})().catch(e=>{console.error(e);process.exitCode=1});
