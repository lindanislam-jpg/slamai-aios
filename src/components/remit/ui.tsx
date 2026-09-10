import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { brand, wordmark } from "@/remit/config/brand";

/**
 * Shared presentation primitives for the money-transfer product.
 *
 * Mobile-first: large tap targets, generous type, one column by default and
 * only widening on `sm:` and up.
 */

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/send"
      className={clsx("inline-flex items-center gap-2 font-bold tracking-tight", className)}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-[10px] bg-send-primary text-[15px] font-black text-white"
      >
        {brand.name.slice(0, 1)}
      </span>
      <span className="text-[17px] text-send-ink">
        {brand.name}
        <span className="text-send-primary">{brand.suffix}</span>
      </span>
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-send-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "min-h-[54px] px-6 text-[16px]" : "min-h-[46px] px-5 text-[15px]",
        variant === "primary" && "bg-send-primary text-white hover:bg-send-primary-strong",
        variant === "secondary" &&
          "border border-send-line bg-white text-send-ink hover:border-send-primary hover:text-send-primary",
        variant === "ghost" && "text-send-primary hover:bg-send-primary-soft",
        variant === "danger" && "bg-send-danger text-white hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        size === "lg" ? "min-h-[54px] px-6 text-[16px]" : "min-h-[46px] px-5 text-[15px]",
        variant === "primary" && "bg-send-primary text-white hover:bg-send-primary-strong",
        variant === "secondary" &&
          "border border-send-line bg-white text-send-ink hover:border-send-primary hover:text-send-primary",
        variant === "ghost" && "text-send-primary hover:bg-send-primary-soft",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={clsx("send-card p-5 sm:p-6", className)}>{children}</Tag>;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-send-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] leading-snug text-send-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] font-medium leading-snug text-send-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-send-line bg-white px-4 py-3 text-[16px] text-send-ink " +
  "placeholder:text-send-muted/70 focus:border-send-primary focus:outline-none focus:ring-2 " +
  "focus:ring-send-primary/20";

/**
 * The sandbox badge.
 *
 * Shown anywhere a number or a status came from a sandbox provider. It is not
 * decoration: it is the thing that stops a demo being mistaken for real money
 * movement, so it is never conditional on a design preference.
 */
export function SandboxBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-send-accent-soft px-2.5 py-1",
        "text-[11px] font-bold uppercase tracking-wide text-send-warning",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-send-accent" />
      Sandbox
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-send-primary-soft text-send-primary",
  SENT: "bg-send-primary-soft text-send-primary",
  CONVERTING: "bg-blue-50 text-blue-700",
  PAYMENT_RECEIVED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  PENDING: "bg-slate-100 text-slate-600",
  COMPLIANCE_REVIEW: "bg-send-accent-soft text-send-warning",
  FAILED: "bg-send-danger-soft text-send-danger",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        STATUS_TONE[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

/** A labelled money row — the building block of every pricing breakdown. */
export function SummaryRow({
  label,
  value,
  sublabel,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasis?: boolean;
  tone?: "accent" | "primary";
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <div
          className={clsx(
            "text-[14px]",
            emphasis ? "font-semibold text-send-ink" : "text-send-body",
          )}
        >
          {label}
        </div>
        {sublabel && <div className="text-[12px] text-send-muted">{sublabel}</div>}
      </div>
      <div
        className={clsx(
          "tnum shrink-0 text-right",
          emphasis ? "text-[17px] font-bold" : "text-[15px] font-semibold",
          tone === "accent" && "text-send-warning",
          tone === "primary" && "text-send-primary",
          !tone && "text-send-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-send-line bg-white px-6 py-12 text-center">
      <h3 className="text-[16px] font-semibold text-send-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-send-body">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={clsx(
        "rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        tone === "info" && "border-send-line bg-white text-send-body",
        tone === "warning" && "border-send-accent/40 bg-send-accent-soft text-send-warning",
        tone === "danger" && "border-send-danger/30 bg-send-danger-soft text-send-danger",
        tone === "success" && "border-send-primary/25 bg-send-primary-soft text-send-primary",
      )}
    >
      {title && <div className="mb-0.5 font-bold">{title}</div>}
      {children}
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-send-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-send-body">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-send-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-3 text-[13px] leading-relaxed text-send-body">{brand.tagline}</p>
            <p className="mt-4 rounded-lg bg-send-accent-soft px-3 py-2 text-[12px] leading-relaxed text-send-warning">
              <strong>Sandbox environment.</strong> {wordmark()} is not connected to a regulated
              payment provider and cannot move money. No regulatory licence, registration or
              partnership is claimed.
            </p>
          </div>
          <nav aria-label="Legal" className="grid grid-cols-2 gap-x-10 gap-y-2 text-[13px]">
            {[
              ["Terms & Conditions", "/send/legal/terms"],
              ["Privacy Policy", "/send/legal/privacy"],
              ["Cookie Policy", "/send/legal/cookies"],
              ["Fees", "/send/legal/fees"],
              ["Complaints", "/send/legal/complaints"],
              ["Regulatory information", "/send/legal/regulatory"],
              ["Verification & KYC", "/send/legal/verification"],
              ["Help & support", "/send/help"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-send-body hover:text-send-primary">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-send-line pt-6 text-[12px] text-send-muted">
          © {new Date().getFullYear()} {brand.legalEntity}. Exchange rates shown in this
          environment are indicative sandbox values, not market rates.
        </p>
      </div>
    </footer>
  );
}
