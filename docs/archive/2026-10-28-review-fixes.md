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

## Stage 3 — documentation and measurement (D1/I3)

README now identifies validated main commits and Actions publication, linking Operations. I1 (mobile framing) and I2 (unadded expense buffering) remain optional product changes and were not implemented. The existing visual direction, save policy and dependencies are retained.

The optional `profile-editing-browser.mjs` measures synthetic offline input/capture/fingerprint/durability/history/undo/redo. [Raw baseline](2026-10-28-review-fixes/photo-profile.json), app source `01a29af`, Windows Node 24.22.1/Chromium 151.0.7922.34, 32 events, 390×844. Eight generated 1600×1000 JPEGs plus thumbnails produce a 9.16 MiB serialized state. CPU rate 4x is deliberate throttling, not a phone model. Five samples per repeated operation; undo/redo one each. All stored-content, undo/redo and blocked-network checks passed. No timing threshold or runtime optimization was introduced.

| CPU rate / staged photos | Input median | Draft flush median | History median | Undo / redo |
|---|---:|---:|---:|---:|
| 1x / 0 | 9.5 ms | 10.0 ms | 7.7 ms | 23.1 / 22.4 ms |
| 1x / 8 | 691.9 ms | 557.2 ms | 429.8 ms | 604.6 / 589.0 ms |
| 4x / 0 | 45.5 ms | 43.3 ms | 35.3 ms | 113.6 / 107.0 ms |
| 4x / 8 | 2620.5 ms | 2085.4 ms | 1647.9 ms | 2266.5 / 2242.5 ms |

Input timing measures synchronous synthetic `input` event dispatch through the actual handler; draft flush separately awaits durability after that event. The figures reveal a substantial byte-dependent cost in this deliberately heavy fixture, not real IME latency or heap usage. Six history snapshots were retained. Check representative actual-phone photos before choosing an optimization, preserving immediate drafts and undo semantics. This measurement establishes the requested baseline; it does not certify acceptable phone performance.

The first profiling fixture failed Redo because manually inserted figures had not passed through normal rendering/decorating. Preparing the baseline through `applyState` fixed the fixture without changing app sources. The successful run verified exact undo/redo text. Syntax, generated/project checks, 20 project/repository tests and `git diff --check` passed for this documentation/tooling stage. `docs/` and `scripts/` are already excluded from Pages; no new deployment exclusion is needed.
