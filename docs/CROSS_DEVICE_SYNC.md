# Cross-device workspace: blocked prerequisites

Source audit at 7c1b3db: cloud-config.js has empty relay URLs and no googleClientId. editor.js signInGoogle requires publisher OAuth client ID. OSMINOGAccountAPI explicitly reports localFilesSync:false. Existing Drive JSON merge by whole-project updated timestamps is insufficient for concurrent editing or local file handles. Do not expose this as working device sync.

Next implementation: authenticated web/PWA client shared with the extension, server-side user ownership and per-board membership, blob storage for imported files, revision-based writes with conflict copies, tombstones for deletion, offline queue and explicit sync errors. Phone access must use the web client rather than requiring desktop Chrome extensions. Before enabling: provision an owned backend and HTTPS origin, configure OAuth redirect/client, test two independent accounts (access isolation), two devices and conflict recovery. Do not upload existing local workspaces until the user connects sync.

Current release hides an unconfigured account entry and keeps all material local. No cross-device service was provisioned or published.
