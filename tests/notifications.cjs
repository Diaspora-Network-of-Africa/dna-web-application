// The notification contract in the source (handoff 55-A; rulings 1318, 1319, 490, 194). Static: it
// needs no browser and no deployment, because what it enforces is a source contract. The database
// half (the one writer, the policies, the dot) is proved by the live arms in tests/live-db.cjs.
//
// The kind vocabulary is public.notification_kinds, seeded by migration and served by vocabularies()
// (1318). So the kinds this check knows are read out of the migrations' own seed, never listed here.
//
// Three arms, each as the handoff names it:
//   sentence   every kind the seed marks renders has a sentence in the row part's parts(), so no row
//              the database renders reads blank (and none renders without its destination words);
//   writer     no file in src/ or supabase/functions/ writes public.notifications directly: no
//              insert, upsert or delete through the client, no SQL insert, and the one client update
//              sets read_at alone (the member's own column grant; markRead). Rows are written by
//              private.notify inside each engine's write function (1319);
//   no array   no client array or object of notification kinds exists in src/: the kinds are the
//              vocabulary's, and NOTIFICATION_REGISTRY, KIND_C and DESTINATION are gone (N4).
//
// Usage: node tests/notifications.cjs
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const ROW = "src/components/strand/NotificationListItem.tsx";
const MIGRATIONS = "supabase/migrations";

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Every file under a directory, relative to the root, filtered by extension. */
function walk(rel, exts) {
  const out = [];
  const visit = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  };
  visit(rel);
  return out;
}

/**
 * The row part's module exports. React and the sibling modules are stubbed because parts() is plain
 * data and the component itself never runs.
 */
function loadRow() {
  const { outputText } = ts.transpileModule(read(ROW), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: ROW,
  });
  const stub = new Proxy({}, { get: (_t, key) => (key === "__esModule" ? true : () => null) });
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    { module, exports: module.exports, require: () => stub },
    { filename: ROW },
  );
  return module.exports;
}

/**
 * The seed: every `insert into public.notification_kinds (...) values (...)` in the migrations, in
 * version order, a later row for a kind replacing an earlier one. Returns [{ kind, renders,
 * destination }] or null when no seed is found.
 */
