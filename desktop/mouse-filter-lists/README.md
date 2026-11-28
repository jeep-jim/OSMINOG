# Bundled network-filter subscriptions

These files are unmodified copies of the named subscriptions, retained as an offline fallback. Mouse parses only its supported network-rule subset; downloading or bundling a rule does not enable scriptlets, response rewriting, cosmetic injection, or DRM modification.

| File | Source and authors | License chosen for this distribution |
| --- | --- | --- |
| `easylist.txt` | The EasyList authors, https://easylist.to/ — https://easylist-downloads.adblockplus.org/easylist.txt | Creative Commons Attribution-ShareAlike 3.0 Unported, https://creativecommons.org/licenses/by-sa/3.0/ |
| `ruadlist.txt` | RU AdList authors and contributors named in the original header (including Akuma / DemonSat); https://forums.lanik.us/viewforum.php?f=102 — https://easylist-downloads.adblockplus.org/ruadlist.txt | Creative Commons Attribution 3.0 Unported, https://creativecommons.org/licenses/by/3.0/ |

The original copyright, attribution, license, homepage, and update headers remain in each file. No text changes were made to these snapshots. Their exact SHA-256, byte counts, and subscription version are recorded in the adjacent manifest. The list licenses apply to the list files, separately from the Mouse implementation. Source files are available at the original URLs and in this repository.

EasyList's licensing statement: https://easylist.to/pages/licence.html . RU AdList identifies its CC BY license and contributors in its own header. Copies of the selected license texts are included alongside the subscriptions.

The fallback is used only for an enabled subscription without a valid downloaded cache. The last valid downloaded copy takes priority. A failed update never replaces a valid copy. These snapshots are not a promise to remove every advertisement or to support every syntax present in the lists.

License-text provenance (Creative Commons' own repository):

- `CC-BY-3.0.txt`: https://github.com/creativecommons/cc-legal-tools-data/blob/main/legacy/legalcode/by_3.0.txt ; Git blob `1a16e05564d2aaa880bbe9e506a0a0226d8742cc`, SHA-256 `e6bc9e9c474700b708f568bac9e5a8a9bcb2b1dad53442f5ba449fcb848b8e76`.
- `CC-BY-SA-3.0.txt`: https://github.com/creativecommons/cc-legal-tools-data/blob/main/legacy/legalcode/by-sa_3.0.txt ; Git blob `604209a804632b6e5274005a22293976d07c3099`, SHA-256 `3f941b3b89cf7b8370ceb83cc76d2120d471b58735d8ca60238a751a48d7f72f`.
