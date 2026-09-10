"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side data access for the dashboard.
 *
 * Every page uses these two helpers so loading, error and retry behave
 * identically, and so an API's own error message is what the user sees rather
 * than a generic failure.
 */

type State<T> = { data: T | null; loading: boolean; error: string | null };

export function useApi<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, loading: Boolean(url), error: null });

  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await fetch(url);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      setState({ data: payload as T, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Could not load this. Check your connection.",
      });
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

export async function api<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

/** Turns any thrown value into something safe to show in a toast. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
