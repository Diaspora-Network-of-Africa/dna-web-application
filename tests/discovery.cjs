// Brief 9, the Discovery Dashboard, as handoff 32-B rebuilds it (items 1 to 7 and 12, with Addenda 1
// and 3): B9-SPEC's exit check in the browser, against BASE with the Supabase surface mocked by
// tests/matrix.cjs, so the real client runs against a deterministic `convene_discovery`. One arm per
// engine, viewport and theme, at the matrix's widths plus 1440 and 1600, where the pane and the rail
// are read at three expanded widths (Done Means 3):
//
//   full density   the ten lanes (1124, 1172) in convene_lanes order, each named from the vocabulary in the
//                  display face at 22, none without items; every card PostCard's discovery face at
//                  320 with 16:9 media and a title clamped to two lines whose height is held; the
//                  reason row in words on the four relationship lanes and empty on the other five;
//                  the where line; no digit outside the when line; See all on five lanes and not
//                  on This weekend, Join from anywhere, New this week or Near your homes (1122);
//                  the LensBar's five lenses with
//                  labels and icons and no trailing seat; the homes line; no right column; the rail
//                  collapsed at first load with nothing written; the facet set and order with its
//                  words and no Donation; the rail's toggle written per band, never at compact.
//   menu           Share, Copy link, Save or Saved, Add to calendar only when going, a rule, Follow
//                  or Following, Subscribe or Subscribed, a rule, Not this; absent items absent and
//                  none disabled; Not this takes the card out of its lane with the toast, and it
//                  stays out on reload.
//   pane           at expanded the title opens the event page as the Pane over the lanes, the rail
//                  its 64 strip, no right column, the card ringed; Previous and Next step through
//                  the lane in its visible order past a dismissal; Escape returns to Discovery.
//                  Below expanded the title is a route to the page with its Back row.
//   below density  the Communities lane is its heading and DIA's one sentence, only with `suggest`.
//   no homes       the homes line and the Home axis are absent (1050).
//   error          the one alert, and Try again re-reads.
//   /collaborate   still the C stub.
//
// `runDiscoveryFacets`, on four viewports (Addendum 1's Done Means 6 and item 12's facet rows):
//
//   redirects      /convene/soon, /convene/online and /convene/near land on /convene with the
//                  when, the format or nothing, keeping the rest of the query (item 1).
//   donation       a price of donation in the URL never reaches the projection (1095).
//   place          the combobox offers places by kind, a pick narrows the lanes to it, Near reads
//                  "While you are in {city}", and the chosen place is a chip that removes it.
//   ladders        one ladder per home on a two-home fixture, the region rung absent for a home
//                  with no region; each rung narrows and Anywhere clears the home (1110).
//   writes         Follow, Subscribe, Save and Add to calendar through their existing paths.
//   rail memory    a toggle survives a reload at its band and leaves the other band collapsed
//                  (1111), and compact writes nothing.
//
// `runDiscoveryPlace` (handoff 31-D: 1063, 1065, 1067), on its own viewports: the lens kept behind
// the pane with no second read, the column and a lane restored on Back, and hover intent.
//
// Addendum 4's arms, one per item (7), and Addendum 5's, each on its own cells:
//
//   presenter      item 1 (1121): the card's presenter row, the menu's Follow and the Feed's
//                  "Presented by" name the presenter the pane names, where 416 hides the author, a
//                  Space presenter keeps its name and no Follow, and no signed-out render reads it.
//   online         item 2 (1122): Join from anywhere has no See all, and /convene/online lands on
//                  format=online, one value, with Online lit.
//   rail           item 3 (D6; 1094, 1111): the pane takes the rail's width, closing it returns the
//                  rail to the member's last choice, and only the member's toggle writes.
//   step           item 4 (B9-SPEC's pane line): two Next presses leave the pane body at its top with
//                  the cluster in view, the list and the body scrolling apart.
//   homes          item 5 (1110, 928): Home between Topics and Place, a ladder for each of two homes.
//   width          item 8 (1123): the canvas and the header on 5% and 95% of the viewport, the Feed
//                  still 1440 at 1920, no page scroll, and the pane beside a full 320 card; in
//                  the pane, list shown and hidden, the event page's cover on the body's edges
//                  and its text --space-5 inside them (1143).
//
// Usage: BASE=https://<preview>.dna-web-application.pages.dev SPECIAL=discovery node tests/matrix.cjs
const M = require("./matrix.cjs");
const { seedAttend, seedAttendCard, publicPage } = require("./event.cjs");

const {
  launch,
  makeMockDb,
  seedPosts,
  mockSupabase,
  signIn,
  record,
  shot,
  noOverflow,
  eventId,
  BASE,
  SB,
  UID,
  VOCAB,
  DISCOVERY_SECTIONS,
  DISCOVERY_LENSES,
} = M;

const SB_RE = SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);
/**
 * Console errors that are the sandbox's and not the app's, as tests/connect.cjs reads them: the
 * aborted font host, a network reset, and the refusals the mock answers on purpose. Anything else
 * the console reports is an error the arm fails on, which is how a render loop (React's "Maximum
 * update depth exceeded", logged and not thrown) reaches a check at all.
 */
const IGNORED_CONSOLE = new RegExp(
  [
    "fonts\\.g",
    "ERR_CONNECTION_RESET",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_FAILED",
    "\\b(?:400|406|500)\\b",
    CANCELLED_MOCK_FETCH.source,
  ].join("|"),
);

/** The matrix's widths plus 1440 and 1600: the pane and the rail at three expanded widths. */
const DISCOVERY_VIEWPORTS = [...M.VIEWPORTS, [1440, 900], [1600, 1000]];

const KWAME = {
  id: "00000000-0000-4000-8000-0000000000f2",
  name: "Kwame Mensah",
  handle: "kwame-mensah",
};
const ADAEZE = {
  id: "00000000-0000-4000-8000-0000000000f6",
  name: "Adaeze Nwosu",
  handle: "adaeze-nwosu",
};
const SEFA = { id: "00000000-0000-4000-8000-0000000000f5", name: "Sefa Owusu" };
const NGOZI = { id: "00000000-0000-4000-8000-0000000000f7", name: "Ngozi Eze" };
const LOADED = eventId("loaded");
const CURATED_LINE = "A weaver and a data engineer read the same cloth two ways.";
const LONG_TITLE =
  "After the harvest: an evening of stories from growers, buyers and the people who finance the season in between";

/** Addendum 1's two-home fixture: Accra holds a stored region, Nairobi none (1110). */
const H1 = "00000000-0000-4000-8000-0000000000a1";
const H2 = "00000000-0000-4000-8000-0000000000a2";
const HOMES = [
  { id: H1, city: "Accra", place_name: "Accra", region: "Greater Accra", country: "Ghana" },
  { id: H2, city: "Nairobi", place_name: "Nairobi", region: null, country: "Kenya" },
];

/** What convene_places() answers, in its own order: cities, regions, countries, each by name. */
const PLACES = [
  { id: "city|ghana|accra", kind: "city", name: "Accra", country: "Ghana" },
  { id: "city|ghana|kumasi", kind: "city", name: "Kumasi", country: "Ghana" },
  { id: "city|united kingdom|london", kind: "city", name: "London", country: "United Kingdom" },
  { id: "city|ghana|madina", kind: "city", name: "Madina", country: "Ghana" },
  { id: "city|kenya|nairobi", kind: "city", name: "Nairobi", country: "Kenya" },
  { id: "city|ghana|tema", kind: "city", name: "Tema", country: "Ghana" },
  { id: "region|ghana|ashanti", kind: "region", name: "Ashanti", country: "Ghana" },
  { id: "region|ghana|greater accra", kind: "region", name: "Greater Accra", country: "Ghana" },
  { id: "country|ghana", kind: "country", name: "Ghana", country: "Ghana" },
  { id: "country|kenya", kind: "country", name: "Kenya", country: "Kenya" },
  {
    id: "country|united kingdom",
    kind: "country",
    name: "United Kingdom",
    country: "United Kingdom",
  },
];

/** Where each fixture city sits, as convene_places() ids and the region it falls in. */
const CITY = {
  Accra: { country: "Ghana", region: "Greater Accra" },
  Madina: { country: "Ghana", region: "Greater Accra" },
  Tema: { country: "Ghana", region: "Greater Accra" },
  Kumasi: { country: "Ghana", region: "Ashanti" },
  Nairobi: { country: "Kenya", region: null },
  London: { country: "United Kingdom", region: null },
};
function placeIds(cities) {
  const out = new Set();
  for (const c of cities) {
    const at = CITY[c];
    const country = at.country.toLowerCase();
    out.add("city|" + country + "|" + c.toLowerCase());
    if (at.region) out.add("region|" + country + "|" + at.region.toLowerCase());
    out.add("country|" + country);
  }
  return [...out];
}

/** One published Convene event with its post, in the shape the Feed's hydration reads. */
function seedEvent(db, key, { title, mode, days, cities = [], family = null, host = KWAME }) {
  const id = eventId("discovery-" + key);
  const postId = "post-d-" + key;
  // `days: null` is an event with no date yet: a window only, which has no calendar file.
  const starts = days === null ? null : new Date(Date.now() + days * 86400e3);
  if (starts) starts.setUTCHours(18, 0, 0, 0);
  db.posts.unshift({
    id: postId,
    author_kind: "member",
    author_id: host.id,
    created_by: host.id,
    author_name: host.name,
    author_handle: host.handle,
    author_avatar_path: null,
    c_category: "convene",
    body: "An evening for members who want to meet the people behind the work. Come as you are, bring one person who should be in the room.",
    anchor_kind: null,
    anchor_id: null,
    created_object_kind: "event",
    created_object_id: id,
    audience: "everyone",
    status: "published",
    published_at: new Date(Date.now() - 3600e3).toISOString(),
    created_at: new Date(Date.now() - 3600e3).toISOString(),
  });
  db.events.push({
    id,
    host_member_id: host.id,
    title,
    starts_at: starts ? starts.toISOString() : null,
    ends_at: null,
    doors_at: null,
    when_text: "An evening",
    mode,
    family,
    ticket_kind: "free",
    space_id: null,
    status: "published",
    timezone:
      mode === "virtual" ? "UTC" : cities[0] === "Nairobi" ? "Africa/Nairobi" : "Africa/Accra",
    time_confirmed: true,
    date_confirmed: true,
    expected_window_start: null,
    expected_window_end: null,
    window_basis: starts ? null : "October",
    delivery_intent: null,
    cancelled_at: null,
    cancelled_reason: null,
    slug: "discovery-" + key,
    created_at: new Date().toISOString(),
  });
  cities.forEach((city, i) =>
    db.event_delivery.push({
      id: "d-d-" + key + "-" + i,
      event_id: id,
      kind: "physical",
      position: i,
      place_id: "dXJuOm1ieHBvaTpmcm9udC1yb29t" + i,
      place_name: "Front Room",
      place_text: null,
      city,
      region: CITY[city].region,
      country: CITY[city].country,
    }),
  );
  if (mode !== "in_person")
    db.event_delivery.push({
      id: "d-d-" + key + "-link",
      event_id: id,
      kind: "meeting_link",
      position: cities.length,
      url: "https://meet.example/" + key,
    });
  return {
    event_id: id,
    post_id: postId,
    title,
    starts_at: starts ? starts.toISOString() : null,
    mode,
    cities,
    family,
    host,
  };
}

/**
 * The corpus every arm reads: the Brief 10 page's loaded event and nine more. `rungs` is the nearest
 * rung each home reaches the event at (1110), which the mock narrows by as the projection does.
 */
function seedCorpus(db) {
  seedAttend(db);
  seedAttendCard(db);
  const loadedPage = db.attend.pages[LOADED];
  const E = {
    loaded: {
      event_id: LOADED,
      post_id: "post-e-loaded",
      title: loadedPage.event.title,
      starts_at: loadedPage.event.starts_at,
      mode: "in_person",
      cities: ["Accra"],
      family: null,
      host: KWAME,
    },
    supper: seedEvent(db, "supper", {
      title: "Corridor Suppers",
      mode: "in_person",
      days: 5,
      cities: ["Accra"],
      family: "small_social",
    }),
    madina: seedEvent(db, "madina", {
      title: "A market morning in Madina",
      mode: "in_person",
      days: 6,
      cities: ["Madina"],
      family: "small_social",
    }),
    tema: seedEvent(db, "tema", {
      title: "Harbour talks",
      mode: "in_person",
      days: 7,
      cities: ["Tema"],
      family: "professional_economic",
    }),
    kumasi: seedEvent(db, "kumasi", {
      title: "Kente weavers at home",
      mode: "in_person",
      days: 18,
      cities: ["Kumasi"],
      family: "culture_arts",
    }),
    table: seedEvent(db, "table", {
      title: "A long table in Westlands",
      mode: "hybrid",
      days: 9,
      cities: ["Nairobi"],
      family: "culture_arts",
    }),
    cloth: seedEvent(db, "cloth", {
      title: "Kente and code",
      mode: "hybrid",
      days: 12,
      cities: ["Accra", "London"],
      family: "culture_arts",
    }),
    readers: seedEvent(db, "readers", {
      title: "Six readers, one room",
      mode: "virtual",
      days: 3,
      family: "learning_dialogue",
    }),
    stream: seedEvent(db, "stream", {
      title: "Founders on the stream",
      mode: "virtual",
      days: 16,
      family: "learning_dialogue",
      host: ADAEZE,
    }),
    harvest: seedEvent(db, "harvest", {
      title: LONG_TITLE,
      mode: "virtual",
      days: 22,
      family: "giving_cause",
    }),
    undated: seedEvent(db, "undated", {
      title: "A supper in Kilimani",
      mode: "in_person",
      days: null,
      cities: ["Nairobi"],
      family: "small_social",
    }),
  };
  const rungs = {
    loaded: { [H1]: "in" },
    supper: { [H1]: "in" },
    cloth: { [H1]: "in" },
    madina: { [H1]: "around" },
    tema: { [H1]: "region" },
    kumasi: { [H1]: "country" },
    table: { [H2]: "in" },
    undated: { [H2]: "in" },
  };
  for (const [k, e] of Object.entries(E)) {
    e.places = placeIds(e.cities);
    e.rungs = rungs[k] || {};
  }
  // Every card opens a loaded page, so the pane and the route read the page and never not-found.
  for (const e of Object.values(E))
    if (!db.attend.pages[e.event_id])
      db.attend.pages[e.event_id] = {
        ...loadedPage,
        event: { ...loadedPage.event, id: e.event_id, slug: "discovery-" + e.event_id },
      };
  // 1121: the card reads the pane's presenter, so each page names who the database would: the
  // latest published post's author (every post here is its host's) and the host, as event_page and
  // event_presenters both resolve them. Brief 10's page keeps its Space presenter in tests/event.cjs.
  for (const e of Object.values(E)) {
    const who = { id: e.host.id, name: e.host.name, handle: e.host.handle, avatar_path: null };
    db.attend.pages[e.event_id] = {
      ...db.attend.pages[e.event_id],
      presented_by: { kind: "member", ...who },
      host: who,
    };
  }
  return E;
}

/** The words the projection matches a search against (1159), as the mock's `_text`. */
const searchWords = (e) =>
  [
    e.title,
    e.host && e.host.name,
    ...(e.cities || []),
    ...(e.cities || []).map((c) => CITY[c] && CITY[c].country),
    (VOCAB.convene_families.find((f) => f.value === e.family) || {}).label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const item = (e, reason) => ({
  event_id: e.event_id,
  post_id: e.post_id,
  reason,
  _places: e.places,
  _rungs: e.rungs,
  _text: searchWords(e),
});

/** The going row's names (1128, 1138): three first names per event, never the viewer's (1158). */
const GOING_NAMES = ["Ama", "Kojo", "Efua"];
/** The sentence the surface composes from them (handoff 34-A item 5, as Chat corrected it in
 *  Session 34): the three comma-joined, then the words. */
const GOING_SENTENCE = "Ama, Kojo, Efua and others are going.";

/**
 * Full density (632, 1092, 1124, 1172): all ten lanes. The member follows Kwame Mensah and Culture and
 * arts, is going to Corridor Suppers, which they have saved, and to an undated supper in Kilimani.
 * Corridor Suppers and Kente and code have five or more going, so they fill up and name three.
 */
function fullDensity(E) {
  const soon = (e) => item(e, { kind: "soon", starts_at: e.starts_at, mode: e.mode });
  return {
    sections: {
      soon: [E.readers, E.supper, E.madina, E.cloth].map(soon),
      weekend: [E.supper, E.tema].map((e) =>
        item(e, { kind: "weekend", starts_at: e.starts_at, mode: e.mode }),
      ),
      // Five, so the lane still scrolls sideways at 1600, the widest this arm runs (1123: no maximum).
      online: [E.readers, E.stream, E.harvest, E.cloth, E.table].map((e) =>
        item(e, { kind: "online", starts_at: e.starts_at, mode: e.mode }),
      ),
      filling: [E.cloth, E.supper].map((e) =>
        item(e, { kind: "filling", starts_at: e.starts_at, mode: e.mode }),
      ),
      fresh: [E.kumasi, E.table, E.undated].map((e) =>
        item(e, { kind: "fresh", published_at: new Date(Date.now() - 86400e3).toISOString() }),
      ),
      curated: [E.loaded, E.cloth].map((e) =>
        item(e, { kind: "curated", editor: SEFA, line: CURATED_LINE }),
      ),
      follow: [E.supper, E.table].map((e) =>
        item(e, { kind: "follow", host: { id: KWAME.id, name: KWAME.name } }),
      ),
      taste: [E.cloth, E.table].map((e) =>
        item(e, { kind: "taste", family: "culture_arts", label: "Culture and arts" }),
      ),
      near: [
        item(E.supper, { kind: "near", home: { id: H1, city: "Accra" } }),
        item(E.madina, { kind: "near", home: { id: H1, city: "Accra" } }),
        item(E.table, { kind: "near", home: { id: H2, city: "Nairobi" } }),
      ],
      network: [
        item(E.cloth, { kind: "network", host: { id: ADAEZE.id, name: ADAEZE.name } }),
        item(E.stream, { kind: "network", going: [ADAEZE, NGOZI] }),
      ],
    },
    goingNames: {
      [E.supper.event_id]: GOING_NAMES,
      [E.cloth.event_id]: GOING_NAMES,
    },
    follows: [{ ...KWAME, avatar_path: null }],
    subscriptions: [{ family: "culture_arts", label: "Culture and arts" }],
    suggest: null,
  };
}

/** Below density, day one (632, 650): three lanes and the Communities lane's sentence. */
function belowDensity(E) {
  const full = fullDensity(E);
  return {
    sections: {
      online: full.sections.online.slice(0, 2),
      curated: full.sections.curated.slice(0, 1),
      network: full.sections.network.slice(0, 1),
    },
    goingNames: {},
    follows: [],
    subscriptions: [],
    suggest: {
      host: { ...KWAME },
      event_id: E.supper.event_id,
      title: "Corridor Suppers",
      city: "Accra",
    },
  };
}

function setAnswer(db, answer, homes = HOMES) {
  Object.assign(db.discovery, answer, { homes, fail: false });
}

/** The fixture state every arm starts from: full density, the places, going and saved. */
function seedDiscovery(db) {
  seedPosts(db, 1);
  const E = seedCorpus(db);
  setAnswer(db, fullDensity(E));
  db.discovery.places = PLACES;
  db.discovery.going = [E.supper.event_id, E.undated.event_id];
  db.saves.push({
    member_id: UID,
    post_id: E.supper.post_id,
    created_at: new Date().toISOString(),
  });
  return E;
}

async function context(browserType, [w, h], theme, db) {
  const browser = await launch(browserType);
  const touch = w <= 1024;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ theme }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
    },
    { theme },
  );
  await mockSupabase(page, db);
  const errors = [];
  page.on("pageerror", (e) => {
    const text = String(e);
    if (!CANCELLED_MOCK_FETCH.test(text)) errors.push(text);
  });
  // Handoff 35-C (1191, G147): a console error names its request. The URL comes first so the arms'
  // slice(0, 300) cannot cut it off; where the engine gives the message no location, the last
  // response of 400 or above stands in, marked unconfirmed since it can be a different request
  // from the one that raised the message. The response listener records and never fails an arm.
  const failedResponses = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.request().method()} ${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_CONSOLE.test(m.text()))
      errors.push(
        `${m.location().url || (failedResponses.length ? "(last failed response, unconfirmed) " + failedResponses.at(-1) : "(no url)")} ${m.text()}`,
      );
  });
  return { browser, page, errors };
}

async function openDiscovery(page, path = "/convene") {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-discovery]", { timeout: 20000 });
  await page.waitForFunction(
    () =>
      !!document.querySelector("[data-discovery] [data-lanes], [data-lens-list], [role=alert]") &&
      !document.querySelector('[role="status"][aria-label="Loading Convene"]'),
    null,
    { timeout: 20000 },
  );
}

const tierOf = (w) => (w < 640 ? "compact" : w > 1024 ? "expanded" : "medium");
const RAIL = '[data-scroller="left"] nav[aria-label="Filters"]';
const SHEET = '[role="dialog"][aria-label="Filters"]';
const lastCall = (db) => db.discovery.calls[db.discovery.calls.length - 1] || {};

/** Opens the rail (medium and up) or the Sheet (compact) and answers the scope its axes are in. */
async function openRail(page, tier) {
  if (tier === "compact") {
    await page.locator('[data-testid="filters"]').click();
    await page.locator(SHEET).waitFor({ timeout: 10000 });
    await page.locator(`${SHEET} [data-axis-id]`).first().waitFor({ timeout: 10000 });
    return SHEET;
  }
  await page.locator(`${RAIL} button[aria-label="Show filters"]`).click();
  await page.locator(`${RAIL} [data-axis-id]`).first().waitFor({ timeout: 10000 });
  return RAIL;
}

async function closeRail(page, tier) {
  if (tier === "compact") {
    await page.keyboard.press("Escape");
    await page.locator(SHEET).waitFor({ state: "detached", timeout: 10000 });
    return;
  }
  await page.locator(`${RAIL} button[aria-label="Collapse filters"]`).click();
  await page.locator(`${RAIL} button[aria-label="Show filters"]`).waitFor({ timeout: 10000 });
}

/** The rail as the part draws it: each axis's id, display, heading and the words it offers. */
function readAxes(page, scope) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope);
    if (!root) return [];
    return Array.from(root.querySelectorAll("[data-axis-id]")).map((a) => {
      const text = (el) => (el.textContent || "").trim();
      const display = a.getAttribute("data-display");
      const heading = a.querySelector('[id^="facet-"]');
      let options = [];
      if (display === "segment")
        options = Array.from(a.querySelectorAll('[role="radio"]')).map(text);
      else if (display === "checklist")
        options = Array.from(a.querySelectorAll('[role="checkbox"]')).map(text);
      else if (display === "ladders")
        options = Array.from(a.querySelectorAll("[data-ladder]")).map((l) =>
          Array.from(l.querySelectorAll("[data-option]")).map(text).join("|"),
        );
      else if (display === "combobox")
        options = [a.querySelector("input")?.getAttribute("placeholder") || ""];
      return {
        id: a.getAttribute("data-axis-id"),
        display,
        label: heading ? text(heading) : "",
        options,
      };
    });
  }, scope);
}

