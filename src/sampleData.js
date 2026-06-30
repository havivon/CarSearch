// Realistic Israeli used-car sample data.
//
// This is the fallback that keeps the product fully usable when a live
// source is blocked (anti-bot, login walls, network policy). Every listing
// is flagged `live: false` so the UI can label it clearly as demo data.

import { makeListing } from "./normalize.js";

const CITIES = [
  "תל אביב", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "באר שבע",
  "נתניה", "אשדוד", "רמת גן", "הרצליה", "רעננה", "חולון", "כפר סבא", "מודיעין",
];

const FUELS = ["בנזין", "דיזל", "היברידי", "חשמלי"];
const GEARBOXES = ["אוטומט", "ידני", "רובוטית", "טיפטרוניק"];

// Model catalog: make (Hebrew + English aliases baked into title), models.
const CATALOG = [
  { make: "מאזדה", en: "Mazda", models: ["3", "2", "6", "CX-5", "CX-30"] },
  { make: "טויוטה", en: "Toyota", models: ["קורולה", "יאריס", "RAV4", "C-HR", "אוריס"] },
  { make: "יונדאי", en: "Hyundai", models: ["i10", "i20", "i25", "טוסון", "קונה"] },
  { make: "קיה", en: "Kia", models: ["פיקנטו", "ריו", "ספורטאז'", "סיד", "נירו"] },
  { make: "סקודה", en: "Skoda", models: ["אוקטביה", "פאביה", "קודיאק", "סקאלה"] },
  { make: "פולקסווגן", en: "Volkswagen", models: ["גולף", "פולו", "טיגואן", "פאסאט"] },
  { make: "מיצובישי", en: "Mitsubishi", models: ["אאוטלנדר", "ASX", "ספייס סטאר"] },
  { make: "ניסאן", en: "Nissan", models: ["קשקאי", "מיקרה", "ג'וק", "ליף"] },
  { make: "הונדה", en: "Honda", models: ["סיוויק", "ג'אז", "CR-V"] },
  { make: "סוזוקי", en: "Suzuki", models: ["סוויפט", "ויטרה", "באלנו", "אש קרוס"] },
];

// Simple seeded PRNG so the sample pool is stable between requests.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Rough price model: newer + fewer km => more expensive.
function estimatePrice(rng, year) {
  const age = 2026 - year;
  const base = 175000 - age * 13000;
  const noise = Math.floor((rng() - 0.5) * 20000);
  return Math.max(18000, Math.round((base + noise) / 500) * 500);
}

/**
 * Build a deterministic pool of listings for a single source.
 * Each source gets a different seed so the pools differ.
 */
function buildPool(source, sourceName, seed, count, urlBuilder) {
  const rng = mulberry32(seed);
  const listings = [];
  for (let i = 0; i < count; i++) {
    const cat = pick(rng, CATALOG);
    const model = pick(rng, cat.models);
    const year = 2008 + Math.floor(rng() * 18); // 2008..2025
    const hand = 1 + Math.floor(rng() * 4);
    const mileage = Math.round((20000 + rng() * 200000) / 1000) * 1000;
    const price = estimatePrice(rng, year);
    const city = pick(rng, CITIES);
    const id = `${seed}${i}`;
    listings.push(
      makeListing(source, sourceName, {
        id,
        title: `${cat.make} ${model} ${year}`,
        make: cat.make,
        model,
        year,
        price,
        mileage,
        hand,
        city,
        fuel: pick(rng, FUELS),
        gearbox: pick(rng, GEARBOXES),
        url: urlBuilder(id, cat.en, model),
        image: `https://picsum.photos/seed/${source}${id}/400/300`,
        postedAt: new Date(Date.now() - Math.floor(rng() * 21) * 86400000).toISOString(),
        live: false,
      })
    );
  }
  return listings;
}

export function yad2Sample() {
  return buildPool("yad2", "יד2", 101, 22, (id) => `https://www.yad2.co.il/vehicles/cars`);
}

export function winwinSample() {
  return buildPool("winwin", "WinWin", 202, 16, (id) => `https://www.winwin.co.il/usedcar`);
}

export function facebookSample() {
  return buildPool("facebook", "Facebook Marketplace", 303, 14, (id) => `https://www.facebook.com/marketplace/category/vehicles`);
}

export function autoSample() {
  return buildPool("auto", "אוטו (Auto.co.il)", 404, 12, (id) => `https://www.auto.co.il`);
}
