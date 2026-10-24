# A · Daylight Discussion Handoff — 2026-10-21

## Starting point

User selected **A Daylight** for further discussion, not immediate production application or another concept-selection round. Last request was to save the necessary Markdown handoff and make a Git commit.

| Decision | Status |
|---|---|
| Goal | Commercial-quality UI from a fresh review |
| Baseline | A Daylight |
| Use | Equal desktop pretrip planning/budget editing and mobile travel lookup |
| Scale | Two travelers; reuse dependencies/patterns, low maintenance |
| Unresolved | A refinements, production scope/order, final tokens, edit/save/error layout |
| Unapproved suggestion | Combining A with C's three-day board was only a recommendation; A alone selected |

Not all copy/spacing/colors/sample states were finalized. Retain B/C history; A is the default direction.

## Screens/files

- [Public A](https://pca01008.github.io/us-west-2027-trip/ui-preview/a.html), [comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/), [local A](../ui-concepts/a.html).
- [Desktop](../ui-concepts/previews/a-desktop.png)/[mobile](../ui-concepts/previews/a-mobile.png), [ledger desktop](../ui-concepts/previews/a-desktop-ledger.png)/[mobile](../ui-concepts/previews/a-mobile-ledger.png).
- [Original review](2026-10-21-ui-concepts.md) owns original findings/differences/evidence.

Then-current root was production without A. `a.html` uses `data-concept="a"`; common `concepts.js` provides `scheduleA()`/sidebar render, `concepts.css` common/responsive styling. `data.js` is defaults, not latest shared state. Refresh captures after source changes; never edit generated `ui-preview/`. `scripts/build-ui-preview.mjs` copies browser files/images and adjusts relative paths. Follow [operations](../OPERATIONS.md#ui-concepts); remote users need HTTPS, not loopback.

## Proposed A structure and limits

Desktop left function menu/central date and daily plan/right accommodation-PREP summary. Compact mobile header/content-first/fixed bottom navigation. Sage/green/white/light separators reduce oversized headers/nested cards/shadows. Time/title/place immediately readable; cautions initially disclosed. Function/date navigation separate; clocks/tools secondary. This is a discussion direction without final DESIGN.md/tokens.

Then-available interactions: dates/menus/PREP checks/cautions/expense filters/maps; checks only page memory. Starts assumed January 25, 2027; times/next event/check status/three expenses/accommodation/copy include fixed examples. Editing/auth/server saves/versions/timetable/offline/export/dark were unwired, not removed features. Preserve actual [usage](../USER_GUIDE.md)/[internals](../PROJECT_GUIDE.md) on integration.

## Suggested next discussion

Review preferred/awkward typography/density/desktop helpers/mobile navigation; define pre/during/post-trip initial/date behavior without treating January 25 as specification; place viewing/editing/save/dirty/error/recovery tools; define PREP/ledger/timetable/photos/dark scope; consider C only if requested. For concrete implementation, plan against functioning app and define regressions, never replace root with prototype. These are suggestions, not additional requirements; handoff request covered document/commit only.

## Publication history

Baseline `1f60ab6` (`feat: publish UI concept comparison for remote access`). [Validate](https://github.com/pca01008/us-west-2027-trip/actions/runs/39570499042)/[Pages](https://github.com/pca01008/us-west-2027-trip/actions/runs/39570497716) succeeded. Public comparison/A/B/C/required JS-CSS/six images/accommodation returned200. Local desktop/mobile interactions/no-overflow360–1440px checked; original review owns limits. These results apply to that snapshot, not later changes. Handoff changed no production UI/config/data; inspect current Git before continuing.

Suggested next-session prompt: Read this handoff and continue A Daylight discussion, treating desktop planning/mobile lookup equally and reviewing refinements first.
