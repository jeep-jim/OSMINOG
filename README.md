# BriefCraft ChatGPT App — GPT Presence Test

Private test repository for the BriefCraft ↔ ChatGPT Presence integration.

This repository hosts only the small ChatGPT App/MCP descriptor and widget used during development. It does **not** store BriefCraft canvases, project files, DOM snapshots, images, or project history.

## Test path

1. Open this repository on GitHub.
2. Click **Code → Codespaces → Create codespace on main**.
3. Wait for the Codespace to start. The BriefCraft MCP server starts automatically on port `3000`.
4. Open the **Ports** panel and set port `3000` visibility to **Public** for this temporary test.
5. Copy the forwarded HTTPS URL and append `/mcp`.
6. Use that URL as the temporary BriefCraft custom App/MCP endpoint in ChatGPT Developer Mode.

The final published BriefCraft product will not require end users to create a repository or Codespace. This repository is only our zero-extra-service test environment.
