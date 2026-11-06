# November 6 review follow-up

Implementation of the [November 6 review](2026-11-06-project-review.md). The release targets schema 6 with KRW/USD. Tests use synthetic fixtures and the production check uses public reads.

## Staged changes

| Stage | Commit | Result |
|---|---|---|
| 1 | `789809f` | F2/F3 and T1. Editor entry uses the same revision adoption rule as refresh and Realtime. Late PREP reads cannot reopen after logout, expiry, or a newer request. |
| 2 | `df0ec37` | F1/T2. Undated expenses stay undated during edit/import/export. Duplicate ID repair reserves existing normalized IDs and is idempotent. |
| 3 | `81f2446` | U1/U2/U3. Totals precede the form in reading order, the phone form is shorter, important text is larger, and import warns about draft replacement with a backup action. Both travelers approved the UI direction. |
| 4 | `d371759` | U4/T3. Reuse the input snapshot for immediate draft protection, cache private comparison keys, and rely on behavioral import/recovery regressions. |

The import backup closes the comparison and downloads the current draft as an editable offline file. Select the incoming file again after exporting. Totals lead on desktop as well, keeping visual and document order aligned.

## Photo-heavy editing

Windows, Node 24.22.1, Chromium 151.0.7922.34, 390×844. The same profiler used 32 events and zero or eight synthetic JPEGs plus thumbnails. Eight staged photos produced 9.16 MiB. Input, flush, and history are medians of five samples. Undo and redo are single samples. All cases confirmed the measured edits reached draft storage and undo/redo returned the expected text.

| CPU / photos | Input before → after | Flush before → after | History before → after |
|---|---:|---:|---:|
| 1× / 0 | 9.7 → 4.7 ms | 10.0 → 9.4 ms | 7.7 → 2.9 ms |
| 1× / 8 | 709.5 → 176.9 ms | 571.4 → 318.1 ms | 466.4 → 137.9 ms |
| 4× / 0 | 47.8 → 25.1 ms | 45.7 → 40.2 ms | 34.5 → 19.9 ms |
| 4× / 8 | 2709.4 → 864.4 ms | 2183.6 → 1449.7 ms | 1743.7 → 597.1 ms |

In the 4× eight-photo case, redo took 2975.3 ms in the follow-up versus 2316.7 ms in the audit. Single undo/redo samples varied. Large photo-heavy operations remain costly. The checkpoint and IndexedDB write paths retain immediate protection and the existing draft format.

## UI check

- Accessibility: browser tests covered keyboard focus and dialog cancellation. Ledger totals and form follow the same DOM and visual order. The sampled rate date passes 4.5:1 in both themes at 320 and 390px. Ledger metadata uses 12px and itinerary descriptions use 14px at default text size.
- Performance: the same synthetic input workload took 68–75% less synchronous input time with staged photos. Rendering a full photo-heavy undo or redo is still expensive.
- Theming: checked light/dark with existing navy/coral roles and focus treatment.
- Responsive layout: Chromium verified totals above the bottom navigation at 320 and 390px, draft form input preservation in a reduced-height viewport, and navigation/ledger geometry from 320 to 1920px and at 200% zoom.
- Integrity: the Impeccable scan repeated four existing itinerary accents and the photo viewer image whose source is assigned on open. No new finding. The sample still rates 15/20 under the baseline rubric, with physical-device and assistive-technology checks outside this run.

## Final local verification

Windows verification completed on November 7, 2026 (KST) against application commit `d371759`.

- Generated build freshness, project integrity, documentation links, and Git whitespace checks passed.
- Node 24.22.1: 195/195 unit and static tests passed.
- Playwright 1.62.1: 16/16 Chromium suites and 6/6 Firefox/WebKit functional groups passed. The longest Chromium suite was drafts at 211.9s of its 300s deadline. All suites stayed below the timing warning threshold.
- WebKit exercised theme selection through the keyboard. Chromium covered the visual checks.

The [checkpoint](../REVIEW_2026-11-06_PROGRESS.md) identifies the local logs.

## Release

GitHub Actions runs required validation with Ubuntu 24.04, the pinned Node/npm and Playwright versions, and disposable PostgreSQL 17. Local WSL uses Ubuntu 26.04 and a different Node/npm, with no configured disposable PostgreSQL URL. Virtual keyboards, photo pickers, and installed PWA behavior on both travelers' phones are tracked in the [validation backlog](../VALIDATION_TODO.md).
