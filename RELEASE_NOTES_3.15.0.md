# OSMINOG Chrome 3.15.0 — INTERACTIVE CAPABILITY RUNTIME

This release turns the successful image-placement fix into a broader host-owned execution layer.

- common desktop widgets (stopwatch, calendar, music player) are created directly by OSMINOG, so a provider cannot “forget” module_create after the first app;
- every provider prompt carries a fresh tool lease and app prompts use one consistent HTML→host-install contract;
- music player can read the currently selected audio file from the canvas through new sandbox permission `assets.read`;
- arbitrary embedded binary canvas files can be handed to sandbox apps without copying bytes into chat;
- audio/video files play directly in the file workbench; spreadsheet/ROM/APK files get explicit File Lab states instead of pretending they are plain text;
- Graphics Studio exposes a structured `graphics_create` runtime for native editable shape/vector/text/image layers, including masks, gradients, Bézier paths, layers, opacity and stroke supported by the core canvas model;
- Poseidon is now owner-only at the UI capability level and is enabled only after verified write permission to private `jeep-jim/OSMINOG`; ordinary users retain interactive canvas/apps/files/AI abilities without product-source access.

Important boundary: Chrome cannot natively execute Android APKs, and a SNES ROM still requires an emulator core. 3.15.0 provides the binary-asset→sandbox-app runtime needed for those adapters instead of falsely claiming universal execution.
