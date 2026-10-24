# Daylight Candidate Implementation and Validation

Recorded 2026-10-23, Asia/Seoul. Authorized implementation on `codex/daylight-implementation`; production migration/actual-data editing require separate approval. [Plan](../DAYLIGHT_IMPLEMENTATION_PLAN.md), [usage](../USER_GUIDE.md), [internals](../PROJECT_GUIDE.md), [rollout](../OPERATIONS.md#daylight-rollout).

## Baseline and changes

Started `22ecee3`, preserving uncommitted README/PRODUCT/plan/October 22 handoff. Integrated desktop-left/mobile-bottom navigation, dates/grouped settings/sage-white-green into existing functionality. Original events receive checkout dates, check-in inclusive/checkout exclusive; editor rejects overlaps/imports flag them. PREP importance persists; only incomplete important items render with pending/failure/retry/source navigation.

Kept schema 5; sanitization/capture/apply/diff/checklist patch/undo/exports carry metadata. Derived regions rebuild outside saved HTML. Existing itinerary/timetable/photos/ledger/auth/drafts/conflicts/versions/theme/PWA connected, no new DB/dependency. Actual offline/read-only exports reopened in fresh contexts to check navigation/metadata/no requests; read-only shows checkout on original events. Final review removed empty desktop read-only helper column and asserted full width; Daylight/theme/project rechecks passed.

## Historical validation

Windows Node 24.19.0/Chromium, synthetic/local APIs only, no production data; npm absent, direct Node equivalents.

| Check | Result |
|---|---|
| Baseline units | 114 passed |
| Candidate units |117 passed; one in-progress missing document link resolved by full rerun after writing |
| Static |11 days/36 events/12 PREP |
| Full browser |10 of11 initially; old hidden PWA-tab selector fixed and PWA independently passed |
| PWA |Root/subpath installation/offline/reconnect/theme/update |
| PREP |Desktop/mobile/offline; importance-only preserves remote checks/excludes other drafts/detects conflicts |
| Daylight |390/1440 importance/pending/failure/stay errors/bounds/overlap/history/metadata/actual exported files; no overflow360/390/768/1280/1440 |
| Visual |Six desktop/mobile itinerary/PREP/ledger views; removed ledger ornament, prioritized mobile importance, adjusted12px support text/approval wording; review passed |
| Final theme |Light/dark/device/sync/edit/dialog/two exports/print/responsive |
| A prototype |`capture.mjs a`: navigation/stay edges/importance complete-restore/settings/timetable/five widths |
| Review output |Hash/storage isolation/stays/important-check reload/zero external requests |

[Captures/results](../ui-concepts/previews/daylight-candidate/). Isolated baseline auth/PWA could not complete because copied SDK dependencies were missing; candidate tests with installed dependencies passed. Sandbox localhost denial retried with permitted execution, no ACL changes.

## Review and remaining approval

`build-daylight-review.mjs` reproducibly generates `ui-preview/daylight-candidate.html`, synthetic/offline/isolated storage/no PWA/production SDK, identified by source SHA-256/commit/fixture. Public editing stays local; shared/auth/conflict evidence comes from same-source mocks. Real phone keyboards/Safari/Samsung darkening/actual accounts/old-window transition untested. Both users must preserve drafts/update apps; old code may erase attributes. Rollback never overwrites real data with old backups. No root deployment/data editing; production approval remained.

## Publication identifiers

- [Integrated review](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-candidate.html): final source `7ba5285`, review commit `38380e5`, LF hash prefix `e6f6cd083791`, fixture 1. Read-only width fixed after `ffe3bfe`/`7a435a6`.
- [Visual A](https://pca01008.github.io/us-west-2027-trip/ui-preview/a.html): example stays/priorities; B/C preserved.
- Public-only `a799d5b`/`86114f0`: six preview files/final candidate update via separate worktree; no root/config/PWA change.
- [Pages39873106260](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873106260) succeeded; public review checks passed hash/isolation/stay/reload/no outbound.
- Public root byte-equal after LF normalization to `22ecee3:index.html`, hash `ae302c9f6d7c`.
- PR failed: connector403/local Git-auth API404; no permission changes. [Branch comparison](https://github.com/pca01008/us-west-2027-trip/compare/main...codex/daylight-implementation).
- [Initial CI39873250045](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873250045) (`7a435a6`) and [final CI39873569293](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873569293) (`38380e5`) passed unit/SQL/browser. Final117 units/SQL Node 24, full browser Node 22; distinct from preview-only main.
- [Final Pages39873604560](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873604560), `86114f0`, succeeded; public hash/behavior rechecked. Read-only PC (`../ui-concepts/previews/daylight-candidate/1440-readonly.png`; historical artifact unavailable in this checkout) reflects width fix.
- Closing commit adds record/checklist/captures only; app/tests/review unchanged from tested38380e5. Links/static/whitespace passed separately.
- One-time `daylight` automation deleted; public-only temporary worktree archived recoverably.
