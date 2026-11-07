# Android Vision 0.2.4 — foreground transport candidate

The owner reported that 0.2.3 still does not connect on the phone. The exact device failure has NOT been observed; earlier fixture success is not proof of a repaired account session.

Changes: recheck the live editor on each explicit question instead of rejecting a stale disconnected flag; keep the real selected site in the foreground while transmitting and awaiting its answer; use Android editor input and a guarded native tap on the send button; return to the ocean shell when the answer completes. The foreground site's login, loading and challenge screens remain visible, rather than hidden behind the shell. No automatic resubmission. Existing external drafts are protected.

The foreground screen during a turn is an intentional UX tradeoff, not an invisible implementation detail. Returning to the shell during a turn cancels waiting; the user must check the provider before retrying if submission might have occurred.

Added a user-invoked local diagnostic share action. It includes app/Android/WebView versions and categorical transport stages; it excludes prompts, replies, conversation URLs, cookies and account identifiers. There is no telemetry upload.

Validation must include stale disconnected state, a rich editor requiring native input, a send control requiring a trusted click, cancellation and unrelated draft protection. The public-site read-only diagnostic sends no messages and is NOT live account verification. Preserve signed release validation and update-feed readback. Do not claim the owner's phone works until confirmed there.
