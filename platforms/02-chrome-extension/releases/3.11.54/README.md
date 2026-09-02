# OSMINOG 3.11.54 — OWNER POSEIDON PUBLISH

This release adds the owner-only publication workflow for any selected local OSMINOG source folder.

- «Poseidon Source» is renamed to «Poseidon».
- «Опубликовать» appears below «Обновить связь» after a real source write.
- Pending publication survives refresh, reload and extension update.
- Publication archives source to `jeep-jim/OSMINOG`, publishes the ZIP to `jeep-jim/OSMINOG-Releases`, and updates the dev feed.
- The marker clears only after success.
- The compact × action requires confirmation and does not delete local files.
- Owner Max controls remain owner-only.

Verification: all JavaScript syntax and JSON parsing pass; ZIP integrity passes.
