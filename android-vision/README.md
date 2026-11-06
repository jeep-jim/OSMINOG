# OSMINOG Vision · Android 0.2.0 (experimental)

A separate Android product, not a replacement for OSMINOG Chrome or Android file-board preview.
Only chat, Android speech input/output, a foreground camera session and signed APK updates.
Application ID: `com.osminog.vision`. No API key required: the user signs into the provider's real website.
The mobile DOM adapter is adapted from `provider-tab-bridge.js` (composer selectors, image upload confirmation,
new-message extraction). There is no private API, cookie extraction, native bridge on remote pages or login bypass.
If a provider blocks embedded-browser login, that provider cannot be connected by this transport.

## Honest capability boundary
The app displays a live camera preview. On each user question while the camera is enabled, it attaches
one fresh JPEG to the existing chat. This is frame-assisted conversation, NOT a realtime audiovisual model
connection. It speaks final responses with Android TTS, using turn-based speech recognition. Tap the microphone
to interrupt spoken output. Accounts, site changes, upload support/limits and Android speech services can affect
operation. No claim of testing real owner accounts is made from fixtures. There is no automatic identification
of people, background recording, file collection, cloud library or desktop canvas in this APK.

History is app-local, without Android backup; submitted text/images go to the chosen provider. Android speech
services may use the network. Camera/audio are stopped on Activity pause. Captured frames are not written to disk.

## Updates
Menu → Обновить онлайн. Fixed HTTPS feed: `channels/android-vision/dev.json` in OSMINOG-Releases.
Verify size, SHA-256, application ID, increasing versionCode and installed signing certificate BEFORE asking
Android to install. The installation still needs Android user confirmation. Only a complete signed APK is used.
Private signing material must never enter Git or CI logs. Unsigned CI artifacts are not installable releases.

## Build and verification
JDK 17; Gradle 8.9; SDK 35. `gradle :app:assembleDebug :app:assembleRelease :app:lintDebug :app:assembleDebugAndroidTest`.
Emulator instrumentation tests cover local shell, real WebView composer/attachment/response with a fixture,
no remote native bridge, rejection of unfinished drafts, updater URL guard, native camera capture and lifecycle stop.
The first APK must remain labelled experimental until tested with the owner's actual provider account and phone.

## 0.2.0 — Original ocean design, native-clock transport

The owner supplied Untitled.fig and its SVG export. The native file was decoded locally;
original vector paths, gradient matrices, fills, layers and dimensions were extracted.
The 13 exported plankton SVGs are unchanged. `assets/design/provenance.json` records hashes.
No animation timeline existed in this file. Drift, sleep and activity transitions implement
owner-described behavior; do not call their timing an extracted Figma animation.

The clean home screen contains the original star menu, wordmark, ocean, plankton,
chat and bottom eye. Tap the eye to start/stop voice, send composed text, interrupt
speech, or stop an active request; hold to end a session. Camera, provider login,
updates, privacy, history clearing and motion preferences are in the star menu.

Provider transport is driven by Android Handler polling instead of timer loops in
the covered provider WebView. Return events use the trusted local shell document,
not a potentially stale message port. External drafts are preserved; app-owned drafts
are scoped. Replies are correlated to one request and never fabricated. Provider reload
recovery does not re-submit the question. Histories are separated by provider and
previous local history is retained. Website changes, login policies and account limits
remain external dependencies; fixtures do not certify live account operation.
