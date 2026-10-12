// Brief 3 and Brief 4 live checks against the deployed URL and the live project (targeted checks 1, 2, 3 and 11
// in DNA-Brief-3-Profile-Code-Handoff.md). No browser: the served HTML and the anonymous REST
// surface, so a failure here is a data-level finding, not a rendering one.
// Usage: BASE=https://<preview>.dna-web-application.pages.dev node tests/live-checks.cjs
// Env: SHARED (default thandiwe-dube), UNSHARED (default kwame-mensah), UNSHARED_ID; SKIP_REST=1
// skips the Supabase calls where the network policy blocks them. LIVE_DB_URL (ruling 382: a
// connection string for the live_arms role, never the Management API token, never the service
// role key) runs the arms that live inside the database on one pg client, each in a transaction
// that rolls back: the Hotfix 01 arm against the real onboard_who, and the Fix PR 02 arms in
// tests/live-db.cjs (IB-18, 416, 435, 439, 442). Without it those arms report unproven (228).
//
// Ruling 218 adds three signed-in arms for Fix PR 01, run when OWNER_EMAIL, OWNER_PASSWORD,
// MEMBER_EMAIL and MEMBER_PASSWORD are set and skipped when they are not: a signed-in member (F1),
// a fixture in which a section audience and the core row disagree (F2a, F2b, F5), the Private
// switch (F3) and a real block (F4). Each restores what it changed and records the restore.
const fs = require("fs");
const path = require("path");
const { runLiveDbArms } = require("./live-db.cjs");

const BASE = (process.env.BASE || "http://127.0.0.1:4173").replace(/\/$/, "");
const SHARED = process.env.SHARED || "thandiwe-dube";
const UNSHARED = process.env.UNSHARED || "kwame-mensah";
const UNSHARED_ID = process.env.UNSHARED_ID || "b3000000-0000-4000-8000-000000000002";
const SHARED_ID = process.env.SHARED_ID || "b3000000-0000-4000-8000-000000000001";

// The client's defaults for the canonical project (publishable by design), unless overridden.
const src = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
const SUPABASE_URL =
  process.env.SUPABASE_URL || (src.match(/"(https:\/\/[a-z]+\.supabase\.co)"/) || [])[1];
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || (src.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];

// Strings that only a connection or an Anchored viewer may see on the seeded persona.
const CONNECTIONS_ONLY = ["dubepower.co.za", "thandiwedube", "dube.power"];
const ANCHORED_ONLY = ["Clinics that need a site survey", "Find collaborators"];

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
};
/**
 * Ruling 228: an arm that cannot run is reported as unproven, never as passing. It is not a FAIL
 * either — nothing was measured — so it is counted apart and named in the summary. An arm that
 * silently vanishes reads as coverage the suite does not have, which is the failure mode this
 * exists to prevent.
 */
const unproven = [];
const skip = (name, why) => {
  unproven.push({ name, why });
  console.log("UNPROVEN " + name + "  (" + why + ")");
};

