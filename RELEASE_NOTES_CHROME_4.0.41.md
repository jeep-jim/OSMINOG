# Chrome 4.0.41 — deferred panel resizing

After 4.0.40 the owner still reports browser termination when dragging a panel boundary. The previous preference-only save did not address layout work during movement.

Sidebar/inspector handles and the chat divider now use a shared pointer transaction: one isolated guide is updated at most once per frame, and panel geometry is applied once on release. Cancellation, capture loss and window blur discard the transaction. A no-op drag does not save. Current tools and updater remain intact.

Validation includes 500 synthetic pointer moves with zero geometry or storage writes, plus real native-extension mouse drags on a 2400-object/1200-image fixture for both Layers and chat. Linux Chromium results do not establish the cause of the owner's Windows browser termination or certify its resolution.
