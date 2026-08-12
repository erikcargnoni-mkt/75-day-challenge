# 75 — a cycle-aware challenge

A 75-day challenge app built around one rule: **the streak is rigid, the targets are not.**

75 Hard works because it doesn't negotiate — miss anything, any day, and you restart at day 1. That
unforgiving quality is the mechanism, not a side effect. But a body with a menstrual cycle does not
have flat capacity across 28 days, and pretending otherwise produces a program that punishes
physiology.

So this app splits the two. The **daily bar** never bends: seven tasks, every day, no substitutions.
What bends is the **definition of done** for the two pillars where capacity actually changes —
training intensity and hydration. Outdoor time, nutrition, reading, meditation and the photo are
identical in every phase, on purpose; the challenge needs a spine.

What the app does *not* do is pass sentence on its own. A missed day is put to her as a choice, and
whichever she picks is recorded permanently — see [Missed days](#missed-days-her-call-permanent-record).

## The daily rules

| Task | Requirement | Phase-relative? |
|---|---|---|
| Workout | 45 min at the prescribed intensity band | **Yes** |
| Outdoors | 30 min outside, any weather — walk or run | No |
| Water | ~35 ml/kg bodyweight, phase-adjusted | **Yes** |
| Nutrition | Your written plan, no cheat meals, no alcohol | No |
| Reading | 10 pages non-fiction | No |
| Meditation | One sit — 5, 10, 15 or 20 min | No |
| Progress photo | Daily | No |

Training *below* the prescribed band is allowed, recorded as a downshift, and does **not** break the
streak. Skipping the workout does.

## Missed days: her call, permanent record

The app never resets anything on its own. When past days were left unfinished, the next time she
opens the app a **blocking prompt** lists exactly what was missed and offers three answers:

- **I did this — log it** — opens that day's checklist. The commonest true answer, and the reason the
  other two are a last resort.
- **Keep going** — the day count holds, and those dates are written to `attempt.carried` forever.
- **Start over** — the run is filed to history and a fresh day 1 opens today. Nothing is deleted.

### Backfilling

A day can be filled in for `BACKFILL_WINDOW_DAYS` (7) after the fact, from the prompt or by tapping
*Earlier* on the Today screen. **Completing a carried day un-carries it automatically** — carrying is
meant to record days the work didn't happen, not days the phone didn't hear about it.

The window exists because an unbounded one isn't a log any more, it's a memory test taken at the end;
a week covers a forgotten evening or a weekend away and stops there. It was a real bug that the first
version of the prompt offered no way to say *I did it, I just forgot to log it* — it charged a clean
day as a carried one, which is exactly the unfairness carrying was supposed to avoid.

The original design auto-failed the attempt during `reconcile()`, which meant seventy-five days of
work could vanish silently while she wasn't looking, on the app's authority. Making her own the
decision is closer to the point of the thing. What stops that from turning the challenge into a habit
tracker is that **carrying is never forgotten**: carried days show as dashed red squares in the day
grid for the whole run, the header reads "N clean · M carried", and only a run with zero carried days
is reported as a **Clean 75**. She keeps her progress; the app doesn't pretend the day happened.

There is no push notification. iOS 16.4+ supports web push for installed PWAs, but only server-sent —
a web app cannot reliably schedule a local notification for tomorrow morning, and adding a push
backend would break the no-server position that keeps her cycle data off the internet. The prompt
fires on open instead.

Walk-or-run and meditation length are recorded, never scored — both options count equally.

**Weight is measured, not scored.** A daily weigh-in is prompted and drives the water target, but
forgetting the scale can never cost the streak. Its only other job is the trend on the Progress
screen, which draws a trailing 7-day average rather than the raw mornings — a single reading moves
on salt, sleep and luteal fluid, none of which is the thing she's changing.

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
npm run dev      # http://localhost:5173/75-day-challenge/  (base path, see vite.config.ts)
npm test         # 101 tests over the rules engine, decisions and chart geometry
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
  challenge.ts     Streak rules, day completion, backfill window, all state transitions
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
seconds, and it collects any past day left incomplete — including days the app was never opened —
into a `PendingDecision` the UI blocks on. The challenge does not pause because you looked away; it
just refuses to decide the consequence for her.

### Rule changes must never reach backwards

`reconcile()` re-judges every past day, so *adding* a required task would otherwise make yesterday
retroactively incomplete and silently reset a legitimate streak to day 1. `isDayComplete()` therefore
treats a day with a `completedAt` stamp as permanently signed off: it was judged against the rules in
force when it was closed. `withLog()` sets that stamp only via the strict `meetsRequirements()` check
and clears it the moment a task is un-ticked, so nothing can be grandfathered that didn't genuinely
earn it. This is what made adding meditation and daily photos safe mid-challenge, and it's covered by
tests in `challenge.test.ts` under *rule changes*.

### The phase palette is computed, not chosen

The four phase colours are a categorical palette carrying identity across badges, the calendar strip,
the day grid and the weight chart. They're validated for lightness band, chroma floor, protan/deutan
separation and surface contrast against both themes. Red and green sit far apart in lightness on
purpose — under deuteranopia that gap is the only thing distinguishing them, and the obvious
"brighter green" choice collapses their separation to ΔE 1.9. Don't nudge them by eye.

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
