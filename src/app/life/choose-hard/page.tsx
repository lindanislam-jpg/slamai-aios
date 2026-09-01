"use client";

import { useState } from "react";
import { addDays, dateKey, shortDate } from "@/lib/life/date";
import { challengeProgress, completion, getDay, streak } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { ClimbPath } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Field, Kicker, Modal, Panel, SectionHeader, TextArea } from "@/components/life/ui";
import type { Challenge } from "@/lib/life/types";

export default function ChooseHardPage() {
  const { state, today, update, toggleMilestone, toggleHabit, notify } = useLife();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Challenge>(state.challenge);
  const [newMilestone, setNewMilestone] = useState("");

  const ch = challengeProgress(state, today);
  const day = getDay(state, today);
  const hardDone = Boolean(day.habits["choose-hard"]);

  const addMilestone = () => {
    const label = newMilestone.trim();
    if (!label) return;
    const milestones = [...state.challenge.milestones, { id: crypto.randomUUID(), label, at: 1, done: false }];
    // Re-space every milestone evenly along the climb.
    const spaced = milestones.map((m, i) => ({ ...m, at: (i + 1) / milestones.length }));
    update({ challenge: { ...state.challenge, milestones: spaced } });
    setNewMilestone("");
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Choose hard"
        title="CHOOSE HARD."
        sub="Easy choices, hard life. Hard choices, easy life. Pick the uncomfortable option on purpose."
        action={
          <Btn size="sm" variant="ghost" icon="Settings" onClick={() => setEditing(true)}>
            Edit challenge
          </Btn>
        }
      />

      <Panel className="rise relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "var(--accent-glow)", opacity: 0.4 }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-8">
          <div className="min-w-0">
            <Kicker>The challenge</Kicker>
            <h2 className="display mt-3 text-[clamp(1.8rem,5vw,3rem)] uppercase leading-[1.02]">
              {state.challenge.title}
            </h2>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-[var(--ink-3)]">{state.challenge.why}</p>
          </div>

          <div className="flex gap-8">
            <div>
              <Kicker>Days remaining</Kicker>
              <div className="num mt-2 text-[46px] leading-none">
                <CountUp value={ch.daysRemaining} />
              </div>
            </div>
            <div>
              <Kicker>Progress</Kicker>
              <div className="num mt-2 text-[46px] leading-none">
                <CountUp value={ch.progress} />
                <span className="text-[22px]">%</span>
              </div>
              <div className="mt-2">
                <Chip tone={ch.pace >= 0 ? "good" : "warn"}>
                  {ch.pace >= 0 ? `${ch.pace} ahead of the calendar` : `${Math.abs(ch.pace)} behind the calendar`}
                </Chip>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-8">
          <ClimbPath
            progress={ch.progress / 100}
            milestones={state.challenge.milestones}
            onMilestone={(id) => {
              const m = state.challenge.milestones.find((x) => x.id === id);
              toggleMilestone(id);
              if (m && !m.done) {
                notify({ title: "Milestone reached", body: m.label, tone: "success", xp: 100 });
              }
            }}
            height={260}
          />
          <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
            <span>Start · {shortDate(state.challenge.startDate)}</span>
            <span>You are here</span>
            <span>Finish · {shortDate(state.challenge.endDate)}</span>
          </div>
        </div>

        {ch.complete ? (
          <div className="relative mt-8 rounded-2xl border p-6 text-center" style={{ borderColor: "var(--accent-line)", background: "var(--accent-soft)" }}>
            <Icon name="Trophy" className="mx-auto h-8 w-8" style={{ color: "var(--accent)" }} />
            <h3 className="display mt-4 text-2xl">YOU DID THE HARD THING.</h3>
            <p className="mt-2 text-[13px] text-[var(--ink-2)]">
              Every milestone is closed. Set the next one before the feeling fades.
            </p>
          </div>
        ) : null}
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <Kicker>Milestones</Kicker>
            <span className="text-[12px] text-[var(--ink-3)]">
              {ch.doneMilestones} / {ch.milestoneCount}
            </span>
          </div>
          <ol className="mt-5 space-y-1">
            {state.challenge.milestones.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3.5 rounded-xl px-1 py-2.5 transition hover:bg-[var(--panel)]">
                <button
                  onClick={() => {
                    toggleMilestone(m.id);
                    if (!m.done) notify({ title: "Milestone reached", body: m.label, tone: "success", xp: 100 });
                  }}
                  aria-label={`Toggle ${m.label}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border transition active:scale-90"
                  style={{
                    borderColor: m.done ? "transparent" : "var(--hair-strong)",
                    background: m.done ? "var(--accent)" : "transparent",
                    color: m.done ? "hsl(var(--a-h) 60% 8%)" : "var(--ink-4)",
                  }}
                >
                  {m.done ? <Icon name="Check" className="h-4 w-4" strokeWidth={3} /> : <span className="num text-[12px]">{i + 1}</span>}
                </button>
                <span className={`flex-1 text-[14px] ${m.done ? "text-[var(--ink-3)]" : ""}`}>{m.label}</span>
                {m.doneOn ? <span className="text-[11px] text-[var(--ink-4)]">{shortDate(m.doneOn)}</span> : null}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            <input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
              placeholder="Add a milestone…"
              className="field"
            />
            <Btn icon="Plus" onClick={addMilestone} disabled={!newMilestone.trim()}>
              Add
            </Btn>
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-5">
          <Panel className="rise p-6" style={hardDone ? { borderColor: "var(--accent-line)" } : undefined}>
            <Kicker>Today&apos;s hard thing</Kicker>
            <h3 className="display mt-3 text-xl leading-tight">
              {hardDone ? "Done. That is the whole habit." : "Pick the uncomfortable option."}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
              Cold shower, the call you are avoiding, the set you would normally skip, the honest sentence. One a day.
            </p>
            <Btn
              className="mt-5"
              variant={hardDone ? "ghost" : "accent"}
              icon="Check"
              onClick={() => {
                toggleHabit("choose-hard");
                if (!hardDone) notify({ title: "Chose hard", body: "That is the compounding one.", tone: "success", xp: 20 });
              }}
            >
              {hardDone ? "Undo" : "I did the hard thing"}
            </Btn>
          </Panel>

          <Panel className="rise p-6">
            <Kicker>The record</Kicker>
            <div className="mt-4 grid grid-cols-2 gap-5">
              <div>
                <div className="kicker">Streak</div>
                <div className="num mt-1.5 text-[26px]">{streak(state, "choose-hard")}</div>
              </div>
              <div>
                <div className="kicker">30 day rate</div>
                <div className="num mt-1.5 text-[26px]">{completion(state, "choose-hard", 30)}%</div>
              </div>
              <div>
                <div className="kicker">Elapsed</div>
                <div className="num mt-1.5 text-[26px]">
                  {ch.elapsed}
                  <span className="text-[13px] text-[var(--ink-4)]"> / {ch.total}</span>
                </div>
              </div>
              <div>
                <div className="kicker">Time progress</div>
                <div className="num mt-1.5 text-[26px]">{ch.timeProgress}%</div>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} className="max-w-xl">
        <h3 className="display text-xl">Your challenge</h3>
        <div className="mt-5 space-y-4">
          <Field label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <TextArea
            label="Why it matters"
            rows={3}
            value={draft.why}
            onChange={(e) => setDraft({ ...draft, why: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Start"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
            <Field
              label="Finish"
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90].map((n) => (
              <button
                key={n}
                className="chip hover:border-[var(--hair-strong)]"
                onClick={() => setDraft({ ...draft, startDate: dateKey(), endDate: addDays(dateKey(), n) })}
              >
                {n}-day challenge from today
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          <Btn
            variant="accent"
            onClick={() => {
              update({ challenge: { ...state.challenge, ...draft } });
              setEditing(false);
              notify({ title: "Challenge updated", tone: "success" });
            }}
          >
            Save
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
