# Mouse landing — open and get to work

## Owner decision

On 2026-11-22 the owner approved the proposed two-line introduction beneath
the existing main headline. Keep the headline, platform-specific download
labels, showcase and layout. Update the introduction in all 72 landing locales.

| Locale | First introduction line | Second introduction line |
| --- | --- | --- |
| Russian | Открыл и работаешь | Сайты, чаты и ИИ — рядом, в одной сетке |
| English | Open and get to work | Your websites, chats and AI — side by side |

Other locales use concise local equivalents. No trailing sentence stops or new
claims about requiring no setup, external account sign-in or privacy are added.
The Russian template fallback must match its compiled language page.

## Delivery

Source commit: `5074906b5ea0c9faf9f751d6c7b494e34d2c3d77`.
Published through the existing own-user Mouse website workflow on REG:
[run 45034079007](https://github.com/jeep-jim/OSMINOG/actions/runs/45034079007).
Both `validate` and `website` completed successfully. Final live verification
finished at 2026-11-22 14:48:21 UTC; the run completed at 14:48:26 UTC.
Deployment identity: `758b79a220adcffb8e0ad153a093760e01e5be6c`.
Native browser releases, DNS, server access and AvtoCena were outside this change.

## Local verification

- Updated the two introduction fields in all 72 source catalog rows and the
  Russian HTML fallback; removed the old hard-coded Russian second line.
- Compared the compiled source catalog against the pre-change snapshot:
  exactly 144 introduction strings and their 72 derived descriptions changed.
  Every other message field and the language catalog remained identical.
  The static builder still applies the existing dedicated SEO descriptions.
- Static build passed: 72 locales, 73 HTML pages and 93 public files.
- SEO verification passed with 72 sitemap URLs. No new tests or dependencies
  were introduced for this copy-only change.
- Translation completeness, UTF-8, absence of HTML and terminal sentence stops
  were checked. Independent native-speaker review was not performed.

## Public verification

- The public `https://mouse.black/i18n.js` returned HTTP 200 with
  `Cache-Control: no-cache`. Its 144 introduction strings exactly matched the
  approved source translations across all 72 locales.
- Visually inspected the new Russian introduction on `https://mouse.black/`
  and `https://mouse.black/ru/`, and the English introduction on
  `https://mouse.black/en/`. Choosing English in the live language picker
  navigated to the English page and displayed both new lines.
- The main headline remained on one line in the inspected desktop viewport.
  The showcase, mouse, and three platform download buttons remained visible.
- The browser download links stayed on `mouse.black/downloads/`.
  At verification time they offered macOS 6.0.36, Windows 6.0.37 and Linux
  6.0.37, as independently selected by the existing release catalog.
- The required publication gate passed: 51 Python tests, 4 Node tests, same-domain
  HTTPS, Russian/English/Arabic HTML, 72 sitemap URLs, 73 hreflang entries,
  and complete SHA256/HEAD/Range checks for all three installers.
- The automatic sync check was observed at
  `2026-11-22T14:42:07.012412+00:00` for the published renderer.
- Final verifier marker:
  `MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3`.
  Deployment evidence artifact: `14758874333` (`mouse-website-deployment-evidence.zip`).
