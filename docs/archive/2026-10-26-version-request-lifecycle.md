# Version request lifecycle — 2026-10-26

Scope: [comprehensive review F3](2026-10-25-comprehensive-review.md#f3--p2-version-requests-outlive-the-dialog-interaction).

## Change

- Version metadata, comparison and preview use one current request identity and AbortController. Closing, newer selections and sign-out invalidate previous work before asynchronous cleanup.
- Validity checks after content loading and draft persistence prevent stale dialogs, cached results and preview application. The original draft/preview return state remains protected.
- Reads have an eight-second deadline and reject promptly even when transport ignores cancellation. Loading, timeout and failure messages appear inside the version dialog; selection or list reopening retries explicitly.
- No schema, SQL, currency, dependency, PWA resource or Daylight changes.

Maintained details: [usage](../USER_GUIDE.md#versions-and-restoration), [internals](../PROJECT_GUIDE.md#state), [validation](../OPERATIONS.md#validation).

## Regression coverage

`scripts/check-versions-browser.mjs` adds 44 scenarios across 1280px desktop and 390px mobile Chromium emulation. Tests drive actual version buttons and Escape against synthetic local HTTP fixtures, with external traffic blocked and no public writes.

Coverage includes compare/preview close, all four reversed selection combinations, sign-out during list/content loading, closed/reopened metadata races, cancellation during draft persistence, stalled list/compare/preview reads with both cooperative and uncooperative transport, in-dialog errors, cached preview and successful retries. Assertions check actual dialog/preview state and preserved document content. The full browser runner includes the new suite.

Only stalled-read fixtures shorten the deadline to 150ms; other delayed responses use explicit release gates. The draft-persistence fixture holds completion of the real persistence function. `VERSIONS_FIXTURE_HTML` permits the same tests against an earlier generated file. Against baseline `7b0cb0b`, the first close-during-compare test fails because the comparison dialog becomes visible (`true !== false`); the fixed application passes that test.

## Verification

Environment: Windows, Node 24.22.1, installed Chrome via Playwright, permitted local networking. Initial sandbox HTTP attempts were blocked; those results do not indicate application defects.

- Unit tests: 123 passed, zero failed/skipped.
- Build freshness and project checks passed.
- Versions suite: all 44 desktop/mobile scenarios passed, including interrupted draft persistence and a fresh read after timed-out responses.
- Full `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs`: all 16 suites passed.
- `git diff --check`: passed.
- Rendered desktop/mobile timeout feedback was inspected inside the active dialog. Mechanical UI checks reported two existing template warnings (dynamic image source and stylesheet-derived heading sizes), unrelated to the added status paragraph.
- SQL is unchanged; local PostgreSQL and physical-device testing are outside this JavaScript fix.
