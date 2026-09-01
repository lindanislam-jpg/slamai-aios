"use client";

import { useEffect, useState } from "react";
import { clockToMinutes, formatCountdown, minutesNow } from "@/lib/life/date";
import { getAlarmSound, requestNotificationPermission, fireNotification } from "@/lib/life/alarm";
import { bedConsistency, wakeConsistency } from "@/lib/life/engine";
import { useLife, useMounted, useNow } from "@/lib/life/store";
import { useAlarm } from "@/components/life/AlarmLayer";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Kicker, Panel, SectionHeader, Toggle } from "@/components/life/ui";

export default function AlarmsPage() {
  const { state, updateSettings, notify } = useLife();
  const { ring, capabilities, audioUnlocked, unlockAudio } = useAlarm();
  const now = useNow(1000);
  const mounted = useMounted();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPermission(capabilities.notificationPermission);
  }, [capabilities.notificationPermission]);

  const s = state.settings;
  const wake = wakeConsistency(state, 30);
  const bed = bedConsistency(state, 30);

  const untilWake = secondsUntil(s.wakeTime, now);
  const untilBed = secondsUntil(s.bedTime, now);

  const facts = [
    {
      ok: capabilities.notifications && permission === "granted",
      title: "System notifications",
      detail:
        permission === "granted"
          ? "Granted. Alarms will also post a system notification while the app is running."
          : permission === "denied"
            ? "Blocked by the browser. Re-enable notifications for this site in your browser settings."
            : capabilities.notifications
              ? "Not requested yet. Grant permission so alarms can reach you outside this tab."
              : "This browser does not support the Notification API.",
    },
    {
      ok: audioUnlocked,
      title: "Alarm audio",
      detail: audioUnlocked
        ? "Unlocked. The alarm tone will play through this tab."
        : "Browsers block audio until you interact with the page. Tap “Unlock audio” once per session — otherwise the alarm is silent.",
    },
    {
      ok: capabilities.serviceWorker,
      title: "Service worker / installable",
      detail: capabilities.serviceWorker
        ? capabilities.standalone
          ? "Installed as an app. This is the most reliable way to run the alarms."
          : "Registered. Install Life OS to your home screen or dock for the most reliable behaviour."
        : "Not supported here, so the app cannot be installed or work offline.",
    },
    {
      ok: capabilities.scheduledNotifications,
      title: "Scheduled notifications (tab closed)",
      detail: capabilities.scheduledNotifications
        ? "This browser supports notification triggers, so a scheduled alarm can fire with the tab closed."
        : "Not available in this browser. No web app can guarantee an alarm with the tab closed — use your phone's built-in alarm as the backstop.",
    },
    {
      ok: capabilities.wakeLock,
      title: "Screen wake lock",
      detail: capabilities.wakeLock
        ? "Supported. The screen stays awake while an alarm is on screen."
        : "Not supported. The screen may sleep during the alarm.",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Alarms"
        title="Wake-up and bedtime."
        sub="Two alarms hold the whole system together: the one that starts the day and the one that protects tomorrow."
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <AlarmCard
          kind="wake"
          title="Wake-up alarm"
          time={s.wakeTime}
          enabled={s.wakeAlarmEnabled && s.alarmsEnabled}
          countdown={mounted ? formatCountdown(untilWake) : "--:--:--"}
          consistency={wake.rate}
          consistencyLabel="on time over 30 days"
          onTime={(v) => updateSettings({ wakeTime: v })}
          onToggle={(v) => updateSettings({ wakeAlarmEnabled: v })}
          onTest={() => ring("wake", { test: true })}
        />
        <AlarmCard
          kind="bed"
          title="Bedtime alarm"
          time={s.bedTime}
          enabled={s.bedAlarmEnabled && s.alarmsEnabled}
          countdown={mounted ? formatCountdown(untilBed) : "--:--:--"}
          consistency={bed.rate}
          consistencyLabel="on time over 30 days"
          onTime={(v) => updateSettings({ bedTime: v })}
          onToggle={(v) => updateSettings({ bedAlarmEnabled: v })}
          onTest={() => ring("bed", { test: true })}
          extra={
            <div className="mt-4">
              <Kicker>Wind-down starts</Kicker>
              <div className="mt-2 flex flex-wrap gap-2">
                {[15, 30, 45, 60].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateSettings({ windDownMinutes: n })}
                    className="chip"
                    style={
                      s.windDownMinutes === n
                        ? { color: "var(--accent)", borderColor: "var(--accent-line)", background: "var(--accent-soft)" }
                        : undefined
                    }
                  >
                    {n} min before
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </section>

      <Panel className="rise p-6">
        <Kicker>Controls</Kicker>
        <div className="mt-2 divide-y divide-[var(--hair)]">
          <Toggle
            label="Alarms enabled"
            description="The master switch. When off, no alarm fires and no notification is sent."
            checked={s.alarmsEnabled}
            onChange={(v) => updateSettings({ alarmsEnabled: v })}
          />
          <Toggle
            label="Alarm sound"
            description="A synthesised tone — no audio file to load, works offline."
            checked={s.sound}
            onChange={(v) => updateSettings({ sound: v })}
          />
        </div>
        <div className="mt-4">
          <Kicker>Volume</Kicker>
          <div className="mt-3 flex items-center gap-3">
            <Icon name="VolumeX" className="h-4 w-4 text-[var(--ink-4)]" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(90deg, var(--accent) ${s.volume * 100}%, var(--panel-strong) ${s.volume * 100}%)`,
              }}
              aria-label="Alarm volume"
            />
            <Icon name="Volume2" className="h-4 w-4 text-[var(--ink-4)]" />
            <Btn
              size="sm"
              variant="ghost"
              icon="Play"
              onClick={async () => {
                await unlockAudio();
                void getAlarmSound().ping("chime", s.volume);
              }}
            >
              Preview
            </Btn>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Btn
            icon="Bell"
            onClick={async () => {
              const result = await requestNotificationPermission();
              setPermission(result);
              updateSettings({ notificationsAsked: true });
              if (result === "granted") {
                await fireNotification("Notifications are on", "This is exactly how an alarm will look.", "life-test");
                notify({ title: "Notifications enabled", tone: "success" });
              } else {
                notify({
                  title: "Notifications not enabled",
                  body: result === "denied" ? "The browser blocked them." : "Permission was dismissed.",
                  tone: "warn",
                });
              }
            }}
          >
            Enable notifications
          </Btn>
          <Btn
            icon="Volume2"
            onClick={async () => {
              const ok = await unlockAudio();
              notify({
                title: ok ? "Audio unlocked" : "Audio still locked",
                body: ok ? "The alarm tone can play in this tab." : "Your browser refused to start the audio context.",
                tone: ok ? "success" : "warn",
              });
            }}
          >
            Unlock audio
          </Btn>
        </div>
      </Panel>

      <Panel className="rise p-6">
        <div className="flex items-start gap-3">
          <Icon name="Info" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-3)]" />
          <div>
            <Kicker>What this browser can actually guarantee</Kicker>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-3)]">
              An honest list, checked live on this device. A web app cannot promise to wake you with the tab closed —
              background timers are frozen and no cross-browser scheduled-alarm API exists. Keep your phone&apos;s
              built-in alarm as the backstop and use this one to run the routine.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {facts.map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                style={{
                  background: f.ok ? "color-mix(in srgb, var(--good) 16%, transparent)" : "color-mix(in srgb, var(--warn) 14%, transparent)",
                  color: f.ok ? "var(--good)" : "var(--warn)",
                }}
              >
                <Icon name={f.ok ? "Check" : "Minus"} className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{f.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function secondsUntil(clock: string, now: Date): number {
  let diff = clockToMinutes(clock) - minutesNow(now);
  if (diff < 0) diff += 1440;
  return Math.round(diff * 60);
}

function AlarmCard({
  kind,
  title,
  time,
  enabled,
  countdown,
  consistency,
  consistencyLabel,
  onTime,
  onToggle,
  onTest,
  extra,
}: {
  kind: "wake" | "bed";
  title: string;
  time: string;
  enabled: boolean;
  countdown: string;
  consistency: number;
  consistencyLabel: string;
  onTime: (v: string) => void;
  onToggle: (v: boolean) => void;
  onTest: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <Panel className="rise relative overflow-hidden p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "var(--accent-glow)", opacity: enabled ? 0.45 : 0.12 }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hair)] bg-[var(--panel-strong)]">
            <Icon name={kind === "wake" ? "Sunrise" : "MoonStar"} className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">{title}</div>
            <div className="text-[12px] text-[var(--ink-3)]">
              {consistency}% {consistencyLabel}
            </div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${title}`}
          onClick={() => onToggle(!enabled)}
          className="relative h-[26px] w-[46px] shrink-0 rounded-full border transition-all duration-300"
          style={{ background: enabled ? "var(--accent)" : "var(--panel-strong)", borderColor: enabled ? "transparent" : "var(--hair)" }}
        >
          <span
            className="absolute top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white transition-all duration-300"
            style={{ left: enabled ? 24 : 4 }}
          />
        </button>
      </div>

      <div className="relative mt-6 flex flex-wrap items-end gap-6">
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          aria-label={`${title} time`}
          className="num border-0 bg-transparent p-0 text-[clamp(2.6rem,8vw,3.4rem)] leading-none outline-none"
        />
        <div className="pb-1">
          <Kicker>In</Kicker>
          <div className="num mono mt-1 text-[18px]" style={{ color: enabled ? "var(--accent)" : "var(--ink-4)" }}>
            {countdown}
          </div>
        </div>
      </div>

      {extra}

      <div className="relative mt-6 flex flex-wrap items-center gap-2">
        <Btn variant="accent" icon="Play" onClick={onTest}>
          Test {kind === "wake" ? "wake-up" : "bedtime"} alarm
        </Btn>
        {!enabled ? <Chip tone="warn">Disabled</Chip> : <Chip tone="accent">Armed while the app is open</Chip>}
      </div>
    </Panel>
  );
}
