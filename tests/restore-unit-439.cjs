'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const context = vm.createContext({console, Blob, Uint8Array, TextEncoder, crypto: webcrypto, setTimeout, atob, btoa});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'osminog-restore-438.js'), 'utf8'), context);
const T = context.OSMINOGRestore438.__test, core = {objectStoreNames: {contains: () => false}};
const plain = value => JSON.parse(JSON.stringify(value));
test('only new Lite theme briefs inherit the theme text color; existing styles and custom backgrounds remain intact', async () => {
  const item = {id: 'new-text', type: 'text', text: 'Created in 4.0.38'};
  const created = await T.mergeObject(core, item);
  assert.equal(created.type, 'brief'); assert.equal(created.themeSurface, true); assert.equal(created.textColor, null);
  const existing = {id: 'styled', type: 'brief', themeSurface: true, textColor: '#202633', fill: '#ffffff'};
  const legacy = await T.mergeObject(core, {...item, id: 'styled', legacySource: 'workspace:desk'}, existing);
  assert.equal(legacy.textColor, '#202633'); assert.equal(legacy.fill, '#ffffff');
  const explicit = await T.mergeObject(core, item, {textColor: '#f7a912'});
  assert.equal(explicit.textColor, '#f7a912');
  const custom = await T.mergeObject(core, item, {fillMode: 'custom', fill: '#ffffff'});
  assert.equal(custom.textColor, '#202633'); assert.equal(custom.fill, '#ffffff');
  const fixed = await T.mergeObject(core, item, {themeSurface: false, fill: '#ffffff'});
  assert.equal(fixed.textColor, '#202633'); assert.equal(fixed.themeSurface, false);
  const unstyledLegacy = await T.mergeObject(core, {...item, legacySource: 'workspace:desk'}, {type: 'brief'});
  assert.equal(unstyledLegacy.textColor, '#202633');
  assert.equal(existing.textColor, '#202633', 'original source style is not changed');
});
test('Lite text edits replace obsolete rich HTML while preserving its original and all unknown style data', async () => {
  const original = {id: 'note', type: 'note', html: '<b>old body</b>', titleHtml: '<i>old title</i>', custom: {nested: 17}};
  const merged = await T.mergeObject(core, {id: 'note', legacySource: 'workspace:desk', type: 'text', text: 'edited in 4.0.38', title: 'new title'}, original);
  assert.equal(merged.type, 'note'); assert.equal(merged.text, 'edited in 4.0.38'); assert.equal(merged.html, undefined);
  assert.equal(merged.titleHtml, undefined); assert.equal(merged.osminogRestore438OriginalHtml, '<b>old body</b>');
  assert.equal(merged.osminogRestore438OriginalTitleHtml, '<i>old title</i>'); assert.deepEqual(plain(merged.custom), {nested: 17});
  assert.equal(original.html, '<b>old body</b>', 'source object is not mutated');
});
test('Lite code edits update the active source file without replacing other files or unknown file properties', async () => {
  const original = {id: 'code', type: 'code', code: 'old code', activeCodeFile: 'main',
    codeFiles: [{id: 'main', name: 'index.html', content: 'old code', custom: 7}, {id: 'css', name: 'style.css', content: 'unchanged'}]};
  const merged = await T.mergeObject(core, {id: 'code', type: 'code', legacySource: 'workspace:desk', text: 'new code'}, original);
  assert.equal(merged.code, 'new code'); assert.equal(merged.codeFiles[0].content, 'new code');
  assert.equal(merged.codeFiles[0].custom, 7); assert.equal(merged.codeFiles[1].content, 'unchanged');
  assert.equal(original.codeFiles[0].content, 'old code');
});
test('unchanged legacy-only HTML and original tool type are not flattened by canonical Lite metadata', async () => {
  const original = {id: 'note', type: 'note', html: '<b>kept body</b>', titleHtml: '<i>kept title</i>', fill: '#ffaa00'};
  const merged = await T.mergeObject(core, {id: 'note', type: 'text', legacySource: 'workspace:desk', text: '', title: ''}, original);
  assert.equal(merged.type, 'note'); assert.equal(merged.html, original.html); assert.equal(merged.titleHtml, original.titleHtml);
  assert.equal(merged.fill, '#ffaa00');
});
test('retry after a committed workspace does not reintroduce obsolete HTML from the immutable detail archive', async () => {
  const original = {id: 'note', type: 'note', text: 'old text', html: '<b>old text</b>', title: 'old title', titleHtml: '<i>old title</i>', custom: {kept: true}};
  const archived = {...original}; delete archived.text;
  const archive = new Blob([JSON.stringify(archived)], {type: 'application/json'});
  const db = {objectStoreNames: {contains: () => false}, transaction() {
    const tx = {abort() {}, objectStore() { return {get() {
      const req = {};
      setImmediate(() => { req.result = {blob: archive}; req.onsuccess(); setImmediate(() => tx.oncomplete?.()); });
      return req;
    }}; }};
    return tx;
  }};
  const item = {id: 'note', type: 'text', legacySource: 'workspace:desk', detailBlobId: 'legacy-detail:note', text: 'new text', title: 'new title'};
  const first = await T.mergeObject(db, item, original), retried = await T.mergeObject(db, item, first);
  assert.equal(retried.text, 'new text'); assert.equal(retried.title, 'new title');
  assert.equal(retried.html, undefined); assert.equal(retried.titleHtml, undefined);
  assert.equal(retried.osminogRestore438OriginalHtml, '<b>old text</b>'); assert.equal(retried.osminogRestore438OriginalTitleHtml, '<i>old title</i>');
  assert.deepEqual(plain(retried.custom), {kept: true}); assert.deepEqual(JSON.parse(await archive.text()), archived);
  const restyled = await T.mergeObject(db, item, {...retried, html: '<em>new text</em>'});
  assert.equal(restyled.html, '<em>new text</em>', 'a deliberately present new rich-text field is retained');
});
test('bounded binary conversion preserves every byte across base64 chunk boundaries', async () => {
  const bytes = Uint8Array.from({length: 200003}, (_, i) => i % 251), blob = new Blob([bytes], {type: 'application/octet-stream'});
  const value = await T.dataURL(blob);
  assert.deepEqual(Buffer.from(value.split(',')[1], 'base64'), Buffer.from(bytes));
  assert.equal(await T.sameInline(value, blob), true);
  bytes[100000] ^= 1;
  assert.equal(await T.sameInline(value, new Blob([bytes], {type: blob.type})), false);
});
test('disk journals respect Core revisions, and proven newer full-UI edits survive a clock rollback', () => {
  const guard = {at: 300, items: new Map([['object', 500]]), folders: new Map([['folder', 400]]), captures: new Set(['old-capture'])};
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'objectPosition', objectId: 'object', at: 499}, 'run'), false);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'position', folderId: 'folder', at: 400}, 'run'), false);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'view', at: 300}, 'run'), false);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'capture', object: {captureId: 'old-capture'}}, 'run'), false);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'objectPosition', objectId: 'object', at: 501}, 'run'), true);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'objectPosition', objectId: 'object', at: 1, restoredRunId: 'run'}, 'run'), true);
  assert.equal(T.shouldApplyAgainst(guard, {kind: 'capture', object: {captureId: 'old-capture'}, at: 1, restoredRunId: 'run'}, 'run'), true);
});
