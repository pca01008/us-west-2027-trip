# A · Daylight Prototype Refinement — 2026-10-21

## Authorization

User requested clearer PREP navigation/settings, always-visible cautions, and existing timetable while preserving functionality/purpose. Confirmed scope: **refine/review A prototype first**; confirm unavoidable purpose/function changes. Production root/auth/save/recovery/shared data untouched; B/C retained. [Initial handoff](2026-10-21-daylight-handoff.md) describes the earlier unwired state; timetable was added afterward.

## Changes

- Go to PREP plus right arrow communicates navigation.
- Settings groups Editing and saving / Files / Display, emphasized edit entry, icons/borders/spacing. Disabled before real integration and labeled layout preview.
- Caution heading/list always visible.
- Daily/timetable and all/one-day controls, desktop All/mobile One defaults, selected-date retention; date heading opens One day.
- Reuse production time/category/overlap logic; no inferred end. Unspecified/all-day/other-zone events above grid; overnight continuation. Details retain notes/cautions/maps/photos; One day includes stay/transport summary.
- Wide overview compresses the axis; small screens scroll internally. One day starts near first timed event.

A-only `daylight.css`/`daylight.js` are used by the common renderer only for A. `timetable-core.js` is generated from production; never hand-edit. See [operations](../OPERATIONS.md#ui-concepts).

[A prototype](../ui-concepts/a.html); [desktop](../ui-concepts/previews/a-desktop.png), [mobile](../ui-concepts/previews/a-mobile.png), [settings](../ui-concepts/previews/a-desktop-settings.png), [all days](../ui-concepts/previews/a-desktop-timetable.png), [mobile one day](../ui-concepts/previews/a-mobile-timetable-day.png).

## Verification

Chromium A/B/C desktop/mobile navigation/check/filter/date passed. A additionally passed settings close/range defaults/switching/KST separation/details/Esc/focus/date/data immutability. No page overflow360/390/768/1280/1440px, including A settings/timetable. Updated/visually inspected desktop/mobile/settings/range captures; Impeccable returned an empty finding list.114 units/static/whitespace passed; npm absent, ran its component commands directly.

No real shared data/login/save/offline editing/dark-theme validation in this prototype. Those functions remain required for later integration. Unchanged production usage/internals needed no behavioral update.
