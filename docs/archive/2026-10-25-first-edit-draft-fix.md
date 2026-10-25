# First-edit draft protection — 2026-10-25

Scope: [comprehensive review F1](2026-10-25-comprehensive-review.md#f1--p1-first-edit-protection-waits-for-history-recording). F2–F4 and UI findings are unchanged.

## Change

- Text input immediately updates dirty state and starts persistence. Undo snapshots keep the 400ms debounce.
- Unload, hidden-page and external-sign-out paths inspect current content rather than a stale dirty flag.
- Initialized draft storage writes a synchronous, per-page localStorage checkpoint before IndexedDB. Recovery uses existing Web Locks; successful commits remove matching checkpoints. Ownership survives storage retries, and generations prevent older operations from clearing newer work.
- Storage initialization failure still requires saving/exporting before departure. Checkpoints can also fail under quota/denial; warnings and navigation protection remain. Offline saving still requires an IndexedDB commit.
- No schema, currency, SQL, service-worker strategy or Daylight artifact changes.

See [draft internals](../PROJECT_GUIDE.md#saving) and [test commands](../OPERATIONS.md#validation) for maintained documentation.

## Regression coverage

The real-app draft runner holds only the history timer and verifies immediate dirty/save/navigation state, then actual reload recovery for title, detail and caution inputs after reload, pagehide, hidden-page events and sign-out. Reload cases deliberately reject IndexedDB writes to prove checkpoint recovery. Continuous input after a completed save remains recoverable. Existing undo-to-clean, preview, deferred recovery, conflict and offline cases remain enabled.

Tab duplication now also exercises a live checkpoint with failing IndexedDB writes. Storage tests verify checkpoint recovery after write failures, preservation of older drafts after failed initialization, and warnings/export when both persistence mechanisms fail. The legacy-draft fixture defers writes so current lifecycle reconciliation does not upgrade its intentionally missing baseline before reload.

## Verification

Final local verification on Windows with Node 24 and installed Chrome:

| Check | Result |
|---|---|
| `node scripts/build-app.mjs --check` | Generated output matches sources |
| `node --test tests/*.test.mjs` | 123 passed; 0 failed/skipped |
| `node scripts/check-project.mjs` | Passed; 11 days, 36 default events, 12 checklist items |
| `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs` | All 15 suites passed in one final run |
| `git diff --check` | Passed |
| Local SQL execution / physical devices | Not run; no SQL changes |

Tests use local synthetic data and mock APIs; production trip content is not modified. The initial sandbox-only HTTP tests could not connect to their local server; the permitted-network run passed. Intermediate failures in legacy-fixture handling and failed-storage initialization were corrected before the final run.

## CI runner follow-up

The [first CI run](https://github.com/pca01008/us-west-2027-trip/actions/runs/40188310100) passed unit/static, SQL and the other 14 browser suites. Drafts passed the new first-input cases, then reached the runner's 180-second process limit during its existing save-timeout matrix (`spawnSync ETIMEDOUT`); no application assertion caused that termination. Its process limit is now 300 seconds to accommodate the expanded matrix on CI hardware. Other suites retain 180 seconds and the workflow retains its 15-minute limit. This follow-up changes only the runner/docs; deployed application bytes are unchanged.
