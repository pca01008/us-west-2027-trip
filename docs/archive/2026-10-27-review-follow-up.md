# Review follow-up — 2026-10-27

Scope: U2 → U3 → T1 → T2 → T3 from the [October 26 review](2026-10-26-project-review.md). Starting commit: `ef4349f`; existing README/Operations/Cloud-guide/review changes were preserved. Current trip remains schema 6, KRW/USD.

## U2 — Rate validation

Settings rate input is buffered until Apply/Enter. Invalid text stays visible with an associated inline error and focus; Cancel/Escape discards only pending rate input. Nested category rendering preserves it. Positive rates allow up to six decimal places. Unchanged rates do not create mutations.

Verified on Windows, Node 24.22.1, installed Chrome, synthetic offline desktop/mobile fixtures: empty/zero/negative/nonnumeric/excess precision × pointer/Enter × both themes; Escape, correction, category rendering and explicit cancel. Ledger suite passed; 176 unit tests and static/generated checks passed. First restricted browser attempt failed at loopback navigation (`ERR_NETWORK_ACCESS_DENIED`); permitted rerun passed. npm is absent from the bundled Windows runtime; build/unit/static entry points were invoked with Node directly.

Visual review: mobile dark rate-error capture in `C:/Users/이승종/AppData/Local/Temp/westbound-ledger-SyeQ8W/`; input, correction message and both actions fit. No physical-device claim.

## U3 — Ledger typography

Entry values now compute to 16px; labels to 13px. Settings/expense-edit values use 16px. Existing Pretendard, palette, layout and touch areas are retained. Ledger suite passed at 320/390/1440px in light/dark with long Korean descriptions and large amounts: computed sizes, 44px geometry, containment, navigation clearance and data retention. Build/static/diff checks passed. Visual review of the 320px ledger confirms readable values and contained controls (`westbound-ledger-Wuo4Pj`). Detector warnings refer to the existing timeline stripe and initially hidden viewer image; neither is a new ledger defect.

## T1 — Operation boundaries

43 focused factory tests passed for pending Undo/Redo, malformed import structure and rollback, refresh ordering, canceled/replaced imports and photo-resource comparison. Real browser import and input suites passed on desktop/mobile. Added photo-caption/alt inline-error regressions for empty/whitespace/repeated submit/correction/reopen in both themes. Rate boundaries are covered in the ledger suite. The existing full draft suite is included in final verification.

Remote inspection found `main` had advanced to `061584d` (U1/U2) while this older work branch remained at F5. Reconcile that implementation before final validation; do not replace its established rate semantics with the initial local approach above. The chronological U2 notes describe that preliminary commit, not the eventual merged behavior.

Final integration retains the existing `061584d` rate behavior: Apply and close/Enter/Escape validate; Revert restores the current rate without closing. Decimal validation rejects precision that cannot round-trip through Number, rather than imposing a six-place limit. Existing U1 photo errors and its broader tests are retained. Earlier local duplicate implementations are superseded by this reconciliation. U3 computed-size assertions remain.

## T2 — Rendered assertions

Ledger checks now measure effective foreground/background colors in the rendered cascade (including ancestor opacity): normal input/label/action, selected navigation and rate errors require 4.5:1 in both themes; disabled move controls record their computed ratio and verify native disabled state/opacity, without claiming a contrast requirement for exempt inactive controls. Results are saved as `computed-contrast.json` beside representative populated/error screenshots. Computed font floors remain enforced at 320/390/1440px. Removed the fixed-literal coral assertion; existing token-derived theme unit coverage remains.

Windows/Chrome ledger suite passed; screenshots and computed colors: `westbound-ledger-fAXDls`. This is scoped rendering evidence, not a complete accessibility audit or pixel-baseline equivalence claim.

## T3 — Shared validation and publication gate

Implemented Ubuntu 24.04 / Node 24.22.1 / npm 11.19.1 baseline, strict full/partial coordinator, pinned browser and disposable PostgreSQL checks, process deadlines/cancellation, timing summaries and a labeled/owned Docker SQL helper. The app runtime support remains >=22. Official Node archive SHA-256 was checked before using a portable Windows npm; no system runtime installation was performed.

Validate now uses the coordinator's three subsets with locked installs, a fail-closed `required` aggregate, same-SHA Jekyll artifact byte/exclusion checks, main-push-only deployment and superseded-SHA protection. Work-branch builds are nonpublishing artifact checks. The legacy Pages source was inspected before activation (`main`, `/`, build_type `legacy`); branch protection was initially disabled. Branch/source activation and remote evidence are recorded below when performed.

