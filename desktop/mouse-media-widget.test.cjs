'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {mediaWidgetMode}=require('./mouse/media-widget.js');
test('keeps player identity across the source desk and compact view elsewhere',()=>{
 const p={id:'media-1',tabId:'tab-3',originDeskId:'desk-1'};
 assert.equal(mediaWidgetMode(p,'desk-1'),'full');
 assert.equal(mediaWidgetMode(p,'desk-2'),'compact');
 assert.equal(mediaWidgetMode(p,'desk-3',true),'hidden');
 assert.equal(mediaWidgetMode(null,'desk-1'),'hidden');
 assert.equal(p.tabId,'tab-3');
});
test('UI uses existing tab activation, stable owner id, and never uses network or capture',()=>{
 const root=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
 const shell=root('mouse/browser.js'),widget=root('mouse/media-widget.js');
 assert.match(shell,/returnToTab:activateDesktopTab/);
 assert.match(shell,/mediaWidget\?\.render\(\)/);
 assert.match(widget,/N\.mediaPlayer\(action,\{id,\.\.\.args\}\)/);
 assert.doesNotMatch(widget,/fetch\(|captureStream\(|getDisplayMedia\(/);
});
