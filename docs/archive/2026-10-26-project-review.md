# Project Review — 2026-10-26

Baseline: `2e7e846` on `codex/modularize-travel-app`. Fresh local review of current sources, rendered UI, and tests. This is an audit and proposed work, not a fix record or production certification.

## Conclusion

Keep the current product and architecture. The app already supports the two travelers' core needs, and its existing regression suite is substantial. The highest-value work is to protect edits at operation boundaries, validate imported document structure, and finish input/error usability. A new framework, redesign, or generalized collaboration system is not justified by this review.

**Seven defects reproduced, one UI improvement measured, and three test improvements identified.** Existing checks all pass: **131 unit tests and all 16 browser suites**. Passing tests currently miss the conditions below.

| ID | Priority | Type | Finding |
|---|---|---|---|
| F1 | P1 | Defect | Undo before the history debounce loses the newest edit from redo |
| F2 | P1 | Defect | Structurally incomplete imports are accepted and can destroy the current rendered document |
| F3 | P2 | Defect | Out-of-order refresh responses roll the displayed document/revision backward |
| F4 | P2 | Defect | Canceling an in-flight import produces a technical error after cancellation |
| F5 | P2 | Defect | Photo resource changes with unchanged photo identity/caption are absent from comparison |
| U1 | P2 | Defect | Photo metadata validation remains invisible inside the active dialog |
| U2 | P2 | Defect | Invalid exchange-rate input is silently reset when closing settings |
| U3 | P2 | Measured improvement | Mobile ledger input text and labels are only 10px |
| T1 | P2 | Test improvement | Add operation-boundary and malformed-structure behavior tests |
| T2 | P2 | Test improvement | Assert computed typography/contrast and meaningful visual states |
| T3 | P2 | Test improvement | Finish validation parity and a small relevant browser/device matrix |

P1: fix before the next release; edit retention or document integrity is affected. P2: focused follow-up. No P0 reproduced. Totals across all findings: P0 **0**, P1 **2**, P2 **9**, P3 **0**. Improvements are not counted as reproduced defects.

## Scope and evidence

Reviewed `src/`, PWA sources, SQL permissions/save structure, test fixtures/runners, CI, and current guides. Generated HTML was used to execute the app; its consistency with editable sources was checked. The paused Daylight candidate was not separately audited or changed.

| Area | Assessment |
|---|---|
| Itinerary, time editing, navigation | Existing input/navigation tests pass; F1 exposes a history boundary gap |
| PREP | Completion, list editing, uncertain-save reconciliation and draft isolation pass current tests |
| Ledger/currencies | Exact dual-currency calculations, migration, CRUD and exports pass; settings feedback and input typography need work |
| Drafts, login and saving | Broad retention/failure coverage; current SDK auth tests pass against mocks; F1/F3 remain |
| Imports, comparisons and versions | Recent version-request/date-movement fixes are covered; F2/F4/F5 remain in adjacent paths |
| Photos and exports | Staging/compression/upload/export checks pass; photo validation and comparison are incomplete |
| Theme and responsive UI | Light/dark navigation and layout work at sampled widths; small form text remains |
| PWA | Current root/project-path installation, cached reload and reconnect checks pass locally |
| Server permissions | Source review finds editor mapping, revision locking, limited grants and version retention; SQL execution was not available locally |
| Test/deployment process | Broad checks, but local/CI parity and deployment gating remain planned work |

### Executed checks

| Check | Result |
|---|---|
| `node scripts/build-app.mjs --check` | Passed; generated output is current |
| `node --test tests/*.test.mjs` | **131 passed, 0 failed, 0 skipped**; about 21.4 seconds |
| `node scripts/check-project.mjs` | Passed; 11 days, 36 default events, 12 PREP items |
| `PWA_BROWSER_CHANNEL=chrome node scripts/check-browsers.mjs` | **All 16 suites passed** |
| Targeted probes | F1–F5 and U1–U2 reproduced; U3 measured |
| Supplemental UI matrix | 320/390/768/1440px × light/dark × itinerary/PREP/ledger: **24 states, no document-width overflow** |
| Impeccable source detector | Five warnings; reviewed, none accepted as a separate defect |
| PostgreSQL execution | Not run: no disposable `TRIP_SQL_TEST_URL` configured |
| Production, physical devices, Firefox/WebKit | Not exercised |