Windows development checks: npm build, npm test (**185 passed**), static/output checks and all **16 pinned Chromium suites passed**. First full-run inputs: 50.1s/180s; drafts: 152.3s/300s. Firefox input/dialog/draft/export suite passed after replacing unsupported synthetic ClipboardEvent data construction and accepting CSS attr() serialization while asserting the actual Korean hint. WebKit exposed missing pointer-origin focus; explicit focus on section and Edit controls now preserves navigation and dialog return focus. Its complete input/dialog/export suite passed after correction.

Failed attempts retained: initial Firefox fixture mismatches; initial WebKit navigation/return focus; the first additional boundary run hit the existing 300s draft deadline while unit tests, another full browser run and WebKit overlapped. No retry policy, assertion weakening or deadline increase was added. Serial three-pass recheck follows; do not describe the failed attempt as a pass.

Negative checks: strict full command rejects Windows with every stage not-run; Linux helper rejects a shared /mnt checkout; shell syntax passed. Executable tests reject aggregate failure/cancellation/skipping/missing stages, stale generated output without repair, missing/changed published bytes and leaked authoring paths. The workstation's WSL Ubuntu 26.04/Node 22/no npm/PostgreSQL cannot supply clean Ubuntu 24.04 local parity. Physical phones, real IME/keyboards/uploads and production database writes remain untested. Browser fixtures block production.

Visual detector: only the retained timeline accent and hidden viewer image warnings remain. WebKit error-dialog captures were reviewed with the same current palette; no redesign or PWA cache-policy change was made.

Serial stability recheck: first input/draft pass passed at 46.7s/139.5s; second input passed at 46.1s. Remaining serial runs continue while the committed candidate is checked remotely. Publication remains conditional on the full remote aggregate, artifact check and successful stability checks.

Serial Windows boundary checks all passed: inputs **46.7 / 46.1 / 52.6 seconds** (180s deadline), drafts **139.5 / 141.2 / 141.8 seconds** (300s deadline). The earlier concurrent failure is retained above; serial execution provides the supported comparison.

Remote negative gate: [40365852207](https://github.com/pca01008/us-west-2027-trip/actions/runs/40365852207), candidate `abc3003`: deliberate validate failure, SQL/browser skipped, aggregate failed, Pages build/deploy skipped as required. Positive run [40366017315](https://github.com/pca01008/us-west-2027-trip/actions/runs/40366017315) passed SQL, but its first validate job received a runner shutdown signal after ~34s. A preceding real HTTP deadline assertion observed 27.6s against a <27s bound. Retain both observations; no threshold was widened. One targeted validate rerun was requested for this identified runner interruption; browser work continued independently.

CI SQL environment: Ubuntu 24.04.5 x64, Node 24.22.1, npm 11.19.1, Playwright 1.62.1, PostgreSQL **17.11**; **24 SQL tests passed**. All three CI jobs read the same version declaration. A clean managed Windows checkout at `abc3003` is used separately to verify committed files while preserving pre-existing Cloud-guide edits in the original workspace.

Preserved local evidence: [suite timings and failed attempt](2026-10-27-review-follow-up/windows-validation.json), [computed contrast](2026-10-27-review-follow-up/computed-contrast.json), [320px ledger](2026-10-27-review-follow-up/320px-ledger.png), [WebKit photo errors](2026-10-27-review-follow-up/webkit-photo-error.png). These fixture captures contain no live trip data.

CI browser evidence from `abc3003`: all 16 Chromium suites passed, including inputs 71.3s and drafts 209.9s. Additional inputs passed at 71.9/71.3s and drafts at 207.6/207.4s, below unchanged 180/300s limits. Firefox completed. Linux WebKit then failed during a category-error screenshot: its 5s capture budget was consumed waiting for fonts. This is a failed overall browser job, not a full pass. The fixture now establishes real Pretendard readiness before interaction/capture using a bounded 10s resource wait; action/screenshot/suite deadlines remain unchanged. Required future runs keep full Chromium plus engine compatibility; optional work-branch `repeat_boundaries` retains the separate stability check without repeating it on every release. Existing failure/summary artifacts survived and remain on run 40366017315.

The one targeted validate rerun also received a runner shutdown signal (~54s). Its last output was the healthcheck group; no successful unit result is claimed for either attempt. The next candidate explicitly runs unit files serially to bound child-process/memory competition and records available parallelism. This is a resource-control hypothesis to verify, not proof of the shutdown cause. Assertions, HTTP deadline bound, stage deadline and job deadline are unchanged.

The browser job now depends on validate; SQL remains parallel and isolated. This measured departure from the initial all-parallel plan prevents another expensive browser run after a failed prerequisite. The aggregate still requires all three successful jobs. Local Firefox/WebKit input suites passed with explicit font readiness.

Follow-up candidate local verification: serial `npm test` passed all 185 tests plus static/output checks; Firefox and WebKit full input suites both passed with font readiness established. Public app source/output is unchanged by this follow-up; it changes verification resource sequencing and capture preparation.
