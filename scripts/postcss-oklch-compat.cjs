/**
 * PostCSS plugin: convert modern CSS color functions (oklch/oklab) to
 * plain sRGB rgb()/rgba() so the site renders correctly on browsers that
 * predate wide-gamut color support:
 *
 *   - Safari < 15.4, iOS < 15.4  (no oklch)
 *   - Firefox < 113              (no oklch)
 *   - Edge/Chrome < 111          (no oklch)
 *   - Older Android WebView / KaiOS browsers common on budget phones
 *
 * Tailwind CSS v4 emits its entire default palette as oklch() custom
 * properties in :root. Browsers that cannot parse oklch() drop the whole
 * declaration, so every var(--color-*) substitution downstream collapses
 * to invalid/unset — white-on-white text, invisible borders, missing
 * backgrounds. Converting the emitted values to rgb() is visually
 * equivalent (minor gamut clipping) and works everywhere.
 *
 * Values containing var() or relative-color syntax (oklch(from ...)) are
 * left untouched — they cannot be computed at build time.
 *
 * CommonJS on purpose: Next.js loads PostCSS plugins via
 * require.resolve(pluginName), which cannot import ESM on Node 20.
 */

"use strict";

const OKLCH_RE = /oklch\(\s*([^)]*?)\s*\)/g;
const OKLAB_RE = /oklab\(\s*([^)]*?)\s*\)/g;

/** sRGB transfer function (linear -> gamma encoded). */
function gammaEncode(channel) {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** OKLab -> linear sRGB -> gamma sRGB (0-255 per channel). */
function oklabToRgb255(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [
    Math.round(Math.min(255, Math.max(0, gammaEncode(r) * 255))),
    Math.round(Math.min(255, Math.max(0, gammaEncode(g) * 255))),
    Math.round(Math.min(255, Math.max(0, gammaEncode(bl) * 255))),
  ];
}

/** Parse one channel: number, percentage, or `none` -> {value, ok}. */
function parseChannel(token) {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw || raw === "none") return { value: 0, ok: true };
  const isPercent = raw.endsWith("%");
  const num = parseFloat(isPercent ? raw.slice(0, -1) : raw);
  if (Number.isNaN(num)) return { ok: false };
  return { value: isPercent ? num / 100 : num, ok: true };
}

/** Format alpha without float noise. */
function formatAlpha(alpha) {
  return String(Math.round(alpha * 1000) / 1000);
}

function convertOklch(inner) {
  // Relative color syntax / var() references cannot be computed at build time.
  if (inner.includes("var(") || /\bfrom\b/i.test(inner)) return null;

  const slashIndex = inner.indexOf("/");
  const channelsPart = slashIndex === -1 ? inner : inner.slice(0, slashIndex);
  const alphaPart = slashIndex === -1 ? null : inner.slice(slashIndex + 1);

  const tokens = channelsPart.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 3) return null;

  const L = parseChannel(tokens[0]);
  const C = parseChannel(tokens[1]);
  const H = parseChannel(tokens[2]);
  if (!L.ok || !C.ok || !H.ok) return null;

  // Lightness is 0-1 (percentage or raw). Chroma percentage maps to 0-0.4.
  const chroma = tokens[1].trim().endsWith("%") ? C.value * 0.4 : C.value;
  const hueDeg = tokens[2].trim().toLowerCase().replace("deg", "");
  const hue = parseFloat(hueDeg) || 0;

  const rad = (hue * Math.PI) / 180;
  const rgb = oklabToRgb255(
    L.value,
    chroma * Math.cos(rad),
    chroma * Math.sin(rad),
  );

  let alpha = 1;
  if (alphaPart !== null) {
    const A = parseChannel(alphaPart);
    if (!A.ok) return null;
    alpha = A.value;
  }

  return alpha >= 1
    ? "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")"
    : "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + formatAlpha(alpha) + ")";
}

function convertOklab(inner) {
  if (inner.includes("var(") || /\bfrom\b/i.test(inner)) return null;

  const slashIndex = inner.indexOf("/");
  const channelsPart = slashIndex === -1 ? inner : inner.slice(0, slashIndex);
  const alphaPart = slashIndex === -1 ? null : inner.slice(slashIndex + 1);

  const tokens = channelsPart.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 3) return null;

  const L = parseChannel(tokens[0]);
  const a = parseChannel(tokens[1]);
  const b = parseChannel(tokens[2]);
  if (!L.ok || !a.ok || !b.ok) return null;

  // a/b percentages map to -0.4..0.4.
  const aVal = tokens[1].trim().endsWith("%") ? a.value * 0.4 : a.value;
  const bVal = tokens[2].trim().endsWith("%") ? b.value * 0.4 : b.value;

  const rgb = oklabToRgb255(L.value, aVal, bVal);

  let alpha = 1;
  if (alphaPart !== null) {
    const A = parseChannel(alphaPart);
    if (!A.ok) return null;
    alpha = A.value;
  }

  return alpha >= 1
    ? "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")"
    : "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + formatAlpha(alpha) + ")";
}

function convertValue(value) {
  let out = value;
  if (out.includes("oklch(")) {
    out = out.replace(OKLCH_RE, function (match, inner) {
      return convertOklch(inner) || match;
    });
  }
  if (out.includes("oklab(")) {
    out = out.replace(OKLAB_RE, function (match, inner) {
      return convertOklab(inner) || match;
    });
  }
  return out;
}

const plugin = {
  postcssPlugin: "zamschool-oklch-compat",
  Declaration: function (decl) {
    if (
      !decl.value ||
      (decl.value.indexOf("oklch(") === -1 &&
        decl.value.indexOf("oklab(") === -1)
    ) {
      return;
    }
    const converted = convertValue(decl.value);
    if (converted !== decl.value) {
      decl.value = converted;
    }
  },
};

module.exports = plugin;
module.exports.default = plugin;
