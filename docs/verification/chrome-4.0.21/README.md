# Chrome 4.0.21 — clipboard recovery verification

## Reported regression

The owner supplied a screenshot from Chrome extension 4.0.20 showing an enabled collector, an empty destination folder and the toast `Не удалось вставить изображение: loadImage is not defined`. The queue importer in `osminog-library.js` referenced a function scoped inside the separate Workdesk closure. Manual paste called that importer through `reuseCapture`, so one queued image could break both paths.

## Regression gates

- `node tests/storage-load-421.cjs`: checks the real storage helper against Chrome's asynchronous callback contract. A callback-style `get` returns `undefined`; this must not resolve an empty workspace before the callback. Storage errors must remain errors.
- `node tests/collector-runtime-421.cjs`: deterministic runtime fixtures verify awaited image decoding/acknowledgement, retry after a changed clipboard, baseline skip, durable deduplication, desk/folder routing and pause/create races. These fixtures do not establish operating-system clipboard behavior.
- `node tests/clipboard-library-421.cjs`: complete editor with real browser clipboard and fault-injected storage; checks queued image recovery, native Ctrl+V, per-item isolation, visible pending errors, persist/acknowledgement failures, arrivals during drain, and live folder refresh with search/scroll retained. Passed locally.
- `xvfb-run -a node tests/clipboard-extension-421.cjs`: loads the complete extension with its actual manifest and fixed key. A separate HTTPS-origin fixture tab writes to the real browser clipboard while the editor is unfocused. Actual extension APIs are used for offscreen, messages and storage. Checks image pixels/dimensions, fixed-folder and desk-root destinations, native Ctrl+V, pause, retained bad entries, a legacy queued screenshot, persisted reload and a full browser/service-worker restart.
- Existing `tests/clipboard-407.cjs` and `tests/library-420.cjs` remain in CI to check prior manual paste/copy, search/date and OCR behavior.

The full-extension test is required before packaging. It uses Playwright's public CDP connection with `noDefaults: true`, so its hidden/unfocused editor assertions use native tab focus rather than Playwright focus emulation. It selects the extension service worker by the ID derived from the retained manifest key. A definition of a test is not evidence it passed; consult the linked PR/build logs for the run result.

The end-to-end scenario uses one editor tab, reusing that tab when Chrome restores it after restart. The test asserts this through the native tabs API. It does not verify concurrent editing in several editor tabs.

## Local evidence and limits

The collector runtime regression and existing HTTP-fixture clipboard regression passed locally. Running the new importer regression against the unchanged 4.0.20 ZIP reproduced `loadImage is not defined` from both the queued PNG importer and an actual Ctrl+V event, with no image created and the queue retained. The HTTP fixture uses real clipboard bytes but fixture Chrome APIs, so it is not the full extension test. A full local Chrome process cannot run in the supplied container because its process-singleton socket is denied. The full-extension regression therefore runs on the existing Linux GitHub Actions runner with Xvfb and Chromium.

This is not a test on the owner's Windows installation, Windows Snipping Tool, external accounts, cloud sync or the owner-device update-button transition. Polling observes the current clipboard at 1.5-second intervals and cannot guarantee intermediate copies replaced between polls. Existing extension identity/storage keys are unchanged.


## Published artifact and evidence

- [PR runtime/build 42006617269](https://github.com/jeep-jim/OSMINOG/actions/runs/42006617269): **success**, including all native clipboard assertions and ZIP packaging.
- [Workdesk/document regression 42006617233](https://github.com/jeep-jim/OSMINOG/actions/runs/42006617233): **success**.
- Candidate `fbb2e1416dbf05c407ee83cb31589dae8c71581c` and merge `5aeb71b3a56258d34dbdbc488a042b65360135d2` have the same tree `93137712502d84ce5417983d37044d53bbc87612`.
- Artifact ID `13405301415`; inner ZIP `OSMINOG-Chrome-4.0.21-CLIPBOARD-FIX.zip`, 9400407 bytes, SHA-256 `f0872c6f35f128956f9a55571cd0541cc86195bb152560b6a7b165919e7c2a1a`. Delivered without repackaging.
- [Publisher 42007754782](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/42007754782): **success**. [Public release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/chrome-v4.0.21) and dev feed refer to the identical size and digest.

The native log records Chrome 151.0.7922.34, the stable extension ID, a truly hidden/unfocused editor, and a restored single editor tab after browser restart. A later main run completed all nine functional assertions but returned exit 1 during final cleanup; its artifact was not used. The test-only cleanup correction waits for process closure, retries temporary-profile removal and logs final errors, with overall PASS emitted after cleanup.


**Final verification / 2026-11-05:** [main runtime/build 42009411240](https://github.com/jeep-jim/OSMINOG/actions/runs/42009411240) on `74d77cd9902adc48400ba1fb4d9e42b50fc3666d` completed **success**, including native clipboard scenarios, browser cleanup and verified ZIP packaging. No failed steps remain. The published ZIP remains the immutable artifact from successful PR build 42006617269, with SHA-256 `f0872c6f35f128956f9a55571cd0541cc86195bb152560b6a7b165919e7c2a1a`.


