// Handoff 62-MIG (ruling 1827), Done Means 8: the migrate workflow is dispatch-only, runs in the
// canonical-migrations Environment, and is the only workflow that references MIGRATE_DB_URL. Static,
// read from the tree, run by pages.yml on every push beside the migration lint: a push or
// pull_request trigger on the workflow that holds the canonical project's write path would apply a
// migration on a push nobody approved (562), and a second workflow holding the secret would be a
// second write path (553). Reported line by line, PASS or FAIL by name, exit 1 on any FAIL.
//
// Usage: node tests/migrate-workflow.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WORKFLOWS = path.join(ROOT, ".github/workflows");
const WORKFLOW = "migrate.yml";
const ENVIRONMENT = "canonical-migrations";
const SECRET = "MIGRATE_DB_URL";
const SCRIPT = "scripts/migrate.sh";

let failed = 0;
const record = (ok, name, detail = "") => {
  if (!ok) failed += 1;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
};

const file = path.join(WORKFLOWS, WORKFLOW);
if (!fs.existsSync(file)) {
  record(false, `${WORKFLOW} exists`, "missing");
  process.exit(1);
}
const text = fs.readFileSync(file, "utf8");
const lines = text.split("\n");

/** The keys directly under a top-level mapping key, read from the indentation. */
function childKeys(topKey) {
  const start = lines.findIndex((l) => l === `${topKey}:`);
  if (start < 0) return null;
  const keys = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(#.*)?$/.test(l)) continue;
    if (!/^\s/.test(l)) break;
    const m = /^(\s+)([A-Za-z_][\w-]*):/.exec(l);
    if (m && m[1].length === 2) keys.push(m[2]);
  }
  return keys;
}

const triggers = childKeys("on");
record(triggers !== null, "migrate.yml has a top-level on: block");
record(
  triggers !== null && triggers.length === 1 && triggers[0] === "workflow_dispatch",
  "migrate.yml is triggered by workflow_dispatch and nothing else",
  triggers ? triggers.join(", ") : "no on: block",
);
record(
  !/^\s*(push|pull_request|pull_request_target|schedule|repository_dispatch):/m.test(text),
  "migrate.yml carries no push, pull_request, pull_request_target, schedule or repository_dispatch key anywhere",
);

for (const input of ["version", "ref", "mode"]) {
  record(
    new RegExp(`^      ${input}:$`, "m").test(text),
    `migrate.yml declares the ${input} input`,
  );
}
const modeBlock = /^      mode:\n((?:        .*\n)+)/m.exec(text);
const options = modeBlock
  ? [...modeBlock[1].matchAll(/^          - (\S+)$/gm)].map((m) => m[1])
  : [];
record(
  options.length === 2 && options[0] === "rehearse" && options[1] === "apply",
  "the mode input's options are exactly rehearse and apply",
  options.join(", ") || "none",
);

record(
  new RegExp(
    `^    environment: ${ENVIRONMENT}$|^    environment:\\n      name: ${ENVIRONMENT}$`,
    "m",
  ).test(text),
  `the job runs in the ${ENVIRONMENT} Environment`,
);

const secretRefs = (text.match(new RegExp(`secrets\\.${SECRET}\\b`, "g")) || []).length;
record(
  secretRefs === 1,
  `migrate.yml reads secrets.${SECRET} in exactly one place`,
  `${secretRefs} reference(s)`,
);
record(new RegExp(`run: ${SCRIPT}$`, "m").test(text), `migrate.yml runs ${SCRIPT}`);
const script = path.join(ROOT, SCRIPT);
record(fs.existsSync(script), `${SCRIPT} exists`);
record(
  fs.existsSync(script) && (fs.statSync(script).mode & 0o111) !== 0,
  `${SCRIPT} is executable`,
);

// Chat's reading of #117 at fdb9a41: the job checked inputs.ref out and ran the script from that
// checkout, so a ref with no scripts/migrate.sh (#116's head) failed, and a ref carrying a different
// script would have run it with the secret. The script runs from the workflow's own commit; only the
// migration file is read out of inputs.ref, by `git show`, never by checking the ref out.
const checkouts = [
  ...text.matchAll(/^\s*- uses: actions\/checkout@[^\n]*\n((?:[ ]{8,}.*\n)*)/gm),
].map((m) => m[1]);
record(
  checkouts.length >= 1,
  "migrate.yml checks the workflow's own commit out",
  `${checkouts.length} checkout step(s)`,
);
record(
  checkouts.every((block) => !/^\s*ref:/m.test(block)),
  "no checkout step in migrate.yml names a ref, so the job runs the workflow's own commit, never inputs.ref",
);
record(
  !/git\s+(checkout|switch|worktree)\b/.test(text),
  "migrate.yml never checks another ref out",
);
const scriptText = fs.existsSync(script) ? fs.readFileSync(script, "utf8") : "";
record(
  /git show "\$\{REF\}:/.test(scriptText) && /git hash-object/.test(scriptText),
  `${SCRIPT} reads the migration file out of REF with git show and checks its blob hash`,
);
record(
  !/git\s+(checkout|switch|worktree)\b/.test(scriptText),
  `${SCRIPT} never checks REF out, so it runs from the workflow's checkout alone`,
);
record(
  /refs\/heads\/\$\{DEFAULT_BRANCH\}/.test(text),
  "migrate.yml refuses a dispatch from any ref but the default branch",
);

const others = fs
  .readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f) && f !== WORKFLOW)
  .filter((f) => fs.readFileSync(path.join(WORKFLOWS, f), "utf8").includes(SECRET));
record(
  others.length === 0,
  `no other workflow references ${SECRET}`,
  others.length
    ? others.join(", ")
    : `${fs.readdirSync(WORKFLOWS).length - 1} other workflow(s) read`,
);

console.log(failed ? `${failed} check(s) failed` : "migrate workflow: every check passed");
process.exit(failed ? 1 : 0);
