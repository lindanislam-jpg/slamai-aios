"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Check, ChevronDown, Info, Loader2, RefreshCw, X,
} from "lucide-react";

/**
 * The SlamAI Voice component kit.
 *
 * Every dashboard page composes these, so spacing, focus rings, empty states
 * and error handling behave identically across the product. Nothing here
 * fetches data — these are presentational only.
 */

/* ------------------------------------------------------------------ Surface */

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-[#15152b]/80 backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)]",
        hover && "transition-all duration-200 hover:border-indigo-500/30 hover:shadow-[0_20px_60px_-30px_rgba(99,102,241,0.5)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-100">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Buttons */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c1d]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-[13px]",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-[15px]",
        variant === "primary" &&
          "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-violet-500 hover:shadow-indigo-800/50",
        variant === "secondary" &&
          "border border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]",
        variant === "ghost" && "text-slate-300 hover:bg-white/[0.06] hover:text-white",
        variant === "danger" &&
          "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Inputs */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
          {label}
          {required && <span className="text-indigo-400">*</span>}
          {hint && <Tooltip text={hint} />}
        </span>
      )}
      {children}
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-[12px] text-rose-400">
          <AlertCircle className="h-3 w-3" /> {error}
        </span>
      )}
    </label>
  );
}

const inputStyles =
  "w-full rounded-xl border border-white/10 bg-[#0e0e1f] px-3.5 py-2.5 text-sm text-slate-100 " +
  "placeholder:text-slate-500 transition-colors " +
  "focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputStyles, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputStyles, "min-h-[96px] resize-y leading-relaxed", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputStyles, "appearance-none pr-9", props.className)} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
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
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {description && <div className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
          checked ? "bg-indigo-500" : "bg-white/10",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-slate-500" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1a35] px-2.5 py-1.5 text-[12px] font-normal leading-relaxed text-slate-300 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- Indicators */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "border-white/10 bg-white/[0.04] text-slate-300",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
        tone === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-300",
        tone === "info" && "border-sky-500/30 bg-sky-500/10 text-sky-300",
        tone === "brand" && "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "success" | "warning" | "info" | "danger";
}) {
  const tones = {
    brand: "from-indigo-500/20 to-violet-500/5 text-indigo-300",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-300",
    info: "from-sky-500/20 to-sky-500/5 text-sky-300",
    danger: "from-rose-500/20 to-rose-500/5 text-rose-300",
  };
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
          <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-white">{value}</div>
          {sub && <div className="mt-2 text-[12px] text-slate-400">{sub}</div>}
        </div>
        {icon && (
          <div className={cn("rounded-xl bg-gradient-to-br p-2.5", tones[tone])}>{icon}</div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------- States */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10">
        <AlertCircle className="h-5 w-5 text-rose-400" />
      </div>
      <p className="text-sm text-slate-300">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/5 text-indigo-300">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the dialog scrolling on touch devices.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#14142a] shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-slate-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Tables */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-px overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-white/[0.06] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-white/[0.04] px-4 py-3 text-slate-300", className)}>{children}</td>;
}

export function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-slate-400">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- Tabs */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
            active === tab.key
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Utility */

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard access can be denied; the value is on screen either way.
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A dot that reads as "live" without needing colour alone to convey it. */
export function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-300">
      <span className="relative flex h-2 w-2">
        {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", active ? "bg-emerald-400" : "bg-slate-600")} />
      </span>
      {label}
    </span>
  );
}
