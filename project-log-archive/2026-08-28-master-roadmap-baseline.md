## 2026-08-28 — MASTER ROADMAP + canonical 3.10.6 GitHub baseline

### Starting state
- Current installed build: **OSMINOG 3.10.6 CANVAS CONTROL**.
- The owner supplied the exact currently installed ZIP because prior GitHub records contained build metadata but not the complete binary.
- OSMINOG Browser Presence was connected to the current ChatGPT and delivered a real live compact context for project `Новый мир` (`world-mtayth7j-25lhsc`).
- Product development had accumulated many subsystems; the owner explicitly stopped feature proliferation and requested a coherence/stability pass.

### Owner request
1. Create one permanent full roadmap covering history, current state and remaining work.
2. Keep that roadmap updated in Markdown in GitHub after every completed step.
3. Keep a live duplicate on the OSMINOG canvas so progress is visible in the project itself.
4. Start preserving OSMINOG builds in GitHub in the same practical style as Chernogram Room Alpha: a rolling prerelease with versioned assets.
5. Maintain a single release registry for all six planned platforms while Chrome extension is the only actively built client.
6. Treat the supplied 3.10.6 archive as the exact canonical baseline for further work.

### Verified baseline
- ZIP size: `308710` bytes.
- ZIP SHA-256: `c25b2ecfe0ab668993ba83d525fb867efc0f6161ad17e0f6c7e6019de9984f4c`.
- Files: `52`.
- Root `manifest.json`: present.
- Manifest version: `3.10.6`.
- Visible name: `OSMINOG`.
- Fixed manifest key: present/preserved.
- All 19 JavaScript files pass `node --check`.
- All 9 JSON files parse successfully.

### Project discipline added
- Added living `OSMINOG_ROADMAP.md` as the master current-state/roadmap document.
- `OSMINOG_PROJECT_LOG.md` remains append-only history.
- Added `releases/osminog-registry.json` with six platform lanes: Chrome extension, Windows, macOS, Web/PWA, Android and iOS.
- Chrome is marked `active-development`; unbuilt clients are explicitly `planned`, not falsely presented as existing binaries.
- Added rolling prerelease convention: `latest-osminog-dev` with unique platform/version asset names.
- Added a gated release workflow that will only publish the exact 3.10.6 binary after its repository artifact matches the expected byte size and SHA-256, and then verifies the remote release asset.
- Added a generic append-only project-log queue workflow for future updates.

### Current UX/stability roadmap captured
The master roadmap records the owner's eight current work areas: Layers/folder dock; provider/widget folders; unified `On` state; agent settings + Poseidon; one internal Browser/Service Session Manager; active octopus workers instead of idle desktop agent pills plus connection z-order; browser redesign; and Media Crew bulk-selection UX. Google duplicate sessions and real screenshot attachment transport are immediate technical priorities.

### Honest artifact status
- The exact owner-supplied 3.10.6 binary is verified locally.
- The rolling GitHub release workflow is prepared and gated.
- The binary is **not yet claimed as remotely archived** until the actual GitHub release asset exists and its remote size/digest match.

### Exact next action
- Publish and verify the exact 3.10.6 ZIP in the `latest-osminog-dev` rolling prerelease.
- Keep the canvas roadmap mirror synchronized.
- Then begin the Unified Provider/Session foundation in this order: status component → agent connection/settings → internal session manager → Google persistent session/multimodal/dedupe → Presence UI/runtime state.
- Do not add another large standalone feature before this coherence pass is complete.
