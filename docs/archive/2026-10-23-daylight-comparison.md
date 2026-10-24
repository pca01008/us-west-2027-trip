# Existing App and Daylight Equal-Condition Comparison

2026-10-23. User requested direct comparison; earlier tools offered only candidate/A-B-C concepts.

| Version | Baseline | LF index SHA-256 prefix |
|---|---|---|
| Existing |`22ecee308d3019cf6303a3d464013ea7172e4d6c`|`ae302c9f6d7c`|
| Daylight |`7ba5285b2d4cbb1fb4830265b7cb60527efa61d8`|`e6f6cd083791`|

Common synthetic fixture 2/hash `a2c796346162`: identical itinerary/12 PREP/budget/three expenses/importance/stays. Only candidate has derived metadata views. Photos are synthetic placeholders; no actual data/accounts/server requests.

[Public comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html) shares date/theme/trip phase/view/frame width; side-by-side/single modes, independent editing/checks, fresh-example reset. See [procedures](../OPERATIONS.md#daylight-rollout). Reproducible source generation injects only SDK/PWA removal, isolated storage, common initial expenses. No production-root/shared changes; auth/public saves/concurrency excluded.

## Validation/publication

Windows Node 24.19.0/Chromium. Build generated two HTML/control page/manifest. Checks passed equivalent settings/three expenses/totals/check isolation/phase retention/reset/common date-theme-timetable/exact390-768-1440 widths/single-side modes/zero outbound. Mobile shell scrolls comparison area only without scaling frames. Desktop (`../ui-concepts/previews/daylight-comparison/side-by-side.png`; historical artifact unavailable in this checkout)/mobile (`../ui-concepts/previews/daylight-comparison/mobile.png`; historical artifact unavailable in this checkout); shell visual verdict `ship`. No real accounts/devices/Safari; candidate regressions remain in [implementation](2026-10-23-daylight-implementation.md).

Implementation `8386147`; public-only `70ffd9e`, six preview files. [Pages39903062729](https://github.com/pca01008/us-west-2027-trip/actions/runs/39903062729) build/deploy/report all succeeded. Initial public test started before deployment and timed out; complete rerun afterward passed. Public root matched22ecee3; candidate unchanged.18 project units/static/whitespace passed. No full app rerun for comparison-only changes; dedicated checks passed locally/public HTTPS.
