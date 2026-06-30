// Yad2 provider.
//
// Yad2 exposes a JSON feed at gw.yad2.co.il used by its own SPA. We attempt a
// live call; in practice Yad2 sits behind PerimeterX anti-bot, so the call is
// often blocked from a server/sandbox. On any failure we fall back to sample
// data so search still returns results, clearly labeled as non-live.

import { fetchJson } from "./http.js";
import { makeListing, matchesCriteria } from "../normalize.js";
import { yad2Sample } from "../sampleData.js";

// Numeric manufacturer ids used by Yad2's feed for common makes.
const MAKE_IDS = {
  "מאזדה": 27, mazda: 27,
  "טויוטה": 40, toyota: 40,
  "יונדאי": 21, hyundai: 21,
  "קיה": 48, kia: 48,
  "סקודה": 38, skoda: 38,
  "פולקסווגן": 41, volkswagen: 41,
  "מיצובישי": 30, mitsubishi: 30,
  "ניסאן": 32, nissan: 32,
  "הונדה": 19, honda: 19,
  "סוזוקי": 39, suzuki: 39,
};

function buildUrl(criteria) {
  const params = new URLSearchParams();
  const makeId = MAKE_IDS[(criteria.make || "").toLowerCase().trim()];
  if (makeId) params.set("manufacturer", String(makeId));
  if (criteria.yearMin || criteria.yearMax) {
    params.set("year", `${criteria.yearMin || 1990}-${criteria.yearMax || 2026}`);
  }
  if (criteria.priceMin || criteria.priceMax) {
    params.set("price", `${criteria.priceMin || 0}-${criteria.priceMax || 9999999}`);
  }
  params.set("page", "1");
  return `https://gw.yad2.co.il/feed-search-legacy/vehicles/cars?${params.toString()}`;
}

function parseFeed(json) {
  const items = json?.data?.feed?.feed_items || [];
  const listings = [];
  for (const it of items) {
    if (!it || it.type === "ad") continue; // skip promo rows
    listings.push(
      makeListing("yad2", "יד2", {
        id: it.id || it.link_token,
        title: [it.title_1, it.title_2].filter(Boolean).join(" "),
        make: it.title_1,
        model: it.title_2,
        year: it.year,
        price: it.price,
        mileage: it.km,
        hand: it.hand,
        city: it.city || it.area,
        url: it.link_token
          ? `https://www.yad2.co.il/item/${it.link_token}`
          : "https://www.yad2.co.il/vehicles/cars",
        image: Array.isArray(it.images_urls) ? it.images_urls[0] : it.image_url,
        postedAt: it.date,
        live: true,
      })
    );
  }
  return listings;
}

export const yad2 = {
  id: "yad2",
  name: "יד2",
  async search(criteria) {
    try {
      const json = await fetchJson(buildUrl(criteria));
      const live = parseFeed(json).filter((l) => matchesCriteria(l, criteria));
      if (live.length > 0) {
        return { id: this.id, name: this.name, live: true, status: "ok", listings: live };
      }
      // Empty live result -> still show sample so the source isn't blank.
      const sample = yad2Sample().filter((l) => matchesCriteria(l, criteria));
      return {
        id: this.id,
        name: this.name,
        live: false,
        status: "fallback",
        message: "לא התקבלו תוצאות חיות — מוצגות דוגמאות",
        listings: sample,
      };
    } catch (err) {
      const sample = yad2Sample().filter((l) => matchesCriteria(l, criteria));
      return {
        id: this.id,
        name: this.name,
        live: false,
        status: err.status === 403 || err.status === 429 ? "blocked" : "error",
        message: `מקור חי לא זמין (${err.message}) — מוצגות דוגמאות`,
        listings: sample,
      };
    }
  },
};
