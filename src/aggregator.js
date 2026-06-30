// Orchestrates all providers: runs them in parallel, merges, dedupes and sorts.

import { yad2 } from "./providers/yad2.js";
import { winwin } from "./providers/winwin.js";
import { facebook } from "./providers/facebook.js";
import { auto } from "./providers/auto.js";
import { dedupe, sortListings } from "./normalize.js";

const PROVIDERS = [yad2, winwin, facebook, auto];

/** The list of selectable sources, for the UI. */
export function listSources() {
  return PROVIDERS.map((p) => ({ id: p.id, name: p.name }));
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
