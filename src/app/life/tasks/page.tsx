"use client";

import { useMemo } from "react";
import { addDays, shortDate, weekOf, weekdayShort } from "@/lib/life/date";
import { getDay } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { Icon } from "@/components/life/icons";
import { Bar, Btn, Chip, Kicker, Panel, SectionHeader } from "@/components/life/ui";
import { PriorityCard } from "@/components/life/widgets";

export default function TasksPage() {
  const { state, today, setPriority, togglePriority, notify } = useLife();
  const day = getDay(state, today);
  const tomorrow = addDays(today, 1);
  const tomorrowDay = getDay(state, tomorrow);

  const week = useMemo(() => weekOf(today), [today]);
  const weekRows = week.map((k) => ({ key: k, day: state.days[k] }));

  const carried = useMemo(() => {
    const y = state.days[addDays(today, -1)];
    return (y?.priorities ?? []).filter((p) => p.title.trim() && !p.done);
  }, [state.days, today]);

  const doneCount = day.priorities.filter((p) => p.done).length;
  const setCount = day.priorities.filter((p) => p.title.trim()).length;

  const weekDone = weekRows.reduce((n, r) => n + (r.day?.priorities.filter((p) => p.done).length ?? 0), 0);
  const weekSet = weekRows.reduce((n, r) => n + (r.day?.priorities.filter((p) => p.title.trim()).length ?? 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Today's two"
        title="Two priorities decide the day."
        sub="Not a task list. Two things that, if they happen, make the day a win."
        action={
          <Chip tone={doneCount === 2 ? "accent" : "default"}>
            {doneCount} / {Math.max(2, setCount)} closed
          </Chip>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <PriorityCard index={0} />
        <PriorityCard index={1} />
      </section>

      {carried.length ? (
        <Panel className="rise p-5" style={{ borderColor: "color-mix(in srgb, var(--warn) 30%, transparent)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="Info" className="h-4 w-4" style={{ color: "var(--warn)" }} />
                <span className="kicker" style={{ color: "var(--warn)" }}>
                  Unfinished yesterday
                </span>
              </div>
              <p className="mt-2 text-[14px]">{carried.map((c) => c.title).join("  ·  ")}</p>
            </div>
            <Btn
              size="sm"
              icon="ArrowRight"
              onClick={() => {
                carried.slice(0, 2).forEach((c, i) => setPriority(i, c.title));
                notify({ title: "Carried over", body: "Yesterday's open priorities are now today's.", tone: "info" });
              }}
            >
              Carry into today
            </Btn>
          </div>
        </Panel>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <Kicker>This week</Kicker>
            <span className="text-[12px] text-[var(--ink-3)]">
              {weekDone} of {weekSet} closed
            </span>
          </div>
          <Bar value={weekSet ? (weekDone / weekSet) * 100 : 0} className="mt-4" />

          <div className="mt-5 space-y-1">
            {weekRows.map((row) => {
              const isToday = row.key === today;
              const priorities = row.day?.priorities.filter((p) => p.title.trim()) ?? [];
              return (
                <div
                  key={row.key}
                  className="flex items-start gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--panel)]"
                  style={isToday ? { background: "var(--panel-strong)" } : undefined}
                >
                  <div className="w-14 shrink-0">
                    <div className="text-[12px] font-semibold uppercase tracking-wider" style={isToday ? { color: "var(--accent)" } : undefined}>
                      {weekdayShort(row.key)}
                    </div>
                    <div className="text-[11px] text-[var(--ink-4)]">{shortDate(row.key)}</div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {priorities.length ? (
                      priorities.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <button
                            onClick={() => (isToday ? togglePriority(i) : undefined)}
                            disabled={!isToday}
                            aria-label={`Priority ${i + 1}`}
                            className="grid h-4 w-4 shrink-0 place-items-center rounded-full border transition"
                            style={{
                              borderColor: p.done ? "transparent" : "var(--hair-strong)",
                              background: p.done ? "var(--accent)" : "transparent",
                              color: "hsl(var(--a-h) 60% 8%)",
                              cursor: isToday ? "pointer" : "default",
                            }}
                          >
                            {p.done ? <Icon name="Check" className="h-2.5 w-2.5" strokeWidth={4} /> : null}
                          </button>
                          <span className={`truncate text-[13px] ${p.done ? "text-[var(--ink-4)] line-through" : ""}`}>
                            {p.title}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[13px] text-[var(--ink-4)]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-5">
          <Kicker>Tomorrow</Kicker>
          <h3 className="display mt-3 text-xl leading-tight">Win tomorrow tonight.</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
            Deciding at 06:30 costs willpower you need for the work itself. Decide now.
          </p>
          <div className="mt-5 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--hair)] bg-[var(--panel)] px-4 py-3">
                <div className="kicker">Priority #{i + 1}</div>
                <input
                  value={tomorrowDay.priorities[i]?.title ?? ""}
                  onChange={(e) => setPriority(i, e.target.value, tomorrow)}
                  placeholder={i === 0 ? "The hardest thing, first" : "The second lever"}
                  className="mt-1 w-full bg-transparent text-[14.5px] outline-none placeholder:text-[var(--ink-4)]"
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-[var(--ink-4)]">
            Saved to {shortDate(tomorrow)}. Completing both in the Night Routine closes “Win Tomorrow Tonight”.
          </p>
        </Panel>
      </section>
    </div>
  );
}
