/** Shown the moment a sidebar link is clicked, while the server prepares the page. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading">
      <div className="h-7 w-64 rounded bg-ink-700" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-lg bg-ink-800" />)}
      </div>
      <div className="h-80 rounded-lg bg-ink-800" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
