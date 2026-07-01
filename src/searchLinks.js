// The link-building logic lives in public/searchLinks.js so the SAME file is
// served to the static GitHub Pages site and imported by this Node backend.
// This keeps one source of truth for the per-site search URLs.

export { buildLinks, listSiteIds } from "../public/searchLinks.js";