Environment: Windows, bundled Node `v24.22.1`, Playwright with installed Chrome `155.0.8059.85`. `npm` was unavailable in this shell, so the equivalent build/unit/static commands were invoked directly. This Windows/installed-Chrome pass is not Linux/pinned-Chromium parity.

Initial restricted runs failed two HTTP unit cases and several browser suites because local connectivity/downloads were restricted; browser diagnostics included `ERR_NETWORK_ACCESS_DENIED`. The complete reruns with permitted local test execution passed. These failures are environment evidence, not app defects.

The 16 suites are diagnostics, drafts, storage, inputs, imports, versions, ledger, currency, ledger compatibility, PREP, auth, photos, theme, palette, navigation and PWA. Tests use synthetic trips and block production requests. No real user data, credentials or server writes were used.

Supplemental probes used the current generated app with synthetic offline configuration. F1/U1/U2 used actual browser input/clicks. F3 instantiated the unchanged document controller with deferred repository promises. F4/F2 instantiated the unchanged import controller with mock reads and captured error choices; F5 compared real DOM-derived summaries. These are controlled local reproductions, not observed production incidents. The 24 extra layout states used viewport sizing, not physical phones or synthesized touch gestures. The standard runners provide additional emulated interaction coverage.

Evidence: [raw probe results](2026-10-26-project-review/results.json), [detector output](2026-10-26-project-review/detector.json), [mobile itinerary](2026-10-26-project-review/390-light-d1.png), [mobile ledger](2026-10-26-project-review/390-dark-money.png), [desktop ledger](2026-10-26-project-review/1440-dark-money.png). Fixture photos are deliberately synthetic placeholders. Screenshots show the scrolled navigation/content state, not the full header.

## Functionality findings

### F1 — P1: Undo drops input that has not reached history

**Location:** [editing.js](../../src/app/editing.js), `queueHistory`/`moveHistory`, lines 126–129; [document-session.js](../../src/app/document-session.js), lines 47–56.

**Reproduce:** Edit a title to `RECORDED EDIT`; wait until Undo is enabled. Change it to `FAST SECOND EDIT`, then click Undo within 400ms. Click Redo.

**Observed:** Undo returned to the original `일정 1-1`; Redo restored only `RECORDED EDIT`. The second edit was absent. The captured run used ordinary fill/click actions inside the debounce window; see `undoElapsedMs` in the evidence.

**Cause/impact:** `moveHistory()` navigates recorded history without first reconciling the current DOM with the pending history snapshot. Immediate draft persistence now protects departure, but does not protect undo/redo. Undo can also make the document clean and trigger draft cleanup while the newest text is no longer recoverable through Redo. No production edit was lost in this review.

**Fix:** At undo/redo boundaries, cancel the pending timer and record any unrecorded current change before moving the history cursor. Preserve redo semantics and avoid adding identical snapshots.

**Acceptance:** First edit and second edit at 0–399ms; typing followed by Undo then Redo; continuous typing; timer firing after Undo; undo-to-clean followed by reload. Assert exact text and recoverable state, not only dirty flags or handler presence.

### F2 — P1: Import validation does not establish a usable document

**Location:** [imports.js](../../src/app/imports.js), lines 7–26; [document.js](../../src/app/document.js), `normalizeState`/`applyState`, lines 67 and 131; [document-workflow.js](../../src/app/document-workflow.js), line 78.

**Reproduce:** Supply an otherwise valid offline file for this trip/schema with `html: "<p>Incomplete document</p>"`. Open the comparison and apply it.

**Observed:** Apply was enabled. The main document became the single paragraph, with **zero day panels**, before rendering failed with `Cannot set properties of null (setting 'textContent')`. [Screenshot](2026-10-26-project-review/malformed-import.png).

**Cause/impact:** Nonempty HTML and sanitized tags are accepted without validating the panels/controls the renderer requires. `applyImportSnapshot()` changes the baseline before `applyState()` finishes; `applyState()` replaces live DOM before rendering succeeds, and its applying flag lacks `finally` cleanup. A damaged/hand-edited file can leave the app unusable despite an error message. Server state was not changed; durable draft loss was not established.

