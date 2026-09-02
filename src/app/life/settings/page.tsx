"use client";

import { useRef, useState } from "react";
import { useLife } from "@/lib/life/store";
import { visibleDays } from "@/lib/life/engine";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Field, Kicker, Modal, Panel, SectionHeader, TextArea, Toggle } from "@/components/life/ui";
import type { AccentId } from "@/lib/life/types";

const ACCENTS: { id: AccentId; label: string; hue: number }[] = [
  { id: "aurora", label: "Aurora", hue: 158 },
  { id: "ember", label: "Ember", hue: 22 },
  { id: "signal", label: "Signal", hue: 212 },
  { id: "violet", label: "Violet", hue: 266 },
  { id: "ice", label: "Ice", hue: 190 },
];

const SHORTCUTS = [
  { keys: "⌘K / Ctrl K", action: "Command palette" },
  { keys: "C", action: "AI Life Coach" },
  { keys: "D", action: "Dashboard" },
  { keys: "M", action: "Morning" },
  { keys: "J", action: "Journal" },
  { keys: "L", action: "Learning" },
  { keys: "H", action: "Habits" },
  { keys: "N", action: "Night" },
  { keys: "W", action: "Weekly" },
  { keys: "P", action: "Progress" },
];

export default function SettingsPage() {
  const { state, update, updateSettings, exportJson, importJson, resetAll, deleteDemoHistory, notify } = useLife();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [profile, setProfile] = useState(state.profile);

  const s = state.settings;
  const seeded = Object.values(state.days).filter((d) => d.seeded).length;
  // Older versions also seeded sample people and environment changes under fixed
  // ids. Offer the cleanup whenever any of it is still present.
  const samplePeople = state.people.filter((x) => /^p[1-5]$/.test(x.id)).length;
  const sampleChanges = state.envChanges.filter((x) => /^e[1-5]$/.test(x.id)).length;
  const hasSamples = seeded > 0 || samplePeople > 0 || sampleChanges > 0;
  const real = Object.keys(visibleDays(state)).length - (s.showDemoHistory ? seeded : 0);

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elite-life-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: "Backup downloaded", body: "A full JSON export of everything in the app.", tone: "success" });
  };

  const upload = async (file: File) => {
    const text = await file.text();
    const result = importJson(text);
    notify({
      title: result.ok ? "Backup restored" : "Import failed",
      body: result.ok ? "Every day, habit and note is back." : result.error,
      tone: result.ok ? "success" : "warn",
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader kicker="System" title="Settings" sub="Everything is stored on this device. Nothing leaves it unless you export it." />

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel className="rise p-6">
          <Kicker>Profile</Kicker>
          <div className="mt-4 space-y-4">
            <Field label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <TextArea
              label="Mission"
              rows={3}
              value={profile.mission}
              onChange={(e) => setProfile({ ...profile, mission: e.target.value })}
            />
            <Btn
              variant="accent"
              icon="Check"
              onClick={() => {
                update({ profile });
                notify({ title: "Profile saved", tone: "success" });
              }}
            >
              Save profile
            </Btn>
          </div>
        </Panel>

        <Panel className="rise p-6">
          <Kicker>Rhythm</Kicker>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Wake time" type="time" value={s.wakeTime} onChange={(e) => updateSettings({ wakeTime: e.target.value })} />
            <Field label="Bed time" type="time" value={s.bedTime} onChange={(e) => updateSettings({ bedTime: e.target.value })} />
          </div>
          <div className="mt-5">
            <Kicker>Protected morning</Kicker>
            <div className="mt-3 flex flex-wrap gap-2">
              {[30, 45, 60, 90].map((n) => (
                <button
                  key={n}
                  onClick={() => updateSettings({ protectedMinutes: n })}
                  className="chip"
                  style={
                    s.protectedMinutes === n
                      ? { color: "var(--accent)", borderColor: "var(--accent-line)", background: "var(--accent-soft)" }
                      : undefined
                  }
                >
                  {n} minutes
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <Panel className="rise p-6">
        <Kicker>Appearance</Kicker>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateSettings({ theme: t })}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition"
              style={{
                borderColor: s.theme === t ? "var(--accent-line)" : "var(--hair)",
                background: s.theme === t ? "var(--accent-soft)" : "var(--panel)",
                color: s.theme === t ? "var(--accent)" : "var(--ink-2)",
              }}
            >
              <Icon name={t === "dark" ? "MoonStar" : "Sunrise"} className="h-4 w-4" />
              {t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <Kicker>Accent</Kicker>
          <div className="mt-3 flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => updateSettings({ accent: a.id })}
                aria-label={a.label}
                className="group flex flex-col items-center gap-2"
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full border-2 transition-transform group-hover:scale-105"
                  style={{
                    background: `hsl(${a.hue} 84% 52%)`,
                    borderColor: s.accent === a.id ? "var(--ink)" : "transparent",
                  }}
                >
                  {s.accent === a.id ? <Icon name="Check" className="h-4 w-4 text-black" strokeWidth={3} /> : null}
                </span>
                <span className="text-[11px] text-[var(--ink-3)]">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--hair)]">
          <Toggle
            label="Reduced motion"
            description="Turns off animated transitions across the whole app. Your system preference is respected automatically too."
            checked={s.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
          <Toggle
            label="Alarm sound"
            description="A synthesised tone. Turning this off leaves the visual alarm only."
            checked={s.sound}
            onChange={(v) => updateSettings({ sound: v })}
          />
        </div>
      </Panel>

      <Panel className="rise p-6">
        <Kicker>Data</Kicker>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Chip>{real} real day{real === 1 ? "" : "s"} logged</Chip>
          {seeded ? <Chip tone="warn">{seeded} demo days</Chip> : null}
          {samplePeople ? <Chip tone="warn">{samplePeople} sample people</Chip> : null}
          {sampleChanges ? <Chip tone="warn">{sampleChanges} sample changes</Chip> : null}
        </div>

        <div className="mt-4 divide-y divide-[var(--hair)]">
          <Toggle
            label="Include demo history in analytics"
            description="A generated 90-day history so charts have something to say on day one. Turn it off to see only what you have actually lived."
            checked={s.showDemoHistory}
            onChange={(v) => updateSettings({ showDemoHistory: v })}
            disabled={!seeded}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Btn icon="Download" onClick={download}>
            Export backup
          </Btn>
          <Btn icon="Import" onClick={() => fileRef.current?.click()}>
            Import backup
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          {hasSamples ? (
            <Btn
              icon="Trash2"
              variant="ghost"
              onClick={() => {
                deleteDemoHistory();
                notify({
                  title: "Sample data deleted",
                  body: "Generated days, sample people and sample changes are gone. Only your own entries remain.",
                  tone: "success",
                });
              }}
            >
              Delete all sample data
            </Btn>
          ) : null}
          <Btn icon="RotateCcw" variant="ghost" onClick={() => setConfirmReset(true)}>
            Reset everything
          </Btn>
        </div>
      </Panel>

      <Panel className="rise p-6">
        <Kicker>Keyboard shortcuts</Kicker>
        <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {SHORTCUTS.map((k) => (
            <div key={k.action} className="flex items-center justify-between border-b border-[var(--hair)] py-2 text-[13px] last:border-0">
              <span className="text-[var(--ink-2)]">{k.action}</span>
              <kbd className="rounded border border-[var(--hair)] bg-[var(--panel)] px-2 py-0.5 text-[11px] text-[var(--ink-3)]">
                {k.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="rise p-6">
        <div className="flex items-start gap-3">
          <Icon name="Shield" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-3)]" />
          <div>
            <Kicker>Where your data lives</Kicker>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-3)]">
              Everything — habits, journal entries, priorities, the whole log — is kept in this browser&apos;s local
              storage on this device. It is never uploaded. Clearing site data or switching browser will lose it, so
              export a backup regularly. The AI Coach is the one exception: when a model key is configured, the question
              and a compact metrics snapshot are sent to that model to answer. Without a key, the coach runs entirely
              on-device.
            </p>
          </div>
        </div>
      </Panel>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)}>
        <h3 className="display text-xl">Reset everything?</h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
          This deletes every habit, journal entry, priority and setting on this device. Export a backup first if there
          is anything worth keeping.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn variant="ghost" onClick={() => setConfirmReset(false)}>
            Cancel
          </Btn>
          <Btn
            onClick={() => {
              resetAll(false);
              setConfirmReset(false);
              notify({ title: "Reset to empty", body: "A clean system, no demo data.", tone: "success" });
            }}
          >
            Reset, no demo data
          </Btn>
          <Btn
            variant="accent"
            onClick={() => {
              resetAll(true);
              setConfirmReset(false);
              notify({ title: "Reset with demo history", tone: "success" });
            }}
          >
            Reset with demo history
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
