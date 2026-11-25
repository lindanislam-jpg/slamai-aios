"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Loading,
  Modal, PageHeader, Select, Textarea,
} from "@/components/voice/ui";
import { formatInZone } from "@/lib/voice/hours";
import { APPOINTMENT_STATUSES, labelFor, toneFor } from "@/lib/voice/labels";

type Appointment = {
  id: string; title: string; startsAt: string; endsAt: string; status: string; notes: string | null;
  customer: { id: string; name: string | null; phone: string | null } | null;
  service: { id: string; name: string; durationMin: number } | null;
  call: { id: string } | null;
};

type Service = { id: string; name: string; durationMin: number };

export default function AppointmentsPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const { from, to, monthLabel } = useMemo(() => monthRange(monthOffset), [monthOffset]);

  const { data, loading, error, refresh } = useApi<{ appointments: Appointment[]; timezone: string }>(
    `/api/v1/appointments?from=${from.toISOString()}&to=${to.toISOString()}`
  );
  const { data: serviceData } = useApi<{ services: Service[] }>("/api/v1/services");

  const timezone = data?.timezone ?? "Europe/Dublin";
  const appointments = useMemo(() => data?.appointments ?? [], [data]);

  const upcoming = appointments
    .filter((a) => new Date(a.startsAt) >= new Date() && a.status !== "cancelled")
    .slice(0, 8);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = new Date(appointment.startsAt).toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    return map;
  }, [appointments]);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Everything your AI booked, plus anything you add yourself. Nothing can be double-booked."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New appointment</Button>}
      />

      {loading ? (
        <Loading label="Loading your calendar…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={monthLabel}
              action={
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)}>Today</Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <MonthGrid from={from} byDay={byDay} onSelect={setSelected} timezone={timezone} />
          </Card>

          <Card>
            <CardHeader title="Coming up" description="The next eight." />
            {upcoming.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-3 text-[13px] text-slate-400">Nothing booked yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {upcoming.map((appointment) => (
                  <li key={appointment.id}>
                    <button
                      onClick={() => setSelected(appointment)}
                      className="w-full px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13.5px] font-medium text-slate-200">
                          {appointment.customer?.name ?? appointment.title}
                        </span>
                        <Badge tone={toneFor(APPOINTMENT_STATUSES, appointment.status)}>
                          {labelFor(APPOINTMENT_STATUSES, appointment.status)}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatInZone(appointment.startsAt, timezone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </div>
                      {appointment.service && (
                        <div className="mt-0.5 text-[12px] text-slate-500">{appointment.service.name}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {appointments.length === 0 && !loading && !error && (
        <div className="mt-4">
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="Nothing booked this month"
            description="When your AI books someone on a call it appears here straight away — and it checks your calendar first so two customers never get the same slot."
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Add one yourself</Button>}
          />
        </div>
      )}

      <AppointmentModal
        open={creating}
        onClose={() => setCreating(false)}
        services={serviceData?.services ?? []}
        onSaved={refresh}
      />

      <DetailModal
        appointment={selected}
        timezone={timezone}
        onClose={() => setSelected(null)}
        onChanged={() => { refresh(); setSelected(null); }}
      />
    </>
  );
}

function MonthGrid({
  from,
  byDay,
  onSelect,
  timezone,
}: {
  from: Date;
  byDay: Map<string, Appointment[]>;
  onSelect: (appointment: Appointment) => void;
  timezone: string;
}) {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="p-3">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} />;
          const key = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
          const items = (byDay.get(key) ?? []).filter((a) => a.status !== "cancelled");
          const isToday = key === today;

          return (
            <div
              key={key}
              className={`min-h-[76px] rounded-lg border p-1.5 ${
                isToday ? "border-indigo-500/50 bg-indigo-500/[0.08]" : "border-white/[0.05] bg-white/[0.015]"
              }`}
            >
              <div className={`mb-1 text-[11px] ${isToday ? "font-semibold text-indigo-300" : "text-slate-500"}`}>{day}</div>
              <div className="space-y-0.5">
                {items.slice(0, 2).map((appointment) => (
                  <button
                    key={appointment.id}
                    onClick={() => onSelect(appointment)}
                    className="block w-full truncate rounded bg-emerald-500/15 px-1.5 py-0.5 text-left text-[10.5px] text-emerald-200 hover:bg-emerald-500/25"
                  >
                    {formatInZone(appointment.startsAt, timezone, { hour: "2-digit", minute: "2-digit", hour12: false })}{" "}
                    {appointment.customer?.name ?? appointment.title}
                  </button>
                ))}
                {items.length > 2 && (
                  <div className="px-1.5 text-[10.5px] text-slate-500">+{items.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentModal({
  open,
  onClose,
  services,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  services: Service[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "", customerName: "", customerPhone: "", serviceId: "", date: "", time: "09:00", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (!form.date) throw new Error("Choose a date.");
      // The datetime-local value is the browser's local wall clock; sending an
      // ISO string keeps the instant unambiguous on the server.
      const startsAt = new Date(`${form.date}T${form.time}`).toISOString();

      await api("/api/v1/appointments", "POST", {
        title: form.title.trim() || form.customerName.trim() || "Appointment",
        startsAt,
        serviceId: form.serviceId || null,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        notes: form.notes,
      });

      toast.success("Booked");
      setForm({ title: "", customerName: "", customerPhone: "", serviceId: "", date: "", time: "09:00", notes: "" });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Book it</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" required>
          <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
        </Field>
        <Field label="Service">
          <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            <option value="">No specific service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>
            ))}
          </Select>
        </Field>
        <Field label="Reference (optional)">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Boiler service" />
        </Field>
        <Field label="Date" required>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Time" required>
          <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function DetailModal({
  appointment,
  timezone,
  onClose,
  onChanged,
}: {
  appointment: Appointment | null;
  timezone: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!appointment) return null;

  async function update(status: string) {
    if (!appointment) return;
    setBusy(true);
    try {
      await api(`/api/v1/appointments/${appointment.id}`, "PATCH", { status });
      toast.success(status === "cancelled" ? "Cancelled" : "Updated");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={appointment.customer?.name ?? appointment.title}
      description={formatInZone(appointment.startsAt, timezone, { dateStyle: "full", timeStyle: "short" })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {appointment.status !== "completed" && (
            <Button variant="secondary" loading={busy} onClick={() => update("completed")}>Mark done</Button>
          )}
          {appointment.status !== "cancelled" && (
            <Button variant="danger" loading={busy} icon={<X className="h-3.5 w-3.5" />} onClick={() => update("cancelled")}>
              Cancel
            </Button>
          )}
        </>
      }
    >
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Status</dt>
          <dd><Badge tone={toneFor(APPOINTMENT_STATUSES, appointment.status)}>{labelFor(APPOINTMENT_STATUSES, appointment.status)}</Badge></dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Service</dt>
          <dd className="text-slate-200">{appointment.service?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Phone</dt>
          <dd className="text-slate-200">{appointment.customer?.phone ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Ends</dt>
          <dd className="text-slate-200">
            {formatInZone(appointment.endsAt, timezone, { hour: "2-digit", minute: "2-digit", hour12: false })}
          </dd>
        </div>
        {appointment.notes && (
          <div className="pt-2">
            <dt className="mb-1 text-slate-500">Notes</dt>
            <dd className="leading-relaxed text-slate-300">{appointment.notes}</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

function monthRange(offset: number) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59));
  return {
    from,
    to,
    monthLabel: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(from),
  };
}
