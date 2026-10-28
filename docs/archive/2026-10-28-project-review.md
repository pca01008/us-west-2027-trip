# Project review — 2026-10-28

Status: complete, including the resumed verification supplement at 2026-10-28 16:11 KST. [Progress and handoff](../REVIEW_2026-10-28_PROGRESS.md).

## Conclusion

Keep the existing architecture and visual direction. Current unit/static checks and all 16 Chromium suites pass, but additional probes reproduced **five application defects: one P1 and four P2**. Prioritize editor-entry cancellation/session races, then map validation and accessibility. No P0, server authorization bypass, or public-data loss was established.

| ID | Priority | Finding |
|---|---|---|
| F1 | P1 | Late edit-start response re-enables editing after sign-out |
| F2 | P2 | Canceled login request still enters editing |
| F3 | P2 | Malformed HTTPS map URL is accepted |
| U1 | P2 | Read-only exported photo viewer lets keyboard focus escape |
| U2 | P2 | Selected category icon has no programmatic selected state |

P1: fix before relying on the affected workflow. P2: bounded issue with a workaround; fix in the next focused pass. Coverage actions and optional improvements below are separate from this defect count.

## Scope

Independent review of current functionality, UI, and tests for a two-person travel app. Recommendations should preserve the existing architecture unless a concrete defect requires a change. This report does not change application behavior.

## Evidence

- HEAD: `216b713`, branch `codex/modularize-travel-app`; Windows, Node `v24.22.1`, locked Playwright `1.62.1`.
- Installed dependencies were reused. `npm` was absent from PATH, so equivalent Node entry points were run directly.
- Pre-existing changes: `README.md`, `docs/OPERATIONS.md`, untracked `docs/CODEX_CLOUD_GUIDE.ko.md`. Retained; only a review navigation link was added to README.
- Browser fixtures used synthetic trips and blocked production requests. Auth reproductions used the actual pinned Supabase SDK against loopback HTTP endpoints.
- Previous reviews are context, not current verification. App sources, generated files, dependencies, schema 6/KRW/USD, and production data were not changed.

| Check | Current result | Evidence |
|---|---|---|
| Generated output | Current; no rebuild needed | [Build check](2026-10-28-project-review/build-check.txt) |
| Unit tests | 185/185 passed, 23.96s | [Final unit run](2026-10-28-project-review/unit-tests-unsandboxed.txt) |
| Project checks | Passed | [Project check](2026-10-28-project-review/project-check.txt) |
| Chromium inputs/navigation/ledger/PREP/PWA | 5/5 suites passed | [First group](2026-10-28-project-review/browser-selected.txt) |
| Chromium diagnostics/drafts/storage/imports/versions/currency/ledger compatibility/auth/photos/theme/palette | 11/11 suites passed | [Remaining group](2026-10-28-project-review/browser-remaining.txt) |
| Additional auth/UI probes | Five defects reproduced again; final IDs and stronger assertions | [Resumed auth log](2026-10-28-project-review/auth-resumed.txt), [UI results](2026-10-28-project-review/ui-reproduction.json) |
| Mechanical design scan | Five contextual warnings, discussed below | [Detector](2026-10-28-project-review/detector.json) |

The browser invocations are individually labeled PARTIAL; their union covers all 16 Chromium suites exactly once. This is **not** full `test:ci` certification: SQL, clean Linux and Firefox/WebKit were not rerun. Drafts took 140.9s/300s; inputs 48.9s/180s. Existing browser suites required no retries or wider deadlines.

The initial sandboxed unit run passed 183/185; two loopback HTTP tests failed. The isolated unsandboxed health suite passed 54/54, then the complete suite passed 185/185. Retain the [initial failure](2026-10-28-project-review/unit-tests.txt) as environment evidence, not an app defect.

## Resumed verification supplement

The usage-limit interruption is resolved. Both updated probes exited 0 on unchanged app sources at HEAD `216b713`, using Node `v24.22.1` and Chromium `151.0.7922.34`. These audit probes deliberately assert defective behavior: a successful probe means the issue was reproduced, **not fixed**. Production requests remained blocked. The previously passing full suites were not rerun because no app source changed.

| Finding/control | Added confirmation |
|---|---|
| F1 | After peer sign-out and delayed GET release: authenticated=false, editable=true, public save requests=0 |
| F2 | Both Cancel button and Esc resume editing after delayed login success; public save requests=0 in each case |
| F3 | `https://`, `https://[bad]`, and `https://example.test:99999` all fail standard URL parsing but are accepted and stored by the app |
| U1 | Tab leaves the exported photo modal; Esc still closes it and restores focus to the original photo |
| U2 | The selected icon still lacks both pressed and checked state attributes |
| Negative controls | Logout HTTP 503 still removes the SDK session; PREP/ledger/itinerary label references resolve |

