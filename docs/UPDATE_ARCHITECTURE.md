# BriefCraft update and recovery architecture

Status: adopted 2026-08-27 after the legacy folder-based owner updater failed across different PCs.

## Core rule
The installed BriefCraft application must never depend on a user-selected local source folder for product updates.

## Source of truth
- `main` remains the private source repository.
- Every confirmed working build gets an immutable recovery ref and an entry in `versions/index.json`.
- Full packaged builds must be archived; patch manifests alone are not an acceptable backup.
- The fixed extension `key` / extension identity must be preserved.

## Chrome distribution
For Windows/macOS Chrome, normal users and the owner development machines receive executable extension updates through the Chrome Web Store. The development channel should be a Private/Trusted Testers or clearly-labelled BETA item until production release.

GitHub stores source, version history, build artifacts, changelogs and CI metadata. GitHub is NOT used as a remote JavaScript execution source inside Manifest V3.

The BriefCraft `Update` button should request/check the browser-managed update and report the result. It must not request a local application-source folder.

## Development workflow
1. Work on a branch / main source tree.
2. Build a complete extension package.
3. Run static checks and smoke tests.
4. Archive the full build under its version and create an immutable recovery ref.
5. Publish the BETA package to Chrome Web Store trusted testers.
6. Owner machines update through Chrome; projects remain in their normal workspace/data location.
7. Only after live confirmation mark that build `stable` in `versions/index.json`.

## Rollback
Rollback means publishing/reinstalling a complete known-good package, never trying to reverse arbitrary patches inside a user's local folder.

The user-confirmed recovery point is BriefCraft AI 3.8.43. Historical commit for its update manifest: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
Recovery branch: `recovery/briefcraft-3.8.43-stable`.

## Repository visibility
Keep the source repository private. Making it public does not enable normal Chrome self-hosted updating on Windows/macOS and would unnecessarily expose product source. If a public download mirror is ever desired, create a separate release-only repository containing packaged artifacts, not the working source tree.

## Future desktop app
A future native desktop BriefCraft build may use GitHub Releases or another signed update feed through a native updater. That is separate from Chrome extension update rules.
