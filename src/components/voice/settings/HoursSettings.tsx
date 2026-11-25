"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import { Button, Card, CardHeader, ErrorState, Input, Loading } from "../ui";
import { DEFAULT_HOURS, WEEKDAYS, type HourRow } from "@/lib/voice/hours";

export default function HoursSettings() {
  const { data, loading, error, refresh } = useApi<{ hours: HourRow[] }>("/api/v1/business/hours");
  const [rows, setRows] = useState<HourRow[]>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.hours && data.hours.length === 7) {
      setRows(
        [...data.hours]
          .sort((a, b) => a.weekday - b.weekday)
          .map((h) => ({ weekday: h.weekday, isOpen: h.isOpen, opensAt: h.opensAt, closesAt: h.closesAt }))
      );
    }
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  function update(weekday: number, patch: Partial<HourRow>) {
    setRows((r) => r.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    try {
      await api("/api/v1/business/hours", "PUT", { hours: rows });
      toast.success("Opening hours saved");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Ordered Monday first, which is how a business thinks about its week.
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((weekday) => rows.find((r) => r.weekday === weekday)!).filter(Boolean);

  return (
    <Card>
      <CardHeader
        title="Opening hours"
        description="Your AI knows when you're open, and behaves differently outside these hours."
        action={<Button loading={saving} size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={save}>Save</Button>}
      />
      <div className="divide-y divide-white/[0.04]">
        {ordered.map((row) => (
          <div key={row.weekday} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="w-24 text-[13.5px] font-medium text-slate-200">{WEEKDAYS[row.weekday]}</span>

            <button
              type="button"
              role="switch"
              aria-checked={row.isOpen}
              aria-label={`${WEEKDAYS[row.weekday]} open`}
              onClick={() => update(row.weekday, { isOpen: !row.isOpen })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${row.isOpen ? "bg-indigo-500" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${row.isOpen ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>

            {row.isOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={row.opensAt}
                  onChange={(e) => update(row.weekday, { opensAt: e.target.value })}
                  className="w-[120px] py-1.5"
                  aria-label={`${WEEKDAYS[row.weekday]} opening time`}
                />
                <span className="text-slate-500">to</span>
                <Input
                  type="time"
                  value={row.closesAt}
                  onChange={(e) => update(row.weekday, { closesAt: e.target.value })}
                  className="w-[120px] py-1.5"
                  aria-label={`${WEEKDAYS[row.weekday]} closing time`}
                />
              </div>
            ) : (
              <span className="text-[13px] text-slate-500">Closed</span>
            )}
          </div>
        ))}
      </div>
      <p className="border-t border-white/[0.06] px-5 py-3.5 text-[12.5px] leading-relaxed text-slate-500">
        Set what happens outside these hours on your{" "}
        <a href="/app/agents" className="text-indigo-300 hover:underline">AI receptionist</a> — it can keep answering,
        take messages, handle emergencies only, or go to voicemail.
      </p>
    </Card>
  );
}
