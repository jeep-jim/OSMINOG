# Android Vision 0.2.3 — native composer fallback and launcher

Owner reported a failed rich-editor insertion in 0.2.2, a misleading connected label,
a right-shifted provider picker and a dark Android navigation strip.

- Resolve the actual editable control, rejecting hidden/zero-height mirror fields.
- Use composed input events and a bounded Android InputConnection fallback when
  JavaScript insertion is not retained by the site editor. Do not replace the
  framework document using raw textContent. Preserve unrelated external drafts.
- Send exactly the user's question, without a technical marker or hidden instruction.
  Correlate new messages and never automatically re-submit an uncertain send.
- Separate composer readiness from a verified send-and-receive exchange. Restore a
  failed question in the local OSMINOG composer instead of silently losing it.
- ChatGPT is the fresh-install default. The picker offers ChatGPT, Grok, DeepSeek
  and a custom HTTPS website. Existing provider sessions/history IDs are preserved;
  custom history is origin-scoped. No remote native bridge or credential extraction.
- Constrain the provider card to the safe viewport, including small/landscape screens.
- Reapply transparent system-bar/divider settings and disable Android contrast scrims.
  Device manufacturers may still control their system navigation appearance.

Regression coverage includes the original Android suite plus a controlled rich-editor
fixture that rejects JS insertion, requiring actual native input and a real WebView
response. Fixture checks are NOT certification of live personal provider accounts.
An arbitrary website can be opened, but its editor and reply DOM must be compatible
for shell send/receive; unsupported websites remain accessible in the original page.

Publication must retain the installed signing certificate, successful pinned source
CI, exact signed-APK startup verification and update-feed hash/size readback.
No Chrome runtime or release channel changes are part of this Android release.
