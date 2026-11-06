# Shared renderer compatibility: Chrome 4.0.28

The Chrome release changes the shared editor loader, project trash, capture defaults and text sizing. These shared files are also copied by the desktop prepare:board step, so the existing Windows compatibility workflow must run for this release candidate.

Do not publish the Chrome channel until the existing native Windows persistence, browser, provider, session and shell gates pass on the same reviewed source commit. This is a compatibility check, not a new Windows product release and not an owner-device verification claim.
