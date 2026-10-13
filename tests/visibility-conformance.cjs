// The visibility conformance arm (handoff 61-VT; rulings 1734, 1747, 1748, 459, 228).
//
// private.visible_to is the one member-visibility predicate. This arm keeps every projection on it:
// it reads, from the catalog over LIVE_DB_URL as live_arms (382), every function in `public` that
// anon or authenticated may execute and every view in `public` that either may read, and holds each
// to exactly one class in tests/visibility-manifest.json:
//
//   predicate   security definer; its body reaches private.visible_to, directly or through a
//               private helper it calls.
//   discovery   as predicate, and its body also reaches private.is_blocked (1747, 1748).
//   invoker     security invoker; every relation it reads is classified in the manifest's `tables`
//               and that classification holds in the catalog (below).
//   exempt      owner-only, vocabulary or admin, with a one-line reason.
//
// A relation an invoker object reads is one of: `predicate` (every SELECT policy for anon or
// authenticated reaches private.visible_to or is a self-row policy, and at least one reaches it),
// `owner` (every such policy is a self-row policy), `open` (every such policy is `true`, a
// vocabulary), `closed` (RLS on and no such policy, so an invoker reads nothing), or `scoped`, with a
// one-line reason naming the policy that scopes it. The first four are verified against pg_policies;
// `scoped` is a recorded decision.
//
// Also asserted: the predicate exists with its two parameters and no viewer parameter (1734); its
// body carries no onboarding term, and connect_cards, connect_where and send_introduction keep
// private.is_onboarded (459, 1748); every policy the manifest names by name (the profile-media
// objects policy on storage.objects) reaches the predicate; and no object outside predicate and
// discovery reaches the audience helpers the predicate wraps (admit_section, admit_member,
// admit_audience, can_see_section, can_see_core) without reaching the predicate.
//
// An object missing from the manifest fails by name, as does a manifest entry the catalog no longer
// holds, a predicate or discovery object whose body lacks the call, an invoker object reading a
// relation the manifest does not classify, and a classification the catalog contradicts.
//
// Standalone: LIVE_DB_URL=postgres://... node tests/visibility-conformance.cjs (exit 1 on any FAIL).
// In the live job it runs inside tests/live-db.cjs on the same client. Without the predicate on the
// project (before Chat applies 20261013150000) every check but coverage reports UNPROVEN (228).
const fs = require("fs");
const path = require("path");

const MANIFEST = path.join(__dirname, "visibility-manifest.json");
const MIGRATION = "20261013150000_h61_vt_visible_to";
const PREDICATE = "visible_to";
const BLOCK = "is_blocked";
const ONBOARDED_CALLERS = ["connect_cards", "connect_where", "send_introduction"];
const AUDIENCE_HELPERS = [
  "admit_section",
  "admit_member",
  "admit_audience",
  "can_see_section",
  "can_see_core",
];
const OBJECT_CLASSES = ["predicate", "discovery", "invoker", "exempt"];
const TABLE_CLASSES = ["predicate", "owner", "open", "closed", "scoped"];

const ARM = "H61-VT conformance (1734, 1747)";
/** The arm's checks by name, in the order they print; tests/live-db.cjs lists them as UNPROVEN when
 *  it cannot connect, so a check never vanishes from the count (G143, 228). */
const CHECKS = {
  coverage:
    ARM + ": every executable function and readable view is classified once, and only what exists",
  shape: ARM + ": private.visible_to is the predicate the doctrine names (1734)",
  onboarding:
    ARM + ": visible_to carries no onboarding term, and the three 459 callers keep is_onboarded",
  predicate: ARM + ": every predicate and discovery object answers through visible_to",
  invoker: ARM + ": every invoker object reads only classified relations, and the classes hold",
  helpers: ARM + ": no object outside the predicate reaches the audience helpers it wraps",
  policies: ARM + ": the policies named by name reach the predicate",
};

/** The private functions a body names, directly: `private.name(`. */
function directCalls(src) {
  const out = new Set();
  for (const m of String(src || "").matchAll(/private\.([a-z0-9_]+)\s*\(/g)) out.add(m[1]);
  return out;
}

/** Every private function a body reaches, through the private helpers it calls (transitively). */
function reach(src, privateBodies) {
  const seen = new Set();
  const queue = [...directCalls(src)];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    for (const body of privateBodies.get(name) || [])
      for (const n of directCalls(body)) queue.push(n);
  }
  return seen;
}

