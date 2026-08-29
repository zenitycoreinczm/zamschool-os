"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
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
  Mail,
  Menu,
  MessageSquare,
  Network,
  Phone,
  RefreshCw,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  Wifi,
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
    tag: "Sub-30s Roll Call",
    color: "from-sky-500/10 to-blue-500/5 text-sky-600 border-sky-200",
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
    tag: "ECZ Form 1–4 & Grade 1–7",
    color: "from-emerald-500/10 to-teal-500/5 text-emerald-600 border-emerald-200",
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
    tag: "Kwacha Accounting",
    color: "from-amber-500/10 to-yellow-500/5 text-amber-600 border-amber-200",
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
    tag: "No SMS Bills",
    color: "from-purple-500/10 to-indigo-500/5 text-purple-600 border-purple-200",
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"mobile" | "web">("mobile");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 antialiased selection:bg-sky-500 selection:text-white overflow-x-hidden">
      {/* ─── Navigation Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 p-0.5 shadow-md shadow-sky-500/20 sm:h-11 sm:w-11">
              <div className="h-full w-full overflow-hidden rounded-[10px] bg-slate-950">
                <Image
                  src="/icon.png"
                  alt="ZamSchool OS"
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white sm:text-xl">
                  ZamSchool<span className="text-sky-400">OS</span>
                </span>
                <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                  v2.4
                </span>
              </div>
              <p className="hidden text-xs font-medium text-slate-400 sm:block">
                Zambian School Operating System
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 lg:flex">
            <Link
              href="#platforms"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Web & Android
            </Link>
            <Link
              href="#architecture"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Architecture
            </Link>
            <Link
              href="#modules"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Modules
            </Link>
            <Link
              href="#compare"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Comparison
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Pricing
            </Link>
            <Link
              href="#leadership"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              Leadership
            </Link>
            <Link
              href="#faq"
              className="text-sm font-medium text-slate-300 transition hover:text-sky-400"
            >
              FAQ
            </Link>
          </nav>

          {/* User actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 active:scale-95 sm:px-5 sm:py-2.5"
            >
              <span>Free Setup</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700 hover:text-white lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen ? (
          <div className="border-t border-slate-800 bg-slate-950/95 px-4 py-5 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-3">
              <Link
                href="#platforms"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>📱 Dual Platform (Web & Android)</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>⚡ Offline Sync Architecture</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#modules"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>📊 School Modules & Features</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#compare"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>⚔️ Compare with Legacy SMS</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>🏷️ Free Founding Pilot Pricing</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#leadership"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>🏛️ ZenityCore Corporate Leadership</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <span>❓ Frequently Asked Questions</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>

              <div className="mt-2 grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 py-3 text-center text-sm font-bold text-slate-200 hover:bg-slate-800"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-xl bg-sky-500 py-3 text-center text-sm font-bold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400"
                >
                  Start School
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        {/* ─── Hero Section with Vibrant Modern Backdrops ───────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-10 pb-16 sm:py-20 lg:py-24">
          {/* Ambient Glow Orbs */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-sky-500/15 blur-[120px]" />
          <div className="pointer-events-none absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
              {/* Left Column: Core Value Proposition */}
              <div className="flex flex-col items-start text-left">
                {/* Authority badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/60 px-3.5 py-1.5 text-xs font-semibold text-sky-200 shadow-sm backdrop-blur">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Backed by ZenityCore Technologies · Zambian Education OS</span>
                </div>

                <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
                  Run your entire school{" "}
                  <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                    from your phone
                  </span>{" "}
                  or computer.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-lg sm:leading-8">
                  Engineered for <span className="font-semibold text-white">Web & Android</span>. 
                  Take morning roll calls in <span className="font-semibold text-emerald-300">30 seconds offline</span>, 
                  compile ECZ-standard report cards with one click, eliminate expensive SMS bundles with direct push alerts, 
                  and balance school fee ledgers with total transparency.
                </p>

                {/* Platform pills */}
                <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-medium">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-slate-200 backdrop-blur">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    <span>Android App (Teachers & Parents)</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-slate-200 backdrop-blur">
                    <Laptop className="h-4 w-4 text-sky-400" />
                    <span>Web Cloud (Head Teacher & Bursar)</span>
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="mt-8 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-7 py-4 text-base font-bold text-white shadow-xl shadow-sky-500/25 transition hover:brightness-110 active:scale-95"
                  >
                    <span>Start a School (Free Pilot)</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <a
                    href="#platforms"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-6 py-4 text-base font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    <Smartphone className="h-5 w-5 text-sky-400" />
                    <span>See Live Demo</span>
                  </a>
                </div>

                {/* Trust Highlights */}
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 sm:text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    100% Offline Ready
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Zero SMS Carrier Costs
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ECZ Grading Aligned
                  </span>
                </div>
              </div>

              {/* Right Column: Interactive Mobile & Web Experience Mockup */}
              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                {/* Tab Switcher */}
                <div className="flex items-center justify-center gap-2 pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("mobile")}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      activeTab === "mobile"
                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                        : "border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>📱 Android Phone View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("web")}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      activeTab === "web"
                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                        : "border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
                    }`}
                  >
                    <Laptop className="h-3.5 w-3.5" />
                    <span>💻 Web Admin Portal</span>
                  </button>
                </div>

                {activeTab === "mobile" ? (
                  /* Smartphone Device Simulation */
                  <div className="relative mx-auto max-w-[340px] rounded-[36px] border-[5px] border-slate-700 bg-slate-950 p-3 shadow-2xl shadow-sky-950/80">
                    {/* Top speaker notch */}
                    <div className="mx-auto mb-2 h-4 w-28 rounded-full bg-slate-800" />

                    {/* App Screen */}
                    <div className="rounded-[24px] bg-slate-900 p-4 border border-slate-800 text-left">
                      {/* App Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-sky-500 flex items-center justify-center text-white font-black text-xs">
                            ZS
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Teacher Roll Call</p>
                            <p className="text-[10px] text-emerald-400">● Offline Mode Active</p>
                          </div>
                        </div>
                        <span className="rounded bg-sky-950 border border-sky-800 px-2 py-0.5 text-[9px] font-bold text-sky-400">
                          Grade 9B
                        </span>
                      </div>

                      {/* Roll Call Fast Action List */}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                          <div>
                            <p className="font-semibold text-slate-200">1. Mwape Chanda</p>
                            <p className="text-[10px] text-slate-400">Reg # 2026/089</p>
                          </div>
                          <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold text-emerald-300">
                            ✓ Present
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                          <div>
                            <p className="font-semibold text-slate-200">2. Kondwani Banda</p>
                            <p className="text-[10px] text-slate-400">Reg # 2026/092</p>
                          </div>
                          <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold text-emerald-300">
                            ✓ Present
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                          <div>
                            <p className="font-semibold text-slate-200">3. Thandiwe Tembo</p>
                            <p className="text-[10px] text-slate-400">Reg # 2026/104</p>
                          </div>
                          <span className="rounded-md bg-rose-500/20 border border-rose-500/40 px-2 py-1 text-[10px] font-bold text-rose-300">
                            ✕ Absent
                          </span>
                        </div>
                      </div>

                      {/* Quick Summary Pill */}
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                        <div className="rounded-lg bg-emerald-950/70 border border-emerald-800/50 p-1.5">
                          <p className="text-sm font-extrabold text-emerald-400">38</p>
                          <p className="text-[9px] text-emerald-300">Present</p>
                        </div>
                        <div className="rounded-lg bg-rose-950/70 border border-rose-800/50 p-1.5">
                          <p className="text-sm font-extrabold text-rose-400">2</p>
                          <p className="text-[9px] text-rose-300">Absent</p>
                        </div>
                        <div className="rounded-lg bg-sky-950/70 border border-sky-800/50 p-1.5">
                          <p className="text-sm font-extrabold text-sky-400">22s</p>
                          <p className="text-[9px] text-sky-300">Elapsed</p>
                        </div>
                      </div>

                      {/* Zero-SMS notice */}
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-2 text-[10px] text-emerald-200">
                        <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Instant push alert will reach parents automatically.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Web Desktop Portal Mockup */
                  <div className="relative rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-sky-950/50 text-left">
                    {/* Mock Window Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                        <span className="text-xs font-semibold text-slate-200">
                          Munali Secondary School · Headteacher Dashboard
                        </span>
                      </div>
                      <span className="rounded bg-sky-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 border border-sky-800">
                        Term 1 Active
                      </span>
                    </div>

                    {/* Financial Ledger Snapshot */}
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Tuition & Boarding Collections
                          </span>
                          <span className="text-xs font-bold text-emerald-400">89.4% Kwacha Collected</span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-xl font-extrabold text-white">K 184,200</span>
                          <span className="text-xs text-slate-400">Target: K 206,000</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: "89.4%" }} />
                        </div>
                      </div>

                      {/* ECZ Results Status */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">ECZ Terminal Report Cards</span>
                          <span className="font-mono text-sky-400">542 Generated</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Automated Division & Distinction rankings ready for batch print.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Platform Breakdown: Web & Android ────────────────────────────── */}
        <section id="platforms" className="border-y border-slate-800 bg-slate-950 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                Dual Platform Architecture
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Built for High-Power Desktop & Agile Mobile
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
                ZamSchool OS provides dedicated experiences for administrative desktops and classroom mobile phones, synchronized in real time.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              {/* Web Platform Card */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl sm:p-8">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-inner">
                      <Laptop className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Web Cloud Portal</h3>
                      <p className="text-xs font-medium text-sky-400">For Head Teachers, Registrars & Bursars</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-300">
                    Engineered for high-density administrative workflows on PC, Mac, and Chromebooks. Manage large-scale school governance with precision.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.web.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                        <div>
                          <span className="font-semibold text-white">{feat.title}: </span>
                          <span className="text-slate-400">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-medium text-slate-300">
                  <span className="font-bold text-sky-400">Compatibility:</span> Chrome, Edge, Safari, Firefox · Accessible from any desktop browser with no local server setup.
                </div>
              </div>

              {/* Android Mobile Card */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl sm:p-8">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Android Mobile Application</h3>
                      <p className="text-xs font-medium text-emerald-400">For Classroom Teachers & Parents</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-300">
                    Optimized for rapid classroom roll calls, continuous assessment marks entry, and real-time parent progress monitoring even with poor connectivity.
                  </p>

                  <ul className="mt-6 space-y-3.5">
                    {platformFeatures.android.map((feat) => (
                      <li key={feat.title} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <div>
                          <span className="font-semibold text-white">{feat.title}: </span>
                          <span className="text-slate-400">{feat.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-medium text-slate-300">
                  <span className="font-bold text-emerald-400">Compatibility:</span> Android 8.0+ Smartphones & Tablets · Progressive Web App (PWA) and APK installation support.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── System Architecture & Offline Sync ────────────────────────────── */}
        <section id="architecture" className="border-b border-slate-800 bg-slate-900/70 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                Offline-First Reliability
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Engineered for African Infrastructure Realities
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
                Built from the ground up to solve load shedding, expensive SMS bundles, and rural connectivity outages across Zambia.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {architecturePillars.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-950/80 p-6 transition hover:border-slate-700 hover:bg-slate-950 hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architectural Data Flow Diagram */}
            <div className="mt-12 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Resilient Data Flow Architecture</h3>
                  <p className="text-xs text-slate-400">Bidirectional Sync & High-Availability Pipeline</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold">
                  <Database className="h-4 w-4" />
                  <span>PostgreSQL Cloud + Client IndexedDB Engine</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <Smartphone className="h-4 w-4" />
                    <span>01. Edge Device (Offline)</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Roll calls and marks write directly to encrypted local IndexedDB storage in under 5ms without network delays.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <RefreshCw className="h-4 w-4" />
                    <span>02. Auto-Sync Mesh</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Service Worker detects connection recovery and securely uploads batched transactions with automated conflict resolution.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
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
        <section id="modules" className="border-b border-slate-800 bg-slate-950 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
                Complete School Suite
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Every Department, One Unified System
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
                Replace fragmented notebooks, spreadsheets, and SMS bills with specialized modules designed for Zambian school standards.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {moduleBreakdown.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.title}
                    className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-sky-400 border border-slate-700">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{mod.title}</h3>
                          <span className="text-[11px] font-semibold text-sky-400">{mod.tag}</span>
                        </div>
                      </div>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {mod.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-2.5 text-sm text-slate-300">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
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
        <section id="compare" className="border-b border-slate-800 bg-slate-900/70 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                Direct Comparison
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Why Schools Replace Legacy Portals with ZamSchool OS
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-400">
                See how ZamSchool OS delivers lower costs, faster operations, and native offline resilience.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-800 bg-slate-900 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-300 sm:px-6 sm:text-sm">
                <div>Capability</div>
                <div className="text-slate-400">Legacy / Paper</div>
                <div className="text-sky-400">ZamSchool OS</div>
              </div>

              {comparisonData.map((row) => (
                <div
                  key={row.aspect}
                  className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-slate-800/80 px-4 py-4 text-xs sm:px-6 sm:text-sm last:border-b-0"
                >
                  <div className="font-semibold text-slate-200">
                    {row.aspect}
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-500">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span>{row.legacy}</span>
                  </div>
                  <div className="flex items-start gap-1.5 font-medium text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{row.zamschool}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing & Pilot Programme ─────────────────────────────────────── */}
        <section id="pricing" className="border-b border-slate-800 bg-slate-950 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                Simple, Transparent Terms
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Free for Founding Schools
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
                Setup is free, and while we onboard founding schools the entire
                platform is free during the pilot. No SMS bills, no credit card
                required, no hidden charges.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col rounded-3xl border-2 border-sky-500/80 bg-gradient-to-b from-sky-950/40 via-slate-900 to-slate-950 p-6 shadow-2xl sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-white">Founding School Pilot</h3>
                  <span className="rounded-full bg-sky-500/20 border border-sky-500/40 px-3 py-1 text-xs font-bold text-sky-300">
                    Current Term
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tight text-white">K0</span>
                  <span className="text-sm font-medium text-slate-400">per school, per term</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Everything the platform does, free while we grow with our founding schools.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
                >
                  <span>Start Free School Setup</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl sm:p-8">
                <h3 className="text-xl font-bold text-white">After the Pilot</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Paid plans will come - and when they do, you will always know
                  what you are paying for before you pay it.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {pilotTerms.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-400">
                  Questions about onboarding your school? Call{" "}
                  <a href="tel:+260973385988" className="font-semibold text-sky-400 hover:underline">
                    +260 973 385 988
                  </a>{" "}
                  or email{" "}
                  <a href="mailto:zenitycoreinc@gmail.com" className="font-semibold text-sky-400 hover:underline">
                    zenitycoreinc@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Trust, Security & Live Status ─────────────────────────────────── */}
        <section id="trust" className="border-b border-slate-800 bg-slate-900/70 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                Security & Data Integrity
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Student Records, Protected by Design
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
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
                    className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-lg"
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 border border-slate-800 shadow-inner">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center sm:p-8">
              <SystemStatusBadge variant="dark" />
              <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-400">
                This indicator runs a live probe against the platform&apos;s
                health endpoint from your browser on every page load. Real-time verification for administrators and educators.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Corporate Authority & Leadership ─────────────────────────────── */}
        <section id="leadership" className="border-b border-slate-800 bg-slate-950 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                  Leadership & Corporate Backing
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Backed by ZenityCore Technologies
                </h2>
                <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300">
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

                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
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
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-2xl font-black text-white shadow-lg">
                    IM
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Ison Mumbuna</h3>
                    <p className="text-sm font-medium text-sky-400">Chief Executive Officer & Founder</p>
                    <p className="text-xs text-slate-400">ZenityCore Technologies</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs sm:text-sm leading-relaxed text-slate-300">
                  <p className="italic">
                    “We engineered ZamSchool OS to ensure that no head teacher spends hours balancing registers by candlelight, and no school exhausts its budget on SMS credits. Real education happens when teachers have tools that work unconditionally on their phones and computers.”
                  </p>
                  <p className="mt-3 text-xs font-semibold text-sky-400">— Ison Mumbuna, CEO</p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="font-bold text-white">Direct Line</p>
                    <p className="mt-0.5 text-slate-400">+260 973 385 988</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="font-bold text-white">Executive Desk</p>
                    <p className="mt-0.5 text-slate-400">zenitycoreinc@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Frequently Asked Questions ───────────────────────────────────── */}
        <section id="faq" className="border-b border-slate-800 bg-slate-900/70 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                Clear Answers
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
                Everything school administrators and headteachers ask when switching to ZamSchool OS.
              </p>
            </div>

            <div className="mt-12 space-y-3.5">
              {faqItems.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-6 transition hover:border-slate-700 open:bg-slate-950"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-sm sm:text-base font-bold text-white marker:content-none">
                    <span className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 shrink-0 text-sky-400" />
                      {item.q}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-300 pl-8">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Final CTA ────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 py-16 sm:py-24 text-white">
          <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-sky-500/10 via-transparent to-transparent" />

          <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/60 px-4 py-1.5 text-xs font-semibold text-sky-300">
              <Sparkles className="h-4 w-4" />
              <span>Transform Your School Operations Today</span>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
              Ready to modernise your school?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-300">
              Set up your school in under 5 minutes. Add classes, register teachers, and experience instant offline roll calls on Web and Android.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-sky-500/25 transition hover:brightness-110 sm:w-auto"
              >
                <span>Start Free School Setup</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-8 py-4 text-base font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white sm:w-auto"
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
