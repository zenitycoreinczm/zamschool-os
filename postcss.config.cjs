const path = require("node:path");

/**
 * Next.js only accepts PostCSS plugins as module-name strings (it
 * require.resolve()s them). Reference our local oklch-compat plugin by
 * absolute path derived from __dirname so it resolves identically on
 * Windows, macOS, Linux, and inside the Vercel build image.
 *
 * CommonJS on purpose: the previous .mjs + import.meta.url variant could
 * fail module resolution on some Node 26 / Windows setups.
 */
const oklchCompatPlugin = path.join(
  __dirname,
  "scripts",
  "postcss-oklch-compat.cjs",
);

/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: [
    // Tailwind v4 emits its palette as oklch() — invisible on Safari < 15.4,
    // Firefox < 113, Edge/Chrome < 111, and older Android WebViews.
    "@tailwindcss/postcss",
    // Downlevel oklch()/oklab() to rgb()/rgba() for universal browser support.
    oklchCompatPlugin,
    "autoprefixer",
  ],
};
