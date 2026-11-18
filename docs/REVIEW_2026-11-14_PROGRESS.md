# November 14 project review checkpoint

Status: local release validation complete as of November 18, 2026.
Requested start: 2026-11-14 04:00 Asia/Seoul, once, in the existing chat.
Workspace: `D:\Workspace\travel\website`.

## Authorized objective

Review the current project from first principles across functionality, UI, and tests. Write evidence-backed findings and an ordered implementation plan to `docs/archive/2026-11-14-project-review.md`, read that plan, then execute its stages sequentially. Validate and commit each completed stage before starting the next. Finish with final validation, a final commit for remaining changes, push, and the existing GitHub Pages release process. The user authorized these actions, including the PR/merge steps required by branch protection; retain normal permission and validation gates.

## Resume procedure

Read this file first, then the audit and `AGENTS.md`, `README.md`, `docs/USER_GUIDE.md`, `docs/PROJECT_GUIDE.md`, and the validation/deployment sections of `docs/OPERATIONS.md`. Check actual Git status, diffs, branch, remote, latest commit, and any active CI/deployment before continuing. Reconcile files and remote state with this checkpoint; never repeat a completed commit, merge, or deployment solely because context was lost.

Persist concise operational facts after each meaningful finding, before long validation, after each stage/commit, and before any interruption: current stage, completed and pending items, changed files, decision summaries, exact commands/results, commit SHAs, CI/PR/deployment links, blockers, and the next concrete action. Do not record hidden deliberation, secrets, or production trip content. If interrupted by token or usage limits, resume from the first unfinished step when execution becomes available; do not claim automatic recovery was guaranteed.

## Initial observation (2026-11-13; recheck at execution)

- Branch: `codex/modularize-travel-app`, tracking `origin/codex/modularize-travel-app`.
- HEAD: `a178b19` (`docs: record November review verification`).
- Worktree was clean before creating this checkpoint.
- Remote: `https://github.com/pca01008/us-west-2027-trip.git`.
- Existing documentation describes protected-main publication through PR checks, then main-push Validate and Pages deployment. Verify current settings before releasing.

## Execution constraints

- Preserve existing user changes and live data. Use a suitable `codex/` branch and the current project workflows. Audit current behavior rather than treating historical findings as current evidence.
- Keep changes proportional to two users. Review the existing app; do not revive the paused Daylight migration.
- Edit `src/`, rebuild generated outputs, and commit source plus output together. Keep the active trip on schema 6/KRW/USD.
- Include functional edge cases, saving/drafts/import/export/conflicts, desktop/mobile UI, keyboard/accessibility, and test reliability in the audit as applicable. Reproduce defects and add meaningful regression coverage.
- Follow `AGENTS.md` for Windows Git metadata permissions. Never recreate `.git`, reset ACLs broadly, force-push, or weaken branch protection.
- Update owning documentation in concise English; report to the user in Korean. Link the new audit/checkpoint from README when the audit exists. `docs/` is already excluded from Pages.
- Run stage-appropriate checks. Final checks include build freshness, unit/static tests, browser tests and required SQL/CI coverage under the documented environment. Record environmental gaps honestly and use existing CI where required.
- Push the verified work branch, complete required PR checks and merge through protection, then follow the same release through main validation, Pages deployment, and read-only public smoke verification. Do not treat a push as deployment success or write test data to production.
- Verify final clean status, expected latest commit, intended remote, and synchronized remote tracking. Record actual deployed SHA and workflow results. If permissions or authentication block progress, save the exact blocker and finish independent work.

## Stage ledger

