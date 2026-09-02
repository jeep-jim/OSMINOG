# OSMINOG Chrome 3.12.4 — DOCK PERFORMANCE HOTFIX

- Removes the self-triggering `MutationObserver` that watched a window's own `style` while changing that same `style` and `z-index`.
- Window visibility monitoring is now limited to the `hidden` attribute and performs no continuous render polling.
- Fixes the Module Store empty-result loop by marking OSMINOG-owned content and scheduling at most one repair render after an external overwrite.
- Extension and provider launchers are no longer inserted into `#world` and cannot scale with canvas zoom.
- Adds one fixed bottom dock for system modules, third-party providers and self-created extensions.
- All dock icons share the same 38 px glyph surface, rounded treatment, hover magnification and running-state indicator.
- A single click opens or restores a dock item; restored windows move to the front.
- Closing or minimizing a reusable managed window collapses it into the bottom dock instead of leaving it on the canvas or placing it in the header.
- Legacy provider and extension canvas launchers are removed during migration.
- The Module Store uses “Add to dock” and “Remove from dock” language and keeps module deletion separate from dock removal.
