// Phase 0 cloud-relay spike — IQ4 path. THROWAWAY; do not import from product code.
//
// Goal: prove we can authenticate to a Rain Bird cloud with an account
// email/password and obtain a token we can reuse to read controllers (and,
// next, drive a zone) WITHOUT a browser or LAN access — the prerequisite for the
// serverless cron to run Rain Bird like it runs B-hyve.
//
// This targets the IQ4 cloud (iq4server.rainbird.com), the best-documented Rain
// Bird cloud (pyrainbird's cloud/ package). NOTE: IQ4 is the COMMERCIAL central-
// control platform (IQ-series satellites). A typical homeowner with an ESP-TM2/
// ESP-ME3 + LNK2 may NOT have an IQ4 account — see README.md for the consumer
// "Relay Mode" investigation path. Run this first to learn which world the test
// account lives in.
//
// Faithful port of allenporter/pyrainbird pyrainbird/cloud/client.py (OIDC
// implicit grant). Constants are from that source.
//
// Usage:
//   RB_EMAIL=you@example.com RB_PASSWORD=... node spikes/rainbird/iq4-spike.mjs
//
// Requires a REAL Rain Bird account. Until that exists this cannot pass — it is
// the gate the plan front-loads. No secrets are written anywhere; creds come
// from env and the access token is only printed (truncated).

const AUTH_BASE = "https://iq4server.rainbird.com/coreidentityserver";
const API_BASE = "https://iq4server.rainbird.com/coreapi/api";
const REDIRECT_URI = "https://iq4.rainbird.com/auth.html";
const CLIENT_ID = "C5A6F324-3CD3-4B22-9F78-B4835BA55D25";
// OIDC implicit grant. Scope is a best-guess from the app; if login fails at the
// authorize step, capture the real scope from app traffic and adjust here.
const SCOPE = "openid profile coreapi";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// --- minimal cookie jar (node fetch doesn't persist cookies across hops) -----
const jar = new Map();
function storeCookies(res) {
  // Node exposes multiple Set-Cookie via getSetCookie() on Headers.
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function baseHeaders(extra = {}) {
  const h = { "User-Agent": UA, Accept: "*/*", "Accept-Language": "en-US,en;q=0.9", ...extra };
  const c = cookieHeader();
  if (c) h.Cookie = c;
  return h;
}

function extractVerificationToken(html) {
  // Hidden input: <input name="__RequestVerificationToken" ... value="..." />
  const m =
    html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) ||
    html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/);
  if (!m) throw new Error("Could not find __RequestVerificationToken on the login page");
  return m[1];
}

async function main() {
  const email = process.env.RB_EMAIL;
  const password = process.env.RB_PASSWORD;
  if (!email || !password) {
    console.error("Set RB_EMAIL and RB_PASSWORD env vars (a real Rain Bird account).");
    process.exit(2);
  }

  // 1. Authorize endpoint -> redirects to the hosted login page (ReturnUrl).
  const state = Math.random().toString(36).slice(2);
  const nonce = Math.random().toString(36).slice(2);
  const authorizeUrl =
    `${AUTH_BASE}/connect/authorize?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token` +
    `&scope=${encodeURIComponent(SCOPE)}&state=${state}&nonce=${nonce}`;

  console.log("[1] GET authorize ->", authorizeUrl);
  let res = await fetch(authorizeUrl, { headers: baseHeaders(), redirect: "manual" });
  storeCookies(res);
  let returnUrl = "";
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") || "";
    console.log("    -> redirect", res.status, loc);
    // The login page URL carries ReturnUrl=<authorize/callback...>.
    const loginUrl = loc.startsWith("http") ? loc : AUTH_BASE + loc;
    res = await fetch(loginUrl, { headers: baseHeaders(), redirect: "manual" });
    storeCookies(res);
    returnUrl = new URL(loginUrl).searchParams.get("ReturnUrl") || "";
  }
  const loginPage = await res.text();
  const token = extractVerificationToken(loginPage);
  console.log("[2] CSRF token acquired:", token.slice(0, 12) + "…");

  // 3. POST credentials.
  const form = new URLSearchParams({
    Username: email, Password: password, ReturnUrl: returnUrl, __RequestVerificationToken: token,
  });
  console.log("[3] POST credentials …");
  res = await fetch(`${AUTH_BASE}/Account/Login?ReturnUrl=${encodeURIComponent(returnUrl)}`, {
    method: "POST",
    headers: baseHeaders({ "Content-Type": "application/x-www-form-urlencoded", Origin: AUTH_BASE }),
    body: form,
    redirect: "manual",
  });
  storeCookies(res);

  // 4. Follow the redirect chain until we hit REDIRECT_URI and capture the token.
  let accessToken = "";
  let location = res.headers.get("location") || "";
  for (let i = 0; i < 10 && location; i++) {
    const next = location.startsWith("http") ? location : AUTH_BASE + location;
    console.log(`[4.${i}] -> ${next.slice(0, 80)}…`);
    if (next.startsWith(REDIRECT_URI)) {
      const frag = new URL(next).hash.replace(/^#/, "");
      accessToken = new URLSearchParams(frag).get("access_token") || "";
      break;
    }
    res = await fetch(next, { headers: baseHeaders(), redirect: "manual" });
    storeCookies(res);
    location = res.headers.get("location") || "";
  }
  if (!accessToken) throw new Error("Login completed but no access_token was found in the redirect.");
  console.log("[5] access_token:", accessToken.slice(0, 16) + "… (len " + accessToken.length + ")");
  console.log("    >>> token-only reuse looks viable (no password needed to read).");

  // 6. Read the controllers (satellites). Proves the token works against the API.
  const listUrl = `${API_BASE}/Satellite/GetSatelliteList?includeInvisibleToCurrentUser=false`;
  console.log("[6] GET", listUrl);
  res = await fetch(listUrl, { headers: baseHeaders({ Authorization: `Bearer ${accessToken}` }) });
  console.log("    status", res.status);
  const sats = await res.json().catch(() => null);
  console.log("    satellites:", JSON.stringify(sats, null, 2)?.slice(0, 1200));

  console.log("\nNEXT: identify the run-zone endpoint (start a station for N min) and");
  console.log("confirm it accepts the Bearer token. That closes the Phase 0 gate.");
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e.message);
  console.error("This is expected without a real Rain Bird account, or if the OIDC");
  console.error("scope/response_type differ from the app — capture real traffic and adjust.");
  process.exit(1);
});
