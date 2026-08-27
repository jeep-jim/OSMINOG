# OSMINOG — CURRENT STATE

Date: 2026-08-27

## Product and brand

- Visible product name: **OSMINOG**.
- Primary domain: `osminog.red`.
- Temporary identity: plain red circle `#FF2D2D` plus the word `OSMINOG`.
- The owner will provide the final logo later. Do not generate or substitute an octopus mascot.
- Legacy names may remain only in hidden compatibility identifiers until migrated safely.

## Source of truth

- Canonical work is stored in GitHub. The owner has deleted local build folders and must not be asked to recover or upload them.
- Private project repository: `jeep-jim/BriefCraft`.
- Public development feed repository/branch: `jeep-jim/chernogram_new@briefcraft-releases`.
- Active rebrand and updater branch: `rebrand/osminog-devhub`.

## Verified historical anchors

- Last user-confirmed stable product behavior: 3.8.43.
- Stable commit: `b17638ff3925214636b772d43a93dbb2ba204d5d`.
- Permanent recovery branch: `recovery/briefcraft-3.8.43-stable`.
- Registry records a reconstructed recovery package named `BriefCraft-AI-3.8.43-STABLE-RECOVERY.zip` with SHA-256 `80d44340a804547ba8ab1bda42acbd9e6cc7315d10845b8e03003966baf7bf8c`; the binary itself must still be recovered or recreated from Git history before use.
- Public feed currently publishes development version 3.8.59 over base 3.8.58.

## Updater conclusion

The folder-selection updater and subsequent repair-script approach are stopped. They failed because there was no single verified owner of the installed extension directory and the native updater was not reliably bound to the actual unpacked Chrome installation.

The accepted architecture is:

- one OSMINOG release registry;
- platform-specific install/update adapters;
- OSMINOG Dev Hub for rapid Chrome development builds;
- Chrome Web Store for later beta/stable extension delivery;
- signed native update paths for desktop and store-native paths for mobile.

Routine updates must never ask the owner to select an application folder.

## Current blocking task

Recover and normalize the complete Chrome extension source from GitHub history. The repository contains versioned transforms, release metadata and partial historical source, but the current branch does not yet contain a complete trustworthy 3.8.58/3.8.59 source tree.

A previously committed `bootstrap/osminog-source.zip` is corrupt. GitHub Actions verified its actual hash, but both PowerShell and `tar` failed while decompressing `roadmap.md`. It must not be treated as source or shipped to the owner.

## Immediate next steps

1. Scan every reachable Git object and historical path in the private and public repositories.
2. Recover candidate complete ZIPs and source files.
3. Reconstruct the newest complete extension deterministically from a verified base plus ordered transforms.
4. Commit the canonical source under an OSMINOG path.
5. Apply the visible rebrand while preserving manifest key, extension ID, projects, storage and protocol compatibility.
6. Build and test OSMINOG Dev Hub end to end before giving the owner another installer.

## Compatibility invariants

Preserve until an explicit migration is tested:

- fixed Chrome manifest `key` and extension ID `hfckimbjiahikihjoceoegilaiolmkgk`;
- existing `briefCraft...` storage keys;
- `.briefcraft.json` project compatibility;
- internal protocols such as `briefcraft.patch/v1`;
- existing Native Messaging identifiers needed by old builds.
