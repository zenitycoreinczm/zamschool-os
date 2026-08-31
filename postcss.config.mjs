import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js only accepts PostCSS plugins as module-name strings (it
 * require.resolve()s them). Reference our local plugin by absolute path so
 * it resolves from any cwd / deploy environment.
 */
const oklchCompatPlugin = path.join(here, "scripts", "postcss-oklch-compat.cjs");

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    // Tailwind v4 emits its palette as oklch() — invisible on Safari < 15.4,
    // Firefox < 113, Edge/Chrome < 111, and older Android WebViews.
    "@tailwindcss/postcss",
    // Downlevel oklch()/oklab() to rgb()/rgba() for universal browser support.
    oklchCompatPlugin,
    "autoprefixer",
  ],
};

export default config;
