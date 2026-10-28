# Project review checkpoint — 2026-10-28

## Resume instructions

Status: **complete, including resumed verification**. Read this file first, then [the report](archive/2026-10-28-project-review.md). Interrupted auth/UI probes completed with final IDs and stronger assertions. App fixes and deployment remain outside scope.

## Scope and constraints

- Review functionality, UI/accessibility, and test quality from current sources.
- Write concise English documentation; explain findings to the user in Korean.
- Preserve current schema 6/KRW/USD and all production data.
- Inspect `src/`; generated app outputs are not edit targets.
- Existing user changes at start: `README.md`, `docs/OPERATIONS.md`, untracked `docs/CODEX_CLOUD_GUIDE.ko.md`. Preserve them.
- Branch: `codex/modularize-travel-app`, tracking the corresponding origin branch.
- Do not modify Git metadata, install system prerequisites, or publish anything.
- Separate reproduced defects, source-supported risks, and optional improvements. Historical evidence is not current verification.

## Work checklist

- [x] Read repository instructions and inventory source/tests/docs.
- [x] Read Impeccable audit playbook.
- [x] Finish product/architecture/user behavior review.
- [x] Run current unit/static checks and preserve output.
- [x] Inspect save/draft/session/import/version/photo lifecycle.
- [x] Inspect itinerary/checklist/ledger/navigation/PWA behavior.
- [x] Inspect test coverage and failure/skip semantics.
- [x] Review current rendered desktop/mobile/light/dark UI where available.
- [x] Reproduce highest-value suspected defects in isolated fixtures.
- [x] Finalize prioritized report with source locations, impact, fixes, and regression checks.
- [x] Check documentation links, exclusions, and final diff.

## Current execution state

- Impeccable context completed: existing UI/product direction, no DESIGN.md; preserve incumbent design.
- Baseline HEAD: `216b713`; Node `v24.22.1`; `npm` is absent from PATH, so exact constituent Node commands are used.
- Generated-output and project checks passed. Sandboxed unit run: 183/185 passed; two local HTTP health tests failed. The isolated health suite rerun outside the sandbox passed 54/54, establishing an environment restriction rather than an app finding. Logs are in the dated evidence folder.
- Selected Chromium suites completed: inputs 48.9s, navigation 16.1s, ledger 32.6s, prep 34.9s, PWA 17.4s; all passed.
- Remaining 11 Chromium suites completed successfully, terminal `90523` exited 0. All 16 suites passed across two disjoint partial invocations. No active test process remains.
- Full unit run outside sandbox: **185/185 passed**, 23.96s. `unit-tests-unsandboxed.txt` is final evidence; original restricted run retained.
- Real-SDK audit probe succeeded: final F1 late editor entry after sign-out; F2 canceled login resumes. Logout-503 session retention hypothesis disproven.
- UI probe succeeded: final F3 malformed map URL; U1 exported viewer focus escape; U2 selected icon lacks semantic state. Panel references exist (rejected hypothesis).
- Resumed probes completed at 2026-10-28 16:11 KST, both exit 0. Current evidence (`auth-resumed.txt`, `ui-resumed.txt`, `ui-reproduction.json`) uses final IDs directly. Earlier UI JSON is preserved as `ui-reproduction-before-resume.json`; earlier auth logs remain. Node v24.22.1 / Chromium 151.0.7922.34, unchanged HEAD 216b713.
- Stronger assertions confirm F1/F2 with no public writes; F2 occurs for both button Cancel and Esc; all three malformed URL variants reproduce F3; U1/U2 persist. Esc/focus restoration, logout-503 session removal and panel labels pass as negative controls. No fixture/page errors. Both temporary files were removed.
- Mechanical detector's five warnings are not defects: hidden dynamic viewer image and intentional timetable/timeline accent borders.
- Inspected and preserved current mobile itinerary/PREP/timetable and dark desktop ledger PNGs. No general layout break confirmed; mobile first-screen density is optional UX work.
- Read current product/user guide plus source for composition, document refresh, editing/save, session, imports, versions, exports, drafts, checklist save and photo service.
- Audit scripts in the evidence folder derive synthetic fixtures from the current source. `reproduce-auth.mjs` temporarily generates a script under scripts/ and removes it; `reproduce-ui.mjs` removes its exported HTML after inspection. No production app edits.
- Existing validation backlog includes local Linux equivalence and physical phone checks. These must not be presented as newly discovered application bugs.
- No app source changes made.

## Next actions

No usage-limit-interrupted work remains. A future fix request should start with F1/F2, followed by F3/U1/U2 and the report's regression cases. Do not repeat full suites or expand to unrelated release prerequisites without a reason.

Final documentation validation: 20/20 project/repository tests passed; all 22 local report/checkpoint links resolved; both probe scripts passed syntax checks; `git diff --check` passed. Logs use `.txt` because the repository ignores `*.log`; this preserves evidence in future checkouts without changing ignore rules. Current `docs/` exclusion already covers all new evidence.

## Interruption record

Automatic approval review could not complete a cosmetic probe rerun because of the account usage limit. The action did not execute; this was not a safety rejection. Existing successful probe evidence remains valid. On the user's resume request, the already-running remaining Chromium suites were confirmed complete, and documentation work continued without bypassing approval.

Resolved on the subsequent explicit resume request: approved loopback-only execution completed both probes and expanded their assertions. The report now links final-ID evidence, not the earlier mismatched records.

Resumed documentation validation: 20/20 project/repository tests passed; all local report/checkpoint links resolved; both probe scripts passed syntax checks; `git diff --check` passed. See `archive/2026-10-28-project-review/resumed-validation.txt` and `documentation-resumed.txt`. No app source changes or active processes remain.

## Verification boundaries

- This is Windows development evidence, not full CI/release certification.
- No SQL fixture configured; SQL execution, clean Linux parity, Firefox/WebKit rerun, live production settings, and physical devices remain outside this run.
- Existing README/Operations/Cloud-guide changes remain intact; only a README review-index row was added by this task.
- No source/build/schema/dependency/production mutations; no commit or push.
