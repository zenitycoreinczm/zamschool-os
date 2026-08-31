"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ChevronRight, Menu, X } from "lucide-react";

import LandingFooter from "@/components/landing/LandingFooter";
import SystemStatusBadge from "@/components/landing/SystemStatusBadge";

const platformFeatures = {
  web: [
    {
      title: "Head Teacher & Bursar Dashboard",
      desc: "Full school oversight: student enrollment, teacher allocation, financial summaries, and timetable scheduling in one high-density portal.",
    },
    {
      title: "Bursar Fee Ledger & Kwacha Accounting",
      desc: "Track tuition fees, PTA levies, exam fees, generate instant digital receipts, and export real-time arrears reports.",
    },
    {
      title: "ECZ-Standard Batch Report Cards",
      desc: "One-click generation of official terminal report cards with Zambian grading scale (Distinction to Unsatisfactory) and class rankings.",
    },
    {
      title: "Bulk CSV Onboarding & Records",
      desc: "Import hundreds of learners and staff records in seconds from existing spreadsheets with zero data loss.",
    },
  ],
  android: [
    {
      title: "Sub-30-Second Classroom Roll Call",
      desc: "Designed for smartphones. Teachers mark 40+ learners in seconds with quick tap gestures directly in the classroom.",
    },
    {
      title: "100% Offline-First Architecture",
      desc: "Take attendance and enter marks without active internet. Data syncs automatically once a 2G/3G/4G or Wi-Fi connection is detected.",
    },
    {
      title: "Zero-Cost Instant Push Broadcasts",
      desc: "Parents receive instant arrival alerts, school notices, and emergency broadcasts with zero costly SMS bundles.",
    },
    {
      title: "Parent Portal on Any Smartphone",
      desc: "Guardians track attendance timestamps, continuous assessment marks, and fee payment balances in real time.",
    },
  ],
};

const architecturePillars = [
  {
    badge: "Local-First Core",
    title: "Offline-First Sync Engine",
    description:
      "Built with client-side IndexedDB caching and Service Worker background sync. Teachers work uninterrupted during power cuts or network outages across Zambian provinces.",
  },
  {
    badge: "Cost Reduction",
    title: "Zero-SMS Direct Push Mesh",
    description:
      "Replaces expensive carrier SMS bundles with native Web and Android push protocols, saving schools thousands of Zambian Kwacha every academic term.",
  },
  {
    badge: "National Syllabus",
    title: "ECZ-Aligned Academic Engine",
    description:
      "Pre-configured for Zambian secondary and primary grading standards (Divisions 1–4, Distinctions, Merits, Credits, Passes) with automated aggregate calculations.",
  },
  {
    badge: "Security & Governance",
    title: "Multi-Role RBAC & Audit Trails",
    description:
      "Granular permission gates for Headteachers, Deputies, Bursars, Class Teachers, and Parents ensure strict data privacy and eliminate unauthorized grade tampering.",
  },
];

const moduleBreakdown = [
  {
    title: "Classroom Attendance Engine",
    tag: "Sub-30s Roll Call",
    tagClass: "text-sky-600",
    points: [
      "Sub-30-second roll calls per classroom",
      "Immediate parent notification on mark entry",
      "Termly Ministry of Education attendance logs",
      "Automated absentee risk alerts for administration",
    ],
  },
  {
    title: "Academic Grading & Report Cards",
    tag: "ECZ Form 1–4 & Grade 1–7",
    tagClass: "text-emerald-600",
    points: [
      "Continuous Assessment (CA) & Terminal Exam marks",
      "ECZ-compliant grading scales & class rankings",
      "Automated teacher & headmaster remarks",
      "One-click batch printable PDF report cards",
    ],
  },
  {
    title: "Bursar & School Fees Ledger",
    tag: "Kwacha Accounting",
    tagClass: "text-amber-600",
    points: [
      "Real-time tuition, boarding, and PTA fee tracking",
      "Automated digital payment receipts with audit IDs",
      "Class-by-class arrears and collection breakdown",
      "Exportable financial summaries for board meetings",
    ],
  },
  {
    title: "Zero-Cost Communications",
    tag: "No SMS Bills",
    tagClass: "text-purple-600",
    points: [
      "Whole-school and class-specific broadcast channels",
      "Direct push notices to Android phones and Web",
      "Instant event, holiday, and exam timetable alerts",
      "Replaces all costly SMS subscription bills",
    ],
  },
];