| Stage | Status | Evidence / next action |
|---|---|---|
| Baseline and full audit | Complete | Baseline `a178b19`; historical evidence in the dated review |
| Findings and ordered plan | Complete | Reproductions and acceptance criteria in the dated review |
| 1. Undo and field names | Passed | `350cce8`. Build freshness, 195 unit tests, static checks, Chromium editing group and full drafts suite. Titles/cautions survive Undo, Redo, and reload. Named fields and reading roles verified in desktop/mobile fixtures and exports. |
| 2. Cache and cancellation | Passed | `b8ac701`. Build freshness, 195 unit tests, static checks, and full Chromium photos/drafts suites. Two-tab writes, fresh offline display, revision ties, legacy migration and failure/retry passed. All four photo-preparation cancellation boundaries retain prior attachments and allow retry. |
| 3. Keyboard interaction | Passed | `05c3ff5`. Build freshness, 195 unit tests, static checks, Chromium input suite, Firefox input groups, and WebKit groups. The combined Windows WebKit run reached its dialog teardown deadline after assertions passed. Standalone dialog and editing runs exited successfully. Chromium's accessibility tree confirmed modal isolation and the edit-to-reading role change. |
| 4. Visual verification | Passed | `9ecaf98`. Compared `a178b19` to `05c3ff5` with `check-palette-browser.mjs`. `baselineCompared: true`, 24/24 identical computed styles and PNGs, zero page errors. Reviewed light desktop itinerary, dark mobile ledger, desktop category error, and mobile photo error. Theme and export checks passed. |
| 5. Optional refinements | Passed | `f69a71d`. Implemented U4 at up to 520px. Navigation, themes, exports, print, and 200% zoom passed. Measured PERF1 and retained the existing font. See measurements below. |
| Final validation and release | Local validation passed | Merged current `origin/main` (`11712c1`) into the candidate without a source diff. Commit and push, then verify the protected PR and Pages workflows. |

## Stage 5 measurements

At 320 × 900 and 390 × 900, the title and theme button share one row. Header height dropped from 473px to 407px. The first PREP checkbox moved from 682px to 616px and the ledger date field from 823px to 757px. The tests cover both clocks, storage warnings, menu bounds, keyboard focus, touch navigation and 200% zoom. Reviewed PREP and ledger before/after in both themes. The post-change palette run had `baselineCompared: false`, 24 captures and zero page errors. All 14 desktop or print PNGs matched Stage 4 by hash. The detector flagged existing typography, decoration and the viewer image that receives its source on open.

Cold font measurement used three samples per condition, Chromium at 390 × 900, a simulated 1.6 Mbps connection with 150ms latency and 4× CPU slowdown. Median first contentful paint and ledger date-field focus were 712ms and 1,798ms with the font, and 572ms and 1,462ms with its request blocked. The 2,057,688-byte font finished at 11.07s while the interface was already usable. The measured first-load cost supports keeping the existing complete font and embedded exports pending representative phone measurements.

## Final local verification

Windows used Node 24.22.3 and Playwright 1.62.1. Generated-output freshness, static project/document checks, and Git whitespace checks passed. The serial unit run passed 195/195 tests. The Chromium runner passed 16/16 suites. Firefox and WebKit passed all six functional groups in a single run. The longest Chromium suite, drafts, used 146.3s of its 300s deadline.

The strict coordinator stopped at the Ubuntu 24.04 requirement on Windows. The protected PR workflow supplies the pinned Ubuntu/Node/npm/browser environment and disposable PostgreSQL 17. Its required gate and Pages artifact must succeed before merging.

## Release candidate follow-up

[PR 4](https://github.com/pca01008/us-west-2027-trip/pull/4) at `2104d0b` passed unit/static and PostgreSQL 17 in [Validate](https://github.com/pca01008/us-west-2027-trip/actions/runs/44244586003). Ubuntu WebKit discarded the first keyboard input after adding an event. The trace showed a named editable title with empty content after typing; typing into the explicitly clicked note still worked. The required gate stopped publication.

Schedule creation now finishes its focus and caret handoff after dialog isolation is released and before the next keyboard event. A side-by-side Chromium probe reproduced the missing immediate caret against `2104d0b` and verified it after the correction. The integrated editing regressions passed on Chromium, Firefox and WebKit. Generated, static, whitespace and 195 unit checks passed again.

Next action: push the verified focus correction and follow the updated PR checks through Pages.
