# DB Health Verification — 2026-10-05

Historical evidence only. Current procedures: [operations](../OPERATIONS.md#db-health). Paths/environments/job states refer to October 5, Asia/Seoul.

## Completed checks

| Check | Historical result |
|---|---|
| `node --test tests/*.test.mjs` | 110 passed, zero failed/skipped; 54 health/scheduler/secret tests |
| Stalled real HTTP response body | 503 after about21.08s at default limits; both requests aborted |
| Deno entrypoint/typecheck | Passed |
| Local Deno HTTP | 39 checks passed |
| Isolated PGlite 0.5.8 | 16 SQL/permission checks passed |
| Static project | 11 days/36 events/12 checks |
| Whitespace/secret ignore | Passed; both env files ignored |
| cron API auth | HTTP200, zero registered jobs at preparation |
| Production endpoint | 12 checks: 200/401/405, JSON/no-cache |
| Production permissions | One row/RLS/anonymous id read, anon/authenticated writes denied |
| Trip preservation | All trip IDs/revisions/timestamps/content hashes matched before/after deployment |

Node v24.19.0. Isolated SQL ran in memory, not production; Deno HTTP accessed loopback only.

Failure coverage: missing/wrong token, non-GET, missing env/admin key/bad project URL; missing/wrong/duplicate row, bad JSON/HTTP/redirect/network; query/body delay/retry success/permanent exactly-two attempts; preflight failure/duplicate/incomplete job lists/prevent bad activation; random token/matched env/rerun preservation/mismatch refusal; migration repetition/singleton/RLS/read/write/DDL/row recovery/trip fixture preservation.

## Production activation and notifications

CLI login/project ACTIVE_HEALTHY, SQL/two env variables/function deployed. Valid token200, missing/wrong401, POST405. Active job **8582896**, title `DB healthcheck: xuzhcogshnjqtunkbsuo`; Asia/Seoul daily00:17/06:17/12:17/18:17, no expiry; first-failure/recovery/auto-disable alerts via account email only.

Real scheduled call October 5 **19:26:19 KST**, HTTP200/about2.29s at a temporary shorter interval; restored four daily times and reread settings. Next recorded run October 6 00:17 KST.

Temporary recovery job **8582948** retained URL/header/schedule while endpoint changed503→200:

- [Failure email](https://mail.google.com/mail/u/?authuser=pca01008%40gmail.com#all/1a10ba00d1771829): 19:33:20 KST, `pca01008@gmail.com`.
- [Recovery email](https://mail.google.com/mail/u/?authuser=pca01008%40gmail.com#all/1a10ba1d7109a69c): 19:35:17 KST, same address.

Earlier token-change job8582904 produced failure mail but no confirmed recovery after settings edits; fixed-job/temporary-function testing resolved that limitation. Both temporary jobs disabled; final account list had one active production job. Removed `trip-db-health-notify-test`/`HEALTHCHECK_NOTIFY_TEST_FAIL`, reran12 live checks/function-list inspection. Two failure/one recovery emails were deliberate tests, not itinerary outages.

Existing user AGENTS.md/attachments were untouched. No UI changes, so no browser UI rerun.

## GitHub runtime follow-up

Node 22.23.3 passed ~21s timeout/retry/503 but failed server-side close observations for two aborted connections, reproduced locally. Three-second waiting/retained response objects did not close the first before cleanup. Short0.5s requests and Node 24.19.0 default10s requests closed both; internal cause remained unknown.

Unit/static CI moved to verified Node 24. Close observation now waits up to3s instead of fixed50ms; response deadline is measured independently first and both-close assertions remain. Browser CI passed on Node 22. Production Deno/function/schedule unchanged.