The auth probe recorded no fixture/page errors or unexpected HTTP requests; the UI probe recorded no server/page errors. Both probes now explicitly assert the reported bad states instead of only printing observations, and record timestamps/browser versions. Temporary generated scripts and exported HTML were removed after completion.

Current evidence: [auth](2026-10-28-project-review/auth-resumed.txt), [UI execution](2026-10-28-project-review/ui-resumed.txt), [UI structured results](2026-10-28-project-review/ui-reproduction.json). Earlier evidence is retained separately: [prior auth](2026-10-28-project-review/auth-reproduction-final.txt), [prior UI](2026-10-28-project-review/ui-reproduction-before-resume.json). Final IDs F1/F2/F3/U1/U2 now agree directly with the current evidence; no mapping is needed.

## Review coverage

| Area | Sources/checks reviewed | Assessment |
|---|---|---|
| Startup/cache/schema | Config, runtime, startup, document/workflow; build/import/currency/PWA checks | Preserve schema guards and transactional render rollback |
| Save/drafts/conflicts | Editing, draft storage/workflow, document session/repository; unit/draft/storage/PREP suites | Broad fault coverage; no new loss reproduced; editor-entry lifecycle has gaps |
| Authentication | Session/editing; existing real-SDK suite and delayed-response probes | F1/F2 |
| Imports/versions/comparison | Controllers, comparison and photo resources; invalid files, cancellation, sign-out, delayed reads | Existing request identity pattern can guide F1/F2 |
| Itinerary/timetable/navigation | Schedule editor, time core, clocks, navigation; input/navigation/palette suites | Core cases pass; mobile first-screen density can improve |
| Ledger/currencies/PREP | Exact decimal domain, category/expense editing, checklist isolation; domain/browser tests | Preserve exact sums and independent PREP saves; U2 |
| Photos/maps/exports | Services/resources/controllers; upload/cancel/timeout/export checks and custom probes | F3/U1; physical photo picker remains untested |
| PWA/deployment | Worker/registration, workflow/artifact source, PWA/deployment negative checks | Local checks pass; live deployment settings not rechecked |
| Test design | Pure factories, source assertions, real-SDK fixtures, coordinator/artifact failure handling | Strong baseline; missing action lifecycle and exported accessibility transitions |

## Findings

### F2 — P2: Cancel does not invalidate an in-flight password submission

- **Confirmed in Chromium with the real pinned Supabase SDK and a loopback HTTP fixture.** Submit the password, delay the token response, cancel with either the button or Esc, then release success. The dialog stays closed but the page becomes `authenticated editing`. Both variants produced zero public save requests.
- Location: `src/app/editing.js`, `bindAuthentication` (`authCancel` and `authForm.onsubmit`).
- Cause: Cancel clears pending actions but the running submit handler still calls `getEditorSession()` and `runPurpose(authPurpose)`. The purpose is mutable global state.
- Fix: introduce a small authentication-attempt generation, capture the purpose, invalidate it on Cancel/new request/sign-out, and ignore stale continuations after each await. Define whether successful authentication may remain while canceling the requested editor action; at minimum do not resume the canceled action.
- Regression: delay password success, cancel with both button and Esc, optionally open a different purpose, and release the first response. No canceled purpose may execute.

### F1 — P1: A late edit-start read re-enables editing after sign-out

- **Confirmed in Chromium with the real pinned SDK.** Sign in, leave clean editing, start editing again while delaying the document GET, sign out from a second SDK-only tab, then release the GET. The original tab has `authenticated=false` while the itinerary title has `contenteditable=true`.
- Location: `src/app/editing.js`, `beginEditing`, `runPurpose`, and `handleExternalSignOut`.
- Cause: `beginEditing` applies the fetched document and unconditionally enables editing after an await without checking whether the initiating session/action remains current.
- Impact: sign-out no longer reliably returns the UI to view mode; users can create new local edits in a signed-out view. The resumed probe asserted zero public save requests. This does **not** establish a server authorization bypass or unauthorized public save.
- Fix: invalidate pending editor-entry operations on sign-out and verify their session/generation before applying fetched state or enabling editing. Reuse the small request-identity pattern already used by imports/versions; avoid a framework rewrite.
- Regression: real SDK peer sign-out during delayed edit-start GET; verify viewing state, noneditable fields, preserved draft, and no public writes after response release.

### F3 — P2: Malformed HTTPS map addresses are accepted

