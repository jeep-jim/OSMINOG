# BriefCraft brand

## Canonical logo
The canonical BriefCraft mark is the new yellow `b/c`-style symbol with the sparkle, supplied by the project owner on 2026-08-25.

**Canonical source file:** `brand/briefcraft-logo.svg`

This SVG is the single source of truth for all future BriefCraft branding.

**Do not use the legacy blue `b°` logo in any future build.**

Future Chrome, Windows, macOS, web/landing and ChatGPT/App builds must derive their visible product icon from this exact SVG. Do not redraw, reinterpret or substitute the mark unless the owner explicitly approves a new logo.

## Brand colors
- Primary gold: `#EEBF26`
- Bright yellow: `#FFE100`
- Transparent background by default

## Build rule
Before publishing any new BriefCraft build, generate its extension/application icons, header mark, favicon and desktop app icon from `brand/briefcraft-logo.svg`.

Minimum derived assets for release builds:
- Chrome: 16, 32, 48, 128 px PNG
- Web/favicon: SVG + PNG where needed
- Windows desktop: ICO derived from the SVG
- macOS desktop: ICNS derived from the SVG

The source SVG must remain unchanged unless the owner explicitly replaces it.