const comparisonData = [
  {
    aspect: "Platform Availability",
    legacy: "Desktop-only or paper logbooks",
    zamschool: "Dual Platform: Web Portal + Android Mobile App",
  },
  {
    aspect: "Offline Operation",
    legacy: "Requires continuous fast broadband",
    zamschool: "100% Offline-First (Syncs when connected)",
  },
  {
    aspect: "Parent Communication Cost",
    legacy: "K0.30–K0.50 per SMS bundle bill",
    zamschool: "K0.00 (Unlimited direct push alerts)",
  },
  {
    aspect: "Attendance Roll Call Time",
    legacy: "10–15 minutes of teacher lecture time",
    zamschool: "Under 30 seconds per classroom",
  },
  {
    aspect: "ECZ Report Card Compilation",
    legacy: "Days of manual calculator aggregation",
    zamschool: "Instant 1-click batch PDF generation",
  },
  {
    aspect: "Fee Arrears Reconciliation",
    legacy: "Disorganized paper bank slips",
    zamschool: "Real-time ledger with automated balances",
  },
  {
    aspect: "Setup & Deployment Time",
    legacy: "Weeks of on-premise installation",
    zamschool: "Under 5 minutes (Cloud & Mobile ready)",
  },
];

const trustPillars = [
  {
    title: "Multi-Role Access Control",
    description:
      "Granular permissions for Head Teachers, Bursars, Class Teachers, and Parents. Every user sees only what their role allows - nothing more.",
  },
  {
    title: "Row-Level Database Security",
    description:
      "Every table enforces school-scoped row-level security, so one school can never read another school's records, even by accident.",
  },
  {
    title: "Complete Audit Trails",
    description:
      "Sensitive actions are logged with who did what, and when. Changes to results, fees, and records stay traceable end to end.",
  },
  {
    title: "Encryption & Backups",
    description:
      "Traffic is encrypted in transit and data rests on managed encrypted infrastructure with operational backups for recovery.",
  },
];

const pilotIncluded = [
  "Unlimited attendance & sub-30-second roll calls",
  "ECZ-aligned results & printable report cards",
  "Fee ledger, digital receipts & arrears tracking",
  "Unlimited parent & staff push notifications",
  "Offline mode on Web and Android",
  "Full school data export whenever you need it",
];

const pilotTerms = [
  "When paid plans begin, pricing is agreed with each school in advance - never a surprise invoice.",
  "Unlimited push notifications stay free. There are no per-message charges, ever.",
  "Your school data remains yours and is always exportable - no lock-in.",
  "Setup, onboarding, and support are included while the pilot runs.",
];

const faqItems = [
  {
    q: "Does ZamSchool OS work when there is no internet in the classroom?",
    a: "Yes. ZamSchool OS is built with a local-first offline synchronization engine. Teachers can take daily roll calls and input marks completely offline. As soon as the device reconnects to Wi-Fi or mobile data, all records synchronize seamlessly with the school's central database.",
  },
  {
    q: "What devices do our teachers and administration need?",
    a: "Administrators and Bursars can access the full Web Cloud Portal on any standard desktop PC, laptop, or tablet. Teachers and Parents can use any standard Android smartphone via the mobile application or modern mobile web browser.",
  },
  {
    q: "How does ZamSchool OS eliminate SMS communication expenses?",
    a: "Traditional systems charge schools per SMS sent to parents. ZamSchool OS leverages native push notification meshes on Android and Web browsers. When a teacher marks attendance or publishes term results, parents receive instant notifications with zero carrier SMS fees.",
  },
  {
    q: "Is ZamSchool OS compliant with the Zambian ECZ grading system?",
    a: "Yes. ZamSchool OS includes native support for Zambian secondary and primary academic structures, including Term 1, 2, and 3 sessions, Continuous Assessment (CA) weighting, ECZ grading distinctions (1–9), and official aggregate computations.",
  },
  {
    q: "How much does ZamSchool OS cost?",
    a: "Setup is free. While we onboard founding schools, the entire platform is free during the pilot - attendance, results, the fee ledger, and unlimited parent notifications included. When paid plans begin, pricing will be agreed with each school in advance, and there are no per-SMS or per-message charges.",
  },
  {
    q: "Who develops and maintains ZamSchool OS?",
    a: "ZamSchool OS is engineered and backed by ZenityCore Technologies (zenitycore.tech), led by CEO Ison Mumbuna. Our engineering team provides continuous system updates, data backups, and dedicated nationwide customer support across Zambia.",
  },
];

