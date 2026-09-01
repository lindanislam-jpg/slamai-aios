"use client";

import { useState } from "react";
import { useLife } from "@/lib/life/store";
import { Icon } from "@/components/life/icons";
import { Btn, EmptyState, Field, Kicker, Modal, Panel, SectionHeader, TextArea } from "@/components/life/ui";
import type { Person, PersonImpact } from "@/lib/life/types";

const IMPACTS: { id: PersonImpact; label: string; icon: string; tone: string; line: string }[] = [
  { id: "raises", label: "Raises my standards", icon: "ArrowUpRight", tone: "var(--good)", line: "More time here." },
  { id: "neutral", label: "Neutral", icon: "ArrowRight", tone: "var(--ink-3)", line: "Fine as it is." },
  { id: "drains", label: "Drains my energy", icon: "ArrowDownRight", tone: "var(--bad)", line: "Reduce the exposure." },
];

const BLANK: Person = { id: "", name: "", relation: "", impact: "raises", note: "" };

export default function PeoplePage() {
  const { state, upsertPerson, removePerson, notify } = useLife();
  const [editing, setEditing] = useState<Person | null>(null);

  const counts = IMPACTS.map((i) => ({
    ...i,
    people: state.people.filter((p) => p.impact === i.id),
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Environment · people"
        title="You are the average of the room."
        sub="Be honest about who lifts you and who costs you. Then change the ratio."
        action={
          <Btn size="sm" variant="accent" icon="Plus" onClick={() => setEditing({ ...BLANK, id: crypto.randomUUID() })}>
            Add person
          </Btn>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <Panel key={c.id} className="rise p-5">
            <div className="flex items-center gap-2.5">
              <Icon name={c.icon} className="h-4 w-4" style={{ color: c.tone }} />
              <span className="kicker" style={{ color: c.tone }}>
                {c.label}
              </span>
            </div>
            <div className="num mt-3 text-[32px] leading-none">{c.people.length}</div>
            <p className="mt-2 text-[12px] text-[var(--ink-3)]">{c.line}</p>
          </Panel>
        ))}
      </section>

      {state.people.length === 0 ? (
        <Panel>
          <EmptyState
            icon="Users"
            title="No one mapped yet"
            body="Add the five people you spend the most time with. The list tends to explain your last six months."
            action={
              <Btn variant="accent" icon="Plus" onClick={() => setEditing({ ...BLANK, id: crypto.randomUUID() })}>
                Add the first
              </Btn>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.people.map((p) => {
            const impact = IMPACTS.find((i) => i.id === p.impact)!;
            return (
              <Panel key={p.id} hover className="group p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold"
                    style={{ background: "var(--panel-strong)", color: impact.tone }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold tracking-tight">{p.name}</div>
                    <div className="truncate text-[12px] text-[var(--ink-3)]">{p.relation}</div>
                  </div>
                  <button
                    onClick={() => setEditing(p)}
                    className="text-[var(--ink-4)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--ink)]"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Icon name="Settings" className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Icon name={impact.icon} className="h-3.5 w-3.5" style={{ color: impact.tone }} />
                  <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: impact.tone }}>
                    {impact.label}
                  </span>
                </div>

                {p.note ? <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-3)]">{p.note}</p> : null}

                <div className="mt-4 flex gap-1.5">
                  {IMPACTS.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => upsertPerson({ ...p, impact: i.id })}
                      title={i.label}
                      className="h-1.5 flex-1 rounded-full transition"
                      style={{ background: p.impact === i.id ? i.tone : "var(--panel-strong)" }}
                    />
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <h3 className="display text-xl">{state.people.some((p) => p.id === editing.id) ? "Edit person" : "Add person"}</h3>
            <div className="mt-5 space-y-4">
              <Field label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Field
                label="Relationship"
                value={editing.relation}
                placeholder="Business partner, friend, family…"
                onChange={(e) => setEditing({ ...editing, relation: e.target.value })}
              />
              <div>
                <Kicker className="mb-2">Impact</Kicker>
                <div className="flex flex-wrap gap-2">
                  {IMPACTS.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setEditing({ ...editing, impact: i.id })}
                      className="chip"
                      style={
                        editing.impact === i.id
                          ? { color: i.tone, borderColor: i.tone, background: "var(--panel-strong)" }
                          : undefined
                      }
                    >
                      <Icon name={i.icon} className="h-3 w-3" />
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
              <TextArea
                label="Note"
                rows={3}
                value={editing.note}
                placeholder="What this relationship does to your standards — and what you will change."
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </div>
            <div className="mt-6 flex items-center justify-between">
              {state.people.some((p) => p.id === editing.id) ? (
                <Btn
                  variant="ghost"
                  icon="Trash2"
                  onClick={() => {
                    removePerson(editing.id);
                    setEditing(null);
                  }}
                >
                  Remove
                </Btn>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Btn>
                <Btn
                  variant="accent"
                  disabled={!editing.name.trim()}
                  onClick={() => {
                    upsertPerson(editing);
                    setEditing(null);
                    notify({ title: "People map updated", tone: "success" });
                  }}
                >
                  Save
                </Btn>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
