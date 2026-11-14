'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const E=require('./quadro-wallet-deps/node_modules/ethers');
const {Vault,ProviderEngine,CHAIN_HEX,originOf,quantity}=require('./quadro-web3-core.cjs');
test('origin and quantities are bounded and main-frame policy does not accept HTTP sites',()=>{assert.equal(originOf('https://example.org/a'),'https://example.org');assert.throws(()=>originOf('http://example.org'));assert.throws(()=>originOf('file:///tmp/test'));assert.throws(()=>originOf('https://x:y@example.org'));assert.equal(quantity('0x0'),0n);assert.throws(()=>quantity('0x00'));assert.throws(()=>quantity('-5'));});
test('encrypted vault, approvals, real signatures, testnet transaction and navigation cancellation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quadro-vault-test-'));
 try{
  const vault=await new Vault(dir).init();assert.equal(vault.state().exists,false);
  await vault.create('test-only-password-long');const addr=vault.state().address,encrypted=await fs.readFile(vault.file,'utf8');
  assert.ok(E.isAddress(addr));assert.ok(!encrypted.includes(vault.wallet.privateKey.slice(2)));assert.ok(!encrypted.includes(vault.wallet.mnemonic.phrase));
  assert.equal((await fs.stat(vault.file)).mode&0o777,0o600);
  let confirmed=0,allowed=true,nav=0,network=CHAIN_HEX,raw=null;
  const engine=new ProviderEngine({vault,approve:async()=>{confirmed++;return allowed;},rpc:async(method,params)=>{
   if(method==='eth_chainId')return network;if(method==='eth_getTransactionCount')return '0x0';if(method==='eth_estimateGas')return '0x5208';if(method==='eth_gasPrice')return '0x3b9aca00';if(method==='eth_call')return '0x';
   if(method==='eth_sendRawTransaction'){raw=params[0];return E.keccak256(raw);}throw Error('Unexpected '+method);
  }});
  const ctx=()=>{const epoch=nav;return{url:'https://fixture.example/',assert(){if(nav!==epoch)throw Object.assign(Error('Navigation changed'),{code:4100});}}};const req=(method,params=[])=>engine.request(ctx(),{method,params});
  await assert.rejects(()=>req('eth_requestAccounts'),/резервную/);await vault.backup(path.join(dir,'backup.json'));
  assert.deepEqual(await req('eth_accounts'),[]);allowed=false;await assert.rejects(()=>req('eth_requestAccounts'),e=>e.code===4001);assert.equal(engine.grants.size,0);
  allowed=true;assert.deepEqual(await req('eth_requestAccounts'),[addr]);assert.deepEqual(await req('eth_accounts'),[addr]);
  const msg=E.hexlify(E.toUtf8Bytes('Only a local test.'));const sig=await req('personal_sign',[msg,addr]);assert.equal(E.verifyMessage(E.getBytes(msg),sig),addr);
  const typed={domain:{name:'Fixture',version:'1',chainId:11155111,verifyingContract:'0x0000000000000000000000000000000000000001'},types:{Test:[{name:'value',type:'uint256'}]},primaryType:'Test',message:{value:42}};
  const tsig=await req('eth_signTypedData_v4',[addr,typed]);assert.equal(E.verifyTypedData(typed.domain,typed.types,typed.message,tsig),addr);
  const n=confirmed;await assert.rejects(()=>req('eth_signTypedData_v4',[addr,{...typed,domain:{...typed.domain,chainId:1}}]),e=>e.code===4901);assert.equal(confirmed,n);
  await assert.rejects(()=>req('eth_sign',[addr,msg]),e=>e.code===4200);
  const tx={from:addr,to:'0x0000000000000000000000000000000000000002',value:'0x1'};
  const hash=await req('eth_sendTransaction',[tx]);assert.equal(hash,E.keccak256(raw));const parsed=E.Transaction.from(raw);assert.equal(parsed.from,addr);assert.equal(parsed.chainId,11155111n);assert.equal(parsed.value,1n);
  raw=null;network='0x1';await assert.rejects(()=>req('eth_sendTransaction',[tx]),e=>e.code===4901);assert.equal(raw,null);network=CHAIN_HEX;
  engine.approve=async()=>{nav++;return true;};await assert.rejects(()=>req('personal_sign',[msg,addr]),e=>e.code===4100);
  engine.approve=async()=>{engine.lock();return true;};await vault.unlock('test-only-password-long');await assert.rejects(()=>req('personal_sign',[msg,addr]),e=>e.code===4100);
  assert.deepEqual(await req('eth_accounts'),[]);await assert.rejects(()=>vault.unlock('wrong password'),/пароль/);
  const reopened=await new Vault(dir).init();assert.equal(reopened.state().locked,true);assert.equal(reopened.state().address,addr);assert.equal(reopened.state().backedUp,true);await reopened.unlock('test-only-password-long');assert.equal(reopened.wallet.address,addr);
  await assert.rejects(()=>reopened.create('another password'),/существует/);assert.equal(await fs.readFile(reopened.file,'utf8'),encrypted);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
