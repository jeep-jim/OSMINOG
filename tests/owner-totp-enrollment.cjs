'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const AUTH='osminogOwnerAuthV1',DRAFT='osminogOwnerEnrollmentV1',MODULE='briefCraftModulesV1';
const SOURCE=process.env.OWNER_GUARD_SOURCE||'osminog-owner-guard.js';
const turn=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function fixture(store={[MODULE]:{github:{token:'fixture-token'}}},options={}){
  const nodes=new Map(),node=s=>{if(!nodes.has(s))nodes.set(s,{hidden:false,value:'',textContent:'',disabled:false,focus(){},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}});return nodes.get(s)};
  const modal={isConnected:true,hidden:true,querySelector:node,addEventListener(){}};
  let now=1770000000000,checks=0;
  const context=vm.createContext({console,Uint8Array,TextEncoder,crypto:crypto.webcrypto,
    Date:class extends Date{static now(){return now}},
    navigator:{clipboard:{writeText:async()=>{}},...(options.navigator||{})},
    document:{createElement:()=>modal,body:{append(){}},dispatchEvent(){}},CustomEvent:class{},
    chrome:{storage:{local:{get:async()=>{if(options.read)await options.read();return structuredClone(store)},set:async value=>{Object.assign(store,structuredClone(value))}}},
    runtime:{sendMessage:async()=>{checks++;if(options.github)return options.github();return{ok:true,name:'fixture-owner',owner:{ok:true}}}}}});
  const source=fs.readFileSync(SOURCE,'utf8').replace('globalThis.OSMINOGOwnerGuard={require,isUnlocked,lock,ownerToken};','globalThis.OSMINOGOwnerGuard={require,isUnlocked,lock,ownerToken,totp,verifyCode,bytesToBase32};');
  vm.runInContext(source,context);
  return{guard:context.OSMINOGOwnerGuard,node,modal,store,setTime:t=>now=t,checks:()=>checks};
}
async function ready(f){for(let i=0;i<100;i++){if(f.node('[data-owner-secret]').textContent||!f.node('[data-owner-code-step]').hidden&&f.node('[data-owner-title]').textContent==='Подтверждение владельца')return;await turn()}throw Error('Owner gate not ready')}
// Independent Node HMAC oracle, not the application verifier generating its own inputs.
function otp(secret,time=1770000000000){let bits='';for(const c of secret)bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));const digest=crypto.createHmac('sha1',key).update(counter).digest(),offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')}
test('RFC 6238 SHA-1 vectors, reduced to six digits',async()=>{
  const f=fixture(),secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for(const [seconds,expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']])assert.equal(await f.guard.totp(secret,Math.floor(seconds/30)),expected);
});
test('enrollment key survives cancel and reopen',async()=>{
  const f=fixture(),first=f.guard.require();await ready(f);const secret=f.node('[data-owner-secret]').textContent;
  f.node('[data-owner-cancel]').onclick();assert.equal(await first,false);
  f.node('[data-owner-secret]').textContent='';const second=f.guard.require();await ready(f);
  assert.equal(f.node('[data-owner-secret]').textContent,secret,'the phone must not be paired to a discarded key');
  f.node('[data-owner-code]').value=otp(secret);await f.node('[data-owner-submit]').onclick();assert.equal(await second,true);assert.equal(f.store[AUTH].totpSecret,secret);
});
test('enrollment key survives a new page / extension reload',async()=>{
  const f=fixture(),first=f.guard.require();await ready(f);const secret=f.node('[data-owner-secret]').textContent;f.node('[data-owner-cancel]').onclick();await first;
  const fresh=fixture(f.store),pending=fresh.guard.require();await ready(fresh);assert.equal(fresh.node('[data-owner-secret]').textContent,secret);
  fresh.node('[data-owner-code]').value=otp(secret);await fresh.node('[data-owner-submit]').onclick();assert.equal(await pending,true);
});
test('overlapping owner requests share the same pending gate',async()=>{
  const f=fixture(),a=f.guard.require('first'),b=f.guard.require('second');assert.equal(a,b,'must not replace the first caller or setup key');await ready(f);
  f.node('[data-owner-code]').value=otp(f.node('[data-owner-secret]').textContent);await f.node('[data-owner-submit]').onclick();assert.deepEqual(await Promise.all([a,b]),[true,true]);
});
test('reconnecting GitHub never replaces enrolled Authenticator',async()=>{
  const secret='JBSWY3DPEHPK3PXP',f=fixture({[MODULE]:{github:{token:'fixture-token'}},[AUTH]:{totpSecret:secret}}),pending=f.guard.require();await ready(f);
  f.node('[data-owner-token-change]').onclick();f.node('[data-owner-token]').value='new-fixture';await f.node('[data-owner-submit]').onclick();assert.equal(f.store[AUTH].totpSecret,secret);assert.equal(f.node('[data-owner-setup-step]').hidden,true);
  f.node('[data-owner-code]').value=otp(secret);await f.node('[data-owner-submit]').onclick();assert.equal(await pending,true);
});
test('wrong codes and codes outside the existing one-step window fail',async()=>{
  const f=fixture(),secret='JBSWY3DPEHPK3PXP';for(const delta of [-1,0,1])assert.equal(await f.guard.verifyCode(secret,otp(secret,1770000000000+delta*30000)),true);
  for(const delta of [-3,3])assert.equal(await f.guard.verifyCode(secret,otp(secret,1770000000000+delta*30000)),false);
  const pending=f.guard.require();await ready(f);f.node('[data-owner-code]').value='bad';await f.node('[data-owner-submit]').onclick();assert.equal(f.guard.isUnlocked(),false);assert.equal(f.store[AUTH],undefined);f.node('[data-owner-cancel]').onclick();assert.equal(await pending,false);
});
test('reject extra digits rather than silently truncate; allow grouped paste',async()=>{
  const f=fixture(),secret='JBSWY3DPEHPK3PXP',code=otp(secret);assert.equal(await f.guard.verifyCode(secret,code+'9'),false);assert.equal(await f.guard.verifyCode(secret,code.slice(0,3)+' '+code.slice(3)),true);assert.equal(await f.guard.verifyCode(secret,'x'+code),false);
});
test('closing during GitHub verification cannot unlock later',async()=>{
  const gate=deferred(),secret='JBSWY3DPEHPK3PXP',f=fixture({[MODULE]:{github:{token:'fixture-token'}},[AUTH]:{totpSecret:secret}},{github:()=>gate.promise}),pending=f.guard.require();await ready(f);
  f.node('[data-owner-code]').value=otp(secret);const submitted=f.node('[data-owner-submit]').onclick();for(let i=0;i<100&&f.checks()===0;i++)await turn();assert.equal(f.checks(),1);f.node('[data-owner-cancel]').onclick();assert.equal(await pending,false);gate.resolve({ok:true,owner:{ok:true}});await submitted;assert.equal(f.guard.isUnlocked(),false);
});
test('cancel during initial storage/GitHub work closes all callers',async()=>{
  const delayed=deferred(),f=fixture(undefined,{read:()=>delayed.promise}),a=f.guard.require(),b=f.guard.require();
  f.node('[data-owner-close]').onclick();assert.deepEqual(await Promise.all([a,b]),[false,false]);delayed.resolve();await turn();await turn();assert.equal(f.modal.hidden,true);assert.equal(f.guard.isUnlocked(),false);assert.equal(f.store[AUTH],undefined);
});
test('valid setup code with rejected GitHub never commits enrollment',async()=>{
  let reject=false;const f=fixture(undefined,{github:()=>reject?{ok:true,owner:{ok:false}}:{ok:true,owner:{ok:true}}}),pending=f.guard.require();await ready(f);const secret=f.node('[data-owner-secret]').textContent;
  reject=true;f.node('[data-owner-code]').value=otp(secret);await f.node('[data-owner-submit]').onclick();assert.equal(f.guard.isUnlocked(),false);assert.equal(f.store[AUTH],undefined);assert.equal(f.store[DRAFT].secret,secret);
  reject=false;await f.node('[data-owner-submit]').onclick();assert.equal(await pending,true);assert.equal(f.store[AUTH].totpSecret,secret);assert.equal(f.store[DRAFT],null);
});
test('simultaneous tabs share one persistent draft under Web Locks',async()=>{
  let tail=Promise.resolve();const locks={request:(_name,task)=>{const next=tail.then(task);tail=next.catch(()=>{});return next}},store={[MODULE]:{github:{token:'fixture-token'}}};
  const a=fixture(store,{navigator:{locks}}),b=fixture(store,{navigator:{locks}}),pa=a.guard.require(),pb=b.guard.require();await Promise.all([ready(a),ready(b)]);
  const secret=a.node('[data-owner-secret]').textContent;assert.equal(b.node('[data-owner-secret]').textContent,secret);
  a.node('[data-owner-code]').value=otp(secret);await a.node('[data-owner-submit]').onclick();assert.equal(await pa,true);
  b.node('[data-owner-code]').value=otp(secret);await b.node('[data-owner-submit]').onclick();assert.equal(await pb,true);assert.equal(store[AUTH].totpSecret,secret);
});
test('paste removes whitespace before maxlength can discard a digit',async()=>{
  const f=fixture(),pending=f.guard.require();await ready(f);const secret=f.node('[data-owner-secret]').textContent,code=otp(secret);let prevented=false;
  f.node('[data-owner-code]').onpaste({clipboardData:{getData:()=>code.slice(0,3)+'\u00a0'+code.slice(3)},preventDefault(){prevented=true}});
  assert.equal(prevented,true);assert.equal(f.node('[data-owner-code]').value,code);await f.node('[data-owner-submit]').onclick();assert.equal(await pending,true);
});
test('auth key enrolled in another tab cannot be overwritten by stale setup',async()=>{
  const f=fixture(),pending=f.guard.require();await ready(f);const old=f.node('[data-owner-secret]').textContent;
  f.store[AUTH]={totpSecret:'JBSWY3DPEHPK3PXP'};f.node('[data-owner-code]').value=otp(old);await f.node('[data-owner-submit]').onclick();assert.equal(f.guard.isUnlocked(),false);assert.equal(f.store[AUTH].totpSecret,'JBSWY3DPEHPK3PXP');f.node('[data-owner-close]').onclick();assert.equal(await pending,false);
});
test('session unlock still expires at fifteen minutes',async()=>{
  const secret='JBSWY3DPEHPK3PXP',f=fixture({[MODULE]:{github:{token:'fixture-token'}},[AUTH]:{totpSecret:secret}}),pending=f.guard.require();await ready(f);f.node('[data-owner-code]').value=otp(secret);await f.node('[data-owner-submit]').onclick();assert.equal(await pending,true);
  f.setTime(1770000000000+15*60*1000-1);assert.equal(f.guard.isUnlocked(),true);f.setTime(1770000000000+15*60*1000);assert.equal(f.guard.isUnlocked(),false);
});
