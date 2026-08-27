# BriefCraft private Chrome Web Store beta bootstrap

Prepared: 2026-08-27

## Packages

### Stable recovery
- File: `BriefCraft-AI-3.8.43-STABLE-RECOVERY.zip`
- SHA-256: `80d44340a804547ba8ab1bda42acbd9e6cc7315d10845b8e03003966baf7bf8c`
- Purpose: exact reconstructed recovery package for the last user-confirmed stable line.

### Store bootstrap
- File: `BriefCraft-AI-3.8.55-CWS-BETA-3.8.43-STABLE.zip`
- SHA-256: `768b4b8035e8649da770aafbc802508360eecb4b1aa482ab7ca30a73ec584366`
- Source behavior: BriefCraft 3.8.43 stable.
- Manifest version: `3.8.55` so Chrome treats it as an upgrade from the broken 3.8.53 line.
- Legacy local-folder updater removed.
- `ownerBuild` disabled.
- Update control uses `chrome.runtime.requestUpdateCheck()` only.

## One-time Chrome Web Store setup

1. In Chrome Web Store Developer Dashboard create a separate testing item or use the existing BriefCraft item if it is already intended for trusted testers.
2. Upload the complete 3.8.55 ZIP.
3. Complete Package, Store listing, Privacy and Distribution fields.
4. Set visibility to **Private / trusted testers** and add the Google accounts used on the owner's home and work Chrome profiles.
5. Publish/submit the private beta once manually. Chrome Web Store requires this initial dashboard setup before API publishing can fully take over.
6. Install the store item on each PC. Do not use `Load unpacked` for the daily beta channel afterward.

## Runtime behavior

The in-app **Update** button asks Chrome to check the Chrome Web Store. Chrome downloads and activates an available version through its normal extension update lifecycle. No application-source folder is requested or modified.

## Future automation

After the store item exists, record these values only as GitHub Actions secrets:
- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`
- `CWS_PUBLISHER_ID`
- `CWS_EXTENSION_ID`

Never commit those secrets or a private signing key. Future release automation should:
1. build and validate a complete ZIP;
2. archive its hash and immutable recovery ref;
3. upload with Chrome Web Store API V2;
4. submit as a staged/private beta release;
5. mark stable only after live testing.

## Source visibility

The working source repository stays private. A public repository is not required for Chrome updates and would expose the product without solving Manifest V3 delivery restrictions.
