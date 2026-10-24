# Pretendard font application

Local validation: October 24, 2026, Asia/Seoul. Baseline: `ef1581c` on `codex/legacy-ui-refinement`; remote main was `c46ea58`. Publication must be verified separately after committing this record.

## Scope

Applied self-hosted Pretendard Variable 1.3.9 to the existing app only. Kept icons, colors, layout rules, shared data, schema, permissions, dependencies, Daylight, and historical previews unchanged. Controls inherit the family; the time editor retains aligned digits with `tabular-nums`.

The official WOFF2 is 2,057,688 bytes; SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`. The bundled OFL notice is also retained in exported HTML. See [typography](../PROJECT_GUIDE.md#typography) for loading, precaching, export embedding, and fallback behavior.

## Validation

- All 120 unit tests and project checks passed; `git diff --check` passed.
- All 13 Chromium browser suites passed, including drafts, shared saves, time input, imports, ledger, authentication, photos, themes, navigation, and PWA.
- Navigation checks load the real font before measuring. Chromium, Firefox, and WebKit passed 320–1440px/breakpoint checks, both themes, menu placement, Add button/currency separation, final-row clearance, reduced viewport, and CSS zoom simulation. Daily itinerary/PREP additionally checked at 320/390/768/1440px.
- Font unavailable: title and navigation remain usable at 320px. Editable/read-only exports loaded the embedded font from local HTML; failed font download preserved the exported content/styles using system fallback.
- PWA loaded the font after clearing HTTP cache with the network disconnected, at both `/` and a deployment subpath.
- Static checks: 11 days, 36 events, 12 PREP items. No production API writes.

Synthetic Chromium captures: [390 itinerary](../ui-concepts/previews/pretendard-2026-10-24/light-390-d1.png), [390 PREP](../ui-concepts/previews/pretendard-2026-10-24/light-390-prep.png), [1440 ledger](../ui-concepts/previews/pretendard-2026-10-24/light-1440-ledger.png), [390 dark itinerary](../ui-concepts/previews/pretendard-2026-10-24/dark-390-d1.png). Full-page captures retain the fixed navigation at the capture-time viewport position.

## Limits

These are Windows browser automation results, not physical iOS/Android or screen-reader certification. The WebKit Windows port rendered variable weights lighter despite loading the requested family/weight; its geometry checks do not certify Safari's visual weight. Chromium/Firefox captures were visually inspected. Existing dimensions, contrasts, and small header labels were retained within the font-only scope.

Initial sandbox runs could not use localhost HTTP or the default Playwright cache; approved local test permissions and the existing browser cache resolved those environment failures. A WebKit computed-family assertion was normalized for its unquoted serialization. No ownership/ACL changes.
