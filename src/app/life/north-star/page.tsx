"use client";

import { useMemo, useState } from "react";
import { lastNDays, shortDate } from "@/lib/life/date";
import { getDay, northStarChange, northStarLatest, northStarSeries } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { AreaChart, Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Delta, Field, Kicker, Modal, Panel, SectionHeader, Segmented } from "@/components/life/ui";
import type { NorthStar } from "@/lib/life/types";

const RANGES = [
  { value: "1", label: "Yesterday" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

const PRESETS: { label: string; ns: NorthStar }[] = [
  { label: "Business growth", ns: { label: "Business Growth", unit: "€", unitPosition: "prefix", target: 10000, direction: "up" } },
  { label: "Monthly revenue", ns: { label: "Monthly Revenue", unit: "€", unitPosition: "prefix", target: 25000, direction: "up" } },
  { label: "Deep work hours", ns: { label: "Deep Work Hours", unit: "hrs", unitPosition: "suffix", target: 4, direction: "up" } },
  { label: "Body weight", ns: { label: "Body Weight", unit: "kg", unitPosition: "suffix", target: 78, direction: "down" } },
  { label: "Followers", ns: { label: "Audience", unit: "", unitPosition: "suffix", target: 10000, direction: "up" } },
];

export default function NorthStarPage() {
  const { state, today, logNorthStar, update, notify } = useLife();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NorthStar>(state.northStar);
  const [entry, setEntry] = useState("");

  const ns = state.northStar;
  const latest = northStarLatest(state);
  const todayValue = getDay(state, today).northStar;
  const progress = latest ? (latest.value / ns.target) * 100 : 0;

  const fmt = (v: number) =>
    ns.unitPosition === "prefix" ? `${ns.unit}${v.toLocaleString()}` : `${v.toLocaleString()}${ns.unit ? ` ${ns.unit}` : ""}`;

  const series = useMemo(() => {
    const days = Number(range) === 1 ? 7 : Number(range);
    const points = northStarSeries(state, days, today);
    return points.map((p) => ({ label: shortDate(p.date), value: p.value }));
  }, [state, range, today]);

  const change = northStarChange(state, Number(range) === 1 ? 1 : Number(range));

  const recent = useMemo(
    () =>
      lastNDays(10, today)
        .map((k) => ({ key: k, value: state.days[k]?.northStar }))
        .reverse(),
    [state.days, today],
  );

  const log = () => {
    const v = Number(entry);
    if (!Number.isFinite(v)) return;
    logNorthStar(v);
    setEntry("");
    notify({ title: `${ns.label} logged`, body: fmt(v), tone: "success", xp: 20 });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="North Star"
        title="One number. Every day."
        sub="What gets measured honestly is what improves. Everything else is a story you tell yourself."
        action={
          <div className="flex gap-2">
            <Segmented value={range} onChange={setRange} options={[...RANGES]} />
            <Btn size="sm" variant="ghost" icon="Settings" onClick={() => setEditing(true)}>
              Change metric
            </Btn>
          </div>
        }
      />

      <Panel className="rise relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "var(--accent-glow)", opacity: 0.45 }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <Kicker>{ns.label}</Kicker>
            <div className="num mt-3 text-[clamp(3rem,10vw,5.5rem)] leading-[0.9]">
              {ns.unitPosition === "prefix" ? <span className="text-[0.5em] align-super">{ns.unit}</span> : null}
              <CountUp value={latest?.value ?? 0} format={(v) => Math.round(v).toLocaleString()} />
              {ns.unitPosition === "suffix" && ns.unit ? (
                <span className="ml-2 text-[0.34em] text-[var(--ink-3)]">{ns.unit}</span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-[13px] text-[var(--ink-3)]">Target {fmt(ns.target)}</span>
              {change !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Delta value={Math.round(change * 10) / 10} suffix="%" />
                  <span className="text-[12px] text-[var(--ink-4)]">
                    over {Number(range) === 1 ? "a day" : `${range} days`}
                  </span>
                </span>
              ) : null}
              {latest ? (
                <Chip>{latest.date === today ? "Logged today" : `Last logged ${shortDate(latest.date)}`}</Chip>
              ) : null}
            </div>
          </div>

          <Ring value={Math.min(100, progress)} size={172} thickness={10} gap={64}>
            <div>
              <div className="num text-[34px] leading-none">{progress.toFixed(1)}%</div>
              <div className="kicker mt-1.5">Of target</div>
            </div>
          </Ring>
        </div>

        <div className="relative mt-8">
          {series.length > 1 ? (
            <AreaChart data={series} height={230} target={ns.target} formatValue={fmt} />
          ) : (
            <p className="py-10 text-center text-[13px] text-[var(--ink-3)]">
              Log a few days and the trend line appears here.
            </p>
          )}
        </div>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-5">
          <Kicker>Log today</Kicker>
          <h3 className="display mt-3 text-xl">
            {typeof todayValue === "number" ? `Today: ${fmt(todayValue)}` : "Today is not logged yet."}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
            Log it even when it is bad. A blank day is worse than a bad number — it hides the trend.
          </p>
          <div className="mt-5 flex gap-2">
            <input
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && log()}
              inputMode="decimal"
              placeholder={String(latest?.value ?? 0)}
              className="field num text-[18px]"
              aria-label={`Today's ${ns.label}`}
            />
            <Btn variant="accent" icon="Check" onClick={log} disabled={!entry.trim()}>
              Log
            </Btn>
          </div>

          <div className="mt-6 space-y-1">
            {recent.map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--panel)]">
                <span className="text-[var(--ink-3)]">{r.key === today ? "Today" : shortDate(r.key)}</span>
                <span className="num">{typeof r.value === "number" ? fmt(r.value) : "—"}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Why one metric</Kicker>
          <h3 className="display mt-3 text-xl leading-tight">
            Ten metrics is a dashboard. One metric is a decision.
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-3)]">
            The North Star is the number that, if it moves, everything else follows. It should be uncomfortable to
            look at on a bad week — that is the point of it.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "Yesterday", n: 1 },
              { k: "7 days", n: 7 },
              { k: "30 days", n: 30 },
              { k: "90 days", n: 90 },
            ].map((c) => {
              const ch = northStarChange(state, c.n);
              return (
                <div key={c.k} className="rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
                  <div className="kicker">{c.k}</div>
                  <div
                    className="num mt-1.5 text-[19px]"
                    style={{ color: ch === null ? undefined : ch >= 0 ? "var(--good)" : "var(--bad)" }}
                  >
                    {ch === null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
            <Icon name="Info" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-4)]" />
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">
              Logging the North Star completes the “Measure What Matters” habit for the day.
            </p>
          </div>
        </Panel>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)}>
        <h3 className="display text-xl">Your North Star</h3>
        <p className="mt-2 text-[13px] text-[var(--ink-3)]">Pick a preset or define your own.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setDraft(p.ns)} className="chip hover:border-[var(--hair-strong)]">
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Metric name" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Unit" value={draft.unit} placeholder="€, kg, hrs…" onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            <Field
              label="Target"
              type="number"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="radio"
                checked={draft.unitPosition === "prefix"}
                onChange={() => setDraft({ ...draft, unitPosition: "prefix" })}
              />
              Unit before ({draft.unit}1,000)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="radio"
                checked={draft.unitPosition === "suffix"}
                onChange={() => setDraft({ ...draft, unitPosition: "suffix" })}
              />
              Unit after (1,000 {draft.unit})
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          <Btn
            variant="accent"
            onClick={() => {
              update({ northStar: draft });
              setEditing(false);
              notify({ title: "North Star updated", body: draft.label, tone: "success" });
            }}
          >
            Save
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
