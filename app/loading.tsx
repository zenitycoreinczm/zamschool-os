/**
 * Root loading UI shown during route transitions.
 * Keep marketing-friendly - never look like a broken primary CTA.
 */
export default function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center bg-white px-4">
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
