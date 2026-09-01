"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export function Panel({
  className,
  lit = true,
  hover = false,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { lit?: boolean; hover?: boolean; as?: React.ElementType }) {
  return (
    <Tag
      className={cn("panel", lit && "panel-lit", hover && "hover-lift", className)}
      {...props}
    />
  );
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("kicker", className)}>{children}</div>;
}

export function SectionHeader({
  kicker,
  title,
  sub,
  action,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {kicker ? <Kicker className="mb-2">{kicker}</Kicker> : null}
        <h2 className="display text-2xl sm:text-[28px] leading-tight">{title}</h2>
        {sub ? <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-3)]">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "accent" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
  iconRight?: string;
};

export function Btn({
  variant = "default",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  ...props
}: BtnProps) {
  return (
    <button
      className={cn(
        "btn",
        variant === "accent" && "btn-accent",
        variant === "ghost" && "btn-ghost",
        size === "sm" && "px-3.5 py-1.5 text-[12px]",
        size === "lg" && "px-6 py-3 text-[14px]",
        className,
      )}
      {...props}
    >
      {icon ? <Icon name={icon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}
    </button>
  );
}

export function IconBtn({
  icon,
  label,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-[var(--hair)] bg-[var(--panel)] text-[var(--ink-2)]",
        "transition hover:border-[var(--hair-strong)] hover:text-[var(--ink)] active:scale-95",
        className,
      )}
      {...props}
    >
      <Icon name={icon} className="h-[17px] w-[17px]" />
    </button>
  );
}

export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "good" | "warn" | "bad";
  className?: string;
}) {
  const toneStyle: React.CSSProperties =
    tone === "good"
      ? { color: "var(--good)", borderColor: "color-mix(in srgb, var(--good) 35%, transparent)", background: "color-mix(in srgb, var(--good) 12%, transparent)" }
      : tone === "warn"
        ? { color: "var(--warn)", borderColor: "color-mix(in srgb, var(--warn) 35%, transparent)", background: "color-mix(in srgb, var(--warn) 12%, transparent)" }
        : tone === "bad"
          ? { color: "var(--bad)", borderColor: "color-mix(in srgb, var(--bad) 35%, transparent)", background: "color-mix(in srgb, var(--bad) 12%, transparent)" }
          : {};
  return (
    <span className={cn("chip", tone === "accent" && "chip-accent", className)} style={toneStyle}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label ? <Kicker className="mb-2">{label}</Kicker> : null}
      <input className={cn("field", className)} {...props} />
      {hint ? <p className="mt-1.5 text-xs text-[var(--ink-4)]">{hint}</p> : null}
    </label>
  );
}

export function TextArea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <Kicker className="mb-2">{label}</Kicker> : null}
      <textarea className={cn("field resize-none leading-relaxed", className)} {...props} />
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description ? <div className="mt-1 text-xs leading-relaxed text-[var(--ink-3)]">{description}</div> : null}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[26px] w-[46px] shrink-0 rounded-full border transition-all duration-300",
          checked ? "border-transparent" : "border-[var(--hair)]",
          disabled && "opacity-40",
        )}
        style={{ background: checked ? "var(--accent)" : "var(--panel-strong)" }}
      >
        <span
          className="absolute top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-all duration-300"
          style={{ left: checked ? 24 : 4 }}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-[var(--hair)] bg-[var(--panel)] p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-300",
              active ? "text-[var(--ink)]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]",
            )}
            style={active ? { background: "var(--panel-strong)", boxShadow: "0 1px 0 var(--sheen) inset" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overlay
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="scrim fade absolute inset-0" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn("panel panel-lit rise relative z-10 my-auto w-full max-w-lg p-6 outline-none", className)}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

export function EmptyState({
  icon = "Sparkles",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: "var(--accent-glow)" }}
        />
        <div className="relative grid h-16 w-16 place-items-center rounded-full border border-[var(--hair)] bg-[var(--panel-strong)]">
          <Icon name={icon} className="h-6 w-6" />
        </div>
      </div>
      <h3 className="display text-lg">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--ink-3)]">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "good" | "bad" | "warn";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Kicker>{label}</Kicker>
      <div
        className="num mt-2 text-[30px] leading-none"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-[var(--ink-3)]">{sub}</div> : null}
    </div>
  );
}

export function Delta({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const tone = value > 0 ? "var(--good)" : value < 0 ? "var(--bad)" : "var(--ink-3)";
  const icon = value > 0 ? "ArrowUpRight" : value < 0 ? "ArrowDownRight" : "Minus";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold", className)} style={{ color: tone }}>
      <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2.2} />
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

export function Bar({ value, className, tone }: { value: number; className?: string; tone?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: tone ?? "linear-gradient(90deg, var(--accent-line), var(--accent))",
        }}
      />
    </div>
  );
}

/** Big animated number that counts to its target once, then tracks changes. */
export function CountUp({
  value,
  duration = 1100,
  className,
  decimals = 0,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
  /** Overrides the default fixed-decimal rendering — used for thousands separators. */
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = React.useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(origin + delta * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : display.toFixed(decimals)}</span>;
}
