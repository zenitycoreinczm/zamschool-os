/**
 * Root loading UI shown during route transitions.
 * Keep marketing-friendly - never look like a broken primary CTA.
 *
 * The modest min-height (30vh, not 40vh+) plus the enter-up fade keeps
 * Cumulative Layout Shift small when streamed content swaps in on slow
 * mobile connections.
 */
export default function Loading() {
  return (
    <div className="grid min-h-[30vh] animate-enter-up place-items-center bg-white px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
        <p className="text-sm font-semibold text-slate-800">Loading…</p>
        <p className="text-xs text-slate-500">
          One moment while we open the page.
        </p>
      </div>
    </div>
  );
}
