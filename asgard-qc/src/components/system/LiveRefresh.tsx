"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Polls the latest review id and refreshes the page when a new review has
 *  finished, so an open dashboard updates without a manual reload. */
export function LiveRefresh({ latestId, intervalMs = 60_000 }: { latestId: string | null; intervalMs?: number }) {
  const router = useRouter();
  const seen = useRef(latestId);
  useEffect(() => {
    seen.current = latestId;
  }, [latestId]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/system/status", { cache: "no-store" });
        if (!res.ok) return;
        const { latest } = (await res.json()) as { latest: { id: string; status: string } | null };
        if (latest && latest.status !== "RUNNING" && latest.id !== seen.current) {
          seen.current = latest.id;
          router.refresh();
        }
      } catch {
        // Network blips are ignored; the next poll retries.
      }
    }, intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
