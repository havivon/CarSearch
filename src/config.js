// Central, env-driven configuration for live fetching.
//
// Everything here has a sane default so the app runs with zero setup, but each
// knob can be overridden via environment variables for production/live use.

import fs from "node:fs";
import path from "node:path";

function bool(v, dflt) {
  if (v == null) return dflt;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

/**
 * Locate a usable Chromium binary for the Playwright engine.
 * Order: explicit CHROMIUM_PATH -> pre-installed /opt/pw-browsers build ->
 * undefined (let Playwright resolve its own download).
 */
function detectChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dirs = fs
      .readdirSync(base)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const d of dirs) {
      const exe = path.join(base, d, "chrome-linux", "chrome");
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    /* base dir not present — fall through */
  }
  return undefined; // Playwright will use its own managed browser.
}

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Master switch: when false, providers skip live fetching and serve samples.
  liveEnabled: bool(process.env.LIVE, true),

  // Per-provider live toggles (default to the master switch).
  live: {
    yad2: bool(process.env.LIVE_YAD2, bool(process.env.LIVE, true)),
    winwin: bool(process.env.LIVE_WINWIN, bool(process.env.LIVE, true)),
    facebook: bool(process.env.LIVE_FACEBOOK, false), // needs auth; off by default
    auto: bool(process.env.LIVE_AUTO, bool(process.env.LIVE, true)),
  },

  // Engine for sites with anti-bot protection: "http" (fast) or "browser"
  // (Playwright real browser, beats most anti-bot). "auto" = browser if the
  // playwright package is available, else http.
  yad2Engine: (process.env.YAD2_ENGINE || "auto").toLowerCase(),

  httpTimeoutMs: Number(process.env.HTTP_TIMEOUT_MS) || 9000,
  browserTimeoutMs: Number(process.env.BROWSER_TIMEOUT_MS) || 25000,
  maxPages: Number(process.env.MAX_PAGES) || 1,

  userAgent:
    process.env.USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",

  chromiumExecutable: detectChromium(),

  // Whether the runtime exposes a proxy that fetch should honor. Node's
  // built-in fetch only reads HTTPS_PROXY when NODE_USE_ENV_PROXY=1 (Node>=22.21).
  httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || null,
};

// Make built-in fetch honor the proxy when one is configured (no-op locally).
if (config.httpsProxy && !process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = "1";
}
