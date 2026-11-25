# Mouse website — free Mouse and Cheese pricing concept

25 November 2026. Owner-provided copy and design direction from the screenshots: a perpetually usable free browser, a future USD 3/month optional upgrade, and the playful saying «Бесплатный сыр только в мышеловке». The browser and mascot are **not** the mousetrap. The site should use a pixel-art cheese and mousetrap to make the distinction memorable.

## Scope and truth

- Website-only visual and copy change, proposed for review in PR #205. Native tiers, billing and entitlements have **not** been implemented. No checkout, fake subscribe action or active free-plan restriction is introduced.
- The proposed *future* division is Free = 2 desktops / 4 windows, and Cheese = 5 desktops / 12 windows with local text/screenshot capture. Five desktops and up to twelve windows reflect the current native feature inventory; future product limits must be implemented and verified separately.
- The live browser remains downloadable using the existing verified same-origin link. Every current browser feature stays as-is; the website explicitly says the pictured split is not currently enforced.
- The USD 3 monthly period stays physically associated with Cheese, and the paid state is labelled with the existing localized “Subscription coming soon” string.
- Existing 72 locales keep the same 13 feature/pricing translation keys and page renderer. RU/EN pricing title and copy are revised; other locales retain their existing translations until localized copy can be reviewed. The two tier names are intentionally English product tier names (FREE/CHEESE). No external fonts, SVGs, images, scripts or service calls are added.
- The monochrome design gains a restrained warm-yellow pixel cheese and a crossed-out pixel trap, retaining both themes, RTL logical layout and motion-reduction behavior. The sole CTA in the pricing module links to existing #downloads.

## Acceptance / evidence

Published 2026-11-25 by squash merge of PR #205, source `34e37e7866713e2dbae665b59874e9438b8fe7c1`. [Mouse website run 45551355664](https://github.com/jeep-jim/OSMINOG/actions/runs/45551355664) completed **SUCCESS**: validation, own-user publishing, real automatic release timer, independent public HTTPS and all three installer SHA256 checks. Public deployment identity: `c035a6917cea7f5958640fd031ec82a5a6b4569c`. 73 generated HTML pages, 72 sitemap locales, three sample rendered locales verified. The public files are the existing **6.0.38** Mac/Windows/Linux installers, not a new browser build. The GitHub website gate does not constitute independent human visual review of all themes or all 72 translations.

## After website acceptance

A separate approved native app entitlement design and payment-provider integration would be needed before any free/pro limitations or purchase flow may go live. The 5-desktop value is the verified current capacity; do not advertise unlimited desktops as shipped.
