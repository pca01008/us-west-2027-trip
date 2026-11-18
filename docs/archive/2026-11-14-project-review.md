# Project review — November 14, 2026

**Reviewed again on November 18, 2026** against the same source, `a178b19`. Two targeted Chromium checks confirmed the visible effects of F1 and F3. The six implementation findings stand. T2 moves from P2 to P3 because the operations guide already covers visual comparison. The full-suite counts below are from November 14.

## Verdict and scope

**Implementation integrity: pass, with targeted defects.** The existing app has a coherent purpose and architecture for two travelers. Keep the current navy/coral UI, source composition, revision-based saves, independent drafts, and schema 6 KRW/USD data. A framework migration, new backend, or restart of Daylight is not justified by these findings.

Fix Undo and editor field names first. Then protect the newest cached itinerary across tabs and respect cancellation during photo preparation. Existing tests passing does not cover these newly reproduced cases.

- Reviewed source: `a178b19`, branch `codex/modularize-travel-app`.
- Scope: functionality, desktop/mobile UI, accessibility, data integrity, test coverage, and deployment-test boundaries.
- Deliverable: review and proposed work only. App sources, generated output, dependencies, SQL, and live data were not changed; no commit, push, or deployment was performed.
- Existing untracked `docs/REVIEW_2026-11-14_PROGRESS.md` was preserved. Its scheduled implementation/release plan is separate from this report-only task.
- Evidence is from the current local source and isolated synthetic fixtures, not historical audit results or production accounts.

## First-principles assessment

The app needs to help two people answer three questions quickly: what happens next, what remains to prepare, and what has been spent. Editing and offline recovery must preserve their work without making them understand storage or synchronization internals.

| User requirement | Current assessment | Follow-up |
|---|---|---|
| Read today's itinerary on a phone | Date-aware entry, sticky dates, timetable and bottom navigation already exist | Reduce initial header dominance only if useful; U4 |
| Prepare together without publishing unrelated edits | PREP uses stable-ID patches against the latest document | Retain the current separation and conflict checks |
| Record expenses accurately | Exact currency arithmetic, fixed historical amounts, validation and CSV coverage are strong | Preserve keyboard position after reorder; U3 |
| Edit without losing work | Immediate draft protection and recovery are extensive | Structural Undo loses pending text; F1 |
| Stop an operation predictably | Network upload/download cancellation is covered | Local thumbnail work can still commit after Cancel; F2 |
| Read the newest available copy offline | Per-tab remote adoption is monotonic | Shared IndexedDB cache can regress across tabs; F3 |
| Use controls with keyboard/assistive technology | Tabs, dialogs, labels and focus indicators have substantial coverage | Inline field names and modal background isolation need work; U1/U2 |
| Maintain the app at a reasonable cost | Modules and focused factories suit the product | Extend current tests at specific gaps; T1/T2 |

## Priority summary

Ten items: **0 P0, 2 P1, 5 P2, 3 P3**. Six are reproduced implementation issues; two are test improvements; two are optional UI/performance candidates. P1 means fix first; P2 means a bounded next pass; P3 requires demonstrated value. No deployment blocker was newly proven in this review.

| ID | Priority | Type | Finding |
|---|---|---|---|
| F1 | P1 | Reproduced bug | Delete then Undo loses text entered within the history debounce |
| U2 | P1 | Reproduced accessibility issue | Inline itinerary editors have empty computed accessible names |
| F3 | P2 | Reproduced bug | A delayed tab can overwrite a newer shared public cache |
| F2 | P2 | Reproduced bug | Cancel during thumbnail encoding still attaches the photo |
| U1 | P2 | Reproduced robustness gap | Main-app modal background remains focusable; external focus is not contained |
| U3 | P2 | Reproduced UX bug | Keyboard expense reorder drops focus to the document body |
| T1 | P2 | Coverage improvement | Add behavioral tests at mutation/cancellation/cache boundaries |
| T2 | P3 | Test reporting | Record whether the existing visual comparison ran |
| U4 | P3 | Optional UI candidate | Mobile initial header delays access to task controls |
| PERF1 | P3 | Optional performance candidate | Measure the cost of the 2.06 MB font before optimizing |

### UI health score