async function get(url, headers = {}) {
  const res = await fetch(url, { headers, redirect: "manual" });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

(async () => {
  // Check 1 and 11: the served page for a shared profile.
  const shared = await get(BASE + "/m/" + SHARED);
  record(
    "check 1: shared profile serves 200 signed out",
    shared.status === 200,
    "status " + shared.status,
  );
  record(
    "check 1: served HTML carries no connections-only or anchored content",
    !CONNECTIONS_ONLY.some((t) => shared.text.includes(t)) &&
      !ANCHORED_ONLY.some((t) => shared.text.includes(t)),
  );
  record(
    "check 11: noindex on the public profile response",
    /<meta[^>]+name="robots"[^>]+content="noindex"/.test(shared.text) ||
      /<meta[^>]+content="noindex"[^>]+name="robots"/.test(shared.text),
  );

  // Check 2: a non-shared profile serves the same members-only shell and no profile data.
  const unshared = await get(BASE + "/m/" + UNSHARED);
  record(
    "check 2: non-shared profile serves 200 signed out (members-only prompt renders client-side)",
    unshared.status === 200,
    "status " + unshared.status,
  );
  record(
    "check 2: served HTML carries no profile data for the non-shared member",
    !/Kwame Mensah/.test(unshared.text) && !unshared.text.includes(UNSHARED_ID),
  );
  record(
    "check 11: noindex on the non-shared response too",
    /name="robots"[^>]+content="noindex"|content="noindex"[^>]+name="robots"/.test(unshared.text),
  );

  if (process.env.SKIP_REST) {
    console.log("REST checks skipped (SKIP_REST)");
  } else if (!SUPABASE_URL || !KEY) {
    record(
      "check 3: Supabase URL and publishable key available",
      false,
      "set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY",
    );
  } else {
    const H = { apikey: KEY, Authorization: "Bearer " + KEY };
    const rest = async (q) => {
      const r = await get(SUPABASE_URL + "/rest/v1/" + q, H);
      let body = null;
      try {
        body = JSON.parse(r.text);
      } catch {}
      return { status: r.status, body, text: r.text };
    };
    // Check 3: anon client, direct table queries for a non-shared profile: zero rows.
    const tables = [
      "members?handle=eq." + UNSHARED + "&select=*",
      "member_about?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_origin?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_intent?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_links?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_stance_details?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_focus_areas?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_skills?member_id=eq." + UNSHARED_ID + "&select=*",
      "member_follows?member_id=eq." + UNSHARED_ID + "&select=*",
      "attestations?member_id=eq." + UNSHARED_ID + "&select=*",
    ];
    for (const q of tables) {
      const r = await rest(q);
      const zero =
        (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) ||
        r.status === 401 ||
        r.status === 403;
      record(
        "check 3: anon " + q.split("?")[0] + " for the non-shared profile returns zero rows",
        zero,
        "status " + r.status + " " + r.text.slice(0, 120),
      );
    }
    const viewRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/profile_view", {
      method: "POST",
      headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ p_handle: UNSHARED, p_as_public: false }),
    });
    const viewText = await viewRes.text();
    record(
      "check 3: anon profile_view for the non-shared profile returns null",
      viewRes.status === 200 && (viewText === "null" || viewText === ""),
      "status " + viewRes.status + " " + viewText.slice(0, 80),
    );
    // The shared profile: core row visible, connections-only and anchored tables still zero rows.
    // Anon's grant on members is column-limited. Ruling 212 narrowed it to the identity columns:
    // origin_country, current_place, current_country, local_tz and stance are section-gated on
    // every path and are read through profile_view, which gates them, or not at all (F2a).
    const CORE_COLS = "id,handle,name,headline,avatar_path,cover_path,cover_focus,pattern";
    const GATED_COLS = "origin_country,current_place,current_country,local_tz,stance";
    const core = await rest("members?handle=eq." + SHARED + "&select=" + CORE_COLS);
    const switches = await rest(
      "members?handle=eq." + SHARED + "&select=profile_private,profile_shared",
    );
    const gated = await rest("members?handle=eq." + SHARED + "&select=" + GATED_COLS);
    record(
      "check 1: anon cannot read the shared profile's switches (column grant)",
      switches.status === 401 || switches.status === 403,
      "status " + switches.status,
    );
    record(
      "F1/F2a: anon cannot read the section-gated core columns (column grant, ruling 212)",
      gated.status === 401 || gated.status === 403,
      "status " + gated.status,
    );
    record(
      "check 1: anon reads the shared profile's core row (limited columns)",
      core.status === 200 &&
        Array.isArray(core.body) &&
        core.body.length === 1 &&
        !("profile_private" in (core.body[0] || {})),
      "status " + core.status + " keys " + Object.keys((core.body && core.body[0]) || {}).join(","),
    );
    const links = await rest("member_links?member_id=eq." + SHARED_ID + "&select=*");
    const intent = await rest("member_intent?member_id=eq." + SHARED_ID + "&select=*");
    record(
      "check 1: anon gets zero rows from the shared profile's connections-only and anchored sections",
      [links, intent].every(
        (r) => r.status === 200 && Array.isArray(r.body) && r.body.length === 0,
      ),
      links.status + "/" + intent.status,
    );
    // Ruling 141: the public rail and the anonymous projection never name a member who does not share.
    const railRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/public_attestations", {
      method: "POST",
      headers: { ...H, "content-type": "application/json" },
      body: "{}",
    });
    const railText = await railRes.text();
    const viewRes2 = await fetch(SUPABASE_URL + "/rest/v1/rpc/profile_view", {
      method: "POST",
      headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ p_handle: SHARED, p_as_public: false }),
    });
    const viewText2 = await viewRes2.text();
    const UNSHARED_NAMES = ["Kwame Mensah", "Adaeze Nwosu"];
    record(
      "ruling 141: anon public_attestations names no member who does not share",
      railRes.status === 200 &&
        !UNSHARED_NAMES.some((n) => railText.includes(n)) &&
        /the host|a Space lead/.test(railText),
      railText.slice(0, 160),
    );
    record(
      "ruling 141: anon profile_view of the shared profile names no third party who does not share",
      viewRes2.status === 200 && !UNSHARED_NAMES.some((n) => viewText2.includes(n)),
      (viewText2.match(/Attested by [^"]+/) || [])[0],
    );
    // Brief 4 (ruling 156): the anonymous REST surface returns nothing from Connect. Tables and the
    // projections alike; a 200 with zero rows or a 401/403 are the same answer.
    const connectTables = [
      "edges?select=*",
      "member_connections?select=*",
      "second_degree?select=*",
      "connection_requests?select=*",
      "dismissed_suggestions?select=*",
      "member_corridors?select=*",
      "member_embeddings?select=*",
      "member_blocks?select=*",
    ];
    for (const q of connectTables) {
      const r = await rest(q);
      const zero =
        (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) ||
        r.status === 401 ||
        r.status === 403 ||
        r.status === 404;
      record(
        "ruling 156: anon " + q.split("?")[0] + " returns nothing",
        zero,
        "status " + r.status + " " + r.text.slice(0, 100),
      );
    }
    for (const [fn, body] of [
      ["connect_cards", { p_lens: "members" }],
      ["connect_where", {}],
      ["connect_filter_options", {}],
      ["send_introduction", { p_recipient: UNSHARED_ID, p_message: "x" }],
    ]) {
      const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: { ...H, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const t = await r.text();
      record(
        "ruling 156: anon " + fn + " is refused or empty",
        r.status === 401 || r.status === 403 || r.status === 404 || t === "null" || t === "",
        "status " + r.status + " " + t.slice(0, 100),
      );
      record("via_count never in an anonymous payload from " + fn, !t.includes("via_count"));
    }
    const connectPage = await get(BASE + "/connect");
    record(
      "ruling 156: /connect served HTML carries no card, tile or filter",
      connectPage.status === 200 &&
        !/member-card|place-tile|Show members there|Connect lens/.test(connectPage.text) &&
        /name="robots"[^>]+content="noindex"|content="noindex"[^>]+name="robots"/.test(
          connectPage.text,
        ),
      "status " + connectPage.status,
    );
    const all = await rest("members?select=handle");
    record(
      "check 3: anon sees only shared handles in members",
      all.status === 200 &&
        Array.isArray(all.body) &&
        all.body.every((m) => m.handle === SHARED || m.handle !== UNSHARED),
      JSON.stringify(all.body).slice(0, 120),
    );

    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // Ruling 218: the standing arms for Fix PR 01. The checks above are the anonymous surface;
    // F1, F2b, F3, F4 and F5 are signed-in findings and none could be caught from an anonymous
    // key, which is why the pass had to find them by hand.
    //
    // Two accounts, both supplied by the runner, never by this file (no secrets in the repo).
    // OWNER_EMAIL/OWNER_PASSWORD owns the fixture; MEMBER_EMAIL/MEMBER_PASSWORD is a signed-in
    // member who is NOT connected to them. Without both, the arms report unproven (ruling 228).
    //
    // The arms BUILD the fixture they need and restore it, rather than assuming a seeded state.
    // Assuming was a real defect: the first version read the fixture owner as SHARED, so it would
    // have set audiences on the account it signed in as and asserted them against a different
    // member. The owner is now read from their own session.
    // -----------------------------------------------------------------------------------------
    const OWNER_EMAIL = process.env.OWNER_EMAIL;
    const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
    const MEMBER_EMAIL = process.env.MEMBER_EMAIL;
    const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD;
    const GATED_KEYS = [
      "origin_country",
      "current_place",
      "current_country",
      "local_tz",
      "stance",
      "stance_label",
    ];

    const signIn = async (email, password) => {
      const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await r.json().catch(() => null);
      return body && body.access_token ? body.access_token : null;
    };
    const memberRest = async (token, q, init = {}) => {
      const r = await fetch(SUPABASE_URL + "/rest/v1/" + q, {
        ...init,
        headers: {
          apikey: KEY,
          Authorization: "Bearer " + token,
          "content-type": "application/json",
          ...(init.headers || {}),
        },
      });
      const text = await r.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {}
      return { status: r.status, body, text };
    };
    const memberRpc = (token, fn, args) =>
      memberRest(token, "rpc/" + fn, { method: "POST", body: JSON.stringify(args) });
    /** The one write path for an audience and for the switches (CLAUDE.md: one write path). */
    const saveSection = (token, section, payload) =>
      memberRpc(token, "save_profile_section", { section, payload });
    /** Teardown only: save_profile_section sets an audience but cannot unset one, and a row left
     *  behind is not the state the project was in. member_visibility carries an owner delete. */
    const clearAudience = (token, ownerId, section) =>
      memberRest(token, "member_visibility?member_id=eq." + ownerId + "&section=eq." + section, {
        method: "DELETE",
      });

    if (!OWNER_EMAIL || !OWNER_PASSWORD || !MEMBER_EMAIL || !MEMBER_PASSWORD) {
      skip(
        "ruling 218: the signed-in, fixture and block arms (F1, F2a, F2b, F3, F4, F5)",
        "set OWNER_EMAIL, OWNER_PASSWORD, MEMBER_EMAIL and MEMBER_PASSWORD",
      );
    } else {
      const ownerToken = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
      const memberToken = await signIn(MEMBER_EMAIL, MEMBER_PASSWORD);
      record(
        "ruling 218: both test members sign in",
        !!ownerToken && !!memberToken,
        ownerToken ? (memberToken ? "" : "member sign-in failed") : "owner sign-in failed",
      );
      if (!ownerToken || !memberToken)
        skip("ruling 218: every signed-in arm", "sign-in did not return an access token");

      // -------------------------------------------------------------------------------------
      // Convene Pass 1, PR 2: place-resolve, one check per state and per anchor (the handoff's
      // four calls, plus Session 23's unavailable state and place anchoring). The function
      // reaches the project by the founder's deploy from the Supabase dashboard, so a 404 from
      // the gateway means it is not deployed yet and the arms report unproven (ruling 228), never
      // passing and never failing on an absence. A 401 without a token is asserted first because
      // it needs no deployment secret to be true once the function is there.
      // What these arms cannot prove: a Mapbox outage, a bad token or a timeout on the deployed
      // function, because breaking the founder's secret is not a test. The transport half of the
      // unavailable state (a non-200 from the gateway) is proven here as the 400 an invalid
      // session_token earns, which the client maps to `unavailable`; the function's own
      // `unavailable` body is proven on the unanchored call it refuses.
      // -------------------------------------------------------------------------------------
      if (ownerToken) {
        const fn = SUPABASE_URL + "/functions/v1/place-resolve";
        const call = async (body, token) => {
          const r = await fetch(fn, {
            method: "POST",
            headers: {
              apikey: KEY,
              ...(token ? { Authorization: "Bearer " + token } : {}),
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const text = await r.text();
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch {}
          return { status: r.status, body: parsed, text, retryAfter: r.headers.get("retry-after") };
        };
        const session = "live-" + Date.now().toString(36) + "-arms";
        const ACCRA = { lng: -0.187, lat: 5.6037 };
        const NAIROBI = { lng: 36.8219, lat: -1.2921 };
        // Session 24 (783, 796, 797): the host-set country is the anchor of every lookup and a home
        // narrows inside it; proximity alone anchors nothing. Every call below carries the country
        // the form would send.
        const probe = await call(
          {
            action: "suggest",
            q: "Front Room",
            session_token: session,
            country_name: "Ghana",
            proximity: ACCRA,
          },
          ownerToken,
        );
        if (probe.status === 404) {
          skip(
            "place-resolve: the handoff calls (one, several, none, unavailable, 401)",
            "function not deployed on the project (gateway 404)",
          );
        } else {
          const noJwt = await call({
            action: "suggest",
            q: "Front Room",
            session_token: session,
            country_name: "Ghana",
          });
          record(
            "place-resolve: a call without a JWT returns 401",
            noJwt.status === 401,
            "status " + noJwt.status,
          );
          // A Mapbox answer: one, several or none. `unavailable` here means the deployed function
          // got no answer, which is a real failure and reads as one.
          const answered = ["one", "several", "none"];
          const typed = (r) =>
            r.status === 200 &&
            r.body &&
            answered.includes(r.body.state) &&
            (r.body.state !== "several" || Array.isArray(r.body.places));
          const placesOf = (r) =>
            r.body && r.body.state === "one"
              ? [r.body.place]
              : r.body && r.body.state === "several"
                ? r.body.places
                : [];
          const firstOf = (r) =>
            placesOf(r)
              .map((p) => p.place_id)
              .join(",");
          const brief = (r) => r.status + " " + r.text.slice(0, 60);
          const inCountry = (r, name) => typed(r) && placesOf(r).every((p) => p.country === name);

          // Proof 1: a country and a home. Front Room in Ghana near Accra is the founder's own case;
          // in Kenya near Nairobi the same words.
          const nairobi = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: session,
              country_name: "Kenya",
              proximity: NAIROBI,
            },
            ownerToken,
          );
          const accra = probe;
          record(
            "place-resolve: Front Room in Kenya near Nairobi and in Ghana near Accra both answer (one, several or none)",
            typed(nairobi) && typed(accra),
            "nairobi " + brief(nairobi) + " | accra " + brief(accra),
          );
          // The row: `one` is already retrieved; `several` is retrieved here for its first place, in
          // the same session, the way the form's pick does. Either way the row carries the point
          // and the zone. Ghana holds no POI (G35), so the row is taken from the United Kingdom,
          // which does.
          const ukList = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: session,
              country_name: "United Kingdom",
            },
            ownerToken,
          );
          const first = placesOf(ukList)[0];
          const row =
            ukList.body && ukList.body.state === "one"
              ? ukList
              : first
                ? await call(
                    {
                      action: "retrieve",
                      q: "Front Room",
                      session_token: session,
                      mapbox_id: first.place_id,
                    },
                    ownerToken,
                  )
                : null;
          record(
            "place-resolve: a resolved row carries the place, the coordinates and the zone (proof 1)",
            !!row &&
              row.status === 200 &&
              row.body &&
              row.body.state === "one" &&
              typeof row.body.place.timezone === "string" &&
              row.body.place.timezone.includes("/") &&
              Number.isFinite(row.body.place.lng) &&
              Number.isFinite(row.body.place.lat) &&
              !!row.body.place.label,
            row ? brief(row) : "no suggestion to retrieve: uk " + brief(ukList),
          );
          // 633: a home narrows the lookup inside the country. Two proximities in one country give
          // two orderings where Search Box knows the name near at least one of them; Portland,
          // Maine and Los Angeles each have a Front Room.
          const portland = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: session,
              country_name: "United States",
              proximity: { lng: -70.2553, lat: 43.6591 },
            },
            ownerToken,
          );
          const losAngeles = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: session,
              country_name: "United States",
              proximity: { lng: -118.2437, lat: 34.0522 },
            },
            ownerToken,
          );
          if (
            portland.body &&
            losAngeles.body &&
            portland.body.state === "none" &&
            losAngeles.body.state === "none"
          )
            skip(
              "place-resolve: a home changes the ordering inside the country (633)",
              "both calls returned none",
            );
          else
            record(
              "place-resolve: a home changes the ordering inside the country (633)",
              typed(portland) &&
                typed(losAngeles) &&
                inCountry(portland, "United States") &&
                inCountry(losAngeles, "United States") &&
                firstOf(portland) !== firstOf(losAngeles),
              "portland " +
                firstOf(portland).slice(0, 40) +
                " | los angeles " +
                firstOf(losAngeles).slice(0, 40),
            );

          // The country filters (783). The name is what the form sends: a public.world_countries
          // name the host chose; the function resolves it to alpha-2 through ICU and sends Search
          // Box `country`. Every place that comes back is in that country. Ghana is the founder's
          // case; Search Box carries no POI for Ghana (docs/GAPS.md G35), so the honest Ghana
          // answer is `none` or an area, and the filter itself is shown on a country it does cover.
          const ghana = await call(
            { action: "suggest", q: "Front Room", session_token: session, country_name: "Ghana" },
            ownerToken,
          );
          record(
            "place-resolve: country Ghana, no home: a Mapbox answer with nothing outside Ghana",
            inCountry(ghana, "Ghana"),
            brief(ghana),
          );
          record(
            "place-resolve: country United Kingdom: results, all in the United Kingdom (the country filter and the ICU conversion)",
            inCountry(ukList, "United Kingdom") && placesOf(ukList).length > 0,
            brief(ukList),
          );
          // A home narrows inside the country and never widens it: United Kingdom with a Nairobi
          // home still answers only the United Kingdom.
          const both = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: session,
              proximity: NAIROBI,
              country_name: "United Kingdom",
            },
            ownerToken,
          );
          record(
            "place-resolve: a home narrows inside the chosen country and never widens it (783, 633)",
            inCountry(both, "United Kingdom") && placesOf(both).length > 0,
            brief(both),
          );
          // Proximity alone anchors nothing (783): a home without a country is not a lookup.
          const homeOnly = await call(
            { action: "suggest", q: "Front Room", session_token: session, proximity: ACCRA },
            ownerToken,
          );
          record(
            "place-resolve: a home with no country is unavailable without a call (783)",
            homeOnly.status === 200 && homeOnly.body && homeOnly.body.state === "unavailable",
            brief(homeOnly),
          );
          // The three stored spellings ICU renders otherwise anchor through the function's own
          // spellings (Session 24): Cabo Verde was case 3 in Session 23 and is a country now.
          const caboVerde = await call(
            { action: "anchor", q: "", session_token: session, country_name: "Cabo Verde" },
            ownerToken,
          );
          record(
            "place-resolve: a stored spelling ICU renders otherwise (Cabo Verde) anchors, never case 3",
            caboVerde.status === 200 &&
              caboVerde.body &&
              caboVerde.body.state === "anchored" &&
              caboVerde.body.country === "CV",
            brief(caboVerde),
          );

          // Session 24, proof 1 owed: every public.world_countries name either anchors the lookup
          // or returns unavailable, and none falls through to an unanchored or a differently
          // anchored call. The dry run resolves the name exactly as suggest does and calls Mapbox
          // never, so the walk costs nothing upstream. The list is read the way the form reads
          // it, from the table under the member's own grant.
          const wc = await fetch(
            SUPABASE_URL + "/rest/v1/world_countries?select=name&order=position",
            { headers: { apikey: KEY, Authorization: "Bearer " + ownerToken } },
          );
          const wcRows = wc.ok ? await wc.json() : null;
          const wcNames = Array.isArray(wcRows) ? wcRows.map((r) => r.name).filter(Boolean) : [];
          if (wcNames.length === 0) {
            skip(
              "place-resolve: every world_countries name anchors or is unavailable",
              "world_countries returned no rows (status " + wc.status + ")",
            );
          } else {
            const walk = [];
            for (const name of wcNames) {
              const r = await call(
                { action: "anchor", q: "", session_token: session, country_name: name },
                ownerToken,
              );
              walk.push({
                name,
                status: r.status,
                state: r.body && r.body.state,
                code: r.body && r.body.country,
                zones: r.body && r.body.zones,
                zones_via: r.body && r.body.zones_via,
              });
            }
            const offShape = walk.filter(
              (w) => w.status !== 200 || (w.state !== "anchored" && w.state !== "unavailable"),
            );
            const unresolved = walk.filter((w) => w.state !== "anchored").map((w) => w.name);
            const codes = new Map();
            for (const w of walk)
              if (w.state === "anchored") codes.set(w.code, [...(codes.get(w.code) || []), w.name]);
            const shared = [...codes.entries()].filter(([, v]) => v.length > 1);
            record(
              "place-resolve: every world_countries name anchors or is unavailable, never a third thing (" +
                wcNames.length +
                " names)",
              offShape.length === 0,
              offShape.length ? JSON.stringify(offShape.slice(0, 3)) : wcNames.length + " walked",
            );
            record(
              "place-resolve: every world_countries name anchors to its own current alpha-2 code (" +
                wcNames.length +
                " names)",
              // Every name anchored, not merely none unavailable: run 248's first attempt passed
              // this vacuously against the old build, which answered none to every dry run.
              walk.filter((w) => w.state === "anchored").length === wcNames.length &&
                shared.length === 0 &&
                wcNames.length >= 195,
              (unresolved.length ? "unresolved " + JSON.stringify(unresolved) + " " : "") +
                (shared.length ? "shared " + JSON.stringify(shared) : "") +
                (unresolved.length || shared.length ? "" : "all " + wcNames.length + " distinct"),
            );

            // Rulings 813, 817, 822: the same walk carries the zones the form now derives a
            // words-only event's time zone from, so this settles on the deployed Deno runtime what
            // the Node probe could not — which shape of the Intl Locale Info API it carries, and
            // whether any stored name comes back with no zone at all. A country with none is not a
            // failure of this arm's first clause (the form falls back rather than guessing), but it
            // is named here, because a host in it silently keeps the old behaviour.
            const zoned = walk.filter((w) => Array.isArray(w.zones) && w.zones.length > 0);
            const zoneless = walk.filter((w) => w.state === "anchored" && !zoned.includes(w));
            const zonesOf = (name) => {
              const w = walk.find((x) => x.name === name);
              return w && Array.isArray(w.zones) ? w.zones : [];
            };
            const via = [...new Set(walk.map((w) => w.zones_via).filter(Boolean))];
            record(
              "place-resolve: anchor carries the country's IANA zones, one for Ghana, two for the DRC, more than five for the United States, at least one for all " +
                wcNames.length +
                " names (813, 817)",
              zonesOf("Ghana").length === 1 &&
                zonesOf("Ghana")[0] === "Africa/Accra" &&
                zonesOf("Democratic Republic of the Congo").length === 2 &&
                zonesOf("United States").length > 5 &&
                zoneless.length === 0 &&
                zoned.length === wcNames.length,
              "via " +
                (via.join(",") || "none") +
                (zoneless.length
                  ? " | no zones for " + JSON.stringify(zoneless.map((w) => w.name).slice(0, 5))
                  : " | all " + zoned.length + " carry at least one"),
            );
          }

          // Session 23, change 2: place, locality and neighborhood join poi and address, because
          // Search Box holds no POI and no street addressing in Ghana. Osu in Ghana near Accra
          // answers an area, and the row says so through kind.
          const osu = await call(
            {
              action: "suggest",
              q: "Osu",
              session_token: session,
              country_name: "Ghana",
              proximity: ACCRA,
            },
            ownerToken,
          );
          const osuPlaces = placesOf(osu);
          record(
            "place-resolve: Osu near Accra answers an area (place, locality or neighborhood) with kind area (change 2)",
            typed(osu) &&
              osuPlaces.length > 0 &&
              osuPlaces.some((p) => p.kind === "area" && /osu/i.test(p.place_name || "")),
            brief(osu),
          );
          // Ruling 927, read on the deployed function rather than on the payload: every place
          // place-resolve answers carries `region` — a string where Mapbox's context held one, null
          // where it did not. Never absent, because a surface that wants to name a region must be
          // able to tell "Mapbox gave none" from "this build drops it", and never derived from the
          // city or the country, which is 790's guardrail. Which regions Mapbox actually knows is
          // Mapbox's business and is reported rather than asserted; the contract is the key and its
          // type. This is the Ghana side of Pass 5's column — G35 means Ghana returns areas rather
          // than venues, so this is the Ghana reading that exists to be taken.
          record(
            "place-resolve: every place carries a region, a string or null, never absent (927)",
            osuPlaces.length > 0 &&
              osuPlaces.every(
                (p) => "region" in p && (typeof p.region === "string" || p.region === null),
              ),
            "Ghana/Osu regions " + JSON.stringify(osuPlaces.map((p) => p.region)),
          );
          record(
            "place-resolve: a venue row carries kind venue and an area row kind area (change 2)",
            placesOf(ukList).every((p) => p.kind === "venue" || p.kind === "area") &&
              placesOf(ukList).some((p) => p.kind === "venue"),
            JSON.stringify(placesOf(ukList).map((p) => p.kind)).slice(0, 80),
          );

          // Proof 3: nonsense, anchored, is Mapbox's own zero: `none`.
          const noPlace = await call(
            {
              action: "suggest",
              q: "xq7zv plk9 wmmt",
              session_token: session,
              country_name: "Ghana",
              proximity: ACCRA,
            },
            ownerToken,
          );
          record(
            "place-resolve: a nonsense string returns none (proof 3)",
            noPlace.status === 200 && noPlace.body && noPlace.body.state === "none",
            brief(noPlace),
          );

          // Proof 4: a deliberately broken call. An invalid session_token is refused before Mapbox
          // with a 400, which the client reads as `unavailable`; the function's own `unavailable`
          // body is the unanchored call (case 3: never the Edge node's IP).
          const badSession = await call(
            {
              action: "suggest",
              q: "Front Room",
              session_token: "no",
              country_name: "Ghana",
              proximity: ACCRA,
            },
            ownerToken,
          );
          record(
            "place-resolve: an invalid session_token is a 400 with an unavailable body, never none (proof 4)",
            badSession.status === 400 && badSession.body && badSession.body.state === "unavailable",
            brief(badSession),
          );
          const unanchored = await call(
            { action: "suggest", q: "Front Room", session_token: session },
            ownerToken,
          );
          record(
            "place-resolve: no home and no country is unavailable without a call (never the Edge node's IP)",
            unanchored.status === 200 && unanchored.body && unanchored.body.state === "unavailable",
            brief(unanchored),
          );

          // Proof 5: under three characters is `none` before anchoring and before Mapbox.
          const short = await call(
            { action: "suggest", q: "Fr", session_token: session, country_name: "Ghana" },
            ownerToken,
          );
          record(
            "place-resolve: under three characters is none without a lookup (proof 5)",
            short.status === 200 && short.body && short.body.state === "none",
            "status " + short.status,
          );
        }
      }

      if (ownerToken && memberToken) {
        // The fixture owner is whoever OWNER_EMAIL signs in as, read from their own session:
        // profile_view() with no handle returns the caller's own profile, switches included.
        const ownerView = await memberRpc(ownerToken, "profile_view", {});
        const om = (ownerView.body && ownerView.body.member) || {};
        const ownerId = om.id;
        const ownerHandle = om.handle;
        const ownerOrigin = om.origin_country || null;
        const ownerWasShared = !!(
          ownerView.body &&
          ownerView.body.switches &&
          ownerView.body.switches.shared
        );
        const memberSelf = await memberRpc(memberToken, "profile_view", {});
        const memberId = memberSelf.body && memberSelf.body.member && memberSelf.body.member.id;
        const memberHandle =
          memberSelf.body && memberSelf.body.member && memberSelf.body.member.handle;
        record(
          "ruling 218: the fixture owner and the viewer are two different members",
          !!ownerId && !!memberId && ownerId !== memberId,
          "owner " + ownerHandle + " (" + ownerId + ") viewer " + memberId,
        );
        // The viewer must be a stranger, or F2b, F3 and F5 assert the wrong thing.
        const relToOwner =
          ownerHandle &&
          (await memberRpc(memberToken, "profile_view", { p_handle: ownerHandle })).body;
        const relState =
          relToOwner && relToOwner.relationship ? relToOwner.relationship.state : "none";
        if (relState === "connected")
          skip(
            "ruling 218: the fixture arms (F2a, F2b, F3, F5)",
            "the two test accounts are connected; the arms need a stranger",
          );

        // ARM 1 (F1, gate IB-1). A signed-in member reads the identity columns of public.members
        // and nothing else. Before ruling 212 this returned every column of every row.
        if (!memberId) skip("F1: the signed-in member arm", "the viewer's own id did not resolve");
        if (memberId) {
          const identity = await memberRest(memberToken, "members?select=" + CORE_COLS);
          const gatedCols = await memberRest(memberToken, "members?select=" + GATED_COLS);
          const switchCols = await memberRest(
            memberToken,
            "members?select=profile_private,profile_shared,identified_at,updated_at",
          );
          record(
            "F1: a signed-in member reads the identity columns of members",
            identity.status === 200 && Array.isArray(identity.body) && identity.body.length > 0,
            "status " + identity.status + " rows " + (identity.body || []).length,
          );
          record(
            "F1: a signed-in member cannot read the section-gated columns of members",
            gatedCols.status === 401 || gatedCols.status === 403,
            "status " + gatedCols.status + " " + gatedCols.text.slice(0, 80),
          );
          record(
            "F1: a signed-in member cannot read the switches, identified_at or updated_at",
            switchCols.status === 401 || switchCols.status === 403,
            "status " + switchCols.status + " " + switchCols.text.slice(0, 80),
          );
        }

        const canFixture = !!ownerId && !!ownerHandle && relState !== "connected";
        // ARM 2 (F2a, F2b, F5, gates IB-2 and IB-5). Origin, Where and Stance set to My
        // connections on a profile the viewer is not connected to, so the section audience and the
        // core row disagree. Omit, never blank: the assertion is that the key is absent.
        const SECTIONS = ["origin", "where", "stance"];
        let prior = new Map();
        if (canFixture) {
          const priorVis = await memberRest(
            ownerToken,
            "member_visibility?member_id=eq." + ownerId + "&select=section,audience",
          );
          prior = new Map(
            (Array.isArray(priorVis.body) ? priorVis.body : []).map((r) => [r.section, r.audience]),
          );
          let fixtureSet = true;
          for (const section of SECTIONS) {
            const r = await saveSection(ownerToken, "visibility", {
              section,
              audience: "connections",
            });
            if (r.status >= 300) fixtureSet = false;
          }
          // The anonymous half of F2a needs a profile anon may read at all. Restored below.
          const sharedOn = await saveSection(ownerToken, "switches", { shared: true });
          if (sharedOn.status >= 300) fixtureSet = false;
          record(
            "F2: the fixture sets Origin, Where and Stance to connections and shares the profile",
            fixtureSet,
          );

          const cardOf = async (token, handle) => {
            const r = await memberRpc(token, "connect_cards", { p_lens: "members" });
            const items = (r.body && r.body.items) || [];
            return items.find((i) => i.handle === handle) || null;
          };
          const gatedView = await memberRpc(memberToken, "profile_view", { p_handle: ownerHandle });
          const gatedMember = (gatedView.body && gatedView.body.member) || {};
          record(
            "F2b: profile_view.member carries no origin, place, time zone or stance for a stranger",
            gatedView.status === 200 && GATED_KEYS.every((k) => !(k in gatedMember)),
            "keys " + Object.keys(gatedMember).join(","),
          );
          record(
            "F2b: profile_view.member still carries name, handle and tier",
            !!gatedMember.name && !!gatedMember.handle && "tier" in gatedMember,
            "keys " + Object.keys(gatedMember).join(","),
          );
          const gatedCard = await cardOf(memberToken, ownerHandle);
          record(
            "F2b: the Connect card carries no place, origin or stance label",
            !!gatedCard &&
              !("place" in gatedCard) &&
              !("origin" in gatedCard) &&
              !("stance_label" in gatedCard),
            gatedCard ? Object.keys(gatedCard).join(",") : "no card for " + ownerHandle,
          );
          record(
            "F2b: the Connect card still carries name and handle",
            !!gatedCard && !!gatedCard.name && !!gatedCard.handle,
            gatedCard ? Object.keys(gatedCard).join(",") : "no card",
          );
          // F2a: the same fixture read with no session at all.
          const anonGated = await fetch(SUPABASE_URL + "/rest/v1/rpc/profile_view", {
            method: "POST",
            headers: { ...H, "content-type": "application/json" },
            body: JSON.stringify({ p_handle: ownerHandle, p_as_public: false }),
          });
          const anonGatedText = await anonGated.text();
          const anonGatedBody = JSON.parse(anonGatedText || "null");
          const anonMember = (anonGatedBody && anonGatedBody.member) || null;
          if (!anonMember)
            skip(
              "F2a: the anonymous projection carries none of the gated attributes",
              "the anonymous projection returned null, so there is no member object to inspect",
            );
          if (anonMember)
            record(
              "F2a: the anonymous projection carries none of the gated attributes",
              GATED_KEYS.every((k) => !(k in anonMember)),
              "keys " + Object.keys(anonMember).join(","),
            );
          if (!ownerOrigin)
            skip(
              "F5: the origin axis does not return a member who withheld Origin",
              "the fixture owner has no origin_country, so there is no value to filter on",
            );
          if (ownerOrigin) {
            const byOrigin = await memberRpc(memberToken, "connect_cards", {
              p_lens: "members",
              p_filters: { origin: ownerOrigin },
            });
            const originItems = (byOrigin.body && byOrigin.body.items) || [];
            record(
              "F5: the origin axis does not return a member who withheld Origin",
              !originItems.some((i) => i.handle === ownerHandle),
              "filter origin=" +
                ownerOrigin +
                " returned " +
                (originItems.map((i) => i.handle).join(",") || "no items"),
            );
          }

          // ARM 3 (F3, gate IB-3). The whole-profile Private switch, on the same fixture.
          const privOn = await saveSection(ownerToken, "switches", { private: true });
          record(
            "F3: the fixture sets the Private switch",
            privOn.status < 300,
            "status " + privOn.status,
          );
          const privView = await memberRpc(memberToken, "profile_view", { p_handle: ownerHandle });
          record(
            "F3: a non-connection's handle lookup of a Private member returns null",
            privView.status === 200 && (privView.text === "null" || privView.body === null),
            privView.text.slice(0, 80),
          );
          record(
            "F3: a Private member is absent from Members for a non-connection",
            (await cardOf(memberToken, ownerHandle)) === null,
          );
          const privIntro = await memberRpc(memberToken, "send_introduction", {
            p_recipient: ownerId,
            p_message: "Hello, I would like to connect.",
          });
          record(
            "F3: send_introduction refuses a Private recipient with the standard message",
            privIntro.status >= 400 && /not available/.test(privIntro.text),
            "status " + privIntro.status + " " + privIntro.text.slice(0, 90),
          );
          const privAnon = await fetch(SUPABASE_URL + "/rest/v1/rpc/profile_view", {
            method: "POST",
            headers: { ...H, "content-type": "application/json" },
            body: JSON.stringify({ p_handle: ownerHandle, p_as_public: false }),
          });
          const privAnonText = await privAnon.text();
          record(
            "F3: the anonymous surface returns null for a Private member, even a shared one",
            privAnon.status === 200 && (privAnonText === "null" || privAnonText === ""),
            privAnonText.slice(0, 80),
          );
          const privOff = await saveSection(ownerToken, "switches", { private: false });
          record(
            "F3: the Private switch is restored",
            privOff.status < 300,
            "status " + privOff.status,
          );

          // Teardown for arm 2: the audiences the owner had, and the Share switch as it was.
          let restored = true;
          for (const section of SECTIONS) {
            const before = prior.get(section);
            const r = before
              ? await saveSection(ownerToken, "visibility", { section, audience: before })
              : await clearAudience(ownerToken, ownerId, section);
            if (r.status >= 300) restored = false;
          }
          const sharedBack = await saveSection(ownerToken, "switches", { shared: ownerWasShared });
          if (sharedBack.status >= 300) restored = false;
          const afterVis = await memberRest(
            ownerToken,
            "member_visibility?member_id=eq." + ownerId + "&select=section,audience",
          );
          const after = new Map(
            (Array.isArray(afterVis.body) ? afterVis.body : []).map((r) => [r.section, r.audience]),
          );
          const afterOwn = await memberRpc(ownerToken, "profile_view", {});
          const sharedNow = !!(
            afterOwn.body &&
            afterOwn.body.switches &&
            afterOwn.body.switches.shared
          );
          record(
            "ruling 218: the audience and Share fixture is torn down and the profile is as it was",
            restored &&
              after.size === prior.size &&
              [...prior].every(([k, v]) => after.get(k) === v) &&
              sharedNow === ownerWasShared,
            "audiences " +
              ([...after].map(([k, v]) => k + "=" + v).join(",") || "none") +
              " shared " +
              sharedNow,
          );
        }

        // ARM 4 (F4, gate IB-4). A real block, and the Feed and everything hanging off a post.
        // The arm publishes a post as the owner when they have none, because asserting "the
        // blocker reads zero of the blocked member's posts" against a member with zero posts
        // passes while proving nothing — the exact shape ruling 228 exists to prevent.
        if (!memberId || !ownerId) skip("F4: the block arm", "the two member ids did not resolve");
        if (memberId && ownerId) {
          let ownerPosts = await memberRest(
            ownerToken,
            "feed?author_id=eq." + ownerId + "&select=id",
          );
          let postIds = (Array.isArray(ownerPosts.body) ? ownerPosts.body : []).map((p) => p.id);
          let seededPostId = null;
          if (!postIds.length) {
            const pub = await memberRpc(ownerToken, "publish_post", {
              payload: {
                body: "Ruling 218 block arm fixture. Deleted by the same run.",
                author_kind: "member",
                author_id: ownerId,
                audience: "everyone",
                host_context: "live-checks",
              },
            });
            if (pub.status < 300 && typeof pub.body === "string") {
              seededPostId = pub.body;
              postIds = [seededPostId];
            }
            record(
              "F4: the arm publishes a post as the owner so the block has something to hide",
              !!seededPostId,
              "status " + pub.status + " " + pub.text.slice(0, 90),
            );
          }
          if (!postIds.length) {
            skip(
              "F4: the blocker reads zero of the blocked member's posts",
              "the fixture owner has no visible posts and one could not be published, so a zero-row result would prove nothing",
            );
          } else {
            const blockIn = await memberRest(memberToken, "member_blocks", {
              method: "POST",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({ blocker_id: memberId, blocked_id: ownerId }),
            });
            record(
              "F4: the viewer blocks the other member",
              blockIn.status < 300,
              "status " + blockIn.status + " " + blockIn.text.slice(0, 80),
            );
            const blockedFeed = await memberRest(
              memberToken,
              "feed?author_id=eq." + ownerId + "&select=id",
            );
            record(
              "F4: the blocker reads zero of the blocked member's " + postIds.length + " post(s)",
              blockedFeed.status === 200 &&
                Array.isArray(blockedFeed.body) &&
                blockedFeed.body.length === 0,
              "status " + blockedFeed.status + " rows " + (blockedFeed.body || []).length,
            );
            const inList = "(" + postIds.join(",") + ")";
            const media = await memberRest(
              memberToken,
              "post_media?post_id=in." + inList + "&select=post_id",
            );
            const links = await memberRest(
              memberToken,
              "post_links?post_id=in." + inList + "&select=post_id",
            );
            record(
              "F4: nothing hanging off those posts reaches the blocker either",
              [media, links].every(
                (r) => r.status === 200 && Array.isArray(r.body) && r.body.length === 0,
              ),
              "media " + (media.body || []).length + " links " + (links.body || []).length,
            );

            // Brief 4A, section 7's acceptance test, live and as a real member, with the block
            // above in place. The blocker is MEMBER_EMAIL and the blocked party is OWNER_EMAIL.
            //
            // The one thing that must never differ between a blocked party and a stranger is
            // anything naming the block. `viewer_blocked` is the caller's own row, so it is true
            // for the blocker and false for the blocked party, which is what an unblocked stranger
            // reads too. The relationship object is absent for both, per ruling 198.
            if (!ownerHandle || !memberHandle) {
              skip(
                "B4A section 7: the blocked party's projection, live",
                "one of the two handles did not resolve, so there is nothing to read",
              );
            } else {
              const blockerSees = await memberRpc(memberToken, "profile_view", {
                p_handle: ownerHandle,
              });
              record(
                "B4A section 4: the blocker's own block reaches them as viewer_blocked",
                blockerSees.status === 200 &&
                  !!blockerSees.body &&
                  blockerSees.body.viewer_blocked === true &&
                  blockerSees.body.relationship === undefined,
                "viewer_blocked " +
                  JSON.stringify(blockerSees.body && blockerSees.body.viewer_blocked) +
                  " relationship " +
                  JSON.stringify(blockerSees.body && blockerSees.body.relationship),
              );
              const blockedSees = await memberRpc(ownerToken, "profile_view", {
                p_handle: memberHandle,
              });
              record(
                "B4A section 7: the blocked party's page still loads (ruling 198 item 4)",
                blockedSees.status === 200 &&
                  !!blockedSees.body &&
                  blockedSees.body.viewer === "member",
                "status " + blockedSees.status + " " + blockedSees.text.slice(0, 80),
              );
              // Every key naming a block state must be present and false, which is what an
              // unblocked stranger reads. Checked over the parsed keys rather than by matching the
              // serialised payload: run 114 failed this arm on a regex whose \\s* backtracked to
              // zero width, so the negative lookahead landed on the space before "false" and
              // reported a disclosure that the projection did not make.
              const blockedBody = blockedSees.body || {};
              const blockKeys = Object.keys(blockedBody).filter((k) => /block/i.test(k));
              const failed = [];
              if (blockedBody.viewer_blocked !== false) failed.push("viewer_blocked");
              if (blockedBody.relationship !== undefined) failed.push("relationship present");
              if ((blockedBody.mutuals || []).length !== 0) failed.push("mutuals");
              if ((blockedBody.shared_spaces || []).length !== 0) failed.push("shared_spaces");
              if (blockedBody.anchored === true) failed.push("anchored");
              if (blockedBody.dia_line !== undefined) failed.push("dia_line");
              const disclosing = blockKeys.filter((k) => blockedBody[k] !== false);
              if (disclosing.length) failed.push("keys " + disclosing.join(","));
              record(
                "B4A section 7: nothing in the blocked party's projection discloses the block",
                !!blockedSees.body && failed.length === 0,
                failed.length
                  ? failed.join("; ")
                  : "keys naming a block: " + (blockKeys.join(",") || "none"),
              );
            }
            const blockOut = await memberRest(
              memberToken,
              "member_blocks?blocker_id=eq." + memberId + "&blocked_id=eq." + ownerId,
              { method: "DELETE" },
            );
            const blocksLeft = await memberRest(
              memberToken,
              "member_blocks?blocker_id=eq." + memberId + "&select=blocked_id",
            );
            record(
              "ruling 218: the block is torn down and member_blocks is as it was",
              blockOut.status < 300 &&
                blocksLeft.status === 200 &&
                Array.isArray(blocksLeft.body) &&
                blocksLeft.body.length === 0,
              "status " + blockOut.status + " left " + (blocksLeft.body || []).length,
            );
            if (seededPostId) {
              const del = await memberRest(ownerToken, "posts?id=eq." + seededPostId, {
                method: "DELETE",
              });
              const gone = await memberRest(
                ownerToken,
                "posts?id=eq." + seededPostId + "&select=id",
              );
              record(
                "ruling 218: the seeded post is deleted and posts is as it was",
                del.status < 300 &&
                  gone.status === 200 &&
                  Array.isArray(gone.body) &&
                  gone.body.length === 0,
                "status " + del.status + " left " + (gone.body || []).length,
              );
            }
          }
          // Ruling 211: a block revokes edges and unblocking restores nothing. The two accounts
          // are deliberately unconnected, so this arm has nothing to restore and leaves the graph
          // unchanged. Pointing it at a connected pair would not.
        }

        // -------------------------------------------------------------------------------------
        // Brief 5 (Done Means 4, 5 and 8). Both test accounts completed onboarding once through
        // the real surface (tests/onboard-test-accounts.cjs, run from its workflow): Owner Test
        // touched a card, Member Test finished without touching. The live rows carry that
        // difference, the gate is closed for both, and a second finish is refused and changes
        // nothing. Read through onboarding_state(), the one read projection; the RPC is the one
        // path that could set onboarded_at, so a refused second call is the proof it is set once.
        // -------------------------------------------------------------------------------------
        const ownerState = await memberRpc(ownerToken, "onboarding_state", {});
        const memberState = await memberRpc(memberToken, "onboarding_state", {});
        const os = ownerState.body && typeof ownerState.body === "object" ? ownerState.body : null;
        const ms =
          memberState.body && typeof memberState.body === "object" ? memberState.body : null;
        record(
          "B5: both test accounts have onboarded, so the gate holds neither (Done Means 8)",
          !!os &&
            !!ms &&
            os.next === null &&
            ms.next === null &&
            !!os.onboarded_at &&
            !!ms.onboarded_at,
          "owner next=" +
            (os ? String(os.next) : "no state") +
            " member next=" +
            (ms ? String(ms.next) : "no state"),
        );
        record(
          "B5: Owner Test touched a card, so stance_declared_at is set (Done Means 4)",
          !!os && os.relationship && os.relationship.declared === true,
          os && os.relationship
            ? "declared " + os.relationship.declared + " stance " + os.relationship.stance
            : "no state",
        );
        record(
          "B5: Member Test finished without touching, so stance_declared_at is null and the default stands (Done Means 4)",
          !!ms &&
            ms.relationship &&
            ms.relationship.declared === false &&
            ms.relationship.stance === "exploring",
          ms && ms.relationship
            ? "declared " + ms.relationship.declared + " stance " + ms.relationship.stance
            : "no state",
        );
        const before = os ? os.onboarded_at : null;
        const again = await memberRpc(ownerToken, "onboard_relationship", {
          p_stance: "kin",
          p_touched: true,
        });
        const after = await memberRpc(ownerToken, "onboarding_state", {});
        const as = after.body && typeof after.body === "object" ? after.body : null;
        record(
          "B5: a second onboard_relationship is refused and onboarded_at does not change (Done Means 5)",
          again.status >= 400 &&
            /already complete/.test(JSON.stringify(again.body || "")) &&
            !!as &&
            as.onboarded_at === before &&
            !!os &&
            as.relationship.stance === os.relationship.stance,
          "status " +
            again.status +
            " onboarded_at " +
            (as ? as.onboarded_at : "?") +
            " was " +
            before,
        );
      }
    }
  }
  // -----------------------------------------------------------------------------------------
  // Brief 10 (handoff 30-C item 13; rulings 662, 680, 1028, 1029): the public page for an event
  // whose post is to everyone, as a crawler reads it. PUBLIC_EVENT names the slug; the projection
  // answering null for it reports the arm unproven rather than failing a deployment for a fixture
  // that moved. The event-media function is called signed out, the way the page and a crawler do.
  // -----------------------------------------------------------------------------------------
  if (process.env.SKIP_REST) {
    console.log("Brief 10 public page checks skipped (SKIP_REST)");
  } else if (!SUPABASE_URL || !KEY) {
    skip("Brief 10: the public page arm", "set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  } else {
    const PUBLIC_EVENT = process.env.PUBLIC_EVENT || "africa-sme-assembly-2026-cb6543";
    const H = { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json" };
    const rpcRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/event_public_page", {
      method: "POST",
      headers: H,
      body: JSON.stringify({ p_slug: PUBLIC_EVENT }),
    });
    let pub = null;
    try {
      pub = await rpcRes.json();
    } catch {}
    if (rpcRes.status !== 200 || !pub || typeof pub !== "object") {
      skip(
        "Brief 10: the public page arm",
        "event_public_page answered " +
          rpcRes.status +
          " " +
          JSON.stringify(pub).slice(0, 80) +
          " for PUBLIC_EVENT=" +
          PUBLIC_EVENT,
      );
    } else {
      const served = await get(BASE + "/e/" + PUBLIC_EVENT);
      const meta = (attr, name) =>
        new RegExp("<meta[^>]+" + attr + '="' + name + '"[^>]+content="([^"]*)"').exec(
          served.text,
        ) ||
        new RegExp('<meta[^>]+content="([^"]*)"[^>]+' + attr + '="' + name + '"').exec(served.text);
      record(
        "Brief 10 (662): the public page serves 200 signed out with its own render",
        served.status === 200 && served.text.includes('data-public-event="' + PUBLIC_EVENT + '"'),
        "status " + served.status,
      );
      record(
        "Brief 10 (item 10.6): the served markup carries og:title, og:description, og:url and twitter:card, and noindex",
        !!meta("property", "og:title") &&
          !!meta("property", "og:description") &&
          !!meta("property", "og:url") &&
          !!meta("name", "twitter:card") &&
          /name="robots"[^>]+content="noindex"|content="noindex"[^>]+name="robots"/.test(
            served.text,
          ),
        "og:title " + (meta("property", "og:title") || [])[1],
      );
      record(
        "Brief 10 (680): the served page carries no attendee row, no going line and no member RSVP control",
        !served.text.includes("data-going-row") &&
          !served.text.includes("data-event-going") &&
          // The going line's shape since handoff 41-C (src/lib/names.ts); the old shape is refused too,
          // so a served page carrying either reads as the line it must not carry.
          !/and others are going|are going, and others/.test(served.text) &&
          !served.text.includes("data-event-rsvp") &&
          !served.text.includes('data-testid="rsvp-going"'),
      );
      // Handoff 30-D item 8.1: the guest path's entry renders only for a free event that is neither
      // cancelled nor over, and the served markup says which this one is.
      const guestable =
        pub.event &&
        pub.event.ticket_kind === "free" &&
        pub.event.cancelled !== true &&
        pub.event.past !== true;
      record(
        "Handoff 30-D (item 8.1): the served page carries the guest affordance exactly when the event is free and not over",
        guestable
          ? served.text.includes("data-guest-rsvp") &&
              served.text.includes('data-testid="guest-going"') &&
              served.text.includes("You will be asked for an email so the door can reach you")
          : !served.text.includes("data-guest-rsvp") &&
              !served.text.includes('data-testid="guest-going"'),
        "ticket_kind " +
          (pub.event && pub.event.ticket_kind) +
          " past " +
          (pub.event && pub.event.past) +
          " cancelled " +
          (pub.event && pub.event.cancelled),
      );
      record(
        "Handoff 30-D (item 8.4): /e/{slug} answers Referrer-Policy no-referrer",
        (served.headers.get("referrer-policy") || "") === "no-referrer",
        served.headers.get("referrer-policy") || "no header",
      );
      // Handoff 30-D item 14.2: the two functions, on paths that send nothing. A tampered token is
      // 410 before any database call; a bad address is the database's own sentence at 400 with no
      // row recorded and no mail; event-mail refuses a call without a token at the gateway.
      const tampered = await fetch(SUPABASE_URL + "/functions/v1/guest-rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open", token: "not-a-link-anyone-minted.AAAA" }),
      });
      let tamperedBody = null;
      try {
        tamperedBody = await tampered.json();
      } catch {}
      record(
        "Handoff 30-D (1026): guest-rsvp answers 410 { expired: true } to a tampered token",
        tampered.status === 410 && !!tamperedBody && tamperedBody.expired === true,
        "status " + tampered.status + " " + JSON.stringify(tamperedBody).slice(0, 60),
      );
      const badAddress = await fetch(SUPABASE_URL + "/functions/v1/guest-rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request", slug: PUBLIC_EVENT, email: "not-an-address" }),
      });
      let badBody = null;
      try {
        badBody = await badAddress.json();
      } catch {}
      record(
        "Handoff 30-D (1026): guest-rsvp answers 400 with the database's own sentence to a bad address",
        badAddress.status === 400 && !!badBody && badBody.error === "That is not an email address.",
        "status " + badAddress.status + " " + JSON.stringify(badBody).slice(0, 80),
      );
      const noToken = await fetch(SUPABASE_URL + "/functions/v1/event-mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: "00000000-0000-4000-8000-000000000000" }),
      });
      try {
        await noToken.text();
      } catch {}
      record(
        "Handoff 30-D (1035): event-mail refuses a call without a token",
        noToken.status === 401,
        "status " + noToken.status,
      );
      const media = Array.isArray(pub.media) ? pub.media : [];
      const mediaUrl =
        SUPABASE_URL +
        "/functions/v1/event-media?e=" +
        PUBLIC_EVENT +
        "&m=" +
        (media[0] ? media[0].position : 0);
      if (media.length === 0) {
        skip(
          "Brief 10 (1029): the cover loads through event-media",
          "the event named by PUBLIC_EVENT carries no image",
        );
      } else {
        const cover = await fetch(mediaUrl);
        const ct = cover.headers.get("content-type") || "";
        const cc = cover.headers.get("cache-control") || "";
        try {
          await cover.arrayBuffer();
        } catch {}
        record(
          "Brief 10 (1029): the cover loads through event-media as an image with a day's public cache, and the page references it",
          cover.status === 200 &&
            ct.startsWith("image/") &&
            /public/.test(cc) &&
            /max-age=86400/.test(cc) &&
            served.text.includes("/functions/v1/event-media?e=" + PUBLIC_EVENT),
          "status " + cover.status + " " + ct + " " + cc,
        );
      }
      const noParty = await fetch(
        SUPABASE_URL +
          "/functions/v1/event-media?e=" +
          PUBLIC_EVENT +
          "&p=00000000-0000-4000-8000-000000000000",
      );
      const wrongMethod = await fetch(
        SUPABASE_URL + "/functions/v1/event-media?e=" + PUBLIC_EVENT + "&m=0",
        {
          method: "POST",
        },
      );
      record(
        "Brief 10 (1029): event-media answers 404 for a made-up party id and 405 for a POST",
        noParty.status === 404 && wrongMethod.status === 405,
        "party " + noParty.status + " post " + wrongMethod.status,
      );
      const missing = await get(BASE + "/e/this-slug-does-not-exist-000000");
      record(
        "Brief 10 (1028): a slug with no public page serves 404",
        missing.status === 404,
        "status " + missing.status,
      );
      // Handoff 32-B item 9 (1080, 1081, 1100, 1109): the event's alias and its short code answer a
      // permanent redirect to its slug on the worker, as a crawler reaches them, and an unknown code
      // is a 404. The alias and the code are read from the event's own row, signed in as the owner;
      // 000000 can never be a code (the column's check has no 0), so it is unknown by construction.
      const LINK_ARMS = {
        x: "Handoff 32-B item 9 (1081): /x/{code} answers 308 to /e/{slug}",
        e: "Handoff 32-B item 9 (1080, 1100): /e/{alias} answers 308 to /e/{slug}",
        unknown: "Handoff 32-B item 9 (1109): an unknown /x/ code answers 404",
      };
      let linkToken = null;
      if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
        const t = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
          method: "POST",
          headers: { apikey: KEY, "content-type": "application/json" },
          body: JSON.stringify({
            email: process.env.OWNER_EMAIL,
            password: process.env.OWNER_PASSWORD,
          }),
        });
        const body = await t.json().catch(() => null);
        linkToken = body && body.access_token ? body.access_token : null;
      }
      const row = linkToken
        ? await fetch(
            SUPABASE_URL +
              "/rest/v1/events?select=custom_slug,short_code&slug=eq." +
              encodeURIComponent(PUBLIC_EVENT),
            { headers: { apikey: KEY, Authorization: "Bearer " + linkToken } },
          )
        : null;
      const rows = row ? await row.json().catch(() => null) : null;
      const ev = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!linkToken) {
        for (const n of Object.values(LINK_ARMS))
          skip(n, "set OWNER_EMAIL and OWNER_PASSWORD to read the event's alias and code");
      } else if (!ev || !ev.short_code || !ev.custom_slug) {
        for (const n of Object.values(LINK_ARMS))
          skip(
            n,
            "events.custom_slug and events.short_code did not answer (" +
              (row ? row.status : "no read") +
              "); 20260924110000 is not on the project yet",
          );
      } else {
        const to = (r) => {
          const loc = r.headers.get("location");
          return loc ? new URL(loc, BASE).pathname : null;
        };
        const x = await get(BASE + "/x/" + ev.short_code);
        record(
          LINK_ARMS.x,
          x.status === 308 && to(x) === "/e/" + PUBLIC_EVENT,
          "status " + x.status + " to " + to(x),
        );
        if (ev.custom_slug === PUBLIC_EVENT)
          skip(LINK_ARMS.e, "the event's alias is its slug, so /e/{alias} is the page itself");
        else {
          const e = await get(BASE + "/e/" + ev.custom_slug);
          record(
            LINK_ARMS.e,
            e.status === 308 && to(e) === "/e/" + PUBLIC_EVENT,
            "status " + e.status + " to " + to(e),
          );
        }
        const unknown = await get(BASE + "/x/000000");
        record(LINK_ARMS.unknown, unknown.status === 404, "status " + unknown.status);
      }
      const anonPage = await fetch(SUPABASE_URL + "/rest/v1/rpc/event_page", {
        method: "POST",
        headers: H,
        body: JSON.stringify({ p_event: "00000000-0000-4000-8000-000000000000" }),
      });
      record(
        "Brief 10 (1023): signed out cannot call event_page at the API",
        anonPage.status === 401 || anonPage.status === 403,
        "status " + anonPage.status,
      );
    }
  }

  // -----------------------------------------------------------------------------------------
  // Ruling 438 (F19): the six security headers on the deployment, read on the Feed route. The
  // Content-Security-Policy is per response because the shell's SSR inline scripts carry a nonce
  // (TanStack Start's ssr.nonce); script-src never widens to 'unsafe-inline'. The static-asset copy
  // is public/_headers; this reads the worker's.
  //
  // Ruling 545 (Fix PR 03 item 4) is what the nonce arms below prove: one value across two layers.
  // The render mints it, stamps it on every inline script it emits and records it on an internal
  // response header; src/server.ts builds this response's policy from that header and strips it. So
  // the assertion is not "a nonce is present in each place" but "it is the same nonce, on the same
  // response" — the failure the old shape could have had is two layers each minting their own, which
  // renders as a policy that blocks the very scripts it was meant to allow.
  // -----------------------------------------------------------------------------------------
  {
    const feedRes = await get(BASE + "/feed");
    const h = (name) => feedRes.headers.get(name) || "";
    const csp = h("content-security-policy");
    record(
      "ruling 438: /feed carries a Content-Security-Policy with default-src 'self' and a nonce, never 'unsafe-inline' for scripts, and media-src 'self' blob: (1569)",
      /default-src 'self'/.test(csp) &&
        /media-src 'self' blob:(;|$)/.test(csp) &&
        /script-src 'self' 'nonce-[A-Za-z0-9+/=_-]+'/.test(csp) &&
        !/script-src[^;]*'unsafe-inline'/.test(csp) &&
        /frame-ancestors 'none'/.test(csp),
      "status " + feedRes.status + " csp " + csp.slice(0, 120),
    );
    record(
      "ruling 438: /feed carries X-Frame-Options DENY",
      h("x-frame-options").toUpperCase() === "DENY",
      h("x-frame-options"),
    );
    record(
      "ruling 438: /feed carries Referrer-Policy strict-origin-when-cross-origin",
      h("referrer-policy") === "strict-origin-when-cross-origin",
      h("referrer-policy"),
    );
    record(
      "ruling 438: /feed carries Strict-Transport-Security for a year with subdomains",
      /max-age=31536000/.test(h("strict-transport-security")) &&
        /includeSubDomains/i.test(h("strict-transport-security")),
      h("strict-transport-security"),
    );
    record(
      "ruling 438: /feed carries X-Content-Type-Options nosniff",
      h("x-content-type-options").toLowerCase() === "nosniff",
      h("x-content-type-options"),
    );
    record(
      "ruling 438: /feed carries Permissions-Policy with camera self, geolocation and microphone off",
      /camera=\(self\)/.test(h("permissions-policy")) &&
        /geolocation=\(\)/.test(h("permissions-policy")) &&
        /microphone=\(\)/.test(h("permissions-policy")),
      h("permissions-policy"),
    );

    // Ruling 545: the nonce in the header is the nonce in the markup, on this one response.
    const headerNonce = (csp.match(/'nonce-([A-Za-z0-9+/=_-]+)'/) || [])[1] || "";
    const markupNonces = [...feedRes.text.matchAll(/<script[^>]*\snonce="([^"]+)"/g)].map(
      (m) => m[1],
    );
    const metaNonce =
      (feedRes.text.match(/property="csp-nonce"[^>]*content="([^"]+)"/) || [])[1] ||
      (feedRes.text.match(/content="([^"]+)"[^>]*property="csp-nonce"/) || [])[1] ||
      "";
    record(
      "ruling 545: the SSR'd script tags carry a nonce",
      markupNonces.length > 0,
      markupNonces.length + " nonced script tag(s)",
    );
    record(
      "ruling 545: every nonce in the markup is the one in the Content-Security-Policy header",
      !!headerNonce && markupNonces.length > 0 && markupNonces.every((n) => n === headerNonce),
      "header " +
        headerNonce.slice(0, 12) +
        " markup " +
        [...new Set(markupNonces)].join(",").slice(0, 40),
    );
    record(
      "ruling 545: the shell's csp-nonce meta carries the same value, so hydration reads it back",
      !!metaNonce && metaNonce === headerNonce,
      "meta " + metaNonce.slice(0, 12),
    );
    // The case that nearly shipped. Deriving the policy from what the render reported works for a 2xx
    // and silently fails for anything else: h3 merges a request event's headers onto a returned
    // Response only when that Response is ok, so a 404 arrived with the nonce stamped in its markup
    // and absent from its policy, blocking the very scripts the policy exists to allow. The worker
    // entry owns the value now, so a non-2xx render is covered too, and this is the arm that says so.
    const missing = await get(BASE + "/this-route-does-not-exist");
    const missingCsp = missing.headers.get("content-security-policy") || "";
    const missingHeaderNonce = (missingCsp.match(/'nonce-([A-Za-z0-9+/=_-]+)'/) || [])[1] || "";
    const missingMarkupNonces = [...missing.text.matchAll(/<script[^>]*\snonce="([^"]+)"/g)].map(
      (m) => m[1],
    );
    record(
      "ruling 545: a non-2xx render carries the nonce in its policy as well as its markup",
      missing.status === 404 &&
        !!missingHeaderNonce &&
        missingMarkupNonces.length > 0 &&
        missingMarkupNonces.every((n) => n === missingHeaderNonce),
      "status " +
        missing.status +
        " header " +
        missingHeaderNonce.slice(0, 12) +
        " markup " +
        [...new Set(missingMarkupNonces)].join(",").slice(0, 40),
    );
    // Per response, not per deployment: a nonce reused across responses is a nonce an attacker can
    // read off one page and reuse on the next, which is the whole point of minting it per render.
    const feedAgain = await get(BASE + "/feed");
    const againNonce =
      ((feedAgain.headers.get("content-security-policy") || "").match(
        /'nonce-([A-Za-z0-9+/=_-]+)'/,
      ) || [])[1] || "";
    record(
      "ruling 545: a second response carries a different nonce",
      !!againNonce && againNonce !== headerNonce,
      "first " + headerNonce.slice(0, 12) + " second " + againNonce.slice(0, 12),
    );
  }

  // -----------------------------------------------------------------------------------------
  // The arms that live inside the database (rulings 374 to 376, 415, 416, 435, 439, 442), on one
  // pg client over LIVE_DB_URL as live_arms (ruling 382). tests/live-db.cjs builds every fixture
  // and rolls every transaction back; without the connection string each arm reports unproven.
  // -----------------------------------------------------------------------------------------
  // Handoff 60-NC (G245, 1529; RFC 8058): the one-click route on the deployment itself. A GET is
  // sent on to the landing page with the token and changes nothing; a POST with RFC 8058's body and
  // a token no mint returned asks the database and answers expired (the database's own word for an
  // unknown token, so the route and the function are both reached); a POST without the body is
  // refused before the database is asked. The token-to-done path is the database arm in
  // tests/live-db.cjs, because a live token exists only inside a rolled-back transaction (269).
  {
    const name =
      "Handoff 60-NC (G245, 1529): /api/email/unsubscribe on the deployment redirects a GET to /email/unsubscribed with the token, answers expired to a one-click POST with an unknown token, and refuses a POST without RFC 8058's body";
    try {
      const unknown = "0".repeat(64);
      const at = BASE + "/api/email/unsubscribe?token=" + unknown;
      const g = await get(at);
      const post = async (body) => {
        const res = await fetch(at, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          redirect: "manual",
        });
        let state = null;
        try {
          state = (await res.json()).state;
        } catch {
          state = null;
        }
        return { status: res.status, state };
      };
      const one = await post("List-Unsubscribe=One-Click");
      const bare = await post("");
      record(
        name,
        g.status === 303 &&
          g.headers.get("location") === "/email/unsubscribed?token=" + unknown &&
          one.status === 200 &&
          one.state === "expired" &&
          bare.status === 400 &&
          bare.state === "refused",
        "GET " +
          g.status +
          " " +
          g.headers.get("location") +
          ", POST " +
          one.status +
          " " +
          one.state +
          ", bare POST " +
          bare.status +
          " " +
          bare.state,
      );
    } catch (e) {
      record(name, false, String(e && e.message ? e.message : e));
    }
  }

  await runLiveDbArms({ record, skip });

  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} live checks passed`);
  // G143: the total counts every arm the run names, so a block that could not run moves arms from the
  // passing column to the unproven one and leaves this number where it was.
  console.log(
    `${results.length + unproven.length} arms named: ${results.length - fails.length} passed, ${fails.length} failed, ${unproven.length} unproven`,
  );
  // Ruling 228: unproven is its own outcome. It does not fail the run, and it is never folded into
  // the passing count, so a suite that could not exercise an arm cannot read as one that did.
  if (unproven.length) {
    console.log(`${unproven.length} arm(s) unproven, not passing:`);
    for (const u of unproven) console.log(`  - ${u.name}: ${u.why}`);
  }
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
