# Remote refresh ordering — F3

Fix for F3 in the October 26 project review. Baseline: `191b7bf`.

## Changes

- Share one remote-adoption path between refresh and Realtime. Require a revision newer than the publication and at least as recent as the pending candidate before rendering or caching it.
- Invalidate earlier refresh responses and errors when another refresh starts or a newer Realtime update arrives.
- Keep only the newest pending remote candidate during editing, draft recovery, historical preview, and PREP operations. Ignore duplicate revisions without resetting history or rewriting cache. A refresh can adopt the pending candidate after deferral ends.
- Preserve deliberate historical preview and its return state independently of publication/cache ordering.
- Add 11 workflow unit regressions and desktop/mobile browser checks for reversed reads, Realtime races, duplicates, older revisions, historical preview/deferred adoption, dirty reconnect, and retained drafts. Check displayed itinerary/expenses, baseline, pending content, and persisted public cache.

Implementation: [Project guide](../PROJECT_GUIDE.md#cache). Test procedures: [Operations](../OPERATIONS.md#validation).

## Verification

- All **151 unit tests passed**, including the 11 new workflow cases.
- Regression proof: the first 10 new workflow cases all failed against the unchanged baseline, including the reproduced revision 12 → 11 rollback. They pass with the fix. The additional deferred-adoption case also passes.
- Build freshness, project checks, JavaScript syntax, and whitespace checks passed.
- All **16 browser suites passed**: final desktop/mobile drafts, plus the other 15 suites from the standard runner. The strengthened dirty-reconnect checks also passed. Browser cases assert actual rendered state and persisted IndexedDB cache, not only revision flags.

Environment: Windows, Node `v24.22.1`, installed Chrome through Playwright. The restricted unit run could not connect to loopback HTTP tests; permitted execution passed. Browser tests use synthetic trips and local APIs with external requests blocked. No production trip writes. SQL and physical-device execution are outside this local check; SQL/schema/permissions are unchanged.

Application SHA-256: `6c670d903282418b80305582238152c672fbe55bd95d217294eabb10bfcfb3aa` (`index.html`).
