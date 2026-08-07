# 75 — a cycle-aware challenge

A 75-day challenge app built around one rule: **the streak is rigid, the targets are not.**

75 Hard works because it doesn't negotiate — miss anything, any day, and you restart at day 1. That
unforgiving quality is the mechanism, not a side effect. But a body with a menstrual cycle does not
have flat capacity across 28 days, and pretending otherwise produces a program that punishes
physiology.

So this app splits the two. The **streak** never bends. What bends is the **definition of done** for
the two pillars where capacity actually changes: training intensity and hydration. Walk, reading and
nutrition are identical in every phase, on purpose — the challenge needs a spine.

## The daily rules

| Task | Requirement | Phase-relative? |
|---|---|---|
| Workout | 45 min at the prescribed intensity band | **Yes** |
| Outdoor walk | 30 min outside, any weather | No |
| Water | ~35 ml/kg bodyweight, phase-adjusted | **Yes** |
| Nutrition | Your written plan, no cheat meals, no alcohol | No |
| Reading | 10 pages non-fiction | No |
| Progress photo | Day 1, then every 7th day | Weekly, not daily |

Miss any required task on any day and the attempt resets. Training *below* the prescribed band is
allowed, recorded as a downshift, and does **not** break the streak. Skipping the workout does.

## Intensity bands

| Phase | Band | Reasoning |
|---|---|---|
| Menstrual, days 1–2 | Restorative | Movement helps, load doesn't |
| Menstrual, day 3+ | Steady | Capacity climbing back |
| Follicular | Build | Rising estrogen; best window for hard work |
| Ovulatory | Peak | Strongest window — plus a joint-laxity caution |
| Luteal (early) | Steady | Aerobic work fine, top end feels harder than the numbers |
| Luteal (last 4 days) | Restorative | Energy floor, harder thermoregulation |

Phases are estimated by counting **back** from the next expected period, because the luteal phase is
the near-constant part of a cycle (~14 days). Cycle length is the median of her own last six logged
intervals, falling back to the configured default until there are at least two. These are estimates.
The app does not detect ovulation and does not track fertility.

## Live

**https://erikcargnoni-mkt.github.io/75-day-challenge/**

Open it on a phone → Share → Add to Home Screen. It installs, works offline, and keeps its data on
that device. Every push to `main` rebuilds and redeploys via GitHub Actions; the workflow runs the
test suite first, so a broken rules engine can't ship.

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 40 tests over the rules engine
npm run build    # production PWA in dist/
```

To use it on a phone: run `npm run dev -- --host`, open the LAN address on the phone, then Share →
Add to Home Screen. It installs, works offline, and keeps its own data.

## Architecture

```
src/core/          Pure TypeScript. No React, no DOM. This is the part that ports to native.
  date.ts          Local-calendar helpers (never UTC — day rollover has to match her midnight)
  types.ts         Domain model
  cycle.ts         Phase estimation, rolling cycle length
  targets.ts       Phase → daily targets. The whole "what bends" policy lives here.
  challenge.ts     Streak rules, day completion, rollover/reset, all state transitions
  insights.ts      Per-phase completion, downshift rates, symptom aggregates
  storage.ts       StateStore interface + localStorage adapter
  photos.ts        IndexedDB blob store
src/state/         React glue (context, persistence, midnight rollover)
src/ui/            Screens
```

`core/` has no imports outside itself and is covered by the test suite. A future iOS build reuses it
verbatim and replaces `src/ui/` and the `StateStore` adapter — the rules don't get rewritten, which
is the point of the split.

State transitions are pure functions (`AppState → AppState`), so the reset logic is testable without
mounting anything. `reconcile()` is the one that matters: it's called on load, on focus, and every 30
seconds, and it fails the attempt for any past day left incomplete — including days the app was never
opened. The challenge does not pause because you looked away.

## Data

Everything is local. The challenge log is in `localStorage`, photos are in IndexedDB, there is no
account and no server. Cycle data is special-category health data under GDPR Art. 9, and the only way
to guarantee it is never mishandled by a backend is to not have one. If this becomes a product, that
is the position, not a limitation to fix later.

Settings has JSON export/import for backup. Photos are deliberately excluded from the export.

## Known gaps

- **No notifications.** iOS PWAs have limited push support and none of it is reliable enough to hang a
  daily streak on. A real reminder is one of the strongest reasons to go native.
- **Copy is inline English**, not externalized. Pulling it into a strings module is a mechanical
  afternoon whenever a second language is needed.
- **Single user.** No accounts. The state shape is a single object, so multi-user means a keyed store
  and an auth layer — additive, not a rewrite.
- **Phase model is population-average.** It's an estimate from arithmetic. The Progress screen exists
  to tell you when it doesn't fit this particular body — if the luteal downshift rate goes above 50%,
  the app says the prescription is wrong for her rather than assuming she's underperforming.

Not a medical device.
