# OSMINOG Ocean 0.3.0-pilot.1

Shared Web/PWA UI consumed directly by the new `android-ocean` module. Original
artwork is copied byte-for-byte from `android-vision/app/src/main/assets/design`.
The existing Android release and desktop application remain unchanged.

Implemented candidate: invited accounts, own private/public intentions, bubble
magnet with explicitly lexical matching, direct per-intent conversations,
blocked-user exclusion, reports stored for operator review, profile plankton,
JPEG/PNG/PDF/TXT attachments to intentions, camera capture, links and draft return.
No external AI, fake people, scraping, background microphone, or paid API.

Run `python mobile-web/build.py` before serving/building APK. Development:
`OSMINOG_DB=/tmp/ocean-test.sqlite3 OSMINOG_LOCAL_TEST=1 OSMINOG_ORIGIN=http://127.0.0.1:8080 python services/intent-ocean/server.py`.
Generate a test invitation with the same environment and `--invite`.
Do not expose development HTTP or publish invitation codes.

The service worker caches only the shell: no private APIs, images or conversations.
Draft text is scoped to the current account/thread in sessionStorage; attachment
bytes are in memory and not preserved after reload. No automatic public import
of the old Android history. PWA/Android cross-device login is explicit.

NOT YET ACCEPTED: production host/DNS/TLS, two real phones, signed Android upgrade,
legacy-history export, account recovery/deletion, circles/contact consent,
semantic model matching, notifications, sustained load and operator moderation.
See `../infra/intent-ocean/README.md` and `../OSMINOG_MOBILE_ROADMAP.md`.
