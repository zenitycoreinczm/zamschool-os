import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  Wallet,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

import LandingFooter from "@/components/landing/LandingFooter";

const valueBlocks = [
  {
    icon: Clock3,
    title: "Save time",
    body: "Teachers finish admin work in under 10 minutes. Attendance, results, and notices without the paper chase.",
  },
  {
    icon: Wallet,
    title: "Save money",
    body: "No SMS bundles. No hidden costs. Unlimited push notifications for parents and staff.",
  },
  {
    icon: WifiOff,
    title: "Works anywhere",
    body: "Offline-first design. Built for phones and slow internet across Zambia.",
  },
];

const comparisonRows = [
  {
    feature: "SMS costs",
    other: "Paid per message",
    ours: "Free push notifications",
  },
  {
    feature: "Setup time",
    other: "Complex configuration",
    ours: "Minutes: school, class, students",
  },
  {
    feature: "Mobile friendly",
    other: "Limited / desktop-first",
    ours: "Built for phones first",
  },
  {
    feature: "Offline support",
    other: "Usually none",
    ours: "Yes, keep working offline",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Create your school",
    body: "Name your school and open the Head Teacher account. Free setup.",
  },
  {
    step: "2",
    title: "Add a class & students",
    body: "One class is enough to start. Add learners in minutes.",
  },
  {
    step: "3",
    title: "Run the school",
    body: "Mark attendance, send notices, publish results from your phone.",
  },
];

const teacherSpeed = [
  { step: "1", label: "Open class" },
  { step: "2", label: "Mark attendance" },
  { step: "3", label: "Submit" },
];

const parentHighlights = [
  {
    title: "Know when they arrive",
    body: "Get notified when attendance is marked. No more waiting for a call.",
  },
  {
    title: "See results instantly",
    body: "View published marks the moment the school releases them.",
  },
  {
    title: "Track attendance live",
    body: "Present, absent, and late, updated in real time for every child.",
  },
];

