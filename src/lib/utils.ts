import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string) {
  const now  = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  if (diff < 60000)   return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}
