'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {safeURL,maybeURL,validateSyncState}=require('./mouse-sync-schema.cjs');
const {exportWorkspace,importWorkspace,PROJECT}=require('./mouse-config-sync.cjs');
const H=require('../services/mouse-identity/test/helpers.cjs');
const PRIVATE_URLS=[
 'https://login.example/callback?code=private-code&state=private-state',
 'https://example.test/?CoDe=private-code&STATE=private-state',
 'https://example.test/cb?code=private-code',
 'https://example.test/%63allback?%63ode=private-code',
 'https://example.test/#/signin-oidc?code=private-code',
 'https://example.test/#/welcome?code=private-code&state=private-state',
 'https://example.test/#token=private-token',
 'https://example.test/#%61ccess%5ftoken=private-token&token_type=bearer',
 'https://example.test/#/view?REFRESH-TOKEN=private-token',
 'https://example.test/#id_token=private-token',
 'https://example.test/?api_key=private-key',
 'https://example.test/?client_secret=private-key',
 'https://example.test/?code_verifier=private-pkce-proof',
 'https://example.test/?SAMLResponse=private-assertion',
 'https://files.example/object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=private-identity&X-Amz-Signature=private-signature',
 'https://files.example/object?X-Amz-Security-Token=private-token',
 'https://files.example/object?AWSAccessKeyId=private-key&Expires=123&Signature=private-signature',
 'https://files.example/object?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=private-identity&X-Goog-Signature=private-signature',
 'https://files.example/object?GoogleAccessId=private-key&Expires=123&Signature=private-signature',
 'https://account.blob.core.windows.net/container/object?sv=2025-07-05&sr=b&sp=r&se=2026-12-01&sig=private-signature',
 'https://files.example/object?%58-Amz-%53ignature=private-signature'
];
test('credential queries, OAuth callbacks, signed object URLs and decoded fragment keys never become sync URLs',()=>{
 for(const url of PRIVATE_URLS){assert.equal(maybeURL(url),'',url);assert.throws(()=>safeURL(url),{code:'SYNC_FORMAT'},url);}
});
test('ordinary document anchors, product codes and public cloud URLs retain their exact URL meaning',()=>{
 for(const url of ['https://example.test/docs#authentication','https://example.test/products?code=product-42&sort=name','https://example.test/search?state=California&q=token','https://example.test/#/view?item=42','https://account.blob.core.windows.net/public/photo.jpg','https://files.example/report?Expires=123','https://example.test/callback-help?code=product-42'])assert.equal(safeURL(url),new URL(url).href,url);
 assert.equal(safeURL('mouse://start',true),'mouse://start');assert.equal(safeURL('about:blank',true),'about:blank');
});
test('excluded credential tabs and bookmarks stay local through import without entering outbound state',()=>{
 const tabs=PRIVATE_URLS.map(url=>({id:randomUUID(),url,lane:'main'})),bookmarks=PRIVATE_URLS.map((url,i)=>({id:'private-bookmark-'+i,url,title:'Local link '+i,at:1}));
 const local={browserSessions:{[PROJECT]:tabs},quadroLibrary:{bookmarks,downloads:[{path:'/private/local-file'}]},quadroPreferences:{theme:'light'}};
 const outgoing=exportWorkspace(local);assert.deepEqual(outgoing.tabs,[]);assert.deepEqual(outgoing.bookmarks,[]);assert.doesNotMatch(JSON.stringify(outgoing),/private-(?:code|state|token|key|identity|signature|assertion|pkce)/);
 const remote=exportWorkspace({quadroPreferences:{theme:'dark'},quadroLibrary:{bookmarks:[{id:'public-bookmark',url:'https://example.test/docs',title:'Public',at:2}]}}),imported=importWorkspace(local,remote);
 assert.deepEqual(imported.browserSessions[PROJECT],tabs);assert.deepEqual(imported.quadroLibrary.bookmarks.filter(row=>row.id.startsWith('private-')),bookmarks);assert.deepEqual(imported.quadroLibrary.downloads,local.quadroLibrary.downloads);
 const again=exportWorkspace(imported);assert.deepEqual(again.tabs,[]);assert.deepEqual(again.bookmarks,remote.bookmarks);assert.equal(again.preferences.theme,'dark');
});
test('shared schema rejects direct credential injection in every URL-bearing sync field',()=>{
 for(const url of PRIVATE_URLS)for(const field of ['tab','bookmark','aiSite','aiSession','layoutAlternative']){
  const state=H.state(),layout=state.desktops.items[0].layout,tabId=state.tabs[0].id;
  if(field==='tab')state.tabs[0].url=url;
  if(field==='bookmark')state.bookmarks[0].url=url;
  if(field==='aiSite')state.preferences.aiSites=[{name:'Private',url}];
  if(field==='aiSession')layout.aiSessions={[url]:tabId};
  if(field==='layoutAlternative')state.layoutAlternatives=[{id:'alternative',desktopId:state.desktops.active,layout:{...layout,aiSessions:{[url]:tabId}}}];
  assert.throws(()=>validateSyncState(state),{code:'SYNC_FORMAT'},field+': '+url);
 }
});
test('actual identity service refuses credential URLs and never persists a rejected sync revision',async t=>{
 const f=H.setup(t),session=await H.register(f),auth=H.auth(f,session);
 for(const url of PRIVATE_URLS){const state=H.state();state.tabs[0].url=url;assert.throws(()=>f.service.syncPut(auth,{revision:0,state}),{code:'SYNC_INVALID'});assert.deepEqual(f.service.syncGet(auth),{revision:0,state:null,updatedAt:null});}
 const accepted=f.service.syncPut(auth,{revision:0,state:H.state()});assert.equal(accepted.revision,1);assert.equal(f.service.syncGet(auth).revision,1);
});
