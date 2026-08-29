import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Fingerprint,
  Globe,
  HelpCircle,
  Laptop,
  Layers,
  Lock,
  MessageSquare,
  Network,
  RefreshCw,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

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
    icon: WifiOff,
    badge: "Local-First Core",
    title: "Offline-First Sync Engine",
    description:
      "Built with client-side IndexedDB caching and Service Worker background sync. Teachers work uninterrupted during power cuts or network outages across Zambian provinces.",
  },
  {
    icon: MessageSquare,
    badge: "Cost Reduction",
    title: "Zero-SMS Direct Push Mesh",
    description:
      "Replaces expensive carrier SMS bundles with native Web and Android push protocols, saving schools thousands of Zambian Kwacha every academic term.",
  },
  {
    icon: FileSpreadsheet,
    badge: "National Syllabus",
    title: "ECZ-Aligned Academic Engine",
    description:
      "Pre-configured for Zambian secondary and primary grading standards (Divisions 1–4, Distinctions, Merits, Credits, Passes) with automated aggregate calculations.",
  },
  {
    icon: Lock,
    badge: "Security & Governance",
    title: "Multi-Role RBAC & Audit Trails",
    description:
      "Granular permission gates for Headteachers, Deputies, Bursars, Class Teachers, and Parents ensure strict data privacy and eliminate unauthorized grade tampering.",
  },
];

