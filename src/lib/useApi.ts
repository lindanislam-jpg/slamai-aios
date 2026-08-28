"use client";

import { useCallback, useEffect, useState } from "react";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches a JSON endpoint on mount and exposes a refresh for after mutations.
 * Every dashboard page uses this so loading and error handling stay consistent.
 */
export function useResource<T>(url: string) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setState({ data: (await res.json()) as T, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Could not load this data",
      });
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return {
    ...state,
    refresh: load,
    setData: (data: T) => setState((s) => ({ ...s, data })),
  };
}

/** POST/PATCH/DELETE helper that surfaces the API's own error message. */
export async function mutate<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload as T;
}
