# Mouse website download counters — 25 November 2026

## Status and exact meaning

This change prepares a real, own-server counter and the small per-platform UI requested by the owner. **Preparing or publishing this code does not activate the Nginx logger.** The existing Mouse vhost in `infra/website/bootstrap.sh` has `access_log off`; previous website totals are unknown. GitHub release download totals are not substituted for website downloads.

Published in [PR #206](https://github.com/jeep-jim/OSMINOG/pull/206), source `6fd7d8b2d548ca54a31d67f1758b77fe7617a4aa`. [Production run 45557554241](https://github.com/jeep-jim/OSMINOG/actions/runs/45557554241) passed and installed the own-user metrics timer. Its observed state was `MOUSE_DOWNLOAD_STATS_UNAVAILABLE since=None checkedAt=2026-11-25T06:02:06.043619+00:00`. The administrator activation below remains unexecuted; counts are not live.

The own-user publisher installs an independent `mouse-download-stats.timer`. Until a server administrator activates the dedicated Mouse logger, it publishes `status: "unavailable"`, `since: null` and null counts. The publisher prints that actual state as `MOUSE_DOWNLOAD_STATS_UNAVAILABLE`; it must not claim that collection is already active. A packaged unavailable endpoint keeps the public page usable before activation. Native app limits, installers, download paths and browser publication are unchanged.

After activation, one increment means a **qualified installer request start**: a browser-like GET with status 200 or an initial single Range response with status 206, and at least one response-body byte sent. The record becomes available when Nginx writes the request log. It is not a completed download, installation, active user, unique person, or persistent visitor identifier. A repeated full request is another start. Requests resuming after byte zero, multi-range requests, HEAD, redirects, failures, empty responses, known automated clients and requests bearing `X-Mouse-Probe` are excluded. Nginx's eligibility filter cannot identify every bot; a spoofed or unrecognised bot can still count. Downloads made through non-browser tools such as curl are excluded.

Counts are grouped by the exact installer filename, version and platform. A new version starts its own count after collection begins; older observed versions remain in the aggregate. Before activation the number is unknown, not zero. After confirmed activation an empty log gives a real zero for each current version. This is the start of measurement, not the start of the product's history.

## Data and runtime

The endpoint is a same-origin JavaScript assignment compatible with the existing `connect-src 'none'; script-src 'self'` policy:

```javascript
window.MOUSE_DOWNLOAD_STATS = {
  schema: 1,
  status: "unavailable", // or "active"
  metric: "qualified_download_starts",
  since: null,
  updatedAt: "...", // collector check time, not a fabricated observation
  files: [
    {platform: "macos", version: "6.0.38", filename: "Mouse-Browser-6.0.38-mac-arm64.dmg", count: null}
  ]
};
```

The UI must match the real current filename, hide unavailable/stale data, and never turn missing records into zero. The endpoint is a public aggregate; discreet or collapsed presentation does not make it private.

| Location | Purpose and access |
| --- | --- |
| `/var/log/mouse-black-downloads/` | Dedicated raw log and activation marker. Root owns the directory; the `osminog` group may read its 0640 files but cannot replace them. Workers may traverse the directory to reopen their own log. |
| `/opt/osminog/website/metrics/` | Private own-user SQLite totals, random request IDs used for deduplication, file cursors, lock and latest check. |
| `/var/www/mouse.black/metrics/download-stats.js` | Only public platform/version/count aggregates. Separate from immutable website release directories. |
| `/etc/logrotate.d/mouse-black-downloads` | Only this new log: daily rotation, 14 files, compression with one-cycle delay, standard Nginx USR1 reopen. |

The log stores timestamp, random request ID, installer URI without query parameters, HTTP method/status/body bytes, Range, and two eligibility flags. It stores **no IP address, raw User-Agent, raw probe-header value, referrer, cookies or query string**. User-Agent and the optional probe header are reduced to 0/1 by Nginx before logging. SQLite retains aggregate totals and random request IDs across rotation; these IDs identify requests, not people. Aggregate history survives log rotation and release publication. A lost database plus already expired logs cannot reconstruct the lost history.

The collector runs as `osminog` every 60 seconds after its previous run. It has a separate user service (10% CPU, 96 MiB memory, 45-second deadline), so it does not join or change the release-sync loop. Incremental cursors and request-ID deduplication handle renamed, copied, compressed and truncated/regrown logs. Cursor and count updates commit in the same SQLite transaction. Unchanged completed compressed files are skipped without decompressing every minute. A long outage exceeding raw-log retention can lose unprocessed events; do not describe the counter as an exhaustive historical census.

## Activation: prepared, not executed by the website deployment

`infra/website/activate-download-stats.py` is deliberately not run by `install-sync.py`. It requires the server administrator's console. Existing instructions close the earlier one-time cross-project bootstrap exceptions: do not obtain or use AvtoCena credentials, change user privileges, or bypass the dedicated `osminog` access boundary.

The helper changes only the existing `mouse.black` vhost, adds the dedicated logger/rotation/aggregate alias, validates Nginx, reloads it, and verifies the Mouse release marker and the exact aggregate response over trusted HTTPS. It preserves the original config in `/var/backups/mouse-black-metrics/` and restores config/rotation on a failed activation. It does not change certificates, DNS, download URLs, CSP, global Nginx defaults, or another site's config. Reload/reopen signals go to the existing shared Nginx process.

All privileged writes are under root-owned directories. The helper never chmods, chowns, creates or replaces files under the user-owned private/public website paths. It reads the prepared aggregate using directory descriptors and `O_NOFOLLOW`, rejecting symlink components, nonregular files and unexpected ownership. The collector must have been published and run as `osminog` first.

Reviewed helper SHA256:

```text
8110f0cde918bb2d322903b47bce44415ee9848b16dba9a2d7d60f707f5c4392
```

After publication, a server administrator can copy the staged helper into a root-owned snapshot, compare that reviewed hash, inspect the candidate, then activate it. Run the following in the administrator console, not an `osminog` shell and not another project's workflow:

```bash
set -euo pipefail
test "$(id -u)" = 0
install -o root -g root -m 0600 \
  /opt/osminog/website/automation/current/infra/website/activate-download-stats.py \
  /root/mouse-download-metrics-20261125.py
printf '%s  %s\n' \
  8110f0cde918bb2d322903b47bce44415ee9848b16dba9a2d7d60f707f5c4392 \
  /root/mouse-download-metrics-20261125.py | sha256sum --check
python3 /root/mouse-download-metrics-20261125.py --check
python3 /root/mouse-download-metrics-20261125.py
```

Success prints `MOUSE_DOWNLOAD_LOGGER_ACTIVE` and the exact backup path. The next own-user timer tick emits `status: "active"` with the recorded `since` time. Confirm that response before claiming that collection is live. Public `/download-stats.js` uses `Cache-Control: no-store` after activation. The activation helper does not generate a fake test download or inflate the count to demonstrate success.

## Verification performed during preparation

- Eighteen targeted tests cover qualification, HEAD/probe/known-bot exclusions, initial versus resumed Range requests, exact version/platform parsing, restart/idempotency, rename/gzip/copytruncate rotation, partial records, null versus zero, version rollover, aggregate privacy, scoped/idempotent config transformation, and symlink-safe privileged reads.
- Nineteen existing sync-runtime tests pass with the extra bundled runtime files and separate timer.
- These tests do not establish live Nginx collection. The current execution environment has no Nginx binary; the helper's real `nginx -t`, reload and HTTPS activation checks must pass on the server before reporting activation.

Nginx reference: [HTTP log module](https://nginx.org/en/docs/http/ngx_http_log_module.html) for JSON escaping and log configuration; [log rotation control](https://nginx.org/en/docs/control.html#logs) for the standard USR1 reopening behavior.
