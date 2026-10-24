# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two travelers. Follow the two-user scope in [AGENTS.md](AGENTS.md).

## Product Purpose

Share and manage a US West trip itinerary, preparation tasks, expenses, and photos. [README.md](README.md) owns the overview and documentation index.

## Capabilities and Constraints

The [user guide](docs/USER_GUIDE.md) defines usage, saving, and recovery; the [project guide](docs/PROJECT_GUIDE.md) defines implementation; the [operations guide](docs/OPERATIONS.md) defines execution and deployment. This file does not duplicate those specifications.

## Product Principles

- Keep complexity proportional to two people's actual needs.
- Prioritize concise interface copy and data integrity.
- Improve necessary navigation and input flows while preserving visual consistency.

## UI Direction and Open Decisions

The October 24, 2026 decision **pauses further Daylight development and production migration** and improves the existing app. Give equal weight to phone use during travel and desktop planning and expense editing before departure. Keep navy/coral colors and cards. Approved changes include bottom navigation for itinerary, PREP, and ledger; a simpler ledger; clearer expense-add controls; and **concept B's theme button and dropdown**. The [refinement plan](docs/LEGACY_UI_REFINEMENT_PLAN.md) defines scope, behavior, references, and acceptance criteria. Changes are implemented on a separate branch; see the [implementation record](docs/archive/2026-10-24-legacy-ui-refinement.md) for deployment status and validation.

Retain the [Daylight plan](docs/DAYLIGHT_IMPLEMENTATION_PLAN.md) and [implementation record](docs/archive/2026-10-23-daylight-implementation.md) as paused candidate history.
