# 4.0.21 — welcome, HTML workspace, annotated screenshots

PR: https://github.com/jeep-jim/OSMINOG/pull/62

- Startup uses bundled HTML/SVG/CSS: underwater octopus animation, description and reduced-motion support. First-run RU/EN selection writes nativeLocale; later changes use the header selector. Existing board localization is reused; this does not claim a complete translation of all legacy modules.
- Code is a real header button. The central editor handles a single HTML document, including embedded CSS/JavaScript, with an isolated sandbox preview on the right. Save uses the existing sandbox module registry; saved AI-created modules appear in the selector. Dirty drafts are not overwritten by registry refresh. Drafts are stored per project. HTML download uses Save As.
- This is the first Code milestone, not full Visual Studio functionality: multi-file IDE, semantic layers, other language runtimes, installers and disk images remain roadmap tasks.
- Header screenshot captures the application window, then supports rectangular selection, arrow, marker, text, color, thickness, undo and PNG Save As. It does not append an image to the board. Video recording retains its earlier behavior.

148 local tests pass, including removal compaction and shared-divider geometry. Windows smoke checks real cropped PNG output, unchanged board object count, sandbox execution, module save and language restoration after reload. The first scope passed Windows run 39004980447 attempt 2. The later same-release layout/address additions require a new Windows run. Initial Windows run attempt stopped in the existing PowerShell clipboard test after screenshot acceptance had already passed; that failure is not reported as a passing run.

Additional scope: vacancy compaction in matching columns, central shared width/height handles, pointer-following drag with collision resolution on release, rail-to-pane scroll (including leaving Code), and persistent address suggestions shared across projects. Windows checks cover removal geometry, central width resizing, rail navigation, domain suggestions and history reload.
