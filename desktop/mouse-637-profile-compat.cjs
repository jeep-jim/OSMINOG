'use strict';
// Acceptance-only published predecessors →642 schema expectation. The owner's
// explicit Agent removal retires only its layout keys, not pages or other data.
// Never normalize observations or fill omissions during a same-version restart.
const assert=require('node:assert/strict');
function expectedProfilePreferences(record,currentVersion){
 const saved=structuredClone(record.preferences);
 if(!['6.0.44','6.0.45'].includes(currentVersion)||!['6.0.29','6.0.36','6.0.37','6.0.38','6.0.39'].includes(record.version))return saved;
 const expected={settingsWidth:760,...(record.version==='6.0.29'?{aiPreviewRatio:.5,presetTabs:{}}:{}),...saved};
 if(!['6.0.29','6.0.36'].includes(record.version))return expected;
 delete expected.agentOpen;delete expected.agentPreviewId;
 if(expected.mode==='agents')expected.mode='';
 if(expected.presetTabs&&typeof expected.presetTabs==='object')delete expected.presetTabs.agents;
 return expected;
}
function assertProfilePreferences(record,currentVersion,actual){
 assert.deepEqual(actual,expectedProfilePreferences(record,currentVersion),'Reinstalled application preserves exact workspace preferences and declared schema defaults');
}
module.exports={expectedProfilePreferences,assertProfilePreferences};
