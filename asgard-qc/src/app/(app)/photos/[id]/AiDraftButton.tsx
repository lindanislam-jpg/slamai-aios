"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AiDraftButton({ photoId, again }: { photoId: string; again: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch(`/api/photos/${photoId}/ai`, { method: "POST" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) setErr(body.error ?? "AI draft failed.");
            else router.refresh();
          } catch {
            setErr("Network error.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sparkles className="h-4 w-4 text-gold-400" />
        {busy ? "Asking AI…" : again ? "Regenerate AI draft" : "Generate AI draft"}
      </button>
      {err && <span role="alert" className="text-sm text-bad-400">{err}</span>}
    </div>
  );
}
