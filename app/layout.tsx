import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Toaster } from "sonner";
import SupabaseGuardBootstrap from "@/components/SupabaseGuardBootstrap";
import { ClientEnvValidator } from "@/components/ClientEnvValidator";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ||
  "https://www.zamschoolos.site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
  colorScheme: "dark light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ZamSchool OS - School Management System for African Schools",
    template: "%s | ZamSchool OS",
  },
  description:
    "ZamSchool OS is the all-in-one school operating system for modern African schools. Manage students, attendance, exams, parent communication, and school finance from one fast platform.",
  applicationName: "ZamSchool OS",
  authors: [{ name: "ZamSchool OS" }],
  creator: "ZamSchool OS",
  publisher: "ZamSchool OS",
  category: "education",
  keywords: [
    "ZamSchool OS",
    "ZamSchool",
    "school management system",
    "school software Zambia",
    "school OS Africa",
    "student attendance system",
    "parent portal school",
    "school fees management",
    "exam results school software",
    "teacher workspace",
    "Zambian schools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_ZM",
    url: siteUrl,
    siteName: "ZamSchool OS",
    title: "ZamSchool OS - School Management System for African Schools",
    description:
      "Manage students, attendance, exams, parent communication, and finance from one school operating system built for modern African schools.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "ZamSchool OS",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ZamSchool OS - School Management System",
    description:
      "The all-in-one school OS for African schools: students, attendance, exams, parents, and finance.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // AI opt-out hints (middleware also hard-blocks AI scraper user-agents).
  other: {
    robots: "index, follow, noai, noimageai",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ZamSchool OS",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "School operating system for African schools - students, attendance, exams, parent communication, and finance.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={inter.className}
        // `next/font/google` injects a hashed className that can differ
        // between SSR + first client render in dev mode (font fallback
        // resolution). Production builds are stable, but the suppression
        // is kept to silence dev-only noise. Tracked in docs/AUDIT.md
        // "Test coverage limits and future work" as a future investigation.
        // No other hydration mismatches should escape it - if any do,
        // they will appear in the dev console.
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SupabaseGuardBootstrap />
        <ClientEnvValidator />
        {children}
        <Toaster position="top-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
