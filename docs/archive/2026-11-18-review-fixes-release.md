# November 18 review fixes release

Pages deployed `cdd43db0b5ce70fc84b629526ed9b13fdae5eef9` on November 18, 2026. The deploy job finished at 06:40:25 UTC. The released tree matches the verified PR head, `73ec54d9cff5b81688f563f39228a325e1881bbf`. [Published site](https://pca01008.github.io/us-west-2027-trip/) · [Merged PR 4](https://github.com/pca01008/us-west-2027-trip/pull/4)

The [implementation checkpoint](../REVIEW_2026-11-14_PROGRESS.md) records the five stage commits, the visual comparison and sizing measurements, and the Ubuntu WebKit diagnosis. The final correction releases the inactive background before inserting new editor fields. The regression confirms the next real keyboard input reaches the title.

| Verification | Result |
|---|---|
| Protected PR at `73ec54d` | Unit/static, SQL, browser, required gate and Pages artifact passed. [PR Validate](https://github.com/pca01008/us-west-2027-trip/actions/runs/44248120430) |
| Main push at `cdd43db` | 195/195 unit tests, 24/24 tests on PostgreSQL 17.12, six Firefox/WebKit groups, and 16 Chromium suites passed. Required, Pages build and deploy passed. [Main Validate and Pages](https://github.com/pca01008/us-west-2027-trip/actions/runs/44251015921) |
| Public HTTPS | Site root and eight artifact files matched the release byte for byte. Sample requests under `docs/` and `src/` returned 404. |
| Public Chromium | Anonymous document read succeeded. Itinerary, PREP, ledger and export-dialog isolation passed at a 390px emulated viewport. The smoke test allowed GET and HEAD and blocked WebSockets. |

The production check exercised public viewing. Physical phones, screen-reader speech, and authenticated production writes were outside this release check. The receipt is a documentation update on the work branch. The published source is the deployed main commit above.
