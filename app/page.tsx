import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileBarChart2,
  GraduationCap,
  Lock,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import LandingFooter from "@/components/landing/LandingFooter";

const featureCards = [
  {
    icon: GraduationCap,
    title: "Students & enrolment",
    description:
      "Register learners, assign classes, keep admission numbers, and see academic history without a stack of spreadsheets.",
    detail: "Registrar desk · class lists · parent links",
  },
  {
    icon: Users,
    title: "Teachers & staff roles",
    description:
      "Head Teacher, Registrar, Academic Admin, Bursar, and classroom teachers each get a workspace built for their job, not a shared admin dump.",
    detail: "Role-based access · invites · staff recovery",
  },
  {
    icon: CalendarCheck,
    title: "Attendance that parents see",
    description:
      "Teachers mark roll by lesson or day. Trends surface for leadership. Parents can follow attendance without calling the office.",
    detail: "Live roll call · absence patterns · parent portal",
  },
  {
    icon: MessageSquare,
    title: "School-wide communication",
    description:
      "Announcements, inbox messages, and notifications stay inside the school, so staff stop relying on scattered WhatsApp groups for official updates.",
    detail: "Announcements · messaging · notifications",
  },
  {
    icon: BadgeDollarSign,
    title: "Fees & finance clarity",
    description:
      "Track balances, payments, and collections in Zambian Kwacha with a bursar workspace that leadership can oversee without losing the paper trail.",
    detail: "Balances · receipts · payment history",
  },
  {
    icon: FileBarChart2,
    title: "Results & reporting",
    description:
      "Enter scores, publish results, and produce clearer term reporting so parents and leadership stop waiting on end-of-term chaos.",
    detail: "Marks · publish · statements",
  },
];

const differentiators = [
  {
    title: "Built for African school ops",
    body: "Zambian phone formats, Kwacha-friendly finance language, and workflows that match how schools actually run, not a generic ERP shipped from another continent.",
  },
  {
    title: "Role desks, not one bloated admin",
    body: "Registrar handles people. Academic Admin owns timetable and subjects. Bursar owns fees. Head Teacher governs. Teachers stay in a teaching workspace.",
  },
  {
    title: "Fast on real networks",
    body: "Designed for everyday school bandwidth: focused pages, less clutter, and operations that stay usable when the connection is uneven.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Register your school",
    body: "Create the school account, set leadership access, and start the free trial in minutes.",
  },
  {
    step: "2",
    title: "Add people & classes",
    body: "Registrar onboards students, parents, and teachers. Academic staff set subjects and the timetable.",
  },
  {
    step: "3",
    title: "Run the school day",
    body: "Mark attendance, message guardians, collect fees, and publish results from one signed-in system.",
  },
];

const proofPoints = [
  { value: "50+", label: "Schools onboarded" },
  { value: "15,000+", label: "Students managed" },
  { value: "99.9%", label: "Uptime target" },
  { value: "4", label: "Countries reached" },
];

const testimonials = [
  {
    name: "Mr. Bwalya Mwila",
    role: "Headteacher",
    quote:
      "Attendance, reports, and communication now take minutes instead of hours. The office finally works from one place.",
  },
  {
    name: "Mrs. Grace Tembo",
    role: "Deputy Principal",
    quote:
      "Parent visibility improved immediately. Guardians see attendance and notices without calling reception all day.",
  },
  {
    name: "Mr. Chanda Mutale",
    role: "Head Teacher",
    quote:
      "Finance tracking is clearer for the bursar and leadership. Follow-ups on fees no longer live only on paper.",
  },
];

