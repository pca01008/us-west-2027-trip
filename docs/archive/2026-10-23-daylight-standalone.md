# Existing and Daylight Standalone Publication

2026-10-23. Verified independent generated HTML and published latest candidate at user request.

## URLs and scope

[Existing](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-before.html), [Daylight](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-after.html), [shared controls](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html).

Standalone pages use full window without parent/iframe; Korean tab titles identify Existing version/Daylight and Trip comparison. Original features plus common synthetic data/offline isolation/version titles; no new framework/server/repository. [Operations](../OPERATIONS.md#daylight-rollout) owns reset/storage behavior.

| Identifier | Value |
|---|---|
| Existing |22ecee3/hash `ae302c9f6d7c`|
| Daylight working source |hash `746c729d28bb`|
| Fixture |2 / `a2c796346162`|
| Public commit |`e33942108a206043f8d462beb4e77052d992645d`|
| Pages |[39939571458](https://github.com/pca01008/us-west-2027-trip/actions/runs/39939571458)|

Separate worktree published only before/after/candidate/compare HTML/comparison JSON. Candidate includes [readiness](2026-10-23-daylight-readiness.md) mobile menu/focus fixes; that record's unpublished status was historical. Only previews updated, no root transition.

## Verification

Windows Node 24.19.0/Chromium, regenerated comparison/enhanced checks. Passed original equivalence/totals/isolation/reset/common controls/exact frame widths. Standalone each has one self frame, version title/hash, distinct trip/cache/offline/theme identity. Two tabs checked different PREP IDs and retained independent state after refresh; theme/navigation independent; full390/1440 width; zero SDK/API/PWA/media requests. Use stable check IDs because completion reorders DOM.

Local/public HTTPS passed after Pages success. Public root remained LF-equal22ecee3/hashae302c9f6d7c. Publication worktree verified e339421/clean/origin-main/no ahead-behind/intended remote.

Before mobile (`../ui-concepts/previews/daylight-comparison/standalone-before-390.png`; historical artifact unavailable in this checkout), after mobile (`../ui-concepts/previews/daylight-comparison/standalone-after-390.png`; historical artifact unavailable in this checkout), before desktop (`../ui-concepts/previews/daylight-comparison/standalone-before-1440.png`; historical artifact unavailable in this checkout), after desktop (`../ui-concepts/previews/daylight-comparison/standalone-after-1440.png`; historical artifact unavailable in this checkout).

Actual login/shared saves/backend sync outside preview scope. Main preview CI is not candidate working-tree CI. Local generator/tests/docs remained on candidate with preexisting uncommitted work preserved.
