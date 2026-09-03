# OSMINOG Chrome 3.15.1 — OWNER ACCESS RECOVERY

- fixes Owner/Poseidon lockout caused by treating every temporary GitHub status failure as loss of ownership;
- caches a successful owner grant for up to 30 days while the locally stored GitHub token remains present; writes still require a working GitHub API connection and the existing owner confirmations;
- adds direct fine-grained GitHub token setup to Control Center; the token is stored locally and is never inserted into AI chat text;
- GitHub and other protected sites no longer try to render as ordinary iframes inside OSMINOG Browser; they open as managed real Chrome tabs using the same Chrome profile, system VPN/proxy and installed browser extensions;
- active managed tabs are restored/focused correctly instead of staying hidden in the minimized background hub;
- normal users keep Interactive Workspace capabilities but cannot unlock OSMINOG product source/release tools without verified write access to the private owner repository.

Recommended fine-grained token repositories: `jeep-jim/OSMINOG` and `jeep-jim/OSMINOG-Releases`. Repository permissions: Contents Read/Write, Pull requests Read/Write, Actions Read/Write.
