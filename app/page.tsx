import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  CheckCircle2,
  Globe,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

import LandingFooter from "@/components/landing/LandingFooter";

const featureCards = [
  {
    icon: GraduationCap,
    title: "Student Management",
    description:
      "Enrollment, profiles, academic history, and performance tracking in one place.",
  },
  {
    icon: Users,
    title: "Teacher and Staff",
    description:
      "Role-aware access for teachers, admin teams, and school operations.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance Tracking",
    description:
      "Fast daily roll call with parent visibility and trend reporting.",
  },
  {
    icon: MessageSquare,
    title: "Parent Communication",
    description:
      "Send announcements, updates, and reminders without leaving the platform.",
  },
  {
    icon: BadgeDollarSign,
    title: "Fees and Finance",
    description:
      "Track balances, receipts, and payment activity with clear reporting.",
  },
  {
    icon: ShieldCheck,
    title: "Operational Control",
    description:
      "One system for attendance, academics, messaging, and school records.",
  },
];

const proofPoints = [
  { value: "50+", label: "Schools onboarded" },
  { value: "15,000+", label: "Students managed" },
  { value: "99.9%", label: "Platform uptime target" },
  { value: "4", label: "Countries reached" },
];

const testimonials = [
  {
    name: "Mr. Bwalya Mwila",
    role: "Headteacher",
    quote:
      "Attendance, reports, and communication now take minutes instead of hours.",
  },
  {
    name: "Mrs. Grace Tembo",
    role: "Deputy Principal",
    quote:
      "Parent visibility improved immediately once everything moved into one system.",
  },
  {
    name: "Mr. Chanda Mutale",
    role: "Head Teacher",
    quote:
      "Finance tracking is clearer, faster, and easier for the whole school office.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-2xl shadow-sm">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">ZamSchool OS</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Features
            </Link>
            <Link
              href="#solutions"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Solutions
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Pricing
            </Link>
            <Link
              href="#about"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-400"
            >
              Register School
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#111827_55%,_#172554)]">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-sky-200">
                <Zap className="h-4 w-4 text-amber-300" />
                Built for modern African schools
              </span>
              <h1 className="mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-white md:text-6xl xl:text-7xl">
                The smart school operating system for faster, calmer school
                operations.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Manage students, teachers, attendance, parent communication,
                exams, and finance from one platform that loads fast and stays
                focused on the work schools do every day.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-7 py-4 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Explore Platform
                </Link>
              </div>

              <ul className="mt-10 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Real-time attendance tracking
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Parent communication portal
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Automated report generation
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Works on any device
                </li>
              </ul>
            </div>

            <section
              aria-label="Platform preview"
              className="rounded-[2rem] border border-white/10 bg-white/95 p-6 shadow-[0_32px_100px_rgba(15,23,42,0.45)]"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  app.zamschool.zm/admin
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-sky-200">
                      Admin Dashboard
                    </p>
                    <p className="mt-1 text-2xl font-bold">Hillcrest Primary</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                    <p className="text-xs text-slate-300">Attendance today</p>
                    <p className="text-2xl font-bold text-emerald-300">96%</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                      Students
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      1,248
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Across classes, exam groups, and attendance streams.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                      Teachers
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">64</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Assignments, timetables, and role-based access in one
                      place.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        This week at a glance
                      </p>
                      <p className="text-sm text-slate-500">
                        Attendance, announcements, and fees in one surface.
                      </p>
                    </div>
                    <Globe className="h-5 w-5 text-sky-500" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Attendance
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        Mon-Fri
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Live updates for present and absent learners.
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Announcements
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        3 active
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Exams, sports day, and fee deadline notices.
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Collections
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        K 482k
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Payment tracking with clearer follow-up.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white p-6 shadow-sm hover:-translate-y-0.5 transition-transform"
              >
                <p className="text-3xl font-extrabold text-slate-900">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
              Features
            </p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Core school workflows without the usual admin drag.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              ZamSchool OS combines the day-to-day systems schools already need,
              then keeps them close enough that staff can move quickly instead
              of bouncing between spreadsheets and disconnected tools.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="solutions" className="bg-slate-950 py-24 text-white">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
                Solutions
              </p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
                Faster operations for admin teams, teachers, and parents.
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold">Admin teams</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Keep attendance, reporting, user management, and school
                  communication in one workflow.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold">Teachers</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Mark attendance quickly, review results, and message guardians
                  without switching tools.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold">Parents</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Stay informed about attendance, announcements, and fee
                  reminders from any device.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-slate-50 py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
                Pricing
              </p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                Start free and set up your school before you commit.
              </h2>
            </div>

            <div className="mt-14 rounded-[2rem] border border-sky-200 bg-white p-8 shadow-xl shadow-sky-100/70">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
                    Starter
                  </p>
                  <h3 className="mt-3 text-4xl font-extrabold text-slate-900">
                    Free 14-day trial
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                    Full platform access for onboarding, attendance,
                    communication, results, and finance workflows.
                  </p>
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  Register Your School
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Unlimited students during trial
                </p>
                <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Parent messaging and announcements
                </p>
                <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Exam and results workflows
                </p>
                <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Fee tracking and finance visibility
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
              Trusted by schools
            </p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Teams want one system that feels organized as soon as it opens.
            </h2>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote
                key={item.name}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <p className="text-base leading-8 text-slate-700">
                  &quot;{item.quote}&quot;
                </p>
                <footer className="mt-6">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section id="about" className="bg-slate-950 py-24 text-white">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
              About
            </p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">
              Ready to transform your school?
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Register your school in minutes and give every student, teacher,
              and parent a platform that is easier to use and faster to trust.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-8 py-4 text-base font-bold text-white transition hover:bg-sky-400"
              >
                Register Your School
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white transition hover:bg-white/15"
              >
                Login to Existing School
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