**Fix:** Validate or safely repair required structure in a detached document before changing baseline/DOM. Reject genuinely incomplete documents with an actionable message. Keep valid legacy imports supported. Restore prior state on unexpected application failure and always clear the applying flag.

**Acceptance:** Missing ledger, missing PREP, duplicate/missing day panels, wrong day classes, absent required inner controls, and a forced render failure. Existing DOM, ledger, history, baseline and stored draft must remain usable on rejection. Keep the existing valid v4 migration case passing.

### F3 — P2: Older refresh responses replace newer state

**Location:** [document-workflow.js](../../src/app/document-workflow.js), `refreshPublishedState`, lines 16–29, and Realtime callback in `hydrate`.

**Reproduce:** Start two refresh reads. Resolve the second with revision 12, then the first with revision 11.

**Observed:** The screen first showed `NEW 12` / revision 12, then `OLD 11` / revision 11. Both responses used the current unmodified controller.

**Cause/impact:** The application checks revision inequality, not whether the response is obsolete. A late refresh can regress itinerary/PREP/expense display and the cache/baseline used for later editing. Server revision conflict checks still protect against an unchecked server overwrite.

**Fix:** Reject older remote revisions at the document-adoption boundary and invalidate superseded reads. Apply the same ordering rule to refresh, Realtime and pending remote state, while retaining deliberate historical preview behavior.

**Acceptance:** Reversed refresh completions; refresh finishing after newer Realtime; duplicate same-revision notifications; reconnect while dirty; historical preview. Assert displayed document, baseline revision and cached revision never regress through ordinary refresh.

### F4 — P2: Cancel does not invalidate an import operation

**Location:** [imports.js](../../src/app/imports.js), `applyImportedDraft` and `importCancel`, lines 26–35.

**Reproduce:** Open a valid import comparison, click Apply, delay its latest-document read, then click Cancel before resolving the read.

**Observed:** The dialog closed, then the operation reached the failure path with `Cannot read properties of null (reading 'baselineRevision')` and status `편집본 적용 실패`. The current title remained unchanged in this case.

**Cause/impact:** Cancel clears shared `pendingImport` while the awaiting function continues to dereference it. Successful cancellation appears as an application failure and exposes technical text. New file selection, double Apply and sign-out require related coverage; their outcomes were not reproduced here.

**Fix:** Capture the selected import in the operation, use an interaction generation/cancellation guard after awaits, and prevent duplicate Apply. Reuse the small lifecycle pattern already implemented for versions; no new framework is necessary.

**Acceptance:** Cancel/Escape during read/materialization, selection replacement, sign-out, reversed file reads and duplicate Apply. Canceled work must neither apply nor show an error dialog later.

### F5 — P2: Comparison ignores a changed photo resource

**Location:** [document.js](../../src/app/document.js), `stateSummary`, line 157; [comparison.js](../../src/app/comparison.js), photo comparison; [imports.js](../../src/app/imports.js), line 3.

**Reproduce:** Keep a photo's ID, caption and alt text unchanged, but replace its image resource in an incoming document. Compare the snapshots.

**Observed:** Markup changed, but `buildDiff()` returned `[]`. Photo summaries include ID/caption/alt only. Since import Apply is disabled for zero differences, an import containing only this change cannot be applied through the normal comparison UI.

**Scope/impact:** Relevant to edited/imported or historical documents that retain photo identity. Ordinary delete-and-add creates a new identity and is not this case. An important image replacement can be omitted from a user's review.

**Fix:** Include stable resource identity/content information in photo comparison. Normalize equivalent storage URLs, paths and embedded export representations to avoid reporting every ordinary export/import as a replacement.

**Acceptance:** Same ID/new image, unchanged bytes/different embedding, caption-only edits, reorder, deletion/addition, and no-change offline round trips. Show a short image-change entry without embedding large data URLs in the diff.

## UI findings

### U1 — P2: Photo validation is outside the active dialog

**Location:** [photos.js](../../src/app/photos.js), `savePhotoMetadata`, line 50; [dialogs.html](../../src/html/dialogs.html), `photoEditDialog`.

