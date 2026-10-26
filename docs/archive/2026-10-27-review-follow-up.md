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

The serial-unit CI at `54f7290` passed the real 21s HTTP deadline probe, then stopped during the artifact checker's deliberate large-file mismatch. Investigation identified an avoidable diagnostic cost in the new checker: `assert.deepEqual(Buffer, Buffer)` generated a huge byte diff for a ~400 KiB HTML mismatch. Windows unit runs had also grown from ~21s to ~60–79s. The checker now uses `Buffer.equals` with a short filename/length error, preserving exact-byte validation and avoiding large assertion serialization. Runner shutdown being caused by resource exhaustion remains an inference until the corrected CI completes; no test or production timeout is relaxed.

After the compact binary mismatch fix, the artifact negative test passed in **0.27s**, and all **185 unit tests passed in 24.1s** (previous serial run 79.0s). Static/generated checks also passed. This measured reduction supports the identified diagnostic bottleneck.

Corrected candidate `da7183e`: [run 40371906646](https://github.com/pca01008/us-west-2027-trip/actions/runs/40371906646) passed the required unit/static and SQL jobs. The prior runner interruptions stopped after replacing the binary deep assertion; earlier failed attempts remain documented. Browser and artifact results follow below when complete.

`da7183e` CI: 185 unit tests and 24 SQL tests passed, all 16 Chromium suites passed again (drafts 208.6s, inputs 71.1s), Firefox completed, but Linux WebKit PNG capture stalled at the same font-ready wait even after explicit startup readiness. Similar upstream evidence exists in [Playwright #42986](https://github.com/microsoft/playwright/issues/42986) for 1.63; this does not establish the exact underlying bug in our pinned 1.62.1.

The added engine matrix is now explicitly functional (`--functional`): input, IME event simulation, keyboard/pointer focus, dialog errors and viewport bounds, draft retention, import/export/download/reload assertions all remain. Incidental PNG writes are omitted only in this mode. Required Chromium checks retain real-font, computed typography/contrast and representative PNG evidence; diagnostics still preserve errors/traces. Linux WebKit visual capture remains an explicit limitation, not a passed visual check. No font-ready bypass environment, hidden retry, dropped behavior assertion or browser upgrade was introduced.

Extra-engine functional checks now run before the full Chromium sequence, so a compatibility failure is visible quickly. Full required coverage is unchanged; only incidental extra-engine PNG collection is outside the functional profile.

Local explicit functional profiles passed for both Firefox and WebKit, including every existing behavioral assertion and export/reload path. The normal Chromium input profile still captures PNG evidence; coordinator/deployment/docs checks passed (26 tests).

The `c60b37c` attempt [40375371099](https://github.com/pca01008/us-west-2027-trip/actions/runs/40375371099) passed unit/SQL but remained in `npx playwright install --with-deps` from 18:11:26 UTC until the targeted cancellation after >20 minutes. Browser tests had not started; this is setup evidence, not an app test failure. Browser CI now uses the official `mcr.microsoft.com/playwright:v1.62.1-noble` container, matching the locked package and Ubuntu 24.04 baseline. It already contains Git, browser binaries and system libraries; setup-node still pins Node/npm. No custom image, dependency upgrade or local OS installation was added. [Official image guidance](https://playwright.dev/docs/docker) owns the upstream image contract. The required browser preflight and all functional/rendered checks remain mandatory.

Official registry HEAD returned 200 for the exact 1.62.1 Noble image; its manifest digest `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e` is pinned in the workflow. Coordinator/deployment/docs checks passed (26 tests).

The pinned image pulled in 27 seconds on [40378846828](https://github.com/pca01008/us-west-2027-trip/actions/runs/40378846828), replacing the stalled installer. Unit/SQL passed; browser preflight correctly refused an unknown Git identity in the root/container-mounted checkout. The browser job now explicitly trusts only its checked-out `$GITHUB_WORKSPACE`; no ownership/ACL modification or wildcard trust is used. Git read errors are retained in setup diagnostics instead of only a generic identity error. All browser stages remain not-run until identity is established.

Resume candidate `60ff077` established a clean source identity on [40415487651](https://github.com/pca01008/us-west-2027-trip/actions/runs/40415487651). Unit 185/SQL 24 passed; the clean Windows checkout also passed all 185 checks (24.3s). Browser preflight rejected unusable Firefox before any suite; aggregate failed and publication stayed skipped. Browser setup errors now retain executable location and original launch diagnostics to distinguish missing binaries from runtime configuration.

Diagnostic run [40415909457](https://github.com/pca01008/us-west-2027-trip/actions/runs/40415909457), `563e9ef`, again passed unit/SQL and retained failed-browser artifacts. Firefox reported that root cannot use `/github/home`, owned by `pwuser`. Browser commands and their exact-path Git trust now use the existing root-owned `/root` home; no user/ownership/ACL changes or sandbox-disable flags were added.

## Stage commits

| Stage | Commit | Result |
|---|---|---|
| U2 | `061584d`, integrated by `da0efe0` | Preserve existing rate validation and regressions; initial duplicate `36411f4` superseded |
| U3 | `7f569c9` | Readable ledger values/labels, responsive regression coverage |
| T1 | `56b6e8f` | Reuse operation-boundary fixes/tests; fill photo-validation gaps |
| T2 | `02f35df` | Computed type/contrast and representative states |
| T3 | `abc3003` through `f6c6a88` | Shared validation, artifact/publication gate, measured CI fixes and editability wait |

Schema 6/KRW/USD and production data are preserved. No production SQL, authenticated save, photo upload or trip-content mutation was performed. Pre-existing Cloud-guide work stays uncommitted in the original workspace.

Candidate `2eb1ad8`, [40416203626](https://github.com/pca01008/us-west-2027-trip/actions/runs/40416203626): unit185/SQL24 and Firefox/WebKit functional suites passed. Every Chromium suite then failed with immediate renderer crashes (including the synthetic diagnostics fixture); this is not a full browser pass. Artifacts survived. The clean Windows candidate passed185 (24.0s). Preflight now renders/captures a trivial page, and a temporary Chromium process-log probe runs before expensive suites to diagnose the container failure.

On `3a0be47`, [40417173625](https://github.com/pca01008/us-west-2027-trip/actions/runs/40417173625), the standalone Chromium render/screenshot probe passed using default `/tmp`. The immediately following preflight with runner-mounted `TMPDIR` crashed on a trivial screenshot. Browser commands now use container-local `/tmp` for profiles and matching summary/diagnostic upload paths. This isolates the observed configuration difference without weakening browser assertions or adding launch flags; the temporary process-log probe is removed because permanent preflight now exercises rendering.

Container-local temp fixed rendering on `6537305`, [40417527169](https://github.com/pca01008/us-west-2027-trip/actions/runs/40417527169): Firefox/WebKit and 15 Chromium suites passed. Drafts exposed a fixture race after clicking Edit: typing began while the title was still `contenteditable=false`. The new boundary scenarios now wait for actual editability, matching the existing `edit()` helper. No sleeps, history flushes, deadline changes or app behavior changes are used. The failed full run remains failed; it is not replaced by the 15 passes.

The corrected draft suite passed locally on Windows/pinned Chromium. The next work-branch run explicitly requests two additional input/draft passes after the full run (three total), retaining unchanged deadlines and every attempt.

Clean Windows `f6c6a88` verification: `npm test` passed185 (24.0s). Two additional input/draft runs passed at **47.1/140.1s** and **46.2/139.7s**, with unchanged180/300s deadlines. Combined with the corrected standalone draft pass, the editability wait passed three consecutive local draft runs. These are Windows results, not local Ubuntu certification.

## Verified release candidate

Candidate `f6c6a88104a51324e46a82bc5a1ca4b8af7feee5` passed [40419080270](https://github.com/pca01008/us-west-2027-trip/actions/runs/40419080270): 185 unit/static checks, 24 PostgreSQL checks, Firefox/WebKit functional suites, all16 Chromium suites, and three consecutive input/draft runs. Inputs: **59.1/57.1/55.4s** of180s; drafts: **174.8/169.5/165.3s** of300s. The full browser stage took722.4s (20-minute stage/30-minute job budgets unchanged). [Machine-readable receipt](2026-10-27-review-follow-up/release-validation.json) preserves suite timings and scope.

The aggregate and same-SHA Jekyll artifact check passed; manual work-branch deployment was skipped. Candidate Pages artifact12698065073, SHA256 `8052045f5a20677a97806ac30ea18474efe7494357a0d22592640c8ab4d75366`, matched required bytes and excluded authoring/test/private paths. Afterward Pages source was changed from legacy to `workflow` and confirmed by GET. A fresh fetch confirmed main remained `061584d`; nonforced promotion to the verified SHA succeeded. Main must validate/build/deploy that SHA before a production success claim.

Main run [40421603642](https://github.com/pca01008/us-west-2027-trip/actions/runs/40421603642), same `f6c6a88`, failed WebKit theme-radio pointer acknowledgement after Firefox passed; deploy stayed blocked. Downloaded synthetic trace12698370108 shows the dark radio checked, `data-theme=dark`, and menu hidden after the click, while Playwright still waited for pointer completion. The font request returned200 in18.6ms; no page error was recorded. This is an observed automation acknowledgement failure, not proof of a production theme defect or of an external transient. No blind rerun was used.

WebKit input fixtures now select themes with real focus+Space and explicitly require applied preference, checked radio and closed menu. Chromium/Firefox keep pointer theme coverage; all engines retain real pointer tabs/dialogs/fields and unchanged error/state assertions. WebKit pointer-theme completion and Linux PNG parity are not certified. App sources/output and deadlines are unchanged.

The first local keyboard-helper check correctly failed its new closed-menu assertion when the requested radio was already selected (Space causes no change event). The helper now closes that unchanged selection with real Escape before checking all postconditions. This setup failure is retained; no timeout was ignored.
