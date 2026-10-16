// Ruling 74's composer budget, measured rather than estimated.
//
// The composer gives DIA 3.5 s (`THINK_BUDGET` in src/components/strand/Composer.tsx) and the
// dia-compose-read function aborts its own Anthropic call at 3.4 s (`THINK_BUDGET_MS`). This arm
// measures what the call actually costs on the deployed path: the member's own JWT against the
// deployed function the deployed app calls, one request at a time, the way the composer fires one
// inference per debounce.
//
// Two numbers per call, because the two budgets bound different spans:
//   server_ms  the function's own `latency_ms`, measured inside the function from the first line of
//              the handler to the parsed response, so it is the Anthropic call plus a few ms of
//              parse and rate-limit work. This is what the 3.4 s abort bounds.
//   client_ms  wall time of the HTTP request from this runner, so it carries the runner-to-edge leg
//              on top. This is what the browser's 3.5 s budget bounds, from a different client.
//
// It is a measurement and not a gate: an over-budget percentile is reported as a number, never as a
// failure, because tuning the budget is a ruling and not this arm's business. It exits non-zero only
// when it could not measure at all, which under ruling 228 is unproven rather than passing.
//
// Env: BASE (deployed URL, verified to point at the project being measured), MEMBER_EMAIL /
// MEMBER_PASSWORD or OWNER_EMAIL / OWNER_PASSWORD, N (default 80), SPACING_MS (default 2500, which
// keeps the sample under the function's 30-per-minute per-session cap), OUT (optional directory for
// the JSON record).
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE || "").replace(/\/$/, "");
const N = Number(process.env.N || 80);
const SPACING_MS = Number(process.env.SPACING_MS || 2500);
const OUT = process.env.OUT || "";

// Same resolution as tests/live-checks.cjs: the env wins, otherwise the values the app itself ships.
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "supabase.ts"), "utf8");
const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  (appSource.match(/"(https:\/\/[a-z0-9.-]+)"/) || [])[1] ||
  ""
).replace(/\/$/, "");
const PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  (appSource.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1] ||
  "";

const EMAIL = process.env.MEMBER_EMAIL || process.env.OWNER_EMAIL;
const PASSWORD = process.env.MEMBER_PASSWORD || process.env.OWNER_PASSWORD;

// Realistic composer drafts, one per line of work a member actually types. All four verbs are
// represented so most calls clear the 0.6 confidence floor and carry the function's own latency_ms;
// a call that returns null is still timed on the client side and still reported.
const DRAFTS = [
  "Hosting a diaspora founders dinner in Accra on Thu 16 Oct at 19:00 at Villa Monticello. Tickets are 250 cedis, and we are streaming the panel for people who cannot make it in person.",
  "Starting a working group on remittance rails for small merchants. Looking for two engineers, a compliance lead and someone who has shipped mobile money before.",
  "I need a venue in Lagos for a 40-person workshop on 12 November. Anyone with a space they can lend for an afternoon, or a contact at a coworking place, would help enormously.",
  "Wrote up what six months of hiring in Nairobi taught me about pay bands, and why the offer we lost taught us more than the ones we won.",
  "Running a Saturday morning mentoring call for first-time founders, 09:00 on Zoom, free, every fortnight until December.",
  "Putting together a cohort of operators working on cold chain logistics across West Africa. Want to build the playbook together rather than each of us learning it twice.",
  "Looking for a pro bono trademark lawyer who knows Ghana and Nigeria filings. A couple of hours of advice would unblock us by the end of the month.",
  "A short account of the day our first hardware batch cleared customs in Tema, and what the eight weeks before it cost us.",
  "Convening a panel on diaspora capital at the Lagos office on 3 Dec, 18:30, hybrid so the London folks can join. Paid tickets, capped at 80 seats.",
  "Starting a Space for African language NLP. Category is research, and I am after linguists, data engineers and anyone with annotated corpora to share.",
  "We need 15 volunteers for the Accra beach clean on 22 November, three hours each, and two people with vans for the collected waste. By 15 November please.",
  "Sharing the lessons from shutting down our second product line, written plainly, because the write-ups I needed when we did it did not exist.",
];

const results = [];
const notes = [];

