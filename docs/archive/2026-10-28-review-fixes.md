# October 28 review fixes

Implementation follow-up to the [review](2026-10-28-project-review.md). The review remains historical evidence of the original defects. Current trip stays schema 6/KRW/USD; no production document or SQL changes.

## Stage 1 — editor entry (F1/F2)

Authentication captures its requested purpose and generation. Cancel/Esc, replacement requests and sign-out invalidate pending entry; stale login/session/recovery/document continuations cannot resume it. SDK authentication may complete after cancellation, but the canceled action requires an explicit retry.

Windows, Node 24.22.1, locked Playwright 1.62.1/Chromium: real-SDK auth suite passed delayed login Cancel/Esc/replacement-purpose, delayed edit-start after SDK-only peer sign-out, stale document rejection, zero public writes, explicit retry, existing login failures/refresh/expiry/draft recovery/save. Full unit suite: 185/185. Source-shape assertions for the changed handlers were replaced by these behavioral cases. Generated output and project checks passed.

Physical phones and clean local Ubuntu 24.04 remain separate [validation prerequisites](../VALIDATION_TODO.md). Required Linux/SQL/engine checks will run on the release candidate in GitHub Actions before publication.

Additional Stage 1 regressions: drafts passed (139.0s/300s) and PREP passed (34.1s/180s), including deferred recovery, sign-out, uncertain saves and independent checklist writes.
