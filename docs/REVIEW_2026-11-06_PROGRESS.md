# November 6 implementation handoff

## Active work

The user authorized sequential fixes, verified commits, a final verification commit, push, and normal GitHub Pages deployment. This section supersedes the historical audit-only handoff below.

- Start: branch `codex/modularize-travel-app` at `7a42630`, tracking origin. The README and two audit Markdown files were already pending from the audit and belong with this follow-up.
- Stage 1 committed as `789809f`: F2 shares published adoption with refresh and Realtime. F3 guards PREP reads by editor request and dialog lifetime. T1 covers reversed responses, pending candidates, and late PREP reads after logout, expiry, and newer opens.
- Stage 1 checks: generated build, project integrity, whitespace, and 191/191 host Node tests passed. Real-SDK Chromium auth and Chromium PREP passed.
- Stage 2 committed as `df0ec37` (F1/T2): existing blank dates survive edits, invalid calendar dates normalize to blank, and normalized IDs are reserved before duplicate repair. Ledger/project Node checks (26) and desktop/mobile Chromium ledger and import suites passed.
- Stage 3 verified (commit subject: feat: clarify draft imports and prioritize ledger totals): U1/U2/U3. Move totals before the entry form in DOM order, tighten phone form spacing, increase meaningful type, and expose a draft backup from the import comparison. Impeccable context loaded for the retained Operate UI. User confirmed both travelers reviewed and approved the U1/U2 proposal. Node import/project checks (35) and Chromium import/ledger/navigation passed. Captures inspected at 320 and 390px, with both themes and a simulated reduced-height viewport. Navigation covers 320–1920px and 200% zoom. The detector repeated the five baseline findings (intentional accents and runtime-populated viewer image).
- Next: stage 4 U4. Baseline JSON under `node_modules/.cache/review-2026-11-06/photo-profile.json`. At 8 staged photos and 4x CPU, capture 107.5ms, one fingerprint 260.2ms, whole input 2709.4ms. Target same-event capture reuse, cached comparisons of private baseline/history, and fewer large defensive copies while preserving the synchronous checkpoint and IndexedDB writes.
- Follow AGENTS.md for elevated metadata writes. Pages deploys after validated PR merge to main. Windows host runs need the pinned Playwright browser path; strict SQL/Linux validation is available via Validate CI. Physical-device checks need the travelers' devices.

## Historical audit handoff

## Resume here

Audit complete. Read this file, then `docs/archive/2026-11-06-project-review.md`. The requested Markdown assessment is finished; implementation needs a subsequent request. If continuing fixes, start with F2/F3 and their controlled-response regressions. Do not treat earlier dated reports as current evidence.

## Request and constraints

- Review the current project from first principles across functionality, UI, and tests; deliver Markdown findings, not implementation fixes.
- Save progress frequently so another context/session can resume.
- Documentation in concise English; explain outcomes to the user in Korean.
- Two-user travel app; prefer proportional improvements. Preserve schema 6/KRW/USD and production data.
- Inspect editable `src/`, not generated application files. No production writes, deployments, commits, or permission changes are needed for this audit.
- Follow `AGENTS.md`. No subagents requested. Apply Impeccable technical audit guidance.

## Baseline

- Workspace: `D:/Workspace/travel/website`.
- Branch at start: `codex/modularize-travel-app`, tracking `origin/codex/modularize-travel-app`.
- Initial `git status --short --branch`: clean.
- Stack: generated static HTML/JS/CSS, Supabase Auth/Database/Storage/Realtime, IndexedDB drafts, PWA; Node tests and Playwright browser runners.
- Current trip is schema 6/KRW/USD; schema 7 applies to new trip currency pairs only.
- Existing audit reports are historical context, not fresh evidence.

## Checklist

- [x] Read repository rules, package scripts, README; discover source/test/document layout.
- [x] Record exact baseline commit, runtime availability, and review map.
- [x] Review core state/normalization, persistence/drafts/conflicts, auth/permissions.
- [x] Review itinerary/PREP, ledger, media, import/export, offline/PWA.
- [x] Inspect rendered mobile/desktop/light/dark UI and keyboard/accessibility behavior.
- [x] Run appropriate current tests; record exact outcomes and limits.
- [x] Reproduce promising findings with isolated synthetic fixtures.
- [x] Prioritize confirmed defects separately from improvements and verification gaps.
- [x] Update README navigation and final handoff; check documentation integrity.

## Current next action

No audit work remains. README links the final report/checkpoint. Final report: 3 reproduced user-visible defects, 4 UI/workflow/performance improvements, 3 test/normalization improvements; environmental/device gaps are explicit. For an authorized implementation follow-up, begin with F2/F3, then F1/T2; do not rerun the full audit first.

## Evidence and running work