export default function HomePage() {
  return (
    <div className="landing-critical-fallback min-h-screen bg-white text-slate-900">
      {/*
        Critical CSS fallback: if the main Tailwind chunk is delayed/blocked on
        mobile networks, the hero still reads as a real product page (not raw text).
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .landing-critical-fallback{min-height:100vh;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
            .landing-critical-fallback header{position:sticky;top:0;z-index:40;border-bottom:1px solid #e2e8f0;background:rgba(255,255,255,.96)}
            .landing-critical-fallback a{color:inherit;text-decoration:none}
            .landing-critical-fallback .btn-primary,.landing-critical-fallback a[href="/register"]{border-radius:999px}
          `,
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900 sm:text-lg">
                ZamSchool OS
              </p>
              <p className="hidden text-[11px] font-medium text-slate-500 sm:block">
                School management, simplified
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {[
              ["#why", "Why us"],
              ["#compare", "Compare"],
              ["#teachers", "Teachers"],
              ["#parents", "Parents"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-sky-400 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#111827_55%,_#172554)]">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-200 sm:text-sm">
                <Zap className="h-3.5 w-3.5 text-amber-300 sm:h-4 sm:w-4" />
                The fastest way to run a school in Zambia
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:mt-7 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Run your entire school from your phone.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
                Attendance, results, communication. Done in minutes.
                <br className="hidden sm:block" />
                No SMS costs. Works offline.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:px-7 sm:py-4 sm:text-base"
                >
                  Start a School (Free Setup)
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#teachers"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:px-7 sm:py-4 sm:text-base"
                >
                  <PlayCircle className="h-4 w-4" />
                  Watch 2-Min Demo
                </a>
              </div>

              <p className="mt-4 text-xs text-slate-400 sm:text-sm">
                Built for Zambian schools · No credit card ·{" "}
                <Link href="/privacy" className="underline hover:text-slate-200">
                  Privacy
                </Link>
              </p>
            </div>

            {/* Phone-first product preview */}
            <section
              aria-label="Platform preview"
              className="mx-auto w-full max-w-sm rounded-[2rem] border border-white/10 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:p-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-semibold text-slate-500">
                    Live on phone
                  </span>
                </div>
                <Smartphone className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-900 px-4 py-3.5 text-white">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300">
                    Today · Form 2A
                  </p>
                  <p className="mt-1 text-lg font-bold">Mark attendance</p>
                  <p className="mt-1 text-xs text-slate-400">
                    32 students · under 30 seconds
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Present", "28", "text-emerald-700 bg-emerald-50"],
                    ["Absent", "3", "text-rose-700 bg-rose-50"],
                    ["Late", "1", "text-amber-700 bg-amber-50"],
                  ].map(([label, value, style]) => (
                    <div
                      key={label}
                      className={`rounded-xl px-2 py-2.5 text-center ${style}`}
                    >
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-[10px] font-semibold opacity-80">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">Parent:</span>{" "}
                  “Mwansa marked present at 07:42”
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* Value blocks */}
        <section id="why" className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 sm:py-16">
            {valueBlocks.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                Why schools switch
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Built to save time and money
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Same job as other systems, without SMS bills, long setup, or
                desktop-only screens.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-slate-200 bg-slate-900 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 sm:text-sm">
                <div className="px-3 py-3 sm:px-5 sm:py-4">Feature</div>
                <div className="px-2 py-3 sm:px-4 sm:py-4">Other systems</div>
                <div className="px-2 py-3 text-sky-300 sm:px-4 sm:py-4">
                  ZamSchool OS
                </div>
              </div>
              {comparisonRows.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-slate-100 text-sm last:border-b-0"
                >
                  <div className="px-3 py-3.5 font-semibold text-slate-900 sm:px-5">
                    {row.feature}
                  </div>
                  <div className="flex items-start gap-1.5 px-2 py-3.5 text-slate-500 sm:px-4">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span className="text-xs sm:text-sm">{row.other}</span>
                  </div>
                  <div className="flex items-start gap-1.5 bg-sky-50/50 px-2 py-3.5 font-medium text-slate-900 sm:px-4">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="text-xs sm:text-sm">{row.ours}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: simplified onboarding story */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Get started
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Three steps. Then you&apos;re running.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No complex roles on day one. Create school → add class → add
              students. Advanced desks come later when you need them.
            </p>
          </div>
          <ol className="mt-8 grid gap-3 md:grid-cols-3">
            {howItWorks.map((item) => (
              <li
                key={item.step}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
                  {item.step}
                </p>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Teacher experience: speed demo */}
        <section
          id="teachers"
          className="border-y border-slate-200 bg-slate-950 py-14 text-white sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                  For teachers
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Designed so teachers don&apos;t need training.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  Tap class → mark attendance → submit. Under 30 seconds. That is
                  the whole product promise for the teaching desk.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                  {[
                    "Attendance in one screen",
                    "Results without spreadsheets",
                    "Works on the phone they already own",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                  Teacher mode · under 30 seconds
                </p>
                <ol className="mt-6 space-y-4">
                  {teacherSpeed.map((item, i) => (
                    <li key={item.step} className="flex items-center gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-sm font-bold">
                        {item.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.label}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${((i + 1) / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 text-center text-sm font-medium text-sky-200">
                  Total: under 30 seconds · no training required
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Parent experience */}
        <section id="parents" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
              For parents
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Peace of mind, not another phone call.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Parents stay informed without SMS fees or waiting at the office
              gate.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {parentHighlights.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section id="trust" className="mx-auto max-w-7xl border-t border-slate-200 px-4 py-12 sm:px-6">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Private by design",
                body: "Each school is separate. Role-based access. Sign-in required.",
              },
              {
                icon: Smartphone,
                title: "Phone-first",
                body: "Built for the devices your teachers and parents already use.",
              },
              {
                icon: Zap,
                title: "School management, simplified",
                body: "We save time, money, and effort, not just list features.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link
              href="/privacy"
              className="font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Cookie Policy
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section id="about" className="bg-slate-950 py-14 text-white sm:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Ready when you are
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              School management, simplified.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              The fastest way to run a school in Zambia. Start free. Add your
              first class today.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-sky-400 sm:px-8 sm:py-4 sm:text-base"
              >
                Start a School (Free Setup)
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/15 sm:px-8 sm:py-4 sm:text-base"
              >
                Log in
              </Link>
              <a
                href="mailto:zenitycoreinc@gmail.com?subject=ZamSchool%20OS%20enquiry"
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 sm:px-8 sm:py-4 sm:text-base"
              >
                Contact us
              </a>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Contact: zenitycoreinc@gmail.com · +260 973 385 988 · Mungu, Zambia
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
