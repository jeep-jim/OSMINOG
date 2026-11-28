'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const badge=require('./mouse/mouse-update-badge.js');
test('the workspace update entry is hidden without a real update and retained through its install lifecycle',()=>{
 const button={dataset:{},style:{setProperty(){}},setAttribute(){}},context={document:{querySelector:s=>s==='#version-button'?button:null},MouseUpdateBadge:badge};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse/mouse-620-ui.js'),'utf8'),context);
 for(const state of [{phase:'idle'},{phase:'checking'},{phase:'current'},{phase:'error',error:'offline'},{phase:'available',availableVersion:'6.0.44'},{phase:'available',availableVersion:'malformed'}]){context.Mouse620UI.renderUpdate(state,'6.0.45');assert.equal(button.hidden,true,JSON.stringify(state));}
 for(const state of [{phase:'available',availableVersion:'6.0.46'},{phase:'error',availableVersion:'6.0.46',error:'retry'},{phase:'downloading',percent:50},{phase:'ready'},{phase:'opened'},{phase:'installing'}]){context.Mouse620UI.renderUpdate(state,'6.0.45');assert.equal(button.hidden,false,JSON.stringify(state));}
 context.Mouse620UI.renderUpdate({phase:'current'},'6.0.46');assert.equal(button.hidden,true);
});
test('the lightning button is inside the library toolbar beside downloads and initially absent version never flashes',()=>{
 const html=fs.readFileSync(path.join(__dirname,'mouse/index.html'),'utf8'),group=html.split('id="footer-library"')[1].split('</div>')[0];assert.match(group,/id="downloads-button"[\s\S]*id="flash-button"[\s\S]*id="screenshot-button"/);assert.match(html,/id="version-button" hidden/);assert.match(html,/src="account-ui.js"[\s\S]*src="settings-panel.js"[\s\S]*src="flash-sidebar.js"[\s\S]*src="browser.js"/);
});