At 390px, clear Photo description and select Apply. The dialog remains open without an error, focus stays on Apply, and the field has no `aria-invalid`. The only message is the toolbar status behind the backdrop. [Observed dialog](2026-10-26-project-review/photo-validation.png).

Reuse the existing `setFieldError` pattern used by category/map/expense fields: concise visible error, error association, invalid state and focus on the first invalid input. Cover blank/whitespace caption and alt text, correction and repeated submit in both themes. Suggested UI follow-up: `$impeccable harden`.

### U2 — P2: Rate validation disappears when settings close

**Location:** [ledger.js](../../src/app/ledger.js), `updateExchangeRate`, line 109, and `ledgerSettingsClose`, line 124.

Enter `bad` as the rate and click Close settings. The input's change handler restores `1450` and writes a global error; the close handler then accepts the restored value, closes the dialog and replaces the status with the ordinary offline status. The attempted value and correction guidance disappear. This was a real fill/click sequence.

Keep invalid input visible, show an inline error and stop Apply/Close from implying acceptance. Make cancel/revert behavior explicit and consistent. Test empty, zero, negative, nonnumeric and excessive-precision values followed by pointer close, Enter and Escape. Assert the rate did not change and the user can see why. Suggested follow-up: `$impeccable harden` / `$impeccable clarify`.

### U3 — P2 improvement: Ledger input typography is too small

**Location:** [modern.css](../../src/styles/modern.css), `.add-expense label` and input/select rules, lines 305–313; inherited form styling in [features.css](../../src/styles/features.css).

At 390px, computed font sizes for date, description, KRW, USD and labels were **10px**. The current controls have adequate 44px hit areas, but enlarging the hit area did not improve text readability. [Mobile ledger](2026-10-26-project-review/390-dark-money.png).

Use roughly 16px editable values and a readable label scale, then check large amounts and long Korean text at 320/390px. Preserve the existing layout/colors and compact secondary information. This is a measured readability recommendation, not a claim of a specific WCAG failure or observed physical-device zoom behavior. Suggested follow-up: `$impeccable typeset` / `$impeccable adapt`.

### UI assessment and limits

**Implementation integrity: pass for product coherence.** Navy/coral roles, separate travel/PREP/ledger navigation, itinerary timelines, currency labels and photo controls form a consistent travel tool. Existing responsive navigation and modal focus improvements should be preserved.

| Dimension | Score / 4 | Evidence |
|---|---|---|
| Accessibility | 2 | Keyboard/focus coverage exists; U1/U2 error feedback and U3 readability remain |
| Performance | 3 | Image compression/lazy loading, caching and bundled font exist; no CPU/throttled-network profile was run |
| Theming | 3 | Both themes passed current checks; computed contrast coverage remains incomplete |
| Responsive design | 3 | No page overflow in 24 added states; 10px form text and real-device gaps remain |
| Implementation integrity | 3 | Product-specific, consistent UI; some form patterns are incomplete |
| **Total** | **14/20** | **Good foundation; address the weak dimensions** |

This is a scoped review score, not an accessibility certification or a release decision. Functional P1 issues take precedence over the visual score. No screen-reader, physical-keyboard, text-scaling or measured performance audit was completed.

Detector disposition: the missing `src` belongs to the initially hidden photo viewer, populated before opening. Four accent-border warnings concern established itinerary/timetable conventions. None justifies removing the existing design. Checkbox inputs flagged as smaller than 44px in raw geometry have larger clickable labels and are not counted as separate findings.

## Test and process improvements

### T1 — P2: Test state transitions, not just completed operations

Current [project tests](../../tests/project.test.mjs) include useful source-presence contracts, and browser coverage has improved substantially. However, completed edit/undo and invalid-file cases do not cover the pending-history and structurally nonempty-but-unusable cases above.

| Add to existing coverage | Essential assertion |
|---|---|
| Input/draft suite | Latest input survives Undo/Redo before debounce; correct draft cleanup |
| Import suite | Invalid structure leaves current DOM, baseline and stored draft intact |
| Import suite | Cancel/replacement/sign-out invalidate pending reads and Apply |
| Document workflow tests | Older refresh/Realtime results cannot reduce accepted revision |
| Comparison/import suite | Image-resource-only changes produce a meaningful diff |
| Photo/ledger UI suite | Errors stay visible in the active dialog; invalid rate survives for correction |

