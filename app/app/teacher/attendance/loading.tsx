export default function TeacherAttendanceLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="space-y-4">
        <div className="h-4 w-64 animate-pulse rounded bg-slate-200/70" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-slate-200/60"
          />
        ))}
      </div>
      <span className="sr-only">Loading roll call…</span>
    </div>
  );
}
