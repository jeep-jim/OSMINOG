# OSMINOG Chrome 3.11.33 — SPACE FX VISIBILITY FIX

Base: 3.11.32.

Exact root cause: `#spaceThemeFx` was inserted as a child of `#app`, while `#viewport` was a later opaque sibling covering it. All Space FX DOM nodes existed, but were physically behind the viewport background.

Fix: Space FX is now mounted inside `#viewport`; the viewport is an isolated stacking context; Space FX is z-index 1 and `#world` is z-index 2. This keeps stars, satellites/UFO, meteors, galaxies and nebulae visible behind canvas objects.

The 3.11.32 MutationObserver freeze fix is preserved.

Package: `OSMINOG-Chrome-3.11.33-SPACE-FX-VISIBILITY-FIX-ROOT.zip`
SHA-256: `cb4d33f50464ca732f5cad25d1367bcebd83637054e0a04e3480642560e90785`
Size: `345697` bytes.
Runtime: owner test pending.
