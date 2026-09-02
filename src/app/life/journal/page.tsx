"use client";

import { useMemo, useState } from "react";
import { getDay, streak } from "@/lib/life/engine";
import { lastNDays, shortDate } from "@/lib/life/date";
import { useLife } from "@/lib/life/store";
import { Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Kicker, Panel, SectionHeader } from "@/components/life/ui";
import { PriorityCard } from "@/components/life/widgets";
import type { JournalEntry } from "@/lib/life/types";

const EMPTY: JournalEntry = { brainDump: "", gratitude: ["", "", ""] };

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export default function JournalPage() {
  const { state, today, patchDay, setHabit, notify } = useLife();
  const day = getDay(state, today);
  const entry = day.journal ?? EMPTY;
  const [saved, setSaved] = useState(false);

  const prioritiesSet = day.priorities.filter((p) => p.title.trim()).length;
  const words = countWords(entry.brainDump);
  const gratitudeSet = entry.gratitude.filter((g) => g.trim()).length;
  // Three sections, each either done or not. Nothing here is estimated.
  const sectionsDone = (words > 0 ? 1 : 0) + (prioritiesSet === 2 ? 1 : 0) + (gratitudeSet === 3 ? 1 : 0);

  const history = useMemo(
    () =>
      lastNDays(14, today)
        .map((k) => ({ key: k, entry: state.days[k]?.journal }))
        .filter((r) => r.entry?.completedAt)
        .reverse(),
    [state.days, today],
  );

  const write = (patch: Partial<JournalEntry>) => {
    patchDay(today, (d) => ({ ...d, journal: { ...EMPTY, ...d.journal, ...patch } }));
    setSaved(false);
  };

  const finish = () => {
    patchDay(today, (d) => ({
      ...d,
      journal: { ...EMPTY, ...d.journal, completedAt: new Date().toISOString() },
    }));
    setHabit("journal", true);
    setSaved(true);
    notify({
      title: "Journal saved",
      body: `${words} word${words === 1 ? "" : "s"} out of your head. Head down, day open.`,
      tone: "success",
      xp: 15,
    });
  };

  return (
    <div className="space-y-6">
      <header className="rise flex flex-wrap items-end justify-between gap-6">
        <div>
          <Kicker>Mindful journalling</Kicker>
          <h1 className="display mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.05]">CLEAR YOUR MIND</h1>
          <p className="mt-3 text-[15px] text-[var(--ink-3)]">Get it out of your head.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <Kicker>Journal streak</Kicker>
            <div className="num mt-1 text-[26px]">{streak(state, "journal")}</div>
          </div>
          <Ring value={(sectionsDone / 3) * 100} size={92} thickness={6} glow={false}>
            <div className="num text-[20px]">{sectionsDone}/3</div>
          </Ring>
        </div>
      </header>

      {/* 01 — Brain dump */}
      <Panel className="rise overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--hair)] px-6 py-4">
          <span className="num text-[13px] text-[var(--ink-4)]">01</span>
          <span className="kicker">Brain dump</span>
          <span className="ml-auto text-[11px] text-[var(--ink-4)]">
            {words} word{words === 1 ? "" : "s"}
          </span>
        </div>
        <textarea
          value={entry.brainDump}
          onChange={(e) => write({ brainDump: e.target.value })}
          placeholder="Everything that is circling. Unsorted, unedited, unjudged. Keep going until the noise stops."
          className="min-h-[280px] w-full resize-y bg-transparent px-6 py-6 text-[16px] leading-[1.9] outline-none placeholder:text-[var(--ink-4)] sm:px-8 sm:text-[17px]"
          spellCheck
        />
      </Panel>

      {/* 02 — Today's two */}
      <section className="rise space-y-4">
        <div className="flex items-center gap-3">
          <span className="num text-[13px] text-[var(--ink-4)]">02</span>
          <span className="kicker">Today&apos;s two</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PriorityCard index={0} />
          <PriorityCard index={1} />
        </div>
      </section>

      {/* 03 — Gratitude */}
      <section className="rise space-y-4">
        <div className="flex items-center gap-3">
          <span className="num text-[13px] text-[var(--ink-4)]">03</span>
          <span className="kicker">Gratitude</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Panel key={i} className="p-5">
              <div className="flex items-center justify-between">
                <Icon name="Sparkles" className="h-4 w-4 text-[var(--ink-4)]" />
                <span className="num text-[12px] text-[var(--ink-4)]">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <textarea
                value={entry.gratitude[i] ?? ""}
                onChange={(e) => {
                  const gratitude = [...entry.gratitude] as [string, string, string];
                  gratitude[i] = e.target.value;
                  write({ gratitude });
                }}
                rows={3}
                placeholder={["Something that happened", "Someone who helped", "Something you have"][i]}
                className="mt-3 w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-[var(--ink-4)]"
              />
            </Panel>
          ))}
        </div>
      </section>

      <Panel className="rise flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="kicker">Today&apos;s entry</span>
            {day.journal?.completedAt ? <Chip tone="accent">Completed today</Chip> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-2">
            <span>
              <span className="num text-[30px] leading-none">{words}</span>
              <span className="ml-2 text-[12px] text-[var(--ink-4)]">word{words === 1 ? "" : "s"}</span>
            </span>
            <span>
              <span className="num text-[30px] leading-none">{prioritiesSet}/2</span>
              <span className="ml-2 text-[12px] text-[var(--ink-4)]">priorities</span>
            </span>
            <span>
              <span className="num text-[30px] leading-none">{gratitudeSet}/3</span>
              <span className="ml-2 text-[12px] text-[var(--ink-4)]">gratitude</span>
            </span>
          </div>
        </div>
        <Btn variant="accent" size="lg" icon="Check" onClick={finish} disabled={!entry.brainDump.trim()}>
          {saved || day.journal?.completedAt ? "Journal saved" : "Complete journal"}
        </Btn>
      </Panel>

      {history.length ? (
        <section className="space-y-4">
          <SectionHeader kicker="Recent entries" title="What was on your mind" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {history.map((h) => (
              <Panel key={h.key} hover className="p-5">
                <div className="flex items-center justify-between">
                  <span className="kicker">{shortDate(h.key)}</span>
                  <Icon name="PenLine" className="h-3.5 w-3.5 text-[var(--ink-4)]" />
                </div>
                <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-[var(--ink-2)]">
                  {h.entry?.brainDump}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {h.entry?.gratitude.filter(Boolean).map((g, i) => (
                    <span key={i} className="chip max-w-full truncate">
                      {g}
                    </span>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
