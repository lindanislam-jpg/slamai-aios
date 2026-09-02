"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  alarmCapabilities,
  fireNotification,
  getAlarmSound,
  requestWakeLock,
  vibrate,
  type AlarmCapabilities,
} from "@/lib/life/alarm";
import { clockDelta, clockToMinutes, dateKey, formatCountdown, formatDelta, minutesNow, nowClock } from "@/lib/life/date";
import { NIGHT_STEPS, WAKE_SEQUENCE } from "@/lib/life/habits";
import { getDay, momentum, streak } from "@/lib/life/engine";
import { useLife, useNow } from "@/lib/life/store";
import { Icon } from "./icons";
import { Btn } from "./ui";

type Stage = "wake" | "bed" | null;

interface AlarmApi {
  stage: Stage;
  ring: (stage: Exclude<Stage, null>, opts?: { test?: boolean }) => void;
  dismiss: () => void;
  capabilities: AlarmCapabilities;
  audioUnlocked: boolean;
  unlockAudio: () => Promise<boolean>;
  testing: boolean;
}

const Ctx = createContext<AlarmApi | null>(null);

export function useAlarm(): AlarmApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAlarm must be used inside <AlarmProvider>");
  return ctx;
}

const FIRED_KEY = "elite-life-os:alarm-fired";

