'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Mac645 advances independently while paused non-Mac package identities remain642',()=>{
 assert.equal(require('./mouse-build.cjs').extraMetadata.version,'6.0.45');
 assert.equal(require('./mouse-windows-build.cjs').extraMetadata.version,'6.0.42');
 assert.equal(require('./mouse-linux-build.cjs').extraMetadata.version,'6.0.42');
 for(const name of ['mouse-linux.yml','mouse-windows.yml','mouse-windows-update-helper.yml']){
  const text=fs.readFileSync(path.join(__dirname,'../.github/workflows',name),'utf8');assert.doesNotMatch(text,/^  (pull_request|push|schedule):/m);assert.match(text,/^  workflow_dispatch:/m);
  const jobs=text.slice(text.indexOf('\njobs:')).match(/^  [a-z][a-z0-9-]*:\n[^\n]*/gm)||[];assert.ok(jobs.length>0);
  for(const job of jobs)assert.match(job,/\n    if: \$\{\{ false \}\}/);
 }
});
test('Mac645 retains643 native proof and both real feature backends',()=>{
 const files=require('./mouse-build.cjs').files;
 for(const file of ['mouse-643-*.cjs','!mouse-643-*.test.cjs','mouse-search-suggestions.cjs','mouse-address-tools.cjs'])assert.ok(files.includes(file),file);
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/mouse-macos.yml'),'utf8');
 for(const token of ['polish643','MOUSE_643_POLISH_WRITE_PASS','MOUSE_643_POLISH_NATIVE_PASS','MOUSE_645_REAL_644_TO_645_PROFILE_PASS','MOUSE_645_REAL_644_TO_645_UPDATE_BUTTON_PASS','MOUSE_645_REAL_629_TO_645_REPLACE_RELAUNCH_PROFILE_PASS'])assert.ok(workflow.includes(token),token);
});
