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
