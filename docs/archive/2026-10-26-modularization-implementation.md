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
