# A · Daylight Session Handoff — 2026-10-22

## Resume point

**Prototype refinement/review only; production migration unapproved.** Continue from the published A and next user feedback, not another selection round or replacing root with a prototype. This supersedes the earlier handoff's current-state description: cautions are now persistent and timetable connected, while retaining that historical record.

User reviews remotely and cannot use loopback. Provide [public A](https://pca01008.github.io/us-west-2027-trip/ui-preview/a.html?v=22ecee3)/[comparison](https://pca01008.github.io/us-west-2027-trip/ui-preview/). Query `v=22ecee3` busts cache; it is not an immutable commit snapshot.

## Agreements

Preserve functionality/purpose; confirm unavoidable changes. User explicitly selected prototype-first review, not production deployment. Equal desktop planning/budget/mobile lookup, two-user proportional scope, existing patterns/dependencies. Keep sage/white/green and B/C history; C board integration unapproved. [Usage](../USER_GUIDE.md)/[internals](../PROJECT_GUIDE.md) remain authoritative.

## Completed prototype changes

PREP navigation uses a right arrow/Go to PREP. Settings grouped Editing and saving / Files / Display with icons/borders/emphasized edit entry. Cautions always visible. Timetable supports all/one, retained day/details/unspecified/other-zone/overnight. PREP button/menu/reselection scrolls0/focuses heading while preserving checks. Categories use text/color, desktop column/mobile subtitle with larger item/amount. Daily/timetable uses icons/underline; One/All uses a smaller pale range control.

Production pure time/category/overlap logic reused; desktop All/mobile One, date-heading entry, first-timed-event scroll, full details/photos/maps. Production/data unchanged. See [first refinement](2026-10-21-daylight-refinement.md)/[usability](2026-10-22-daylight-usability.md).

## Latest questions and unresolved decisions

User asked why a Las Vegas day shows LA accommodation and how PREP's priority/lodging blocks are selected. Explained: `lodgings()` hardcodes West Hollywood photo/address/map and is reused without date lookup; `prep()` hardcodes canyon-tour luggage/hotel-storage cautions without date/priority/completion logic. **Explanation only; selection behavior unchanged.** Date-aware lodging, removing cards, or incomplete-first behavior were not yet agreed. Follow user direction, not assumed automatic selection. Latest screen had no final design approval.

## Remaining limits/files

`data.js` is defaults, not shared state. January 25, 2027 starting screen/time/next event/checks/three expenses/city/lodging have fixed samples. Checks remain page memory without reload/server persistence. Settings edit/save/version/import/export/theme remain disabled layout controls; auth/drafts/offline/dark unwired. Timetable integration does not imply complete operational integration.

Root remained production/pure timetable source. A entry loads common plus `daylight.js`/`.css`; concepts.js owns render/tabs/date/lodgings/prep/ledger/scroll. Common concepts.css also affects B/C. prepare-data extracts display/icons/timetable; data.js/timetable-core are generated. capture.mjs/previews own checks/images. build-ui-preview copies11 browser files/six images/relative paths; never edit generated ui-preview. See [procedures](../OPERATIONS.md#ui-concepts). Node available; npm previously absent. Recheck cache `C:/Users/이승종/AppData/Local/ms-playwright` in the next environment.

## Historical Git/deployment/validation

Immediately before handoff, main/origin-main=`22ecee308d3019cf6303a3d464013ea7172e4d6c`, clean tree. This handoff/navigation edits were not yet committed; recheck Git.

`22ecee3` implemented scrolling/categories/switches. [Pages](https://github.com/pca01008/us-west-2027-trip/actions/runs/39702138785) succeeded; [Validate](https://github.com/pca01008/us-west-2027-trip/actions/runs/39702138788) was **in_progress** when recorded, not confirmed success.

Local A/B/C desktop/mobile nav/check/filter/date passed. A PREP scroll/focus/check retention/category visibility/keyboard timetable/date/details/zones checked. No overflow360/390/768/1280/1440px; captures/static/JS syntax/whitespace/Impeccable passed. Public concepts.js/daylight.js/daylight.css matched generated local files; public 1440/390 interactions/no script errors verified.114-unit pass belonged to first refinement, not rerun for this usability change. Historical evidence does not certify later changes. Follow [Git rules](../../AGENTS.md).

Suggested continuation: read this handoff, retain production/purpose/features, use next feedback to refine A, and provide public preview for remote review.
