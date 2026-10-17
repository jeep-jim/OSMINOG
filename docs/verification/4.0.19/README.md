# 4.0.19 — routine automation and observed results

PR: https://github.com/jeep-jim/OSMINOG/pull/60

## Use

Enable the existing autopilot control once for the project, then send a task in the provider tab. Recognized search submissions and Figma editor drawing gestures no longer request a separate native approval. Publication, message sending and purchases retain confirmation; sensitive actions remain blocked. Turning autopilot off restores per-action approvals.

The source chat receives a clearly labelled **executor result** overlay, without adding service instructions or browser context to its composer. The vendor's original conversation and the executor conversation are distinct; this release does not claim that the original vendor response reads the execution feedback. The executor receives actual observations after browser and canvas actions.

## Added tools

- `canvas.copy {ids:[...]}` and `canvas.paste {dx?,dy?}` use a project-local object clipboard. They do not alter the operating system clipboard. Layout objects/images and single embedded files are supported; mixed file batches fail without partial application.
- `canvas.inspect {}` returns up to 200 object summaries and the current revision. Mutating tool observations prioritize newly created/changed IDs and exclude embedded image bytes.
- Existing `search_canvas`, `get_object`, `canvas.create`, `canvas.move`, `canvas.duplicate`, `readFile`, and `writeFile` remain available to the executor.
- `browser_navigate {id,url}`, `browser_back {id}`, `browser_forward {id}`, and `browser_reload {id}` target an existing permitted tab, followed by a fresh browser read. They cannot control provider chat tabs.

Tool extensions must be registered in the workspace contract and executor allowlist, validated against project/context revision, and return actual outcomes. Mark mutations for manual mode approval and retain live target risk checks for native input.

## Validation scope

145 local tests pass. Windows acceptance includes actual search input/submission, native input on a synthetic Figma-origin canvas, and real board copy/paste with new IDs and positions. This is not a live Figma or live provider-account acceptance test. Logs under `logs/orchestrator.log` in the test artifact record the native fixture steps. Existing image-import and chat execution regression tests remain in the suite.



Windows candidate run https://github.com/jeep-jim/OSMINOG/actions/runs/39001028407 and agent runtime run https://github.com/jeep-jim/OSMINOG/actions/runs/39001028353 passed. All 10 native acceptance scenarios passed in the installed copy. Source head 1b7cdcd946d84e9943e3fec5fe991e4add643700; merge 176cd75b2b232e411f677201d18e1749bbeda351. Runtime source fb4e92cc57c2d73792fd19e076a19179ef767a07 matches all 437 merged blob files. Runtime size 4844761, SHA256 6b27cacaa69fdf15e0d405489913a93e4ab77a47ea663c30641b5f66032f414f. Candidate artifact SHA256 2df827cb00f16f7bfa77e2c7da148a26f37091031d245daf15dfbb79c3cc4521.

Release https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/39001588501 passed: UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.19, upgrading 4.0.18 with retained local data. Public Windows JSON feed and latest.yml point to 4.0.19. Installer size 115231165; SHA256 53921a82e8b9103af8074fb29112662db7c0279113db1f0fc3167f2fe47476e1.
