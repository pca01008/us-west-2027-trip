# A · Daylight Usability Refinement — 2026-10-22

User asked about lodging/caution selection and requested PREP top scrolling, visible expense categories, and clearer timetable switches. Scope remained A prototype only; production root/shared data/B-C behavior unchanged.

## Fixed examples explained

`lodgings()` hardcodes LA photo/name/itinerary/map for both schedule/PREP without date filtering, so it appears on Las Vegas dates. `prep()` manually includes canyon luggage/hotel-storage warnings without completion/date-based priority. Selection was explained only; no automatic selection/travel edits. [Operations](../OPERATIONS.md#ui-concepts) records limits.

## Changes

- PREP navigation button/menu/reselection scrolls to0/focuses heading; check state survives.
- Categories retain desktop column, appear below names on mobile, and use text/color; item/amount type enlarged.
- Daily/timetable uses icon/underline; One/All uses a smaller pale control. Existing selection/date/keyboard behavior retained.

## Verification

`node docs/ui-concepts/capture.mjs` passed Chromium A/B/C desktop/mobile navigation/check/filter/date. Added PREP entry/reselection scroll/focus/check, categories/filter, keyboard timetable assertions. No overflow360/390/768/1280/1440px; A category visibility checked. Desktop/mobile ledger/timetable captures visually reviewed; Impeccable findings empty. Production usage/internals unchanged; generation/capture/deployment remain in operations.
