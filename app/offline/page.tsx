export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
          Offline
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          This page needs a connection
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-200">
          ZamSchool works best online. On school Wi‑Fi or mobile data, reconnect
          and refresh. Dashboards, attendance, and announcements you opened
          earlier may still open from cache.
        </p>
        <ul className="mt-6 space-y-2 text-sm leading-6 text-slate-300">
          <li>Reconnect to mobile data or school Wi‑Fi</li>
          <li>Open the app again from your home screen or bookmark</li>
          <li>Do not enter new payments or marks until you are online</li>
        </ul>
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
          Tip: After reconnecting, refresh once so class lists and balances
          update fully.
        </div>
      </div>
    </main>
  );
}
