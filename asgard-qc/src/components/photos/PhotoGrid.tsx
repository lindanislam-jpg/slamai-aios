import Link from "next/link";
import { Badge } from "@/components/ui";
import { PhotoDate, Thumb } from "./Thumb";

export interface GridPhoto {
  id: string;
  code: string;
  category: string;
  caption: string | null;
  thumbKey: string | null;
  takenAt: Date | null;
  uploadedAt: Date;
  reviewStatus: string;
  isDemo: boolean;
  project?: { code: string } | null;
  unit?: { ref: string } | null;
}

export function PhotoGrid({ photos }: { photos: GridPhoto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {photos.map((p) => (
        <li key={p.id} className="card overflow-hidden">
          <Link href={`/photos/${p.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
            <Thumb id={p.id} hasThumb={!!p.thumbKey} alt={p.caption ?? p.category} className="aspect-[4/3] w-full" />
            <div className="space-y-1 p-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gold-300">{p.code}</span>
                <span className="flex gap-1">{p.isDemo && <Badge tone="gold" label="DEMO" />}<Badge value={p.reviewStatus} /></span>
              </div>
              <div className="truncate text-xs text-ink-100">{p.caption ?? p.category}</div>
              <div className="truncate text-[11px] text-ink-300">{[p.project?.code, p.unit?.ref, p.category].filter(Boolean).join(" · ")}</div>
              <div className="text-[11px]"><PhotoDate takenAt={p.takenAt} uploadedAt={p.uploadedAt} /></div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