/** Every lane's event ids in DOM order, keyed by lane. */
function laneItems(page) {
  return page.evaluate(() => {
    const out = {};
    for (const l of document.querySelectorAll("[data-discovery] [data-lanes] > [data-lane]"))
      out[l.getAttribute("data-lane")] = Array.from(
        l.querySelectorAll("[data-discovery-item]"),
      ).map((e) => e.getAttribute("data-discovery-item"));
    return out;
  });
}

async function laneIds(page) {
  return page.$$eval("[data-discovery] [data-lanes] > [data-lane]", (els) =>
    els.map((e) => e.getAttribute("data-lane")),
  );
}

const cardSel = (e, lane) => `[data-discovery-item="${e.event_id}"][data-section="${lane}"]`;

/**
 * Opens a card's menu and answers its entries in order: labels, "|" for a rule, and any disabled.
 * The answer also carries the menu's rendered width and its declared minimum (G113). The ellipsis is
 * found by its name's first word: with the face's link it reads "More: {title}" (G115).
 */
async function readMenu(page, card) {
  await page.locator(`${card} button[aria-label^="More"]`).click();
  const menu = page.locator('[role="menu"][data-menu]');
  await menu.waitFor({ timeout: 10000 });
  const box = await menu.evaluate((m) => {
    const width = Math.round(m.getBoundingClientRect().width * 10) / 10;
    const min = getComputedStyle(m).minWidth;
    // The menu's width by its words alone, read with the floor lifted for one synchronous layout and
    // put back before anything paints (G113 under BS7: the words' width moves with the font).
    const prev = m.style.minWidth;
    m.style.minWidth = "0px";
    const own = Math.round(m.getBoundingClientRect().width * 10) / 10;
    m.style.minWidth = prev;
    return { width, min, own };
  });
  const read = await menu.evaluate((m) =>
    Array.from(m.children).map((c) =>
      c.getAttribute("role") === "separator"
        ? { label: "|", disabled: false }
        : {
            label: (c.textContent || "").trim(),
            disabled:
              c.hasAttribute("disabled") ||
              c.getAttribute("aria-disabled") === "true" ||
              !!c.querySelector("[disabled],[aria-disabled=true]"),
          },
    ),
  );
  return Object.assign(read, { box });
}

async function closeMenu(page) {
  await page.keyboard.press("Escape");
  await page
    .locator('[role="menu"][data-menu]')
    .waitFor({ state: "detached", timeout: 10000 })
    .catch(() => undefined);
}

async function menuSelect(page, card, label) {
  await page.locator(`${card} button[aria-label^="More"]`).click();
  const menu = page.locator('[role="menu"][data-menu]');
  await menu.waitFor({ timeout: 10000 });
  await menu.getByRole("menuitem", { name: label, exact: true }).click();
  await menu.waitFor({ state: "detached", timeout: 10000 }).catch(() => undefined);
}

/**
 * Copy link and Share read without a clipboard or a share sheet, which a headless engine may refuse
 * (G110, 1140): each stub keeps the URL it is handed in `window.__copied` or `window.__shared`. The
 * stubs stand in for the APIs that need the press's activation, so no arm reads activation (G131).
 */
function stubHandOver(page) {
  return page.addInitScript(() => {
    window.__copied = [];
    window.__shared = [];
    try {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (t) => void window.__copied.push(t) },
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (d) => void window.__shared.push(d && d.url),
      });
    } catch {}
  });
}

/** What `act` hands over through those stubs: emptied first, read once they hold `copied` and
 *  `shared` URLs or after 5s, because a press whose page is not cached reads it first (1140). */
async function handedOver(page, act, { copied = 0, shared = 0 }) {
  await page.evaluate(() => {
    window.__copied = [];
    window.__shared = [];
  });
  await act();
  await page
    .waitForFunction(
      (n) => window.__copied.length >= n.copied && window.__shared.length >= n.shared,
      { copied, shared },
      { timeout: 5000 },
    )
    .catch(() => undefined);
  return page.evaluate(() => ({ copied: window.__copied, shared: window.__shared }));
}

/** Whether `url` is `path` on the origin under test. */
function onPath(url, path) {
  try {
    const u = new URL(url);
    return u.origin === new URL(BASE).origin && u.pathname === path;
  } catch {
    return false;
  }
}

/** The text of the surface and its columns with every card's when line taken out. */
async function digitsOutsideWhen(page) {
  return page.evaluate(() => {
    const parts = [
      '[data-scroller="feed"]',
      '[data-scroller="left"]',
      '[data-scroller="right"]',
      "[data-layout-top]",
    ]
      .map((s) => document.querySelector(s))
      .filter(Boolean)
      .map((el) => el.innerText || "");
    let text = parts.join("\n");
    for (const w of document.querySelectorAll('[data-discovery] [data-row="when"]')) {
      const t = (w.innerText || "").trim();
      if (t) text = text.replace(t, "");
    }
    const m = text.match(/[^\d]{0,24}\d[^\d]{0,24}/);
    return m ? m[0].replace(/\s+/g, " ") : "";
  });
}

/** Waits until the last projection call satisfies `pred` and the lanes have settled on it. */
/** Polls the lanes until `ok(ids)` holds for every item id shown, or 10s pass; answers the ids. */
async function lanesUntil(page, ok) {
  let ids = [];
  for (let t = 0; t < 100; t++) {
    ids = Object.values(await laneItems(page)).flat();
    if (ok(ids)) break;
    await page.waitForTimeout(100);
  }
  return ids;
}

async function settled(page, db, pred) {
  const start = Date.now();
  while (!pred(lastCall(db)) && Date.now() - start < 10000) await page.waitForTimeout(100);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
  return pred(lastCall(db));
}

async function runDiscovery(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);
    await openDiscovery(page);

    // Item 3 (1092, 1105) with handoff 34-A (1124, 1160, 1172): the ten lanes in the order the
    // answer gives, which is convene_lanes order for a member with no act in the week, each named
    // from the vocabulary.
    const order = await laneIds(page);
    record(
      tag +
        " full: the lanes are the ten in the answer's order, convene_lanes order before any act (1105, 1160, 1172)",
      order.join(",") === DISCOVERY_SECTIONS.join(","),
      order.join(","),
    );
    const emptyLanes = await page.$$eval("[data-discovery] [data-lanes] > [data-lane]", (els) =>
      els
        .filter((e) => e.querySelectorAll("[data-discovery-item]").length === 0)
        .map((e) => e.getAttribute("data-lane")),
    );
    record(
      tag + " full: no lane renders without items, and no sentence without suggest (632, 650)",
      emptyLanes.length === 0 &&
        !(await page.locator("[data-discovery]").innerText()).includes("You follow no host yet"),
      emptyLanes.join(","),
    );
    const heads = await page.$$eval("[data-discovery] [data-lanes] > [data-lane] h2", (els) =>
      els.map((e) => {
        const cs = getComputedStyle(e);
        return { text: e.textContent.trim(), size: cs.fontSize, face: cs.fontFamily };
      }),
    );
    const display = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim(),
    );
    record(
      tag + " full: each lane's h2 is its convene_lanes name in the display face at 22",
      heads.map((x) => x.text).join("|") === VOCAB.convene_lanes.map((l) => l.name).join("|") &&
        heads.every(
          (x) =>
            x.size === "22px" &&
            x.face.split(",")[0].replace(/"/g, "").trim() ===
              display.split(",")[0].replace(/"/g, "").trim(),
        ),
      JSON.stringify(heads.slice(0, 2)),
    );

    // Item 4 (1076 to 1079): every card PostCard's discovery face, and no DIA line above it (1096).
    const faces = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[data-discovery-item]"));
      return {
        items: items.length,
        discovery: items.filter(
          (e) =>
            e.querySelectorAll('article[data-presentation="discovery"]').length === 1 &&
            e.querySelectorAll("article").length === 1,
        ).length,
        feed: document.querySelectorAll("[data-discovery] article[data-c]").length,
        dia: document.querySelectorAll("[data-discovery] [data-lanes] [data-dia]").length,
      };
    });
    record(
      tag + " full: every item is one discovery-face PostCard, no feed face and no DIA line (1096)",
      faces.items > 0 && faces.discovery === faces.items && faces.feed === 0 && faces.dia === 0,
      JSON.stringify(faces),
    );
    const geo = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-discovery-item] article")).map((a) => {
        const m = a.querySelector("[data-media]");
        return {
          w: a.getBoundingClientRect().width,
          mw: m ? m.clientWidth : 0,
          mh: m ? m.clientHeight : 0,
        };
      }),
    );
    const badGeo = geo.filter(
      (g) => Math.abs(g.w - 320) > 0.6 || !g.mh || Math.abs(g.mw / g.mh - 16 / 9) > 0.02,
    );
    record(
      tag + " full: every card is 320 wide with its media at 16:9 (1077, 1087)",
      geo.length > 0 && badGeo.length === 0,
      JSON.stringify(badGeo.slice(0, 2)),
    );
    // The clamp is read wherever it sits (correction 28 puts it on a span inside the face's link,
    // G115). Every two-line clamp in the title is lifted for one synchronous read and put back, so
    // the long title shows it runs past two lines without them and holds two with them, on either
    // engine.
    const clamp = await page.evaluate(
      (ids) => {
        const read = (id) => {
          const h3 = document.querySelector(`[data-discovery-item="${id}"] article h3`);
          const b = h3 && h3.querySelector("[data-card-open]");
          if (!h3 || !b) return null;
          const height = () => Math.round(h3.getBoundingClientRect().height * 10) / 10;
          const clamps = [b, ...b.querySelectorAll("*")].filter((e) => {
            const cs = getComputedStyle(e);
            return (cs.webkitLineClamp || cs.getPropertyValue("-webkit-line-clamp")) === "2";
          });
          const held = height();
          const was = clamps.map((e) => e.style.getPropertyValue("-webkit-line-clamp"));
          clamps.forEach((e) => e.style.setProperty("-webkit-line-clamp", "none"));
          const free = height();
          clamps.forEach((e, i) => e.style.setProperty("-webkit-line-clamp", was[i]));
          return { h3: held, free, clamps: clamps.length, back: height() === held };
        };
        return { long: read(ids[0]), short: read(ids[1]) };
      },
      [E.harvest.event_id, E.supper.event_id],
    );
    record(
      tag + " full: the title clamps to two lines and holds two lines' height (1087)",
      !!clamp.long &&
        !!clamp.short &&
        clamp.long.clamps > 0 &&
        clamp.long.free > clamp.long.h3 + 1 &&
        clamp.long.back &&
        Math.abs(clamp.long.h3 - 55) <= 1 &&
        Math.abs(clamp.short.h3 - 55) <= 1,
      JSON.stringify(clamp),
    );
    // Handoff 33-A (correction 28, 1134). G115: the title's one clamp is the part's own span inside
    // the face's link, with none of the page's, so the title is a string again and the ellipsis is
    // named with it.
    const own = await page.evaluate((id) => {
      const art = document.querySelector(`[data-discovery-item="${id}"] article`);
      const h3 = art && art.querySelector("h3");
      if (!h3) return null;
      const clamps = [h3, ...h3.querySelectorAll("*")].filter((e) => {
        const cs = getComputedStyle(e);
        return (cs.webkitLineClamp || cs.getPropertyValue("-webkit-line-clamp")) === "2";
      });
      const more = art.querySelector('button[aria-haspopup="menu"]');
      return {
        clamps: clamps.map(
          (e) =>
            e.tagName.toLowerCase() +
            (e.hasAttribute("data-title-clamp") ? "[data-title-clamp]" : "") +
            (e.parentElement && e.parentElement.matches("a[data-card-open]") ? " in the link" : ""),
        ),
        label: more ? more.getAttribute("aria-label") : null,
        title: (h3.textContent || "").trim(),
      };
    }, E.harvest.event_id);
    record(
      tag +
        " full: the title's one clamp is the part's span inside the face's link, and the ellipsis reads More: {title} (G115)",
      !!own &&
        own.clamps.length === 1 &&
        own.clamps[0] === "span[data-title-clamp] in the link" &&
        own.label === "More: " + own.title,
      JSON.stringify(own),
    );
    // G113: every face at the compile's geometry, which is the spec's: gap 8, the presenter row 36 on
    // a pointer and 44 on touch (498), the last row 28 behind a 1px --line rule, on one line.
    const faceGeo = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--line)";
      document.body.appendChild(probe);
      const line = getComputedStyle(probe).color;
      probe.remove();
      const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null);
      return Array.from(
        document.querySelectorAll('[data-discovery-item] article[data-presentation="discovery"]'),
      ).map((a) => {
        const reason = a.querySelector('[data-row="reason"]');
        const rs = reason && getComputedStyle(reason);
        const text =
          reason && reason.firstElementChild && getComputedStyle(reason.firstElementChild);
        return {
          input: a.getAttribute("data-input"),
          gap: getComputedStyle(a).rowGap,
          presenter: h(a.querySelector('[data-row="presenter"]')),
          reason: h(reason),
          rule: rs
            ? `${rs.borderTopWidth} ${rs.borderTopStyle} ${rs.borderTopColor === line}`
            : null,
          oneLine: !!text && text.whiteSpace === "nowrap" && text.textOverflow === "ellipsis",
        };
      });
    });
    const offGeo = faceGeo.filter(
      (f) =>
        f.gap !== "8px" ||
        Math.abs(f.presenter - (f.input === "touch" ? 44 : 36)) > 0.5 ||
        Math.abs(f.reason - 28) > 0.5 ||
        f.rule !== "1px solid true" ||
        !f.oneLine,
    );
    record(
      tag +
        " full: every face at gap 8, its presenter row 36 on a pointer and 44 on touch, its last row 28 behind a 1px --line rule on one line (G113)",
      faceGeo.length > 0 && offGeo.length === 0,
      JSON.stringify({ faces: faceGeo.length, off: offGeo.slice(0, 2) }),
    );
    const reasons = await page.evaluate(() => {
      const out = {};
      for (const l of document.querySelectorAll("[data-discovery] [data-lanes] > [data-lane]")) {
        const rows = Array.from(l.querySelectorAll('[data-row="reason"]'));
        out[l.getAttribute("data-lane")] = rows.map((r) => ({
          id: r.closest("[data-discovery-item]")?.getAttribute("data-discovery-item") ?? null,
          text: (r.textContent || "").trim(),
          hidden: r.getAttribute("aria-hidden") === "true",
          going: r.hasAttribute("data-going"),
          h: Math.round(r.getBoundingClientRect().height),
        }));
      }
      return out;
    });
    const speaks = ["follow", "taste", "curated", "network"];
    const firstReason = (lane, n = 0) =>
      reasons[lane] && reasons[lane][n] ? reasons[lane][n].text : "";
    // Handoff 34-A (1124, 1138): outside the relationship lanes the row is the going sentence for an
    // event event_going_names named, and empty for every other; the relationship lanes keep their
    // reason even on a named event, since the reason wins in the part.
    const goingIds = Object.keys(db.discovery.goingNames);
    const quiet = Object.entries(reasons)
      .filter(([lane]) => !speaks.includes(lane))
      .flatMap(([lane, rows]) =>
        rows
          .filter((r) =>
            goingIds.includes(r.id) ? r.text !== GOING_SENTENCE || !r.going : r.text || !r.hidden,
          )
          .map(() => lane),
      );
    const spoke = Object.entries(reasons)
      .filter(([lane]) => !speaks.includes(lane))
      .some(([, rows]) => rows.some((r) => r.text === GOING_SENTENCE));
    const heights = new Set(Object.values(reasons).flatMap((rows) => rows.map((r) => r.h)));
    record(
      tag +
        " full: the reason row speaks on the four relationship lanes and the going names elsewhere, only for a named event, its height held (1096, 1138)",
      firstReason("follow") === "Because you follow Kwame Mensah." &&
        firstReason("taste") === "Because you follow culture and arts." &&
        firstReason("curated") === "Curated by Sefa Owusu." &&
        firstReason("network", 0) === "Adaeze Nwosu, a connection, is hosting." &&
        firstReason("network", 1) === "Adaeze Nwosu and Ngozi Eze are going." &&
        quiet.length === 0 &&
        spoke &&
        heights.size === 1,
      JSON.stringify({ quiet, spoke, heights: [...heights], follow: firstReason("follow") }),
    );
    const where = await page.evaluate(
      (ids) => {
        const read = (id) =>
          (
            document.querySelector(`[data-discovery-item="${id}"] [data-row="where"]`)
              ?.textContent || ""
          ).trim();
        return ids.map(read);
      },
      [E.supper.event_id, E.readers.event_id, E.cloth.event_id],
    );
    record(
      tag + " full: the where line reads the format and the places (item 4)",
      where[0] === "In person · Accra" &&
        where[1] === "Online" &&
        where[2] === "Hybrid · Accra and London",
      where.join(" / "),
    );
    const digits = await digitsOutsideWhen(page);
    record(
      tag + " full: no digit anywhere but a card's when line (guardrail)",
      digits === "",
      digits,
    );

    // Lanes (item 3): sideways rows of 320 cards with a 12 gap.
    const laneGeo = await page.evaluate(() => {
      const row = document.querySelector('[data-lane="online"] [data-lane-row]');
      const slot = row && row.querySelector("[data-discovery-item]");
      if (!row || !slot) return null;
      const cs = getComputedStyle(row);
      const before = row.scrollLeft;
      row.scrollLeft = 200;
      const moved = row.scrollLeft > before;
      row.scrollLeft = before;
      return {
        gap: cs.columnGap,
        overflowX: cs.overflowX,
        snap: cs.scrollSnapType,
        scrolls: row.scrollWidth > row.clientWidth && moved,
      };
    });
    record(
      tag + " full: a lane is a sideways row, gap 12, that scrolls on its own",
      !!laneGeo &&
        laneGeo.gap === "12px" &&
        laneGeo.overflowX === "auto" &&
        /^x(?: proximity)?$/.test(laneGeo.snap) &&
        laneGeo.scrolls,
      JSON.stringify(laneGeo),
    );
    const seeAll = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-discovery] [data-lanes] > [data-lane]")).map(
        (l) => {
          const a = l.querySelector("a[data-see-all]");
          return { lane: l.getAttribute("data-lane"), href: a ? a.getAttribute("href") : null };
        },
      ),
    );
    const hrefOf = (lane) => {
      const s = seeAll.find((x) => x.lane === lane);
      return s && s.href ? new URL(s.href, "https://x.invalid") : null;
    };
    const soonTo = hrefOf("soon");
    record(
      tag +
        " full: See all on five lanes to their targets, none on the other four (1092, 1112, 1122)",
      !!soonTo &&
        soonTo.pathname === "/convene" &&
        soonTo.searchParams.get("when") === "two_weeks" &&
        ["curated", "follow", "taste", "network"].every(
          (l) => hrefOf(l) && hrefOf(l).pathname === "/convene/" + l,
        ) &&
        ["weekend", "online", "fresh", "near"].every((l) => !hrefOf(l)),
      JSON.stringify(seeAll),
    );

    // Item 7: the LensBar's five lenses, labels always, icons at every tier, no trailing seat.
    const bar = await page.evaluate((compact) => {
      const t = document.querySelector(
        (compact ? "[data-discovery] [data-lens-anchor] " : "[data-layout-top] ") +
          '[role="tablist"][aria-label="Convene lens"]',
      );
      if (!t) return null;
      const tabs = Array.from(t.querySelectorAll('[role="tab"]'));
      return {
        mode: t.getAttribute("data-lensbar"),
        words: tabs.map((x) => (x.textContent || "").trim()),
        names: tabs.map((x) => (x.getAttribute("aria-label") || "").split(":")[0]),
        clipped: tabs.filter((x) => x.scrollWidth > x.clientWidth + 1).length,
        // Strand's Icon is a currentColor mask on an aria-hidden span, not an svg.
        icons: tabs.filter((x) =>
          Array.from(x.querySelectorAll('span[aria-hidden="true"]')).some((i) =>
            /icons\//.test(i.style.maskImage || i.style.webkitMaskImage || i.style.mask || ""),
          ),
        ).length,
        trailing: !!(t.parentElement && t.parentElement.querySelector("[data-lensbar-trailing]")),
        row: !!t.closest("[data-lensbar-row]"),
        // B9-SPEC's compact line: at compact the row scrolls sideways, whole. Fix PR 09 (1515)
        // moved the scroller from the anchor (the seat) to the track itself, so the row read is
        // the track: it scrolls sideways, its scroll width reaches its last seat, and the anchor
        // around it no longer scrolls.
        inRow: compact
          ? (() => {
              const a = t.closest("[data-lens-anchor]");
              const last = tabs[tabs.length - 1];
              return (
                getComputedStyle(t).overflowX === "auto" &&
                !!last &&
                t.scrollWidth >= last.offsetLeft + last.offsetWidth - 1 &&
                !!a &&
                a.scrollLeft === 0
              );
            })()
          : true,
      };
    }, tier === "compact");
    // Item 7 and B9-SPEC's compact line: labels and icons at every tier; at compact in a row that scrolls
    // sideways, each seat whole (the page's own overflow is the noOverflow check below).
    const shorts = VOCAB.convene_lenses.map((l) => l.short).join("|");
    record(
      tag +
        (tier === "compact"
          ? " compact: the LensBar's five lenses with labels and icons in a sideways row, none clipped (B9-SPEC's compact line)"
          : " full: the LensBar's five lenses with labels and icons, no seat after them (1093)"),
      !!bar &&
        bar.mode === "labels" &&
        bar.words.join("|") === shorts &&
        bar.inRow &&
        bar.names.join("|") === shorts &&
        bar.icons === VOCAB.convene_lenses.length &&
        bar.clipped === 0 &&
        !bar.trailing &&
        !bar.row,
      JSON.stringify(bar),
    );
    record(
      tag + " full: the homes line reads Accra and Nairobi (690)",
      (await page.locator("[data-homes-line]").innerText()).trim() === "Accra and Nairobi",
    );
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("[data-canvas]");
      return c ? Math.round(c.getBoundingClientRect().width) : null;
    });
    record(
      tag +
        " full: no right column (item 7), and the canvas the viewport's width at every width this arm runs (1123; the width arm reads no maximum at 1920 and 2560)",
      (await page.locator('[data-scroller="right"]').count()) === 0 &&
        (tier === "compact" || canvas === w),
      "canvas " + canvas,
    );

    // Item 7 (1094, 1111): collapsed at first load at every width, and nothing written on load.
    const first = await page.evaluate((rail) => {
      const nav = document.querySelector(rail);
      return {
        left: document.querySelectorAll('[data-scroller="left"]').length,
        width: nav ? Math.round(nav.getBoundingClientRect().width) : null,
        expand: !!(nav && nav.querySelector('button[aria-label="Show filters"]')),
        axes: nav ? nav.querySelectorAll("[data-axis-id]").length : 0,
        canvas: document.querySelector("[data-canvas]")?.getAttribute("data-rail") ?? null,
        // B9-SPEC's compact line: one row of the homes and the Filters trigger; no chips row until set.
        pill: !!document.querySelector(
          '[data-discovery] [data-first-row] [data-homes-line] ~ [data-testid="filters"]',
        ),
        applied: !!document.querySelector("[data-discovery] [data-applied-row]"),
      };
    }, RAIL);
    record(
      tag +
        (tier === "compact"
          ? " compact: Filters is the trigger and no rail, nothing written on load (1094)"
          : " " +
            tier +
            ": the rail is its collapsed 64 strip at first load, nothing written (1094)"),
      db.discovery.railWrites.length === 0 &&
        (tier === "compact"
          ? first.left === 0 && first.pill && !first.applied
          : first.width === 64 && first.expand && first.axes === 0 && first.canvas === "collapsed"),
      JSON.stringify(first),
    );

    // Item 2 (1095, 1110): the facet set and its order, each axis in its display with its words.
    const scope = await openRail(page, tier);
    const axes = await readAxes(page, scope);
    // B9-SPEC's medium, expanded and Filters lines: the rail 240 open at medium and 280 at expanded,
    // headed Filters.
    const railWidth = await page.evaluate(
      (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width),
      scope,
    );
    record(
      tag +
        " rail: Filters, with Format, Price, When, Topics, Home and Place in that order and display" +
        (tier === "compact" ? "" : ", " + (tier === "medium" ? 240 : 280) + " wide"),
      (tier === "compact" || railWidth === (tier === "medium" ? 240 : 280)) &&
        axes.map((a) => `${a.id}:${a.display}:${a.label}`).join(",") ===
          [
            "format:segment:Format",
            "price:segment:Price",
            "when:segment:When",
            "family:checklist:Topics",
            "home:ladders:Home",
            "place:combobox:Place",
          ].join(","),
      axes.map((a) => `${a.id}:${a.display}:${a.label}`).join(",") + " width " + railWidth,
    );
    const words = Object.fromEntries(axes.map((a) => [a.id, a.options]));
    const railText = await page.locator(scope).innerText();
    record(
      tag + " rail: Format, Price and When led by Any, and no Donation (1095)",
      (words.format || []).join("|") === "Any|In person|Online|Hybrid" &&
        (words.price || []).join("|") === "Any|Free|Paid" &&
        (words.when || []).join("|") === "Any|Next two weeks|This month|Later" &&
        !/donation/i.test(railText),
      JSON.stringify({ format: words.format, price: words.price, when: words.when }),
    );
    record(
      tag + " rail: Topics are the families, Home a ladder per home, Place a combobox; no count",
      (words.family || []).join("|") === VOCAB.convene_families.map((f) => f.label).join("|") &&
        (words.home || []).length === 2 &&
        (words.place || [])[0] === "Anywhere in the world" &&
        !/\d/.test(railText),
      JSON.stringify({ home: words.home, place: words.place }),
    );
    await closeRail(page, tier);
    // The collapsed strip renders from the optimistic state; the second write reaches the mock after.
    for (let t = 0; tier !== "compact" && db.discovery.railWrites.length < 2 && t < 100; t++)
      await page.waitForTimeout(50);
    const writes = db.discovery.railWrites.map(
      (r) => `${r.surface}:${r.width_band}:${r.collapsed}`,
    );
    const band =
      tier === "compact" ? null : tier === "medium" ? "medium" : w >= 1440 ? "wide" : "expanded";
    record(
      tag +
        (tier === "compact"
          ? " compact: the Sheet opens and closes and writes nothing (1111)"
          : " " + tier + ": each toggle writes the member's row for its band (1111)"),
      tier === "compact"
        ? writes.length === 0
        : writes.join(",") === `discovery:${band}:false,discovery:${band}:true`,
      writes.join(","),
    );
    if (tier === "compact") {
      // 947: past 72px the header takes the lens bar and the in-content bar keeps its space hidden.
      await page.evaluate(() => {
        const sc = document.querySelector('[data-scroller="feed"]');
        sc.scrollTop = 400;
        sc.dispatchEvent(new Event("scroll"));
      });
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector("[data-discovery] [data-lens-anchor]"))
            .visibility === "hidden",
        null,
        { timeout: 10000 },
      );
      record(
        tag + " compact: past 72px the header holds the Convene lens bar (947)",
        (await page.locator('[data-app-header] [role="tablist"] [role="tab"]').count()) ===
          VOCAB.convene_lenses.length,
      );
      await page.evaluate(() => {
        const sc = document.querySelector('[data-scroller="feed"]');
        sc.scrollTop = 0;
        sc.dispatchEvent(new Event("scroll"));
      });
    }
    await noOverflow(page, tag + " full");
    await shot(page, `${tag}-01-full`);

    // Item 5 (1097): the menu's items in the ruled order; an item that does not apply is absent.
    const going = await readMenu(page, cardSel(E.supper, "follow"));
    await closeMenu(page);
    const expect = [
      "Share",
      "Copy link",
      "Saved",
      "Add to calendar",
      "|",
      "Following Kwame Mensah",
      "Subscribe to Small social gatherings",
      "|",
      "Not this",
    ];
    record(
      tag +
        " menu: Share, Copy link, Saved, Add to calendar, Following, Subscribe, Not this (1097)",
      going.map((x) => x.label).join(",") === expect.join(",") && going.every((x) => !x.disabled),
      going.map((x) => x.label + (x.disabled ? "(disabled)" : "")).join(","),
    );
    const plain = await readMenu(page, cardSel(E.loaded, "curated"));
    await closeMenu(page);
    // G113: the menu's floor is 240 (220 before correction 28), and above it the menu is its words'
    // width. These items measured 217 in Alegreya Sans and so rendered at the floor; in Inter (1884)
    // the same words are wider, so the reading is the rule itself rather than one font's outcome.
    record(
      tag + " menu: a menu renders at its words' width and never under the 240 minimum (G113)",
      plain.box.min === "240px" && Math.abs(plain.box.width - Math.max(240, plain.box.own)) <= 0.5,
      JSON.stringify(plain.box),
    );
    const other = await readMenu(page, cardSel(E.stream, "network"));
    await closeMenu(page);
    const undated = await readMenu(page, cardSel(E.undated, "fresh"));
    await closeMenu(page);
    record(
      tag +
        " menu: Add to calendar absent when not going or undated, Subscribe absent with no topic, none disabled",
      plain.map((x) => x.label).join(",") ===
        "Share,Copy link,Save,|,Following Kwame Mensah,|,Not this" &&
        other.map((x) => x.label).join(",") ===
          "Share,Copy link,Save,|,Follow Adaeze Nwosu,Subscribe to Learning and dialogue,|,Not this" &&
        undated.map((x) => x.label).join(",") ===
          "Share,Copy link,Save,|,Following Kwame Mensah,Subscribe to Small social gatherings,|,Not this" &&
        [...plain, ...other, ...undated].every((x) => !x.disabled),
      [plain, other, undated].map((m) => m.map((x) => x.label).join(",")).join(" / "),
    );

    // Not this (1044, 1105): out of its lane at once with the toast. No reload before the pane, so
    // the projection still carries the card and only the surface's own skip can step past it; the
    // dismissal's persistence is read on reload after the pane.
    await menuSelect(page, cardSel(E.madina, "soon"), "Not this");
    await page.locator(cardSel(E.madina, "soon")).waitFor({ state: "detached", timeout: 10000 });
    const toast = (await page.locator('[role="status"]').allInnerTexts()).join(" ");

    // A card's title: the pane at expanded (688, 1047), the page's own route below it (1023).
    await page.locator(`${cardSel(E.supper, "soon")} [data-card-open]`).click();
    await page.waitForURL((u) => u.pathname === "/convene/events/" + E.supper.event_id, {
      timeout: 10000,
    });
    await page.waitForSelector('[data-event-page][data-event-state="loaded"]', { timeout: 15000 });
    if (tier === "expanded") {
      await page.waitForTimeout(300);
      const pane = await page.evaluate((id) => {
        const nav = document.querySelector('[data-scroller="left"] nav[aria-label="Filters"]');
        return {
          open: !!document.querySelector('[data-discovery][data-pane-open="1"]'),
          rail: nav ? Math.round(nav.getBoundingClientRect().width) : null,
          col: document.querySelector("[data-canvas]")?.getAttribute("data-rail"),
          right: document.querySelectorAll('[data-scroller="right"]').length,
          lanes: document.querySelectorAll("[data-discovery] [data-lanes] [data-lane]").length,
          back: document.querySelectorAll("[data-event-page] [data-back-row]").length,
          // B9-SPEC's pane line: the header row moves into the list column with the pane open.
          header: !!document.querySelector("[data-pane-list] [data-header-row] [data-homes-line]"),
          ring: Array.from(
            document.querySelectorAll("[data-discovery-item] article[data-selected]"),
          ).map((a) => {
            const s = a.closest("[data-discovery-item]");
            return (
              s.getAttribute("data-section") + ":" + (s.getAttribute("data-discovery-item") === id)
            );
          }),
          expand: !!document.querySelector(
            'button[aria-label="Back to Discovery and show filters"]',
          ),
        };
      }, E.supper.event_id);
      record(
        tag +
          " pane: the event page in the Pane, the 64 strip, no right column, the header row in the list, the card ringed (1083)",
        pane.open &&
          pane.rail === 64 &&
          pane.col === "collapsed" &&
          pane.right === 0 &&
          pane.lanes > 0 &&
          pane.header &&
          pane.back === 0 &&
          pane.expand &&
          pane.ring.join(",") === "soon:true",
        JSON.stringify(pane),
      );
      // Stepping (1083, 1044): Happening soon reads readers, supper, madina, cloth as the projection
      // answered it; madina was dismissed in this session, so the surface steps supper to cloth.
      const stepTo = async (label, id) => {
        await page.locator(`[data-pane-cluster] button[aria-label="${label}"]`).click();
        await page.waitForURL((u) => u.pathname === "/convene/events/" + id, { timeout: 10000 });
        await page.waitForSelector(`${cardSel({ event_id: id }, "soon")} article[data-selected]`, {
          timeout: 10000,
        });
      };
      const disabled = (label) =>
        page
          .locator(`[data-pane-cluster] button[aria-label="${label}"]`)
          .getAttribute("aria-disabled");
      await stepTo("Next event", E.cloth.event_id);
      const endNext = await disabled("Next event");
      await stepTo("Previous event", E.supper.event_id);
      await stepTo("Previous event", E.readers.event_id);
      const endPrev = await disabled("Previous event");
      record(
        tag +
          " pane: Next and Previous step the lane in its visible order past a dismissal, the ends refused",
        endNext === "true" && endPrev === "true",
        `next end ${endNext}, previous end ${endPrev}`,
      );
      // G78: the close control sits in the pane's own top row with the toolbar (correction 28),
      // above the body, so the page's first block starts below it with no row the page reserves.
      const g78 = await page.evaluate(() => {
        const close = document.querySelector('button[aria-label="Back to Discovery"]');
        const firstBlock = document.querySelector("[data-event-page]")?.firstElementChild;
        if (!close || !firstBlock) return null;
        return {
          close: Math.round(close.getBoundingClientRect().bottom),
          first: Math.round(firstBlock.getBoundingClientRect().top),
        };
      });
      record(
        tag + " pane: the page's first block starts below the pane's close control (G78)",
        !!g78 && g78.first >= g78.close,
        JSON.stringify(g78),
      );
      // 719: Escape fires only while focus is within the pane, so focus goes there first.
      await page.getByRole("button", { name: "Back to Discovery", exact: true }).focus();
      await page.keyboard.press("Escape");
      await page.waitForURL((u) => u.pathname === "/convene", { timeout: 10000 });
      await page.waitForTimeout(300);
      record(
        tag + " pane: Escape returns to Discovery with the rail as the member left it (719, 1111)",
        (await page.locator(`${RAIL} button[aria-label="Show filters"]`).count()) === 1 &&
          (await page.locator('[data-discovery][data-pane-open="1"]').count()) === 0,
      );
      // 1047: a cold arrival at the event's address is the same pane, whatever the member came from.
      await page.goto(BASE + "/convene/events/" + LOADED, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
        timeout: 20000,
      });
      record(
        tag + " pane: a cold arrival at /convene/events/{id} is the pane on Discovery (1047)",
        (await page.locator("[data-event-page] [data-back-row]").count()) === 0 &&
          (await page.locator("[data-discovery] [data-lanes] [data-lane]").count()) > 0,
      );
    } else {
      record(
        tag + " " + tier + ": a card's title is a route to the event page with its Back row (1023)",
        (await page.locator("[data-discovery]").count()) === 0 &&
          (await page.locator("[data-event-page] [data-back-row]").count()) === 1,
      );
    }
    await openDiscovery(page);
    record(
      tag + " menu: Not this takes the card out of its lane with the toast, and out on reload",
      toast.includes("Fewer like this in your lanes.") &&
        db.discovery.dismissals.some(
          (d) => d.p_event === E.madina.event_id && d.p_section === "soon",
        ) &&
        (await page.locator(cardSel(E.madina, "soon")).count()) === 0 &&
        (await page.locator(cardSel(E.madina, "near")).count()) === 1,
      toast,
    );

    // Below density (632, 650): the Communities lane is its heading and one sentence, only with
    // suggest, in its own place in convene_lanes order (1092).
    setAnswer(db, belowDensity(E));
    await openDiscovery(page);
    const below = await laneIds(page);
    const firstLane = page.locator('[data-discovery] [data-lane="follow"]');
    const sentence = await firstLane.locator('[data-dia="done"]').allInnerTexts();
    record(
      tag +
        " below: the Communities lane is its heading and DIA's one sentence, in its place in the lanes' order",
      below.join(",") === "online,curated,follow,network" &&
        (await firstLane.locator("h2").innerText()).trim() === "From communities you follow" &&
        sentence.length === 1 &&
        sentence[0].startsWith(
          "You follow no host yet. Kwame Mensah hosts Corridor Suppers in Accra; follow them and their events start here.",
        ) &&
        (await firstLane.locator("[data-discovery-item]").count()) === 0 &&
        // 1053: plain text, the host's name unlinked.
        (await firstLane.locator('[data-dia="done"] a').count()) === 0,
      below.join(",") + " | " + sentence.join(" / "),
    );
    await shot(page, `${tag}-02-below`);

    // No homes (1050): no homes line, no Home axis.
    setAnswer(db, fullDensity(E), []);
    await openDiscovery(page);
    const noHomes = await openRail(page, tier);
    const axesNoHome = (await readAxes(page, noHomes)).map((a) => a.id);
    await closeRail(page, tier);
    record(
      tag + " no homes: the homes line and the Home axis are absent (1050)",
      (await page.locator("[data-homes-line]").count()) === 0 &&
        axesNoHome.join(",") === "format,price,when,family,place",
      axesNoHome.join(","),
    );

    // The one alert, and Try again re-reads.
    db.discovery.fail = true;
    await page.goto(BASE + "/convene", { waitUntil: "networkidle" });
    const alert = page.locator('[data-discovery] [role="alert"]');
    await alert.waitFor({ timeout: 20000 });
    const alertText = await alert.innerText();
    db.discovery.fail = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await page.waitForSelector("[data-discovery] [data-lanes] [data-lane]", { timeout: 20000 });
    record(
      tag + " error: Convene could not load, and Try again re-reads the lanes",
      alertText.includes("Convene could not load.") &&
        alertText.includes("Check your connection and try again."),
      alertText,
    );

    await page.goto(BASE + "/collaborate", { waitUntil: "networkidle" });
    await page.locator('[data-testid="c-stub"][data-c="collaborate"]').waitFor({ timeout: 15000 });
    record(tag + " /collaborate still renders the C stub", true);

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

