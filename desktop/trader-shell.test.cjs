'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'trader',name),'utf8');

test('Trader OS shell is lightweight, branded and exposes trading, AI and wallet regions',()=>{
 const html=read('index.html'),css=read('trader.css'),js=read('trader.js'),i18n=read('i18n.js'),pkg=require('./package.json'),mark=fs.readFileSync(path.join(__dirname,'..','brand','trader-os-mark.svg'),'utf8');
 assert.match(html,/<title>Trader OS<\/title>/);assert.doesNotMatch(html,/OSMINOG|Осьминог/i);
 for(const id of ['grid','tabstrip','ai-panel','wallet-panel','update-dialog','update-progress'])assert.match(html,new RegExp(`id="${id}"`));
 for(const layout of ['1','2','4','6'])assert.match(css,new RegExp(`data-layout="${layout}"`));
 assert.match(js,/context-scope/);assert.match(js,/Trader OS холст отключён/);
 assert.match(js,/native\.checkUpdate\(\)/);assert.match(js,/native\.downloadUpdate\(\)/);assert.match(js,/native\.installUpdate\(\)/);assert.match(js,/native\.onUpdate/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);assert.match(css,/data-theme="light"/);assert.match(html,/class="brand-version"/);assert.match(html,/id="theme-button"/);assert.match(html,/id="language-dialog"/);assert.match(html,/id="help-dialog"/);
 assert.match(i18n,/54 locales/);assert.match(i18n,/const catalogs=\{en,ru,de,es,fr,pt,ar,zh,ja,ko\}/);assert.match(js,/traderPreferences/);assert.match(js,/helpSeenV501/);
 assert.match(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),/setPath\('userData',path\.join\(app\.getPath\('appData'\),'OSMINOG Preview'\)\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),/titleBarStyle:'hidden'/);assert.match(fs.readFileSync(path.join(__dirname,'preload.cjs'),'utf8'),/setTheme:theme=>ipcRenderer\.invoke\('window:theme',theme\)/);
 assert.match(html,/rel="icon"[^>]+trader-os\.svg/);assert.match(mark,/#55D48F/);assert.match(mark,/#F9697C/);assert.doesNotMatch(mark,/#5d7cff/i);
 assert.equal(pkg.build.productName,'Trader OS');assert(pkg.build.files.includes('trader/**/*'));assert(pkg.build.files.includes('wallet-vault.cjs'));
});
