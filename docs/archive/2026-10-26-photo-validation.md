# Photo metadata validation — 2026-10-26

Fixes U1 from the October 26 project review. Blank photo descriptions or alt text previously left the active dialog without visible feedback.

## Behavior

- Reuse `setFieldError` for visible per-field alerts, `aria-describedby`, and `aria-invalid`.
- Apply validates trimmed values and focuses the first invalid field without changing the document.
- Typing clears that field's error; reopening clears stale errors and restores saved values.
- Valid submissions retain trimmed caption/alt text, viewer labeling, history, and trigger focus.

The current app's palette, styles, schema, storage, and photo upload behavior are unchanged. Rebuilt `index.html` from `src/`.

## Verification

The added browser regression failed on the previous generated app at the first invalid-field focus assertion, then passed after the fix.

- Build freshness, all **176 unit tests**, and project checks passed.
- Input browser suite passed at 390px and 1440px in light/dark themes. Coverage: each field empty or whitespace-only, both invalid, repeated Apply, error association/visibility/viewport bounds, input/document retention, independent correction, valid trimmed metadata, and Escape/Cancel/reopen/reset/focus.
- Reviewed mobile light/dark error screenshots from the synthetic browser fixture.
- All **16 browser suites** passed. The full runner initially passed 14; `ledger-compat` and `auth` could not locate dependencies in the new worktree. Both passed individually after linking existing packages (Playwright 1.62.1 and the project's pinned Supabase SDK). No application/test changes were needed for those retries.
- Impeccable detector reported one existing warning for the image viewer's runtime-assigned `src`; the viewer receives its image before opening. No new finding was introduced.

Environment: Windows, Node 24.22.1, Playwright with installed Chrome. Tests use isolated synthetic trips and block production requests. Physical devices and assistive technology were not exercised. Exact-commit Actions and public HTML checks provide separate deployment verification.
