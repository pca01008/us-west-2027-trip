# Connected Daylight Parallel App — 2026-10-23

Started October 23; final public verification completed October 24 KST. Authorized scope: complete Daylight sharing actual data at a separate HTTPS address, not replacing legacy root.

## Implementation

Existing `/us-west-2027-trip/`; Daylight `/us-west-2027-trip/daylight/`. Generated from candidate `5c68244` root, LF hash prefix `746c729d28bb`, retaining online auth/shared saves/photos/files/PWA. Same trip/editor/Supabase/bucket; `_daylight` cache suffix separates local data while same-origin auth remains shared.

Legacy root changes only five metadata functions to preserve importance/stay checkout and reflect conflicts/import differences. Close/reopen old windows. No SQL/grants/server-data change; tests save synthetic data only, never commit actual trip snapshots.

## Local validation

Windows Node 24.19.0/Playwright 1.62.1 Chromium. Live-browser check passed settings/source hash/storage isolation/bidirectional saves/importance/stays/concurrent-list conflict/import diff. `DAYLIGHT_LIVE=1` PWA passed `/trip/daylight/` install/mobile navigation/offline/theme/missing SDK/network update. Static passed. Final candidate 117/117 units after resolving sandbox HTTP/document-link issues and rerunning all. Main-derived deployment had one document link failure among114; after including referenced record all18 project tests passed. Remote CI is separate.

## Publication/read-only checks

Deployment `66aa08f` (`feat: publish connected Daylight alongside legacy app`); [Pages39973609984](https://github.com/pca01008/us-west-2027-trip/actions/runs/39973609984) succeeded. [Validate39973610191](https://github.com/pca01008/us-west-2027-trip/actions/runs/39973610191) at October 24 00:00KST had unit/SQL success and browser installing Chromium, not confirmed completed.

Public checker: both revision 27/17 checks/8expenses, shared document hashes equal in memory; content not recorded. Writes blocked/zero actual writes. Legacy navigation retained/Daylight visible, no390px overflow, login dialog/no runtime errors. One anonymous context verified independent root/Daylight worker scopes, then offline reopening restored each UI/17 checks independently after online reading.

Actual password login/server writing/physical phone installation were not tested. Save/conflict/offline results above use synthetic data.