function seededKinds() {
  const files = fs
    .readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => /^\d{14}_.*\.sql$/.test(f))
    .sort();
  const kinds = new Map();
  let found = false;
  for (const f of files) {
    const sql = read(path.join(MIGRATIONS, f));
    const re = /insert\s+into\s+public\.notification_kinds\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi;
    let m;
    while ((m = re.exec(sql))) {
      found = true;
      const cols = m[1].split(",").map((c) => c.trim());
      const tuples = m[2].match(/\((?:[^()']|'(?:[^']|'')*')*\)/g) || [];
      for (const t of tuples) {
        const vals = [...t.slice(1, -1).matchAll(/\s*('(?:[^']|'')*'|[^,]+)\s*(?:,|$)/g)].map((v) =>
          v[1].trim(),
        );
        const at = (col) => vals[cols.indexOf(col)];
        const str = (v) => (v && v.startsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : null);
        const kind = str(at("kind"));
        if (!kind) continue;
        kinds.set(kind, {
          kind,
          renders: at("renders") === "true",
          destination: str(at("destination")),
        });
      }
    }
  }
  return found ? [...kinds.values()] : null;
}

// sentence -----------------------------------------------------------------------------------------
const row = loadRow();
const seed = seededKinds();
record("sentence: the row part exports hasSentence", typeof row.hasSentence === "function");
if (!seed) {
  record("sentence: the notification_kinds seed is read from the migrations", false);
} else {
  record(
    "sentence: the notification_kinds seed is read from the migrations",
    seed.length > 0,
    seed.map((k) => k.kind + (k.renders ? "*" : "")).join(", ") + "  (* renders)",
  );
  for (const k of seed.filter((x) => x.renders)) {
    record(
      `sentence: ${k.kind} renders and has a sentence in parts()`,
      typeof row.hasSentence === "function" && row.hasSentence(k.kind) === true,
    );
    record(
      `sentence: ${k.kind} renders with its destination in words (490)`,
      typeof k.destination === "string" && k.destination.trim() !== "",
      String(k.destination),
    );
  }
  for (const k of seed.filter((x) => !x.renders))
    console.log(`  held (renders false in the seed): ${k.kind}`);
}

// writer -------------------------------------------------------------------------------------------
const sources = [...walk("src", [".ts", ".tsx"]), ...walk("supabase/functions", [".ts"])].filter(
  (f) => !f.endsWith("database.types.ts"),
);
const writes = [];
const updates = [];
for (const f of sources) {
  const text = read(f);
  if (/insert\s+into\s+(public\.)?notifications\b/i.test(text)) writes.push(f + " (SQL insert)");
  const re = /\.from\(\s*["']notifications["']\s*\)([\s\S]{0,200})/g;
  let m;
  while ((m = re.exec(text))) {
    const chain = m[1];
    const verb = /^\s*\.(insert|upsert|delete|update)\s*\(/.exec(chain);
    if (!verb) continue;
    if (verb[1] !== "update") writes.push(f + " (." + verb[1] + ")");
    else {
      const arg = /^\s*\.update\(\s*\{([^}]*)\}/.exec(chain);
      const keys = arg
        ? arg[1]
            .split(",")
            .map((x) => x.split(":")[0].trim())
            .filter(Boolean)
        : [];
      updates.push(f);
      if (keys.join(",") !== "read_at")
        writes.push(f + " (.update of " + (keys.join(",") || "?") + ")");
    }
  }
}
record(
  "writer: no file in src/ or supabase/functions/ inserts, upserts or deletes notifications, and the one client update sets read_at alone",
  writes.length === 0,
  writes.length ? writes.join("; ") : "read_at updates: " + (updates.join(", ") || "none"),
);

// no array -----------------------------------------------------------------------------------------
const kindNames = (seed || []).map((k) => k.kind);
const clientFiles = walk("src", [".ts", ".tsx"]).filter((f) => !f.endsWith("database.types.ts"));
const arrays = [];
const retired = [];
for (const f of clientFiles) {
  const text = read(f);
  for (const name of ["NOTIFICATION_REGISTRY", "KIND_C", "DESTINATION"])
    if (new RegExp("\\b" + name + "\\b").test(text)) retired.push(f + ": " + name);
  if (kindNames.length < 2) continue;
  const alt = kindNames.join("|");
  // An array literal naming two or more kinds, or an object keyed by two or more kinds.
  const asArray = new RegExp(
    "\\[[^\\]]*[\"'](" + alt + ")[\"'][^\\]]*[\"'](" + alt + ")[\"']",
    "s",
  );
  // A key starts a line or follows { or , so a switch's `case "kind":` is not one.
  const asKey = new RegExp("(?:^|[{,])\\s*[\"']?(" + alt + ")[\"']?\\s*:", "gm");
  if (asArray.test(text)) arrays.push(f + " (array)");
  if ((text.match(asKey) || []).length >= 2) arrays.push(f + " (object keyed by kind)");
}
record(
  "no array: NOTIFICATION_REGISTRY, KIND_C and DESTINATION are gone from src/",
  retired.length === 0,
  retired.join("; "),
);
record(
  "no array: no client array or object of notification kinds exists in src/",
  kindNames.length >= 2 && arrays.length === 0,
  kindNames.length < 2 ? "the seed did not load" : arrays.join("; "),
);

// ------------------------------------------------------------------------------------------------
// Handoff 60-NC (G245, rulings 477, 1529, 1554, 1555, 1557, 1572). Four more arms, each against the
// source as it ships, loaded the way the row part is: transpiled and run in a context of its own.
//   headers   notify-deliver's deliver.ts passes List-Unsubscribe and List-Unsubscribe-Post to the
//             sender for a non-transactional row, immediate or digest, minted before the send, and
//             neither for a transactional row; read from the call, never from a sent message;
//   endpoint  the one-click handler asks the database only on a POST carrying RFC 8058's body and a
//             well-formed token, answers its word, and a GET redirects to the landing page without
//             asking it;
//   next      sign-in's next keeps exactly email-preferences and drops anything else, a URL above all;
//   no mode   no literal mode or mode label exists in src/: they are notification_email_modes' words.
// ------------------------------------------------------------------------------------------------

/** A TypeScript module run in its own context; `deps` answers its imports by specifier. */
function loadTs(rel, deps = {}) {
  const { outputText } = ts.transpileModule(read(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: rel,
  });
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      require: (id) => {
        if (id in deps) return deps[id];
        throw new Error(rel + " imports " + id + ", which the arm does not provide");
      },
      URL,
      URLSearchParams,
      Response,
      Request,
      JSON,
      Promise,
      encodeURIComponent,
    },
    { filename: rel },
  );
  return module.exports;
}

async function arms60nc() {
  // headers
  const d = loadTs("supabase/functions/notify-deliver/deliver.ts");
  const order = [];
  const sends = [];
  const settles = [];
  const base = {
    member_id: "m1",
    email: "member@example.invalid",
    suppressed: false,
    kind: "connection_request",
    c: "connect",
    subject: "A subject",
    line: "A line.",
    created_at: "2026-10-11T00:00:00Z",
  };
  const token = "a".repeat(64);
  await d.deliver(
    [
      { ...base, id: "o-immediate", mode: "immediate", transactional: false },
      { ...base, id: "o-digest", mode: "digest", transactional: false },
      { ...base, id: "o-transactional", mode: "immediate", transactional: true },
    ],
    {
      appOrigin: "https://app.example.invalid",
      mint: async (id) => {
        order.push("mint " + id);
        return token;
      },
      send: async (m) => {
        order.push("send " + m.subject);
        sends.push(m);
        return { ok: true, status: 200, id: "re_" + sends.length };
      },
      settle: async (id, state, resendId, error) => {
        settles.push({ id, state, resendId, error });
      },
    },
  );
  const pair = (m) =>
    !!m.headers &&
    m.headers["List-Unsubscribe"] ===
      "<https://app.example.invalid/api/email/unsubscribe?token=" + token + ">" &&
    m.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" &&
    m.text.includes("https://app.example.invalid/email/unsubscribed?token=" + token);
  const plain = (m) =>
    !m.headers || (!("List-Unsubscribe" in m.headers) && !("List-Unsubscribe-Post" in m.headers));
  record(
    "headers: a non-transactional immediate and a digest pass both List-Unsubscribe headers and the landing link to sendMail, minted before the send; a transactional send passes neither and mints nothing (477, G245, 1572)",
    sends.length === 3 &&
      pair(sends[0]) &&
      pair(sends[1]) &&
      plain(sends[2]) &&
      !sends[2].text.includes("/email/unsubscribed") &&
      order.join(",") ===
        "mint o-immediate,send A subject,mint o-digest,send A subject,send A subject" &&
      settles.every((x) => x.state === "sent"),
    JSON.stringify({ order, settles: settles.map((x) => x.state) }),
  );
  const noToken = [];
  const noTokenSettles = [];
  await d.deliver([{ ...base, id: "o-nomint", mode: "digest", transactional: false }], {
    appOrigin: "https://app.example.invalid",
    mint: async () => null,
    send: async (m) => {
      noToken.push(m);
      return { ok: true, status: 200, id: "re_x" };
    },
    settle: async (id, state, resendId, error) => noTokenSettles.push({ state, error }),
  });
  record(
    "headers: a non-transactional row whose token cannot be minted is not sent without the pair; it settles failed",
    noToken.length === 0 &&
      noTokenSettles.length === 1 &&
      noTokenSettles[0].state === "failed" &&
      noTokenSettles[0].error === "no_unsubscribe_token",
    JSON.stringify(noTokenSettles),
  );

  // endpoint
  const shared = loadTs("src/lib/unsubscribe.ts");
  const h = loadTs("src/lib/server/unsubscribe.server.ts", {
    "@supabase/supabase-js": {
      createClient: () => {
        throw new Error("the arm injects the rpc");
      },
    },
    "../supabase": { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "" },
    "../unsubscribe": shared,
  });
  const asked = [];
  const rpc = (answer) => async (t) => {
    asked.push(t);
    return answer;
  };
  const url = (t) => "https://app.example.invalid/api/email/unsubscribe?token=" + t;
  const post = (t, body = "List-Unsubscribe=One-Click") =>
    new Request(url(t), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  const word = async (res) => (await res.json()).state;
  const done = await h.handleUnsubscribePost(post(token), rpc({ data: "done", error: null }));
  const used = await h.handleUnsubscribePost(post(token), rpc({ data: "expired", error: null }));
  const failed = await h.handleUnsubscribePost(
    post(token),
    rpc({ data: null, error: { code: "XX000" } }),
  );
  const before = asked.length;
  const noBody = await h.handleUnsubscribePost(post(token, ""), rpc({ data: "done", error: null }));
  const badToken = await h.handleUnsubscribePost(
    post("not-a-token"),
    rpc({ data: "done", error: null }),
  );
  const get = h.handleUnsubscribeGet(new Request(url(token)));
  const states = {
    done: [done.status, await word(done)],
    used: [used.status, await word(used)],
    failed: [failed.status, await word(failed)],
    noBody: [noBody.status, await word(noBody)],
    badToken: [badToken.status, await word(badToken)],
    get: [get.status, get.headers.get("Location")],
  };
  record(
    "endpoint: a one-click POST answers the database's word (done, expired) or refused, a POST without RFC 8058's body or with a malformed token never asks it, and a GET only redirects to /email/unsubscribed with the token (1529, G245)",
    states.done.join() === "200,done" &&
      states.used.join() === "200,expired" &&
      states.failed.join() === "503,refused" &&
      states.noBody.join() === "400,refused" &&
      states.badToken.join() === "200,expired" &&
      states.get.join() === "303,/email/unsubscribed?token=" + token &&
      asked.length === 3 &&
      before === 3,
    JSON.stringify(states) + " asked " + asked.length,
  );

  // next
  const n = loadTs("src/lib/sign-in-next.ts");
  const tried = [
    "email-preferences",
    "https://example.invalid",
    "/feed",
    "//example.invalid",
    "EMAIL-PREFERENCES",
    undefined,
    ["email-preferences"],
  ].map((v) => n.readSignInNext(v) ?? null);
  record(
    "next: sign-in keeps exactly email-preferences and drops a URL, a path and every other value (1557)",
    JSON.stringify(tried) ===
      JSON.stringify(["email-preferences", null, null, null, null, null, null]) &&
      /readSignInNext\(search\["next"\]\)/.test(read("src/routes/sign-in.tsx")),
    JSON.stringify(tried),
  );

  // no mode
  const literals = [];
  for (const f of walk("src", [".ts", ".tsx"])) {
    if (f.endsWith("database.types.ts")) continue;
    const text = read(f);
    for (const m of text.matchAll(/["'`](immediate|digest|Right away|Daily digest)["'`]/g))
      literals.push(f + ": " + m[1]);
  }
  record(
    "no mode: no email mode or mode label is a literal in src/; both come from notification_email_modes (1554, 194)",
    literals.length === 0,
    literals.join("; "),
  );
}

arms60nc()
  .catch((e) => record("60-NC arms completed", false, String(e && e.stack ? e.stack : e)))
  .finally(() => {
    const fails = results.filter((r) => !r.ok);
    console.log(`\n${results.length - fails.length}/${results.length} notification checks passed`);
    if (fails.length) for (const f of fails) console.log(`  FAILED: ${f.name}`);
    process.exit(fails.length ? 1 : 0);
  });
