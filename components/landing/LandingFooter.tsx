import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

const footerLinks = [
  {
    heading: "Platform",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Start free trial", href: "/register" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Trust & legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Security & trust", href: "/#trust" },
      { label: "Contact", href: "mailto:zamschoolos@gmail.com" },
    ],
  },
];

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
];

export default function LandingFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-12 pt-20 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-5">
          <Link href="/" className="flex w-fit items-center gap-2.5 group">
            <div className="h-9 w-9 overflow-hidden rounded-xl shadow-md transition-transform group-hover:scale-105">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xl font-bold text-white">ZamSchool OS</span>
          </Link>

          <p className="max-w-sm text-sm leading-6 text-slate-500">
            School operating system for modern African schools: attendance,
            people, communication, fees, and results in one place.
          </p>
          <div className="flex flex-col gap-2.5 text-sm">
            <a
              href="mailto:zamschoolos@gmail.com"
              className="group flex items-center gap-2.5 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-sky-400" />
              zamschoolos@gmail.com
            </a>
            <a
              href="tel:+260973385988"
              className="flex items-center gap-2.5 transition-colors hover:text-white"
            >
              <Phone className="h-4 w-4 shrink-0 text-slate-600" />
              +260 973 385 988
            </a>
            <span className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-slate-600" />
              Mungu, Zambia
            </span>
          </div>
        </div>

        {footerLinks.map((column) => (
          <div key={column.heading} className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
              {column.heading}
            </h3>
            <ul className="flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-block text-sm text-slate-500 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.05]" />

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold text-slate-500">All systems operational</span>
        </div>

        <nav className="flex items-center gap-4">
          {legalLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs text-slate-600 transition-colors hover:text-slate-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
