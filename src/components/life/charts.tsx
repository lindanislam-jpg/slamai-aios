"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** Catmull–Rom → cubic bézier. Smooth lines without a charting dependency. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ------------------------------------------------------------------ *
 * Radial gauge
 * ------------------------------------------------------------------ */

export function Ring({
  value,
  size = 220,
  thickness = 10,
  gap = 0,
  label,
  sub,
  children,
  tone,
  trackTone,
  className,
  glow = true,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  thickness?: number;
  /** Degrees of open arc at the bottom. 0 = full circle. */
  gap?: number;
  label?: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  tone?: string;
  trackTone?: string;
  className?: string;
  glow?: boolean;
}) {
  const id = useId();
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const sweep = 360 - gap;
  const start = gap / 2;
  const clamped = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * r * (sweep / 360);
  const dash = (clamped / 100) * circumference;

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-0" role="img" aria-label={`${Math.round(clamped)} percent`}>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone ?? "hsl(var(--a-h) var(--a-s) calc(var(--a-l) + 14%))"} />
            <stop offset="100%" stopColor={tone ?? "var(--accent)"} />
          </linearGradient>
          {glow ? (
            <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>

        <path
          d={arcPath(cx, cy, r, start, start + sweep - 0.01)}
          fill="none"
          stroke={trackTone ?? "var(--panel-strong)"}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {clamped > 0 ? (
          <path
            d={arcPath(cx, cy, r, start, start + sweep - 0.01)}
            fill="none"
            stroke={`url(#ring-${id})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            filter={glow ? `url(#glow-${id})` : undefined}
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)" }}
          />
        ) : null}
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        {children ?? (
          <div>
            <div className="num text-[44px] leading-none">{Math.round(clamped)}</div>
            {label ? <div className="kicker mt-2">{label}</div> : null}
            {sub ? <div className="mt-1 text-xs text-[var(--ink-3)]">{sub}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** The daily score ring: one segment per habit, lit as each is completed. */
export function SegmentRing({
  segments,
  size = 240,
  thickness = 12,
  children,
  onSegmentClick,
}: {
  segments: { id: string; done: boolean; hue: number; label: string }[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  onSegmentClick?: (id: string) => void;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const step = 360 / segments.length;
  const pad = 4;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {segments.map((s, i) => {
          const from = i * step + pad / 2;
          const to = (i + 1) * step - pad / 2;
          const color = `hsl(${s.hue} 78% 58%)`;
          return (
            <g key={s.id}>
              <title>{s.label}</title>
              <path
                d={arcPath(cx, cx, r, from, to)}
                fill="none"
                stroke={s.done ? color : "var(--panel-strong)"}
                strokeWidth={thickness}
                strokeLinecap="round"
                opacity={s.done ? 1 : 0.9}
                onClick={onSegmentClick ? () => onSegmentClick(s.id) : undefined}
                style={{
                  cursor: onSegmentClick ? "pointer" : undefined,
                  filter: s.done ? `drop-shadow(0 0 8px hsl(${s.hue} 78% 58% / 0.5))` : undefined,
                  transition: "stroke 0.5s cubic-bezier(0.22,1,0.36,1), filter 0.5s",
                }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sparkline
 * ------------------------------------------------------------------ */

export function Spark({
  points,
  width = 120,
  height = 34,
  tone = "var(--accent)",
  fill = true,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  tone?: string;
  fill?: boolean;
  className?: string;
}) {
  const id = useId();
  const { line, area } = useMemo(() => {
    if (points.length < 2) return { line: "", area: "" };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const pts = points.map((v, i) => ({
      x: (i / (points.length - 1)) * width,
      y: height - 3 - ((v - min) / span) * (height - 6),
    }));
    const d = smoothPath(pts);
    return { line: d, area: `${d} L ${width} ${height} L 0 ${height} Z` };
  }, [points, width, height]);

  if (!line) return null;

  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.34" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#sp-${id})`} /> : null}
      <path d={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Area / line chart with crosshair
 * ------------------------------------------------------------------ */

export interface SeriesPoint {
  label: string;
  value: number;
  meta?: string;
}

export function AreaChart({
  data,
  height = 220,
  tone = "var(--accent)",
  formatValue = (v: number) => String(Math.round(v)),
  min: forcedMin,
  max: forcedMax,
  target,
  className,
  showGrid = true,
}: {
  data: SeriesPoint[];
  height?: number;
  tone?: string;
  formatValue?: (v: number) => string;
  min?: number;
  max?: number;
  target?: number;
  className?: string;
  showGrid?: boolean;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padY = 18;

  const { line, area, pts, min, max } = useMemo(() => {
    const values = data.map((d) => d.value);
    const rawMin = forcedMin ?? Math.min(...values, target ?? Infinity);
    const rawMax = forcedMax ?? Math.max(...values, target ?? -Infinity);
    const pad = (rawMax - rawMin) * 0.14 || 1;
    const lo = forcedMin ?? rawMin - pad;
    const hi = forcedMax ?? rawMax + pad;
    const span = hi - lo || 1;
    const p = data.map((d, i) => ({
      x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
      y: H - padY - ((d.value - lo) / span) * (H - padY * 2),
    }));
    const d = smoothPath(p);
    return { line: d, area: `${d} L ${W} ${H} L 0 ${H} Z`, pts: p, min: lo, max: hi };
  }, [data, H, forcedMin, forcedMax, target]);

  if (!data.length) return null;

  const targetY =
    typeof target === "number" ? H - padY - ((target - min) / (max - min || 1)) * (H - padY * 2) : null;

  const onMove = (e: React.PointerEvent) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  };

  const active = hover === null ? null : data[hover];

  return (
    <div
      ref={wrap}
      className={cn("relative w-full select-none", className)}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={`ar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
            <stop offset="70%" stopColor={tone} stopOpacity="0.03" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>

        {showGrid
          ? [0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={padY + f * (H - padY * 2)}
                y2={padY + f * (H - padY * 2)}
                stroke="var(--hair)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}

        {targetY !== null ? (
          <line
            x1="0"
            x2={W}
            y1={targetY}
            y2={targetY}
            stroke="var(--ink-4)"
            strokeDasharray="4 6"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <path d={area} fill={`url(#ar-${id})`} />
        <path
          d={line}
          fill="none"
          stroke={tone}
          strokeWidth="2.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover !== null ? (
          <>
            <line
              x1={pts[hover].x}
              x2={pts[hover].x}
              y1="0"
              y2={H}
              stroke="var(--hair-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="5" fill={tone} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>

      {active && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-[var(--hair)] bg-[var(--panel-solid)] px-3 py-2 text-center shadow-lg"
          style={{ left: `${(pts[hover].x / W) * 100}%` }}
        >
          <div className="num text-sm">{formatValue(active.value)}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--ink-3)]">{active.label}</div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-between text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bars
 * ------------------------------------------------------------------ */

export function Bars({
  data,
  height = 130,
  className,
  formatValue = (v: number) => `${Math.round(v)}%`,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  className?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(100, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-2", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="group flex flex-1 flex-col items-center gap-2">
          <div className="relative w-full flex-1">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-700"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: 3,
                background: d.highlight
                  ? "linear-gradient(180deg, var(--accent), var(--accent-line))"
                  : "linear-gradient(180deg, var(--hair-strong), var(--hair))",
              }}
            />
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded border border-[var(--hair)] bg-[var(--panel-solid)] px-1.5 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100">
              {formatValue(d.value)}
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-4)]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Heatmap / streak calendar
 * ------------------------------------------------------------------ */

export function Heatmap({
  cells,
  columns = 13,
  className,
}: {
  /** Oldest first. `value` 0–1. */
  cells: { key: string; value: number; title: string }[];
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-[5px]", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => (
        <div
          key={c.key}
          title={c.title}
          className="aspect-square rounded-[4px] border transition-transform duration-200 hover:scale-125"
          style={{
            background:
              c.value <= 0
                ? "var(--panel-strong)"
                : `hsl(var(--a-h) var(--a-s) var(--a-l) / ${0.18 + c.value * 0.82})`,
            borderColor: c.value > 0 ? "transparent" : "var(--hair)",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Momentum flow — the visual signature of the app
 * ------------------------------------------------------------------ */

export function MomentumFlow({
  points,
  height = 190,
  direction = "stable",
  className,
}: {
  points: { date: string; value: number }[];
  height?: number;
  direction?: "building" | "stable" | "slipping";
  className?: string;
}) {
  const id = useId();
  const W = 1000;
  const H = height;
  const tone =
    direction === "building" ? "var(--good)" : direction === "slipping" ? "var(--bad)" : "var(--accent)";

  const { line, area, last } = useMemo(() => {
    if (points.length < 2) return { line: "", area: "", last: null };
    const values = points.map((p) => p.value);
    const lo = Math.max(0, Math.min(...values) - 8);
    const hi = Math.min(100, Math.max(...values) + 8);
    const span = hi - lo || 1;
    const pts = points.map((p, i) => ({
      x: (i / (points.length - 1)) * W,
      y: H - 12 - ((p.value - lo) / span) * (H - 30),
    }));
    const d = smoothPath(pts);
    return { line: d, area: `${d} L ${W} ${H} L 0 ${H} Z`, last: pts[pts.length - 1] };
  }, [points, H]);

  // A flat line at zero looks like data. With nothing logged, say so instead.
  if (!line || points.every((p) => p.value === 0)) {
    return (
      <div
        className={cn("grid place-items-center text-center", className)}
        style={{ height: H }}
      >
        <p className="max-w-xs text-[13px] leading-relaxed text-[var(--ink-4)]">
          Your momentum curve starts with the first habit you complete.
        </p>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className={cn("overflow-visible", className)}>
      <defs>
        <linearGradient id={`mf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.36" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`mfl-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={tone} stopOpacity="0.25" />
          <stop offset="100%" stopColor={tone} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#mf-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#mfl-${id})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {last ? (
        <>
          <circle cx={last.x} cy={last.y} r="10" fill={tone} opacity="0.18" className="breathe" />
          <circle cx={last.x} cy={last.y} r="4.5" fill={tone} />
        </>
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * The challenge path — a climb, not a progress bar
 * ------------------------------------------------------------------ */

export function ClimbPath({
  progress,
  milestones,
  height = 240,
  onMilestone,
}: {
  /** 0–1 */
  progress: number;
  milestones: { id: string; label: string; at: number; done: boolean }[];
  height?: number;
  onMilestone?: (id: string) => void;
}) {
  const id = useId();
  const W = 1000;
  const H = height;
  const pad = 26;

  const y = (t: number) => H - pad - Math.pow(t, 1.85) * (H - pad * 2);
  const x = (t: number) => pad + t * (W - pad * 2);

  const samples = Array.from({ length: 60 }, (_, i) => ({ x: x(i / 59), y: y(i / 59) }));
  const path = smoothPath(samples);
  const doneSamples = samples.filter((_, i) => i / 59 <= progress);
  const donePath = smoothPath(doneSamples.length > 1 ? doneSamples : samples.slice(0, 2));
  const head = { x: x(progress), y: y(progress) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="overflow-visible">
      <defs>
        <linearGradient id={`cp-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id={`cpf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={`${donePath} L ${head.x} ${H - pad} L ${pad} ${H - pad} Z`} fill={`url(#cpf-${id})`} />
      <path d={path} fill="none" stroke="var(--hair-strong)" strokeWidth="2" strokeDasharray="3 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={donePath} fill="none" stroke={`url(#cp-${id})`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      {milestones.map((m) => {
        const mx = x(m.at);
        const my = y(m.at);
        return (
          <g
            key={m.id}
            onClick={onMilestone ? () => onMilestone(m.id) : undefined}
            style={{ cursor: onMilestone ? "pointer" : undefined }}
          >
            <title>{m.label}</title>
            <circle
              cx={mx}
              cy={my}
              r="7"
              fill={m.done ? "var(--accent)" : "var(--panel-solid)"}
              stroke={m.done ? "var(--accent)" : "var(--hair-strong)"}
              strokeWidth="2"
            />
            {m.done ? <circle cx={mx} cy={my} r="14" fill="var(--accent)" opacity="0.12" /> : null}
          </g>
        );
      })}

      <g>
        <circle cx={head.x} cy={head.y} r="16" fill="var(--accent)" opacity="0.16" className="breathe" />
        <circle cx={head.x} cy={head.y} r="6.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2.5" />
      </g>

      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--hair)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