function record(line) {
  notes.push(line);
  console.log(line);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Nearest-rank percentile on an ascending sample: the smallest value at or above the p-th rank. */
function pct(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  return {
    n: s.length,
    min: s.length ? s[0] : null,
    p50: pct(s, 0.5),
    p90: pct(s, 0.9),
    p95: pct(s, 0.95),
    p99: pct(s, 0.99),
    max: s.length ? s[s.length - 1] : null,
    mean: mean === null ? null : Math.round(mean),
  };
}

/** The deployed build must name the project this arm measures, or the sample is of something else. */
async function confirmDeployedEndpoint() {
  if (!BASE) {
    record(
      "endpoint: BASE is unset, so the deployed build was not read. Measuring " + SUPABASE_URL,
    );
    return false;
  }
  const res = await fetch(BASE + "/sign-in", { redirect: "follow" });
  const html = await res.text();
  record(`endpoint: GET ${BASE}/sign-in -> ${res.status}`);
  if (!res.ok) return false;
  if (html.includes(SUPABASE_URL)) {
    record(`endpoint: the served HTML carries ${SUPABASE_URL}`);
    return true;
  }
  // The entry script does not carry the client, it imports it: the project URL lives in a lazily
  // imported chunk two hops down the graph, which is why reading only the <script src> tags of the
  // served HTML reported "not found" for a build that plainly carries it. So walk the graph, breadth
  // first and bounded, seeded from every module the document names.
  const seeds = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) seeds.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g))
    seeds.add(m[1]);
  for (const m of html.matchAll(/["'(]([^"'()\s]*\/[\w.-]+\.m?js)["')]/g)) seeds.add(m[1]);

  const absolute = (ref, from) => {
    if (ref.startsWith("http")) return ref;
    if (ref.startsWith("/")) return BASE + ref;
    const dir = from.slice(0, from.lastIndexOf("/") + 1);
    return new URL(ref, dir).toString();
  };

  const queue = [...seeds].map((s) => absolute(s, BASE + "/"));
  const seen = new Set();
  const CAP = 40;
  while (queue.length && seen.size < CAP) {
    const url = queue.shift();
    if (!url.startsWith(BASE) || seen.has(url)) continue;
    seen.add(url);
    const js = await fetch(url).then((r) => (r.ok ? r.text() : ""));
    if (!js) continue;
    if (js.includes(SUPABASE_URL)) {
      record(
        `endpoint: ${url.replace(BASE, "")} carries ${SUPABASE_URL} (${seen.size} modules read)`,
      );
      if (js.includes(PUBLISHABLE_KEY)) record("endpoint: and the same publishable key");
      return true;
    }
    for (const m of js.matchAll(/["'(]([^"'()\s]*[\w.-]+\.m?js)["')]/g)) {
      queue.push(absolute(m[1], url));
    }
  }
  record(
    `endpoint: ${SUPABASE_URL} was not found in ${seen.size} modules reached from the document`,
  );
  return false;
}

async function signIn() {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.access_token) {
    record(
      `sign-in: FAILED ${res.status} ${body && body.error_description ? body.error_description : ""}`,
    );
    return null;
  }
  record(
    `sign-in: ${EMAIL} signed in, token for sub ${String(body.user && body.user.id).slice(0, 8)}…`,
  );
  return body.access_token;
}

