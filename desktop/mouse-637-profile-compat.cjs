'use strict';
// Acceptance-only629 →637 schema expectation. Never normalize the observed
// preferences or fill omissions during a same-version637 restart.
const assert=require('node:assert/strict');
function expectedProfilePreferences(record,currentVersion){
 const saved=structuredClone(record.preferences);
 return record.version==='6.0.29'&&currentVersion==='6.0.37'
  ?{agentPreviewId:'',aiPreviewRatio:.5,presetTabs:{},...saved}:saved;
}
function assertProfilePreferences(record,currentVersion,actual){
 assert.deepEqual(actual,expectedProfilePreferences(record,currentVersion),'Reinstalled application preserves exact workspace preferences and declared schema defaults');
}
module.exports={expectedProfilePreferences,assertProfilePreferences};
