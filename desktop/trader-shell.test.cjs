'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'trader',name),'utf8');

test('Trader OS shell is lightweight, branded and exposes trading, AI and wallet regions',()=>{
 const html=read('index.html'),css=read('trader.css'),js=read('trader.js'),pkg=require('./package.json'),mark=fs.readFileSync(path.join(__dirname,'..','brand','trader-os-mark.svg'),'utf8');
 assert.match(html,/<title>Trader OS<\/title>/);assert.doesNotMatch(html,/OSMINOG|Осьминог/i);
 for(const id of ['grid','tabstrip','ai-panel','wallet-panel'])assert.match(html,new RegExp(`id="${id}"`));
 for(const layout of ['1','2','4','6'])assert.match(css,new RegExp(`data-layout="${layout}"`));
 assert.match(js,/context-scope/);assert.match(js,/Trader OS холст отключён/);
 assert.match(html,/rel="icon"[^>]+trader-os\.svg/);assert.match(mark,/#55D48F/);assert.match(mark,/#F9697C/);assert.doesNotMatch(mark,/#5d7cff/i);
 assert.equal(pkg.build.productName,'Trader OS');assert(pkg.build.files.includes('trader/**/*'));assert(pkg.build.files.includes('wallet-vault.cjs'));
});
