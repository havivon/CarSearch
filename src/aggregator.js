// Orchestrates all providers: runs them in parallel, merges, dedupes and sorts.

import { yad2 } from "./providers/yad2.js";
import { winwin } from "./providers/winwin.js";
import { facebook } from "./providers/facebook.js";
import { auto } from "./providers/auto.js";
import { dedupe, sortListings } from "./normalize.js";
import { probe } from "./providers/http.js";
import { browserAvailable } from "./providers/browser.js";
import { config } from "./config.js";

const PROVIDERS = [yad2, winwin, facebook, auto];

// Base URLs probed by the health check to report per-source reachability.
const HEALTH_URLS = {
  yad2: "https://gw.yad2.co.il/feed-search-legacy/vehicles/cars?page=1",
  winwin: "https://www.winwin.co.il/",
  facebook: "https://www.facebook.com/marketplace/",
  auto: "https://www.auto.co.il/",
};

/** The list of selectable sources, for the UI. */
export function listSources() {
  return PROVIDERS.map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Diagnose whether live fetching can actually work right now: probe each
 * source's reachability and report the browser engine + proxy status. This is
 * what tells the user if live data is blocked by the environment's network
 * policy versus by anti-bot, versus genuinely working.
 */
export async function checkHealth() {
  const browser = await browserAvailable();
  const entries = await Promise.all(
    PROVIDERS.map(async (p) => {
      const url = HEALTH_URLS[p.id];
      const result = url ? await probe(url) : { ok: false, kind: "no_endpoint" };
      return {
        id: p.id,
        name: p.name,
        liveEnabled: config.live[p.id] ?? false,
        reachable: result.ok,
        kind: result.kind,
        status: result.status ?? null,
        ms: result.ms ?? null,
      };
    })
  );
  return {
    browserEngine: browser,
    chromium: config.chromiumExecutable || "(playwright default)",
    proxy: config.httpsProxy ? "configured" : "none",
    yad2Engine: config.yad2Engine,
    sources: entries,
  };
}

/**
 * Run a search across the requested sources.
 * @param {object} criteria normalized search criteria
 * @param {string[]} sourceIds ids to include (empty/undefined = all)
 * @param {string} sort sort key
 */
export async function search(criteria, sourceIds, sort = "price_asc") {
  const active = PROVIDERS.filter(
    (p) => !sourceIds || sourceIds.length === 0 || sourceIds.includes(p.id)
  );

  const settled = await Promise.allSettled(active.map((p) => p.search(criteria)));

  const sources = [];
  let merged = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      const r = res.value;
      sources.push({
        id: r.id,
        name: r.name,
        live: r.live,
        status: r.status,
        message: r.message || null,
        count: r.listings.length,
      });
      merged = merged.concat(r.listings);
    } else {
      sources.push({
        id: active[i].id,
        name: active[i].name,
        live: false,
        status: "error",
        message: String(res.reason?.message || res.reason),
        count: 0,
      });
    }
  });

  const deduped = dedupe(merged);
  const listings = sortListings(deduped, sort);

  return {
    total: listings.length,
    rawTotal: merged.length,
    anyLive: sources.some((s) => s.live),
    sources,
    listings,
  };
}
