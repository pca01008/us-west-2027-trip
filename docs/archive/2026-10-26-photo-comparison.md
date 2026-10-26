# Photo comparison fix — 2026-10-26

Scope: F5 from the October 26 project review. The root app now compares full-image and thumbnail resources even when photo IDs, captions and alt text are unchanged. Imports, versions and save conflicts share the same comparison. Image-only imports can be applied as drafts.

Resource identities are local: SHA-256 of decoded embedded bytes matches immutable Storage filenames. Equivalent public Storage URLs and paths compare equal. Current offline exports retain a verified source/digest link for asset and legacy-path photos; replacing embedded bytes invalidates that link. Photo descriptions, order, additions and deletions remain separate changes. Diff text contains no image payloads. No schema, currency, dependency, SQL or shared-data changes.

## Verification

- Build consistency and static project checks passed.
- All **176 unit tests** passed, including SHA-256 padding/large-input checks against Node crypto, equivalent representations, changed paths, metadata and concise image-change output.
- Import browser checks passed on desktop and emulated mobile: full/thumbnail replacements, path-only changes, equivalent URL/base64 representations, actual offline embedding with no differences, enabled Apply for image-only changes, durable draft retention and zero shared saves.
- The new browser regression fails against pre-fix `3b466ff` with the missing full/thumbnail change assertion. It passes against the rebuilt app.
- All **16 browser suites** passed: diagnostics, drafts, storage, inputs, imports, versions, ledger, currency, ledger compatibility, PREP, auth, photos, theme, palette, navigation and PWA.

Windows, Node `v24.22.1`, installed Chrome via `PWA_BROWSER_CHANNEL=chrome`. Localhost tests use synthetic trips and block remote requests. Restricted localhost failures were rerun with permitted local test execution. CI, Pages publication and public artifact verification are separate from these local results.

See [comparison internals](../PROJECT_GUIDE.md#saving), [test commands](../OPERATIONS.md#validation) and [deployment](../OPERATIONS.md#deployment).
