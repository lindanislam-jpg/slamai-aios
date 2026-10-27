"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { stroke: "#47596d", fontSize: 11, tickLine: false } as const;
const TIP = { contentStyle: { background: "#0e151e", border: "1px solid #2a3a4c", borderRadius: 8, fontSize: 12, color: "#dbe3ec" }, labelStyle: { color: "#aebccb" } };
export const PALETTE = ["#3b82f6", "#f0a531", "#e5484d", "#1fb894", "#c39a45", "#8b5cf6", "#7d8fa3", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

export function TrendChart({ data }: { data: { week: string; passRate: number | null; fpy: number | null; rework: number }[] }) {
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#1d2a38" vertical={false} />
        <XAxis dataKey="week" {...AXIS} tickFormatter={(w: string) => w.slice(5)} />
        <YAxis yAxisId="pct" {...AXIS} domain={[0, 100]} unit="%" />
        <YAxis yAxisId="count" orientation="right" {...AXIS} allowDecimals={false} />
        <Tooltip {...TIP} formatter={(v, n) => [n === "Rework records" ? v : `${v}%`, n]} labelFormatter={(l) => `Week of ${l}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="pct" type="monotone" dataKey="passRate" name="Pass rate" stroke="#1fb894" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line yAxisId="pct" type="monotone" dataKey="fpy" strokeDasharray="5 3" name="First-pass yield" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="rework" name="Rework records" stroke="#f0a531" strokeWidth={2} dot={{ r: 3 }} yAxisId="count" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, total, label, colors }: { data: { name: string; value: number }[]; total: number; label: string; colors?: string[] }) {
  const shown = data.filter((d) => d.value > 0);
  if (!shown.length) return <NoData />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="96%" stroke="#111a24" strokeWidth={2} isAnimationActive={false}>
              {shown.map((d, i) => (
                <Cell key={d.name} fill={(colors ?? PALETTE)[data.indexOf(d) % (colors ?? PALETTE).length] ?? PALETTE[i]} />
              ))}
            </Pie>
            <Tooltip {...TIP} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink-100">{total}</span>
          <span className="text-[11px] text-ink-300">{label}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink-200">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: (colors ?? PALETTE)[i % (colors ?? PALETTE).length] }} />
              {d.name}
            </span>
            <span className="tabular-nums text-ink-300">
              {total ? Math.round((d.value / total) * 100) : 0}% ({d.value})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bars({ data, color = "#1fb894", height = 220, colors }: { data: { key: string; count: number }[]; color?: string; height?: number; colors?: string[] }) {
  if (!data.length || data.every((d) => d.count === 0)) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#1d2a38" vertical={false} />
        <XAxis dataKey="key" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TIP} cursor={{ fill: "#16212d" }} />
        <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "#aebccb", fontSize: 11 }}>
          {data.map((d, i) => (
            <Cell key={d.key} fill={colors?.[i] ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pareto: bars sorted descending with cumulative % line. */
export function Pareto({ data }: { data: { key: string; count: number }[] }) {
  if (!data.length) return <NoData />;
  const total = data.reduce((s, d) => s + d.count, 0);
  let run = 0;
  const rows = data.map((d) => {
    run += d.count;
    return { ...d, cumulative: Math.round((run / total) * 1000) / 10 };
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 16, right: 8, left: -20, bottom: 30 }}>
        <CartesianGrid stroke="#1d2a38" vertical={false} />
        <XAxis dataKey="key" {...AXIS} interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="l" {...AXIS} allowDecimals={false} />
        <YAxis yAxisId="r" orientation="right" {...AXIS} domain={[0, 100]} unit="%" />
        <Tooltip {...TIP} cursor={{ fill: "#16212d" }} />
        <Bar yAxisId="l" dataKey="count" name="Confirmed defects" fill="#e5484d" radius={[4, 4, 0, 0]} />
        <Line yAxisId="r" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#c39a45" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function NoData() {
  return <div className="flex h-40 items-center justify-center text-sm text-ink-300">No data for this selection.</div>;
}
