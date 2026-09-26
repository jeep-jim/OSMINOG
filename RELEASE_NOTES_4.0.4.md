# OSMINOG 4.0.4 — Board Focus

Core: personal infinite boards for files, notes and editable layouts; project context for external ChatGPT.

- Top-level Sites and layouts menu: saved apps, saved editable copies, browser editor and selected layout editing. Closing a generated app preserves it in the registry.
- HTML/CSS editor within generated app windows, with save and preview. Visual editing opens a separate sanitized copy, preserving the original executable app.
- Editable copies saved in the current board and reopenable after reload. Website editor works on local copies; protected or dynamic sites may not yield complete editable HTML.
- Welcome layout fixed; close button restored; legacy translation no longer overwrites the new intro.
- External ChatGPT access made prominent. Each connected external message receives the current project map, not only counts. Exact content/images still requested on demand. Existing explicit role, route and project restrictions retained.
- Explicit copy/download of current-board text context as a fallback; no pixel-vision or live-access claims. No API key needed for context export or extension context injection.
- API image generation and other providers moved to optional/experimental actions; no claim they work in the user's native session.

Automated tests cover source editing/save/reopen, welcome dismissal, board context export and external injection. Live external ChatGPT delivery on the user's device remains unverified. Store publication is separate from GitHub release: no store listing is claimed submitted.
