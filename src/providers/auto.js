// Auto.co.il provider.
//
// Demonstrates how easy it is to add another "known site" to the aggregator:
// implement search(criteria) returning the standard result envelope. Auto.co.il
// has no public JSON feed, so this serves labeled sample data.

import { matchesCriteria } from "../normalize.js";
import { autoSample } from "../sampleData.js";

export const auto = {
  id: "auto",
  name: "אוטו (Auto.co.il)",
  async search(criteria) {
    const sample = autoSample().filter((l) => matchesCriteria(l, criteria));
    return {
      id: this.id,
      name: this.name,
      live: false,
      status: "fallback",
      message: "אין API ציבורי — מוצגות דוגמאות",
      listings: sample,
    };
  },
};
