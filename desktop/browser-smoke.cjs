'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
module.exports=async function smoke(win,browser){
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"frame-ancestors 'none'",'X-Frame-Options':'DENY'});res.end(`<title>Native ${req.url}</title><h1>Native browser fixture ${req.url}</h1><input type="password" value="do-not-share"><textarea>private draft</textarea><a href="/second">Next</a><script>window.fixtureToken=Math.random()</script>`)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function ready(id){const wc=browser.get(id).view.webContents;if(wc.isLoading())await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture load timed out')),15000);wc.once('did-stop-loading',()=>{clearTimeout(timer);resolve()})});return wc}
 try{
  await win.webContents.executeJavaScript('OSMINOGStateReady');
  await win.webContents.executeJavaScript(`(async()=>{if(!state.activeProject)createProject();await OSMINOGNativeBrowser.open(${JSON.stringify(base+'/first')})})()`);
  assert.equal(await win.webContents.executeJavaScript("!!document.querySelector('#native-browser .native-chat #bridgePanel')"),true);
  let s=browser.state();assert.equal(s.tabs.length,1);const first=s.tabs[0].id,wc=await ready(first);
  assert.match(await wc.executeJavaScript('document.body.innerText'),/Native browser fixture/);
  assert.equal(await wc.executeJavaScript('typeof require+":"+typeof OSMINOGNative'),'undefined:undefined');
  const token=await wc.executeJavaScript('window.fixtureToken');
  const ids=[first];for(let i=1;i<4;i++){const t=await browser.command('open',{url:base+'/pane-'+i});ids.push(t.id);await ready(t.id)}
  await win.webContents.executeJavaScript('OSMINOGNativeBrowser.split(4)');
  await new Promise(r=>setTimeout(r,300));assert.equal(browser.panels.filter(p=>ids.includes(p.id)).length,4);
  for(const id of ids){const view=browser.get(id).view;assert(view.getVisible());assert(view.getBounds().width>100);assert(view.getBounds().height>100)}
  const context=await browser.command('context',{ids});assert.equal(context.length,4);assert(context.every(c=>!c.text.includes('private draft')&&!c.text.includes('do-not-share')));
  const shot=await browser.command('capture',{id:first});assert.match(shot.src,/^data:image\/png;base64,/);assert(shot.width>10);
  await fs.writeFile('browser-smoke-four.png',(await win.webContents.capturePage()).toPNG());
  const sources=await require('electron').desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1440,height:960}});
  const composed=sources.find(source=>source.id===win.getMediaSourceId());
  if(!composed||composed.thumbnail.isEmpty())throw Error('Native window screenshot unavailable');
  await fs.writeFile('browser-smoke-native-window.png',composed.thumbnail.toPNG());
  await win.webContents.executeJavaScript('OSMINOGNativeBrowser.canvas()');await new Promise(r=>setTimeout(r,100));assert.equal(browser.panels.length,0);assert.deepEqual(browser.contextIds,ids);assert.equal(await win.webContents.executeJavaScript("!!document.querySelector('#native-browser #bridgePanel')"),false);
  await win.webContents.executeJavaScript('OSMINOGNativeBrowser.open()');assert.equal(await wc.executeJavaScript('window.fixtureToken'),token);
  await browser.command('navigate',{id:first,url:base+'/second'});assert(wc.navigationHistory.canGoBack());await browser.command('back',{id:first});await ready(first);assert.match(wc.getURL(),/first$/);
  await assert.rejects(browser.command('navigate',{id:first,url:'file:///etc/passwd'}));
  const project=browser.project;await browser.command('project',{id:'other-project'});assert.equal(browser.state().tabs.length,0);await assert.rejects(browser.command('capture',{id:first}));await browser.command('project',{id:project});assert.equal(browser.state().tabs.length,4);
  await browser.command('close',{id:ids[3]});assert.equal(browser.state().tabs.length,3);
  console.log('BROWSER_SMOKE_PASS');
 }finally{await new Promise(r=>server.close(r))}
};