- **Confirmed in Chromium.** With a nonempty place name, all three invalid URLs (`https://`, `https://[bad]`, `https://example.test:99999`) close the map dialog and are stored verbatim in href. Each fails `new URL` in the probe. See the `Malformed map URL` scenarios.
- Location: `src/app/photos.js:52`, `saveMap`; related sanitization in `src/app/document.js`.
- Cause/impact: the prefix regex checks scheme text, not URL validity. The button does not submit a validating form. Travelers can save a broken navigation link.
- Fix: parse with `new URL`, require HTTPS and a nonempty hostname, and retain the field error/focus on failure. Preserve valid query strings and short links; do not add unnecessary provider restrictions. Use equivalent validation during import where appropriate.
- Regression: reject bare `https://`, malformed hosts and invalid ports; accept valid HTTPS query/fragment URLs. Invalid submission must leave state/history unchanged.

### U1 — P2: Exported photo dialogs lose keyboard confinement

- **Confirmed in a newly exported read-only file.** Open a photo with Enter, then Tab from Close. Focus moves to a background image while the modal remains visible (`inViewer=false`). The runtime also does not set `modal-open`. Esc closes the viewer and restores the original photo's focus; those controls work and should be preserved.
- Location: `src/app/exports.js:73`, `appendReadonlyRuntime`; `photoViewer` in `src/html/dialogs.html`.
- Impact: keyboard users reach obscured controls while the dialog claims `aria-modal=true`. Export removes the live dialog manager; its replacement only handles opening, closing and Esc.
- Fix: add a small standalone modal implementation to the export runtime: Tab/Shift+Tab confinement, background isolation/scroll control, and focus restoration. Preserve offline usability.
- Regression: test the downloaded file with the network blocked, including Enter/Space, Tab/Shift+Tab, Esc/Close, background isolation and restored focus.

### U2 — P2: Category icon selection is visual only

- **Confirmed in rendered DOM.** The selected package icon has `.active` but no `aria-pressed` or radio/checked state. This is a semantics finding; a physical screen reader was not used.
- Location: `src/app/ledger.js:105`, `renderIconPicker` and its selection handler.
- Impact: assistive technology cannot obtain which icon is selected from the control state.
- Fix: retain native buttons with meaningful short names and consistent `aria-pressed`, or implement a complete radio group. Prefer the smaller native-button change; ensure exactly one selected state.
- Regression: keyboard selection updates the chosen and previous states; closing/reopening preserves the selected icon and accessible name.

## Test improvements

These support the findings and are not additional app defect counts.

| Priority | Action | Acceptance |
|---|---|---|
| P1 | Extend `check-auth-browser.mjs` with F1/F2 using delayed local HTTP and the actual SDK | Canceled or expired editor-entry work cannot resume; existing draft recovery remains intact |
| P2 | Extend input/export tests for F3/U1/U2 | Reject malformed HTTPS; confine exported focus; expose selected icon state |
| P2 | Keep source assertions for build/security contracts; use factory/browser assertions for behavior | Implementation renames should not require changing behavioral expectations; no blanket test rewrite |
| P2 | Add a representative photo-heavy editing measurement before optimizing | Record input/persistence/undo costs; establish a baseline before adopting timing thresholds |
| Existing prerequisite | Complete [validation backlog](../VALIDATION_TODO.md) | Actual phones, clean Linux/SQL, required engine coverage and existing release gate |

Existing coverage already protects first-keystroke drafts, uncertain saves, storage failures, malformed imports, version invalidation, exact money, SDK cross-tab sign-out, PREP isolation and deployment failures. Preserve it. The new findings identify missing transitions, not a reason to replace the suite.

## Optional product and maintenance improvements

### I1 — P3: Reduce mobile first-screen overhead

The [320px itinerary](2026-10-28-project-review/light-320-itinerary.png) places the first event near the viewport bottom after the hero, clocks, progress, dates and toolbar. The [390px timetable](2026-10-28-project-review/dark-390-timetable.png) similarly devotes much of the first screen to framing. Fixture clocks are deliberately simulated; these captures were produced in this audit.

Consider a compact mobile header or remembered collapse control during travel. Preserve clocks/theme/navigation access. Compare 320/390px with larger text and the keyboard open. This is a usability opportunity, not a confirmed layout failure or approval for redesign.

### I2 — P2 option: Protect expense input before Add