/**
 * The facet, ladder, write and rail-memory arms (items 1, 2, 6 and 12; Addendum 1's Done Means 6),
 * one per tier plus the wide band, one theme each, alternating: nothing here reads a colour.
 */
const FACET_VIEWPORTS = [
  [[390, 844], "light"],
  [[820, 1180], "dark"],
  [[1280, 800], "light"],
  [[1440, 900], "dark"],
];

async function runDiscoveryFacets(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-facets`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const here = () => new URL(page.url());
  try {
    await signIn(page);

    // Item 1: the three retired lens paths land on /convene, keeping the rest of the query.
    for (const [from, check, want] of [
      [
        "/convene/soon?family=culture_arts",
        (u) =>
          u.searchParams.get("when") === "two_weeks" &&
          u.searchParams.get("family") === "culture_arts",
        "when=two_weeks with the family kept",
      ],
      [
        "/convene/online?price=free",
        (u) => u.searchParams.get("format") === "online" && u.searchParams.get("price") === "free",
        "format=online with the price kept",
      ],
      ["/convene/near", (u) => [...u.searchParams.keys()].length === 0, "no query"],
    ]) {
      await openDiscovery(page, from);
      const u = here();
      record(
        tag + ` redirect: ${from.split("?")[0]} lands on /convene with ${want} (item 1)`,
        u.pathname === "/convene" &&
          check(u) &&
          (await page.locator('[data-discovery][data-lens="all"]').count()) === 1,
        u.pathname + u.search,
      );
    }

    // 1095: Donation is gone. A price of donation never reaches the projection.
    const before = db.discovery.calls.length;
    await openDiscovery(page, "/convene?price=donation,free");
    await settled(page, db, (c) => Array.isArray(c.p_price));
    const sent = db.discovery.calls.slice(before);
    record(
      tag + " donation: a price of donation in the URL is never sent; free still is (1095)",
      sent.length > 0 &&
        sent.every((c) => !(c.p_price || []).includes("donation")) &&
        (lastCall(db).p_price || []).join(",") === "free",
      JSON.stringify(sent.map((c) => c.p_price)),
    );

    // 1145 with 1170 and 1171 (B9-SPEC Revision 7's Lens bar and tiers lines): at medium and expanded
    // each seat is its own label's width, never an equal share, and the bar and the search field
    // centre together as one unit on the line the header's five Cs centre on, the field 140 to 280
    // beside the bar past a 12 gap, or on its own full-width row under the bar where that does not
    // fit, the scope line under the bar either way. Read from the boxes and computed styles: each seat
    // against its word, its glyph, the gap between them, its padding and its border (floored at its
    // min-width); the unit's centre against the five Cs' centre within 1, the unit inside the row.
    if (tier !== "compact") {
      const lensRow = await page.evaluate(() => {
        const t = document.querySelector(
          '[data-layout-top] [role="tablist"][aria-label="Convene lens"]',
        );
        const row = t && t.closest("[data-layout-top]");
        if (!row) return null;
        const px = (v) => parseFloat(v) || 0;
        const r = (n) => Math.round(n * 1000) / 1000;
        const rb = row.getBoundingClientRect();
        const rs = getComputedStyle(row);
        const left = rb.left + px(rs.borderLeftWidth) + px(rs.paddingLeft);
        const right = rb.right - px(rs.borderRightWidth) - px(rs.paddingRight);
        const tb = t.getBoundingClientRect();
        const cs = Array.from(document.querySelectorAll('nav[aria-label="Pulse"] button[data-c]'));
        const csLeft = Math.min(...cs.map((c) => c.getBoundingClientRect().left));
        const csRight = Math.max(...cs.map((c) => c.getBoundingClientRect().right));
        const unit = t.closest("[data-lens-row]");
        const mode = unit ? unit.getAttribute("data-lens-row") : null;
        const field = unit && unit.querySelector("[data-discovery-search] input");
        const fb = field && field.getBoundingClientRect();
        const unitRight = mode === "beside" && fb ? fb.right : tb.right;
        const scope = unit && unit.querySelector("[data-lens-scope]");
        const sb = scope && scope.getBoundingClientRect();
        const seats = Array.from(t.querySelectorAll('[role="tab"]')).map((x) => {
          const cs = getComputedStyle(x);
          const word = x.querySelector(":scope > span:not([aria-hidden])");
          const glyph = x.querySelector(':scope > span[aria-hidden="true"]');
          const label = word ? word.getBoundingClientRect().width : 0;
          const ico = glyph ? glyph.getBoundingClientRect().width + px(cs.columnGap) : 0;
          const own =
            label +
            ico +
            px(cs.paddingLeft) +
            px(cs.paddingRight) +
            px(cs.borderLeftWidth) +
            px(cs.borderRightWidth);
          return {
            id: x.getAttribute("data-lens"),
            seat: r(x.getBoundingClientRect().width),
            own: r(Math.max(px(cs.minWidth), own)),
            label: r(label),
          };
        });
        return {
          row: [r(left), r(right)],
          bar: [r(tb.left), r(tb.right)],
          cs: cs.length,
          dock: document.querySelector('nav[aria-label="Pulse"]')?.getAttribute("data-pulse"),
          mode,
          // The unit's centre less the five Cs' centre, in px.
          centre: r((tb.left + unitRight) / 2 - (csLeft + csRight) / 2),
          inRow: tb.left >= left - 0.5 && unitRight <= right + 0.5,
          field: fb ? [r(fb.left), r(fb.right), r(fb.width)] : null,
          gap: fb ? r(fb.left - tb.right) : null,
          fieldFull: fb ? Math.abs(fb.width - (right - left)) <= 1 : null,
          scopeUnder: sb ? sb.top >= tb.bottom - 0.5 && sb.left >= tb.left - 0.5 : null,
          scroll: [t.scrollWidth, t.clientWidth],
          seats,
        };
      });
      const beside = !!lensRow && lensRow.mode === "beside";
      record(
        tag +
          " lens row: each seat its own label's width, the bar and the field one unit centred on the five Cs, the field 140 to 280 beside the bar or full width under it, the scope line under the bar (1145, 1170, 1171)",
        !!lensRow &&
          lensRow.seats.length === VOCAB.convene_lenses.length &&
          lensRow.seats.every((s) => s.label > 0 && Math.abs(s.seat - s.own) <= 1) &&
          lensRow.cs === 5 &&
          Math.abs(lensRow.centre) <= 1 &&
          lensRow.inRow &&
          lensRow.scopeUnder === true &&
          !!lensRow.field &&
          (beside
            ? Math.abs(lensRow.gap - 12) <= 0.5 &&
              lensRow.field[2] >= SEARCH_MIN_PX - 0.5 &&
              lensRow.field[2] <= SEARCH_MAX_PX + 0.5
            : lensRow.mode === "under" && lensRow.fieldFull === true),
        JSON.stringify(lensRow),
      );
    }

    // Place (1095): typed, offered by kind, picked, narrowing, and removed as a chip.
    await openDiscovery(page);
    let scope = await openRail(page, tier);
    const field = page.locator(`${scope} [data-axis-id="place"] input`);
    await field.click();
    await field.fill("acc");
    await page.locator(`${scope} [data-axis-id="place"] [role="option"]`).first().waitFor({
      timeout: 10000,
    });
    const offered = await page.$$eval(`${scope} [data-axis-id="place"] [role="option"]`, (els) =>
      els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()),
    );
    record(
      tag + " place: typing offers each place with its kind, and no count (1095)",
      offered.join("|") === "Accra City, Ghana|Greater Accra Region, Ghana",
      offered.join("|"),
    );
    await page
      .locator(`${scope} [data-axis-id="place"] [role="option"][data-value="city|ghana|accra"]`)
      .click();
    await page.waitForURL((u) => u.searchParams.get("place") === "city|ghana|accra", {
      timeout: 10000,
    });
    const picked = await settled(
      page,
      db,
      (c) => (c.p_places || []).join(",") === "city|ghana|accra",
    );
    record(
      tag + " place: a pick goes into the query and p_places, and is a removable chip",
      picked &&
        (await page
          .locator(`${scope} [data-axis-id="place"] button[data-chosen="city|ghana|accra"]`)
          .getAttribute("aria-label")) === "Remove Accra",
      JSON.stringify(lastCall(db)),
    );
    if (tier === "compact") await closeRail(page, tier);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-discovery] [data-lane="near"] h2')?.textContent?.trim() ===
        "While you are in Accra",
      null,
      { timeout: 10000 },
    );
    const accraIds = new Set(
      Object.values(E)
        .filter((e) => e.places.includes("city|ghana|accra"))
        .map((e) => e.event_id),
    );
    // The heading is the URL's; the cards are the answer's, which lands after it.
    await lanesUntil(page, (ids) => ids.length > 0 && ids.every((id) => accraIds.has(id)));
    const inAccra = await laneItems(page);
    // B9-SPEC's compact line: at compact, the applied chips and Clear all once a facet is set.
    const appliedRow =
      tier !== "compact" ||
      ((await page.locator("[data-applied-row] [data-applied-facets]").innerText()).includes(
        "Accra",
      ) &&
        (await page
          .locator("[data-applied-row]")
          .getByRole("button", { name: "Clear all", exact: true })
          .count()) === 1);
    const strays = Object.values(inAccra)
      .flat()
      .filter((id) => !accraIds.has(id));
    record(
      tag +
        " place: the lanes narrow to Accra and Near reads While you are in Accra (1095)" +
        (tier === "compact" ? ", the chip and Clear all shown (B9-SPEC's compact line)" : ""),
      strays.length === 0 &&
        Object.keys(inAccra).includes("near") &&
        !Object.keys(inAccra).includes("fresh") &&
        appliedRow,
      JSON.stringify({ lanes: Object.keys(inAccra), strays, appliedRow }),
    );
    if (tier === "compact") scope = await openRail(page, tier);
    await page
      .locator(`${scope} [data-axis-id="place"] button[data-chosen="city|ghana|accra"]`)
      .click();
    await page.waitForURL((u) => !u.searchParams.has("place"), { timeout: 10000 });
    const cleared = await settled(page, db, (c) => !c.p_places);
    record(
      tag + " place: removing the chip takes the place out of the query and the projection",
      cleared,
      JSON.stringify(lastCall(db)),
    );

    // Home (1110): a ladder per home; each rung narrows and Anywhere clears the home.
    const ladders = await page.evaluate(
      (scope) =>
        Array.from(document.querySelectorAll(`${scope} [data-axis-id="home"] [data-ladder]`)).map(
          (l) => ({
            id: l.getAttribute("data-ladder"),
            rungs: Array.from(l.querySelectorAll("[data-option]")).map((b) => b.textContent.trim()),
          }),
        ),
      scope,
    );
    record(
      tag +
        " home: one ladder per home in order, the region rung only where a region is stored (1110)",
      JSON.stringify(ladders) ===
        JSON.stringify([
          { id: H1, rungs: ["In Accra", "Around Accra", "Greater Accra", "Ghana", "Anywhere"] },
          { id: H2, rungs: ["In Nairobi", "Around Nairobi", "Kenya", "Anywhere"] },
        ]),
      JSON.stringify(ladders),
    );
    const RUNG = ["in", "around", "region", "country"];
    for (const rung of RUNG) {
      await page
        .locator(
          `${scope} [data-axis-id="home"] [data-ladder="${H1}"] [data-option="${H1}:${rung}"]`,
        )
        .click();
      await page.waitForURL(
        (u) =>
          u.searchParams.get("home") === H1 &&
          (rung === "in" ? !u.searchParams.has("rung") : u.searchParams.get("rung") === rung),
        { timeout: 10000 },
      );
      const ok = await settled(page, db, (c) => c.p_home === H1 && c.p_home_rung === rung);
      const want = new Set(
        Object.values(E)
          .filter((e) => e.rungs[H1] && RUNG.indexOf(e.rungs[H1]) <= RUNG.indexOf(rung))
          .map((e) => e.event_id),
      );
      const shown = new Set(
        await lanesUntil(
          page,
          (ids) => new Set(ids).size === want.size && ids.every((id) => want.has(id)),
        ),
      );
      const checked = await page
        .locator(`${scope} [data-axis-id="home"] [data-option="${H1}:${rung}"]`)
        .getAttribute("aria-checked");
      record(
        tag + ` home: ${rung} sends p_home with p_home_rung ${rung} and narrows to it (1110)`,
        ok &&
          checked === "true" &&
          shown.size === want.size &&
          [...shown].every((id) => want.has(id)),
        JSON.stringify({ call: lastCall(db), shown: shown.size, want: want.size }),
      );
    }
    await page
      .locator(`${scope} [data-axis-id="home"] [data-ladder="${H1}"] [data-option="anywhere"]`)
      .click();
    await page.waitForURL((u) => !u.searchParams.has("home") && !u.searchParams.has("rung"), {
      timeout: 10000,
    });
    record(
      tag + " home: Anywhere clears the home and the rung, and sends neither (1110)",
      await settled(page, db, (c) => c.p_home === undefined && c.p_home_rung === undefined),
      JSON.stringify(lastCall(db)),
    );
    await closeRail(page, tier);

    // Item 6: every menu act through its existing path, and the word flips.
    await menuSelect(page, cardSel(E.stream, "network"), "Follow Adaeze Nwosu");
    await menuSelect(page, cardSel(E.readers, "online"), "Subscribe to Learning and dialogue");
    await menuSelect(page, cardSel(E.readers, "online"), "Save");
    const flipped = await readMenu(page, cardSel(E.stream, "network"));
    await closeMenu(page);
    const readersMenu = await readMenu(page, cardSel(E.readers, "online"));
    await closeMenu(page);
    record(
      tag +
        " writes: Follow, Subscribe and Save go through set_follow, set_subscription and post_saves",
      db.profile.follows.includes("on") &&
        db.discovery.subscriptionWrites.some(
          (x) => x.p_family === "learning_dialogue" && x.p_on === true,
        ) &&
        db.saves.some((s) => s.post_id === E.readers.post_id) &&
        flipped.some((x) => x.label === "Following Adaeze Nwosu") &&
        readersMenu.some((x) => x.label === "Subscribed to Learning and dialogue") &&
        readersMenu.some((x) => x.label === "Saved"),
      flipped.map((x) => x.label).join(",") + " / " + readersMenu.map((x) => x.label).join(","),
    );
    // The handler is attached as the waiter is made, so a failed menu path cannot leave it
    // rejecting with nothing to catch it.
    const download = page.waitForEvent("download", { timeout: 15000 }).then(
      (d) => d.suggestedFilename(),
      (e) => "no download: " + String(e).slice(0, 80),
    );
    await menuSelect(page, cardSel(E.supper, "follow"), "Add to calendar");
    const file = await download;
    record(
      tag + " writes: Add to calendar downloads the event page's .ics (1097)",
      /\.ics$/.test(file),
      file,
    );

    // Ruling 1144 (B9-SPEC Revision 5's Filters line, amending G102): in the FacetRail, medium and
    // expanded, Topics is one column, each row's bottom at or above the next row's top; only the
    // compact Sheet keeps two columns, its checklist 150 or wider. The columns are the checklist's
    // computed layout and where its rows sit, never the prop the caller passed.
    await openDiscovery(page);
    scope = await openRail(page, tier);
    const topics = await page.evaluate((scope) => {
      const rows = Array.from(
        document.querySelectorAll(`${scope} [data-axis-id="family"] [role="checkbox"]`),
      );
      const boxes = rows.map((b) => b.getBoundingClientRect());
      const list = rows[0] ? rows[0].parentElement : null;
      const cs = list ? getComputedStyle(list) : null;
      const r = (n) => Math.round(n * 10) / 10;
      return {
        rows: boxes.length,
        lefts: [...new Set(boxes.map((b) => Math.round(b.left)))].sort((a, b) => a - b),
        width: list ? r(list.getBoundingClientRect().width) : null,
        layout: cs ? cs.display + " " + cs.flexDirection + " " + cs.gridTemplateColumns : null,
        columns: !cs
          ? null
          : cs.display === "grid"
            ? cs.gridTemplateColumns.split(" ").length
            : cs.display === "flex" && cs.flexDirection === "column"
              ? 1
              : null,
        heights: boxes.map((b) => r(b.height)),
        // How far each row's bottom runs past the next row's top, in document order.
        overrun: boxes.slice(1).map((b, i) => r(boxes[i].bottom - b.top)),
      };
    }, scope);
    const inSheet = tier === "compact";
    record(
      tag +
        (inSheet
          ? " Topics: two columns in the compact Sheet, its checklist 150 or wider (1144, G102)"
          : " Topics: one column in the FacetRail, no row running into the next (1144)"),
      topics.rows > 1 &&
        (inSheet
          ? topics.lefts.length === 2 &&
            topics.columns === 2 &&
            topics.width !== null &&
            topics.width >= 150
          : topics.lefts.length === 1 &&
            topics.columns === 1 &&
            topics.overrun.every((d) => d <= 0)),
      JSON.stringify(topics),
    );
    // G111: in the rail, Clear all is in the pinned heading row and stays in view once the axes have
    // scrolled beneath it, and nothing is at the foot; it clears. The compact Sheet keeps its foot.
    if (tier !== "compact") {
      await page.locator(`${scope} [data-axis-id="family"] [role="checkbox"]`).first().click();
      await page.waitForURL((u) => !!u.searchParams.get("family"), { timeout: 10000 });
      await page.waitForTimeout(300);
      const clear = await page.evaluate((scope) => {
        // The rail is its own scroller (25 §3), bounded by Discovery, and its column stays still.
        const nav = document.querySelector(scope);
        const column = nav && nav.closest('[data-scroller="left"]');
        if (nav) nav.scrollTop = nav.scrollHeight;
        const all = Array.from(nav ? nav.querySelectorAll("button") : []).filter(
          (b) => (b.textContent || "").trim() === "Clear all",
        );
        const b = all[0];
        const pin = b && b.closest("[data-heading-pin]");
        const r = b && b.getBoundingClientRect();
        const n = nav && nav.getBoundingClientRect();
        const hit = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          count: all.length,
          slot: !!b && !!b.closest("[data-clear-slot]"),
          pinned: !!pin,
          scrolled: nav ? Math.round(nav.scrollTop) : null,
          column: column ? column.scrollHeight - column.clientHeight : null,
          top: r && n ? Math.round(r.top - n.top) : null,
          visible: !!hit && !!b && b.contains(hit),
        };
      }, scope);
      if (clear.count === 1)
        await page
          .locator(`${scope} button`, { hasText: "Clear all" })
          .click({ timeout: 5000 })
          .catch(() => undefined);
      await page.waitForTimeout(400);
      const cleared = !new URL(page.url()).searchParams.get("family");
      record(
        tag +
          " Clear all: one, in the rail's pinned heading row, in view after the axes scroll, and it clears (G111)",
        clear.count === 1 &&
          clear.slot &&
          clear.pinned &&
          clear.scrolled > 0 &&
          clear.column === 0 &&
          clear.visible &&
          cleared,
        JSON.stringify({ ...clear, cleared }),
      );
    }
    await closeRail(page, tier);

    // 1111: the rail's state per member per band, read on load and written on toggle only.
    if (tier === "compact") {
      db.discovery.rail.push({ surface: "discovery", width_band: "wide", collapsed: false });
      await openDiscovery(page);
      await openRail(page, tier);
      await closeRail(page, tier);
      record(
        tag + " memory: compact opens no Sheet on load and writes nothing on toggle (1111)",
        db.discovery.railWrites.length === 0 && (await page.locator(SHEET).count()) === 0,
        JSON.stringify(db.discovery.railWrites),
      );
    } else {
      const band = tier === "medium" ? "medium" : w >= 1440 ? "wide" : "expanded";
      // The Place and Home rows above opened and collapsed the rail; memory is read from here on.
      db.discovery.railWrites.length = 0;
      await openDiscovery(page);
      await page.locator(`${RAIL} button[aria-label="Show filters"]`).click();
      await page.locator(`${RAIL} [data-axis-id]`).first().waitFor({ timeout: 10000 });
      // The rail renders open from the optimistic state; the write reaches the mock after it.
      for (let t = 0; db.discovery.railWrites.length < 1 && t < 100; t++)
        await page.waitForTimeout(50);
      await openDiscovery(page);
      await page.waitForTimeout(400);
      const open = await page.locator(`${RAIL} [data-axis-id]`).count();
      record(
        tag + ` memory: the rail opened at ${band} is open after a reload (1111)`,
        open > 0 &&
          db.discovery.railWrites.length === 1 &&
          db.discovery.railWrites[0].width_band === band &&
          db.discovery.railWrites[0].collapsed === false,
        JSON.stringify(db.discovery.railWrites),
      );
      if (tier === "expanded") {
        const other = w >= 1440 ? [1280, 800] : [1440, 900];
        await page.setViewportSize({ width: other[0], height: other[1] });
        await page.waitForTimeout(600);
        const strip = await page.evaluate((rail) => {
          const nav = document.querySelector(rail);
          return nav ? Math.round(nav.getBoundingClientRect().width) : null;
        }, RAIL);
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(600);
        const back = await page.locator(`${RAIL} [data-axis-id]`).count();
        record(
          tag +
            ` memory: at ${other[0]} the other band stays collapsed, and ${w} is open again (1111)`,
          strip === 64 && back > 0 && db.discovery.railWrites.length === 1,
          `strip ${strip}, back ${back}, writes ${db.discovery.railWrites.length}`,
        );
      }
    }

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

/**
 * Handoff 31-D's viewports: the two expanded widths the lens is kept at behind the pane, and the two
 * widths below expanded where Back restores the column and the lane. One theme each, alternating,
 * because nothing here reads a colour; the full density arm above covers both themes at every width.
 */
const PLACE_VIEWPORTS = [
  [[390, 844], "light"],
  [[820, 1180], "dark"],
  [[1280, 800], "light"],
  [[1440, 900], "dark"],
];

/** The Feed's hover-intent hold is 80ms (PostCard, ruling 84); the arm waits well past it. */
const INTENT_WAIT_MS = 600;

async function runDiscoveryPlace(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-place`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);

    // Intent (1067): at expanded with a pointer the event page is read on hover, before any click;
    // at compact on touch it is not. The hover is a real mouse move onto the card.
    if (w === 1280 || w === 390) {
      await openDiscovery(page);
      const card = page.locator(`${cardSel(E.loaded, "curated")} article`).first();
      await card.scrollIntoViewIfNeeded();
      const before = db.attend.reads.length;
      await card.hover();
      await page.waitForTimeout(INTENT_WAIT_MS);
      const read = db.attend.reads.slice(before).includes(LOADED);
      record(
        tag +
          (tier === "expanded"
            ? " intent: hovering a card at expanded with a pointer reads the event page before any click (1067)"
            : " intent: no hover read at compact on touch (1067)"),
        tier === "expanded" ? read : !read,
        JSON.stringify(db.attend.reads.slice(before)),
      );
    }

    if (tier === "expanded") {
      // Lens kept (1063): from a lens with one facet set, the pane opens over that lens with no
      // second Discovery read, and the pane's close returns to the lens with the facet in the query.
      await openDiscovery(page, "/convene/curated?format=hybrid");
      await page.waitForSelector('[data-discovery][data-lens="curated"] [data-discovery-item]', {
        timeout: 20000,
      });
      await page.waitForTimeout(300);
      const reads = db.discovery.calls.length;
      await page.locator("[data-discovery-item] [data-card-open]").first().click();
      await page.waitForURL((u) => u.pathname.startsWith("/convene/events/"), { timeout: 10000 });
      await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
        timeout: 20000,
      });
      await page.waitForTimeout(600);
      const behind = await page.locator("[data-discovery]").getAttribute("data-lens");
      record(
        tag + " lens: the pane keeps the lens it opened from behind it, no second read (1063)",
        behind === "curated" && db.discovery.calls.length === reads,
        `lens ${behind} reads ${reads} -> ${db.discovery.calls.length}`,
      );
      await page.locator('button[aria-label="Back to Discovery"]').click();
      await page.waitForURL((u) => !u.pathname.startsWith("/convene/events/"), { timeout: 10000 });
      const back = new URL(page.url());
      record(
        tag + " lens: closing the pane returns to that lens with the facet in the query (1063)",
        back.pathname === "/convene/curated" &&
          back.searchParams.get("format") === "hybrid" &&
          (await page.locator('[data-discovery][data-lens="curated"]').count()) === 1 &&
          (await page.locator('[data-discovery][data-pane-open="1"]').count()) === 0,
        back.pathname + back.search,
      );
    } else {
      // Place kept (1065): scroll the column, scroll one lane sideways, open an event from it; Back
      // names Discovery and restores both.
      await openDiscovery(page);
      const lane = '[data-lane="online"] [data-lane-row]';
      await page.evaluate((sel) => {
        const row = document.querySelector(sel);
        row.scrollIntoView({ block: "center" });
        row.scrollLeft = row.firstElementChild.getBoundingClientRect().width + 12;
      }, lane);
      await page.waitForTimeout(500);
      const measure = (sel) =>
        page.evaluate((sel) => {
          const col = document.querySelector('[data-scroller="feed"]');
          const row = document.querySelector(sel);
          return { col: col ? col.scrollTop : null, lane: row ? row.scrollLeft : null };
        }, sel);
      const was = await measure(lane);
      const second = page.locator(`${lane} > [data-discovery-item]`).nth(1);
      await second.locator("[data-card-open]").click();
      await page.waitForURL((u) => u.pathname.startsWith("/convene/events/"), { timeout: 10000 });
      await page.waitForSelector('[data-event-page][data-event-state="loaded"] [data-back-row]', {
        timeout: 20000,
      });
      const label = (await page.locator("[data-event-page] [data-back-row]").innerText()).trim();
      record(
        tag + " place: the event page's Back row reads Discovery (1065)",
        label === "Discovery",
        label,
      );
      await page.locator("[data-event-page] [data-back-row]").click();
      await page.waitForURL((u) => u.pathname === "/convene", { timeout: 10000 });
      await page.waitForSelector(lane, { timeout: 20000 });
      await page.waitForTimeout(600);
      const now = await measure(lane);
      record(
        tag + " place: Back restores the column's scroll and the lane's position within 2px (1065)",
        was.col > 0 &&
          was.lane > 0 &&
          Math.abs(now.col - was.col) <= 2 &&
          Math.abs(now.lane - was.lane) <= 2,
        JSON.stringify({ was, now }),
      );
    }

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// Handoff 32-B Addendum 4 (items 1 to 5, rulings 1121 and 1122) and Addendum 5 (item 8, ruling 1123):
// one arm per item, each on its own cells.
// ---------------------------------------------------------------------------------------------------

