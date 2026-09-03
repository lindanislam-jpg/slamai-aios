import { Construction } from "lucide-react";

/**
 * Marks a section that has no backend yet. The layout below it is a preview of
 * what is planned — without this banner the placeholder figures read as live
 * numbers.
 */
export default function PreviewNotice({ feature }: { feature: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-start gap-3 border-l-2 border-yellow-500/50">
      <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
        <Construction className="w-4 h-4 text-yellow-400" />
      </div>
      <div>
        <h3 className="font-semibold text-sm text-slate-200">{feature} is not connected yet</h3>
        <p className="text-sm text-slate-400 mt-0.5">
          This page is a preview of the planned interface. Nothing here is wired to a backend,
          so no figures are shown and the controls do not run anything.
        </p>
      </div>
    </div>
  );
}
