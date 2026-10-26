# Ownership refactor — October 26, 2026

Baseline: `de00d47`, branch `codex/modularize-travel-app`. Scope follows [the review plan](../MODULARIZATION_REVIEW_PLAN.md). Current trip remains schema 6/KRW/USD; no server data, SQL, storage identity or runtime dependencies change.

## Stage 0 — test seams

Replaced initialization-line browser injection with one checked inert composition marker. Synthetic servers inject their existing narrow APIs and deadline options. Unit coverage checks missing/duplicate markers. Existing review/navigation documents were present before implementation and are preserved in this stage.

Baseline unit/static: 123 tests and project checks passed. Sandboxed loopback tests failed because local HTTP was blocked; normal local execution passed. Browser checks use the existing user Chromium cache. Baseline drafts suite passed its lifecycle, response-loss, ownership, recovery, preview and input-preservation cases.

Stage exit: 124 unit tests, generated freshness/project checks, reusable-currency browser suite passed. Source/generated diff and whitespace checked.

## Stage 1a — ledger domain

`createCurrencyPolicy()` owns immutable currency rules. `createLedgerDomain()` owns exact arithmetic, input calculations and normalization; category/ID collaborators are explicit. Currency labels stay in the view, unsubmitted input buffers stay outside the domain. Ledger/currency tests now load whole source files.

Exit: 8 focused unit tests and ledger/currency/ledger-compat browser suites passed; build/project/whitespace checks passed. The compatibility suite exposed the paused Daylight artifact's missing fixture marker; a checked test-only legacy adapter preserves that separate artifact unchanged.

## Stage 1b — timetable core

`createTimetableCore()` owns time parsing, clock masks/edits, classification and interval layout. DOM reads/rendering remain in `timetable.js`. Tests load the complete core through the explicit factory mapping.

Exit: 14 fixed-expectation unit tests, inputs/navigation browser suites, build/project/whitespace checks passed. The earlier long browser run completed all suites except the already repaired Daylight fixture compatibility check; its separate rerun passed all three cases.

## Stage 2a — repository

`createTripRepository()` owns published reads, revision-checked save transport, version metadata/content queries and Realtime subscription disposal. Callers retain timeout reconciliation, retries, normalization and conflict choices. SDK error objects/status and abort signals remain intact.

Exit: repository/PWA unit checks, versions and PREP browser suites (including response-loss matrix) passed. Build/project/whitespace checks passed. No SQL or permission change.

## Stage 2b and Stop A — dialogs/session

`createDialogs()` privately owns the choice resolver, input, countdown and focus stack. `createSession()` privately owns editor identity, activity/broadcast, auth subscription and timers; workflow callbacks decide expiry/recovery. `editing.js` owns logout/discard decisions and login bindings. Both services dispose the resources they start. The former `auth-dialogs.js` is removed.

Exit: all 127 unit tests and all 16 browser suites passed, including real-SDK auth, nested/replaced focus origins, storage/drafts, version races and root/subpath PWA. Static assertions were redirected to the new owners; repository tests verify metadata-only lazy reads behavior directly. Build/project/whitespace checks passed.

Stop A review: calculations can be changed with complete-file tests; dialog fixes no longer involve authentication or published queries. These concrete boundaries justify continuing with the requested document/storage ownership work.

## Stage 3a — document adapter/session

`document.js` owns serialization, sanitization, legacy repair, normalization and apply/input preservation. Normalization takes a supplied fallback; the workflow supplies current DOM only when needed. `document-session.js` privately owns baseline/revision/remote candidates, dirty/preview/write-block state and undo history. Named published/draft/import/PREP transitions replace external field assignments. Snapshot reads cannot mutate the owner's baseline.

Exit: focused unit checks (including independent PREP divergence and preview preservation), imports, drafts, PREP, versions and ledger-compat browser suites passed; build/project/whitespace checks passed. Ledger form/data callbacks temporarily target their existing state; stage 4 removes that bridge when its controller becomes private.

## Stage 3b, storage slice

`createDraftStorage()` privately owns IndexedDB transactions, Web Locks/claims, synchronous checkpoints, generations, memory records and public cache migration. Storage receives warning callbacks and explicit cache metadata; it never reads publication state or opens dialogs. Workflow guards still execute before invoking writes, without introducing an await before checkpoints. Failed offline saves explicitly retain the dirty memory record.

Exit: focused unit/static checks plus the complete storage and drafts browser suites passed, including first-input navigation, failed/aborted writes/deletes, ownership, deferred recovery and offline baseline reload. Source/generated diff and whitespace checked. Recovery scheduling remains a separate next change.

## Stage 3b, scheduling/recovery slice

