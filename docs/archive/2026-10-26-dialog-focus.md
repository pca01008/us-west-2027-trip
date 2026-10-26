# U1 dialog focus — 2026-10-26

All app modal openings now record the trigger synchronously through `showDialog()`, before input focus. Return selectors resolve replaced ledger/category buttons, while nested dialogs restore within the parent. Closing a parent underneath a child does not steal focus; queued autofocus ignores closed/background dialogs.

`scripts/check-inputs-browser.mjs` adds desktop/390px keyboard coverage for expense, category, schedule-time and photo dialogs: Enter opening, initial input focus, Tab/Shift+Tab wrapping, Escape/Cancel/Apply return focus, nested settings and category/expense rerendered triggers. Fixtures are synthetic and external traffic is blocked.

Validation: build consistency, 123 unit tests, static checks, and input browser suite passed using installed Chrome. Local HTTP checks require networking outside the Windows sandbox. No production data writes or physical-device testing.
