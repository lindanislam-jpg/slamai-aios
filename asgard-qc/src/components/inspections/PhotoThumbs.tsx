import Link from "next/link";

interface P {
  id: string;
  code: string;
  caption?: string | null;
  thumbKey?: string | null;
  takenAt?: Date | null;
}

/** Thumbnail grid linking to the photo record. Thumbnails stream through the authenticated file route. */
export function PhotoThumbs({ photos, cols = 3, empty = "No photos linked." }: { photos: P[]; cols?: 2 | 3 | 4; empty?: string }) {
  if (!photos.length) return <p className="text-sm text-ink-300">{empty}</p>;
  return (
    <div className={cols === 2 ? "grid grid-cols-2 gap-2" : cols === 4 ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid grid-cols-3 gap-2"}>
      {photos.map((ph) => (
        <PhotoThumb key={ph.id} p={ph} />
      ))}
    </div>
  );
}

export function PhotoThumb({ p }: { p: P }) {
  return (
    <Link href={`/photos/${p.id}`} className="group block overflow-hidden rounded-md border border-ink-600" title={p.caption ?? p.code}>
      {p.thumbKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/photo/${p.id}?size=thumb`} alt={p.caption ?? p.code} className="aspect-[4/3] w-full object-cover transition group-hover:opacity-80" loading="lazy" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-ink-700 text-[10px] text-ink-300">No preview (original stored)</div>
      )}
      <div className="truncate px-1.5 py-1 text-[10px] text-ink-300">
        {p.code}
        {p.caption ? ` · ${p.caption}` : ""}
      </div>
    </Link>
  );
}