This is a review score, not WCAG certification, a Lighthouse result, or physical-device validation.

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 2/4 | Empty editor names; modal isolation and reorder-focus gaps; existing keyboard controls remain useful |
| Performance | 3/4 | Lazy thumbnails, local font with swap/fallback, bounded network operations; cold-device performance unmeasured |
| Theming | 3/4 | Central palette, light/dark coverage and selected contrast assertions; not every rendered state audited for contrast |
| Responsive design | 3/4 | Mobile/desktop layout checks and navigation are established; initial mobile density can improve |
| Implementation integrity | 3/4 | Product-specific views and consistent controls; localized state-boundary defects |
| **Total** | **14/20** | **Good foundation; address weak dimensions** |

## Reproduced findings

### F1 — Pending text disappears when deletion is undone [P1]

**Location:** [schedule-editor.js](../../src/app/schedule-editor.js), line 169; [editing.js](../../src/app/editing.js), lines 156–171; [document-session.js](../../src/app/document-session.js), line 74. Category: functionality/data integrity.

**Reproduction:** Enter itinerary editing, change the first event title, delete that event before the 400 ms history debounce finishes, then choose Undo. The probe uses consecutive input/delete/Undo events to fix this timing deterministically.

**Observed:** Expected `Last input immediately before deletion`; restored `일정 1-1`, the original title. On November 18, a separate Chromium run used keyboard typing and clicks on the visible buttons. The title went from `일정 1-1` to `일정 1-1X`. After Delete and Undo it read `일정 1-1`. This is a local editing loss, not evidence of server corruption.

**Cause:** Text input persists a draft immediately but queues its history snapshot. The delete handler removes the row before recording history. Undo consequently restores the snapshot from before the text edit. The time-dialog path already flushes history before mutation; structural handlers are inconsistent.

**Recommendation:** Finish the pending history checkpoint before deleting/reordering rows or removing content; record the result afterward. Audit the analogous photo/warning actions without introducing a second history system.

**Acceptance/test:** With virtual time held below 400 ms, type → delete → Undo restores the exact last text; Redo removes the row; recovery after reload matches the chosen history state. Include at least one unaffected row and a caution deletion. Add focused coverage to the existing editing-history/input suites. Suggested UI follow-up: `$impeccable harden`.

### U2 — Inline editors lack accessible field names [P1]

**Location:** [config.js](../../src/app/config.js), line 32; [editing.js](../../src/app/editing.js), line 155; [schedule-editor.js](../../src/app/schedule-editor.js), line 138. Category: accessibility.

**Reproduction:** Enter itinerary editing and inspect the actual Chromium accessibility nodes for the day subtitle, event title, and event note.

**Observed:** All three populated fields had an empty computed name. Chromium exposed each field’s current text as its value. The missing information is the field’s purpose, such as “event note”. Roles remain `paragraph`, `heading`, and `generic`, with `editable: richtext`. Visual `data-placeholder` text does not supply a field name. This was checked through Chromium's accessibility API, not inferred only from missing attributes.

**Impact:** The field purpose is difficult to identify with assistive technology, particularly when content is empty or several similarly structured events are present. It relates to [WCAG 4.1.2 name/role requirements](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html); actual screen-reader speech remains untested.

**Recommendation:** Supply short contextual names in editing mode, such as event title, event note, caution, and day summary. Use appropriate textbox semantics and multiline state where needed; preserve heading/read-mode semantics when editing ends. Do not add lengthy visible instructions.

**Acceptance/test:** Assert nonempty computed names and appropriate edit/read roles on existing, newly added, empty, restored, and imported fields. Smoke-check keyboard editing with a real screen reader. Suggested follow-up: `$impeccable harden`.

### F3 — Public cache can move backward across tabs [P2]

**Location:** [draft-storage.js](../../src/app/draft-storage.js), lines 158–174; [document-session.js](../../src/app/document-session.js), line 31; [document-workflow.js](../../src/app/document-workflow.js), line 17. Category: offline/data integrity.

**Reproduction:** Open two isolated fixture pages in one browser context. Tab B adopts revision 20 and finishes caching it. Tab A, whose own baseline is older, then adopts a delayed revision 10. Read the shared public cache again from B.

**Observed:** The durable cache changes **20 → 10**. Each tab's adoption check is individually valid; `writePublicCache()` unconditionally puts its record into the shared key.

**Impact:** A later offline startup can display an older itinerary even though a newer one was already cached. The server revision and the already-rendered newer tab are not overwritten by this probe. The production transport timing was simulated through the actual document controller; no server requests were made.

