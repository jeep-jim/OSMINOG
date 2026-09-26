# OSMINOG 4.0.3 — Image Generation

- Restored Graphics Studio, Animation Studio and AI team runtime. Added header actions; restored agent tabs and provider selection.
- Ordinary website/layout requests use the app runtime, without Owner Unlock. Explicit product source edits still require Owner Unlock.
- Colloquial internet image requests (выкинь/закинь на холст) route to real image search/import without a connected text model.
- Added opt-in OpenAI Images API: GPT Image 2.5 Flare/Sunburst, high quality by default, portrait/landscape/square/2K PNG, up to four attached references via edits.
- Internal chat calls the configured generator directly and imports the original PNG with aspect ratio preserved. Connected ChatGPT generation remains the default.
- API key stays in page memory until reload; never stored in chat/board/settings, never echoed in errors. Explicit API domain permission. No automatic retries of paid requests. Cancellation stops waiting; completed provider requests may still be billed. Last result can be downloaded if board import fails.
- Button updater and fixed extension key unchanged.

Validation: local regression tests and mocked API tests; browser CI required before packaging. Live generation requires the user's own API project/key/balance and model access. No live paid generation or end-user session has been verified by this release. Native ChatGPT image generation remains dependent on that session's capabilities. 3D renders are images, not mesh/rig assets.
