'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
for(const p of ["room.html","room.css","room.js","room-model.js","room-software-renderer.js","osminog-room-entry.js","vendor/three.min.js","vendor/THREE_LICENSE.txt","osminog-space-model.js","osminog-space.js","osminog-space.css","osminog-animation-studio.js","osminog-animation-studio.css"])assert(!fs.existsSync(p),p+' must be removed');
const html=fs.readFileSync('editor.html','utf8');assert(!/osminog-(?:space|room|animation)/.test(html));assert(html.includes('osminog-photo-editor.js'));assert(html.includes('osminog-graphics-studio.js'));
console.log('PASS retired feature files and entrypoints removed; photo and vector editing retained');
