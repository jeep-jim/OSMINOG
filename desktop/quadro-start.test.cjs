'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {bookmarkURL,recentSites}=require('./quadro-start.cjs');
const {Library}=require('./quadro-library.cjs');
test('visual bookmark addresses cannot open privileged schemes',()=>{assert.equal(bookmarkURL('example.com'),'https://example.com/');for(const v of ['file:///etc/passwd','javascript:alert(1)','https://user:pass@example.com','not a url'])assert.throws(()=>bookmarkURL(v));});
test('recent sites come only from real visits, ordered and deduplicated',()=>{assert.deepEqual(recentSites([]),[]);const rows=[{id:'a',url:'https://example.com/new',title:'new'},{id:'b',url:'https://example.com/old'},{id:'c',url:'https://other.test/'},{id:'d',url:'quadro://start'}];assert.deepEqual(recentSites(rows).map(x=>x.id),['a','c']);});
test('bookmark collection survives 1305 additions and restart without trimming',async()=>{let saved={};const store={get:async()=>saved,set:async v=>{saved=structuredClone({...saved,...v});}};const a=await new Library(store).init();for(let n=0;n<1305;n++)a.bookmark('https://example.com/'+n,'Website '+n);await a.flush();const b=await new Library(store).init();assert.equal(b.list('bookmarks').total,1305);assert.equal(b.list('bookmarks','',1300).items.length,5);assert.ok(b.data.bookmarks.some(x=>x.title==='Website 0'));});