function readFired(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function markFired(key: string) {
  try {
    const all = readFired();
    all[key] = true;
    // Keep the map small: only today's and yesterday's markers matter.
    const today = dateKey();
    const trimmed = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(today)));
    trimmed[key] = true;
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable — the alarm still rings this session */
  }
}

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const { state, wakeUp, notify } = useLife();
  const [stage, setStage] = useState<Stage>(null);
  const [testing, setTesting] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const sound = getAlarmSound();

  const unlockAudio = useCallback(async () => {
    const ok = await sound.unlock();
    setAudioUnlocked(ok);
    return ok;
  }, [sound]);

  /* Audio can only start after a gesture. We opportunistically unlock on the
     first interaction anywhere in the app, which is what makes the alarm audible
     later without asking the user to do anything explicit. */
  useEffect(() => {
    const handler = () => {
      void unlockAudio();
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [unlockAudio]);

  const ring = useCallback(
    (next: Exclude<Stage, null>, opts?: { test?: boolean }) => {
      setTesting(Boolean(opts?.test));
      setStage(next);
      if (state.settings.sound) void sound.start(next, state.settings.volume);
      vibrate(next === "wake" ? [400, 200, 400, 200, 600] : [200, 100, 200]);
      void requestWakeLock().then((lock) => {
        wakeLock.current = lock;
      });
      void fireNotification(
        next === "wake" ? "Get up. Your day starts now." : "Wind down. Tomorrow starts tonight.",
        next === "wake"
          ? `${state.settings.wakeTime} — four steps, sixty protected minutes.`
          : `Bedtime is ${state.settings.bedTime}. Close the day properly.`,
        `life-${next}`,
      );
    },
    [sound, state.settings],
  );

  const dismiss = useCallback(() => {
    sound.stop();
    setStage(null);
    setTesting(false);
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, [sound]);

  /* The scheduler. Runs while the app is open; the Alarms screen is explicit
     that a closed tab cannot be relied on. */
  useEffect(() => {
    const check = () => {
      const s = state.settings;
      if (!s.alarmsEnabled) return;
      const now = minutesNow();
      const key = dateKey();
      const fired = readFired();

      if (s.wakeAlarmEnabled) {
        const target = clockToMinutes(s.wakeTime);
        const already = fired[`${key}:wake`];
        const woken = Boolean(state.days[key]?.wakeActual);
        if (!already && !woken && now >= target && now < target + 30) {
          markFired(`${key}:wake`);
          ring("wake");
        }
      }

      if (s.bedAlarmEnabled) {
        const target = clockToMinutes(s.bedTime) - s.windDownMinutes;
        const already = fired[`${key}:bed`];
        const inBed = Boolean(state.days[key]?.bedActual);
        if (!already && !inBed && now >= target && now < target + 30) {
          markFired(`${key}:bed`);
          ring("bed");
        }
      }
    };

    const t = window.setInterval(check, 15_000);
    check();
    return () => window.clearInterval(t);
  }, [state.settings, state.days, ring]);

  const capabilities = useMemo(() => alarmCapabilities(audioUnlocked), [audioUnlocked]);

  const api = useMemo<AlarmApi>(
    () => ({ stage, ring, dismiss, capabilities, audioUnlocked, unlockAudio, testing }),
    [stage, ring, dismiss, capabilities, audioUnlocked, unlockAudio, testing],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {stage === "wake" ? <WakeStage onDone={dismiss} testing={testing} wakeUp={wakeUp} notify={notify} /> : null}
      {stage === "bed" ? <BedStage onDone={dismiss} testing={testing} /> : null}
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Wake stage
 * ------------------------------------------------------------------ */

function WakeStage({
  onDone,
  testing,
  wakeUp,
  notify,
}: {
  onDone: () => void;
  testing: boolean;
  wakeUp: () => void;
  notify: ReturnType<typeof useLife>["notify"];
}) {
  const { state, today, completeMorningStep } = useLife();
  const router = useRouter();
  const now = useNow(1000);
  const [risen, setRisen] = useState<{ planned: string; actual: string; delta: number } | null>(null);
  const day = getDay(state, today);
  const target = day.wakeTarget ?? state.settings.wakeTime;

  const onUp = () => {
    const actual = nowClock();
    const delta = clockDelta(target, actual);
    if (!testing) {
      wakeUp();
      notify({
        title: "Up and moving",
        body: `${formatDelta(delta)} against a ${target} target.`,
        tone: delta <= 5 ? "success" : "info",
        xp: 25,
      });
    }
    setRisen({ planned: target, actual, delta });
    getAlarmSound().stop();
    void getAlarmSound().ping("chime", state.settings.volume);
  };

  const verdict = (d: number) =>
    d <= 0 ? "Ahead of yourself." : d <= 5 ? "Excellent." : d <= 15 ? "Good enough. Go." : "Late. Tomorrow, no snooze.";

  return (
    <div className="stage fade" role="dialog" aria-modal="true" aria-label="Wake-up alarm">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        {testing ? (
          <div className="mb-8 self-center rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Test alarm
          </div>
        ) : null}

        {!risen ? (
          <>
            <div className="text-center">
              <div className="num text-shadow-soft text-[clamp(4.5rem,20vw,10rem)] leading-[0.85]">
                {now.toTimeString().slice(0, 5)}
              </div>
              <div className="kicker mt-5 text-white/50">
                {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>

            <div className="mt-12 text-center">
              <h1 className="display text-[clamp(1.8rem,7vw,3rem)] leading-[1.05]">
                GET UP.
                <br />
                <span style={{ color: "var(--accent)" }}>YOUR DAY STARTS NOW.</span>
              </h1>
            </div>

            <ol className="mx-auto mt-12 w-full max-w-md space-y-2.5">
              {WAKE_SEQUENCE.map((s, i) => (
                <li
                  key={s.id}
                  className="rise flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                  style={{ animationDelay: `${140 * i}ms` }}
                >
                  <span className="num w-6 text-center text-sm text-white/35">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold tracking-tight">{s.label}</span>
                    <span className="block text-[12px] text-white/45">{s.line}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-col items-center gap-4">
              <button
                onClick={onUp}
                className="relative grid h-32 w-32 place-items-center rounded-full text-lg font-bold tracking-[0.08em]"
                style={{
                  background: "linear-gradient(180deg, hsl(var(--a-h) var(--a-s) calc(var(--a-l) + 8%)), var(--accent))",
                  color: "hsl(var(--a-h) 60% 8%)",
                  boxShadow: "0 20px 60px -20px var(--accent-glow)",
                }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ border: "1px solid var(--accent)", animation: "life-pulse-ring 2.4s ease-out infinite" }}
                />
                I&apos;M UP
              </button>
              <button onClick={onDone} className="text-[12px] text-white/40 underline-offset-4 hover:underline">
                {testing ? "End test" : "Dismiss (costs the streak)"}
              </button>
            </div>
          </>
        ) : (
          <div className="pop text-center">
            <div
              className="mx-auto grid h-20 w-20 place-items-center rounded-full"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}
            >
              <Icon name="Check" className="h-9 w-9" strokeWidth={2.4} />
            </div>
            <h2 className="display mt-8 text-3xl">{verdict(risen.delta)}</h2>

            <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
              {[
                { k: "Planned", v: risen.planned },
                { k: "Actual", v: risen.actual },
                { k: "Delta", v: formatDelta(risen.delta) },
              ].map((c) => (
                <div key={c.k} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4">
                  <div className="kicker text-white/40">{c.k}</div>
                  <div className="num mt-2 text-xl">{c.v}</div>
                </div>
              ))}
            </div>

            {!testing ? (
              <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-6 text-[12px] text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="Flame" className="h-3.5 w-3.5" /> {streak(state, "protect-morning")} day streak
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="Activity" className="h-3.5 w-3.5" /> Momentum {momentum(state, today).score}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="Zap" className="h-3.5 w-3.5" /> +25 XP
                </span>
              </div>
            ) : null}

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Btn
                variant="accent"
                size="lg"
                icon="Sunrise"
                onClick={() => {
                  if (!testing) completeMorningStep("wake");
                  onDone();
                  router.push("/life/morning");
                }}
              >
                Start Morning Mode
              </Btn>
              <Btn size="lg" variant="ghost" onClick={onDone}>
                Later
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bedtime stage
 * ------------------------------------------------------------------ */

function BedStage({ onDone, testing }: { onDone: () => void; testing: boolean }) {
  const { state, today, goToBed, notify } = useLife();
  const router = useRouter();
  const now = useNow(1000);

  const bedTarget = getDay(state, today).bedTarget ?? state.settings.bedTime;
  const secondsLeft = useMemo(() => {
    const diff = clockToMinutes(bedTarget) - minutesNow(now);
    return Math.round((diff < -720 ? diff + 1440 : diff) * 60);
  }, [bedTarget, now]);
  const due = secondsLeft <= 0;

  return (
    <div className="stage fade" role="dialog" aria-modal="true" aria-label="Bedtime alarm">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        {testing ? (
          <div className="mb-8 self-center rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Test alarm
          </div>
        ) : null}

        <div className="text-center">
          <div className="num text-shadow-soft text-[clamp(4rem,17vw,8.5rem)] leading-[0.85]">
            {now.toTimeString().slice(0, 5)}
          </div>
          <h1 className="display mt-8 text-[clamp(1.6rem,6vw,2.6rem)] leading-tight">
            {due ? (
              <>
                TIME TO RESET.
                <br />
                <span style={{ color: "var(--accent)" }}>WIN TOMORROW TONIGHT.</span>
              </>
            ) : (
              "WIND DOWN"
            )}
          </h1>
          <p className="mt-4 text-[15px] text-white/50">
            {due ? "Everything else can wait until you have slept." : "Tomorrow starts tonight."}
          </p>
        </div>

        {!due ? (
          <div className="mt-10 text-center">
            <div className="kicker text-white/40">Until {bedTarget}</div>
            <div className="num mono mt-3 text-5xl" style={{ color: "var(--accent)" }}>
              {formatCountdown(secondsLeft)}
            </div>
          </div>
        ) : null}

        <ol className="mx-auto mt-10 w-full max-w-md space-y-2.5">
          {NIGHT_STEPS.map((s, i) => (
            <li
              key={s.id}
              className="rise flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              style={{ animationDelay: `${110 * i}ms` }}
            >
              <Icon name={s.icon} className="h-[18px] w-[18px] text-white/45" />
              <span className="flex-1">
                <span className="block text-[14px] font-semibold tracking-tight">{s.label}</span>
                <span className="block text-[12px] text-white/40">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Btn
            variant="accent"
            size="lg"
            icon="ClipboardCheck"
            onClick={() => {
              onDone();
              router.push("/life/night");
            }}
          >
            Start night routine
          </Btn>
          <Btn
            size="lg"
            icon="MoonStar"
            onClick={() => {
              if (!testing) {
                goToBed();
                notify({ title: "Lights out logged", body: "Bedtime recorded. Tomorrow is already set up.", tone: "success", xp: 25 });
              }
              onDone();
            }}
          >
            I&apos;m going to bed
          </Btn>
          <Btn size="lg" variant="ghost" onClick={onDone}>
            {testing ? "End test" : "Dismiss"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
