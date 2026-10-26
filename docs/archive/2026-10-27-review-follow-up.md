# Review follow-up — 2026-10-27

Scope: U2 → U3 → T1 → T2 → T3 from the [October 26 review](2026-10-26-project-review.md). Starting commit: `ef4349f`; existing README/Operations/Cloud-guide/review changes were preserved. Current trip remains schema 6, KRW/USD.

## U2 — Rate validation

Settings rate input is buffered until Apply/Enter. Invalid text stays visible with an associated inline error and focus; Cancel/Escape discards only pending rate input. Nested category rendering preserves it. Positive rates allow up to six decimal places. Unchanged rates do not create mutations.

Verified on Windows, Node 24.22.1, installed Chrome, synthetic offline desktop/mobile fixtures: empty/zero/negative/nonnumeric/excess precision × pointer/Enter × both themes; Escape, correction, category rendering and explicit cancel. Ledger suite passed; 176 unit tests and static/generated checks passed. First restricted browser attempt failed at loopback navigation (`ERR_NETWORK_ACCESS_DENIED`); permitted rerun passed. npm is absent from the bundled Windows runtime; build/unit/static entry points were invoked with Node directly.

Visual review: mobile dark rate-error capture in `C:/Users/이승종/AppData/Local/Temp/westbound-ledger-SyeQ8W/`; input, correction message and both actions fit. No physical-device claim.

## U3 — Ledger typography

Entry values now compute to 16px; labels to 13px. Settings/expense-edit values use 16px. Existing Pretendard, palette, layout and touch areas are retained. Ledger suite passed at 320/390/1440px in light/dark with long Korean descriptions and large amounts: computed sizes, 44px geometry, containment, navigation clearance and data retention. Build/static/diff checks passed. Visual review of the 320px ledger confirms readable values and contained controls (`westbound-ledger-Wuo4Pj`). Detector warnings refer to the existing timeline stripe and initially hidden viewer image; neither is a new ledger defect.

## T1 — Operation boundaries

43 focused factory tests passed for pending Undo/Redo, malformed import structure and rollback, refresh ordering, canceled/replaced imports and photo-resource comparison. Real browser import and input suites passed on desktop/mobile. Added photo-caption/alt inline-error regressions for empty/whitespace/repeated submit/correction/reopen in both themes. Rate boundaries are covered in the ledger suite. The existing full draft suite is included in final verification.

Remote inspection found `main` had advanced to `061584d` (U1/U2) while this older work branch remained at F5. Reconcile that implementation before final validation; do not replace its established rate semantics with the initial local approach above. The chronological U2 notes describe that preliminary commit, not the eventual merged behavior.
