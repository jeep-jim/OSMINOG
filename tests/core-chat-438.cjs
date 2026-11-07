'use strict';
// The real Chromium gate covers IndexedDB migration, exact full-body retention,
// reload, permission UI and bounded DOM. These tests exercise the tool boundary
// and late-response guards without substituting the native history database.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../osminog-core-chat.js');

function fixture() {
  const state = {scope: 'project-a', deskId: 'desk-a', thread: 'main', epoch: 0, disposed: false};
  const scope = {...state, role: 'edit'}, records = new Map([
    ['text-a', {id: 'text-a', deskId: 'desk-a', type: 'brief', name: 'Note', text: 'complete note ' + 'x'.repeat(12000), x: 5, y: 6}],
    ['file-a', {id: 'file-a', deskId: 'desk-a', type: 'image', name: 'Image', assetId: 'blob-a', mime: 'image/png', src: 'secret-data-url'}],
    ['foreign', {id: 'foreign', deskId: 'desk-b', type: 'brief', text: 'different desk secret'}]
  ]);
  const calls = [], proposals = [];
  const api = {getDeskId: () => state.deskId, getDesk: async () => ({id: state.deskId, name: 'Desk'}),
    listItems: async () => [...records.values()].filter(row => row.deskId === state.deskId),
    getItem: async id => { calls.push(['getItem', id]); return records.get(id); },
    getView: () => ({x: 0, y: 0, scale: 1}), revision: () => 7, selectedIds: () => ['text-a'],
    search: async (q, options) => { calls.push(['search', q, options]); return [...records.values()]; },
    createItem: async data => { calls.push(['create', data]); }, patchItem: async (...args) => { calls.push(['patch', ...args]); },
    focusItem: async id => { calls.push(['focus', id]); }};
  const tools = core.createTools({api, history: {page: async () => ({rows: [], next: null, hasMore: false})},
    current: () => state, stage: patch => { proposals.push(patch); return {ok: true, staged: true, applied: false}; }});
  return {state, scope, records, calls, api, tools, proposals};
}

test('history preview bounds text and strips image data while preserving source input', () => {
  const raw = {id: 'legacy', role: 'user', text: 'x'.repeat(30000), at: 123,
    attachments: Array.from({length: 100}, (_, index) => ({name: 'photo-' + index, dataUrl: 'data:image/png;base64,' + 'A'.repeat(40000), unknown: {keep: true}})),
    unknown: {neverRemove: ['original']}};
  const before = structuredClone(raw), preview = core.previewOf(raw, 'scope', 'main', 2);
  assert.equal(preview.text.length, 12000); assert.equal(preview.fullTextChars, 30000);
  assert.equal(preview.attachmentCount, 100); assert.equal(preview.attachments.length, 12);
  assert.ok(JSON.stringify(preview).length < 16000); assert.equal(JSON.stringify(preview).includes('data:image'), false);
  assert.deepEqual(raw, before);
});

test('prompt history is bounded and does not serialize attachments or runtime telemetry', () => {
  const rows = Array.from({length: 100}, (_, id) => ({role: id % 2 ? 'user' : 'assistant', text: 'x'.repeat(20000), at: id, attachments: ['secret']}));
  rows.push({role: 'assistant', text: 'telemetry should not enter a prompt', source: 'progress'});
  const result = core.conversationOf(rows);
  assert.equal(result.reduce((sum, row) => sum + row.text.length, 0), 24000);
  assert.ok(result.length <= 40); assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('telemetry'), false);
});

test('retained tool lease excludes source, browsers, automatic image generation and arbitrary deletion', () => {
  for (const name of ['writeFile', 'delete', 'browser_open', 'source_publish', 'module_create', 'asset_create', 'capture_viewport_image'])
    assert.equal(core.allowedTools('edit').includes(name), false);
  assert.equal(core.allowedTools('view').includes('propose_canvas_patch'), false);
  assert.equal(core.allowedTools('comment').includes('canvas.move'), false);
  assert.equal(core.allowedTools('edit').includes('propose_canvas_patch'), true);
});

test('backend execution contract overrides legacy instructions with exact tools and enforced limits', () => {
  const contract = core.executionContract('edit'), serialized = JSON.stringify(contract);
  assert.deepEqual(contract.tools, core.allowedTools('edit'));
  assert.deepEqual(contract.limits, {callsPerStep: 8, steps: 6, objectsPerRead: 80, textCharsPerRead: 8000,
    patchActions: 20, createdTextChars: 30000, automaticImages: false});
  for (const retired of ['agent_create', 'graphics_create', 'asset_create', 'browser_open', 'module_create', 'source_publish', 'github_commit_files'])
    assert.equal(serialized.includes(retired), false);
  assert.match(contract.instructions, /NOT an applied change/);
  assert.match(contract.instructions, /must press Apply/);
  const external = core.executionContract('view', true);
  assert.equal(external.tools.includes('chat_history_read'), false);
  assert.equal(external.tools.includes('propose_canvas_patch'), false);
  assert.equal(external.limits.steps, 12);
});

