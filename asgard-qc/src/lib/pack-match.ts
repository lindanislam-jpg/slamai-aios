/**
 * Matches files picked from a OneDrive / SharePoint folder to the quality
 * packs imported from that same folder tree, by path.
 *
 * A pack's SharePoint path is, e.g.
 *   …/AMM602 HEL04 Skids/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/2. Returned/Admin Skid
 * and a picked file's relative path starts at whatever folder the person chose,
 *   0.2 - Large Projects/AMM602 HEL04 Skids/…/2. Returned/Admin Skid/Skid A.pdf
 * A file belongs to a pack when the start of its path is the end of the pack's
 * path: equal to it for a file pack, or a folder above the file for a folder
 * pack. Comparison ignores case, spaces and punctuation, so small renames
 * between SharePoint and the OneDrive copy still match. Only a unique match
 * counts: if two packs fit (e.g. the person chose a "1. Issued" folder that
 * exists in every project), the file is left for the person to place.
 */

export interface PackRef { id: string; kind: string; sourcePath: string | null }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const segments = (path: string) => path.split(/[\\/]/).map(norm).filter(Boolean);

export function buildPackIndex(packs: PackRef[]) {
  const files = new Map<string, PackRef[]>();
  const folders = new Map<string, PackRef[]>();
  for (const p of packs) {
    if (!p.sourcePath) continue;
    const segs = segments(p.sourcePath);
    const idx = p.kind === "folder" ? folders : files;
    for (let j = 1; j <= segs.length; j++) {
      const key = segs.slice(segs.length - j).join("/");
      const list = idx.get(key);
      if (list) list.push(p);
      else idx.set(key, [p]);
    }
  }
  return { files, folders };
}

export type PackMatch = { pack: PackRef } | { ambiguous: number } | null;

/** The pack a picked file belongs to; `relPath` includes the file name. */
export function matchPackFile(index: ReturnType<typeof buildPackIndex>, relPath: string): PackMatch {
  const r = segments(relPath);
  if (!r.length) return null;
  let ambiguous = 0;
  for (let j = r.length; j >= 1; j--) {
    const key = r.slice(0, j).join("/");
    const hits = j === r.length ? index.files.get(key) : index.folders.get(key);
    if (!hits?.length) continue;
    if (hits.length === 1) return { pack: hits[0] };
    ambiguous = Math.max(ambiguous, hits.length);
    // A longer path that is still ambiguous will not become unique when shorter.
    break;
  }
  // A path that starts below a pack folder (e.g. the person picked the pack's
  // own folder): try the file inside each folder level, deepest first.
  if (!ambiguous) {
    for (let i = 1; i < r.length; i++) {
      const tail = r.slice(i);
      for (let j = tail.length; j >= 1; j--) {
        const key = tail.slice(0, j).join("/");
        const hits = j === tail.length ? index.files.get(key) : index.folders.get(key);
        if (hits?.length === 1) return { pack: hits[0] };
        if (hits && hits.length > 1) return { ambiguous: hits.length };
      }
    }
  }
  return ambiguous ? { ambiguous } : null;
}
