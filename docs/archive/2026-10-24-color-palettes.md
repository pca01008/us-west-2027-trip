# Color Palette Proposals

Date: 2026-10-24 (Asia/Seoul). Three unselected color mockups for the current legacy app; no production palette change or deployment.

Decision on 2026-10-25: retain the current public site's palette, not A/B/C. These previews remain historical alternatives. See [the current-palette record](2026-10-25-current-palette.md) and [maintained color roles](../PROJECT_GUIDE.md#color-palette).

| Proposal | Header | Action | Canvas | Direction |
|---|---|---|---|---|
| A: Navy & Coral | `#17324D` | `#B34738` | `#F6F3EF` | Familiar, warm, clear |
| B: Forest & Sand | `#183E36` | `#2D6754` | `#F1F4EE` | Calm, natural; sand highlights |
| C: Plum & Rose | `#49344E` | `#A33F65` | `#F8F2F5` | Soft, personal; rose highlights |

[Comparison](../ui-concepts/palettes-2026-10-24/index.html) preserves current local layout, icons, typography and itinerary content. It supports mobile/desktop framing, itinerary/PREP/ledger navigation and light/dark previews. Each proposal also opens separately. Full role tokens, including authored dark palettes, are in `palettes.json` and `palettes.css` beside the comparison.

The build renders the current local `index.html` with local trip configuration. Supabase credentials and the editor email are removed from the render configuration; remote requests and service workers are blocked. Generated pages strip application scripts and retain only local preview navigation/theme code. Editing, authentication and saving are not connected. Ledger totals are labeled sample values. Mockups do not represent the latest shared itinerary.

Validation: browser render at 390×1050 and 1440×1100; no horizontal document overflow; itinerary/PREP/ledger selection and theme switching pass for all three. Comparison controls synchronize all previews; the comparison has no document overflow at 320/390/768/1440px. Primary text tokens (body, secondary and action text) meet 4.5:1 in both themes; ratios are in `contrast.json`. The mechanical design detector reported no findings for the authored gallery/styles. Images are stored in the adjacent `images/` folder. This is preview validation, not a full application regression or accessibility audit. Existing uncommitted application/font changes were preserved.

For local serving and rebuilding, see [operations](../OPERATIONS.md#color-palettes). The existing Pages exclusion for `docs/` also covers these proposals.
