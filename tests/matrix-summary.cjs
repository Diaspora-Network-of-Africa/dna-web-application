// H63-CI (rulings 1847, 1881; 292, 317, 228): one engine's shards, read together against
// tests/expected-counts.json.
//
// A shard checks every arm it ran against its declaration, as a full run always has, but it cannot
// see an arm that ran nowhere, nor one that two shards both ran: ruling 228's missing arm and its
// mirror live between the shards. So this reads each shard's arm-counts.json (what tests/matrix.cjs
// writes beside its log: every arm the shard closed, with the checks it emitted) and holds their
// union to every arm the engine declares, the admin arms aside as the full run's sweep sets them
// aside (they run in admin-arms, against the admin host). It fails, naming the arm, on an arm no
// shard ran (MISSING), one two shards ran (TWICE), one that emitted fewer than it declares (SHORT)
// or more (OVER), and one no declaration names (UNDECLARED); and naming the shard, on a shard that
// left no counts at all, which is what a shard cut by its timeout or lost with its runner leaves.
//
// The totals are the shards' own: each shard's results.json read as its tail reads it, with an arm
// that lost a web process its retry did not prove taken out of the count (228, 1237), summed. A
// shard's failing checks are its own job's red and are reported here, not judged twice.
//
// Usage: node tests/matrix-summary.cjs <engine> <dir>
//   <dir> holds one directory per shard whose name carries `shard-<k>-of-<n>`, as the workflow's
//   download of the engine's shard artifacts lays them out.
const fs = require("fs");
const path = require("path");
const { ADMIN_ARM, loadExpected } = require("./matrix.cjs");

const [engine, dir] = process.argv.slice(2);
if (!engine || !dir) {
  console.error("usage: node tests/matrix-summary.cjs <engine> <dir>");
  process.exit(2);
}
const SUMMARY = process.env.GITHUB_STEP_SUMMARY;
const lines = [];
const say = (s = "") => {
  console.log(s);
  lines.push(s);
};
const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const partition = read(path.join(__dirname, "matrix-shards.json")) || {};
const count = Array.isArray(partition[engine]) ? partition[engine].length : 0;
const expected = loadExpected();
const problems = [];
if (!count) problems.push(`tests/matrix-shards.json has no shards for ${engine}`);
if (!expected) problems.push("tests/expected-counts.json is missing or unreadable");

const dirs = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const shards = [];
for (let k = 1; k <= count; k++) {
  const name = dirs.find((d) => new RegExp(`(^|-)shard-${k}-of-${count}(-|$)`).test(d));
  const at = name ? path.join(dir, name) : null;
  const counts = at && read(path.join(at, "arm-counts.json"));
  const results = (at && read(path.join(at, "results.json"))) || [];
  const arms = (at && read(path.join(at, "arms.json"))) || { armLog: [] };
  const timing = at && read(path.join(at, "shard.json"));
  if (!counts)
    problems.push(
      `shard ${k} of ${count}: no arm-counts.json${name ? ` in ${name}` : " (no artifact)"}; it did not reach its tail, so none of its arms is counted`,
    );
  const lost = new Set((arms.armLog || []).filter((a) => a.crashed).map((a) => a.arm));
  const counted = results.filter((r) => !lost.has(r.arm) && !r.unproven);
  shards.push({
    k,
    counts: counts || {},
    reported: !!counts,
    counted: counted.length,
    failed: counted.filter((r) => r.ok === false).length,
    unproven: results.filter((r) => r.unproven).length,
    lost: lost.size,
    timing,
  });
}

const inScope = (arm) =>
  (arm.startsWith(engine + "-") || arm.startsWith(engine + " ")) && !ADMIN_ARM.test(arm);
const ranIn = new Map();
for (const s of shards)
  for (const [arm, n] of Object.entries(s.counts)) {
    if (!ranIn.has(arm)) ranIn.set(arm, []);
    ranIn.get(arm).push({ k: s.k, n });
  }

const findings = [];
const declared = expected ? Object.keys(expected).filter(inScope) : [];
for (const arm of declared) {
  const want = expected[arm];
  const runs = ranIn.get(arm) || [];
  if (!runs.length) findings.push(`MISSING ${arm}: declares ${want} checks and no shard ran it`);
  else if (runs.length > 1)
    findings.push(
      `TWICE ${arm}: counted in ${runs.map((r) => `shard ${r.k} (${r.n})`).join(" and ")}; declares ${want}`,
    );
  else if (runs[0].n < want)
    findings.push(`SHORT ${arm}: emitted ${runs[0].n} of ${want} in shard ${runs[0].k}`);
  else if (runs[0].n > want)
    findings.push(
      `OVER ${arm}: emitted ${runs[0].n} against a declared ${want} in shard ${runs[0].k}`,
    );
}
for (const [arm, runs] of ranIn)
  if (expected && !(arm in expected))
    findings.push(
      `UNDECLARED ${arm}: emitted ${runs.map((r) => r.n).join(" + ")} in shard ${runs.map((r) => r.k).join(", ")} and is absent from expected-counts.json`,
    );

const sum = (f) => shards.reduce((n, s) => n + f(s), 0);
say(`### ${engine}: ${count} shards against tests/expected-counts.json (rulings 292, 1847, 1881)`);
say("");
say("```");
for (const s of shards) {
  const t = s.timing;
  say(
    `shard ${s.k} of ${count}: ` +
      (s.reported
        ? `${Object.keys(s.counts).length} arms, ${s.counted - s.failed} of ${s.counted} checks passed` +
          (s.failed ? `, ${s.failed} FAILED` : "") +
          (s.unproven ? `, ${s.unproven} unproven` : "") +
          (s.lost ? `, ${s.lost} arm(s) lost a web process unproven by a retry` : "")
        : "NO COUNTS") +
      (t && t.seconds != null
        ? ` | ${Math.floor(t.seconds / 60)}m${String(t.seconds % 60).padStart(2, "0")}s from its first step to its tail`
        : ""),
  );
}
say(
  `${engine}: ${ranIn.size} arms ran across the shards; ${declared.length} declared; ` +
    `${sum((s) => s.counted - s.failed)} of ${sum((s) => s.counted)} checks passed` +
    (sum((s) => s.failed)
      ? ` (${sum((s) => s.failed)} failed, in the shard jobs named above)`
      : ""),
);
for (const p of problems) say("FAIL " + p);
for (const f of findings) say("FAIL " + f);
if (!problems.length && !findings.length)
  say(
    `PASS every declared ${engine} arm ran in exactly one shard and emitted exactly what it declares`,
  );
say("```");
if (SUMMARY) fs.appendFileSync(SUMMARY, lines.join("\n") + "\n");
process.exit(problems.length || findings.length ? 1 : 0);
