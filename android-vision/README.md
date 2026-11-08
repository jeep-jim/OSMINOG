# OSMINOG Android 0.2.6 — personal space and intention menu

Owner-designed menu: the top right arrow toggles ONLY the settings rows. The
profile and both list sections remain visible. Star, edge swipe or Android Back
close the whole menu; Back closes an active dialog first.

One local WebView, same appassets origin and application ID com.osminog.vision.
No provider website/hidden WebView, DOM adapter, provider login or remote bridge.
Original ocean SVG files remain unchanged; the accepted welcome scene uses actual
Android safe-area CSS variables, including the bottom navigation/keyboard inset.
The Android launcher and system splash use the eye motif. Update verification,
package, signing identity and previous local-storage keys are retained.

Normal send saves a private personal message. Message bubble actions edit, delete
with confirmation, or prepare an intention. Composer bubble tap attaches a file
or link; holding opens the explicit intention action. Photo and camera previews
stay local. Profile name/avatar/photo and settings persist locally.

**This release does NOT claim a connected internal AI or shared ocean.** No own
backend/model credentials have been supplied. It shows the real unavailable
state; intention drafts are explicitly labelled NOT PUBLISHED and are never
queued for automatic future publication. No fake assistant or users are seeded.
Former provider histories are still readable through a private archive; none
are uploaded or deleted during migration. Selected REG model vision capability
has not been verified. Camera capture is not model analysis.

On-device speech recognition is used only where Android exposes that capability;
otherwise the app suggests keyboard dictation, without enabling cloud recognition
silently. All camera/microphone sessions stop on pause.

Build with JDK17 / Gradle8.9 / SDK35. New Android contract tests cover independent
menu folding, native Back, real arrow touch, swipe, message actions, hold vs tap,
navigation/keyboard insets, camera lifecycle, legacy history, update URL guards
and two themes. Deleted provider-specific tests are replaced with tests for the
new runtime, not reused as proof of functionality that no longer exists.

See OSMINOG_MOBILE_ROADMAP.md and docs/mobile/2026-11-08-personal-menu-and-bubbles.md.
No web deployment or unrelated desktop/server changes are included.
