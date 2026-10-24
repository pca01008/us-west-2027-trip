# Modularization — October 25, 2026

## Implementation

The [plan](../MODULARIZATION_PLAN.md) started at `502f4e5`; production was `5b94bad`. The current navy/coral palette from the starting branch is preserved.

- Editable source lives in `src/`: HTML, theme, ordered CSS layers/palette, feature JavaScript, trip settings and initial itinerary. `scripts/build-app.mjs` uses Node built-ins only and produces the existing standalone entry points. No new runtime requests/assets or dependency changes.
- `npm test`/`npm run check` reject stale generated files. Pages excludes authoring `src/`. The source map and reuse procedure are in the project and operations guides; AGENTS.md directs future edits to source.
- Currency policy and exact arithmetic are isolated. Current US West remains schema 6/KRW/USD with unchanged draft identity/state fields. New trips use schema 7 with explicit base/quote codes, currency precision, matching UI/CSV/export labels, and read/write blocking on mismatched data. The template uses KRW/JPY. Existing production data and Daylight files are untouched; no SQL migration is required.

## Local validation

- Node 24.22.1, Windows, installed Playwright Chromium.
- Build freshness and project/configuration checks passed; unit tests: **123 passed**.
- Full existing browser runner: **14 suites passed** (diagnostics, drafts, storage, inputs, imports, ledger, ledger compatibility, PREP, auth, photos, theme, palette, navigation, PWA).
- New currency suite passed separately and is included in the updated 15-suite runner. KRW/JPY and EUR/USD: actual entry/conversion, IndexedDB draft reload, CSV currency codes, editable and read-only HTML exports/reopening, metadata retention, and wrong-currency write blocking. Unit coverage includes three-decimal KWD and invalid/missing currency metadata.
- Palette comparison against `502f4e5`: **24 scenarios with identical computed styles and PNG bytes**, covering 390/1440 px, both themes, itinerary/PREP/ledger/timetable/print. No appearance change was intended.
- Root and subpath PWA installation, offline reload and online refresh passed. Tests use synthetic fixtures and block external requests; no production edits or saves.
- Initial sandboxed HTTP unit tests were blocked by network restrictions. The authorized local-server run passed all tests. The new suite's first run exposed a diagnostic cleanup call error; fixing that call produced a clean successful rerun.

Ignored local logs and parity images: `node_modules/.cache/modularization/`. Export fixtures and browser traces are OS temporary files. These results are Chromium/emulation evidence, not physical-device testing.

## Deployment

Pending commit, remote CI and GitHub Pages verification at the time of this record's initial commit. Final publication evidence will be added after verification.
