# Project review — 2026-11-06

Historical baseline audit of `7a42630`. See the [implementation follow-up](2026-11-06-review-fixes.md) for changes and current verification.

## Scope

Fresh review of the current two-user travel app: functionality, UI, and test reliability. Audit only; no production data changes or implementation fixes. Earlier reports are historical references and are not evidence that a defect remains.

## Assessment

The existing architecture and visual system remain suitable for two users. Three user-visible defects were reproduced; the main risks are delayed reads crossing lifecycle boundaries, not missing basic CRUD coverage. Prioritize F2/F3, then F1. Four concrete UI/workflow/performance improvements and three test/normalization improvements follow. No P0/P1 incident or demonstrated server authorization bypass was found in the reviewed scope.

| Item | Priority | Outcome |
|---|---|---|
| F2 | P2 defect | Late editor read reverts accepted revision 12 to 11 |
| F3 | P2 defect | PREP editor reopens after second-tab logout |
| F1 | P2 defect | Renaming an undated expense inserts today's date |
| U4 | P2 improvement | Photo-heavy drafts cause substantial synchronous input cost |
| U1 / U3 | P2 improvements | Reach ledger totals sooner; disclose local-draft replacement on import |
| U2 | P3 improvement | Increase meaningful supporting text selectively |
| T1 | P2 coverage | Add cross-controller race regressions |
| T2 / T3 | P3 improvements | Unique/idempotent expense IDs; direct behavioral tests as touched |

Sampled Impeccable technical assessment: **15/20, Good**. This is a prioritization aid, not accessibility certification or a full production performance audit.

| Dimension | Score / 4 | Evidence and limitation |
|---|---:|---|
| Accessibility | 3 | Keyboard/dialog/error coverage passes; small supporting type; no screen-reader/device run |
| Performance | 2 | Fresh staged-photo profile shows input cost growing with serialized bytes |
| Theming | 3 | Light/dark/print tests and sampled captures pass; no exhaustive pixel contrast audit |
| Responsive design | 3 | Existing width/zoom checks pass; mobile ledger priority can improve |
| Implementation integrity | 4 | Coherent retained palette/navigation; all five detector warnings explained in context |

Implementation-integrity verdict: **pass for the visual system**. This does not waive the separate lifecycle defects below. The app's current Operate surfaces benefit from precision and restraint rather than a replacement design.

## Evidence standard

- Confirmed defect: current source plus a reproducible failure or an unambiguous reachable code path.
- Improvement: a concrete usability or maintenance benefit, without claiming broken behavior.
- Verification gap: behavior not established by available automated or manual evidence.
- Priorities: P1 data loss/security/core flow failure; P2 user-visible defect; P3 limited-impact improvement.

## Baseline and verification

- Code baseline: `7a42630`, branch `codex/modularize-travel-app`; initial tree clean. Audit adds documentation only.
- Node 24.22.1 on Windows; installed Playwright 1.62.1 browsers. `npm` is absent from this sandbox PATH; exact underlying Node commands are used.
- Build freshness and project checks passed. Unit tests: 186/186 passed with approved host execution (24.1s). Restricted execution initially failed two local HTTP tests; host execution isolates that environment limitation.
- Chromium full regression runner: **16/16 suites passed**, approximately 435.3s combined suite time; longest was drafts at 140.3s of its 300s deadline. All suites remained below the runner's 75% timing-warning threshold.
- Firefox/WebKit compatibility: **6/6 input groups passed** (navigation, dialogs, editing per engine). Functional coverage only; the WebKit fixture uses keyboard theme selection, so this is not WebKit pointer-theme or physical-device certification.
- Local synthetic probes use the current generated app and current source controllers, actual bundled SDK against a loopback mock, no production requests/writes. 12 captures cover 390/1440px, light/dark, daily itinerary/PREP/ledger. No horizontal overflow or page errors in those captures.

