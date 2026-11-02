# OSMINOG Chrome 4.0.11 — GitHub Workspace

- Owner login revalidates the saved GitHub token and refreshes the grant. Reconnect from the owner dialog without resetting Authenticator.
- Read large UTF-8 source files in pages; edit exact unique fragments against the original blob SHA.
- Validate all changed files before committing, reject stale SHA and reread the resulting commit.
- Existing branch, PR and Actions tools are documented in the agent contract; no local source directory is required.
- Discussing development no longer forces a source mutation. Workflow dispatch is not reported as completed publication.
- Invalid updater folders are no longer retained; an invalid old selection is cleared for the next attempt.

Validation: gateway and owner tests use synthetic credentials and GitHub responses; Chrome UI regression runs in Chromium. A live internal-chat test with the owner's installed token remains necessary after updating. Actual Contents, Pull requests and Actions token permissions cannot be granted by this update.
