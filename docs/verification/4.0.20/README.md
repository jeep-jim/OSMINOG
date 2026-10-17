# 4.0.20 — executor status below the chat viewport

PR: https://github.com/jeep-jim/OSMINOG/pull/61

The in-page status badge overlapped the DeepSeek composer. The status and result now use the existing host footer below the provider viewport. No badge is inserted into provider pages. Long results scroll within a height limit of 110px or 20vh, whichever is smaller. The host observes viewport size changes and resizes the native WebContents accordingly.

Execution, permissions and provider transport are unchanged. The existing 145 tests pass locally. Windows session smoke checks the native viewport/footer bounds, absence of the website overlay, and continued display of actual execution outcomes. The fixture screenshot shows the host footer; it is not a live DeepSeek-account screenshot.

Windows candidate run https://github.com/jeep-jim/OSMINOG/actions/runs/39002436410 and agent run https://github.com/jeep-jim/OSMINOG/actions/runs/39002436576 passed. The installed copy reports EXECUTOR_FOOTER_OUTSIDE_COMPOSER_PASS. Head af0d01c5993e59355bc81284c5d92b74d72125c8; merge e0e9917451ea0553be0126c8f5e068e599fd8928. Runtime source fdd26a1a692aa2f645988b7cda27fa6c581fa05b matches all 443 source blob files. Runtime size 4844023; SHA256 00b7a76aa7cddf50dcd1c1584d00f6b19dd36f4ca3f90c3df1beab6ea0b472af. Candidate artifact SHA256 fe6e403ddcafb78bdefe201f990855859d81a1dfe62da8c589a97ca29e9b5f5d.

Release https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/39002965514 passed. UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.20 verify upgrade from 4.0.19 with retained local data. Installer size 115230575; SHA256 03d669cae9cb4904556c974f4ae332e4fef04c70b6369223061c6bf6f8a499d7. The public update feed points to 4.0.20.
