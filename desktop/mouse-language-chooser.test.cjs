'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mouseInterfaceLanguages,mouseLanguageSearch}=require('./mouse/overlays.js');
test('existing interface locales remain the only selectable choices',()=>{
 const all=mouseInterfaceLanguages();
 assert.deepEqual(all.filter(x=>x.available).map(x=>x.code),['ru','en']);
 assert.equal(new Set(all.map(x=>x.code)).size,all.length);
 assert.ok(all.length>=70);
 assert.ok(all.every(x=>x.label&&x.english));
});
test('includes both common script and region variants',()=>{
 const codes=mouseInterfaceLanguages().map(x=>x.code);
 for(const code of ['zh-Hans','zh-Hant','pt-BR','pt-PT','ar','hi','bn','ja','ko','he','uk','kk','uz','vi','fa','am'])assert.ok(codes.includes(code),code);
});
test('filters by endonym, current English name and tag without touching locale state',()=>{
 assert.equal(mouseLanguageSearch('  Français ')[0].code,'fr');
 assert.equal(mouseLanguageSearch('Francais')[0].code,'fr');
 assert.equal(mouseLanguageSearch('japanese')[0].code,'ja');
 assert.equal(mouseLanguageSearch('العربية')[0].code,'ar');
 assert.equal(mouseLanguageSearch('zh-hant')[0].code,'zh-Hant');
 assert.deepEqual(mouseLanguageSearch('!missing!'),[]);
 assert.ok(mouseInterfaceLanguages().find(x=>x.code==='ja').available===false);
});