The [user guide](../USER_GUIDE.md#ledger) explicitly excludes unadded inputs from draft protection. `document.js` preserves them across remote renders, but `document-workflow.js:77` does not include them in its unload guard. Reload/closure can lose entered details by design.

Consider a tab-local entry buffer or concise leave warning for nonempty input. Keep it separate from published expenses and never silently add a row. This changes the documented product policy; it is not a newly introduced regression.

### I3 — Conditional: Profile photo-heavy editing

`captureState` clones main DOM; `fingerprint` normalizes/serializes it; `queueHistory` immediately flushes drafts; undo retains up to 100 full snapshots. Staged photos use data URLs. Work therefore grows with photo bytes as well as event count.

No user-visible slowdown was measured. Profile representative photos on the actual phones first. If needed, remove redundant captures or bound history by bytes while preserving immediate draft protection. Avoid speculative storage redesign.

### D1 — P2 documentation correction: Legacy Pages wording

[README](../../README.md#setup-and-deployment) says Pages serves the `main` branch root, while [Operations](../OPERATIONS.md#deployment) and `.github/workflows/validate.yml` describe Actions publication gated by required checks and same-SHA artifact validation. A maintainer could choose the wrong Pages source from the overview.

Replace that sentence with a short statement about validated main commits publishing through Actions and link Operations for details. This audit only adds its navigation link; it preserves the user's ongoing documentation work.

## UI assessment

**Implementation integrity: pass for the retained product direction.** Itinerary timelines, clocks, checklist grouping, dual-currency ledger and responsive navigation form a coherent UI. Preserve the approved palette/cards; no wholesale redesign is justified.

| Dimension | Provisional score / 4 | Basis |
|---|---|---|
| Accessibility | 2 | Existing keyboard/error tests pass; U1/U2 need correction |
| Performance | 3 | Compressed/lazy photos and bundled font; photo-heavy cost unmeasured |
| Theming | 3 | Current light/dark/print checks pass; not full contrast certification |
| Responsive behavior | 3 | 320/390/768/1440 checks; physical keyboard/touch remains unverified |
| Implementation integrity | 3 | Coherent UI with isolated lifecycle/semantics defects |
| **Total** | **14/20** | **Good baseline; scoped heuristic, not WCAG certification** |

The detector warnings were contextualized: one missing image source belongs to the hidden viewer populated on open; four side-border warnings identify intentional itinerary/timetable cues. They are not additional bugs. The [dark desktop ledger](2026-10-28-project-review/dark-1440-ledger.png) and [mobile PREP](2026-10-28-project-review/light-390-prep.png) are consistent in inspected renders. The [viewer capture](2026-10-28-project-review/readonly-viewer.png) uses a synthetic 1px image; its almost-empty center is a fixture property.

## Recommended order

1. Fix F1/F2 together with real-SDK race regressions; use the existing request-identity pattern.
2. Fix F3/U1/U2 with focused input/export/semantics tests. Optional UI workflow: `$impeccable harden`, then `$impeccable audit`, then `$impeccable polish`.
3. Correct D1; consider I1/I2 only if the travelers want those behavior changes. Measure I3 before choosing an optimization.
4. After source edits, rebuild generated files, run relevant suites and the required release gate, and complete the physical-device checklist.

## Rejected hypotheses

Logout HTTP 503 does not retain the SDK session in this pinned dependency. The real-SDK probe confirmed session removal and a password prompt on the next edit. Do not report a logout persistence vulnerability.

PREP/ledger panel-label references are also valid: their target IDs exist. Do not report missing labels from an incomplete source search.

## Verification limits

- No production mutations, real credentials, uploads, deployment, installs, Git metadata changes or remote CI dispatch.
- No local PostgreSQL fixture was configured; SQL execution was not attempted. SQL/workflow source and existing negative unit checks were inspected.
- Firefox/WebKit, physical touch/IME/keyboard/VoiceOver/TalkBack, clean Linux installation and current live Pages settings were not reverified.
- Audit scripts are preserved as [auth reproduction](2026-10-28-project-review/reproduce-auth.mjs) and [UI reproduction](2026-10-28-project-review/reproduce-ui.mjs). They use existing synthetic fixtures; they intentionally demonstrate current bad behavior and are not future fix-acceptance tests.
- Probe harness mistakes were corrected before successful runs: relative path, nonexistent cleanup method, export while still editing, and blocking its own local export. Retained failed probe logs are harness evidence, not app failures.
- The first final-ID rerun was blocked by a usage-limit approval-review error, not a safety rejection. The resumed supplement completed both probes with final IDs and stronger assertions. Older logs retain historical numbering; use the resumed evidence for current finding references.
- Only this report/checkpoint/evidence and the README navigation link were added. User/project/operations behavior docs need no implementation updates because no app behavior changed. `_config.yml` already excludes `docs/` from Pages.
- Documentation checks cover project/repository tests, local report/checkpoint links, both audit-script syntax checks, and `git diff --check`. Resumed results are preserved in the evidence directory. Evidence logs use `.txt` because `*.log` is Git-ignored; ignore rules were not changed.
