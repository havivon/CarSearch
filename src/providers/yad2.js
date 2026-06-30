// Yad2 provider — live fetch with two engines + sample fallback.
//
//   engine "http"    -> hits gw.yad2.co.il JSON feed (fast, but PerimeterX
//                       anti-bot usually returns 403 from a server).
//   engine "browser" -> drives real Chromium (Playwright) through the search
//                       page and reads the embedded Next.js data; this passes
//                       anti-bot and is the production-correct path.
//
// Engine is chosen by config.yad2Engine ("auto" = browser if available).
// Any failure degrades to clearly-labeled sample data so search never breaks.

import { fetchJson } from "./http.js";
import { browserAvailable, withPage, readNextData } from "./browser.js";
import { makeListing, matchesCriteria } from "../normalize.js";
import { yad2Sample } from "../sampleData.js";
import { config } from "../config.js";

const MAKE_IDS = {
  "מאזדה": 27, mazda: 27, "טויוטה": 40, toyota: 40, "יונדאי": 21, hyundai: 21,
  "קיה": 48, kia: 48, "סקודה": 38, skoda: 38, "פולקסווגן": 41, volkswagen: 41,
  "מיצובישי": 30, mitsubishi: 30, "ניסאן": 32, nissan: 32, "הונדה": 19, honda: 19,
  "סוזוקי": 39, suzuki: 39,
};

function queryParams(criteria) {
  const params = new URLSearchParams();
  const makeId = MAKE_IDS[(criteria.make || "").toLowerCase().trim()];
  if (makeId) params.set("manufacturer", String(makeId));
  if (criteria.yearMin || criteria.yearMax) {
    params.set("year", `${criteria.yearMin || 1990}-${criteria.yearMax || 2026}`);
  }
  if (criteria.priceMin || criteria.priceMax) {
    params.set("price", `${criteria.priceMin || 0}-${criteria.priceMax || 9999999}`);
  }
  if (criteria.kmMax) params.set("km", `-1-${criteria.kmMax}`);
  if (criteria.handMax) params.set("hand", `-1-${criteria.handMax}`);
  return params;
}

function gwUrl(criteria) {
  const p = queryParams(criteria);
  p.set("page", "1");
  return `https://gw.yad2.co.il/feed-search-legacy/vehicles/cars?${p.toString()}`;
}

function pageUrl(criteria) {
  const p = queryParams(criteria);
  return `https://www.yad2.co.il/vehicles/cars?${p.toString()}`;
}

/** Map one raw Yad2 feed item (gw or __NEXT_DATA__ shape) to a listing. */
function mapItem(it) {
  if (!it || (it.type && it.type === "ad")) return null;
  const id = it.id || it.link_token || it.token || it.adNumber;
  if (!id) return null;
  const make = it.title_1 || it.manufacturer || it.make || it.model?.manufacturer;
  const model = it.title_2 || it.model_name || it.model || it.commercialName;
  const token = it.link_token || it.token || it.adNumber;
  return makeListing("yad2", "יד2", {
    id,
    title: [make, model].filter(Boolean).join(" ") || it.title || "רכב",
    make,
    model,
    year: it.year || it.vehicleDates?.yearOfProduction,
    price: it.price || it.priceData?.price,
    mileage: it.km ?? it.kilometers ?? it.mileage,
    hand: it.hand ?? it.hand_num ?? it.currentOwner,
    city: it.city || it.area || it.address?.city?.text,
    url: token ? `https://www.yad2.co.il/item/${token}` : "https://www.yad2.co.il/vehicles/cars",
    image: Array.isArray(it.images_urls) ? it.images_urls[0] : it.image_url || it.coverImage,
    postedAt: it.date || it.updated_at || it.dates?.updatedAt,
    live: true,
  });
}

/** Find arrays of listing-like objects anywhere in a deeply-nested JSON blob. */
export function deepFindItems(node, depth = 0, out = []) {
  if (!node || depth > 8) return out;
  if (Array.isArray(node)) {
    const looksLikeFeed =
      node.length > 0 &&
      node.some(
        (x) => x && typeof x === "object" && (x.link_token || x.token || x.adNumber || (x.title_1 && x.price))
      );
    if (looksLikeFeed) out.push(...node);
    else node.forEach((c) => deepFindItems(c, depth + 1, out));
  } else if (typeof node === "object") {
    for (const v of Object.values(node)) deepFindItems(v, depth + 1, out);
  }
  return out;
}

export function parseGw(json) {
  const items = json?.data?.feed?.feed_items || deepFindItems(json);
  return items.map(mapItem).filter(Boolean);
}

async function viaHttp(criteria) {
  const json = await fetchJson(gwUrl(criteria));
  return parseGw(json);
}

async function viaBrowser(criteria) {
  return withPage(
    pageUrl(criteria),
    async (page) => {
      const next = await readNextData(page);
      if (next) {
        const items = deepFindItems(next);
        if (items.length) return items.map(mapItem).filter(Boolean);
      }
      // DOM fallback: scrape rendered listing cards.
      return page.$$eval('[data-test-id="feed-item"], [data-nagish="feed-item-list"] a[href*="/item/"]', (els) =>
        els.slice(0, 40).map((el, i) => {
          const text = (sel) => el.querySelector(sel)?.textContent?.trim() || "";
          const href = el.getAttribute("href") || el.querySelector("a")?.getAttribute("href") || "";
          return {
            id: (href.match(/item\/([^/?]+)/) || [])[1] || `dom${i}`,
            title_1: text("[class*=heading]") || text("h2"),
            title_2: text("[class*=subtitle]"),
            price: text("[class*=price]"),
            link_token: (href.match(/item\/([^/?]+)/) || [])[1],
          };
        })
      ).then((rows) => rows.map(mapItem).filter(Boolean));
    },
    { waitFor: '[data-test-id="feed-item"], #__NEXT_DATA__' }
  );
}

function sampleResult(criteria, status, message) {
  const listings = yad2Sample().filter((l) => matchesCriteria(l, criteria));
  return { id: "yad2", name: "יד2", live: false, status, message, listings };
}

export const yad2 = {
  id: "yad2",
  name: "יד2",
  async search(criteria) {
    if (!config.live.yad2) {
      return sampleResult(criteria, "sample", "מצב חי מושבת (LIVE_YAD2=0)");
    }

    const useBrowser =
      config.yad2Engine === "browser" ||
      (config.yad2Engine === "auto" && (await browserAvailable()));

    try {
      const raw = useBrowser ? await viaBrowser(criteria) : await viaHttp(criteria);
      const live = raw.filter((l) => matchesCriteria(l, criteria));
      if (live.length > 0) {
        return { id: "yad2", name: "יד2", live: true, status: "ok", listings: live };
      }
      return sampleResult(criteria, "fallback", "לא התקבלו תוצאות חיות — מוצגות דוגמאות");
    } catch (err) {
      const blocked =
        err.status === 403 ||
        err.status === 429 ||
        /403|407|policy|ERR_TUNNEL|ERR_PROXY|CONNECT/i.test(String(err.message));
      return sampleResult(
        criteria,
        blocked ? "blocked" : "error",
        `מקור חי לא זמין (${err.message}) — מוצגות דוגמאות`
      );
    }
  },
};