/** Items 1, 2 and 5: compact, where the page and the Sheet stand in, and expanded, with the pane. */
const FOLLOWUP_VIEWPORTS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];
/** Items 3 and 4 are the pane's, which opens at expanded only: the expanded band and the wide one. */
const PANE_VIEWPORTS = [
  [[1280, 800], "light"],
  [[1600, 1000], "dark"],
];
/** Item 8's widths (1123), with 1600: handoff 33-A reads G110's pane at all five (1127). */
const WIDTH_VIEWPORTS = [
  [[1280, 800], "light"],
  [[1440, 900], "dark"],
  [[1600, 1000], "light"],
  [[1920, 1080], "light"],
  [[2560, 1440], "dark"],
];

/** Item 1's member presenter: a name 416 keeps from this viewer on the post's author line. */
const EFUA = {
  id: "00000000-0000-4000-8000-0000000000f8",
  name: "Efua Asante",
  handle: "efua-asante",
};
const EFUA_PHOTO = "seed/efua-asante.jpg";
/** Item 1's Space presenter: a Space-authored post, hosted by Kwame Mensah. */
const GUILD = { id: "00000000-0000-4000-8000-0000000000c9", name: "Corridor Suppers" };
const VEILED_TITLE = "The reading room";

/**
 * Item 1's two events at the head of Happening soon: one whose post the feed view carries with no
 * author (416 does not admit the author to this viewer), presented by Efua Asante with a photo, and
 * one authored by a Space. Each page names who the database would (event_page and event_presenters
 * resolve both from the same two private functions).
 */
function seedPresenters(db) {
  const veiled = seedEvent(db, "veiled", {
    title: VEILED_TITLE,
    mode: "in_person",
    days: 4,
    cities: ["Accra"],
    family: "learning_dialogue",
    host: { ...EFUA },
  });
  Object.assign(
    db.posts.find((p) => p.id === veiled.post_id),
    { author_name: null, author_handle: null, author_avatar_path: null },
  );
  const guild = seedEvent(db, "guild", {
    title: "Suppers on the corridor",
    mode: "in_person",
    days: 6,
    cities: ["Accra"],
    family: "small_social",
  });
  Object.assign(
    db.posts.find((p) => p.id === guild.post_id),
    {
      author_kind: "space",
      author_id: GUILD.id,
      author_name: null,
      author_handle: null,
      author_avatar_path: null,
    },
  );
  const base = db.attend.pages[LOADED];
  const pageOf = (e, title, presented_by, host) =>
    (db.attend.pages[e.event_id] = {
      ...base,
      event: { ...base.event, id: e.event_id, slug: "discovery-" + e.event_id, title },
      presented_by,
      host,
    });
  const efua = { id: EFUA.id, name: EFUA.name, handle: EFUA.handle, avatar_path: EFUA_PHOTO };
  pageOf(veiled, VEILED_TITLE, { kind: "member", ...efua }, efua);
  pageOf(
    guild,
    "Suppers on the corridor",
    { kind: "space", id: GUILD.id, name: GUILD.name },
    { id: KWAME.id, name: KWAME.name, handle: KWAME.handle, avatar_path: null },
  );
  for (const e of [veiled, guild]) {
    e.places = placeIds(e.cities);
    e.rungs = {};
  }
  const soon = (e) => item(e, { kind: "soon", starts_at: e.starts_at, mode: e.mode });
  db.discovery.sections.soon = [soon(veiled), soon(guild), ...db.discovery.sections.soon];
  return { veiled, guild };
}

/** A client-side navigation, so a public page's loader reads the mock (tests/event.cjs's own). */
async function clientGo(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, path);
}

/** The file a signed avatar URL delivers, or null. */
function photoOf(src) {
  if (!src) return null;
  const at = decodeURIComponent(new URL(src, "https://x.invalid").pathname).split(
    "/profile-media/",
  );
  return at.length > 1 ? at[1] : null;
}

/** A card's presenter row as drawn: the name beside the avatar, and the photo's source. */
function presenterRow(page, card) {
  return page.evaluate((sel) => {
    const control = document.querySelector(sel + ' [data-row="presenter"] button');
    const name = control && control.lastElementChild;
    const img = control && control.querySelector("img");
    return { name: name ? (name.textContent || "").trim() : null, src: img ? img.src : null };
  }, card);
}

