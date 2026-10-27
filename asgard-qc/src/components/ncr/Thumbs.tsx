import Link from "next/link";

export interface ThumbPhoto {
  id: string;
  code: string;
  thumbKey: string | null;
  caption?: string | null;
  reworkPhase?: string | null;
  category?: string | null;
}

/** Photo thumbnails linking to the evidence record. Shared by NCR, rework
 *  and release pages. */
export function Thumbs({ photos, size = "h-24 w-32" }: { photos: ThumbPhoto[]; size?: string }) {
  if (!photos.length) return <p className="text-sm text-ink-300">No photographs linked.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((p) => (
        <Link key={p.id} href={`/photos/${p.id}`} className="group block" title={p.caption ?? p.code}>
          <div className={`${size} overflow-hidden rounded-md border border-ink-600 bg-ink-900`}>
            {p.thumbKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/photo/${p.id}?size=thumb`} alt={p.caption ?? p.code} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-ink-300">No preview (original stored)</div>
            )}
          </div>
          <div className="mt-1 text-[11px] text-ink-300">
            {p.code}
            {p.reworkPhase && <span className={p.reworkPhase === "BEFORE" ? " text-warn-400" : " text-ok-400"}> · {p.reworkPhase.toLowerCase()}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Before/after columns for a repair. */
export function BeforeAfter({ photos }: { photos: ThumbPhoto[] }) {
  const before = photos.filter((p) => p.reworkPhase === "BEFORE");
  const after = photos.filter((p) => p.reworkPhase === "AFTER");
  const other = photos.filter((p) => !p.reworkPhase);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warn-400">Before</div>
        {before.length ? <Thumbs photos={before} size="h-20 w-28" /> : <p className="text-xs text-ink-300">None recorded</p>}
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ok-400">After</div>
        {after.length ? <Thumbs photos={after} size="h-20 w-28" /> : <p className="text-xs text-ink-300">None recorded</p>}
      </div>
      {other.length > 0 && (
        <div className="sm:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-300">Other</div>
          <Thumbs photos={other} size="h-20 w-28" />
        </div>
      )}
    </div>
  );
}
