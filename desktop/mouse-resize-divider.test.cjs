'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const css = readFileSync(join(__dirname, 'mouse/window-drag.css'), 'utf8');
const rule = selector => css.split(selector + '{')[1]?.split('}')[0] || '';
const active = '.split > .divider:not([data-pinned="true"]):is(:hover,:focus-visible,.dragging)';
test('active split paints a rounded overlay instead of a rectangular accent gutter', () => {
 assert.match(rule(active), /background:var\(--line\);outline:none/);
 assert.match(rule(active + '::before'), /pointer-events:none;.*border-radius:99px;.*background:var\(--accent\)/);
 assert.doesNotMatch(rule(active), /width|height|cursor|pointer-events/);
});
test('both split orientations inset the hover guide and preserve the hit target', () => {
 assert.match(rule('.split > .divider[data-axis="x"]::before'), /inset:min\(12px,20%\) auto;left:50%;width:2px/);
 assert.match(rule('.split > .divider[data-axis="y"]::before'), /inset:auto min\(12px,20%\);top:50%;height:2px/);
 assert.doesNotMatch(css, /\.ai-divider::before/);
});
