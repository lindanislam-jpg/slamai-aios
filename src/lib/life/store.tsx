"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { dateKey, nowClock } from "./date";
import { emptyDay } from "./engine";
import { createInitialState, DEFAULT_SETTINGS } from "./seed";
import { useSync, type SyncInfo } from "./useSync";
import type {
  CoachMessage,
  DayRecord,
  EnvChange,
  HabitId,
  ISODate,
  LifeState,
  Person,
  Place,
  Settings,
} from "./types";
import { STATE_VERSION, STORAGE_KEY } from "./types";

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

type Action =
  | { type: "hydrate"; state: LifeState }
  | { type: "patchDay"; date: ISODate; patch: (d: DayRecord) => DayRecord }
  | { type: "patch"; patch: Partial<LifeState> }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "reset"; state: LifeState };

function reducer(state: LifeState, action: Action): LifeState {
  switch (action.type) {
    case "hydrate":
    case "reset":
      return action.state;
    // Every write is timestamped so two devices can be merged later without
    // guessing which copy is the newer one. See sync.ts.
    case "patch":
      return { ...state, ...action.patch, touchedAt: Date.now() };
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch }, touchedAt: Date.now() };
    case "patchDay": {
      const existing = state.days[action.date] ?? emptyDay(action.date, state.settings);
      const next = action.patch({ ...existing, seeded: false });
      return { ...state, days: { ...state.days, [action.date]: { ...next, updatedAt: Date.now() } } };
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Ephemeral UI notifications (also feed the Notification Center)
 * ------------------------------------------------------------------ */

export interface Notice {
  id: string;
  title: string;
  body?: string;
  tone: "success" | "info" | "warn";
  xp?: number;
  at: number;
  read: boolean;
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

interface LifeContext {
  state: LifeState;
  ready: boolean;
  today: ISODate;
  notices: Notice[];
  notify: (n: Omit<Notice, "id" | "at" | "read">) => void;
  dismiss: (id: string) => void;
  markAllRead: () => void;
  /* day-level */
  patchDay: (date: ISODate, patch: (d: DayRecord) => DayRecord) => void;
  toggleHabit: (id: HabitId, date?: ISODate) => void;
  setHabit: (id: HabitId, value: boolean, date?: ISODate) => void;
  setPriority: (index: number, title: string, date?: ISODate) => void;
  togglePriority: (index: number, date?: ISODate) => void;
  completeMorningStep: (stepId: string, date?: ISODate) => void;
  wakeUp: (date?: ISODate) => void;
  goToBed: (date?: ISODate) => void;
  logNorthStar: (value: number, date?: ISODate) => void;
  /* object-level */
  update: (patch: Partial<LifeState>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toggleMilestone: (id: string) => void;
  upsertPerson: (p: Person) => void;
  removePerson: (id: string) => void;
  upsertPlace: (p: Place) => void;
  addEnvChange: (kind: EnvChange["kind"], text: string) => void;
  toggleEnvChange: (id: string) => void;
  removeEnvChange: (id: string) => void;
  pushCoach: (m: Omit<CoachMessage, "id" | "at">) => void;
  clearCoach: () => void;
  /* sync */
  sync: SyncInfo;
  /* data */
  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; error?: string };
  resetAll: (withDemo: boolean) => void;
  deleteDemoHistory: () => void;
}

/** Fixed ids used by the old seed, so its samples can be told apart from real
 *  entries — anything you added yourself carries a UUID. */
const LEGACY_PERSON_IDS = new Set(["p1", "p2", "p3", "p4", "p5"]);
const LEGACY_PLACE_IDS = new Set(["pl1", "pl2", "pl3", "pl4", "pl5", "pl6"]);
const LEGACY_ENV_IDS = new Set(["e1", "e2", "e3", "e4", "e5"]);

/**
 * Removes everything the app invented — generated days, sample people, sample
 * environment changes, and the assessments written onto the starting places.
 * Your own entries are untouched.
 */
export function stripSamples(state: LifeState): LifeState {
  return {
    ...state,
    days: Object.fromEntries(Object.entries(state.days).filter(([, v]) => !v.seeded)),
    seededAt: undefined,
    people: state.people.filter((p) => !LEGACY_PERSON_IDS.has(p.id)),
    envChanges: state.envChanges.filter((c) => !LEGACY_ENV_IDS.has(c.id)),
    places: state.places.map((p) =>
      LEGACY_PLACE_IDS.has(p.id) ? { ...p, status: "needs-work" as const, note: "" } : p,
    ),
  };
}

const Ctx = createContext<LifeContext | null>(null);

export function useLife(): LifeContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLife must be used inside <LifeProvider>");
  return ctx;
}

function migrate(raw: unknown): LifeState | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<LifeState>;
  if (!parsed.days || !parsed.settings) return null;
  const merged = {
    ...createInitialState(),
    ...parsed,
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
  } as LifeState;

  // v1 shipped invented people, places and history to every install. Clear them
  // on the way in, so nobody has to find a button to stop seeing strangers.
  return (parsed.version ?? 1) < 2 ? stripSamples(merged) : merged;
}

