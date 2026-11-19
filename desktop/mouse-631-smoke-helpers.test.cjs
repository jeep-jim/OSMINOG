'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixtureWindowBounds,containsRect,pageHTML}=require('./mouse-631-smoke-helpers.cjs');

test('fixture fits a work area below the old heuristic without changing the actual native minimum',()=>{
 const work={x:-1024,y:24,width:1024,height:672},minimum=[800,600],before=structuredClone({work,minimum});
 const actual=fixtureWindowBounds(work,minimum);
 assert.deepEqual(actual,{x:-1020,y:28,width:1016,height:664});
 assert.ok(containsRect(work,actual));assert.ok(actual.width>=minimum[0]&&actual.height>=minimum[1]);
 assert.deepEqual({work,minimum},before);
});

test('fixture drops only the optional margin when the native minimum exactly fills the work area',()=>{
 assert.deepEqual(fixtureWindowBounds({x:0,y:24,width:800,height:600},[800,600]),{x:0,y:24,width:800,height:600});
 assert.deepEqual(fixtureWindowBounds({x:.25,y:-.25,width:800.75,height:600.75},[800,600]),{x:1,y:0,width:800,height:600});
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:799,height:600},[800,600]),/actual BrowserWindow minimum/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1200,height:599},[800,600]),/actual BrowserWindow minimum/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1000,height:900},[1100,700]),/actual BrowserWindow minimum/);
});

test('fixture keeps the preferred size on large displays and rejects invalid or offscreen geometry',()=>{
 assert.deepEqual(fixtureWindowBounds({x:0,y:0,width:1920,height:1080},[800,600]),{x:4,y:4,width:1200,height:820});
 for(const work of [{x:0,y:0,width:NaN,height:700},{x:0,y:0,width:1000,height:0},{x:Infinity,y:0,width:1000,height:700}])assert.throws(()=>fixtureWindowBounds(work,[800,600]),/finite and positive/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1000,height:700},[800,NaN]),/minimum is available/);
 const outer={x:4,y:28,width:1016,height:664};
 assert.ok(containsRect(outer,{...outer}));
 assert.equal(containsRect(outer,{...outer,y:27}),false);assert.equal(containsRect(outer,{...outer,height:665}),false);
});

test('the unchanged page color regions remain fully visible above the derived native viewport boundary',()=>{
 const css=pageHTML(0).match(/\.region\{([^}]+)\}/)[1],top=Number(css.match(/top:(\d+)px/)[1]),height=Number(css.match(/height:(\d+)px/)[1]);
 assert.equal(top+height,112);assert.equal(height,34);assert.match(css,/width:36%/);
 const region={x:8,y:top,width:36,height};
 assert.ok(containsRect({x:0,y:0,width:100,height:112},region));
 assert.equal(containsRect({x:0,y:0,width:100,height:111},region),false);
});
