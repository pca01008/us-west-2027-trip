# US West 2027 Trip

A shared travel web app for Las Vegas and Los Angeles, January 21–31, 2027. View the itinerary, PREP checklist, expenses, and photos; designated editors can make changes.

Work now focuses on the existing app. Further Daylight development and production migration are on hold. See the [refinement plan](docs/LEGACY_UI_REFINEMENT_PLAN.md) and [implementation and validation record](docs/archive/2026-10-24-legacy-ui-refinement.md).

## Documentation

| Task | Reference |
|---|---|
| Latest functionality, UI, and test audit | [2026-10-28 project review](docs/archive/2026-10-28-project-review.md) · [Fixes and verification](docs/archive/2026-10-28-review-fixes.md) · [Audit checkpoint](docs/REVIEW_2026-10-28_PROGRESS.md) |
| Fresh functionality, UI, and test audit | [2026-10-26 project review](docs/archive/2026-10-26-project-review.md) — seven reproduced defects, one measured UI improvement, and regression priorities |
| Functionality, UI, and test findings | [2026-10-25 comprehensive review](docs/archive/2026-10-25-comprehensive-review.md) — reproduced issues, priorities, and proposed regression coverage |
| Itinerary, timetable, PREP, ledger, draft recovery, installation, exports | [User guide](docs/USER_GUIDE.md) |
| Architecture, data, saving, permissions, SQL | [Project guide](docs/PROJECT_GUIDE.md) |
| Modular sources and reusable currencies | [Source map](docs/PROJECT_GUIDE.md#source-modules) · [Completed extraction plan](docs/MODULARIZATION_PLAN.md) · [New trips](docs/OPERATIONS.md#new-trip) |
| Ownership refactor for development | [October 26 plan](docs/MODULARIZATION_REVIEW_PLAN.md) · [Staged implementation and checks](docs/archive/2026-10-26-modularization-implementation.md) |
| Current color palette and change workflow | [Color roles](docs/PROJECT_GUIDE.md#color-palette) · [Maintenance](docs/OPERATIONS.md#palette-maintenance) |
| Pretendard font loading, offline copies, validation limits | [Typography](docs/PROJECT_GUIDE.md#typography) · [October 24 checks](docs/archive/2026-10-24-pretendard.md) |
| Setup, new trips, testing, deployment, DB checks, troubleshooting | [Operations guide](docs/OPERATIONS.md) |
| Codex Cloud setup, local handoff, and PR review | [Cloud workflow guide (Korean)](docs/CODEX_CLOUD_GUIDE.ko.md) |
| Required checks and gated publication | [Operations](docs/OPERATIONS.md#validation) · [Remaining validation work](docs/VALIDATION_TODO.md) |
| Separate research from website files | [Directory guide](docs/DIRECTORY_PLAN.md) |
| Dual KRW/USD entry and automatic conversion | [Plan](docs/LEDGER_DUAL_CURRENCY_PLAN.md) — deployed; see the [implementation record](docs/archive/2026-10-24-ledger-dual-currency.md) |
| Historical DB health deployment and notification evidence | [2026-10-05 verification](docs/archive/2026-10-05-db-health-verification.md) |
| Draft and restore bugs, fixes, and validation | [2026-10-16 review](docs/archive/2026-10-16-review.md) |
| Findings and handoff as of October 18 | [2026-10-18 review and handoff](docs/archive/2026-10-18-review-handoff.md) |
| Test results and proposed coverage | [2026-10-19 test review](docs/archive/2026-10-19-test-review.md) |
| Agent rules | [AGENTS.md](AGENTS.md) |
| Compare three UI concepts | [Online comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/) · [Local source](docs/ui-concepts/index.html) · [Review](docs/archive/2026-10-21-ui-concepts.md) · [Run and publish](docs/OPERATIONS.md#ui-concepts) |
| Compare three color palettes for the current app | [Local comparison](docs/ui-concepts/palettes-2026-10-24/index.html) · [Preview record](docs/archive/2026-10-24-color-palettes.md) |
| Review selected concept A (Daylight) | [Latest handoff](docs/archive/2026-10-22-daylight-handoff.md) · [Refined prototype](docs/ui-concepts/a.html) · [First refinement](docs/archive/2026-10-21-daylight-refinement.md) · [Usability changes](docs/archive/2026-10-22-daylight-usability.md) |
| Daylight scope, implementation sequence, acceptance criteria | [Implementation plan](docs/DAYLIGHT_IMPLEMENTATION_PLAN.md) · [Candidate implementation](docs/archive/2026-10-23-daylight-implementation.md) — paused candidate history |
| Compare existing and Daylight versions equally | [Side-by-side comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html) · [Environment record](docs/archive/2026-10-23-daylight-comparison.md) |
| Open each preview as a standalone site | [Existing version](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-before.html) · [Daylight](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-after.html) · [Publication record](docs/archive/2026-10-23-daylight-standalone.md) |
| Use both apps with actual trip data | [Existing app](https://pca01008.github.io/us-west-2027-trip/) · [Daylight](https://pca01008.github.io/us-west-2027-trip/daylight/) · [Shared-data instructions](docs/USER_GUIDE.md#shared-daylight) |
| Daylight readiness and follow-up fixes | [Readiness review](docs/archive/2026-10-23-daylight-readiness.md) · [Rollout sequence](docs/OPERATIONS.md#daylight-rollout) — distinguish local fixes from published files |

The user guide owns usage, the project guide owns implementation details, and the operations guide owns procedures. Archived records describe observations on their stated dates; they do not certify the current production state.

## Architecture and storage

```text
App code: local files → GitHub → GitHub Pages → browser
Trip data: browser ↔ Supabase Database / Auth / Storage / Realtime
Unsaved drafts: IndexedDB in the current browser
```

- `src/` owns editable app and trip sources. `npm run build` generates `index.html` and `trip-config.js`; commit both source and output. See the [source map](docs/PROJECT_GUIDE.md#source-modules).
- The Supabase document for the same `tripId` takes precedence over defaults.
- Git push deploys code; saving in the app updates trip data.
- SQL, Edge Functions, and external scheduled jobs require separate application or deployment.

## Main files

| File or directory | Purpose |
|---|---|
| `src/`, `scripts/build-app.mjs` | Editable app modules, palette, trip settings/itinerary, deterministic build |
| `index.html` | Generated standalone app: itinerary, PREP, ledger |
| `trip-config.js`, `trip-config.template.js` | Generated current configuration and new-trip starting point |
| `supabase_setup.sql`, `register_trip.sql` | Server structure and trip/editor registration |
| `migrations/`, `supabase/` | DB changes and health function |
| `pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` | Installed app and caching |
| `assets/` | Accommodation photos and map captures |
| `scripts/`, `tests/`, `.github/workflows/validate.yml` | Automated validation |
| `test.html`, `test2.html` | Header previews during and after travel |

## Getting started

Travelers use the deployed HTTPS URL. Viewing needs no login; editing requires a designated account. See the [user guide](docs/USER_GUIDE.md).

For development, Node.js 24 matches unit-test CI; the package minimum is Node.js 22.

```sh
npm ci
npm run build
npm test
```

Browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

See [validation procedures](docs/OPERATIONS.md#validation) for coverage and individual commands. Local `index.html` can preview the screen; PWA installation/service workers require HTTPS or localhost.

## Setup and deployment

Follow [initial setup](docs/OPERATIONS.md#setup), [server updates](docs/OPERATIONS.md#updates), or [new-trip reuse](docs/OPERATIONS.md#new-trip). Validated `main` commits publish through GitHub Actions; see [deployment](docs/OPERATIONS.md#deployment). `docs/` is excluded from Pages builds.

Save current trip changes in the app. Editing configuration defaults does not replace an existing shared itinerary. Keep confirmed plans, PREP, and actual expenses in the app; research, alternatives, and booking evidence belong in `planning`. See the [data policy](docs/USER_GUIDE.md#planning-policy).

Public keys belong in browser configuration. Never commit passwords, service-role keys, or invocation tokens.
