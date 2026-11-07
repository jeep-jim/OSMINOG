'use strict';
const CACHE='osminog-ocean-shell-0.3.0-pilot.1';
const SHELL=['/','/index.html','/ocean.css','/ocean.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/design/background-fullscreen.svg','/design/star-idle.svg','/design/wordmark.svg','/design/bubble-avatar.svg','/design/eye-original.svg','/design/Group%2026.svg','/design/Group%2027.svg','/design/Group%2028.svg','/design/Group%2029.svg','/design/Group%2030.svg','/design/Star%2035.svg','/design/Vector.svg','/design/Vector-1.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
// No skipWaiting: do not force-reload a chat or replace a draft while typing.
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('osminog-ocean-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname==='/healthz')return;if(!SHELL.some(p=>decodeURI(p)===decodeURI(u.pathname)))return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(r=>r||fetch(e.request))));});
