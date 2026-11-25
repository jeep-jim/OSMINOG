'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../website/download-metrics.js'), 'utf8');
const NOW = Date.parse('2026-11-25T07:00:00Z');
const suffixes = { macos: 'mac-arm64.dmg', windows: 'Windows-x64.exe', linux: 'Linux-x64.AppImage' };
const record = (platform = 'macos', version = '6.0.38', count = 12) => ({
  platform, version, count, filename: `Mouse-Browser-${version}-${suffixes[platform]}`,
});
const catalog = (versions = ['6.0.38', '6.0.38', '6.0.38']) => ({
  schema: 1,
  files: Object.keys(suffixes).map((platform, index) => record(platform, versions[index])),
});
const totals = (files = [record()]) => ({
  schema: 1, status: 'active', metric: 'qualified_download_starts',
  since: '2026-11-24T12:00:00Z', updatedAt: new Date(NOW).toISOString(), files,
});

// Only the DOM surface used by the real module is modeled here. In particular,
// markup sinks throw, so the tests cannot silently treat HTML writes as text.
function browser(stats, search = '') {
  const listeners = new Map(), windowListeners = new Map(), scripts = [], timers = new Map(), intervals = [];
  let clock = NOW, timerId = 0, activeElement = null;
  class Node {
    constructor(tag = 'span') {
      this.tagName = tag.toUpperCase(); this.children = []; this.textContent = '';
      this.hidden = false; this.open = false; this.dataset = {};
    }
    set innerHTML(_) { throw new Error('Statistics must not use an HTML sink'); }
    insertAdjacentHTML() { throw new Error('Statistics must not use an HTML sink'); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelector(selector) { return this.parts?.[selector] || null; }
    contains(target) { return target === this || Object.values(this.parts || {}).includes(target); }
    focus() { activeElement = this; }
    remove() { this.removed = true; }
  }
  const hosts = Object.fromEntries(Object.keys(suffixes).map(platform => {
    const host = new Node('details');
    host.hidden = true;
    host.dataset.downloadStats = platform;
    host.parts = {
      '[data-stats-count]': new Node(), '[data-stats-versions]': new Node('dl'),
      '[data-stats-since]': new Node('time'), summary: new Node('summary'),
    };
    return [platform, host];
  }));
  const document = {
    visibilityState: 'visible',
    head: { appendChild(node) { scripts.push(node); } },
    createElement(tag) { return new Node(tag); },
    querySelectorAll(selector) {
      if (selector === '[data-download-stats]') return Object.values(hosts);
      if (selector === '[data-download-stats][open]') return Object.values(hosts).filter(host => host.open);
      throw new Error('Unexpected selector: ' + selector);
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  const window = {
    MOUSE_DOWNLOAD_STATS: stats, location: { search },
    addEventListener(name, callback) { windowListeners.set(name, callback); },
  };
  class Clock extends Date { static now() { return clock; } }
  vm.runInNewContext(source, {
    window, document, URLSearchParams, Date: Clock,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback) { intervals.push(callback); },
  }, { filename: 'download-metrics.js' });
  listeners.get('DOMContentLoaded')();
  return {
    hosts, scripts, window, document,
    update(next = catalog()) { window.MouseDownloadStats.update(next); },
    replace(value) { window.MOUSE_DOWNLOAD_STATS = value; window.MouseDownloadStats.update(); },
    advance(milliseconds) { clock += milliseconds; },
    refresh() { intervals[0](); },
    emit(name, event) { listeners.get(name)(event); },
    focused() { return activeElement; },
  };
}

const countText = host => host.parts['[data-stats-count]'].textContent;
const rowText = host => host.parts['[data-stats-versions]'].children.map(node => node.textContent);
function assertHidden(page, message) {
  for (const host of Object.values(page.hosts)) {
    assert.equal(host.hidden, true, message);
    assert.equal(host.open, false, message);
    assert.equal(countText(host), '', message);
  }
}

test('missing or inactive statistics stay hidden rather than becoming zero', () => {
  for (const value of [undefined, null, {}, { ...totals(), status: 'unavailable' }]) {
    const page = browser(value, '?stats=1');
    page.update();
    assertHidden(page);
  }
});

test('a recorded zero is subtle publicly and exact in the owner view and disclosure', () => {
  for (const [query, expected] of [['', '···'], ['?stats=0', '···'], ['?stats=1', '· 0']]) {
    const page = browser(totals([record('macos', '6.0.38', 0), record('windows', '6.0.38', 23)]), query);
    page.update();
    assert.equal(page.hosts.macos.hidden, false);
    assert.equal(countText(page.hosts.macos), expected);
    assert.deepEqual(rowText(page.hosts.macos), ['v6.0.38', '0']);
    assert.equal(countText(page.hosts.windows), '· 23');
    assert.equal(page.hosts.linux.hidden, true);
  }
});

test('only the exact platform, version and filename gets a current count', () => {
  const page = browser(totals([record('macos', '6.0.37', 91), record('windows', '6.0.38', 17), record('linux', '6.0.38', 2)]));
  page.update(catalog(['6.0.38', '6.0.37', '6.0.38']));
  assert.equal(page.hosts.macos.hidden, true, 'Older Mac totals must not follow the new installer');
  assert.equal(page.hosts.windows.hidden, true, 'Newer Windows totals must not label an older installer');
  assert.equal(countText(page.hosts.linux), '· 2');
});

test('a catalog change hides unmatched old counts and closes their disclosure', () => {
  const page = browser(totals([record('macos', '6.0.38', 18), record('linux', '6.0.38', 4)]));
  page.update();
  page.hosts.macos.open = true;
  page.update(catalog(['6.0.39', '6.0.38', '6.0.38']));
  assert.equal(page.hosts.macos.hidden, true);
  assert.equal(page.hosts.macos.open, false);
  assert.equal(countText(page.hosts.macos), '');
  assert.equal(countText(page.hosts.linux), '· 4');
  page.replace(totals([record('macos', '6.0.39', 1)]));
  assert.equal(countText(page.hosts.macos), '· 1');
});

test('untrusted or inconsistent totals invalidate the whole snapshot and clear old summaries', () => {
  const changes = {
    'stale snapshot': value => { value.updatedAt = new Date(NOW - 600001).toISOString(); },
    'future snapshot': value => { value.updatedAt = new Date(NOW + 300001).toISOString(); },
    'reversed period': value => { value.since = new Date(NOW + 1).toISOString(); },
    'invalid date': value => { value.updatedAt = 'not-a-date'; },
    'missing date': value => { value.since = null; },
    'wrong schema': value => { value.schema = 2; },
    'wrong metric': value => { value.metric = 'users'; },
    'invalid collection': value => { value.files = {}; },
    'oversize collection': value => { value.files = Array(1025).fill(record()); },
    'unknown platform': value => { value.files[0].platform = 'android'; },
    'malformed version': value => { value.files[0].version = '6.0'; },
    'unsafe version': value => { value.files[0] = record('macos', '9007199254740992.0.0'); },
    'mismatched filename': value => { value.files[0].filename = 'Mouse-Browser-6.0.37-mac-arm64.dmg'; },
    'negative total': value => { value.files[0].count = -1; },
    'fractional total': value => { value.files[0].count = 1.5; },
    'text total': value => { value.files[0].count = '12'; },
    'NaN total': value => { value.files[0].count = NaN; },
    'infinite total': value => { value.files[0].count = Infinity; },
    'unsafe total': value => { value.files[0].count = Number.MAX_SAFE_INTEGER + 1; },
    'duplicate record': value => { value.files.push({ ...value.files[0] }); },
  };
  for (const [name, change] of Object.entries(changes)) {
    const page = browser(totals());
    page.update();
    page.hosts.macos.open = true;
    const invalid = totals();
    change(invalid);
    page.replace(invalid);
    assertHidden(page, name);
  }
});

test('disclosure sorts versions numerically and keeps platform history separate', () => {
  const page = browser(totals([
    record('macos', '6.0.9', 9), record('macos', '6.0.38', 38),
    record('macos', '10.0.0', 100), record('windows', '11.0.0', 110),
    record('macos', '6.0.10', 10), record('macos', '6.1.0', 61),
  ]));
  page.update();
  assert.deepEqual(rowText(page.hosts.macos), ['v10.0.0', '100', 'v6.1.0', '61', 'v6.0.38', '38', 'v6.0.10', '10', 'v6.0.9', '9']);
  const nodes = page.hosts.macos.parts['[data-stats-versions]'].children;
  assert.deepEqual(nodes.map(node => node.tagName), ['DT', 'DD', 'DT', 'DD', 'DT', 'DD', 'DT', 'DD', 'DT', 'DD']);
  assert.ok(nodes.every(node => node.dir === 'ltr'));
  const period = page.hosts.macos.parts['[data-stats-since]'];
  assert.equal(period.textContent, '2026-11-24 — 2026-11-25');
  assert.equal(period.dateTime, '2026-11-24T12:00:00Z');
});

test('markup in purported values is rejected and unused metadata never becomes HTML', () => {
  const malicious = record('macos', '<img src=x onerror=alert(1)>', 1);
  const page = browser(totals([malicious]));
  page.update();
  assertHidden(page);
  page.replace(totals([{ ...record(), label: '<svg onload=alert(1)>', html: '<script>bad()</script>' }]));
  assert.deepEqual(rowText(page.hosts.macos), ['v6.0.38', '12']);
  page.replace(totals([{ ...record(), count: '<script>bad()</script>' }]));
  assertHidden(page);
});

test('failed refresh expires old counts without publishing a fabricated zero', () => {
  const page = browser(totals());
  page.update();
  page.advance(600001);
  page.refresh();
  page.refresh();
  assert.equal(page.scripts.length, 1, 'Only one optional statistics request at a time');
  assert.match(page.scripts[0].src, /^\/download-stats\.js\?v=\d+$/);
  page.scripts[0].onerror();
  assert.equal(page.scripts[0].removed, true);
  assertHidden(page);
});

test('disclosures close outside or on Escape and return keyboard focus to the summary', () => {
  const page = browser(totals());
  page.update();
  const host = page.hosts.macos;
  host.open = true;
  page.emit('click', { target: host.parts.summary });
  assert.equal(host.open, true);
  page.emit('click', { target: {} });
  assert.equal(host.open, false);
  host.open = true;
  page.emit('keydown', { key: 'Escape' });
  assert.equal(host.open, false);
  assert.equal(page.focused(), host.parts.summary);
});
