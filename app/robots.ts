import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ||
  "https://www.zamschoolos.site";

/**
 * Indexing policy:
 * - Google Search (Googlebot / InspectionTool) may crawl public marketing pages.
 * - All other crawlers: Disallow entire site (enforced in middleware too).
 * - AI training scrapers: explicit Disallow (also hard-blocked in middleware).
 * - Product UI, APIs, and auth flows stay closed.
 */
const PUBLIC_ALLOW = [
  "/",
  "/privacy",
  "/terms",
  "/cookies",
  "/login",
  "/register",
];

const PRIVATE_DISALLOW = [
  "/app/",
  "/api/",
  "/dashboard",
  "/first-login",
  "/verify-email",
  "/accept-invitation",
  "/join",
  "/forgot-password",
  "/reset-password",
  "/login/mfa",
  "/admin/",
  "/teacher/",
  "/student/",
  "/parent/",
  "/payments/",
  "/super-admin/",
  "/_next/",
];

/** Google Search crawlers only. */
const GOOGLE_SEARCH_AGENTS = ["Googlebot", "Google-InspectionTool"];

const AI_AND_OTHER_CRAWLERS = [
  // AI training / agents
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "PerplexityBot",
  "YouBot",
  "Diffbot",
  "ImagesiftBot",
  "AI2Bot",
  "Webzio-Extended",
  "PetalBot",
  "DataForSeoBot",
  "SemrushBot",
  "AhrefsBot",
  "DotBot",
  "BLEXBot",
  "MJ12bot",
  "Scrapy",
  "DeepSeek",
  "Grok",
  // Non-Google search engines
  "bingbot",
  "BingPreview",
  "DuckDuckBot",
  "Slurp",
  "Applebot",
  "YandexBot",
  "Baiduspider",
  "Sogou",
  "SeznamBot",
  "ia_archiver",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: no crawlers. Google is allow-listed below.
      {
        userAgent: "*",
        disallow: ["/"],
      },
      ...GOOGLE_SEARCH_AGENTS.map((userAgent) => ({
        userAgent,
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      })),
      ...AI_AND_OTHER_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: ["/"] as string[],
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
