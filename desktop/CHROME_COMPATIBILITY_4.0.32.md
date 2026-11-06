# Shared renderer compatibility: Chrome 4.0.32

The Chrome extension uses a profile-owned Chrome popup window as a magnetized live page surface. It is aligned to BrowserApp canvas and follows parent Chrome window geometry. It is not Electron WebContentsView and does not change the separate Windows application. Same-profile cookies, VPN and installed Chrome extensions are reused. OS-level always-on-top is unavailable to ordinary extensions; z-order is managed through Chrome windows APIs.
