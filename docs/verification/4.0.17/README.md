# 4.0.17 verification

- PR: https://github.com/jeep-jim/OSMINOG/pull/58
- Head: 0d6bbbfd1788490d0c5b17840f40c61a69d7bea9
- Merge: 209eae5cb461b112d96b30cc992fb3ba65f9a19f
- Windows: https://github.com/jeep-jim/OSMINOG/actions/runs/38995523224 (success)
- Agent: https://github.com/jeep-jim/OSMINOG/actions/runs/38995523226 (success)
- 132 unit tests; installed application and normal/second launch pass.

Installed session log verifies ordinary chat → private executor → DOM ref click/type → observation → canvas change; image search/import; all six existing orchestrator scenarios and new scenario 7 (layout movement, replacement rejection, recovery). The element registry is absent from the website's main JS world. Existing coordinate controls are exercised independently.

The screenshot is the actual controlled fixture page, not a live ChatGPT account. The visible JSON is that fixture's scripted assistant reply; host context is not inserted into the source composer. All provider replies in this run are controlled fixtures. Live signed-in provider accounts and Figma are not certified by these results.

One earlier run failed because the new negative test ended with an expected stale-element error but the final screenshot assertion expected a successful chain. The test now performs a fresh-read recovery, asserts success, and then captures progress. No production guard was disabled.

Candidate artifact 12086968020: SHA256 82dacaec47b3295a5fb1c80b0ad88290ee7540acff44920a5d2bdf94e119de6c.
Runtime source 8e676d4cae7c150eb2484d95698406b05ada6d7f matches the merge across all 425 blob files. Runtime size 4840360; SHA256 9fc050afacb8cc5523e53d63bb94ca024586c4260094c88179057d48577108ec.

Release: https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/38996141489 (success). Actual installed upgrade from 4.0.16 reports UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.17 with retained local project/session data. Installer: 115228550 bytes; SHA256 bffc6710b1d7b53e197dcecc0abd824b240def7a6d8fdd984e67e0b8f8857aa1. Public latest.yml and channels/dev/windows.json point to 4.0.17; public installer download returns MZ.
