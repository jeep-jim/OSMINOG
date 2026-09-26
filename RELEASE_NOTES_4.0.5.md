# OSMINOG 4.0.5 — Photo command fix

- Fixed direct photo placement routing for «выкинь фото верблюда на оску», «закинь фото орла», and natural filler such as «вот». Explicit placement no longer depends on correctly spelling the canvas destination.
- Direct-search suitability checks whole words, not substrings inside image subjects (e.g. лилии).
- Web photo commands use direct search/import even while team mode is selected. No text-provider connection is required.
- Explicit negative requests are not auto-executed. Ambiguous search-or-generate commands retain the existing chooser.
- Browser regression submits the exact reported command with an unavailable text provider, stubs only the image-search response, and checks real asset import on the board. This does not validate live search relevance or user-device connectivity.

No interface redesign, update mechanism change, or new provider added.
