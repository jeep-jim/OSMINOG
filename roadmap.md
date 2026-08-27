# OSMINOG — рабочая дорожная карта

Date: 2026-08-27

This file is the project memory for the OSMINOG rebrand and release system. Update it after every completed step. Do not ask the owner to reconstruct source from local folders; GitHub is the source of truth.

## Product

OSMINOG is a visual AI workspace where briefs, notes, files, code, websites, design, agents, nodes and decisions live on one canvas. Primary domain: `osminog.red`.

Temporary visible identity: a plain red circle (`#FF2D2D`) plus `OSMINOG`. The owner will replace the logo later.

## Non-negotiable rules

1. Never require the owner to select an application-source folder for an update.
2. Never ship another repair ZIP, CMD or PowerShell script as the normal update path.
3. GitHub stores canonical source, release metadata, checksums and recovery history.
4. One release registry serves every platform; each platform uses its native installation adapter.
5. Preserve the fixed Chrome manifest key, extension ID, existing projects, storage keys and protocol compatibility.
6. A build is not called tested until its real install/update/rollback path has run end to end.
7. Do not publish a user-facing artifact from a truncated or generated placeholder source bundle.
8. The development updater owns deterministic application folders; project/data folders remain separate.
9. New visible branding is OSMINOG everywhere. Legacy names remain only where compatibility requires them.
10. Every stable release receives a complete recovery artifact, checksum and immutable Git reference.

## Current recovery facts

- Last user-confirmed stable product behavior: BriefCraft 3.8.43.
- Current user-visible installation that was tested during updater work: 3.8.58, but its folder-based update path failed.
- Public development feed currently contains 3.8.59 metadata/fileset.
- The owner removed local build folders; no local file is a prerequisite anymore.
- The previously committed `bootstrap/osminog-source.zip` is corrupt and must not be used as source.

## Phase 0 — recover and normalize GitHub source

- [ ] Scan all reachable objects and history in `jeep-jim/BriefCraft` and `jeep-jim/chernogram_new` for complete extension packages, manifests and deleted source files.
- [ ] Recover the newest complete trustworthy extension base into a canonical source directory.
- [ ] Replay versioned transforms in order and verify exact resulting hashes.
- [ ] Compare reconstructed source with published 3.8.57/3.8.59 filesets.
- [ ] Commit a source inventory and reconstruction report.
- [ ] Remove the corrupt bootstrap ZIP and failed extraction workflow.

## Phase 1 — OSMINOG Chrome source

- [ ] Establish `apps/chrome-extension/` as the complete canonical extension source.
- [ ] Change all visible `BriefCraft`, `BriefCraft AI` and `RichCraft` copy to `OSMINOG`.
- [ ] Use the red-circle temporary mark for extension icons, header, popup, onboarding and updater UI.
- [ ] Point visible links and support copy to `osminog.red`.
- [ ] Preserve manifest key, extension ID and legacy storage/project compatibility.
- [ ] Add automated checks: manifest parse, JavaScript syntax, duplicate HTML IDs, forbidden visible legacy names, icon presence and ZIP integrity.

## Phase 2 — unified release registry

- [ ] Define one signed release schema with `dev`, `beta` and `stable` channels.
- [ ] Store version, platform artifacts, hashes, signatures, migration requirements, rollback target and release notes.
- [ ] Generate immutable artifacts in CI from canonical source only.
- [ ] Publish the public feed separately from private source.
- [ ] Retain the previous working release and automatic rollback metadata.

## Phase 3 — OSMINOG Dev Hub for Chrome development

- [ ] Build a normal Windows application, not a script archive.
- [ ] Own one deterministic extension directory under `%LOCALAPPDATA%\OSMINOG\Dev\chrome-extension`.
- [ ] Register and diagnose the Native Messaging host.
- [ ] Install/import an existing compatible extension without asking for a folder during routine updates.
- [ ] Download, verify, stage and atomically activate a release.
- [ ] Preserve the previous version and offer one-click rollback.
- [ ] Show real progress and real errors in the UI; write a readable log.
- [ ] Reload Chrome only after verification succeeds.
- [ ] Create a signed installer and an uninstall path that never removes user projects.

## Phase 4 — required end-to-end test gate

Before the owner receives Dev Hub:

- [ ] clean Windows installation;
- [ ] migration/import of an existing compatible extension;
- [ ] update from version N to N+1;
- [ ] automatic extension reload;
- [ ] project/settings persistence;
- [ ] rollback N+1 to N;
- [ ] repeat update after rollback;
- [ ] Windows reboot and update again;
- [ ] offline and corrupted-download errors;
- [ ] second Chrome profile behavior;
- [ ] no CMD, PowerShell or folder picker;
- [ ] uninstall keeps projects/data.

## Phase 5 — platform adapters

- Chrome beta/stable: Chrome Web Store delivery behind the same in-product update UX.
- Windows/macOS desktop: signed native updater.
- Android: stable application ID and signing key; internal distribution then store in-app updates.
- iOS: TestFlight/App Store when explicitly started.
- Web/PWA: atomic deployment with service-worker versioning.

## Done

- [x] Product renamed to OSMINOG.
- [x] Domain fixed as `osminog.red`.
- [x] Temporary brand rule fixed: red circle + `OSMINOG`, nothing else.
- [x] Dedicated branch `rebrand/osminog-devhub` created.
- [x] Failed folder-selection repair approach stopped.
- [x] GitHub, not the owner's computer, declared the source of truth.
