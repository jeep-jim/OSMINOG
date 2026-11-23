# Mouse landing — three everyday essentials and one fair plan

## Owner decision and scope

On 2026-11-23 the owner explicitly approved a single USD 3/month proposal, a large centred price below the feature cards, and the heading “One fair plan” / “Один честный тариф”. The landing focuses on three everyday capabilities in this order: multiple windows, separate desktops, and local autosave. Other capabilities remain secondary in settings. This supersedes the previous four-card promotional hierarchy, not the implementation of native browser features.

The change publishes the pricing proposal on mouse.black through the existing OSMINOG own-user website workflow. It does not create a merchant account, payment checkout, subscription entitlement, trial duration, native paywall, DNS change or server tariff change. The published plan is explicitly labelled “Subscription coming soon”; the real action returns to the existing same-domain installer buttons. No purchasable Offer is added to structured data.

## Truthful feature boundaries

- Up to 12 main windows per desktop; layout controls resize and expand/restore panes. Pinned panes must be unpinned before resizing.
- Native desktops preserve their window membership and layouts. Current desktop code has five desktops and shares the normal web session; the copy promises neither unlimited desktops nor isolated accounts.
- Local collection is opt-in, copies new clipboard text/images and new images in the selected screenshot folder while Mouse runs, and pauses in incognito or when the device is locked. This is not automatic extraction of visited pages from the cache, scheduled deletion or encryption. Existing capture translations are retained exactly.

Sources: desktop/mouse/layout.js, desktop/mouse/browser.js, desktop/mouse-pane-focus.cjs, desktop/mouse-desktops.cjs, desktop/mouse-local-captures.cjs and desktop/mouse-capture-archive.cjs. Historic docs/PRODUCT_TIERS_AND_PRO_SUBSCRIPTION.md is not a live Mouse payment implementation.

## Implementation

- Three connected feature burrows, ordered windows → desktops → local archive. The window illustration devotes the whole browser to 12 panes; a new layered-desktop SVG illustrates the second feature.
- One centred pricing section with the existing pixel display font, a large $3, explicit USD/month period, a short description, settings aside, coming-soon status and a working download anchor.
- Shared theme tokens, readable body copy, responsive layout, script-aware heading fallbacks and reduced-motion support. No new runtime script, third-party requests, analytics or new hosted service.
- The original modular font gains a matching dollar glyph. Font inspection confirms all 661 existing codepoints, outlines and horizontal metrics are unchanged.
- All 72 locales contain exactly 13 nonempty feature/pricing fields (936 strings); all 144 existing capture strings are unchanged. Translations were reviewed during authoring; independent native-speaker review of all languages has not been performed.
- Complete locale fields flow through the existing static renderer and in-page catalog. The SoftwareApplication featureList follows the three visible primary features; all existing canonical, sitemap, language links and same-domain download mechanisms remain.

## Verification and delivery

Local verification completed on 2026-11-23:

- Existing Python website suite: 51 tests passed. Existing JavaScript download suite: 4 tests passed.
- Shell syntax checks for deploy.sh and bootstrap.sh passed; the existing 6.0.36 fixture download manifest validated. This fixture is not a claim about the live release version.
- Static build: `MOUSE_SEO_BUILD languages=72 html=73 files=101`; verification: `MOUSE_SEO_VERIFIED pages=73 languages=72 sitemap_urls=72 version=6.0.36`.
- Browser review at a 1348 px content width: three feature burrows in the requested order, centred 208 px price, correct Russian dark and English light themes, no horizontal overflow. The Download Mouse anchor returns to the existing platform installers.
- Browser review in local 375 px and 320 px iframe viewports: Russian and Arabic price, monthly USD label, coming-soon note and download action fit without horizontal overflow. Content widths after scrollbars were 360 px and 305 px respectively. These are constrained browser viewports, not tests on physical phones.

Publication completed on 2026-11-23 at 13:42 Krasnoyarsk time (06:42 UTC):

- Published source: `7de034f5e73254760570e38d7e159f198bb32dbc`; its tree `201e43a3fd2bfc5233027e448df214deb2d06769` exactly matches the locally reviewed tree. The non-force main update used the expected parent `08025fea4d5b993ee97495d4dff9ed5a7015deb3` and was read back.
- Own-user [website run 45125609048](https://github.com/jeep-jim/OSMINOG/actions/runs/45125609048) completed successfully. Validation job `137529134856` and publication job `137529243961` both succeeded.
- Actual deployment identity: `7fff66f471f0b25fd417d52cc81bc05316822a91`. The user timer performed a new automatic release check at `2026-11-23T06:41:29.509094+00:00` against the published source, followed by `MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black`.
- The independent external gate finished at `2026-11-23T06:42:18Z`: HTTPS and canonical redirects passed, rendered Russian/English/Arabic pages matched the expected source, sitemap retained 72 locales and the language graph 73 entries. Final receipt: `MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3`.
- Actual public downloads remain macOS/Windows/Linux **6.0.37**, with full SHA256 checks passing for all three same-domain installers. This landing change did not publish a browser release.
- Evidence artifact: `14795781692`, `mouse-website-deployment-evidence`, 2302 bytes, ZIP SHA256 `673fdf7fad0ec9c5941b336ddfb6be6fd87ab9918db6dc7d02970d300aedb73c`.
- Browser review of [the actual Russian pricing section](https://mouse.black/ru/#pricing) confirmed three feature cards, the centred pixel-font $3, USD/month period and “Подписка скоро”. [Live screenshot](evidence/2026-11-23-one-fair-plan-live.jpg).

Subscription billing and entitlement enforcement remain unimplemented and are not represented as available. The next commercial step is a separately configured and verified payment flow, not further cosmetic work on this block.