/** Opens a card and answers the event page's presenter block: the name after "Presented by". */
async function openAndReadPresenter(page, card, { photo = false } = {}) {
  await page.locator(`${card} [data-card-open]`).click();
  await page.waitForSelector(
    '[data-event-page][data-event-state="loaded"] [data-event-presenter]',
    {
      timeout: 20000,
    },
  );
  // The page's photos come from a second read after the page (EventSurface's `images`), so a page
  // already cached, by hover intent (1067) or by the press on a card's ellipsis (1140), is loaded a
  // commit before its presenter's photo is drawn. A presenter who has a photo is read once it is.
  if (photo)
    await page
      .waitForSelector('[data-event-page][data-event-state="loaded"] [data-event-presenter] img', {
        timeout: 5000,
      })
      .catch(() => undefined);
  return page.evaluate(() => {
    const block = document.querySelector("[data-event-page] [data-event-presenter]");
    const img = block && block.querySelector("img");
    const line = block
      ? Array.from(block.querySelectorAll("span")).find((el) =>
          (el.textContent || "").trim().startsWith("Presented by "),
        )
      : null;
    const name = line ? (line.textContent || "").trim().replace(/^Presented by\s+/, "") : null;
    return { name, src: img ? img.src : null };
  });
}

async function runDiscoveryPresenter(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-presenter`;
  M.armStart(tag);
  const db = makeMockDb();
  seedDiscovery(db);
  const P = seedPresenters(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);
    await openDiscovery(page);
    const veiled = cardSel(P.veiled, "soon");
    const guild = cardSel(P.guild, "soon");
    await page.locator(veiled).waitFor({ timeout: 20000 });
    const row = await presenterRow(page, veiled);
    const menu = (await readMenu(page, veiled)).map((x) => x.label);
    await closeMenu(page);
    const guildRow = await presenterRow(page, guild);
    const guildMenu = (await readMenu(page, guild)).map((x) => x.label);
    await closeMenu(page);
    const pane = await openAndReadPresenter(page, veiled, { photo: true });
    await openDiscovery(page);
    const guildPane = await openAndReadPresenter(page, guild);

    // The card's presenter row: the pane's name and photo, where 416 gives the author line no name.
    record(
      tag + " card: the presenter row names the pane's presenter, with the pane's photo (1121)",
      pane.name === EFUA.name &&
        row.name === pane.name &&
        photoOf(row.src) === EFUA_PHOTO &&
        photoOf(pane.src) === EFUA_PHOTO,
      JSON.stringify({ row, pane }),
    );
    record(
      tag + " menu: Follow names the pane's presenter (1121)",
      menu.includes("Follow " + pane.name) && !menu.some((l) => /^Follow(ing)? Member$/.test(l)),
      menu.join(","),
    );
    record(
      tag + " space: a Space presenter is named as the pane names it, and offers no Follow (1121)",
      guildPane.name === GUILD.name &&
        guildRow.name === guildPane.name &&
        !guildMenu.some((l) => /^Follow/.test(l)),
      JSON.stringify({ guildRow, guildPane, guildMenu }),
    );

    // The Feed's Convene post: "Presented by" is the pane's presenter; the author line keeps 416.
    await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
    const post = page.locator("main article[data-c='convene']", { hasText: VEILED_TITLE }).first();
    await post.waitFor({ timeout: 20000 });
    const lines = await post.evaluate((a) => {
      const col = a.querySelector("header > div");
      const rows = col ? Array.from(col.children).map((c) => (c.innerText || "").trim()) : [];
      return { author: rows[0] || "", meta: rows.find((r) => r.startsWith("Presented by")) || "" };
    });
    record(
      tag +
        " feed: the post's \"Presented by\" is the pane's presenter, and its author line keeps 416",
      lines.meta.startsWith("Presented by " + pane.name + " · ") && lines.author === "Member",
      JSON.stringify(lines),
    );

    // Signed out: Discovery and the Feed are sign-in only, and the public page reads no presenter
    // line; the projection's own role word is what it shows (139 to 141).
    const slug = "the-reading-room";
    db.attend.publicPages[slug] = {
      ...publicPage("loaded", { slug, title: VEILED_TITLE }),
      presented_by: { kind: "member", name: "the host" },
      host: { name: "the host" },
    };
    const reads = db.attend.presenterReads.length;
    const anonCtx = await browser.newContext({
      viewport: { width: w, height: h },
      colorScheme: theme,
    });
    const anon = await anonCtx.newPage();
    await mockSupabase(anon, db);
    await anon.goto(BASE + "/convene", { waitUntil: "networkidle" });
    await anon.waitForURL((u) => u.pathname === "/sign-in", { timeout: 15000 });
    const signInText = await anon.locator("body").innerText();
    await clientGo(anon, "/e/" + slug);
    await anon.waitForSelector(`[data-public-event="${slug}"]`, { timeout: 15000 });
    const publicText = await anon.locator("body").innerText();
    await anonCtx.close();
    record(
      tag + " signed out: no render names the presenter or reads event_presenters (1121)",
      !signInText.includes(EFUA.name) &&
        !publicText.includes(EFUA.name) &&
        publicText.includes(VEILED_TITLE) &&
        db.attend.presenterReads.length === reads,
      JSON.stringify({
        reads: db.attend.presenterReads.slice(reads),
        named: publicText.includes(EFUA.name),
      }),
    );

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

async function runDiscoveryOnline(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-online`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);
    await openDiscovery(page);
    const lanes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-discovery] [data-lanes] > [data-lane]")).map(
        (l) => {
          const a = l.querySelector("a[data-see-all]");
          return { lane: l.getAttribute("data-lane"), href: a ? a.getAttribute("href") : null };
        },
      ),
    );
    const online = lanes.find((l) => l.lane === "online");
    record(
      tag + " Join from anywhere has no See all, and no See all writes a Format value (1122)",
      !!online &&
        online.href === null &&
        lanes
          .filter((l) => l.href)
          .every((l) => !new URL(l.href, "https://x.invalid").searchParams.has("format")),
      JSON.stringify(lanes),
    );

    await openDiscovery(page, "/convene/online?price=free");
    const u = new URL(page.url());
    const sent = await settled(
      page,
      db,
      (c) =>
        JSON.stringify(c.p_format) === '["online"]' && JSON.stringify(c.p_price) === '["free"]',
    );
    record(
      tag +
        " /convene/online lands on /convene with format=online, one value, the rest kept (1122)",
      u.pathname === "/convene" &&
        u.searchParams.getAll("format").join("|") === "online" &&
        u.searchParams.get("price") === "free" &&
        sent,
      u.pathname + u.search + " " + JSON.stringify(lastCall(db)),
    );

    const scope = await openRail(page, tier);
    const format = () =>
      page.evaluate(
        (scope) =>
          Array.from(
            document.querySelectorAll(`${scope} [data-axis-id="format"] [role="radio"]`),
          ).map((r) => ({
            label: (r.textContent || "").trim(),
            on: r.getAttribute("aria-checked") === "true",
          })),
        scope,
      );
    const lit = await format();
    record(
      tag + " Online is lit in Format, and nothing else is (1122)",
      lit
        .filter((x) => x.on)
        .map((x) => x.label)
        .join("|") === "Online",
      JSON.stringify(lit),
    );
    await page
      .locator(`${scope} [data-axis-id="format"] [role="radio"]`, { hasText: "Hybrid" })
      .click();
    await page.waitForURL((v) => v.searchParams.get("format") !== "online", { timeout: 10000 });
    const after = new URL(page.url());
    const relit = await format();
    record(
      tag + " choosing Hybrid replaces Online: the control writes one Format value (1122)",
      after.searchParams.getAll("format").join("|") === "hybrid" &&
        relit
          .filter((x) => x.on)
          .map((x) => x.label)
          .join("|") === "Hybrid" &&
        (await settled(page, db, (c) => JSON.stringify(c.p_format) === '["hybrid"]')),
      after.search + " " + JSON.stringify(relit),
    );
    await closeRail(page, tier);

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

async function runDiscoveryRailPane(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-rail`;
  M.armStart(tag);
  const band = w >= 1440 ? "wide" : "expanded";
  const db = makeMockDb();
  seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const rail = () =>
    page.evaluate((sel) => {
      const nav = document.querySelector(sel);
      const grid = document.querySelector("[data-canvas][data-rail]");
      return {
        state: grid ? grid.getAttribute("data-rail") : null,
        width: nav ? Math.round(nav.getBoundingClientRect().width) : null,
        axes: document.querySelectorAll(sel + " [data-axis-id]").length,
      };
    }, RAIL);
  const stored = () => JSON.stringify(db.discovery.rail.filter((r) => r.width_band === band));
  const writes = async (n) => {
    for (let t = 0; db.discovery.railWrites.length < n && t < 100; t++)
      await page.waitForTimeout(50);
    return db.discovery.railWrites.length;
  };
  const openPane = async () => {
    await page.locator("[data-discovery-item] [data-card-open]").first().click();
    await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
      timeout: 20000,
    });
    await page.waitForTimeout(300);
  };
  const closed = async () => {
    await page.waitForURL((u) => !u.pathname.startsWith("/convene/events/"), { timeout: 10000 });
    await page.waitForTimeout(500);
  };
  try {
    await signIn(page);
    await openDiscovery(page);
    // The member opens the rail: their toggle, one row at this band.
    await page.locator(`${RAIL} button[aria-label="Show filters"]`).click();
    await page.locator(`${RAIL} [data-axis-id]`).first().waitFor({ timeout: 10000 });
    await writes(1);
    const chosen = stored();
    await openPane();
    const during = await rail();
    await page.locator('button[aria-label="Back to Discovery"]').first().click();
    await closed();
    const after = await rail();
    record(
      tag +
        ` the pane takes the rail's width, and closing it returns the rail open as the member left it at ${band} (D6; 1094, 1111)`,
      during.state === "collapsed" &&
        during.width === 64 &&
        after.state === "open" &&
        after.width === 280 &&
        after.axes > 0,
      JSON.stringify({ during, after }),
    );

    // A step and Escape: the same rail, and still only the member's one row.
    await openPane();
    await page.locator('button[aria-label="Next event"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('button[aria-label="Next event"]').first().focus();
    await page.keyboard.press("Escape");
    await closed();
    const escaped = await rail();
    record(
      tag + " opening, stepping and closing the pane write nothing to member_rail_state (1111)",
      escaped.state === "open" && db.discovery.railWrites.length === 1 && stored() === chosen,
      JSON.stringify({ escaped, writes: db.discovery.railWrites.length, stored: stored() }),
    );

    // The member collapses it: the pane closes onto collapsed, and the pane writes nothing.
    await page.locator(`${RAIL} button[aria-label="Collapse filters"]`).click();
    await page.locator(`${RAIL} button[aria-label="Show filters"]`).waitFor({ timeout: 10000 });
    await writes(2);
    const collapsedChoice = stored();
    await openPane();
    await page.locator('button[aria-label="Back to Discovery"]').first().click();
    await closed();
    const back = await rail();
    record(
      tag + " collapsed by the member, the rail is collapsed again after the pane closes (1111)",
      back.state === "collapsed" &&
        back.width === 64 &&
        db.discovery.railWrites.length === 2 &&
        stored() === collapsedChoice,
      JSON.stringify({ back, writes: db.discovery.railWrites.length }),
    );

    // The strip's own expand, pressed with the pane open, is the member's toggle.
    await openPane();
    await page.locator(`${RAIL} button[aria-label="Back to Discovery and show filters"]`).click();
    await closed();
    const n = await writes(3);
    const shown = await rail();
    const last = db.discovery.railWrites[2] || {};
    record(
      tag +
        " the strip's Back to Discovery and show filters closes the pane and opens the rail, one write of the member's (1111)",
      shown.state === "open" &&
        shown.axes > 0 &&
        n === 3 &&
        last.width_band === band &&
        last.collapsed === false,
      JSON.stringify({ shown, writes: db.discovery.railWrites }),
    );

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

async function runDiscoveryStep(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-step`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const read = () =>
    page.evaluate(() => {
      const main = document.querySelector('[data-scroller="feed"]');
      const body = document.querySelector("[data-discovery] [data-pane-body]");
      const section = body && body.parentElement;
      const m = main.getBoundingClientRect();
      const controls = ["Previous event", "Next event", "Back to Discovery"].map((label) => {
        const b = document.querySelector(`[data-pane-cluster] button[aria-label="${label}"]`);
        if (!b) return { label, inView: false };
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          label,
          top: Math.round(r.top),
          inView:
            r.top >= m.top &&
            r.bottom <= Math.min(m.bottom, innerHeight) &&
            !!hit &&
            b.contains(hit),
        };
      });
      // G85: with the pane bounded the list column is its own scroller, and the open card is
      // brought into its view (Pane's selectedKey, 1083).
      const list = document.querySelector("[data-discovery] [data-pane-list]");
      const card = list && list.querySelector("article[data-selected]");
      const l = list && list.getBoundingClientRect();
      const c = card && card.getBoundingClientRect();
      return {
        id: location.pathname.split("/").pop(),
        top: body ? body.scrollTop : null,
        selected: !!c && c.top >= l.top - 1 && c.bottom <= l.bottom + 1,
        // The selected ring is drawn 4 outside the face (1083): whole when it is inside the list.
        ring: !!c && c.top - 4 >= l.top - 0.5 && c.bottom + 4 <= l.bottom + 0.5,
        listScrolled: !!list && list.scrollTop > 0,
        own: !!body && body.scrollHeight > body.clientHeight,
        fits: !!section && section.getBoundingClientRect().bottom <= m.bottom + 1,
        controls,
      };
    });
  const next = async (id) => {
    await page.locator('[data-pane-cluster] button[aria-label="Next event"]').click();
    await page.waitForURL((u) => u.pathname.endsWith("/" + id), { timeout: 10000 });
    await page.waitForSelector('[data-event-page][data-event-state="loaded"]', { timeout: 20000 });
    await page.waitForTimeout(400);
  };
  try {
    await signIn(page);
    await openDiscovery(page);
    // Join from anywhere, in its visible order: readers, stream, harvest, cloth, table.
    await page.locator(`${cardSel(E.readers, "online")} [data-card-open]`).click();
    await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
      timeout: 20000,
    });
    await page.waitForTimeout(400);
    const open = await read();
    record(
      tag + " the pane fits the list column and its body scrolls on its own (B9-SPEC's pane line)",
      open.own && open.fits && open.controls.every((c) => c.inView),
      JSON.stringify(open),
    );
    await page.evaluate(() => {
      document.querySelector("[data-discovery] [data-pane-body]").scrollTop = 600;
    });
    await next(E.stream.event_id);
    const one = await read();
    record(
      tag + " Next once: the pane body at its top, Previous, Next and Back to Discovery in view",
      one.id === E.stream.event_id &&
        one.top === 0 &&
        one.controls.every((c) => c.inView) &&
        one.ring,
      JSON.stringify(one),
    );
    // The body and the list both at their ends before the second step. With the pane bounded the
    // list column is its own scroller (correction 28, G110); the feed column does not scroll.
    await page.evaluate(() => {
      document.querySelector("[data-discovery] [data-pane-body]").scrollTop = 1e6;
      document.querySelector("[data-discovery] [data-pane-list]").scrollTop = 1e6;
    });
    await page.waitForTimeout(300);
    // G85: this step reads Pane's own follow, so the surface's `scrollIntoView` is held still for it.
    await page.evaluate(() => {
      window.__siv = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = function () {};
    });
    await next(E.harvest.event_id);
    const two = await read();
    await page.evaluate(() => {
      HTMLElement.prototype.scrollIntoView = window.__siv;
    });
    record(
      tag +
        " Next twice, from the body's and the list's ends: the body at its top, the controls and the open card in view",
      two.id === E.harvest.event_id &&
        two.top === 0 &&
        two.controls.every((c) => c.inView) &&
        two.selected &&
        two.listScrolled,
      JSON.stringify(two),
    );
    // Hidden, the list has no width to follow the open card in, so a step taken then leaves its
    // scroll where it is (correction 28: the same element, inert, its scroll kept), read on the
    // element itself (930); Show list brings the open card back into view. The list is taken to its
    // end first, away from the open card, so a follow while hidden would have somewhere to move it.
    let refollow = null;
    let hiddenScroll = null;
    const listTool = page.locator('[data-pane-toolbar] [data-tool="list"]');
    const listTop = () =>
      page.evaluate(
        () =>
          Math.round(document.querySelector("[data-discovery] [data-pane-list]").scrollTop * 10) /
          10,
      );
    if ((await listTool.count()) === 1) {
      await page.evaluate(() => {
        document.querySelector("[data-discovery] [data-pane-list]").scrollTop = 1e6;
      });
      await page.waitForTimeout(300);
      await listTool.click();
      await page.waitForTimeout(300);
      const before = await listTop();
      await next(E.cloth.event_id);
      hiddenScroll = { before, after: await listTop() };
      await listTool.click();
      await page.waitForTimeout(500);
      refollow = await read();
    }
    record(
      tag +
        " Hide list, Next, Show list: the step leaves the hidden list's scroll where it was, and the open card is in the list's view again (1083, G110, correction 28)",
      !!refollow &&
        !!hiddenScroll &&
        Math.abs(hiddenScroll.after - hiddenScroll.before) <= 1 &&
        refollow.id === E.cloth.event_id &&
        refollow.selected &&
        refollow.ring,
      JSON.stringify({ hiddenScroll, refollow }),
    );
    // 688: Back to Discovery leaves the lanes where the member left them. The list column scrolls
    // while the pane is open (G110), so the card at its top goes back to the same distance from the
    // feed column's top once the pane has closed.
    const kept = await page.evaluate(() => {
      const list = document.querySelector("[data-discovery] [data-pane-list]");
      list.scrollTop = Math.min(900, list.scrollHeight - list.clientHeight);
      const top = list.getBoundingClientRect().top;
      const first = Array.from(list.querySelectorAll("[data-discovery-item]")).find(
        (e) => e.getBoundingClientRect().bottom > top,
      );
      return {
        scrolled: Math.round(list.scrollTop),
        item: first ? first.getAttribute("data-discovery-item") : null,
        section: first ? first.getAttribute("data-section") : null,
        at: first ? Math.round(first.getBoundingClientRect().top - top) : null,
      };
    });
    await page.waitForTimeout(200);
    await page.locator('[data-pane-cluster] button[aria-label="Back to Discovery"]').click();
    await page.waitForURL((u) => u.pathname === "/convene", { timeout: 10000 });
    await page.waitForTimeout(500);
    const back = await page.evaluate((k) => {
      const column = document.querySelector('[data-scroller="feed"]');
      const el = Array.from(document.querySelectorAll("[data-discovery-item]")).find(
        (e) =>
          e.getAttribute("data-discovery-item") === k.item &&
          e.getAttribute("data-section") === k.section,
      );
      return {
        column: Math.round(column.scrollTop),
        at: el
          ? Math.round(el.getBoundingClientRect().top - column.getBoundingClientRect().top)
          : null,
      };
    }, kept);
    record(
      tag + " Back to Discovery: the lanes where the list column left them (688)",
      kept.scrolled > 0 &&
        kept.item !== null &&
        back.column > 0 &&
        back.at !== null &&
        Math.abs(back.at - kept.at) <= 2,
      JSON.stringify({ kept, back }),
    );

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

async function runDiscoveryHomes(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-homes`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);
    await openDiscovery(page);
    const scope = await openRail(page, tier);
    const ids = (await readAxes(page, scope)).map((a) => a.id);
    record(
      tag + " the Home axis renders between Topics and Place (1110, 928)",
      ids.indexOf("family") > -1 &&
        ids.indexOf("home") === ids.indexOf("family") + 1 &&
        ids.indexOf("place") === ids.indexOf("home") + 1,
      ids.join(","),
    );
    const ladders = await page.evaluate(
      (scope) =>
        Array.from(document.querySelectorAll(`${scope} [data-axis-id="home"] [data-ladder]`)).map(
          (l) => ({
            id: l.getAttribute("data-ladder"),
            rungs: Array.from(l.querySelectorAll("[data-option]")).map((b) => b.textContent.trim()),
          }),
        ),
      scope,
    );
    record(
      tag + " two homes, two ladders: Accra with its region rung, Nairobi with none (1110)",
      JSON.stringify(ladders) ===
        JSON.stringify([
          { id: H1, rungs: ["In Accra", "Around Accra", "Greater Accra", "Ghana", "Anywhere"] },
          { id: H2, rungs: ["In Nairobi", "Around Nairobi", "Kenya", "Anywhere"] },
        ]),
      JSON.stringify(ladders),
    );
    await closeRail(page, tier);

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

/** Where the canvas's content, the rail, the lanes column and the header's row start and end. */
function edges(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const canvas = document.querySelector("[data-canvas]");
    const cs = canvas ? getComputedStyle(canvas) : null;
    const box = canvas ? canvas.getBoundingClientRect() : null;
    const at = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const header = document.querySelector("[data-app-header]");
    const logo = header ? header.querySelector('[data-testid="home"] img') : null;
    const controls = header
      ? Array.from(header.querySelectorAll("a[href], button")).filter(
          (el) => el.getBoundingClientRect().width > 0,
        )
      : [];
    const rail = at('[data-scroller="left"]');
    const main = at('[data-scroller="feed"]');
    return {
      vw,
      maxWidth: cs ? cs.maxWidth : null,
      left: box ? box.left + parseFloat(cs.paddingLeft) : null,
      right: box ? box.right - parseFloat(cs.paddingRight) : null,
      width: box ? box.width : null,
      rail: rail ? rail.left : null,
      main: main ? main.right : null,
      logo: logo ? logo.getBoundingClientRect().left : null,
      control: controls.length
        ? Math.max(...controls.map((el) => el.getBoundingClientRect().right))
        : null,
      scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    };
  });
}

