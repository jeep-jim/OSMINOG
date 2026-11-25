# Mouse 6.0.39 — opt-in network ad blocking

## Owner request and scope

Anton requested an integrated Electron AdBlock: local EasyList/RU AdList subscriptions, network cancellation for matching advertising requests, and a **“Блокировать рекламу”** settings switch that is **off by default**. The feature belongs to Mouse Browser, not the website or the unrelated AvtoCena project. Publication remains Mac → Linux → Windows, with the existing installed, profile, updater and public-package gates retained.

The implementation is a network filter, not a claim of full uBlock Origin compatibility. It cannot selectively remove an advertisement delivered inside the same response or media stream as wanted content. CSS, scriptlets, response rewriting and automatic ad-skipping are not introduced. YouTube/VK ad-free playback is therefore not promised.

## Runtime and user behavior

- `mouseControlSettings.blockAds` defaults to `false`, including profiles created by earlier Mouse versions. The trusted settings IPC persists an explicit boolean before applying the live change. The existing interface, profile identity, cookies, tabs, desktops and update channels remain intact.
- The switch is in **Settings → Privacy and library**, with Russian/English text and a short local-list status. It applies to new requests immediately; a page reload may be needed for already loaded content. Permanent settings remain read-only while in incognito.
- `mouse-main.cjs` initializes the service before restored pages start loading, and installs one `onBeforeRequest` listener on `session.defaultSession` and the real `persist:osminog-browser` Session. New private Sessions receive the same current policy and are detached when disposed. The shell is not mistaken for the browsing partition.
- Toggling changes state without replacing listeners. Each intercepted request receives exactly one callback. Disabled mode, internal schemes, top-level navigation, unknown resource types and unexpected matching failures are allowed. The callback performs no disk reads, downloads or list compilation.
- Existing Mouse runtime hooks were inspected: connection diagnostics use other webRequest events; the current extension compatibility package does not install an `onBeforeRequest` listener. Older fixture interceptors run only in their separate test processes.

## Subscriptions, local storage and resilience

The two fixed HTTPS subscriptions are:

| List | Download | Attribution / license |
| --- | --- | --- |
| EasyList | https://easylist-downloads.adblockplus.org/easylist.txt | The EasyList authors, https://easylist.to/; CC BY-SA 3.0-or-later option from https://easylist.to/pages/licence.html |
| RU AdList | https://easylist-downloads.adblockplus.org/ruadlist.txt | RU AdList authors and contributors named in the original list header; https://creativecommons.org/licenses/by/3.0/ |

Original subscription text and attribution headers are retained unmodified in `<userData>/mouse-adblock/{easylist,ruadlist}.json`, alongside exact URL, acquisition date and SHA256. No browsing URLs, request history or advertising identifiers are written there. The compiled in-memory subset is derived locally; the full lists are downloaded from their providers and are not shipped inside the installer.

Lists are fetched on first enable and refreshed when enabled lists are at least 24 hours old. A fresh cached copy works offline and is loaded before restoring pages after restart. Requests omit credentials, reject redirects, enforce HTTPS source identities and validate UTF-8/plain-text subscription format, size and supported rules. Each successful subscription is written atomically; a failed update preserves that list's last verified version. Matching continues on the previous complete engine while a replacement is prepared in short asynchronous batches.

Before lists are available, only the owner's three explicit advertising-domain rules are active: `ads.vk.com`, `an.yandex.ru`, and `doubleclick.net`, including their subdomains. The interface distinguishes this fallback from ready local lists. Turning the switch off aborts pending downloads and immediately allows requests again.

## Supported rules and boundaries

The local parser implements domain anchors `||`, URL start/end anchors `|`, wildcards `*`, separator `^`, ordinary exceptions `@@`, positive/negative resource types, positive/negative `domain=` conditions, `third-party` / `~third-party`, `match-case`, exact `badfilter` suppression and basic document-wide exceptions.

Domain scope uses the requesting document's origin, not the URL being downloaded. Opaque or missing initiators cannot activate context-dependent blocking rules. The pinned MIT dependency `tldts` 7.5.5 supplies Public Suffix List lookup, including private suffixes, so `www.example.co.uk` and `cdn.example.co.uk` are treated as one site while separate private-suffix tenants remain distinct. Package-lock integrity pins both it and its transitive core.

Rules are indexed by hostname suffix or a literal URL token. Downloaded patterns are not evaluated as JavaScript or raw regular expressions. Unsupported **blocking** rules are skipped as a whole. A network exception with an unknown condition is conservatively allowed to match more broadly while its understood conditions remain; it cannot expand a block. Cosmetic-only exceptions do not disable network filtering. Raw regex, cosmetic/procedural rules, scriptlets, redirect/rewrite, CSP, popup and other unsupported actions are not executed. The implementation does not claim all extended uBO `badfilter` semantics.

