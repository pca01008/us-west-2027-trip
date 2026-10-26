# U3 ledger touch targets — 2026-10-26

Ledger entry inputs/selects now have a minimum height of 44px. Move/Modify/Delete actions are at least 44×44px, retaining 4px gaps and existing responsive wrapping. No data/schema changes.

The ledger browser suite adds 320/390/1440px checks in both themes with six long-name, high-amount expenses: input/action dimensions, action spacing, containment, overflow, final-row clearance above navigation, center hit testing and actual Modify/Cancel interaction. Normalized trip state remains unchanged. Desktop and touch-emulated contexts both run the matrix.

The new regression first failed on the pre-fix generated HTML at the 320px input-height assertion. After rebuilding, ledger and navigation browser suites, 123 unit tests, build/static checks passed in installed Chrome. Screenshots were inspected at 320/390px in both themes; the mechanical detector reported no warnings for the changed CSS.

This establishes browser geometry and emulated interaction only. Physical-phone ergonomics remain unverified.
