// WinWin provider.
//
// WinWin (winwin.co.il) renders its used-car listings server-side and does not
// publish a documented JSON API. A reliable integration would require HTML
// scraping of the results page, which breaks easily and is rate-limited. We
// attempt a lightweight live probe and fall back to sample data otherwise.

import { fetchJson } from "./http.js";
import { matchesCriteria } from "../normalize.js";
import { winwinSample } from "../sampleData.js";

export const winwin = {
  id: "winwin",
  name: "WinWin",
  async search(criteria) {
    // No stable public JSON endpoint — attempt a probe, expect failure,
    // and serve labeled sample data.
    try {
      // Placeholder probe; winwin has no public feed, so this normally throws.
      await fetchJson("https://www.winwin.co.il/api/usedcar/search", { timeout: 5000 });
    } catch (err) {
      const sample = winwinSample().filter((l) => matchesCriteria(l, criteria));
      return {
        id: this.id,
        name: this.name,
        live: false,
        status: "fallback",
        message: "ל-WinWin אין API ציבורי — מוצגות דוגמאות",
        listings: sample,
      };
    }
    const sample = winwinSample().filter((l) => matchesCriteria(l, criteria));
    return { id: this.id, name: this.name, live: false, status: "fallback", listings: sample };
  },
};
