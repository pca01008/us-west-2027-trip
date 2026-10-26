# Functionality, UI, and Test Review — 2026-10-25

Review baseline: `d9c6971` on `codex/modularize-travel-app`. This is a dated local audit, not a production certification or a record of fixes. App sources and generated output were unchanged.

## Result and priorities

The existing regression suite passes, but targeted checks reproduced **six bugs** and measured **one UI improvement**. The highest priority is the first-edit draft protection gap. Three additional test improvements address why these cases can escape the current suite.

| ID | Priority | Area | Finding | Evidence |
|---|---|---|---|---|
| F1 | P1 | Drafts | First text edit can be lost before the history debounce finishes | Browser reproduction |
| F2 | P2 | PREP | Committed save with a lost response is displayed as failed/unchecked | Local API reproduction |
| F3 | P2 | Versions | A delayed response opens a comparison after the user closes versions | Local API reproduction |
| F4 | P2 | Comparison | Moving an event across a day boundary can produce no reported changes | Browser state reproduction |
| U1 | P2 | Keyboard | Closing expense editing loses focus instead of returning to its trigger | Browser reproduction |
| U2 | P2 | Validation | Empty category errors appear outside the active dialog and viewport | Browser reproduction and screenshot inspection |
| U3 | P2 | Touch | Secondary ledger actions are smaller than the 44px project target | Rendered measurements |
| T1 | P2 | Behavior tests | Important assertions check source presence instead of observable behavior | Test review; F1/U1 escaped |
| T2 | P2 | Visual tests | Default palette checks lack a baseline; contrast test uses fixed literals | Test review |
| T3 | P2 | Browser coverage | CI exercises Chromium only; native mobile interaction remains unverified | Workflow and runner review |

P1: prioritize before the next release because edits can be lost. P2: fix in a focused follow-up. No P0 issue was reproduced. These are scoped observations, not an exhaustive absence-of-bugs claim.

## Scope and validation

Reviewed the current root app: navigation, itinerary/time editing, PREP, ledger/currencies, authentication, drafts, saving/conflicts, versions/imports, photos/exports, theme, PWA, test runners, and CI. Sources under `src/` were the implementation reference; current generated HTML was used to run the app. Daylight remains a paused candidate and was not separately audited.

| Check | This run |
|---|---|
| `node scripts/build-app.mjs --check` | Passed; committed generated files match sources |
| `node --test tests/*.test.mjs` | **123 passed; 0 failed; 0 skipped** |
| `node scripts/check-project.mjs` | Passed; 11 days, 36 default events, 12 checklist items |
| `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs` | **All 15 suites passed** |
| Additional targeted checks | F1–F4 and U1–U2 reproduced; U3 measured |
| UI inspection | Synthetic 390px/1440px light/dark itinerary, PREP, ledger; category validation dialog |
| Mechanical UI detector | Six warnings, reviewed in context; none accepted as a separate defect |
| Executed SQL tests | **Not run:** no disposable PostgreSQL URL configured |
| Production APIs/data/deployment | Not exercised or changed |

Environment: Windows, Node `v24.22.1`, installed Chrome `155.0.8059.85` through Playwright. `npm` was absent from this shell; the three commands above execute the same build/unit/static steps as `npm test`. Initial sandbox attempts failed on local HTTP connectivity and the default Playwright browser path. The successful runs used permitted local networking and installed Chrome. Those initial failures are environment limitations, not app findings.

Browser checks used synthetic trips, `example.test` identities, local mock APIs, and blocked external requests. F2 shortened the existing 12-second save timeout to 120ms in the served fixture and delayed its response 400ms; production sources were not edited. F3 delayed a version response 500ms. F1's logout check directly invoked the existing external-sign-out handler; its refresh check used an actual reload. These probes did not exercise real JWT/Storage/Realtime services.

