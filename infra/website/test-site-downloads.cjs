'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../website/site.js'), 'utf8');
const platforms = [['macos', 'mac', 'mac-arm64.dmg'], ['windows', 'windows', 'Windows-x64.exe'], ['linux', 'linux', 'Linux-x64.AppImage']];
const manifest = (versions = ['6.0.36', '6.0.36', '6.0.36']) => ({
  schema: 1,
  version: [...versions].sort((a, b) => {
    const left = a.split('.').map(Number), right = b.split('.').map(Number);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  }).at(-1),
  files: platforms.map(([platform, , suffix], i) => ({ platform, version: versions[i],
    filename: `Mouse-Browser-${versions[i]}-${suffix}`, url: `/downloads/Mouse-Browser-${versions[i]}-${suffix}`,
    size: 100 + i, sha256: String(i + 1).repeat(64) }))
});
const settle = () => new Promise(resolve => setImmediate(resolve));

function browser(initial = manifest()) {
  const downloaded = [], scripts = [], timers = new Map(), intervals = [];
  let nextTimer = 0;
  class Element {
    constructor(attrs = {}) {
      this.attrs = { ...attrs }; this.listeners = new Map(); this.textContent = '';
      this.dataset = {}; this.style = {}; this.clientWidth = 0; this.scrollWidth = 0;
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    addEventListener(name, callback) { this.listeners.set(name, [...(this.listeners.get(name) || []), callback]); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    querySelector(selector) { return this.children?.[selector] || null; }
    click(options = {}) {
      const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
      for (const callback of this.listeners.get('click') || []) callback(event);
      if (!event.defaultPrevented && this.attrs.href) downloaded.push(this.attrs.href);
      return event;
    }
    remove() { this.removed = true; }
  }
  const root = new Element({ 'data-static-language': 'ru' });
  const footer = new Element({ 'data-i18n': 'releaseLabel' });
  const messages = { releaseTemplate: 'Предварительная версия {version}', releaseLabel: 'Предварительная версия 6.0.36' };
  const anchors = new Map(platforms.map(([platform, key], i) => {
    const item = initial.files[i];
    const anchor = new Element({ href: item.url, download: item.filename, 'data-platform': platform, 'data-i18n-aria': key + 'Aria' });
    const meta = new Element({ 'data-i18n': key + 'Meta' });
    anchor.children = { '.download-meta': meta };
    messages[key + 'AriaTemplate'] = `Скачать ${platform} · Mouse Browser {version}`;
    messages[key + 'Aria'] = `Скачать ${platform} · Mouse Browser ${item.version}`;
    messages[key + 'MetaBase'] = platform + ' installer';
    messages[key + 'Meta'] = platform + ' installer';
    return [platform, anchor];
  }));
  const themeLabel = new Element(), theme = new Element(), language = new Element(), headline = new Element();
  theme.children = { '.theme-label': themeLabel };
  const details = { open: false };
  const documentListeners = new Map(), windowListeners = new Map();
  const document = {
    documentElement: root, visibilityState: 'visible',
    head: { appendChild(script) { scripts.push(script); } },
    createElement() { return new Element(); },
    getElementById(id) { return { headline, 'language-picker': language, 'theme-switch': theme }[id] || null; },
    querySelector(selector) {
      if (selector === '[data-i18n="releaseLabel"]') return footer;
      if (selector === '.install-details') return details;
      const match = /^\.download\[data-platform="(\w+)"\]$/.exec(selector);
      return match ? anchors.get(match[1]) : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [footer, ...[...anchors.values()].map(a => a.children['.download-meta'])];
      if (selector === '[data-i18n-aria]' || selector === '.download[data-platform]') return [...anchors.values()];
      return [];
    },
    addEventListener(name, callback) { documentListeners.set(name, callback); }
  };
  const window = {
    MOUSE_DOWNLOADS_CURRENT: initial,
    MOUSE_I18N: { languages: [{ code: 'ru', name: 'русский', dir: 'ltr' }], messages: { ru: messages } },
    MouseLanguagePicker: { create() { return { update() {} }; } },
    location: { href: 'https://mouse.black/ru/', search: '' },
    addEventListener(name, callback) { windowListeners.set(name, callback); }
  };
  vm.runInNewContext(source, {
    window, document, navigator: { languages: ['ru'] }, localStorage: { getItem() { return null; }, setItem() {} },
    URLSearchParams, URL, Map, Set, WeakSet, Promise, Date,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback) { intervals.push(callback); },
  });
  documentListeners.get('DOMContentLoaded')();
  return { anchors, footer, scripts, downloaded, document, window, intervals,
    focus() { windowListeners.get('focus')(); },
    async respond(value) { const script = scripts.at(-1); window.MOUSE_DOWNLOADS_CURRENT = value; script.onload(); await settle(); },
    async fail() { scripts.at(-1).onerror(); await settle(); },
    async timeout() { const timer = [...timers.values()].find(item => item.delay === 3500); assert.ok(timer); timer.callback(); await settle(); }
  };
}

test('a primary click discovers a new Mac release before downloading, preserving other platform versions', async () => {
  const page = browser();
  const event = page.anchors.get('macos').click();
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(page.downloaded, []);
  assert.match(page.scripts[0].src, /^\/downloads-current\.js\?v=\d+-1$/);
  await page.respond(manifest(['6.0.37', '6.0.36', '6.0.36']));
  assert.deepEqual(page.downloaded, ['/downloads/Mouse-Browser-6.0.37-mac-arm64.dmg']);
  assert.equal(page.anchors.get('macos').attrs.download, 'Mouse-Browser-6.0.37-mac-arm64.dmg');
  assert.match(page.anchors.get('macos').attrs['aria-label'], /6\.0\.37/);
  assert.match(page.anchors.get('windows').attrs.href, /6\.0\.36/);
  assert.equal(page.footer.textContent, 'macOS 6.0.37 · Windows 6.0.36 · Linux 6.0.36');
  assert.equal(page.anchors.get('macos').attrs['aria-busy'], undefined);
});

test('timeout falls back once to the existing direct download and does not disable future clicks', async () => {
  const page = browser(), anchor = page.anchors.get('macos');
  anchor.click();
  anchor.click();
  assert.equal(page.scripts.length, 1);
  await page.timeout();
  assert.equal(page.downloaded.length, 1);
  assert.match(page.downloaded[0], /6\.0\.36/);
  assert.equal(page.scripts[0].removed, true);
  anchor.click();
  await page.respond(manifest(['6.0.37', '6.0.37', '6.0.37']));
  assert.equal(page.downloaded.length, 2);
  assert.match(page.downloaded[1], /6\.0\.37/);
  assert.equal(page.footer.textContent, 'Предварительная версия 6.0.37');
});

test('malformed, external, older, or same-version changed metadata never replaces verified links', async () => {
  const cases = [];
  const external = manifest(['6.0.38', '6.0.38', '6.0.38']); external.files[0].url = 'https://invalid.example/setup.exe'; cases.push(external);
  const duplicate = manifest(['6.0.38', '6.0.38', '6.0.38']); duplicate.files[1] = duplicate.files[0]; cases.push(duplicate);
  const changed = manifest(['6.0.37', '6.0.37', '6.0.37']); changed.files[0].sha256 = 'a'.repeat(64); cases.push(changed);
  cases.push(manifest(), null);
  for (const data of cases) {
    const page = browser(manifest(['6.0.37', '6.0.37', '6.0.37']));
    page.anchors.get('macos').click();
    await page.respond(data);
    assert.deepEqual(page.downloaded, ['/downloads/Mouse-Browser-6.0.37-mac-arm64.dmg']);
  }
});

test('visible intervals and focus refresh without navigation; modified clicks remain ordinary anchors', async () => {
  const page = browser();
  const modified = page.anchors.get('windows').click({ ctrlKey: true });
  assert.equal(modified.defaultPrevented, false);
  assert.equal(page.scripts.length, 0);
  page.document.visibilityState = 'hidden'; page.intervals[0]();
  assert.equal(page.scripts.length, 0);
  page.document.visibilityState = 'visible'; page.intervals[0](); page.focus();
  assert.equal(page.scripts.length, 1);
  await page.respond(manifest(['6.0.37', '6.0.37', '6.0.37']));
  assert.equal(page.downloaded.length, 1);
  assert.match(page.anchors.get('linux').attrs.href, /6\.0\.37/);
  page.focus(); await page.fail();
  assert.match(page.anchors.get('linux').attrs.href, /6\.0\.37/);
});
