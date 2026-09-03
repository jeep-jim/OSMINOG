# OSMINOG Chrome 3.14.3 — DESKTOP ACTION RECOVERY

Focused repair over 3.14.2.

- compact utilities such as stopwatch/timer/calculator open as frameless transparent desktop widgets instead of a white application container;
- sandbox widget documents are forced to transparent, intrinsic-size html/body and the desktop shell no longer reintroduces a 46px app header for compact widgets;
- requests to find/download/place photos, images or files on the desktop/canvas are classified as real canvas execution and must finish through `asset_create` with a real object id;
- product/UI/layout requests for OSMINOG itself enter a strict source executor that reads and writes `jeep-jim/OSMINOG` rather than drawing a canvas mockup;
- version advanced to 3.14.3 while preserving the fixed Chrome extension key and current 3.14 desktop design.

Runtime smoke tests are still required after owner update: compact stopwatch, internet photo to desktop, and a small real OSMINOG UI source edit.


## 2026-09-03 — 3.14.3 DESKTOP ACTION RECOVERY

Owner test of 3.14.2 confirmed that real module creation returned, but exposed three follow-up regressions: compact stopwatch UI was still wrapped by a desktop application shell; an explicit request to find a web photo and place it on the desktop stopped at prose instead of `asset_create`; and the product-source path needed a stronger fail-closed contract so OSMINOG interface edits go to the canonical GitHub source rather than canvas mockups.

3.14.3 repairs those paths additively over 3.14.2. Compact sandbox widgets are transparent/content-sized and the desktop CSS no longer forces the normal 46px extension header on them. Internet image/file placement is promoted to an execution task and only completes after a real `asset_create` object id. Direct source mode now explicitly requires inspection and mutation of `jeep-jim/OSMINOG` and forbids canvas substitution for product UI changes.
