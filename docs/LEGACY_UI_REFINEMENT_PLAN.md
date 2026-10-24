# Existing-App UI Refinement Plan

Approved: 2026-10-24 (Asia/Seoul).

**Recorded status: implemented and automatically validated on a separate branch, before public deployment. Theme concept B (button/dropdown) was selected.** Further Daylight development/rollout is paused. Follow the [implementation record](archive/2026-10-24-legacy-ui-refinement.md) for subsequent deployment, actual results, and remaining real-device checks. Local implementation did not change public data/site.

## 1. Baseline and scope

- Retain navy header, coral accents, cards, and fonts; support mobile travel lookup and desktop planning/expense editing equally.
- Start implementation from latest deployed legacy app. Plan-time local `origin/main`: `1ff42eb3205d8f499042df462e2026f8798296f8`; recheck at implementation.
- Plan branch `codex/daylight-implementation` has the Daylight candidate at root, not legacy. Do not edit it as legacy or merge that entire branch. Create a separate `codex/` branch from current deployment and bring this plan.
- Preserve Daylight source/public paths/history, shared data, and metadata compatibility. Pause does not mean deletion/shutdown.
- Reuse HTML/CSS/JavaScript; no framework/server/DB changes.

## 2. Approved behavior

### Bottom navigation

- Fix itinerary/PREP/ledger at the bottom on desktop/mobile with icons, Korean labels, selected state; align wide layouts with content width.
- Remove top PREP/ledger tabs. Dates and daily/timetable controls appear only in itinerary. Keep header/editor/save tools.
- Preserve `selectInitialTab()` device-date rules: PREP before travel, current day during travel, ledger after. Do not substitute destination-zone or last-visited selection.
- Returning to itinerary retains this run's day/view. First visit uses current travel day or day one before/after travel.
- Clock/server updates never override user selection. Navigation preserves unadded expenses/drafts.
- Reserve navigation/safe-area space so final content, reorder buttons, and errors remain visible. Check keyboard, zoom, and dialog overlap.

### Remove budgets

Remove progress, amount, remaining/over-budget indicators and budget setting. Retain currency totals/conversion, manual rate, category totals/management. Preserve `budgetKrw`/`defaultBudgetKrw` as unused compatibility data without schema/migration changes. Normalize old HTML so removed UI cannot return; check data preservation separately.

### Remove filters and simplify CSV

Remove search/category/date-range filters/reset/results text and their variables/events/render dependencies. Retain entry date/category controls. Place Export CSV beside Expenses. Export all current entries, including unsaved changes, in user order with no hidden filter state. Preserve the then-current date/description/category/currency/amount/KRW-equivalent columns, UTF-8 BOM, special-character escaping, formula protection, rounding, and header-only empty output. Subsequent schema-6 columns are defined in the ledger plan/current guide.

### Expense Add and ordering

Use inherited font/consistent weight/line height and existing icons. Center icon/Add expense on one line, full-width below mobile inputs and sufficiently wide on desktop; minimum target 44px. Preserve validation/auth/saving. Remove Registration order from headings/summaries without replacement. Preserve up/down/array-order save/recovery and first/last limits; remove filter-based reorder restrictions.

### Theme concept B

Replace the large header select with a small translucent bordered Theme button. Open a dropdown with heading and Light/Dark/Device options/check mark; icon follows effective brightness. Select applies/closes; reclick/outside/Esc closes. Keyboard choice/Esc returns button focus; focus leaving closes without stealing it. Expose expanded/single-selection state using simple native radios/existing icons, without a menu library. Keep menu within small-screen bounds and below dialogs/above navigation as appropriate.

Preserve defaults, per-path localStorage, live device setting, and persistent outside-menu storage-error notice. Exclude theme from data/drafts/versions; keep offline working support and remove controls from print/share.

## 3. Approved visual references

October 24 conversation mockups used isolated `ui-preview/daylight-before.html` examples, never actual data/public app. They are layout references, not implementation/test evidence.

![Approved theme concept B](ui-concepts/previews/legacy-refinement-2026-10-24/theme-b.png)

- [A/B comparison](ui-concepts/previews/legacy-refinement-2026-10-24/theme-options.png): right-hand B selected.
- [Ledger/navigation draft](ui-concepts/previews/legacy-refinement-2026-10-24/ledger-draft.png): long body capture omits header for framing, not as a removal decision; offline/date/amount values are examples.
- Match proportions/layout but retain existing fonts/icons. Mobile body scrolls with fixed bottom navigation.

## 4. Implementation and acceptance

1. Inspect current legacy save/restore/export paths; prepare a separate branch. The original plan commit was documentation-only.
2. Connect bottom navigation, initial date/view/edit state without cloning original DOM or bypassing capture/apply.
3. Remove budget/filter/order UI/dependencies, adjust CSV/Add. Check current and loaded historical markup.
4. Implement B theme and validate all modes, keyboard/focus/storage failures.
5. Update/run relevant tests using [operations](OPERATIONS.md#validation).
6. Update [usage](USER_GUIDE.md), [internals](PROJECT_GUIDE.md), [operations](OPERATIONS.md) against final behavior. Planning alone must not describe future behavior as implemented.

| Area | Acceptance |
|---|---|
| Initial screen | Before/first/middle/last/after travel, Seoul/US West device-date boundaries |
| Navigation | Three-menu round trips, day/view/server-update selection, input/draft retention |
| Ledger | No budget/filter/order labels; add/edit/delete/reorder/save/reopen |
| CSV | Full/user order, empty, Korean/commas/quotes/newlines/formula-like values, currency/rounding |
| Compatibility | Old shared/draft/version/offline content never restores budget UI; retain budget/importance/stay/order data |
| Layout | 320/390/768/1440px and actual breakpoints, no clipping/overflow/bottom obstruction; themes/zoom/keyboard |
| Theme | Choice/persistence/reopen/device/blocked storage, outside/Esc/keyboard/focus |
| Export | Offline retains navigation/theme; print/share removes controls and uses light printing |

Record actual passes/failures/untested scope in dated archives. The table is acceptance criteria, not execution evidence. Existing `_config.yml` excludes this plan/images with all `docs/`.
