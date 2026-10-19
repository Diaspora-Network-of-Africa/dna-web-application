// H63-CI (rulings 1846, 1847, 1881): the full matrix in shards, six on WebKit and four on Chromium.
//
// tests/matrix-shards.json is the partition: per engine, one list of unit keys per shard. A unit is
// one call of the full run's loop (`fullUnits` in tests/matrix.cjs), so a group runner's arms
// travel together and no unit is split. The file is an allowlist and fails closed: a unit no shard
// names, a unit two shards name, a key no unit answers, or a shard count that disagrees with the
// workflow's stops the shard before any arm runs, and the static step in pages.yml's deploy job
// says the same on every push, so a new arm is placed by whoever adds it rather than dropped.
//
// Partitioned by fixture first (1847). The full run's arms mock the project at the network layer,
// each arm in its own browser, except three that act on the project for the two seeded accounts
// (ruling 218): messenger-media and messenger-composer-video write to the one group thread the
// owner leads with member-test in it, and messenger-live reads and writes that pair's threads and
// settings. They run in one shard per engine, in the full run's order, so no shard reads another's
// writes. The two engines' runs of them overlap in time as they did before sharding, when the two
// engine jobs ran side by side; that is not new here.
//
// Balanced by measured time second (1881): the lists were cut from pages.yml run 625 (#123's final
// head, 0b426b5), each engine's per-arm seconds read from its own job's `ARM ... +Ns` lines and
// summed per unit, as contiguous runs of the full run's order so each shard reads like a section of
// the old log.
//
// SHARD=k/n with ENGINE naming one engine runs shard k of n. With SPECIAL, ONLY or THEME set it is
// refused: those are subsets already, and a shard of a subset is a partition of nothing.
//
// Usage: node tests/shards.cjs          checks the file against the unit list, both engines
//        node tests/shards.cjs list     prints each shard's units
const fs = require("fs");
const path = require("path");

const PARTITION_PATH = path.join(__dirname, "matrix-shards.json");
/** Ruling 1847: the units that act on the project for the seeded accounts, kept in one shard. */
const TOGETHER = [["messenger-media", "messenger-composer-video", "messenger-live"]];

function loadPartition() {
  return JSON.parse(fs.readFileSync(PARTITION_PATH, "utf8"));
}

/** Every way the partition disagrees with the unit list for one engine, by name. Empty is sound. */
function problems(engine, keys, partition = loadPartition()) {
  const out = [];
  const shards = partition[engine];
  if (!Array.isArray(shards) || !shards.length || !shards.every(Array.isArray))
    return [`${engine}: tests/matrix-shards.json has no list of shards for this engine`];
  const known = new Set(keys);
  const seenKeys = new Set();
  for (const k of keys) {
    if (seenKeys.has(k)) out.push(`${engine}: the unit key "${k}" names two units in fullUnits`);
    seenKeys.add(k);
  }
  const where = new Map();
  shards.forEach((list, i) => {
    for (const k of list) {
      if (!known.has(k)) out.push(`${engine}: shard ${i + 1} names "${k}", which is no unit`);
      if (where.has(k))
        out.push(`${engine}: "${k}" is in shard ${where.get(k)} and again in shard ${i + 1}`);
      else where.set(k, i + 1);
    }
  });
  for (const k of keys) if (!where.has(k)) out.push(`${engine}: "${k}" is in no shard`);
  for (const group of TOGETHER) {
    const at = new Set(group.map((k) => where.get(k)));
    if (at.size > 1)
      out.push(
        `${engine}: ${group.join(", ")} act on the project for the seeded accounts and must share a shard (1847); found in ${[...at].join(", ")}`,
      );
  }
  return out;
}

/**
 * The shard SHARD names, or null when it is unset. `pick` checks the partition against the units
 * the run built and throws, listing every problem, before any arm runs.
 */
function fromEnv({ engines, only }) {
  const raw = (process.env.SHARD || "").trim();
  if (!raw) return null;
  const m = /^(\d+)\/(\d+)$/.exec(raw);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > Number(m[2]))
    throw new Error(`SHARD=${raw} is not k/n with 1 <= k <= n`);
  if (only || process.env.SPECIAL || process.env.THEME)
    throw new Error(
      `SHARD=${raw} with SPECIAL, ONLY or THEME set: a shard is a part of the full run`,
    );
  if (engines.length !== 1)
    throw new Error(`SHARD=${raw} needs ENGINE to name one engine; it names ${engines.length}`);
  const index = Number(m[1]);
  const count = Number(m[2]);
  return {
    index,
    count,
    pick(bname, units) {
      const partition = loadPartition();
      const errs = problems(
        bname,
        units.map((u) => u.key),
        partition,
      );
      if (partition[bname] && partition[bname].length !== count)
        errs.push(
          `${bname}: the workflow runs ${count} shards and tests/matrix-shards.json has ${partition[bname].length}`,
        );
      if (errs.length) throw new Error("the shard partition is unsound:\n  " + errs.join("\n  "));
      const mine = new Set(partition[bname][index - 1]);
      const picked = units.filter((u) => mine.has(u.key));
      console.log(
        `SHARD ${index}/${count} | ${bname} | ${picked.length} of ${units.length} units: ` +
          `${picked[0].key} ... ${picked[picked.length - 1].key}`,
      );
      return picked;
    },
  };
}

module.exports = { PARTITION_PATH, TOGETHER, loadPartition, problems, fromEnv };

if (require.main === module) {
  const { fullUnits } = require("./matrix.cjs");
  const partition = loadPartition();
  const engines = Object.keys(partition).filter((k) => Array.isArray(partition[k]));
  let failed = 0;
  for (const engine of ["chromium", "webkit"]) {
    const keys = fullUnits(null, engine).map((u) => u.key);
    const errs = engines.includes(engine)
      ? problems(engine, keys, partition)
      : [`${engine}: no partition`];
    if (process.argv[2] === "list" && !errs.length)
      partition[engine].forEach((list, i) =>
        console.log(`${engine} shard ${i + 1} (${list.length} units)\n  ${list.join("\n  ")}`),
      );
    for (const e of errs) console.log("FAIL " + e);
    if (!errs.length)
      console.log(
        `PASS ${engine}: ${keys.length} units, each in exactly one of ${partition[engine].length} shards; ` +
          `${TOGETHER.map((g) => g.join(" + ")).join("; ")} share a shard (1847)`,
      );
    failed += errs.length;
  }
  process.exit(failed ? 1 : 0);
}
