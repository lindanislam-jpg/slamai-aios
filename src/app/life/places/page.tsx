"use client";

import { useState } from "react";
import { useLife } from "@/lib/life/store";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Field, Kicker, Modal, Panel, SectionHeader, TextArea } from "@/components/life/ui";
import type { Place, PlaceStatus } from "@/lib/life/types";

const STATUSES: { id: PlaceStatus; label: string; tone: string; icon: string }[] = [
  { id: "optimized", label: "Optimised", tone: "var(--good)", icon: "ShieldCheck" },
  { id: "needs-work", label: "Needs work", tone: "var(--warn)", icon: "Info" },
  { id: "hostile", label: "Working against me", tone: "var(--bad)", icon: "Flame" },
];

const ICONS: Record<string, string> = {
  Workspace: "Layers",
  Home: "Home",
  Gym: "Dumbbell",
  Phone: "Smartphone",
  "Social media": "MonitorSmartphone",
  Inbox: "Bell",
};

const BLANK: Place = { id: "", name: "", category: "physical", status: "needs-work", note: "" };

export default function PlacesPage() {
  const { state, upsertPlace, update, notify } = useLife();
  const [editing, setEditing] = useState<Place | null>(null);

  const groups = [
    { key: "physical" as const, label: "Physical spaces", sub: "Where your body is when the habit happens." },
    { key: "digital" as const, label: "Digital environment", sub: "The rooms you enter a hundred times a day." },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Environment · places"
        title="Design beats discipline."
        sub="Every space either makes the right action obvious or makes it expensive. Audit them honestly."
        action={
          <Btn size="sm" variant="accent" icon="Plus" onClick={() => setEditing({ ...BLANK, id: crypto.randomUUID() })}>
            Add place
          </Btn>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <Panel key={s.id} className="rise flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--panel-strong)", color: s.tone }}>
              <Icon name={s.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="num text-[26px] leading-none">{state.places.filter((p) => p.status === s.id).length}</div>
              <div className="kicker mt-1.5" style={{ color: s.tone }}>
                {s.label}
              </div>
            </div>
          </Panel>
        ))}
      </section>

      {groups.map((g) => (
        <section key={g.key} className="space-y-4">
          <div>
            <Kicker>{g.label}</Kicker>
            <p className="mt-1.5 text-[13px] text-[var(--ink-3)]">{g.sub}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.places
              .filter((p) => p.category === g.key)
              .map((p) => {
                const status = STATUSES.find((s) => s.id === p.status)!;
                return (
                  <Panel key={p.id} hover className="group p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
                        style={{ borderColor: "var(--hair)", background: "var(--panel-strong)", color: status.tone }}
                      >
                        <Icon name={ICONS[p.name] ?? (p.category === "digital" ? "MonitorSmartphone" : "MapPin")} className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold tracking-tight">{p.name}</div>
                        <Chip
                          className="mt-1.5"
                          tone={p.status === "optimized" ? "good" : p.status === "hostile" ? "bad" : "warn"}
                        >
                          {status.label}
                        </Chip>
                      </div>
                      <button
                        onClick={() => setEditing(p)}
                        className="text-[var(--ink-4)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--ink)]"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Icon name="Settings" className="h-4 w-4" />
                      </button>
                    </div>
                    {p.note ? <p className="mt-3.5 text-[13px] leading-relaxed text-[var(--ink-3)]">{p.note}</p> : null}
                    <div className="mt-4 flex gap-1.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s.id}
                          title={s.label}
                          onClick={() => upsertPlace({ ...p, status: s.id })}
                          className="h-1.5 flex-1 rounded-full transition"
                          style={{ background: p.status === s.id ? s.tone : "var(--panel-strong)" }}
                        />
                      ))}
                    </div>
                  </Panel>
                );
              })}
          </div>
        </section>
      ))}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <h3 className="display text-xl">{state.places.some((p) => p.id === editing.id) ? "Edit place" : "Add place"}</h3>
            <div className="mt-5 space-y-4">
              <Field label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <div>
                <Kicker className="mb-2">Type</Kicker>
                <div className="flex gap-2">
                  {(["physical", "digital"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditing({ ...editing, category: c })}
                      className="chip"
                      style={editing.category === c ? { color: "var(--accent)", borderColor: "var(--accent-line)" } : undefined}
                    >
                      {c === "physical" ? "Physical" : "Digital"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Kicker className="mb-2">Status</Kicker>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setEditing({ ...editing, status: s.id })}
                      className="chip"
                      style={editing.status === s.id ? { color: s.tone, borderColor: s.tone } : undefined}
                    >
                      <Icon name={s.icon} className="h-3 w-3" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <TextArea
                label="What you will change"
                rows={3}
                value={editing.note}
                placeholder="One concrete change to this space."
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </div>
            <div className="mt-6 flex items-center justify-between">
              {state.places.some((p) => p.id === editing.id) ? (
                <Btn
                  variant="ghost"
                  icon="Trash2"
                  onClick={() => {
                    update({ places: state.places.filter((p) => p.id !== editing.id) });
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
                    upsertPlace(editing);
                    setEditing(null);
                    notify({ title: "Environment map updated", tone: "success" });
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
