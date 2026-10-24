# Test-Focused Project Review — 2026-10-19

Historical review/local results, not assurance of later code/production. Proposals below are coverage gaps, not reproduced feature bugs.

## Scope and results

Draft recovery/conflicts/photo failure coverage was strong; prioritize real SQL, malformed input, and storage failure. Reviewed app/SQL/unit/browser/CI/docs without code/production edits. User requested saving the record/README link; no proposed tests/fixes/deployment/commit/push performed. [Operations](../OPERATIONS.md#validation) owns execution procedures.

Passed114 units/zero failures or skips; project 11 days/36 events/12 checks; six browser suites drafts/inputs/prep/photos/theme/pwa. Windows Node 24.19.0, installed Chrome155.0.8059.80 via `PWA_BROWSER_CHANNEL=chrome`; npm absent, direct Node commands.

Initial sandbox failed two HTTP units and lacked default Playwright browser/localhost access. Installed Chrome confirmed ERR_NETWORK_ACCESS_DENIED; authorized outside-sandbox rerun passed, an environment issue. Local mocks block production: results do not verify real DB/Auth/devices.

## Prioritized coverage proposals

### 1. High: execute save/permission SQL

[Project tests](../../tests/project.test.mjs) mostly inspect SQL strings; [draft browser tests](../../scripts/check-drafts-browser.mjs) emulate revisions. [Health SQL tests](../../scripts/check-db-health-sql.mjs) cover a different table. Execute [setup](../../supabase_setup.sql)/[registration](../../register_trip.sql) in isolation:

- Deny anonymous/noneditor/other-trip saving/history and direct document mutation; permit editor RPC.
- Use separate concurrent connections at the same revision: one succeeds/one conflicts.
- Failed conflict/invalid/oversized writes preserve current/history; successful save increments once/retains latest 50 per trip.
- Preserve data/editor mapping through install/upgrade/rerun and isolate trips.
- Verify photo paths/per-trip upload/overwrite/delete policies, distinguishing DB policy checks from Storage service enforcement.

### 2. High: import/sanitization/legacy compatibility

[App](../../index.html) readImportFile/sanitizeMarkup/normalizeState/migratePublishedState needs actual-file malformed cases: wrong trip/future/missing versions/data/broken JSON with original draft intact; duplicate event/check/photo IDs, invalid numbers, scripts/events/dangerous URLs. Block execution while retaining legitimate content/links/photos. Legacy fixtures must preserve content/checks/stable IDs. A changed revision during comparison requires recomparison/confirmation, never automatic apply/save.

### 3. High: IndexedDB failures

[PREP tests](../../scripts/check-prep-browser.mjs) replace a save function, not actual open/write/delete handling. Inject open/quota/aborted transaction/delete failures; verify notices, in-memory retention, shared-save/export/retry, honest deletion failure, old-record preservation. Never imply uncommitted data survives refresh; verify actual committed records match messages.

### 4. Medium: ledger arithmetic/CSV semantics

Current project checks mostly assert filter/CSV/category code presence; input preservation exists but numeric output needs fixed independent expected totals, rates/rounding, unset/over budget, empty/deleted category, combined date/category/search filters matching CSV rows. Inspect actual downloaded commas/quotes/newlines/Korean/formula-prefix escaping.

### 5. Medium: actual Auth SDK

Draft/PREP auth stubs always succeed and do not implement onAuthStateChange, so logout protection alone does not verify SDK wiring. Add a few actual-SDK/local-API cases for password/server/noneditor failure, refresh/expiry/external logout events, retry/draft retention. Keep production-account validation distinct.

### 6. Medium: failure diagnostics

[CI](../../.github/workflows/validate.yml) uploads artifacts but screenshots are mostly checkpoints and drafts lack failure trace. Save scenario/screenshot/console/request errors/trace before browser closure, matching upload paths. Use synthetic data only, no actual tokens/private travel. Keep string checks for deployment configuration, execute user behavior for important flows.

## Devices and sequence

Current mobile tests emulate Chromium dimensions/touch, not iPhone Safari/Samsung Internet. Before deployment, each user's device should check login→photo→save→draft recovery→offline reopening. If Safari is used, limited WebKit core-flow checks are proportional.

Order: SQL/import first, storage/ledger next, SDK/diagnostics last. Reuse Node/Playwright; no framework replacement/broad device matrix needed. Update actual [operations coverage](../OPERATIONS.md#validation) when tests are implemented.
