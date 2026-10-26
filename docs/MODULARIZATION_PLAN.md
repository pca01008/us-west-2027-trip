# Modularization plan — October 25, 2026

This extraction is complete. The [October 26 ownership refactor](MODULARIZATION_REVIEW_PLAN.md) is implemented separately; see its [staged verification record](archive/2026-10-26-modularization-implementation.md).

## Goal and constraints

Make future edits smaller and travel reuse safer. Preserve the current navy/coral UI, existing US West data, draft keys, offline exports, PWA behavior, and shared Daylight compatibility. Use Node built-ins and the existing test tools; no framework or runtime module loader.

## Implementation

- [x] Extract editable HTML, CSS, palette, theme bootstrap, and app feature sources into `src/`. Generate the committed standalone `index.html` deterministically; check freshness in validation.
- [x] Separate current trip settings from initial itinerary data. Generate the existing `trip-config.js` entry point, preserving exports and test fixtures.
- [x] Isolate currency policy and exact arithmetic. Keep schema 6 KRW/USD behavior; support configurable currency pairs for new schema 7 trips with explicit currency metadata and mismatch rejection. Do not reinterpret existing expenses or migrate production documents.
- [x] Update the new-trip template and operations/source map. Exclude authoring sources from Pages. Keep current deployment entry points and cache assets.
- [x] Verify source assembly, existing unit/browser suites, new-trip currencies, round trips, and screenshot parity against the starting app. Use synthetic fixtures; no production data writes.
- [x] Review changes, commit and push, deploy through the existing `main` GitHub Pages workflow, verify CI and public bytes, then record the result.

## File boundaries

`src/index.html` owns the document and includes; `src/styles/` owns cascade layers and palette; `src/app/` owns configuration, timetable, drafts, ledger, state, editing, media, exports, versions, and startup. `src/trip/` owns current settings and initial days. `scripts/build-app.mjs` assembles sources without transforming behavior. Generated output stays self-contained for local previews and HTML exports.

## Validation and delivery

Run build freshness, `npm test`, full browser checks, palette before/after comparison, and focused reusable-currency checks. Verify deployed commit with Validate (including SQL) and Pages. Report the final source layout, compatibility boundaries, test results, commit, remote tracking state, and public URL in Korean. Dated results belong in `docs/archive/`.

## Initial state

Clean `codex/legacy-ui-refinement` at `502f4e5`; `origin/main` at `5b94bad`. The starting branch contains the approved current-palette refactor. Current app configuration remains schema 6; the stored document is checked separately during publication. No implementation has been applied at plan creation.

## Results

See the [implementation and verification record](archive/2026-10-25-modularization.md). The final source layout follows the planned boundaries without introducing runtime modules or a framework.
