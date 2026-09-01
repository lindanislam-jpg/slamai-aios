"use client";

import { useMemo, useState } from "react";
import { lastNDays, shortDate } from "@/lib/life/date";
import { completion, getDay, learningStreak, longestStreak, pagesRead } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { AreaChart, Heatmap, Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Field, Kicker, Modal, Panel, SectionHeader } from "@/components/life/ui";
import type { LearningEntry } from "@/lib/life/types";

const EMPTY: LearningEntry = { pages: 0, nugget: "", apply: "", teach: "" };

const CAPTURE = [
  {
    key: "nugget" as const,
    title: "Golden nugget",
    prompt: "What did I learn?",
    placeholder: "The one idea worth keeping from today's pages.",
    icon: "Sparkles",
  },
  {
    key: "apply" as const,
    title: "Apply it",
    prompt: "How will I use it?",
    placeholder: "A specific change to a specific part of tomorrow.",
    icon: "Zap",
  },
  {
    key: "teach" as const,
    title: "Teach it",
    prompt: "Who will I share it with?",
    placeholder: "Name the person. Teaching is the test of understanding.",
    icon: "Users",
  },
];

export default function LearningPage() {
  const { state, today, patchDay, setHabit, update, notify } = useLife();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.book);

  const day = getDay(state, today);
  const entry = day.learning ?? EMPTY;
  const read = pagesRead(state);
  const current = Math.min(state.book.totalPages, read);
  const progress = Math.round((current / state.book.totalPages) * 100);

  const write = (patch: Partial<LearningEntry>) => {
    patchDay(today, (d) => ({ ...d, learning: { ...EMPTY, ...d.learning, ...patch } }));
  };

  const finish = () => {
    patchDay(today, (d) => ({
      ...d,
      learning: { ...EMPTY, ...d.learning, completedAt: new Date().toISOString() },
    }));
    setHabit("learn", true);
    notify({
      title: "Learning logged",
      body: `${entry.pages} pages. ${learningStreak(state) + (day.habits.learn ? 0 : 1)} day streak.`,
      tone: "success",
      xp: 15,
    });
  };

  const pagesSeries = useMemo(
    () =>
      lastNDays(30, today).map((k) => ({
        label: shortDate(k),
        value: state.days[k]?.learning?.pages ?? 0,
      })),
    [state.days, today],
  );

  const heat = useMemo(
    () =>
      lastNDays(91, today).map((k) => ({
        key: k,
        value: state.days[k]?.habits.learn ? 1 : 0,
        title: `${shortDate(k)} — ${state.days[k]?.learning?.pages ?? 0} pages`,
      })),
    [state.days, today],
  );

  const nuggets = useMemo(
    () =>
      lastNDays(30, today)
        .map((k) => ({ key: k, entry: state.days[k]?.learning }))
        .filter((r) => r.entry?.nugget)
        .reverse()
        .slice(0, 6),
    [state.days, today],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Learn daily"
        title="Ten pages a day compounds."
        sub="Read, capture the one idea, decide how you will use it, name who you will teach."
        action={
          <Btn size="sm" variant="ghost" icon="Settings" onClick={() => setEditing(true)}>
            Change book
          </Btn>
        }
      />

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 sm:p-8 lg:col-span-7">
          <Kicker>Currently learning</Kicker>
          <h2 className="display mt-3 text-[clamp(1.5rem,3.5vw,2.1rem)] leading-tight">{state.book.title}</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-3)]">{state.book.author}</p>

          <div className="mt-8 flex flex-wrap items-center gap-8">
            <Ring value={progress} size={140} thickness={9} gap={64}>
              <div>
                <div className="num text-[32px] leading-none">{progress}%</div>
                <div className="kicker mt-1.5">Complete</div>
              </div>
            </Ring>
            <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <Kicker>Pages</Kicker>
                <div className="num mt-1.5 text-[24px]">
                  {current}
                  <span className="text-[14px] text-[var(--ink-4)]"> / {state.book.totalPages}</span>
                </div>
              </div>
              <div>
                <Kicker>Today&apos;s target</Kicker>
                <div className="num mt-1.5 text-[24px]">
                  {state.book.dailyTarget}
                  <span className="text-[14px] text-[var(--ink-4)]"> pages</span>
                </div>
              </div>
              <div>
                <Kicker>7 day rate</Kicker>
                <div className="num mt-1.5 text-[24px]">{completion(state, "learn", 7)}%</div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <Kicker>Pages logged today</Kicker>
              <span className="num text-[13px]">{entry.pages}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="range"
                min={0}
                max={60}
                value={entry.pages}
                onChange={(e) => write({ pages: Number(e.target.value) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(90deg, var(--accent) ${(entry.pages / 60) * 100}%, var(--panel-strong) ${(entry.pages / 60) * 100}%)`,
                }}
                aria-label="Pages read today"
              />
              {[5, 10, 20].map((n) => (
                <Btn key={n} size="sm" variant="ghost" onClick={() => write({ pages: n })}>
                  {n}
                </Btn>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="rise flex flex-col items-center justify-center p-8 lg:col-span-5">
          <div
            className="relative grid h-24 w-24 place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}
          >
            <Icon name="Flame" className="h-10 w-10" style={{ color: "var(--accent)" }} />
            <span
              className="absolute inset-0 rounded-full"
              style={{ border: "1px solid var(--accent-line)", animation: "life-pulse-ring 3s ease-out infinite" }}
            />
          </div>
          <div className="num mt-6 text-[64px] leading-none">{learningStreak(state)}</div>
          <div className="kicker mt-2">Day reading streak</div>
          <div className="mt-6 grid w-full grid-cols-2 gap-4 text-center">
            <div className="rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
              <div className="kicker">Longest</div>
              <div className="num mt-1 text-[20px]">{longestStreak(state, "learn")}</div>
            </div>
            <div className="rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
              <div className="kicker">30 day rate</div>
              <div className="num mt-1 text-[20px]">{completion(state, "learn", 30)}%</div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {CAPTURE.map((c, i) => (
          <Panel key={c.key} className="rise p-6" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center gap-2.5">
              <Icon name={c.icon} className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <span className="kicker">{c.title}</span>
            </div>
            <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{c.prompt}</h3>
            <textarea
              value={entry[c.key]}
              onChange={(e) => write({ [c.key]: e.target.value } as Partial<LearningEntry>)}
              rows={4}
              placeholder={c.placeholder}
              className="mt-3 w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[var(--ink-4)]"
            />
          </Panel>
        ))}
      </section>

      <Panel className="rise flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3">
          {day.learning?.completedAt ? <Chip tone="accent">Logged today</Chip> : <Chip>Not logged yet</Chip>}
          <span className="text-[13px] text-[var(--ink-3)]">
            {entry.pages >= state.book.dailyTarget
              ? "Target hit. That is the whole habit."
              : `${Math.max(0, state.book.dailyTarget - entry.pages)} pages to today's target.`}
          </span>
        </div>
        <Btn variant="accent" icon="Check" onClick={finish} disabled={!entry.pages && !entry.nugget.trim()}>
          Complete learning
        </Btn>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Pages · last 30 days</Kicker>
          <div className="mt-5">
            <AreaChart data={pagesSeries} height={180} min={0} formatValue={(v) => `${Math.round(v)} pages`} />
          </div>
        </Panel>
        <Panel className="rise p-6 lg:col-span-5">
          <Kicker>Consistency · 13 weeks</Kicker>
          <div className="mt-5">
            <Heatmap cells={heat} columns={13} />
          </div>
          <p className="mt-4 text-[12px] text-[var(--ink-4)]">Each square is a day. Filled means you read.</p>
        </Panel>
      </section>

      {nuggets.length ? (
        <section className="space-y-4">
          <SectionHeader kicker="Golden nuggets" title="What you have been taking in" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {nuggets.map((n) => (
              <Panel key={n.key} hover className="p-5">
                <span className="kicker">{shortDate(n.key)}</span>
                <p className="mt-3 text-[14px] leading-relaxed">“{n.entry?.nugget}”</p>
                {n.entry?.apply ? (
                  <p className="mt-3 border-l-2 pl-3 text-[12px] leading-relaxed text-[var(--ink-3)]" style={{ borderColor: "var(--accent-line)" }}>
                    {n.entry.apply}
                  </p>
                ) : null}
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <Modal open={editing} onClose={() => setEditing(false)}>
        <h3 className="display text-xl">What are you learning?</h3>
        <div className="mt-6 space-y-4">
          <Field label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Field label="Author" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Total pages"
              type="number"
              value={draft.totalPages}
              onChange={(e) => setDraft({ ...draft, totalPages: Number(e.target.value) })}
            />
            <Field
              label="Daily target"
              type="number"
              value={draft.dailyTarget}
              onChange={(e) => setDraft({ ...draft, dailyTarget: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          <Btn
            variant="accent"
            onClick={() => {
              update({ book: { ...draft, startedOn: draft.title === state.book.title ? state.book.startedOn : today } });
              setEditing(false);
              notify({ title: "Book updated", tone: "success" });
            }}
          >
            Save
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
