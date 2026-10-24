# Dual-Currency Ledger Plan

Written: 2026-10-24 (Asia/Seoul).
**Status: implemented; unit/browser/real PostgreSQL CI verified; user confirmed production SQL; Pages deployed.** See [implementation/results/deployment](archive/2026-10-24-ledger-dual-currency.md).

Baseline: legacy app at `f03e727`, local `codex/legacy-ui-refinement`. Design/local implementation did not read or modify real expense data. Later public read-only checks are recorded separately.

## 1. Purpose and scope

Allow two travelers to record actual KRW and USD amounts for each expense while retaining existing colors/cards/navigation. Requested behavior: enter either currency to calculate the other at the manual rate with an automatic hint; enter both manually to retain both without a hint or rate-mismatch warning.

Apply consistently to add/edit/list/totals/CSV/drafts/export/restore. No live-rate API, rate-history screen, per-entry rate editor, or framework. Daylight development stays paused; data-preserving compatibility is a deployment requirement. [Usage](USER_GUIDE.md#ledger), [internals](PROJECT_GUIDE.md), and [operations](OPERATIONS.md#validation) own final behavior. Below is preimplementation design history, not execution evidence.

## 2. Baseline findings

| Area | Original behavior and required change |
|---|---|
| Add/edit | `#expenseAmount`, `#expenseCurrency`, `addExpense()`, `#expenseDialog`, `openExpenseDialog()`, `saveExpenseChanges()` use one amount/currency |
| Normalization | `normalizeExpense(s)`/`normalizeState()` discard unfamiliar fields; simply adding fields cannot preserve them |
| List/totals/rate | `renderLedger()` totals originals and KRW+USD×current rate; `updateExchangeRate()`/settings changes historical conversion |
| CSV/diff | `exportExpensesCsv()` uses current rate; `buildDiff()` compares only old amount/currency |
| Input | `applyStatePreservingInputs()` retains values/focus/selection, lacks manual/calculated provenance |
| Markup/state | `sanitizeMarkup()`/`moneyTemplateHtml`/`IMPORT_ALLOWED_MONEY_IDS` replace old ledger HTML/restrict IDs; capture/apply/fingerprint affect all persistence |
| Schema/server | Config/template schema 5; JSONB/revision RPC permits expansion without expense tables |
| Daylight | Separate cache but same tripId; old normalization can erase new data |

Update existing rate/rounding/category/order regressions rather than deleting them.

## 3. Input, display, and transitions

### Interface

Replace the single amount/currency selector with labeled KRW/USD inputs in add and edit forms. Show automatic-rate hints only under calculated fields; do not show actual/effective-rate mismatch warnings for manual pairs. Display two representations of one expense, e.g. `₩14,500 · $10.00`, never joined by plus. Desktop side-by-side, narrow mobile stacked; long values/errors must not overlap buttons. Use actual labels/`inputmode="decimal"`, field-linked errors/focus first failure, non-color-only hints without noisy per-keystroke announcements.

### Internal state

Keep manual raw strings separate from calculated output, independently for add/edit; share only small calculation helpers. Two populated fields do not imply both were entered manually.

| Action | Result |
|---|---|
| Both empty | No calculation; Add requires at least one |
| KRW only | USD=KRW/rate; hint only USD |
| USD only | KRW=USD×rate; hint only KRW |
| Type into automatic side, even same number | Both manual; preserve opposite value/remove hint |
| Edit one manual value | Opposite unchanged |
| Clear one manual side | Calculate it from remaining side/show hint |
| Clear automatic pair's source | Clear both |
| Clear automatic result only | Restore calculation while source remains |
| Invalid/partial number | Preserve string, no confirmed calculation, block submit with field error |

Focus/selection alone never changes source. Real paste/mobile/IME input does; programmatic value assignment does not.

### Add/edit/refresh

Clear name/amounts/source only after successful Add. Auth cancel/validation failure keeps input. Revalidate immediately before insertion after authentication using latest valid rate; never recalculate manual pairs. Restore source in edit; name/date/category-only changes preserve amounts/rate. Editing a source or switching back to automatic uses current rate; opening alone does not. Cancel/Esc discards temporary edit; remotely changed/deleted entries require review instead of stale overwrite.

Save/Realtime/reconnection preserves raw strings/source/focus/cursor; only automatic unadded output updates for changed rates. Unadded input remains outside IndexedDB/shared data; added draft entries include amounts/source and publish only after Save changes.

## 4. Amounts, rates, and totals

The request did not explicitly specify historical recalculation. Recommended design: **fixed added amounts; rate changes affect future calculations only**. These were design assumptions to review before implementation.

- Rate unit `1 USD = R KRW`; no external rate fetch.
- Automatic pairs retain both calculated values and applied R. Manual pairs retain fixed values without changing global rate.
- Settings says Applies to new calculations; no bulk historical recalculation.
- KRW total sums all KRW values, USD total all USD values; they represent identical spending, not additive totals. Replace redundant KRW-equivalent card with two cards. Category totals match. Document the changed meaning from original-KRW-only totals.

### Precision/validation

New manual KRW uses integers, USD at most two decimals; excess precision requires explicit errors. Automatic values round half-up to won/cents using the same display/commit calculation. Distinguish empty before Number conversion; trim/parse proper thousands separators, rejecting malformed grouping/exponents/mixed text. Manual input must be finite/positive; reject zero/negative/Infinity/NaN. Valid positive source may calculate to zero: retain automatic hint and distinguish zero from blank/manual.

Reject unsafe KRW integers/USD cents and calculation overflow. Rates must be finite/positive only when calculation is required; manual pairs need no valid global rate. Use minor units and small decimal rational helpers to avoid binary boundary errors, without a large money dependency.

## 5. State and legacy data

### Schema 6 expense

```json
{
  "id": "expense-example", "name": "Dinner", "date": "2027-01-21",
  "categoryId": "food", "amountKrw": 14500, "amountUsd": 10,
  "amountSource": "both", "appliedExchangeRate": null
}
```

`krw` means KRW manual/USD automatic; `usd` means USD manual/KRW automatic; both store the positive applied rate. `both` means manual pair/rate null. Do not retain old amount/currency as a second source of truth. Rendering/comparison/CSV use new fields. Normalization validates combinations and rejects corrupt new state rather than replacing with zero/current-rate calculations.

### Schema 5 and earlier

- Preserve source amount/ID/date/category/order and calculate only the other currency once at **that document's saved rate**, not another loaded document's rate. Invalid rates use the existing default fallback with a notice.
- Historical rates cannot be reconstructed; call this a conversion baseline. Show a one-time notice explaining existing entries are calculated/fixed using saved rate.
- Preserve fractional legacy KRW/other precision through separate legacy reading/new-input validation. Apply new precision only when editing amounts.
- Round only newly calculated opposite currency. Per-row conversion can differ slightly from former convert-after-summing totals; show differences, never imply historical accuracy improved.
- Valid schema 6 never reconverts on reopen/normalization/rate changes; conversion must be deterministic.
- Reads do not auto-save. Normalize baseline/draft consistently to avoid false dirty state. Normal save writes schema 6.
- Convert draft/current baseline separately at their own rates. Restore/import uses each file/version rate without modifying archived versions.
- Retain preconversion export/restore ability; rollback must not deploy code that ignores new fields.

### Old-client protection

Unknown-field stripping affects even Daylight PREP-only saving. Raising a schema number alone cannot stop already open tabs.

1. Add minimal future-schema detection/write blocking to existing app/Daylight with a short refresh notice; no new Daylight inputs.
2. Add a small RPC check rejecting schema lower than current document, preserving old-tab/offline data without new tables/auth systems.
3. Keep full setup/incremental migration identical and retain editor/revision checks. Applying SQL belongs to implementation/deployment, not original planning.
4. Confirm all full/PREP/restore writes use guarded RPC. New app converts old versions before restoring.
5. Reject future formats before normalization, never replace unreadable content with empty state then save.

## 6. CSV, comparisons, exports

CSV columns: date, description, category, KRW amount, USD amount, calculated currency, applied rate; last two blank for manual pairs. Export stored values, not current-rate calculations. Preserve legacy precision in CSV and document display rounding differences. Keep UTF-8 BOM/CRLF/quote/comma/newline/formula protection and header-only empty exports.

Compare both amounts/source/applied rate, including same-number automatic→manual changes. Offline/print/JSON/IndexedDB must agree. Derive automatic hints at rendering, never duplicate them as stored data.

## 7. Implementation order

1. Small calculation/normalization/conversion helpers and input/state contract in `index.html`.
2. Schema 6 in config/template, retaining manual default rate.
3. Add/edit controls, input events, transitions, validation/hints.
4. `renderLedger()`, rate settings, `exportExpensesCsv()`, `buildDiff()` use fixed values.
5. Capture/apply/drafts/sanitization/import IDs, source restoration, schema rejection/round trips.
6. Minimal `daylight/index.html` compatibility; never just bump its configured schema without reading support.
7. Setup SQL/incremental RPC downgrade guard.
8. Ledger/draft/import/input browser scenarios with fixed independent expectations.
9. Project checks/SQL runner/fixtures and calculation units; retain old fixtures as compatibility tests.
10. Update user/project/operations guides against final implementation.

Review root/Daylight workers; bump versions only for cache/precache changes. Old previews/design/history are not implementation targets.

## 8. Validation and completion

Use fixed `1 USD=1,400 KRW` unless stated; do not generate expected values with app helpers.

| Scenario | Expected |
|---|---|
| KRW 14, 000 only / USD 10 only | USD 10.00 / KRW 14, 000; opposite-only hint |
| Manual 14, 500/10 | Both retained/no hint |
| Retype automatic 10 | Same number, source both/no hint |
| Clear one manual side | Automatic from remaining value |
| Clear/retype automatic source | Both clear/recalculate; result never promoted |
| KRW 1 | Automatic USD zero allowed, not blank |
| USD 0.01 at 1, 350 | KRW 14 (half-up boundary) |
| Change rate 1, 400→1, 500 | Old USD10 stays KRW14, 000; new USD10→15, 000 |
| Name/category-only edit | Amount/source/rate unchanged |
| 14, 000/10 auto plus 14, 500/10 manual | Totals KRW28, 500/USD20, no double counting |
| Invalid/precision/zero/negative/empty/overflow | Field error, no save, retained input |
| Auth wait/cancel/success | Retained input/revalidation/no duplicate |
| Save/remote/reconnect while typing | Raw strings/source/focus/cursor retained; automatic portion only updates |
| Undo/redo/draft recovery | Amount/source/hints restored |
| Old documents/drafts/versions/files | Own-rate deterministic conversion; source precision/IDs/order retained |
| Fractional legacy/rounding | Source CSV precision/expected total difference |
| Old client/Daylight saving schema 6 | Server rejects downgrade/preserves data |
| New client restoring old version | Converts then saves schema 6 |
| Corrupt new/future format | Error without overwrite; original draft retained |
| CSV/offline/print/category deletion/order/empty | Consistent amounts/source/security/Korean and original behavior |

```sh
npm test
node scripts/check-ledger-browser.mjs
node scripts/check-drafts-browser.mjs
node scripts/check-imports-browser.mjs
node scripts/check-inputs-browser.mjs
npm run test:sql
npm run test:browser
```

Check desktop/mobile real rendering of long values/hints/errors/keyboard/dialogs. Apply server guard before deployment, verify new/old-tab behavior, distinguish mocks from production. Completion requires all three input modes, fixed amounts/no double totals, source persistence through every recovery path, old-client protection, docs, and passing checks.

## 9. Documentation and original deliverable

README links here; [user guide](USER_GUIDE.md) owns input/hints/rate/totals/precision, [project guide](PROJECT_GUIDE.md) owns schema/conversion/input/diff/RPC, [operations](OPERATIONS.md) owns checks/server-first/Daylight/cache/rollback. Put actual dated results in archives, never rewrite old evidence as new. Existing Pages exclusion covers docs without config changes.

Original plan work changed only this document/README navigation, not code/DB/deployment/usage. Later implementation updated code/guides. Scenarios are criteria, not execution results; see the top record for actual scope.
