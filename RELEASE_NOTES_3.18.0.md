# OSMINOG Chrome 3.18.0 — PRODUCT CORE RECOVERY

This release restores the simple product model that worked in the early 3.11 generation while keeping the 3.17 generative application runtime.

- The updater now checks GitHub Contents API, raw GitHub and jsDelivr independently, chooses the highest valid feed and never reports “up to date” when every feed source failed.
- The top bar exposes two explicit states: AI for the connected assistant session and Poseidon for owner-only source/product development.
- Normal user capabilities do not require permission toggles. Canvas, files, apps, graphics, web tools and project work remain available by default.
- Access is only human canvas sharing: invite/link plus view/comment/edit role.
- User GitHub project repositories return as a separate integration and do not grant Poseidon.
- Google Drive is surfaced again through the existing account/Drive API. OAuth still requires a publisher-configured Google OAuth client ID.
- Any web service can be added by URL and uses the service favicon by default; authorization happens on the real service session.
- Old test modules that were incorrectly marked system become deletable unless their id is a real `system.*` module.
- Module Store deletion supports both user-created applications and user-added web services.
- Header/action alignment and chat nested-container styling are simplified to recover the cleaner 3.11 interaction language.
- 3.17 GENERATIVE APP RUNTIME is preserved: applications are generated per request, can be focused and updated, and retain rollback/file/capture/runtime capabilities.

Owner product-source changes remain protected by Poseidon/Owner Guard. Normal users never need Poseidon for ordinary OSMINOG work.
