# Mouse 6.0.38 — Linux installation follow-up

## CI preparation failures and correction — 23 November 2026

Source `02538ac9727bd20a3e2a155fc64ebb7733510c26` passed the main installed
Linux job in both attempts of [run 45154295105](https://github.com/jeep-jim/OSMINOG/actions/runs/45154295105).
Both actual package archives were also accepted by the independent publisher
Linux and rendering/Store readers. The additional Ubuntu 24.04 gate did not
complete, so these results do not authorize publication yet.

- Attempt 1, Noble job `137628954314`: the clean container's APT update fetched
  33.9 MB in 436 seconds. Dependency installation had started when the existing
  480-second limit expired; `ldd` and native Ubuntu 24.04 launch were not reached.
- Attempt 2, Noble job `137640791827`: host `apt-get update` selected the runner's
  AWS cloud mirror, then tried its HTTPS archive fallback. Its last download
  line was at 10:48:59 UTC; the job was cancelled at 11:08:56 by the existing
  20-minute limit. Host-tool installation and the verifier never started.
  There is no Noble verification artifact for attempt 2.

The logs establish stalled dependency preparation, without identifying a
particular network failure or a Mouse runtime defect. The runner's mirror
selection is defined in the pinned
[official runner-images source](https://github.com/actions/runner-images/blob/0e63d4f9d2c29043b4cf1d2f40d1812a7cde1369/images/ubuntu/scripts/build/configure-apt-sources.sh).
The failed attempts remain retained separately from any successor evidence.

The first bounded successor, `6c2c690`, passed host APT update in 14.21 seconds.
Fetching 71.6 MB then took 93 seconds, including retries: its log contains
208 `Ign` lines for the HTTP EC2 mirror and 104 successful `Get` lines for
the HTTPS archive fallback. Package setup reached libc-bin triggers before
the new 120-second host deadline expired.
[Noble job 137664701272](https://github.com/jeep-jim/OSMINOG/actions/runs/45164749324/job/137664701272)
retained the actual host log and exit code 124; it did not reach the verifier.
The auxiliary bootstrap allowance is therefore 240 seconds, with a five-minute
step limit for termination and log handling. This changes neither native
acceptance budgets nor the overall 20-minute job limit.

The successor changes only CI dependency preparation. Host APT now has
15-second HTTP/HTTPS inactivity limits, one retry and a 240-second outer
bootstrap deadline. Its dedicated log records update/install progress and
the actual command and log-writer exit statuses; the workflow step retains
time to save that evidence on failure.

The clean container receives read-only mirror configuration and the runner's
public CA bundle as a separate APT configuration file. It prefers the runner's
known cloud mirror and retains the official runner's HTTPS archive/security
fallbacks. APT uses the explicit
[`Acquire::https::CAInfo` option](https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-https.1.html)
to verify HTTPS without installing an extra CA package in the minimal image;
peer and hostname verification remain enabled. The bundle must exist and be
nonempty before Docker starts, and its size and SHA256 are recorded.
Only the Ubuntu repository URIs change; suites, components, keyring and
`Signed-By` remain intact. APT still verifies signed indexes and packages, and
an incomplete update is an error. Source files, mirror bytes and their hashes
are logged. No host package database, indexes or libraries enter the container.

The sole explicit package install remains `/candidate.deb` with
`--no-install-recommends`. The 480/180/300/100-second dependency, installation
and native-process limits, full `ldd` checks, sandbox/profile checks and the
20-minute job limit are unchanged. The successor still needs a complete
fresh Ubuntu 24.04 result before release.

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

Local validation after the transport correction: all sixteen Linux Python
verification/binding tests passed. Actual shell regressions cover trust-field
preservation, read-only mounts, failed update/install and host exit/log handling.
The container and host probes pass Bash syntax checking; workflow YAML retains
separate original and Ubuntu 24.04 verification artifacts. Native Ubuntu 24.04
execution is pending;
this record does not claim validation on the owner's Mint device or a public
6.0.38 release.
