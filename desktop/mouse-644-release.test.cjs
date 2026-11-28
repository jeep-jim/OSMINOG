'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('Mac645 packages the page-theme sandbox helper and local filter fallback with retained native suites',()=>{
 const config=require('./mouse-build.cjs');assert.equal(config.extraMetadata.version,'6.0.45');
 for(const name of ['mouse-page-theme.cjs','mouse-adblock-subscriptions.cjs','mouse-filter-lists/**/*','mouse-644-*.cjs','!mouse-644-*.test.cjs','mouse-643-*.cjs','mouse-642-*.cjs','mouse-641-*.cjs','mouse-639-*.cjs'])assert.ok(config.files.includes(name),name);
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/mouse-macos.yml'),'utf8');
 for(const token of ['sync644','MOUSE_644_SYNC_WRITE_PASS','MOUSE_644_SYNC_NATIVE_PASS','mouse-644-sync-acceptance.json','native644-filter-subscriptions-and-conditional-refresh','native644-page-theme-sync-and-restoration','native644-private-isolation-and-restart','MOUSE_645_REAL_644_TO_645_PROFILE_PASS','MOUSE_645_REAL_644_TO_645_UPDATE_BUTTON_PASS','MOUSE_645_REAL_629_TO_645_REPLACE_RELAUNCH_PROFILE_PASS'])assert.ok(workflow.includes(token),token);
});

test('Mac645 update-button probe uses the accepted published644 source and unchanged updater bytes',()=>{
 const driver=require('../tools/mouse-637-update-button.cjs');
 const receipt=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/desktop/evidence/mouse644-publisher-acceptance.json'),'utf8'));
 const current=driver.versionFor('darwin');assert.equal(current.from,'6.0.44');assert.equal(current.to,'6.0.45');assert.equal(current.source,receipt.source);assert.equal(receipt.ok,true);
 const bytes=fs.readFileSync(path.join(__dirname,'mouse-update.cjs'));
 assert.equal(require('node:crypto').createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),driver.UPDATER_BLOB);
});
