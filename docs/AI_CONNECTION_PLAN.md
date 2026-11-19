# Same-conversation workspace connector — engineering candidate

Status: unpublished component. Windows 4.0.9 remains current. No real provider conversation connected or end-to-end verified.

## Implemented in this branch
Local MCP tools workspace_read, browser_read, browser_act, canvas_apply, browser_open, browser_close. Resource osminog://workspace/current reads current workspace on demand; DOM bulk is opt-in (includeDom), targeted browser_read reads a selected page. Existing BrowserContext remains internal. No model API request, composer modification or assistant-response replacement.
Loopback-only capability endpoint. Project and source revision guards, single-use canvas edit tokens; source revocation blocks cached tokens and pending reads. No UI or external transport is installed by this component.
Six node tests cover HTTP tools, fresh resource reads, edit replay, source revocation and in-flight reads, origin/host boundaries, stop/project changes, and URL restrictions. These are host fixtures, not live model tests.

## Remaining integration gates
1. Wire tested MCP into desktop lifetime and a single connection flow; select source scope once. Disable separate executor only for a confirmed chosen integration.
2. Provide a stable authenticated provider-reachable transport. Localhost alone cannot be reached by a service's cloud.
3. Connect provider account using its supported connector mechanism. Account permissions and provider confirmations cannot be created by DOM injection.
4. Verify in the SAME actual chat: read current tab, fill fixture form, verify; create red circle, read back actual object. Confirm no hidden parallel model request and no context dump.
5. Only then ship a precisely scoped desktop release.

## Evidence checked 2026-10-16
- OpenAI custom MCP: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- OpenAI tunnel: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- Claude remote connectors: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Gemini custom apps: https://support.google.com/gemini/answer/17209137
- WebMCP requires a compatible agent: https://developer.chrome.com/docs/ai/agents
- Temporary tunnels are development-only and change hostname: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- DeepSeek tool calls documented for API: https://api-docs.deepseek.com/guides/tool_calls/
- DeepSeek Harness is a distinct application: https://deepseek.com/en/harness/

No verified tool connector for ordinary chat.deepseek.com was found. Do not infer it from DeepSeek's API or Harness. Do not promise all websites/AI plans support tools by virtue of sharing an Electron process. The original extension's bridge.js contains a WebSocket relay path, but cloud-config.js in current source has empty relay addresses; a reusable live relay/account is not established by that code.