/** A policy expression that admits the caller's own row and nothing else: self-row terms OR'd. */
function isSelfRow(qual) {
  if (!qual) return false;
  const t = qual.replace(
    /[a-z0-9_]+(?:\.[a-z0-9_]+)? = (?:\( SELECT auth\.uid\(\) AS uid\)|auth\.uid\(\))/g,
    "SELF",
  );
  return /^[\s()]*SELF(?:[\s()]*OR[\s()]*SELF)*[\s()]*$/.test(t);
}

function appliesTo(roles) {
  return roles.includes("anon") || roles.includes("authenticated") || roles.includes("public");
}

async function readCatalog(client) {
  const privateFns = await client.query(
    `select p.proname as name, p.prosrc as src
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'`,
  );
  const privateBodies = new Map();
  for (const r of privateFns.rows) {
    if (!privateBodies.has(r.name)) privateBodies.set(r.name, []);
    privateBodies.get(r.name).push(r.src);
  }
  const predicate = await client.query(
    `select pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as secdef,
            p.provolatile as volatility, p.proconfig as config, p.prosrc as src
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = $1`,
    [PREDICATE],
  );
  const functions = await client.query(
    `select p.proname as name, p.prosecdef as secdef, p.prosrc as src,
            pg_get_function_identity_arguments(p.oid) as args,
            has_function_privilege('anon', p.oid, 'execute') as anon,
            has_function_privilege('authenticated', p.oid, 'execute') as authenticated
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind in ('f', 'p')
        and (has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('authenticated', p.oid, 'execute'))
      order by 1, 4`,
  );
  const views = await client.query(
    `select c.relname as name,
            coalesce((select o.option_value in ('true', 'on') from pg_options_to_table(c.reloptions) o
                       where o.option_name = 'security_invoker'), false) as invoker,
            (select array_agg(distinct r.relname order by r.relname)
               from pg_rewrite rw
               join pg_depend d on d.objid = rw.oid
                and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
               join pg_class r on r.oid = d.refobjid
               join pg_namespace rn on rn.oid = r.relnamespace
              where rw.ev_class = c.oid and r.oid <> c.oid and rn.nspname = 'public'
                and r.relkind in ('r', 'p', 'v', 'm')) as reads
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
        and (has_table_privilege('anon', c.oid, 'select')
             or has_table_privilege('authenticated', c.oid, 'select'))
      order by 1`,
  );
  const relations = await client.query(
    `select c.relname as name, c.relkind as kind, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')`,
  );
  const policies = await client.query(
    `select schemaname as schema, tablename as "table", policyname as name, cmd,
            roles::text[] as roles, qual
       from pg_policies
      where schemaname in ('public', 'storage') and cmd in ('SELECT', 'ALL')
      order by 1, 2, 3`,
  );
  return {
    privateBodies,
    predicate: predicate.rows,
    functions: functions.rows,
    views: views.rows,
    relations: new Map(relations.rows.map((r) => [r.name, r])),
    policies: policies.rows,
  };
}

/**
 * Runs the arm. `record(name, ok, detail)` and `skip(name, why)` are live-checks' own; `client` is
 * a connected pg client. Returns { fails, checks, unproven, counts }.
 */
