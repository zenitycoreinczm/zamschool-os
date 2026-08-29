import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

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
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12">
        {/* Brand & Corporate profile */}
        <div className="flex flex-col gap-4">
          <Link href="/" className="group flex w-fit items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/15 transition-transform group-hover:scale-105">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">ZamSchool OS</span>
              <p className="text-[11px] font-medium text-sky-400">The School Operating System</p>
            </div>
          </Link>

          <p className="max-w-sm text-sm leading-6 text-slate-400">
            Enterprise school operating system built for Zambian educational institutions. 
            Native offline roll calls, ECZ report cards, and fee reconciliation on Web and Android.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
            <p className="font-semibold text-white">Backed by ZenityCore Technologies</p>
            <p className="mt-1 text-slate-400">
              Founded & led by CEO <span className="font-medium text-white">Ison Mumbuna</span>. 
              Engineering resilient educational cloud & mobile solutions across Africa.
            </p>
            <a
              href="https://zenitycore.tech"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-semibold text-sky-400 hover:text-sky-300"
            >
              zenitycore.tech
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-xs sm:text-sm">
            <a
              href="mailto:zenitycoreinc@gmail.com"
              className="flex items-center gap-2.5 text-slate-400 transition hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0 text-sky-400" />
              zenitycoreinc@gmail.com
            </a>
            <a
              href="tel:+260973385988"
              className="flex items-center gap-2.5 text-slate-400 transition hover:text-white"
            >
              <Phone className="h-4 w-4 shrink-0 text-sky-400" />
              +260 973 385 988
            </a>
            <span className="flex items-center gap-2.5 text-slate-400">
              <MapPin className="h-4 w-4 shrink-0 text-sky-400" />
              Lusaka & Mongu, Zambia
            </span>
          </div>
        </div>

        {/* Links columns */}
        {footerNavigation.map((col) => (
          <div key={col.heading} className="flex flex-col gap-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {col.heading}
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-400 transition hover:text-white"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-slate-400 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.08]" />

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <SystemStatusBadge />
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
            TLS 1.3 Encrypted & Local-First Cached
          </span>
        </div>

        <p className="text-center sm:text-right">
          © {new Date().getFullYear()} ZamSchool OS · Developed by ZenityCore Technologies. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
