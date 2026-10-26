# U2 — Exchange-rate settings validation

Baseline: `4dcc7eb` on `origin/main`. Addresses U2 from the October 26 project review.

## Change

Invalid rates retain their raw text and show a local accessible error. Settings cannot close through the primary button, Enter, or Escape until corrected or explicitly reverted. Blur validates without applying. Revert rate restores the current value without reverting category edits. Category rendering preserves pending input and errors.

Rate parsing rejects decimal values that would silently lose precision when stored as a JSON Number. Supported exact fractions, grouped thousands, leading/trailing zeros remain valid. Existing expenses are unchanged; unchanged application preserves the rate timestamp.

Behavior and implementation are maintained in [User guide](../USER_GUIDE.md#ledger) and [Project guide](../PROJECT_GUIDE.md#dialog-focus); commands and coverage live in [Operations](../OPERATIONS.md#browser-checks).

## Verification

- Regression proof: the added browser case fails against the baseline when an empty rate is followed by pointer close; no inline error remains visible.
- Build consistency, all **177 unit tests**, and project checks passed.
- Targeted ledger suite passed on Windows / installed Chrome, desktop 1440px and mobile emulation 390px, light/dark. The rate matrix uses eight invalid strings with pointer close, Enter and Escape (**96 submissions**), plus correction, blur, explicit revert, reopen, category rendering and unchanged application.
- The complete **16-suite browser runner passed**, including input focus, imports/versions, drafts/storage, currency compatibility, authentication, photos, themes, navigation and PWA.
- Inspected desktop/light and mobile/dark screenshots. The manual design detector reported the existing photo-viewer image without an initial source; the viewer sets it at runtime. No new design defect was identified.

All browser data is synthetic; production APIs are blocked. Physical devices and Firefox/WebKit are outside this verification. SQL and server permissions are unchanged.
