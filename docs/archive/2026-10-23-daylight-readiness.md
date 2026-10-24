# Daylight Rollout Readiness Review

2026-10-23, Asia/Seoul. User requested comparison/fixes through readiness just before production transition. Preserve earlier [implementation](2026-10-23-daylight-implementation.md)/[comparison](2026-10-23-daylight-comparison.md) as dated evidence.

## Verdict and identifiers

**Local functional review/fixes complete; no production transition/actual-data changes.** Updated comparison was local only, not yet public. No commit/push/candidate CI in this task.

| Source | Identity |
|---|---|
| Legacy |`22ecee308d3019cf6303a3d464013ea7172e4d6c`, LF hash `ae302c9f6d7c`|
| Worktree |`codex/daylight-implementation`, changes above HEAD `1b5c66a`|
| Fixed root |LF hash `746c729d28bb`|
| Common fixture |2/hash `a2c796346162`, same itinerary/12 PREP/three expenses/budget|

Manifest candidate `7ba5285` is last committed root, while `afterHash` identifies uncommitted fixes. Single-review baseline uses generation HEAD and also needs source hash.

## Comparison

Navigation moves from combined top tabs to desktop-left/mobile-bottom/separate dates, preserving initial phases/day/timetable/keyboard. Settings grouped edit/files/display; clipping/focus fixed below. Event time/category/photo/map/caution/undo/redo regressions passed. Stays use inclusive/exclusive boundaries, overlap notice, source deletion/edit/history, never assign missing legacy links. Important incomplete PREP preserves pending/failure/retry/concurrent/list behavior. Ledger retains equal totals/currency/rate/budget/filters/delete/order/CSV/unadded inputs. Schema5/persistence retained with v4 import/draft/conflict/preview/recovery/metadata round trips. Actual exports/PWA/offline/reconnect preserved work.

Derived stays/priorities/navigation remain outside saved main; repeated apply/tab/date/settings leaves fingerprint unchanged. Existing config changes were only two explanatory comments, no default-data overwrite migration.

## Fixed findings

### P1: mobile settings clipped left

At360/390px, panel left about **-202px**, width290px. Button wrapped to toolbar left but panel right-aligned to it. Whole-page overflow checks missed left clipping. Anchored panel to toolbar/constrained width; checker now directly asserts both open-panel bounds at 320/360/390/620/621/768/1100/1440px.

### P2: closing settings dialog loses keyboard focus

Settings→Export→Esc left focus on body because action opened dialog before bubbling menu close, leaving a hidden return target. Close menu in capture phase/focus visible Settings before action so dialog records it. Enter/dialog focus/Esc/return tested at eight widths and mouse path checked in generated review.

## Verification

Windows Node 24.19.0/Playwright 1.62.1 Chromium; npm absent/direct Node. Initial sandbox blocked two HTTP units/browser localhost; permitted local rerun, no ACL/ownership changes.

117 units passed **before final UI fixes**. Static11/36/12 passed. Full12-browser suites passed before/after: diagnostics/drafts/storage/inputs/imports/ledger/prep/auth/photos/theme/pwa/daylight. Final Daylight tested390/1440 functionality/eight menu widths/focus/exports/metadata. Both builders regenerated candidate/comparison; review/comparison checked hashes/isolation/stays/reloaded importance/equal totals/check/reset/date-theme-phase/exact390-768-1440 frames/zero outbound. Whitespace passed. After final docs, 18 project units/static reran successfully. Distinguish pre-fix117-unit result from final-source full-browser result.

Synthetic mobile light (`../ui-concepts/previews/daylight-readiness/390-settings-light.png`; historical artifact unavailable in this checkout), mobile dark (`../ui-concepts/previews/daylight-readiness/390-settings-dark.png`; historical artifact unavailable in this checkout), desktop light (`../ui-concepts/previews/daylight-readiness/1440-settings-light.png`; historical artifact unavailable in this checkout), desktop dark (`../ui-concepts/previews/daylight-readiness/1440-settings-dark.png`; historical artifact unavailable in this checkout), comparison (`../ui-concepts/previews/daylight-comparison/side-by-side.png`; historical artifact unavailable in this checkout).

Impeccable ran; old CSS colors/shadows/hidden description/dynamic photo-viewer src were not treated automatically as rendered defects. Actual theme/background/text/input/shadow/image states checked in render evidence (`../ui-concepts/previews/daylight-readiness/render-check.json`; historical artifact unavailable in this checkout)/captures. Small support text remained an improvement opportunity, not WCAG/full-device certification.

## Remaining rollout checks

Follow [operations](../OPERATIONS.md#daylight-rollout): commit exact fixes/verify its CI, preserve both drafts/latest shared backup, close/update old apps, obtain production approval. Prior38380e5 CI does not certify this source. Actual account saves/devices/old windows/Safari/Samsung/keyboards excluded. No SQL/grants/server changes, so no expanded SQL execution. Old code can erase new attributes; simple code rollback is not assured data recovery.

README/user/project/operations/plan updated. No files moved/deleted; existing docs Pages exclusion sufficed at that time.
