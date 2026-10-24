# Current-Site Palette Maintenance

Decision: 2026-10-25 (Asia/Seoul). Retain the current public site's navy/coral colors; do not adopt proposal A, B or C.

## Implementation

Before editing, the local `trip-app-styles` CSS matched the public site at `https://pca01008.github.io/us-west-2027-trip/` after LF normalization. Existing uncommitted proposal documentation/files were preserved.

The marked palette block in `index.html` now owns the current light/dark role values, including header composition, ledger totals and timetable categories. Earlier root color overrides were removed. Role names (`--canvas`, `--heading-ink`, `--timeline-accent`) have compatibility aliases for existing components. Header/total/category rules consume the centralized values. Warning/error roles remain separate from brand choices.

The stylesheet stays inline, preserving standalone HTML exports and existing worker assets. No palette selector, dependency, schema/data/save change, worker-version bump, commit, push or deployment was introduced. Browser/install chrome metadata remains separate from CSS roles.

[Project guide](../PROJECT_GUIDE.md#color-palette) owns color-role rules; [operations](../OPERATIONS.md#palette-maintenance) owns the maintenance workflow. Historical A/B/C previews remain under `docs/ui-concepts/` and are explicitly unselected. `PRODUCT.md` records this decision; `README.md` links to the maintained guides. No user-guide change is needed because visible behavior is unchanged. Existing `docs/` and `PRODUCT.md` Pages exclusions still apply.

## Verification

- All 121 unit tests and `scripts/check-project.mjs` passed. The unit command was run directly with Node because this shell had no `npm` command; localhost-dependent tests required permitted normal execution. Documentation links and `git diff --check` passed.
- `scripts/check-palette-browser.mjs` compared saved pre-change HTML against the refactor using synthetic fixtures, blocked remote requests, fixed time and reduced motion. All 24 scenarios had identical computed styles (including pseudo-elements) and exact PNG bytes: 390/1440px × light/dark × itinerary/PREP/ledger/one-day timetable/full timetable/print. No horizontal document overflow. Images/results are local verification artifacts, not production itinerary captures.
- `scripts/check-theme-browser.mjs` passed preference persistence, tab sync, system/blocked storage, editing/dirty-state preservation, dialogs, editable/read-only exports, print and 320/390/768/1440px layout. The initial sandbox run could not access localhost; the permitted normal run passed.
- Theme unit contrast checks now read actual CSS role values for body, secondary text, actions, warnings, links and danger controls in both themes. They do not certify every UI pairing.
- The mechanical design detector reported inherited static-scaffold contrast, small-text, glow, empty-image, kicker and timetable-stripe findings. Its static header/background assumptions do not replace browser rendering. This task preserves the existing appearance; it is not a redesign or a full accessibility audit.

The palette browser check is included in the shared browser runner. `PALETTE_BASELINE_HTML` enables the stricter before/after comparison; without it the check renders the current palette and checks overflow/aliases. `PALETTE_OUTPUT_DIR` optionally retains screenshots/results in a chosen directory. No production API/auth/data writes were used.