Prefer deterministic deferred promises/timer boundaries plus one real browser path for each critical workflow. Retain structural checks for build identity/security constraints. Add focused cases to existing runners; do not introduce a second test framework.

### T2 — P2: Connect UI assertions to actual rendering

The contrast test at [project.test.mjs](../../tests/project.test.mjs), lines 197–203, compares fixed `a93f35`/`ffffff` literals rather than current CSS. [Palette checks](../../scripts/check-palette-browser.mjs) only compare screenshots/styles against a prior version when `PALETTE_BASELINE_HTML` is supplied. The default run captures evidence but does not establish pixel equivalence. Ledger geometry checks assert 44px boxes, not readable font sizes; U3 passes them.

Add computed typography and a few meaningful text/background contrast pairs for both themes, including error/disabled/selected states. Keep screenshots for human review of representative itinerary, populated ledger and error dialogs. Use a small stable baseline set only if its maintenance is worthwhile. Do not equate no horizontal overflow with usable forms.

### T3 — P2: Complete the existing validation plan and device checks

[validate.yml](../../.github/workflows/validate.yml) currently uses Node 24 for unit/SQL, Node 22 for browsers, Chromium only, and a disposable PostgreSQL 17 job. This review used Windows/installed Chrome, with no local SQL server. These are different verification scopes.

Follow [VALIDATION_TODO.md](../VALIDATION_TODO.md) for one declared environment, full/subset result labels, required SQL/browser stages and a tested deployment gate. Do not create a competing plan. Repository configuration shows no deployment job depending on successful validation; remote Pages/branch settings were not inspected here.

Add a small WebKit/Firefox smoke for input, dialogs, draft recovery and exported files where those browsers matter to the two travelers. Before travel, check their actual phones: numeric/IME input, keyboard visibility, photo selection, installed offline launch and reconnect. Do not expand every expensive scenario to every browser by default.

## Existing strengths and previous findings

- Deterministic generation keeps `src/` and committed app output aligned; pure currency/timetable/session/repository factories can be tested independently.
- Exact currency arithmetic and schema guards protect the current schema-6 KRW/USD trip. No currency/schema migration is needed for these findings.
- Drafts have per-tab ownership, immediate checkpoints, recovery/deletion guards and storage-failure tests. Preserve these when fixing F1/F2.
- Saves use revision conflicts; photos are staged and uploaded immutably; imported unsafe markup is sanitized. Preserve these controls.
- SQL source separates public reading from editor writes and retains 50 versions. This review does not replace execution of permission/concurrency SQL tests.
- Prior October 25 findings have dedicated fixes and regression coverage: immediate first-edit protection, PREP uncertain saves, version request lifecycle, cross-day comparisons, modal return focus, selected inline validation and ledger touch targets. Their current relevant suites passed. Do not reopen those historical findings verbatim: F1 concerns Undo before debounce, and U1 concerns the remaining photo dialog.

Performance follow-up should be evidence-led: generated HTML is 407,511 bytes and the bundled font is 2,057,688 bytes before transport compression. Profile cold load and typing with a realistic staged-photo draft on the travelers' devices before changing bundling, fonts or state storage. These sizes alone are not a performance defect.

## Recommended sequence

1. Fix **F1/F2** with regression cases first. Recheck draft recovery, undo-to-clean and legacy imports.
2. Fix **F3/F4/F5** within the existing controllers and comparison projection. Preserve revision conflict and ordinary export/import behavior.
3. Address **U1/U2/U3** through `$impeccable harden`, `$impeccable clarify`, `$impeccable typeset` and `$impeccable adapt`; finish the UI pass with `$impeccable polish`.
4. Add **T1/T2** alongside each fix; complete **T3** through the existing validation plan. Record local, CI, SQL and physical-device results separately.
5. Update the owning user/project/operations guide only when implemented behavior changes. Re-run the audit after fixes; retain this dated record as historical evidence.

This task changed the review/evidence and README navigation only. Application sources/output, trip data, SQL, dependencies and runtime behavior were not changed. Pre-existing README/Operations/Cloud-guide work was preserved. No commit, push or deployment was performed. The new evidence remains under `docs/`, already excluded from Pages; no exclusion change was needed.
