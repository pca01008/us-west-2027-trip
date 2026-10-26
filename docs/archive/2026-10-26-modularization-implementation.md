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
