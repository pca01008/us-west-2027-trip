# PREP save reconciliation — 2026-10-26

Scope: [comprehensive review F2](2026-10-25-comprehensive-review.md#f2--p2-prep-does-not-reconcile-uncertain-save-results). Other findings are outside this change.

## Change

- Checklist checkbox and list saves reconcile timeouts, thrown transport errors and ambiguous SDK/HTTP failures with one bounded public read.
- Verification checks the operation rather than the entire document: stable checkbox ID/value, or ordered list IDs/text/importance. Later unrelated changes and completion flags are preserved.
- Unverified writes show `저장 결과 확인 필요`, retaining the last confirmed checkbox or list editor inputs. No automatic write retry follows an ambiguous result. Explicit retries read first and skip an unchanged patch, avoiding duplicate versions.
- After an uncertain list submission, submitted new IDs can already exist remotely. Retry preserves their later completion flags instead of initializing them again.
- Existing revision-conflict retries, private drafts/history, offline persistence and pending remote baselines remain in use. No schema, SQL, currency, dependencies, PWA assets or Daylight artifacts change.

Maintained details: [usage](../USER_GUIDE.md#prep-checklist), [internals](../PROJECT_GUIDE.md#state), [validation](../OPERATIONS.md#validation).

## Regression coverage

The existing real-app PREP runner adds 24 combinations: checkbox/list × no draft/unrelated ledger draft × committed timeout, thrown transport error, SDK status-zero error, newer remote changes, timeout before commit, and unavailable verification. Assertions cover server content/revisions/request counts, actual checkbox/dialog feedback, retained inputs and private drafts. Manual retries verify recovery and absence of duplicate versions. Existing auth, conflict, completion/reordering, new-item and offline checks remain enabled.

Only the uncertainty fixture shortens the save deadline from 12 seconds to 120ms; delayed responses take 400ms. Transport/SDK failures occur after the mock commit, with Realtime silent. No production data is written.

A temporary runner served `git show HEAD:index.html` from baseline `7bd7cbc`; the first committed-timeout case failed because the checkbox reverted (`false !== true`). The same new matrix passes with the fix. The temporary runner was removed without altering application files.

Unavailable-verification cases also complete a newly added item remotely before manual retry. The runner checks that retry preserves completion and creates no version. Against `5ad079b` this strengthened case reproduced a second version (`2 !== 1`); the follow-up fix and full focused PREP matrix pass.

## Verification

Local verification: Windows, Node 24.22.1 and installed Chrome.

- Build freshness and project checks passed.
- Unit tests: 123 passed, zero failed/skipped with local networking permitted.
- Focused PREP runner: passed, including all 24 new cases and existing desktop/mobile/offline checks.
- Full `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs`: all 15 suites passed before the submitted-new-ID retry refinement (`5ad079b`). The final focused PREP run includes that refinement and strengthened cases; deployment also gates on CI for the final commit.
- `git diff --check`: passed.
- Initial sandbox HTTP/browser checks could not connect to localhost. The permitted-network run is the verification environment.
- Local SQL execution and physical-device testing are outside this JavaScript change.
