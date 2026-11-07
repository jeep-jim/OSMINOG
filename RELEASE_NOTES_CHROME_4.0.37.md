# OSMINOG Chrome 4.0.37 — update recovery candidate

The owner reported three browser closures after pressing Update for 4.0.36. The exact owner-device crash cause has not been observed. Source inspection confirmed that the legacy folder updater recursively reads every file under the installation folder into memory, then structured-clones that entire snapshot while retaining an expanded ZIP. This release removes that unbounded operation.

## Changes

- Updater 2 processes bounded package entries and backs up only replaced program files in a durable per-file journal. It does not enumerate unrelated folders.
- A failed or interrupted installation restores original files and removes newly introduced program files; manifest is the final commit point. Concurrent installations are rejected.
- A browser-independent temporary tab holds a normal browser window open during extension reload. Only the target version can acknowledge startup; user-navigated temporary tabs are preserved.
- The ordinary update button saves the desk, installs the verified package, and arms the exact version handoff before reloading. No blind reload fallback.
- A separately generated self-contained recovery page uses the new updater for the initial transition from the old updater. The new toolbar popup detects staged disk files and offers Finish update. This bootstrap must pass its real Chromium test before distribution.
- Fixed extension key, Owner Authenticator and persisted project-data keys are preserved. Embedded browser remains retired.

## Delivery and verification

Do not direct the owner to repeat the old updater path: it executes old code before installing the new package. The release feed must require updater 2.0.0. The one-time recovery page is an explicit user-controlled repair, not a claim that an already running installation has been patched remotely.

Required gates include the existing full regression suite, transaction/rollback/error/limit tests, handoff tests, a real Chromium native-folder update, ordinary-tab preservation and a fresh-popup bootstrap check. CI evidence is recorded as ciVerified; runtimeVerified remains false because the owner Windows profile has not been observed.

Publication and the owner-device result are not claimed by this source note. Record exact successful runs, asset hash, feed state and remaining limits in OSMINOG_PROJECT_LOG.md after they exist.
