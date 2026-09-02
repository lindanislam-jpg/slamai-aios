"use client";

import { useState } from "react";
import Link from "next/link";
import { shortDate } from "@/lib/life/date";
import { completion, getDay, streak } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { Icon } from "@/components/life/icons";
import { Bar, Btn, Chip, EmptyState, Kicker, Panel, SectionHeader } from "@/components/life/ui";

const LANES = [
  {
    kind: "easy" as const,
    title: "MAKE GOOD HABITS EASY.",
    sub: "Remove every step between you and the right action.",
    icon: "Zap",
    tone: "var(--good)",
    placeholder: "e.g. Training clothes laid out the night before",
  },
  {
    kind: "hard" as const,
    title: "MAKE BAD HABITS HARD.",
    sub: "Add friction until the wrong action costs more than it is worth.",
    icon: "Lock",
    tone: "var(--bad)",
    placeholder: "e.g. Social apps deleted from the phone",
  },
];

export default function EnvironmentPage() {
  const { state, today, addEnvChange, toggleEnvChange, removeEnvChange, toggleHabit, notify } = useLife();
  const [drafts, setDrafts] = useState<Record<string, string>>({ easy: "", hard: "" });
  const day = getDay(state, today);
  const done = Boolean(day.habits.environment);

  const submit = (kind: "easy" | "hard") => {
    const text = drafts[kind].trim();
    if (!text) return;
    addEnvChange(kind, text);
    setDrafts((d) => ({ ...d, [kind]: "" }));
    notify({ title: "Change added", body: text, tone: "success" });
  };

  const applied = state.envChanges.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Environment engineering"
        title="Discipline is expensive. Design is cheap."
        sub="Change the room and the habit follows. This is the highest-leverage habit of the eight."
        action={
          <Btn
            size="sm"
            variant={done ? "ghost" : "accent"}
            icon="Check"
            onClick={() => {
              toggleHabit("environment");
              if (!done) notify({ title: "Environment engineered", tone: "success", xp: 20 });
            }}
          >
            {done ? "Completed today" : "Mark done today"}
          </Btn>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Panel className="rise p-5">
          <Kicker>Changes applied</Kicker>
          <div className="num mt-2.5 text-[30px] leading-none">
            {applied}
            <span className="text-[15px] text-[var(--ink-4)]"> / {state.envChanges.length}</span>
          </div>
          <Bar value={state.envChanges.length ? (applied / state.envChanges.length) * 100 : 0} className="mt-4" />
        </Panel>
        <Panel className="rise p-5">
          <Kicker>Habit streak</Kicker>
          <div className="num mt-2.5 text-[30px] leading-none">{streak(state, "environment")}</div>
          <p className="mt-2 text-[12px] text-[var(--ink-3)]">{completion(state, "environment", 30)}% over 30 days</p>
        </Panel>
        <Panel className="rise p-5">
          <Kicker>Map</Kicker>
          <div className="mt-3 flex gap-2">
            <Link href="/life/people">
              <Btn size="sm" variant="ghost" icon="Users">
                {state.people.length} people
              </Btn>
            </Link>
            <Link href="/life/places">
              <Btn size="sm" variant="ghost" icon="MapPin">
                {state.places.length} places
              </Btn>
            </Link>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {LANES.map((lane) => {
          const items = state.envChanges.filter((c) => c.kind === lane.kind);
          return (
            <Panel key={lane.kind} className="rise flex flex-col p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--panel-strong)", color: lane.tone }}>
                  <Icon name={lane.icon} className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="display text-[19px] leading-tight">{lane.title}</h2>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{lane.sub}</p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <input
                  value={drafts[lane.kind]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [lane.kind]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submit(lane.kind)}
                  placeholder={lane.placeholder}
                  className="field"
                />
                <Btn icon="Plus" onClick={() => submit(lane.kind)} disabled={!drafts[lane.kind].trim()}>
                  Add
                </Btn>
              </div>

              <div className="mt-5 flex-1 space-y-1.5">
                {items.length === 0 ? (
                  <EmptyState
                    icon={lane.icon}
                    title="Nothing here yet"
                    body={
                      lane.kind === "easy"
                        ? "Name one thing that would make tomorrow's first habit effortless."
                        : "Name one thing that would make your worst habit annoying to start."
                    }
                  />
                ) : (
                  items.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--panel)] px-3.5 py-3"
                    >
                      <button
                        onClick={() => toggleEnvChange(c.id)}
                        aria-label={c.done ? "Mark not applied" : "Mark applied"}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border transition active:scale-90"
                        style={{
                          borderColor: c.done ? "transparent" : "var(--hair-strong)",
                          background: c.done ? lane.tone : "transparent",
                          color: "#05070a",
                        }}
                      >
                        {c.done ? <Icon name="Check" className="h-3.5 w-3.5" strokeWidth={3.4} /> : null}
                      </button>
                      <span className={`flex-1 text-[13.5px] ${c.done ? "text-[var(--ink-3)] line-through decoration-[var(--ink-4)]" : ""}`}>
                        {c.text}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-[var(--ink-4)]">{shortDate(c.createdOn)}</span>
                      <button
                        onClick={() => removeEnvChange(c.id)}
                        aria-label="Remove"
                        className="shrink-0 text-[var(--ink-4)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--bad)]"
                      >
                        <Icon name="Trash2" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          );
        })}
      </section>

      <Panel className="rise p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <Kicker>The rule</Kicker>
            <h3 className="display mt-3 text-[clamp(1.3rem,3vw,1.8rem)] leading-tight">
              If a habit needs willpower every day, the environment is wrong — not you.
            </h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
              Every entry above is a permanent change you only have to make once. That is why this habit compounds
              faster than the other seven.
            </p>
          </div>
          <div className="flex gap-2">
            <Chip tone="good">{state.envChanges.filter((c) => c.kind === "easy" && c.done).length} easier</Chip>
            <Chip tone="bad">{state.envChanges.filter((c) => c.kind === "hard" && c.done).length} harder</Chip>
          </div>
        </div>
      </Panel>
    </div>
  );
}
