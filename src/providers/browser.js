// Playwright (real Chromium) engine.
//
// This is the production-correct way to fetch listings from sites with anti-bot
// protection (e.g. Yad2/PerimeterX): a real browser executes the site's JS and
// passes the bot challenge, then we read the embedded data or the rendered DOM.
//
// The `playwright` package is an OPTIONAL dependency. If it is not installed,
// browserAvailable() returns false and callers fall back to the HTTP engine.

import { config } from "../config.js";

let _chromium = null; // lazily-imported playwright.chromium
let _browser = null; // reused singleton browser
let _checked = false;

/** True if the playwright package can be loaded. */
export async function browserAvailable() {
  if (_checked) return _chromium != null;
  _checked = true;
  try {
    const pw = await import("playwright");
    _chromium = pw.chromium;
  } catch {
    _chromium = null;
  }
  return _chromium != null;
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (!(await browserAvailable())) {
    throw new Error("playwright not installed");
  }
  _browser = await _chromium.launch({
    headless: true,
    executablePath: config.chromiumExecutable, // undefined => Playwright default
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return _browser;
}

/**
 * Open `url` in a fresh page and run `extract(page)` once the page is ready.
 * Returns whatever `extract` returns. Always closes the page (browser is reused).
 */
export async function withPage(url, extract, { waitFor } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: config.userAgent,
    locale: "he-IL",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.browserTimeoutMs,
    });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: config.browserTimeoutMs }).catch(() => {});
    }
    return await extract(page);
  } finally {
    await context.close().catch(() => {});
  }
}

/** Read and JSON-parse a Next.js __NEXT_DATA__ blob from the page, if present. */
export async function readNextData(page) {
  const raw = await page
    .$eval("#__NEXT_DATA__", (el) => el.textContent)
    .catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Close the shared browser (call on shutdown). */
export async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
