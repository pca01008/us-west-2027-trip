# Research and Website Directory Guide

This follows the small-project policy adopted on October 19, 2026. It supersedes the earlier proposal to update planning originals first and reorganize into `src/data/public`. This documentation update did not move folders or migrate trip data.

The [user guide](USER_GUIDE.md#planning-policy) owns data placement; the [operations guide](OPERATIONS.md#maintenance) owns cleanup and backup.

## Current layout

```text
D:\Workspace\travel\
├─ planning\
│  ├─ 2027-us-west\
│  └─ 2027-bali\
└─ website\
   ├─ index.html
   ├─ trip-config.js
   ├─ trip-config.template.js
   ├─ assets\
   └─ docs\
```

Only major paths are shown. A research folder does not imply that an app or server registration exists for that trip.

## Planning

Store research, alternatives, booking evidence, and decision reasons by trip. Add only useful material; existing filenames may remain.

| Optional example | Purpose |
|---|---|
| `trip-overview.md` | Dates, travelers, preferences, constraints |
| `itinerary.md` | Candidate routes or dated historical plans |
| `budget.csv` | Estimates and cost comparisons |
| `decisions.md` | Reasons for selections or changes |
| `research/` | Accommodation, transport, attractions, sources, check dates |
| `bookings/` | Confirmations and related documents |

These are examples, not mandatory files. Separate confirmed facts, candidates, and unverified information. Record sources and verification dates for prices, opening hours, and booking terms. Follow the [transition procedure](OPERATIONS.md#planning-transition) for existing itinerary and budget files.

## Website

Keep `index.html` and `trip-config.js`. See [main files](../README.md#main-files) and the [project guide](PROJECT_GUIDE.md) for storage details.

The app does not read or synchronize `planning` files. The current workflow needs neither `src/data/public` separation nor a trip picker. Follow [new-trip reuse](OPERATIONS.md#new-trip) for another trip.

## Project connections and retention

| Connected folder | Work |
|---|---|
| `travel\website` | Website development and maintenance |
| `travel\planning\2027-us-west` | US West research, comparisons, booking evidence |
| `travel\planning\2027-bali` | Bali research, comparisons, booking evidence |

Connect the folder needed for the task and follow its `AGENTS.md`, if present. Apply confirmed information according to the [data policy](USER_GUIDE.md#planning-policy).

Keep `website` as its existing independent Git repository. Back up `planning` as files or in a separate repository as needed; the parent `travel` directory need not become one repository. See [operations](OPERATIONS.md) for Git, deployment, and backup.
