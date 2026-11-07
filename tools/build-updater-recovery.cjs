'use strict';

/* Build the one-time, self-contained repair page from the reviewed updater.
 * The page is a CI artifact, not part of the Chrome extension package.
 * It never fetches or evaluates executable code. Only the normal, verified
 * release package is downloaded after the owner selects the installed folder.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const templatePath = path.join(__dirname, 'updater-recovery-template.html');
const updaterPath = path.join(root, 'osminog-folder-updater.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const updater = fs.readFileSync(updaterPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');
const fixedKeyDigest = '1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const compare = (a, b) => {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
};

if (manifest.name !== 'OSMINOG' || manifest.manifest_version !== 3 ||
    !/^\d+(?:\.\d+){2,3}$/.test(manifest.version) ||
    digest(manifest.key || '') !== fixedKeyDigest) {
  throw new Error('The recovery page must preserve the canonical OSMINOG identity.');
}
if (compare(manifest.version, '4.0.37') < 0) {
  throw new Error('Do not build a recovery page for a package containing the legacy updater.');
}
if (/<\/script/i.test(updater)) {
  throw new Error('The updater contains an HTML script terminator; review before embedding.');
}
new vm.Script(updater, { filename: 'osminog-folder-updater.js' });

const configuration = {
  schema: 'osminog-updater-recovery/v1',
  product: manifest.name,
  manifestVersion: manifest.manifest_version,
  manifestKey: manifest.key,
  minimumPackageVersion: manifest.version,
  minimumUpdaterVersion: '2.0.0',
  updaterSha256: digest(updater),
};
const safeJson = JSON.stringify(configuration)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
function substitute(source, token, value) {
  if (source.split(token).length !== 2) throw new Error('Expected exactly one template token: ' + token);
  return source.replace(token, () => value);
}
let html = substitute(template, '__OSMINOG_RECOVERY_CONFIG_JSON__', safeJson);
html = substitute(html, '__OSMINOG_FOLDER_UPDATER_SOURCE__', updater);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1 || /<script\b[^>]*\bsrc\s*=/i.test(html)) {
  throw new Error('Recovery must contain exactly one embedded script and no remote scripts.');
}
new vm.Script(scripts[0][1], { filename: 'OSMINOG-Update-Recovery.html' });
const scriptCsp = crypto.createHash('sha256').update(scripts[0][1]).digest('base64');
html = substitute(html, '__OSMINOG_SCRIPT_CSP_HASH__', scriptCsp);
if (/__OSMINOG_[A-Z_]+__/.test(html)) throw new Error('Unresolved recovery template token.');

const output = path.resolve(process.argv[2] || path.join(root, 'artifacts', 'OSMINOG-Update-Recovery.html'));
if (!output.endsWith('.html')) throw new Error('Recovery output must be an HTML file.');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html, 'utf8');
const bytes = fs.readFileSync(output);
fs.writeFileSync(output + '.sha256', digest(bytes) + '  ' + path.basename(output) + '\n', 'utf8');
process.stdout.write(JSON.stringify({
  artifact: path.basename(output),
  minimumPackageVersion: configuration.minimumPackageVersion,
  size: bytes.byteLength,
  sha256: digest(bytes),
  updaterSha256: configuration.updaterSha256,
}) + '\n');