async function runDiscoveryWidth(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-width`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const near = (a, b) => a != null && Math.abs(a - b) <= 1;
  // G110's Copy link and Share: what each hands over (1140, G120).
  await stubHandOver(page);
  try {
    await signIn(page);
    await openDiscovery(page);
    const e = await edges(page);
    const five = e.vw * 0.05;
    const ninetyFive = e.vw * 0.95;
    record(
      tag +
        ` canvas: no maximum, its edges at 5% and 95% of ${w}, the rail and the lanes on them (1123)`,
      e.maxWidth === "none" &&
        near(e.left, five) &&
        near(e.right, ninetyFive) &&
        near(e.rail, five) &&
        near(e.main, ninetyFive),
      JSON.stringify(e),
    );
    record(
      tag +
        " header: the logo's left edge and the rightmost control's right edge on those lines (1123)",
      near(e.logo, five) && near(e.control, ninetyFive),
      JSON.stringify({ logo: e.logo, control: e.control, five, ninetyFive }),
    );
    record(
      tag + " no horizontal page scroll",
      e.scroll <= e.vw,
      `scrollWidth ${e.scroll} viewport ${e.vw}`,
    );

    // The pane at every width: inside the new edges, beside at least one full 320 card.
    await page.locator(`${cardSel(E.supper, "soon")} [data-card-open]`).click();
    await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
      timeout: 20000,
    });
    await page.waitForTimeout(500);
    const pane = await page.evaluate(() => {
      const list = document.querySelector("[data-pane-list]");
      const l = list ? list.getBoundingClientRect() : null;
      const section = document.querySelector('[data-pane-open="true"] > section');
      const s = section ? section.getBoundingClientRect() : null;
      const cards = list
        ? Array.from(list.querySelectorAll("[data-discovery-item] article")).map((a) =>
            a.getBoundingClientRect(),
          )
        : [];
      const whole = cards.filter(
        (c) => Math.round(c.width) === 320 && c.left >= l.left - 0.5 && c.right <= l.right + 0.5,
      );
      return {
        list: l && [Math.round(l.left), Math.round(l.right)],
        pane: s && [Math.round(s.left), Math.round(s.right)],
        whole: whole.length,
        scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        vw: document.documentElement.clientWidth,
      };
    });
    record(
      tag +
        " pane open: the list column holds a full 320 card, the pane inside 95%, no page scroll",
      pane.whole > 0 &&
        !!pane.pane &&
        pane.pane[1] <= Math.round(ninetyFive) + 1 &&
        !!pane.list &&
        pane.list[0] >= Math.round(five) - 1 &&
        pane.scroll <= pane.vw,
      JSON.stringify(pane),
    );

    // Handoff 33-A, G110 (B9-SPEC's pane line, 1127, 1136; correction 28): the pane 520 at the right
    // and the list the rest, both starting level, each scrolling on its own and the feed column not
    // at all, the pane's foot on the canvas's foot (1136: the column's own height less the 16).
    const tracks = () =>
      page.evaluate(() => {
        const r1 = (n) => Math.round(n * 10) / 10;
        const grid = document.querySelector('[data-discovery] [data-pane-open="true"]');
        const list = grid && grid.querySelector(":scope > [data-pane-list]");
        const section = list && list.nextElementSibling;
        const main = document.querySelector('[data-canvas] [data-scroller="feed"]');
        if (!grid || !list || !section || !main) return null;
        const g = grid.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        const s = section.getBoundingClientRect();
        const m = main.getBoundingClientRect();
        const strip = document.querySelector('[data-scroller="left"] nav[aria-label="Filters"]');
        const ls = getComputedStyle(list);
        const tool = document.querySelector('[data-pane-toolbar] [data-tool="list"]');
        return {
          content: r1(g.width),
          list: r1(l.width),
          pane: r1(s.width),
          gap: parseFloat(getComputedStyle(grid).columnGap) || 0,
          left: r1(s.left - g.left),
          right: r1(g.right - s.right),
          tops: [r1(l.top), r1(s.top), strip ? r1(strip.getBoundingClientRect().top) : null],
          foot: [
            r1(s.bottom),
            r1(m.bottom - (parseFloat(getComputedStyle(main).paddingBottom) || 0)),
          ],
          column: [main.scrollHeight, main.clientHeight],
          listScrolls: ls.overflowY === "auto" && list.scrollHeight > list.clientHeight,
          hidden: {
            inert: list.inert === true || list.hasAttribute("inert"),
            aria: list.getAttribute("aria-hidden"),
            visibility: ls.visibility,
            probe: list.getAttribute("data-probe"),
            top: Math.round(list.scrollTop),
          },
          tool: tool ? tool.getAttribute("aria-label") : null,
          tools: Array.from(document.querySelectorAll("[data-pane-toolbar] button")).map((b) =>
            b.getAttribute("aria-label"),
          ),
        };
      });
    // Handoff 33-A Addendum 2 (1143): Pane's body is unpadded, so the event page carries its own
    // inset. The cover's box meets the body's content box at both sides; the kicker, the title and
    // the date row sit --space-5 inside it, the token read off the page. Each side is the gap from
    // the content box's edge to the element's, so the cover reads [0,0] and the text [20,20].
    const inset = () =>
      page.evaluate(() => {
        const r1 = (n) => Math.round(n * 10) / 10;
        const body = document.querySelector("[data-discovery] [data-pane-body]");
        const ep = body && body.querySelector("[data-event-page]");
        if (!ep) return null;
        const bs = getComputedStyle(body);
        const b = body.getBoundingClientRect();
        const left = b.left + body.clientLeft + (parseFloat(bs.paddingLeft) || 0);
        const right =
          b.left + body.clientLeft + body.clientWidth - (parseFloat(bs.paddingRight) || 0);
        const sides = (el) => {
          if (!el) return null;
          const x = el.getBoundingClientRect();
          return [r1(x.left - left), r1(right - x.right)];
        };
        // H60-MEDIA: the cover is MediaBlock's openable frame (a button carrying data-media) inside
        // the page's own wrapper, which now holds 1143's reach; the frame is still the image's parent.
        const img = ep.querySelector(':scope > div > [data-media] > img[src*="post-media"]');
        return {
          body: [r1(left), r1(right)],
          space5: parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--space-5"),
          ),
          cover: sides(img && img.parentElement),
          kicker: sides(ep.querySelector("[data-event-kicker]")),
          title: sides(ep.querySelector("[data-event-title]")),
          when: sides(ep.querySelector('[data-fact="when"]')),
        };
      });
    const insetHolds = (i) =>
      !!i &&
      i.space5 > 0 &&
      !!i.cover &&
      i.cover.every((s) => Math.abs(s) <= 0.5) &&
      [i.kicker, i.title, i.when].every(
        (el) => !!el && el.every((s) => Math.abs(s - i.space5) <= 0.5),
      );
    // The seeded page carries a cover (Brief 10's loaded page, `seed/loaded.jpg`); wait for it.
    await page
      .waitForSelector(
        '[data-pane-body] [data-event-page] > div > [data-media] > img[src*="post-media"]',
        {
          timeout: 10000,
        },
      )
      .catch(() => {});
    const insetShown = await inset();
    const open = await tracks();
    record(
      tag +
        " pane (G110): 520 at the right, the list the rest less the gap, rail, list and pane level, the column still, the foot on the canvas's",
      !!open &&
        Math.abs(open.pane - 520) <= 0.5 &&
        Math.abs(open.list - (open.content - 520 - open.gap)) <= 0.5 &&
        open.right <= 0.5 &&
        Math.abs(open.tops[0] - open.tops[1]) <= 0.5 &&
        open.tops[2] !== null &&
        Math.abs(open.tops[0] - open.tops[2]) <= 0.5 &&
        open.column[0] <= open.column[1] &&
        open.listScrolls &&
        Math.abs(open.foot[0] - open.foot[1]) <= 1 &&
        open.tools.join(",") === "Hide list,Copy link,Share",
      JSON.stringify(open),
    );

    // Hide list: 720, centred, the list the same element, hidden and inert; Show list returns the
    // pane to 520 and the list where it was. (While hidden, scroll anchoring may move the list's
    // offset as its header row wraps at no width; the member reads it only once it is shown.)
    let hidden = null;
    let shown = null;
    let insetHidden = null;
    if (open && open.tool) {
      await page.evaluate(() => {
        const list = document.querySelector("[data-discovery] [data-pane-list]");
        list.setAttribute("data-probe", "kept");
        list.scrollTop = 300;
      });
      const kept = await page.evaluate(() =>
        Math.round(document.querySelector("[data-discovery] [data-pane-list]").scrollTop),
      );
      await page.locator('[data-pane-toolbar] [data-tool="list"]').click();
      await page.waitForTimeout(400);
      hidden = { ...(await tracks()), kept };
      insetHidden = await inset();
      await page.locator('[data-pane-toolbar] [data-tool="list"]').click();
      await page.waitForTimeout(400);
      shown = await tracks();
    }
    record(
      tag +
        " pane (G110): Hide list centres the pane at 720, the list the same element, hidden, inert and where it was; Show list returns 520",
      !!hidden &&
        Math.abs(hidden.pane - 720) <= 0.5 &&
        Math.abs(hidden.left - hidden.right) <= 1 &&
        hidden.hidden.inert &&
        hidden.hidden.aria === "true" &&
        hidden.hidden.visibility === "hidden" &&
        hidden.hidden.probe === "kept" &&
        hidden.kept > 0 &&
        hidden.tool === "Show list" &&
        !!shown &&
        Math.abs(shown.pane - 520) <= 0.5 &&
        shown.hidden.probe === "kept" &&
        Math.abs(shown.hidden.top - hidden.kept) <= 2 &&
        shown.tool === "Hide list",
      JSON.stringify({
        hidden,
        shown: shown && { pane: shown.pane, tool: shown.tool, top: shown.hidden.top },
      }),
    );
    record(
      tag +
        " pane (1143): the event page's cover spans the pane body edge to edge and the kicker, the title and the date row sit --space-5 inside it, list shown and hidden",
      insetHolds(insetShown) && insetHolds(insetHidden),
      JSON.stringify({ shown: insetShown, hidden: insetHidden }),
    );

    // Copy link hands over the open event's public address under /e/, as its page builds it and
    // the card menu hands it over (1140, G120). Share opens the page's share view in the pane
    // (1156, G130), whose row carries the same address, and hands nothing over itself; pressed again
    // it closes. The seeded page is public, its slug "discovery-{id}".
    let handed = null;
    let view = null;
    if (open && open.tools.includes("Copy link") && open.tools.includes("Share")) {
      handed = await handedOver(
        page,
        async () => {
          await page.locator('[data-pane-toolbar] [data-tool="copy"]').click();
          await page.locator('[data-pane-toolbar] [data-tool="share"]').click();
          await page.waitForSelector("[data-pane-share] [data-share-url]", { timeout: 5000 });
        },
        { copied: 1 },
      );
      view = await page.evaluate(() => ({
        url: document.querySelector("[data-pane-share] [data-share-url] span")?.textContent ?? null,
        pressed: document
          .querySelector('[data-pane-toolbar] [data-tool="share"]')
          ?.getAttribute("aria-pressed"),
      }));
      await page.locator('[data-pane-toolbar] [data-tool="share"]').click();
      await page.waitForTimeout(300);
      view.closed = !(await page.$("[data-pane-share]"));
    }
    const publicPath = "/e/discovery-" + E.supper.event_id;
    record(
      tag +
        " pane (G110, 1156): Copy link hands over the open event's public address under /e/, and Share opens the share view carrying it, pressed while it shows (1140, G120, G130)",
      !!handed &&
        handed.copied.length === 1 &&
        onPath(handed.copied[0], publicPath) &&
        handed.shared.length === 0 &&
        !!view &&
        onPath(view.url, publicPath) &&
        view.pressed === "true" &&
        view.closed,
      JSON.stringify({ handed, view }),
    );

    // Every other surface keeps its caps: the Feed at 1920 is still its 1440 columns.
    if (w === 1920) {
      await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-scroller="feed"]', { timeout: 20000 });
      await page.waitForTimeout(400);
      const feed = await edges(page);
      record(
        tag + " the Feed at 1920 still measures its 1440 cap, its header row too (1123)",
        near(feed.width, 1440) && near(feed.control, (1920 + 1440) / 2),
        JSON.stringify({ width: feed.width, control: feed.control }),
      );
    }

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

/**
 * Handoff 33-A, G100 (1067; correction 28): the discovery face is a real link across its whole face.
 * Its title is an anchor to the address a plain click navigates to, a cover spans the face, and the
 * presenter, topic and ellipsis stand above it. A modified or middle press is the browser's and
 * opens no pane; a plain press on the media opens the event, the pane at expanded and the route below.
 * Addendum 1 item 2 (1140, G120): the card menu's Copy link and Share hand over the event's public
 * address under /e/, and for an event with no public page the member address, as the event page does.
 */
async function runDiscoveryLink(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-link`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  // 1140: one event with no public page, as event_page answers it (1028), before any page loads.
  db.attend.pages[E.madina.event_id].event.public = false;
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  await stubHandOver(page);
  // A modified or middle press may open a tab. Each is closed as it opens, and nothing it requests
  // leaves the runner: only this page's requests go on to its mocks and to BASE.
  const opened = [];
  page.context().on("page", (p) => {
    opened.push(p);
    p.close().catch(() => undefined);
  });
  await page.context().route("**/*", (route) => {
    let mine = false;
    try {
      mine = route.request().frame().page() === page;
    } catch {
      mine = false;
    }
    return mine ? route.fallback() : route.abort();
  });
  const card = cardSel(E.supper, "soon");
  try {
    await signIn(page);
    await openDiscovery(page);
    await page.locator(card).scrollIntoViewIfNeeded();
    const face = await page.evaluate((sel) => {
      const art = document.querySelector(`${sel} article[data-presentation="discovery"]`);
      const a = art && art.querySelector("a[data-card-open][href]");
      const cover = a && a.querySelector("[data-card-cover]");
      if (!art || !a || !cover) return { link: !!a, cover: !!cover };
      const at = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      };
      const inside = (el) => {
        const hit = at(el);
        return !!hit && el.contains(hit);
      };
      const edge = parseFloat(getComputedStyle(art).borderTopWidth) || 0;
      const ar = art.getBoundingClientRect();
      const cr = cover.getBoundingClientRect();
      const media = art.querySelector("[data-media]");
      return {
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        anchors: art.querySelectorAll("a[href]").length,
        cover: [Math.round(cr.width * 10) / 10, Math.round(cr.height * 10) / 10],
        inner: [
          Math.round((ar.width - 2 * edge) * 10) / 10,
          Math.round((ar.height - 2 * edge) * 10) / 10,
        ],
        media: !!media && a.contains(at(media)),
        presenter: inside(art.querySelector('[data-row="presenter"] button')),
        topic: inside(art.querySelector('[data-row="presenter"] [data-card-control] button')),
        ellipsis: inside(art.querySelector('button[aria-haspopup="menu"]')),
      };
    }, card);
    const href = face.href ? new URL(face.href, BASE) : null;
    record(
      tag +
        " the face is one link to the event's address, its cover across the face, the presenter, topic and ellipsis above it (G100)",
      !!href &&
        href.pathname === "/convene/events/" + E.supper.event_id &&
        face.target === null &&
        face.anchors === 1 &&
        Math.abs(face.cover[0] - face.inner[0]) <= 1 &&
        Math.abs(face.cover[1] - face.inner[1]) <= 1 &&
        face.media &&
        face.presenter &&
        face.topic &&
        face.ellipsis,
      JSON.stringify(face),
    );

    // A modified press and a middle press are the browser's: this page stays on Discovery. Each is
    // a press at the media's centre, which lands on the link's cover (the check above), so the
    // cover is what receives it, as it does a pointer's.
    const atMedia = await page.evaluate((sel) => {
      const cover = document.querySelector(`${sel} [data-card-cover]`);
      const media = document.querySelector(`${sel} [data-media]`);
      if (!cover || !media) return null;
      const c = cover.getBoundingClientRect();
      const m = media.getBoundingClientRect();
      return { x: m.left + m.width / 2 - c.left, y: m.top + m.height / 2 - c.top };
    }, card);
    // Without a cover (before correction 28) the press goes to the media itself, as a pointer's
    // would, so the check reads what that face does with a modified press.
    const press = (opts) =>
      (atMedia
        ? page
            .locator(`${card} [data-card-cover]`)
            .click({ position: atMedia, timeout: 5000, ...opts })
        : page.locator(`${card} [data-media]`).click({ timeout: 5000, ...opts })
      ).catch(() => undefined);
    const before = page.url();
    await press({ modifiers: ["ControlOrMeta"] });
    await page.waitForTimeout(600);
    const afterModified = page.url();
    await press({ button: "middle" });
    await page.waitForTimeout(600);
    const still = {
      modified: afterModified,
      middle: page.url(),
      pane: await page.locator('[data-discovery][data-pane-open="1"]').count(),
      page: await page.locator("[data-event-page]").count(),
      tabs: opened.length,
    };
    record(
      tag +
        " a modified press and a middle press on the face open no pane and leave this page (G100)",
      still.modified === before && still.middle === before && still.pane === 0 && still.page === 0,
      JSON.stringify(still),
    );

    // A plain press on the media lands in the link: the event at its address, in the pane at
    // expanded and as its own route below it (1023, 1063).
    await press({});
    await page.waitForURL((u) => u.pathname === "/convene/events/" + E.supper.event_id, {
      timeout: 10000,
    });
    await page.waitForSelector("[data-event-page]", { timeout: 20000 });
    const landed = new URL(page.url());
    record(
      tag +
        (tier === "expanded"
          ? " a plain press on the face opens the event in the pane, at the link's address (G100, 1063)"
          : " a plain press on the face opens the event's route, at the link's address (G100, 1023)"),
      !!href &&
        landed.pathname + landed.search === href.pathname + href.search &&
        (tier === "expanded"
          ? (await page.locator('[data-discovery][data-pane-open="1"]').count()) === 1
          : (await page.locator("[data-event-page] [data-back-row]").count()) === 1),
      landed.pathname + landed.search,
    );

    // 1140, G120: the card menu's Copy link, then Share from the menu reopened, read through the
    // harness's stubs. The seeded page is public, its slug "discovery-{id}". `menuSelect` selects as
    // soon as the menu opens, which can be before the read the ellipsis's press started has answered,
    // so a press here may take the awaited path (G131); both paths hand over one address, and the
    // arm reads the address.
    await openDiscovery(page);
    const menuHanded = await handedOver(
      page,
      async () => {
        await menuSelect(page, card, "Copy link");
        await menuSelect(page, card, "Share");
      },
      { copied: 1, shared: 1 },
    );
    const publicPath = "/e/discovery-" + E.supper.event_id;
    record(
      tag +
        " the card menu's Copy link and Share hand over the event's public address under /e/, as its page builds it (1140, G120)",
      menuHanded.copied.length === 1 &&
        onPath(menuHanded.copied[0], publicPath) &&
        menuHanded.shared.length === 1 &&
        onPath(menuHanded.shared[0], publicPath),
      JSON.stringify(menuHanded),
    );

    // An event with no public page: the member address, which is what its page's own Share hands over.
    const memberHanded = await handedOver(
      page,
      () => menuSelect(page, cardSel(E.madina, "soon"), "Copy link"),
      { copied: 1 },
    );
    record(
      tag +
        " for an event with no public page, the card menu's Copy link hands over the member address, as its page does (1140, G120)",
      memberHanded.copied.length === 1 &&
        onPath(memberHanded.copied[0], "/convene/events/" + E.madina.event_id),
      JSON.stringify(memberHanded),
    );

    record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

/**
 * Handoff 33-D item 4 (G123, G124, G128; correction 30 Part B, 1150, 1151). Pane's bounded list
 * column, its toolbar and its follow, read on the part as Discovery binds it, at 1280 and 1440:
 *
 *   G123  the selected card's ring (1083: 2px --bg then 2px --ink, 4 outside the face) inside the
 *         list column's scrollport: at the sides and the top of a lens list whose card fills the
 *         column, at the foot once Next has taken the list to its end, and for a lane's first card
 *         inside the lane's own scrollport as well (the lane pads itself, 1151).
 *   G124  on a toolbar tool, ArrowRight, End, Home and ArrowLeft move focus between the tools, stop
 *         at the ends and never step to another event.
 *   G128  with the list hidden, Next and Previous never write its scrollTop (a setter trap on the
 *         element), its value holds while hidden, and Show list on the event it was hidden on
 *         writes none. Discovery held Pane's key to the same effect from 3d05d50 until this
 *         handoff, so this check read the same before the part's own guard; it is the part's
 *         guard it reads now. Where the list stands after Show list is the engine's: Chromium
 *         moves it back and WebKit does not (G138), so the check does not read it.
 */
async function runDiscoveryPaneTools(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-pane-tools`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const r1 = (v) => Math.round(v * 10) / 10;
  // How far the ring sits inside each scrollport it is in, per side; negative is cut.
  const ring = () =>
    page.evaluate(() => {
      const list = document.querySelector("[data-discovery] [data-pane-list]");
      const card = list && list.querySelector("article[data-selected]");
      if (!card) return null;
      const port = (el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const left = b.left + parseFloat(cs.borderLeftWidth);
        const top = b.top + parseFloat(cs.borderTopWidth);
        return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
      };
      const c = card.getBoundingClientRect();
      const inside = (p) =>
        [
          c.left - 4 - p.left,
          c.top - 4 - p.top,
          p.right - (c.right + 4),
          p.bottom - (c.bottom + 4),
        ].map((v) => Math.round(v * 10) / 10);
      const lane = card.closest("[data-lane-row]");
      return {
        list: inside(port(list)),
        lane: lane ? inside(port(lane)) : null,
        atEnd: Math.abs(list.scrollTop + list.clientHeight - list.scrollHeight) <= 1,
        pad: getComputedStyle(list).paddingTop,
      };
    });
  const whole = (sides, which) => which.every((i) => sides && sides[i] >= -0.5);
  const openCard = async (sel) => {
    await page.locator(`${sel} [data-card-open]`).first().click();
    await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
      timeout: 20000,
    });
    await page.waitForTimeout(500);
  };
  const next = async (id) => {
    await page.locator('[data-pane-cluster] button[aria-label="Next event"]').click();
    await page.waitForURL((u) => u.pathname.endsWith("/" + id), { timeout: 10000 });
    await page.waitForSelector('[data-event-page][data-event-state="loaded"]', { timeout: 20000 });
    await page.waitForTimeout(500);
  };
  const previous = async (id) => {
    await page.locator('[data-pane-cluster] button[aria-label="Previous event"]').click();
    await page.waitForURL((u) => u.pathname.endsWith("/" + id), { timeout: 10000 });
    await page.waitForSelector('[data-event-page][data-event-state="loaded"]', { timeout: 20000 });
    await page.waitForTimeout(500);
  };
  let lensTop = null;
  let lensEnd = null;
  let laneFirst = null;
  let keys = null;
  let hidden = null;
  try {
    await signIn(page);
    // A lens grid: the network lens's cards, each at its one track's width in the list column
    // (G123's sides). A third card, first in the lane, fills a row of the full column's grid at
    // 1280 and 1440, so More on Convene (1148) does not follow the lens and its last card is the
    // list's last.
    db.discovery.sections.network = [
      item(E.table, { kind: "network", host: { id: ADAEZE.id, name: ADAEZE.name } }),
      ...db.discovery.sections.network,
    ];
    await openDiscovery(page, "/convene/network");
    await openCard(cardSel(E.cloth, "network"));
    lensTop = await ring();
    await next(E.stream.event_id);
    lensEnd = await ring();
    // G128: the list at its end, then hidden; Previous then Next; then shown on the same event.
    // Hide moves the list as it lays out on the 0px track, and Show moves it back in Chromium and
    // not in WebKit (G138). Neither is a write, so the trap counts the part's writes alone, and
    // the values compare hidden with hidden.
    const pre = await page.evaluate(() => {
      const list = document.querySelector("[data-discovery] [data-pane-list]");
      list.scrollTop = 1e6;
      return new Promise((r) => setTimeout(() => r(Math.round(list.scrollTop)), 300));
    });
    await page.locator('[data-pane-toolbar] [data-tool="list"]').click();
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => {
      const list = document.querySelector("[data-discovery] [data-pane-list]");
      const d = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
      window.__g128 = [];
      Object.defineProperty(list, "scrollTop", {
        configurable: true,
        get() {
          return d.get.call(this);
        },
        set(v) {
          window.__g128.push(v);
          d.set.call(this, v);
        },
      });
      return Math.round(list.scrollTop);
    });
    await previous(E.cloth.event_id);
    await next(E.stream.event_id);
    const mid = await page.evaluate(() =>
      Math.round(document.querySelector("[data-discovery] [data-pane-list]").scrollTop),
    );
    await page.locator('[data-pane-toolbar] [data-tool="list"]').click();
    await page.waitForTimeout(500);
    hidden = await page.evaluate(
      ({ pre, before, mid }) => {
        const list = document.querySelector("[data-discovery] [data-pane-list]");
        const writes = window.__g128.slice();
        delete list.scrollTop;
        return { pre, before, mid, after: Math.round(list.scrollTop), writes };
      },
      { pre, before, mid },
    );
    // A lane's first card, from All (1151).
    await openDiscovery(page, "/convene");
    const firstLane = await page.evaluate(() => {
      const row = document.querySelector("[data-lanes] [data-lane-row]");
      const item = row && row.querySelector("[data-discovery-item]");
      return item
        ? `[data-discovery-item="${item.getAttribute("data-discovery-item")}"][data-section="${item.getAttribute("data-section")}"]`
        : null;
    });
    if (firstLane) {
      await openCard(firstLane);
      laneFirst = await ring();
    }
    // G124 last, on the lane card's open pane: on a build whose toolbar keys step, they move the
    // open event, and nothing after this reads the pane.
    const url = page.url();
    keys = await (async () => {
      const tool = () =>
        page.evaluate(
          () =>
            (document.activeElement && document.activeElement.getAttribute("data-tool")) || null,
        );
      await page.locator('[data-pane-toolbar] [data-tool="list"]').focus();
      const seen = [await tool()];
      for (const k of ["ArrowRight", "End", "ArrowRight", "Home", "ArrowLeft"]) {
        await page.keyboard.press(k);
        await page.waitForTimeout(250);
        seen.push(await tool());
      }
      return { seen, stayed: page.url() === url };
    })();
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  record(
    tag +
      " G123: in a lens list the selected card's ring is inside the list column's scrollport at its sides and top (correction 30, 1150)",
    !!lensTop && whole(lensTop.list, [0, 1, 2]),
    JSON.stringify(lensTop),
  );
  record(
    tag +
      " G123: Next onto the last card takes the list to its end, and the ring is inside the scrollport at its foot",
    !!lensEnd && lensEnd.atEnd && whole(lensEnd.list, [0, 1, 2, 3]),
    JSON.stringify(lensEnd),
  );
  record(
    tag +
      " G123: a lane's first card, selected, keeps its ring inside the lane's own scrollport and the list column's (1151)",
    !!laneFirst &&
      !!laneFirst.lane &&
      whole(laneFirst.lane, [0, 1]) &&
      whole(laneFirst.list, [0, 1]),
    JSON.stringify(laneFirst),
  );
  record(
    tag +
      " G124: ArrowRight, End, Home and ArrowLeft on the toolbar move focus between its tools, stop at the ends and never step",
    !!keys &&
      keys.stayed &&
      JSON.stringify(keys.seen) ===
        JSON.stringify(["list", "copy", "share", "share", "list", "list"]),
    JSON.stringify(keys),
  );
  record(
    tag +
      " G128: with the list hidden, Previous and Next never write its scrollTop, and Show list on the same event writes none",
    !!hidden && hidden.writes.length === 0 && Math.abs(hidden.mid - hidden.before) <= 1,
    JSON.stringify(hidden),
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/**
 * Handoff 33-D item 4 (1146, 1153): IconButton's built-in Tooltip, measured in the browser where
 * Strand's readout could only read the delay it scheduled. On a fine pointer, on the open pane's
 * toolbar: resting on Hide list paints no tooltip before 250 ms and one by 600 ms; the neighbour's,
 * Copy link, paints within 100 ms of the pointer reaching it; Escape takes it away and nothing
 * paints again while the pointer rests; and the tool's accessible name is its label alone, with no
 * `title` and no `aria-describedby`, while its tooltip shows. On a touch cell, resting on and
 * focusing the header's bell paints none. The times are the page's own, from the pointerover the
 * browser fires to the tooltip's insertion, so the harness's round trips are not in them.
 */
async function runDiscoveryTooltip(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-tooltip`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const pointer = w > 1024;
  const watch = () =>
    page.evaluate(() => {
      const tt = (window.__tt = { over: [], shown: [] });
      const name = (el) => {
        const host = el instanceof Element ? el.closest("[data-tooltip-host]") : null;
        const b = host && host.querySelector("button");
        return b ? b.getAttribute("aria-label") : null;
      };
      document.addEventListener(
        "pointerover",
        (e) => {
          const label = name(e.target);
          if (label && !tt.over.some((o) => o.label === label && o.open)) {
            tt.over.forEach((o) => (o.open = false));
            tt.over.push({ label, t: performance.now(), open: true });
          }
        },
        true,
      );
      new MutationObserver((ms) => {
        for (const m of ms)
          for (const n of m.addedNodes)
            if (n instanceof Element && n.matches("[data-tooltip]"))
              tt.shown.push({ label: n.textContent, t: performance.now() });
      }).observe(document.body, { childList: true, subtree: true });
    });
  const center = async (sel) => {
    const b = await page.locator(sel).boundingBox();
    return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
  };
  const shownFor = (label, ms) =>
    page
      .waitForFunction(
        (label) => {
          const t = document.querySelector("[data-tooltip]");
          return !!t && t.textContent === label && getComputedStyle(t).visibility === "visible";
        },
        label,
        { timeout: ms },
      )
      .then(() => true)
      .catch(() => false);
  const delay = (label) =>
    page.evaluate((label) => {
      const over = window.__tt.over.filter((o) => o.label === label).pop();
      const shown = window.__tt.shown
        .filter((s) => s.label === label && over && s.t >= over.t)
        .shift();
      return over && shown ? Math.round(shown.t - over.t) : null;
    }, label);
  const count = () => page.locator("[data-tooltip]").count();
  try {
    await signIn(page);
    if (pointer) {
      await openDiscovery(page, "/convene/network");
      await page
        .locator(`${cardSel(E.cloth, "network")} [data-card-open]`)
        .first()
        .click();
      await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-pane-toolbar]', {
        timeout: 20000,
      });
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      // Rest well away first, past the grace window, so the first read is the delay and not a
      // neighbour's grace.
      await page.mouse.move(2, h - 2);
      await page.waitForTimeout(800);
      await watch();
      const hide = await center('[data-pane-toolbar] [data-tool="list"]');
      const copy = await center('[data-pane-toolbar] [data-tool="copy"]');
      await page.mouse.move(hide[0], hide[1], { steps: 4 });
      const first = (await shownFor("Hide list", 3000)) ? await delay("Hide list") : null;
      const box = await page.evaluate(() => {
        const t = document.querySelector("[data-tooltip]");
        const b = document.querySelector('[data-pane-toolbar] [data-tool="list"]');
        if (!t || !b) return null;
        const r = t.getBoundingClientRect();
        const c = b.getBoundingClientRect();
        return {
          placement: t.getAttribute("data-placement"),
          clear: r.top >= c.bottom || r.bottom <= c.top,
        };
      });
      record(
        tag +
          " rest on a Pane tool: no tooltip before 250 ms, one by 600 ms, placed off the control (1146, 1153)",
        first !== null && first >= 250 && first <= 600 && !!box && box.clear,
        JSON.stringify({ first, box }),
      );
      await page.mouse.move(copy[0], copy[1], { steps: 4 });
      const second = (await shownFor("Copy link", 3000)) ? await delay("Copy link") : null;
      record(
        tag + " the neighbour's tooltip within 100 ms, inside the grace (1146)",
        second !== null && second <= 100,
        JSON.stringify({ second }),
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
      const gone = await count();
      await page.waitForTimeout(800);
      const later = await count();
      const open = await page.locator('[data-discovery][data-pane-open="1"]').count();
      record(
        tag +
          " Escape takes the showing tooltip away and nothing paints again while the pointer rests",
        second !== null && gone === 0 && later === 0 && open === 1,
        JSON.stringify({ showing: second !== null, gone, later, open }),
      );
      await page.mouse.move(2, h - 2, { steps: 4 });
      await page.waitForTimeout(800);
      await page.mouse.move(hide[0], hide[1], { steps: 4 });
      const again = await shownFor("Hide list", 3000);
      const name = await page.evaluate(() => {
        const b = document.querySelector('[data-pane-toolbar] [data-tool="list"]');
        const t = document.querySelector("[data-tooltip]");
        return {
          label: b && b.getAttribute("aria-label"),
          title: b && b.getAttribute("title"),
          describedby: b && b.getAttribute("aria-describedby"),
          tipHidden: t && t.getAttribute("aria-hidden"),
        };
      });
      const byRole = await page.getByRole("button", { name: "Hide list", exact: true }).count();
      record(
        tag +
          " the tool's accessible name is its label alone while its tooltip shows: no title, no aria-describedby",
        again &&
          name.label === "Hide list" &&
          name.title === null &&
          name.describedby === null &&
          name.tipHidden === "true" &&
          byRole === 1,
        JSON.stringify({ again, name, byRole }),
      );
    } else {
      // A touch cell: the pointer mode is coarse, so nothing paints on rest or on focus.
      await openDiscovery(page, "/convene");
      await watch();
      await page.locator('[data-testid="bell"]').hover();
      await page.waitForTimeout(800);
      const rest = await count();
      await page.locator('[data-testid="bell"]').focus();
      await page.waitForTimeout(800);
      const focus = await count();
      const title = await page.locator('[data-testid="bell"]').getAttribute("title");
      record(
        tag +
          " on touch the bell paints no tooltip on rest or on focus, and carries no title (1146)",
        rest === 0 && focus === 0 && title === null,
        JSON.stringify({ rest, focus, title }),
      );
    }
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

// ---------------------------------------------------------------------------------------------------
// Handoff 34-A (1124 to 1174): the search, the learned order and the acts that teach it, Filling up
// and the going row, the lens grid with More on Convene, and the share view in the pane. One arm
// each, on its own cells. The Browse lane's arm went with the lane (1172).
// ---------------------------------------------------------------------------------------------------

/** One cell per tier: the field's place differs at each (B9-SPEC's tiers, 1124). */
const SEARCH_VIEWPORTS = [
  [[390, 844], "light"],
  [[820, 1180], "dark"],
  [[1280, 800], "light"],
];
const SEARCH_FIELD = '[data-discovery-search] input[role="searchbox"]';

/**
 * The search (1124, 1159): one field in its tier's place; Enter applies the trimmed text as q, sends
 * it as p_q and shows it as the first applied chip; Escape clears the draft alone; when every lane
 * drops, the search's EmptyState with Clear all fills its column; and Clear all takes the search with
 * the facets. The mock narrows each item by its `_text`, the words the projection matches.
 */
async function runDiscoverySearch(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-search`;
  M.armStart(tag);
  const { readEmpty, emptyFills } = require("./mount.cjs");
  const tier = tierOf(w);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const kente = [E.kumasi.event_id, E.cloth.event_id];
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const q = () => page.evaluate(() => new URL(location.href).searchParams.get("q"));
  let place = null;
  let applied = null;
  let escaped = null;
  let none = null;
  let cleared = null;
  try {
    await signIn(page);
    await openDiscovery(page);
    place = await page.evaluate((tier) => {
      const fields = Array.from(
        document.querySelectorAll('[data-discovery-search] input[role="searchbox"]'),
      );
      const f = fields[0];
      if (!f) return { count: 0 };
      const r1 = (v) => Math.round(v * 10) / 10;
      const out = {
        count: fields.length,
        name: f.getAttribute("aria-label"),
        placeholder: f.getAttribute("placeholder"),
        max: f.maxLength,
        width: r1(f.getBoundingClientRect().width),
        inRow: !!f.closest("[data-layout-top]"),
      };
      const wrap = f.closest("[data-discovery-search]");
      if (tier === "compact") {
        const anchor = document.querySelector("[data-discovery] [data-lens-anchor]");
        const root = document.querySelector("[data-discovery]");
        out.afterBar =
          !!anchor && !!(anchor.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING);
        out.full =
          !!root &&
          Math.abs(wrap.getBoundingClientRect().width - root.getBoundingClientRect().width) <= 1;
        return out;
      }
      const row = f.closest("[data-lens-row]");
      const bar = row && row.querySelector('[role="tablist"]');
      const top = f.closest("[data-layout-top]");
      out.mode = row ? row.getAttribute("data-lens-row") : null;
      if (row && bar && top) {
        const tb = top.getBoundingClientRect();
        const cs = getComputedStyle(top);
        const left = tb.left + parseFloat(cs.paddingLeft);
        const right = tb.right - parseFloat(cs.paddingRight);
        const bb = bar.getBoundingClientRect();
        const fb = f.getBoundingClientRect();
        // 1170: the unit (the bar, or the bar and the field beside it) against the five Cs' centre.
        const c = Array.from(document.querySelectorAll('nav[aria-label="Pulse"] button[data-c]'));
        const cl = Math.min(...c.map((x) => x.getBoundingClientRect().left));
        const cr = Math.max(...c.map((x) => x.getBoundingClientRect().right));
        out.beside = fb.left >= bb.right - 0.5 && fb.top < bb.bottom && fb.bottom > bb.top;
        out.under = fb.top >= bb.bottom - 0.5;
        const unitRight = out.beside ? fb.right : bb.right;
        out.centre = r1((bb.left + unitRight) / 2 - (cl + cr) / 2);
        out.full = Math.abs(fb.width - (right - left)) <= 1;
      }
      return out;
    }, tier);

    const field = page.locator(SEARCH_FIELD);
    await field.click();
    await field.fill("  kente  ");
    await field.press("Enter");
    await page.waitForFunction(
      () => new URL(location.href).searchParams.get("q") === "kente",
      null,
      { timeout: 10000 },
    );
    await settled(page, db, (c) => c.p_q === "kente");
    const ids = await lanesUntil(
      page,
      (ids) => ids.length > 0 && ids.every((id) => kente.includes(id)),
    );
    applied = {
      ...(await page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll("[data-applied-facets] > *"));
        const first = chips[0];
        return {
          first: first ? (first.innerText || "").trim() : null,
          search: !!(first && first.querySelector("[data-search-chip]")),
          value: document.querySelector('[data-discovery-search] input[role="searchbox"]').value,
        };
      })),
      q: await q(),
      call: lastCall(db).p_q ?? null,
      ids: [...new Set(ids)],
      // 1173: how many matches each shown lane holds, against the lane's floor.
      lanes: Object.fromEntries(
        Object.entries(await laneItems(page)).map(([lane, items]) => [lane, items.length]),
      ),
    };

    const calls = db.discovery.calls.length;
    await field.fill("harbour");
    await field.press("Escape");
    await page.waitForTimeout(400);
    escaped = {
      value: await field.inputValue(),
      q: await q(),
      calls: db.discovery.calls.length - calls,
    };

    await field.fill("zzzz");
    await field.press("Enter");
    await page.getByText("Nothing matches that search.").waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    none = await page.evaluate(() => ({
      lanes: document.querySelectorAll("[data-discovery] [data-lane]").length,
      states: document.querySelectorAll("[data-discovery] [data-empty-state]").length,
      actions: Array.from(
        document.querySelectorAll("[data-discovery] [data-empty-state] button"),
      ).map((b) => (b.textContent || "").trim()),
    }));
    none.fill = emptyFills(await readEmpty(page));
    none.digits = await digitsOutsideWhen(page);

    await page
      .locator("[data-discovery] [data-empty-state]")
      .getByRole("button", { name: "Clear all" })
      .click();
    await page.waitForFunction(() => !new URL(location.href).searchParams.has("q"), null, {
      timeout: 10000,
    });
    await settled(page, db, (c) => c.p_q == null);
    const back = await lanesUntil(page, (ids) => ids.length > 0);
    cleared = {
      q: await q(),
      value: await field.inputValue(),
      call: lastCall(db).p_q ?? null,
      lanes: (await laneIds(page)).length,
      items: back.length,
    };
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  const placed =
    !!place &&
    place.count === 1 &&
    place.name === "Search events" &&
    place.placeholder === "Search events, hosts, places" &&
    (tier === "compact"
      ? place.afterBar && place.full && !place.inRow
      : place.inRow &&
        Math.abs(place.centre) <= 1 &&
        ((place.mode === "beside" &&
          place.beside &&
          place.width >= SEARCH_MIN_PX - 0.5 &&
          place.width <= SEARCH_MAX_PX + 0.5) ||
          (place.mode === "under" && place.under && place.full)));
  record(
    tag +
      (tier === "compact"
        ? " search: one field named Search events, full width under the lens bar (1124)"
        : " search: one field named Search events in the lens row, 140 to 280 beside the bar as one unit centred on the five Cs, or full width under the bar where the unit does not fit (1124, 1170, 1171)"),
    placed,
    JSON.stringify(place),
  );
  record(
    tag +
      " search: Enter applies the trimmed text as q, sends it as p_q and shows it as the first applied chip, and the lanes narrow to what matches (1124, 1159)",
    !!applied &&
      applied.q === "kente" &&
      applied.call === "kente" &&
      applied.first === "kente" &&
      applied.search &&
      applied.value === "kente" &&
      applied.ids.length > 0 &&
      applied.ids.every((id) => kente.includes(id)),
    JSON.stringify(applied),
  );
  // 1173: under a search the floors do not apply. Happening soon's floor is four (B9-SPEC's Lanes
  // line) and one event matches "kente" in it, so the lane shows with its one match.
  const belowFloor =
    !!applied && Object.entries(applied.lanes).filter(([lane, n]) => n < LANE_FLOORS[lane]);
  record(
    tag +
      " search: a lane holding a single match shows under a search, below the floor it would need without one (1173)",
    !!applied &&
      applied.lanes["soon"] === 1 &&
      !!belowFloor &&
      belowFloor.length > 0 &&
      Object.values(applied.lanes).every((n) => n > 0),
    JSON.stringify({ lanes: applied && applied.lanes, belowFloor }),
  );
  record(
    tag + " search: Escape clears the draft and leaves the applied search as it is (1124)",
    !!escaped && escaped.value === "" && escaped.q === "kente" && escaped.calls === 0,
    JSON.stringify(escaped),
  );
  record(
    tag +
      " search: when every lane drops, one EmptyState, Nothing matches that search., with Clear all, filling its column and counting nothing (B9-SPEC States, 1147)",
    !!none &&
      none.lanes === 0 &&
      none.states === 1 &&
      none.actions.join("|") === "Clear all" &&
      none.fill.ok &&
      none.digits === "",
    JSON.stringify(none),
  );
  record(
    tag + " search: Clear all takes the search with the facets, and the lanes return (1124)",
    !!cleared &&
      cleared.q === null &&
      cleared.value === "" &&
      cleared.call === null &&
      cleared.lanes > 0 &&
      cleared.items > 0,
    JSON.stringify(cleared),
  );
  record(
    tag + " search: the field holds 100 characters, the most the projection takes (1159)",
    !!place && place.max === 100,
    place ? "maxLength " + place.max : "no field",
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/** The search field's bounds beside the bar (B9-SPEC's medium line, 1124). */
const SEARCH_MIN_PX = 140;
const SEARCH_MAX_PX = 280;
/** The lanes' floors as B9-SPEC Revision 7's Lanes line gives them (632), which a search lifts (1173). */
const LANE_FLOORS = {
  soon: 4,
  weekend: 2,
  online: 2,
  filling: 2,
  fresh: 2,
  curated: 1,
  follow: 1,
  taste: 2,
  near: 2,
  network: 1,
};

/** Learned order and its acts (1160): the pane's cell, and compact's, where a card opens a route. */
const ORDER_VIEWPORTS = [
  [[1280, 800], "light"],
  [[390, 844], "dark"],
];

/**
 * Learned order (1124, 1160): the lanes render in the answer's order, which the member's acts in the
 * week lead, with no re-sort in the surface; the Communities sentence takes its place by lane_order;
 * nothing is written on load; a card opened from a lane writes open for that lane once and the
 * pane's Previous and Next write nothing; Save and Follow from a card's menu write save and follow
 * for its lane, and undoing either writes nothing.
 */
async function runDiscoveryOrder(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-order`;
  M.armStart(tag);
  const expanded = tierOf(w) === "expanded";
  const db = makeMockDb();
  const E = seedDiscovery(db);
  // Two acts in the week, the older from New this week and the newer from My network: the mock
  // answers those lanes first, most recent first, as the projection does.
  const hour = 3600e3;
  db.discovery.laneActs.push(
    { p_lane: "fresh", p_act: "save", at: Date.now() - 2 * hour },
    { p_lane: "network", p_act: "open", at: Date.now() - hour },
  );
  const learned = [
    "network",
    "fresh",
    ...DISCOVERY_SECTIONS.filter((x) => x !== "network" && x !== "fresh"),
  ];
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  const acts = (from) => db.discovery.laneActs.slice(from).map((a) => a.p_lane + ":" + a.p_act);
  const until = async (n) => {
    for (let t = 0; t < 50 && db.discovery.laneActs.length < n; t++) await page.waitForTimeout(100);
  };
  let onLoad = null;
  let rendered = null;
  let opened = null;
  let stepped = null;
  let saved = null;
  let followed = null;
  let sentence = null;
  try {
    await signIn(page);
    let n = db.discovery.laneActs.length;
    await openDiscovery(page);
    await page.waitForTimeout(400);
    onLoad = acts(n);
    rendered = await laneIds(page);

    // A card opened from This weekend: the pane at expanded, the event's route below it.
    n = db.discovery.laneActs.length;
    await page
      .locator(`${cardSel(E.supper, "weekend")} [data-card-open]`)
      .first()
      .click();
    if (expanded) {
      await page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
        timeout: 20000,
      });
      await until(n + 1);
      await page.waitForTimeout(300);
      opened = acts(n);
      const m = db.discovery.laneActs.length;
      await page.locator('[data-pane-cluster] button[aria-label="Next event"]').click();
      await page.waitForURL((u) => u.pathname.endsWith("/" + E.tema.event_id), { timeout: 10000 });
      await page.waitForTimeout(600);
      stepped = acts(m);
      await page.locator('button[aria-label="Back to Discovery"]').first().click();
      await page.waitForSelector("[data-discovery]:not([data-pane-open]) [data-lanes]", {
        timeout: 20000,
      });
    } else {
      await page.waitForURL((u) => u.pathname.endsWith("/" + E.supper.event_id), {
        timeout: 20000,
      });
      await until(n + 1);
      await page.waitForTimeout(300);
      opened = acts(n);
      stepped = [];
      await openDiscovery(page);
    }

    // Save from a card's menu in a lane, then unsave.
    n = db.discovery.laneActs.length;
    await menuSelect(page, cardSel(E.tema, "weekend"), "Save");
    await until(n + 1);
    await page.waitForTimeout(300);
    const afterSave = db.discovery.laneActs.length;
    await menuSelect(page, cardSel(E.tema, "weekend"), "Saved");
    await page.waitForTimeout(800);
    saved = { save: acts(n).slice(0, afterSave - n), unsave: acts(afterSave) };

    // Follow the presenter from a card's menu in a lane, then unfollow.
    n = db.discovery.laneActs.length;
    await menuSelect(page, cardSel(E.stream, "online"), "Follow " + ADAEZE.name);
    await until(n + 1);
    await page.waitForTimeout(300);
    const afterFollow = db.discovery.laneActs.length;
    await menuSelect(page, cardSel(E.stream, "online"), "Following " + ADAEZE.name);
    await page.waitForTimeout(800);
    followed = { follow: acts(n).slice(0, afterFollow - n), unfollow: acts(afterFollow) };

    // The Communities sentence (650) takes its place by lane_order: first when the order leads with
    // Communities, and between Curated and My network in the base order.
    setAnswer(db, belowDensity(E));
    db.discovery.laneActs = [];
    db.discovery.laneOrder = ["follow", ...DISCOVERY_SECTIONS.filter((x) => x !== "follow")];
    await openDiscovery(page);
    const led = await laneIds(page);
    const text = await page
      .locator('[data-lanes] > [data-lane="follow"]')
      .innerText()
      .catch(() => "");
    db.discovery.laneOrder = null;
    await openDiscovery(page);
    sentence = { led, text: text.includes("You follow no host yet."), base: await laneIds(page) };
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  record(
    tag + " order: nothing is written on load (1160)",
    !!onLoad && onLoad.length === 0,
    JSON.stringify(onLoad),
  );
  record(
    tag +
      " order: the lanes render in the answer's order, the member's acts in the week first, with no re-sort (1160)",
    !!rendered && rendered.join(",") === learned.join(","),
    JSON.stringify(rendered),
  );
  record(
    tag +
      (expanded
        ? " acts: a card opened from a lane writes open for that lane once, and the pane's Next writes nothing (1160)"
        : " acts: a card opened from a lane writes open for that lane once (1160)"),
    !!opened && opened.join(",") === "weekend:open" && !!stepped && stepped.length === 0,
    JSON.stringify({ opened, stepped }),
  );
  record(
    tag +
      " acts: Save from a card's menu writes save for its lane, and unsaving writes nothing (1160)",
    !!saved && saved.save.join(",") === "weekend:save" && saved.unsave.length === 0,
    JSON.stringify(saved),
  );
  record(
    tag +
      " acts: Follow from a card's menu writes follow for its lane, and unfollowing writes nothing (1160)",
    !!followed && followed.follow.join(",") === "online:follow" && followed.unfollow.length === 0,
    JSON.stringify(followed),
  );
  record(
    tag + " order: the Communities sentence takes its place by lane_order (650, 1160)",
    !!sentence &&
      sentence.led.join(",") === "follow,online,curated,network" &&
      sentence.text &&
      sentence.base.join(",") === "online,curated,follow,network",
    JSON.stringify(sentence),
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/** Filling up and the going row: compact and expanded. */
const FILLING_VIEWPORTS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];

/**
 * Filling up is an ordinary lane with no See all (1157). The going row (1128, 1138, 1158) reads the
 * three names outside the relationship lanes and keeps the reason in them, from one event_going_names
 * read that names no event only a relationship lane carries; a failed read leaves the rows empty and
 * the lanes up.
 */
async function runDiscoveryFilling(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-filling`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  let filling = null;
  let going = null;
  let failed = null;
  try {
    await signIn(page);
    await openDiscovery(page);
    const firstRead = db.discovery.goingReads[0] || null;
    // Filling up and the going row, on the full answer.
    await lanesUntil(page, (ids) => ids.includes(E.cloth.event_id));
    filling = await page.evaluate(() => {
      const lane = document.querySelector('[data-lanes] > [data-lane="filling"]');
      return lane
        ? {
            head: (lane.querySelector("h2")?.textContent || "").trim(),
            items: Array.from(lane.querySelectorAll("[data-discovery-item]")).map((e) =>
              e.getAttribute("data-discovery-item"),
            ),
            seeAll: !!lane.querySelector("[data-see-all]"),
          }
        : null;
    });
    going = await page.evaluate(
      ({ cloth }) => {
        const row = (sel) => {
          const r = document.querySelector(sel + ' [data-row="reason"]');
          return r
            ? { text: (r.textContent || "").trim(), going: r.hasAttribute("data-going") }
            : null;
        };
        return {
          filling: Array.from(
            document.querySelectorAll('[data-lanes] > [data-lane="filling"] [data-row="reason"]'),
          ).map((r) => ({
            text: (r.textContent || "").trim(),
            going: r.hasAttribute("data-going"),
          })),
          curated: row(`[data-discovery-item="${cloth}"][data-section="curated"]`),
        };
      },
      { cloth: E.cloth.event_id },
    );
    going.read = firstRead;

    // A failed names read: the lanes stay, the rows stay empty.
    db.discovery.goingFail = true;
    await openDiscovery(page);
    await page.waitForTimeout(400);
    failed = await page.evaluate(() => ({
      lanes: document.querySelectorAll("[data-discovery] [data-lanes] > [data-lane]").length,
      going: document.querySelectorAll("[data-discovery] [data-going]").length,
      alert: !!document.querySelector("[data-discovery] [role=alert]"),
    }));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  record(
    tag + " filling: Filling up renders as an ordinary lane with no See all (1124, 1157)",
    !!filling &&
      filling.head === "Filling up" &&
      filling.items.join(",") === [E.cloth.event_id, E.supper.event_id].join(",") &&
      !filling.seeAll,
    JSON.stringify(filling),
  );
  record(
    tag +
      " going: the three names in a non-relationship lane's last row and the reason in a relationship lane's, from one event_going_names read that names no event only a relationship lane carries (1128, 1138, 1158)",
    !!going &&
      going.filling.length === 2 &&
      going.filling.every((r) => r.text === GOING_SENTENCE && r.going) &&
      !!going.curated &&
      going.curated.text === "Curated by Sefa Owusu." &&
      !going.curated.going &&
      !!going.read &&
      !going.read.anon &&
      going.read.ids.includes(E.supper.event_id) &&
      going.read.ids.includes(E.cloth.event_id) &&
      !going.read.ids.includes(E.loaded.event_id),
    JSON.stringify(going),
  );
  record(
    tag + " going: a failed names read leaves the rows empty and the lanes up (item 4)",
    !!failed && failed.lanes > 0 && failed.going === 0 && !failed.alert,
    JSON.stringify(failed),
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/** B9-SPEC's exit check reads a lens grid at 1280 and 1920 (1125); compact lays one track. */
const GRID_VIEWPORTS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
  [[1920, 1080], "light"],
];

/**
 * The lens grid (1125) and More on Convene (1148): a lens is a grid of the same card on auto-fill
 * tracks of --lane-card-width or more, gap 12, filling the column, each card filling its track. A lens
 * short of a row at the column's width is followed by All's lanes under an h2 at 22, less the lens's
 * own events, from a second read under All with the lens's facets; a lens that fills its row reads
 * nothing more; an empty lens keeps its EmptyState and shows no More on Convene.
 */
async function runDiscoveryGrid(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-grid`;
  M.armStart(tag);
  const db = makeMockDb();
  seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  let grid = null;
  let more = null;
  let empty = null;
  try {
    await signIn(page);
    await openDiscovery(page, "/convene/curated?price=free");
    await page.waitForSelector("[data-lens-cards] [data-discovery-item]", { timeout: 20000 });
    await page.waitForTimeout(800);
    grid = await page.evaluate(() => {
      const g = document.querySelector("[data-lens-cards]");
      const cs = getComputedStyle(g);
      const r1 = (v) => Math.round(v * 10) / 10;
      return {
        tracks: cs.gridTemplateColumns.split(" ").map((t) => r1(parseFloat(t))),
        gap: cs.columnGap,
        width: r1(g.getBoundingClientRect().width),
        column: r1(g.parentElement.getBoundingClientRect().width),
        cards: Array.from(g.querySelectorAll("[data-discovery-item]")).map((s) => [
          r1(s.getBoundingClientRect().width),
          r1(s.querySelector("article").getBoundingClientRect().width),
        ]),
      };
    });
    more = await page.evaluate(() => {
      const m = document.querySelector("[data-more-on-convene]");
      if (!m) return null;
      const h2 = m.querySelector("h2#more-on-convene");
      const lensIds = new Set(
        Array.from(document.querySelectorAll("[data-lens-cards] [data-discovery-item]")).map((e) =>
          e.getAttribute("data-discovery-item"),
        ),
      );
      const ids = Array.from(m.querySelectorAll("[data-discovery-item]")).map((e) =>
        e.getAttribute("data-discovery-item"),
      );
      return {
        head: h2 ? (h2.textContent || "").trim() : null,
        size: h2 ? getComputedStyle(h2).fontSize : null,
        lanes: Array.from(m.querySelectorAll("[data-lanes] > [data-lane]")).map((l) =>
          l.getAttribute("data-lane"),
        ),
        overlap: ids.filter((id) => lensIds.has(id)).length,
        cards: ids.length,
      };
    });
    const calls = db.discovery.calls.map((c) => ({
      lens: c.p_lens || "all",
      price: c.p_price || null,
      without: c.p_without || null,
    }));
    more = { view: more, calls };
    // An empty lens.
    db.discovery.sections = { ...db.discovery.sections, curated: [] };
    const before = db.discovery.calls.length;
    await openDiscovery(page, "/convene/curated");
    await page.getByText("Nothing in this lens yet.").waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    empty = {
      more: !!(await page.$("[data-more-on-convene]")),
      lenses: db.discovery.calls.slice(before).map((c) => c.p_lens || "all"),
    };
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  const n = grid ? grid.tracks.length : 0;
  const filled =
    !!grid &&
    n > 0 &&
    grid.tracks.every((t) => t >= 319.5) &&
    Math.abs(grid.tracks.reduce((a, b) => a + b, 0) + 12 * (n - 1) - grid.width) <= 1 &&
    Math.abs(grid.width - grid.column) <= 1 &&
    grid.gap === "12px" &&
    grid.cards.length > 0 &&
    grid.cards.every(
      ([slot, card]) => Math.abs(slot - card) <= 0.6 && Math.abs(slot - grid.tracks[0]) <= 1,
    );
  record(
    tag +
      " grid: a lens is a grid of the same card on auto-fill tracks of 320 or more, gap 12, filling the column, each card filling its track (1125)",
    filled,
    JSON.stringify(grid),
  );
  const short = !!grid && grid.cards.length < n;
  const view = more && more.view;
  const alls = more ? more.calls.filter((c) => c.lens === "all") : [];
  record(
    tag +
      " more: only a lens short of a row is followed by All's lanes under More on Convene at 22, less the lens's events, from a second read under All with its facets and the lens as p_without (1148, 1174)",
    !!more &&
      (short
        ? !!view &&
          view.head === "More on Convene" &&
          view.size === "22px" &&
          view.lanes.length > 0 &&
          !view.lanes.includes("curated") &&
          view.cards > 0 &&
          view.overlap === 0 &&
          alls.length > 0 &&
          alls.every((c) => JSON.stringify(c.price) === JSON.stringify(["free"])) &&
          alls.some((c) => c.without === "curated")
        : !view && alls.length === 0),
    JSON.stringify({ short, tracks: n, more }),
  );
  record(
    tag +
      " more: an empty lens keeps its EmptyState, shows no More on Convene and reads nothing more (724, 1148)",
    !!empty && !empty.more && empty.lenses.length > 0 && empty.lenses.every((l) => l === "curated"),
    JSON.stringify(empty),
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/** The share view is the pane's, which opens at expanded only (1156). */
const SHARE_VIEWPORTS = [
  [[1280, 800], "light"],
  [[1440, 900], "dark"],
];

/**
 * The share view in the pane (1156, G130): the toolbar's Share and the page's own Share open one
 * view in the pane body in place of the page, never a Sheet, carrying the page's share content; the
 * toolbar's Share is pressed while it shows; its close control at top right and Escape inside it
 * return to the page, with focus on the control that opened it; Copy hands over the row's address;
 * Next and closing the pane close it.
 */
async function runDiscoveryShare(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-share`;
  M.armStart(tag);
  const db = makeMockDb();
  const E = seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  await stubHandOver(page);
  const publicPath = "/e/discovery-" + E.supper.event_id;
  const read = () =>
    page.evaluate(() => {
      const v = document.querySelector("[data-pane-share]");
      const tool = document.querySelector('[data-pane-toolbar] [data-tool="share"]');
      const wrap = document.querySelector("[data-pane-page]");
      const a = document.activeElement;
      const close = v && v.querySelector('button[aria-label="Close"]');
      const code = v && v.querySelector('[data-share-code] [role="img"]');
      const vb = v && v.getBoundingClientRect();
      const cb = close && close.getBoundingClientRect();
      return {
        view: !!v,
        heading: v ? (v.querySelector("[data-sheet-heading]")?.textContent || "").trim() : null,
        url: v ? (v.querySelector("[data-share-url] span")?.textContent || "").trim() : null,
        copy: !!v && !!v.querySelector('[data-testid="share-copy"]'),
        code: code
          ? Math.round(code.getBoundingClientRect().width) +
            "x" +
            Math.round(code.getBoundingClientRect().height)
          : null,
        line: !!v && (v.textContent || "").includes("It is not a ticket and admits nobody."),
        via: !!v && !!v.querySelector('[data-testid="share-via"]'),
        corner: vb && cb ? [Math.round(vb.right - cb.right), Math.round(cb.top - vb.top)] : null,
        inBody: !!v && !!v.closest("[data-pane-body]"),
        dialog: !!document.querySelector('[role="dialog"][aria-label="Share this event"]'),
        page: wrap ? getComputedStyle(wrap).display : null,
        pressed: tool ? tool.getAttribute("aria-pressed") : null,
        focus: a
          ? a.getAttribute("data-tool") ||
            a.getAttribute("data-testid") ||
            (a.hasAttribute("data-sheet-heading") ? "heading" : a.tagName.toLowerCase())
          : null,
        pane: !!document.querySelector('[data-discovery][data-pane-open="1"]'),
        event: location.pathname.split("/").pop(),
      };
    });
  const openSupper = async () => {
    await page
      .locator(`${cardSel(E.supper, "soon")} [data-card-open]`)
      .first()
      .click();
    await page.waitForSelector(
      '[data-discovery][data-pane-open="1"] [data-event-page][data-event-state="loaded"]',
      {
        timeout: 20000,
      },
    );
    await page.waitForTimeout(400);
  };
  const toolbarShare = async () => {
    await page.locator('[data-pane-toolbar] [data-tool="share"]').click();
    await page.waitForSelector("[data-pane-share] [data-share-url]", { timeout: 5000 });
    await page.waitForTimeout(200);
  };
  let s0 = null;
  let s1 = null;
  let copied = null;
  let s2 = null;
  let s3 = null;
  let s4 = null;
  let s5 = null;
  let s6 = null;
  try {
    await signIn(page);
    await openDiscovery(page);
    await openSupper();
    s0 = await read();
    await toolbarShare();
    s1 = await read();
    copied = await handedOver(
      page,
      () => page.locator('[data-pane-share] [data-testid="share-copy"]').click(),
      { copied: 1 },
    );
    await page.locator('[data-pane-share] button[aria-label="Close"]').click();
    await page.waitForTimeout(300);
    s2 = await read();
    await page.locator('[data-pane-body] [data-testid="event-share"]').click();
    await page.waitForSelector("[data-pane-share] [data-share-url]", { timeout: 5000 });
    await page.waitForTimeout(200);
    s3 = await read();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    s4 = await read();
    await toolbarShare();
    await page.locator('[data-pane-cluster] button[aria-label="Next event"]').click();
    await page.waitForURL((u) => u.pathname.endsWith("/" + E.madina.event_id), { timeout: 10000 });
    await page.waitForTimeout(500);
    s5 = await read();
    await toolbarShare();
    await page.locator('button[aria-label="Back to Discovery"]').first().click();
    await page.waitForSelector("[data-discovery]:not([data-pane-open]) [data-lanes]", {
      timeout: 20000,
    });
    await openSupper();
    s6 = await read();
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  }
  record(
    tag +
      " share: the toolbar's Share opens the share view in the pane body in place of the page, never a Sheet: the heading, the address with Copy, the 120 page-link code and its line, Share via, and its close at top right (1156)",
    !!s1 &&
      s1.view &&
      s1.inBody &&
      !s1.dialog &&
      s1.page === "none" &&
      s1.heading === "Share this event" &&
      onPath(s1.url, publicPath) &&
      s1.copy &&
      s1.code === "120x120" &&
      s1.line &&
      s1.via &&
      !!s1.corner &&
      s1.corner.every((v) => v >= 0 && v <= 16),
    JSON.stringify(s1),
  );
  record(
    tag + " share: the toolbar's Share is pressed while the view shows and not otherwise (1156)",
    !!s0 &&
      s0.pressed === "false" &&
      !!s1 &&
      s1.pressed === "true" &&
      !!s2 &&
      s2.pressed === "false",
    JSON.stringify([s0 && s0.pressed, s1 && s1.pressed, s2 && s2.pressed]),
  );
  record(
    tag + " share: Copy in the view hands over the address its row carries (1140)",
    !!copied && copied.copied.length === 1 && onPath(copied.copied[0], publicPath),
    JSON.stringify(copied),
  );
  record(
    tag +
      " share: the view's close returns to the page, with focus on the control that opened it (1156)",
    !!s2 && !s2.view && s2.page === "contents" && s2.pane && s2.focus === "share",
    JSON.stringify(s2),
  );
  record(
    tag +
      " share: the page's own Share opens the same view, and Escape inside it returns to the page with the pane open (1156, G130)",
    !!s3 &&
      s3.view &&
      s3.inBody &&
      !s3.dialog &&
      s3.heading === "Share this event" &&
      onPath(s3.url, publicPath) &&
      s3.pressed === "true" &&
      !!s4 &&
      !s4.view &&
      s4.pane &&
      s4.page === "contents" &&
      s4.focus === "event-share",
    JSON.stringify({ s3, s4 }),
  );
  record(
    tag +
      " share: Next closes the view, and closing the pane leaves none when the event opens again (1156)",
    !!s5 &&
      !s5.view &&
      s5.event === E.madina.event_id &&
      s5.pressed === "false" &&
      !!s6 &&
      !s6.view &&
      s6.page === "contents" &&
      s6.pressed === "false",
    JSON.stringify({ s5, s6 }),
  );
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/**
 * The five Cs on the page's axis (1175, 1190): the header's row is three tracks with equal sides at
 * expanded, so the box the five Cs' faces span centres on the viewport's centre within 0.5, the faces
 * keep their 44 hit area and sit inside the row, and the dock is the header's own. At 1024 the tier
 * is medium (`tierFor`: expanded is wider than 1024), so the Cs are in the fixed dock below and are
 * read the same way. Discovery's row is narrowest just above 1024, where G149 names a two-pixel band.
 */
async function runDiscoveryAxis(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-discovery-axis`;
  M.armStart(tag);
  const tier = tierOf(w);
  const db = makeMockDb();
  seedDiscovery(db);
  const { browser, page, errors } = await context(browserType, [w, h], theme, db);
  try {
    await signIn(page);
    await openDiscovery(page);
    const a = await page.evaluate(() => {
      const r = (n) => Math.round(n * 100) / 100;
      const nav = document.querySelector('nav[aria-label="Pulse"]');
      const cs = Array.from(document.querySelectorAll('nav[aria-label="Pulse"] button[data-c]'));
      const boxes = cs.map((c) => c.getBoundingClientRect());
      const left = Math.min(...boxes.map((b) => b.left));
      const right = Math.max(...boxes.map((b) => b.right));
      const hdr = document.querySelector("[data-app-header]");
      const hb = hdr && hdr.getBoundingClientRect();
      return {
        n: cs.length,
        inHeader: !!hdr && !!nav && hdr.contains(nav),
        // The five Cs' centre less the viewport's, in px.
        off: r((left + right) / 2 - document.documentElement.clientWidth / 2),
        min: r(Math.min(...boxes.map((b) => Math.min(b.width, b.height)))),
        inside: !!hb && left >= hb.left && right <= hb.right,
        gap: r(boxes[1].left - boxes[0].right),
      };
    });
    record(
      tag + " the five Cs' centre is the viewport's centre within 0.5 (1175, 1190)",
      a.n === 5 && Math.abs(a.off) <= 0.5,
      JSON.stringify(a),
    );
    record(
      tag +
        (tier === "expanded"
          ? " the Cs are in the header's row, inside it, each face at least 44 (1190)"
          : " the Cs are in the dock below the header, each face at least 44 (99)"),
      a.n === 5 &&
        a.min >= 44 &&
        a.inHeader === (tier === "expanded") &&
        (tier !== "expanded" || a.inside),
      JSON.stringify(a),
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
  }
  record(tag + " no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await browser.close();
}

/** Handoff 33-D's cells: Pane's tools at 1280 and 1440 (G123's widths); the Tooltip on a pointer
 *  cell and a touch cell. */
const PANE_TOOLS_VIEWPORTS = [
  [[1280, 800], "light"],
  [[1440, 900], "dark"],
];
const AXIS_VIEWPORTS = [1024, 1280, 1536, 2560].flatMap((w) =>
  ["light", "dark"].map((theme) => [[w, w === 1024 ? 768 : 800], theme]),
);
const TOOLTIP_VIEWPORTS = [
  [[1280, 800], "light"],
  [[820, 1180], "dark"],
];

/** Addendum 4's and 5's arms and their cells, in item order, then handoff 33-A's link arm (G100),
 *  handoff 33-D's Pane tools and Tooltip arms, and handoff 34-A's five, then handoff 35-B's axis arm. */
const FOLLOWUP_ARMS = [
  [runDiscoveryPresenter, FOLLOWUP_VIEWPORTS],
  [runDiscoveryOnline, FOLLOWUP_VIEWPORTS],
  [runDiscoveryRailPane, PANE_VIEWPORTS],
  [runDiscoveryStep, PANE_VIEWPORTS],
  [runDiscoveryHomes, FOLLOWUP_VIEWPORTS],
  [runDiscoveryWidth, WIDTH_VIEWPORTS],
  [runDiscoveryLink, FOLLOWUP_VIEWPORTS],
  [runDiscoveryPaneTools, PANE_TOOLS_VIEWPORTS],
  [runDiscoveryTooltip, TOOLTIP_VIEWPORTS],
  [runDiscoverySearch, SEARCH_VIEWPORTS],
  [runDiscoveryOrder, ORDER_VIEWPORTS],
  [runDiscoveryFilling, FILLING_VIEWPORTS],
  [runDiscoveryGrid, GRID_VIEWPORTS],
  [runDiscoveryShare, SHARE_VIEWPORTS],
  [runDiscoveryAxis, AXIS_VIEWPORTS],
];

module.exports = {
  runDiscovery,
  runDiscoveryFacets,
  runDiscoveryPlace,
  FOLLOWUP_ARMS,
  FACET_VIEWPORTS,
  PLACE_VIEWPORTS,
  DISCOVERY_VIEWPORTS,
  DISCOVERY_LENSES,
  __seedDiscovery: seedDiscovery,
  __seedCorpus: seedCorpus,
  __full: fullDensity,
};