- Baseline commit: `7a42630` (`docs: record verified October 28 deployment and follow-up checks`). Node `24.22.1`; `npm` is absent from sandbox PATH, so invoke the exact underlying Node scripts.
- `node scripts/build-app.mjs --check`: passed; outputs current.
- `node scripts/check-project.mjs`: passed (11 days, 36 events, 12 checklist items).
- Unit suite: restricted sandbox 184/186; two loopback HTTP failures. Same suite with approved host execution: **186/186 passed**, 24.1s. Do not report sandbox failures as app defects.
- Full Chromium runner **passed all 16 suites**. Session `73470` completed; longest was drafts 140.3s/300s. Timing file: `C:/Users/이승종/AppData/Local/Temp/westbound-browser-timing-TZExVf/results.json`.
- Firefox/WebKit compatibility **passed all six input groups**; session `19446` completed. Log: `node_modules/.cache/review-2026-11-06/engines.log`.
- Persistent local evidence (ignored): `node_modules/.cache/review-2026-11-06/`: `unit-sandbox.log`, `unit-host.log`, `browser.log`, `detector.json`.
- Detector completed (exit 2): five static warnings. Four timeline/card accent stripes fit the retained design; the no-src dialog image is populated at open time. No confirmed visual defect from these warnings.
- Reviewed source owners across document/session/storage/editing, checklist/schedule/timetable, ledger/currency, imports/exports/versions, photos/resources, navigation/theme and PWA; inspected SQL save/permission and CI gates. Tests provide broad behavior coverage, not line-by-line certification of every file.
- No app source changes.
- Performance profile completed (session `91099`): 0/8 photos × 1×/4× CPU, all correctness checks passed. Files: `photo-profile.json`, `profile.log` in the local evidence directory. Median input 9.7/709.5/47.8/2709.4ms respectively; exact table/limits are in U4.
- No background test processes remain.
- Final documentation validation: 17/17 project tests passed after README navigation changed; 74 local Markdown link targets across README/report/checkpoint verified; `git diff --check` passed. Only README and the two new Markdown files are changed/untracked. `docs/` is already excluded by `_config.yml`; no runtime/user-guide/operations changes were needed because behavior and procedures were not changed. No commit or push performed.
- Local ignored probes/logs/screenshots may be removed by dependency cleanup. The report retains essential reproduction steps, outputs, source locations, and measurements so it remains useful without those files.

## Findings ledger

- F1 confirmed browser behavior: an imported/legacy expense with `date:''` silently acquires today's date when only its name is edited. `ledger.js` defaults both edit initialization and save to `todayLocal()`.
- F2 confirmed through the actual SDK and local HTTP mock: editor-entry fetch at revision 11 returned after normal refresh accepted 12; baseline changed `12 -> 11`, newest title disappeared. Source-controller probe also observed a stale cache callback. Server optimistic concurrency still protects writes; do not claim silent server overwrite.
- F3 confirmed through an actual second SDK tab's sign-out: an outstanding PREP editor read reopens the dialog after logout, with Save enabled and app session null. No server authorization bypass is claimed.
- Rejected candidate: read-only exports initially serialize hidden panel ARIA, but `appendReadonlyRuntime.sync()` corrects all panels at execution. Do not report raw HTML alone as an accessibility bug. The probe must verify rendered output.
- Local probe: `node_modules/.cache/review-2026-11-06/probe.mjs`, `probe-results.json`, `probe.log`; 12 synthetic captures at 390/1440px in light/dark for itinerary/PREP/ledger. No page errors in the first run. Explicitly inspected mobile light ledger and desktop dark itinerary.
- Second probe run hit its own file-route block while opening exported HTML; changed to `setContent`; final run passed, rendered export has 13 panels and zero hidden panels. This was a probe failure, not an app failure.
- Online probes: `make-auth-probe.mjs` derives an isolated harness from `scripts/check-auth-browser.mjs`; `auth-probe.mjs`, `auth-probe.log`, `auth-probe-results.json` retain execution. Both new reproductions passed; no page errors, fixture errors or unexpected HTTP.
- Report now contains F1/F2/F3 with causes, limited impact claims, fix directions, and regression criteria.
- UI observations to evaluate: at 390x844 the expense form is 535.5px high and totals remain below the bottom nav after entering the ledger (total top ~852px); rate metadata is 9px, itinerary remarks 12px. Small native checkbox/radio boxes alone are not target-size defects: consider their associated labels and visually hidden radio implementation.
- Further unit boundary: `normalizeExpenses` with IDs `['x','x-duplicate-2','x']` returns duplicate IDs on the first pass and changes the third ID on the second. Record as a normalization/coverage improvement with exact scope; repeated normalization in main flows may repair it before rendering, so do not claim demonstrated multi-delete/data loss.
- SQL execution not run: no configured disposable PostgreSQL URL, no `psql`/Docker on PATH. Source permission/revision/schema/history checks inspected; unit assertions passed. Do not label this a full Linux/SQL/production verification.
