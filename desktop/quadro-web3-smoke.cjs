'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {dialog}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<250;i++){if(await fn())return;await sleep(70);}throw Error('Timed out '+label);}
module.exports=async({app,win,browser,web3Service})=>{
 const js=s=>win.webContents.executeJavaScript(s),{vault,engine}=web3Service;
 const click=async selector=>{const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(140);};
 await js('QuadroTest.action("wallet")');await until(()=>js('document.querySelector("#web3-dialog").open'),'wallet UI');
 assert.equal(vault.state().exists,false);
 await click('#web3-password');win.webContents.insertText('only-CI-test-password-605');
 await click('#web3-accept');await click('#web3-submit');await until(()=>vault.state().exists,'create encrypted wallet from UI');
 assert.equal(vault.state().locked,false);const data=await fs.readFile(vault.file,'utf8');assert.ok(!data.includes(vault.wallet.privateKey.slice(2)));assert.ok(!data.includes('only-CI-test-password-605'));
 const file=path.join(app.getPath('userData'),'test-wallet-encrypted-backup.json');
 const save=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:file});
 try{await click('#web3-backup');await until(()=>vault.state().backedUp,'encrypted wallet backup');}finally{dialog.showSaveDialog=save;}
 assert.equal(await fs.readFile(file,'utf8'),data);await click('#web3-close');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/child'?'<html><body>Unprivileged child frame</body></html>':'<!doctype html><title>Web3 local test</title><h1>Wallet integration fixture</h1><iframe src="/child"></iframe>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const address=vault.state().address,url='http://127.0.0.1:'+server.address().port+'/dapp';
 let approves=0;const approve=engine.approve;engine.approve=async info=>{assert.equal(info.origin,new URL(url).origin);approves++;return true;};
 try{
  await js(`QuadroTest.openPage(${JSON.stringify(url)})`);await until(()=>[...browser.tabs.values()].some(t=>t.visible&&t.view.webContents.getURL()===url&&!t.loading),'dapp fixture');
  const page=[...browser.tabs.values()].find(t=>t.view.webContents.getURL()===url).view.webContents;
  await until(()=>page.executeJavaScript('!!window.ethereum?.isQuadro'),'provider injection');
  assert.equal(await page.executeJavaScript('typeof window.QuadroNative'),'undefined');
  assert.equal(await page.executeJavaScript('typeof document.querySelector("iframe").contentWindow.ethereum'),'undefined');
  assert.equal(await page.executeJavaScript('ethereum.request({method:"eth_chainId"})'),'0xaa36a7');
  assert.deepEqual(await page.executeJavaScript('ethereum.request({method:"eth_accounts"})'),[]);
  assert.deepEqual(await page.executeJavaScript('ethereum.request({method:"eth_requestAccounts"})'),[address]);assert.equal(approves,1);
  const signature=await page.executeJavaScript(`ethereum.request({method:'personal_sign',params:['0x71756164726f',${JSON.stringify(address)}]})`);assert.match(signature,/^0x[0-9a-f]{130}$/i);assert.equal(approves,2);
  assert.equal(await page.executeJavaScript('ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1"}]}).then(()=>0,e=>e.code)'),4902);
  assert.equal(await page.executeJavaScript('ethereum.request({method:"eth_sign",params:[]}).then(()=>0,e=>e.code)'),4200);
  const announced=await page.executeJavaScript(`new Promise(resolve=>{window.addEventListener('eip6963:announceProvider',e=>resolve(e.detail.info.name),{once:true});window.dispatchEvent(new Event('eip6963:requestProvider'));setTimeout(()=>resolve('missing'),2000)})`);assert.equal(announced,'Mouse Wallet · Sepolia');
  engine.lock();assert.deepEqual(await page.executeJavaScript('ethereum.request({method:"eth_accounts"})'),[]);
  console.log('QUADRO_WEB3_ENCRYPTED_VAULT_DAPP_ORIGIN_APPROVAL_SIGN_TESTNET_PASS');
 }finally{engine.approve=approve;engine.lock();await new Promise(r=>server.close(r));}
};
