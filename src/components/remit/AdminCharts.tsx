"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Dashboard charts.
 *
 * Volume and revenue are plotted on separate charts rather than dual axes: two
 * different units sharing one vertical scale is how a dashboard ends up lying
 * to whoever reads it.
 */

export interface TimeseriesPoint {
  date: string;
  transfers: number;
  volume: string;
  revenue: string;
}

const AXIS = { stroke: "#6B8199", fontSize: 11 };
const GRID = "#E2E9F0";

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export function VolumeChart({ data }: { data: TimeseriesPoint[] }) {
  const points = data.map((point) => ({ ...point, volumeNumber: Number(point.volume) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E7C66" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#0E7C66" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} width={56} {...AXIS} />
        <Tooltip
          formatter={(value: number) => [`€${value.toLocaleString("en-IE")}`, "Volume"]}
          labelFormatter={shortDate}
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="volumeNumber"
          stroke="#0E7C66"
          strokeWidth={2}
          fill="url(#volumeFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: TimeseriesPoint[] }) {
  const points = data.map((point) => ({ ...point, revenueNumber: Number(point.revenue) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} width={56} {...AXIS} />
        <Tooltip
          formatter={(value: number) => [`€${value.toLocaleString("en-IE")}`, "Fee revenue"]}
          labelFormatter={shortDate}
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
        />
        <Bar dataKey="revenueNumber" fill="#F0A202" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TransfersChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} {...AXIS} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} {...AXIS} />
        <Tooltip
          formatter={(value: number) => [value, "Transfers"]}
          labelFormatter={shortDate}
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
        />
        <Bar dataKey="transfers" fill="#0E7C66" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
