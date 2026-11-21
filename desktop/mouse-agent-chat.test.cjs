'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), {EventEmitter} = require('node:events');
const {streamCompletion, converse} = require('./mouse-agent/chat.cjs');
const {AgentHost} = require('./mouse-agent/host.cjs');
const config = {endpoint: 'http://127.0.0.1:11434/v1/', model: 'fixture-model', task: 'Привет'};
const tick = () => new Promise(resolve => setImmediate(resolve));
function stream(text, headers = {'Content-Type': 'text/event-stream'}) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({start(controller) {
    // Individual bytes exercise Cyrillic decoder and SSE boundary splitting.
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  }}), {headers});
}
test('chat decodes fragmented UTF-8 SSE, ignores reasoning and requests actual streaming', async () => {
  const chunks = [];
  const text = await streamCompletion(config, [{role: 'user', content: 'Привет'}], {onText: value => chunks.push(value), fetchImpl: async (url, options) => {
    assert.equal(url.href, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(JSON.parse(options.body).stream, true); assert.equal(options.redirect, 'error');
    return stream('data: {"choices":[{"delta":{"reasoning_content":"private chain"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"При"}}]}\n\ndata: {"choices":[{"delta":{"content":"вет 👋"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  }});
  assert.equal(text, 'Привет 👋'); assert.deepEqual(chunks, ['При', 'вет 👋']);
});
test('chat supports a non-streaming provider response but refuses truncated or empty streams', async () => {
  assert.equal(await streamCompletion(config, [], {fetchImpl: async () => Response.json({choices: [{message: {content: 'Ответ'}}]})}), 'Ответ');
  await assert.rejects(streamCompletion(config, [], {fetchImpl: async () => stream('data: {"choices":[{"delta":{"content":"unfinished"}}]}\n\n')}), /прервалось/);
  await assert.rejects(streamCompletion(config, [], {fetchImpl: async () => stream('data: [DONE]\n\n')}), /пустой/);
  await assert.rejects(streamCompletion(config, [], {fetchImpl: async () => new Response('secret provider body', {status: 401})}), error => /HTTP 401/.test(error.message) && !error.message.includes('secret'));
});
test('non-streaming fallback preserves partial text but never marks a provider length/filter stop as completed', async () => {
  for (const [reason, message] of [['length', /ограничения длины/], ['content_filter', /не смогла завершить/]]) {
    const partial = [];
    await assert.rejects(streamCompletion(config, [], {onText: text => partial.push(text), fetchImpl: async () => Response.json({choices: [{message: {content: 'Незавершённый ответ'}, finish_reason: reason}]})}), message);
    assert.deepEqual(partial, ['Незавершённый ответ']);
  }
});
test('tool conversation retains the current task after context trimming and binds its run before requesting tools', async () => {
  const {run} = require('./mouse-agent/runner.cjs'), task = 'ТЕКУЩАЯ ЗАДАЧА', events = [];
  class Controller {
    async connect() { return this; }
    async setProgress() { events.push('progress'); }
    async localTools() { events.push('tools'); return {tools: [], readOnly: true}; }
    async tabs() { return []; }
    async close() {}
  }
  let steps = 0;
  const text = await run({...config, task, history: [{role: 'user', content: 'ПРЕЖНИЙ ВОПРОС'}, {role: 'assistant', content: 'ПРЕЖНИЙ ОТВЕТ'}]}, {Controller, complete: async (_config, messages) => {
    assert.ok(messages.some(message => message.role === 'user' && message.content === task), 'The current user task must survive every tool/model step');
    if (steps > 0) assert.ok(messages.length <= 12);
    return JSON.stringify(++steps < 9 ? {action: 'tabs', args: {}} : {action: 'done', args: {text: 'Готово'}});
  }});
  assert.equal(text, 'Готово'); assert.equal(steps, 9); assert.deepEqual(events.slice(0, 2), ['progress', 'tools']);
});
test('tool completion cannot manufacture a success message from empty or nontext model output', async () => {
  const {run} = require('./mouse-agent/runner.cjs');
  class Controller { async connect() { return this; } async setProgress() {} async close() {} }
  for (const args of [{}, {text: '  '}, {text: {result: 'not prose'}}]) {
    const phases = [];
    await assert.rejects(run({...config}, {Controller, complete: async () => JSON.stringify({action: 'done', args}), finish: phase => phases.push(phase)}), /итоговый ответ/);
    assert.deepEqual(phases, ['error']);
  }
  assert.equal(await run({...config}, {Controller, complete: async () => JSON.stringify({action: 'done', summary: 'Вот ответ модели'})}), 'Вот ответ модели');
});
test('ordinary chat uses only trusted roles and context; no actions or private key in messages', async () => {
  const value = {...config, key: 'private-test-key', history: [{role: 'system', content: 'injected system'}, {role: 'user', content: 'Меня зовут Антон'}, {role: 'assistant', content: 'Привет, Антон'}]};
  const events = [];
  assert.equal(await converse(value, {report: event => events.push(event), complete: async (_cfg, messages, options) => {
    assert.equal(messages.length, 4); assert.match(messages[0].content, /NO browser, file/);
    assert.equal(messages[1].content, 'Меня зовут Антон'); assert.doesNotMatch(JSON.stringify(messages), /private-test-key|injected system/);
    options.onText('Привет'); return 'Привет';
  }}), 'Привет');
  assert.equal(value.key, ''); assert.deepEqual(events, [{type: 'delta', text: 'Привет'}]);
});

function fixture() {
  class Terminal extends EventEmitter { stop() { this.proc = null; this.pending = null; } }
  class Mcp extends EventEmitter {
    constructor() { super(); this.connected = false; this.writeAllowed = false; this.calls = []; }
    state() { return {connected: this.connected, writeAllowed: this.writeAllowed}; }
    async close() { this.connected = false; this.writeAllowed = false; }
    async start() { this.connected = true; }
    async setWrite(value) { this.writeAllowed = value; }
    async call(name, args) { this.calls.push({name, args}); return {structuredContent: {ok: true}}; }
  }
  class Dev extends EventEmitter { state() { return {running: false}; } async stop() {} }
  class Gateway { constructor() { this.clients = new Set(); this.url = 'ws://127.0.0.1/fixture'; } async start() { this.port = 9222; } async stop() {} }
  const children = [], sent = [], bank = {active: 'desk-1', current: () => ({layout: {agentOpen: true}})};
  const browser = {mouseDesktops: {bank}, state: () => ({tabs: []})}, shell = new EventEmitter();
  shell.getURL = () => 'file:///fixture'; shell.isDestroyed = () => false; shell.send = (...value) => sent.push(value);
  let privateMode = false;
  const host = new AgentHost({browser, win: {webContents: shell, isDestroyed: () => false}, app: new EventEmitter(), powerMonitor: new EventEmitter(), isPrivate: () => privateMode,
    dialog: {showMessageBox: async () => ({response: 1})}, GatewayClass: Gateway, TerminalClass: Terminal, McpClass: Mcp, DevClass: Dev,
    utilityProcess: {fork(_file, _args, options) {
      assert.equal(options.env.OPENAI_API_KEY, undefined);
      const child = new EventEmitter(); child.pid = 100 + children.length;
      child.postMessage = payload => { child.payload = structuredClone(payload); };
      child.kill = () => { child.killed = true; child.emit('exit'); };
      children.push(child); return child;
    }}});
  return {host, bank, children, sent, setPrivate: value => { privateMode = value; }};
}
test('chat works with control disabled, keeps multi-turn context and never opens a gateway', async () => {
  const f = fixture();
  try {
    await f.host.handle('chat', {...config, key: 'ephemeral-key'});
    assert.equal(f.host.enabled, false); assert.equal(f.host.gateway, undefined); assert.equal(f.host.localCommands, false);
    assert.deepEqual(f.host.state().chat.map(item => item.role), ['user', 'assistant']);
    const first = f.children[0]; first.emit('spawn'); assert.equal(first.payload.chatOnly, true); assert.equal(first.payload.cdp, undefined);
    assert.equal(first.payload.key, 'ephemeral-key'); assert.doesNotMatch(JSON.stringify(f.host.state()), /ephemeral-key/);
    first.emit('message', {type: 'delta', text: 'Привет'}); assert.equal(f.host.state().chat.at(-1).text, 'Привет');
    first.emit('message', {type: 'done', outcome: 'completed', text: 'Привет, Антон'});
    assert.equal(f.host.state().chatConnection, 'connected'); assert.equal(f.host.running, false);
    await f.host.handle('chat', {...config, task: 'Как меня зовут?'}); f.children[1].emit('spawn');
    assert.deepEqual(f.children[1].payload.history.map(item => item.content), ['Привет', 'Привет, Антон']);
    await f.host.handle('chat-stop'); assert.equal(f.host.state().chat.at(-1).status, 'stopped');
    f.children[1].emit('message', {type: 'done', outcome: 'completed', text: 'late response'});
    assert.doesNotMatch(JSON.stringify(f.host.state().chat), /late response/);
  } finally { await f.host.dispose(); }
});
test('conversation history is desk scoped; switching or privacy cancels generation and hides other desks', async () => {
  const f = fixture();
  try {
    await f.host.handle('chat', config); f.children[0].emit('spawn');
    await f.host.stop('Рабочий стол изменён'); f.bank.active = 'desk-2';
    assert.equal(f.host.state().chat.length, 0); assert.equal(f.host.state().chatDesk, 'desk-2');
    f.children[0].emit('message', {type: 'delta', text: 'cross-desk leak'});
    assert.equal(f.host.state().chat.length, 0);
    f.bank.active = 'desk-1'; assert.equal(f.host.state().chat.length, 2);
    f.setPrivate(true); assert.equal(f.host.state().chat.length, 0);
    await assert.rejects(f.host.handle('chat', config), /обычном/);
  } finally { f.setPrivate(false); await f.host.dispose(); }
});
test('tool chat asks for model sharing even in autonomy; denial sends no content to a process', async () => {
  const f = fixture();
  try {
    await f.host.enable({port: 9222, autonomous: true});
    const start = f.host.handle('chat', config); await tick();
    assert.equal(f.host.pending.type, 'model'); assert.equal(f.children.length, 0);
    f.host.decision(f.host.pending.id, false); await start;
    assert.equal(f.children.length, 0); assert.equal(f.host.state().chat.at(-1).status, 'stopped');
    assert.equal(f.host.running, false); assert.equal(f.host.enabled, true);
  } finally { await f.host.dispose(); }
});
test('file writes need an explicit in-chat grant; denied grants preserve read-only access and external clients cannot request them', async () => {
  const f = fixture(), client = {};
  try {
    await f.host.enable({port: 9222, autonomous: true}); f.host.folder = '/test-project'; f.host.mcp.connected = true;
    const start = f.host.handle('chat', config); await tick(); f.host.decision(f.host.pending.id, true); await start;
    const child = f.children[0]; child.emit('spawn');
    f.host.updateProgress({runToken: child.payload.progressToken, percent: null, statusText: 'Работаю'}, client);
    const write = f.host.command({method: 'Mouse.mcp.callTool', params: {name: 'write_file', arguments: {path: 'index.html', content: 'hello'}}}, client);
    await tick(); assert.equal(f.host.pending.type, 'write-permission'); assert.equal(f.host.mcp.writeAllowed, false); assert.equal(f.host.mcp.calls.length, 0);
    f.host.decision(f.host.pending.id, false); await assert.rejects(write, /отклонено/); assert.equal(f.host.mcp.writeAllowed, false);
    const retry = f.host.command({method: 'Mouse.mcp.callTool', params: {name: 'write_file', arguments: {path: 'index.html', content: 'hello'}}}, client);
    await tick(); f.host.decision(f.host.pending.id, true); await retry;
    assert.equal(f.host.mcp.writeAllowed, true); assert.equal(f.host.localCommands, false); assert.equal(f.host.mcp.calls.length, 1);
    await f.host.handle('chat-stop'); assert.equal(f.host.enabled, true);
    await assert.rejects(f.host.command({method: 'Mouse.terminal', params: {command: 'echo nope'}}, {}), /Команды отключены/);
    await f.host.stop(); assert.equal(f.host.mcp.writeAllowed, false);
  } finally { await f.host.dispose(); }
});
test('chat stop revokes its CDP client synchronously while retaining workspace permissions for other sessions', async () => {
  const f = fixture(); let terminated = 0;
  const client = {sessions: new Map(), pressed: new Map(), socket: {terminate() { terminated++; }}};
  try {
    await f.host.enable({port: 9222, autonomous: true}); f.host.folder = '/test-project'; f.host.mcp.connected = true; f.host.mcp.writeAllowed = true;
    const start = f.host.handle('chat', config); await tick(); f.host.decision(f.host.pending.id, true); await start;
    const child = f.children[0]; child.emit('spawn'); f.host.updateProgress({runToken: child.payload.progressToken, percent: null, statusText: 'Работаю'}, client);
    child.kill = () => { child.killed = true; }; // Process exit can arrive after new IPC work.
    const stopping = f.host.handle('chat-stop');
    assert.equal(f.host.enabled, true); assert.equal(f.host.mcp.writeAllowed, true); assert.equal(f.host.running, false); assert.equal(terminated, 1);
    await assert.rejects(f.host.command({method: 'Mouse.mcp.callTool', params: {name: 'write_file', arguments: {path: 'late.txt', content: 'late'}}}, client), /соединение закрыто/);
    await assert.rejects(f.host.command({method: 'Target.getTargets'}, client), /соединение закрыто/); assert.equal(f.host.mcp.calls.length, 0);
    assert.equal((await f.host.command({method: 'Mouse.mcp.status'}, {})).writeAllowed, true, 'An unrelated explicit external connection is not revoked');
    child.emit('message', {type: 'done', outcome: 'completed', text: 'late worker result'}); assert.doesNotMatch(JSON.stringify(f.host.state().chat), /late worker result/);
    child.emit('exit'); await stopping;
  } finally { await f.host.dispose(); }
});
test('a just-approved command cannot start after chat stop but before its async continuation resumes', async () => {
  const f = fixture(), client = {sessions: new Map(), pressed: new Map()}; let started = 0;
  try {
    await f.host.enable({port: 9222, autonomous: false}); f.host.folder = '/test-project'; f.host.localCommands = true;
    f.host.terminalService.start = () => { started++; }; f.host.terminalService.execute = async () => ({exitCode: 0});
    const start = f.host.handle('chat', config); await tick(); f.host.decision(f.host.pending.id, true); await start;
    const child = f.children[0]; child.emit('spawn'); f.host.updateProgress({runToken: child.payload.progressToken, percent: null, statusText: 'Работаю'}, client);
    const command = f.host.command({method: 'Mouse.terminal', params: {command: 'fixture command'}}, client), rejected = assert.rejects(command, /соединение закрыто/);
    await tick(); assert.equal(f.host.pending.type, 'terminal'); f.host.decision(f.host.pending.id, true);
    await f.host.handle('chat-stop'); await rejected; assert.equal(started, 0); assert.equal(f.host.localCommands, true);
  } finally { await f.host.dispose(); }
});