const trustItems = [
  {
    icon: Lock,
    title: "School data stays scoped",
    body: "Role-based access, tenant separation by school, and private workspaces that are not public web pages.",
  },
  {
    icon: ShieldCheck,
    title: "Policies you can read",
    body: "Privacy Policy, Terms of Service, and Cookie Policy are published so procurement and boards can review them.",
  },
  {
    icon: Smartphone,
    title: "Works on phones & desktops",
    body: "Teachers and parents can use the same school system from a phone or office computer without a separate app install.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
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
                School OS for African schools
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {[
              ["#features", "Features"],
              ["#how-it-works", "How it works"],
              ["#pricing", "Pricing"],
              ["#trust", "Trust"],
              ["#about", "About"],
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
              Start free trial
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
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-200 sm:text-sm">
                <Zap className="h-3.5 w-3.5 text-amber-300 sm:h-4 sm:w-4" />
                School management system for African schools
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:mt-7 sm:text-5xl lg:text-6xl">
                Faster, calmer school operations from enrolment to fees.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
                ZamSchool OS brings students, attendance, parent communication,
                exams, and finance into one platform your office can actually
                run every day, not another pile of disconnected tools.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:px-7 sm:py-4 sm:text-base"
                >
                  Start free 14-day trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:px-7 sm:py-4 sm:text-base"
                >
                  <PlayCircle className="h-4 w-4" />
                  Log in to your school
                </Link>
              </div>

              <p className="mt-4 text-xs text-slate-400 sm:text-sm">
                No credit card required · Full platform during trial ·{" "}
                <Link href="/privacy" className="underline hover:text-slate-200">
                  Privacy
                </Link>{" "}
                ·{" "}
                <Link href="/terms" className="underline hover:text-slate-200">
                  Terms
                </Link>
              </p>

              <ul className="mt-8 grid gap-2.5 text-sm text-slate-200 sm:grid-cols-2">
                {[
                  "Role desks for admin, teachers & parents",
                  "Attendance parents can actually see",
                  "Fees tracked in clear Kwacha language",
                  "Works on phone, tablet, and desktop",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Product preview mock */}
            <section
              aria-label="Platform preview"
              className="rounded-2xl border border-white/10 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:rounded-[2rem] sm:p-6"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-2 truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                  app.zamschoolos.site
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white sm:rounded-2xl sm:px-5 sm:py-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-sky-200">
                      Head Teacher view
                    </p>
                    <p className="mt-0.5 text-lg font-bold sm:text-2xl">
                      Hillcrest Primary
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2 text-right sm:rounded-2xl sm:px-4 sm:py-3">
                    <p className="text-[10px] text-slate-300">Attendance</p>
                    <p className="text-xl font-bold text-emerald-300 sm:text-2xl">
                      96%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl bg-sky-50 p-3 sm:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Students
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                      1,248
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Classes & enrolment in one desk
                    </p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3 sm:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      Staff
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                      64
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Teachers & office roles
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    This week at a glance
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      ["Attendance", "Live roll"],
                      ["Notices", "3 active"],
                      ["Fees", "K 482k"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* Trust bar under hero */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 text-xs text-slate-600 sm:justify-between sm:px-6 sm:text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Role-based school workspaces
            </span>
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
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Building2 className="h-4 w-4 text-sky-600" />
              Built in Zambia · serving African schools
            </span>
          </div>
        </section>

        {/* Proof metrics */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 sm:gap-4 sm:px-6 sm:py-8 lg:grid-cols-4">
            {proofPoints.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
              >
                <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-slate-600 sm:mt-2 sm:text-sm">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 sm:text-sm">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:mt-4 sm:text-4xl md:text-5xl">
              Everything the school day needs, without the admin drag.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">
              Not a feature dump. ZamSchool OS covers the workflows that slow
              offices down: people, attendance, messaging, fees, and results, with
              clear ownership by role.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, description, detail }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:leading-7">
                  {description}
                </p>
                <p className="mt-3 text-xs font-semibold text-sky-700">
                  {detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Differentiation */}
        <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 sm:text-sm">
                Why ZamSchool OS
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Different from generic school ERPs and spreadsheet chaos.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {differentiators.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 sm:text-sm">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Live in days, not a multi-month IT project.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {howItWorks.map((item) => (
              <article
                key={item.step}
                className="relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Solutions by role */}
        <section id="solutions" className="bg-slate-950 py-14 text-white sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300 sm:text-sm">
                Solutions
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Built for every desk in the school.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Leadership",
                  body: "Head Teacher overview, staff invites, audit visibility, and school profile without drowning in data entry.",
                },
                {
                  title: "Registrar",
                  body: "Students, parents, classes, and transfers: people operations owned by the admissions desk.",
                },
                {
                  title: "Teachers",
                  body: "Attendance, results, students in classes you teach, and messaging without leaving the teaching workspace.",
                },
                {
                  title: "Parents",
                  body: "Attendance, notices, fees, and results for their children, on any device.",
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 sm:text-sm">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                Start free. Set up the school before you commit.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Transparent onboarding: full platform for 14 days. Paid plans
                after trial are sized to your school. Contact us for a quote that
                fits your budget.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-sky-200 bg-white p-6 shadow-xl shadow-sky-100/60 sm:rounded-[2rem] sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                  Starter trial
                </p>
                <h3 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Free for 14 days
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Then contact us for school-sized pricing
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Full access to enrolment, attendance, messaging, results, and
                  finance workflows so you can evaluate with real school data.
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-sky-400 sm:w-auto"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {[
                    "Unlimited students during trial",
                    "Parent messaging & announcements",
                    "Exam and results workflows",
                    "Fee tracking & finance visibility",
                    "Role-based staff access",
                    "Mobile-friendly workspaces",
                  ].map((line) => (
                    <p
                      key={line}
                      className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  After trial
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  School plans on request
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Pricing depends on school size and modules you need. We quote
                  in clear terms, with no surprise enterprise lock-in language.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    Primary & secondary school packages
                  </li>
                  <li className="flex gap-2">
                    <BadgeDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    Local currency conversations (ZMW)
                  </li>
                  <li className="flex gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    Onboarding support for your team
                  </li>
                </ul>
                <a
                  href="mailto:zamschoolos@gmail.com?subject=ZamSchool%20OS%20pricing%20quote"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Request a demo / quote
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & security */}
        <section id="trust" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 sm:text-sm">
              Trust & security
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Built for school data, not a public free-for-all.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Workspaces require sign-in. Access is role-based. Legal policies
              are published for boards and parents who ask hard questions.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {trustItems.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/privacy"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-800 hover:bg-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-800 hover:bg-white"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-800 hover:bg-white"
            >
              Cookie Policy
            </Link>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-slate-200 bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 sm:text-sm">
                Trusted by schools
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Teams want one system that feels organized as soon as it opens.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {testimonials.map((item) => (
                <blockquote
                  key={item.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <p className="text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
                    &quot;{item.quote}&quot;
                  </p>
                  <footer className="mt-5">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* About / final CTA */}
        <section id="about" className="bg-slate-950 py-14 text-white sm:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300 sm:text-sm">
              About ZamSchool OS
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Ready to transform your school office?
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
              ZamSchool OS is built in Zambia for modern African schools, so your
              team can enrol learners, mark attendance, talk to parents, collect
              fees, and publish results without juggling five disconnected tools.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-sky-400 sm:px-8 sm:py-4 sm:text-base"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:zamschoolos@gmail.com?subject=ZamSchool%20OS%20demo%20request"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/15 sm:px-8 sm:py-4 sm:text-base"
              >
                Request a demo
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 sm:px-8 sm:py-4 sm:text-base"
              >
                Log in
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Contact: zamschoolos@gmail.com · +260 973 385 988 · Mungu, Zambia
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
