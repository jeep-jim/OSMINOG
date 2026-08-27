# OSMINOG brand

## Product name

The visible product name is **OSMINOG**. The primary domain is **osminog.red**.

`BriefCraft`, `BriefCraft AI` and `RichCraft` are legacy names. They may remain only in hidden compatibility identifiers until an explicit migration is implemented; they must not appear on new visible product surfaces.

## Temporary mark

Until the owner supplies the final hand-drawn logo, the identity is deliberately minimal:

- mark: a plain red circle;
- red: `#FF2D2D`;
- wordmark: `OSMINOG`;
- no `AI` suffix;
- no generated octopus, mascot, gradient, tentacles or extra emblem.

Source files:

- `brand/osminog-mark.svg`
- `brand/osminog-wordmark.svg`

## Release rule

Every new visible surface must use the temporary OSMINOG identity: Chrome extension name and icons, editor header, popup, onboarding, updater, Dev Hub, website, documentation, installers, desktop clients and mobile packages.

The old `brand/briefcraft-logo.svg` remains in Git history only for recovery and comparison. It is not a valid source for new OSMINOG builds.

## Compatibility rule

The rebrand must not destroy existing installations or projects. Preserve until migrated safely:

- the fixed Chrome manifest `key` and resulting extension ID;
- existing `briefCraft...` storage keys;
- `.briefcraft.json` project compatibility;
- internal protocols such as `briefcraft.patch/v1`;
- existing Native Messaging identifiers while older builds may still call them.

Visible branding changes immediately. Internal identifiers change only through backward-compatible migrations that read legacy data first.