| Area reviewed | Current evidence |
|---|---|
| State, save/conflicts, drafts and recovery | Source review, unit tests, drafts/storage suites, new F2 probe |
| Auth, inactivity, cross-tab state | Source review, actual SDK auth fixtures, new F3 probe |
| Itinerary/PREP/timetable | Navigation/input/PREP suites, timetable unit tests, rendered captures |
| Ledger and currencies | Domain/controller review, ledger/currency/compatibility suites, new F1/T2 probes |
| Media, imports, exports, version history | Source review, photo/import/version suites, rendered read-only export check |
| PWA | Worker/registration review, root and project-path offline/refresh browser checks |
| SQL and deployment | Permission/revision/schema source review and contract tests; no PostgreSQL/CI/deployment execution |

Commands executed (Node scripts underlying the documented npm commands):

```text
node scripts/build-app.mjs --check
node --test --test-concurrency=1 tests/*.test.mjs
node scripts/check-project.mjs
node scripts/check-browsers.mjs
node scripts/check-browser-engines.mjs
node scripts/profile-editing-browser.mjs <local-json-output>
node --test tests/project.test.mjs
git diff --check
```

Browser tools used the installed pinned cache through `PLAYWRIGHT_BROWSERS_PATH`; local HTTP/browser execution required host permission. No tests were weakened or dependencies installed. Final documentation checks are recorded in the checkpoint. Full strict Linux/SQL validation was not run.

## Confirmed defects

### F1 — P2: Editing an undated expense assigns today's date

- Location: [ledger.js](../../src/app/ledger.js), lines 86–103, `openExpenseDialog()` and `saveExpenseChanges()`.
- Reproduce: load a valid legacy/imported expense with `date:''`; open Edit; change only the name; apply.
- Observed: the date input and saved draft become `2026-11-06` in this run. The ledger supports an explicit undated display, so editing another field should preserve that state.
- Cause: both edit initialization and save use `item.date || todayLocal()` / `input.value || todayLocal()`.
- Fix direction: retain empty dates for existing records; use today's default only for new expenses. If dates become mandatory, require an explicit choice.
- Regression: round-trip empty date through no-op edit, name edit, category edit, import/export; existing nonempty dates must remain unchanged.

### F2 — P2: A delayed editor-entry read can roll back the displayed revision

- Location: [editing.js](../../src/app/editing.js), lines 126–135, `beginEditing()`; compare the guarded adoption path in [document-workflow.js](../../src/app/document-workflow.js).
- Reproduce with a clean authenticated view: hold the editor-entry fetch for revision 11; let normal refresh adopt revision 12; then release the older fetch.
- Observed with the actual SDK and local mock: baseline `12 -> 11`, newest title disappears, editing opens on the older document. The source-controller probe also recorded revision 11 being sent to the cache callback.
- Cause: editor-entry generation prevents stale authentication actions, but does not compare document revision after the await. It applies and establishes any fetched document unconditionally.
- Impact: stale screen/cache and an avoidable save conflict. This is not proof of silent server overwrite: the server's expected-revision check remains active.
- Fix direction: reuse the document adoption invariant across editor entry, refresh, and Realtime. Do not adopt a row older than either accepted or pending published state.
- Regression: delayed editor read versus newer refresh and Realtime, both arrival orders, pending remote candidate, auth cancellation, current-revision read.

### F3 — P2: A pending PREP read reopens its editor after logout

- Location: [checklist.js](../../src/app/checklist.js), lines 146–153, `openChecklistEditor()`; [editing.js](../../src/app/editing.js), `closeEditorDialogs()` / editor-entry invalidation.
- Reproduce: sign in, finish editing, switch to PREP, hold the list editor's document read, sign out through a second SDK tab, then release the held read.
- Observed: authenticated `false`, dialog hidden before response then visible after response, Save enabled. Actual SDK mock probe produced no page errors or outbound requests.
- Cause: the PREP controller does not invalidate its open request or recheck authorization after awaiting the latest document.
- Impact: a signed-out user is returned to an unusable editor and can receive a misleading save failure. No authorization bypass is claimed; server-side write permission remains separate.
- Fix direction: invalidate pending opens on close/logout and check the request generation and editor session before rendering. Keep the existing draft preservation policy.
- Regression: second-tab signout, manual logout, expired session and superseding opens while the PREP read is pending; stale results must not reopen or enable controls.

## UI and workflow improvements

Preserve the current navy/coral identity, desktop sidebar, mobile bottom navigation, and separate brightness preference. No redesign is recommended from static detector warnings.

### U1 — P2 improvement: Make existing expenses and totals easier to reach on phones

