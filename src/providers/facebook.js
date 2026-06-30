// Facebook Marketplace provider.
//
// Marketplace requires an authenticated session and actively blocks automated
// access; there is no official public API for vehicle listings. A real
// integration would need the Graph API with the right permissions or a
// logged-in browser session. We therefore always serve labeled sample data and
// report the auth requirement honestly to the UI.

import { matchesCriteria } from "../normalize.js";
import { facebookSample } from "../sampleData.js";

export const facebook = {
  id: "facebook",
  name: "Facebook Marketplace",
  async search(criteria) {
    const sample = facebookSample().filter((l) => matchesCriteria(l, criteria));
    return {
      id: this.id,
      name: this.name,
      live: false,
      status: "auth_required",
      message: "Marketplace דורש התחברות ואינו חושף API ציבורי — מוצגות דוגמאות",
      listings: sample,
    };
  },
};
