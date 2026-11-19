# «Локал» — Mouse 6.0.28

«Локал» connects the existing Agent Mouse host to one selected project directory.
Folder selection starts the bundled file server in a separate Node-mode process
over standard MCP stdio. The official SDK performs initialize, tools/list and
tools/call. No new HTTP listener is opened; external agents continue using the
existing authenticated loopback Agent Mouse connector.

## Owner controls

Choose **«Выбрать папку проекта»** in Agent Mouse. Files start read-only.
**«Разрешить редактирование»** grants the four MCP tools permission to create or
replace project text files. Commands have a separate **terminal permission**.
Autonomous browser mode does not grant either permission. Choosing another
folder, Stop, a desktop switch or private-session teardown revokes these grants.
The configuration and action journal are memory-only.

The connected model can receive the contents of the files it explicitly reads.
The task consent describes this before sending a task. A connector URL is a
per-session credential: do not publish it or put it in logs.

The tree updates from chokidar notifications. Those notifications are only a
refresh hint; filenames shown to the owner are always rebuilt through the
confined file tools. Raw watcher paths are not forwarded to the UI or model.
The tree/search skip generated directories `.git`, `node_modules`, `.cache`,
`.next`, `dist`, and `build` during recursive expansion. A known path can still
be read subject to the same file checks. «Обновить» requests a fresh tree.

## Tools and exact bounds

| Tool | Result and restriction |
| --- | --- |
| `read_file({path})` | UTF-8 text, byte count, SHA-256; at most 262144 bytes |
| `write_file({path,content,expectedSha256?})` | At most 65536 UTF-8 bytes; returns the actual new hash and byte count |
| `list_directory({path?,depth?,limit?})` | At most 1000 visited entries and depth 8; explicit `truncated` flag |
| `search_files({query,path?,limit?})` | Literal case-insensitive filename search, never a shell command or regex |

Paths are project-relative, at most 2048 characters and 32 components. Absolute
paths, `..`, backslashes, NUL/control characters and alternate-stream colons are
rejected. Symlinks, hardlinked files and special files are not read or written.
Reading allocates only the byte limit plus one, even when a file grows during
the operation. Directory enumeration is bounded before sorting names.

New files are installed exclusively: a concurrently created name is not
overwritten. Existing files require the SHA-256 returned by a prior read. The
server checks that hash and the current inode/timestamps before atomically
replacing the file. This is **not an atomic compare-and-swap against another
editor**; the owner should avoid editing the same file concurrently. Temporary
files use unpredictable names and are removed on failure.

## Actual security boundary

The mandatory N-API module `mouse-mcp-fs.node` opens the chosen directory once.
It opens each descendant relative to held directory descriptors with
`openat`/`O_NOFOLLOW`, uses `mkdirat`, enumerates those descriptors, and commits
with descriptor-relative `linkat` or `renameat`. A parent renamed or replaced
by a symlink cannot redirect an operation into an unrelated directory. The
authority is the already opened directory object; a renamed authorized object
does not become an arbitrary path lookup. Missing native support fails closed.

This is **file-tool confinement, not an OS process sandbox**. The process needs
its bundled runtime and libraries, and it is not protected from all effects of
other programs running as the same OS user. An explicitly enabled terminal
executes with that user's rights and can reach paths or the network beyond the
project directory. The UI presents terminal permission separately; a read-only
file-tool grant must not be described as a read-only operating-system session.

## Managed dev command and localhost

The owner supplies a command and explicitly starts its own managed PTY. There
is no assumed `npm run dev`, automatic dependency installation, or command
chosen by a model. Optional restart-on-save is triggered only by a successful
MCP write while both editing and command permissions remain enabled. File
watcher events alone do not execute commands. Writes coalesce for 700 ms;
automatic restart pauses after three restarts in 30 seconds.

Only the managed PTY and its observed descendant identities are stopped before
the next command starts. Stop or permission revocation cancels scheduled
restarts. «Открыть Localhost» opens the owner-selected loopback port; a running
process does not by itself assert that a web server is ready.

## Existing connector

```js
const { AgentController } = require('./agent-connector.cjs');
const agent = await new AgentController(sessionUrl).connect();
const capabilities = await agent.localTools();
const { structuredContent: file } = await agent.localFile('read_file', {
  path: 'src/example.js'
});
// This call succeeds only after the owner enabled editing in Mouse.
await agent.localFile('write_file', {
  path: 'src/example.js',
  content: replacement,
  expectedSha256: file.sha256
});
await agent.close();
```

The host exposes `Mouse.mcp.listTools`, `Mouse.mcp.callTool` and
`Mouse.mcp.status`. It does not expose permission changes or dev configuration
to external agents. The model runner obtains the actual tool schemas and
routes the four additional actions through the same connector. This does not
enable vendor-native tools automatically in a regular third-party chat tab.

## Pinned implementation sources and verification

Runtime pins: `@modelcontextprotocol/sdk` 1.32.2, `fs-extra` 11.4.1 and
CommonJS-compatible `chokidar` 4.0.3, alongside the retained node-pty/xterm runtime.
The private packaged tree is `Resources/mouse-agent-node_modules/node_modules`;
no global `NODE_PATH` modification is used.

Project and system-interface documentation reviewed on 2026-11-19:

- [MCP SDK v1 server and stdio](https://ts.sdk.modelcontextprotocol.io/server)
- [MCP SDK v1 client, listTools and callTool](https://ts.sdk.modelcontextprotocol.io/client)
- [Electron Node-mode child processes](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)
- [fs-extra project documentation](https://github.com/jprichardson/node-fs-extra)
- [chokidar project documentation and v4 compatibility](https://github.com/paulmillr/chokidar)
- [Linux man-pages project: open/openat and directory descriptors](https://man7.org/linux/man-pages/man2/openat.2.html)
- [Linux man-pages project: link/linkat and existing-name failure](https://man7.org/linux/man-pages/man2/linkat.2.html)
- [Apple's open/O_NOFOLLOW manual](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/open.2.html)

`mcp-files.test.cjs` exercises the actual native helper with path/link/hardlink,
ancestor-swap, conflict, bounded-read and bounded-enumeration regressions.
`mcp-manager.test.cjs` uses the actual SDK and child server plus deterministic
managed-PTY lifecycle fixtures. `mcp-host.test.cjs` uses the actual authenticated
connector for permission separation, UTF-8 limits, revoke and desktop/privacy
boundaries. These tests do not replace installed macOS verification or a live
external model-account check.
