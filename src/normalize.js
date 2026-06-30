// Unified listing schema + helpers shared by every provider.
//
// A normalized listing looks like:
// {
//   id, source, sourceName, title, make, model, year, price, currency,
//   mileage, hand, city, fuel, gearbox, url, image, postedAt, live
// }

/** Coerce anything into a number, or null when not parseable. */
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Build a normalized listing, filling sensible defaults. */
export function makeListing(source, sourceName, data) {
  return {
    id: `${source}-${data.id}`,
    source,
    sourceName,
    title: (data.title || "").trim(),
    make: (data.make || "").trim(),
    model: (data.model || "").trim(),
    year: toNumber(data.year),
    price: toNumber(data.price),
    currency: data.currency || "₪",
    mileage: toNumber(data.mileage),
    hand: toNumber(data.hand),
    city: (data.city || "").trim(),
    fuel: (data.fuel || "").trim(),
    gearbox: (data.gearbox || "").trim(),
    url: data.url || "",
    image: data.image || "",
    postedAt: data.postedAt || null,
    live: Boolean(data.live),
  };
}

/** Normalize a Hebrew/loose string for loose matching. */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[״"'`]/g, "")
    .trim();
}

/**
 * Returns true when a listing satisfies the search criteria.
 * All criteria are optional; missing criteria never filter anything out.
 */
export function matchesCriteria(listing, criteria) {
  const hay = norm(
    [listing.title, listing.make, listing.model, listing.city].join(" ")
  );

  if (criteria.make) {
    if (!hay.includes(norm(criteria.make))) return false;
  }
  if (criteria.model) {
    if (!hay.includes(norm(criteria.model))) return false;
  }
  if (criteria.text) {
    // Every whitespace-separated token must appear somewhere.
    const tokens = norm(criteria.text).split(/\s+/).filter(Boolean);
    if (!tokens.every((t) => hay.includes(t))) return false;
  }
  if (criteria.city) {
    if (!norm(listing.city).includes(norm(criteria.city))) return false;
  }
  if (criteria.yearMin != null && listing.year != null && listing.year < criteria.yearMin) {
    return false;
  }
  if (criteria.yearMax != null && listing.year != null && listing.year > criteria.yearMax) {
    return false;
  }
  if (criteria.priceMin != null && listing.price != null && listing.price < criteria.priceMin) {
    return false;
  }
  if (criteria.priceMax != null && listing.price != null && listing.price > criteria.priceMax) {
    return false;
  }
  if (criteria.kmMax != null && listing.mileage != null && listing.mileage > criteria.kmMax) {
    return false;
  }
  if (criteria.handMax != null && listing.hand != null && listing.hand > criteria.handMax) {
    return false;
  }
  return true;
}

/**
 * Remove cross-source duplicates. The same car is often posted on several
 * sites; we collapse listings that share make/model/year/price.
 */
export function dedupe(listings) {
  const seen = new Map();
  for (const l of listings) {
    const key = [
      norm(l.make || l.title.split(" ")[0]),
      norm(l.model),
      l.year || "",
      l.price || "",
    ].join("|");
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...l, alsoOn: [] });
    } else if (existing.source !== l.source) {
      // Keep the first, but record that it also appears elsewhere.
      if (!existing.alsoOn.includes(l.sourceName)) {
        existing.alsoOn.push(l.sourceName);
      }
    }
  }
  return [...seen.values()];
}

/** Sort normalized listings by the requested key. */
export function sortListings(listings, sort) {
  const arr = [...listings];
  switch (sort) {
    case "price_asc":
      return arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price_desc":
      return arr.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    case "year_desc":
      return arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    case "km_asc":
      return arr.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity));
    default:
      return arr;
  }
}
