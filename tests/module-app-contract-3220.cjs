"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const source=fs.readFileSync("gpt-presence.js","utf8");
assert.match(source,/explicitAppRequest=/);
assert.match(source,/appBuild=\(appVerb&&appNoun\|\|explicitAppRequest\)&&!visualMock/);
assert.match(source,/Never ask for, mention, or wait for module_create, module_update, module_id/);
assert.match(source,/const tool=updateId\?"module_update":"module_create",result=await B\.executeTool/);
assert.match(source,/if\(task\.execution==="app"&&!task\.moduleResult&&extractWorkspaceHtml\(visible\)\)/);
console.log("OSMINOG module app contract: PASS");
