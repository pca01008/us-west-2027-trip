# Dual-Currency Ledger Implementation Record

2026-10-24, Asia/Seoul. Separates initial local validation, later CI, and production/public checks on `codex/legacy-ui-refinement`. Initial local work did not read/change actual expenses. [Plan](../LEDGER_DUAL_CURRENCY_PLAN.md), [usage](../USER_GUIDE.md#ledger), [internals](../PROJECT_GUIDE.md#ledger-timetable), [deployment](../OPERATIONS.md#ledger-schema-6).

## Changes

Schema6 retains fixed KRW/USD, manual source/applied rate; one input calculates the other, manual pairs remain intact. BigInt decimal fractions round positive half-up to won/cents with string/precision/range checks and field-linked hints/errors. Added expenses stay fixed after rate changes; totals/categories/CSV/diffs/drafts/offline/print use new fields.

Legacy conversion uses each document's rate once, preserves original precision/backup, and explains previous-total differences. Unadded input survives authenticated recovery. Existing/Daylight apps block future-schema writes; corrupt new amounts error without overwriting/deleting IndexedDB drafts. Full/incremental SQL share RPC downgrade protection with auth/revision checks. Navigation screenshots moved to temporary diagnostics to preserve older dated evidence/images.

## Local validation

Synthetic trips/localhost only, no actual writes/phones/Excel. npm absent; equivalent Node commands, outside-sandbox execution needed for localhost/HTTP units.

Passed calculation/validation/legacy/re-normalization/corruption/migration-parity units. Desktop/mobile covered one/both inputs, same-number source change, clearing, automatic zero, precision/range, fixed rates, edit/cancel/stale edit rejection, remote raw/source/cursor retention. CSV checked totals/categories/order/delete/empty/BOM/CRLF/Korean/quotes/newlines/formula protection; reopened two-currency working files/print amounts/hints. Separate compatibility checker covered future existing-app schema, Daylight/schema 6, corrupt schema 6 draft: save/write/delete blocked with original retained. Reviewed320/390/1440/light/dark and adjusted desktop Add/card/mobile amount/button layout. Static design tool still reported legacy CSS contrast warnings; no warning-free claim.

| Command | Initial final local result |
|---|---|
|`node --test tests/*.test.mjs`|120 passed, zero failed/skipped|
|`node scripts/check-project.mjs`|11 days/36 events/12 checks|
|`node scripts/check-browsers.mjs`|13 suites passed: diagnostics/drafts/storage/inputs/imports/ledger/ledger-compat/prep/auth/photos/theme/navigation/pwa|
|`git diff --check`|Passed|
|`node --test scripts/check-trip-sql.mjs`|Prerequisite missing, not executed|

Installed Chromium/cache `C:/Users/이승종/AppData/Local/ms-playwright`. Ledger/downloads temp `westbound-ledger-Uk82M3`; theme/navigation `westbound-navigation-chromium-diagnostics-6Ry9Ze`. Light errors/dark desktop/320px visually inspected.

At this point `TRIP_SQL_TEST_URL` was unset/no local PostgreSQL found; SQL stopped at startup, so real grants/revision/downgrade were not verified. Migration/deployment/old production-tab rejection/commit/push were not yet done.

## Subsequent predeployment CI

Committed/pushed `eb12e00` to work branch and manually dispatched Validate without PR/production DB/main changes. [CI39](https://github.com/pca01008/us-west-2027-trip/actions/runs/40097751940) failed actual PostgreSQL17 saves: PL/pgSQL `current_schema` collided with builtin name, causing `numeric < name`. Renamed in setup/migration to `stored_schema_version`/`incoming_schema_version`.

Fix `114ed04`; [CI40](https://github.com/pca01008/us-west-2027-trip/actions/runs/40097976140) passed validate/sql/browser: 24 SQL, 120 units/project, 13 browser suites. SQL covered fresh/upgrade, automatic/explicit grants, normal/concurrent revision saves, schema 6 downgrade rejection/converted restore. Local120 units also passed.

Production still pending then. Main was f03e727; dry-run HEAD:main confirmed fast-forward path; real push/Pages awaited verified migration application.

## Production application and public checks

User confirmed production SQL applied October 24; this is user confirmation, not a direct server-definition query. Fast-forwarded `2b71ccb` to origin-main. [Pages40100061664](https://github.com/pca01008/us-west-2027-trip/actions/runs/40100061664) build/deploy passed; [main Validate40100061797](https://github.com/pca01008/us-west-2027-trip/actions/runs/40100061797) passed 120 units/project, 24 SQL, 13 browser.

Public root/config/Daylight returned200 and matched deployment LF content:

| File | SHA-256 |
|---|---|
|`index.html`|`7ca47c5e2c727aa4a9d63593bf705ce748defb301a8a5a9a3e47c01915ea8163`|
|`trip-config.js`|`1201c65323a8e9f568063b4b4cead7a6ab4f78f3dfc4f8d453a17ed04c6ec15a`|
|`daylight/index.html`|`b59362ef1cdeef77cade0ec902fbb3f91b9c68ff87180bbcd96bbdcd3f7a6436`|

Isolated Chromium public root: shared GET200/client schema 6/dual inputs/no overflow at 1440/390; zero JS errors/writes. Allowed only GET/HEAD/OPTIONS, no login/save. No actual document/photos/screenshots in outputs. This does not replace installed-device updating/production-save verification.

Kept local exports; root `*_EDITABLE_*.html` ignored to avoid public publication. Actual shared document may convert on next normal user save. Follow-up record/README/plan-only commit changes no app/SQL.
