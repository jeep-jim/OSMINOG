# OSMINOG Chrome 3.14.3 — DESKTOP ACTION RECOVERY

Focused repair over 3.14.2.

- compact utilities such as stopwatch/timer/calculator open as frameless transparent desktop widgets instead of a white application container;
- sandbox widget documents are forced to transparent, intrinsic-size html/body and the desktop shell no longer reintroduces a 46px app header for compact widgets;
- requests to find/download/place photos, images or files on the desktop/canvas are classified as real canvas execution and must finish through `asset_create` with a real object id;
- product/UI/layout requests for OSMINOG itself enter a strict source executor that reads and writes `jeep-jim/OSMINOG` rather than drawing a canvas mockup;
- version advanced to 3.14.3 while preserving the fixed Chrome extension key and current 3.14 desktop design.

Runtime smoke tests are still required after owner update: compact stopwatch, internet photo to desktop, and a small real OSMINOG UI source edit.
