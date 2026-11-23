# Mouse 6.0.38 — Linux installation follow-up

## Owner report

On 23 November 2026 the owner clarified that Linux installation does not work
and ordered public releases as macOS, Linux, then Windows. The supplied images
show Linux Mint 22.3 Cinnamon 64-bit, X11, and an “Open with” chooser for
`Mouse-Browser-6.0.37-Linux-x64.AppImage`, offering disk-image utilities.
They do not show an attempted executable launch, its stderr, or a proven GPU,
FUSE, AppArmor or missing-library failure.

AppImage's own [run instructions](https://docs.appimage.org/user-guide/run-appimages.html)
require executable permission before running the file. Mouse already builds a
separate `.deb` package for package-manager installation; no new format is
being invented in 6.0.38. Existing packages and their published feeds remain
immutable.

## Confirmed corrections

- The 6.0.38 Linux verifier still expected `fromVersion=6.0.36` while the
  actual predecessor helper now upgrades published 6.0.37. Its identity and
  report checks now consistently require 6.0.37 → 6.0.38 for both deb and
  AppImage. The check still rejects a missing format or wrong platform.
- `readelf -d` on the pinned Electron 44.5.0 Linux executable lists
  `libgbm.so.1` and `libasound.so.2` as directly needed libraries. Mouse's
  custom deb `Depends` omitted both, while the existing CI preinstalled them.
  The package now declares `libgbm1` and `libasound2t64 | libasound2`.
  Ubuntu's package index identifies [libasound2t64 for 24.04](https://packages.ubuntu.com/en/noble/libs/libasound2t64)
  and [libasound2 for 22.04](https://packages.ubuntu.com/jammy/libasound2).

The locked electron-builder 26.15.3 package already supplies an application
AppArmor profile and an installation hook for it. These are retained. Ubuntu
documents [its user-namespace policy and per-application profile support](https://documentation.ubuntu.com/release-notes/24.04/).
Neither browser sandbox flags nor host user-namespace policy are disabled.

## Additional acceptance

The existing full Ubuntu 22.04 native package, AppImage, updater and profile
checks remain required. A dependent Ubuntu 24.04 job uses the same verified
candidate bytes and source SHA. It first installs the deb with APT in a clean
Ubuntu 24.04 container using only the package's declared dependencies, then
checks the executable and shipped shared/native libraries for unresolved
dynamic dependencies. This dependency check is not a browser launch.

The job separately installs the deb on its Ubuntu 24.04 host and runs the
existing native WRITE/READ scenarios as an unprivileged user. These check real
X11 input, both theme captures, browser renderer sandbox facts and profile
restoration in a different process. Restricted-user-namespace hosts must have
the package's matching AppArmor profile. Host namespace policy is recorded
before and after and must stay unchanged. No test changes the owner's machine.

Local validation: seven Python verification/binding tests passed, the container
probe passes Bash syntax checking, and workflow YAML has separate original and
Ubuntu 24.04 verification artifacts. Native Ubuntu 24.04 execution is pending;
this record does not claim validation on the owner's Mint device or a public
6.0.38 release.
