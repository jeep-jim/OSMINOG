# OSMINOG releases

OSMINOG keeps one six-platform release registry even while only the Chrome extension is actively built.

## Rolling development release

Tag: `latest-osminog-dev`

Like the Chernogram Room Alpha release, this prerelease is a living catalog of development artifacts. Every uploaded build keeps a unique platform/version filename so older builds remain available.

## Platform identifiers

- `chrome-extension`
- `windows`
- `macos`
- `web-pwa`
- `android`
- `ios`

A platform may be present in the registry with `status: planned`; this does not claim that a binary exists.

## Artifact verification

A build is archived only after its remote artifact is available and its byte size and SHA-256 match the locally verified build. Release notes or `build.json` alone are not a substitute for the binary.

## Recovery

Confirmed stable versions should additionally receive an immutable recovery ref/tag. The rolling prerelease is for convenient development history, not the only recovery mechanism.
