# October 28 review fixes

Implementation follow-up to the [review](2026-10-28-project-review.md). The review remains historical evidence of the original defects. Current trip stays schema 6/KRW/USD; no production document or SQL changes.

## Stage 1 — editor entry (F1/F2)

Authentication captures its requested purpose and generation. Cancel/Esc, replacement requests and sign-out invalidate pending entry; stale login/session/recovery/document continuations cannot resume it. SDK authentication may complete after cancellation, but the canceled action requires an explicit retry.

Windows, Node 24.22.1, locked Playwright 1.62.1/Chromium: real-SDK auth suite passed delayed login Cancel/Esc/replacement-purpose, delayed edit-start after SDK-only peer sign-out, stale document rejection, zero public writes, explicit retry, existing login failures/refresh/expiry/draft recovery/save. Full unit suite: 185/185. Source-shape assertions for the changed handlers were replaced by these behavioral cases. Generated output and project checks passed.

Physical phones and clean local Ubuntu 24.04 remain separate [validation prerequisites](../VALIDATION_TODO.md). Required Linux/SQL/engine checks will run on the release candidate in GitHub Actions before publication.

Additional Stage 1 regressions: drafts passed (139.0s/300s) and PREP passed (34.1s/180s), including deferred recovery, sign-out, uncertain saves and independent checklist writes.

## Stage 2 — links and accessibility (F3/U1/U2)

Map entry and imported links use the same HTTPS URL parser, requiring a hostname without restricting providers or losing queries/fragments. Failed entry leaves state/history unchanged. The read-only export runtime confines focus, isolates/restores the background, locks scroll and restores the photo trigger. Icon buttons have short Korean names and one pressed state, with in-place keyboard selection and preserved saved selection; existing custom icons remain selectable.

Windows Chromium input suite passed at desktop/mobile sizes, including malformed HTTPS hosts/ports, import sanitization, exact document/history retention, keyboard icon selection/reopening and network-blocked exported Enter/Space/Tab/Shift+Tab/Esc/Close. Imports (25.4s), photos (1.0s), ledger (35.5s) passed. [Unit evidence](2026-10-28-review-fixes/stage2-unit.txt): 185/185 passed. Generated/project/diff checks passed; the mechanical detector reported no findings in changed targets. Visual inspection: [export viewer](2026-10-28-review-fixes/mobile-readonly-viewer.png), [dark photo error](2026-10-28-review-fixes/mobile-dark-photo-error.png). The viewer uses the synthetic 1px photo; the empty center is fixture content.

Firefox and WebKit functional input/dialog/export suites also passed the new regressions on Windows. Chromium owns PNG evidence; physical screen readers/touch/IME and Linux engine results are distinct scopes.
