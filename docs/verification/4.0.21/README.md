# 4.0.21 — welcome, HTML workspace, annotated screenshots

PR: https://github.com/jeep-jim/OSMINOG/pull/62

- Startup uses bundled HTML/SVG/CSS: underwater octopus animation, description and reduced-motion support. First-run RU/EN selection writes nativeLocale; later changes use the header selector. Existing board localization is reused; this does not claim a complete translation of all legacy modules.
- Code is a real header button. The central editor handles a single HTML document, including embedded CSS/JavaScript, with an isolated sandbox preview on the right. Save uses the existing sandbox module registry; saved AI-created modules appear in the selector. Dirty drafts are not overwritten by registry refresh. Drafts are stored per project. HTML download uses Save As.
- This is the first Code milestone, not full Visual Studio functionality: multi-file IDE, semantic layers, other language runtimes, installers and disk images remain roadmap tasks.
- Header screenshot captures the application window, then supports rectangular selection, arrow, marker, text, color, thickness, undo and PNG Save As. It does not append an image to the board. Video recording retains its earlier behavior.

148 local tests pass, including removal compaction and shared-divider geometry. Windows smoke checks real cropped PNG output, unchanged board object count, sandbox execution, module save and language restoration after reload. The first scope passed Windows run 39004980447 attempt 2. The later same-release layout/address additions passed the final run below. Initial Windows run attempt stopped in the existing PowerShell clipboard test after screenshot acceptance had already passed; that failure is not reported as a passing run.

Additional scope: vacancy compaction in matching columns, central shared width/height handles, pointer-following drag with collision resolution on release, rail-to-pane scroll (including leaving Code), and persistent address suggestions shared across projects. Windows checks cover removal geometry, central width resizing, rail navigation, domain suggestions and history reload.

The first layout candidate (39005684147) exposed a state-notification race: close rendered before vacancy compaction (shell-smoke.cjs:254, y=417 instead of 0). Compaction now runs before applying removal notifications; the follow-up run checks the same assertion unchanged.

Final source checks: Windows run 39005714284 (job 117317657662) and agent run 39005714279 succeeded. PR62 merged as 36d169fad09bf45dc6d4d69f2574c5e29edc9649. Runtime source 5f08d46952e36e5019c02a8af6b8ccaaf22924dd has identical blob paths/hashes to the merged commit (456 files; non-truncated recursive trees).

Candidate artifact 12091107406 SHA256: 38fdf9d00398811c39977bcf15f99c59b75072d552ec56b31b51215fb5f37f0c.
Runtime ZIP SHA256: 77b527433f7e44170675dfda319d9b054bb35dcbcff05bcbf932f1a5195916a3 (4,858,247 bytes).
Evidence: shell-smoke.log, code.png, capture-editor.png. These are Windows fixture checks, not live-provider or live-Figma acceptance.

Release run 39006256731, job 117319248554: success. UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.21 confirm the installed upgrade from 4.0.20 with retained local data. Both channels/dev/windows.json and public latest.yml now advertise 4.0.21. Installer HTTP range check returned 206 and MZ.
Installer: https://github.com/jeep-jim/OSMINOG-Releases/releases/download/windows-v4.0.21/OSMINOG-Preview-4.0.21-x64.exe
Size: 115,239,196 bytes. SHA256: e9162117270d6a248137f9cc3f1a1727cbd2e357bcb6b0ba537b8828546f9dc7.
