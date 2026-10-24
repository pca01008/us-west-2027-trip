# A · Daylight Production Migration Plan

Written/revised: 2026-10-22 (Asia/Seoul). Revision compared state/PREP/read-only export paths and CI with code; this was document review, not behavior verification.

**October 23 status: candidate implemented/validated and public review published; production migration unapproved.** Candidate branch: `codex/daylight-implementation`. See [implementation](archive/2026-10-23-daylight-implementation.md). [Readiness](archive/2026-10-23-daylight-readiness.md) records later menu/focus fixes; historical CI/publication checks below do not certify subsequent unpublished work. **Further development/migration was paused October 24; retain this as candidate history.**

## 1. Purpose and references

Start from [October 22 handoff](archive/2026-10-22-daylight-handoff.md); this discussion resolved implementation scope/helper-card direction without rewriting old handoffs. [Usage](USER_GUIDE.md), [internals](PROJECT_GUIDE.md), [operations](OPERATIONS.md#ui-concepts) own their topics. Visual baseline: [local A](ui-concepts/a.html)/[public A](https://pca01008.github.io/us-west-2027-trip/ui-preview/a.html), a changing deployment rather than immutable snapshot.

This owns planned changes, not premature future usage. After implementation update authoritative guides and link actual evidence here.

## 2. Approved scope and implementation assumptions

Approved: plan production transition as well as prototype refinement, with separate deployment approval; link accommodation to selected date; manually mark existing PREP items important; show only important incomplete items; preserve functions/purpose and confirm unavoidable functional/save-policy changes; equally support desktop planning/budgets and mobile lookup; keep sage/white/green; retain B/C history; provide HTTPS for remote review.

Implementation assumptions, not separate user approvals: show that night's stay with check-in inclusive/checkout exclusive; checkout remains in itinerary, same-day move shows new lodging; remove fixed LA card from PREP; hide empty/all-complete priority region and restore on uncheck; retain list order without rank/deadline/recommendation scoring; reuse existing HTML/JS/Supabase/tests without frameworks/state libraries/servers/tables.

## 3. Starting implementation findings

| Area | Finding/implication |
|---|---|
| Root | UI/auth/edit/save together; apply design to functioning app, never replace with mockup |
| Then-current schema | Version 5; HTML itinerary/PREP, expense/check arrays; assess DOM effects |
| Capture/apply | Clone/replace main; avoid duplicate derived state/lost layout |
| PREP | Stable `data-check-id`; importance belongs to IDs, not indices |
| Patches/conflicts | Extend `checklistItems`/`patchChecklist`/`checklistShape` so checkbox-only saves retain importance and importance-only edits conflict |
| Stays | No explicit ranges; add linkage without title inference |
| Concept | Default snapshots/fixed times/cities/checks/expenses and disabled settings; production must use applied state and real auth |

`data.js`, `timetable-core.js`, `ui-preview/` are generated; edit source/generators first.

## 4. Screens and behavior

### Navigation and itinerary

Desktop left menu/mobile bottom menu shares itinerary/PREP/ledger selection. Settings groups: Editing and saving / Files / Display, wired to existing permissions/enabled states. Keep draft/error/save/preview notices visible without opening settings. Preserve before/during/after initial policy and user-selected tab/date on clock/server refresh. PREP entry/reselection scrolls top/focuses heading; other navigation protects content/input/focus. Use real home/destination clocks, remove fixed dates/cities. Next-event emphasis may use only precise future starts, never guess unspecified/other-zone/past-day events.

Screen navigation is separate from saved data. Map existing `.day-radio`, date IDs, `.tabs`, `.panel.day`, edit/timetable/export dependencies before replacing controls. Avoid duplicate IDs/focusable hidden menus and never clone original event/checklist DOM.

Distinguish daily/timetable from one/all-day hierarchy. Always show cautions; retain photos/maps/references/costs and time/category/add/delete/undo/redo tools. Reuse overlap/overnight/unspecified/other-zone logic. Keep desktop All/mobile One default and day retention; align breakpoints. Details support keyboard/Esc/return focus.

### Date-specific accommodation

Add Show as accommodation and checkout date on an existing event; start is its panel date, name/photos/map from original event, no separate duplicated accommodation editor.

| Situation | Behavior |
|---|---|
| Check-in ≤ selected date < checkout | Show stay |
| Checkout without replacement | Hide card; retain itinerary checkout |
| Same-day move | Show new stay |
| Missing photo/map | Use actual event title; omit missing controls/photo |
| Unset range/deleted source | Show no guessed lodging |
| Invalid/nonlater checkout | Error before apply; retain input |
| Overlap | Editor warns; imported data shows candidates/review state, never arbitrary winner |

Compare destination **calendar dates**, not UTC/device conversions. Allow checkout through the day after trip end; reject impossible dates such as February 30. Stay designation is independent of category/color. Card uses applied draft and follows undo/redo; clearing designation removes attributes, not the event/photos. Applying the range changes only a draft until shared save. Never force defaults onto existing shared data by title/order; absent linkage means hidden card until the user assigns it. Initial assignments need actual-data review/authorized editing.

### Important PREP items

Add accessible labeled importance toggles in list editor. New items are incomplete/not important; importance publishes only after list Save and cancels with Esc/Cancel. Priority region shows important incomplete text in list order with source navigation, never a second checkbox set. Do not duplicate `checks`/counts. Original checkbox focus/scroll is the navigation target; if missing, use a valid PREP heading.

Keep priority items visible as Saving while `pendingChecks` retains pre-save state; remove only after success. Failure retains/restores item/error/retry. Text/order/check completion preserve importance; deletion removes it. Existing list saving excludes unrelated drafts and shares importance between users. No recommendations when none are selected.

### Ledger and remaining features

Categories always visible: desktop column/mobile subtitle. Preserve the candidate's then-existing add/edit/delete/order/search/category/date filters/budget/manual rate/totals/CSV. Keep unadded input/cursor during refresh/save. Connect login/logout/version/restore/draft/import/two exports. Preserve Light/Dark/Device, light printing, PWA/offline policies. Keep help concise and omit implementation details from ordinary UI.

## 5. Data and compatibility

### Minimal extension and state sources

Proposed verified `data-check-important="true"` defaults false. Original row carries stay designation/`data-stay-checkout="YYYY-MM-DD"`; start derives from its actual day. Derived cards are not stored. No large state model outside existing HTML; attributes alone do not guarantee compatibility.

| State | Derived-region source |
|---|---|
| Normal viewing | Currently applied public document, not pending remote notification |
| Local editing | Applied draft, matching original content/photos |
| List dialog | Temporary list inside; outside remains pre-dialog state until successful save |
| Check pending | Applied state plus pending pre-save/progress flags |
| Version preview | Preview version; exit restores original draft |
| Deferred recovery | Current public state, never unapplied deferred content |
| Offline | File's recovered/applied state, never defaults/online substitute |

Refresh regions at existing apply boundaries, without extra server requests or dirtying data.

### Paths to update

1. Validate allowed attributes/elements/real dates/booleans in sanitization.
2. Carry importance through checklist items/patch/shape, reorder/conflict/draft merge.
3. Exclude tools/derived content from capture; count original checkboxes only.
4. Regenerate after apply/recovery/Realtime without accumulating DOM.
5. Revalidate links after event moves/deletion/restore without automatic public writes.
6. Add meaningful metadata differences to version/import summaries.
7. Preserve offline metadata; remove print tools while retaining readable information.
8. Extract only needed display metadata/IDs, excluding accounts/API settings.

`commitChecklistPatch()` transforms remote, `nextLocal`, `nextBase`, undo history; all must preserve metadata/exclude other drafts. `stateSummary()`/`buildDiff()` must detect metadata-only changes so Import remains enabled. Sanitization replaces ledger with `moneyTemplateHtml`; old and new data need the same final template. Prefer one derived container outside main; otherwise remove during capture/sanitize and regenerate. Repeated normalize/apply/capture and tab/day/theme/range changes must retain fingerprint/dirty state/check count.

### Schema/old clients

Choose schema 5 versus bump from compatibility experiments and record evidence; document version is separate from DB schema. Preserve old content/checks/ledger with absent metadata defaulted. Import/restore lacking metadata must show its removal before confirmation. Old open apps can erase fields; a version bump alone is not protection. Reopen both users' apps and handle old files before rollout. Rollback editing requires proven field-preserving code or backup/compatibility first. If server protection/scope expansion is required, explain risk/options and obtain confirmation; never migrate with unresolved uncertainty.

### Export and print

`exportStaticHtml()` removes app code then adds `appendReadonlyRuntime()`; update independent navigation/photo runtime too. Offline embeds state/config/photos and regenerates regions even after save/reopen. Read-only keeps daily layout/all dates without edit/auth/save/timetable; either minimal stay lookup or original-event accommodation information, never dead cards/menus. Retain readable importance with immutable checks and existing photo-failure policy. Print hides desktop/mobile menus/settings/status without clipping itinerary. Reopen both actual generated files in fresh contexts; screenshots alone are insufficient.

## 6. File scope

| Files | Planned changes |
|---|---|
| `index.html` | Layout/theme/navigation, range/importance editing, capture/apply/sanitize/diff |
| Export functions/print styles | Offline/read-only navigation/derived-region handling |
| Config/template | Defaults/examples/document version if needed; never overwrite shared data |
| `docs/ui-concepts/concepts.js` | A-only helper replacement; preserve B/C |
| `daylight.js`, `daylight.css` | Prototype state/interaction/responsive regions |
| `concepts.css` | Only necessary common changes, check B/C |
| prepare-data/capture/build-preview | Metadata extraction/synthetic checks/captures/generated publication |
| Browser fixtures/checks/tests | New/old/concurrent scenarios, keep external blocking/regressions |
| `sw.js`, `pwa.js` | Only if paths/cache/activation affected; never force refresh unsaved work |
| Guides/README/PRODUCT | Final usage/internals/operations and navigation/direction |

File splitting is not a goal; external CSS/JS affects single-file export/offline/PWA and needs a concrete benefit.

## 7. Phases and outputs

Resolve ordinary technical choices from evidence without repeated approval. Ask only for feature reduction, save-policy change, or server scope changes. Record brief decisions here: fields/schema and derived placement by phase 1; read-only stay strategy by phase 2; review generation/test isolation before phase 3.

### Phase 1: feature map and compatibility

**October 23 decision:** retain schema 5, add importance and checkout only (checkout also identifies lodging). Regenerate `#daylightContext` outside main from applied DOM. Include importance in shape/patch/diff. Read-only shows checkout on original events with existing date tabs. Old apps still need updating.

Map navigation to shared radios/panels; event tools to original cards/dialogs plus range; PREP to existing auth/revision patches plus importance; ledger to existing functions/template; save/undo/errors to visible toolbar/status; versions/logout/files/theme to grouped settings; timetable/details reuse existing logic; exports retain runtime with actual-file tests.

`build-daylight-review.mjs` generates candidate review from root with synthetic fixture, no production API/accounts/PWA, unique storage. Public offline review demonstrates local editing; same-source local mock API tests verify saves/conflicts. Identify commit/source SHA-256/fixture version.

Experiment with metadata capture/apply/recapture and checkbox/list saves. Fix legacy input/version policy; retain export fixtures/runtime dependencies. Output feature map, field/schema decision, compatibility tests, old-app transition requirements. Record baseline commit/tests/existing failures and preserve preexisting uncommitted docs. Completion: verified persistence/restoration without omitted features.

### Phase 2: prototype/public review

Implement synthetic stays/priorities, pre/during/post-trip, empty/all-complete/no-stay, desktop editing/mobile lookup, settings/errors/pending. Capture/test/build within approved preview publication. Output working A/captures/clear unwired markers; remote review without B/C/production impact.

### Phase 3: production-code skeleton

Apply design to functioning code on isolated `codex/` branch or suitable existing worktree. Never deploy root to main before approval. Preserve original DOM/separate derived regions; check old-state apply/edit/recovery. Completion: same content before/after save, no navigation-created drafts.

### Phase 4: connect features

Connect itinerary/timetable/stays; PREP importance/source navigation/pending/failure/retry; ledger/filter/totals/settings/saves; auth/session/draft/conflict/version/files/theme. Remove fixed dates/times/cities/sample numbers. Preserve usage permissions/save policy; no unwired production settings.

### Phase 5: integrated verification/docs

Run criteria/regressions without weakening tests. Inspect rendered typography/overflow/focus/dark/print. Compare guides with final behavior and old-version handling. Output results/limits/docs/candidate; disclose untested scope and resolve data loss/regressions.

### Phase 6: approval and migration

Publish review without real writes; synthetic/mock data, independent PWA scope or registration disabled, separate trip/storage/auth keys (disabling PWA alone does not isolate storage). No actual account/private fixtures. Reproducibly generate from candidate, not hand-maintained copies. Pages alone cannot mock full auth/server saves: disclose public limitations and use same-source API tests; define any separate interactive environment first. Identify candidate/fixture; retest changed code. Obtain approval only after review/validation/old-app/rollback preparation, then deploy validated files/check Pages/public assets/worker. Completion: both users see existing data/new metadata with old-window/file instructions.

## 8. Required validation

| Area | Cases/expectations |
|---|---|
| Stays | Before/check-in/multiple nights/checkout/move; missing data/invalid/overlap/deleted sources; no guessed lodging |
| Priorities | Set/unset/check/uncheck/all-complete; pending survives until success, failure retry; original counts unchanged |
| PREP/concurrency | Check/list edit/reorder/delete/failure; retain importance/latest checks, detect importance conflict, exclude other drafts |
| Round trips | Public/IndexedDB/version/import preserve content/IDs/photos/maps/metadata or explain removals |
| Applied states | Draft/deferred/preview/pending remote regions match original source |
| Diff/dirty | Metadata-only detected; repeated rendering/navigation/theme/range leaves fingerprint/check count unchanged |
| Legacy | Missing fields default safely; destructive metadata removal appears in diff |
| Screens | Before/during/after, unspecified/empty/pending; no fake numbers |
| Timetable | Overlap/overnight/zones/date/details/keyboard retain semantics |
| Ledger/auth | Remote input/cursor, filters/deleted category/totals/CSV; login expiry/deferred/conflict retains drafts |
| Responsive/accessibility | 360/390/768/1280/1440px, intentional timetable scroll only; keyboard/focus/reduced motion/long text/zoom/non-color status |
| Theme/files | Light/dark/device/print/both exports, actual fresh-file all-date/photo/stay access without operational requests |
| PWA | Reconnect/cache/old windows/offline; no forced refresh or review/production collision |

Use [operations](OPERATIONS.md#validation): relevant checks per phase, then `npm test`, `npm run test:browser`, prototype checks, `git diff --check`. Retain CI SQL but do not expand SQL execution solely for UI changes. Unit/SQL CI uses Node 24/browser Node 22; local Node 24 does not prove candidate browser CI.

Map PREP checks to importance/pending/concurrency; drafts/storage to unrelated-draft/history protection; imports to metadata-only/old/generated-file cases; timetable units to time semantics/stay boundaries; auth/ledger/photos retain user assertions; theme/PWA/project checks update UI/output/config/docs. Register any small extra browser scripts. Pure date/filter/metadata functions deserve meaningful units; persistence/conflict/restore needs real browser flow. Keep existing user-focused assertions when selectors change.

Record commit/uncommitted changes/runtime/commands/pass/fail/untested/captures/diagnostics without private snapshots. Real keyboards/forced darkening remain explicit limits.

## 9. Deployment and rollback

Never overwrite actual documents with test fixtures. Confirm latest revision/backups and perform only authorized data changes. Git/config changes are not data saves. Validate old-window/rollback metadata preservation before new saves; never bulk-restore historical expenses. Authorized commits/pushes follow Windows rules and status/log/tracking/remote verification. Confirm Pages/public behavior; historical handoff successes are not current evidence.

## 10. Documentation

Update USER_GUIDE for navigation/range/priority; PROJECT_GUIDE for metadata/derived/capture/sanitize/schema; OPERATIONS for isolation/checks/old apps/files/deploy/rollback; README navigation; PRODUCT direction; dated archives for actual results. Existing docs exclusion covers this plan; moving/removing/public-path changes require link/test/exclusion review.

## 11. Historical completion checklist

- [x] Feature map/fields and schema decision.
- [x] Legacy data/draft/file compatibility with mandatory old-app update.
- [x] State sources/pending/failure behavior.
- [x] Stay/priority prototype review.
- [x] Production-code skeleton and features.
- [x] Fixed examples removed/no missing functions.
- [x] Unit/browser/visual/accessibility/responsive checks with real-phone/non-Chromium limits recorded.
- [x] Actual generated offline/read-only files and print checked.
- [x] Guides updated.
- [x] Public review/limitations/rollback supplied.
- [x] Candidate/review correspondence and final CI: candidate `38380e5`, unit/SQL/browser success.
- [ ] Separate production migration approval.
- [ ] Production deployment/public behavior/cache confirmation.

All items began incomplete October 22; checked items reflect October 23 evidence in [implementation](archive/2026-10-23-daylight-implementation.md). Final unchecked deployment means production root transition, not preview publication.
