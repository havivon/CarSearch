// Zero-dependency HTTP server: serves the static UI and the /api/search endpoint.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { search, listSources } from "./src/aggregator.js";
import { toNumber } from "./src/normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

/** Turn raw query params into normalized search criteria. */
function parseCriteria(params) {
  return {
    make: params.get("make") || undefined,
    model: params.get("model") || undefined,
    text: params.get("text") || undefined,
    city: params.get("city") || undefined,
    yearMin: toNumber(params.get("yearMin")),
    yearMax: toNumber(params.get("yearMax")),
    priceMin: toNumber(params.get("priceMin")),
    priceMax: toNumber(params.get("priceMax")),
    kmMax: toNumber(params.get("kmMax")),
    handMax: toNumber(params.get("handMax")),
  };
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  // Prevent path traversal.
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/sources") {
    return sendJson(res, 200, { sources: listSources() });
  }

  if (url.pathname === "/api/search") {
    try {
      const criteria = parseCriteria(url.searchParams);
      const sourcesParam = url.searchParams.get("sources");
      const sourceIds = sourcesParam ? sourcesParam.split(",").filter(Boolean) : [];
      const sort = url.searchParams.get("sort") || "price_asc";
      const result = await search(criteria, sourceIds, sort);
      return sendJson(res, 200, { query: criteria, ...result });
    } catch (err) {
      return sendJson(res, 500, { error: String(err.message || err) });
    }
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`CarSearch aggregator running on http://localhost:${PORT}`);
});