const mobileNavLinks = [
  { href: "#platforms", label: "Dual Platform (Web & Android)" },
  { href: "#architecture", label: "Offline Sync Architecture" },
  { href: "#modules", label: "School Modules & Features" },
  { href: "#compare", label: "Compare with Legacy SMS" },
  { href: "#pricing", label: "Free Founding Pilot Pricing" },
  { href: "#leadership", label: "ZenityCore Corporate Leadership" },
  { href: "#faq", label: "Frequently Asked Questions" },
];

function Check({ className = "bg-emerald-100 text-emerald-700" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${className}`}
    >
      ✓
    </span>
  );
}

function Cross() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-600"
    >
      ✕
    </span>
  );
}

const sectionChips = [
  { href: "#platforms", label: "Platforms" },
  { href: "#architecture", label: "Architecture" },
  { href: "#modules", label: "Modules" },
  { href: "#compare", label: "Compare" },
  { href: "#pricing", label: "Pricing" },
  { href: "#leadership", label: "Leadership" },
  { href: "#faq", label: "FAQ" },
];

export default function HomePage() {
  // Native <details> powers the mobile drawer so navigation works even
  // before React hydration completes on slow 3G/4G connections.
  const mobileNavRef = useRef<HTMLDetailsElement>(null);
  const closeMobileNav = () => {
    if (mobileNavRef.current?.open) {
      mobileNavRef.current.removeAttribute("open");
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 antialiased selection:bg-sky-600 selection:text-white">
      <header className="landing-header sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex min-h-[44px] min-w-0 items-center gap-2.5 py-1 sm:gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 sm:h-10 sm:w-10">
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
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                  ZamSchool<span className="text-sky-600">OS</span>
                </span>
              </div>
              <p className="max-w-[200px] truncate text-[10px] font-medium leading-tight text-slate-500 sm:max-w-none sm:text-xs">
                Zambian School Operating System
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <Link href="#platforms" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Web & Android
            </Link>
            <Link href="#architecture" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Architecture
            </Link>
            <Link href="#modules" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Modules
            </Link>
            <Link href="#compare" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Comparison
            </Link>
            <Link href="#pricing" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Pricing
            </Link>
            <Link href="#leadership" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              Leadership
            </Link>
            <Link href="#faq" className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-sky-700">
              FAQ
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="landing-press hidden min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-95 sm:inline-flex"
            >
              Free Setup
            </Link>

            {/* Mobile drawer: native <details> so it opens without JS. */}
            <details className="group relative lg:hidden" ref={mobileNavRef}>
              <summary
                className="landing-nav-toggle landing-press flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-5 w-5 group-open:hidden" />
                <X className="hidden h-5 w-5 group-open:block" />
              </summary>

              <div className="mobile-nav-panel absolute inset-x-0 top-full z-50 mt-2 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
                <nav className="flex flex-col" aria-label="Mobile navigation">
                  {mobileNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileNav}
                      className="flex min-h-[48px] items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition last:border-b-0 hover:text-sky-700 active:text-sky-700"
                    >
                      {link.label}
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </nav>

                <div className="mt-3 grid grid-cols-2 gap-2.5 pb-1">
                  <Link
                    href="/login"
                    onClick={closeMobileNav}
                    className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={closeMobileNav}
                    className="landing-press flex min-h-[48px] items-center justify-center rounded-xl bg-sky-600 text-center text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
                  >
                    Start School
                  </Link>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Always-visible section shortcuts on mobile: one-tap navigation
            without opening the drawer. Horizontally scrollable, no JS. */}
        <nav
          aria-label="Section shortcuts"
          className="border-t border-slate-100 bg-white/95 backdrop-blur-md lg:hidden"
        >
          <div className="landing-chip-strip mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6">
            {sectionChips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className="flex min-h-[36px] shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 active:bg-sky-100 active:text-sky-800"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white pt-10 pb-14 sm:pt-16 sm:pb-20 lg:py-24">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="flex flex-col items-start text-left">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-sky-700 shadow-sm">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="leading-snug">Backed by ZenityCore Technologies · Zambian Education OS</span>
                </div>

                <h1 className="mt-5 text-[clamp(1.75rem,6.5vw,2.5rem)] font-black leading-[1.15] tracking-tight text-slate-900 break-words lg:text-[3.25rem] lg:leading-[1.12]">
                  Run your entire school{" "}
                  <span className="bg-gradient-to-r from-sky-600 to-emerald-500 bg-clip-text text-transparent">
                    from your phone
                  </span>{" "}
                  or computer.
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg sm:leading-8">
                  Engineered for <span className="font-semibold text-slate-900">Web & Android</span>. Take morning roll calls in{" "}
                  <span className="font-semibold text-emerald-600">30 seconds offline</span>, compile ECZ-standard report
                  cards with one click, eliminate expensive SMS bundles with direct push alerts, and balance school fee
                  ledgers with total transparency.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium sm:gap-2.5 sm:text-sm">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 sm:px-3.5 sm:py-2">
                    Android App · Teachers & Parents
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 sm:px-3.5 sm:py-2">
                    Web Cloud · Head Teacher & Bursar
                  </div>
                </div>

                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/register"
                    className="landing-press inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 active:scale-95 sm:w-auto sm:py-4 sm:text-base"
                  >
                    Start a School (Free Pilot)
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <Check className="bg-emerald-100 text-emerald-700" />
                    100% Offline Ready
                  </span>
                  <span className="flex items-center gap-2">
                    <Check className="bg-emerald-100 text-emerald-700" />
                    Zero SMS Carrier Costs
                  </span>
                  <span className="flex items-center gap-2">
                    <Check className="bg-emerald-100 text-emerald-700" />
                    ECZ Grading Aligned
                  </span>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[400px]">
                <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-b from-sky-100/60 to-transparent blur-xl" aria-hidden="true" />
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/[0.03]">
                  <Image
                    src="/landing.jpg"
                    alt="ZamSchool OS in action"
                    width={880}
                    height={1168}
                    priority
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platforms" className="landing-section border-y border-slate-200 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                Dual Platform Architecture
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Built for High-Power Desktop & Agile Mobile
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                ZamSchool OS provides dedicated experiences for administrative desktops and classroom mobile phones,
                synchronized in real time.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-2">
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Web Cloud Portal</h3>
                    <p className="mt-0.5 text-xs font-semibold text-sky-600">
                      For Head Teachers, Registrars & Bursars
                    </p>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Engineered for high-density administrative workflows on PC, Mac, and Chromebooks. Manage large-scale
                    school governance with precision.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.web.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <Check className="bg-sky-100 text-sky-700" />
                        <div>
                          <span className="font-semibold text-slate-900">{feat.title}: </span>
                          <span className="text-slate-600">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-600 sm:mt-8">
                  <span className="font-bold text-sky-700">Compatibility:</span> Chrome, Edge, Safari, Firefox ·
                  Accessible from any desktop browser with no local server setup.
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Android Mobile Application</h3>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                      For Classroom Teachers & Parents
                    </p>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Optimized for rapid classroom roll calls, continuous assessment marks entry, and real-time parent
                    progress monitoring even with poor connectivity.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.android.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <Check className="bg-emerald-100 text-emerald-700" />
                        <div>
                          <span className="font-semibold text-slate-900">{feat.title}: </span>
                          <span className="text-slate-600">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-600 sm:mt-8">
                  <span className="font-bold text-emerald-700">Compatibility:</span> Android 8.0+ Smartphones &
                  Tablets · Progressive Web App (PWA) and APK installation support.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="architecture" className="landing-section border-b border-slate-200 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Offline-First Reliability
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Engineered for African Infrastructure Realities
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Built from the ground up to solve load shedding, expensive SMS bundles, and rural connectivity outages
                across Zambia.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {architecturePillars.map((item) => (
                <div
                  key={item.title}
                  className="landing-card flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md sm:p-6"
                >
                  <div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {item.badge}
                    </span>
                    <h3 className="mt-4 text-base font-bold text-slate-900 sm:text-lg">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:mt-12 sm:p-8">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-900 sm:text-lg">Resilient Data Flow Architecture</h3>
                  <p className="text-xs text-slate-500">Bidirectional Sync & High-Availability Pipeline</p>
                </div>
                <div className="text-xs font-semibold text-sky-700">
                  PostgreSQL Cloud + Client IndexedDB Engine
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="text-sky-600">01.</span> Edge Device (Offline)
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Roll calls and marks write directly to encrypted local IndexedDB storage in under 5ms without
                    network delays.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="text-emerald-600">02.</span> Auto-Sync Mesh
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Service Worker detects connection recovery and securely uploads batched transactions with automated
                    conflict resolution.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="text-amber-600">03.</span> Zero-SMS Push Broadcast
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Cloud workers trigger direct push events to registered parent devices and update headmaster
                    dashboards simultaneously.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="landing-section border-b border-slate-200 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                Complete School Suite
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Every Department, One Unified System
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Replace fragmented notebooks, spreadsheets, and SMS bills with specialized modules designed for Zambian
                school standards.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-12 md:grid-cols-2">
              {moduleBreakdown.map((mod) => (
                <div
                  key={mod.title}
                  className="landing-card rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
                >
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{mod.title}</h3>
                    <span className={`text-[11px] font-semibold ${mod.tagClass}`}>{mod.tag}</span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {mod.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="bg-emerald-100 text-emerald-700" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="compare" className="landing-section border-b border-slate-200 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                Direct Comparison
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Why Schools Replace Legacy Portals with ZamSchool OS
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                See how ZamSchool OS delivers lower costs, faster operations, and native offline resilience.
              </p>
            </div>

            <div className="mt-10 hidden overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-3xl border border-slate-200 bg-white shadow-sm sm:block">
              <div className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-200 bg-slate-50 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600 sm:px-6 sm:text-sm">
                <div>Capability</div>
                <div className="text-slate-500">Legacy / Paper</div>
                <div className="text-sky-700">ZamSchool OS</div>
              </div>

              {comparisonData.map((row) => (
                <div
                  key={row.aspect}
                  className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-100 px-4 py-4 text-xs last:border-b-0 sm:px-6 sm:text-sm"
                >
                  <div className="font-semibold text-slate-900">{row.aspect}</div>
                  <div className="flex items-start gap-1.5 text-slate-500">
                    <Cross />
                    <span>{row.legacy}</span>
                  </div>
                  <div className="flex items-start gap-1.5 font-medium text-slate-700">
                    <Check className="bg-emerald-100 text-emerald-700" />
                    <span>{row.zamschool}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3.5 sm:hidden">
              {comparisonData.map((row) => (
                <div
                  key={row.aspect}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-900">{row.aspect}</p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500">
                      <Cross />
                      <div>
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-400">
                          Legacy / Paper
                        </span>
                        <span>{row.legacy}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                      <Check className="bg-emerald-200 text-emerald-800" />
                      <div>
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase text-emerald-600">
                          ZamSchool OS
                        </span>
                        <span>{row.zamschool}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section border-b border-slate-200 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Simple, Transparent Terms
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Free for Founding Schools
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Setup is free, and while we onboard founding schools the entire platform is free during the pilot. No
                SMS bills, no credit card required, no hidden charges.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-2">
              <div className="landing-card flex flex-col rounded-3xl border-2 border-sky-600 bg-white p-5 shadow-xl shadow-sky-600/10 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Founding School Pilot</h3>
                  <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">Current Term</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">K0</span>
                  <span className="text-xs font-medium text-slate-500 sm:text-sm">per school, per term</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Everything the platform does, free while we grow with our founding schools.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="bg-sky-100 text-sky-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="landing-press mt-8 inline-flex items-center justify-center rounded-xl bg-sky-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 active:scale-95 sm:py-4"
                >
                  Start Free School Setup
                </Link>
              </div>

              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">After the Pilot</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Paid plans will come - and when they do, you will always know what you are paying for before you pay
                  it.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotTerms.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="bg-emerald-100 text-emerald-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                  Questions about onboarding your school? Call{" "}
                  <a href="tel:+260973385988" className="font-semibold text-sky-700 hover:underline break-all">
                    +260 973 385 988
                  </a>{" "}
                  or email{" "}
                  <a
                    href="mailto:zenitycoreinc@gmail.com"
                    className="font-semibold text-sky-700 hover:underline break-all"
                  >
                    zenitycoreinc@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="landing-section border-b border-slate-200 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                Security & Data Integrity
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Student Records, Protected by Design
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Schools entrust us with their most sensitive records. Every layer of ZamSchool OS is engineered to
                honor that trust.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {trustPillars.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center sm:p-8">
              <SystemStatusBadge variant="light" />
              <p className="max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
                This indicator runs a live probe against the platform&apos;s health endpoint from your browser on every
                page load. Real-time verification for administrators and educators.
              </p>
            </div>
          </div>
        </section>

        <section id="leadership" className="landing-section border-b border-slate-200 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                  Leadership & Corporate Backing
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  Backed by ZenityCore Technologies
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  ZamSchool OS is engineered and operated by{" "}
                  <span className="font-semibold text-slate-900">ZenityCore Technologies</span> (
                  <a
                    href="https://zenitycore.tech"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline underline-offset-4 hover:text-sky-800"
                  >
                    zenitycore.tech
                  </a>
                  ), an enterprise software organization founded and led by Chief Executive Officer{" "}
                  <span className="font-semibold text-slate-900">Ison Mumbuna</span>.
                </p>

                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Our mission is to eliminate educational administrative bottlenecks across Africa by building software
                  that runs reliably on local infrastructure, regardless of bandwidth limitations or power
                  fluctuations.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="mt-0 bg-emerald-100 text-emerald-700" />
                    <span>Strict Zambian student data sovereignty & cryptographic encryption</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="mt-0 bg-sky-100 text-sky-700" />
                    <span>Nationwide engineering & support presence in Lusaka and Mongu</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="mt-0 bg-sky-100 text-sky-700" />
                    <span>Dedicated 99.9% uptime SLA for registered educational institutions</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col flex-wrap items-center gap-3 sm:flex-row sm:gap-4">
                  <a
                    href="https://zenitycore.tech"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto"
                  >
                    Visit zenitycore.tech
                  </a>
                  <a
                    href="mailto:zenitycoreinc@gmail.com"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Contact Leadership
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-16 sm:w-16">
                    <Image
                      src="/ceo.jpg"
                      alt="Ison Mumbuna, CEO of ZenityCore Technologies"
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Ison Mumbuna</h3>
                    <p className="text-xs font-medium text-sky-700 sm:text-sm">Chief Executive Officer & Founder</p>
                    <p className="text-xs text-slate-500">ZenityCore Technologies</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  <p className="italic">
                    “We engineered ZamSchool OS to ensure that no head teacher spends hours balancing registers by
                    candlelight, and no school exhausts its budget on SMS credits. Real education happens when teachers
                    have tools that work unconditionally on their phones and computers.”
                  </p>
                  <p className="mt-3 text-xs font-semibold text-sky-700">Ison Mumbuna, CEO</p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 text-center text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-bold text-slate-900">Direct Line</p>
                    <p className="mt-0.5 break-all text-slate-600">+260 973 385 988</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-bold text-slate-900">Executive Desk</p>
                    <p className="mt-0.5 break-all text-slate-600">zenitycoreinc@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="landing-section border-b border-slate-200 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                Clear Answers
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Everything school administrators and headteachers ask when switching to ZamSchool OS.
              </p>
            </div>

            <div className="mt-10 space-y-3.5 sm:mt-12">
              {faqItems.map((item, idx) => (
                <details
                  key={idx}
                  className="landing-card group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 open:border-sky-200 open:bg-sky-50/40 sm:p-6"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden sm:text-base">
                    <span>{item.q}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600 sm:mt-4 sm:text-sm">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 to-white py-14 sm:py-20 lg:py-24">
          <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-1.5 text-xs font-semibold text-sky-700 shadow-sm">
              <span>Transform Your School Operations Today</span>
            </div>

            <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Ready to modernise your school?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-lg">
              Set up your school in under 5 minutes. Add classes, register teachers, and experience instant offline
              roll calls on Web and Android.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="landing-press inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 active:scale-95 sm:w-auto sm:px-8 sm:py-4 sm:text-base"
              >
                Start Free School Setup
              </Link>
              <Link
                href="/login"
                className="landing-press inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] sm:w-auto sm:px-8 sm:py-4 sm:text-base"
              >
                Sign In to School Desk
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              ZenityCore Technologies · Customer Support Hotline: +260 973 385 988 · Lusaka & Mongu, Zambia
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
