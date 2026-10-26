# Operations Guide

Source for setup, reuse, testing, deployment, DB health, and troubleshooting. See [usage](USER_GUIDE.md) and [internals](PROJECT_GUIDE.md). Commands run from the repository root unless stated otherwise.

## Contents

- [Ledger schema 6](#ledger-schema-6)
- [Initial setup](#setup)
- [Updates](#updates)
- [New trips](#new-trip)
- [Validation](#validation)
- [Deployment](#deployment)
- [DB health](#db-health)
- [Troubleshooting](#troubleshooting)
- [UI concepts](#ui-concepts)
- [Daylight](#daylight-rollout)
- [Backup](#maintenance)

<a id="ledger-schema-6"></a>

## Ledger schema 6 deployment and recovery

1. Back up current JSON or an old-app offline copy separately. First conversion also retains localStorage `<tripId>_ledger_v5_backup`; browser storage does not replace backup. Root `*_EDITABLE_*.html` exports remain Git-ignored, never committed/deployed.
2. **Apply server SQL first:** `migrations/20261024_ledger_schema_guard.sql` for existing servers, `supabase_setup.sql` for new ones. RPC retains editor/revision locking and rejects lower-schema saves. No new tables/authorization model.
3. Deploy the updated existing app and minimally compatible Daylight. Daylight remains schema 5 and blocks editing/PREP saves against schema 6. Shared data may remain old until the new app saves.
4. Check dual amounts, recovery, and old-version restore, then save. Separately verify old open tabs cannot overwrite through full/PREP saves. Distinguish real-server evidence from mocks.
5. Keep network-first PWA updating. No precache/strategy change means no worker-version bump for this change. Server protection must cover old tabs/cache; preserve drafts before refresh.

Recover through version compare/restore in the new app. Old versions convert at their own rate before saving as schema 6. Do not roll back to code unaware of new fields. Retain corrupt/future-schema copies/drafts and use compatible code or sound backups. The localStorage backup can be exported as JSON via developer tools.

Checks: `npm test`, `node scripts/check-ledger-browser.mjs`, `node scripts/check-drafts-browser.mjs`, `node scripts/check-imports-browser.mjs`, `node scripts/check-inputs-browser.mjs`, `npm run test:sql`, `npm run test:browser`. SQL needs disposable local PostgreSQL/`TRIP_SQL_TEST_URL`. `tests/ledger.test.mjs` covers calculations, conversion, corruption and RPC migration parity; `scripts/check-trip-sql.mjs` executes downgrade rejection/converted restoration. See [actual results](archive/2026-10-24-ledger-dual-currency.md).

<a id="setup"></a>

## Initial setup

1. Create/clone repositories in normal PowerShell under the user's account, never in the elevated Windows sandbox.
2. Create a Supabase project and editor Authentication account.
3. Set URL, publishable key, trip ID, and editor email in `trip-config.js`; see [reuse](#new-trip).
4. Run all of [supabase_setup.sql](../supabase_setup.sql) in SQL Editor.
5. Match trip ID/email in [register_trip.sql](../register_trip.sql), then run it. Existing IDs preserve data/editor mapping; inspect messages.
6. Verify trip row, editor mapping, bucket, and SQL errors. Empty JSON uses defaults; shared data wins after first save.
7. Complete [validation](#validation)/[deployment](#deployment), checking login/save/photos/versions/cross-browser sync/offline copies.
8. Configure [health](#db-health) separately. Setup SQL/Git push activates neither function nor schedule.

<a id="updates"></a>

## Existing-project updates

- Review SQL/migrations, target project, preserved data, execution results, especially `drop table`, `delete`, `truncate`.
- Apply current setup SQL before deploying to older structures. It preserves content but updates functions/grants/bucket policies.
- For pre-JPEG servers, first apply [20260920_photo_jpeg_fallback.sql](../migrations/20260920_photo_jpeg_fallback.sql): MIME/upload policies change; trips/photos/editor mappings remain.
- Health-table changes need migrations; function changes need deployment. Git push does neither.
- Update owning docs with implementation/configuration changes; link elsewhere and preserve dated observations.

<a id="new-trip"></a>

## Reuse for another trip

Generated `index.html` uses `trip-config.js`; edit the source configuration and rebuild. The current US West app stays schema 6. New-trip template schema 7 supports configurable currencies; see [currency binding](PROJECT_GUIDE.md#currency-binding).

1. Clone/copy under the normal user outside the elevated sandbox.
2. Copy `trip-config.template.js` to `src/trip/config.js`; fill title/dates/zones/checklist/ledger/events. Its inline days replace the current include. For larger trips, move the `days` property into `src/trip/days.js` and include it with `// @include trip/days.js`.
3. Assign unique identifiers and connection/editor settings.
4. Follow [setup](#setup) for a new project, or register another trip on the existing project.
5. Update manifest name/description and `src/index.html` Apple title. Set palette roles in `src/styles/palette.css` when needed. Run `npm run build`; see [deployment](#deployment).
6. Complete validation and the checklist below.

| Unique setting | Purpose | Example |
|---|---|---|
| `tripId` | DB identity/photo folder | `japan-spring-2028` |
| `cacheNamespace` | Browser separation | `japan_spring_2028` |
| `exportBaseName` | Download prefix | `Japan_Spring_2028` |

Use lowercase letters/digits/hyphens for `tripId`; reuse can load another trip's document over defaults.

- `tripStart`/`tripEnd`: ISO timestamps with offsets, e.g. `2028-05-01T09:00:00+09:00`.
- `clocks.home`/`destination`: IANA zones such as `Asia/Seoul`, `Europe/Paris` for clocks/offset.
- `prep.items`: initial checklist, unique IDs.
- `ledger.currencies`: base/quote codes, e.g. `{ base: "KRW", quote: "JPY" }` or `{ base: "EUR", quote: "USD" }`. Use a fresh trip ID/cache and schema 7; never change the pair on an existing trip. Amount precision follows each currency.
- `ledger.defaultExchangeRate`: initial base amount per one quote unit, e.g. `10` means 1 JPY = 10 KRW; update the example rate before use.
- `ledger.defaultBudgetKrw`: compatibility-only initial budget; zero unset, no current UI editing.
- `ledger.categories`: retain `misc`/`deleted`.
- `days`: chronological `YYYY-MM-DD`, no fixed day limit.

```js
{
  time: '14:30', zone: 'LOCAL', title: 'Hotel check-in',
  detail: 'Check-in instructions and address', warnings: ['Confirm late check-in'],
  chip: 'HOTEL', map: { name: 'Hotel', url: 'https://www.google.com/maps/...' },
  reference: { label: 'Hotel details', url: 'https://example.com/hotel' },
  tourCosts: { title: 'On-site costs', items: [{ label: 'Admission', amount: 'USD 20' }],
    total: 'Total USD 20', note: 'Pay on site' },
  photos: [{ id: 'hotel-exterior', src: 'assets/hotel.webp', fullUrl: 'assets/hotel.webp',
    alt: 'Hotel exterior', caption: 'Hotel exterior' }]
}
```

Zone/warnings/chip/map/reference/tourCosts/photos are optional. URLs require HTTPS; arbitrary `extraHtml` is unsupported. Default photos use `assets/`; attached photos stage locally and upload on final save.

Shared setup creates public documents, private editors, revision RPC, history, and bucket. Upgrade old projects first, then run configured registration per trip. Unique IDs isolate current data/50 versions/photos. Registration currently assigns one editor per trip and never silently replaces ownership. Multiple editors need explicit key/registration changes.

Before launch check title/dates/route, tab count/order, PREP/day/ledger initial rules, clocks/offset, login/save/restore, photo prefix, offline reimport, `npm test`/Actions. Keeping US West configuration leaves that trip unchanged. One project can share health checks; another needs fresh SQL/function/token/schedule.

<a id="validation"></a>

## Local and CI validation

Planned environment alignment, shared verification, and publication gating are tracked in [Validation TODO](VALIDATION_TODO.md). That checklist describes proposed changes, not the current procedure below.

Minimum Node 22; Node 24 matches unit CI. Historical Node 22 HTTP-close observations remain in [October 5 evidence](archive/2026-10-05-db-health-verification.md).

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` runs unit regressions and `scripts/check-project.mjs` config/image/HTML/SQL checks. Without npm, use installed Node: `node --test tests/*.test.mjs` and `node scripts/check-project.mjs`.

Without PostgreSQL, dispatch `.github/workflows/validate.yml` on the work branch to run `validate`, `sql`, `browser` without PR/main changes. SQL uses disposable PostgreSQL 17, never production. Verify commit/all jobs before production SQL/deployment.

### Source editing and build

Edit `src/` using the [source map](PROJECT_GUIDE.md#source-modules), then run `npm run build`. Commit source and generated `index.html`/`trip-config.js` together. `npm run build:check`, `npm run check`, and `npm test` reject stale output. Pages serves the committed output directly and excludes `src/`; it does not rebuild it. No watch server or new dependencies are required. Keep include order unless changing initialization intentionally.

`trip-config.template.js` is the reusable template, not the current generated configuration. The historical `styles:consolidate` shortcut was removed because it targets generated HTML. Edit `src/styles/` and rebuild; do not run the old one-time utility.

### Save/permission SQL execution

`npm run test:sql` runs actual setup/registration through [check-trip-sql.mjs](../scripts/check-trip-sql.mjs). Requires Node 24, packages, local PostgreSQL 17 with database/role/publication admin privileges. Example:

```sh
docker run --rm --name trip-sql-test -e POSTGRES_PASSWORD=trip-sql-local-only -p 127.0.0.1:55439:5432 -d postgres:17
```

After readiness:

```powershell
$env:TRIP_SQL_TEST_URL='postgresql://postgres:trip-sql-local-only@127.0.0.1:55439/postgres'
npm run test:sql
# Without npm: node --test scripts/check-trip-sql.mjs
docker stop trip-sql-test
```

Only loopback is accepted; app settings/`DATABASE_URL` are ignored. Fresh/upgrade cases run under automatic `public` table/sequence grants and explicit-only grants, creating/dropping random databases. Absent anon/authenticated roles are temporary; existing roles are untouched. Discard the disposable server after forced termination. Never connect/forward production.

Coverage: control reads/identity sequence confirm grant modes; explicit-only catches missing grants associated with October 30, 2026 changes. Check anonymous/noneditor/other-trip save/history denial, direct document/version/editor write denial, successful revision/content/metadata, conflicts/invalid JSON/UTF-8 4 MiB boundary with preserved history, real two-connection lock contention, 50-version/equal-time ordering/trip isolation, install/upgrade/rerun preservation, path-scoped INSERT and duplicate/overwrite/delete restrictions, bucket size/MIME/public settings.

[Fixtures](../tests/fixtures/trip-sql-bootstrap.sql) minimally emulate auth/Storage. Real JWT, Storage HTTP upload/download/size/MIME enforcement, and Realtime delivery remain outside scope. Test-only read policies ensure overwrite/delete denial is not merely unreadability. Separate from browser mocks/[health SQL](#db-health).

### Browser checks

Isolated local APIs block production. [Fixtures](../scripts/browser-fixtures.mjs) use synthetic trips, `example.test` accounts, generated images. Real phone keyboards/iPhone uploads/Samsung forced darkening need device checks.

Synthetic servers use `injectBrowserFixture()` at the single inert `// @browser-fixture` composition marker. Missing/duplicate markers fail immediately. Fixture deadline options preserve production defaults; no private API is exposed by the normal build.

The paused Daylight artifact and an explicitly supplied pre-marker `VERSIONS_FIXTURE_HTML` use a separate checked archived adapter. Current builds never silently fall back to initialization-line injection.

| Check | Command and coverage |
|---|---|
| Full runner | `node scripts/check-browsers.mjs`; fails if any child fails; drafts has a five-minute process limit, other suites three minutes |
| Diagnostics | `node scripts/check-diagnostics-browser.mjs`: injected failures, exit/scenario, multi-tab PNG/errors/traces, partial capture resilience/startup failure/success cleanup |
| Drafts | `node scripts/check-drafts-browser.mjs`: pending input Undo/Redo and reload, undo-to-clean reload on desktop/mobile; first title/detail/caution input before history, reload/checkpoint/pagehide/hidden/sign-out, continuous input after saving; tabs/clones/recover/defer/conflict/preview/logout/timeouts; PREP/deferred retention, reauthentication/duplicate sign-out, resume/reconnect/Realtime input/focus/selection/category fallback; reversed refresh/Realtime responses, duplicate and old revisions, preview/deferred adoption, dirty reconnect, and public-cache ordering |
| Input | `node scripts/check-inputs-browser.mjs`: desktop/mobile IME/noncancelable input/undo/import/export; keyboard open/Tab/Shift+Tab/Escape/Cancel/Apply focus for expense/category/time/photo dialogs, nested settings and replaced triggers; blank/whitespace category names and photo description/alt text, repeated submission/correction/reopen in both themes, invalid-photo document retention, local expense/map errors and viewport bounds; distant-date setup scrolls instantly before real clicks, while app transitions retain the tested motion preference |
| Ledger | `node scripts/check-ledger-browser.mjs`: dual/category totals/rates/rounding/empty/delete/order, budget compatibility/old HTML/full CSV; 44px inputs/actions, spacing/containment/overflow, long names/high amounts, final-row navigation clearance and Modify hit testing at 320/390/1440px in both themes |
| Compatibility | `node scripts/check-ledger-compat-browser.mjs`: future schema, Daylight/schema 6, corrupt drafts/write blocking/original retention |
| Import | `node scripts/check-imports-browser.mjs`: real files, same-ID full/thumbnail replacements, equivalent Storage URLs/embedded bytes, unchanged offline photo round trips, Cancel/Escape during Apply, replacement/reversed comparison reads, session loss, duplicate Apply, DOM/baseline/history/durable-draft retention; 36 rejected inputs including 19 malformed structures, forced render failure/Undo/Redo/retry, date moves/cancel, sanitization/IDs/numbers, v4 content/checks/empty-day repair, changing revision/explicit save. `tests/import-lifecycle.test.mjs` adds deferred file/read/materialization results and errors, sign-out, reconfirmation and retry; `IMPORTS_FIXTURE_HTML` optionally serves earlier generated HTML |
| Versions | `node scripts/check-versions-browser.mjs`: 54 desktop/mobile scenarios covering date moves with unchanged/reordered events, within-day reordering, combined date/title edits, unchanged state, close/Escape, reversed compare/preview selections, sign-out, stale list reopening, interrupted draft persistence, stalled reads with/without transport cancellation, visible errors and retry; `VERSIONS_FIXTURE_HTML` optionally serves an earlier generated HTML for regression proof |
| PREP | `node scripts/check-prep-browser.mjs`: immediate save, auth cancel/failure/retry, list edits/draft protection; 24 checkbox/list response-loss cases with/without drafts: timeout before commit, committed timeout/transport/SDK failure, later remote changes, unavailable verification, explicit retry without duplicate versions |
| Auth SDK | `node scripts/check-auth-browser.mjs`: actual SDK login errors/503/noneditor, refresh/expiry, cross-tab logout, retained/recovered drafts/save |
| Storage | `node scripts/check-storage-browser.mjs`: open/quota/aborted write/delete, memory/old records, notices/save/export/retry/reload/logout/offline |
| Photos | `node scripts/check-photos-browser.mjs`: conversion/PNG fallback/staging |
| Theme | `node scripts/check-theme-browser.mjs`: choice/blocked storage/device changes/export/print |
| Reusable currencies | `node scripts/check-currency-browser.mjs`: synthetic KRW/JPY and EUR/USD entry, precision, draft recovery, CSV, editable/read-only HTML and mismatch write blocking |
| Palette | `node scripts/check-palette-browser.mjs`: mobile/desktop, light/dark, itinerary/PREP/ledger/timetable/print and role aliases; optional `PALETTE_BASELINE_HTML` compares computed styles and exact PNG bytes against a saved HTML source |
| Navigation | `node scripts/check-navigation-browser.mjs`: real Pretendard loading/failure fallback, Seoul/US West date edges, menus/day/timetable/input, draft reopen/theme keyboard/focus, 320–1440px/breakpoints/reduced viewport/zoom simulation |
| PWA | `node scripts/check-pwa-browser.mjs`: install/cache/offline/timeouts |

Navigation supports `TRIP_BROWSER_ENGINE=firefox`/`webkit`, default Chromium; install that browser first and clear with `Remove-Item Env:TRIP_BROWSER_ENGINE`. Firefox uses a touch viewport, not mobile emulation. Paths are printed. Daylight checks belong to the preserved candidate, not the current root suite; use the runner for current counts.

Scripts accept an absolute Playwright module path first. `$env:PWA_BROWSER_CHANNEL='chrome'` uses installed Chrome. PWA/Auth serve the pinned SDK locally with test URL/SRI substitution, requiring no CDN.

Auth tests alter HTTP responses, not auth functions; virtual time checks automatic refresh/token expiry/rejection, TOKEN_REFRESHED/SIGNED_OUT, UI/session state and refreshed request tokens. A separate SDK-only tab tests actual cross-tab delivery. Production accounts/JWT/DB/Realtime are excluded; outbound HTTP/WebSockets blocked.

Ledger tests compare real offline UI/downloads to fixed expectations: won/cent rounding, stored totals/CSV, fractional legacy KRW, conversion-total differences. Check BOM/commas/quotes/newlines/Korean and apostrophe escaping for =/+/-/@. Downloads remain in temp `westbound-ledger-*`; opening in Excel is untested.

Storage tests inject API failures, synchronous exceptions, quota, and transaction abort after successful write/delete requests. Independent reads verify rollback; refresh recovers only committed records. No physical-disk filling/device eviction emulation.

Draft virtual-time tests cover 29/30-minute warning/expiry, continue/save/discard, clean/deferred states, auth/resume expiry, signed-out refresh/reauthentication, desktop/mobile recover/delete/defer and preview exit.

Imports use [schema-4 fixture](../tests/fixtures/import-v4.json)/actual file inputs. Fourteen wrong-trip/online/version/missing-data/broken-JSON cases retain UI/IndexedDB/server. Dangerous scripts/events/URLs/srcset are blocked while valid content survives. Mock revisions do not replace DB concurrency.

Photo transport tests in `tests/photos.test.mjs`/draft browser tests stall auth/HEAD/upload/download/body, verify duplicate responses, real timeout/cancel disconnection, no public save, retained drafts, busy cleanup/retry, print URL fallback/cancel preventing download. Limits are shortened only in tests; no production calls.

Actions jobs: unit/static Node 24; SQL Node 24/PostgreSQL 17; browser Node 22. SQL uses disposable service/locked dependencies. Browser installs locked packages/Chromium and retains `${runner.temp}/westbound-*/` as `browser-diagnostics` for seven days on failure.

[Diagnostics](../scripts/browser-diagnostics.mjs) saves per-tab PNG, per-context trace ZIP, failure.json before browser close in OS temp `westbound-<check>-diagnostics-*`. JSON includes scenario/error/progress/latest 1, 000 console/page/request/HTTP 4xx/5xx events, including deliberately injected failures. Partial capture errors are recorded without losing others; successful traces are discarded; self-tests use `westbound-diagnostics-self-test-*`.

Open with `npx playwright show-trace "<trace.zip path>"`. DOM/bodies may be sensitive: use synthetic data/new contexts only. Startup failures yield JSON without images/trace. Forced termination/180-second child timeout may prevent capture.

For docs-only changes check paths/links/Pages exclusions and relevant unit/static tests. UI/behavior needs corresponding browser/device checks. Do not present historical counts as current passes.

<a id="palette-maintenance"></a>

### Palette maintenance

Keep the current-site palette unless a replacement is explicitly selected. [Color roles and source location](PROJECT_GUIDE.md#color-palette) define the implementation; [historical A/B/C previews](archive/2026-10-24-color-palettes.md) do not define production colors.

1. Before a visual refactor, save the current generated `index.html` outside the deployed tree. Change role values in `src/styles/palette.css`, run `npm run build`, and review light/dark together. Avoid changing warning/error/category meanings with the brand colors.
2. Run `npm test`, `node scripts/check-palette-browser.mjs`, and `node scripts/check-theme-browser.mjs`. The palette check uses synthetic data and blocks remote traffic; theme checks cover persistence, dialogs and both export types.
3. For a refactor intended to preserve appearance, set `PALETTE_BASELINE_HTML` to the saved source before running the palette check. It requires identical computed styles and screenshot bytes in 24 scenarios. Clear the variable afterward. For an intentional palette change, compare the saved/current PNGs visually instead of claiming parity. Screenshots and results are written to an OS temp `westbound-palette-*` folder, or to `PALETTE_OUTPUT_DIR` when set.
4. Check text contrast (normal text 4.5:1, large text 3:1), focus/selection, warnings, links and totals in both themes. Unit tests derive key contrast pairs from the actual CSS tokens; they are not a complete accessibility audit.
5. Update the project guide if roles/rules change and record the choice and actual checks in `docs/archive/`. Publish application code through the normal deployment procedure. Changing only inline palette values does not add an asset or require a worker-version bump; browser chrome/manifest/icons need their own synchronized update when changed.

On Windows, set `$env:PLAYWRIGHT_BROWSERS_PATH` if the browser cache is outside the sandbox default. Set `$env:PALETTE_BASELINE_HTML='C:/path/before.html'` for the parity run and clear with `Remove-Item Env:PALETTE_BASELINE_HTML`. Preview sources/dated evidence remain under excluded `docs/`.

<a id="deployment"></a>

## Git and deployment

Use one primary shell (PowerShell or WSL); inspect status/diff before/after. `.gitattributes` enforces LF. Preserve user edits, stage only intended files, and follow [AGENTS.md](../AGENTS.md) for metadata/permissions.

```sh
git status --short --branch
git diff
npm run build
npm test
git diff --check
```

Commit/push only within authorization. Verify tracking state/intended remote before claiming a push. Save trip content in the app.

Pages: `main`, root `/`. `_config.yml` excludes `docs` and authoring `src` from HTML deployment; repository access remains. Deploy manifest/PWA scripts/icons/assets with HTML/config. Keep relative install paths; omit manifest `id` so deployment-specific `start_url` identifies the app. Do not add `id: "./"`. Update names/description/Apple title for another trip.

Bump worker `VERSION` for cache-list/strategy/icon/image/font changes. Retain the bundled font and license when deploying or reusing the app; see [typography](PROJECT_GUIDE.md#typography) for loading/export behavior. SDK updates must synchronize pinned HTML URL/SRI and worker `SDK_URL`/`SDK_INTEGRITY`. Close old windows for activation; avoid forced refresh while editing. `scripts/generate-icons.ps1` generates PNGs matching `icons/icon.svg`.

<a id="db-health"></a>

## DB health setup and operation

These are repository-recorded settings; recheck actual activation in cron-job.org/Supabase. October 5 job ID: `8582896`; [dated evidence](archive/2026-10-05-db-health-verification.md) covers deployment/scheduled execution/email receipt.

Flow: cron-job.org → `trip-db-health` Edge Function → `public.healthcheck`, `id=1`. Pages cannot host the API. Daily schedule: **00:17, 06:17, 12:17, 18:17 Asia/Seoul**. Retry once after one second; each DB read including body has a ten-second limit. Failure returns 503 after about 21 seconds maximum; scheduler timeout 30 seconds.

Responses: `200 {"ok":true}` success; `503 {"ok":false}` read/missing-data/configuration failure; 401 token failure; 405 non-GET. No caching. One nonsensitive row is read without touching itinerary/timestamps/history; this is not an end-to-end write/login/photo check.

### Table and token

Resume project `xuzhcogshnjqtunkbsuo` if paused. Run [20261005_db_healthcheck.sql](../migrations/20261005_db_healthcheck.sql), separately even for new projects. Reruns avoid duplicates; anonymous access grants only `id` reads with RLS/no writes. Common setup need not rerun.

Node 22+ (24 for unit parity):

```powershell
node scripts/prepare-db-health.mjs
```

Public config supplies connection data; a cryptographically random 64-character token is generated:

- `.secrets/db-health.env`: `HEALTHCHECK_TOKEN`, `HEALTHCHECK_PUBLISHABLE_KEY`.
- `.secrets/db-health-cron.env`: `SUPABASE_PROJECT_REF`, matching token, empty `CRON_JOB_API_KEY`.

Both are ignored; reruns preserve existing files/tokens and reject mismatches. Keep tokens/API keys out of chat/source/command arguments.

### Function deployment

Use an authenticated CLI or npx:

```powershell
npx supabase@2.119.0 login
npx supabase@2.119.0 secrets set --env-file .secrets/db-health.env --project-ref xuzhcogshnjqtunkbsuo
npx supabase@2.119.0 functions deploy trip-db-health --project-ref xuzhcogshnjqtunkbsuo --use-api
```

`verify_jwt=false` in `supabase/config.toml` allows scheduler calls without user JWT; the function validates `X-Healthcheck-Token`. It accepts a publishable key, not service-role/secret keys. Deployment provides `SUPABASE_URL`.

```text
https://xuzhcogshnjqtunkbsuo.supabase.co/functions/v1/trip-db-health
```

`--use-api` bundles remotely without Docker. Dashboard needs `index.ts` and `handler.mjs` plus matching JWT/env settings. Authenticated CLI 2.119.0 can apply only the verified migration:

```powershell
npx supabase@2.119.0 db query --linked --project-ref xuzhcogshnjqtunkbsuo --file migrations/20261005_db_healthcheck.sql
```

### cron-job.org registration

Use verified account `pca01008@gmail.com`; notifications go to account email. Place the Settings API key in local `CRON_JOB_API_KEY=`; no account password needed.

Preview without external requests/token output, then apply:

```powershell
node --env-file=.secrets/db-health-cron.env scripts/configure-db-health-cron.mjs
node --env-file=.secrets/db-health-cron.env scripts/configure-db-health-cron.mjs --apply
```

The script verifies endpoint 200/ok, reuses matching title/URL, rejects duplicates/incomplete lists, creates disabled, rereads/verifies, enables, then rechecks timezone/schedule/token/notifications. Inspect Console before retrying uncertain API results.

| Manual setting | Value |
|---|---|
| URL/method | Function URL above / GET |
| Header | `X-Healthcheck-Token` from local health env |
| Timezone/schedule | Asia/Seoul; daily 00:17, 06:17, 12:17, 18:17 |
| Timeout | 30 seconds |
| Redirect success / body storage | Off / off |
| Failure alerts | On, from first failure |
| Recovery / auto-disable alerts | On / on |
| Channel | Account email only |

### Validation and response

```powershell
node --test tests/db-health.test.mjs
node --test tests/*.test.mjs
node scripts/check-project.mjs
deno check supabase/functions/trip-db-health/index.ts
deno run --allow-net=127.0.0.1 scripts/check-db-health-deno.mjs
```

Use npx/pnpm Deno if absent. Local HTTP tests cover auth/query/missing row/DB errors/body timeout/recovery. For SQL permissions install `@electric-sql/pglite@0.5.8` in a separate temporary folder, not app runtime:

```powershell
node scripts/check-db-health-sql.mjs '<temporary folder>/node_modules/@electric-sql/pglite/dist/index.js'
```

Isolated SQL contrasts auto/explicit grants, repeated migration, singleton constraint, RLS/anonymous reads, write/DDL denial, row recovery, preserved trips. No production modifications.

Production checks:

1. Confirm one health row.
2. `node --env-file=.secrets/db-health-cron.env scripts/check-db-health-live.mjs`: valid 200, missing/wrong token 401, POST 405, no cache.
3. Confirm Test Run 200.
4. Test emails using a **separate temporary function/job**, keeping URL/header/schedule fixed and changing only endpoint response failure→success. Editing the job can change recovery/email behavior. Never disrupt production. Disable temporary job/remove function/test env afterward.
5. Observe a real scheduled run. Registration success alone proves neither scheduling nor email receipt.

No published threshold guarantees free-project pause exemption. Four daily calls were proposed from guidance about a few daily user DB requests; paused projects need manual Resume. Repeated failures may disable jobs. This watches responses, not scheduler-wide missed execution; that needs separate monitoring.

Rotate function secrets/scheduler headers together and Test Run. Project/public-key changes also need health env changes. On alerts inspect HTTP/recent success/activation, Resume paused projects, investigate tokens for 401 or DB/row/grants/env for 503, fix/reenable, then verify next scheduled success/recovery email.

- [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [cron-job.org API](https://docs.cron-job.org/rest-api.html)
- [Limits/notifications](https://cron-job.org/en/faq/)

<a id="troubleshooting"></a>

## Troubleshooting

| Symptom | Checks |
|---|---|
| UI unchanged after push | Repo/branch → Pages/Actions → close/reopen windows; preserve drafts |
| Old content after defaults change | Shared document wins for same ID; save in app |
| Login failure/repetition | Account/email/project/key → idle expiry → blocked storage → browser/private/file/HTTPS differences |
| Login works, save fails | Trip/editor mapping → RPC/RLS → network/timeout/revision; retain uncertain drafts |
| SQL leaves UI unchanged | Deploy app code for UI changes |
| Photo failure | Original 20MB/compressed 5MB → conversion → MIME/path INSERT → auth/network; HEAD 10s, transfer 60s; retain drafts/retry |
| Changes invisible elsewhere | Actual save → editing/draft/preview deferral → Realtime → fetch after refresh |
| No versions | Editor login, table/policy, prior saves |
| Large offline file | Base64 photos, free space, photo count |
| Wrong theme | [Theme](USER_GUIDE.md#theme): forced darkening/storage limits |
| Health failure | Response procedure above |
| All files changed across Windows/WSL | LF/`.gitattributes`; distinguish content/endings, preserve user edits |

<a id="ui-concepts"></a>

## UI concept comparison

Use [online comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/) remotely. Loopback means the viewing device, not another development PC. Open `docs/ui-concepts/index.html` or serve from root:

```sh
node docs/ui-concepts/serve.mjs
```

Open `http://127.0.0.1:4173/docs/ui-concepts/index.html`; Ctrl+C stops. Local-only binding; override `UI_PREVIEW_PORT` (this session used 4174).

- Concepts use sample times/checks/expenses without production changes.
- `node docs/ui-concepts/prepare-data.mjs` extracts display itinerary/zone/icons and pure timetable logic into generated `timetable-core.js`. Do not hand-edit output. No account/API settings/shared fetch.
- A explores PREP navigation, persistent confirmations, grouped settings and all/one-day timetable. Unwired settings are disabled; defaults are snapshots, not live data. This does not approve removing production features/changing save policy.
- PREP scrolls top/focuses heading. Categories use a desktop column/mobile subtitle. Underlined daily/timetable switches differ from compact range controls.
- Accommodation follows sample stay ranges. PREP shows important incomplete items in list order with source navigation/importance editing; fixed accommodation card removed. B/C retain historical state.
- `node docs/ui-concepts/capture.mjs` checks/captures navigation/filter/check; append `a` for A only. A additionally checks settings/ranges/details/Esc/focus/date/other zones/source immutability. Install browsers; set `PLAYWRIGHT_BROWSERS_PATH` for separate cache.
- Sources/captures stay under excluded docs. Regenerate/capture before committing source/output. Online build copies 11 browser files/six images, refers relatively to accommodation assets, excludes API/helpers. `PRODUCT.md` is excluded too.
- See [original review](archive/2026-10-21-ui-concepts.md), [refinement](archive/2026-10-21-daylight-refinement.md), [usability](archive/2026-10-22-daylight-usability.md). Before selection these were not a permanent design system.

```sh
node scripts/build-ui-preview.mjs
```

Online publication follows main Pages success without changing production root/worker.

<a id="color-palettes"></a>

### Current-app color palette previews

Use the same local server and open `http://127.0.0.1:4173/docs/ui-concepts/palettes-2026-10-24/index.html`. Switch framing, section and brightness together, or open a proposal separately. These are isolated mockups; app editing/saving is disconnected and ledger totals are examples. See the [proposal record](archive/2026-10-24-color-palettes.md).

Rebuild snapshots and screenshots from the current local app with `node docs/ui-concepts/palettes-2026-10-24/build.mjs`. Requires the installed Playwright browser; set `PLAYWRIGHT_BROWSERS_PATH` to its cache if needed. The build blocks remote requests/service workers, strips cloud configuration, and checks navigation, theme switching and document overflow at mobile/desktop sizes. It changes only the proposal folder. Preview files remain excluded from Pages under `docs/`.

<a id="daylight-rollout"></a>

## Daylight candidate and rollout

**Further development/rollout paused October 24, 2026.** These procedures apply only to preserved `codex/daylight-implementation`, never the existing-app refinement root.

<a id="daylight-live"></a>

### Parallel app with actual data

Root keeps existing UI; `/daylight/` shares real documents. See [usage/auth/drafts](USER_GUIDE.md#shared-daylight)/[compatibility](PROJECT_GUIDE.md). Replacing root is a separate decision. Candidate scripts generate/check; main publishes output/legacy compatibility:

- `node scripts/build-daylight-live.mjs`: regenerate `daylight/` after candidate/config/PWA/assets change; never hand-edit. `daylight-live-source` records LF source hash.
- `node scripts/check-daylight-live-browser.mjs`: mock shared saves/importance/stay preservation/concurrent-list conflicts using patched baseline `22ecee3`; CI needs full history. No real writes.
- `node scripts/check-daylight-layout-browser.mjs`: synthetic candidate/output, 320/360/390/520/540/620/621/768/1100/1280/1440px, long Korean/English/large amounts, clipping/overlap/44px targets/input fonts/menu bounds. Mobile Chromium emulation is not real-device/Samsung evidence. Paths print; candidate runner includes it.
- Set `$env:DAYLIGHT_LIVE='1'`, run `node scripts/check-pwa-browser.mjs`, then `Remove-Item Env:DAYLIGHT_LIVE`: `/trip/daylight/` installation/offline/theme/network update.
- Publish full generated directory plus root metadata compatibility. `preserveDaylightMetadata(legacy,candidate)` in `scripts/daylight-legacy-compat.mjs` transfers five functions. Inspect preserved UI/navigation; never overwrite main with candidate root.
- After Pages, verify both addresses read latest same revision without test writes. Both users close/reopen old browser/installed apps online. Rollback retains compatibility/current travel data.
- `node scripts/check-daylight-live-public.mjs` permits only GET/HEAD, checks through login, reports revision/counts without printing/storing document content.

See [live record](archive/2026-10-23-daylight-live.md), [implementation](archive/2026-10-23-daylight-implementation.md), [readiness](archive/2026-10-23-daylight-readiness.md). Root migration needs separate approval. Local regeneration is neither deployment nor candidate CI.

### Equal-condition comparison

[Existing standalone](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-before.html)/[Daylight standalone](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-after.html) use full browser width and HTTPS on phones. Titles identify versions. Same origin, independent trip/cache/draft/offline/theme IDs; direct URLs use persistent `standalone` space. Date/theme/check/editing state remains local per version/device.

Examples have no auth/production save/concurrency server. Save downloads a file. To reset, choose Start fresh on [comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html), then each New tab link. See [publication](archive/2026-10-23-daylight-standalone.md).

Comparison uses identical itinerary/PREP/three expenses. Shared controls: date/theme/trip phase/daily-or-timetable/390/768/1440px; side-by-side/single/new tab. Internal interactions remain independent; Align screens reapplies common navigation/top. Editing may restrict timetable switching. Start fresh isolates session/version IDs/storage/theme. No production API/SDK/PWA; auth/shared save/conflicts are outside scope. Source commits/fixture hash appear in UI and `ui-preview/daylight-comparison.json`.

`node scripts/build-daylight-comparison.mjs` reads explicit baseline/current candidate root. Baseline changes require a new explicit commit/record. Only common fixture/offline isolation/initial expense injection differs from original app code. Regenerate after source changes, never edit output.

`node scripts/check-daylight-comparison.mjs` optionally takes public HTTPS last; checks equivalent config/totals/check isolation/reset/navigation/exact widths/no outbound requests. Captures: `docs/ui-concepts/previews/daylight-comparison/`. Serve locally and open `/ui-preview/daylight-compare.html`; HTTP/HTTPS is needed for frame access. It also opens standalone tabs to check no frames/titles/hashes/identities/check persistence/theme/navigation/full 390/1440px width. Identify checks by `data-check-id`, not completion-dependent order.

### Single candidate and migration

`node scripts/build-daylight-review.mjs` generates `ui-preview/daylight-candidate.html` using synthetic fixtures, no production accounts/content/SDK/PWA. Source-hash-specific identity/offline mode isolates drafts. Editing saves locally; auth/shared saves/conflicts use `node scripts/check-daylight-browser.mjs`/mock checks. Never hand-edit output.

Publish preview/candidate files separately from root changes; verify file list/Pages/HTTPS and banner commit/hash/fixture version. Source changes require regeneration/retesting. `node scripts/check-daylight-review.mjs` checks output hash/isolation/stays/important-check reload/no outbound requests; append public HTTPS for published verification. Hash LF-normalized source. Candidate CI runs on its branch by PR/manual Validate; preview-only main CI is distinct.

Before migration both users preserve drafts via save/export, close/update old apps, and review old-file import differences. After saving new metadata, never edit via unpatched code. Rollback requires current-data backup/metadata-preserving compatibility, never wholesale old-backup overwrite. Defer if these steps cannot be met.

1. Fix reviewed commit/hash and verify that commit's unit/SQL/browser results, not older CI.
2. Preserve each user's drafts and latest revision/photo-inclusive backup; server backup misses other unsaved work.
3. After production approval, apply main/verify Pages. UI transition requires no SQL/server changes.
4. Both users close old browser/installed windows, reopen online, check menus/settings/latest data/reconnect/offline before new metadata saves.
5. Review old-file diffs before importing; on problems stop edits/prioritize current data in fixes/rollback.

Extra checks: `node --test tests/daylight.test.mjs`, `node scripts/check-daylight-browser.mjs` cover importance/pending/failure/stay edges/duplicates/undo/round trips/generated HTML reopening/five widths. Captures: `docs/ui-concepts/previews/daylight-candidate/`; exported HTML ignored. Candidate runner includes checks. Settings additionally verifies actual open-menu left/right bounds at 320/360/390/620/621/768/1100/1440px and export keyboard/Esc/focus. scrollWidth alone misses left clipping.

Sandbox `ERR_NETWORK_ACCESS_DENIED` on localhost is an environment failure, not automatically an app defect. Retry with approved test permissions/use `PLAYWRIGHT_BROWSERS_PATH`; never arbitrarily alter ACLs.

<a id="maintenance"></a>

## Backup and data management

Follow [data policy](USER_GUIDE.md#planning-policy)/[layout](DIRECTORY_PLAN.md).

- Export important states with photos. Git does not back up server data; versions retain 50 only.
- Clean Storage only after checking current/all retained version references. UI deletion differs from file deletion.
- Keep passwords/admin keys/tokens out of source; `.secrets/` ignored.
- Preserve three local travel TXT notes/ignore rules. Historical requests are not new tasks; never copy booking details into public docs.
- [October 16 results](archive/2026-10-16-review.md) are history; reproduce new issues on current code with fresh dates/scope.

<a id="planning-transition"></a>

### Existing planning files

1. Compare files/app; save file-only confirmed facts and resolve conflicts using current valid information. If app is current, nothing to transfer.
2. Retain itinerary/budget files as candidate routes/dated history/estimates. Mark purpose/date and app ownership of confirmed itinerary/actual expenses. No deletion or continuous duplication needed.
3. Keep new research/booking evidence in trip `planning`; save confirmed facts in app. Files do not auto-sync.

No DB/folder migration needed. Configuration supplies defaults; active-trip changes use app saving, not Git deployment. See [reuse](#new-trip).

## Existing-app refinement validation and deployment

[Plan](LEGACY_UI_REFINEMENT_PLAN.md): branch `codex/legacy-ui-refinement` from deployed `1ff42eb`. [October 24 record](archive/2026-10-24-legacy-ui-refinement.md) owns results/limits. Unit/full browser runners include synthetic navigation tests; captures: `docs/ui-concepts/previews/legacy-refinement-implementation/`. Device keyboards/zoom remain distinct from emulation.

Deploy only reviewed root refinement/tests/docs to main; verify Validate/Pages. Do not merge Daylight wholesale or regenerate its existing public artifacts. No SQL/schema/server changes. Users preserve drafts, close/reopen online, check desktop sidebar/mobile bottom navigation and theme. Record publication/real-data saving separately from local regression results.
