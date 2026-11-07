'use strict';
// Package inventory and local resource closure, not a replacement for UI tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const files = JSON.parse(read('tools/release-files-439.json'));
const baseline = JSON.parse(read('tools/release-files-437.json'));
const listed = new Set(files);
assert.equal(listed.size, files.length);
for (const name of baseline) assert(listed.has(name), 'Missing original runtime file: ' + name);
for (const name of files) {
  assert(!path.isAbsolute(name) && !name.split('/').includes('..'), name);
  assert(!/^(?:tests|tools|android|android-vision|desktop|docs|artifacts)\//.test(name), name);
  assert(fs.statSync(path.join(root, name)).isFile(), name);
  if (!/\.(?:html|css)$/.test(name)) continue;
  const source = read(name);
  const refs = name.endsWith('.html')
    ? [...source.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)].map(m => m[1])
    : [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(m => m[1].trim());
  for (const ref of refs) {
    if (/^(?:[a-z][\w+.-]*:|\/\/|#|\$\{)/i.test(ref)) continue;
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(name), ref.split(/[?#]/)[0]));
    assert(listed.has(rel), `${name} references an unpackaged resource: ${ref}`);
  }
}
for (const name of ['osminog-restore-438.js', 'osminog-capture-store.js']) assert(listed.has(name), name);
const manifest = JSON.parse(read('manifest.json'));
const build = JSON.parse(read('OSMINOG_BUILD.json'));
assert.equal(manifest.version, '4.0.40');
assert.equal(manifest.version_name, manifest.version);
assert.equal(build.version, manifest.version);
assert.equal(build.runtimeVerified, false);
assert.equal(build.workspaceBaseline, '4.0.37');
assert.equal(crypto.createHash('sha256').update(manifest.key).digest('hex'), '1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e');
for (const item of JSON.parse(read('tools/ocr-assets.json'))) {
  const bytes = fs.readFileSync(path.join(root, 'vendor/ocr', item.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
}
console.log(`PASS complete ${baseline.length}-file 4.0.37 Chrome runtime retained; ${files.length} package files and all local HTML/CSS resources present`);
