// Shared fetch helper with a timeout and browser-like headers.
//
// Node's built-in fetch honors HTTPS_PROXY only when NODE_USE_ENV_PROXY=1
// (Node >= 22.21); src/config.js sets that automatically when a proxy exists.

import { config } from "../config.js";

const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

function headers(extra) {
  return { "User-Agent": config.userAgent, ...DEFAULT_HEADERS, ...extra };
}

export async function fetchJson(url, { timeout = config.httpTimeoutMs, headers: h = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: headers(h) });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lightweight reachability probe for diagnostics. Returns a structured result
 * instead of throwing, classifying the most common failure modes — including
 * an egress-policy denial from the agent proxy (403/407 on CONNECT).
 */
export async function probe(url, { timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: headers(),
    });
    // With a proxy in front, a 403 is the egress proxy denying CONNECT (network
    // policy), not the origin's anti-bot. Distinguish so diagnostics are honest.
    let kind = "http_error";
    if (res.status < 400) kind = "reachable";
    else if (res.status === 403) kind = config.httpsProxy ? "policy_blocked" : "blocked";
    else if (res.status === 429) kind = "blocked";
    return { ok: res.status < 400, status: res.status, kind, ms: Date.now() - started };
  } catch (err) {
    const msg = String(err?.message || err);
    let kind = "network_error";
    if (err.name === "AbortError") kind = "timeout";
    else if (/403|407|proxy|CONNECT/i.test(msg)) kind = "policy_blocked";
    else if (/ENOTFOUND|EAI_AGAIN|dns/i.test(msg)) kind = "dns_error";
    return { ok: false, status: null, kind, error: msg, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