const moduleBreakdown = [
  {
    icon: Users,
    title: "Classroom Attendance Engine",
    points: [
      "Sub-30-second roll calls per classroom",
      "Immediate parent notification on mark entry",
      "Termly Ministry of Education attendance logs",
      "Automated absentee risk alerts for administration",
    ],
  },
  {
    icon: BookOpen,
    title: "Academic Grading & Report Cards",
    points: [
      "Continuous Assessment (CA) & Terminal Exam marks",
      "ECZ-compliant grading scales & class rankings",
      "Automated teacher & headmaster remarks",
      "One-click batch printable PDF report cards",
    ],
  },
  {
    icon: Coins,
    title: "Bursar & School Fees Ledger",
    points: [
      "Real-time tuition, boarding, and PTA fee tracking",
      "Automated digital payment receipts with audit IDs",
      "Class-by-class arrears and collection breakdown",
      "Exportable financial summaries for board meetings",
    ],
  },
  {
    icon: Zap,
    title: "Zero-Cost Communications",
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
    icon: ShieldCheck,
    title: "Multi-Role Access Control",
    description:
      "Granular permissions for Head Teachers, Bursars, Class Teachers, and Parents. Every user sees only what their role allows - nothing more.",
  },
  {
    icon: Lock,
    title: "Row-Level Database Security",
    description:
      "Every table enforces school-scoped row-level security, so one school can never read another school's records, even by accident.",
  },
  {
    icon: Database,
    title: "Complete Audit Trails",
    description:
      "Sensitive actions are logged with who did what, and when. Changes to results, fees, and records stay traceable end to end.",
  },
  {
    icon: Fingerprint,
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased selection:bg-sky-500 selection:text-white">
      {/* ─── Navigation Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-950 p-1 shadow-sm ring-1 ring-slate-900/10 sm:h-11 sm:w-11">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={44}
                height={44}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  ZamSchool OS
                </span>
                <span className="hidden rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 sm:inline-block">
                  v2.4
                </span>
              </div>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">
                Enterprise School Management
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-7 lg:flex">
            <Link
              href="#platforms"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Web & Android
            </Link>
            <Link
              href="#architecture"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Architecture
            </Link>
            <Link
              href="#modules"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Modules
            </Link>
            <Link
              href="#compare"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Comparison
            </Link>
            <Link
              href="#leadership"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Leadership
            </Link>
            <Link
              href="#faq"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              FAQ
            </Link>
          </nav>

          {/* User actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 sm:px-4"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-sky-500 active:scale-95 sm:px-5 sm:py-2.5"
            >
              <span>Start Free Setup</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Hero Section ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, #38bdf8 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
              {/* Left Column: Value Proposition */}
              <div className="flex flex-col items-start text-left">
                {/* Authority badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/70 px-3.5 py-1.5 text-xs font-semibold text-sky-200 shadow-sm backdrop-blur">
                  <ShieldCheck className="h-4 w-4 text-sky-400" />
                  <span>Backed by ZenityCore Technologies · Zambian Education OS</span>
                </div>

                <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.15]">
                  The Operating System for Zambian Schools.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg sm:leading-8">
                  <span className="font-semibold text-white">Run your entire school from your phone</span> or web dashboard. 
                  Engineered for <span className="font-semibold text-white">Web & Android</span>. 
                  Run morning attendance in 30 seconds offline, automate ECZ-standard terminal report cards, 
                  eliminate SMS bills with direct push broadcasts, and manage student fee ledgers with total transparency.
                </p>

                {/* Platform availability pills */}
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-200">
                    <Laptop className="h-4 w-4 text-sky-400" />
                    <span>Web Cloud Portal (Admin & Bursar)</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-200">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    <span>Android Mobile App (Teachers & Parents)</span>
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="mt-8 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-7 py-4 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 active:scale-95"
                  >
                    <span>Start a School (Free Setup)</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <a
                    href="#architecture"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-6 py-4 text-base font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Cpu className="h-5 w-5 text-sky-400" />
                    <span>Explore Architecture</span>
                  </a>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 sm:text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    No Credit Card Required
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Works 100% Offline
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Zero Carrier SMS Fees
                  </span>
                </div>
              </div>

              {/* Right Column: Live Enterprise System Mockup */}
              <div className="relative mx-auto w-full max-w-md">
                <div className="relative rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-sky-950/50">
                  {/* Mock Window Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <span className="text-xs font-semibold text-slate-300">
                        Munali Secondary School · Lusaka
                      </span>
                    </div>
                    <span className="rounded bg-sky-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 border border-sky-800">
                      Live Sync Active
                    </span>
                  </div>

                  {/* Attendance Card Mock */}
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Form 3A Science Roll Call</span>
                        <span className="font-mono text-emerald-400">07:38 AM</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">34 Learners · Sub-30s Classroom Log</p>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 p-2 text-center">
                          <p className="text-xl font-extrabold text-emerald-400">31</p>
                          <p className="text-[10px] font-semibold text-emerald-300">Present</p>
                        </div>
                        <div className="rounded-lg bg-rose-950/60 border border-rose-800/40 p-2 text-center">
                          <p className="text-xl font-extrabold text-rose-400">2</p>
                          <p className="text-[10px] font-semibold text-rose-300">Absent</p>
                        </div>
                        <div className="rounded-lg bg-amber-950/60 border border-amber-800/40 p-2 text-center">
                          <p className="text-xl font-extrabold text-amber-400">1</p>
                          <p className="text-[10px] font-semibold text-amber-300">Late</p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Ledger Snapshot */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">Term 1 Tuition Collections</span>
                        <span className="text-xs font-bold text-sky-400">89.4% Collected</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-lg font-extrabold text-white">K 184,200</span>
                        <span className="text-xs text-slate-400">Target: K 206,000</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: "89.4%" }} />
                      </div>
                    </div>

                    {/* Instant Broadcast Status */}
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                      <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Zero SMS Cost: 34 parent push alerts dispatched instantly</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Platform Breakdown: Web & Android ────────────────────────────── */}
        <section id="platforms" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Dual Platform Ecosystem
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Built for High-Power Desktop & Agile Mobile
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                ZamSchool OS provides dedicated experiences for administrative desktops and classroom mobile devices, synchronized in real time.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              {/* Web Platform Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      <Laptop className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Web Cloud Portal</h3>
                      <p className="text-xs font-medium text-slate-500">For Head Teachers, Registrars & Bursars</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Engineered for high-density administrative workflows on PC, Mac, and Chromebooks. Manage large-scale school governance with precision.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.web.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                        <div>
                          <span className="font-semibold text-slate-900">{feat.title}: </span>
                          <span className="text-slate-600">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs font-medium text-slate-700">
                  <span className="font-bold text-slate-900">Compatibility:</span> Chrome, Edge, Safari, Firefox · Accessible from any desktop browser with no local server maintenance.
                </div>
              </div>

              {/* Android Mobile Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Android Mobile Application</h3>
                      <p className="text-xs font-medium text-slate-500">For Classroom Teachers & Parents</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Optimized for rapid classroom roll calls, continuous assessment marks entry, and real-time parent progress monitoring even with poor connectivity.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.android.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <div>
                          <span className="font-semibold text-slate-900">{feat.title}: </span>
                          <span className="text-slate-600">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs font-medium text-slate-700">
                  <span className="font-bold text-slate-900">Compatibility:</span> Android 8.0+ Smartphones & Tablets · Progressive Web App (PWA) and APK installation support.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── System Architecture & Reliability ────────────────────────────── */}
        <section id="architecture" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                System Engineering
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Engineered for African Infrastructure Realities
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Built from the ground up to solve power outages, expensive SMS bundles, and unstable rural internet across Zambia.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {architecturePillars.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-6 transition hover:border-slate-300 hover:bg-white hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architectural Data Flow Diagram */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Resilient Data Flow Architecture</h3>
                  <p className="text-xs text-slate-400">Bidirectional Sync & High-Availability Pipeline</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-sky-400">
                  <Database className="h-4 w-4" />
                  <span>PostgreSQL Cloud + Client IndexedDB Engine</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <Smartphone className="h-4 w-4" />
                    <span>01. Edge Device (Offline)</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Roll calls and marks write directly to encrypted local IndexedDB storage in under 5ms without network delays.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <RefreshCw className="h-4 w-4" />
                    <span>02. Auto-Sync Mesh</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Service Worker detects connection recovery and securely uploads batched transactions with automated conflict resolution.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                    <Zap className="h-4 w-4" />
                    <span>03. Zero-SMS Push Broadcast</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Cloud workers trigger direct push events to registered parent devices and update headmaster dashboards simultaneously.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Core Modules ─────────────────────────────────────────────────── */}
        <section id="modules" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Complete School Suite
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Every Department, One Unified System
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Replace fragmented notebooks, spreadsheets, and SMS bills with specialized modules designed for Zambian school standards.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {moduleBreakdown.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.title}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Icon className="h-5 w-5 text-sky-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">{mod.title}</h3>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {mod.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-600" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Comparison Matrix ────────────────────────────────────────────── */}
        <section id="compare" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Direct Comparison
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Why Schools Replace Legacy Portals with ZamSchool OS
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
                See how ZamSchool OS delivers lower costs, faster operations, and native offline resilience.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-200 bg-slate-900 text-left text-xs font-bold uppercase tracking-wider text-slate-300 sm:text-sm">
                <div className="px-4 py-4 sm:px-6">Capability</div>
                <div className="px-3 py-4 sm:px-5">Legacy Systems / Paper</div>
                <div className="bg-sky-950/80 px-3 py-4 text-sky-300 sm:px-5">ZamSchool OS</div>
              </div>

              {comparisonData.map((row) => (
                <div
                  key={row.aspect}
                  className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-100 text-xs sm:text-sm last:border-b-0"
                >
                  <div className="px-4 py-4 font-semibold text-slate-900 sm:px-6">
                    {row.aspect}
                  </div>
                  <div className="flex items-start gap-1.5 px-3 py-4 text-slate-500 sm:px-5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span>{row.legacy}</span>
                  </div>
                  <div className="flex items-start gap-1.5 bg-sky-50/50 px-3 py-4 font-medium text-slate-900 sm:px-5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{row.zamschool}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing & Pilot Programme ─────────────────────────────────────── */}
        <section id="pricing" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Simple, Honest Pricing
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Free for Founding Schools
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Setup is free, and while we onboard founding schools the entire
                platform is free during the pilot. No SMS bills, no card
                required, no hidden charges.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col rounded-2xl border-2 border-sky-500 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-slate-900">Founding School Pilot</h3>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">
                    Current
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-900">K0</span>
                  <span className="text-sm font-medium text-slate-500">per school, per term</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Everything the platform does, free while we grow with our founding schools.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <span>Start Free School Setup</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h3 className="text-xl font-bold text-slate-900">After the Pilot</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Paid plans will come - and when they do, you will always know
                  what you are paying for before you pay it.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotTerms.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                  Questions about pricing for your school? Call{" "}
                  <a href="tel:+260973385988" className="font-semibold text-slate-900">
                    +260 973 385 988
                  </a>{" "}
                  or email{" "}
                  <a href="mailto:zenitycoreinc@gmail.com" className="font-semibold text-slate-900">
                    zenitycoreinc@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Trust, Security & Live Status ─────────────────────────────────── */}
        <section id="trust" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Trust & Security
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Student Records, Protected by Design
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Schools entrust us with their most sensitive records. Every
                layer of ZamSchool OS is engineered to honor that trust.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {trustPillars.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-6 transition hover:border-slate-300 hover:bg-white hover:shadow-md"
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <Icon className="h-5 w-5 text-sky-400" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-center sm:p-8">
              <SystemStatusBadge variant="light" />
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                This indicator runs a live probe against the platform&apos;s
                health endpoint from your browser on every page load. If we ever
                have service trouble, it turns amber instead of quietly claiming
                everything is fine.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Corporate Authority & Leadership ─────────────────────────────── */}
        <section id="leadership" className="border-b border-slate-200 bg-slate-950 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Leadership & Corporate Backing
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Backed by ZenityCore Technologies
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  ZamSchool OS is engineered and operated by <span className="font-semibold text-white">ZenityCore Technologies</span> (
                  <a
                    href="https://zenitycore.tech"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline underline-offset-4 hover:text-sky-300"
                  >
                    zenitycore.tech
                  </a>
                  ), an enterprise software organization founded and led by Chief Executive Officer <span className="font-semibold text-white">Ison Mumbuna</span>.
                </p>

                <p className="mt-3 text-base leading-relaxed text-slate-300">
                  Our mission is to eliminate educational administrative bottlenecks across Africa by building software that runs reliably on local infrastructure, regardless of bandwidth limitations or power fluctuations.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>Strict Zambian student data sovereignty & cryptographic encryption</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <Network className="h-5 w-5 shrink-0 text-sky-400" />
                    <span>Nationwide engineering & support presence in Lusaka and Mongu</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <Globe className="h-5 w-5 shrink-0 text-sky-400" />
                    <span>Dedicated 99.9% uptime SLA for registered educational institutions</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href="https://zenitycore.tech"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                  >
                    <span>Visit zenitycore.tech</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href="mailto:zenitycoreinc@gmail.com"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    <span>Contact Leadership</span>
                  </a>
                </div>
              </div>

              {/* Leadership profile card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-2xl font-black text-white shadow-lg">
                    IM
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Ison Mumbuna</h3>
                    <p className="text-sm font-medium text-sky-400">Chief Executive Officer & Founder</p>
                    <p className="text-xs text-slate-400">ZenityCore Technologies</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-relaxed text-slate-300">
                  <p className="italic">
                    “We engineered ZamSchool OS to ensure that no head teacher spends hours balancing registers by candlelight, and no school exhausts its budget on SMS credits. Real education happens when teachers have tools that work unconditionally on their phones and computers.”
                  </p>
                  <p className="mt-3 text-xs font-semibold text-sky-400">— Ison Mumbuna, CEO</p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-bold text-white">Direct Line</p>
                    <p className="mt-0.5 text-slate-400">+260 973 385 988</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-bold text-white">Executive Desk</p>
                    <p className="mt-0.5 text-slate-400">zenitycoreinc@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Frequently Asked Questions ───────────────────────────────────── */}
        <section id="faq" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700">
                Clear Answers
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Everything school administrators and headteachers ask when switching to ZamSchool OS.
              </p>
            </div>

            <div className="mt-12 space-y-4">
              {faqItems.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-slate-300 open:bg-white open:shadow-sm sm:p-6"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-base font-bold text-slate-900 marker:content-none">
                    <span className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 shrink-0 text-sky-600" />
                      {item.q}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 pl-8">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Final CTA ────────────────────────────────────────────────────── */}
        <section className="bg-slate-950 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/60 px-4 py-1.5 text-xs font-semibold text-sky-300">
              <Sparkles className="h-4 w-4" />
              <span>Transform Your School Operations Today</span>
            </div>

            <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Ready to modernise your school?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Set up your school in under 5 minutes. Add classes, register teachers, and experience instant offline roll calls on Web and Android.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:w-auto"
              >
                <span>Start Free School Setup</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-base font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white sm:w-auto"
              >
                <span>Sign In to School Desk</span>
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
