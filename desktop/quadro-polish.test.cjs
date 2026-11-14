'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ChromeReveal}=require('./quadro/chrome-model.cjs'),{classify}=require('./quadro/icon-contrast.js');
test('only transparent monochrome ink is inverted; brand colors remain unchanged',()=>{const pixels=(r,g,b)=>new Uint8ClampedArray([r,g,b,255,r,g,b,150,0,0,0,0]);assert.equal(classify(pixels(0,0,0)),'dark');assert.equal(classify(pixels(255,255,255)),'light');assert.equal(classify(pixels(20,150,70)),'color');assert.equal(classify(new Uint8ClampedArray(12)),'color');});
test('only measured visible system menu reserves space; no synthetic title strip',()=>{const m=new ChromeReveal();assert.equal(m.update({fullscreen:true,menuVisible:false,menuHeight:24}),0);assert.equal(m.update({fullscreen:true,menuVisible:true,menuHeight:24}),24);assert.equal(m.update({fullscreen:true,menuVisible:true,menuHeight:38,contentTopGap:38}),0);assert.equal(m.update({fullscreen:false,menuVisible:true,menuHeight:24}),0);});