**November 18 display check.** With two tabs open on the normal app shell, deliver revision 20 with title `Updated stop` to B, then revision 10 with title `Previous stop` to A. Wait for each cache write. Open a third tab sharing that storage with the SDK unavailable. Its status indicated offline cache, its cached revision was 10, and the first event visibly read `Previous stop`. This exercised the cache fallback with synthetic arrivals and a locally served shell. An installed PWA in airplane mode is a separate device check.

**Recommendation:** Compare stored and incoming revisions inside one IndexedDB read/write transaction, and keep the newer cache. Define equal-revision/legacy-zero behavior explicitly; avoid a separate read followed by an unconditional write. Retain the existing tab-specific draft protocol.

**Acceptance/test:** Two tabs, reversed arrivals and concurrent writes retain the highest revision; a fresh tab using cache fallback must show the newer event title as well as its revision. Use distinct titles to catch mismatches between stored metadata and content. Include cache-write failure and legacy migration. Same-tab refresh tests alone are insufficient.

### F2 — Photo cancellation is not checked after thumbnail work [P2]

**Location:** [photos.js](../../src/app/photos.js), lines 34–45. Category: functionality/operation lifecycle.

**Reproduction:** Use the actual photo controller with controlled encoding promises. Complete full-image encoding, pause thumbnail encoding, request cancellation, then resolve the thumbnail.

**Observed:** One photo is appended and one mutation is recorded after cancellation. Status says `사진 작업 취소 · 1개 초안 유지`. The existing check occurs after full encoding, before the remaining awaited work.

**Impact:** Cancel can still add a photo that was not attached when the user canceled. This is unexpected local draft mutation; it is not an unsolicited server upload.

**Recommendation:** Check the operation's cancellation state again after thumbnail/data-URL awaits and immediately before appending. Keep photos already committed before cancellation. Avoid leaving an empty gallery when no photo was attached.

**Acceptance/test:** Pause independently at full encode, thumbnail encode, and both data-URL reads. Cancel at each boundary: no later attachment, prior photos retained, busy state released, and retry usable. Use controlled promises instead of arbitrary sleeps. Suggested follow-up: `$impeccable harden`.

### U1 — Main dialogs do not make their background inactive [P2]

**Location:** [dialogs.js](../../src/app/dialogs.js), lines 26–40; contrast with [exports.js](../../src/app/exports.js), `appendReadonlyRuntime()`. Category: accessibility/interaction robustness.

**Reproduction:** Open the export modal, allow its initial animation-frame focus handling to finish, then programmatically focus the background ledger-navigation button and press Tab.

**Observed:** Background focus succeeds; Tab moves to the background Edit button. No ancestor is inert. The accessibility snapshot includes the background. Ordinary Tab wrapping from inside the modal still works and is already tested.

**Impact/limit:** If browser or assistive-technology interaction moves focus outside the dialog, the handler does not recover containment. This probe does not claim that a normal pointer click passes through the overlay or that every screen reader ignores `aria-modal`. The [WAI-ARIA modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) calls for an inactive background and contained focus.

**Recommendation:** Manage background `inert` state per dialog stack, restoring previous state on close; account for nested dialogs and sign-out. The standalone read-only photo viewer already demonstrates background isolation. Add a small focus guard if needed; keep the current dialog owner.

**Acceptance/test:** External focus cannot remain outside the top modal; nested close restores its parent; final close restores the trigger and prior background state. Validate normal app and exported copies. Suggested follow-up: `$impeccable harden`.

### U3 — Expense reorder loses keyboard focus [P2]

**Location:** [ledger.js](../../src/app/ledger.js), `renderLedger()` at line 57 and `moveExpense()` at line 103. Category: keyboard UX.

**Reproduction:** Add Expense A and B. Focus A's Move down button and press Enter.

**Observed:** Order becomes B, A, but `document.activeElement` becomes `BODY`. `renderLedger()` replaces the initiating control.

**Impact:** Repeated keyboard reordering requires finding the row again, particularly in a longer ledger. The change itself succeeds.

**Recommendation:** Restore focus using the stable expense ID and action after rendering. At an endpoint where that direction becomes disabled, choose an enabled control in the same row. Apply similar fallback after deletion where useful.

**Acceptance/test:** Reorder a middle row repeatedly with Enter/Space, then test first/last boundaries and deletion. Assert the active element, row identity and next keyboard action, not only array order. Suggested follow-up: `$impeccable harden`.

## Test improvements

### T1 — Exercise behavioral boundaries that current assertions miss [P2]

