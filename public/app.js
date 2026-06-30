// Frontend logic: load sources, run searches, render results.

const form = document.getElementById("search-form");
const sourceList = document.getElementById("source-list");
const statusBar = document.getElementById("status-bar");
const grid = document.getElementById("results-grid");
const searchBtn = document.getElementById("search-btn");

const STATUS_LABEL = {
  ok: "חי",
  fallback: "דוגמה",
  blocked: "חסום",
  error: "שגיאה",
  auth_required: "דורש התחברות",
};

// Load the available sources and render checkboxes (all checked by default).
async function loadSources() {
  try {
    const res = await fetch("/api/sources");
    const { sources } = await res.json();
    sourceList.innerHTML = sources
      .map(
        (s) => `
      <label class="source-item">
        <input type="checkbox" name="source" value="${s.id}" checked />
        ${s.name}
      </label>`
      )
      .join("");
  } catch {
    sourceList.innerHTML = '<p style="color:var(--danger)">טעינת מקורות נכשלה</p>';
  }
}

function fmt(n) {
  return n == null ? "—" : Number(n).toLocaleString("he-IL");
}

function buildQuery() {
  const fd = new FormData(form);
  const params = new URLSearchParams();
  for (const key of ["make", "model", "yearMin", "yearMax", "priceMin", "priceMax", "kmMax", "handMax", "city", "text", "sort"]) {
    const v = fd.get(key);
    if (v) params.set(key, v);
  }
  const sources = fd.getAll("source");
  if (sources.length) params.set("sources", sources.join(","));
  return params;
}

function renderStatus(data) {
  const summary = `<span class="status-pill summary-pill">📋 ${fmt(data.total)} מודעות (${fmt(data.rawTotal)} לפני איחוד כפילויות)</span>`;
  const pills = data.sources
    .map((s) => {
      const label = STATUS_LABEL[s.status] || s.status;
      const title = s.message ? ` title="${s.message.replace(/"/g, "'")}"` : "";
      return `<span class="status-pill"${title}>
        <span class="dot ${s.status}"></span>${s.name}: ${fmt(s.count)} · ${label}
      </span>`;
    })
    .join("");
  statusBar.innerHTML = summary + pills;
}

function card(l) {
  const specs = [
    l.year && `📅 ${l.year}`,
    l.mileage != null && `🛣️ ${fmt(l.mileage)} ק"מ`,
    l.hand != null && `✋ יד ${l.hand}`,
    l.gearbox,
    l.fuel,
    l.city && `📍 ${l.city}`,
  ]
    .filter(Boolean)
    .map((s) => `<span>${s}</span>`)
    .join("");

  const badge = l.live
    ? '<span class="badge-live">חי</span>'
    : '<span class="badge-sample">דוגמה</span>';

  const alsoOn =
    l.alsoOn && l.alsoOn.length
      ? `<div class="also-on">מופיע גם ב: ${l.alsoOn.join(", ")}</div>`
      : "";

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

function renderResults(data) {
  if (!data.listings.length) {
    grid.innerHTML = '<div class="empty-state"><p>לא נמצאו מודעות שתואמות את החיפוש. נסו להרחיב את המאפיינים.</p></div>';
    return;
  }
  grid.innerHTML = data.listings.map(card).join("");
}

async function runSearch(e) {
  e.preventDefault();
  searchBtn.disabled = true;
  searchBtn.textContent = "מחפש...";
  statusBar.innerHTML = "";
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>אוסף מודעות מכל האתרים...</div>';

  try {
    const res = await fetch(`/api/search?${buildQuery().toString()}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderStatus(data);
    renderResults(data);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">החיפוש נכשל: ${err.message}</p></div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "🔎 חפש בכל האתרים";
  }
}

// --- Connectivity diagnostics ------------------------------------------------

const healthBtn = document.getElementById("health-btn");
const healthPanel = document.getElementById("health-panel");

const KIND_LABEL = {
  reachable: "✅ נגיש",
  blocked: "🚫 חסום (אנטי-בוט)",
  policy_blocked: "🔒 חסום ע\"י מדיניות הרשת",
  timeout: "⏱️ פסק זמן",
  dns_error: "❓ DNS",
  http_error: "⚠️ שגיאת HTTP",
  network_error: "📡 שגיאת רשת",
  no_endpoint: "—",
};

async function checkHealth() {
  healthPanel.hidden = false;
  healthPanel.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch("/api/health");
    const h = await res.json();
    const rows = h.sources
      .map((s) => {
        const label = KIND_LABEL[s.kind] || s.kind;
        const live = s.liveEnabled ? "מצב חי פעיל" : "דוגמאות";
        return `<div class="health-row">${s.name}: ${label} <span style="color:var(--muted)">· ${live}${s.ms != null ? " · " + s.ms + "ms" : ""}</span></div>`;
      })
      .join("");
    healthPanel.innerHTML = `
      <h3>בדיקת חיבור למקורות</h3>
      ${rows}
      <div class="health-meta">
        מנוע דפדפן (Playwright): ${h.browserEngine ? "✅ זמין" : "❌ לא מותקן"}<br>
        מנוע יד2: ${h.yad2Engine} · פרוקסי: ${h.proxy}<br>
        ${h.sources.some((s) => s.kind === "policy_blocked")
          ? '<strong style="color:var(--warn)">אתרים חסומים ע"י מדיניות הרשת של הסביבה — מודעות חיות יעבדו בהרצה מקומית או בסביבה שמתירה את הדומיינים.</strong>'
          : ""}
      </div>`;
  } catch (err) {
    healthPanel.innerHTML = `<span style="color:var(--danger)">בדיקת חיבור נכשלה: ${err.message}</span>`;
  }
}

healthBtn.addEventListener("click", checkHealth);
form.addEventListener("submit", runSearch);
loadSources();
