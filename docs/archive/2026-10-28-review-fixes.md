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

## Stage 4 — integrated release verification

Integrated current main (`ea8567f`) through merge `a311c00`, preserving its separate intentional-gate workflow and required-validation command. Final Windows checks on that integrated tree: [186/186 unit tests](2026-10-28-review-fixes/final-unit.txt), [all 16 Chromium suites](2026-10-28-review-fixes/final-chromium.txt), generated output/project/diff checks, and 128 local documentation targets passed. Firefox/WebKit functional coverage above uses the same final app/input-test sources. No application source changed after Stage 2.

Live API GET before release confirmed Pages source `workflow`, strict main `required` checks including administrators and disabled force pushes. Work-branch Linux/SQL/browser validation and main deployment must still succeed before a publication claim. No production data/SQL/authenticated save/upload is part of this release.

Remaining limits: clean local Ubuntu 24.04 verification; both travelers' physical phone/IME/keyboard/photo picker/installed offline/reconnect checks; physical screen readers; WebKit pointer-theme acknowledgement and Linux PNG parity. Existing CI scopes do not replace those checks. The user was asked for phone results; none were available during implementation. I1/I2 remain optional and I3 actual-phone profiling remains outstanding.

## Release-gate follow-up

Manual candidate [40654033648](https://github.com/pca01008/us-west-2027-trip/actions/runs/40654033648), source `58b987c`, passed 186 unit/24 SQL tests, Firefox/WebKit functional coverage, all 16 Chromium suites, aggregate and Pages byte/exclusion checks. A nonforced direct main push was rejected (`required` expected). Protections were retained and [PR #2](https://github.com/pca01008/us-west-2027-trip/pull/2) opened.

PR run [40656272443](https://github.com/pca01008/us-west-2027-trip/actions/runs/40656272443), synthetic merge `59beb11`, passed unit/SQL/Firefox, then WebKit hit its 180-second process deadline during read-only file reload. [Preserved job log](2026-10-28-review-fixes/pr-webkit-deadline.txt); diagnostic artifact `12802440066`, SHA256 `514f7e4b62766482a6661b100bb0498fb229e112809466cf80af5ae8c2b280df`. Page/screenshot closure errors followed termination. This run failed; it is not a full pass. Manual WebKit had taken about 168s, leaving insufficient margin under variable runner load.

The extra-engine runner now splits the input suite at existing navigation/dialog/editing-export boundaries. Each group retains a 180s process limit and every original/new assertion; all six engine/group combinations are required and report timings/warnings. Chromium still runs the full input suite by default, and full CI stage/job budgets are unchanged. This is a targeted fixture execution change, with no app source/output changes and no blind rerun or retry policy. The user explicitly chose automatic validation/deployment now and physical-device checks later.

Local verification of the split: [all six groups passed](2026-10-28-review-fixes/grouped-engines-windows.txt); Firefox navigation/dialogs/editing 17.3/31.1/19.4s, WebKit 25.4/49.8/21.4s, each under 180s. [Chromium default full input](2026-10-28-review-fixes/grouped-chromium.txt) and [186 unit tests](2026-10-28-review-fixes/grouped-unit.txt) passed, along with syntax/generated/project/diff checks. These timings are Windows evidence; the corrected PR run must establish Linux results.