The 15 suites cover diagnostics, drafts, storage, inputs, imports, ledger, currencies, ledger compatibility, PREP, actual-SDK authentication against mocks, photos, theme, palette, navigation, and PWA. Navigation also checks widths from 320px to 1920px. Successful emulation does not establish physical-device keyboard, pinch-zoom, VoiceOver/TalkBack, or Safari behavior. See [validation procedures](../OPERATIONS.md#validation).

## Functionality findings

### F1 — P1: First-edit protection waits for history recording

Follow-up: see the [F1 fix and verification record](2026-10-25-first-edit-draft-fix.md). The reproduction below describes the original review baseline.

**Location:** [state-ui.js](../../src/app/state-ui.js), lines 28–32; [startup.js](../../src/app/startup.js), lines 133 and 160–163; [drafts.js](../../src/app/drafts.js), `flushDraftPersistence`; [auth-dialogs.js](../../src/app/auth-dialogs.js), lines 24–35.

**Reproduction:** Open a clean itinerary, enter editing, change an event title, then reload before the 400ms history timer fires. Separately, invoke external sign-out immediately after that first input.

**Observed:** Immediately after input, `isDirty()` was true but `pendingDraft` remained false and `historyIndex` was 0. The unload handler did not prevent navigation; `flushDraftPersistence()` returned false. Reload restored the old title. External sign-out also restored the old title and left no recoverable draft (`null`).

**Cause and impact:** The contenteditable input handler only queues history. Dirty-state detection and draft scheduling happen later inside `recordHistory()`. Unload, visibility, and sign-out paths rely on the stale `pendingDraft` flag. A first edit after any clean baseline can therefore be silently lost. Continuous input can keep resetting the timer; the risk is not limited to a single character.

**Recommended change:** Mark potentially dirty content immediately, while retaining debounce for expensive history snapshots. Lifecycle and sign-out boundaries must reconcile pending input with current state before deciding there is nothing to retain. Do not depend on an asynchronous IndexedDB write started only during unload as the sole safeguard.

**Acceptance tests:** First title/detail/caution edit followed by reload, page hide, or external sign-out within 0–399ms; continuous typing followed by departure; normal input after a completed save. Verify navigation protection and recoverable content, not only the existence of an event listener. Preserve undo-to-clean behavior.

### F2 — P2: PREP does not reconcile uncertain save results

Follow-up: see the [F2 fix and verification record](2026-10-26-prep-save-reconciliation.md). The reproduction below describes the original review baseline.

**Location:** [checklist-schedule.js](../../src/app/checklist-schedule.js), lines 63–105 and 119–133. Compare the existing reconciliation in [saving.js](../../src/app/saving.js), `persistState()`.

**Reproduction:** Check a PREP item. Let the mock server commit, but delay its response past the save timeout without delivering a Realtime notification.

**Observed:** The server stored `true`; the UI reverted to `false` and displayed `저장 실패` with Retry. Reload then showed the item completed.

**Impact:** Travelers receive contradictory completion feedback even though the public change succeeded. A retry may create an unnecessary additional version. The same patch-saving path serves list editing, although this run reproduced the checkbox case only.

**Recommended change:** After a timeout or ambiguous transport failure, fetch the latest document and check whether the intended checklist operation is reflected. If verification is unavailable, show an uncertain outcome rather than a definitive rollback/failure. Preserve unrelated drafts and existing revision-conflict checks; avoid automatic blind retries.

**Acceptance tests:** Timeout before commit, committed response loss, newer remote changes after commit, and unavailable verification. Include checkbox and list editing, with an unrelated local draft present. Assert both server state and UI feedback.

### F3 — P2: Version requests outlive the dialog interaction

Follow-up: see the [F3 fix and verification record](2026-10-26-version-request-lifecycle.md). The reproduction below describes the original review baseline.

**Location:** [versions.js](../../src/app/versions.js), lines 65–90; [startup.js](../../src/app/startup.js), line 93.

**Reproduction:** Delay version-content loading, select Compare, then close the version list before the response arrives.

**Observed:** The list remained closed, but the comparison dialog opened after the delayed response. `compareVersion()` does not verify whether its originating interaction is still current. Version reads also lack the explicit bounded request handling used for public-document reads.

**Impact:** An operation the user left reappears unexpectedly. Out-of-order version selection and sign-out are related cases requiring coverage, not outcomes claimed as reproduced here.

**Recommended change:** Use a small request generation counter or AbortController scoped to the version interaction. Closing, sign-out, or a newer selection invalidates previous work. Check validity after awaits and bound stalled reads. Apply the same rule to comparison and preview.

**Acceptance tests:** Close during loading, A/B selections with reversed response order, sign-out during loading, and stalled reads. No stale dialog or preview should become active; errors should be visible in the relevant UI.

### F4 — P2: Date movement can disappear from comparison

Follow-up: see the [F4 fix and verification record](2026-10-26-comparison-date-moves.md). The reproduction below describes the original review baseline.

**Location:** [versions.js](../../src/app/versions.js), lines 1–18 (`stateSummary`, `buildDiff`).

**Reproduction:** In a synthetic saved-state copy, move the last event of day one to the beginning of day two while preserving its ID, content, and overall event order. Compare the two states. This models an imported or historical document; the current editor does not provide an across-day move control.

**Observed:** HTML changed and event `default-1-4` moved from `day1` to `day2`, but `buildDiff()` returned `[]`. The summary records `dayIndex`, but the comparison ignores it and compares only flattened event order.

**Impact:** Import/version/conflict review can omit a meaningful itinerary-date change, weakening the user's review before applying or publishing content.

**Recommended change:** Compare each matched event's day/date as well as its existing fields and order. Show a concise old-date → new-date entry. No schema change is needed.

**Acceptance tests:** Across-day moves with unchanged flattened order, moves with reordered events, and ordinary within-day reordering. A date move must always produce a meaningful difference.

## UI findings

### U1 — P2: Modal focus origin is captured too late

Follow-up: see the [U1 fix and verification record](2026-10-26-dialog-focus.md). The reproduction below describes the original review baseline.

**Location:** [auth-dialogs.js](../../src/app/auth-dialogs.js), lines 5–12; [ledger-editor.js](../../src/app/ledger-editor.js), lines 16–19 and 37; [schedule-editor.js](../../src/app/schedule-editor.js), lines 3–17.

**Reproduction and evidence:** Add a synthetic expense, select Modify, then press Escape. The dialog's stored focus origin was `expenseEditName`, an input inside the dialog. After closing, `document.activeElement` was `BODY`, not the originating Modify button.

**Cause:** A MutationObserver records the origin after opening code has already focused an input. Other dialogs with the same synchronous-focus pattern need verification.

**Recommended change:** Capture the trigger before showing/focusing a dialog and restore it on close. Use a stable replacement target when rendering removes the original button; handle nested dialogs explicitly.

**Acceptance tests:** Keyboard open/Tab/Shift+Tab/Escape/Cancel/Apply for expense, category, time, and photo dialogs. Check the actual active element after close, including nested dialogs and rerendered triggers. Suggested UI follow-up: `$impeccable harden`.

### U2 — P2: Category validation is hidden outside its dialog

Follow-up: see the [U2 fix and verification record](2026-10-26-dialog-validation.md). The reproduction below describes the original review baseline.

**Location:** [ledger-editor.js](../../src/app/ledger-editor.js), line 38; [src/index.html](../../src/index.html), `categoryDialog` and global `status`.

**Reproduction:** At 390px, open Ledger settings → Add category, leave the name empty, and select Apply.

**Observed:** The dialog contains no error. Focus remains on `categorySave`; the input has neither `aria-invalid` nor an error association. The message exists only in the toolbar status, outside the modal. Its measured rectangle started at x≈495px, beyond the 390px viewport, and the backdrop obscured the underlying UI.

**Impact:** The action appears to do nothing and users cannot easily identify the required correction. The global live region does not replace visible field-level feedback, especially while a modal is active.

**Recommended change:** Show a short error beside the field, associate it with `aria-describedby`, mark invalid, and focus the name input. Reuse the existing schedule-time error pattern. Review map and expense-name validation for the same global-status-only pattern without treating them as already reproduced.

**Acceptance tests:** Blank/whitespace name, correction, repeated submission, mobile viewport, and nested-dialog focus. Assert that the error is visible inside the active dialog. Suggested follow-up: `$impeccable harden` / `$impeccable clarify`.

### U3 — P2: Enlarge secondary touch controls

Follow-up: see the [U3 fix and verification record](2026-10-26-ledger-touch-targets.md). The measurements below describe the original review baseline.

**Location:** [ledger.css](../../src/styles/ledger.css), lines 7, 9, and 12; [refinement.css](../../src/styles/refinement.css), primary control sizing.

**Measured at 390px:** Ledger inputs were 42px high; Modify was approximately 55×38px; Delete was 38×38px. Main navigation and Add expense already meet the 44px target. Hidden day radios and checkbox inputs with larger clickable labels were excluded from this finding.

**Impact:** Small adjacent row actions are harder to use while traveling. This is an ergonomic improvement against the project's 44px design target, **not a claim that every sub-44px control violates WCAG AA**.

**Recommended change:** Bring secondary actions and input hit areas to at least 44px and retain spacing, without enlarging every decorative element or redesigning the page.

**Acceptance tests:** Enabled row controls at 320/390px, long expense names, high amounts, both themes, and the final row above bottom navigation. Follow with a physical-phone check. Suggested follow-up: `$impeccable adapt`.

## Test improvements

### T1 — P2: Assert the critical behavior behind source checks

[project.test.mjs](../../tests/project.test.mjs), especially lines 51–106 and 182–203, checks source fragments for several important contracts. These checks are useful for structural guarantees, but finding `beforeunload` or `focusableIn(dialog)` cannot establish draft safety or focus restoration. Existing browser suites cover many related paths; they did not cover F1's pre-debounce boundary or U1's modal return focus.

Add the focused acceptance cases above to the existing draft/input/PREP/import/navigation runners. Use controlled timers for debounce boundaries and actual pointer/keyboard activation for modal behavior. Retain structural tests for generated output and security invariants. Avoid adding a new general test framework for two users.

### T2 — P2: Connect visual assertions to the rendered implementation

[check-palette-browser.mjs](../../scripts/check-palette-browser.mjs) compares computed styles and PNG bytes only when `PALETTE_BASELINE_HTML` is supplied. Default CI captures screenshots and checks overflow/token aliases, so its success does not prove visual equivalence. The contrast test in [project.test.mjs](../../tests/project.test.mjs), lines 197–203, calculates contrast between hard-coded `a93f35` and `ffffff`; changing the actual CSS token would not affect that assertion.

Use computed theme values for a few meaningful text/background pairs and assert the visible states used by errors/actions. For intentional visual changes, use the existing optional baseline mechanism and review both themes; only add a small, stable screenshot baseline set if its maintenance cost is justified. Do not mistake palette screenshots for an automated accessibility audit.

### T3 — P2: Add a small browser/device validation matrix

[validate.yml](../../.github/workflows/validate.yml) installs Chromium only. [check-navigation-browser.mjs](../../scripts/check-navigation-browser.mjs) supports Firefox/WebKit, while most other runners instantiate Chromium directly. No Firefox/WebKit run was performed in this audit.

Start with the existing navigation suite on WebKit and a small critical smoke covering input, draft recovery, dialogs, and offline export. Use physical iPhone/Safari and Android checks for keyboard visibility, numeric input, photo selection, and installed-app behavior before a relevant release. Preserve device findings as dated evidence; do not promise full browser compatibility from viewport emulation. Keep SQL execution on the existing disposable PostgreSQL CI job.

## UI audit assessment

**Implementation integrity: pass for product coherence.** The existing navy/coral identity, semantic currency presentation, date navigation, and task-specific controls are consistent. Preserve that direction. This is not a redesign recommendation.

| Dimension | Indicative score / 4 | Evidence or limitation |
|---|---|---|
| Accessibility | 2 | Dialog semantics and keyboard navigation exist; U1/U2 remain |
| Performance | 3 | Lazy images, image compression, and version-content loading are present; no field profiling |
| Theming | 3 | Shared palette and light/dark/print tests pass; comprehensive computed contrast not measured |
| Responsive design | 3 | Existing geometry tests pass; U3 and physical-device validation remain |
| Implementation integrity | 3 | Coherent product UI and current generated files; interaction lifecycle gaps |
| **Total** | **14/20** | **Good foundation; address the verified weak areas** |

Scores are limited review judgments, not WCAG certification or measured performance benchmarks. Technical UI review used the `impeccable` audit workflow and `ui-ux-pro-max` keyboard-focus guidance.

Detector triage: one missing image source is the intentionally hidden photo viewer populated on open; one flat-type warning comes from scanning the unassembled source template without included styles; four accent-border warnings concern legacy/overridden or intentional timeline styling. Rendered inspection did not justify reporting them as defects. The synthetic white photo is a fixture, not a broken production image. Fixed navigation appearing mid-page in a full-page capture is not, by itself, an overlap defect.

## Keep and improve in this order

Keep the current strengths: deterministic source generation, explicit save/conflict handling, isolated per-tab drafts, storage-failure recovery, currency/schema guards, lazy version loading, local API fixtures, and diagnostic artifacts. Core tests already cover substantial failure and recovery behavior.

1. Fix **F1** and add its boundary regressions first.
2. Fix **F2/F4** for trustworthy save outcomes and change review.
3. Fix **F3/U1/U2** together around request lifetime, focus, and local error feedback.
4. Apply **U3**, then strengthen **T1–T3** using the existing runners.
5. Run the relevant browser suites, full unit/static checks, and `$impeccable polish` after UI fixes. Re-run the scoped audit to record resolved findings.

No new infrastructure, schema migration, currency relabeling, or Daylight rollout is needed for these recommendations. When implementing, follow the [source map](../PROJECT_GUIDE.md#source-modules), rebuild generated output, and update the behavior/operations documents that actually change.

This task adds the review and its README link only. The user/project/operations guides remain accurate for the current implementation; fixes and new test coverage described here are pending.
