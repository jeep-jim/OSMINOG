# OSMINOG 4.0.23 — verification and limits

## Changes

- Small-key storage reads use a bounded cache (1 MiB estimated budget, 64 KiB per value), invalidate on file identity/size/nanosecond timestamps, and return independent values. Large project payloads are not retained in this cache. Existing atomic JSON writes and backup remain unchanged.
- PDF export dependencies (pdf-lib and fontkit, 1,283,539 source bytes combined) load on first export with shared in-flight loading and retry after failure. This is deferred JavaScript loading, not an equivalent RAM saving.
- On-demand resource report maps process IDs to shell and tab hosts, counts a shared process once, and excludes URL paths/query strings and chat contents. Working-set totals can double-count shared pages across processes and differ from Windows Task Manager's memory column. First CPU sample is not an idle interval measurement.
- Opening a browser tab returns an observation and token for the next action and is counted as execution. Compact task history retains target IDs/tokens. Model-turn ceiling is 32 within the existing 15-minute task expiry. Unsupported browser_close advertisement removed.

## Evidence

152 local tests passed. Synthetic benchmark: 16 MiB embedded project asset, 50 small preference reads, 1403 ms baseline full parse versus 10 ms cached on this host. Cache retained 74 estimated bytes and no project payload. This does not measure total application CPU, startup time or RAM savings.

Windows candidate run 39023399908: shell checks confirmed LAZY_PDF_EXPORT_PASS, RESOURCE_REPORT_PASS and SHELL_SMOKE_PASS. Fixture pages and simulated provider responses validate plumbing; they do not establish live ChatGPT/DeepSeek availability or BrowserOS feature parity. Source PR64 merged as ccc0205db511fc1d77c829d921d4294bf8d14c54. Windows run 39023399908 and agent run 39023400030 passed, including installed application tests. Retained document regression 39023399903 and studio compatibility 39023399888 passed. Runtime source 83cf75b8da659c55a5fad84cd5e892110d5a635e was verified to contain the same 469 source blobs as the merged commit. Update-channel evidence is recorded separately.

## BrowserOS comparison and remaining work

Sources inspected 2026-10-17:
- https://github.com/browseros-ai/BrowserOS/blob/main/README.BrowserOS.md
- https://github.com/browseros-ai/BrowserOS/blob/main/README.md
- https://docs.browseros.com/

BrowserOS contains an integrated agent and provider connections (including ChatGPT Pro OAuth). BrowserOS neo exposes an MCP interface for external agents. Its source tree separates browser-core, browser-mcp and agent/server implementations. A normal third-party chat webpage is not automatically an MCP client.

OSMINOG has native actions, scoped snapshots/refs, a task loop and private service-chat transport. The web-session/provider transport remains a distinct reliability dependency; a shared BrowserContext does not itself connect a remote model. Full parity requires an explicit supported model/agent connection and live acceptance, not only more permissions or UI changes.

Still open:
1. Live end-to-end acceptance through each supported provider: navigate, fill/search, inspect result, import an image, create/edit canvas objects, recover from stale targets. No claim of success without observed results.
2. A stable standard agent connection (MCP/provider adapter) alongside existing chat transport; preserve current no-key workflow where supported, without pretending every hosted chat offers tool calling.
3. Tab lifetime policy: restored/background project tabs remain alive. Automatic discarding must preserve unsaved forms, active agents and media. This patch does not silently unload them.
4. Multi-file IDE/runtimes and Android package remain separate unfinished work. No full-browser RAM reduction percentage or BrowserOS memory advantage has been established.
