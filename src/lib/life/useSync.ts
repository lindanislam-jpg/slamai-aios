"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { differsFrom, mergeStates, type SyncPayload, type SyncStatus } from "./sync";
import type { LifeState } from "./types";

/**
 * Keeps this device's copy in step with the account's copy on the server.
 *
 * The rules it follows, in order:
 *
 *   1. Signed out, it does nothing at all. /life is local-first and stays fully
 *      usable with no account, no network and no server.
 *   2. On sign-in it pulls, merges the server's copy into this device's, and
 *      pushes the result — so the first device to sync donates its history
 *      rather than being overwritten by an empty account.
 *   3. Local edits are pushed after a short quiet period, not per keystroke.
 *   4. It pulls again when you come back to the tab or the network returns,
 *      which is what makes "wake up on the laptop, journal on the phone" work.
 *   5. A push rejected as stale (409) is merged with what the server returned
 *      and retried once. Nothing is dropped on the floor.
 */

const PUSH_DEBOUNCE_MS = 1_500;
const POLL_MS = 60_000;

interface Options {
  state: LifeState;
  ready: boolean;
  /** Called with the merged result whenever the server contributes something. */
  onMerged: (next: LifeState) => void;
}

export interface SyncInfo {
  status: SyncStatus;
  /** Epoch ms of the last successful exchange with the server. */
  lastSyncedAt: number | null;
  /** Present only when status is "error" — shown to the user verbatim. */
  error: string | null;
  /** Signed-in email, for "syncing as ..." copy. */
  account: string | null;
  /** Force a pull-merge-push cycle now. */
  syncNow: () => void;
  /**
   * Throws away the server's copy and replaces it with `next`, without merging.
   * Only for deliberate destructive actions — reset, or restoring a backup —
   * where merging would resurrect exactly what the user just removed.
   *
   * The state is passed in rather than read from this hook: the caller dispatches
   * and calls this in the same tick, before React has re-rendered, so anything
   * read from a ref here would still be the copy the user just discarded.
   */
  overwrite: (next: LifeState) => void;
}

export function useSync({ state, ready, onMerged }: Options): SyncInfo {
  const { data: session, status: authStatus } = useSession();
  const signedIn = authStatus === "authenticated";
  const account = session?.user?.email ?? null;

  const [status, setStatus] = useState<SyncStatus>("off");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Server revision this device last saw. Sent with every push. */
  const revision = useRef(0);
  /** The live state, so the sync loop never closes over a stale copy. */
  const latest = useRef(state);
  latest.current = state;
  const onMergedRef = useRef(onMerged);
  onMergedRef.current = onMerged;
  /** Guards against two cycles overlapping. */
  const running = useRef(false);
  /**
   * Bumped whenever the state is deliberately replaced (reset, import). A cycle
   * that started before the replacement must not apply what it read afterwards,
   * or the reset is silently undone by a pull that was already in the air.
   */
  const generation = useRef(0);
  /** Set while a push is owed, so a failed attempt is retried rather than lost. */
  const pending = useRef(false);
  const firstPull = useRef(false);

  const cycle = useCallback(
    async (reason: "pull" | "push") => {
      if (!signedIn || running.current) {
        if (reason === "push") pending.current = true;
        return;
      }
      running.current = true;
      const gen = generation.current;
      const superseded = () => generation.current !== gen;
      setStatus("syncing");

      try {
        // Pull first, always: pushing without knowing what is there risks
        // flattening a day another device logged.
        const res = await fetch("/api/life/sync", { cache: "no-store" });
        if (res.status === 401) {
          setStatus("off");
          return;
        }
        if (!res.ok) throw new Error(`The server answered ${res.status}.`);

        const remote = (await res.json()) as SyncPayload;
        // A reset or import landed while this pull was in the air. What came
        // back describes a life the user has just replaced; drop it.
        if (superseded()) return;
        revision.current = remote.revision;

        let next = latest.current;
        if (remote.data) {
          next = mergeStates(latest.current, remote.data);
          onMergedRef.current(next);
        }

        const owed = pending.current || !remote.data || differsFrom(next, remote.data);
        if (owed) {
          let put = await fetch("/api/life/sync", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data: next, baseRevision: revision.current }),
          });

          // Another device pushed between our pull and our push. Merge what it
          // wrote and try once more, rather than overwriting it.
          if (put.status === 409) {
            const theirs = (await put.json()) as SyncPayload;
            revision.current = theirs.revision;
            if (theirs.data) {
              next = mergeStates(latest.current, theirs.data);
              onMergedRef.current(next);
            }
            put = await fetch("/api/life/sync", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ data: next, baseRevision: revision.current }),
            });
          }

          if (!put.ok) throw new Error(`Could not save to the server (${put.status}).`);
          const saved = (await put.json()) as SyncPayload;
          if (superseded()) return;
          revision.current = saved.revision;
        }

        pending.current = false;
        setLastSyncedAt(Date.now());
        setError(null);
        setStatus("idle");
      } catch (err) {
        // Offline is not an error worth alarming anyone about: the device still
        // has everything, and the push happens when the network comes back.
        pending.current = true;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setStatus("offline");
          setError(null);
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Sync failed.");
        }
      } finally {
        running.current = false;
      }
    },
    [signedIn],
  );

  /* Signed out: say so plainly and do nothing else. */
  useEffect(() => {
    if (!signedIn) {
      setStatus("off");
      firstPull.current = false;
      revision.current = 0;
    }
  }, [signedIn]);

  /* First pull once signed in and the local state is loaded. */
  useEffect(() => {
    if (!ready || !signedIn || firstPull.current) return;
    firstPull.current = true;
    void cycle("pull");
  }, [ready, signedIn, cycle]);

  /* Push local edits after a pause in typing. */
  useEffect(() => {
    if (!ready || !signedIn || !firstPull.current) return;
    const t = window.setTimeout(() => void cycle("push"), PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state, ready, signedIn, cycle]);

  /* Pull when the tab is looked at again, when the network returns, and slowly
     in the background — the three moments another device's work can appear. */
  useEffect(() => {
    if (!signedIn) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") void cycle("pull");
    };
    const onOnline = () => void cycle("pull");
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    const t = window.setInterval(() => void cycle("pull"), POLL_MS);
    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.clearInterval(t);
    };
  }, [signedIn, cycle]);

  const syncNow = useCallback(() => void cycle("pull"), [cycle]);

  const overwrite = useCallback(
    (next: LifeState) => {
      if (!signedIn) return;
      void (async () => {
        // Take the same lock the sync cycle uses, and invalidate anything
        // already in flight, so a pull cannot restore what is being deleted.
        generation.current += 1;
        running.current = true;
        try {
          setStatus("syncing");
          // Drop the stored copy first. Without this the next pull would merge
          // the deleted days straight back in, and a reset would not stick.
          await fetch("/api/life/sync", { method: "DELETE" });
          revision.current = 0;
          const put = await fetch("/api/life/sync", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data: next, baseRevision: 0 }),
          });
          if (!put.ok) throw new Error(`Could not save to the server (${put.status}).`);
          const saved = (await put.json()) as SyncPayload;
          revision.current = saved.revision;
          pending.current = false;
          setLastSyncedAt(Date.now());
          setError(null);
          setStatus("idle");
        } catch {
          pending.current = true;
          setStatus("error");
          setError("Could not clear the synced copy. It will retry.");
        } finally {
          running.current = false;
        }
      })();
    },
    [signedIn],
  );

  return { status, lastSyncedAt, error, account, syncNow, overwrite };
}
