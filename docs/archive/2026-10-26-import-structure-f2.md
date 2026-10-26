# Import structure and rollback — F2

Fix for F2 in the October 26 project review. Baseline: `7d5e348`.

## Changes

- Validate imported panels and required checklist, itinerary, and photo elements in detached markup before comparison. Reject missing, duplicate, nested, unknown, or conflicting day panels with a fresh-download message.
- Rebuild the ledger controls from the current template. Preserve the frozen v4 import: omitted days become empty shells without introducing default events.
- Revalidate before live application. Restore original main nodes, ledger data, and expense input buffer if rendering fails; always clear the applying flag.
- Adopt the compared published baseline only after successful application. Failed imports retain publication metadata, pending remote state, dirty state, history, and stored drafts.
- Add two workflow unit regressions and desktop/mobile file-input regressions: 19 malformed structures, render failure, exact rollback, input retention, Undo/Redo, retry, and legacy repair.

Implementation and validation procedures are documented in [Project guide](../PROJECT_GUIDE.md#offline), [User guide](../USER_GUIDE.md), and [Operations](../OPERATIONS.md#validation).

## Verification

- Generated output freshness, project checks, and whitespace checks passed.
- All **140 unit tests passed**, including the two new workflow regressions.
- Targeted import browser checks passed on desktop and emulated mobile: **36 rejected inputs per viewport**, forced rendering failure/recovery/retry, sanitization, v4 migration, and revision conflicts.
- Regression proof: the new import runner against baseline `7d5e348` fails with `paragraph only must be rejected before comparison`. The same case passes against the fix.
- All **16 browser suites passed**. Final targeted imports also passed after adding the explicit application-boundary and canonical-ledger-repair assertions.

Environment: Windows, Node `v24.22.1`, installed Chrome through Playwright. Restricted local networking initially blocked browser navigation and two HTTP unit cases; permitted local runs passed. Synthetic test trips and loopback APIs only; no production data writes. PostgreSQL execution and physical-device checks are outside this local verification; the unchanged SQL workflow runs on CI.

Application SHA-256: `ead711ba0384bd75135161fcc153e8486ee77d5a8d4197661c5e92f30da6cd6e` (`index.html`).
