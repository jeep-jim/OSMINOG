# Mouse showcase — public interface capture provenance, 2026-11-22

Captured 2026-11-22 through approved Cloud Browser UI. Assets are unaltered JPEG screenshot bytes, except the documented native screenshot clipping for Finviz. All interface content is English. These are recorded screenshots, not live embeds.

| Key | Asset | Dimensions | Bytes | Source | Content |
| --- | --- | --- | ---: | --- | --- |
| `github` | `github-vscode.jpg` | 1348 × 926 | 131175 | https://github.com/microsoft/vscode | Public Microsoft VS Code repository, logged out; repository files and project information |
| `mdn` | `mdn-grid.jpg` | 1348 × 926 | 139186 | https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout | Public CSS grid layout documentation; native documentation page and grid example |
| `figma` | `figma-community.jpg` | 1348 × 926 | 79356 | https://www.figma.com/community | Public Community resource gallery; this is not the Figma editor |
| `huggingface` | `huggingface-spaces.jpg` | 1348 × 926 | 144682 | https://huggingface.co/spaces | Public AI App Directory; this is not a chat conversation |
| `discord` | `discord-support.jpg` | 1348 × 926 | 62676 | https://support.discord.com/hc/en-us | Public Help Center; this is not a private chat or support inbox |
| `finviz` | `finviz-map.jpg` | 1348 × 816 | 223382 | https://finviz.com/map | Public S&P 500 stock market heatmap; cookie consent rejected and native introductory tooltip closed; native screenshot clip x=0,y=110,width=1348,height=816 omits the external ad above the brand header |
| `perplexity` | `perplexity-grid.jpg` | 1363 × 936 | 108479 | https://www.perplexity.ai/session/449271ba-0bea-4546-82ce-de130149636c | Real guest response to a new nonpersonal prompt: Explain CSS Grid in three concise bullets and give one practical example; no sign-in, personal data or existing conversation; optional sign-in prompt dismissed |

## Display constraints

- Keep service names accurate: Figma Community, Discord Help Center and Hugging Face Spaces are the pages captured, not editor, inbox or chat substitutes.
- Public GitHub example is Microsoft VS Code, unrelated to the Mouse repository. The current public-output validator prohibits GitHub host strings; the integration descriptor should leave host empty until that rule is deliberately scoped.
- Finviz and TradingView captures are frozen example market screens, not real-time feeds.
- No personally authenticated ChatGPT content was saved. The reused ChatGPT session was excluded.
- Telegram public channel capture was attempted at https://t.me/s/telegram but the browser returned Site Unavailable / Unable to access this site; no Telegram image was saved or substituted.
- Unsplash did not produce a usable page in this browser. No Unsplash image was saved.
- TRELLIS.2 public Gradio interface loaded, but a completed result was not captured; it is not included in the asset list.

## Existing assets checked for color

| Existing asset | Dimensions | Pixels with channel spread > 12 |
| --- | --- | ---: |
| maps.jpg | 867 × 856 | 43.63% |
| tradingview.jpg | 1363 × 936 | 7.84% |
| youtube.jpg | 1096 × 705 | 30.35% |
| vscode.jpg | 1015 × 909 | 1.96% |

The low VS Code color share reflects its mostly dark editor UI; the source file is not grayscale. Color shares use max(R,G,B) minus min(R,G,B) per pixel and are only a local asset check.