`createDraftWorkflow()` owns deferred recovery and the draft timer. Recovery actions moved out of startup; external callers query recovery status or defer/cancel through actions. Published/cache coordination stays in `document-workflow.js`; storage mechanics are unchanged from the preceding commit.

Exit: 29 focused unit checks and the complete storage/drafts browser suites passed. Build/project/whitespace checks passed. First-input checkpoints still execute synchronously through the guard before storage awaits.

## Stage 4 — feature controllers/composition

PREP, ledger, schedule time/decorations, editing/save, navigation, timetable and clocks now have explicit controller factories. Ledger data/input buffers and PREP queues/maps/editor buffers are private. Document callbacks use capture/restore APIs rather than writable compatibility fields. Feature controls bind once to stable roots; startup contains construction/wiring/initialization instead of feature forms or save algorithms. Timetable listeners, clock intervals and navigation/history timers have owned cleanup on actual unload, preserving BFCache.

Exit: all 129 unit tests and all 16 browser suites passed. Build/project/whitespace checks passed. Existing response-loss, replacement/input/focus, exports, lazy version races and PWA cases remain enabled. Media/version/import/operation state is the remaining stage-5 migration.

## Stage 5 and Stop B — comparison/import/version/media

Plain-summary comparison is independent of DOM projection. Import/version controllers privately own pending state and requests/cache; document actions own preview/apply transitions. Save/reset confirmations and the operation handle belong to editing. Photo encoding/hash/immutable transport is separate from photo/map selection/rendering. Exports remain one pipeline. Runtime now contains environment/identity only, with no feature state. Domain/photo/hydration tests read whole factory files. Fixture deadline options replace the global timer interception.

Exit: all 131 unit tests and all 16 browser suites passed, including downloaded editable/read-only artifacts, encoding fallbacks, cancellation, response-loss and version races. One existing local HTTP health test failed transiently; an unchanged full rerun passed 131/131, including the real production-deadline test. Build/project/whitespace checks passed.

Stop B review: no CSS cascade change is justified by the current two-user maintenance needs. Stage 6 groups coherent static HTML, documents existing CSS ownership and removes the misleading historical command; selectors/layers/order/values remain intact.

## Stage 6 — static organization

Grouped dialogs, ledger template and timetable markup under `src/html/` using existing includes. The entire generated HTML is byte-identical to the stage-5 artifact. Removed the historical `styles:consolidate` shortcut and documented current CSS ownership without changing selectors/layers/order/values.

Exit: 36 focused unit checks, palette/theme/inputs/navigation/ledger browser checks passed. Against baseline `de00d47`, all 24 palette scenarios have identical computed styles and PNG bytes (mobile/desktop, light/dark, itinerary/PREP/ledger/timetable/print). Build/project/whitespace checks passed.

Current docs: source map/contracts and CSS ownership in Project Guide, fixture/build command changes in Operations, plan/navigation status updated. User Guide needs no behavior revision. Reviewed source links retain baseline snapshots; no docs were moved/deleted, and existing `src`/`docs` Pages exclusions remain sufficient.

## Final integration

Verified October 26, 2026, 04:22 UTC. Integration target: `d1acc631586c122828146d27853884d7f2b8d754` (the following verification-record commit changes documentation only).

- Build freshness and project checks passed; all 131 unit tests passed, including the real 21-second health deadline test.
- All 16 browser suites passed. Current and explicitly archived baseline version fixtures passed separately; all three ledger compatibility cases passed. The archived adapter preserves the existing `VERSIONS_FIXTURE_HTML` option without weakening the current marker contract.
- Baseline visual parity: identical computed styles and PNG bytes in all 24 scenarios.
- 114 current documentation links checked; source/generated whitespace checks passed.
- Git diff confirms unchanged trip settings/config/template, SQL/migrations/health function, Daylight, PWA/manifest/icons/assets/font, CSS/theme and CI workflow.
- No production data or SQL writes. Browser tests use synthetic fixtures; SQL execution remains the unchanged disposable CI job. Physical-device behavior beyond the existing browser matrix is not certified here.

Application SHA-256:

| Artifact | SHA-256 |
|---|---|
| `index.html` | `1029364f655b3e5348154268c0d50befaba220903d3f535d958ca74290f88175` |
| `trip-config.js` | `162f7aeb1f04675672b3463b5b58ca74168c6375c30ac938351dd174803386ca` |

Stage commits: 0 `9530c19`; 1a `7b6fe20`; 1b `a260d9c`; 2a `799ec79`; 2b/Stop A `097810f`; 3a `8a20dae`; 3b storage `ddb5f36`, recovery `164b3dc`; 4 `1f36441`; 5/Stop B `188f030`; 6 `28c9342`; archived-fixture compatibility `d1acc63`.