**Location:** [editing-history.test.mjs](../../tests/editing-history.test.mjs), [photos.test.mjs](../../tests/photos.test.mjs), [project.test.mjs](../../tests/project.test.mjs), [check-drafts-browser.mjs](../../scripts/check-drafts-browser.mjs), [check-inputs-browser.mjs](../../scripts/check-inputs-browser.mjs).

Existing coverage is extensive. The gap is specific: tests verify pending-text Undo, network-photo cancellation, same-tab revision ordering, and basic modal wrapping, but not the combinations reproduced above. For example, the photo-staging test at `project.test.mjs:106` checks source strings; it cannot establish behavior after an awaited thumbnail returns.

Add these cases to existing suites instead of creating another broad runner:

| Layer | New regression assertion | Related finding |
|---|---|---|
| Controller/browser | Pending text survives structural Undo/Redo and reload | F1 |
| Controller | Deferred encoding/data-URL result is ignored after cancellation | F2 |
| Browser + real IndexedDB | Two tabs cannot downgrade a public-cache revision | F3 |
| Browser accessibility | Computed editor names and edit/read semantics are present | U2 |
| Browser keyboard | Top-dialog isolation and stable-ID focus after reorder | U1/U3 |

Keep regex checks for packaging/security declarations where appropriate. Do not treat their presence as substitutes for these behavior checks. Do not increase deadlines, add blanket retries, or rewrite the test framework to accommodate the new cases.

### T2 — Record which visual check ran [P3]

**Location:** [check-palette-browser.mjs](../../scripts/check-palette-browser.mjs), lines 13 and 53–69; [validate.yml](../../.github/workflows/validate.yml).

The palette suite always captures screenshots and checks overflow/tokens, but exact pixel/computed-style comparison runs only when `PALETTE_BASELINE_HTML` is supplied. Normal required CI does not supply it. Captures alone therefore do not fail on an unintended visual change. Existing geometry, theme and contrast checks still provide real coverage.