At 390×844, after navigating to the ledger, the add form is 535.5px tall. The total begins around viewport y=852, below the bottom navigation at y=775. Recording an expense is prominent; checking accumulated spending requires extra scrolling even when no new entry is intended. This is an information-priority choice, not an overflow defect.

Keep a compact total above the form/list, or expose the entry form through a clear Add action while retaining unfinished input. Reduce nested padding before reducing target sizes. Test both quick entry and reviewing/editing an existing expense at 320/390px with the keyboard visible. Source: [ledger template](../../src/html/ledger-template.html), [ledger styles](../../src/styles/ledger.css), [refinement styles](../../src/styles/refinement.css). Suggested design action: `$impeccable layout`.

### U2 — P3 improvement: Increase important supporting text selectively

Computed styles at 390px show 9px exchange-rate metadata and 12px itinerary remarks. Screenshots confirm that supporting details are substantially smaller than headings and form inputs. Improve the few labels needed for decisions (rate/date, itinerary details); avoid uniformly enlarging every decorative label. Start around 12px for meaningful metadata and 14px for descriptive body text, then verify wrapping in both themes and at enlarged text settings. This is a readability recommendation, not a claimed contrast or standards violation. Source: [ledger styles](../../src/styles/ledger.css), [itinerary styles](../../src/styles/itinerary.css), final theme/refinement overrides. Suggested design action: `$impeccable typeset`.

### U3 — P2 improvement: Explain when importing replaces an existing local draft

[imports.js](../../src/app/imports.js) compares the file with the latest published snapshot and says it will become a draft. Applying calls `applyImportSnapshot()`, replacing the current document and resetting undo history. A local-only change can therefore disappear without appearing in the published-versus-file difference list. The user explicitly chooses Apply, so this is a disclosure improvement rather than an unconfirmed import corruption claim.

When the current document is dirty, add a short warning that its draft will be replaced; offer cancellation and a straightforward way to export it first. Preserve the existing comparison and second-read revision check. Regression: different local-only and file-only changes, cancellation preserves visible/durable draft, successful apply clearly replaces it. Suggested design action: `$impeccable clarify`.

### U4 — P2 improvement: Reduce repeated whole-document work while typing with staged photos

A fresh run of [the existing profiler](../../scripts/profile-editing-browser.mjs) on this baseline reproduced the earlier byte-dependent editing cost. Windows Node 24.22.1, Chromium 151.0.7922.34, 390×844 viewport, synthetic 32-event trip; eight generated 1600×1000 JPEGs/thumbnails produce a 9.16 MiB staged document. Other browser runners had completed before profiling.

| CPU rate / staged photos | Input handler median | Draft flush median | History median | Undo / redo |
|---|---:|---:|---:|---:|
| 1× / 0 | 9.7 ms | 10.0 ms | 7.7 ms | 22.8 / 22.2 ms |
| 1× / 8 | 709.5 ms | 571.4 ms | 466.4 ms | 597.2 / 587.8 ms |
| 4× / 0 | 47.8 ms | 45.7 ms | 34.5 ms | 114.3 / 112.4 ms |
| 4× / 8 | 2709.4 ms | 2183.6 ms | 1743.7 ms | 2369.0 / 2316.7 ms |

Repeated operations use five samples; undo/redo are single measurements. Input measures synchronous dispatch through the actual input handler; flush separately awaits persistence. CPU throttling is not a phone model, and this measures neither heap usage nor real IME latency. Stored content and undo/redo checks passed.

The relevant path is [editing.js](../../src/app/editing.js) `queueHistory()` → dirty evaluation/immediate flush, repeated [document-session.js](../../src/app/document-session.js) cloned snapshots, DOM capture and serialized draft storage. Profile these components before changing semantics. Start by avoiding repeated full snapshot/capture work within the same input event and keeping unchanged photo bytes out of repeated comparison work. Do not merely delay all durable writes or weaken undo history to make timings look better. Repeat the same correctness profile and test representative phone photos. Suggested design action: `$impeccable optimize`.

### Retain these working behaviors

