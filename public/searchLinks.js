// Search-link builder — shared by the browser (static site) and the Node server.
//
// Pure functions, no platform APIs, so the SAME file runs in both places:
// the static GitHub Pages site imports it in the browser, and src/searchLinks.js
// re-exports it for the optional Node backend.
//
// Instead of scraping (fragile, blocked, against ToS), we turn the user's
// criteria into a ready-made search URL per site. One tap opens that site's
// real, filtered results. Native filter format where known; otherwise a
// Google site-scoped search, which works for any site and any make.

// Numeric manufacturer ids used by Yad2's native car search.
const YAD2_MAKE_IDS = {
  "מאזדה": 27, mazda: 27, "טויוטה": 40, toyota: 40, "יונדאי": 21, hyundai: 21,
  "קיה": 48, kia: 48, "סקודה": 38, skoda: 38, "פולקסווגן": 41, volkswagen: 41,
  "מיצובישי": 30, mitsubishi: 30, "ניסאן": 32, nissan: 32, "הונדה": 19, honda: 19,
  "סוזוקי": 39, suzuki: 39, "מרצדס": 31, mercedes: 31, "ב.מ.וו": 25, bmw: 25,
  "אאודי": 23, audi: 23, "פורד": 17, ford: 17, "שברולט": 7, chevrolet: 7,
  "פיג'ו": 33, peugeot: 33, "רנו": 36, renault: 36, "סיטרואן": 9, citroen: 9,
};

function clean(s) {
  return String(s == null ? "" : s).trim();
}

function terms(c) {
  return [clean(c.make), clean(c.model), clean(c.text)].filter(Boolean).join(" ").trim();
}

/** Google search scoped to a single domain — the universal "always works" mode. */
function siteSearch(domain, c) {
  const yearStr =
    c.yearMin && c.yearMax ? `${c.yearMin}-${c.yearMax}` : clean(c.yearMin || c.yearMax);
  const q =
    [`site:${domain}`, terms(c), yearStr, clean(c.city)].filter(Boolean).join(" ").trim() ||
    `site:${domain} רכב יד שנייה`;
  return { url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, mode: "site-search" };
}

// ---- Native deep-links (known filter formats) ------------------------------

function yad2(c) {
  const id = YAD2_MAKE_IDS[clean(c.make).toLowerCase()];
  if (!id) return siteSearch("yad2.co.il", c); // unknown make -> reliable fallback
  const p = new URLSearchParams();
  p.set("manufacturer", String(id));
  if (c.yearMin || c.yearMax) p.set("year", `${c.yearMin || 1990}-${c.yearMax || 2026}`);
  if (c.priceMin || c.priceMax) p.set("price", `${c.priceMin || 0}-${c.priceMax || 9999999}`);
  if (c.kmMax) p.set("km", `0-${c.kmMax}`);
  if (c.handMax) p.set("hand", `0-${c.handMax}`);
  return { url: `https://www.yad2.co.il/vehicles/cars?${p.toString()}`, mode: "native" };
}

function facebook(c) {
  const p = new URLSearchParams();
  const q = terms(c);
  if (q) p.set("query", q);
  if (c.priceMin) p.set("minPrice", String(c.priceMin));
  if (c.priceMax) p.set("maxPrice", String(c.priceMax));
  if (c.yearMin) p.set("minYear", String(c.yearMin));
  if (c.yearMax) p.set("maxYear", String(c.yearMax));
  if (c.kmMax) p.set("maxMileage", String(c.kmMax));
  const qs = p.toString();
  return {
    url: `https://www.facebook.com/marketplace/category/vehicles${qs ? "?" + qs : ""}`,
    mode: "native",
  };
}

// Registry of sites. Add a site by appending one entry.
const SITES = [
  { id: "yad2", name: "יד2", icon: "🚗", build: yad2 },
  { id: "facebook", name: "Facebook Marketplace", icon: "📘", build: facebook },
  { id: "winwin", name: "WinWin", icon: "🏷️", build: (c) => siteSearch("winwin.co.il", c) },
  { id: "auto", name: "אוטו (Auto.co.il)", icon: "🅰️", build: (c) => siteSearch("auto.co.il", c) },
  { id: "walla", name: "וואלה! רכב", icon: "🚙", build: (c) => siteSearch("cars.walla.co.il", c) },
  { id: "icar", name: "iCar", icon: "🔑", build: (c) => siteSearch("icar.co.il", c) },
];

/** Build a ready-to-open search link for every registered site. */
export function buildLinks(criteria) {
  return SITES.map((s) => {
    const { url, mode } = s.build(criteria);
    return { id: s.id, name: s.name, icon: s.icon, url, mode };
  });
}

export function listSiteIds() {
  return SITES.map((s) => s.id);
}
