# OSMINOG Chrome 3.14.4 — CHAT EXECUTION RECOVERY

- Selected provider is the only visible speaker. OSMINOG progress/runtime events stay in the progress strip.
- Moving response progress again shows elapsed seconds and the chat smart-follows the bottom without fighting manual reading.
- Compact widgets close their whole managed parent when their × is pressed; recreating the same widget closes stale windows first.
- Explicit internet-image-to-desktop commands use a deterministic `web_image_search` → `asset_create` path with real image bytes.
- Repeated no-tool replies stop quickly instead of running a long autonomous retry loop.
- Version badge is rendered from the actual manifest version immediately and desktop-v3 no longer overwrites it with 3.14.1.
- Interface text migrates to Normal by default; Compact and Normal now apply visibly different CSS sizes.