- Stable mobile bottom navigation and desktop sidebar; theme controls restore keyboard focus.
- Inline form errors, exact dual-currency arithmetic, explicit source amounts, and unchanged historic exchange rates.
- Isolated PREP patches, revision conflicts, uncertain-write reconciliation, per-tab draft ownership, photo staging, and explicit publish/save actions.
- Offline exports embed images/fonts; read-only runtime exposes all 13 panels. Service worker excludes database/Auth/Storage traffic and does not force-reload drafts.
- SQL source retains editor checks, row locking, expected revision, schema downgrade rejection, 4 MiB limit, and 50-version retention. Execution against PostgreSQL was not repeated in this audit.

### Detector disposition and visual limits

Impeccable source detector completed with five warnings: four accent stripes and one dialog image without a static `src`. The stripes belong to the retained timeline/category system; the viewer image receives its source before opening. These are not promoted to defects. Small native checkbox boxes are inside larger clickable labels; hidden day radios are not user-facing targets.

Inspected fresh synthetic captures include mobile light ledger, mobile dark PREP, desktop dark itinerary, desktop light ledger, mobile one-day timetable, and desktop all-days timetable. Full-page screenshots can place sticky controls within the capture; this alone does not prove overlap. The timetable fixtures intentionally freeze the clock. Physical touch, screen-reader speech and OS text scaling remain unverified.

## Test and operational gaps

### T1 — P2: Cover races across controllers, not only within each controller

Existing refresh tests protect out-of-order refresh/Realtime, and auth tests protect late editor login/signout. F2 crosses those boundaries; F3 reaches PREP instead of the itinerary editor. Add the F1–F3 regressions to the existing ledger/auth/PREP suites. Prefer controlled deferred responses and observable state over sleeps. A green current suite does not cover these new reproductions.

### T2 — P3: Make expense ID repair unique and idempotent

The current [normalizeExpenses](../../src/app/ledger-domain.js) (line 108) appends `-duplicate-<index>` only once, without reserving existing IDs. A direct source-factory probe gives:

```text
input:  x, x-duplicate-2, x
pass 1: x, x-duplicate-2, x-duplicate-2
pass 2: x, x-duplicate-2, x-duplicate-2-duplicate-2
```

This confirms a normalization invariant failure; it does not demonstrate a production multi-delete or data-loss path. Main flows often normalize again, which can repair the first result. Reserve normalized IDs and choose unused suffixes in a loop, following the existing imported schedule/photo repair pattern. Test adversarial suffix collisions, sanitized/truncated IDs, repeat normalization, and preview/apply identity. No property-testing dependency is necessary.

### T3 — P3: Replace fragile behavioral source extraction as touched

Some [project tests](../../tests/project.test.mjs) extract function bodies from generated HTML using regex. Keep source/build/SQL/asset contract assertions, but test behavioral cases through existing factories or browser flows when those areas change. Avoid a broad suite rewrite; generated text matching alone cannot establish runtime ordering such as F2.

### Verification still needed outside this Windows audit

- Execute the strict full coordinator on its declared Ubuntu 24.04/Node/npm baseline with disposable PostgreSQL 17; no local SQL service/URL was available here. Source inspection is not SQL execution.
- On both travelers' phones: IME/numeric input, virtual keyboard, photo picker/format, installed offline launch/reconnect, and text enlargement. Browser emulation is separate evidence.
- Test representative real photo sizes before choosing a performance change. No production credentials, database writes, migrations, deployments, or current production verification were used.
- Keep outstanding environment/device work in [VALIDATION_TODO.md](../VALIDATION_TODO.md); this dated report does not supersede its unchecked items.

## Recommended sequence

1. Fix F2 and F3 with the controlled race regressions; both are small lifecycle corrections with direct user impact.
2. Fix F1 and add empty/invalid-date boundaries; then address T2 without changing monetary values or schema.
3. Apply U3's concise draft-replacement disclosure. Review U1/U2 with both users before changing the familiar layout.
4. Measure the existing photo-heavy editing path, then choose one targeted optimization if representative phone behavior warrants it. Preserve immediate draft protection and undo/redo.
5. Run relevant unit/browser checks, then the required release coordinator and real-device checks. Finish any UI changes with `$impeccable polish`; use `$impeccable audit` afterward to compare the same surfaces. No framework migration, new service, currency migration, or broad CSS refactor is needed for these findings.
