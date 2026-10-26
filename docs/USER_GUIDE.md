# User Guide

This guide owns traveler procedures. See [operations](OPERATIONS.md) for server setup and tests, and the [project guide](PROJECT_GUIDE.md) for internals. Control names below describe the app's Korean labels in English.

<a id="planning-policy"></a>

## Trip data policy

The shared document saved in the app is the source of truth for an active trip's confirmed information.

| Information | Where to maintain it |
|---|---|
| Confirmed itinerary, times, places | App itinerary |
| Packing, tasks, completion | App PREP |
| Actual expenses | App ledger |
| Candidate routes, accommodation, attractions, estimated costs | Trip folder in `planning` |
| Booking confirmations, references, decision/change reasons | Trip folder in `planning` |

Edit and save confirmed plans in the app. Keep supporting evidence in `planning`; avoid duplicate full itineraries or actual-spending records. For example, update accommodation and itinerary in the app, then retain the new confirmation and change reason in `planning`.

The app is publicly readable. Keep original confirmations and personal information in `planning`; enter only shareable travel/check-in information. See [planning transition](OPERATIONS.md#planning-transition) for existing files.

## Screens and navigation

These instructions describe this branch's existing-app refinement. See the [implementation record](archive/2026-10-24-legacy-ui-refinement.md) for publication status and validation limits. Further Daylight development and production migration are paused.

<a id="shared-daylight"></a>

The [existing app](https://pca01008.github.io/us-west-2027-trip/) and [Daylight](https://pca01008.github.io/us-west-2027-trip/daylight/) share actual trip data and editor accounts. Saved itineraries, checks, expenses, and photos appear in both. Unsaved drafts and display preferences are separate. Authentication is shared in the same browser, so signing out of one affects the other.

Before first using both, close browser/installed-app windows and reopen online. The existing app also needs the metadata-preserving update. Resolve concurrent edits by checking the latest document and saving again. `ui-preview` examples do not connect to actual data.

Viewing requires no login; editing requires a designated Supabase editor account. Login distinguishes password errors from server connection failures. Retry later after connection failures; failed login does not delete drafts.

- Choose itinerary, PREP, or ledger in the fixed left sidebar on desktop (1024px and wider), or bottom navigation on smaller screens.
- The initial screen uses the device date: PREP before travel, that day's itinerary during travel, ledger afterward.
- Date selection and daily itinerary/timetable controls appear only in itinerary. Selected day/view survive menu changes in the current session. Opening itinerary before/after travel initially selects day one. Date tabs support arrows, Home, and End.
- Navigation preserves edits and expense inputs. Clock/shared-document updates preserve the selected menu/day.
- The header shows Seoul and US West clocks with an automatic offset. Existing toolbar controls handle editing, saving, versions, importing, and exporting.

## Editing, drafts, and sign-out

Start editing enables itinerary edits. Finishing with changes offers Save and exit, Continue editing, or Discard changes. Reset restores the last saved state.

- Itinerary/ledger edits remain in tab-specific browser drafts until explicitly saved publicly. Text edits are protected immediately, including before undo history updates. Recovery is offered after refresh/tab closure when signed in; otherwise start editing and sign in first. Esc defers recovery and keeps the draft; Delete draft removes it. Deferred drafts must be recovered/deleted before new editing. Other tabs' drafts are not overwritten/deleted. Undoing all changes removes the recovery draft.
- Editing supports undo/redo.
- Cross-tab sign-out or expired authentication preserves this tab's draft and shows the last saved state. Sign in and recover/delete the draft before editing/importing. Dismissing recovery retains the draft without starting new work.
- Authentication persists after editing. Manual/automatic sign-out affects the current browser session and synchronizes across its tabs. A warning appears after 29 idle minutes; automatic sign-out occurs at 30. Drafts remain recoverable unless Discard and sign out is explicitly selected.
- After photo upload, a shared-document save without a response within 12 seconds is canceled and the latest document is fetched. Verified saves complete; otherwise the draft remains. Check connectivity and retry, resolving conflicts when needed.

If someone saves first, compare the latest document and draft before reapplying. Drafts are not backups across devices. Save important changes or export an offline working copy.

Draft-storage failure means recent edits may exist only in the current tab. Save to the server or export before refreshing/closing. Editing again retries storage after the issue is resolved; refresh recovers only the last successfully stored draft. Draft-deletion failure prevents discard and discard/sign-out from completing: check storage and retry. Server saving may succeed while old local-draft cleanup fails. Offline saves do not report success when browser storage fails; Export can still retain the current content in a file.

## PREP checklist

- Toggle completion in view mode. Authentication precedes immediate public saving. Completed items move into the completed group; unchecked items move to the top of the incomplete group. Rejected saves restore the original state and offer Retry.
- Edit list adds/edits/deletes items and reorders with up/down buttons. Dialog Save updates the server immediately. New items start incomplete; Cancel/Esc discards list edits. Checklist saves do not publish other itinerary/ledger drafts.
- Offline completion/list edits save in the current browser. Import the working copy and save online to publish them.
- Checklist saving remains available with deferred draft recovery. The deferred draft remains recoverable after refresh.
- After a timeout or lost response, the app checks the latest document. Verified changes show Saved; otherwise Save result needs checking keeps the last confirmed checkbox or entered list edits. Reconnect and Retry; an already reflected operation creates no extra version. Other drafts remain private.

## Itinerary and time input

- Events form a timeline of times, lines, markers, and cards. Editing supports per-event photos and HTTPS map links.
- Type into new title, location/note, and caution fields without deleting placeholders. Placeholders are not saved. Viewing shows Untitled for an empty title and hides empty notes/cautions. Existing text remains. Textual time labels and photo captions are selected on opening their editor for replacement.
- Add event time or Set time in daily-itinerary editing opens start and optional end inputs. Enter four digits over the faded `09:00`; the colon is skipped. All four digits are required because the example is not a value. Empty end means start-only; both empty mean unspecified. Overwrite digits/selected positions; deleting restores placeholders. Textual mode supports morning, afternoon, unspecified, etc. Time-zone labels such as KST remain separate and apply to both ends. End before start means next day. Cancel leaves the event unchanged; applied edits support undo/redo.
- Event category defaults to Auto using title/secondary tags. Manually select sightseeing, food, transport, accommodation, rest, or other to override category/color. Manual selection survives title changes; Auto reclassifies the current title. Categories survive saving, recovery, undo/redo, and offline copies, and appear in version/import comparisons.

## Timetable

- Timetable is a read-only date-by-time view of the loaded itinerary. Desktop defaults to All days; mobile to One day. Date navigation works in One day and retains its date after visiting All days. Selecting an event opens its original description, cautions, photos, and maps.
- All days shows every date column and the time axis. Wide screens compress the overview into one screen; at 800px or narrower, readable columns scroll horizontally with a fixed left time axis. Names/times remain visible. Unspecified, all-day, and other-zone events appear above with sample names/counts. Select events for details or date headings for One day.
- Dashed cards have start-only times; no duration is inferred. Only explicit ranges such as `09:00~11:00` scale with duration. Overlaps appear side by side; overnight ranges continue on the next date.
- Morning, unspecified, all-day, and non-destination-zone events such as KST stay above the grid with original labels. Automatic title/tag categories refresh on opening: sightseeing green, food orange, transport blue, accommodation/rest purple, other gray. Generic titles or bare place names may remain Other. One day summarizes registered check-in/stays and transport; missing transport duration is unspecified.
- Timetable/date navigation changes neither trip data nor drafts. Edit in daily itinerary. Print/share uses daily layout; offline working copies also support timetable.

## Photos and maps

- Maps store a place name and HTTPS URL. Missing names or invalid links show an error beside the input and focus the field. Links remain visible offline; opening them needs internet.
- Photo count is unlimited. New photos stay in drafts until final save. Uploads use WebP at up to 1600px full size/480px thumbnails, with JPEG fallback if WebP encoding is unsupported. Compressed files must be at most 5MB; thumbnails load lazily. Select original files up to 20MB each.
- Existence checks time out after 10 seconds; uploads/export downloads after 60 seconds per request. Cancel operation aborts photo requests. Failure/cancellation preserves the draft. Offline export fails if required photos cannot download; print/share falls back to their online URLs.
- Document deletion does not immediately delete stored photo files, allowing earlier-version restoration.

## Ledger

The current trip uses KRW/USD. Other trips may show a different configured pair; inputs, totals and exports use those currencies and their decimal precision. The manual rate always means one unit of the second currency in the first currency. A currency-mismatch message requires restoring the trip configuration; existing expenses are never relabeled automatically.

- Enter date, category, description, KRW, and USD. KRW uses integers; USD allows two decimals; thousands separators are accepted. Actual changes require authentication and remain private until Save changes.
- One entered amount automatically calculates the other with the manual exchange rate and displays a hint. Editing the calculated value makes both manual and removes the hint. Manual pairs retain their values even when their ratio differs from the configured rate.
- Clear one manual amount to calculate from the remaining value. Clearing an automatic pair's source clears both; clearing only its result restores the calculation.
- Manual amounts must be positive. Calculated results may round to zero. Correct invalid input before adding.
- Remote saving, app resume, and reconnection preserve unadded input/cursor position. Deleted categories fall back to available ones. Input has no draft protection until Add.
- Ledger settings manages the manual rate and categories. Category deletion moves its expenses to Deleted category. Empty category names or expense descriptions in editing dialogs show an error beside the input; correct the field and apply again.
- KRW totals sum every expense's KRW amount; USD totals sum every USD amount. These express the same spending; do not add them together. Category totals follow the same rule. KRW totals no longer count only original KRW entries. Budget controls and expense filters are absent.
- Expense rows and category totals display KRW (USD), with the second amount in teal. Currency symbols and parentheses distinguish the amounts in both themes and print; automatic-calculation labels remain beside the relevant amount.
- CSV exports all entries, including unsaved changes, in screen order. Columns: date, description, category, KRW amount, USD amount, calculated currency, applied exchange rate. The last two are empty for manual pairs. Empty ledgers export headers only.
- Rates affect **new calculations only**. Added amounts stay fixed. Editing name/date/category preserves amounts and the applied rate; amount edits recalculate with the current rate. If the entry changes remotely during editing, cancel and inspect the latest entry.
- Remote rate changes update only automatic results in unadded input; manual pairs remain unchanged.
- Legacy entries receive the opposite amount once using the document rate as the **conversion baseline**. An initial notice explains differences from the previous KRW-equivalent total. Historical transaction rates are not reconstructed. Missing/invalid rates produce a default-rate notice.
- Legacy precision, including fractional KRW, survives until amount editing. KRW display rounds while CSV preserves source precision, so displayed sums can differ from CSV totals.
- Reorder with up/down buttons, then save. Deletion requires confirmation.

## Versions and restoration

Up to 50 saved versions retain notes. Version management fetches metadata first and loads only selected content for compare/preview/restore. Preview blocks editing and normal saving while retaining the original draft. Publishing historical content requires Restore confirmation.

Version, import and save-conflict comparisons show an event's old date → new date when it moves between days, including moves that preserve overall order.

Closing version management or signing out cancels pending loads; selecting another version supersedes the previous selection. Failed or timed-out loads show a message in the version dialog. Select the version again to retry; for a failed list, close and reopen version management.

Undo is temporary editing history; versions are server history. Restore saves the selected past content as a new version.

## Offline working copies and print/share copies

- Export offers Offline working copy and Print/share copy.
- Offline copies embed photos and support editing without internet. Above 100MB, a warning precedes download.
- Saving offline downloads a new working copy. Online Import edited copy compares against the latest public document. Applying creates a draft; separate Save publishes it.
- Wrong-trip, corrupt, and unsupported files are rejected without replacing the current draft. Old copies retain itinerary/checks. Shared changes during comparison require reviewing refreshed differences before applying.
- Print/share copies are read-only snapshots without editor tools or Supabase. Photos embed when possible; remaining online photos/map links need internet.
- The existing app preserves Daylight importance flags/stay ranges during save/import but has no dedicated editor for them. Comparisons show missing metadata in old files/versions.
- Print/share removes main navigation and its reserved space, date/theme/CSV controls, and shows PREP, itinerary, and expenses sequentially. Offline copies retain responsive navigation/theme menus.

## Installation and offline use

Install from HTTPS for the configured name/icon and standalone mode in supported browsers.

- Android Chrome: menu → Add to Home screen → Install; names vary by version.
- iPhone Safari: Share → Add to Home Screen; enable Open as Web App if offered.
- First open online and wait for the page/latest shared document. Installation alone does not retain all photos offline.
- Static UI/configuration uses network first, falling back to cache on failure/after four seconds. Shared reads time out after eight seconds and fall back to IndexedDB public cache with saved time, or clearly identified defaults if no cache exists.
- The service worker excludes Supabase authentication, itinerary API, and photo Storage. Login, server saves, external maps, and uploaded photos need internet. Export an offline copy for reliable photo retention.
- Normal reconnection synchronizes. If startup could not load the SDK, reopen/refresh after reconnecting.
- Browser cleanup can remove caches; they are not permanent backups.

## Theme

Open Theme at the header's right and select Light (default), Dark, or Device setting without login. Device setting follows live `prefers-color-scheme` changes.

- Selection applies immediately and closes the menu. Reclick, outside click, or Esc also closes it. Keyboard selection/Esc returns focus to Theme; Tab leaving the menu keeps its new focus.
- Preferences use browser localStorage key `westbound:theme:<path>` per deployment directory. Chrome/Samsung Internet do not share them. They are excluded from trip data, drafts, shared saves, and versions.
- Blocked/full storage leaves a notice outside the menu and applies the choice only this session. Site-data deletion restores the default.
- Embedded bootstrap/CSS supports offline use. Editable exports keep theme functionality/original deployment path, excluding the author's preference. `file://` persistence depends on browser local-file storage support.
- Print/share and printing use light colors; print/share removes theme controls.
- Samsung Internet forced dark mode may transform site colors. Light mode declares `color-scheme: only light` but cannot disable/reliably detect browser transformation. If colors differ, disable forced web-content darkening under Samsung Internet webpage/scroll and dark-mode settings, then reopen. Names vary by browser version.

Reopen online after deployment to update. Closing all app windows and reopening also activates waiting service workers. Avoid forced refresh with unsaved edits.

## Troubleshooting

See [troubleshooting](OPERATIONS.md#troubleshooting) for saving, upload, and refresh issues. If save status is uncertain, retain the draft and follow the screen message.
