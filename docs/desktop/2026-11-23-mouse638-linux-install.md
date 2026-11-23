# Mouse 6.0.38 — Linux installation follow-up

## Published 6.0.38 and accepted Ubuntu 24.04 evidence

The common accepted source is `b9d243dd7507da3c5b5397c62391315c09794db8`,
merged in [PR #203](https://github.com/jeep-jim/OSMINOG/pull/203) as
`4d3953456f09448c5b2c2bd463496f27fe6c8a9e`.
[Source run 45185688213, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/45185688213)
passed native job `137730561367` and clean Ubuntu 24.04 job `137736459380`.
The three independent source reader groups accepted the same packages and
ASAR `8114744cebad155762842bffeafaa3b85fba1e7836e26f3f2cce63c9785b377e`.

| Package | Bytes | SHA256 |
| --- | ---: | --- |
| Mouse-Browser-6.0.38-Linux-x64.AppImage | 127949079 | `ad8192a991b6485e447e6e33acd899567df885095bf3f7581c0a6d1457bbad90` |
| Mouse-Browser-6.0.38-Linux-x64.deb | 101179004 | `08cb079dda38f049d9dd56bebba22a1ae1e575e0c1e0555e4e9e8ab655cd4d8b` |

The Noble receipt binds that exact deb and ASAR. Clean dependency verification,
host installation, native write and restart/read completed in 21.246, 8.535,
61.938 and 1.368 seconds respectively. Processes 6263 and 7023 exited with zero;
namespace policy remained unchanged. This is Ubuntu 24.04 CI evidence, not a
result on the owner's Linux Mint 22.3/X11 device.

[Publisher run 45202332513, attempt 2](https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/45202332513/attempts/2)
completed fresh installed acceptance, publication and anonymous updater checks
on publisher `f50204b9c4533ea3bb8623c80919acb9a7b4ed46`.
The [public release](https://github.com/jeep-jim/OSMINOG-Releases/releases/tag/mouse-linux-v6.0.38-x64)
was published at 2026-11-23 15:33:30 UTC. All five public assets were downloaded
in full without authorization and matched their recorded SHA256 values. The
published manifest, verification report and checksum file also match the raw
publisher artifact; manifest and checksums match the accepted source candidate.

Both [latest feed](https://github.com/jeep-jim/OSMINOG-Releases/blob/e3df06614825d6ba0bd37e26a50fde19b15042ec/platforms/linux/mouse-x64/latest.json)
and [version feed](https://github.com/jeep-jim/OSMINOG-Releases/blob/e3df06614825d6ba0bd37e26a50fde19b15042ec/platforms/linux/mouse-x64/releases/6.0.38.json)
contain these exact package URLs, sizes and hashes. The actual published 6.0.37
updater discovered, downloaded and verified both formats anonymously and
confirmed the current-version check. Source attempt 1 remains distinct from
publisher attempt 2: publisher attempt 1 hit a GitHub API rate limit before
native work; the unchanged retry passed.

From the directory containing the downloaded deb, install with:

```sh
sudo apt install ./Mouse-Browser-6.0.38-Linux-x64.deb
```

The screenshot of an AppImage program chooser did not establish the cause of
the owner's earlier launch issue. The dependency correction and CI result do
not claim that this particular device has now been tested. Historical evidence
below remains available for targeted investigation.

## Earlier accepted Ubuntu 24.04 evidence

Source `eb948797dd919ade788349efd152728d47614244` passed both jobs in
[run 45179250078, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/45179250078)
and all three independent publisher e520 reader groups. Actual deb bytes:
101,180,112; SHA256 `024b98fec9213912018760b7bf4e9b5a36640253e23bcb1d10046953f8e119b3`.
The Noble evidence uses that exact package and the accepted main ASAR
`8114744cebad155762842bffeafaa3b85fba1e7836e26f3f2cce63c9785b377e`.
Clean dependency verification took 22.665 seconds, host installation 9.089
seconds, native write 61.950 seconds and restart/read 1.421 seconds. Both
native processes, PIDs 6357 and 7132, exited successfully with unchanged
namespace policy. This does not claim a result on the owner's Mint device.
Publication still awaits a common source with passing modern Windows
acceptance and the ordered publisher runs.

## Earlier accepted Ubuntu 24.04 evidence

Source `e79f14bcee3355efed9ab3dfd2fc65dde5d0eff6` passed both jobs in
[run 45172737181, attempt 1](https://github.com/jeep-jim/OSMINOG/actions/runs/45172737181).
Independent publisher e520 accepted the main Linux evidence, rendering/Store
evidence and Noble evidence. The actual deb is 101,179,068 bytes, SHA256
`5ac5335d4be1fff1b60ed14c7ee1e8055b5ceb83d1b79a89b2d26b75e6d2fe26`.
Noble used those same bytes and the main job's ASAR. Its clean dependency
check took 29.134 seconds, host installation 9.836 seconds, native write
61.468 seconds and restart/read 1.719 seconds. Both native processes exited
successfully, with distinct PIDs and unchanged namespace policy.

This accepts that exact source on CI Ubuntu 24.04. The common release remains
blocked by a separate Windows fixture-cleanup failure; any successor source
must complete its own native evidence. No owner's Mint-device result is claimed.

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

On `6666a54`, host update completed in 19.283 seconds, but the following
220.720 seconds did not finish the 71.6 MB download before that 240-second
bound. The install log has 79 package `Get` lines, all from the HTTP EC2 mirror,
with no `Ign` or `Err` lines and no use of HTTPS fallback. There is no final
`Fetched` line, unpacking or configuration.
[Noble job 137677670055](https://github.com/jeep-jim/OSMINOG/actions/runs/45168906068/job/137677670055)
retained exit 124 and the host log; clean dependency and native checks were
skipped. The successor therefore prioritizes the official HTTPS archive and
security mirrors on both host and container, retaining recognized cloud
mirrors as later fallbacks. The time limits do not increase again.

The successor changes only CI dependency preparation. Host APT now has
15-second HTTP/HTTPS inactivity limits, one retry and a 240-second outer
bootstrap deadline. Its dedicated log records update/install progress and
the actual command and log-writer exit statuses; the workflow step retains
time to save that evidence on failure.

Before changing the host's mirror list, a read-only helper checks that every
active Ubuntu URI field references that exact list. Only the list is installed
with elevated permission. Source and mirror configuration bytes, sizes and
hashes are logged before and after; the source file must remain byte-identical.

The clean container receives read-only mirror configuration and the runner's
public CA bundle as a separate APT configuration file. Its mirror order matches
the host's official HTTPS archive/security preference. APT uses the explicit
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

Local validation after the transport correction: all eighteen Linux Python
verification/binding tests passed. Actual shell regressions cover trust-field
preservation, read-only mounts, failed update/install and host exit/log handling.
The container and host probes pass Bash syntax checking; workflow YAML retains
separate original and Ubuntu 24.04 verification artifacts. The accepted Ubuntu 24.04
execution is recorded above; this record does not claim validation on the owner's
Mint device or a public 6.0.38 release.
