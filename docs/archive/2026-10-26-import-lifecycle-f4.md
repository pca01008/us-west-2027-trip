# Import cancellation lifecycle — F4

Fix for F4 in the October 26 project review. Baseline: `6b9051d`.

## Changes

- Capture the selected comparison and retain a request identity across file reading, public-document reads, and photo materialization.
- Invalidate pending work on Cancel/Escape, another file selection, authentication loss, and sign-out. External sign-out invalidates it before awaiting draft persistence.
- Ignore obsolete results, errors, and cleanup. They cannot apply a draft, replace a newer comparison, reopen an error, or change newer controls/status.
- Disable and guard Apply while running. Keep changed-revision reconfirmation and active-error retry available.
- Add 18 deterministic lifecycle unit cases and desktop/mobile browser regressions using actual file controls and delayed local reads. Assert the rendered document, IndexedDB draft, baseline/history, selection, errors, and duplicate-read count.

Behavior: [User guide](../USER_GUIDE.md#offline-working-copies-and-printshare-copies). Internals: [Project guide](../PROJECT_GUIDE.md#offline). Procedures: [Operations](../OPERATIONS.md#validation).

## Verification

- **169 unit tests passed**, including all 18 new lifecycle cases.
- **All 16 browser suites passed** using the standard runner. The import suite covers desktop and mobile Cancel/Escape during Apply, replacement, reversed comparison reads, session loss, and duplicate Apply, alongside existing validation, migration, rollback, and save checks.
- The new browser test fails against the unchanged baseline at its first in-flight assertion: Apply remains enabled while reading. The fixed app disables it immediately and passes cancellation/retention assertions.
- Build freshness, project validation, and whitespace checks passed. Build ran through `node scripts/build-app.mjs`; npm is unavailable in this shell.

Environment: Windows, Node `v24.22.1`, installed Chrome through Playwright. Restricted loopback execution returned `ERR_NETWORK_ACCESS_DENIED`; permitted execution passed. Tests use synthetic documents and local APIs with external requests blocked. SQL/schema/permissions are unchanged; SQL CI and publication are verified separately from these local results. No production trip writes or physical-device testing.

Application SHA-256: `4225ce66799b70b15aab4d19b50d18ab86e7da3278311296a7fe21273f625de3` (`index.html`).
