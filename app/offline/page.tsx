/**
 * Next.js /offline route — also used if someone navigates while partially online.
 * Primary offline shell is public/offline.html (inline CSS, SW-precache).
 * This page uses inline styles so it still looks right if Tailwind is missing.
 */
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "3rem 1.25rem",
        background:
          "linear-gradient(145deg, #0f172a 0%, #111827 55%, #172554 100%)",
        color: "#f8fafc",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "32rem",
          margin: "0 auto",
          borderRadius: "1.5rem",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          padding: "2rem 1.5rem",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#7dd3fc",
          }}
        >
          Offline · site is live
        </p>
        <h1
          style={{
            margin: "1rem 0 0.75rem",
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            lineHeight: 1.2,
            letterSpacing: "-0.03em",
          }}
        >
          You&apos;re offline — ZamSchool OS is still here
        </h1>
        <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.65 }}>
          The product is online for schools across Zambia. Your connection
          dropped. Reconnect and refresh to open the full app.
        </p>
        <ul
          style={{
            margin: "1.25rem 0 0",
            paddingLeft: "1.15rem",
            color: "#e2e8f0",
            lineHeight: 1.7,
            fontSize: "0.95rem",
          }}
        >
          <li>Reconnect to mobile data or school Wi‑Fi</li>
          <li>Open the site again from your home screen or bookmark</li>
          <li>Do not enter new payments until you are online</li>
        </ul>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
            marginTop: "1.5rem",
          }}
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              padding: "0.85rem 1.15rem",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Go to home
          </a>
          <a
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              padding: "0.85rem 1.15rem",
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.18)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Log in
          </a>
        </div>
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.85rem 1rem",
            borderRadius: "0.85rem",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: "0.8rem",
            color: "#94a3b8",
          }}
        >
          Tip: After reconnecting, refresh once so class lists and balances
          update fully.
        </div>
      </div>
    </main>
  );
}
