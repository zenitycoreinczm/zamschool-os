import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import LandingFooter from "@/components/landing/LandingFooter";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalPageLayoutProps = {
  title: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
  /** Current page key for sibling nav highlight */
  current: "privacy" | "terms" | "cookies";
};

const LEGAL_NAV = [
  { key: "privacy" as const, label: "Privacy Policy", href: "/privacy" },
  { key: "terms" as const, label: "Terms of Service", href: "/terms" },
  { key: "cookies" as const, label: "Cookie Policy", href: "/cookies" },
];

export default function LegalPageLayout({
  title,
  summary,
  lastUpdated,
  sections,
  current,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="truncate text-sm font-bold text-slate-900 sm:text-base">
              ZamSchool OS
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="hidden font-medium text-slate-600 transition hover:text-slate-900 sm:inline"
            >
              Log in
            </Link>
            <Link
              href="/"
              className="font-medium text-slate-600 transition hover:text-slate-900"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          {/* Side nav */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Legal
            </p>
            <nav className="mt-3 flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
              {LEGAL_NAV.map((item) => {
                const active = item.key === current;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={
                      active
                        ? "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                On this page
              </p>
              <nav className="mt-3 space-y-1.5">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm text-slate-500 transition hover:text-slate-900"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Document */}
          <article className="min-w-0">
            <header className="border-b border-slate-200 pb-8">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Last updated: {lastUpdated}
              </p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                {summary}
              </p>
            </header>

            <div className="divide-y divide-slate-100">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-8 py-8"
                >
                  <h2 className="text-lg font-semibold text-slate-950 sm:text-xl">
                    {section.title}
                  </h2>
                  <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="text-sm font-semibold text-slate-900">
                Related policies
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {LEGAL_NAV.filter((item) => item.key !== current).map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="font-medium text-slate-700 underline-offset-2 hover:underline"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Questions? Email{" "}
                <a
                  href="mailto:zenitycoreinc@gmail.com"
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  zenitycoreinc@gmail.com
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

/** Shared inline link style for legal body copy */
export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
    >
      {children}
    </Link>
  );
}

export function LegalMail({ children }: { children: string }) {
  return (
    <a
      href={`mailto:${children}`}
      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
    >
      {children}
    </a>
  );
}