export function LifeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null as unknown as LifeState, () => createInitialState());
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<ISODate>(() => dateKey());
  const [notices, setNotices] = useState<Notice[]>([]);
  const hydrated = useRef(false);

  /* Cross-device sync. Signed out this is inert and the app is unchanged. */
  const onMerged = useCallback((next: LifeState) => dispatch({ type: "hydrate", state: next }), []);
  const sync = useSync({ state, ready, onMerged });

  /* Load once on the client. The server render always shows the shell skeleton,
     so there is no hydration mismatch from localStorage. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const migrated = migrate(JSON.parse(raw));
        if (migrated) dispatch({ type: "hydrate", state: migrated });
      }
    } catch {
      /* corrupt payload — fall back to a fresh state rather than crash */
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  /* Persist. Debounced so a fast typist doesn't hit localStorage per keystroke. */
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* quota — the app keeps working in memory */
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [state, ready]);

  /* Roll over at midnight without a refresh. */
  useEffect(() => {
    const t = window.setInterval(() => {
      const k = dateKey();
      setToday((prev) => (prev === k ? prev : k));
    }, 20_000);
    return () => window.clearInterval(t);
  }, []);

  const notify = useCallback((n: Omit<Notice, "id" | "at" | "read">) => {
    const notice: Notice = { ...n, id: crypto.randomUUID(), at: Date.now(), read: false };
    setNotices((prev) => [notice, ...prev].slice(0, 60));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotices((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const patchDay = useCallback((date: ISODate, patch: (d: DayRecord) => DayRecord) => {
    dispatch({ type: "patchDay", date, patch });
  }, []);

  const value = useMemo<LifeContext>(() => {
    const d = (date?: ISODate) => date ?? dateKey();

    return {
      state,
      ready,
      today,
      notices,
      notify,
      dismiss,
      markAllRead,
      patchDay,

      toggleHabit(id, date) {
        const key = d(date);
        const current = Boolean(state.days[key]?.habits[id]);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => ({ ...day, habits: { ...day.habits, [id]: !current } }),
        });
      },

      setHabit(id, value_, date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => ({ ...day, habits: { ...day.habits, [id]: value_ } }),
        });
      },

      setPriority(index, title, date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => {
            const priorities = [...day.priorities];
            while (priorities.length <= index) {
              priorities.push({ id: `${key}-p${priorities.length + 1}`, title: "", done: false });
            }
            priorities[index] = { ...priorities[index], title };
            return { ...day, priorities };
          },
        });
      },

      togglePriority(index, date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => {
            const priorities = [...day.priorities];
            if (!priorities[index]) return day;
            const done = !priorities[index].done;
            priorities[index] = {
              ...priorities[index],
              done,
              completedAt: done ? new Date().toISOString() : undefined,
            };
            return { ...day, priorities };
          },
        });
      },

      completeMorningStep(stepId, date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) =>
            day.morning[stepId]
              ? { ...day, morning: Object.fromEntries(Object.entries(day.morning).filter(([k]) => k !== stepId)) }
              : { ...day, morning: { ...day.morning, [stepId]: nowClock() } },
        });
      },

      wakeUp(date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => ({
            ...day,
            wakeActual: day.wakeActual ?? nowClock(),
            wakeTarget: day.wakeTarget ?? state.settings.wakeTime,
            morning: { ...day.morning, wake: day.morning.wake ?? nowClock() },
          }),
        });
      },

      goToBed(date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => ({
            ...day,
            bedActual: nowClock(),
            bedTarget: day.bedTarget ?? state.settings.bedTime,
          }),
        });
      },

      logNorthStar(v, date) {
        const key = d(date);
        dispatch({
          type: "patchDay",
          date: key,
          patch: (day) => ({ ...day, northStar: v, habits: { ...day.habits, measure: true } }),
        });
      },

      update(patch) {
        dispatch({ type: "patch", patch });
      },

      updateSettings(patch) {
        dispatch({ type: "settings", patch });
      },

      toggleMilestone(id) {
        const milestones = state.challenge.milestones.map((m) =>
          m.id === id ? { ...m, done: !m.done, doneOn: !m.done ? dateKey() : undefined } : m,
        );
        dispatch({ type: "patch", patch: { challenge: { ...state.challenge, milestones } } });
      },

      upsertPerson(p) {
        const exists = state.people.some((x) => x.id === p.id);
        dispatch({
          type: "patch",
          patch: { people: exists ? state.people.map((x) => (x.id === p.id ? p : x)) : [...state.people, p] },
        });
      },

      removePerson(id) {
        dispatch({ type: "patch", patch: { people: state.people.filter((p) => p.id !== id) } });
      },

      upsertPlace(p) {
        const exists = state.places.some((x) => x.id === p.id);
        dispatch({
          type: "patch",
          patch: { places: exists ? state.places.map((x) => (x.id === p.id ? p : x)) : [...state.places, p] },
        });
      },

      addEnvChange(kind, text) {
        const change: EnvChange = {
          id: crypto.randomUUID(),
          kind,
          text,
          done: false,
          createdOn: dateKey(),
        };
        dispatch({ type: "patch", patch: { envChanges: [change, ...state.envChanges] } });
      },

      toggleEnvChange(id) {
        dispatch({
          type: "patch",
          patch: { envChanges: state.envChanges.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) },
        });
      },

      removeEnvChange(id) {
        dispatch({ type: "patch", patch: { envChanges: state.envChanges.filter((c) => c.id !== id) } });
      },

      pushCoach(m) {
        const message: CoachMessage = { ...m, id: crypto.randomUUID(), at: new Date().toISOString() };
        dispatch({ type: "patch", patch: { coach: [...state.coach, message].slice(-80) } });
      },

      clearCoach() {
        dispatch({ type: "patch", patch: { coach: [] } });
      },

      sync,

      exportJson() {
        return JSON.stringify(state, null, 2);
      },

      importJson(raw) {
        try {
          const migrated = migrate(JSON.parse(raw));
          if (!migrated) return { ok: false, error: "That file isn't an Elite Life OS backup." };
          const restored = { ...migrated, touchedAt: Date.now() };
          dispatch({ type: "reset", state: restored });
          // A restore is a deliberate replacement, not one more edit to merge.
          sync.overwrite(restored);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
        }
      },

      resetAll(withDemo) {
        const fresh = { ...createInitialState(dateKey(), { demo: withDemo }), touchedAt: Date.now() };
        dispatch({ type: "reset", state: fresh });
        // Without this the next pull would merge the cleared days back in.
        sync.overwrite(fresh);
      },

      deleteDemoHistory() {
        const cleaned = { ...stripSamples(state), touchedAt: Date.now() };
        dispatch({ type: "reset", state: cleaned });
        sync.overwrite(cleaned);
      },
    };
  }, [state, ready, today, notices, notify, dismiss, markAllRead, patchDay, sync]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ------------------------------------------------------------------ *
 * Clock hook — one interval per subscriber, at the resolution it asks for.
 * ------------------------------------------------------------------ */

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** True only after the first client paint — guards anything time-dependent. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
