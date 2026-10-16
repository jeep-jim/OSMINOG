# OSMINOG Android 0.1.0 Preview

Native Android browser shell and a dedicated mobile file board. Independent from the Electron desktop binary. Android 8+, HTTPS tabs, up to eight retained WebViews, local desks, file cards and drag handles. System file picker, inbound Android file sharing and supported system drag/drop import files (25 MiB each) into app-private storage. Long-press a tab to close it. Ordinary provider websites receive no JavaScript/native bridge.

To attach a board file: tap its card → «Передать в чат ИИ» → choose the provider → tap that website's attachment button. The native file chooser supplies the chosen file. Alternatively, any site's file chooser offers «С рабочего стола». Actual upload/acceptance depends on that website; no fabricated assistant response and no automatic message submission.

This first APK is a release-signed preview, not a complete production Android product. Signing is performed outside public CI; the private signing key must never enter this repository. Android in-app updates are not configured. Desktop project interchange, full desktop editor parity and an AI tool channel in the same provider conversation are not implemented. Website authentication/embedding restrictions remain applicable. No claims of verified live ChatGPT/Gemini/Claude/DeepSeek operation are made from emulator tests.

Build: JDK 17, Gradle 8.9, Android SDK 35; `gradle :app:assembleDebug :app:lintDebug`. CI also runs an API 35 emulator test for board boot, persistence and the absence of the native bridge in remote WebViews.
