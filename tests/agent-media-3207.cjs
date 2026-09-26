"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const g=fs.readFileSync("gpt-presence.js","utf8"),b=fs.readFileSync("background.js","utf8"),tab=fs.readFileSync("chatgpt-lite-bridge.js","utf8"),css=fs.readFileSync("osminog-product-core-recovery.css","utf8"),m=require("../manifest.json");
assert.ok(["3.20.7","3.20.8","3.20.9","3.21.0","3.21.1","3.21.2","3.21.3","3.21.4","3.21.5","3.21.6","3.21.7","3.21.8","3.21.9","3.23.0","4.0.0","4.0.1","4.0.2","4.0.3"].includes(m.version));
assert.match(g,/function isGeneratedImageAction/);
assert.match(g,/if\(edit&&selfProduct\)return"source"/);
assert.match(g,/execution==="canvas"&&isWebAssetAction/);
assert.match(g,/importGeneratedMedia/);
assert.match(g,/OSMINOG IMAGE GENERATION/);
assert.match(g,/gpt-msg-identity/);
assert.match(b,/media:parsed\.media\|\|\[\]/);
assert.match(tab,/async function assistantImages/);
assert.match(tab,/images,media:images/);
assert.match(css,/stable chat footer and timestamps below avatars/);
assert.match(css,/\.gpt-msg-identity>time/);
console.log("OSMINOG 3.20.7 routing, media and chat layout contracts passed");


