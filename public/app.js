// Frontend logic (runs fully in the browser — no backend required).
//
// Primary feature: build a ready-made search link per site from the user's
// criteria and show big, tap-friendly buttons. Link-building is imported from
// the shared module so the static site needs no server at all.
//
// Secondary: an aggregated demo view that calls the optional Node backend; it
// degrades gracefully (with a clear message) when the site is hosted statically.

import { buildLinks } from "./searchLinks.js";

const form = document.getElementById("search-form");
const linksArea = document.getElementById("links-area");
const statusBar = document.getElementById("status-bar");
const grid = document.getElementById("results-grid");
const linksBtn = document.getElementById("links-btn");
const demoBtn = document.getElementById("demo-btn");

const MODE_LABEL = { native: "חיפוש מסונן", "site-search": "חיפוש ממוקד באתר" };

function fmt(n) {
  return n == null ? "—" : Number(n).toLocaleString("he-IL");
}

// Collect form fields into a criteria object (numbers parsed).
function criteria() {
  const fd = new FormData(form);
  const num = (k) => {
    const v = fd.get(k);
    return v ? Number(String(v).replace(/[^\d.-]/g, "")) || undefined : undefined;
  };
  const str = (k) => (fd.get(k) ? String(fd.get(k)).trim() : undefined);
  return {
    make: str("make"), model: str("model"), text: str("text"), city: str("city"),
    yearMin: num("yearMin"), yearMax: num("yearMax"),
    priceMin: num("priceMin"), priceMax: num("priceMax"),
    kmMax: num("kmMax"), handMax: num("handMax"),
  };
}

function summary(c) {
  const bits = [];
  if (c.make) bits.push(c.make);
  if (c.model) bits.push(c.model);
  if (c.yearMin || c.yearMax) bits.push(`${c.yearMin || ""}–${c.yearMax || ""}`);
  if (c.priceMax) bits.push(`עד ${fmt(c.priceMax)} ₪`);
  if (c.kmMax) bits.push(`עד ${fmt(c.kmMax)} ק"מ`);
  if (c.city) bits.push(c.city);
  if (c.text) bits.push(c.text);
  return bits.join(" · ") || "כל הרכבים";
}

// --- Primary: per-site search links (100% client-side) ----------------------

function showLinks(e) {
  if (e) e.preventDefault();
  statusBar.innerHTML = "";
  grid.innerHTML = "";
  const c = criteria();
  const buttons = buildLinks(c)
    .map(
      (l) => `
      <a class="site-link" href="${l.url}" target="_blank" rel="noopener">
        <span class="site-icon">${l.icon || "🔎"}</span>
        <span class="site-name">${l.name}</span>
        <span class="site-mode ${l.mode}">${MODE_LABEL[l.mode] || l.mode}</span>
        <span class="site-go">פתח ↗</span>
      </a>`
    )
    .join("");
  linksArea.innerHTML = `
    <div class="links-header">
      <h2>חיפוש מוכן — ${summary(c)}</h2>
      <p class="hint">הקישו על אתר כדי לפתוח אצלו את החיפוש המסונן (נפתח בלשונית חדשה).</p>
    </div>
    <div class="site-links">${buttons}</div>`;
}

// --- Secondary: aggregated demo/live results (needs the Node backend) -------

function card(l) {
  const specs = [
    l.year && `📅 ${l.year}`,
    l.mileage != null && `🛣️ ${fmt(l.mileage)} ק"מ`,
    l.hand != null && `✋ יד ${l.hand}`,
    l.gearbox, l.fuel, l.city && `📍 ${l.city}`,
  ].filter(Boolean).map((s) => `<span>${s}</span>`).join("");
  const badge = l.live ? '<span class="badge-live">חי</span>' : '<span class="badge-sample">דוגמה</span>';
  const alsoOn = l.alsoOn && l.alsoOn.length ? `<div class="also-on">מופיע גם ב: ${l.alsoOn.join(", ")}</div>` : "";
  const img = l.image
    ? `<img class="card-img" src="${l.image}" alt="${l.title}" loading="lazy" onerror="this.style.visibility='hidden'" />`
    : '<div class="card-img"></div>';
  return `
  <article class="card">
    ${img}
    <div class="card-body">
      <h3 class="card-title">${l.title || "רכב"}</h3>
      <div class="card-price">${l.price != null ? fmt(l.price) + " ₪" : "מחיר לא צוין"}</div>
      <div class="card-specs">${specs}</div>
      ${alsoOn}
      <div class="card-footer">
        <span class="source-tag">${l.sourceName} ${badge}</span>
        <a class="card-link" href="${l.url}" target="_blank" rel="noopener">לצפייה ↗</a>
      </div>
    </div>
  </article>`;
}

function query(c) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(c)) if (v != null && v !== "") p.set(k, v);
  return p.toString();
}

async function runDemo() {
  demoBtn.disabled = true;
  linksArea.innerHTML = "";
  statusBar.innerHTML = "";
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>אוסף מודעות...</div>';
  try {
    const res = await fetch(`api/search?${query(criteria())}`);
    if (!res.ok) throw new Error("no-backend");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    statusBar.innerHTML =
      `<span class="status-pill summary-pill">📋 ${fmt(data.total)} מודעות (דמו/חי)</span>` +
      data.sources
        .map((s) => `<span class="status-pill"><span class="dot ${s.status}"></span>${s.name}: ${fmt(s.count)}</span>`)
        .join("");
    grid.innerHTML = data.listings.length
      ? data.listings.map(card).join("")
      : '<div class="empty-state"><p>לא נמצאו מודעות. נסו להרחיב את המאפיינים.</p></div>';
  } catch {
    grid.innerHTML =
      '<div class="empty-state"><p>התצוגה המאוחדת זמינה רק בהרצה עם שרת (Node).<br>' +
      'בגרסה הסטטית השתמשו ב<strong>כפתורי החיפוש</strong> שלמעלה — הם פותחים את האתרים האמיתיים.</p></div>';
  } finally {
    demoBtn.disabled = false;
  }
}

form.addEventListener("submit", showLinks);
demoBtn.addEventListener("click", runDemo);
