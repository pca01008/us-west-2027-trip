# U2 local dialog validation — 2026-10-26

Category names now show a short error beside the field, focus the input and set `aria-invalid`, with `aria-describedby` pointing to a local alert. Typing or reopening clears stale feedback. The same global-status-only pattern was found and repaired in expense-name editing and map name/HTTPS validation. Existing acceptance rules and saved schema are unchanged.

The input browser suite checks desktop/390px and both themes: blank/whitespace names, repeated submission, correction, successful save, reopen, nested return focus, local error visibility and viewport bounds. It also checks expense/map invalid submission and correction. Screenshots capture each category-error state. Synthetic fixtures block remote requests.

Validation: build consistency, 123 unit tests, static checks and the input browser suite passed in installed Chrome. Rendered mobile light/dark errors were inspected. Detector warnings refer to the existing unpopulated photo viewer and unassembled source typography, unrelated to this change. Physical-phone and screen-reader testing were not performed.
