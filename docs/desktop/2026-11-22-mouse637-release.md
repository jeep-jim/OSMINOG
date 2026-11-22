# Mouse Browser 6.0.37 — one successor to 6.0.36

## Owner scope and immutable predecessor

The owner requested one release for macOS Apple Silicon, Windows x64 and Linux x64 through the existing **Обновить** control. The owner's primary computer is a **MacBook**. Native CI acceptance does not constitute installation on that physical computer.

Source work continues in [PR #193](https://github.com/jeep-jim/OSMINOG/pull/193), originally checked at `05b57d1b1accf51a67f1fa1944f2476c73fafb85`. Publication uses the existing [OSMINOG-Releases](https://github.com/jeep-jim/OSMINOG-Releases) repository and its unchanged platform channel URLs.

The release audit found no running or queued duplicate build/publication of these changes, no open release PR, and no reserved 6.0.37 tag, release, staging directory or branch. Version **6.0.37** was selected before starting the new build. Published 6.0.36 packages, tags, manifests and historical validators are immutable.

The actual installed predecessor for current upgrade and performance acceptance is **6.0.36** on all three platforms. Historical compatibility probes may additionally exercise their named old versions; they do not substitute for 6.0.36 acceptance.

## Changes carried forward

The release preserves the live desktop switching improvements, inline Agent settings and removal of tile search already published in 6.0.36.

PR #193 contributes the 72-entry language chooser, rounded resize highlight, quieter separators and address styling, a compact pane header revealed by hover/focus, the puzzle control and pinned extension shortcuts with resizable panes, and the media mini-player to the right of Nora on other desktops. Only Russian and English are translated. Other listed interface languages remain explicitly planned.

Extensions are limited to compatible unpacked folders with the existing validation and explicit install consent. Chrome Web Store installation is not supported. No claim is made about the media player's compatibility with VK; native acceptance uses owned HTTP/audio fixtures.

The three refinements requested from the previously local-only work are included:

- Language search recognizes Russian names, including both Simplified and Traditional Chinese, without enabling untranslated locales.
- A failed extension restore has a distinct RU/EN error state and removal/reinstallation guidance. Successfully restored bytes clear a stale error state.
- A real native media-started-playing event received during an outstanding read is coalesced and rediscovered after that read settles. Replacement audio elements are not discarded with the stale element; navigation, privacy, dismissal and disposal revoke queued rediscovery.

## Startup regression found in the draft

The previous macOS run stopped in the old 6.0.35 acceptance before reaching the candidate. Previous Windows and Linux candidate restarts did not reach `MOUSE_READY`; the Linux renderer's basic CDP ready-state evaluation timed out as well.

The draft introduced a renderer observer cycle: translation of body mutations unconditionally assigned the root `lang` attribute; the extension UI observed that assignment, replaced its content, and triggered another body translation. This kept producing microtasks before startup timers could run.

The fix writes `lang` only when the value changes and makes the extension observer react only to an actual language/privacy transition. `mouse-renderer-startup.test.cjs` executes both production scripts with same-value attribute mutation semantics. The original draft scripts fail both RU/EN cases because the mutation queue does not settle; the corrected scripts settle through startup, later body updates and language/privacy transitions.

## Acceptance contract

All three distributable platforms must come from one accepted source commit. Windows also retains the additional modern Windows installed acceptance job. Existing applicable profile, documents, Agent, capture, privacy and removed-search checks remain required.

The new installed feature check runs in two processes with the same isolated profile. It checks the language chooser and Russian search, extension folder loading/pinning/pane behavior, owned media and cross-desktop controls, then preserves a deliberately changed owned extension fixture. After actual restart, it checks the restore failure display and recovery. Native input and operating-system screenshots are recorded where the check asserts visible behavior.

Performance acceptance compares the published 6.0.36 installation and candidate 6.0.37 with the same 20- and 50-page workloads across five desktops. Both retain page identity, live page activity and zero desktop snapshot/native capture calls. The declared median allowance is one 60 Hz frame, **1000 / 60 ms**, for each workload. This is a selected acceptance budget, not a claim about measured runner noise or an additional speed improvement. Both 50-page runs must also meet p95 ≤ 250 ms and maximum ≤ 600 ms. Raw samples are retained and recomputed by the acceptance gate.

Final publication requires successful installed upgrade/profile checks from the exact published 6.0.36 bytes, successful native feature checks, and package/source/digest binding. The published updater module from 6.0.36 must then discover and download the new exact package from each real public channel.

The prepublication button test installs the unchanged published 6.0.36 application, confirms its updater Git blob `91ab363f926774825caf8055b2d3d81bf0d51264`, and supplies only channel/package transport through a CI-owned loopback fixture. The original version selection, SHA-256 verification, native installer and profile lifecycle remain in use. Real operating-system clicks activate the update, download and install controls. The main inspector must actually close before the Install click. The test then requires the production startup acknowledgement, a distinct visible automatically relaunched process, a native quit, and an independent fresh-process profile read. This fixture is explicitly separate from the mandatory real public-channel/download proof after publication.

On macOS this test creates the previously absent default profile so the unchanged LaunchServices relaunch uses the same data even if it does not inherit a test environment variable. Its exclusive ownership sentinel is checked after the complete profile read; only then is this CI-owned profile removed. Failure keeps it for diagnostics.

The added bounded checks account for aggregate job caps of 55 minutes on macOS, 60 on Linux and 65 on Windows. Existing individual startup, capture and profile deadlines are unchanged.

## Local verification before the source build

The combined focused JavaScript run passes **57/57** tests, covering the startup regression, three requested refinements, retained routing, feature fixtures, performance contract and the production updater's selection/checksum/install delegation. The new Python helpers pass **22/22** tests, including native window ownership, PID reuse rejection, exact sentinel requirements and refused out-of-window input. Workflow YAML, syntax and whitespace checks pass.

The broad local suite is not recorded as accepted: this scratch runtime lacks the pinned Node native headers/module and rejects Unix-domain socket creation, so native MCP/PTY cases fail there. These gates remain mandatory, unchanged, in the actual platform CI with its native dependencies.

## Publication status

Preparation and local verification are in progress. This document does not yet attest a successful 6.0.37 build, installation or publication. Final source/run/package/channel evidence will be appended after it exists. The owner must not be told that updating is available until all three actual channels serve the accepted 6.0.37 packages.
