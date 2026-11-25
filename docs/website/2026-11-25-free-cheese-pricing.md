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

Pending GitHub Actions validation of PR #205 and browser review of desktop/mobile widths, dark/light and RTL. A source commit or passing synthetic test alone will not be described as deployed. Do not publish another browser build; the existing Mouse installer update service remains independent of pricing.

## After website acceptance

A separate approved native app entitlement design and payment-provider integration would be needed before any free/pro limitations or purchase flow may go live. The 5-desktop value is the verified current capacity; do not advertise unlimited desktops as shipped.
