# Existing-App Refinement Implementation and Validation

Executed 2026-10-24, Asia/Seoul.

## Scope/baseline

Origin `https://github.com/pca01008/us-west-2027-trip.git`; fetched baseline `1ff42eb3205d8f499042df462e2026f8798296f8`. Created `codex/legacy-ui-refinement` there and brought [plan](../LEGACY_UI_REFINEMENT_PLAN.md)/visuals/product direction from 37a93be, not the entire Daylight branch. Retained navy/coral/cards/fonts; no Daylight artifacts/comparisons/actual data/SQL/schema/dependency changes.

Initial record covers local implementation. Following user request, verified `7d08bedbe92728540c4f56a6a779cbbad3cb12d6` was fast-forwarded to main/Pages October 24. Public200/new navigation/theme/CSV/no budgets checked; that commit's Validate/SQL/browser all passed. No production data edits.

## Implementation

Shared desktop/mobile bottom itinerary/PREP/ledger uses existing radios/original DOM. Device-date initial rules/day/timetable/unadded input survive navigation. Removed budget/search/category/date filters/registration-order text and filter events/state; retain budget fields and normalize old ledger HTML/current template, without budget diff display.

CSV beside Expenses exports all current/unsaved entries in array order. Add works through icon, inherited font/icons/one line, full mobile width/min44px. Theme B uses native radios/checks/effective-brightness icon/Esc/outside/focus behavior; storage warning stays outside closed menu, preserving path persistence/live device modes.

Offline retains navigation/theme. Print/share removes navigation/date/theme/CSV controls, shows all panels/keeps photo viewing. README/guides align with final behavior, distinguish current root from preserved candidate/public paths, retain local candidate exports/targeted ignore rule. Existing docs exclusion needed no config change then.

## Validation

Final single full run: 114 units and all12 Chromium suites exit0; Firefox/WebKit navigation separately passed, synthetic APIs only. Initial import budget expectation updated to rate difference/no-budget UI and included in final run.

- Units114; static11days/36 events/12 PREP; whitespace passed.
- Full suites: diagnostics/drafts/storage/inputs/imports/ledger/prep/auth/photos/theme/navigation/pwa.
- Navigation: before/first/middle/last/after travel in Seoul/US West, same-UTC different dates, menu/day/timetable/remote selection/unadded input, expense CRUD/draft reopening, theme keyboard/focus/closing.
- Both themes at 320/390/519/520/521/620/621/680/681/768/899/900/901/1440: menu actual bounds/click positions, Add/currency overlap/overflow/final-expense spacing.390×360 reduced viewport/CSS zoom2 simulated.
- Firefox 153.0/WebKit 26.5 same navigation suite exit0, date edges/draft/theme/14 widths/both themes/CRUD. Firefox uses touch viewport, not mobile emulation. Firefox 390 light menu/WebKit 1440 dark ledger visually reviewed; not Firefox Android/iOS Safari evidence.
- Ledger compared eight actual CSV downloads per desktop/mobile: empty/Korean/commas/quotes/newlines/formula/BOM/currency/rounding/order/deleted category/legacy budget HTML/value/importance/stay preservation.
- Existing shared-save/conflict/restore/draft/write blocking/photos/auth/offline/exported-file regressions included. [Operations](../OPERATIONS.md#validation) defines limits.

Initial sandbox localhost denial retried with local-test permission. Automatic approval-review usage limit interrupted execution; resumed after user continuation. No ownership/ACL changes. Date regression came from Playwright resetting vertical scroll before clicking horizontally hidden dates: reveal horizontally then use real pointer/touch. PREP theme tests inject existing change events under modal; real theme interactions covered separately. PWA now selects bottom itinerary before dates.

## Visual evidence and limits

Synthetic [390 light menu](../ui-concepts/previews/legacy-refinement-implementation/light-390-menu.png), [1440 light ledger](../ui-concepts/previews/legacy-refinement-implementation/light-1440-ledger.png), [320 dark ledger](../ui-concepts/previews/legacy-refinement-implementation/dark-320-ledger.png), [768 dark menu](../ui-concepts/previews/legacy-refinement-implementation/dark-768-menu.png). Sticky tools may appear at capture-time scroll position in long images.

Impeccable ran once. [Raw result](2026-10-24-legacy-ui-design-check.json) warned about old small header text/kicker/decoration, assumed-white header contrast, hidden viewer src populated on selection. New controls were checked by actual rendering/interaction; approved scope retained old header/timeline. Not full accessibility certification.

Verified root SHA-256 `f2f2dfd6efc5674c7b9313d88cb6a7935c06326f2e406dc4950c13727c640999`.

Initial local validation did not include physical keyboards/notches/device zoom/Samsung forced darkening/screen-reader interaction/public HTTPS. Viewport/touch/CSS zoom is not device evidence. No additional local SQL integration/actual-account save because DB/grants/SQL unchanged. Later public deployment checks above are separate from these initial limits.
