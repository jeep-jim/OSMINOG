# OSMINOG Chrome 3.12.3 — UNIFIED WORKSPACE

This release repairs the product execution path and consolidates the workspace UI around one set of behaviors.

- Main-chat requests about OSMINOG source, product layout, windows, modules, tools or browser now route to the canonical private GitHub source repository instead of canvas primitives.
- GitHub source editing uses status/tree/search/fetch/commit tools and does not require a selected local folder.
- Machine-only patch/request JSON is removed from visible chat messages.
- One Window Manager owns focus, z-order, move, resize, minimize, restore and close behavior.
- Minimized windows remain visible in the top tray; restored and newly opened windows come to the front.
- Every non-chat window receives the same hover action shelf, including node/focus, minimize and close.
- Module Store uses a list plus a right-side detail pane. Grid cards no longer repeat Open/Desktop/Team buttons.
- Custom modules can be deleted; system modules cannot. Removing a desktop shortcut preserves the installed module.
- Widget windows render their own content without a redundant dark application container.
- Desktop launchers and provider shortcuts share one icon size, hover behavior and remove-shortcut control.
- Small utilities such as clocks, calculators and timers default to content-sized widget mode.
- Module permissions use the OSMINOG confirmation surface instead of native JavaScript confirm dialogs.
- Window and module runtime tools are available to the main chat.
- Vector prompting now documents cubic Bézier handles and rejects rectangle/triangle placeholders for organic illustration.
- Internet results can be saved directly to the canvas as embedded image/file objects. PNG, WebP and SVG transparency is preserved.
- Bottom tools are grouped into navigation, content, drawing, assets and system clusters; the Web tool opens the unified web center.