async function main() {
  record("=== ruling 74: the composer's Anthropic call, measured on the deployed path ===");
  record(`target: ${SUPABASE_URL}/functions/v1/dia-compose-read`);
  record(
    `sample: N=${N}, sequential, ${SPACING_MS}ms apart (the function caps 30 per minute per session)`,
  );

  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    record("UNPROVEN: no project URL or publishable key could be resolved (ruling 228).");
    process.exit(1);
  }
  const endpointConfirmed = await confirmDeployedEndpoint();

  if (!EMAIL || !PASSWORD) {
    record(
      "UNPROVEN: set MEMBER_EMAIL and MEMBER_PASSWORD (or OWNER_*); the function verifies the JWT (ruling 228).",
    );
    process.exit(1);
  }
  const token = await signIn();
  if (!token) {
    record("UNPROVEN: could not sign in, so no call was made (ruling 228).");
    process.exit(1);
  }

  const url = SUPABASE_URL + "/functions/v1/dia-compose-read";
  let headersDumped = false;
  const regions = new Set();

  for (let i = 0; i < N; i++) {
    const text = DRAFTS[i % DRAFTS.length];
    const t0 = process.hrtime.bigint();
    let res = null;
    let body = null;
    let err = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          apikey: PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      body = await res.json().catch(() => null);
    } catch (e) {
      err = e && e.message ? e.message : String(e);
    }
    const clientMs = Number((process.hrtime.bigint() - t0) / 1000000n);

    if (res && !headersDumped) {
      headersDumped = true;
      record("response headers on the first call:");
      for (const [k, v] of res.headers) record(`  ${k}: ${v}`);
    }
    // Supabase names the executing edge region in its own headers; keep every spelling it may use.
    if (res) {
      for (const k of [
        "x-sb-edge-region",
        "sb-edge-region",
        "x-sb-region",
        "x-served-by",
        "x-deno-ray",
      ]) {
        const v = res.headers.get(k);
        if (v) regions.add(`${k}=${v}`);
      }
    }

    const serverMs =
      body && typeof body === "object" && typeof body.latency_ms === "number"
        ? body.latency_ms
        : null;
    let kind;
    if (err) kind = "transport_error";
    else if (!res.ok) kind = "http_" + res.status;
    else if (serverMs !== null) kind = "inference";
    else if (clientMs >= 3300)
      kind = "null_at_budget"; // the function's 3.4 s abort
    else if (clientMs < 300)
      kind = "null_immediate"; // rate limited, or refused before the call
    else kind = "null_fast"; // answered, but below the confidence floor or verb null

    results.push({
      i: i + 1,
      kind,
      client_ms: clientMs,
      server_ms: serverMs,
      verb: body && body.verb ? body.verb : null,
      confidence: body && typeof body.confidence === "number" ? body.confidence : null,
      status: res ? res.status : null,
      error: err,
    });
    console.log(
      `call ${String(i + 1).padStart(3)}  ${kind.padEnd(14)}  client ${String(clientMs).padStart(5)}ms  server ${
        serverMs === null ? "    -" : String(serverMs).padStart(5)
      }ms  ${body && body.verb ? body.verb : ""}`,
    );
    if (i < N - 1) await sleep(SPACING_MS);
  }

  const byKind = {};
  for (const r of results) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const serverAll = results.filter((r) => r.server_ms !== null).map((r) => r.server_ms);
  const clientAll = results.filter((r) => r.kind === "inference").map((r) => r.client_ms);
  const serverWarm = results.filter((r) => r.server_ms !== null && r.i > 1).map((r) => r.server_ms);

  const report = {
    target: url,
    deployed_base: BASE || null,
    deployed_endpoint_confirmed: endpointConfirmed,
    requested: N,
    spacing_ms: SPACING_MS,
    by_kind: byKind,
    regions: [...regions],
    server_ms: stats(serverAll),
    server_ms_excluding_first_call: stats(serverWarm),
    client_ms_inference_calls: stats(clientAll),
    over_server_budget_3400: serverAll.filter((v) => v >= 3400).length,
    over_client_budget_3500: results.filter((r) => r.client_ms >= 3500).length,
    percentile_method: "nearest rank, ascending sample",
    calls: results,
  };

  record("");
  record("=== REPORT (ruling 74) ===");
  record(`calls: ${results.length} requested ${N}; ${JSON.stringify(byKind)}`);
  record(`region: ${regions.size ? [...regions].join(", ") : "no region header on the response"}`);
  const s = report.server_ms;
  record(
    `server latency_ms (n=${s.n}): p50 ${s.p50}  p95 ${s.p95}  p90 ${s.p90}  p99 ${s.p99}  min ${s.min}  max ${s.max}  mean ${s.mean}`,
  );
  const w = report.server_ms_excluding_first_call;
  record(
    `server latency_ms without the first call (n=${w.n}): p50 ${w.p50}  p95 ${w.p95}  max ${w.max}`,
  );
  const c = report.client_ms_inference_calls;
  record(
    `client wall ms, inference calls (n=${c.n}): p50 ${c.p50}  p95 ${c.p95}  p90 ${c.p90}  p99 ${c.p99}  min ${c.min}  max ${c.max}  mean ${c.mean}`,
  );
  record(`over the function's 3400ms abort: ${report.over_server_budget_3400} of ${s.n}`);
  record(
    `over the composer's 3500ms budget, client wall: ${report.over_client_budget_3500} of ${results.length}`,
  );

  if (!serverAll.length) {
    record(
      "UNPROVEN: no call returned an inference, so no server-side latency was measured (ruling 228).",
    );
  }

  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "dia-latency.json"), JSON.stringify(report, null, 2));
    record(`record: ${path.join(OUT, "dia-latency.json")}`);
  }

  process.exit(serverAll.length ? 0 : 1);
}

main().catch((e) => {
  console.error("UNPROVEN: the arm threw before it could report (ruling 228).", e);
  process.exit(1);
});
