# OSMINOG public release registry — one-time owner bootstrap

Public binary registry: `jeep-jim/OSMINOG-Releases`  
Private source repository: `jeep-jim/OSMINOG`

## Purpose

The public repository contains only immutable packaged builds, public update feeds, schemas, release notes and verification material. Product source code remains private.

## One-time bootstrap

1. Put the current complete Chrome baseline ZIP into:
   `platforms/chrome-extension/releases/<version>/<package>.zip`
   in `OSMINOG-Releases`.
2. The public registry workflow verifies byte size, SHA-256, root `manifest.json`, manifest version and fixed Chrome key.
3. Only after the GitHub Release asset is verified does the workflow advance:
   `channels/dev/chrome-extension.json`.
4. Create a fine-grained GitHub token restricted to `jeep-jim/OSMINOG-Releases` with **Contents: Read and write**.
5. Store it as the private source-repository Actions secret:
   `OSMINOG_RELEASES_TOKEN`.

After that, future private CI builds can publish complete verified packages to the public registry without manual copying.

## Hard rules

- A release card without a verified asset is not an available update.
- A feed must never point to a missing or hash-mismatched package.
- Full immutable packages are the recovery source of truth.
- Skipping versions must be supported; updates may not require a patch chain.
- Private signing keys and product source code must never be committed to the public registry.
- Chrome production distribution remains Chrome Web Store; the public `dev` feed is consumed by OSMINOG Dev Hub for the managed unpacked development installation.
