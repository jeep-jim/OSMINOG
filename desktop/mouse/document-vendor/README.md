# Mouse document vendor snapshot

Inventory verified on 2026-11-18 for the 6.0.25 document editor work. This directory contains **9 inherited files: 5 runtime assets and 4 licence/readme notices**, plus this inventory. Every listed file is byte-identical to the same filename in [`vendor/pdf`](../../../vendor/pdf). No runtime asset was rebuilt, patched or downloaded as a new dependency for this integration.

## Origins and declared licences

| Files | Origin and verified version information | Licence / notice |
| --- | --- | --- |
| `pdf.mjs`, `pdf.worker.mjs`, `PDFJS_LICENSE` | [Mozilla PDF.js](https://github.com/mozilla/pdf.js). The inherited code identifies version `4.10.38`, build `f9bea397f`. | Apache-2.0; copied `PDFJS_LICENSE`, plus the copyright/licence header in each module. |
| `pdf-lib.min.js`, `PDF_LIB_LICENSE.md` | [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib). The inherited minified file is pinned by SHA-256 below. A release number is not embedded in this file; this inventory does not infer its version from the latest upstream release. | MIT; copied `PDF_LIB_LICENSE.md`, copyright 2019 Andrew Dillon. [Upstream licence](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md). |
| `fontkit.umd.min.js`, `FONTKIT_README.md` | [Hopding/fontkit](https://github.com/Hopding/fontkit), the `@pdf-lib/fontkit` fork of [foliojs/fontkit](https://github.com/foliojs/fontkit). The README identifies this fork and browser bundle. The inherited bundle is pinned by hash; no release number is inferred from upstream `master`/latest. | The copied README declares MIT and points to the licence; [upstream package metadata](https://github.com/Hopding/fontkit/blob/master/package.json) also declares MIT. This entry describes the upstream notice provided with the inherited snapshot; it is not a completed transitive bundle licence audit. |
| `DejaVuSans.ttf`, `DEJAVU_LICENSE` | [DejaVu Fonts](https://dejavu-fonts.github.io/). The TTF name table reports `Version 2.37`, DejaVu fonts team. | Bitstream Vera font terms, DejaVu changes in public domain; upstream also identifies Arev glyph attribution. The copied `DEJAVU_LICENSE` is the inherited Debian copyright notice, with separate Debian-packaging text. [Upstream font licence](https://dejavu-fonts.github.io/License.html). |

The immediate byte source for all nine files is the repository's existing `vendor/pdf` snapshot, rather than a newly resolved package version. The historical [`chrome-4.0.39.json` audit](../../../docs/release-audits/chrome-4.0.39.json) already records the same hashes for the font, pdf-lib and fontkit runtime files. Upstream links identify the projects and notices; they do not assert that the current contents of an upstream default branch are byte-identical to this snapshot.

## Exact inventory

Sizes are uncompressed file bytes. SHA-256 is over the exact shipped file contents, including line endings.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `pdf.mjs` | 658371 | `a209a2124baa35cbb9015b809926f1bcec9dd1c247296290e205dd9d76cb9128` |
| `pdf.worker.mjs` | 2209730 | `7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323` |
| `pdf-lib.min.js` | 525099 | `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f` |
| `fontkit.umd.min.js` | 758440 | `d8df561b9fba98e24f2e5130e40948809281bbbc55a20c412359f1a0a5eb35a6` |
| `DejaVuSans.ttf` | 759720 | `ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280` |
| `PDFJS_LICENSE` | 10174 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |
| `PDF_LIB_LICENSE.md` | 1070 | `f2c9fc00fdb66eb99ac156ba52d734af66d8d309f65753ae809ad34ee2883bcb` |
| `FONTKIT_README.md` | 16875 | `7315fcc54511f5ffc906969c39333f93cd47f5217ab014fe45acff14bd5ec4c0` |
| `DEJAVU_LICENSE` | 3859 | `63d3ba759d12804c5b31a9d5940d855c1820d1f5999e6b0872eb1c7ff045fbc9` |

Recheck from the repository root without modifying assets:

```python
from pathlib import Path
import hashlib

source = Path('vendor/pdf')
target = Path('desktop/mouse/document-vendor')
names = (
    'pdf.mjs', 'pdf.worker.mjs', 'pdf-lib.min.js', 'fontkit.umd.min.js',
    'DejaVuSans.ttf', 'PDFJS_LICENSE', 'PDF_LIB_LICENSE.md',
    'FONTKIT_README.md', 'DEJAVU_LICENSE',
)
for name in names:
    data = (target / name).read_bytes()
    assert data == (source / name).read_bytes(), name
    print(name, len(data), hashlib.sha256(data).hexdigest())
```

## Runtime use and advisory scope

[`document-pdf.js`](../document-pdf.js) imports PDF.js and its local worker for rendering. It loads pdf-lib, fontkit and DejaVu Sans only when an edited PDF needs export. The adapter supplies `isEvalSupported: false`, operates on explicitly opened file bytes and does not instantiate PDF.js's scripting manager/full viewer scripting pipeline. The shell CSP limits scripts/workers to local application resources and sets `object-src 'none'`.

Two official Mozilla advisories were checked on 2026-11-18:

| Advisory | Published affected / fixed versions | Relation to this snapshot |
| --- | --- | --- |
| [GHSA-wgrm-67xf-hhpq](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) | Affected `<= 4.1.392`; fixed `4.2.67`. The advisory also describes disabling `isEvalSupported`. | `4.10.38` is outside the listed affected range. The adapter also passes `isEvalSupported: false`. |
| [GHSA-hq66-cqwq-w95j](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) | Affected starts at `5.6.83`; fixed `6.2.108`. The described issue concerns enabled scripting and CSP conditions. | `4.10.38` predates that affected range; this adapter does not create the scripting pipeline. |

This is a scoped comparison with two published advisories. It is not an assurance that the snapshot or all bundled transitive code is free of vulnerabilities. The presence of an `enableScripting: false` property in a `getDocument` options object is not used as proof that a separate viewer scripting manager has been disabled; that manager is not instantiated here.

Supported edits, resource limits, native file handling and the distinction between local tests and pending installed verification are recorded in [the 6.0.25 implementation note](../../../docs/desktop/2026-11-18-mouse625-documents.md).
