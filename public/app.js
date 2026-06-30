// Frontend logic.
// Primary feature: build a ready-made search link per site and show big,
// tap-friendly buttons. Secondary: an aggregated demo/live results view.

const form = document.getElementById("search-form");
const linksArea = document.getElementById("links-area");
const statusBar = document.getElementById("status-bar");
const grid = document.getElementById("results-grid");
const linksBtn = document.getElementById("links-btn");
const demoBtn = document.getElementById("demo-btn");

const MODE_LABEL = {
  native: "חיפוש מסונן",
  "site-search": "חיפוש ממוקד באתר",
};

function fmt(n) {
  return n == null ? "—" : Number(n).toLocaleString("he-IL");
}

// Collect form fields into URL query params.
function buildQuery() {
  const fd = new FormData(form);
  const params = new URLSearchParams();
  for (const key of ["make", "model", "yearMin", "yearMax", "priceMin", "priceMax", "kmMax", "handMax", "city", "text", "sort"]) {
    const v = fd.get(key);
    if (v) params.set(key, v.trim());
  }
  return params;
}

// Short human summary of the active criteria, shown above the buttons.
function criteriaSummary() {
  const fd = new FormData(form);
  const bits = [];
  if (fd.get("make")) bits.push(fd.get("make"));
  if (fd.get("model")) bits.push(fd.get("model"));
  if (fd.get("yearMin") || fd.get("yearMax")) bits.push(`${fd.get("yearMin") || ""}–${fd.get("yearMax") || ""}`);
  if (fd.get("priceMax")) bits.push(`עד ${fmt(fd.get("priceMax"))} ₪`);
  if (fd.get("kmMax")) bits.push(`עד ${fmt(fd.get("kmMax"))} ק"מ`);
  if (fd.get("city")) bits.push(fd.get("city"));
  if (fd.get("text")) bits.push(fd.get("text"));
  return bits.join(" · ") || "כל הרכבים";
}

// --- Primary: per-site search links -----------------------------------------

async function buildLinks(e) {
  if (e) e.preventDefault();
  statusBar.innerHTML = "";
  grid.innerHTML = "";
  linksBtn.disabled = true;
  linksArea.innerHTML = '<div class="loading"><div class="spinner"></div>בונה קישורים...</div>';

  try {
    const res = await fetch(`/api/links?${buildQuery().toString()}`);
    const data = await res.json();
    const buttons = data.links
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
        <h2>חיפוש מוכן — ${criteriaSummary()}</h2>
        <p class="hint">הקישו על אתר כדי לפתוח אצלו את החיפוש המסונן (נפתח בלשונית חדשה).</p>
      </div>
      <div class="site-links">${buttons}</div>`;
  } catch (err) {
    linksArea.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">בניית הקישורים נכשלה: ${err.message}</p></div>`;
  } finally {
    linksBtn.disabled = false;
  }
}

// --- Secondary: aggregated demo/live results --------------------------------

function card(l) {
  const specs = [
    l.year && `📅 ${l.year}`,
    l.mileage != null && `🛣️ ${fmt(l.mileage)} ק"מ`,
    l.hand != null && `✋ יד ${l.hand}`,
    l.gearbox,
    l.fuel,
    l.city && `📍 ${l.city}`,
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

async function runDemo() {
  demoBtn.disabled = true;
  linksArea.innerHTML = "";
  statusBar.innerHTML = "";
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>אוסף מודעות...</div>';
  try {
    const res = await fetch(`/api/search?${buildQuery().toString()}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const summary = `<span class="status-pill summary-pill">📋 ${fmt(data.total)} מודעות (דמו/חי)</span>`;
    statusBar.innerHTML =
      summary +
      data.sources
        .map(
          (s) =>
            `<span class="status-pill" title="${(s.message || "").replace(/"/g, "'")}"><span class="dot ${s.status}"></span>${s.name}: ${fmt(s.count)}</span>`
        )
        .join("");
    grid.innerHTML = data.listings.length
      ? data.listings.map(card).join("")
      : '<div class="empty-state"><p>לא נמצאו מודעות. נסו להרחיב את המאפיינים.</p></div>';
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
  } finally {
    demoBtn.disabled = false;
  }
}

form.addEventListener("submit", buildLinks);
demoBtn.addEventListener("click", runDemo);
