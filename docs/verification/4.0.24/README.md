# 4.0.24 — local MCP and agent picker

Supported connection cards: Codex CLI/IDE and Claude Code. Their official docs document local stdio MCP:
- https://developers.openai.com/codex/mcp
- https://code.claude.com/docs/en/mcp
Protocol: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle

Click a card in the empty right pane, enable session access, and add the generated configuration in the selected client. Existing client entries must be preserved; merge the osminog section. The generated command runs the installed Electron executable in Node mode and communicates with the already-running OSMINOG process. No provider key is requested by this bridge. Client login/subscription remains managed by the client. This is a local desktop connection; ordinary ChatGPT/DeepSeek web tabs are not stdio clients.

MCP uses an authenticated local named pipe (Windows) / Unix socket, not an open HTTP/CDP port. A random secret is stored in the private user profile; config snippets contain only the path to that connection file. Access defaults to disabled each launch. An initialize/initialized handshake is required for connected status. Project/access changes invalidate client scope. One operation at a time; native action policy remains active. Context and tool results are returned through MCP, not pasted into a web chat. Actions are logged in the existing logs/orchestrator.log without field values or prompts.

Tools: browser_tabs/context/open/read/act/navigate; canvas_inspect/create/move/duplicate; read_file/write_file (embedded canvas assets only). Real OS filesystem access is not exposed.

Tests: socket authentication and protocol lifecycle, malformed input, scope revocation, concurrent calls; installed-app stdio process performs read, click/type on an HTTP fixture, creates a canvas shape and file. These validate the bridge, not a live account/model in Codex or Claude Code. Screenshots and CI evidence are attached after verification.

Local sandbox does not permit listening on Unix sockets (EPERM); socket tests are therefore run on the Windows CI host. Existing control/action tests pass locally. No bypass of local sandbox restrictions is used.
