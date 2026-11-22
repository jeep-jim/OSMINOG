'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const css = readFileSync(join(__dirname, 'mouse/window-drag.css'), 'utf8');
const rule = selector => css.split(selector + '{')[1]?.split('}')[0] || '';
const active = '.split > .divider:not([data-pinned="true"]):is(:hover,:focus-visible,.dragging)';
test('active split paints a rounded overlay instead of a rectangular accent gutter', () => {
 assert.match(rule(active), /background:var\(--mouse-grid-seam,var\(--line\)\);outline:none/);
 assert.match(rule(active + '::before'), /pointer-events:none;.*border-radius:99px;.*background:var\(--mouse-grid-guide,var\(--accent\)\)/);
 assert.doesNotMatch(rule(active), /width|height|cursor|pointer-events/);
});
test('both split orientations inset the hover guide and preserve the hit target', () => {
 assert.match(rule('.split > .divider[data-axis="x"]::before'), /inset:min\(12px,20%\) auto;left:50%;width:2px/);
 assert.match(rule('.split > .divider[data-axis="y"]::before'), /inset:auto min\(12px,20%\);top:50%;height:2px/);
 assert.doesNotMatch(css, /\.ai-divider::before/);
});

test('dark seam shares a hex color with the native mask, and URLs brighten only on focus', () => {
 const js = readFileSync(join(__dirname, 'mouse/browser.js'), 'utf8');
 assert.match(css, /--mouse-grid-seam:#[a-f\d]{6}/i);
 assert.ok(js.includes("getPropertyValue('--mouse-grid-seam')"));
 assert.match(css, /#workspace :is\(#stage,\.branch,\.split,\.pane,\.mouse-pane-downloads\),\s*html\[data-theme="dark"\] #workspace \.split > \.divider\{background:var\(--mouse-grid-seam\)\}/);
 assert.ok(css.includes('input{color:var(--muted)}'));
 assert.ok(css.includes('input:focus{color:var(--text)}'));
});
test('compact headers use pane height and reshape the real native page slot', () => {
 const js = readFileSync(join(__dirname, 'mouse/browser.js'), 'utf8');
 assert.ok(js.includes("L.minimum({id:'pane-header'},'y')+2"));
 assert.ok(js.includes("paneChromeBounds.observe(pane.querySelector('.page-slot'))"));
 assert.ok(js.includes('paneChromeBounds.disconnect()'));
 assert.ok(css.includes('.pane-head:not(:hover):not(:focus-within)'));
 assert.ok(css.includes('@media (hover:hover) and (pointer:fine)'));
 assert.doesNotMatch(css.split('/* Keep a small real hover strip')[1], /position:absolute|visibility:hidden/);
});
