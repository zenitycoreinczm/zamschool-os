import Image from "next/image";
import Link from "next/link";

import SystemStatusBadge from "@/components/landing/SystemStatusBadge";

const footerNavigation = [
  {
    heading: "Platform & Desks",
    links: [
      { label: "Web Portal (Admin & Bursar)", href: "/#platforms" },
      { label: "Android App (Teachers & Parents)", href: "/#platforms" },
      { label: "System Architecture", href: "/#architecture" },
      { label: "Attendance Engine", href: "/#modules" },
      { label: "ECZ Grading & Reports", href: "/#modules" },
      { label: "Tuition & Fee Ledger", href: "/#modules" },
    ],
  },
  {
    heading: "System & Architecture",
    links: [
      { label: "Offline-First Sync", href: "/#architecture" },
      { label: "Zero-SMS Push Mesh", href: "/#compare" },
      { label: "Multi-Role RBAC", href: "/#architecture" },
      { label: "Frequently Asked Questions", href: "/#faq" },
      { label: "Compare with Legacy SMS", href: "/#compare" },
      { label: "System Status", href: "/#trust" },
    ],
  },
  {
    heading: "Company & Trust",
    links: [
      { label: "ZenityCore Technologies", href: "https://zenitycore.tech", isExternal: true },
      { label: "About Leadership", href: "/#leadership" },
      { label: "Pricing & Pilot", href: "/#pricing" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Security Architecture", href: "/#trust" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-14 sm:px-6 sm:pt-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-4">
          <Link href="/" className="group flex w-fit items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 transition-transform group-hover:scale-105">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">ZamSchool OS</span>
              <p className="text-[11px] font-medium text-sky-700">The School Operating System</p>
            </div>
          </Link>

          <p className="max-w-sm text-sm leading-6 text-slate-600">
            Enterprise school operating system built for Zambian educational institutions. Native offline roll calls,
            ECZ report cards, and fee reconciliation on Web and Android.
          </p>

          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-900">Backed by ZenityCore Technologies</p>
            <p className="mt-1 text-slate-600">
              Founded & led by CEO <span className="font-medium text-slate-900">Ison Mumbuna</span>. Engineering
              resilient educational cloud & mobile solutions across Africa.
            </p>
            <a
              href="https://zenitycore.tech"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex font-semibold text-sky-700 hover:text-sky-800 hover:underline"
            >
              zenitycore.tech
            </a>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-xs sm:text-sm">
            <a
              href="mailto:zenitycoreinc@gmail.com"
              className="break-all text-slate-600 transition hover:text-sky-700"
            >
              zenitycoreinc@gmail.com
            </a>
            <a href="tel:+260973385988" className="text-slate-600 transition hover:text-sky-700">
              +260 973 385 988
            </a>
            <span className="text-slate-600">Lusaka & Mongu, Zambia</span>
          </div>
        </div>

        {footerNavigation.map((col) => (
          <div key={col.heading} className="flex flex-col gap-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">{col.heading}</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-600 transition hover:text-sky-700"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-slate-600 transition hover:text-sky-700">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200" />

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <SystemStatusBadge variant="light" />
          <span className="text-slate-500">TLS 1.3 Encrypted & Local-First Cached</span>
        </div>

        <p className="text-center sm:text-right">
          © {new Date().getFullYear()} ZamSchool OS · Developed by ZenityCore Technologies. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