async function runVisibilityConformance({ client, record, skip }) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (e) {
    record(CHECKS.coverage, false, "the manifest does not parse: " + String(e.message || e));
    return { fails: 1, checks: 1, unproven: 0, counts: {} };
  }
  const fails = [];
  let checks = 0;
  let unproven = 0;
  const fail = (what, detail) => {
    fails.push(what + (detail ? " (" + detail + ")" : ""));
  };
  const cat = await readCatalog(client);
  const applied = cat.predicate.length > 0;

  // ---------------------------------------------------------------------------------------------
  // Coverage. Independent of the migration: every object in the catalog is in the manifest, in one
  // class, and every manifest entry is in the catalog.
  // ---------------------------------------------------------------------------------------------
  const mf = manifest.functions || {};
  const mv = manifest.views || {};
  const mt = manifest.tables || {};
  const counts = { predicate: 0, discovery: 0, invoker: 0, exempt: 0 };
  const fnNames = [...new Set(cat.functions.map((f) => f.name))];
  const viewNames = cat.views.map((v) => v.name);
  const coverage = [];
  for (const name of fnNames) {
    const e = mf[name];
    if (!e) coverage.push("function " + name + " is not in the manifest");
    else if (!OBJECT_CLASSES.includes(e.class))
      coverage.push("function " + name + " has class " + JSON.stringify(e.class));
    else counts[e.class]++;
  }
  for (const name of viewNames) {
    const e = mv[name];
    if (!e) coverage.push("view " + name + " is not in the manifest");
    else if (!OBJECT_CLASSES.includes(e.class))
      coverage.push("view " + name + " has class " + JSON.stringify(e.class));
    else counts[e.class]++;
  }
  for (const name of Object.keys(mf))
    if (!fnNames.includes(name))
      coverage.push("function " + name + " is in the manifest and not executable in the catalog");
  for (const name of Object.keys(mv))
    if (!viewNames.includes(name))
      coverage.push("view " + name + " is in the manifest and not readable in the catalog");
  for (const [name, e] of Object.entries({ ...mf, ...mv }))
    if (e && e.class === "exempt" && !(typeof e.reason === "string" && e.reason.trim()))
      coverage.push(name + " is exempt with no reason");
  for (const [name, e] of Object.entries(mt)) {
    if (!TABLE_CLASSES.includes(e.class))
      coverage.push("table " + name + " has class " + JSON.stringify(e.class));
    if (e.class === "scoped" && !(typeof e.reason === "string" && e.reason.trim()))
      coverage.push("table " + name + " is scoped with no reason");
    if (!cat.relations.has(name))
      coverage.push("table " + name + " is in the manifest and not in the catalog");
  }
  checks++;
  record(
    CHECKS.coverage,
    coverage.length === 0,
    coverage.length
      ? coverage.slice(0, 6).join("; ") + (coverage.length > 6 ? "; +" + (coverage.length - 6) : "")
      : fnNames.length + " functions, " + viewNames.length + " views",
  );
  if (coverage.length) for (const c of coverage) fail("coverage", c);

  if (!applied) {
    const why = MIGRATION + " is not on the project (private." + PREDICATE + " is absent)";
    for (const n of Object.values(CHECKS).filter((n) => n !== CHECKS.coverage)) {
      skip(n, why);
      unproven++;
    }
    return { fails: fails.length, checks, unproven, counts };
  }

  // ---------------------------------------------------------------------------------------------
  // The predicate itself (1734).
  // ---------------------------------------------------------------------------------------------
  const p = cat.predicate[0];
  const shapeOk =
    cat.predicate.length === 1 &&
    /^p_member uuid, p_section (public\.)?profile_section$/.test(p.args) &&
    p.secdef === true &&
    p.volatility === "s" &&
    Array.isArray(p.config) &&
    p.config.some((c) => /^search_path=/.test(c));
  checks++;
  record(
    CHECKS.shape,
    shapeOk,
    cat.predicate.length +
      " definition(s); args " +
      JSON.stringify(p.args) +
      "; security definer " +
      p.secdef +
      "; volatility " +
      p.volatility +
      "; config " +
      JSON.stringify(p.config),
  );
  if (!shapeOk) fail("predicate shape");

  const onboardedProblems = [];
  if (directCalls(p.src).has("is_onboarded"))
    onboardedProblems.push("visible_to calls private.is_onboarded");
  for (const name of ONBOARDED_CALLERS) {
    const defs = cat.functions.filter((f) => f.name === name);
    if (!defs.length) onboardedProblems.push(name + " is not executable in the catalog");
    for (const d of defs)
      if (!directCalls(d.src).has("is_onboarded"))
        onboardedProblems.push(name + "(" + d.args + ") does not call private.is_onboarded");
  }
  checks++;
  record(
    CHECKS.onboarding,
    onboardedProblems.length === 0,
    onboardedProblems.join("; ") || ONBOARDED_CALLERS.join(", "),
  );
  for (const x of onboardedProblems) fail("onboarding", x);

  // ---------------------------------------------------------------------------------------------
  // Objects by class.
  // ---------------------------------------------------------------------------------------------
  const relRead = (src) => {
    const out = new Set();
    for (const m of String(src || "").matchAll(/public\.([a-z0-9_]+)\b/g))
      if (cat.relations.has(m[1])) out.add(m[1]);
    return [...out].sort();
  };
  const tableVerdicts = new Map();
  const tableVerdict = (name) => {
    if (tableVerdicts.has(name)) return tableVerdicts.get(name);
    const e = mt[name];
    let verdict;
    if (!e) verdict = "not classified in the manifest";
    else {
      const rel = cat.relations.get(name);
      const pols = cat.policies.filter(
        (x) => x.schema === "public" && x.table === name && appliesTo(x.roles),
      );
      const reachesVt = (q) => reach(q, cat.privateBodies).has(PREDICATE);
      if (rel && rel.kind === "v") {
        // A view read by an invoker object is itself classified as an object; its own policies
        // are its sources'. The manifest classifies it as `scoped` with the view named.
        verdict = e.class === "scoped" ? null : "is a view; classify it as scoped naming the view";
      } else if (e.class === "predicate") {
        const bad = pols.filter((x) => !(reachesVt(x.qual) || isSelfRow(x.qual)));
        const any = pols.some((x) => reachesVt(x.qual));
        verdict = !pols.length
          ? "predicate, but no SELECT policy for anon or authenticated"
          : !any
            ? "predicate, but no SELECT policy reaches visible_to"
            : bad.length
              ? "predicate, but " +
                bad.map((x) => x.name).join(", ") +
                " neither reaches visible_to nor is a self-row policy"
              : null;
      } else if (e.class === "owner") {
        const bad = pols.filter((x) => !isSelfRow(x.qual));
        verdict = !pols.length
          ? "owner, but no SELECT policy for anon or authenticated"
          : bad.length
            ? "owner, but " + bad.map((x) => x.name).join(", ") + " is not a self-row policy"
            : null;
      } else if (e.class === "open") {
        const bad = pols.filter((x) => String(x.qual).trim() !== "true");
        verdict = !pols.length
          ? "open, but no SELECT policy for anon or authenticated"
          : bad.length
            ? "open, but " + bad.map((x) => x.name).join(", ") + " is not `true`"
            : null;
      } else if (e.class === "closed") {
        verdict =
          !rel || !rel.rls
            ? "closed, but row security is off"
            : pols.length
              ? "closed, but " +
                pols.map((x) => x.name).join(", ") +
                " admits anon or authenticated"
              : null;
      } else verdict = null; // scoped: a recorded reason, checked under coverage.
    }
    tableVerdicts.set(name, verdict);
    return verdict;
  };

  const classProblems = { predicate: [], invoker: [], helpers: [] };
  const objects = [
    ...fnNames.map((name) => ({ kind: "function", name, entry: mf[name] })),
    ...viewNames.map((name) => ({ kind: "view", name, entry: mv[name] })),
  ];
  for (const o of objects) {
    if (!o.entry || !OBJECT_CLASSES.includes(o.entry.class)) continue; // already failed under coverage
    const defs =
      o.kind === "function"
        ? cat.functions.filter((f) => f.name === o.name)
        : [cat.views.find((v) => v.name === o.name)];
    for (const d of defs) {
      const label = o.kind + " " + o.name + (o.kind === "function" ? "(" + d.args + ")" : "");
      const src = o.kind === "function" ? d.src : "";
      const reached = o.kind === "function" ? reach(src, cat.privateBodies) : new Set();
      const secdef = o.kind === "function" ? d.secdef : !d.invoker;
      if (o.entry.class === "predicate" || o.entry.class === "discovery") {
        if (o.kind === "view")
          classProblems.predicate.push(label + " is a view; a view is invoker or exempt");
        else {
          if (!secdef) classProblems.predicate.push(label + " is security invoker");
          if (!reached.has(PREDICATE))
            classProblems.predicate.push(label + " does not reach private.visible_to");
          if (o.entry.class === "discovery" && !reached.has(BLOCK))
            classProblems.predicate.push(
              label + " is discovery and does not reach private.is_blocked",
            );
        }
      } else if (o.entry.class === "invoker") {
        if (secdef) classProblems.invoker.push(label + " is security definer");
        const reads = o.kind === "function" ? relRead(src) : d.reads || [];
        for (const t of reads) {
          const verdict = tableVerdict(t);
          if (verdict) classProblems.invoker.push(label + " reads " + t + ": " + verdict);
        }
      }
      if (o.entry.class !== "predicate" && o.entry.class !== "discovery" && o.kind === "function") {
        const old = AUDIENCE_HELPERS.filter((h) => reached.has(h));
        if (old.length && !reached.has(PREDICATE))
          classProblems.helpers.push(label + " reaches " + old.join(", ") + " and not visible_to");
      }
    }
  }
  // Every predicate-class table holds, read by an invoker object or not.
  for (const [name, e] of Object.entries(mt)) {
    if (e.class === "predicate") {
      const verdict = tableVerdict(name);
      if (verdict) classProblems.invoker.push("table " + name + ": " + verdict);
    }
  }
  const tableCounts = {};
  for (const e of Object.values(mt)) tableCounts[e.class] = (tableCounts[e.class] || 0) + 1;

  checks++;
  record(
    CHECKS.predicate,
    classProblems.predicate.length === 0,
    classProblems.predicate.join("; ") ||
      counts.predicate + " predicate, " + counts.discovery + " discovery",
  );
  for (const x of classProblems.predicate) fail("predicate", x);
  checks++;
  record(
    CHECKS.invoker,
    classProblems.invoker.length === 0,
    classProblems.invoker.slice(0, 6).join("; ") ||
      counts.invoker +
        " invoker objects; tables " +
        Object.entries(tableCounts)
          .map(([k, v]) => v + " " + k)
          .join(", "),
  );
  for (const x of classProblems.invoker) fail("invoker", x);
  checks++;
  record(
    CHECKS.helpers,
    classProblems.helpers.length === 0,
    classProblems.helpers.join("; ") || counts.exempt + " exempt objects checked",
  );
  for (const x of classProblems.helpers) fail("helpers", x);

  // ---------------------------------------------------------------------------------------------
  // Policies named by name (the profile-media objects on storage.objects).
  // ---------------------------------------------------------------------------------------------
  const named = manifest.policies || [];
  const policyProblems = [];
  for (const n of named) {
    const pol = cat.policies.find(
      (x) => x.schema === n.schema && x.table === n.table && x.name === n.name,
    );
    if (!pol)
      policyProblems.push(n.schema + "." + n.table + " " + n.name + " is not in the catalog");
    else if (!reach(pol.qual, cat.privateBodies).has(PREDICATE))
      policyProblems.push(n.schema + "." + n.table + " " + n.name + " does not reach visible_to");
  }
  checks++;
  record(
    CHECKS.policies,
    policyProblems.length === 0,
    policyProblems.join("; ") || named.length + " named",
  );
  for (const x of policyProblems) fail("policies", x);

  return { fails: fails.length, checks, unproven, counts };
}

