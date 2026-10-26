# Review follow-up — 2026-10-27

Scope: U2 → U3 → T1 → T2 → T3 from the [October 26 review](2026-10-26-project-review.md). Starting commit: `ef4349f`; existing README/Operations/Cloud-guide/review changes were preserved. Current trip remains schema 6, KRW/USD.

## U2 — Rate validation

Settings rate input is buffered until Apply/Enter. Invalid text stays visible with an associated inline error and focus; Cancel/Escape discards only pending rate input. Nested category rendering preserves it. Positive rates allow up to six decimal places. Unchanged rates do not create mutations.

Verified on Windows, Node 24.22.1, installed Chrome, synthetic offline desktop/mobile fixtures: empty/zero/negative/nonnumeric/excess precision × pointer/Enter × both themes; Escape, correction, category rendering and explicit cancel. Ledger suite passed; 176 unit tests and static/generated checks passed. First restricted browser attempt failed at loopback navigation (`ERR_NETWORK_ACCESS_DENIED`); permitted rerun passed. npm is absent from the bundled Windows runtime; build/unit/static entry points were invoked with Node directly.

Visual review: mobile dark rate-error capture in `C:/Users/이승종/AppData/Local/Temp/westbound-ledger-SyeQ8W/`; input, correction message and both actions fit. No physical-device claim.