test('tool IDs cannot read objects from a different desk even if storage knows them', async () => {
  const f = fixture();
  await assert.rejects(f.tools.execute('read_object_text', {id: 'foreign'}, f.scope), /текущем столе/);
  assert.equal(f.calls.some(call => call[0] === 'getItem'), false);
});

test('read text pages preserve exact offset with an 8000-character maximum', async () => {
  const f = fixture(), result = await f.tools.execute('read_object_text', {id: 'text-a', offset: 5, max_chars: 100000}, f.scope);
  assert.equal(result.text, f.records.get('text-a').text.slice(5, 8005)); assert.equal(result.nextOffset, 8005);
  assert.equal(result.totalChars, f.records.get('text-a').text.length);
});

test('switching desks during an asynchronous read rejects its result', async () => {
  const f = fixture();
  f.api.getItem = async id => { f.state.deskId = 'desk-b'; return f.records.get(id); };
  await assert.rejects(f.tools.execute('get_object', {id: 'text-a'}, f.scope), /Стол изменился/);
});

test('search stays scoped and bounded even if the search service returns other desks', async () => {
  const f = fixture(), result = await f.tools.execute('search_canvas', {query: 'note', limit: 200}, f.scope);
  assert.equal(result.objects.some(row => row.id === 'foreign'), false);
  assert.equal(f.calls.find(call => call[0] === 'search')[2].limit, 25);
  assert.equal(f.calls.find(call => call[0] === 'search')[2].deskId, 'desk-a');
  assert.equal(JSON.stringify(result).includes('secret-data-url'), false);
});

test('edit tool stages a concrete revision-bound proposal and does not write storage', async () => {
  const f = fixture(), result = await f.tools.execute('propose_canvas_patch', {summary: 'Move note', actions: [{op: 'set', target: 'text-a', properties: {x: 50, y: 70}}]}, f.scope);
  assert.deepEqual(result, {ok: true, staged: true, applied: false}); assert.equal(f.proposals.length, 1);
  assert.equal(f.proposals[0].scope, 'project-a'); assert.equal(f.proposals[0].revision, 7);
  assert.equal(f.calls.some(call => ['create', 'patch'].includes(call[0])), false);
});

test('read-only and comment grants cannot stage a patch or focus/mutate the canvas', async () => {
  const f = fixture();
  for (const role of ['view', 'comment']) {
    await assert.rejects(f.tools.execute('canvas.move', {id: 'text-a', x: 5, y: 6}, {...f.scope, role}), /недоступен/);
    await assert.rejects(f.tools.execute('focus_object', {id: 'text-a'}, {...f.scope, role}), /недоступен/);
  }
  assert.equal(f.proposals.length, 0); assert.equal(f.calls.length, 0);
});

test('patch rejects unsafe or unsupported fields, types, coordinates and cross-desk targets', async () => {
  for (const actions of [
    [{op: 'delete', target: 'text-a'}],
    [{op: 'create', objectType: 'html', properties: {text: '<script>'}}],
    [{op: 'set', target: 'text-a', properties: {src: 'https://untrusted'}}],
    [{op: 'set', target: 'text-a', properties: {x: Infinity}}],
    [{op: 'set', target: 'text-a', properties: JSON.parse('{"__proto__":{"pollute":true}}')}]
  ]) assert.throws(() => core.normalizedPatch({actions}));
  const f = fixture(); await assert.rejects(f.tools.execute('propose_canvas_patch', {actions: [{op: 'set', target: 'foreign', properties: {text: 'overwrite'}}]}, f.scope), /текущем столе/);
  assert.equal(f.proposals.length, 0);
});

test('external canvas access never receives internal chat history', async () => {
  const f = fixture(); await assert.rejects(f.tools.execute('chat_history_read', {}, {...f.scope, external: true}), /не передаётся/);
});

test('late replies are rejected after cancellation, thread switch, history clear or a new task', () => {
  const fence = core.createTaskFence(), state = {scope: 'project', deskId: 'desk', thread: 'main', epoch: 0};
  const task = fence.begin(state); assert.equal(fence.valid(task, state), true);
  assert.equal(fence.valid(task, {...state, thread: 'other'}), false);
  assert.equal(fence.valid(task, {...state, epoch: 2}), false);
  assert.equal(fence.valid(task, {...state, scope: 'other'}), false);
  fence.cancel(); assert.equal(fence.valid(task, state), false);
  const next = fence.begin(state); fence.finish(task); assert.equal(fence.valid(next, state), true);
  fence.finish(next); assert.equal(fence.valid(next, state), false);
});
