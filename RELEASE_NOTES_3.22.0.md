# OSMINOG 3.22.0 — Scoped canvas and generated media

- Connected chat messages carry project metadata, not the full object map or note bodies.
- Canvas images are requested explicitly through tools; generation keywords no longer attach canvas screenshots.
- Re-submitting a draft replaces the previous OSMINOG context block instead of appending duplicates.
- Generated images in reused assistant containers are eligible for import. Old image sources remain excluded.
- Import succeeds before a source is marked complete; transient failures retry up to three attempts.
- Image imports precede subsequent canvas tool requests, and asset creation awaits persistence.
- Existing canvas, themes, local projects and update identity are retained.

Validation: scoped router tests and browser fixtures for five provider DOM layouts. Authenticated live image-host compatibility is not certified by these fixtures.

This is a repair release for the external-AI workflow, not the completed five-scenario desktop architecture.