The existing procedure covers both cases. For a refactor that should look identical, it compares styles and pixels across 24 scenarios. For an intentional design change, it asks the reviewer to inspect before/after images. [Palette maintenance](../OPERATIONS.md#palette-maintenance)

**Acceptance.** When appearance matters to a change, record the comparison performed and its result. The palette runner already writes `baselineCompared` to its results. Use that value for automated comparisons, or name the screens inspected for a visual review.

## Optional UI and performance candidates

### U4 — Compact the initial mobile header if it improves task access [P3]

**Location:** [modern.css](../../src/styles/modern.css), header rules; [src/index.html](../../src/index.html), header composition.

At 390 × 900, the synthetic page's header is **473 px** tall. The first PREP checkbox starts at **682 px** and the ledger date input at **823 px** when scrolled to the top. These measurements use the offline fixture; production's additional toolbar controls were not included. Menu switches already scroll to content, so this is mainly an initial-opening/top-of-page issue.

Consider a compact phone header or collapsed secondary metadata after initial orientation, retaining the date, both clocks and an obvious way to expand. Preserve the approved palette and desktop planning layout. This is a product choice, not a responsive overflow bug. Acceptance: meaningfully earlier task access at 390/320 px, with clear clocks, stable navigation, 200% zoom and no new obstruction. Suggested follow-up: `$impeccable distill`, then `$impeccable adapt`.

### PERF1 — Measure cold-load font cost before changing typography [P3]

**Location:** [foundation.css](../../src/styles/foundation.css), line 97; [src/index.html](../../src/index.html), font preload; `assets/PretendardVariable-1.3.9.woff2`.

The font is **2,057,688 bytes**, compared with **425,915 bytes** for generated `index.html`. It is preloaded, cached by the service worker and embedded into exports; `font-display: swap` and a tested fallback already protect usability. File size alone does not prove a performance failure.

First measure cold-cache render and interaction on a representative phone/slow connection. If the font dominates, investigate a compatible Korean/Latin font subset or unicode-range distribution while preserving complete Hangul coverage and self-contained exports. Do not switch fonts or add a build dependency just to reduce a byte count. Suggested follow-up: `$impeccable optimize` only after measurement.

## November 14 evidence and verification

Environment: Windows, Node **24.22.1**, installed Playwright **1.62.1**, Chromium **151.0.7922.34**. `npm` was unavailable on this shell's PATH, so the equivalent package-script commands were executed directly with Node. Dependencies were not reinstalled. This is local development evidence, not the required Ubuntu 24.04/PostgreSQL 17 release certification.

| Check | Result | Evidence |
|---|---|---|
| Generated-output freshness | Passed; no rebuild/write needed | [build-check.txt](2026-11-14-project-review/build-check.txt) |
| Unit tests in sandbox | 193/195 passed; two actual-loopback HTTP failures | [initial log](2026-11-14-project-review/unit-static.txt) |
| Same unit tests with local-network-capable execution | **195/195 passed**, no skips | [verification log](2026-11-14-project-review/unit-static-unsandboxed.txt) |
| Static project/document checks | Passed | End of the same verification log |
| Full current Chromium runner | **16/16 suites passed** | [browser log](2026-11-14-project-review/browser-chromium.txt), [timings](2026-11-14-project-review/browser-timings.json) |
| Firefox/WebKit input groups | **6/6 groups passed**; functional coverage, no PNG comparison | [engine log](2026-11-14-project-review/browser-engines.txt) |
| Additional targeted probes | Six implementation issues reproduced; no uncaught page errors in the main probe context | [results](2026-11-14-project-review/review-probes.json), [reproduction script](2026-11-14-project-review/review-probes.mjs) |
| Mechanical UI detector | Five warnings reviewed; none establishes a new defect | [detector output](2026-11-14-project-review/ui-detector.json) |
| SQL integration, strict full CI, live auth/storage/Realtime, Pages deployment | Not executed in this report-only review | Existing procedure: [Operations](../OPERATIONS.md#validation) |

The two initial HTTP failures disappeared under the same tests outside restricted execution; they are recorded as environment-sensitive failures, not product regressions. Existing SQL files/tests were inspected for revision checks, restricted grants, immutable media and version retention, but that inspection is not a PostgreSQL test result.

The original probe writes into its own dated evidence directory. Use a disposable copy of the checkout when rerunning the command to preserve the November 14 captures.

```sh
node docs/archive/2026-11-14-project-review/review-probes.mjs
```

The dated script records observed behavior; it is not a replacement for permanent regression assertions. It serves synthetic configuration, blocks external requests, runs actual app/controller code, and never connects to production. F2 controls encoding completion; F3 simulates reversed published arrivals through the actual document controller and shares a real IndexedDB database between two tabs.

Fresh visual evidence inspected: [desktop itinerary](2026-11-14-project-review/light-1440-d1.png), [mobile PREP](2026-11-14-project-review/light-390-prep.png), [mobile dark ledger](2026-11-14-project-review/dark-390-money.png), and [Undo result](2026-11-14-project-review/undo-after-delete.png). Blank-looking photo tiles are intentional 1 × 1 synthetic image fixtures, not production-image defects. Full-page captures place fixed navigation at the capture viewport boundary; that appearance alone does not demonstrate permanently hidden content.

Detector triage: the missing image `src` is the initially hidden photo viewer, filled when opened; four accent-border warnings concern the incumbent timeline/category design. Preserve these intentional visual choices. No redesign follows from those warnings.

Limits: no physical phone keyboards, VoiceOver/NVDA speech, real touch-scroll gestures, fresh Linux installation, cold-network performance measurement, live trip writes, or production deployment verification. Existing tests synthesize mobile taps and emulate viewport/zoom; those are distinct from device evidence.

## Proposed implementation order

These are future stages, not work performed by this review.

| Stage | Work | Acceptance |
|---|---|---|
| 1 — Highest priority | F1 and U2, each with its T1 regression | Undo restores the last input. Editors expose their purpose and return to reading semantics when editing ends. |
| 2 — Cache and cancellation | F3, F2 plus focused regressions | Highest cache revision retained; canceled asynchronous work cannot mutate the draft |
| 3 — Keyboard interaction | U1 and U3 with their T1 regressions | Focus stays in the active modal and follows the reordered expense. |
| 4 — When reviewing a visual change | T2 | The review states which comparison ran and what it found. |
| 5 — Optional refinement | Evaluate U4/PERF1 only if useful | Measured task-access/load improvement without losing identity or export support |

For source changes, rebuild generated outputs, update the owning guides, and run the relevant unit/browser checks. Before any later release, use the existing strict Linux/SQL/CI and protected Pages process; this review does not replace it. End UI work with `$impeccable polish` and re-audit the affected states.

Documentation in this task: this dated report, linked evidence, and the README navigation entry. USER_GUIDE, PROJECT_GUIDE and OPERATIONS behavior remains unchanged because no implementation changed. `docs/` is already excluded by `_config.yml`; no Pages exclusion changes are needed.
