# UI Review and Selection Concepts — 2026-10-21

Historical local-default screens/proposals, not verification of shared data, actual expenses, or bookings.

## Request and findings

Provide three directions toward commercial-quality UI, equally supporting desktop planning/budget editing and mobile travel lookup. Production root/auth/save/draft/permission code stayed unchanged.

[Desktop](../ui-concepts/current-desktop.png)/[390×844 mobile](../ui-concepts/current-mobile.png) captured with outbound blocked, showing connection failure/default PREP. Mobile header occupied about490px; PREP title appeared after 700px. Functional PREP/ledger and11 dates shared one navigation level. Theme/clocks/dates/route/progress/tools crowded before content; heavy header/cards/shadows/borders/bold text weakened hierarchy.

## Three directions

| Concept | Structure | Palette | Tradeoff |
|---|---|---|---|
| A Daylight | Desktop left menu/central daily plan/right accommodation; mobile bottom navigation | Sage `#eff5f1`, green `#147161`, white | Balanced lookup/planning, restrained branding |
| B Postcard | Top menu/photo/trip introduction/daily plan; short mobile photo | Cobalt `#234dc5`, pale blue `#edf2ff`, white | Strong travel impression, more scroll to events |
| C Trip Desk | Desktop adjacent three-day comparison/mobile selected day/dark top menu | Charcoal `#25303d`, amber `#a34c23`, gray `#f3f4f6` | Planning-focused, less emotional |

All start January 25; differing navigation/content structure permits more than color comparison. No permanent DESIGN.md/token contract before selection.

## Behavior and data

[Comparison](../ui-concepts/index.html) supports navigation/dates/PREP checks/caution disclosure/expense filters. Checks remain page memory; map links are real external URLs. Default configuration snapshot, reused `assets/airbnb.webp`/existing SVG icons, no generated/downloaded photos. Time/next-event/check state/three expenses are samples. Editing/auth/save/version/offline/dark were unwired, not removed requirements.

## Historical validation

Chromium A/B/C1440×1000/390×844 navigation/check/filter/date passed; no page overflow360/390/768/1280/1440px, intentional date scrolling retained. Six basic screens had no JS errors; empty category/return checked. Fixed comparison low contrast/small type after machine review and visually inspected main/mobile views. Separate review found B's fixed-date button wording mismatched scroll; renamed Browse itinerary/recaptured and received resolved/ready-for-selection result. In-app browser loopback4174 displayed all options/links. These are concept tests, not real-device/full-accessibility/production-save certification.

See [procedures](../OPERATIONS.md#ui-concepts). Later integration must cover edits/save/error/recovery/timetable/offline/dark.

## Remote publication and selection

User could not reach loopback remotely, so `scripts/build-ui-preview.mjs` generates static `/ui-preview/` from retained `docs/ui-concepts/`, without touching production app/data. User selected **A Daylight** for further discussion. Preserve this preselection history; see [handoff](2026-10-21-daylight-handoff.md).
