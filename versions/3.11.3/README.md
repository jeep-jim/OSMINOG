# OSMINOG Chrome 3.11.3 — BUBBLE EYE ENVIRONMENT

Base: **3.11.2 PROVIDER / SESSION LAYER**.

This build continues the Ocean Shell rewrite for **desktop Chrome first**. Mobile Figma frames are used only as a source of visual language and assets; mobile layout is explicitly out of scope for this pass. Windows/macOS desktop shells are expected to reuse the same spatial interaction model later.

## What changes

- Replaces the generic launcher with an **octopus-eye-inspired translucent lens** and a horizontal slit pupil.
  - idle: almost transparent;
  - hover/focus: red organic eye state;
  - open: active red state while remaining anchored in the bottom strip.
- Rebuilds the lower Search Layer geometry so it **compresses into and pushes out of the persistent seabed strip** instead of behaving like a floating modal/dome.
- Adds a Bubble interaction grammar for Ocean:
  - soft bubble hover instead of hard square hover;
  - liquid selection/focus glow;
  - focused-object micro-vortex;
  - bubble-like provider shortcuts and desktop folder hover states.
- Adds deletion feedback:
  - short pop ring;
  - upward micro-bubbles.
- Adds drag feedback:
  - light water/turbulence trail;
  - small bubble release on drop.
- Adds **Ocean FX** controls to canvas settings:
  - Plankton On/Off;
  - Bubbles On/Off;
  - Sea forms On/Off;
  - Density: Low / Medium / High;
  - Bioluminescence: Off / Soft / Bright.
- Adds translucent sea-form silhouettes recreated from the owner's Figma visual language: comet/larva-like shape, jellyfish, starburst, ring/bean forms and layered bubbles.
- Preserves Dark and Light as alternative themes; Ocean environmental effects remain Ocean-specific.

## Preservation rule

This is a presentation/environment pass. 3.11.2 Provider/Session behavior is retained. The following are intentionally not rewritten in this build:

- DeepSeek proven authenticated transport;
- Google provider transport/session logic;
- Provider Registry / Session Manager semantics;
- project/canvas object IDs and storage;
- Team engine;
- Browser Hub;
- folder engine;
- Presence / patch protocols.

## Candidate artifact

`OSMINOG-Chrome-3.11.3-BUBBLE-EYE-ENVIRONMENT-ROOT.zip`

- Files: **55**
- Size: **337047 bytes**
- SHA-256: `797136658d01c5b636f3e79500ddf7c38ad93d9f92c9b7ba2394cbe58ceb2050`
- Root `manifest.json`: yes
- Manifest version: **3.11.3**
- Fixed manifest key: preserved

## Verification

Static checks completed:

- 21 JavaScript files pass `node --check`;
- 9 JSON files parse;
- real HTML duplicate IDs: 0;
- ZIP integrity: PASS.

Owner runtime verification is still required before calling the build proven.
