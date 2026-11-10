# OSMINOG Light 5.0.0 candidate

The owner's 2026-11-10 request supersedes the previous full-tool Chrome scope. This is an independent minimal runtime, not a stylesheet hiding the old app. `python3 light/build.py` packages only 21 reviewed files and the unchanged folder-update/handoff/recovery and owner-identity resource. No old editor, creative tools, embedded AI browser, autonomous agent, OCR engine or other providers are loaded. Android/ocean and previous archives are untouched.

## Bounded storage and rendering

IndexedDB `cards` stores metadata with at most 512 preview characters; `files` stores original Blobs separately. A spatial index queries a bounded viewport (120 records / 256 cells maximum). At most 24 previews, each 384 px long edge, are attached. One worker decodes one supported image at a time; dimensions are checked before decoding. Unsupported formats, images above 16 MP or preview inputs above 16 MiB remain downloadable without decoding. The modal uses one 1280 px preview; closing revokes URLs. No full-workspace JSON, media payload messages, full archive enumeration on startup, or per-pointer persistence. Individual originals up to 32 MiB, text up to 1 million characters. Clipboard inputs up to 8 MiB, sequential 2.5-second polling. These are allocation/work limits, not total process-RAM guarantees.

Free: 3 desks, 100 image captures/imports per UTC calendar month. Usage and original/card insertion commit in one transaction; deletion does not refund quota, legacy import does not consume quota. Pro proposal: $6.99/month, 10,000 images/month, 1,000 desks, sequential ZIP desk export. No checkout or entitlement backend yet; production always Free. No local switch is represented as a paid subscription. Server-verified entitlements and billing reconciliation are future required work before sale. Individual downloads remain free.

GPT/DeepSeek open in a separate system-browser tab. Optional in-app API requests use an explicit key/model and explicit submit; keys stay only in input memory, archives are never auto-sent. API access is optional Chrome host permission. Only selected note text may be added with consent. Provider responses are rendered as plain text, bounded to 1 MiB/2048 requested tokens, with timeout/cancel. No live paid-provider request is asserted without a real test.

## Existing data

Explicit import reads prior per-item IndexedDB stores one record at a time and keeps the sources. The monolithic `briefCraftStudioV2` snapshot is read only after `getBytesInUse` confirms at most 16 MiB; larger snapshots are left intact with a visible block. No prior full editor is launched to migrate. Large snapshot recovery, unsupported historical creative objects, old per-item editing journals, and cross-install desktop transfer need separate acceptance before claiming complete archive migration. Never delete the old extension/profile to install this candidate. The candidate does not silently present unimported content as an empty legacy archive.

## Desktop

`light/desktop`: separate Electron process with local-only UI, sandbox, context isolation, no renderer Node, denied navigation/new windows, two fixed external AI URLs. No embedded browser or code execution tools. Native clipboard and streamed save IPC validate the calling main frame. Original desktop profile stays untouched (`com.osminog.light` is a separate product). Windows x64 NSIS and universal macOS DMG/ZIP builds have native launch/storage/reload smoke gates. Signing/notarization is not configured; unsigned artifacts must be labelled accordingly. Windows/macOS CI launch is not owner's hardware acceptance. Installer in-place upgrade and old-desktop migration are not yet verified.

Extension native test: 3,000 4K image records, repeated viewport movement, ≤120 card DOM nodes / ≤24 URLs, GC heap growth gate 32 MiB, exact full-text edit/reload and native clipboard. Unit tests cover atomic quota, binary separation, bounds, dimensions before decode, and real streaming ZIP CRC. Never infer total Chrome RSS/GPU memory or elimination of the owner's crash from JS heap alone.