module.exports = { runVisibilityConformance, CHECKS, isSelfRow, reach, directCalls };

if (require.main === module) {
  (async () => {
    const url = process.env.LIVE_DB_URL;
    const log = (ok, name, detail) =>
      console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
    const record = (name, ok, detail) => log(ok, name, detail);
    const skip = (name, why) => console.log("UNPROVEN " + name + "  (" + why + ")");
    if (!url) {
      console.log("UNPROVEN " + ARM + "  (set LIVE_DB_URL; nothing was measured)");
      process.exit(0);
    }
    let pg;
    try {
      pg = require("pg");
    } catch {
      console.log("UNPROVEN " + ARM + "  (the pg package is not installed)");
      process.exit(0);
    }
    const { clientConfig } = require("./live-db.cjs");
    const config = clientConfig(url);
    if (!config) {
      console.log(
        "UNPROVEN " + ARM + "  (LIVE_DB_URL is not a connection string this arm can parse)",
      );
      process.exit(0);
    }
    const client = new pg.Client(config);
    try {
      await client.connect();
    } catch (e) {
      console.log("UNPROVEN " + ARM + "  (could not connect: " + (e.message || e) + ")");
      process.exit(0);
    }
    let result;
    try {
      result = await runVisibilityConformance({ client, record, skip });
    } finally {
      await client.end().catch(() => {});
    }
    console.log(
      `\n${result.checks} checks, ${result.fails} failing, ${result.unproven} unproven; manifest ` +
        Object.entries(result.counts)
          .map(([k, v]) => v + " " + k)
          .join(", "),
    );
    process.exit(result.fails ? 1 : 0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