## Primary technical references

- Electron WebRequest and its one-listener-per-event behavior: https://www.electronjs.org/docs/latest/api/web-request
- Exact pinned Electron 44.5.0 API, including optional `initiatorOrigin`: https://github.com/electron/electron/blob/v44.5.0/docs/api/web-request.md
- Electron Session partitions: https://www.electronjs.org/docs/latest/api/session
- ABP filter syntax: https://help.adblockplus.org/adblock-plus-help-center/how-to-write-filters and https://adblockplus.org/filter-cheatsheet
- Public Suffix List handling: https://github.com/remusao/tldts

## Verification and release status

Local verification on 25 November 2026: 36 parser cases and eight controller/downloader cases passed. The independent code review found no blocking lifecycle or Session-hook issue. The production `downloadList` function also fetched both fixed subscriptions successfully: EasyList 2,067,328 bytes / SHA256 `b1d1214dde030f91d57154f9396ddbbd959316e8451d9d796cd7156ee9906188`, RU AdList 1,111,863 bytes / SHA256 `3ec29650888be00c9efc3f09ce539e38fb84e65eeed907b31268bab3b7779c17`. These are observations of changing upstream lists, not immutable release assets or a promise of native playback behavior.

The full `node tools/mouse-unit-tests.cjs` gate passed locally: 1,360 tests, 1,351 passed, nine platform/native skips, zero failures. The new Python runner, reader and manifest contracts passed 12/12. The separate retained `npm test` suite ran 182 cases: 177 passed and five unchanged legacy socket cases failed because this execution environment rejected Unix socket `listen` with `EPERM`. Those gates remain enabled in native CI; they were not skipped or weakened to make the local result green.

Native OS acceptance remains a separate requirement. Its new isolated fixture loads real loopback HTTP pages, records both script outcomes and server requests, drives the settings, desktop and private controls with native input, archives OS screenshots, and restarts the installed executable with the same test profile. The two cached subscriptions in this fixture are explicitly synthetic; live-list coverage and playback behavior are not inferred from them.

Implementation and acceptance preparation are in progress. No 6.0.39 publication is claimed until exact source CI, independent installed evidence, ordered publisher runs and public package/feed verification are recorded here.

Source PR: https://github.com/jeep-jim/OSMINOG/pull/215. The first candidate `c43b939633b99c4304cb6b468522ff8207c60206` entered native CI. Mac run `45595788081` passed the retained `npm test` gate, resolving the local Unix-socket restriction, then exposed three negative runner-test fixtures that used the unresolved macOS temporary path while the real runner correctly resolves it. The fixture helper now uses `Path.resolve()` too; its five targeted cases pass. Production path validation was not relaxed. Further native results are pending.

Candidate `96910fd2b15bdf305e72be83fad18a160915b3da` built all three platform installers. Windows run `45596355087`, job `139143400106`, passed its full installed acceptance, including `MOUSE_639_ADBLOCK_WRITE_PASS`, `MOUSE_639_ADBLOCK_NATIVE_PASS` and `MOUSE_639_INDEPENDENT_NATIVE_ACCEPTANCE_PASS`; the separate modern-Windows job was still running at this checkpoint. Mac run `45596354459` reached the new installed check but its test-only input guard did not yet include the two new 639 scenario flags. Those exact flags are now added under the retained `CI=true` and absolute test-profile requirements.

Linux run `45596354372` recorded real loopback requests: default-off delivered both control and advertising scripts; enabled checks in two separate tabs delivered the control script and cancelled the advertising request before it reached the server. It then timed out before sending the desktop-card click. The smoke waited for `dialog.open`, although Nora sets that before its content becomes non-inert and its native presentation/animation settles. The smoke now waits for the complete existing readiness state and avoids refocusing or scrolling that already exposed panel. It still requires foreground focus, native OS input and a trusted matching click receipt. The old artifact does not establish which event closed the panel; bounded read-only failure diagnostics were added. The nine targeted smoke/guard cases pass; the revised source must complete fresh native CI before acceptance. Production AdBlock behavior and the independent acceptance reader were not changed by these test-driver fixes.

The new publisher family is prepared in https://github.com/jeep-jim/OSMINOG-Releases/pull/77 (merged as `255cec53d996ca83b49a7142fd0c787bba7aeafa`). Its 148 local contracts and all PR gates passed. All three release pins remain unready, without a publication owner marker; this preparation did not publish 6.0.39 or change the public 6.0.38 packages.
