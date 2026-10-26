# Local / GitHub Validation TODO

Created: 2026-10-26 (Asia/Seoul). Implementation and verification status: see the [October 27 evidence](archive/2026-10-27-review-follow-up.md). Unchecked local/device items remain prerequisites, not completed checks.

## Objective

Run the same required checks against the same committed files in a reproducible local Linux environment and GitHub Actions. Prevent production publication when required checks fail or are missing.

Local success reduces surprises; it cannot reproduce GitHub runner load, hardware, or every external failure. A successful GitHub run for the release commit remains required.

This file owns outstanding work and acceptance criteria. [Operations](OPERATIONS.md#validation) remains the source for implemented procedures. Store actual run evidence in dated files under `docs/archive/`.

## October 27 implementation

The version file, strict full/partial coordinator, process cancellation/deadlines, owned disposable SQL helper, shared three CI jobs, aggregate gate, timing summaries, repeated boundaries, extra-engine input coverage, and Jekyll artifact/deployment gate are implemented. [Operations](OPERATIONS.md#validation) owns their commands. The observations below are the October 26 baseline, not current settings.

Recorded evidence includes Windows checks, CI PostgreSQL 17.11, three consecutive CI input/draft passes, and a failing nonpublishing gate probe. Clean local Ubuntu 24.04 full verification (this workstation has Ubuntu 26.04) and the travelers' physical phones remain unverified. CI Firefox/WebKit cover behavior; Chromium owns visual captures. Do not equate these scopes with physical-device verification.

## Observed baseline

These are repository observations on the creation date, not fresh test results.

| Area | Current state | Gap |
|---|---|---|
| Local evidence | Windows, Node 24, installed Chrome in the October 25 record | Different OS, runtime, and browser from browser CI |
| GitHub OS | `ubuntu-latest` | Image can change independently of local setup |
| Node | Unit/SQL jobs use 24; browser job uses 22 | Required jobs use different runtime versions |
| Dependencies | Lockfile; SQL/browser jobs run `npm ci` | Unit job does not install packages; setup is inconsistent |
| Browser | Playwright 1.62.1; CI installs Chromium | Local Chrome override can produce different results |
| SQL | PostgreSQL 17; `TRIP_SQL_TEST_URL` must use loopback | Local SQL can be omitted from an informal verification sequence |
| Entry points | `npm test`, `test:sql`, `test:browser` | No single full verification command |
| Browser deadlines | Drafts: 300 seconds; other suites: 180 seconds | Suite durations and remaining headroom are not summarized |
| Workflow deadlines | Unit/SQL: 5 minutes; browser: 15 minutes | Shared runner must preserve appropriate job budgets |
| Publication | Pages serves `main` root; Validate runs separately | No workflow dependency makes successful validation a prerequisite for publication |

Historical incidents:

- [Run 40143749380](https://github.com/pca01008/us-west-2027-trip/actions/runs/40143749380): the desktop date-tab test exceeded a five-second position wait with normal motion enabled. Commit `d9c6971` corrected fixture setup scrolling. Retain the fix and verify stability; do not count it as unfinished implementation.
- [Run 40188310100](https://github.com/pca01008/us-west-2027-trip/actions/runs/40188310100): the draft suite exceeded its former 180-second process limit. The closed-page/trace errors followed termination. Commit `7bd7cbc` increased the draft limit to 300 seconds. Retain that fix; measure whether the current suite has sufficient headroom.
- The [October 25 record](archive/2026-10-25-first-edit-draft-fix.md) distinguishes local success from the subsequent CI timeout. These incidents do not establish production data loss.

## Scope and constraints

- Reuse existing Node scripts, Playwright fixtures, and SQL tests. Keep the solution practical for two users.
- Use WSL2 / Ubuntu as the local Linux path. Browser CI now uses the matching official Playwright Noble image after a >20-minute system-dependency installation stall; this does not establish a completed local Docker/full verification path.
- Keep ordinary Windows checks available for quick feedback; label them separately from full Linux verification.
- Preserve schema 6, KRW/USD, trip IDs, production data, draft behavior, and existing application output.
- Keep SQL tests on a disposable local PostgreSQL instance. Preserve loopback URL validation and outbound production blocking in browser fixtures.
- Preserve Git metadata and ownership. Follow [AGENTS.md](../AGENTS.md); do not initialize/clone repositories from the elevated Windows sandbox or broadly change ACLs.
- This checklist originally planned validation/publication changes. The October 27 follow-up is authorized to implement and deploy; privileged local OS setup remains a separate prerequisite.

## P0 — Agree on one validation environment

- [x] Select Ubuntu 24.04 for the local/CI baseline. Required CI uses that release; local full execution remains unverified below.
- [x] Pin Node 24.22.1/npm 11.19.1 after successful unit, SQL and browser CI coverage; all required jobs read the version file.
- [x] Store the Node version in one checked-in version file supported by `actions/setup-node`; make local setup and all CI jobs read it. Document the expected npm version and dependency update procedure.
- [x] Keep `package.json` runtime support separate from the validation baseline. Do not raise `engines.node` merely to pin the test environment; decide any supported-runtime change explicitly.
- [x] Keep Playwright 1.62.1 pinned through the lockfile. Browser CI uses its digest-pinned Noble image; local setup installs the same binaries/system dependencies explicitly.
- [x] Reject `PWA_BROWSER_CHANNEL` overrides in the required full-check mode. Keep installed Chrome runs available as optional compatibility checks.
- [x] Configure disposable PostgreSQL 17 in CI/local helper; CI recorded 17.11. Local full execution remains unverified. Pin minors only if drift causes meaningful differences.
- [x] Run `npm ci` for clean Windows and CI environments, including the unit job. Never reuse Windows `node_modules` inside Linux.
- [x] Record OS release, architecture, Node/npm/Playwright/browser/PostgreSQL versions at the start of verification. Never print database passwords or full connection URLs.

Acceptance: local Linux and CI use the agreed versions, and a mismatch produces an actionable failure instead of a misleading full pass.

## P0 — Provide a repeatable local Linux setup

- [x] Inspect WSL status, installed distributions, and PostgreSQL availability. The presence of `wsl.exe` alone does not prove Ubuntu is installed or ready.
- [x] Document prerequisite installation as user setup steps in [Operations](OPERATIONS.md#validation). Keep privileged OS setup separate from repository scripts.
- [x] Choose one Linux working directory and installation procedure. Avoid shared dependency directories or simultaneous Git writes from Windows and Linux.
- [x] Provide a disposable PostgreSQL lifecycle: start, bounded readiness wait, test, and cleanup. Use a dedicated test instance with no persistent production connection.
- [x] If PostgreSQL runs in Docker, expose it only on loopback and run the Node SQL tests through that loopback endpoint. Do not weaken `check-trip-sql.mjs` to accept arbitrary container hostnames.
- [x] Choose Docker as the documented disposable SQL path. Without Docker, stop and install the prerequisite; never fall back to a shared personal database.
- [x] Avoid port collisions and identify exactly which test instance the helper owns. Cleanup must never stop unrelated services.
- [x] Define cleanup for success, failure, cancellation, and forced termination. Leave diagnostics available while reporting any leftover test resources.
- [ ] Verify a fresh terminal session can follow the documented steps without hidden shell variables or production credentials.

Acceptance: one documented setup path prepares Linux, packages, Chromium, and disposable PostgreSQL. Missing prerequisites prevent a full verification result.

## P0 — Add a shared verification entry point

Implemented entry point:

```sh
npm run test:ci
```

- [x] Add a small `scripts/check-ci.mjs` coordinator and the package script. Reuse existing suites rather than duplicating assertions.
- [x] Default to the complete sequence: environment checks → `npm test` → `npm run test:sql` → `npm run test:browser`.
- [x] Keep generated-output verification read-only. Do not run a build that silently repairs stale committed files during verification; build deliberately before the final check.
- [x] Allow explicit `--suite=validate`, `--suite=sql`, and `--suite=browser` selection for existing CI jobs. A selected subset must be labeled partial, never full verification.
- [x] Make missing PostgreSQL, browser binaries, package installation, wrong versions, and invalid overrides fail with nonzero status. Never turn a missing prerequisite into a skipped successful check.
- [x] Preserve existing test exit codes and distinguish assertion failure, process deadline, browser crash, and setup failure.
- [x] Use bounded execution and terminate child processes on cancellation. Keep failure diagnostics before cleanup when possible.
- [x] Print per-stage elapsed time and a final passed/failed/not-run summary. Stop early on invalid setup; avoid launching expensive checks after a prerequisite failure.
- [x] Include the commit SHA and working-tree state. Mark results from modified files as local development evidence, not certification of the committed release.
- [x] Add focused coordinator tests for failure propagation, omitted prerequisites, subset labeling, cancellation, and stale generated output. Avoid retesting every underlying suite.

Acceptance: the default command cannot report success unless every required stage completed successfully. Full local and CI results identify the source commit and environment.

## P0 — Use the shared entry point in GitHub

- [x] Keep three jobs and SQL service isolation; call each explicit coordinator subset. SQL/validate run in parallel; browser waits for validate after the observed October 27 runner interruption wasted a complete browser run.
- [x] Ensure their combined coverage equals the default local command. Do not run the entire browser suite in every job.
- [x] Read the agreed Node version file, use the explicit Ubuntu release, and install locked packages consistently.
- [x] Keep PostgreSQL readiness checks and loopback `TRIP_SQL_TEST_URL` in the SQL job. Supply only disposable test credentials.
- [x] Keep browser diagnostics on failure and upload environment/timing summaries even when a stage fails. Report upload failures separately from the original test failure.
- [x] Add one stable aggregate validation result requiring all three jobs. Failure, cancellation, unexpected skipping, or incomplete checks must prevent aggregate success.
- [x] Preserve PR and manual work-branch execution so GitHub can verify release candidates before they reach `main`.
- [x] Set job budgets from measurements, retaining adequate room for dependency/browser setup and diagnostic capture.

Acceptance: one work-branch commit passes all three jobs and the aggregate check; a deliberately failing candidate cannot produce an aggregate pass.

## P1 — Remove timing sensitivity and measure limits

- [x] Preserve the instant date-strip fixture positioning introduced by `d9c6971`. Continue testing real app motion in both reduced-motion and normal-motion modes.
- [x] Review tab-position waits and min-height release conditions. Wait for observable state and geometry; avoid arbitrary sleeps or disabling the behavior under test.
- [ ] Repeat the previously failing input and draft suites at least three consecutive times in local Linux and in a temporary work-branch CI check. Retain every failure; do not accept only the last successful attempt.
- [x] Capture each suite's elapsed time and deadline. Warn at a documented threshold, initially 75% of its process budget, without weakening assertions.
- [x] Confirm the draft suite completes with useful headroom under its existing 300-second limit. Investigate slow scenarios before increasing that limit again.
- [x] If a suite approaches its budget repeatedly, reduce redundant fixture work or split it at existing scenario boundaries. Preserve all fault cases and avoid a general test framework rewrite.
- [x] Preserve screenshots/traces/scenario data before process teardown where possible. For forced termination, identify the current scenario and original timeout explicitly.
- [x] Do not use blanket retries, swallowed errors, or unconditional timeout increases to make the workflow green. Any targeted retry needs an identified external transient cause and visible attempt history.

Acceptance: repeated targeted runs are stable, current full-suite timings are recorded, and test failures remain visible and diagnosable.

## P0 — Make successful validation a deployment prerequisite

Immediate operating rule:

- [x] Validate the candidate locally (Windows scope) and on its work branch before updating `main`. Preserve its SHA; clean local Linux full execution remains separate below.
- [x] Inspect available GitHub branch rules and Pages source settings. Record actual capabilities; do not assume required checks or protection are enabled.
- [ ] Where supported, require the stable aggregate check before merging to `main`, and inspect direct-push/bypass behavior. Document limitations honestly.

Enforced publication target:

- [ ] Change Pages publication to a controlled Actions deployment that depends on successful validation of the same commit. A manual work-branch Validate run must never publish production.
- [x] Prefer one workflow containing validation and dependent Pages build/deploy jobs. Gate publication to the intended `main` event/ref, with Pages permissions scoped to deployment jobs.
- [x] Check out and package the validated commit, never a moving `main` reference. Avoid downloading an artifact whose source SHA is unverified.
- [x] Preserve Jekyll/Pages behavior and `_config.yml` exclusions. Same-SHA artifact checks reject source, dependencies, tests and private/local exports.
- [x] Preserve relative paths, PWA assets and existing preview directories; required-byte and browser path checks pass. Verify the publication artifact before switching Pages source.
- [x] Define deployment concurrency so an older validation run cannot overwrite a newer release. Handle cancellation without publishing incomplete output.
- [x] Test failure/cancellation/skip behavior on a work branch or nonpublishing dry run. Confirm deployment is unreachable when a required job fails.
- [x] Switch Pages source only after the replacement artifact and dependency graph pass. GET confirmed `workflow`; legacy publication is disabled.
- [x] Document recovery to a known compatible release. Rollback must preserve trip data and follow the same validation gate; do not restore an uncontrolled publication bypass.

Acceptance: a failing candidate cannot publish. A successful release identifies its validated SHA, Pages artifact, deployment run, and final URL; record actual activation in the dated evidence.

## P1 — Verify the complete change

- [ ] Run the complete shared command from a clean Linux dependency installation against the final candidate files.
- [x] Run the same committed candidate in GitHub; compare environment, selection, counts and timing in the dated receipt.
- [x] Use isolated negative checks to prove: stale generated output fails; missing SQL fails; browser failure propagates; selected subsets remain partial; cancelled validation cannot deploy.
- [x] Verify failure artifacts survive and successful runs do not accumulate unnecessary temporary files.
- [x] Run existing Windows checks once for developer usability after changing shared scripts. Keep this result separate from Linux/CI equivalence.
- [x] Check same-SHA Jekyll artifact bytes/exclusions and isolated navigation/PWA path fixtures without production writes.
- [ ] After an actual authorized deployment, verify public asset identity and basic read-only behavior separately from automated fixture results.

## P1 — Maintain documentation and evidence

- [x] Update [Operations](OPERATIONS.md#validation) with the implemented environment, full/partial commands, PostgreSQL lifecycle, diagnostics, timeout policy, and troubleshooting.
- [x] Update [deployment procedures](OPERATIONS.md#deployment) with the actual validation gate, commit identity rules, Pages settings, and recovery path.
- [x] Update [README](../README.md) setup/navigation links and runtime notes. Link to Operations rather than copying setup instructions.
- [x] Update [Project guide](PROJECT_GUIDE.md) only if shared-runner/workflow architecture needs explanation. No user-guide changes are expected unless app behavior changes.
- [x] Add dated evidence under `docs/archive/`: exact SHAs, environments, commands, results, timing, failed attempts, gate tests, and remaining limits. Do not rewrite historical passes as current evidence.
- [x] Keep this checklist current; link completed items to implementation/evidence instead of turning it into another operations manual.
- [x] Run relevant documentation/link tests and `git diff --check`. Confirm `docs/` remains excluded from Pages; update exclusions only for newly introduced publishable paths that require it.

## Suggested implementation order

1. Establish the version baseline and local Linux/PostgreSQL setup.
2. Add the shared coordinator and its failure-handling checks.
3. Move GitHub jobs onto the same environment and coordinator.
4. Measure repeated input/draft runs and resolve remaining instability.
5. Verify the candidate on its work branch; prepare and test the publication gate.
6. Activate the verified Pages gate, document actual procedures, and record evidence.

Do not combine this work with UI redesign, currency migration, dependency upgrades unrelated to validation, or production database changes.

## Definition of done

- [ ] Required local Linux and GitHub checks use the same declared tools and test stages.
- [x] Missing prerequisites and failed/unfinished checks cannot produce a full pass.
- [x] Previously failing suites pass repeated Windows/CI runs with measured headroom; local Linux remains unverified above.
- [ ] Production deploys only an artifact derived from the validated release commit.
- [x] Documentation describes implemented behavior; dated evidence distinguishes local, CI, deployment, and device verification.
- [x] Remaining limits are explicit: runner performance still varies, mocked browser APIs do not prove production integrations, and emulation does not replace physical-device testing.
