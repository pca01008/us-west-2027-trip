# Comparison date moves — 2026-10-26

Scope: [comprehensive review F4](2026-10-25-comprehensive-review.md#f4--p2-date-movement-can-disappear-from-comparison).

## Change

`buildDiff()` compares each matched event's day index and reports its configured old date → new date. A boundary move now appears even when stable IDs, content and flattened order remain unchanged. Reordering and content differences keep their existing entries. Versions, imports and save conflicts share the fix.

No schema, SQL, currency, dependency, PWA resource or Daylight changes. Maintained details: [usage](../USER_GUIDE.md#versions-and-restoration), [internals](../PROJECT_GUIDE.md#state), [validation](../OPERATIONS.md#validation).

## Regression coverage

- Versions: ten new scenarios across 1280px desktop and 390px mobile Chromium emulation. Real comparison controls verify boundary moves, moves with reordered events, within-day reordering, combined date/title changes and unchanged documents. Assertions check rendered entries, stable event IDs/order and unchanged current content.
- Imports: actual file inputs verify a date-only move appears, enables Apply, and preserves local/server content when canceled, on desktop/mobile.
- Synthetic local HTTP fixtures block external traffic. No production documents are written.

## Verification

- Before the fix, the new boundary-move test failed against baseline `c787a5a`: zero rendered entries instead of one.
- Fixed version suite: all 54 desktop/mobile scenarios passed.
- Unit tests: 123 passed, zero failed/skipped.
- Build freshness, project checks and `git diff --check` passed.
- Full `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs`: all 16 suites passed, including the date-only import checks.
- Desktop/mobile comparison screenshots were inspected; date and order changes remain readable inside the active dialog.

Environment: Windows, Node 24.22.1, installed Chrome through Playwright. Sandboxed loopback requests were denied; successful HTTP/browser checks used permitted local networking. SQL is unchanged; physical-device testing is outside this fix.
