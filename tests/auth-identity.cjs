// Ruling 234: one address is one account. An address arriving by password and later by Google (or
// LinkedIn) lands in the same member, through identity linking on a verified matching email with
// manual linking off. Tested rather than assumed, because the failure mode is a member with two
// profiles and no merge path.
//
// No browser can drive a real provider consent screen, so this checks the state the round trip
// leaves behind rather than the round trip itself: after a human has signed in to the same address
// by two providers once, these arms prove the project resolved them to one auth user and one
// members row. Without the admin key or the address the arms report UNPROVEN and are counted apart
// (ruling 228); they are never reported as passing.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... IDENTITY_EMAIL=someone@example.com node tests/auth-identity.cjs
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
const SUPABASE_URL = process.env.SUPABASE_URL || (src.match(/"(https:\/\/[a-z0-9.-]+)"/) || [])[1];
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EMAIL = process.env.IDENTITY_EMAIL || "";

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
};
const unproven = [];
const skip = (name, why) => {
  unproven.push({ name, why });
  console.log("UNPROVEN " + name + "  (" + why + ")");
};

async function admin(pathname) {
  const res = await fetch(SUPABASE_URL + pathname, {
    headers: { apikey: KEY, Authorization: "Bearer " + KEY },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* a non-JSON body is reported as the failure detail */
  }
  return { status: res.status, body, text };
}

const ARMS = [
  "ruling 234: the address resolves to exactly one auth user",
  "ruling 234: every provider identity points at that one user",
  "ruling 234: the address has exactly one members row",
];

(async () => {
  if (!KEY || !EMAIL) {
    const why = !KEY
      ? "SUPABASE_SERVICE_ROLE_KEY not set"
      : "IDENTITY_EMAIL not set (the address a human signed in to by two providers)";
    for (const arm of ARMS) skip(arm, why);
  } else {
    const users = await admin(
      "/auth/v1/admin/users?filter=" + encodeURIComponent(EMAIL) + "&per_page=100",
    );
    if (users.status !== 200 || !users.body || !Array.isArray(users.body.users)) {
      for (const arm of ARMS)
        skip(
          arm,
          "admin users endpoint answered " + users.status + ": " + users.text.slice(0, 120),
        );
    } else {
      const matched = users.body.users.filter(
        (u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase(),
      );
      record(
        ARMS[0],
        matched.length === 1,
        matched.length + " auth user(s): " + matched.map((u) => u.id).join(", "),
      );

      const user = matched[0];
      if (!user) {
        skip(ARMS[1], "no auth user for " + EMAIL);
        skip(ARMS[2], "no auth user for " + EMAIL);
      } else {
        const identities = user.identities || [];
        const providers = identities.map((i) => i.provider);
        const oneUser = identities.every((i) => i.user_id === user.id);
        if (identities.length < 2)
          skip(
            ARMS[1],
            "only " +
              (providers.join(", ") || "no") +
              " identity on this address; sign in once by a second provider before this arm can run",
          );
        else record(ARMS[1], oneUser, providers.join(", ") + " all on " + user.id);

        const members = await admin(
          "/rest/v1/members?select=id,handle&id=eq." + encodeURIComponent(user.id),
        );
        const all = await admin("/rest/v1/members?select=id&limit=1000");
        if (members.status !== 200 || !Array.isArray(members.body))
          skip(
            ARMS[2],
            "members read answered " + members.status + ": " + members.text.slice(0, 120),
          );
        else
          record(
            ARMS[2],
            members.body.length === 1 &&
              Array.isArray(all.body) &&
              all.body.filter((m) => m.id === user.id).length === 1,
            members.body.length + " members row(s) for " + user.id,
          );
      }
    }
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
  fails.forEach((f) => console.log("FAIL:", f.name, f.detail));
  // Ruling 228: unproven is its own outcome. It does not fail the run, and it is never folded into
  // the passing count.
  if (unproven.length) {
    console.log(`${unproven.length} arm(s) unproven, not passing:`);
    for (const u of unproven) console.log(`  - ${u.name}: ${u.why}`);
  }
  process.exit(fails.length ? 1 : 0);
})();
