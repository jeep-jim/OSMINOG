'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{Library}=require('./mouse-library.cjs'),{createIcons,iconURL}=require('./mouse-library-icons.cjs');
const create=()=>new Library({get:async()=>({}),set:async()=>{}}).init();
test('select-all applies to every matching page while excludes and active downloads survive',async()=>{
 const lib=await create();for(let n=0;n<205;n++)lib.bookmark('https://example.test/'+n,n<180?'keep-group':'other');
 assert.equal(lib.list('bookmarks','keep-group').items.length,100);assert.equal(lib.list('bookmarks','keep-group').removableTotal,180);
 const excluded=lib.data.bookmarks.find(x=>x.title==='keep-group').id;const ids=lib.selected('bookmarks',{all:true,query:'keep-group',exclude:[excluded]});assert.equal(ids.length,179);
 lib.bookmark('https://example.test/new','keep-group');assert.equal(lib.removeMany('bookmarks',ids),179);assert.equal(lib.data.bookmarks.length,27);assert.ok(lib.data.bookmarks.some(x=>x.id===excluded));
 lib.data.downloads=[{id:'a',state:'progressing'},{id:'b',state:'paused'},{id:'c',state:'completed',path:'/actual/user/file'},{id:'d',state:'interrupted'}];
 assert.deepEqual(lib.selected('downloads',{all:true}),['c','d']);assert.equal(lib.removeMany('downloads',['a','b','c','d']),2);assert.deepEqual(lib.data.downloads.map(x=>x.id),['a','b']);
 assert.throws(()=>lib.selected('bookmarks',{ids:['x'.repeat(101)]}));assert.throws(()=>lib.selected('closed',{all:true}));assert.throws(()=>lib.selected('history',{all:'yes'}));
});
test('observed favicon is retained for exact visited records and saved origin bookmarks only',async()=>{
 const lib=await create();lib.visit('https://example.test/a');lib.bookmark('https://example.test/');lib.bookmark('https://other.test/');lib.favicon('https://example.test/a','https://cdn.test/brand.svg');
 assert.equal(lib.data.history[0].favicon,'https://cdn.test/brand.svg');assert.equal(lib.data.bookmarks[1].favicon,'https://cdn.test/brand.svg');assert.equal(lib.data.bookmarks[0].favicon,undefined);
 lib.favicon('https://example.test/a','file:///private/icon');assert.equal(lib.data.history[0].favicon,'https://cdn.test/brand.svg');assert.equal(iconURL('javascript:alert(1)'),'');assert.equal(iconURL('data:text/html;base64,YQ=='),'');
});
test('library icon loading is restricted to saved websites, queued instead of dropping entries after four',async()=>{
 const lib=await create();let requests=0,active=0,peak=0;for(let n=0;n<10;n++)lib.bookmark('https://host'+n+'.test/');
 const browser={session:{fetch:async url=>{requests++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,3));active--;assert.match(url,/https:\/\/host\d+\.test\/favicon.ico/);return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0h16v16H0z"/></svg>',{headers:{'content-type':'image/svg+xml'}})}}};
 const nativeImage={createFromBuffer:()=>({getSize:()=>({width:0,height:0}),isEmpty:()=>true})};const icons=createIcons({app:{},browser,library:lib,nativeImage});
 assert.equal(await icons.site('https://not-saved.test/'),'');assert.equal(requests,0);
 const data=await Promise.all(lib.data.bookmarks.map(x=>icons.site(x.url)));assert.equal(data.length,10);assert.ok(data.every(x=>x.startsWith('data:image/svg+xml;')));assert.equal(requests,10);assert.ok(peak<=4);await icons.site(lib.data.bookmarks[0].url);assert.equal(requests,10);
 assert.equal(await icons.download('unknown'),'');
});
test('UI has one top toolbar, a count-adjacent show-all, scoped checkboxes and round remove controls',()=>{
 const js=fs.readFileSync('mouse/browsing.js','utf8'),css=fs.readFileSync('mouse/library-view.css','utf8');
 assert.match(js,/library-summary/);assert.match(js,/library-select-all/);assert.match(js,/remove-selected/);assert.match(js,/limit=Math.max\(100,total\)/);assert.match(js,/IntersectionObserver/);assert.doesNotMatch(js,/<footer>/);assert.match(css,/border-radius:50%!important/);assert.match(css,/data-view=grid/);
 const host=fs.readFileSync('mouse-browsing.cjs','utf8');assert.match(host,/const ids=library.selected/);assert.match(host,/dialog.showMessageBox/);assert.doesNotMatch(host,/unlink|rmSync/);
});
