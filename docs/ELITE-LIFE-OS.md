# Elite Life OS

A personal operating system built on eight habits, living at **`/life`** inside this app.
It is self-contained: no database, no auth, no server state. Everything is kept in the
browser's local storage on the user's device, which makes it instant, offline-capable and
private by default.

> WIN TOMORROW TONIGHT · PROTECT YOUR MORNING · BUILD MOMENTUM · CHOOSE HARD

---

## Where things live

```
src/app/life/                 The application. One route per screen.
  layout.tsx                  Metadata, PWA manifest, provider + shell
  life.css                    The whole design system (tokens, surfaces, motion)
  page.tsx                    Command Center (home)
  morning · tasks · journal · learning · night
  habits · momentum · north-star · choose-hard
  people · places · environment
  weekly · monthly · progress
  alarms · settings

src/lib/life/
  types.ts    The single serialisable LifeState + storage key/version
  date.ts     Local-time date and clock maths (never UTC — it shifts the day)
  habits.ts   The eight habits, the morning sequence, the night sequence
  seed.ts     Defaults + the deterministic 90-day demo history
  engine.ts   Every derived number: scores, streaks, momentum, timeline, reports
  coach.ts    The snapshot the coach reasons from + the local rule-based coach
  store.tsx   React context, reducer, persistence, notifications, clock hooks
  alarm.ts    Audio synthesis, notifications, wake lock, capability detection
  nav.ts      Navigation model, shared by the sidebar and the command palette

src/components/life/
  Shell.tsx           App chrome: top bar, toasts, notification centre, shortcuts
  Sidebar.tsx         Desktop sidebar + mobile bottom navigation
  AlarmLayer.tsx      The scheduler and the two cinematic full-screen alarm stages
  CommandPalette.tsx  ⌘K — search, navigate, complete a habit, run an action
  CoachDock.tsx       The floating AI Life Coach panel
  charts.tsx          Hand-rolled SVG: rings, sparklines, area charts, heatmaps,
                      the momentum flow and the challenge climb
  ui.tsx              Panels, buttons, fields, toggles, modals, counters
  widgets.tsx         Habit cards, next action, timeline rail, recovery banner
  icons.tsx           Curated icon registry (named imports keep the bundle small)

src/app/api/life/coach/route.ts   The one server route: the AI coach
public/life-sw.js                 Service worker (installability, notifications)
public/life-manifest.webmanifest  PWA manifest
```

## Core ideas

**One state object.** `LifeState` is the whole system — profile, settings, a map of
day records, North Star, challenge, book, people, places, environment changes. It is
versioned and migrated in `store.tsx`, exported and imported as plain JSON.

**Nothing derived is stored.** Scores, streaks, momentum, completion rates and reports
are all computed from the day log in `engine.ts`. The history is the only source of
truth, so editing a past day instantly and correctly updates every chart.

**Momentum** (0–100) blends four inputs: recency-weighted 7-day consistency (62%),
direction — last 3 days against the previous 4 (20%), and rhythm — how tightly wake and
bed times hit their targets (18%). Today is judged against how much of the day has
actually passed, so a 07:00 reading is not punished for an unfinished day.

**The Next Action engine** builds one ordered timeline for the day from the user's own
wake and bed times, then picks the first open item whose window contains now. The
Command Center, the morning rail and the routine list all read that single structure.

**Never miss twice.** `missStatus` only counts *closed* days, so an unfinished today is
never a miss. One miss surfaces a recovery day; two surfaces a warning and exactly one
recovery action.

## The alarms — and what they honestly can't do

`AlarmLayer` runs a 15-second scheduler while the app is open and fires a full-screen
stage, a synthesised Web Audio tone, a system notification, vibration and a screen wake
lock. Each alarm is marked fired per day in local storage so a reload does not re-ring it.

A web page **cannot** guarantee to wake anyone with the tab closed: background timers are
throttled or frozen and there is no cross-browser scheduled-alarm API. The Alarms screen
checks each capability live on the device and states plainly what is and is not
guaranteed, and recommends the phone's built-in alarm as the backstop. Nothing in the UI
claims otherwise.

## The AI Coach

`buildSnapshot()` produces a compact, human-readable summary of the tracked data. That
snapshot is the only thing either coach reasons from:

- **No `OPENAI_API_KEY`** → the deterministic coach in `coach.ts` answers on-device.
- **Key configured** → `/api/life/coach` sends the snapshot and question to the model
  (`LIFE_COACH_MODEL`, default `gpt-4o-mini`) with instructions to reason only from the
  snapshot. If the model fails, it degrades to the local answer.

Every reply is badged **Local analysis** or **AI model** so the user always knows which
engine spoke.

## Demo history

A fresh install generates a deterministic 90-day history so the analytics have something
to say on day one. Every generated row carries `seeded: true`, the dashboard shows a
"Demo history on" badge, and Settings can hide it from all analytics or delete it
outright in one action.

## Keyboard

`⌘K`/`Ctrl K` command palette · `C` coach · `D` dashboard · `M` morning · `J` journal ·
`L` learning · `H` habits · `N` night · `W` weekly · `P` progress.

## Theming

Everything derives from CSS custom properties in `life.css`, switched by three attributes
on one root node: `data-theme` (dark/light), `data-accent` (five accents) and
`data-motion` (reduced motion, which also respects the OS preference).
