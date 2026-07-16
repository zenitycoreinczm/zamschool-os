import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ||
  "https://www.zamschoolos.site";

/**
 * Public marketing may be indexed. Product UI, APIs, and auth flows stay closed.
 * AI training scrapers are disallowed entirely (also hard-blocked in middleware).
 */
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

const AI_AGENTS = [
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
  "Scrapy",
  "DeepSeek",
  "Grok",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/cookies", "/login", "/register"],
        disallow: PRIVATE_DISALLOW,
      },
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: ["/"] as string[],
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
