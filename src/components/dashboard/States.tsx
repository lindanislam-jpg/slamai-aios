"use client";

import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-slate-300 font-medium mb-1">Couldn&apos;t load this</p>
      <p className="text-sm text-slate-500 max-w-sm mb-5">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-slam-card border border-slam-border flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-slate-200 font-medium mb-1">{title}</p>
      <p className="text-sm text-slate-500 max-w-sm mb-5">{description}</p>
      {action}
    </div>
  );
}
