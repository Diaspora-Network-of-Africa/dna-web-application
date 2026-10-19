// Responsive test matrix (ruling 61) for the shell, Feed, notifications and composer (B2.1: one-row
// header, three scroll containers, in-place expansion, the ten targeted checks). Points at
// BASE (a deployed Pages URL or a local server) with every Supabase endpoint mocked at the network
// layer, so the real client code paths run against a deterministic backend. Backend behaviour
// (RLS, the feed view) is verified separately in SQL against the live project.
// Usage: BASE=https://b2-shell-feed.dna-web-application.pages.dev WEBKIT=1 node tests/matrix.cjs
// Env: ONLY='[390,844]' runs one viewport; SPECIAL=publish,guards,keyboard,fields,silence,shell,width,targeted,profile,connect,event,discovery,vocab,block,auth,onboarding,mount,sheet,gate,admin,media,messenger,theme,account,comments runs flows only.
// Ruling 1237: an arm that loses its web process is run again once, alone, in a fresh browser, by
// `drive()` below; CRASH_PROBE=<arm tag> is the harness probe that proves it (off by default).
// Brief 3 profile flows live in tests/profile.cjs and Brief 4 Connect flows in tests/connect.cjs; both share this mock.
const { chromium, webkit } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://127.0.0.1:4173";
const OUT = process.env.OUT || path.join(__dirname, "matrix-out");
fs.mkdirSync(OUT, { recursive: true });
const SB = "dgspjevjoblujcoljvkn.supabase.co";
const VIEWPORTS = [
  [360, 800],
  [390, 844],
  [430, 932],
  [744, 1133],
  [820, 1180],
  [1024, 1366],
  [1366, 1024],
  [1280, 800],
  [1536, 960],
];
const FULL_PREVIEW_AT = new Set([390, 820, 1280]);
const COMPOSE_SEL = 'section[role="dialog"][aria-label="Compose"]';
// Mirrors DRAFT_DEBOUNCE in src/components/strand/Composer.tsx.
const DRAFT_DEBOUNCE_MS = 800;
const THEMES = ["light", "dark"];
const UID = "00000000-0000-4000-8000-0000000000e1";
const KENTE = fs.readFileSync(path.join(__dirname, "../public/strand/patterns/kente-pattern.svg"));

function b64url(o) {
  return Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
const JWT =
  b64url({ alg: "HS256", typ: "JWT" }) +
  "." +
  b64url({
    sub: UID,
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600 * 24,
    email: "member@test.invalid",
  }) +
  ".sig";
const USER = {
  id: UID,
  aud: "authenticated",
  role: "authenticated",
  email: "member@test.invalid",
  user_metadata: { full_name: "Amara Osei" },
  app_metadata: { provider: "email" },
  created_at: new Date().toISOString(),
};
const SESSION = {
  access_token: JWT,
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: "r",
  user: USER,
};

const SAMPLES = {
  convene:
    "We are hosting a Diaspora Builders Dinner in Nairobi on Thu 16 Oct at 19:00. Doors at 18:30. Free for members, bring one person who should be in the room.",
  connect:
    "Can someone introduce me to Kwame Mensah at the Accra fintech hub? I am building a savings product for market traders and he has done this before.",
  collaborate:
    "Starting a Space for diaspora health workers who want to run short clinics back home. Looking for two coordinators and one person who knows Kenyan licensing.",
  contribute:
    "We need a volunteer accountant to review the cooperative books before the audit by 30 Nov. Two evenings, remote is fine.",
  convey:
    "Three intros that changed a harvest. I wrote down how a cassava cooperative in Oyo found its first buyer through two members in Houston.",
  untyped:
    "Back in Nairobi after three weeks in Houston. The jet lag is winning and the mangoes are not.",
};
const INFER = {
  // Convene Pass 1 (SPEC 1): DIA may fill the title, when as words, the venue name and doors;
  // never the city, never the format. src/lib/dia.ts namespaces these as convene.* (664).
  convene: {
    verb: "convene",
    confidence: 0.95,
    fields: {
      title: "Diaspora Builders Dinner",
      when: "Thu 16 Oct at 19:00",
      place_name: "Front Room",
      doors: "18:30",
    },
    latency_ms: 900,
  },
  connect: {
    verb: "connect",
    confidence: 0.94,
    fields: {
      who: "Kwame Mensah at the Accra fintech hub",
      why: "I am building a savings product for market traders and he has done this before",
    },
    latency_ms: 900,
  },
  collaborate: {
    verb: "collaborate",
    confidence: 0.92,
    fields: {
      title: "Space for diaspora health workers",
      category: "Health",
      roles: "two coordinators and one person who knows Kenyan licensing",
    },
    latency_ms: 900,
  },
  contribute: {
    verb: "contribute",
    confidence: 0.93,
    fields: {
      title: "Volunteer accountant",
      instrument: "Skills",
      need: "review the cooperative books before the audit",
      by: "30 Nov",
    },
    latency_ms: 900,
  },
  convey: {
    verb: "convey",
    confidence: 0.78,
    fields: { title: "Three intros that changed a harvest" },
    latency_ms: 900,
  },
};

// Brief 3 profile fixtures: the shape profile_view returns for the seeded persona thandiwe-dube,
// captured from the live projection so the mock answers the way the database does.
const OWNER_ID = "b3000000-0000-4000-8000-000000000001";
const PROFILE_MEMBER = {
  id: OWNER_ID,
  name: "Thandiwe Dube",
  tier: "attested",
  handle: "thandiwe-dube",
  pattern: "kente",
  stance: "returnee",
  // Ruling 187: profile_view resolves the label from public.member_stances.
  stance_label: "Returnee",
  headline: "Solar engineer, mini-grids for rural clinics",
  local_tz: "Africa/Johannesburg",
  cover_focus: "center 35%",
  current_place: "Johannesburg, SAST",
  current_country: "South Africa",
  origin_country: "South Africa",
  avatar_path: OWNER_ID + "/avatar/a.png",
  cover_path: OWNER_ID + "/cover/c.png",
};
const PROFILE_BADGES = [
  {
    c: "convene",
    items: [
      {
        role: "host",
        when: "2026-08-23T10:00:00+00:00",
        object: "Solar for Clinics, working session",
        attester: "Kwame Mensah",
      },
    ],
  },
  {
    c: "contribute",
    items: [
      {
        role: "Space lead",
        when: "2026-07-10T10:00:00+00:00",
        object: "Site survey, Thohoyandou clinic",
        attester: "Adaeze Nwosu",
      },
    ],
  },
];
const ABOUT_TEXT =
  "Engineer by training, electrician by temperament. I left Cape Town for Berlin in 2014 and came back in 2023 to put power where it changes outcomes: rural clinics. Most weeks I am on a site somewhere in Limpopo, arguing with a battery cabinet or a provincial procurement officer.";
const INTENT_NOTE = "Clinics that need a site survey, and members with battery storage experience.";
const LINKS = { website: "dubepower.co.za", linkedin: "thandiwedube", instagram: "dube.power" };
const SEGMENT_FIELDS = {
  needs:
    "A reliable transport partner for panels into Limpopo, and an accountant who knows SARS filings for a small engineering practice.",
  timeline: "Already back",
};
const EVERYONE_SECTIONS = {
  work: {
    focus: ["Healthcare & Wellness", "Infrastructure & Energy", "Environment & Climate"],
    regions: ["East Africa", "Southern Africa"],
    industries: ["Healthcare", "Energy"],
  },
  about: { about: ABOUT_TEXT },
  where: {
    local_tz: "Africa/Johannesburg",
    current_place: "Johannesburg, SAST",
    current_country: "South Africa",
  },
  origin: { pathway: "Already returned", heritage: "Continental", origin_country: "South Africa" },
  skills: { skills: ["Leadership", "Project Management", "Operations"] },
  convene: [
    {
      sub: "Attested by Kwame Mensah, host",
      when: "2026-08-23T10:00:00+00:00",
      title: "Solar for Clinics, working session",
    },
  ],
  stance: { fields: SEGMENT_FIELDS, stance: "returnee" },
  languages: { languages: ["English", "isiZulu", "Sesotho"] },
  contribute: [
    {
      sub: "Fulfilled a Need from Adaeze Nwosu",
      when: "2026-07-10T10:00:00+00:00",
      title: "Site survey, Thohoyandou clinic",
    },
  ],
  collaborate: [
    {
      sub: "Member since Sep 2026",
      when: "2026-09-08T07:22:24+00:00",
      title: "Diaspora health workers",
      completed: false,
    },
  ],
};
const VISIBILITY = {
  work: "everyone",
  about: "everyone",
  links: "connections",
  where: "everyone",
  badges: "everyone",
  convey: "everyone",
  intent: "anchored",
  origin: "everyone",
  skills: "everyone",
  convene: "everyone",
  stance: "everyone",
  languages: "everyone",
  contribute: "everyone",
  collaborate: "everyone",
};
const VOCAB = {
  focus: ["Healthcare & Wellness", "Infrastructure & Energy", "Environment & Climate", "Education"],
  industries: ["Healthcare", "Energy", "Agriculture", "Finance"],
  regions: ["East Africa", "Southern Africa", "West Africa", "North Africa"],
  skills: ["Leadership", "Project Management", "Operations", "Engineering", "Fundraising"],
  languages: ["English", "isiZulu", "Sesotho", "Swahili", "Twi"],
  intent: ["Find collaborators", "Host and convene", "Contribute skills", "Learn"],
  interests: ["Energy", "Health", "Farming"],
  countries: ["South Africa", "Ghana", "Nigeria", "Kenya"],
  world: ["Germany", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States"],
  // Ruling 187: the stance chooser reads the vocabulary, not a map in the component.
  stances: [
    { value: "returnee", label: "Returnee" },
    { value: "kin", label: "Kin" },
    { value: "anchor", label: "Anchor" },
    { value: "ally", label: "Ally" },
    { value: "exploring", label: "Still exploring" },
  ],
  heritage: ["Continental", "First generation", "Second generation"],
  pathway: ["Already returned", "Planning to return", "Not returning"],
  timeline: ["Already back", "Within a year", "One to three years", "Someday"],
  // Rulings 1018 and 678: the roles a host can name on an event, and the verb its invitation reads.
  event_roles: [
    { value: "speaker", label: "Speaker", verb: "speak at" },
    { value: "moderator", label: "Moderator", verb: "moderate" },
    { value: "host", label: "Co-host", verb: "co-host" },
  ],
  // Ruling 193: contribute_instrument, value and derived label, as public.vocabularies() serves it.
  instrument: [
    { value: "time", label: "Time" },
    { value: "skills", label: "Skills" },
    { value: "in_kind", label: "In-kind" },
  ],
  // Brief 9 (1037, 1041): Convene's families and lenses, the rows 20260922150000 inserts, in order.
  convene_families: [
    { value: "small_social", label: "Small social gatherings", schema_org: ["SocialEvent"] },
    { value: "learning_dialogue", label: "Learning and dialogue", schema_org: ["EducationEvent"] },
    { value: "professional_economic", label: "Professional and economic", schema_org: [] },
    { value: "culture_arts", label: "Culture and arts", schema_org: ["MusicEvent"] },
    { value: "heritage_religious", label: "Cultural, heritage and religious", schema_org: [] },
    { value: "civic_community", label: "Civic and community", schema_org: [] },
    { value: "giving_cause", label: "Giving and cause", schema_org: [] },
    { value: "sport_wellness", label: "Sport and wellness", schema_org: ["SportsEvent"] },
    { value: "family_kids", label: "Family and kids", schema_org: ["ChildrensEvent"] },
  ],
  // Handoff 32-B (1093, 1105): the five lenses and the lanes as 20260924100000 leaves them, with
  // handoff 34-A's Filling up (20260926170000) and its Browse withdrawn again (20260926170400, 1172),
  // and All's scope line as 20261003140000 sets it (1451).
  convene_lenses: [
    {
      value: "all",
      name: "All",
      short: "All",
      icon: "circle-dot",
      scope: "Every event open to you.",
    },
    {
      value: "follow",
      name: "Communities",
      short: "Communities",
      icon: "users",
      scope: "Events whose host you follow.",
    },
    {
      value: "taste",
      name: "For you",
      short: "For you",
      icon: "heart",
      scope: "Events in the category families you subscribe to.",
    },
    {
      value: "curated",
      name: "Curated",
      short: "Curated",
      icon: "bookmark",
      scope: "Picks chosen by an editor and named as theirs.",
    },
    {
      value: "network",
      name: "My network",
      short: "My network",
      icon: "user-plus",
      scope: "A connection hosting, or connections going.",
    },
  ],
  // Handoff 34-A (1124, 1172): Filling up at 3, as 20260926170400 leaves the table.
  convene_lanes: [
    { value: "soon", name: "Happening soon" },
    { value: "weekend", name: "This weekend" },
    { value: "online", name: "Join from anywhere" },
    { value: "filling", name: "Filling up" },
    { value: "fresh", name: "New this week" },
    { value: "curated", name: "Curated by Convene" },
    { value: "follow", name: "From communities you follow" },
    { value: "taste", name: "Because of what you follow" },
    { value: "near", name: "Near your homes" },
    { value: "network", name: "Connected to your network" },
  ],
  // Handoff 37-A (1186): the kinds of host-written block, as 20260928120000 seeds them.
  // Brief 14 (41-A, 1331, 1348, 1349; 41-E, 1403): the four Messenger vocabularies (tests/messenger-mock.cjs).
  ...require("./messenger-mock.cjs").VOCAB_KEYS,
  event_block_kinds: [
    { value: "link", label: "Links" },
    { value: "programme", label: "Programme" },
    { value: "note", label: "Good to know" },
  ],
  // Handoff 55-A (1318): the notification kinds as 20261008120100 seeds them, in position order.
  notification_kinds: [
    {
      value: "connection_request",
      c: "connect",
      c_from_object: false,
      destination: "Opens My Network, Requests",
      renders: true,
    },
    {
      value: "connection_accepted",
      c: "connect",
      c_from_object: false,
      destination: "Opens their profile",
      renders: true,
    },
    {
      value: "role_invitation",
      c: "convene",
      c_from_object: false,
      destination: "Opens the event",
      renders: true,
    },
    {
      value: "role_accepted",
      c: "convene",
      c_from_object: false,
      destination: "Opens the event",
      renders: false,
    },
    {
      value: "event_reminder",
      c: "convene",
      c_from_object: false,
      destination: "Opens the event",
      renders: false,
    },
    {
      value: "attestation_received",
      c: null,
      c_from_object: true,
      destination: "Opens the contribution",
      renders: false,
    },
    // Fix PR 10 item 8 (1623, 20261009120100): the row renders, its C from its object.
    {
      value: "thread_invitation",
      c: null,
      c_from_object: true,
      destination: "Opens the group",
      renders: true,
    },
    {
      value: "space_role_approved",
      c: "collaborate",
      c_from_object: false,
      destination: "Opens the Space",
      renders: false,
    },
    {
      value: "message_request",
      c: "connect",
      c_from_object: false,
      destination: null,
      renders: false,
    },
    // Handoff 62-G (1849): the two comment kinds as 20261016120100 seeds them, C from the object.
    {
      value: "comment_on_post",
      c: null,
      c_from_object: true,
      destination: "Opens the post",
      renders: true,
    },
    {
      value: "reply_to_comment",
      c: null,
      c_from_object: true,
      destination: "Opens the comment",
      renders: true,
    },
  ],
  // Handoff 60-NC (1554, 1555): the two email vocabularies as 20261012120000 seeds them.
  notification_email_modes: [
    { value: "off", label: "Off" },
    { value: "immediate", label: "Right away" },
    { value: "digest", label: "Daily digest" },
  ],
  notification_categories: [
    { value: "connect", label: "Connect" },
    { value: "convene", label: "Convene" },
    { value: "collaborate", label: "Collaborate" },
    { value: "contribute", label: "Contribute" },
    { value: "convey", label: "Convey" },
    { value: "system", label: "Account" },
  ],
  // Handoff 62-A (1798, 1818, 1819): the six as 20261015120100 seeds them, with Asante's glosses.
  post_reaction_kinds: [
    {
      value: "asante",
      class: "public",
      emoji: "🫶",
      label: "Asante",
      glosses: { en: "Thank you", fr: "Merci", pt: "Obrigado" },
    },
    { value: "celebrate", class: "public", emoji: "🎉", label: "Celebrate", glosses: {} },
    { value: "learned", class: "public", emoji: "💡", label: "Learned from this", glosses: {} },
    { value: "standing", class: "public", emoji: "🤝", label: "Standing with you", glosses: {} },
    { value: "help", class: "intent", emoji: "🙋", label: "I can help", glosses: {} },
    { value: "build", class: "intent", emoji: "🛠️", label: "Let’s build", glosses: {} },
  ],
};

/** 62-A: the mock's names for a few picker characters (message_reaction_emoji's labels). */
const EMOJI_LABELS = {
  "🔥": "Fire",
  "🚀": "Rocket",
  "👍️": "Thumbs up",
  "🌍️": "Globe showing Europe-Africa",
  "✨": "Sparkles",
};

/** The projection's ten lanes, in convene_lanes order (1092, 1105; 1124 adds Filling up, 1172 withdraws Browse). */
const DISCOVERY_SECTIONS = VOCAB.convene_lanes.map((l) => l.value);
/** The four lenses under /convene/{lens}, each the one lane of the same id (1093, 1105). */
const DISCOVERY_LENSES = VOCAB.convene_lenses.map((l) => l.value).filter((v) => v !== "all");
const ATTESTATIONS = {
  convene: [
    {
      c: "convene",
      role: null,
      when: "2026-08-23T10:00:00+00:00",
      handle: "thandiwe-dube",
      member: "Thandiwe Dube",
      object: "Solar for Clinics, working session",
      attester: "the host",
      object_id: "b3e00000-0000-4000-8000-000000000001",
      avatar_path: null,
      object_kind: "event",
    },
  ],
  contribute: [
    {
      c: "contribute",
      role: null,
      when: "2026-07-10T10:00:00+00:00",
      handle: "thandiwe-dube",
      member: "Thandiwe Dube",
      object: "Site survey, Thohoyandou clinic",
      attester: "a Space lead",
      object_id: "b3700000-0000-4000-8000-000000000001",
      avatar_path: null,
      object_kind: "opportunity",
    },
  ],
};

/**
 * What profile_view returns for the mock's persona. mode: owner | connected | anchor | stranger |
 * blocked (the viewer is blocked by this member, ruling 198) | blocker (the viewer blocked this
 * member, B4A section 7's Done Means 5).
 * A signed-out request (or p_as_public) gets the anonymous projection: null when Share is off,
 * otherwise core plus Everyone sections only. Section writes made through save_profile_section
 * are folded in so a refetch reflects them.
 */
function profileProjection(db, anon) {
  const pr = db.profile;
  const sw = pr.switches;
  const over = pr.overrides;
  const member = { ...PROFILE_MEMBER, ...(over.core || {}), ...(over.media || {}) };
  if (over.pattern) member.pattern = over.pattern.pattern;
  const sections = JSON.parse(JSON.stringify(EVERYONE_SECTIONS));
  if (over.about) sections.about = { about: over.about.about };
  if (over.where) sections.where = { ...sections.where, current_place: over.where.current_place };
  const vis = { ...VISIBILITY, ...pr.visibility };
  const base = {
    member,
    badges: PROFILE_BADGES,
    mutuals: [],
    shared_spaces: [],
    private: sw.private,
    // B4A section 4: the viewer's own block, and never the converse. False for a blocked viewer
    // exactly as it is for a stranger, which is what keeps the two indistinguishable (section 7).
    viewer_blocked: pr.mode === "blocker",
  };
  // Ruling 141: attesters who do not share publicly render as a role on a public projection.
  const publicBadges = () => {
    const ROLE = { host: "the host", "Space lead": "a Space lead" };
    sections.convene = sections.convene.map((r) => ({ ...r, sub: "Attested by " + ROLE.host }));
    sections.contribute = sections.contribute.map((r) => ({
      ...r,
      sub: "Fulfilled a Need from " + ROLE["Space lead"],
    }));
    return PROFILE_BADGES.map((b) => ({
      c: b.c,
      items: b.items.map((it) => ({ object: it.object, when: it.when, attester: ROLE[it.role] })),
    }));
  };
  if (anon) {
    if (!sw.shared) return null;
    return {
      ...base,
      viewer_blocked: false,
      badges: publicBadges(),
      viewer: "anon",
      anchored: false,
      sections,
    };
  }
  // Ruling 198: a blocked viewer is signed in and gets the public projection, whatever the prior
  // relationship and whether or not the profile is shared. No relationship object at all, so the
  // surface renders no Connect action and no Follow, and no mutual name or DIA line reaches them.
  if (pr.mode === "blocked")
    return { ...base, badges: publicBadges(), viewer: "member", anchored: false, sections };
  // B4A sections 6 and 7 (Done Means 5): the blocker's own view of the member they blocked. Their
  // scope is not dropped, so Anchored sections stay (ruling 220) and the mutuals, shared Spaces and
  // DIA line stay with them; the connection edge is revoked, so Connections sections are gone; and
  // the relationship object is absent, so the row holds the overflow and nothing else.
  if (pr.mode === "blocker") {
    sections.intent = { note: INTENT_NOTE, intent: ["Find collaborators", "Host and convene"] };
    return {
      ...base,
      viewer: "member",
      anchored: true,
      sections,
      mutuals: [{ name: "Lerato Khumalo", handle: "lerato-khumalo" }],
      shared_spaces: ["Diaspora health workers"],
      dia_line: "Thandiwe fulfilled a Need in the Space you lead.",
    };
  }
  if (pr.mode === "owner") {
    sections.links = LINKS;
    sections.intent = { note: INTENT_NOTE, intent: ["Find collaborators", "Host and convene"] };
    sections.convey = [];
    sections.stance.variants = { returnee: SEGMENT_FIELDS, exploring: { interests: [] } };
    return { ...base, viewer: "owner", anchored: false, sections, switches: sw, visibility: vis };
  }
  const anchored = pr.mode === "connected" || pr.mode === "anchor";
  const connected = pr.rel === "connected";
  if (vis.links === "everyone" || (vis.links === "connections" && connected))
    sections.links = LINKS;
  if (
    vis.intent === "everyone" ||
    (vis.intent === "connections" && connected) ||
    (vis.intent === "anchored" && (anchored || connected))
  )
    sections.intent = { note: INTENT_NOTE, intent: ["Find collaborators", "Host and convene"] };
  const out = {
    ...base,
    viewer: "member",
    anchored,
    sections,
    relationship: { state: pr.rel, following: pr.following },
  };
  if (pr.mode === "connected") {
    out.mutuals = [{ name: "Lerato Khumalo", handle: "lerato-khumalo" }];
    out.dia_line = "Thandiwe was at Solar for Clinics, working session, which you hosted.";
  }
  if (pr.mode === "anchor") {
    out.shared_spaces = ["Diaspora health workers"];
    out.dia_line = "Thandiwe fulfilled a Need in the Space you lead.";
  }
  return out;
}

// Brief 4 Connect fixtures: the card shape connect_cards returns, one member per relationship state
// (including the sender-side window, ruling 168), a Suggested set with DIA's reason already written
// (connect-suggest), eight demo countries above the floor, and the ten filter option lists.
const CONNECT_MEMBERS = [
  {
    id: "c4000000-0000-4000-8000-000000000001",
    handle: "adaeze-nwosu",
    name: "Adaeze Nwosu",
    identified: true,
    headline: "Clinic coordinator, Enugu and Manchester",
    stance_label: "Returnee",
    place: "Manchester, United Kingdom",
    origin: "Nigeria",
    heritage: "Second generation",
    chips: ["Healthcare & Wellness", "Project Management", "West Africa"],
    badges: [],
    mutuals: [
      { name: "Lerato Khumalo", avatar_path: null },
      { name: "Kwame Mensah", avatar_path: null },
    ],
    rel: "none",
    following: false,
    _stance: "returnee",
    _location: "United Kingdom",
    _focus: "Healthcare & Wellness",
  },
  {
    id: "c4000000-0000-4000-8000-000000000002",
    handle: "yusuf-diallo",
    name: "Yusuf Diallo",
    identified: false,
    headline: "Solar engineer between Dakar and Lyon",
    stance_label: "Anchor",
    place: "Dakar, Senegal",
    origin: "Senegal",
    heritage: "Continental",
    chips: ["Infrastructure & Energy", "Operations"],
    badges: [],
    mutuals: [{ name: "Lerato Khumalo", avatar_path: null }],
    rel: "sent",
    following: true,
    _stance: "anchor",
    _location: "Senegal",
    _focus: "Infrastructure & Energy",
  },
  {
    id: "c4000000-0000-4000-8000-000000000003",
    handle: "kwame-mensah",
    name: "Kwame Mensah",
    identified: true,
    headline: "Fintech founder, Accra",
    stance_label: "Anchor",
    place: "Accra, Ghana",
    origin: "Ghana",
    heritage: "Continental",
    chips: ["Finance & Investment", "Strategy"],
    badges: [],
    mutuals: [],
    rel: "received",
    following: false,
    message:
      "Hello Amara. I saw your note on savings products for market traders. I have done two of these in Accra and would like to compare notes.",
    _stance: "anchor",
    _location: "Ghana",
    _focus: "Finance & Investment",
  },
  {
    id: "c4000000-0000-4000-8000-000000000004",
    handle: "lerato-khumalo",
    name: "Lerato Khumalo",
    identified: false,
    headline: "Community organiser, Soweto",
    stance_label: "Ally",
    place: "Johannesburg, South Africa",
    origin: "South Africa",
    heritage: "Continental",
    chips: ["Education & Training"],
    // Handoff 44-MC-R3: two attestations in one C (two lines, never "2"), a second C (one pill open at
    // a time, 1500), and a mutual on a connected member (1531), so the card and the arm read them.
    badges: [
      {
        c: "contribute",
        items: [
          {
            object: "Site survey, Thohoyandou clinic",
            attester: "Adaeze Nwosu",
            role: "Space lead",
            when: "2026-07-10T10:00:00Z",
          },
        ],
      },
      {
        c: "convene",
        items: [
          {
            object: "Solar for Clinics, working session",
            attester: "Thandiwe Dube",
            role: "host",
            when: "2026-08-22T18:00:00Z",
          },
          {
            object: "Mini-grid procurement clinic",
            attester: "Kwame Mensah",
            role: "host",
            when: "2026-09-14T17:00:00Z",
          },
        ],
      },
    ],
    mutuals: [{ name: "Kwame Mensah", avatar_path: null }],
    rel: "connected",
    following: true,
    _stance: "ally",
    _location: "South Africa",
    _focus: "Education & Training",
  },
  {
    id: "c4000000-0000-4000-8000-000000000005",
    handle: "thandiwe-dube",
    name: "Thandiwe Dube",
    identified: true,
    headline: "Building clinics between Johannesburg and Houston",
    stance_label: "Returnee",
    place: "Houston, United States",
    origin: "South Africa",
    heritage: "First generation",
    chips: ["Healthcare & Wellness", "Leadership"],
    badges: [],
    mutuals: [{ name: "Lerato Khumalo", avatar_path: null }],
    // Ruling 214: this member declined inside the window. private.relationship_display maps that
    // to sent before the projection returns, so the fixture carries what the wire carries and the
    // card is compared against a genuinely pending one below.
    rel: "sent",
    following: false,
    _stance: "returnee",
    _location: "United States",
    _focus: "Healthcare & Wellness",
  },
  {
    id: "c4000000-0000-4000-8000-000000000006",
    handle: "ngozi-okafor",
    name: "Ngozi Okafor",
    identified: false,
    headline: "Agritech, Lagos",
    stance_label: "Still exploring",
    place: "Lagos, Nigeria",
    origin: "Nigeria",
    heritage: "Continental",
    chips: ["Agriculture & Food Systems", "Data Analysis"],
    badges: [],
    mutuals: [],
    rel: "none",
    following: false,
    _stance: "exploring",
    _location: "Nigeria",
    _focus: "Agriculture & Food Systems",
  },
  // Handoff 44-MC-R3 (1491): a name the compact lane cannot hold at the 15px floor, so the arm reads
  // the fit stopping at the floor and the name wrapping rather than shrinking. Matches no filter the
  // arm applies and sits in no network section.
  {
    id: "c4000000-0000-4000-8000-000000000007",
    handle: "oluwadamilare-adebayo-ogunbanjo",
    name: "Oluwadamilare Adebayo-Ogunbanjo Olufunmilayo Akinwande-Balogun",
    identified: false,
    headline: "Logistics, Lagos and Rotterdam",
    stance_label: "Kin",
    place: "Rotterdam, Netherlands",
    origin: "Nigeria",
    heritage: "First generation",
    chips: ["Operations"],
    badges: [],
    mutuals: [],
    rel: "none",
    following: false,
    _stance: "kin",
    _location: "Netherlands",
    _focus: "Infrastructure & Energy",
  },
];
const CONNECT_SUGGESTED = [
  {
    ...CONNECT_MEMBERS[0],
    reason:
      "You were both at Solar for Clinics, working session, and Lerato and Kwame are connections you share.",
  },
  {
    ...CONNECT_MEMBERS[5],
    reason: "You share Agriculture & Food Systems as a focus area.",
  },
];
const CONNECT_WHERE = {
  continent: ["Ghana", "Kenya", "Nigeria", "South Africa"],
  diaspora: ["Canada", "France", "United Kingdom", "United States"],
};
const CONNECT_OPTIONS = {
  stances: [
    { value: "returnee", label: "Returnee" },
    { value: "kin", label: "Kin" },
    { value: "anchor", label: "Anchor" },
    { value: "ally", label: "Ally" },
    { value: "exploring", label: "Still exploring" },
  ],
  locations: [
    "Canada",
    "France",
    "Ghana",
    "Kenya",
    "Nigeria",
    "Senegal",
    "South Africa",
    "United Kingdom",
    "United States",
  ],
  origins: ["Ghana", "Nigeria", "Senegal", "South Africa"],
  heritage: ["First generation", "Second generation", "Third generation or later", "Continental"],
  pathway: [
    "Already returned",
    "Planning a return",
    "Circular, both places",
    "Not planning a return",
  ],
  // Ruling 436: the corridor row of ruling 243 exists on the live project, so the mock carries it
  // and the Corridor axis renders (ruling 154). The label is as connect_filter_options builds it.
  corridors: [{ id: "los-angeles-accra-agriculture", label: "Los Angeles to Accra" }],
  focus: [
    "Agriculture & Food Systems",
    "Technology & Innovation",
    "Healthcare & Wellness",
    "Education & Training",
    "Finance & Investment",
    "Arts & Culture",
    "Policy & Governance",
    "Infrastructure & Energy",
    "Trade & Commerce",
    "Environment & Climate",
  ],
  industries: ["Agriculture", "Technology", "Healthcare", "Education", "Finance"],
  skills: ["Leadership", "Project Management", "Software Development", "Marketing", "Sales"],
  regions: [
    "West Africa",
    "East Africa",
    "Southern Africa",
    "Central Africa",
    "North Africa",
    "African Diaspora",
  ],
};

/** A card as connect_cards emits it: the private fixture keys (_stance, _location, _focus) never leave the mock. */
function connectCard(m, overrides) {
  const out = {};
  for (const k of Object.keys(m)) if (!k.startsWith("_")) out[k] = m[k];
  const st = overrides[m.id] || {};
  if (st.rel) out.rel = st.rel;
  if (typeof st.following === "boolean") out.following = st.following;
  return out;
}

function makeMockDb() {
  const db = {
    // Brief 14 (handoff 41-C): the Messenger fixture, EXTRACTION-41-14 section 6 as the projections
    // answer it (tests/messenger-mock.cjs).
    messenger: require("./messenger-mock.cjs").messengerFixture(),
    posts: [],
    events: [],
    // Convene Pass 1: one row per delivery endpoint (521), the member's homes (633) and the
    // place-resolve calls the form made, with their proximity.
    event_delivery: [],
    homes: [
      {
        id: "h1",
        position: 0,
        place_id: "dXJuOm1ieHBsYzpBY2NyYQ",
        place_name: "Accra",
        city: "Accra",
        country: "Ghana",
        lng: -0.187,
        lat: 5.6037,
        timezone: "Africa/Accra",
      },
      {
        id: "h2",
        position: 1,
        place_id: "dXJuOm1ieHBsYzpOYWlyb2Jp",
        place_name: "Nairobi",
        city: "Nairobi",
        country: "Kenya",
        lng: 36.8219,
        lat: -1.2921,
        timezone: "Africa/Nairobi",
      },
    ],
    placeCalls: [],
    // Set to make publish_post refuse with this message (ruling 665's failed state).
    publishFail: null,
    spaces: [
      {
        id: "s1",
        title: "Nairobi chapter",
        owner_member_id: UID,
        category: null,
        description: null,
        roles_sought: [],
        status: "active",
        created_at: new Date().toISOString(),
      },
    ],
    opportunities: [],
    connection_requests: [],
    stories: [],
    post_media: [],
    post_links: [],
    notifications: [],
    // Handoff 60-NC: the email view's answer as notification_email_view() gives it (no category
    // carries copy, as today), the member's modes, and the forced failures the arms set.
    notify: {
      view: ["connect", "convene", "collaborate", "contribute", "convey", "system"].map((c) => ({
        c,
        has_copy: false,
        mode: null,
        email_default: null,
      })),
      saves: [],
      markAll: 0,
      failMarkAll: false,
      failSave: false,
      emptyEmailVocab: false,
    },
    // Handoff 55-A: members a read by id answers, keyed by id (see the members table below).
    membersById: {},
    // Handoff 61-S1: what the Account drawer reads and writes (tests/account.cjs). Supabase Auth's
    // user (its identities and a pending new_email), the password and email writes, the devices
    // sessions_list() answers and session_revoke() removes, and the member's blocked rows.
    account: {
      identities: [
        {
          identity_id: "i-email",
          id: UID,
          user_id: UID,
          provider: "email",
          identity_data: { email: "member@test.invalid", sub: UID },
          created_at: "2026-09-01T00:00:00Z",
          last_sign_in_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ],
      newEmail: null,
      // Ruling 1746: /auth/v1/user answers 403 session_not_found, or fails at the network.
      sessionGone: false,
      userFail: null,
      updateCalls: [],
      updateFail: null,
      weakPassword: false,
      wrongCurrent: null,
      tokenCalls: [],
      logoutScopes: [],
      resendCalls: 0,
      unlinkCalls: [],
      unlinkFail: false,
      sessions: [
        {
          id: "s-current",
          user_agent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          last_active_at: new Date().toISOString(),
          is_current: true,
        },
        {
          id: "s-phone",
          user_agent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          last_active_at: "2026-10-09T18:12:00Z",
          is_current: false,
        },
        {
          id: "s-windows",
          user_agent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
          last_active_at: "2026-10-04T09:05:00Z",
          is_current: false,
        },
      ],
      sessionsFail: false,
      revokeCalls: [],
      revokeFail: false,
      blocked: [
        {
          blocked_id: "c4000000-0000-4000-8000-0000000000b1",
          created_at: "2026-10-07T12:00:00Z",
          member: { name: "Yaa Mensah", handle: "yaa-mensah", avatar_path: null },
        },
        {
          blocked_id: "c4000000-0000-4000-8000-0000000000b2",
          created_at: "2026-09-20T12:00:00Z",
          member: { name: "Kojo Asante", handle: "kojo-asante", avatar_path: null },
        },
      ],
      blockedFail: false,
      unblockFail: false,
      unblockCalls: [],
    },
    saves: [],
    // 62-A: a reaction row is { member_id, post_id, kind, emoji, created_at } and, for a seeded
    // reactor other than the member, `person` (id, name, handle, avatar_path) and `network` (in
    // the viewer's first degree); intents and picker picks beside them.
    reactions: [],
    intents: [],
    picks: [],
    // 62-G: a comment row is { id, post_id, parent_id, author_id, body, media, created_at,
    // edited_at, deleted_at } and, for a seeded commenter other than the member, `person`; a
    // reaction or intent on one carries comment_id in place of post_id. commentReactDelayMs and
    // reactDelayMs hold the write's answer back so an arm can read the optimistic change (1844);
    // reactFail refuses the next comment_react so the rollback can be read.
    comments: [],
    commentReactions: [],
    commentIntents: [],
    commentReactDelayMs: 0,
    reactDelayMs: 0,
    reactFail: false,
    drafts: new Map(),
    rpcPayloads: [],
    inferCalls: 0,
    // Rulings 193, 194: set to fail the one vocabulary read, so a flow can check that the controls
    // reading it render empty rather than falling back to a literal that no longer exists.
    failVocab: false,
    // Ruling 287: publish_post answers instantly by default, so the composer unmounts before an
    // autosave timer in flight can fire and React clears it. Set this to hold the response open
    // past DRAFT_DEBOUNCE, after the draft has been cleared, and the timer fires with the composer
    // still mounted and the publish still in flight, which is the live shape of the defect.
    publishDelayMs: 0,
    reads: [],
    // Brief 3: which persona is signed in relative to thandiwe-dube, and the owner's switches.
    profile: {
      mode: "owner",
      rel: "none",
      following: false,
      switches: { shared: true, private: false },
      visibility: {},
      overrides: {},
      failSection: null,
      attempts: [],
      saves: [],
      follows: [],
      requests: [],
      blocks: [],
    },
    // Brief 5: what onboarding_state() answers and what the onboarding function was sent. Every
    // existing flow signs in as a member who has onboarded (next null), so the gate in the root
    // route holds nothing; the onboarding arm sets next itself.
    onboarding: {
      state: {
        next: null,
        who: {
          name: "Amara Osei",
          username: "amara-osei",
          suggestion: "amara-osei",
          avatar_path: null,
          completed: true,
        },
        where: { city: "Nairobi", country: "Kenya", completed: true },
        relationship: {
          stance: "exploring",
          stance_label: "Still exploring",
          declared: false,
          completed: true,
        },
        onboarded_at: "2026-09-01T00:00:00+00:00",
      },
      writes: [],
      explainerOpens: 0,
      taken: false,
      failScreen: null,
      delayMs: 0,
      // Ruling 345: what the last media-upload actually carried, so an arm can prove the client
      // normalised the file (converted to JPEG, downscaled) before it left the browser.
      lastUpload: null,
    },
    // Brief 5: media-upload refusals, so the photo's two alerts can be exercised.
    mediaTooLarge: false,
    mediaFail: false,
    // Brief 10 (handoff 30-C): what event_page answers per event id (undefined is not found, null
    // is the projection's own null), the card's speakers, the member's own event_parties rows, and
    // every write the page made. rsvpFail is the server's refusal sentence for the next rsvp_event.
    // `reads` is every event id event_page was asked for, in order (handoff 31-D's intent arm).
    attend: {
      pages: {},
      reads: [],
      // Addendum 4 item 1: every event_presenters call, its ids and whether it carried no session.
      presenterReads: [],
      speakers: [],
      parties: [],
      rsvps: [],
      responses: [],
      rsvpFail: null,
      fail: false,
      // Handoff 30-D: what event_public_page answers per slug (undefined is not found), the
      // guest-rsvp function's state (the tokens it accepts and the address each names, the one
      // guest row, whether the conversion offer was made, every request and answer it took), and
      // every event-mail call. mailFail makes event-mail answer 502.
      publicPages: {},
      guest: { tokens: {}, row: null, offered: false, requests: [], answers: [], refuse: null },
      mail: [],
      mailFail: false,
    },
    // Brief 9 (handoff 31-B item 15, 32-B): what convene_discovery answers. `sections` maps a lane
    // id to its items ({ event_id, post_id, reason }); the mock returns, under lens all, every lane
    // with an item left after this member's dismissals and facets, and under a lens that one lane,
    // empty or not, as the projection does. Homes default to the member's own; `calls` is every argument set
    // the surface sent and `dismissals` every write.
    discovery: {
      sections: {},
      homes: null,
      follows: [],
      subscriptions: [],
      suggest: null,
      dismissals: [],
      calls: [],
      fail: false,
      // Handoff 32-B: what convene_places() answers (1095), the member's going registrations for
      // Add to calendar (1097), every set_subscription write (1039), and the member's rail rows
      // (1111) as { surface, width_band, collapsed }, with every upsert.
      places: [],
      going: [],
      subscriptionWrites: [],
      rail: [],
      railWrites: [],
      // Handoff 34-A: the going names event_going_names gives per event id with every call it took
      // (goingFail makes it answer 500), every note_lane_act write, and a lane order that overrides
      // the learned one when set.
      goingNames: {},
      goingReads: [],
      goingFail: false,
      laneActs: [],
      laneOrder: null,
    },
    // Brief 4: Connect's projection state and the writes the surface made.
    connect: {
      // Handoff 55-A (1522): whether connect_requests_pending answers true, and the surfaces the
      // member marked seen through mark_surface_seen.
      pending: false,
      surfaceSeen: [],
      overrides: {},
      dismissed: [],
      writes: [],
      whereEmpty: false,
      membersEmpty: false,
      suggestFail: false,
      corridors: [{ id: "los-angeles-accra-agriculture", label: "Los Angeles to Accra" }],
    },
  };
  return db;
}

const LONG =
  "Back in Nairobi after three weeks in Houston. The jet lag is winning and the mangoes are not. " +
  "Three intros changed the trip: a cooperative in Oyo found its first buyer through two members, " +
  "a clinic coordinator agreed to run a weekend session in Kisumu, and a fintech founder in Accra " +
  "opened his books to a savings product for market traders. Writing the long version tonight, " +
  "because the short version does not do the people justice.\n\nMore soon, with names once they agree.";

/** Seed n published untyped posts, newest first, alternating authors so Mine and My Network differ. */
function seedPosts(db, n) {
  for (let i = 0; i < n; i++) {
    const mineRow = i % 2 === 0;
    db.posts.push({
      id: "seed-" + i,
      author_kind: "member",
      author_id: mineRow ? UID : "00000000-0000-4000-8000-0000000000f2",
      created_by: mineRow ? UID : "00000000-0000-4000-8000-0000000000f2",
      c_category: "convey",
      body: i + 1 + ". " + LONG,
      anchor_kind: null,
      anchor_id: null,
      created_object_kind: null,
      created_object_id: null,
      audience: "everyone",
      status: "published",
      published_at: new Date(Date.now() - i * 3600e3).toISOString(),
      created_at: new Date(Date.now() - i * 3600e3).toISOString(),
    });
  }
}

async function mockSupabase(page, db, opts = {}) {
  // Brief 14 (handoff 41-C): the shell keeps the member's Realtime inbox for the session (1351), so
  // every page opens the Realtime socket. The mock serves REST and RPC and never that socket, and a
  // socket left to the network either fails (a console error every arm's page-error check reads) or
  // reaches the real project with the mock's unsigned token. Stubbed here, once, for every arm: the
  // Phoenix frames (vsn 2.0.0, `[join_ref, ref, topic, event, payload]`) are answered `ok` for a
  // join, a leave and the heartbeat, and nothing is ever broadcast, which is the mock's honest
  // reading of a project that has no broadcast to send.
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((message) => {
      if (typeof message !== "string") return;
      let frame;
      try {
        frame = JSON.parse(message);
      } catch {
        return;
      }
      if (!Array.isArray(frame)) return;
      const [joinRef, ref, topic, event] = frame;
      if (event === "phx_join" || event === "phx_leave" || event === "heartbeat")
        ws.send(
          JSON.stringify([
            joinRef ?? null,
            ref ?? null,
            topic,
            "phx_reply",
            { status: "ok", response: event === "phx_join" ? { postgres_changes: [] } : {} },
          ]),
        );
    });
  });
  // Google Fonts are not reachable from this sandbox; abort so the check for page errors stays meaningful.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(`**/${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const method = req.method();
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      });
    if (method === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    // Handoff 61-S1 (tests/account.cjs): the auth surface the Account drawer reaches. The user
    // carries its identities (getUserIdentities reads them off the user) and a pending new_email;
    // a password grant is the drawer's re-authentication, refused when it names the wrong current
    // password; PUT /user is updateUser for the email change and the password.
    const ac = db.account;
    const accountUser = () => ({
      ...USER,
      identities: ac.identities,
      ...(ac.newEmail ? { new_email: ac.newEmail } : {}),
    });
    if (p.startsWith("/auth/v1/token")) {
      const body = req.postDataJSON() || {};
      ac.tokenCalls.push(body);
      if (ac.wrongCurrent && body.password === ac.wrongCurrent)
        return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login" }, 400);
      return json({ ...SESSION, user: accountUser() });
    }
    if (p === "/auth/v1/user" && method === "PUT") {
      const body = req.postDataJSON() || {};
      ac.updateCalls.push(body);
      await new Promise((r) => setTimeout(r, 120));
      if (body.password !== undefined && ac.weakPassword)
        return json(
          {
            code: 422,
            error_code: "weak_password",
            msg: "Password is known to be weak and easy to guess, please choose a different one.",
            weak_password: { reasons: ["pwned"] },
          },
          422,
        );
      if (body.email !== undefined) {
        if (ac.updateFail === "email")
          return json({ code: 500, error_code: "unexpected_failure", msg: "mail" }, 500);
        ac.newEmail = body.email;
      }
      return json(accountUser());
    }
    if (p === "/auth/v1/user") {
      // Ruling 1746 (tests/account.cjs): the server's answer that this session is gone, as GoTrue
      // writes it, and a network failure, which is no answer at all.
      if (ac.userFail === "network") return route.abort("connectionfailed");
      if (ac.sessionGone)
        return json(
          {
            code: 403,
            error_code: "session_not_found",
            msg: "Session from session_id claim in JWT does not exist",
          },
          403,
        );
      return json(accountUser());
    }
    if (p.startsWith("/auth/v1/user/identities/") && method === "DELETE") {
      const id = p.slice("/auth/v1/user/identities/".length);
      ac.unlinkCalls.push(id);
      await new Promise((r) => setTimeout(r, 120));
      if (ac.unlinkFail)
        return json({ code: 500, error_code: "unexpected_failure", msg: "unlink" }, 500);
      ac.identities = ac.identities.filter((i) => i.identity_id !== id);
      return json({});
    }
    if (p === "/auth/v1/resend") {
      ac.resendCalls++;
      return json({});
    }
    if (p === "/auth/v1/logout") {
      ac.logoutScopes.push(url.searchParams.get("scope") || "global");
      if ((url.searchParams.get("scope") || "global") === "others")
        ac.sessions = ac.sessions.filter((x) => x.is_current);
      return json({}, 204);
    }
    if (p === "/rest/v1/rpc/sessions_list") {
      await new Promise((r) => setTimeout(r, 120));
      if (ac.sessionsFail) return json({ code: "P0001", message: "sessions" }, 400);
      return json(ac.sessions);
    }
    if (p === "/rest/v1/rpc/session_revoke") {
      const body = req.postDataJSON() || {};
      ac.revokeCalls.push(body.p_session_id);
      await new Promise((r) => setTimeout(r, 120));
      if (ac.revokeFail) return json({ code: "P0002", message: "session_not_found" }, 400);
      ac.sessions = ac.sessions.filter((x) => x.id !== body.p_session_id);
      return json(null, 204);
    }
    if (p === "/functions/v1/dia-compose-read") {
      db.inferCalls++;
      const body = req.postDataJSON();
      await new Promise((r) => setTimeout(r, opts.inferDelay ?? 900));
      if (opts.silent) return json(null);
      const key = Object.keys(SAMPLES).find(
        (k) => k !== "untyped" && body.text.startsWith(SAMPLES[k].slice(0, 30)),
      );
      return json(key ? INFER[key] : null);
    }
    if (p === "/functions/v1/place-resolve") {
      // Convene Pass 1, PR 2: four typed states. Session 24 (783): every suggest carries the
      // host's country and the mock answers inside it only: zero hits is none, one is one, two
      // or more is several. A suggest with no country_name is the function's own `unavailable`
      // (never the Edge node's IP); a proximity narrows and never widens. Session 23: a query
      // naming an outage is answered 503 from the gateway, which the client reads as
      // `unavailable`.
      const body = req.postDataJSON() || {};
      db.placeCalls.push(body);
      await new Promise((r) => setTimeout(r, 120));
      const FRONT = {
        place_id: "dXJuOm1ieHBvaTpmcm9udC1yb29t",
        place_name: "Front Room",
        area: "Osu",
        city: "Accra",
        // Ruling 927: the region Mapbox returns in the same context block as the city and the
        // country. It was dropped before Pass 5 and a surface wanting to say it had to look twice.
        region: "Greater Accra",
        country: "Ghana",
        lng: -0.1747,
        lat: 5.5559,
        timezone: "Africa/Accra",
        label: "Front Room, Osu, Accra",
        kind: "venue",
      };
      // Session 23, change 2: an area. Search Box holds no POI for Ghana; "Labadi beach" near
      // Accra answers the locality it sits in, and the form keeps the words beside it.
      const OSU = {
        place_id: "dXJuOm1ieHBsYzpPc3U",
        place_name: "Osu",
        area: null,
        city: "Accra",
        // Ruling 927's other half: a response that carries no region. Null here, "" through the
        // composer, and `nullif(trim(...), '')` makes it null in the column rather than a guess.
        region: null,
        country: "Ghana",
        lng: -0.1794,
        lat: 5.5557,
        timezone: "Africa/Accra",
        label: "Osu, Accra",
        kind: "area",
      };
      // Ruling 807: Mapbox names the same thing twice often enough to matter. This Ghana area's
      // `place_name` and `area` are one string, which is what printed `Labadi Villas, Labadi
      // Villas, Accra` on the founder's preview on 17 September.
      const VILLAS = {
        place_id: "dXJuOm1ieHBsYzpMYWJhZGlWaWxsYXM",
        place_name: "Labadi Villas",
        area: "Labadi Villas",
        city: "Accra",
        region: null,
        country: "Ghana",
        lng: -0.1553,
        lat: 5.5606,
        timezone: "Africa/Accra",
        label: "Labadi Villas, Accra",
        kind: "area",
      };
      const AF = [
        {
          place_id: "af-accra",
          place_name: "Alliance Française Accra",
          area: "Airport Residential",
          city: "Accra",
          country: "Ghana",
          lng: -0.18,
          lat: 5.61,
          timezone: "Africa/Accra",
          label: "Alliance Française Accra, Airport Residential, Accra",
          kind: "venue",
        },
        {
          place_id: "af-kumasi",
          place_name: "Alliance Française Kumasi",
          area: "Nhyiaeso",
          city: "Kumasi",
          country: "Ghana",
          lng: -1.62,
          lat: 6.67,
          timezone: "Africa/Accra",
          label: "Alliance Française Kumasi, Nhyiaeso, Kumasi",
          kind: "venue",
        },
        {
          place_id: "af-nairobi",
          place_name: "Alliance Française Nairobi",
          area: "Loresho",
          city: "Nairobi",
          country: "Kenya",
          lng: 36.79,
          lat: -1.26,
          timezone: "Africa/Nairobi",
          label: "Alliance Française Nairobi, Loresho, Nairobi",
          kind: "venue",
        },
      ];
      // What the stand-in knows, by the words that find it.
      const CATALOGUE = [
        { match: "front room", place: FRONT },
        { match: "labadi", place: OSU },
        { match: "villas", place: VILLAS },
        ...AF.map((place) => ({ match: "alliance", place })),
      ];
      if (body.action === "retrieve") {
        const hit = CATALOGUE.find((c) => c.place.place_id === body.mapbox_id);
        return hit ? json({ state: "one", place: hit.place }) : json({ state: "none" });
      }
      // Rulings 813, 817: the dry run answers the country's alpha-2 code and its IANA zones from
      // the function's own runtime ICU, with no Mapbox call. One zone is the 168-country case the
      // form takes silently; more than one is the case it asks about (821); null is a runtime that
      // could not say, which leaves the form's previous behaviour standing.
      if (body.action === "anchor") {
        const ANCHORS = {
          Ghana: { country: "GH", zones: ["Africa/Accra"] },
          Kenya: { country: "KE", zones: ["Africa/Nairobi"] },
          "United Kingdom": { country: "GB", zones: ["Europe/London"] },
          "South Africa": { country: "ZA", zones: ["Africa/Johannesburg"] },
          "United States": {
            country: "US",
            zones: [
              "America/Chicago",
              "America/Denver",
              "America/Los_Angeles",
              "America/New_York",
              "Pacific/Honolulu",
            ],
          },
        };
        const hit = ANCHORS[body.country_name];
        if (!hit) return json({ state: "unavailable" });
        return json({ ...hit, state: "anchored", zones_via: "timeZones" });
      }
      const q = String(body.q || "").toLowerCase();
      if (q.length < 3) return json({ state: "none" });
      if (q.includes("outage")) return json({ message: "upstream unavailable" }, 503);
      if (!body.country_name) return json({ state: "unavailable" });
      const hits = CATALOGUE.filter(
        (c) => q.includes(c.match) && c.place.country === body.country_name,
      ).map((c) => c.place);
      if (hits.length === 0) return json({ state: "none" });
      if (hits.length === 1) return json({ state: "one", place: hits[0] });
      return json({
        state: "several",
        places: hits.map(({ lng, lat, timezone, ...rest }) => rest),
      });
    }
    if (p === "/functions/v1/link-unfurl") {
      await new Promise((r) => setTimeout(r, 400));
      return json({
        url: req.postDataJSON().url,
        title: "Nairobi to host continental builders summit",
        description: null,
        image_url: null,
      });
    }
    if (p === "/functions/v1/media-upload") {
      // Ruling 345: record what left the browser. The multipart headers for the file part name its
      // filename and Content-Type; the body length stands in for the uploaded byte count.
      const buf = req.postDataBuffer && req.postDataBuffer();
      const head = buf ? buf.slice(0, 4096).toString("latin1") : "";
      // A JPEG's EXIF segment carries the marker "Exif\0\0" near the file start; a canvas re-encode
      // carries none, which is how ruling 347's client-side strip is proven.
      const sep = head.indexOf("\r\n\r\n");
      const fileHead = sep >= 0 ? head.slice(sep + 4) : head;
      db.onboarding.lastUpload = {
        bytes: buf ? buf.length : 0,
        jpeg: /content-type:\s*image\/jpeg/i.test(head) || /filename="[^"]*\.jpe?g"/i.test(head),
        exif: fileHead.includes("Exif\u0000\u0000"),
      };
      await new Promise((r) => setTimeout(r, 300));
      if (db.mediaTooLarge) return json({ error: "too_large" }, 413);
      if (db.mediaFail) return json({ error: "upload_failed" }, 500);
      return json({
        storage_path: `${UID}/p1/${db.post_media.length + 1}.png`,
        width: 1200,
        height: 800,
        media_id: "m-" + (db.post_media.length + 1),
      });
    }
    if (p.startsWith("/storage/v1/object/sign/") && method === "POST") {
      // Batch signing (createSignedUrls): a bucket path with {paths} in the body.
      const b = req.postDataJSON() || {};
      if (Array.isArray(b.paths))
        return json(
          b.paths.map((x) => ({
            error: null,
            path: x,
            signedURL: "/object/sign/profile-media/" + x + "?token=t",
          })),
        );
      return json({ signedURL: "/object/sign/" + p.split("/object/sign/")[1] + "?token=t" });
    }
    if (p === "/rest/v1/rpc/onboarding_state") return json(db.onboarding.state);
    if (p === "/functions/v1/onboarding") {
      const ob = db.onboarding;
      const body = req.postDataJSON() || {};
      if (ob.delayMs) await new Promise((r) => setTimeout(r, ob.delayMs));
      if (body.event === "explainer_opened") {
        ob.explainerOpens++;
        return json({ ok: true });
      }
      ob.writes.push(body);
      if (ob.failScreen === body.screen)
        return json({ ok: false, error: { code: "P0001", message: "That did not save." } }, 400);
      const st = ob.state;
      if (body.screen === "who") {
        if (ob.taken)
          return json({ ok: true, result: { status: "taken", suggestion: st.who.suggestion } });
        st.who = {
          ...st.who,
          name: body.name,
          username: body.username,
          avatar_path: body.avatar_path,
          completed: true,
        };
        st.next = st.where.completed ? (st.onboarded_at ? null : "relationship") : "where";
        return json({
          ok: true,
          result: {
            status: "ok",
            name: body.name,
            username: body.username,
            avatar_path: body.avatar_path,
            suggestion: st.who.suggestion,
            username_changes: body.username === st.who.suggestion ? 0 : 1,
          },
        });
      }
      if (body.screen === "where") {
        st.where = { city: body.city, country: body.country, completed: true };
        st.next = "relationship";
        return json({ ok: true, result: { status: "ok", city: body.city, country: body.country } });
      }
      if (body.screen === "relationship") {
        const now = new Date().toISOString();
        if (body.touched)
          st.relationship = { ...st.relationship, stance: body.stance, declared: true };
        st.relationship.completed = true;
        st.onboarded_at = now;
        st.next = null;
        return json({
          ok: true,
          result: {
            status: "ok",
            stance: st.relationship.stance,
            stance_declared_at: body.touched ? now : null,
            onboarded_at: now,
          },
        });
      }
      return json({ ok: false, error: { code: "bad_screen" } }, 400);
    }
    if (p === "/functions/v1/connect-suggest") {
      await new Promise((r) => setTimeout(r, 150));
      if (db.connect.suggestFail) return json({ items: [] });
      return json({
        items: CONNECT_SUGGESTED.filter((c) => !db.connect.dismissed.includes(c.id)).map((c) =>
          connectCard(c, db.connect.overrides),
        ),
      });
    }
    if (
      p.startsWith("/rest/v1/rpc/") &&
      /^\/rest\/v1\/rpc\/(connect_cards|connect_where|connect_filter_options|connection_request_intros|send_introduction|respond_to_request|withdraw_request|set_follow|dismiss_suggestion)$/.test(
        p,
      )
    ) {
      const fn = p.slice("/rest/v1/rpc/".length);
      const body = req.postDataJSON() || {};
      const cx = db.connect;
      await new Promise((r) => setTimeout(r, 120));
      if (fn === "connect_filter_options")
        return json({ ...CONNECT_OPTIONS, corridors: cx.corridors });
      if (fn === "connection_request_intros") return json([]);
      if (fn === "connect_where")
        return json(cx.whereEmpty ? { continent: [], diaspora: [] } : CONNECT_WHERE);
      if (fn === "connect_cards") {
        const f = body.p_filters || {};
        if (body.p_lens === "members") {
          let rows = cx.membersEmpty ? [] : CONNECT_MEMBERS.slice();
          if (f.stance) rows = rows.filter((m) => m._stance === f.stance);
          if (f.location) rows = rows.filter((m) => m._location === f.location);
          if (f.focus) rows = rows.filter((m) => m._focus === f.focus);
          if (f.origin) rows = rows.filter((m) => m.origin === f.origin);
          if (f.heritage) rows = rows.filter((m) => m.heritage === f.heritage);
          for (const k of ["industry", "skill", "region"])
            if (f[k]) rows = rows.filter((m) => m.chips.includes(f[k]));
          // No fixture carries a pathway or a corridor: those axes filter to nothing.
          if (f.pathway || f.corridor) rows = [];
          // Ruling 1483 (Fix PR 10): the projection orders by tier, then name, then id. The fixture's
          // one tier signal is a request waiting on the viewer (rel received); no fixture carries an
          // anchor, a second degree row or a shared attribute, so the rest read by name. Filters
          // narrow and never reorder.
          const tier = (m) => (m.rel === "received" ? 0 : 4);
          rows.sort(
            (a, b) => tier(a) - tier(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          );
          return json({ items: rows.map((m) => connectCard(m, cx.overrides)), next_cursor: null });
        }
        if (body.p_lens === "suggested")
          return json({
            items: CONNECT_SUGGESTED.filter((c) => !cx.dismissed.includes(c.id)).map((c) =>
              connectCard(c, cx.overrides),
            ),
          });
        if (body.p_lens === "network") {
          const cards = CONNECT_MEMBERS.map((m) => connectCard(m, cx.overrides));
          return json({
            // 1449: each received request carries its created_at as since, raw; the lib formats it.
            requests: cards
              .filter((c) => c.rel === "received")
              .map((c) => ({ ...c, since: "2026-10-08T09:15:00Z" })),
            sent: cards
              .filter((c) => c.rel === "sent" || (cx.overrides[c.id] || {}).sentPending)
              .map((c) => ({ ...c, rel: "sent" })),
            connections: cards.filter((c) => c.rel === "connected"),
            following: cards.filter((c) => c.following),
          });
        }
        return json({ code: "22023", message: "unknown lens" }, 400);
      }
      cx.writes.push(fn + ":" + JSON.stringify(body));
      const over = (id, o) => (cx.overrides[id] = { ...(cx.overrides[id] || {}), ...o });
      if (fn === "send_introduction") {
        if (!body.p_message || !String(body.p_message).trim())
          return json(
            { code: "22023", message: "An introduction needs a message of up to 300 characters." },
            400,
          );
        over(body.p_recipient, { rel: "sent" });
        db.profile.rel = "sent";
        return json("cr-new");
      }
      if (fn === "respond_to_request") {
        over(body.p_sender, { rel: body.p_accept ? "connected" : "none" });
        db.profile.requests.push("PATCH");
        db.profile.rel = body.p_accept ? "connected" : "none";
        return json(null, 204);
      }
      if (fn === "withdraw_request") {
        over(body.p_recipient, { rel: "none" });
        db.profile.requests.push("PATCH");
        db.profile.rel = "none";
        return json(null, 204);
      }
      if (fn === "set_follow") {
        over(body.p_target, { following: !!body.p_on });
        db.profile.following = !!body.p_on;
        db.profile.follows.push(body.p_on ? "on" : "off");
        // Discovery's projection reads the member's follows, so the next answer carries the write.
        const d = db.discovery;
        d.follows = d.follows.filter((f) => f.id !== body.p_target);
        if (body.p_on)
          d.follows.push({ id: body.p_target, name: null, handle: null, avatar_path: null });
        return json(null, 204);
      }
      if (fn === "dismiss_suggestion") {
        cx.dismissed.push(body.p_target);
        return json(null, 204);
      }
    }
    if (p.startsWith("/storage/v1/object/sign") || p.includes("/object/sign/"))
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: KENTE });
    // Brief 10 (1029): the public page's cover through the event-media function, signed out.
    if (p === "/functions/v1/event-media")
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: KENTE });
    // Handoff 32-B item 9: an alias or a short code answers its event's slug, or null.
    if (p === "/rest/v1/rpc/resolve_event_link") {
      const b = req.postDataJSON() || {};
      const links = db.attend.links || {};
      const slug = (links[b.p_kind] || {})[b.p_segment];
      return json(slug ?? null);
    }
    if (p === "/rest/v1/rpc/publish_post") {
      const payload = req.postDataJSON().payload;
      db.rpcPayloads.push(payload);
      // A refusal (ruling 665's failed state) writes nothing and answers in the RPC's own shape.
      if (db.publishFail)
        return json({ code: "22023", message: db.publishFail, details: null, hint: null }, 400);
      const id = payload.id;
      let kind = null,
        oid = null;
      const f = payload.fields || {};
      const title = f.title || payload.body.split("\n")[0].slice(0, 80) || "Untitled";
      if (payload.verb === "convene") {
        // Convene Pass 1: the namespaced keys publish_post reads (20260916120200), mirrored here.
        oid = "e" + id;
        kind = "event";
        const c = (k) => f["convene." + k];
        const format = c("format") || "in_person";
        const mode = format === "online" ? "virtual" : format;
        const starts = c("starts_at") || null;
        const windowed = !starts && !!c("when_window");
        db.events.push({
          id: oid,
          host_member_id: UID,
          title: c("title") || title,
          starts_at: starts,
          ends_at: c("ends_at") || null,
          doors_at: c("doors_at") || null,
          when_text: c("when") || c("when_window") || "",
          mode,
          ticket_kind: c("price_nature") || "free",
          space_id: c("space_id") || (payload.anchor?.kind === "space" ? payload.anchor.id : null),
          status: "published",
          timezone: c("timezone") || null,
          time_confirmed: !!starts,
          date_confirmed: !!starts,
          expected_window_start: windowed ? c("expected_window_start") || null : null,
          expected_window_end: windowed ? c("expected_window_end") || null : null,
          window_basis: windowed ? c("when_window") : null,
          delivery_intent: c("delivery_intent") || "",
          cancelled_at: null,
          cancelled_reason: null,
          attachments: [],
          created_at: new Date().toISOString(),
        });
        if (format === "in_person" || format === "hybrid")
          db.event_delivery.push({
            id: "d" + id + "p",
            event_id: oid,
            kind: "physical",
            position: 0,
            place_id: c("place_id") || null,
            place_name: c("place_name") || null,
            place_text: c("place_id") ? null : c("place_text") || null,
            city: c("city") || null,
            country: c("country") || null,
          });
        if (format === "online" || format === "hybrid")
          db.event_delivery.push({
            id: "d" + id + "l",
            event_id: oid,
            kind: c("link") ? "meeting_link" : "to_be_announced",
            position: format === "hybrid" ? 1 : 0,
            url: c("link") || null,
          });
      }
      if (payload.verb === "collaborate") {
        oid = "sp" + id;
        kind = "space";
        db.spaces.push({
          id: oid,
          title,
          owner_member_id: UID,
          category: f.category || null,
          description: payload.body,
          roles_sought: (f.roles || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          status: "active",
          created_at: new Date().toISOString(),
        });
      }
      if (payload.verb === "contribute") {
        oid = "o" + id;
        kind = "opportunity";
        db.opportunities.push({
          id: oid,
          receiver_member_id: UID,
          title,
          instrument: { Skills: "skills", "In-kind": "in_kind" }[f.instrument] || "time",
          need: f.need || payload.body,
          by_date: payload.by_date,
          by_text: f.by || "",
          space_id: null,
          event_id: null,
          created_at: new Date().toISOString(),
        });
      }
      if (payload.verb === "connect") {
        oid = "c" + id;
        kind = "connection_request";
        db.connection_requests.push({
          id: oid,
          from_member_id: UID,
          to_member_id: null,
          to_name: f.who || "",
          why: f.why || payload.body,
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }
      if (payload.verb === "convey") {
        oid = "st" + id;
        kind = "story";
        db.stories.push({
          id: oid,
          author_member_id: UID,
          title,
          body: payload.body,
          origin_kind: null,
          origin_id: null,
          created_at: new Date().toISOString(),
        });
      }
      db.posts.unshift({
        id,
        author_kind: payload.author_kind,
        author_id: payload.author_id,
        created_by: UID,
        c_category: payload.verb || "convey",
        body: payload.body,
        anchor_kind: payload.anchor?.kind ?? null,
        anchor_id: payload.anchor?.id ?? null,
        created_object_kind: kind,
        created_object_id: oid,
        audience: payload.audience,
        status: "published",
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      (payload.media || []).forEach((m, i) =>
        db.post_media.push({
          id: "m" + i + id,
          post_id: id,
          storage_path: m.storage_path,
          width: m.width,
          height: m.height,
          position: m.position,
          created_at: new Date().toISOString(),
        }),
      );
      if (payload.link)
        db.post_links.push({
          id: "l" + id,
          post_id: id,
          url: payload.link.url,
          title: payload.link.title,
          description: payload.link.description,
          image_url: payload.link.image_url,
          fetched_at: null,
          created_at: new Date().toISOString(),
        });
      db.drafts.clear();
      // Ruling 287: the draft is deleted inside the publish transaction, and the response is what
      // the client is still waiting on. Holding it here, after the clear, is the live ordering:
      // on the founder's account the resurrected draft row landed 132ms after the transaction that
      // deleted it, with the composer still mounted and the publish still in flight.
      if (db.publishDelayMs) await new Promise((r) => setTimeout(r, db.publishDelayMs));
      return json(id);
    }
    if (p === "/rest/v1/rpc/profile_view") {
      const body = req.postDataJSON() || {};
      const auth = req.headers()["authorization"] || "";
      const anon = !auth.includes(JWT) || body.p_as_public === true;
      await new Promise((r) => setTimeout(r, 120));
      return json(profileProjection(db, anon));
    }
    // Ruling 193: one vocabulary path, read by Profile, the Composer and the Feed. FAIL_VOCAB
    // forces the read to fail, which is how the empty-control behaviour of ruling 194 is checked.
    // Handoff 30-D (1026, 1028): the public page's one read, and the guest's one write path. The
    // function's answers follow supabase/functions/guest-rsvp/index.ts and 20260922120000: a request
    // is 202 whether sent or throttled, a bad address is the database's own sentence at 400, a
    // bad or unknown token is 410, `open` writes going once and reports the row after, going and
    // not_going write the answer, and the conversion offer is made once per row (1034).
    if (p === "/rest/v1/rpc/event_public_page") {
      const b = req.postDataJSON() || {};
      await new Promise((r) => setTimeout(r, 120));
      const pg = db.attend.publicPages[b.p_slug];
      return json(pg === undefined ? null : pg);
    }
    if (p === "/functions/v1/guest-rsvp") {
      const b = req.postDataJSON() || {};
      const g = db.attend.guest;
      await new Promise((r) => setTimeout(r, 150));
      if (b.action === "request") {
        g.requests.push(b);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || "")))
          return json({ error: "That is not an email address." }, 400);
        if (g.refuse) return json({ error: g.refuse }, 400);
        return json({ ok: true }, 202);
      }
      const email = typeof b.token === "string" ? g.tokens[b.token] : undefined;
      if (!email) return json({ expired: true }, 410);
      g.answers.push(b);
      const offer = () => {
        const first = !g.offered;
        g.offered = true;
        return first;
      };
      if (b.action === "open") {
        if (g.row)
          return json({ state: "existing", status: g.row.status, offer_conversion: false, email });
        g.row = { status: "going", email };
        return json({ state: "returned", status: "going", offer_conversion: offer(), email });
      }
      if (b.action === "going") {
        g.row = { status: "going", email };
        return json({ state: "answered", status: "going", offer_conversion: offer(), email });
      }
      if (b.action === "not_going") {
        g.row = { status: "not_going", email };
        return json({ state: "answered", status: "not_going", offer_conversion: false, email });
      }
      return json({ error: "That is not a request this takes." }, 400);
    }
    // Handoff 30-D (1035): the member's going email. 202 sent, 502 when the send failed.
    if (p === "/functions/v1/event-mail") {
      const b = req.postDataJSON() || {};
      db.attend.mail.push({ ...b, auth: req.headers()["authorization"] || "" });
      await new Promise((r) => setTimeout(r, 120));
      return db.attend.mailFail ? json({ sent: false }, 502) : json({ sent: true }, 202);
    }
    // Brief 10 (handoff 30-C): the event page's one read, the card's speakers, and the two writes.
    if (p === "/rest/v1/rpc/event_page") {
      const b = req.postDataJSON() || {};
      const a = db.attend;
      a.reads.push(b.p_event);
      await new Promise((r) => setTimeout(r, 120));
      if (a.fail) return json({ code: "PGRST", message: "forced event_page failure" }, 500);
      const pg = a.pages[b.p_event];
      if (pg && pg.event && pg.event.family && pg.viewer) {
        // Handoff 37-C: viewer.subscribed reads member_subscriptions, which set_subscription writes.
        const subscribed = db.discovery.subscriptions.some((x) => x.family === pg.event.family);
        return json({ ...pg, viewer: { ...pg.viewer, subscribed } });
      }
      return json(pg === undefined ? null : pg);
    }
    if (p === "/rest/v1/rpc/event_speakers") {
      const b = req.postDataJSON() || {};
      const ids = Array.isArray(b.p_events) ? b.p_events : [];
      return json(db.attend.speakers.filter((sp) => ids.includes(sp.event_id)));
    }
    // Addendum 4 item 1 (1121): the presenter line for many events, which the database resolves
    // through the same two private functions as event_page, so the mock answers from the same page
    // fixtures: presented_by and host per id it holds a page for. Anon holds no execute grant
    // (20260924140000), so a signed-out call is refused; more than 200 ids is the function's 22023.
    if (p === "/rest/v1/rpc/event_presenters") {
      const b = req.postDataJSON() || {};
      const ids = Array.isArray(b.p_events) ? b.p_events : [];
      const anon = !(req.headers()["authorization"] || "").includes(JWT);
      db.attend.presenterReads.push({ ids, anon });
      if (anon)
        return json(
          { code: "42501", message: "permission denied for function event_presenters" },
          401,
        );
      if (ids.length > 200)
        return json({ code: "22023", message: "At most 200 events at a time." }, 400);
      const out = {};
      for (const id of ids) {
        const pg = db.attend.pages[id];
        if (pg) out[id] = { presented_by: pg.presented_by ?? null, host: pg.host ?? null };
      }
      return json(out);
    }
    if (p === "/rest/v1/rpc/rsvp_event") {
      const b = req.postDataJSON() || {};
      const a = db.attend;
      a.rsvps.push(b);
      await new Promise((r) => setTimeout(r, 150));
      if (a.rsvpFail)
        return json({ code: "22023", message: a.rsvpFail, details: null, hint: null }, 400);
      const pg = a.pages[b.p_event];
      if (!pg)
        return json({ code: "22023", message: "That event is not one you can answer." }, 400);
      // 1030: a first going answer writes the convene default and stores no override.
      const firstDefault = b.p_status === "going" && !pg.viewer.has_default;
      if (firstDefault) {
        pg.viewer.has_default = true;
        pg.viewer.default_audience = b.p_audience_override || "connections";
      }
      pg.viewer.registration = {
        status: b.p_status,
        audience_override: firstDefault ? null : (b.p_audience_override ?? null),
        contact_consent: false,
      };
      return json({
        event_id: b.p_event,
        status: b.p_status,
        audience_override: pg.viewer.registration.audience_override,
        contact_consent: false,
        default_set: firstDefault,
        updated_at: new Date().toISOString(),
      });
    }
    if (p === "/rest/v1/rpc/respond_to_event_role") {
      const b = req.postDataJSON() || {};
      const a = db.attend;
      a.responses.push(b);
      await new Promise((r) => setTimeout(r, 150));
      for (const pg of Object.values(a.pages))
        if (pg && Array.isArray(pg.invitations))
          pg.invitations = pg.invitations
            .map((i) =>
              i.party_id === b.p_party ? { ...i, status: b.p_accept ? "accepted" : "declined" } : i,
            )
            .filter((i) => i.status !== "declined");
      a.parties = a.parties.map((r) =>
        r.id === b.p_party ? { ...r, status: b.p_accept ? "accepted" : "declined" } : r,
      );
      db.notifications = db.notifications.filter(
        (n) => !(n.object_kind === "event_party" && n.object_id === b.p_party && !b.p_accept),
      );
      return json({ id: b.p_party, status: b.p_accept ? "accepted" : "declined" });
    }
    // Brief 9 as handoff 32-B rebuilds it: the Discovery projection, its dismissal, Place's options
    // and the subscription write, with the projection's own refusals (22023) for a lens, a format, a
    // price, a when, a family, a home, a rung, a place or a search it does not take. Handoff 34-A
    // adds the search, Filling up and the learned order (20260926170300); its addendum withdraws
    // Browse (20260926170400, 1172).
    if (p === "/rest/v1/rpc/convene_discovery") {
      const b = req.postDataJSON() || {};
      const d = db.discovery;
      d.calls.push(b);
      const refuse = (message) => json({ code: "22023", message, details: null, hint: null }, 400);
      if (d.fail)
        return json(
          { code: "PGRST", message: "forced discovery failure", details: null, hint: null },
          500,
        );
      const lens = b.p_lens || "all";
      const homes =
        d.homes ??
        db.homes.map((h) => ({
          id: h.id,
          city: h.city,
          place_name: h.place_name,
          region: h.region ?? null,
          country: h.country,
        }));
      if (lens !== "all" && !DISCOVERY_LENSES.includes(lens)) return refuse("That is not a lens.");
      // 1174: p_without names the lens a read of All leaves out, and only All takes it.
      const without = b.p_without == null ? "" : String(b.p_without).trim();
      if (without && (lens !== "all" || !DISCOVERY_LENSES.includes(without)))
        return refuse("That is not a lens to leave out.");
      if (b.p_when && !["two_weeks", "this_month", "later"].includes(b.p_when))
        return refuse("That is not a when.");
      if (b.p_format && b.p_format.some((f) => !["in_person", "online", "hybrid"].includes(f)))
        return refuse("That is not a format.");
      // 1095: Donation is gone, so the projection refuses it as it refuses any unknown price.
      if (b.p_price && b.p_price.some((f) => !["free", "paid"].includes(f)))
        return refuse("That is not a price.");
      const families = VOCAB.convene_families.map((f) => f.value);
      if (b.p_families && b.p_families.some((f) => !families.includes(f)))
        return refuse("That is not a category family.");
      if (b.p_home && !homes.some((h) => h.id === b.p_home))
        return refuse("That is not one of your homes.");
      if (
        b.p_home_rung != null &&
        (!b.p_home || !["in", "around", "region", "country"].includes(b.p_home_rung))
      )
        return refuse("That is not a distance from a home.");
      const placeOk = (x) => {
        const parts = String(x).split("|");
        if (parts[0] === "city" || parts[0] === "region") return parts.length === 3 && !!parts[2];
        return parts[0] === "country" && parts.length === 2 && !!parts[1];
      };
      if (b.p_places && b.p_places.some((x) => !placeOk(x))) return refuse("That is not a place.");
      // 1159: trimmed, empty is no search, and past 100 characters the projection refuses it.
      const q = b.p_q == null ? "" : String(b.p_q).trim().toLowerCase();
      if (q.length > 100) return refuse("That search is too long.");
      // An in-person-only facet drops the online and curated lanes, as the live arm reads it.
      const inPersonOnly =
        Array.isArray(b.p_format) &&
        b.p_format.length &&
        !b.p_format.some((f) => f !== "in_person");
      // Fixture keys narrow as the projection does and never leave the mock: `_places` are the
      // place ids an item's physical rows fall in, `_rungs` the nearest rung from each home the item
      // sits at (1110: in, then around, then region, then country, each containing the one before),
      // and `_price` free or paid.
      const RUNG = ["in", "around", "region", "country"];
      const rung = b.p_home ? b.p_home_rung || "in" : null;
      const keep = (i) => {
        if (
          b.p_places &&
          b.p_places.length &&
          !(i._places || []).some((x) => b.p_places.includes(x))
        )
          return false;
        if (b.p_home) {
          const at = (i._rungs || {})[b.p_home];
          if (!at || RUNG.indexOf(at) > RUNG.indexOf(rung)) return false;
        }
        if (b.p_price && b.p_price.length && i._price && !b.p_price.includes(i._price))
          return false;
        // `_text` is the item's searchable words, lower-cased: its title, host, presenter, places
        // and family label, which the projection matches the search against (1159).
        if (q && !(i._text || "").includes(q)) return false;
        return true;
      };
      const strip = (i) => {
        const out = {};
        for (const k of Object.keys(i)) if (!k.startsWith("_")) out[k] = i[k];
        return out;
      };
      const city = (b.p_places || []).find((x) => x.startsWith("city|"));
      const cityName = city ? (d.places.find((x) => x.id === city) || {}).name || null : null;
      // 1160: lanes acted in during the last seven days first, most recent first, then the base
      // order; `lane_order` names every lane in it, and the sections come back in it.
      const week = Date.now() - 7 * 86400e3;
      const latest = {};
      for (const a of d.laneActs) if (a.at >= week) latest[a.p_lane] = a.at;
      const order =
        d.laneOrder ||
        [...DISCOVERY_SECTIONS].sort(
          (x, y) =>
            (latest[y] || 0) - (latest[x] || 0) ||
            DISCOVERY_SECTIONS.indexOf(x) - DISCOVERY_SECTIONS.indexOf(y),
        );
      // A lane as that lane's own read returns it, before the strip.
      const laneItems = (id) => {
        let items = (d.sections[id] || []).filter(
          (i) => !d.dismissals.some((x) => x.p_section === id && x.p_event === i.event_id),
        );
        if (inPersonOnly && (id === "online" || id === "curated")) items = [];
        return items.filter(keep);
      };
      // 1174: the lens's own events, the first 60 as its read returns them, leave every lane before
      // any floor applies.
      const leftOut = new Set(
        without
          ? laneItems(without)
              .slice(0, 60)
              .map((i) => i.event_id)
          : [],
      );
      const sections = [];
      for (const id of order) {
        if (lens !== "all" && lens !== id) continue;
        let items = laneItems(id)
          .filter((i) => !leftOut.has(i.event_id))
          .map(strip);
        // With a city chosen in Place, Near reads the place rather than a home (1095).
        if (id === "near" && cityName)
          items = items.map((i) => ({ ...i, reason: { kind: "near", place: { city: cityName } } }));
        // 1173: under a search the floors do not apply, so a lane holding any match shows and a lane
        // with no match drops. This mock holds no floors at all (its fixtures seed every lane at or
        // above its floor, and the narrowings the arms read were calibrated without them), so under
        // All it answers as the projection does under a search: a lane with an item left shows.
        if (lens === "all" && items.length === 0) continue;
        sections.push({ section: id, items });
      }
      return json({
        lens,
        lane_order: order,
        homes,
        follows: d.follows,
        subscriptions: d.subscriptions,
        suggest: lens === "all" || lens === "follow" ? d.suggest : null,
        sections,
      });
    }
    if (p === "/rest/v1/rpc/dismiss_discovery_item") {
      const b = req.postDataJSON() || {};
      if (!DISCOVERY_SECTIONS.includes(b.p_section))
        return json(
          { code: "22023", message: "That is not a section.", details: null, hint: null },
          400,
        );
      db.discovery.dismissals.push(b);
      return json(null, 204);
    }
    if (p === "/rest/v1/rpc/convene_places") return json(db.discovery.places);
    // Handoff 34-A (20260926170200): the going row's three first names per event, for the member
    // only; anon holds no execute grant, and more than 200 ids is the function's 22023.
    if (p === "/rest/v1/rpc/event_going_names") {
      const b = req.postDataJSON() || {};
      const ids = Array.isArray(b.p_events) ? b.p_events : [];
      const anon = !(req.headers()["authorization"] || "").includes(JWT);
      db.discovery.goingReads.push({ ids, anon });
      if (anon)
        return json(
          { code: "42501", message: "permission denied for function event_going_names" },
          401,
        );
      if (db.discovery.goingFail)
        return json(
          { code: "PGRST", message: "forced going-names failure", details: null, hint: null },
          500,
        );
      if (ids.length > 200)
        return json({ code: "22023", message: "At most 200 events at a time." }, 400);
      const out = {};
      for (const id of ids) if (db.discovery.goingNames[id]) out[id] = db.discovery.goingNames[id];
      return json(out);
    }
    // Handoff 34-A (20260926170100): the one writer of member_lane_activity, which refuses a lane or
    // an act it does not know with 22023.
    if (p === "/rest/v1/rpc/note_lane_act") {
      const b = req.postDataJSON() || {};
      if (!DISCOVERY_SECTIONS.includes(b.p_lane))
        return json(
          { code: "22023", message: "That is not a lane.", details: null, hint: null },
          400,
        );
      if (!["open", "save", "follow"].includes(b.p_act))
        return json(
          { code: "22023", message: "That is not an act.", details: null, hint: null },
          400,
        );
      db.discovery.laneActs.push({ p_lane: b.p_lane, p_act: b.p_act, at: Date.now() });
      return json(null, 204);
    }
    if (p === "/rest/v1/rpc/set_subscription") {
      const b = req.postDataJSON() || {};
      const d = db.discovery;
      d.subscriptionWrites.push(b);
      // The next projection answer carries the write, as member_subscriptions does.
      d.subscriptions = d.subscriptions.filter((x) => x.family !== b.p_family);
      if (b.p_on) {
        const f = VOCAB.convene_families.find((x) => x.value === b.p_family);
        d.subscriptions.push({ family: b.p_family, label: f ? f.label : b.p_family });
      }
      return json(null, 204);
    }
    // Handoff 55-A (1322, 1522): the two dots and the two marks, as the migrations answer them. The
    // dot is an unseen row of a kind the vocabulary renders; opening the panel marks every row seen.
    // ---------------------------------------------------------------------------------------------
    // Handoff 62-A: the reaction layer's six functions, as 20261015120100 shapes their answers.
    // The viewer is UID; a seeded reactor carries `person` and `network`. No figure reaches a
    // reader's answer; the author's answer carries the exact figures.
    // ---------------------------------------------------------------------------------------------
    const PUBLIC_KINDS = VOCAB.post_reaction_kinds
      .filter((k) => k.class === "public")
      .map((k) => k.value);
    const ME = { id: UID, name: "Thandiwe Dube", handle: "thandiwe-dube", avatar_path: null };
    const personOf = (r) =>
      r.member_id === UID ? { ...ME, you: true } : { ...r.person, you: false };
    const authorOf = (id) => (db.posts.find((x) => x.id === id) || {}).author_id;
    if (p === "/rest/v1/rpc/post_reaction_rows") {
      const b = req.postDataJSON() || {};
      const out = {};
      for (const id of b.p_posts || []) {
        const rx = db.reactions.filter((r) => r.post_id === id);
        const people = rx
          .filter((r) => r.member_id === UID || r.network)
          .sort((a, c) =>
            a.member_id === UID
              ? -1
              : c.member_id === UID
                ? 1
                : (c.created_at || "").localeCompare(a.created_at || ""),
          )
          .slice(0, 2);
        const own = rx.find((r) => r.member_id === UID);
        out[id] = {
          kinds: PUBLIC_KINDS.filter((k) => rx.some((r) => r.kind === k)),
          other: rx.some((r) => r.kind === "other"),
          people: people.map(personOf),
          more: rx.length > people.length,
          own: own ? { kind: own.kind, emoji: own.emoji || null } : null,
          intents: db.intents
            .filter((i) => i.post_id === id && i.member_id === UID)
            .map((i) => i.kind),
        };
      }
      return json(out);
    }
    if (p === "/rest/v1/rpc/post_react") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "post_react", body: b });
      if (db.reactDelayMs) await new Promise((r) => setTimeout(r, db.reactDelayMs));
      if (db.reactFail) {
        db.reactFail = false;
        return json({ code: "XX000", message: "forced failure", details: null, hint: null }, 500);
      }
      const held = db.reactions.find((r) => r.post_id === b.p_post && r.member_id === UID);
      const base = (e) => (e || "").replace(/\uFE0F/g, "");
      if (
        held &&
        held.kind === b.p_kind &&
        (b.p_kind !== "other" || base(held.emoji) === base(b.p_emoji))
      ) {
        db.reactions.splice(db.reactions.indexOf(held), 1);
        return json(null);
      }
      const row = {
        member_id: UID,
        post_id: b.p_post,
        kind: b.p_kind,
        emoji: b.p_kind === "other" ? b.p_emoji : null,
        created_at: new Date().toISOString(),
      };
      if (held) Object.assign(held, row);
      else db.reactions.push(row);
      if (b.p_picked && b.p_kind === "other") {
        db.picks = [b.p_emoji, ...db.picks.filter((e) => e !== b.p_emoji)].slice(0, 5);
      }
      return json({ kind: row.kind, emoji: row.emoji });
    }
    if (p === "/rest/v1/rpc/post_intent") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "post_intent", body: b });
      const at = db.intents.findIndex(
        (i) => i.post_id === b.p_post && i.member_id === UID && i.kind === b.p_kind,
      );
      if (b.p_on) {
        if (at < 0)
          db.intents.push({
            member_id: UID,
            post_id: b.p_post,
            kind: b.p_kind,
            line: b.p_line || null,
          });
        else if (b.p_line) db.intents[at].line = b.p_line;
      } else if (at >= 0) db.intents.splice(at, 1);
      return json(
        db.intents.filter((i) => i.post_id === b.p_post && i.member_id === UID).map((i) => i.kind),
      );
    }
    if (p === "/rest/v1/rpc/post_reactors_visible") {
      const b = req.postDataJSON() || {};
      const rows = db.reactions
        .filter((r) => r.post_id === b.p_post)
        .sort((a, c) => (a.member_id === UID ? -1 : c.member_id === UID ? 1 : 0))
        .map((r) => ({
          ...personOf(r),
          headline: r.member_id === UID ? null : r.person.headline || null,
          kind: r.kind,
          emoji: r.emoji || null,
          relationship:
            r.member_id === UID
              ? "self"
              : r.network
                ? "connected"
                : r.through
                  ? "through"
                  : "outside",
          through: r.through || null,
        }));
      return json(rows);
    }
    if (p === "/rest/v1/rpc/post_reactors_author") {
      const b = req.postDataJSON() || {};
      if (authorOf(b.p_post) !== UID)
        return json(
          {
            code: "42501",
            message: "post_reactors_author: not the author",
            details: null,
            hint: null,
          },
          403,
        );
      const rx = db.reactions.filter((r) => r.post_id === b.p_post);
      const ix = db.intents.filter((i) => i.post_id === b.p_post);
      const figures = {
        all: rx.length + ix.length,
        other: rx.filter((r) => r.kind === "other").length,
      };
      for (const k of VOCAB.post_reaction_kinds)
        figures[k.value] =
          rx.filter((r) => r.kind === k.value).length + ix.filter((i) => i.kind === k.value).length;
      const rowOf = (r, cls, line) => ({
        ...(r.member_id === UID || !r.person || r.person.withheld
          ? r.member_id === UID
            ? { ...ME, you: true, headline: null }
            : { id: null, name: null, handle: null, avatar_path: null, headline: null, you: false }
          : { ...r.person, you: false }),
        class: cls,
        kind: r.kind,
        emoji: r.emoji || null,
        line,
        relationship:
          r.member_id === UID
            ? "self"
            : r.person && !r.person.withheld
              ? r.network
                ? "connected"
                : "outside"
              : null,
        through: null,
      });
      return json({
        figures,
        rows: [
          ...rx.map((r) => rowOf(r, "reaction", null)),
          ...ix.map((i) => rowOf({ ...i, person: i.person }, "intent", i.line || null)),
        ],
      });
    }
    if (p === "/rest/v1/rpc/member_recent_reactions") return json(db.picks.slice(0, 5));
    // ---------------------------------------------------------------------------------------------
    // Handoff 62-G: the comment layer's eight functions, as 20261016120100 shapes their answers. The
    // viewer is UID; a seeded commenter carries `person`. A deleted comment answers as a tombstone;
    // no figure reaches a reader's answer.
    // ---------------------------------------------------------------------------------------------
    const commentSummary = (cid) => {
      const rx = db.commentReactions.filter((r) => r.comment_id === cid);
      const people = rx
        .filter((r) => r.member_id === UID || r.network)
        .sort((a, c) => (a.member_id === UID ? -1 : c.member_id === UID ? 1 : 0))
        .slice(0, 2);
      const own = rx.find((r) => r.member_id === UID);
      return {
        kinds: PUBLIC_KINDS.filter((k) => rx.some((r) => r.kind === k)),
        other: rx.some((r) => r.kind === "other"),
        people: people.map(personOf),
        more: rx.length > people.length,
        own: own ? { kind: own.kind, emoji: own.emoji || null } : null,
        intents: db.commentIntents
          .filter((i) => i.comment_id === cid && i.member_id === UID)
          .map((i) => i.kind),
      };
    };
    const commentJson = (c, withReplies) => {
      const deleted = !!c.deleted_at;
      const author = c.author_id === UID ? { ...ME } : c.person ? { ...c.person } : null;
      const out = {
        id: c.id,
        post_id: c.post_id,
        parent_id: c.parent_id || null,
        deleted,
        you: !deleted && c.author_id === UID,
        is_post_author: !deleted && authorOf(c.post_id) === c.author_id,
        author: deleted || (author && author.withheld) ? null : author,
        body: deleted ? null : c.body,
        media: deleted ? null : c.media || null,
        created_at: c.created_at,
        edited_at: c.edited_at || null,
        reactions: deleted ? null : commentSummary(c.id),
      };
      if (withReplies)
        out.replies = db.comments
          .filter((r) => r.parent_id === c.id && !r.deleted_at)
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map((r) => commentJson(r, false));
      return out;
    };
    if (p === "/rest/v1/rpc/post_comments") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "post_comments", body: b });
      const limit = b.p_limit || 20;
      let tops = db.comments
        .filter(
          (c) =>
            c.post_id === b.p_post &&
            !c.parent_id &&
            (!c.deleted_at || db.comments.some((r) => r.parent_id === c.id && !r.deleted_at)),
        )
        .sort((a, c) => a.created_at.localeCompare(c.created_at) || a.id.localeCompare(c.id));
      if (b.p_after)
        tops = tops.filter(
          (c) =>
            c.created_at > b.p_after || (c.created_at === b.p_after && c.id > (b.p_after_id || "")),
        );
      const page = tops.slice(0, limit);
      const last = page[page.length - 1];
      return json({
        comments: page.map((c) => commentJson(c, true)),
        more: tops.length > limit,
        next: tops.length > limit && last ? { created_at: last.created_at, id: last.id } : null,
      });
    }
    if (p === "/rest/v1/rpc/post_latest_comments") {
      const b = req.postDataJSON() || {};
      const out = {};
      for (const id of b.p_posts || []) {
        const newest = db.comments
          .filter((c) => c.post_id === id && !c.deleted_at)
          .sort((a, c) => c.created_at.localeCompare(a.created_at) || c.id.localeCompare(a.id))[0];
        if (newest) {
          const j = commentJson(newest, false);
          delete j.reactions;
          out[id] = j;
        }
      }
      return json(out);
    }
    if (p === "/rest/v1/rpc/comment_post") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "comment_post", body: b });
      const refuse = (m) => json({ code: "22023", message: m, details: null, hint: null }, 400);
      const body = (b.p_body || "").trim();
      if (!body && !b.p_media) return refuse("empty_comment");
      if (b.p_parent) {
        const parent = db.comments.find((c) => c.id === b.p_parent && c.post_id === b.p_post);
        if (!parent)
          return json(
            { code: "42501", message: "comment_write: no such comment", details: null, hint: null },
            403,
          );
        if (parent.parent_id) return refuse("reply_to_reply");
        if (parent.deleted_at) return refuse("comment_deleted");
      }
      if (db.commentFail) {
        db.commentFail = false;
        return json({ code: "XX000", message: "forced failure", details: null, hint: null }, 500);
      }
      const row = {
        id: "c-" + (db.comments.length + 1) + "-" + Math.random().toString(36).slice(2, 6),
        post_id: b.p_post,
        parent_id: b.p_parent || null,
        author_id: UID,
        body: body || null,
        media: b.p_media
          ? {
              id: b.p_media,
              storage_path: `${UID}/${b.p_post}/${b.p_media}.png`,
              width: 1200,
              height: 800,
              crop: null,
              focal_point: null,
            }
          : null,
        created_at: new Date().toISOString(),
      };
      db.comments.push(row);
      const j = commentJson(row, !row.parent_id);
      return json(j);
    }
    if (p === "/rest/v1/rpc/comment_react") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "comment_react", body: b });
      if (db.commentReactDelayMs) await new Promise((r) => setTimeout(r, db.commentReactDelayMs));
      if (db.reactFail) {
        db.reactFail = false;
        return json({ code: "XX000", message: "forced failure", details: null, hint: null }, 500);
      }
      const held = db.commentReactions.find(
        (r) => r.comment_id === b.p_comment && r.member_id === UID,
      );
      const base = (e) => (e || "").replace(/\uFE0F/g, "");
      if (
        held &&
        held.kind === b.p_kind &&
        (b.p_kind !== "other" || base(held.emoji) === base(b.p_emoji))
      ) {
        db.commentReactions.splice(db.commentReactions.indexOf(held), 1);
        return json(null);
      }
      const row = {
        member_id: UID,
        comment_id: b.p_comment,
        kind: b.p_kind,
        emoji: b.p_kind === "other" ? b.p_emoji : null,
        created_at: new Date().toISOString(),
      };
      if (held) Object.assign(held, row);
      else db.commentReactions.push(row);
      if (b.p_picked && b.p_kind === "other")
        db.picks = [b.p_emoji, ...db.picks.filter((e) => e !== b.p_emoji)].slice(0, 5);
      return json({ kind: row.kind, emoji: row.emoji });
    }
    if (p === "/rest/v1/rpc/comment_intent") {
      const b = req.postDataJSON() || {};
      db.rpcPayloads.push({ fn: "comment_intent", body: b });
      const at = db.commentIntents.findIndex(
        (i) => i.comment_id === b.p_comment && i.member_id === UID && i.kind === b.p_kind,
      );
      if (b.p_on) {
        if (at < 0)
          db.commentIntents.push({
            member_id: UID,
            comment_id: b.p_comment,
            kind: b.p_kind,
            line: b.p_line || null,
          });
        else if (b.p_line) db.commentIntents[at].line = b.p_line;
      } else if (at >= 0) db.commentIntents.splice(at, 1);
      return json(
        db.commentIntents
          .filter((i) => i.comment_id === b.p_comment && i.member_id === UID)
          .map((i) => i.kind),
      );
    }
    if (p === "/rest/v1/rpc/comment_reaction_rows") {
      const b = req.postDataJSON() || {};
      const out = {};
      for (const id of b.p_comments || []) out[id] = commentSummary(id);
      return json(out);
    }
    if (p === "/rest/v1/rpc/comment_reactors_visible") {
      const b = req.postDataJSON() || {};
      return json(
        db.commentReactions
          .filter((r) => r.comment_id === b.p_comment)
          .sort((a, c) => (a.member_id === UID ? -1 : c.member_id === UID ? 1 : 0))
          .map((r) => ({
            ...personOf(r),
            headline: r.member_id === UID ? null : (r.person && r.person.headline) || null,
            kind: r.kind,
            emoji: r.emoji || null,
            relationship: r.member_id === UID ? "self" : r.network ? "connected" : "outside",
            through: null,
          })),
      );
    }
    if (p === "/rest/v1/rpc/comment_reactors_author") {
      const b = req.postDataJSON() || {};
      const c = db.comments.find((x) => x.id === b.p_comment);
      if (!c || c.author_id !== UID)
        return json(
          {
            code: "42501",
            message: "comment_reactors_author: not the author",
            details: null,
            hint: null,
          },
          403,
        );
      const rx = db.commentReactions.filter((r) => r.comment_id === b.p_comment);
      const ix = db.commentIntents.filter((i) => i.comment_id === b.p_comment);
      const figures = {
        all: rx.length + ix.length,
        other: rx.filter((r) => r.kind === "other").length,
      };
      for (const k of VOCAB.post_reaction_kinds)
        figures[k.value] =
          rx.filter((r) => r.kind === k.value).length + ix.filter((i) => i.kind === k.value).length;
      const rowOf = (r, cls, line) => ({
        ...(r.member_id === UID
          ? { ...ME, you: true, headline: null }
          : { ...r.person, you: false }),
        class: cls,
        kind: r.kind,
        emoji: r.emoji || null,
        line,
        relationship: r.member_id === UID ? "self" : r.network ? "connected" : "outside",
        through: null,
      });
      return json({
        figures,
        rows: [
          ...rx.map((r) => rowOf(r, "reaction", null)),
          ...ix.map((i) => rowOf(i, "intent", i.line || null)),
        ],
      });
    }
    if (p === "/rest/v1/rpc/notifications_dot") {
      const renders = new Set(
        VOCAB.notification_kinds.filter((k) => k.renders).map((k) => k.value),
      );
      return json(db.notifications.some((n) => !n.seen_at && renders.has(n.kind)));
    }
    if (p === "/rest/v1/rpc/notifications_mark_seen") {
      const at = new Date().toISOString();
      db.notifications.forEach((n) => {
        if (!n.seen_at) n.seen_at = at;
      });
      return json(null, 204);
    }
    // Handoff 60-NC (1556, 1553, 1552): Mark all read, the email view's read and a row's save, as
    // the migrations answer them; a forced failure answers as PostgREST does.
    if (p === "/rest/v1/rpc/notifications_mark_all_read") {
      db.notify.markAll++;
      await new Promise((r) => setTimeout(r, 150));
      if (db.notify.failMarkAll)
        return json({ code: "XX000", message: "forced failure", details: null, hint: null }, 500);
      const at = new Date().toISOString();
      db.notifications.forEach((n) => {
        if (!n.read_at) n.read_at = at;
      });
      return json(null, 204);
    }
    if (p === "/rest/v1/rpc/notification_email_view") return json(db.notify.view);
    if (p === "/rest/v1/rpc/set_notification_preference") {
      const b = req.postDataJSON() || {};
      await new Promise((r) => setTimeout(r, 150));
      if (db.notify.failSave)
        return json({ code: "XX000", message: "forced failure", details: null, hint: null }, 500);
      if (!VOCAB.notification_email_modes.some((m) => m.value === b.p_mode))
        return json({ code: "22023", message: "refused", details: null, hint: null }, 400);
      db.notify.saves.push(b);
      const row = db.notify.view.find((v) => v.c === b.p_c);
      if (row) row.mode = b.p_mode;
      return json(null, 204);
    }
    if (p === "/rest/v1/rpc/connect_requests_pending") return json(db.connect.pending === true);
    if (p === "/rest/v1/rpc/mark_surface_seen") {
      const b = req.postDataJSON() || {};
      db.connect.surfaceSeen.push(b.p_surface);
      if (b.p_surface === "my_network") db.connect.pending = false;
      return json(null, 204);
    }
    if (p === "/rest/v1/rpc/vocabularies")
      return db.failVocab
        ? json(
            { code: "PGRST", message: "forced vocabulary failure", details: null, hint: null },
            500,
          )
        : db.notify.emptyEmailVocab
          ? json({ ...VOCAB, notification_email_modes: [], notification_categories: [] })
          : json(VOCAB);
    if (p === "/rest/v1/rpc/public_attestations") return json(ATTESTATIONS);
    if (p === "/rest/v1/rpc/save_profile_section") {
      const body = req.postDataJSON() || {};
      const pr = db.profile;
      await new Promise((r) => setTimeout(r, 200));
      // Every attempt, answered or refused, so a flow can wait on the round trip.
      pr.attempts.push(body.section);
      if (pr.failSection && body.section === pr.failSection)
        return json(
          { code: "P0001", message: "That did not save.", details: null, hint: null },
          400,
        );
      pr.saves.push(body.section);
      if (body.section === "switches") {
        if (typeof body.payload.private === "boolean") pr.switches.private = body.payload.private;
        if (typeof body.payload.shared === "boolean") pr.switches.shared = body.payload.shared;
      } else if (body.section === "visibility")
        pr.visibility[body.payload.section] = body.payload.audience;
      else pr.overrides[body.section] = body.payload;
      return json(null, 204);
    }
    // Brief 14 (handoff 41-C): the Messenger's projections and wrappers (tests/messenger-mock.cjs).
    if (
      await require("./messenger-mock.cjs").handleMessenger({
        p,
        method,
        url,
        req,
        json: (b, st) => json(b, st).then(() => true),
        db,
      })
    )
      return;
    if (p.startsWith("/rest/v1/")) {
      const table = p.slice("/rest/v1/".length);
      const inIds = (param) => {
        const v = url.searchParams.get(param);
        if (!v) return null;
        const m = v.match(/^in\.\((.*)\)$/);
        return m ? m[1].split(",").map((s) => s.replace(/^"|"$/g, "")) : null;
      };
      if (table === "post_drafts") {
        (db.log = db.log || []).push(
          method + " " + p + url.search + " accept=" + (req.headers()["accept"] || ""),
        );
        if (method === "GET") {
          const d = db.drafts.get(url.searchParams.get("host_context")?.replace("eq.", ""));
          const single = (req.headers()["accept"] || "").includes("object");
          if (single)
            return d
              ? json({ payload: d })
              : json({ code: "PGRST116", details: "0 rows", hint: null, message: "no rows" }, 406);
          return json(d ? [{ payload: d }] : []);
        }
        if (method === "POST") {
          const b = req.postDataJSON();
          const row = Array.isArray(b) ? b[0] : b;
          db.drafts.set(row.host_context, row.payload);
          return json([row], 201);
        }
        if (method === "DELETE") {
          db.drafts.delete(url.searchParams.get("host_context")?.replace("eq.", ""));
          return json([], 200);
        }
      }
      const eqOf = (param) => url.searchParams.get(param)?.replace(/^eq\./, "") ?? null;
      const single = (req.headers()["accept"] || "").includes("object");
      const one = (rows) =>
        rows[0]
          ? json(rows[0])
          : json({ code: "PGRST116", details: "0 rows", hint: null, message: "no rows" }, 406);
      if (table === "feed") {
        let rows = db.posts.filter((p) => p.status === "published");
        const ids = inIds("id");
        if (ids) rows = rows.filter((p) => ids.includes(p.id));
        // Only an `eq.` filter is one id: `loadPostsByIds` (Brief 9's hydration) sends `in.(...)`,
        // which eqOf would otherwise hand back whole and match against no row.
        const id = ids ? null : eqOf("id");
        if (id) rows = rows.filter((p) => p.id === id);
        const or = url.searchParams.get("or") || "";
        if (or.includes("created_by")) rows = rows.filter((p) => p.author_id === UID);
        else if (or.includes("author_kind"))
          rows = rows.filter((p) => or.includes('"' + p.author_id + '"'));
        return single ? one(rows) : json(rows);
      }
      if (table === "message_reaction_emoji") {
        // 62-A: the recents' names, read by character.
        const ids = inIds("emoji") || [];
        return json(
          ids.filter((e) => EMOJI_LABELS[e]).map((e) => ({ emoji: e, label: EMOJI_LABELS[e] })),
        );
      }
      if (table === "post_reactions" && (method === "POST" || method === "DELETE")) {
        // 62-A (415's shape): authenticated holds no insert or delete grant; post_react is the path.
        db.directReactionWrites = (db.directReactionWrites || 0) + 1;
        return json({ code: "42501", message: "permission denied for table post_reactions" }, 403);
      }
      if (table === "post_saves" || table === "post_reactions") {
        const list = table === "post_saves" ? db.saves : db.reactions;
        if (method === "POST") {
          const b = req.postDataJSON();
          const row = Array.isArray(b) ? b[0] : b;
          list.push({ ...row, created_at: new Date().toISOString() });
          return json([row], 201);
        }
        if (method === "DELETE") {
          const pid = eqOf("post_id");
          const keep = list.filter((r) => r.post_id !== pid);
          list.length = 0;
          list.push(...keep);
          return json([], 200);
        }
        const ids = inIds("post_id");
        return json(list.filter((r) => !ids || ids.includes(r.post_id)));
      }
      if (table === "comments") {
        const ids = inIds("id");
        return json(
          db.comments
            .filter((c) => !ids || ids.includes(c.id))
            .map((c) => ({ id: c.id, body: c.body, post_id: c.post_id })),
        );
      }
      if (table === "notifications") {
        if (method === "PATCH") {
          const id = eqOf("id");
          db.reads.push(id);
          db.notifications.forEach((n) => {
            if (n.id === id) n.read_at = new Date().toISOString();
          });
          return json([], 204);
        }
        let rows = db.notifications.slice();
        if (url.searchParams.get("read_at") === "is.null") rows = rows.filter((n) => !n.read_at);
        return json(rows);
      }
      if (table === "members") {
        // Handoff 55-A: an arm that names members by id seeds db.membersById, and a read of those
        // ids answers their rows; every other read keeps the one fixed row.
        const byId = inIds("id");
        if (byId && db.membersById && byId.some((id) => db.membersById[id]))
          return json(byId.map((id) => db.membersById[id]).filter(Boolean));
        const row = { handle: "amara-osei", name: "Amara Osei" };
        return single ? json(row) : json([row]);
      }
      // Brief 4A: block and unblock are a plain insert and delete on member_blocks under the
      // blocker's own RLS (src/lib/blocks.ts). The live trigger revokes the relationship; here the
      // projection mode carries the same consequence, so the surface re-reads the state it will
      // read live.
      if (table === "member_blocks") {
        // Handoff 61-S1: the drawer's Blocked members list, the blocker's own rows with the blocked
        // member's core embedded through member_blocks_blocked_id_fkey (tests/account.cjs).
        if (method === "GET" && (url.searchParams.get("select") || "").includes("members")) {
          if (db.account.blockedFail) return json({ code: "P0001", message: "blocked" }, 400);
          return json(db.account.blocked);
        }
        if (method === "DELETE") {
          const bid = (url.searchParams.get("blocked_id") || "").replace(/^eq\./, "");
          db.account.unblockCalls.push(bid);
          if (db.account.unblockFail)
            return json({ code: "P0001", message: "That did not save." }, 400);
          db.account.blocked = db.account.blocked.filter((b) => b.blocked_id !== bid);
        }
        if (method === "POST") {
          db.profile.blocks.push("block");
          db.profile.mode = "blocker";
          db.profile.rel = "none";
          return json([], 201);
        }
        if (method === "DELETE") {
          db.profile.blocks.push("unblock");
          // Ruling 211: unblocking restores nothing. The pair comes back as strangers.
          db.profile.mode = "stranger";
          db.profile.rel = "none";
          db.profile.following = false;
          return json([], 200);
        }
        return json([]);
      }
      if (table === "member_follows") {
        if (method === "POST") {
          db.profile.following = true;
          db.profile.follows.push("on");
          return json([], 201);
        }
        if (method === "DELETE") {
          db.profile.following = false;
          db.profile.follows.push("off");
          return json([], 200);
        }
        return json([]);
      }
      if (
        table === "connection_requests" &&
        method === "GET" &&
        url.searchParams.has("from_member_id")
      ) {
        const pending = db.profile.rel === "sent" || db.profile.rel === "received";
        return single
          ? pending
            ? json({ id: "cr1" })
            : json(null)
          : json(pending ? [{ id: "cr1" }] : []);
      }
      if (table === "connection_requests" && method !== "GET") {
        db.profile.requests.push(method);
        if (method === "POST") db.profile.rel = "sent";
        if (method === "DELETE") db.profile.rel = "none";
        if (method === "PATCH") {
          const b = req.postDataJSON() || {};
          db.profile.rel = b.status === "accepted" ? "connected" : "none";
        }
        return json([], method === "POST" ? 201 : 200);
      }
      if (table === "member_homes") return json(db.homes);
      // Handoff 32-B: Add to calendar is offered only for an event the member is going to (1097).
      if (table === "event_registrations" && method === "GET") {
        const ids = inIds("event_id");
        return json(
          db.discovery.going
            .filter((e) => !ids || ids.includes(e))
            .map((event_id) => ({ event_id })),
        );
      }
      // Addendum 1 (1111): the member's own rail rows, read per surface and band, upserted on toggle.
      if (table === "member_rail_state") {
        const d = db.discovery;
        if (method === "POST") {
          const b = req.postDataJSON();
          const row = Array.isArray(b) ? b[0] : b;
          d.railWrites.push(row);
          d.rail = d.rail.filter(
            (r) => !(r.surface === row.surface && r.width_band === row.width_band),
          );
          d.rail.push({
            surface: row.surface,
            width_band: row.width_band,
            collapsed: row.collapsed,
          });
          return json([], 201);
        }
        const surface = eqOf("surface");
        const band = eqOf("width_band");
        return json(
          d.rail
            .filter((r) => (!surface || r.surface === surface) && (!band || r.width_band === band))
            .map((r) => ({ collapsed: r.collapsed })),
        );
      }
      if (table === "event_parties") {
        const ids = inIds("id");
        return json(db.attend.parties.filter((r) => !ids || ids.includes(r.id)));
      }
      if (table === "event_delivery") {
        const ids = inIds("event_id");
        // The meeting_link row is host-only under RLS; the mock member is the host of what they
        // publish and a viewer of the seeded rows, so seeded meeting links stay out.
        return json(
          db.event_delivery.filter(
            (d) => (!ids || ids.includes(d.event_id)) && (d.kind !== "meeting_link" || d.mine),
          ),
        );
      }
      if (table === "member_connections") return json([]);
      if (table === "space_roles") return json([{ space_id: "s1" }]);
      if (table === "spaces") {
        const ids = inIds("id");
        return json(ids ? db.spaces.filter((s) => ids.includes(s.id)) : db.spaces);
      }
      if (table === "posts") return json(db.posts);
      if (table === "post_media") {
        const ids = inIds("post_id");
        return json(db.post_media.filter((m) => !ids || ids.includes(m.post_id)));
      }
      if (table === "post_links") {
        const ids = inIds("post_id");
        return json(db.post_links.filter((m) => !ids || ids.includes(m.post_id)));
      }
      for (const t of ["events", "opportunities", "connection_requests", "stories"])
        if (table === t) {
          const ids = inIds("id");
          if (!ids && url.searchParams.has("starts_at")) return json([]);
          if (!ids && t === "connection_requests") return json([]);
          return json(db[t].filter((r) => !ids || ids.includes(r.id)));
        }
      return json([]);
    }
    return json(null, 404);
  });
}

// CHROME_PATH points Chromium at a preinstalled binary (sandboxes without a Playwright download).
//
// RULING200_PROBE is a diagnostic switch for ruling 200, off unless set, and it changes no pass
// criterion: it injects one stylesheet into every context the run opens so a dispatched matrix run
// can be compared against an identical run without it. `appearance` takes every form control off
// the engine's native form-control paint path, which is the surviving suspect in docs/GAPS.md G5;
// `color-scheme` forces the light branch of that path. Anything else is ignored.
const PROBE_CSS = {
  appearance:
    "select, input, textarea, button, ::-webkit-inner-spin-button, ::-webkit-search-decoration" +
    " { appearance: none !important; -webkit-appearance: none !important; }",
  "color-scheme": "*, *::before, *::after { color-scheme: light !important; }",
};

async function launch(browserType) {
  const opts =
    browserType === chromium && process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {};
  // `compositing` is not a stylesheet: the core from run 17 (34322686504) is a SIGSEGV in the
  // WPEWebProcess thread named ThreadedCompositor, so the probe that matches the evidence turns
  // accelerated compositing off in the engine rather than restyling the page.
  if (process.env.RULING200_PROBE === "compositing")
    opts.env = { ...process.env, WEBKIT_DISABLE_COMPOSITING_MODE: "1" };
  const browser = await browserType.launch(opts);
  const css = PROBE_CSS[process.env.RULING200_PROBE];
  if (css) {
    const probeContext = browser.newContext.bind(browser);
    browser.newContext = async (o) => {
      const ctx = await probeContext(o);
      await ctx.addInitScript((text) => {
        const add = () => {
          const s = document.createElement("style");
          s.setAttribute("data-ruling-200-probe", "");
          s.textContent = text;
          document.documentElement.appendChild(s);
        };
        if (document.documentElement) add();
        else document.addEventListener("readystatechange", add, { once: true });
      }, css);
      return ctx;
    };
  }
  // Ruling 316. Wrapped last, so it also covers the context the probe hands back. Every page in
  // every flow is created on a context from here, so the listener cannot be forgotten by a flow
  // that exists now or one written later, which is the gap the ruling names.
  const outerContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const ctx = await outerContext(o);
    ctx.on("page", (page) => watchCrash(page, browser));
    return ctx;
  };
  // Ruling 830. `page.on("crash")` fires for a lost web process and says nothing about the browser
  // process, and Playwright's own error cannot tell them apart either: it reads "Target page,
  // context or browser has been closed" whichever went. Ruling 828's census could not answer which
  // died on any of its seventeen sightings, because nothing ever asked.
  //
  // Measured against Chromium at `chrome://crash` before this was written, because a listener whose
  // behaviour is assumed is the thing ruling 828 spent a day undoing: on a lost web process `crash`
  // fires with `isConnected()` still true, and `disconnected` does not fire at all. So the two
  // together separate the cases that Playwright's one error message conflates. The same probe is why
  // `closing` exists: `disconnected` fires on every ordinary `browser.close()` too, which without
  // the flag would print this line once per arm, two hundred times a job, each one reading as an
  // event when it is a teardown. A signal that fires on the ordinary path is not a signal.
  let closing = false;
  const outerClose = browser.close.bind(browser);
  browser.close = async (...args) => {
    closing = true;
    await failureState(browser);
    return outerClose(...args);
  };
  browser.on("disconnected", () => {
    if (closing) return;
    console.log("BROWSER DISCONNECTED |", openArm ? openArm.arm : "(no arm open)");
  });
  return browser;
}

/**
 * Handoff 37-F: what the page held when an arm failed, as text in the log, because a flow's catch
 * records only the error and the artefact's screenshots are not readable everywhere the log is.
 * Runs once per arm from `launch()`'s close wrapper, before the browser goes: when the open arm has
 * a failed check, every page it still has open prints one `FAILSTATE` line (its URL, the focused
 * element, the open dialogs, the test ids present) and writes a screenshot under OUT. Diagnostic:
 * it changes no check and its own failure is swallowed.
 */
async function failureState(browser) {
  const arm = openArm;
  if (!arm || arm.stated) return;
  if (!results.slice(arm.from).some((r) => r.ok === false)) return;
  arm.stated = true;
  let n = 0;
  for (const page of arm.pages) {
    if (page.isClosed()) continue;
    n += 1;
    const file = path.join(OUT, `failstate-${arm.arm.replace(/[^\w.-]+/g, "_")}-${n}.png`);
    try {
      const state = await page.evaluate(() => {
        const a = document.activeElement;
        const id = (el) =>
          el?.getAttribute?.("data-testid") || el?.getAttribute?.("aria-label") || "";
        const ids = [...document.querySelectorAll("[data-testid]")].map((el) =>
          el.getAttribute("data-testid"),
        );
        return {
          active: a ? `${a.tagName.toLowerCase()}${id(a) ? `[${id(a)}]` : ""}` : "none",
          dialogs: [...document.querySelectorAll("dialog[open]")].map(
            (d) => d.querySelector('[role="dialog"]')?.getAttribute("aria-label") || "(unlabelled)",
          ),
          pane: !!document.querySelector("[data-pane], [data-pane-share]"),
          ids: [...new Set(ids)].slice(0, 40),
        };
      });
      console.log(
        `FAILSTATE ${arm.arm} | ${page.url()} | active ${state.active} | dialogs ${JSON.stringify(state.dialogs)} | pane ${state.pane} | testids ${state.ids.join(",")}`,
      );
      await page.screenshot({ path: file, timeout: 5000 });
      console.log(`FAILSTATE ${arm.arm} | screenshot ${path.relative(OUT, file)}`);
    } catch (e) {
      console.log(`FAILSTATE ${arm.arm} | not read: ${String(e).slice(0, 160)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Arms, the crash flag (ruling 316) and the declared count (ruling 317).
//
// An arm is one flow at one engine, viewport and theme: the unit ruling 317 says is comparable
// between runs, and the unit ruling 316's flag has to be attached to. Flows run strictly one after
// another, so one module-level cursor is the whole bookkeeping. `armStart(tag)` opens an arm and
// closes the one before it; every check `record()` emits until the next `armStart` belongs to it.
//
// The crash listener is registered in `launch()` rather than two lines into each flow, because the
// defect ruling 316 names is a flow that never registered one. Every page every flow opens comes
// from `launch()`, so no flow can forget and a flow written later inherits it.
// ---------------------------------------------------------------------------
const results = [];
const armLog = [];
const crashSightings = [];
/**
 * Ruling 916: the lens bar's rendered mode, per viewport, on the run that is cited. It used to live
 * only in the `lensFit` check's detail string, and `record()` prints a detail when the check fails
 * and never when it passes, so the one run whose reading anyone wants to quote — a green one — was
 * the one run that said nothing. The 820 reading is the standing instance, because that is the tier
 * whose icon-first boundary G37 leaves open. This is a record and not an assertion (ruling 930): it
 * states what the bar did and fails nothing, and the check beside it is what judges.
 */
const lensModes = [];
let openArm = null;
/** Ruling 830: the zero the per-arm progress line counts from. */
const runStart = Date.now();

/** The tier ruling 61's matrix is read in. Widths are the app's own breakpoints. */
function tierOf(name) {
  const m = /(\d+)x(\d+)/.exec(name || "");
  if (!m) return "unsized";
  const w = Number(m[1]);
  return w < 640 ? "compact" : w > 1024 ? "expanded" : "medium";
}

function armStart(tag) {
  armClose();
  // Ruling 1237: `attempt` is 2 while `drive()` is running this arm again after a lost web process.
  const attempt = retryOf === tag ? 2 : 1;
  openArm = { arm: tag, from: results.length, crashed: false, pages: new Set(), attempt };
  // Ruling 830: `record()` prints nothing for a passing check, so a job's log held no timeline at
  // all and ruling 828's census had to place each crash by step timestamps and infer how far the
  // run had got. One line per arm makes that readable: the checks emitted so far, the seconds since
  // the run began, and the arm about to run. Two hundred lines a job, against a log of thousands.
  const at = Math.round((Date.now() - runStart) / 1000);
  console.log(
    `ARM ${String(results.length).padStart(5)} +${at}s ${tag}` +
      (attempt === 2 ? " (retry after a lost web process, ruling 1237)" : ""),
  );
  return tag;
}

function armClose() {
  if (!openArm) return;
  armLog.push({
    arm: openArm.arm,
    tier: tierOf(openArm.arm),
    emitted: results.length - openArm.from,
    crashed: openArm.crashed,
  });
  openArm = null;
}

/**
 * Ruling 316. Registered on every page `launch()` produces. The flag is sticky for the rest of the
 * arm: once the web process is gone every check behind it fails for that reason and no other, which
 * is exactly the distinction the suite could not previously draw.
 */
function watchCrash(page, browser) {
  // Pinned here rather than read when the event fires: the page belongs to the arm that opened it,
  // and a crash reported during teardown must not be charged to whichever arm opened next.
  const owner = openArm;
  if (owner) owner.pages.add(page);
  // Ruling 1237's harness probe, off unless CRASH_PROBE names an arm tag. It navigates that arm's
  // page to chrome://crash once the page has loaded, on Chromium, where ruling 830 measured `crash`
  // firing; on WebKit no such URL exists and the probe says so and does nothing. Attempt 1 alone by
  // default, so a green job shows one crashed attempt and one clean retry; CRASH_PROBE_ATTEMPTS=2
  // crashes the retry as well, which must fail the job. A probe, never a pass criterion, and a
  // one-off proof that stays out of the permanent suite (37-F guardrail 5).
  if (owner && process.env.CRASH_PROBE === owner.arm) {
    const attempts = Number(process.env.CRASH_PROBE_ATTEMPTS || 1);
    if (owner.attempt <= attempts) {
      page.once("load", () => {
        if (page.context().browser()?.browserType().name() !== "chromium") {
          console.log(
            `CRASH_PROBE | ${owner.arm} | the probe crashes a page at chrome://crash, which only Chromium serves; nothing injected`,
          );
          return;
        }
        console.log(
          `CRASH_PROBE | ${owner.arm} | attempt ${owner.attempt}: navigating the page to chrome://crash`,
        );
        page.goto("chrome://crash").catch(() => {});
      });
    }
  }
  page.on("crash", () => {
    const on = owner || openArm;
    const arm = on ? on.arm : "(no arm open)";
    if (on) on.crashed = true;
    // Ruling 830. Read here and not later: by the time a flow's catch runs, teardown has closed the
    // context and the answer is gone. `null` where no browser was handed in, never a guess.
    const alive = browser ? browser.isConnected() : null;
    crashSightings.push({
      arm,
      tier: tierOf(arm),
      attempt: on ? on.attempt : null,
      at: new Date().toISOString(),
      secondsIn: Math.round((Date.now() - runStart) / 1000),
      browserConnected: alive,
    });
    console.log(
      "WEB PROCESS CRASHED |",
      arm,
      "| browser",
      alive === null ? "unknown" : alive ? "still connected" : "gone with it",
    );
  });
  return page;
}

/** Whether the arm currently open has lost a web process. */
function armCrashed() {
  return !!(openArm && openArm.crashed);
}

/**
 * Ruling 228, per check: a check the run could not prove is reported as UNPROVEN, never as PASS,
 * and is counted apart from the passing count. `ok` is null so nothing reads it as a failure and
 * nothing folds it into a pass; the arm still emits it, so ruling 292's declaration is unchanged.
 * Handoff 30-D item 11.3 (ruling 1036) is the first caller: the Event hook's tap that did not
 * navigate and was followed by its href.
 */
function unproven(name, why, arm = openArm ? openArm.arm : null) {
  results.push({ name, ok: null, detail: why, arm, crashed: armCrashed(), unproven: true });
  console.log("UNPROVEN", name, why);
  if (process.env.DUMP_LABELS) console.log("LABEL", openArm ? openArm.arm : "-", "::", name);
}

function record(name, ok, detail = "", crashed = armCrashed(), arm = openArm ? openArm.arm : null) {
  // `arm` is explicit only for ruling 292's own per-arm accounting, which runs after the last arm
  // has closed and so has no open arm to read. Ruling 1237 needs those records attributed, because a
  // crashed arm's accounting failure is the crashed arm's and not a failure elsewhere in the job.
  results.push({ name, ok, detail, arm, crashed });
  // Ruling 316: every failure carries the flag or its absence, in the line a reader sees first.
  if (!ok) console.log("FAIL", crashed ? "[CRASH]" : "[no crash]", name, detail);
  // Ruling 292 asks for a changed count to be explained by name, and EXPECT=write only ever gives
  // the number. DUMP_LABELS=1 prints every check as it is emitted, so two arms can be diffed
  // label by label and the delta named rather than guessed at.
  if (process.env.DUMP_LABELS) console.log("LABEL", openArm ? openArm.arm : "-", "::", name);
}
// ---------------------------------------------------------------------------
// Ruling 1237 (amending 832): an arm that loses its web process is run again once, alone, in a
// fresh browser, and a second crash fails the run.
//
// G5 is a Linux WPE compositor defect that Safari does not run (1234), at a rate no branch owns
// (828). Ruling 832 stood a job down on one crashed arm, which left that arm unproven on a green
// job; 1237 replaces the stand-down with one retry, so the arm is either proven on its second
// attempt or the job is red. It lives here, in one place, and every arm the suite runs goes through
// it: the main loop below calls each arm through `drive(fn, ...args)`, and the three group runners
// (tests/profile.cjs `runProfile`, tests/mount.cjs `runMount`, tests/sheet.cjs `runSheets`) call
// their own arms through it, so no arm's body knows the retry exists.
//
// An arm is one `armStart`. `drive` reads the arms `fn` opened from the arm log after `fn` returns:
// when exactly one arm opened and it lost a web process, the first attempt's checks leave the
// counted results and are kept in `retriedArms` for the tail and the job summary, its arm-log entry
// is dropped, and `fn` runs again with the same arguments. Every arm launches its own browser from
// `launch()`, so the retry's browser is fresh by construction. The retry's checks are the arm's
// result and are enforced against its declared count like any other arm's (292); a crash on the
// retry stays in the arm log and fails the run, and so does any failed check on the retry, because
// nothing here removes a failure. When `fn` opened more than one arm the crashed arm cannot be run
// alone, and `drive` records a failure that says so rather than retrying the group.
//
// Guardrail 3 of handoff 37-F, in code: the first attempt is printed by name with its crash and its
// checks; a retry that fails for any reason fails the run; and nothing crashed is ever counted as
// passed (228), because a crashed attempt is either replaced by a clean retry or left in the log
// as a crash.
// ---------------------------------------------------------------------------
/** Ruling 1237: every arm that was retried, each with its first attempt's checks and its retry's outcome. */
const retriedArms = [];
/** The arm tag `drive` is currently running again, so `armStart` can mark the attempt. */
let retryOf = null;
/** Depth guard: an arm driven from inside another `drive` (a group runner) runs plainly. */
let driving = 0;

async function drive(fn, ...args) {
  if (driving) return fn(...args);
  driving += 1;
  try {
    const from = results.length;
    const armsFrom = armLog.length;
    const sightingsFrom = crashSightings.length;
    let threw = null;
    try {
      await fn(...args);
    } catch (e) {
      threw = e;
    }
    armClose();
    const arms = armLog.slice(armsFrom);
    const crashed = arms.filter((a) => a.crashed);
    if (!crashed.length) {
      if (threw) throw threw;
      return;
    }
    if (arms.length !== 1) {
      record(
        `ruling 1237 | ${crashed.map((a) => a.arm).join(", ")}: retried alone after a lost web process`,
        false,
        `${fn.name || "the runner"} opened ${arms.length} arms in one call (${arms.map((a) => a.arm).join(", ")}), so the crashed arm could not be run again alone; the crash stands`,
        true,
        crashed[0].arm,
      );
      if (threw) throw threw;
      return;
    }
    const arm = arms[0].arm;
    const first = {
      arm,
      crash: crashSightings.slice(sightingsFrom),
      emitted: arms[0].emitted,
      threw: threw ? String(threw).slice(0, 300) : null,
      checks: results.splice(from).map((r) => ({
        name: r.name,
        state: r.unproven ? "UNPROVEN" : r.ok ? "PASS" : "FAIL",
        // One line per check in the tail, so a Playwright call log cannot break the block apart.
        detail: String(r.detail || "")
          .replace(/\s*\n\s*/g, " | ")
          .slice(0, 300),
      })),
      retry: null,
    };
    armLog.splice(armsFrom);
    retriedArms.push(first);
    console.log(
      `RETRY ${arm} | lost a web process on attempt 1 after ${first.emitted} checks; ` +
        "running it again once, alone, in a fresh browser (ruling 1237)",
    );
    retryOf = arm;
    let threwAgain = null;
    try {
      await fn(...args);
    } catch (e) {
      threwAgain = e;
    } finally {
      retryOf = null;
    }
    armClose();
    const again = armLog.slice(armsFrom);
    first.retry = {
      crashed: again.some((a) => a.crashed),
      failed: results.slice(from).filter((r) => r.ok === false).length,
      emitted: again.reduce((n, a) => n + a.emitted, 0),
      threw: threwAgain ? String(threwAgain).slice(0, 300) : null,
    };
    console.log(
      `RETRY ${arm} | attempt 2 ${first.retry.crashed ? "LOST A WEB PROCESS AS WELL; the run fails" : first.retry.failed ? `failed ${first.retry.failed} check(s); the run fails` : "ran clean"} (ruling 1237)`,
    );
    if (threwAgain) throw threwAgain;
  } finally {
    driving -= 1;
  }
}

// ---------------------------------------------------------------------------
// Ruling 317: the suite declares what each arm emits, or the count is not evidence.
//
// tests/expected-counts.json is that declaration, generated by EXPECT=write and committed. Nothing
// infers it at run time: a number derived from the run it is checking cannot detect that run being
// short. Enforcement is per arm and never per run, because a crashed flow abandons the checks
// behind it, and an arm that emitted fewer is reported as incomplete rather than quietly reducing
// a total (rulings 228 and 317).
// ---------------------------------------------------------------------------
const EXPECTED_PATH = path.join(__dirname, "expected-counts.json");
/** Handoff 40-B: the arms tests/auth.cjs runs against the admin host, swept by the admin run alone; handoff 45-B adds tests/overview.cjs's three, 45-C tests/theme.cjs's admin theme, and 45-D tests/settings.cjs's four, and 45-E its staff role arm. */
const ADMIN_ARM =
  /-admin (signed-out|accounts|overview|overview error|drawer focus|theme|settings admin|settings analyst|zone|dia off|appearance|staff role|brand)$/;

function loadExpected() {
  try {
    return JSON.parse(fs.readFileSync(EXPECTED_PATH, "utf8"));
  } catch {
    return null;
  }
}

function sortedObject(pairs) {
  return Object.fromEntries([...pairs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function accountForArms({ full, engines, shard = null }) {
  armClose();
  const seen = new Map();
  for (const a of armLog) seen.set(a.arm, (seen.get(a.arm) || 0) + a.emitted);
  fs.writeFileSync(path.join(OUT, "arm-counts.json"), JSON.stringify(sortedObject(seen), null, 2));

  if (process.env.EXPECT === "write") {
    // Calibration. Merges upward against what is already declared: an arm that lost a web process
    // during calibration emitted fewer checks than it owes, and taking the lower number would bake
    // the crash in as the expectation. A declared number only ever falls by a deliberate edit.
    const prior = loadExpected() || {};
    const next = new Map(Object.entries(prior));
    for (const [arm, n] of seen) {
      // Ruling 831's other end. Merging upward already refuses to take a crashed arm's short count.
      // It used to take an inflated one: an arm that threw emits one check MORE than it declares,
      // because every flow's catch records `${tag} flow` on the error path and that check is in no
      // declaration, so a calibration run with one late failure would raise the declaration by one
      // for good and every clean run after it would read INCOMPLETE. An arm that crashed or failed
      // is not calibration material in either direction; the declaration keeps what it had.
      if (
        armLog.some((a) => a.arm === arm && a.crashed) ||
        results.some((r) => r.arm === arm && !r.ok)
      ) {
        console.log(
          `EXPECT=write: ${arm} crashed or failed; its declaration is left at ${prior[arm] ?? "unset"}`,
        );
        continue;
      }
      next.set(arm, Math.max(prior[arm] || 0, n));
    }
    const body = JSON.stringify(sortedObject(next), null, 2) + "\n";
    fs.writeFileSync(EXPECTED_PATH, body);
    // Also into the artifact and the job log, so a calibration run on a runner can be read back
    // without a checkout of the runner's own workspace.
    fs.writeFileSync(path.join(OUT, "expected-counts.json"), body);
    console.log(
      `EXPECT=write: ${next.size} arms declared\n--- BEGIN expected-counts.json ---\n` +
        body +
        "--- END expected-counts.json ---",
    );
    return;
  }

  const expected = loadExpected();
  if (!expected) {
    record(
      "ruling 292: an expected count per arm is declared",
      false,
      `${EXPECTED_PATH} is missing or unreadable; regenerate it with EXPECT=write`,
    );
    return;
  }

  for (const [arm, n] of seen) {
    const want = expected[arm];
    const crashed = armLog.some((a) => a.arm === arm && a.crashed);
    // Ruling 831. An arm that threw late emits one check MORE than it declares: every flow's catch
    // records `${tag} flow` on the error path, and that check is in no declaration. Read as DRIFT
    // it told the reader the declaration was stale and to regenerate a file that was correct, which
    // is what run 254 attempt 1's crashed arm reported (39 against a declared 38) and what attempt
    // 2 reported on a plain fifteen-second timeout with no crash anywhere in the job. So the cause
    // is the catch-all and not the crash handler, and the discriminator is a failing check inside
    // the arm: a declaration that is genuinely stale drifts upward with every check still passing.
    const threw = results.some((r) => r.arm === arm && r.ok === false);
    const label = `ruling 292 | ${arm}: emitted every check it declares`;
    if (want === undefined) {
      record(
        `ruling 292 | ${arm}: the arm is declared`,
        false,
        `UNDECLARED: emitted ${n} checks and is absent from expected-counts.json; regenerate with EXPECT=write`,
        crashed,
        arm,
      );
    } else if (n < want) {
      record(
        label,
        false,
        `UNPROVEN (228): emitted ${n} of ${want}; the ${want - n} checks behind the failure never ran`,
        crashed,
        arm,
      );
    } else if (n > want && (crashed || threw)) {
      record(
        label,
        false,
        `UNPROVEN (228): emitted ${n} against a declared ${want}, and the arm ${crashed ? "lost a web process" : "threw"}; ` +
          `the extra check is the flow catch-all on the error path, so the declaration is sound and must not be regenerated from this run`,
        crashed,
        arm,
      );
    } else if (n > want) {
      record(
        label,
        false,
        `DRIFT: emitted ${n} against a declared ${want} with every check passing; the declaration is stale, regenerate with EXPECT=write`,
        crashed,
        arm,
      );
    } else if (crashed) {
      // Rulings 228 and 1237. An arm can lose its web process after its last check has passed: the
      // listener charges the crash to the arm that opened the page, and a crash during teardown
      // arrives when the arm is over. Left as a pass, that arm emitted its declared number, failed
      // nothing, and the job went green with a dead web process in it and no failing check anywhere
      // to classify. So the count matching is not enough: an arm that lost a web process is
      // unproven whatever it emitted, and this is the check that says so.
      record(
        label,
        false,
        `UNPROVEN (228): emitted its declared ${want}, but the arm lost a web process, so what it emitted proves nothing`,
        crashed,
        arm,
      );
    } else {
      record(label, true, "", crashed, arm);
    }
  }

  // Handoff 40-B: the admin arms are declared beside every other arm, so a stale or short count
  // is caught the same way, but they run only in the admin-arms job, under SPECIAL=admin against
  // ADMIN_BASE, the dna-admin deployment, and never in a full run, which has no admin host to read.
  // So the full run's sweep leaves them out, and the SPECIAL=admin run sweeps exactly them: an
  // admin arm that stopped running is still found in what was declared, in the job that owes it.
  const adminRun = !full && (process.env.SPECIAL || "").includes("admin");
  if (shard) {
    // H63-CI (1847): a shard runs a part of the engine's arms, so an arm that did not run here may
    // have run in another shard. The engine's summary job (tests/matrix-summary.cjs) reads every
    // shard's arm-counts.json against this file and sweeps for the missing, the short and the twice.
    console.log(
      `ruling 292: shard ${shard.index} of ${shard.count}; the missing-arm sweep is the engine's ` +
        "summary job's, over every shard (tests/matrix-summary.cjs).",
    );
    return;
  }
  if (!full && !adminRun) {
    console.log(
      "ruling 292: SPECIAL, ONLY or THEME is set, so this is a subset run and arms that did not " +
        "run are not swept for. The missing-arm sweep is a full-run check.",
    );
    return;
  }
  // Ruling 228's case, and the one a total conceals: an arm that stopped running entirely emits
  // nothing, so it appears nowhere in what was observed and can only be found in what was declared.
  const inScope = (arm) =>
    engines.some((e) => arm.startsWith(e + "-") || arm.startsWith(e + " ")) &&
    ADMIN_ARM.test(arm) === adminRun;
  for (const arm of Object.keys(expected)) {
    if (seen.has(arm) || !inScope(arm)) continue;
    record(
      `ruling 292 | ${arm}: the arm ran`,
      false,
      `MISSING: declares ${expected[arm]} checks and emitted none`,
    );
  }
}

/**
 * Ruling 357: the classes a failure is already known to fall into, in the order the tail prints
 * them. The first is ruling 274's crash flag. The second is a WebKit-only aborted fetch on the
 * mocked REST origin, worded by the engine as an access-control denial ("… due to access control
 * checks."): not a crash, and not the app, since every request to that origin is fulfilled
 * in-process. tests/connect.cjs and tests/profile.cjs filter it out of their own page-error checks;
 * this names it anywhere else it surfaces. Add a class here when a sighting is understood, never
 * to make a tail read cleaner.
 */
const ABORTED_MOCK_FETCH = new RegExp(
  `${SB.replace(/\./g, "\\.")}\\S*\\s+due to access control checks`,
);
const KNOWN_CLASSES = [
  { id: "behind a web-process crash (G5)", test: (f) => f.crashed },
  {
    id: "an aborted fetch on mocked REST (WebKit, ruling 357)",
    test: (f) => !f.crashed && ABORTED_MOCK_FETCH.test(f.detail || ""),
  },
];

/**
 * The closing summary. Ruling 317: arms are what is comparable between runs, so the arms lead and
 * the check count is printed as a count and never as a score. Ruling 316: every failure is printed
 * with the crash flag or its absence, so a G5 sighting and a different symptom are told apart in
 * the line a reader sees first.
 */
function finish({ full = false, engines = [], shard = null } = {}) {
  accountForArms({ full, engines, shard });
  const fails = results.filter((r) => r.ok === false);
  const unprovenChecks = results.filter((r) => r.unproven);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(
    path.join(OUT, "arms.json"),
    JSON.stringify({ armLog, crashSightings }, null, 2),
  );

  const byTier = new Map();
  for (const a of armLog) {
    const t = byTier.get(a.tier) || { arms: 0, crashed: 0, failed: new Set() };
    t.arms += 1;
    if (a.crashed) t.crashed += 1;
    byTier.set(a.tier, t);
  }
  for (const f of fails) {
    const t = f.arm && byTier.get(tierOf(f.arm));
    if (t) t.failed.add(f.arm);
  }

  console.log("\n=== arms by tier (ruling 61's matrix; ruling 292: arms, not a total) ===");
  for (const tier of ["compact", "medium", "expanded", "unsized"]) {
    const t = byTier.get(tier);
    if (!t) continue;
    console.log(
      `${tier}: ${t.arms} arms | ${t.arms - t.failed.size} with no failing check | ` +
        `${t.failed.size} with at least one | ${t.crashed} that lost a web process`,
    );
  }

  // Ruling 916. Inside the tail both workflows re-emit into the job summary (they take everything
  // from `=== arms by tier` on), so this reaches the summary of a passing run, which is the whole
  // point: a record that only appears on failure cannot say which mode the cited run rendered.
  if (lensModes.length) {
    console.log("\n=== lens bar mode by viewport (ruling 916: a record, not an assertion) ===");
    for (const r of lensModes)
      console.log(
        `${String(r.width).padStart(4)}  ${String(r.mode)}  track ${r.track}  ${r.arm}` +
          (r.probe && r.probe.length ? `  probe ${r.probe.join(" ")}` : ""),
      );
    const at820 = lensModes.filter((r) => r.width === 820);
    console.log(
      at820.length
        ? "820: " + at820.map((r) => `${r.mode} (${r.arm})`).join(", ")
        : "820: not read on this run (no shell arm at 820)",
    );
  }

  // Ruling 357: name the class, so the ruling 199 line written from this tail names it too. A
  // failure that matches no known class is printed as unclassified, which is the one worth reading.
  const classified = KNOWN_CLASSES.map((k) => [k.id, fails.filter((f) => k.test(f)).length]);
  const unclassified = fails.filter((f) => !KNOWN_CLASSES.some((k) => k.test(f))).length;
  console.log(
    `\n=== failures classified (rulings 274, 357) ===\n` +
      classified.map(([id, n]) => `${n} ${id}`).join(" | ") +
      ` | ${unclassified} unclassified`,
  );
  if (crashSightings.length)
    console.log(
      "arms that lost a web process: " +
        crashSightings.map((c) => `${c.arm} (attempt ${c.attempt ?? "?"})`).join(", "),
    );

  // Ruling 1237 (amending 832). Every arm that lost a web process and was not proven by a retry is
  // unproven and comes out of the count: that part is ruling 228. An arm whose retry ran clean is in
  // the count on its retry's checks alone, and its first attempt is printed below by name. The
  // exit rule is one line: any counted failure or any crash that survived its retry fails the run.
  const unproven = [...new Set(armLog.filter((a) => a.crashed).map((a) => a.arm))];
  const counted = results.filter((r) => !unproven.includes(r.arm) && !r.unproven);
  const countedFails = counted.filter((r) => r.ok === false);
  const declared = loadExpected() || {};

  console.log(
    `\n${counted.length - countedFails.length} of ${counted.length} checks passed` +
      (unproven.length
        ? `; ${unproven.length} arm${unproven.length > 1 ? "s" : ""} UNPROVEN and excluded from that ` +
          `count (228): ` +
          unproven
            .map((a) => `${a} (declares ${declared[a] ?? "an undeclared number of"})`)
            .join(", ")
        : ""),
  );
  fails.forEach((f) => console.log("FAIL", f.crashed ? "[CRASH]" : "[no crash]", f.name, f.detail));
  // Ruling 228: a check the run could not prove is listed apart, never inside the passing count.
  if (unprovenChecks.length) {
    console.log(`${unprovenChecks.length} check(s) UNPROVEN, not passing:`);
    for (const u of unprovenChecks) console.log(`  - ${u.name}: ${u.detail}`);
  }
  // Ruling 1237: the retried arms, first attempt by name with its crash and its checks, then the
  // retry's outcome. Inside the tail, so both workflows lift it into the job summary.
  if (retriedArms.length) {
    console.log(
      `\n=== ruling 1237: ${retriedArms.length} arm${retriedArms.length > 1 ? "s" : ""} retried once, alone, after a lost web process ===`,
    );
    for (const r of retriedArms) {
      const crash = r.crash[0];
      console.log(
        `${r.arm}: attempt 1 lost its web process` +
          (crash
            ? ` at +${crash.secondsIn}s (browser ${crash.browserConnected ? "still connected" : "gone with it"})`
            : "") +
          ` after ${r.emitted} check(s)` +
          (r.threw ? `; the flow threw: ${r.threw}` : "") +
          `; attempt 1's checks are not counted`,
      );
      for (const c of r.checks)
        console.log(
          `  attempt 1  ${c.state.padEnd(8)} ${c.name}${c.state === "PASS" ? "" : ` ${c.detail}`}`,
        );
      const x = r.retry;
      console.log(
        `  attempt 2  ${x.crashed ? "LOST A WEB PROCESS AS WELL: the run fails" : x.failed ? `${x.failed} check(s) FAILED: the run fails` : `clean, ${x.emitted} check(s), counted as the arm's result`}` +
          (x.threw ? `; the flow threw: ${x.threw}` : ""),
      );
    }
  }
  if (unproven.length)
    console.log(
      `\n=== ruling 1237: ${unproven.length} arm${unproven.length > 1 ? "s" : ""} lost a web process and ${unproven.length > 1 ? "were" : "was"} not proven by a retry; the run fails ===`,
    );
  process.exit(fails.length || unproven.length ? 1 : 0);
}

/**
 * Ruling 344. The shell clips its root at the viewport (overflow hidden on the 100dvh column), so
 * documentElement.scrollWidth never exceeds innerWidth and the check this replaces could not fail
 * on the very tier it existed for. This one finds the element. Three measures, any of which fails:
 * the document is wider than the viewport; some rendered element's right edge lies past it; or a
 * vertical scroll container's content is wider than its box, which is the shape a clipped overflow
 * takes on the compact tier. Skipped: descendants of a designed horizontal scroller (an inline
 * overflow-x of auto or scroll, which is how every strip in Strand declares itself) and of an
 * aria-hidden ancestor (a parked affordance, a closed sheet). The detail names the offender and
 * its edges, so a failing tier says what to fix.
 */
async function measureWidth(page) {
  return page.evaluate(() => {
    const iw = window.innerWidth;
    const describe = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
        const attrs = [...e.attributes]
          .filter((a) =>
            /^(data-testid|data-scroller|data-sheet-scrim|data-fab|role|aria-label)$/.test(a.name),
          )
          .map((a) => `${a.name}=${a.value.slice(0, 24)}`)
          .join(",");
        parts.unshift(e.tagName.toLowerCase() + (attrs ? `{${attrs}}` : ""));
      }
      return parts.join(" > ");
    };
    const isStrip = (e) =>
      !!e.style && (e.style.overflowX === "auto" || e.style.overflowX === "scroll");
    const skipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.getAttribute("aria-hidden") === "true") return true;
        if (isStrip(p)) return true;
      }
      return false;
    };
    let widest = null;
    let panning = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.right > iw + 0.5 && !skipped(el) && (!widest || r.right > widest.right))
        widest = { right: Math.round(r.right), left: Math.round(r.left), path: describe(el) };
      if (!panning && !isStrip(el) && el.scrollWidth > el.clientWidth + 1) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && !skipped(el))
          panning = { sw: el.scrollWidth, cw: el.clientWidth, path: describe(el) };
      }
    }
    const docSW = document.documentElement.scrollWidth;
    const ok = docSW <= iw && !widest && !panning;
    const detail = ok
      ? ""
      : [
          docSW > iw ? `document ${docSW} wider than viewport ${iw}` : "",
          widest ? `element ends at ${widest.right} past viewport ${iw}: ${widest.path}` : "",
          panning ? `scroller pans ${panning.sw} in a ${panning.cw} box: ${panning.path}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
    return { ok, iw, docSW, widest, panning, detail };
  });
}

async function noOverflow(page, label) {
  const m = await measureWidth(page);
  record(label + " no horizontal overflow", m.ok, m.detail);
}

/** Ruling 492's geometry can only be measured once the slide has finished, and a fixed sleep is a
 *  race rather than a wait. The Sheet's resting transform is `none` and its in-flight transform is
 *  an interpolated matrix, so poll for the resting value. A 500ms sleep against the 300ms slide
 *  held on Chromium and lost on WebKit, which starts the transform a frame later and runs it slower
 *  under CI load: the composer's publish row measured 189px below the viewport on a panel that was
 *  still moving. */
/**
 * The resolved width of a --sheet-* token (1219, handoff 37-D): a probe given `width: var(token)`
 * is placed in the panel's own scrim, so a percentage resolves against the same box the panel's
 * does, viewport for a fixed sheet and host for a contained one, and its measured width is the
 * token's value. Assertions compare against this, never against a number.
 */
async function sheetTokenWidth(page, selector, token) {
  return page.evaluate(
    ({ sel, token }) => {
      const panel = document.querySelector(sel);
      if (!panel || !panel.parentElement) return null;
      const probe = document.createElement("div");
      probe.setAttribute("data-sheet-probe", token);
      probe.style.cssText =
        "position:absolute;left:0;top:0;height:0;visibility:hidden;pointer-events:none;width:var(" +
        token +
        ");";
      panel.parentElement.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    },
    { sel: selector, token },
  );
}

/** Whether a side sheet's panel is the token's width within 1 px and flush to the right edge. */
async function sheetWidthIs(page, selector, token) {
  const want = await sheetTokenWidth(page, selector, token);
  const box = await page.locator(selector).boundingBox();
  const iw = await page.evaluate(() => window.innerWidth);
  return {
    want,
    box,
    ok:
      want !== null &&
      !!box &&
      Math.abs(box.width - want) < 1 &&
      Math.abs(box.x + box.width - iw) < 1,
  };
}

async function sheetSettled(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).transform === "none";
    },
    selector,
    { timeout: 10000, polling: "raf" },
  );
}

/** DIA's line is the composer's slowest signal and the one a whole arm hangs off, so when it does
 *  not arrive the arm should say which limb failed rather than time out mutely. The app's own worst
 *  case is INFER_DEBOUNCE + THINK_BUDGET; past that `infer` is aborted and the line settles at
 *  nothing permanently, so a bare timeout cannot tell "the fetch was slow" from "the text never
 *  reached React". Report what the textarea actually holds and what the line actually shows. */
async function diaSettled(page, dialog, tag) {
  try {
    await dialog.locator('[data-dia="done"]').waitFor({ timeout: 5000 });
  } catch (e) {
    const state = await page
      .evaluate(() => {
        const ta = document.querySelector('textarea[aria-label="What is going on with you"]');
        const line = document.querySelector("[data-dia]");
        return {
          textarea: ta ? ta.value : "(no textarea)",
          dia: line ? line.getAttribute("data-dia") : "(no line)",
        };
      })
      .catch(() => null);
    record(
      tag + " DIA resolved on the filled text",
      false,
      JSON.stringify(state) + " " + String(e).slice(0, 120),
    );
    throw e;
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

/**
 * G140 (handoff 37-F): the sign-in form is touched only once the client has taken over from the
 * server-rendered markup. Every auth route calls useTheme, which stamps data-theme on the document
 * element in an effect, so the attribute's arrival is hydration; networkidle is not, and a press
 * that lands before React's onSubmit is attached submits the form natively, to `/sign-in?`, where
 * the arm then waits fifteen seconds for a feed that never comes (runs 379 and 431).
 */
async function hydrated(page) {
  // Handoff 45-C: the admin root sets data-theme before first paint and marks it data-prepaint
  // until its effect runs, so the attribute without the mark is still hydration on both apps.
  await page.waitForFunction(
    () => {
      const root = document.documentElement;
      return root.hasAttribute("data-theme") && !root.hasAttribute("data-prepaint");
    },
    null,
    { timeout: 15000 },
  );
}

async function signIn(page) {
  await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill('input[type="email"]', "member@test.invalid");
  await page.fill('input[type="password"]', "x");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/feed", { timeout: 15000 });
  await page.waitForSelector('[data-testid="compose"]');
}

async function runViewport(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}`;
  armStart(tag);
  const isTouch = w < 1024 || w === 1024;
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: isTouch,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 3);
  await page.addInitScript(
    ({ theme }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
    },
    { theme },
  );
  if (process.env.HIDE)
    await page.addInitScript((css) => {
      const st = document.createElement("style");
      st.textContent = css;
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    }, process.env.HIDE);
  await mockSupabase(page, db);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Handoff 35-C (1191, G147): a console error names its request. The URL comes first so the arms'
  // slice(0, 300) cannot cut it off; where the engine gives the message no location, the last
  // response of 400 or above stands in, marked unconfirmed since it can be a different request
  // from the one that raised the message. The response listener records and never fails an arm.
  const failedResponses = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.request().method()} ${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/fonts\.g|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_FAILED/.test(m.text())
    )
      errors.push(
        `${m.location().url || (failedResponses.length ? "(last failed response, unconfirmed) " + failedResponses.at(-1) : "(no url)")} ${m.text()}`,
      );
  });
  try {
    await signIn(page);
    record(tag + " theme attribute", (await page.getAttribute("html", "data-theme")) === theme);
    await shot(page, `${tag}-00-feed`);
    await noOverflow(page, tag + " feed");
    if (process.env.DEBUG)
      console.log(
        "DEBUG nav:",
        JSON.stringify(
          await page.evaluate(() =>
            [...document.querySelectorAll('nav[aria-label="Pulse"]')].map((n) => ({
              h: n.style.height,
              w: n.getBoundingClientRect().width,
              sw: n.scrollWidth,
              items: [...n.children].map((c) => Math.round(c.getBoundingClientRect().width)),
              parentW: n.parentElement.getBoundingClientRect().width,
              parentSW: n.parentElement.scrollWidth,
            })),
          ),
        ),
      );
    if (process.env.DEBUG)
      console.log(
        "DEBUG wide:",
        JSON.stringify(
          await page.evaluate(() => {
            const out = { innerWidth: window.innerWidth, wide: [] };
            for (const el of document.querySelectorAll("body *")) {
              const r = el.getBoundingClientRect();
              if (r.right > 821)
                out.wide.push([
                  el.tagName,
                  Math.round(r.width),
                  Math.round(r.right),
                  (el.getAttribute("aria-label") || el.textContent || "").slice(0, 25),
                ]);
            }
            return out;
          }),
        ),
      );

    record(
      tag + " shell: one header, one Pulse nav, five slots",
      (await page.locator("[data-app-header]").count()) === 1 &&
        (await page.locator('nav[aria-label="Pulse"]').count()) === 1 &&
        (await page.locator('nav[aria-label="Pulse"] button').count()) === 5,
    );
    const navPos = await page.evaluate(
      () => getComputedStyle(document.querySelector('nav[aria-label="Pulse"]')).position,
    );
    const headBox = await page.locator("[data-app-header]").boundingBox();
    record(
      tag +
        (w > 1024
          ? " expanded: one-row header with the five Cs inline and the Home icon (rulings 99, 106)"
          : " compact/medium: bottom dock, no Home icon, logo is Home"),
      w > 1024
        ? (await page.locator('[data-app-header] nav[data-pulse="inline"]').count()) === 1 &&
            (await page.locator('[data-app-header] [data-testid="home-item"]').count()) === 1 &&
            headBox.height <= 66
        : navPos === "fixed" &&
            (await page.locator('[data-testid="home-item"]').count()) === 0 &&
            (await page.locator('[data-testid="home"]').getAttribute("href")) === "/feed",
      `nav ${navPos} header height ${headBox && headBox.height}`,
    );
    record(
      tag +
        (w > 1024
          ? " header: logo, bell, avatar; composer entry in the Feed column"
          : " header: logo Home, composer entry, bell, avatar; no theme or sign-out controls"),
      (await page.locator('[data-app-header] [role="img"][aria-label="DNA"]').count()) === 1 &&
        (await page.locator('[data-testid="compose"]').count()) === 1 &&
        (await page.locator('[data-testid="compose"]').textContent()).includes(
          "What is going on with you?",
        ) &&
        (await page
          .locator((w > 1024 ? "[data-feed] " : "[data-app-header] ") + '[data-testid="compose"]')
          .count()) === 1 &&
        (await page.locator('[data-app-header] [data-testid="bell"]').count()) === 1 &&
        (await page.locator('[data-app-header] [aria-label="Your profile"]').count()) === 1 &&
        (await page.locator('[data-app-header] [aria-label="Sign out"]').count()) === 0,
    );
    record(
      tag + " lens bar with five lenses, All selected",
      (await page.locator('[role="tablist"][aria-label="Lens"] [role="tab"]').count()) === 5 &&
        (await page
          .locator('[role="tablist"][aria-label="Lens"] [role="tab"][aria-selected="true"]')
          .getAttribute("data-lens")) === "all",
    );
    record(
      tag + " feed cards in feed mode: react, respond, save, share, no counts",
      (await page.locator("main article[data-c]").count()) === 3 &&
        (await page.locator('main article [data-testid="react"]').count()) === 3 &&
        (await page.locator('main article [data-testid="respond"]').count()) === 3 &&
        (await page.locator('main article [data-testid="save"]').count()) === 3 &&
        (await page.locator('main article [data-testid="share"]').count()) === 3 &&
        !/\b\d+ (likes|reactions|saves)\b/i.test(await page.locator("main").textContent()),
    );
    if (w > 1024) {
      const rails = await page.locator("[data-rail-widget]").count();
      record(
        tag + (w >= 1440 ? " three regions, both rails grounded-or-empty" : " left rail only"),
        w >= 1440 ? rails === 4 : rails === 3,
        "rail widgets " + rails,
      );
    } else {
      record(
        tag + " no rails below 1024",
        (await page.locator("[data-rail-widget]").count()) === 0,
      );
    }
    // Open from the header pill: empty state.
    await page.click('[data-testid="compose"]');
    const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
    await dialog.waitFor({ timeout: 10000 });
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    record(tag + " composer opens from the header pill", true);
    if (process.env.DEBUG)
      console.log(
        "DEBUG wide2:",
        JSON.stringify(
          await page.evaluate(() => {
            const out = { innerWidth: window.innerWidth, wide: [] };
            for (const el of document.querySelectorAll("body *")) {
              const r = el.getBoundingClientRect();
              if (r.right > window.innerWidth + 1)
                out.wide.push([
                  el.tagName,
                  Math.round(r.width),
                  Math.round(r.right),
                  (el.getAttribute("aria-label") || el.textContent || "").slice(0, 25),
                ]);
            }
            return out;
          }),
        ),
      );
    // Rulings 400, 417, 458, 498: four chips in C order, above the text area, visible before
    // anything is typed, and no Connect chip. Connect has left the composer; making an intro is the
    // request sheet's job (401).
    record(
      tag + " four verb chips in C order above the text area, and no Connect chip",
      (await dialog
        .locator('[role="radiogroup"][aria-label="What kind of post"] [role="radio"]')
        .count()) === 4 &&
        (await dialog.locator('[role="radio"][aria-label^="Make an Intro"]').count()) === 0 &&
        (await dialog
          .locator('[role="radiogroup"][aria-label="What kind of post"] [role="radio"]')
          .first()
          .getAttribute("aria-label")) === "Host an Event (Convene)" &&
        (await dialog.evaluate(() => {
          const row = document.querySelector("[data-verb-row]");
          const ta = document.querySelector('[aria-label="What is going on with you"]');
          return (
            !!row && !!ta && !!(row.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING)
          );
        })),
    );
    // Ruling 493: the chip row is one horizontal scroller at every tier, never a stack of four.
    record(
      tag + " the chip row is one horizontal scroller, never a stack",
      await dialog.evaluate(() => {
        const row = document.querySelector("[data-verb-row]");
        if (!row) return false;
        const cs = getComputedStyle(row);
        const tops = new Set(
          [...row.children].map((c) => Math.round(c.getBoundingClientRect().top)),
        );
        return cs.overflowX === "auto" && cs.flexWrap !== "wrap" && tops.size === 1;
      }),
    );
    record(
      tag + " empty: no DiaLine, no preview, publish disabled",
      (await dialog.locator("[data-dia]").count()) === 0 &&
        (await dialog.locator("article[aria-label='Preview of your post']").count()) === 0 &&
        (await dialog.getByRole("button", { name: "Publish" }).isDisabled()),
    );
    // Ruling 492, superseding ruling 106's geometry: no sheet is full screen. A bottom sheet is 80
    // percent tall on compact; a side sheet is --sheet-composer-ratio wide on medium and expanded,
    // read in the page and never written as a number here (1219, 1220; handoff 37-D).
    const box = await dialog.boundingBox();
    const composerWidth =
      w >= 640 ? await sheetWidthIs(page, COMPOSE_SEL, "--sheet-composer-ratio") : null;
    record(
      tag +
        (w >= 640
          ? " composer: side sheet at --sheet-composer-ratio, flush right"
          : " compact: 80% bottom sheet"),
      w >= 640
        ? composerWidth.ok
        : Math.abs(box.width - w) < 2 && Math.abs(box.height - 0.8 * h) < 2,
      w >= 640
        ? `token ${composerWidth.want}, box ${JSON.stringify(box)}`
        : `box ${JSON.stringify(box)}`,
    );
    const pub = dialog.getByRole("button", { name: "Publish" });
    const pb = await pub.boundingBox();
    const geo = await page.evaluate(() => {
      const s = document.querySelector('section[role="dialog"][aria-label="Compose"]');
      const r = s.getBoundingClientRect();
      const scrim = s.parentElement.getBoundingClientRect();
      return {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        sectionBottom: r.bottom,
        sectionTop: r.top,
        scrimBottom: scrim.bottom,
        vv: window.visualViewport && window.visualViewport.height,
      };
    });
    record(
      tag + " publish within viewport",
      pb && pb.y + pb.height <= geo.innerHeight + 1,
      JSON.stringify({ pb, geo }),
    );
    await shot(page, `${tag}-01-empty`);
    await noOverflow(page, tag + " empty");

    // Thinking then proposed (Contribute sample: a verb whose fields VERB_SCHEMA still carries, so
    // DIA's tags have labels to sit on. Convene's fields are its own form's from Pass 1, and the
    // publish arm below drives that verb.)
    const ta = dialog.locator('textarea[aria-label="What is going on with you"]');
    await ta.fill(SAMPLES.contribute);
    await dialog.locator('[data-dia="thinking"]').waitFor({ timeout: 3000 });
    record(tag + " thinking state after 700ms debounce", true);
    await shot(page, `${tag}-02-thinking`);
    await dialog.locator('[data-dia="done"]').waitFor({ timeout: 5000 });
    // Rulings 635, 667, 668 (Convene Pass 1 rebind): DIA proposes and selects nothing. The DiaLine
    // carries the read, the proposed verb's fields mount with DIA's fills tagged, no chip carries
    // aria-checked from the read alone, and Publish stays off until the member taps a chip.
    record(
      tag + " proposed: DIA line, no chip checked by the read, Publish off (667, 668)",
      (await dialog
        .locator(
          '[role="radiogroup"][aria-label="What kind of post"] [role="radio"][aria-checked="true"]',
        )
        .count()) === 0 &&
        (await dialog.locator('[data-dia="done"]').textContent()).includes(
          "DIA read this as a Need.",
        ) &&
        (await pub.isDisabled()),
    );
    record(
      tag + " proposed: DIA tags on filled fields",
      (await dialog.locator("label", { hasText: "DIA" }).count()) >= 3,
    );
    const preview = dialog.locator("article[aria-label='Preview of your post']");
    record(
      tag + " proposed: preview card assembled as contribute",
      (await preview.getAttribute("data-c")) === "contribute" &&
        (await preview.textContent()).includes("Volunteer accountant"),
    );
    // Handoff 37-D (1217, 1219, 1221): the header is Strand's 57px toolbar row above compact, the
    // body has no cap of its own so the card is the feed card's width, and the footer is one line
    // above compact and the full-width bar at compact. Widths are read from tokens; 57 is the
    // toolbar row's own height (1217), not a sheet width.
    {
      const TOOLBAR_ROW = 57;
      const contentMax = await sheetTokenWidth(page, COMPOSE_SEL, "--content-max");
      const sideMax = await sheetTokenWidth(page, COMPOSE_SEL, "--sheet-side-max-width");
      const g = await page.evaluate((sel) => {
        const panel = document.querySelector(sel);
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const pub = [...panel.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Publish",
        );
        // Sheet's own action row, not the preview card's footer.
        const foot = pub && pub.closest("footer");
        const cs = foot ? getComputedStyle(foot) : null;
        return {
          panel: rect(panel),
          header: rect(panel.querySelector("header")),
          card: rect(panel.querySelector("article[aria-label='Preview of your post']")),
          foot: rect(foot),
          footPad: cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0,
          hint: rect(foot && foot.querySelector("span")),
          pub: rect(pub),
        };
      }, COMPOSE_SEL);
      console.log(`COMPOSER ${tag} ${JSON.stringify({ contentMax, sideMax, ...g })}`);
      if (w >= 640) {
        record(
          tag + " composer header is the 57px toolbar row (1217)",
          Math.abs(g.header.h - TOOLBAR_ROW) < 0.5,
          `header ${g.header.h}`,
        );
        record(
          tag +
            " composer body is uncapped: the card is the feed card's width, or the sheet's inside its padding (1217, 1219)",
          Math.abs(g.card.w - Math.min(contentMax, g.panel.w - (sideMax - contentMax))) < 1,
          `card ${g.card.w}, panel ${g.panel.w}, content-max ${contentMax}, side-max ${sideMax}`,
        );
        record(
          tag +
            " composer footer is one line: the hint and Publish share a row, Publish is not full width (1221)",
          !!g.hint &&
            Math.abs(g.hint.y + g.hint.h / 2 - (g.pub.y + g.pub.h / 2)) < 2 &&
            g.pub.w < (g.foot.w - g.footPad) / 2,
          JSON.stringify({ hint: g.hint, pub: g.pub, foot: g.foot }),
        );
      } else {
        record(
          tag + " composer footer at compact: Publish is the full-width bar, no hint (1221)",
          !g.hint && Math.abs(g.pub.w - (g.foot.w - g.footPad)) < 1,
          JSON.stringify({ pub: g.pub, foot: g.foot, footPad: g.footPad }),
        );
      }
    }
    await shot(page, `${tag}-03-populated`);
    await noOverflow(page, tag + " populated");

    // Member edits a DIA field: tag disappears; re-inference must not overwrite it.
    const titleInput = dialog.locator("label", { hasText: "Title" }).locator("..").locator("input");
    await titleInput.fill("Accountant for the cooperative books");
    record(
      tag + " member edit removes DIA tag on that field",
      (await dialog
        .locator("label", { hasText: "Title" })
        .locator("span", { hasText: "DIA" })
        .count()) === 0,
    );
    record(
      tag + " member-written field shows in the preview title",
      (await preview.locator("h3").textContent()).includes("Accountant for the cooperative books"),
    );

    // Not this? clears the proposal and DIA's fields, keeps member ones, returns to untyped Convey.
    await dialog.getByRole("button", { name: "Not this?" }).click();
    record(
      tag + " Not this? -> untyped convey, no DiaLine",
      (await dialog.locator("[data-dia]").count()) === 0 &&
        (await preview.getAttribute("data-c")) === "convey" &&
        (await preview.locator("h3").count()) === 0,
    );
    record(
      tag + " publish enabled with content once nothing is proposed",
      !(await pub.isDisabled()),
    );
    // Previews via the four chips (rulings 400, 417): four, not five. Connect left the composer
    // with the Intro verb.
    for (const v of ["convene", "collaborate", "contribute", "convey"]) {
      if (!FULL_PREVIEW_AT.has(w) && v !== "contribute") continue;
      await ta.fill(SAMPLES[v]);
      const act = {
        convene: "Host an Event",
        collaborate: "Start a Space",
        contribute: "Post a Need",
        convey: "Share a Story",
      }[v];
      await dialog.locator(`[role="radio"][aria-label^="${act}"]`).click();
      record(
        tag + ` chip override -> ${v} preview, no DiaLine`,
        (await preview.getAttribute("data-c")) === v &&
          (await dialog.locator("[data-dia]").count()) === 0,
      );
      await page.waitForTimeout(150);
      await shot(page, `${tag}-04-preview-${v}`);
      await noOverflow(page, tag + " preview " + v);
    }
    await dialog.locator('[role="radio"][aria-label^="Post a Need"]').click();
    // Audience pills.
    await dialog
      .locator('[role="radiogroup"][aria-label="Who sees this"] [role="radio"]', {
        hasText: "My connections",
      })
      .click();
    record(
      tag + " audience pill -> preview meta",
      (await preview.textContent()).includes("My connections"),
    );
    // Close keeps draft (Esc), reopen restores.
    await page.keyboard.press("Escape");
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
    });
    record(tag + " Esc closes; draft persisted server-side", db.drafts.size === 1);
    await page.keyboard.press("c");
    await dialog.waitFor({ timeout: 10000 });
    if (process.env.DEBUG)
      console.log(
        "DEBUG restore:",
        JSON.stringify({
          value: (await ta.inputValue()).slice(0, 40),
          drafted: await dialog.getByText("Draft saved").count(),
          drafts: [...db.drafts.entries()].map(([k, v]) => [
            k,
            typeof v,
            v && v.text && v.text.slice(0, 30),
          ]),
          log: db.log,
        }),
      );
    // Ruling 497: the composer opens empty and offers "Continue your draft" with a discard. The
    // draft itself, the autosave and the "Draft saved" trace are unchanged; what changed is that a
    // half-finished draft no longer arrives unasked.
    record(
      tag + " c keypress opens the composer empty, with the draft offered",
      (await ta.inputValue()) === "" &&
        (await dialog.locator('[data-testid="continue-draft"]').count()) === 1 &&
        (await dialog.locator('[data-testid="discard-draft"]').count()) === 1,
    );
    await dialog.locator('[data-testid="continue-draft"]').click();
    // G34: this waited a fixed 300 ms and read the pre-restore state whenever WebKit took longer,
    // which is four sightings across four heads and four widths, none with a defect behind it. The
    // wait is now on the two signals the restore itself produces, so it cannot resolve early; the
    // assertions and the arm's declared count are unchanged.
    await dialog
      .locator('[data-testid="continue-draft"]')
      .waitFor({ state: "detached", timeout: 10000 });
    await ta.evaluate(
      (el) =>
        new Promise((resolve, reject) => {
          const done = () => /^(Three intros|We need a volunteer)/.test(el.value);
          if (done()) return resolve();
          const t = setInterval(() => {
            if (!done()) return;
            clearInterval(t);
            clearTimeout(bail);
            resolve();
          }, 50);
          const bail = setTimeout(() => {
            clearInterval(t);
            reject(new Error("the draft's words never reached the textarea"));
          }, 10000);
        }),
    );
    record(
      tag + " Continue your draft restores it, and Draft saved is still the only trace",
      /^(Three intros|We need a volunteer)/.test(await ta.inputValue()) &&
        (await dialog.locator('[data-testid="continue-draft"]').count()) === 0 &&
        (await dialog.getByText("Draft saved").count()) === 1,
    );
    await page.keyboard.press("Escape");
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
    });
    // Empty-state action opens the same composer (Mine lens has no posts by this member? it has; use a member-less lens).
    db.posts.length = 0;
    await page.click('[role="tablist"][aria-label="Lens"] [data-lens="mine"]');
    await page.waitForURL("**/feed?lens=mine");
    await page.locator('[data-testid="feed-empty"][data-lens="mine"]').waitFor({ timeout: 10000 });
    await shot(page, `${tag}-05-empty-mine`);
    await page.locator('[data-testid="feed-empty"] button', { hasText: "Share a Story" }).click();
    await dialog.waitFor({ timeout: 10000 });
    record(tag + " empty-state action opens the composer", true);
    await page.keyboard.press("Escape");
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
    });
    db.drafts.clear();
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

// Convene Pass 1 (P1-SPEC section 6, the composer and the card). One arm per tier and theme it is
// declared for: the form on Strand's Composer (664 to 673), place resolution in its three states
// (PR 2's mock), the moment parsed and windowed (520, 634), the door by format (521, 621), publish
// in flight and failed (665, 666), the published card and a seeded cancelled card (SPEC 2).
/**
 * The mocked event ids, one UUID per kind. Handoff 30-D item 11.1 makes the member page's read
 * return not found before any call for an id that is not a UUID, so a fixture id like `e-loaded`
 * could never load; these are UUIDs that read as their kind in the last group.
 */
const EVENT_IDS = {
  loaded: "00000000-0000-4000-8000-0000000e10ad",
  past: "00000000-0000-4000-8000-0000000e0a57",
  cancelled: "00000000-0000-4000-8000-0000000eca9c",
  full: "00000000-0000-4000-8000-0000000ef011",
  private: "00000000-0000-4000-8000-0000000e9b1a",
};
function eventId(kind) {
  if (EVENT_IDS[kind]) return EVENT_IDS[kind];
  const hex = require("crypto").createHash("md5").update(String(kind)).digest("hex").slice(0, 12);
  return "00000000-0000-4000-8000-" + hex;
}

function seedEvent(db, kind) {
  const id = "seed-event-" + kind;
  const oid = eventId(kind);
  const past = kind === "past";
  const starts = new Date(Date.now() + (past ? -3 : 20) * 86400e3);
  starts.setUTCHours(19, 0, 0, 0);
  db.posts.unshift({
    id,
    author_kind: "member",
    author_id: "00000000-0000-4000-8000-0000000000f2",
    created_by: "00000000-0000-4000-8000-0000000000f2",
    author_name: "Kwame Mensah",
    author_handle: "kwame-mensah",
    author_avatar_path: null,
    c_category: "convene",
    body: "A long table for members in the Accra to Los Angeles agriculture corridor. Growers, buyers, cold chain people and the ones financing them. One conversation, no panel.",
    anchor_kind: null,
    anchor_id: null,
    created_object_kind: "event",
    created_object_id: oid,
    audience: "everyone",
    status: "published",
    published_at: new Date(Date.now() - 7200e3).toISOString(),
    created_at: new Date(Date.now() - 7200e3).toISOString(),
  });
  db.events.push({
    id: oid,
    host_member_id: "00000000-0000-4000-8000-0000000000f2",
    title: "Corridor Suppers: Accra",
    starts_at: starts.toISOString(),
    ends_at: null,
    doors_at: null,
    when_text: "15 October at 19:00",
    mode: "in_person",
    ticket_kind: "free",
    space_id: "s1",
    status: kind === "cancelled" ? "cancelled" : "published",
    timezone: "Africa/Accra",
    time_confirmed: true,
    date_confirmed: true,
    expected_window_start: null,
    expected_window_end: null,
    window_basis: null,
    delivery_intent: "In person at Front Room, Accra.",
    cancelled_at: kind === "cancelled" ? new Date(Date.now() - 3600e3).toISOString() : null,
    cancelled_reason:
      kind === "cancelled"
        ? "The market association moved its own event onto our evening and the supper would have been in the way. We will find another Thursday."
        : null,
    attachments: [],
    created_at: new Date().toISOString(),
  });
  db.event_delivery.push({
    id: "d-" + kind,
    event_id: oid,
    kind: "physical",
    position: 0,
    place_id: "dXJuOm1ieHBvaTpmcm9udC1yb29t",
    place_name: "Front Room",
    place_text: null,
    city: "Accra",
    country: "Ghana",
  });
  db.event_delivery.push({
    id: "d-" + kind + "-link",
    event_id: oid,
    kind: "meeting_link",
    position: 1,
    url: "https://meet.example/" + kind,
  });
  db.post_media.push({
    id: "m-" + kind,
    post_id: id,
    storage_path: "seed/" + kind + ".jpg",
    width: 1200,
    height: 800,
    position: 0,
  });
  return id;
}

async function runConvene(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-convene`;
  armStart(tag);
  const browser = await launch(browserType);
  const touch = w < 1024;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: touch,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  // Ruling 1876: the arm types calendar dates as words ("Thu 16 Oct at 19:00", "Wed 16
  // september, 7pm") and `parseWhen` reads a year-less date forward from the page's clock, so the
  // arm runs on one date rather than the calendar's: 1 October 2026, where 16 October is this
  // year's Friday and 16 September next year's Thursday. Installed running, before the first
  // navigation, as tests/sheet.cjs does under 1236.
  await page.clock.install({ time: new Date("2026-10-01T12:00:00Z") });
  // P4-SPEC section 5's two input-mode states were both host-pin states — `Map shown, pin
  // unplaced` and `Pin being dragged` — and ruling 929 removed the pin. Nothing in the place
  // section varies by input mode any more, so the `coarse` read that proved the mapping went with
  // them rather than sitting here unread. It comes back with the pin.
  const db = makeMockDb();
  seedPosts(db, 2);
  const cancelledId = seedEvent(db, "cancelled");
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
  page.on("pageerror", (e) => errors.push(String(e)));
  const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
  const pub = () => dialog.getByRole("button", { name: /^Publish/ });
  const fmt = (label) =>
    dialog.locator('[role="radiogroup"][aria-label="Format"] [role="radio"]', { hasText: label });
  const field = (key) => dialog.locator(`input[data-convene="${key}"]`);
  try {
    await signIn(page);

    // The seeded cancelled card, before anything is composed (SPEC 2: the full treatment).
    const cancelled = page.locator(`[data-post-id="${cancelledId}"] article`);
    await cancelled.waitFor({ timeout: 10000 });
    const cText = await cancelled.textContent();
    record(
      tag + " cancelled card: kicker Event cancelled, struck title, past-tense meta, the reason",
      cText.includes("Event cancelled") &&
        (await cancelled.locator("[data-cancelled-title]").count()) === 1 &&
        // 898 on the cancelled card: the stored instant reads through `localLine`, so the zone
        // is the event's own identifier and never an abbreviation. The year term is optional
        // because 835 renders it only outside the year being read in, and the seed is 20 days out.
        /Was set for \w{3} \d{1,2} \w{3}(?: \d{4})?, \d{2}:\d{2} Africa\/Accra/.test(cText) &&
        cText.includes("This event will not happen.") &&
        cText.includes("The host wrote:") &&
        cText.includes("told by email"),
      cText.slice(0, 200),
    );
    record(
      tag + " cancelled card: no img, no hook rows, no Read more, four icon actions, no RSVP",
      (await cancelled.locator("img").count()) === 0 &&
        (await cancelled.locator("[data-hook]").count()) === 0 &&
        (await cancelled.locator("[data-read-more]").count()) === 0 &&
        (await cancelled.locator("footer [data-testid]").count()) === 4 &&
        !cText.includes("Get a ticket") &&
        (await cancelled.locator('[data-testid="respond"]').getAttribute("aria-label")) ===
          "Ask the host",
    );
    await shot(page, `${tag}-00-cancelled`);

    // Step 1 and 2: the words, the proposal, nothing selected (635, 667, 668).
    await page.click('[data-testid="compose"]');
    await dialog.waitFor();
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    const ta = dialog.locator('textarea[aria-label="What is going on with you"]');
    await ta.fill(SAMPLES.convene);
    await diaSettled(page, dialog, tag);
    const proposedFields = (db.rpcPayloads[0] && db.rpcPayloads[0].dia) || null;
    record(
      tag +
        " proposal: no chip carries aria-checked from the read, Publish off, form mounted with DIA's tags",
      (await dialog
        .locator(
          '[role="radiogroup"][aria-label="What kind of post"] [role="radio"][aria-checked="true"]',
        )
        .count()) === 0 &&
        (await pub().isDisabled()) &&
        (await dialog.locator("[data-convene-form]").count()) === 1 &&
        (await dialog.locator("label", { hasText: "DIA" }).count()) >= 3,
      String(proposedFields),
    );
    record(
      tag + " the door renders no place or link control before a format is chosen (621)",
      (await dialog
        .locator('[data-convene="place-block"], [data-convene="link-block"]')
        .count()) === 0 && (await fmt("In person").count()) === 1,
    );
    // Written as `A === false || !B` it could not fail once `GMT` renders nowhere, which is a
    // check that proves nothing (485, 539). Read positively instead: the label carries the moment
    // and nothing follows the time, neither an abbreviation nor an identifier.
    const preFormatMeta = await dialog
      .locator("article[aria-label='Preview of your post']")
      .textContent();
    record(
      tag + " preview meta carries no time zone before a format is chosen (671)",
      preFormatMeta.includes("Presented by Amara Osei · Fri 16 Oct, 19:00") &&
        !/Fri 16 Oct, 19:00 [A-Za-z]/.test(preFormatMeta),
      preFormatMeta.slice(0, 160),
    );
    await shot(page, `${tag}-01-proposal`);
    await noOverflow(page, tag + " proposal");

    // Accept (668): the tap keeps DIA's fills; the form still gates Publish (664).
    await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
    record(
      tag + " tap accepts the proposal and keeps DIA's fills; Publish still gated by the form",
      (await dialog
        .locator('[role="radio"][aria-label^="Host an Event"][aria-checked="true"]')
        .count()) === 1 &&
        (await field("title").inputValue()) === "Diaspora Builders Dinner" &&
        (await field("when").inputValue()) === "Thu 16 Oct at 19:00" &&
        (await field("doors").inputValue()) === "18:30" &&
        (await pub().isDisabled()),
    );

    // The door: In person. Session 24 (783, 786, 796, 797): Country is the first control of the
    // place block and reads the vocabulary; nothing is selected on a fresh form, the member's
    // stated country (South Africa in the fixture) is listed first; Place is not in the DOM until
    // a country is chosen; no lookup runs; DIA's venue words wait in the store.
    await fmt("In person").click();
    await page.waitForTimeout(150);
    const countrySelect = dialog.locator('select[data-convene="country"]');
    const options = await countrySelect.locator("option").allTextContents();
    record(
      tag +
        " in person, no country: Choose a country with nothing selected, the stated country first, no Place in the DOM, no lookup, Publish off (786, 783)",
      (await countrySelect.count()) === 1 &&
        (await countrySelect.inputValue()) === "" &&
        options[0] === "Choose a country" &&
        options[1] === "South Africa" &&
        options.length === 1 + VOCAB.world.length &&
        (await field("place_query").count()) === 0 &&
        db.placeCalls.length === 0 &&
        (await dialog.locator('[data-convene="intent"]').count()) === 0 &&
        // P4-SPEC section 8: 821's gate has been in force since `e3392e5`, but the surface only
        // disabled Publish and left the reason to be inferred. The door now says which.
        (await dialog.locator('[data-convene="door-line"]').textContent()) ===
          "Choose the country first." &&
        (await pub().isDisabled()),
      JSON.stringify(options).slice(0, 120) + " calls " + db.placeCalls.length,
    );
    await shot(page, `${tag}-02-no-country`);

    // The wrong country as a visible state (798): United States chosen, DIA's Front Room finds
    // nothing there, and the hint names what was searched; the words stand. Since ruling 821 the
    // door also waits on a zone here, because the United States carries more than one and nothing
    // may be guessed for the host: the check asserts the gate, then opens it the way a host would.
    // The zone behaviour itself is the -convene-zone arm's, which drives it from a Pacific browser.
    await countrySelect.selectOption("United States");
    await dialog
      .getByText(
        "The map has no venue records in United States. Your words are kept, and you can publish.",
      )
      .waitFor({ timeout: 5000 });
    const usCall = db.placeCalls[db.placeCalls.length - 1];
    record(
      tag +
        " wrong country: Front Room in United States finds nothing, the hint names United States, words stand, publishable (798)",
      (await field("place_query").inputValue()) === "Front Room" &&
        (await field("place_query").getAttribute("placeholder")) === "A venue or an area" &&
        !!usCall &&
        usCall.country_name === "United States" &&
        usCall.proximity == null &&
        (await dialog.locator('[data-convene="place-resolved"]').count()) === 0 &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at Front Room, United States." &&
        (await pub().isDisabled()) &&
        // P4-SPEC section 8, the other gate: the United States carries more than one zone and
        // nothing may be guessed, so the door says what it is waiting on.
        (await dialog.locator('[data-convene="door-line"]').textContent()) ===
          "Choose the time zone first." &&
        (await dialog.locator('select[data-convene="country-tz"]').count()) === 1,
      JSON.stringify(usCall && [usCall.q, usCall.country_name, usCall.proximity]),
    );
    await dialog
      .locator('select[data-convene="country-tz"]')
      .selectOption("America/New_York", { timeout: 5000 });
    // G34's seventh sighting: the sixth's twin, in the arm the fix did not reach. `selectOption`'s
    // `{ timeout: 5000 }` bounds how long it waits for the control, not how long React takes to
    // re-render the line and re-evaluate the door, so the two signals below were read on the next
    // tick with no wait at all. Seen red at `webkit-1280x800-dark-convene` on run 265, on a
    // doc-and-comment-only head that reaches no surface. The wait is the sixth sighting's, moved:
    // the same in-page poll on the same two signals, its own bail and its own sentence. The
    // assertion and the arm's declared count are unchanged (ruling 292).
    await dialog.evaluate(
      (root) =>
        new Promise((resolve, reject) => {
          const want = "Time zone America/New_York, from the country.";
          const done = () => {
            const line = root.querySelector('[data-convene="country-tz-line"]');
            const publish = [...root.querySelectorAll("button")].find((b) =>
              /^Publish/.test(b.textContent || ""),
            );
            return !!line && line.textContent === want && !!publish && !publish.disabled;
          };
          if (done()) return resolve();
          const t = setInterval(() => {
            if (!done()) return;
            clearInterval(t);
            clearTimeout(bail);
            resolve();
          }, 50);
          const bail = setTimeout(() => {
            clearInterval(t);
            reject(new Error("the zone line and the door never settled on the chosen zone"));
          }, 10000);
        }),
    );
    record(
      tag + " and the zone the host chooses opens the door and reads from the country (821)",
      (await dialog.locator('[data-convene="country-tz-line"]').textContent()) ===
        "Time zone America/New_York, from the country." && !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-02-wrong-country`);

    // Ghana chosen: the same words resolve inside Ghana with the zone from the place; the row
    // carries the country in the quiet ink and replaces both controls (800).
    await countrySelect.selectOption("Ghana");
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    const resolved = await dialog.locator('[data-convene="place-resolved"]').textContent();
    const anchored = db.placeCalls[db.placeCalls.length - 1];
    record(
      tag +
        " Ghana chosen: the venue resolves inside Ghana, the row reads the place then Ghana, zone from the place, the country control not rendered",
      resolved.includes("Front Room, Osu, Accra") &&
        resolved.includes(", Ghana") &&
        resolved.includes("Time zone Africa/Accra, from the place.") &&
        (await dialog
          .locator('[data-convene="place-resolved"]')
          .getAttribute("data-place-kind")) === "venue" &&
        (await countrySelect.count()) === 0 &&
        // P4-SPEC sections 1 and 2 in one read: the read-back names no zone, the sentence
        // beneath it does and names where it came from, and `, the time at the place` is gone
        // along with the string G40 was opened about.
        (await dialog.locator('[data-convene="when-line"]').textContent()) ===
          "Fri 16 Oct, 19:00. Time zone Africa/Accra, from the place." &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at Front Room, Osu, Accra." &&
        // P4-SPEC section 6, the fourth reading: a point the host did not place reads as the
        // map's, in the ink treatment and never in the copper ring, and the door returns to its
        // resting line.
        (await dialog.locator('[data-convene="pin-chip"]').textContent()) ===
          "From the map's records" &&
        (await dialog.locator('[data-convene="pin-chip"]').getAttribute("data-pin-source")) ===
          "map" &&
        (await dialog.locator('[data-convene="plate-grid"] [data-pin-kind="map"]').count()) === 1 &&
        // Ruling 929: the host's pin is gone, so `[data-pin-kind="host"]` is absent everywhere
        // rather than absent in this state. The count that mattered here was the map's, and the
        // line beside it describes the map's point instead of inviting the host to place one.
        (await dialog.locator('[data-convene="plate-grid"] [data-pin-kind="host"]').count()) ===
          0 &&
        (await dialog.locator('[data-convene="pin-instruction"]').textContent()) ===
          "This point is the map's own record for the place you picked." &&
        (await dialog.locator('[data-convene="pin-act"]').count()) === 0 &&
        (await dialog.locator('[data-convene="door-line"]').textContent()) ===
          "Posting publishes this event. It goes to the Feed and to Convene." &&
        !!anchored &&
        anchored.country_name === "Ghana" &&
        anchored.proximity == null,
      resolved.slice(0, 160) + " " + JSON.stringify(anchored && anchored.country_name),
    );
    const previewText = await dialog
      .locator("article[aria-label='Preview of your post']")
      .textContent();
    record(
      tag + " preview reads convene.title and convene.meta with the fixed footer (671)",
      previewText.includes("Diaspora Builders Dinner") &&
        previewText.includes(
          "Presented by Amara Osei · Fri 16 Oct, 19:00 Africa/Accra · Front Room, Osu, Accra",
        ) &&
        !previewText.includes("Get a ticket") &&
        !(await pub().isDisabled()),
      previewText.slice(0, 200),
    );
    await shot(page, `${tag}-02-in-person`);
    await noOverflow(page, tag + " in person");

    // Change (785, Session 23 change 4): both controls return, the country still selected and the
    // words in place, and nothing is looked up again until the text changes.
    const callsBeforeChange = db.placeCalls.length;
    await dialog.getByRole("button", { name: "Change" }).click();
    await page.waitForTimeout(700);
    record(
      tag +
        " Change reopens both controls with Ghana still selected and the words in place, and does not re-resolve them (785)",
      (await dialog.locator('[data-convene="place-resolved"]').count()) === 0 &&
        (await countrySelect.inputValue()) === "Ghana" &&
        (await field("place_query").inputValue()) === "Front Room" &&
        db.placeCalls.length === callsBeforeChange &&
        (await dialog.getByText(/^The map has no venue records in/).count()) === 0,
      "calls " + callsBeforeChange + " -> " + db.placeCalls.length,
    );

    // A home chip (633, 690, Session 24): with the words cleared the chips render; a tap sets the
    // country and the city words together, and the lookup runs inside that country narrowed to
    // the home's point.
    await field("place_query").fill("");
    await page.waitForTimeout(150);
    record(
      tag + " empty place: Near one of your homes with the member's homes as chips (633, 690)",
      (await dialog.locator('[data-convene="homes"]').count()) === 1 &&
        (await dialog.locator('[data-convene="homes"] button', { hasText: "Accra" }).count()) ===
          1 &&
        (await dialog.locator('[data-convene="homes"] button', { hasText: "Nairobi" }).count()) ===
          1,
    );
    await dialog.locator('[data-convene="homes"] button', { hasText: "Nairobi" }).click();
    await dialog
      .getByText("The map has no venue records in Kenya. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });
    const homeCall = db.placeCalls[db.placeCalls.length - 1];
    record(
      tag +
        " a home chip sets the country and the city words together and narrows inside that country (633, Session 24)",
      (await countrySelect.inputValue()) === "Kenya" &&
        (await field("place_query").inputValue()) === "Nairobi" &&
        !!homeCall &&
        homeCall.country_name === "Kenya" &&
        !!homeCall.proximity &&
        Math.round(homeCall.proximity.lng) === 37 &&
        (await dialog.locator('[data-convene="homes"]').count()) === 0,
      JSON.stringify(homeCall && [homeCall.q, homeCall.country_name, homeCall.proximity]),
    );

    // The country filters: Alliance in Kenya is one place, the Nairobi one, and it resolves.
    await field("place_query").fill("Alliance");
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    record(
      tag + " the country filters: Alliance in Kenya is one place, the Nairobi one (783)",
      (await dialog.locator('[data-convene="place-resolved"]').textContent()).includes(
        "Alliance Française Nairobi, Loresho, Nairobi, Kenya",
      ),
    );

    // Changing the country from the open state clears any resolution and keeps the words: after
    // Change, Ghana chosen with Alliance still in the field finds two places, the home no longer
    // narrows, and nothing is chosen for the member.
    await dialog.getByRole("button", { name: "Change" }).click();
    await countrySelect.selectOption("Ghana");
    await dialog.getByRole("listbox", { name: "Places that match" }).waitFor({ timeout: 5000 });
    const last = db.placeCalls[db.placeCalls.length - 1];
    record(
      tag +
        " changing the country keeps the words and re-runs the lookup inside the new country: several, nothing chosen, the home no longer narrows",
      (await field("place_query").inputValue()) === "Alliance" &&
        (await dialog
          .getByText("Several places match. Pick one, or leave it as you wrote it.")
          .count()) === 1 &&
        (await dialog
          .getByRole("listbox", { name: "Places that match" })
          .getByRole("option")
          .count()) === 2 &&
        (await dialog.locator('[data-convene="place-resolved"]').count()) === 0 &&
        // P4-SPEC section 5, `Map shown, no point`: the plate is up and nothing stands behind it.
        // This was one of the two states where input mode changed the words, and both of those
        // were host-pin states, so ruling 929 leaves the line the same on either input mode.
        (await dialog.locator('[data-convene="pin-instruction"]').textContent()) ===
          "No point yet. Pick a place above and the map shows the point it holds for it." &&
        !!last &&
        last.country_name === "Ghana" &&
        last.proximity == null &&
        !(await pub().isDisabled()),
      JSON.stringify(last && [last.q, last.country_name, last.proximity]),
    );
    await dialog
      .getByRole("listbox", { name: "Places that match" })
      .getByRole("option")
      .first()
      .click();
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    record(
      tag + " picking one of several retrieves it and settles the row",
      (await dialog.locator('[data-convene="place-resolved"]').textContent()).includes(
        "Alliance Française Accra, Airport Residential, Accra, Ghana",
      ),
    );

    // Session 23, change 2: an area. The words stand beside the resolved area, the country after
    // it (784, 800), the zone comes from the area's point, and the payload carries the words in
    // place_text with no place_id.
    await dialog.getByRole("button", { name: "Change" }).click();
    await field("place_query").fill("Labadi beach");
    await dialog
      .locator('[data-convene="place-resolved"][data-place-kind="area"]')
      .waitFor({ timeout: 5000 });
    const areaRow = await dialog.locator('[data-convene="place-resolved"]').textContent();
    record(
      tag +
        " an area resolves with the words beside it and the country after, zone from the area, publishable (784, 800)",
      areaRow.includes("Labadi beach") &&
        areaRow.includes(", Osu, Accra, Ghana") &&
        areaRow.includes("Time zone Africa/Accra, from the place.") &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at Labadi beach, Osu, Accra." &&
        !(await pub().isDisabled()),
      areaRow.slice(0, 160),
    );
    await shot(page, `${tag}-03a-place-area`);

    // Ruling 807: one dedupe for the row, the intent line and the card's where line. This area's
    // place_name and area are the same string, so a join that does not dedupe prints it twice.
    await dialog.getByRole("button", { name: "Change" }).click();
    await field("place_query").fill("The villas");
    await dialog
      .locator('[data-convene="place-resolved"][data-place-kind="area"]')
      .waitFor({ timeout: 5000 });
    // The row, not the block: 898 put an identifier under it that contains a place name
    // (`Africa/Accra`), and 807 is about the parts of the place line rendering once each.
    const dupRow = (await dialog.locator('[data-convene="place-row"]').textContent()) || "";
    const dupIntent = (await dialog.locator('[data-convene="intent"]').textContent()) || "";
    const twice = (s, part) => s.split(part).length - 1;
    record(
      tag +
        " a place whose place_name equals its area renders each part once, row and intent alike (807)",
      dupRow.includes("The villas, Labadi Villas, Accra, Ghana") &&
        twice(dupRow, "Labadi Villas") === 1 &&
        twice(dupRow, "Accra") === 1 &&
        dupIntent === "In person at The villas, Labadi Villas, Accra." &&
        !(await pub().isDisabled()),
      dupRow.slice(0, 160) + " | " + dupIntent,
    );

    // None: the words stand in place_text, the hint names the country searched, the intent and
    // the card compose the country at read (798, 799), and the event is still publishable.
    await dialog.getByRole("button", { name: "Change" }).click();
    await field("place_query").fill("Kwame's rooftop");
    await dialog
      .getByText("The map has no venue records in Ghana. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });
    record(
      tag +
        " none: the hint names Ghana, the words stand in place_text, the intent composes the country, publishable (798, 799)",
      !(await pub().isDisabled()) &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at Kwame's rooftop, Ghana.",
    );
    record(
      tag +
        " a request never carries the member's residence; every lookup carried a chosen country (783)",
      db.placeCalls.length > 0 &&
        // A retrieve resolves a chosen row by its id and carries no anchor; every suggest does.
        db.placeCalls.every(
          (c) =>
            c.action === "retrieve" ||
            (!!c.country_name && c.country_name !== "South Africa" && !("residence" in c)),
        ),
      JSON.stringify([...new Set(db.placeCalls.map((c) => c.country_name))]),
    );
    await shot(page, `${tag}-03-place-none`);

    // ---- Convene Pass 4 (P4-SPEC sections 3 to 7) ----------------------------------------------
    // The nothing-found state is where the place section is at its fullest, and it is also the
    // only state in which the info control has grounds. P4-SPEC section 3 draws the control in
    // `Country chosen, place empty` and says the panel's claim renders only where it is true;
    // nothing in this tree knows which countries the map holds venues for, so the surface waits
    // until this country has answered with nothing, which is the map's own zero and the only true
    // thing it can say. Clearing the field then puts the form in the drawn state, grounded.
    await field("place_query").fill("");
    await dialog.locator('[data-convene="venue-info"]').waitFor({ timeout: 5000 });
    await dialog.locator('[data-convene="venue-info"]').click();
    await dialog.locator('[data-convene="venue-info-panel"]').waitFor({ timeout: 5000 });
    const venuePanel =
      (await dialog.locator('[data-convene="venue-info-panel"]').textContent()) || "";
    record(
      tag +
        " Pass 4: `Why is my venue not here?` opens a Sheet carrying the three ratified lines, and no plate stands behind it (814, 901)",
      (await dialog.locator('[data-convene="venue-info"]').textContent()) ===
        "Why is my venue not here?" &&
        venuePanel.includes("Venues in Ghana") &&
        venuePanel.includes(
          "The map holds no venue records for Ghana, so searching will not find your venue. This is the map\u2019s gap, not a mistake in what you typed.",
        ) &&
        // Ruling 929 on 897's line: it claimed the pin travelled with the event and it never did
        // (G43). The clause that named the act goes with the act, and the panel now claims only
        // what `place_text` keeps. Asserted as an exact absence as well as a presence, so a
        // half-reverted edit fails here rather than reading as a pass.
        venuePanel.includes("Type the venue as you say it. Your words travel with the event.") &&
        !venuePanel.includes("place the pin") &&
        !venuePanel.includes("Both travel with the event") &&
        (await dialog.locator('[data-convene="map-plate"]').count()) === 0,
      venuePanel.slice(0, 200),
    );
    // Escape on the topmost `dialog` fires `cancel`, which the Sheet turns into a close. This is
    // the one place in the suite where two modal dialogs are open at once, and no engine's handling
    // of that has been exercised here before, so a second press backs the first up. The assertion
    // above is unchanged and the arm's declared count with it; if one press is enough, as it is on
    // Chromium, the catch never runs.
    await page.keyboard.press("Escape");
    await dialog
      .locator('[data-convene="venue-info-panel"]')
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(async () => {
        await page.keyboard.press("Escape");
        await dialog
          .locator('[data-convene="venue-info-panel"]')
          .waitFor({ state: "detached", timeout: 5000 });
      });

    // The plate, unplaced. It is a drawn plate and says so in its own words; it renders no tile and
    // no invented geography, so there is nothing on it to read as a street (P4-SPEC guardrail 3).
    await field("place_query").fill("Kwame's rooftop");
    await dialog
      .getByText("The map has no venue records in Ghana. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });
    await dialog.locator('[data-convene="map-plate"]').waitFor({ timeout: 5000 });
    record(
      tag +
        " Pass 4: the plate is drawn with no point, its own line says where tiles come from, and no control offers to place one (790, 792, 929)",
      (await dialog.locator('[data-convene="map-plate"]').getAttribute("data-pin-state")) ===
        "unplaced" &&
        (await dialog.locator('[data-convene="plate-line"]').textContent()) ===
          "No point yet. Map tiles come from the provider in the built surface." &&
        (await dialog.locator('[data-convene="pin-instruction"]').textContent()) ===
          "The map has no record here. Your words are what the event carries." &&
        // Ruling 929, asserted as an absence: the act is gone from the DOM rather than disabled or
        // relabelled, so this reads as a removal and cannot pass on a control that still exists.
        (await dialog.locator('[data-convene="pin-act"]').count()) === 0 &&
        (await dialog.locator('[data-convene="host-point"]').count()) === 0 &&
        (await dialog.locator('[data-pin-kind="host"]').count()) === 0 &&
        (await dialog.locator('[data-convene="pin-chip"]').count()) === 0 &&
        (await dialog.locator('[data-convene="plate-grid"] [data-pin-kind]').count()) === 0 &&
        (await dialog.locator('[data-convene="plate-grid"] img').count()) === 0,
    );

    // Ruling 929 removed two checks here, and they are removed rather than left passing on an
    // absent control (ruling 228: an arm that cannot run is not an arm that passed).
    //
    //   - `a point being moved says so, and the drag's words follow the input mode`, which pressed
    //     the plate, held the drag open and read `Moving your point`.
    //   - `the host's own point reads as the host's, the chip says so, the act becomes Move the
    //     pin, and pressing it hands the keyboard the plate`, which pressed the act, followed focus
    //     onto the grid and drove an arrow key.
    //
    // Both drove the host-placed pin, whose position `publish_post` never read and never could,
    // because a drawn plate carries no projection (G43). Nothing else in this arm exercised them,
    // so there is no behaviour left behind them to cover: the pin's absence is now asserted in the
    // check above, as an absence, and the plate's remaining point is the map's own. The drag and
    // the keyboard path come back with the pin, in the pass that gives this plate real tiles.
    //
    // What that costs the declaration is two checks on each of the two `convene` arms, from 44 to
    // 42, which is a deliberate edit of tests/expected-counts.json and not a regeneration.

    // The map link (815, 816). The promise the hint makes is that DNA keeps it as a link and never
    // reads it, and the check that proves it is the one that counts lookups: the link goes in and
    // nothing is sent anywhere, because nothing parses it, geocodes it or plots it.
    const callsBeforeLink = db.placeCalls.length;
    await field("map_link").fill("https://maps.app.goo.gl/frontroom-osu");
    // A wait on an absence, and the one place in this file where a fixed wait is the right shape:
    // there is no signal to wait on when the assertion is that nothing happens. It has to outlast
    // what it is proving nothing fires after — every lookup this form issues goes through one
    // debounced effect at `LOOKUP_PAUSE_MS`, 400 ms — or the obvious regression, routing the link
    // through `resolvePlace` on that same pause, would fire at 400 ms and be read at 150. The
    // counter is live rather than stuck: `callsBeforeLink` is already above zero by this point and
    // the checks after this one drive it higher.
    await page.waitForTimeout(700);
    record(
      tag +
        " Pass 4: the map link is kept as the host typed it, with its hint, and no lookup of any kind follows it (815, 816)",
      (await field("map_link").inputValue()) === "https://maps.app.goo.gl/frontroom-osu" &&
        (await field("map_link").getAttribute("placeholder")) === "Paste a link to a map" &&
        (await dialog
          .getByText(
            "Optional. It opens in the app you took it from. DNA keeps it as a link and never reads it.",
          )
          .count()) === 1 &&
        db.placeCalls.length === callsBeforeLink &&
        !(await pub().isDisabled()),
      "lookups before " + callsBeforeLink + ", after " + db.placeCalls.length,
    );
    await shot(page, `${tag}-03c-plate-and-link`);

    // Session 23, the unavailable state: a lookup that did not run (here a 503 from the gateway)
    // is its own hint, never "No place found"; the words stand and Publish stays open.
    await field("place_query").fill("The outage bar");
    await dialog
      .getByText("Place search is unavailable right now. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });
    record(
      tag + " unavailable: its own hint, not No place found; words kept, still publishable",
      (await dialog.getByText(/^The map has no venue records in/).count()) === 0 &&
        !(await pub().isDisabled()) &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at The outage bar, Ghana.",
    );
    await shot(page, `${tag}-03b-place-unavailable`);
    await field("place_query").fill("Kwame's rooftop");
    await dialog
      .getByText("The map has no venue records in Ghana. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });

    // The moment: a failed parse mounts the pickers; a window is words (520, 634).
    await field("when").fill("next Thursday evening");
    await page.waitForTimeout(100);
    record(
      tag + " failed parse: the hint and a date and time picker, Publish off",
      (await dialog.getByText("That did not read as a date and time. Pick them below.").count()) ===
        1 &&
        (await field("when_date").count()) === 1 &&
        (await field("when_time").count()) === 1 &&
        (await pub().isDisabled()),
    );
    await field("when_time").fill("19:30");
    // A wait on the signal, not a fixed 100 ms: the when line is derived from the picker in an
    // effect, and on run 401 WebKit at 390 read it before the effect had run (handoff 37-B).
    await dialog
      .locator('[data-convene="when-line"]')
      .getByText(/19:30/)
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    record(
      tag + " the picker completes the moment and Publish returns",
      !(await pub().isDisabled()) &&
        /19:30/.test(await dialog.locator('[data-convene="when-line"]').textContent()),
    );
    await dialog.locator('[data-convene="give-window"]').click();
    await field("when_window").fill("November");
    await page.waitForTimeout(100);
    record(
      tag + " window: the card will say November, date to be confirmed; no end invented",
      (await dialog.getByText("The card will say: November, date to be confirmed.").count()) ===
        1 &&
        (await dialog.locator('[data-convene="when-line"]').textContent()) ===
          "November, date to be confirmed" &&
        (await dialog.locator('[data-convene="ends"]').count()) === 0 &&
        !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-04-window`);
    await dialog.locator('[data-convene="have-date"]').click();
    // P4-SPEC section 9 (836), in the words the frame draws: 16 September falls on a Thursday in
    // 2027, which is the year `forwardDate` reaches from here. The host's words are kept exactly
    // as typed, the disagreement is stated, and the instant that will be stored is named.
    await field("when").fill("Wed 16 september, 7pm");
    await dialog.locator('[data-convene="weekday-contradiction"]').waitFor({ timeout: 5000 });
    record(
      tag +
        " Pass 4: a weekday that disagrees with the date is stated, and the host's words are not rewritten (836)",
      (await dialog.locator('[data-convene="weekday-contradiction"]').textContent()) ===
        "You wrote Wed. The date you wrote falls on a Thursday in 2027. Your words are kept; the event will be stored for Thu 16 Sep 2027." &&
        (await field("when").inputValue()) === "Wed 16 september, 7pm" &&
        // 835's year, on the surface that has to carry it: outside this year the label says which.
        /^Thu 16 Sep 2027, 19:00\./.test(
          await dialog.locator('[data-convene="when-line"]').textContent(),
        ),
      await dialog.locator('[data-convene="when-line"]').textContent(),
    );
    await field("when").fill("Thu 16 Oct at 19:00");

    // Online and hybrid (521): the link or a promise of one; hybrid is two rows and one sentence.
    await fmt("Online").click();
    await page.waitForTimeout(100);
    record(
      tag + " online: the link control, no place control, zone your home time zone",
      (await dialog.locator('[data-convene="link-block"]').count()) === 1 &&
        (await dialog
          .locator('[data-convene="place-block"], [data-convene="place-resolved"]')
          .count()) === 0 &&
        // 824, and the fourth of section 1's ratified cases. The arm sets no timezoneId, so the
        // zone named is the runner's own and only the tail can be asserted literally; the
        // -convene-zone arm drives the same case from a Pacific browser.
        /\. Time zone \S+, from your device\. An online event has no country to take it from\.$/.test(
          await dialog.locator('[data-convene="when-line"]').textContent(),
        ) &&
        (await pub().isDisabled()),
    );
    await dialog.locator('[data-convene="announce-later"]').click();
    await page.waitForTimeout(150);
    record(
      tag + " announce later: Link to be announced, publishable, Online in the meta",
      (await dialog.locator('[data-convene="link-tba"]').textContent()).includes(
        "Link to be announced",
      ) &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "Online, link to be announced." &&
        !(await pub().isDisabled()) &&
        (await dialog.locator("article[aria-label='Preview of your post']").textContent()).includes(
          " · Online",
        ),
    );
    await fmt("Hybrid").click();
    await page.waitForTimeout(150);
    // The words the member wrote for the place stand across a format change (the store keeps its
    // values), so hybrid is publishable at once and its sentence joins both endpoints.
    record(
      tag + " hybrid: two delivery rows and one sentence; the typed words still stand",
      (await dialog.locator('[data-convene="place-block"]').count()) === 1 &&
        (await dialog.locator('[data-convene="link-tba"]').count()) === 1 &&
        (await dialog.locator('[data-convene="intent"]').textContent()) ===
          "In person at Kwame's rooftop, Ghana and Online, link to be announced." &&
        !(await pub().isDisabled()),
    );
    await field("place_query").fill("Front Room");
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    record(
      tag + " hybrid resolved: one sentence for both endpoints, where is city and online",
      (await dialog.locator('[data-convene="intent"]').textContent()) ===
        "In person at Front Room, Osu, Accra and Online, link to be announced." &&
        (await dialog.locator("article[aria-label='Preview of your post']").textContent()).includes(
          "Accra and online",
        ) &&
        !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-05-hybrid`);
    await noOverflow(page, tag + " hybrid");

    // Publish failed (665): the caller's message in the error slot, every value intact.
    db.publishFail = "Publishing did not go through. Your draft is here. Try again.";
    await pub().click();
    await dialog.locator("[data-sheet-error]").waitFor({ timeout: 5000 });
    record(
      tag + " failed publish: the message in Sheet's error slot, the draft intact, Publish back",
      (await dialog.locator("[data-sheet-error]").textContent()) ===
        "Publishing did not go through. Your draft is here. Try again." &&
        (await field("title").inputValue()) === "Diaspora Builders Dinner" &&
        (await field("when").inputValue()) === "Thu 16 Oct at 19:00" &&
        (await dialog.locator('[data-convene="place-resolved"]').count()) === 1 &&
        (await pub().textContent()).trim() === "Publish" &&
        !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-06-failed`);
    db.publishFail = null;

    // Publish in flight (665): fieldset disabled and aria-busy, Publish reads Publishing.
    db.publishDelayMs = 1500;
    const before = db.rpcPayloads.length;
    await pub().click();
    await page.waitForTimeout(300);
    record(
      tag + " publish in flight: fieldset disabled and aria-busy, Publish reads Publishing",
      (await dialog.locator("fieldset[disabled][aria-busy='true']").count()) === 1 &&
        (await pub().textContent()).trim() === "Publishing" &&
        (await field("title").count()) === 1,
    );
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 15000,
    });
    db.publishDelayMs = 0;
    const payload = db.rpcPayloads[before];
    record(
      tag +
        " payload: the namespaced convene keys, hybrid, one place, to be announced, no city from DIA",
      !!payload &&
        payload.verb === "convene" &&
        payload.fields["convene.format"] === "hybrid" &&
        payload.fields["convene.place_id"] === "dXJuOm1ieHBvaTpmcm9udC1yb29t" &&
        payload.fields["convene.link_tba"] === true &&
        typeof payload.fields["convene.starts_at"] === "string" &&
        payload.fields["convene.timezone"] === "Africa/Accra" &&
        // SPEC Revision 5's exit check (799): event_delivery.country is the chosen country on every
        // published in-person event, and place_text never contains it.
        payload.fields["convene.country"] === "Ghana" &&
        // Ruling 927: the region rides the same payload as the city and the country, so the write
        // that stores them stores it too and no surface has to look the place up a second time to
        // name it. Front Room's Mapbox context carries `Greater Accra`.
        payload.fields["convene.region"] === "Greater Accra" &&
        !String(payload.fields["convene.place_text"] || "").includes("Ghana") &&
        payload.fields["convene.delivery_intent"] ===
          "In person at Front Room, Osu, Accra and Online, link to be announced." &&
        payload.dia &&
        payload.dia.accepted === true &&
        !Object.keys(payload.dia.proposed_fields || {}).some((k) => /city|format/.test(k)),
      payload ? JSON.stringify(payload.fields).slice(0, 300) : "no payload",
    );
    await page.getByText("Published. It is in the Feed and on Convene.").waitFor({ timeout: 4000 });
    const card = page.locator("main article[data-c='convene']").first();
    await card.waitFor({ timeout: 10000 });
    const cardText = await card.textContent();
    record(
      tag +
        " the published card first: kicker Event, meta line, four icon actions, no RSVP, no count",
      cardText.includes("Event") &&
        cardText.includes("Diaspora Builders Dinner") &&
        cardText.includes("Presented by Amara Osei") &&
        // 16 October 2026 is a Friday: the parser trusts the day the member wrote, and the
        // weekday comes from the calendar (P1-EXTRACTION item 9).
        cardText.includes("Fri 16 Oct") &&
        // 898 on the published card. `whenLine` reads the viewer's zone first, and this arm sets
        // no timezoneId, so the identifier is whatever the runner is in: what is asserted is that
        // it is an identifier at all and that no abbreviation renders anywhere on the card.
        /Fri 16 Oct, 19:00 (?:UTC|[A-Za-z_]+\/[A-Za-z_+-]+)/.test(cardText) &&
        !/\b(?:GMT|BST|EDT|EST|CDT|CST|PDT|PST|CET|CEST|WAT|EAT|SAST)\b/.test(cardText) &&
        cardText.includes("Accra and online") &&
        (await card.locator("footer [data-testid]").count()) === 4 &&
        !cardText.includes("Get a ticket") &&
        (await card.locator('[data-testid="respond"]').getAttribute("aria-label")) ===
          "Ask the host" &&
        !/\b\d+\s+(going|members|people)\b/i.test(cardText),
      cardText.slice(0, 220),
    );
    await shot(page, `${tag}-07-published`);
    await noOverflow(page, tag + " published");
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

// Rulings 813, 817, 821: the zone a words-only event carries. Driven from a browser in
// America/Los_Angeles, which is where the founder composes, against a Ghana event, which is where
// the corridor is: the whole defect was that the two were the same value. A separate arm because
// the context's timezoneId is what makes the difference visible at all — under the runner's own UTC,
// Accra and the browser agree and every assertion here would pass vacuously.
async function runConveneZone(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-convene-zone`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
    isMobile: w < 1024,
    colorScheme: theme,
    timezoneId: "America/Los_Angeles",
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
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
  page.on("pageerror", (e) => errors.push(String(e)));
  const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
  const pub = () => dialog.getByRole("button", { name: /^Publish/ });
  const fmt = (label) =>
    dialog.locator('[role="radiogroup"][aria-label="Format"] [role="radio"]', { hasText: label });
  const field = (key) => dialog.locator(`input[data-convene="${key}"]`);
  const country = () => dialog.locator('select[data-convene="country"]');
  const zone = () => dialog.locator('select[data-convene="country-tz"]');
  try {
    await signIn(page);
    await page.click('[data-testid="compose"]');
    await dialog.waitFor({ timeout: 10000 });
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    const ta = dialog.locator('textarea[aria-label="What is going on with you"]');
    await ta.fill(SAMPLES.convene);
    await diaSettled(page, dialog, tag);
    await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
    await fmt("In person").click();

    // The corridor case: one zone, taken silently. No control, no line, no question (168 countries).
    await country().selectOption("Ghana");
    await field("place_query").fill("Kwame's rooftop");
    await dialog
      .getByText("The map has no venue records in Ghana. Your words are kept, and you can publish.")
      .waitFor({ timeout: 5000 });
    record(
      tag + " Ghana with words only: no zone control, no zone line, publishable (813, 821)",
      (await zone().count()) === 0 &&
        (await dialog.locator('[data-convene="country-tz-line"]').count()) === 0 &&
        !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-00-single-zone`);

    // The instant, which is the whole of 813: the typed 19:00 is 19:00 in Accra, not 19:00 Pacific.
    // Before the fix this stored 02:00 the next day and every viewer read the wrong hour.
    const before = db.rpcPayloads.length;
    await pub().click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 15000,
    });
    const paid = db.rpcPayloads[before];
    record(
      tag + " Ghana with words only stores Africa/Accra and the typed 19:00 as 19:00 Accra (813)",
      !!paid &&
        paid.fields["convene.timezone"] === "Africa/Accra" &&
        /T19:00/.test(String(paid.fields["convene.starts_at"])) &&
        paid.fields["convene.country"] === "Ghana" &&
        // Ruling 927's null half, at the write boundary: this event is words only, nothing
        // resolved, so no region reaches the payload and `publish_post`'s nullif writes null.
        // Nothing is derived from the country or the city to fill it, which is 790's guardrail.
        !paid.fields["convene.region"],
      paid
        ? String(paid.fields["convene.starts_at"]) + " " + paid.fields["convene.timezone"]
        : "no payload",
    );

    // A country with more than one zone: the control is present, the door is shut until the host
    // chooses, the browser's own zone is offered first, and nothing is selected for them (821).
    await page.click('[data-testid="compose"]');
    await dialog.waitFor({ timeout: 10000 });
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    await ta.fill(SAMPLES.convene);
    await diaSettled(page, dialog, tag);
    await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
    await fmt("In person").click();
    await country().selectOption("United States");
    await field("place_query").fill("Kwame's rooftop");
    await zone().waitFor({ timeout: 5000 });
    const options = await zone().locator("option").allTextContents();
    record(
      tag +
        " a country with several zones asks, offers the browser's zone first and selects nothing, and the door stays shut (821)",
      options[0] === "Choose a time zone" &&
        options[1] === "America/Los_Angeles" &&
        options.length === 6 &&
        (await zone().inputValue()) === "" &&
        (await pub().isDisabled()),
      options.join(", "),
    );
    await zone().selectOption("America/New_York");
    // G34's family, and the sighting that earned the entry's own "until one of them earns it".
    // `selectOption` resolves when the change event is dispatched, not when React has re-rendered
    // the line and re-evaluated the door, so this read was a race: won on every fast run, lost on
    // run 261's second attempt at `webkit-1280x800-dark`. The app was not wrong there, and the
    // proof is in the same run: the next check passed, so the payload did carry America/New_York
    // and the door did open. The wait is now on the two signals this assertion needs, in the shape
    // the draft-restore fix above uses; the assertions and the arm's declared count are unchanged.
    await dialog.evaluate(
      (root) =>
        new Promise((resolve, reject) => {
          const want = "Time zone America/New_York, from the country.";
          const done = () => {
            const line = root.querySelector('[data-convene="country-tz-line"]');
            const publish = [...root.querySelectorAll("button")].find((b) =>
              /^Publish/.test(b.textContent || ""),
            );
            return !!line && line.textContent === want && !!publish && !publish.disabled;
          };
          if (done()) return resolve();
          const t = setInterval(() => {
            if (!done()) return;
            clearInterval(t);
            clearTimeout(bail);
            resolve();
          }, 50);
          const bail = setTimeout(() => {
            clearInterval(t);
            reject(new Error("the zone line and the door never settled on the chosen zone"));
          }, 10000);
        }),
    );
    record(
      tag + " choosing a zone opens the door and the line reads it, from the country (821)",
      (await dialog.locator('[data-convene="country-tz-line"]').textContent()) ===
        "Time zone America/New_York, from the country." && !(await pub().isDisabled()),
    );
    await shot(page, `${tag}-01-several-zones`);
    const before2 = db.rpcPayloads.length;
    await pub().click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 15000,
    });
    const paid2 = db.rpcPayloads[before2];
    record(
      tag + " the chosen zone is what the event stores, not the browser's (821)",
      !!paid2 && paid2.fields["convene.timezone"] === "America/New_York",
      paid2 ? String(paid2.fields["convene.timezone"]) : "no payload",
    );

    // A resolved place still wins over the country, unchanged; and changing the country after a
    // zone was chosen recomputes rather than keeping the old answer.
    await page.click('[data-testid="compose"]');
    await dialog.waitFor({ timeout: 10000 });
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    await ta.fill(SAMPLES.convene);
    await diaSettled(page, dialog, tag);
    await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
    await fmt("In person").click();
    await country().selectOption("United States");
    await field("place_query").fill("Kwame's rooftop");
    await zone().waitFor({ timeout: 5000 });
    await zone().selectOption("America/Denver");
    await country().selectOption("Ghana");
    record(
      tag + " changing the country recomputes: the control goes, Ghana's one zone stands (813)",
      (await zone().count()) === 0 &&
        (await dialog.locator('[data-convene="country-tz-line"]').count()) === 0 &&
        !(await pub().isDisabled()),
    );
    await field("place_query").fill("Front Room");
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    const resolvedRow = await dialog.locator('[data-convene="place-resolved"]').textContent();
    record(
      tag + " a resolved place still wins over the country's zone (813, unchanged)",
      resolvedRow.includes("Time zone Africa/Accra, from the place.") &&
        (await zone().count()) === 0,
      resolvedRow.slice(0, 120),
    );
    await shot(page, `${tag}-02-place-wins`);
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

// End-to-end publish (once per tier) including link unfurl, image attach, and the feed card via the router.
async function runPublish(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-publish`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
    isMobile: w < 1024,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
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
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await signIn(page);
    await page.click('[data-testid="compose"]');
    const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
    await dialog.waitFor();
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    await dialog.locator('textarea[aria-label="What is going on with you"]').fill(SAMPLES.convene);
    await diaSettled(page, dialog, tag);
    // Ruling 668: the read is a proposal; the tap on the proposed chip is the acceptance and keeps
    // DIA's fills, and it is what enables Publish (664, 667).
    record(
      tag + " Publish is off while the proposal stands without a tap (668)",
      await dialog.getByRole("button", { name: "Publish" }).isDisabled(),
    );
    await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
    record(
      tag + " tapping the proposed chip accepts it: chip checked, DiaLine gone, DIA's fills kept",
      (await dialog
        .locator('[role="radio"][aria-label^="Host an Event"][aria-checked="true"]')
        .count()) === 1 &&
        (await dialog.locator("[data-dia]").count()) === 0 &&
        (await dialog.locator('input[data-convene="title"]').inputValue()) ===
          "Diaspora Builders Dinner",
    );
    // Convene Pass 1 (664): the form gates Publish. With the title, when and venue filled by DIA
    // and no format chosen, Publish is still off; In person lets the venue resolve (PR 2's one
    // state) and the form reports true.
    record(
      tag + " Publish stays off until the Convene form reports true (664)",
      await dialog.getByRole("button", { name: "Publish" }).isDisabled(),
    );
    await dialog
      .locator('[role="radiogroup"][aria-label="Format"] [role="radio"]', { hasText: "In person" })
      .click();
    // Session 24 (783, 786): Place is not in the DOM until a country is chosen, so the arm chooses
    // Ghana the way a member does and DIA's venue words then resolve inside it. The Convene arm
    // asserts the no-country state itself.
    await dialog.locator('select[data-convene="country"]').selectOption("Ghana");
    await dialog.locator('[data-convene="place-resolved"]').waitFor({ timeout: 5000 });
    record(
      tag + " In person with Ghana chosen: the venue resolves to one place and Publish is on",
      (await dialog.locator('[data-convene="place-resolved"]').textContent()).includes(
        "Front Room, Osu, Accra",
      ) && !(await dialog.getByRole("button", { name: "Publish" }).isDisabled()),
    );
    // Link.
    await dialog.getByRole("button", { name: "Add a link" }).click();
    await dialog.locator('input[placeholder="https://"]').fill("https://nation.africa/summit");
    await page.keyboard.press("Enter");
    record(
      tag + " link shows domain immediately",
      (await dialog.textContent()).includes("nation.africa"),
    );
    await dialog
      .getByText("Nairobi to host continental builders summit")
      .first()
      .waitFor({ timeout: 3000 });
    record(
      tag + " link unfurls into card",
      (await dialog.locator("article[aria-label='Preview of your post']").textContent()).includes(
        "Nairobi to host continental builders summit",
      ),
    );
    // Images (picker path on touch, direct input on pointer): set files on the hidden input.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    const fileInput = dialog.locator('input[type="file"]:not([capture])');
    await fileInput.setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png },
      { name: "b.png", mimeType: "image/png", buffer: png },
    ]);
    await page.waitForTimeout(600);
    record(
      tag + " two thumbnails after attach",
      (await dialog.getByRole("button", { name: "Remove image" }).count()) === 2,
    );
    record(
      tag + " gallery in preview",
      (await dialog.locator("article[aria-label='Preview of your post'] img").count()) >= 2,
    );
    await fileInput.setInputFiles([
      { name: "c.png", mimeType: "image/png", buffer: png },
      { name: "d.png", mimeType: "image/png", buffer: png },
      { name: "e.png", mimeType: "image/png", buffer: png },
    ]);
    await page.waitForTimeout(600);
    record(
      tag + " fifth image truncated to cap of four",
      (await dialog.getByRole("button", { name: "Remove image" }).count()) === 4 &&
        (await dialog.getByRole("button", { name: "Add an image" }).isDisabled()),
    );
    await page.screenshot({ path: path.join(OUT, `${tag}-05-attached.png`) });
    // Publish.
    await dialog.getByRole("button", { name: "Publish" }).click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 10000,
    });
    record(tag + " composer closes on publish, no navigation", page.url().endsWith("/feed"));
    const payload = db.rpcPayloads[0];
    record(
      tag + " RPC payload: one c_category via verb, media x4, link, dia record",
      payload &&
        payload.verb === "convene" &&
        payload.media.length === 4 &&
        payload.link.url.includes("nation.africa") &&
        payload.dia &&
        payload.dia.verb === "convene" &&
        payload.dia.accepted === true &&
        // Ruling 681: the instants travel inside `fields` as convene.* from the Convene form;
        // the chassis stand-in that parsed date and time here is retired, so this is null.
        payload.starts_at === null &&
        typeof payload.fields["convene.starts_at"] === "string" &&
        payload.fields["convene.format"] === "in_person" &&
        payload.fields["convene.place_id"] === "dXJuOm1ieHBvaTpmcm9udC1yb29t",
      JSON.stringify(payload).slice(0, 300),
    );
    // Convene Pass 1: an event's toast names Convene too (P1-EXTRACTION, confirmed content).
    await page.getByText("Published. It is in the Feed and on Convene.").waitFor({ timeout: 3000 });
    const card = page.locator("main article[data-c='convene']").first();
    await card.waitFor({ timeout: 10000 });
    // Rulings 579, 671: the card's action row is the fixed vocabulary; no RSVP, so no "Get a
    // ticket" anywhere in the card.
    record(
      tag +
        " feed card rendered by the router with kicker Event, title, fixed icon actions, no RSVP",
      (await card.textContent()).includes("Event") &&
        (await card.textContent()).includes("Diaspora Builders Dinner") &&
        (await card.textContent()).includes("Presented by Amara Osei") &&
        (await card.textContent()).includes("Front Room, Accra") &&
        !(await card.textContent()).includes("Get a ticket") &&
        (await card.locator('[data-testid="react"]').count()) === 1 &&
        (await card.locator('[data-testid="respond"]').count()) === 1 &&
        (await card.locator('[data-testid="save"]').count()) === 1 &&
        (await card.locator('[data-testid="share"]').count()) === 1,
    );
    record(
      tag + " feed card carries media and link",
      (await card.locator("img").count()) >= 4 &&
        (await card.textContent()).includes("nation.africa"),
    );
    await page.screenshot({ path: path.join(OUT, `${tag}-06-published.png`) });
    // Untyped publish. The published sheet slides out over 300ms; wait for it to leave so the
    // locator below binds to the new composer.
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 10000,
    });
    await page.keyboard.press("c");
    await dialog.waitFor();
    await dialog.locator('textarea[aria-label="What is going on with you"]').fill(SAMPLES.untyped);
    await page.waitForTimeout(1900);
    if (process.env.DEBUG) {
      await page.screenshot({ path: path.join(OUT, `${tag}-DEBUG-untyped.png`) });
      console.log(
        "DEBUG untyped:",
        JSON.stringify({
          dia: await dialog.locator("[data-dia]").count(),
          preview: await dialog.locator("article[aria-label='Preview of your post']").count(),
          c: await dialog
            .locator("article[aria-label='Preview of your post']")
            .getAttribute("data-c")
            .catch(() => "none"),
          disabled: await dialog.getByRole("button", { name: "Publish" }).isDisabled(),
          text: (
            await dialog.locator('textarea[aria-label="What is going on with you"]').inputValue()
          ).slice(0, 30),
          drafts: db.drafts.size,
          infer: db.inferCalls,
        }),
      );
    }
    // W54, ruling 546: a chipless post resolves to Convey and the card carries Convey's kicker, so
    // it reads as labelled rather than sitting in a generic bucket. The preview is the same card, so
    // what the member sees before publishing is what they get after.
    const untypedPreview = dialog.locator("article[aria-label='Preview of your post']");
    record(
      tag + " silence: untyped text -> no DiaLine, convey preview carrying the Story kicker (546)",
      (await dialog.locator("[data-dia]").count()) === 0 &&
        (await untypedPreview.getAttribute("data-c")) === "convey" &&
        (await untypedPreview.locator("[data-kicker]").count()) === 1 &&
        (await untypedPreview.locator("[data-kicker]").textContent()).trim() === "Story",
      (await untypedPreview.locator("[data-kicker]").count()) === 1
        ? (await untypedPreview.locator("[data-kicker]").textContent()).trim()
        : "no kicker element",
    );
    await dialog.getByRole("button", { name: "Publish" }).click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 10000,
    });
    const p2 = db.rpcPayloads[1];
    record(
      tag + " untyped publish: verb null (convey, no object)",
      p2 &&
        p2.verb === null &&
        db.posts[0].c_category === "convey" &&
        db.posts[0].created_object_kind === null,
    );
    const untypedCard = page.locator("main article[data-c='convey']").first();
    await untypedCard.waitFor({ timeout: 10000 });
    // W54 on the Feed card itself, which is where the finding was seen. The kicker is there and the
    // act is not: there is no story object behind an untyped post, so "Read the story" would lead
    // nowhere and ruling 68's no-title, no-action half still stands.
    record(
      tag + " W54: the published chipless card carries the Story kicker and no act (546, 68)",
      (await untypedCard.locator("[data-kicker]").count()) === 1 &&
        (await untypedCard.locator("[data-kicker]").textContent()).trim() === "Story" &&
        (await untypedCard.getByRole("button", { name: "Read the story" }).count()) === 0,
      (await untypedCard.locator("[data-kicker]").count()) === 1
        ? (await untypedCard.locator("[data-kicker]").textContent()).trim()
        : "no kicker element",
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await page.screenshot({ path: path.join(OUT, `${tag}-ERROR.png`) }).catch(() => {});
  }
  record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
}

// Ruling 287: the draft autosave never writes after a publish has been initiated.
//
// The live shape of the defect: DRAFT_DEBOUNCE is 800ms, so a member who edits and presses Publish
// inside that window leaves a timer armed. publish_post takes long enough that the timer fires while
// the composer is still mounted and the RPC still in flight, and the callback upserts the draft back
// into post_drafts carrying the post id the RPC has just consumed. On the founder's account the
// draft row landed 132ms after the transaction that deleted it. The reopen then restored that draft,
// the next publish reused the consumed id, and every retry collided on posts_pkey.
//
// publishDelayMs is what makes it reproducible here: with an instant RPC the composer unmounts
// before the timer can fire and React clears it, so the defect is invisible. Two arms follow the
// chain: no draft survives the publish, and the reopen therefore comes up empty and mints an id that
// is not already a post.
async function runPublishGuards(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-guards`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
    isMobile: w < 1024,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  // Long enough that a timer armed just before Publish fires mid-RPC, with the composer mounted.
  db.publishDelayMs = 900;
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
  page.on("pageerror", (e) => errors.push(String(e)));
  const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
  const textarea = () => dialog.locator('textarea[aria-label="What is going on with you"]');
  try {
    await signIn(page);

    await page.click('[data-testid="compose"]');
    await dialog.waitFor();
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
    await textarea().fill("A draft with an autosave timer still in flight.");
    // Inside DRAFT_DEBOUNCE: the timer is armed and has not fired, so nothing is saved yet.
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS - 200);
    record(tag + " autosave has not fired when Publish is pressed", db.drafts.size === 0);
    await dialog.getByRole("button", { name: "Publish" }).click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 15000,
    });
    // Past the debounce, the held-open RPC and anything the unmount flush could still run.
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS + 1500);
    record(
      tag + " no draft survives a publish with a timer in flight",
      db.drafts.size === 0,
      `drafts=${db.drafts.size} payload=${JSON.stringify([...db.drafts.values()][0] || null).slice(0, 160)}`,
    );
    const firstId = db.rpcPayloads[0] && db.rpcPayloads[0].id;
    record(tag + " the first publish carried a post id", !!firstId, String(firstId));

    // The consequence of the resurrection: the reopen restored the dead draft and the next publish
    // reused the consumed id. With no draft to restore, the composer opens empty and mints a fresh
    // one. ComposerShell also clears postId on publish, so nothing stale is left in memory either.
    const idsBefore = db.posts.map((r) => r.id);
    await page.click('[data-testid="compose"]');
    await dialog.waitFor();
    record(
      tag + " the composer reopens empty after a publish",
      (await textarea().inputValue()) === "",
      (await textarea().inputValue()).slice(0, 80),
    );
    await textarea().fill("A second post from the same session.");
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS + 400);
    await dialog.getByRole("button", { name: "Publish" }).click();
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
      timeout: 15000,
    });
    const secondId = db.rpcPayloads[1] && db.rpcPayloads[1].id;
    record(
      tag + " reopening after a publish mints a fresh post id",
      !!secondId && secondId !== firstId,
      `${firstId} -> ${secondId}`,
    );
    record(
      tag + " the minted id was not already a published post",
      !!secondId && !idsBefore.includes(secondId),
      String(secondId),
    );
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS + 1500);
    record(
      tag + " no draft survives the second publish either",
      db.drafts.size === 0,
      `drafts=${db.drafts.size}`,
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await page.screenshot({ path: path.join(OUT, `${tag}-ERROR.png`) }).catch(() => {});
  }
  record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
}

// Shell, Feed lenses, quick-look overlay, notifications: one run per viewport, light theme.
async function runShell(browserType, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-shell`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 8);
  // 62-A: seed-1 (another member's post) carries three reactions, two from the viewer's network
  // and one `other` from outside it; seed-0 (the viewer's own post) carries one, for the author's
  // sheet; the viewer has five picker recents, so the bar's strip overflows at 390.
  const F2 = "00000000-0000-4000-8000-0000000000f2";
  const F3 = "00000000-0000-4000-8000-0000000000f3";
  const F4 = "00000000-0000-4000-8000-0000000000f4";
  const lerato = {
    id: F2,
    name: "Lerato Khumalo",
    handle: "lerato-khumalo",
    avatar_path: null,
    headline: "Builder",
  };
  const ngozi = {
    id: F3,
    name: "Ngozi Okafor",
    handle: "ngozi-okafor",
    avatar_path: null,
    headline: "Designer",
  };
  const kwame = {
    id: F4,
    name: "Kwame Mensah",
    handle: "kwame-mensah",
    avatar_path: null,
    headline: "Engineer",
  };
  const at = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  db.reactions.push(
    {
      member_id: F2,
      post_id: "seed-1",
      kind: "celebrate",
      emoji: null,
      created_at: at(3),
      person: lerato,
      network: true,
    },
    {
      member_id: F3,
      post_id: "seed-1",
      kind: "other",
      emoji: "🔥",
      created_at: at(2),
      person: ngozi,
      network: false,
    },
    {
      member_id: F4,
      post_id: "seed-1",
      kind: "asante",
      emoji: null,
      created_at: at(1),
      person: kwame,
      network: true,
    },
    {
      member_id: F2,
      post_id: "seed-0",
      kind: "asante",
      emoji: null,
      created_at: at(1),
      person: lerato,
      network: true,
    },
  );
  db.picks = ["🔥", "🚀", "👍️", "🌍️", "✨"];
  await mockSupabase(page, db);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await signIn(page);
    const stamp = await page.getAttribute("html", "data-shell");
    record(tag + " shell mount stamp set", !!stamp);
    // Session 23: the lens bar's labels-fit answer is checked against the layout it produced, after
    // the document's fonts have settled, because the founder's iPhone rendered labels over their
    // neighbours' icons at 390 while both engines here read the bar as fitting (G36). When the bar
    // shows labels, no tab's content may exceed its box; when it shows icons first, the labels did
    // not fit and the bar said so.
    const lensFit = await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const bar = document.querySelector('[role="tablist"][aria-label="Lens"]');
      if (!bar) return null;
      const tabs = Array.from(bar.querySelectorAll('[role="tab"]'));
      return {
        mode: bar.getAttribute("data-lensbar"),
        track: bar.clientWidth,
        overflowing: tabs
          .filter((t) => t.scrollWidth > t.clientWidth + 1)
          .map((t) => t.getAttribute("data-lens") + ":" + t.scrollWidth + ">" + t.clientWidth),
        barOverflow: bar.scrollWidth > bar.clientWidth + 1,
        // Fix PR 09 (1515) amends Fix PR 08's reading: the strip's scroller is the rounded track,
        // at its column's width, and the seat never scrolls. Where the track overflows, it is the
        // strip and the active lens is in the track's view.
        seat: (() => {
          const seat = bar.closest("[data-lens-seat]");
          const on = bar.querySelector('[role="tab"][aria-selected="true"]');
          if (!seat || !on) return null;
          const r = bar.getBoundingClientRect();
          const a = on.getBoundingClientRect();
          return {
            sw: seat.scrollWidth,
            cw: seat.clientWidth,
            sl: seat.scrollLeft,
            strip: getComputedStyle(bar).overflowX === "auto",
            activeIn: a.left >= r.left - 0.5 && a.right <= r.right + 0.5,
          };
        })(),
        // What the bar measured: its probe's labels, as active and as inactive tabs. The probe is
        // the bar's root's (Fix PR 09 framed the track, so the root is no longer its parent).
        probe: Array.from(
          (bar.closest(".strand-lens") &&
            bar.closest(".strand-lens").querySelectorAll("[data-probe]")) ||
            [],
        ).map((e) => e.getAttribute("data-probe")[0] + Math.round(e.getBoundingClientRect().width)),
      };
    });
    // Fix PR 08 amended this check under 1465; Fix PR 09 amends it again under 1515. The seat never
    // scrolls and is never wider than its column; the track scrolls only as the strip, with the
    // active lens in its view. No tab's label exceeds its box, as before.
    record(
      tag +
        " lens bar: with fonts settled, no tab's label exceeds its box, the seat does not scroll and the track scrolls only as the strip",
      !!lensFit &&
        lensFit.overflowing.length === 0 &&
        !!lensFit.seat &&
        lensFit.seat.sw <= lensFit.seat.cw + 1 &&
        lensFit.seat.sl === 0 &&
        (!lensFit.barOverflow || (lensFit.seat.strip && lensFit.seat.activeIn)),
      JSON.stringify(lensFit),
    );
    // Ruling 916: kept for the closing summary, so a green run states the mode it read.
    if (lensFit)
      lensModes.push({
        arm: tag,
        width: w,
        mode: lensFit.mode,
        track: lensFit.track,
        probe: lensFit.probe,
      });
    // G48 (ruling 952): selection must not be a layout input. The bar used to give the active tab
    // its content width and the others an equal share of what was left, so moving the selection
    // moved every seat and the member's next tap landed on the neighbour. The G36 check above reads
    // the bar in one selection state and cannot see that; this one reads the same seats twice,
    // across the selection the arm was already going to make. Compact only, at 390, which is where
    // the taps are and where the prototype's reading was taken.
    const seatsNow = () =>
      page.evaluate(() => {
        const bar = document.querySelector('[role="tablist"][aria-label="Lens"]');
        if (!bar) return null;
        const t = bar.getBoundingClientRect();
        return {
          track: { x: +t.x.toFixed(2), w: +t.width.toFixed(2) },
          // Fix PR 08: in the track's own coordinates. Fix PR 09 (1515): the track is now what
          // scrolls the active lens into view, so its scroll offset is added back, and a scroll is
          // still not a redistribution.
          seats: Array.from(bar.querySelectorAll('[role="tab"]')).map((el) => {
            const r = el.getBoundingClientRect();
            return {
              id: el.getAttribute("data-lens"),
              x: +(r.x - t.x + bar.scrollLeft).toFixed(2),
              w: +r.width.toFixed(2),
              on: el.getAttribute("aria-selected") === "true",
            };
          }),
        };
      });
    const seatsBefore = w === 390 ? await seatsNow() : null;
    // Lens in the URL, back-button safe.
    await page.click('[role="tablist"][aria-label="Lens"] [data-lens="saved"]');
    await page.waitForURL("**/feed?lens=saved");
    await page.locator('[data-testid="feed-empty"][data-lens="saved"]').waitFor({ timeout: 10000 });
    if (w === 390) {
      const seatsAfter = await seatsNow();
      // The track itself must not have moved either, or the comparison is measuring the column and
      // not the distribution. Reported in the detail so a failure says which of the two it was.
      const trackSame =
        !!seatsBefore && !!seatsAfter && Math.abs(seatsBefore.track.w - seatsAfter.track.w) < 0.5;
      const moved = [];
      if (seatsBefore && seatsAfter)
        for (const b of seatsBefore.seats) {
          const a = seatsAfter.seats.find((s) => s.id === b.id);
          if (!a) moved.push(`${b.id}:gone`);
          else if (Math.abs(a.x - b.x) >= 0.5 || Math.abs(a.w - b.w) >= 0.5)
            moved.push(`${b.id}:${b.x}+${b.w}->${a.x}+${a.w}`);
        }
      record(
        tag + " lens bar: selecting a lens moves no seat (G48, ruling 952)",
        trackSame && moved.length === 0 && !!seatsBefore && seatsBefore.seats.length > 1,
        JSON.stringify({ trackSame, moved, before: seatsBefore, after: seatsAfter }),
      );
    }
    record(
      tag + " Saved lens: ?lens=saved, honest empty state, scope line",
      (await page.locator("[data-lens-scope]").textContent()).includes("saved"),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid="feed-empty"][data-lens="saved"]').waitFor({ timeout: 15000 });
    record(tag + " lens survives refresh", page.url().includes("lens=saved"));
    const stamp2 = await page.getAttribute("html", "data-shell");
    await page.click('[role="tablist"][aria-label="Lens"] [data-lens="mine"]');
    await page.waitForURL("**/feed?lens=mine");
    await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
    record(
      tag + " Mine lens: only this member's posts",
      (await page.locator("[data-feed] article[data-c]").count()) === 4,
    );
    await page.goBack();
    await page.waitForURL("**/feed?lens=saved");
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/feed" && !u.search);
    await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
    record(
      tag + " back button restores All (no ?lens) with all posts",
      (await page.locator("[data-feed] article[data-c]").count()) === 8 &&
        (await page
          .locator('[role="tablist"][aria-label="Lens"] [role="tab"][aria-selected="true"]')
          .getAttribute("data-lens")) === "all",
    );
    record(
      tag + " shell did not remount across lens changes",
      (await page.getAttribute("html", "data-shell")) === stamp2,
    );
    // For You renders identically to All.
    await page.click('[role="tablist"][aria-label="Lens"] [data-lens="for-you"]');
    await page.waitForURL("**/feed?lens=for-you");
    await page.waitForTimeout(300);
    record(
      tag + " For You identical to All",
      (await page.locator("[data-feed] article[data-c]").count()) === 8,
    );
    await page.click('[role="tablist"][aria-label="Lens"] [data-lens="all"]');
    await page.waitForURL((u) => u.pathname === "/feed" && !u.search);
    await page.waitForTimeout(300);
    // Save and React: existence toggles, no counts.
    const first = page.locator("[data-feed] article[data-c]").nth(0);
    await first.locator('[data-testid="save"]').click();
    await page.waitForTimeout(400);
    await first.locator('[data-testid="react"]').click();
    await page.waitForTimeout(400);
    // 62-A: one tap on React places Asante through post_react, never a direct insert (415).
    const ownOnSeed0 = db.reactions.filter((r) => r.post_id === "seed-0" && r.member_id === UID);
    record(
      tag + " Save and React toggle own rows (aria-pressed), no count rendered",
      db.saves.length === 1 &&
        ownOnSeed0.length === 1 &&
        ownOnSeed0[0].kind === "asante" &&
        !(db.directReactionWrites > 0) &&
        (await first.locator('[data-testid="save"]').getAttribute("aria-pressed")) === "true" &&
        (await first.locator('[data-testid="react"]').getAttribute("aria-pressed")) === "true" &&
        !/\b\d+ (likes|reactions|saves)\b/i.test(await first.textContent()),
      "own rows on seed-0: " +
        JSON.stringify(ownOnSeed0.map((r) => r.kind)) +
        "; direct writes " +
        (db.directReactionWrites || 0),
    );
    // 62-A (SPEC 5, 1822): the summary in the action row between Respond and Save on seed-1:
    // glyphs in fixed order with the neutral other mark, up to two photos of the viewer's network,
    // the names line at medium and expanded only, no digit anywhere.
    const second = page.locator("[data-feed] article[data-c]").nth(1);
    const summary = second.locator("[data-footer-summary] [data-reaction-summary]");
    await summary.waitFor({ timeout: 10000 });
    const summaryText = (await summary.textContent()) || "";
    const names = second.locator("[data-summary-names]");
    const namesText = (await names.count()) ? (await names.textContent()) || "" : "";
    record(
      tag +
        (w < 640
          ? " reaction summary in the action row: glyphs and photos, no names at compact"
          : " reaction summary in the action row: glyphs, photos and the names line"),
      (await summary.getAttribute("data-summary-kinds")) === "asante,celebrate" &&
        (await summary.getAttribute("data-summary-other")) === "1" &&
        (await second.locator("[data-reaction-summary] [data-summary-glyph]").count()) === 3 &&
        (await summary.getAttribute("data-summary-people")) === "2" &&
        (w < 640
          ? (await names.count()) === 0
          : namesText === "Kwame Mensah, Lerato Khumalo and others") &&
        (await summary.getAttribute("aria-label")) ===
          "Reactions: Kwame Mensah, Lerato Khumalo and others. See who reacted",
      "kinds " +
        (await summary.getAttribute("data-summary-kinds")) +
        "; names " +
        JSON.stringify(namesText),
    );
    record(
      tag + " no digit inside the summary",
      !/\d/.test(summaryText),
      JSON.stringify(summaryText),
    );
    // The summary sits between Respond and Save.
    const respondBox = await second.locator('[data-testid="respond"]').boundingBox();
    const saveBox = await second.locator('[data-testid="save"]').boundingBox();
    const summaryBox = await summary.boundingBox();
    record(
      tag + " the summary sits between Respond and Save",
      !!respondBox &&
        !!saveBox &&
        !!summaryBox &&
        summaryBox.x >= respondBox.x + respondBox.width &&
        summaryBox.x + summaryBox.width <= saveBox.x + 1,
      JSON.stringify({
        respond: respondBox && respondBox.x,
        summary: summaryBox && [summaryBox.x, summaryBox.width],
        save: saveBox && saveBox.x,
      }),
    );
    // 62-A (SPEC 6, 1813): any reader opens the reader's sheet without reacting; rows for every
    // reactor the viewer may see, no tabs, no digit, no intent, View profile outside the network only.
    await summary.click();
    const who = page.locator('[role="dialog"][aria-label="Who reacted"]');
    await who.waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    const whoText = (await who.textContent()) || "";
    record(
      tag +
        " the reader's sheet opens without reacting: rows, no tabs, no digit, View profile outside the network only",
      (await who.locator('[data-who-reacted="reader"]').count()) === 1 &&
        (await who.locator("[data-reactor-row]").count()) === 3 &&
        (await who.locator('[role="tab"]').count()) === 0 &&
        (await who.locator("[data-row-reaction]").count()) === 3 &&
        (await who.locator("[data-view-profile]").count()) === 1 &&
        (await who.locator('[data-view-profile="ngozi-okafor"]').count()) === 1 &&
        (await who.locator('[data-person-link="kwame-mensah"]').count()) === 1 &&
        !/\d/.test(whoText) &&
        !whoText.includes("I can help") &&
        !db.reactions.some((r) => r.post_id === "seed-1" && r.member_id === UID),
      "rows " +
        (await who.locator("[data-reactor-row]").count()) +
        "; text " +
        JSON.stringify(whoText.slice(0, 120)),
    );
    await page.keyboard.press("Escape");
    await who.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    // 62-A (SPEC 3, 1821): the bar opens from React by a hover on pointer or a 500 ms hold on
    // touch; the six in fixed order, then the recents, then the plus pinned outside the strip.
    // H62-A1: on iPhone Safari the hold began a text selection across React and the text above it
    // (16 October, 04:56 PDT), and the selection held the touch so the bar could not be tapped. At
    // a touch cell the hold is a real touch where the engine gives one, Chromium through CDP
    // Input.dispatchTouchEvent held 700 ms, and the pointer events a touch raises on WebKit, whose
    // Linux port has no CDP. Neither headless engine runs iOS's loupe gesture (G305), so the line
    // that fails on main is the contract the gesture reads: React and its row answer user-select
    // none, and -webkit-touch-callout none where the engine knows the property, while the body
    // stays selectable; beside it, the hold leaves the page selection empty with the bar open, and
    // the bar's first glyph takes a touch tap.
    const reactBtn = second.locator('[data-testid="react"]');
    const holdReact = async () => {
      await reactBtn.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const s = document.getSelection();
        if (s) s.removeAllRanges();
      });
      if (w >= 1024) {
        await reactBtn.hover();
        return;
      }
      if (bname === "chromium") {
        const cdp = await ctx.newCDPSession(page);
        const b = await reactBtn.boundingBox();
        const point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        await page.waitForTimeout(700);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
        return;
      }
      await reactBtn.dispatchEvent("pointerdown", {
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
      });
      await page.waitForTimeout(700);
      await reactBtn.dispatchEvent("pointerup", {
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
      });
    };
    await holdReact();
    const bar = second.locator("[data-reaction-bar]");
    await bar.waitFor({ timeout: 10000 });
    await page.waitForTimeout(350);
    if (w < 1024) {
      const held = await second.evaluate((card) => {
        const s = document.getSelection();
        const btn = card.querySelector('[data-testid="react"]');
        const read = (el) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          return {
            select: cs.userSelect,
            webkitSelect: cs.webkitUserSelect,
            // Chromium does not know the property and answers undefined; WebKit answers its value.
            callout: cs.webkitTouchCallout === undefined ? "unknown" : cs.webkitTouchCallout,
          };
        };
        let body = null;
        const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode()))
          if (n.textContent.trim().length > 30) {
            body = n.parentElement;
            break;
          }
        return {
          selection: s ? { type: s.type, text: s.toString() } : null,
          react: read(btn),
          row: read(btn && btn.closest("footer")),
          body: read(body),
          bodyText: body ? body.textContent.slice(0, 40) : null,
        };
      });
      const refuses = (r) =>
        !!r &&
        r.select === "none" &&
        r.webkitSelect === "none" &&
        (r.callout === "unknown" || r.callout === "none");
      record(
        tag + " H62-A1: a 500 ms hold on React leaves the page selection empty with the bar open",
        !!held.selection && held.selection.type === "None" && held.selection.text === "",
        JSON.stringify(held.selection),
      );
      record(
        tag +
          " H62-A1: React and its row refuse selection and the callout; the body stays selectable",
        refuses(held.react) &&
          refuses(held.row) &&
          !!held.body &&
          held.body.select !== "none" &&
          held.body.webkitSelect !== "none",
        JSON.stringify({ react: held.react, row: held.row, body: held.body }),
      );
    }
    const order = await bar
      .locator("[data-reaction-entry]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-reaction-entry")));
    record(
      tag + " the bar: the six in fixed order, five recents newest first, the plus",
      order.slice(0, 6).join(",") === "asante,celebrate,learned,standing,help,build" &&
        order.slice(6).join(",") === "recent:🔥,recent:🚀,recent:👍️,recent:🌍️,recent:✨" &&
        (await bar.locator("[data-reaction-more]").count()) === 1 &&
        (await bar.locator('[data-reaction-entry="asante"]').getAttribute("aria-label")) ===
          "Asante, thank you" &&
        !db.reactions.some((r) => r.post_id === "seed-1" && r.member_id === UID),
      order.join(","),
    );
    const plusBefore = await bar.locator("[data-reaction-more]").boundingBox();
    const scrolled = await bar.locator("[data-reaction-strip]").evaluate((el) => {
      el.scrollLeft = 120;
      return el.scrollLeft;
    });
    await page.waitForTimeout(150);
    const plusAfter = await bar.locator("[data-reaction-more]").boundingBox();
    record(
      tag + " the bar's plus does not move when the strip scrolls",
      !!plusBefore &&
        !!plusAfter &&
        Math.abs(plusBefore.x - plusAfter.x) < 1 &&
        Math.abs(plusBefore.y - plusAfter.y) < 1 &&
        (w >= 640 || scrolled > 0),
      JSON.stringify({
        before: plusBefore && plusBefore.x,
        after: plusAfter && plusAfter.x,
        scrolled,
      }),
    );
    if (w < 1024) {
      // H62-A1: the bar's first glyph takes a touch tap once the hold is released, and the bar is
      // held open again for the pick below, which then changes Asante to Celebrate.
      const asante = bar.locator('[data-reaction-entry="asante"]');
      // Centred in the shell's scroller, so the tab bar at the bottom does not sit over the glyph.
      await asante.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await page.waitForTimeout(200);
      const ab = await asante.boundingBox();
      await page.touchscreen.tap(ab.x + ab.width / 2, ab.y + ab.height / 2);
      await page.waitForTimeout(400);
      const tapped = db.reactions.filter((r) => r.post_id === "seed-1" && r.member_id === UID);
      record(
        tag +
          " H62-A1: after the hold the bar's first glyph takes a touch tap: Asante lands through post_react and the bar closes",
        tapped.length === 1 &&
          tapped[0].kind === "asante" &&
          (await second.locator("[data-reaction-bar]").count()) === 0 &&
          (await reactBtn.getAttribute("aria-pressed")) === "true",
        JSON.stringify(tapped.map((r) => r.kind)),
      );
      await holdReact();
      await bar.waitFor({ timeout: 10000 });
      await page.waitForTimeout(350);
    }
    await bar.locator('[data-reaction-entry="celebrate"]').click();
    await page.waitForTimeout(400);
    const ownOnSeed1 = db.reactions.filter((r) => r.post_id === "seed-1" && r.member_id === UID);
    record(
      tag + " a pick on the bar reacts through post_react and closes the bar",
      ownOnSeed1.length === 1 &&
        ownOnSeed1[0].kind === "celebrate" &&
        (await second.locator("[data-reaction-bar]").count()) === 0 &&
        (await reactBtn.getAttribute("aria-pressed")) === "true",
      JSON.stringify(ownOnSeed1.map((r) => r.kind)),
    );
    // Read more expands the same card in place at /posts/:id; the Feed column's scroll is untouched.
    const scrollTop = () =>
      page.evaluate(() => document.querySelector('[data-scroller="feed"]').scrollTop);
    const third = page.locator("[data-feed] article[data-c]").nth(5);
    await third.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const before = await scrollTop();
    record(tag + " scrolled before opening", before > 0, "scrollTop " + before);
    const readMore = third.locator("[data-read-more]");
    record(tag + " long body clamped with Read more", (await readMore.count()) === 1);
    await readMore.click();
    await page.waitForURL("**/posts/seed-5");
    await third.locator("[data-show-less]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const during = await scrollTop();
    record(
      tag + " expanded in place: same card, real route, no dialog, scroll unchanged",
      (await page.locator("[data-feed] article[data-c]").count()) === 8 &&
        (await third.getAttribute("data-expanded")) === "1" &&
        (await third.locator("[data-read-more]").count()) === 0 &&
        (await page.locator('[role="dialog"]').count()) === 0 &&
        (await page.locator("[data-feed] article[data-expanded='1']").count()) === 1 &&
        Math.abs(during - before) <= 1,
      `before ${before} during ${during}`,
    );
    record(
      tag + " expansion: shell not remounted",
      (await page.getAttribute("html", "data-shell")) === stamp2,
    );
    await shot(page, `${tag}-expanded`);
    await noOverflow(page, tag + " expanded");
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/feed");
    await third.locator("[data-read-more]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const after = await scrollTop();
    record(
      tag + " back button collapses; scroll identical",
      (await third.getAttribute("data-expanded")) === "0" && Math.abs(after - before) <= 1,
      `before ${before} after ${after}`,
    );
    // Respond expands too; Show less collapses and pops the URL.
    const respond = third.locator('[data-testid="respond"]');
    await respond.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const before2 = await scrollTop();
    await respond.click();
    await page.waitForURL("**/posts/seed-5");
    await third.locator("[data-show-less]").waitFor({ timeout: 10000 });
    await third.locator("[data-show-less]").click();
    await page.waitForURL((u) => u.pathname === "/feed");
    await page.waitForTimeout(300);
    const after2 = await scrollTop();
    record(
      tag + " Respond expands; Show less collapses and returns the URL; scroll identical",
      (await third.getAttribute("data-expanded")) === "0" && Math.abs(after2 - before2) <= 1,
      `before ${before2} after ${after2}`,
    );
    // Direct load of /posts/:id renders the expanded card as page content with Back to Feed.
    await page.goto(BASE + "/posts/seed-1", { waitUntil: "networkidle" });
    const direct = page.locator('[data-direct-post="seed-1"]');
    await direct.locator("article[data-c]").waitFor({ timeout: 15000 });
    record(
      tag + " direct /posts/:id: shell, expanded card as page content, Back to Feed, no dialog",
      (await page.locator("[data-app-header]").count()) === 1 &&
        (await direct.locator("article[data-c]").count()) === 1 &&
        (await direct.locator("[data-read-more]").count()) === 0 &&
        (await direct.locator("[data-show-less]").count()) === 0 &&
        (await page.locator('[data-testid="back-to-feed"]').count()) === 1 &&
        (await page.locator('[role="dialog"]').count()) === 0 &&
        (await page.locator("[data-sheet-scrim]").count()) === 0,
    );
    await shot(page, `${tag}-direct`);
    await page.click('[data-testid="back-to-feed"]');
    await page.waitForURL((u) => u.pathname === "/feed");
    await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
    record(tag + " Back to Feed from the direct view lands on Feed", true);
    // The three remaining C stubs render inside the same shell (Connect is a real surface since
    // Brief 4, covered by tests/connect.cjs, and Convene since Brief 9, covered by
    // tests/discovery.cjs); Home returns to Feed; no remount.
    const stampBefore = await page.getAttribute("html", "data-shell");
    await page.locator('nav[aria-label="Pulse"] button', { hasText: "Collaborate" }).click();
    await page.waitForURL("**/collaborate");
    await page.locator('[data-testid="c-stub"][data-c="collaborate"]').waitFor({ timeout: 10000 });
    record(
      tag + " /collaborate: stub inside the shell, Collaborate active, no remount",
      (await page.locator('[data-testid="c-stub"]').textContent()).includes(
        "Collaborate is next",
      ) &&
        (
          await page.locator('nav[aria-label="Pulse"] [aria-current="page"]').textContent()
        ).includes("Collaborate") &&
        (await page.getAttribute("html", "data-shell")) === stampBefore &&
        (await page.locator("[data-app-header]").count()) === 1,
    );
    await shot(page, `${tag}-stub`);
    await noOverflow(page, tag + " stub");
    await page.click('[data-testid="to-feed"]');
    await page.waitForURL((u) => u.pathname === "/feed");
    record(
      tag + " stub's Feed link returns Home without remount",
      (await page.getAttribute("html", "data-shell")) === stampBefore,
    );
    // Notifications: no dot without rows, empty list; dot with a real unread row; opening marks read.
    record(
      tag + " bell: no dot without a real unread row",
      (await page.locator('[data-testid="bell-dot"]').count()) === 0,
    );
    await page.click('[data-testid="bell"]');
    const list = page.locator('[role="dialog"][aria-label="Notifications"]');
    await list.waitFor({ timeout: 10000 });
    await list.locator('[data-testid="notifications-empty"]').waitFor({ timeout: 10000 });
    record(tag + " bell opens the list with an honest empty state", true);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-notifications-empty`);
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"][aria-label="Notifications"]', {
      state: "detached",
    });
    // Ruling 547: a kind whose destination has no surface is suppressed from the registry, and a row
    // of that kind renders nothing and raises no dot. space_role_approved is one of G19's three: it
    // is a real notification_kind in the database, so the row is as real as any other, and the point
    // is that a member is never sent to a list with nothing in it.
    db.notifications.push({
      id: "n0",
      recipient_member_id: UID,
      kind: "space_role_approved",
      c_category: "collaborate",
      actor_kind: null,
      actor_id: null,
      object_kind: "space",
      object_id: null,
      read_at: null,
      created_at: new Date(Date.now() - 9 * 60e3).toISOString(),
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    record(
      tag + " a destination-less kind raises no dot (ruling 547)",
      (await page.locator('[data-testid="bell-dot"]').count()) === 0,
    );
    await page.click('[data-testid="bell"]');
    await list.waitFor({ timeout: 10000 });
    await list.locator('[data-testid="notifications-empty"]').waitFor({ timeout: 10000 });
    record(
      tag + " a destination-less kind renders no row (ruling 547, grounded-or-empty)",
      (await list.locator("button[data-kind]").count()) === 0,
    );
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"][aria-label="Notifications"]', {
      state: "detached",
    });
    db.notifications.length = 0;
    db.notifications.push({
      id: "n1",
      recipient_member_id: UID,
      kind: "connection_accepted",
      c_category: "connect",
      actor_kind: null,
      actor_id: null,
      object_kind: null,
      object_id: null,
      read_at: null,
      created_at: new Date(Date.now() - 5 * 60e3).toISOString(),
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid="bell-dot"]').waitFor({ timeout: 15000 });
    record(
      tag + " bell: a dot, never a numeral, once an unread row exists",
      (await page.locator('[data-testid="bell"]').textContent()).trim() === "" &&
        (await page.locator('[data-testid="bell-dot"]').count()) === 1,
    );
    await page.click('[data-testid="bell"]');
    await list.waitFor({ timeout: 10000 });
    const row = list.locator('button[data-kind="connection_accepted"]');
    await row.waitFor({ timeout: 10000 });
    // Design pass 01, B17: ruling 461 retitled the row now that making an intro has left the
    // composer (417), and ruling 490 puts the destination in words on every row. Ruling 480 puts a
    // hidden Unread label in a 24 hit area, so the dot is named rather than only coloured.
    record(
      tag + " list shows the real row with the Connect glyph, spec copy, and unread state",
      (await row.getAttribute("data-unread")) === "1" &&
        (await row.locator('[role="img"][aria-label="Connect"]').count()) === 1 &&
        (await row.textContent()).includes("accepted your connection request."),
    );
    record(
      tag + " the row names its destination in words (ruling 490)",
      (await row.getAttribute("data-destination")) === "Opens their profile" &&
        (await row.locator("[data-destination-line]").innerText()) === "Opens their profile",
    );
    record(
      tag + " the unread dot carries a hidden label in a 24 hit area (ruling 480)",
      (await row.locator('[data-unread-dot][role="img"][aria-label="Unread"]').count()) === 1 &&
        (await row.locator("[data-unread-dot]").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return Math.round(r.width) >= 24 && Math.round(r.height) >= 24;
        })),
    );
    await page.waitForTimeout(300);
    await shot(page, `${tag}-notifications`);
    await row.click();
    await page.waitForTimeout(600);
    record(
      tag + " opening a row marks it read (read_at only) and the dot goes",
      db.reads.length === 1 &&
        db.reads[0] === "n1" &&
        (await page.locator('[data-testid="bell-dot"]').count()) === 0 &&
        (await row.getAttribute("data-unread")) === null,
    );
    await page.keyboard.press("Escape");
    // c keypress opens the composer from the shell.
    await page.waitForSelector('[role="dialog"][aria-label="Notifications"]', {
      state: "detached",
    });
    await page.keyboard.press("c");
    await page.locator('section[role="dialog"][aria-label="Compose"]').waitFor({ timeout: 10000 });
    record(tag + " c keypress opens the one composer from the shell", true);
    await page.keyboard.press("Escape");
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

/**
 * Fix PR 08 (handoff 51): the lens seat on the three lens surfaces, one arm per viewport.
 *
 * Ruling 1466 (W71) as 1501 rules it: the in-page bar's top edge, read on the Feed, Connect and
 * Convene, is one value below expanded. At expanded Connect's and Convene's are one value and the
 * Feed's is read and printed but not compared: its bar follows the composer and the greeting (1501).
 * Every reading is printed as a `SEAT` line on every run, passing or failing (916, 930).
 *
 * Ruling 1468 (W74), at 390 only: past 72px a lens change from the header's bar leaves the bar in
 * the header and the shell's scroller at or below the docking point, the seat's bottom edge, on all
 * three surfaces; with the bar in the page a lens change leaves the scroll where it was.
 *
 * Rulings 1502 and 1504, at medium and expanded: the Feed's and Connect's bar is justified across
 * its column, read from the seats themselves (track equal to the column, no seat under its word, the
 * same spare in every seat), with a `JUSTIFY` line naming the sum against the column; Convene's lens
 * row is exempt and its bar stays narrower than the row.
 *
 * Ruling 1503, at 820 and 1280 on Convene: a lens change made 400px past the lanes' top returns the
 * column to the lanes' top, and one made at the lanes' top moves nothing. The lanes' top is read as
 * Discovery reads it, the column's first block after the header row, and printed as a `LANES` line.
 */
const SEAT_SURFACES = [
  { id: "feed", path: "/feed", label: "Lens", root: "[data-feed]" },
  { id: "connect", path: "/connect", label: "Connect lens", root: '[data-testid="connect"]' },
  { id: "convene", path: "/convene", label: "Convene lens", root: "[data-discovery]" },
];

async function runLensSeat(browserType, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-lens-seat`;
  armStart(tag);
  const tier = tierOf(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 8);
  // Required here rather than at the top: discovery.cjs requires this module.
  require("./discovery.cjs").__seedDiscovery(db);
  await mockSupabase(page, db);
  // Ruling 357: the arm navigates between three surfaces, and WebKit reports a mocked REST fetch the
  // navigation cancels as an access-control error; that is the sandbox's, never the app's, and is
  // read as every other suite reads it (tests/mount.cjs, tests/discovery.cjs).
  const cancelled = new RegExp(
    `(?:^|[\\s/])${SB.replace(/\./g, "\\.")}\\S*\\s+due to access control checks\\.?$`,
  );
  const errors = [];
  page.on("pageerror", (e) => {
    const text = String(e);
    if (!cancelled.test(text)) errors.push(text);
  });
  const open = async (s) => {
    await page.goto(BASE + s.path, { waitUntil: "networkidle" });
    await page.locator(s.root).first().waitFor({ timeout: 20000 });
    await page
      .locator(`${s.root} [data-lens-seat] [role="tablist"], [data-layout-top] [role="tablist"]`)
      .first()
      .waitFor({ timeout: 20000 });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await page.waitForTimeout(300);
  };
  const barTop = (label) =>
    page.evaluate((label) => {
      const bar = [...document.querySelectorAll(`[role="tablist"][aria-label="${label}"]`)].find(
        (b) => !b.closest("[data-app-header]"),
      );
      return bar ? +bar.getBoundingClientRect().top.toFixed(2) : null;
    }, label);
  try {
    await signIn(page);
    // Rulings 1502 and 1504, at medium and expanded: the Feed's and Connect's bar is justified across
    // its column. Each seat's natural width is its own content (glyph, gap, word with its 700
    // reservation) plus padding and border, floored at the 44 seat; the spare is what it was grown
    // by. Convene's lens row is exempt and its bar stays narrower than the row (1170).
    const justified = (s) =>
      page.evaluate(
        ({ root, label }) => {
          const bar = document.querySelector(
            `${root} [data-lens-seat] [role="tablist"][aria-label="${label}"]`,
          );
          if (!bar) return null;
          const seat = bar.closest("[data-lens-seat]");
          const cs = getComputedStyle(seat);
          const column =
            seat.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const tabs = [...bar.querySelectorAll('[role="tab"]')].map((t) => {
            const ts = getComputedStyle(t);
            const kids = [...t.children];
            const inner =
              kids.reduce((a, k) => a + k.getBoundingClientRect().width, 0) +
              (parseFloat(ts.columnGap) || 0) * Math.max(0, kids.length - 1);
            const natural = Math.max(
              44,
              inner +
                parseFloat(ts.paddingLeft) +
                parseFloat(ts.paddingRight) +
                parseFloat(ts.borderLeftWidth) +
                parseFloat(ts.borderRightWidth),
            );
            const w = t.getBoundingClientRect().width;
            return {
              id: t.getAttribute("data-lens"),
              w: +w.toFixed(2),
              natural: +natural.toFixed(2),
              spare: +(w - natural).toFixed(2),
            };
          });
          const n = tabs.length;
          return {
            column: +column.toFixed(2),
            track: +bar.getBoundingClientRect().width.toFixed(2),
            sum: +(8 + 2 * (n - 1) + tabs.reduce((a, t) => a + t.natural, 0)).toFixed(2),
            spread: bar.getAttribute("data-lensbar-spread"),
            tabs,
          };
        },
        { root: s.root, label: s.label },
      );
    const tops = {};
    for (const s of SEAT_SURFACES) {
      await open(s);
      tops[s.id] = await barTop(s.label);
      if (tier === "compact") continue;
      if (s.id === "convene") {
        const ex = await page.evaluate(() => {
          const bar = document.querySelector(
            '[data-layout-top] [role="tablist"][aria-label="Convene lens"]',
          );
          const row = bar && bar.closest("[data-layout-top]");
          return bar && row
            ? {
                bar: +bar.getBoundingClientRect().width.toFixed(2),
                row: +row.getBoundingClientRect().width.toFixed(2),
              }
            : null;
        });
        record(
          tag + " convene: the lens row is exempt, its bar narrower than the row (1502, 1170)",
          !!ex && ex.bar < ex.row - 1,
          JSON.stringify(ex),
        );
        continue;
      }
      const j = await justified(s);
      console.log(
        `JUSTIFY ${tag} ${s.id} sum=${j && j.sum} column=${j && j.column} track=${j && j.track} spread=${j && j.spread}`,
      );
      const spares = j ? j.tabs.map((t) => t.spare) : [];
      record(
        tag + ` ${s.id}: the track spans its column's content width within 1px (1502, 1504)`,
        !!j && Math.abs(j.track - j.column) <= 1,
        JSON.stringify(j),
      );
      record(
        tag + ` ${s.id}: every seat is at least its own word's width (1465, 1504)`,
        !!j && j.tabs.every((t) => t.w >= t.natural - 0.5),
        JSON.stringify(j),
      );
      record(
        tag + ` ${s.id}: the spare width per seat is equal within 0.5px (1504)`,
        !!j && spares.length > 1 && Math.max(...spares) - Math.min(...spares) <= 0.5,
        JSON.stringify(j),
      );
    }
    console.log(
      `SEAT ${tag} tier=${tier} feed=${tops.feed} connect=${tops.connect} convene=${tops.convene}`,
    );
    const same = (a, b) => a !== null && b !== null && Math.abs(a - b) < 0.5;
    record(
      tier === "expanded"
        ? tag +
            " lens bar top edge: Connect and Convene equal; the Feed's follows its composer and greeting (1466, 1501)"
        : tag + " lens bar top edge: equal on Feed, Connect and Convene (1466)",
      tier === "expanded"
        ? same(tops.connect, tops.convene) && tops.feed !== null
        : same(tops.feed, tops.connect) && same(tops.connect, tops.convene),
      JSON.stringify(tops),
    );
    if (w === 820 || w === 1280) {
      // Ruling 1503: the lanes' top, measured as DiscoverySurface measures it.
      const lanes = () =>
        page.evaluate(() => {
          const sc = document.querySelector('[data-scroller="feed"]');
          const first =
            sc &&
            sc.querySelector(
              '[data-discovery] > :is([data-lanes], [data-lens-list], [data-empty-column], [aria-label="Loading Convene"])',
            );
          if (!sc || !first) return null;
          return {
            scroll: Math.round(sc.scrollTop),
            top: Math.round(
              first.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop,
            ),
            max: Math.round(sc.scrollHeight - sc.clientHeight),
          };
        });
      const setTop = (y) =>
        page.evaluate((v) => {
          const sc = document.querySelector('[data-scroller="feed"]');
          sc.scrollTop = v;
          sc.dispatchEvent(new Event("scroll"));
        }, y);
      const lensTo = async () => {
        await page
          .locator('[data-layout-top] [role="tablist"] [role="tab"][aria-selected="false"]')
          .first()
          .click();
        await page.waitForTimeout(900);
      };
      await open(SEAT_SURFACES[2]);
      const at = await lanes();
      console.log(`LANES ${tag} top=${at ? at.top : null} max=${at ? at.max : null}`);
      await setTop((at ? at.top : 0) + 400);
      await page.waitForTimeout(250);
      const past = await lanes();
      await lensTo();
      const back = await lanes();
      record(
        tag + " convene: a lens change 400px past the lanes' top returns to the lanes' top (1503)",
        // The column cannot scroll past its own end, so where the new lens is shorter than the lanes'
        // top plus the column (Communities at 820 on the mock), the top it can reach is its end.
        !!past &&
          !!back &&
          past.scroll > past.top &&
          Math.abs(back.scroll - Math.min(back.top, back.max)) <= 1,
        JSON.stringify({ past, back }),
      );
      await setTop(back ? back.top : 0);
      await page.waitForTimeout(250);
      const still = await lanes();
      await lensTo();
      const after = await lanes();
      record(
        tag + " convene: a lens change at the lanes' top moves nothing (1503)",
        !!still && !!after && Math.abs(after.scroll - still.scroll) <= 1,
        JSON.stringify({ still, after }),
      );
    }
    if (w === 390) {
      const scroller = () =>
        page.evaluate(() => {
          const sc = document.querySelector('[data-scroller="feed"]');
          const seat = document.querySelector('[data-lens-seat="flow"]');
          if (!sc || !seat) return null;
          const dock =
            seat.getBoundingClientRect().bottom - sc.getBoundingClientRect().top + sc.scrollTop;
          return {
            top: Math.round(sc.scrollTop),
            dock: Math.round(dock),
            header: !!document.querySelector('[data-app-header] [role="tablist"]'),
            hidden: getComputedStyle(seat).visibility === "hidden",
          };
        });
      const setTop = (y) =>
        page.evaluate((v) => {
          const sc = document.querySelector('[data-scroller="feed"]');
          sc.scrollTop = v;
          sc.dispatchEvent(new Event("scroll"));
        }, y);
      for (const s of SEAT_SURFACES) {
        await open(s);
        // The bar in the page: a lens change leaves the scroll where it was. 8, so the tab is wholly
        // in the scroller's view and the click's own scroll-into-view has nothing to move.
        await setTop(8);
        await page.waitForTimeout(250);
        const inPage = await page
          .locator(`${s.root} [data-lens-seat] [role="tab"][aria-selected="false"]`)
          .first();
        await inPage.click();
        await page.waitForTimeout(600);
        const stay = await scroller();
        record(
          tag +
            ` ${s.id}: with the bar in the page a lens change leaves the scroll where it was (1468)`,
          !!stay && Math.abs(stay.top - 8) <= 1 && !stay.header,
          JSON.stringify(stay),
        );
        // The bar in the header: past 72px, a lens change from the header's bar.
        await setTop(400);
        await page
          .locator('[data-app-header] [role="tablist"] [role="tab"]')
          .first()
          .waitFor({ timeout: 10000 });
        const before = await scroller();
        await page
          .locator('[data-app-header] [role="tablist"] [role="tab"][aria-selected="false"]')
          .first()
          .click();
        await page.waitForTimeout(800);
        const after = await scroller();
        record(
          tag +
            ` ${s.id}: past 72px a lens change keeps the bar in the header and the scroller at or below the docking point (1468)`,
          !!after && after.header && after.hidden && after.top > 72 && after.top >= after.dock - 1,
          JSON.stringify({ before, after }),
        );
      }
    }
    // Fix PR 09, W86 (G225 item 3): the shell's scroller stepped from 0 to 400 and back in steps of 8,
    // the Feed then Connect, at 390 and 820. Each row is the scroller's top, its range, the shell's
    // data-scrolled, the header's data-centre, whether a header tablist exists and the in-page seat's
    // visibility. Each table is printed as a `STEP` line and the first row where the Feed and Connect
    // differ as `STEPDIFF` (930); a fling, one burst of wheel events, is printed as `FLING`. At 390 the
    // Feed's rows are a standing check: from the first step past 72 to 400 and back to the last step
    // past 72, the header holds the Feed's bar.
    if (w === 390 || w === 820) {
      const row = () =>
        page.evaluate(() => {
          const sc = document.querySelector('[data-scroller="feed"]');
          const t = document.querySelector("[data-tier]");
          const hd = document.querySelector("[data-app-header]");
          const seat = document.querySelector('[data-lens-seat="flow"]');
          return {
            top: Math.round(sc.scrollTop),
            max: Math.round(sc.scrollHeight - sc.clientHeight),
            s: t ? t.getAttribute("data-scrolled") : null,
            c: hd ? hd.getAttribute("data-centre") : null,
            t: !!document.querySelector('[data-app-header] [role="tablist"]'),
            v: seat ? getComputedStyle(seat).visibility : null,
          };
        });
      const frame = () =>
        page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        );
      const fmt = (r) => `${r.top}/${r.max}/${r.s}/${r.c}/${r.t ? 1 : 0}/${r.v}`;
      const tables = {};
      for (const s of SEAT_SURFACES.slice(0, 2)) {
        await open(s);
        const ys = [];
        for (let y = 0; y <= 400; y += 8) ys.push(y);
        for (let y = 392; y >= 0; y -= 8) ys.push(y);
        const rows = [];
        for (const y of ys) {
          await page.evaluate((v) => {
            document.querySelector('[data-scroller="feed"]').scrollTop = v;
          }, y);
          await frame();
          rows.push({ y, ...(await row()) });
        }
        tables[s.id] = rows;
        console.log(`STEP ${tag} ${s.id} ` + rows.map((r) => `${r.y}:${fmt(r)}`).join(" "));
        // The fling: one burst of wheel events over the scroller, then every frame for a second.
        await page.evaluate(() => {
          document.querySelector('[data-scroller="feed"]').scrollTop = 0;
        });
        await frame();
        try {
          const box = await page.locator('[data-scroller="feed"]').boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 60);
          const fl = await page.evaluate(
            () =>
              new Promise((done) => {
                const out = [];
                const t0 = performance.now();
                const tick = () => {
                  const sc = document.querySelector('[data-scroller="feed"]');
                  const t = document.querySelector("[data-tier]");
                  out.push({
                    top: Math.round(sc.scrollTop),
                    s: t && t.getAttribute("data-scrolled"),
                    t: !!document.querySelector('[data-app-header] [role="tablist"]'),
                  });
                  if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
                  else done(out);
                };
                requestAnimationFrame(tick);
              }),
          );
          const lost = fl.find((r) => r.top > 72 && !r.t);
          console.log(
            `FLING ${tag} ${s.id} frames=${fl.length} last=${JSON.stringify(fl[fl.length - 1])} first-without-bar-past-72=${JSON.stringify(lost || null)}`,
          );
        } catch (e) {
          console.log(`FLING ${tag} ${s.id} not read: ${String(e).split("\n")[0].slice(0, 160)}`);
        }
      }
      const key = (r) => `${r.s}/${r.c}/${r.t}/${r.v}`;
      const diff = tables.feed.findIndex(
        (r, i) => tables.connect[i] && key(r) !== key(tables.connect[i]),
      );
      console.log(
        `STEPDIFF ${tag} ` +
          (diff < 0
            ? "none: the Feed's rows match Connect's at every step"
            : `y=${tables.feed[diff].y} feed=${fmt(tables.feed[diff])} connect=${fmt(tables.connect[diff])}`),
      );
      if (w === 390) {
        const past = tables.feed.filter((r) => r.top > 72);
        const held = past.filter((r) => !(r.t && r.c === "lens"));
        record(
          tag +
            " feed: stepped by 8 to 400 and back, the header holds the Feed's bar at every step past 72 (W86)",
          past.length > 0 && held.length === 0,
          JSON.stringify({ past: past.length, without: held.slice(0, 3) }),
        );
      }
    }
    // Fix PR 09, W87 (G225 item 4; 1468), at 390: dock the bar, change to every other lens from the
    // header, and sample every animation frame for 1500 ms from the click: the scroller's top, its
    // range, the header's data-centre and the docking point (the seat's bottom edge in scroller
    // coordinates). Every frame holds the header's bar and a top at or below the docking point. Run
    // with the mock's normal content and again with a lens seeded to one item (the Feed's Mine,
    // Connect's Suggested, every Convene lane); the first losing frame is printed as `FRAME` (930).
    if (w === 390) {
      const seedings = [
        ["normal", () => {}],
        [
          "one",
          () => {
            let mine = 0;
            for (const p of db.posts)
              if (p.author_id === UID && ++mine > 1) {
                p.author_id = "00000000-0000-4000-8000-0000000000f2";
                p.created_by = "00000000-0000-4000-8000-0000000000f2";
              }
            db.connect.dismissed = CONNECT_SUGGESTED.slice(1).map((c) => c.id);
            const sec = db.discovery.sections || {};
            for (const k of Object.keys(sec))
              if (Array.isArray(sec[k])) sec[k] = sec[k].slice(0, 1);
          },
        ],
      ];
      for (const [seeding, seed] of seedings) {
        seed();
        for (const s of SEAT_SURFACES) {
          await open(s);
          const ids = await page
            .locator(`${s.root} [data-lens-seat] [role="tab"]`)
            .evaluateAll((els) => els.map((e) => e.getAttribute("data-lens")));
          const changes = [];
          for (const id of [...ids.slice(1), ids[0]]) {
            await page.evaluate(() => {
              const sc = document.querySelector('[data-scroller="feed"]');
              sc.scrollTop = 400;
            });
            const dockedTab = page.locator(
              `[data-app-header] [role="tablist"] [data-lens="${id}"]`,
            );
            const ready = await dockedTab
              .waitFor({ timeout: 5000 })
              .then(() => true)
              .catch(() => false);
            if (!ready) {
              changes.push({ to: id, docked: false });
              continue;
            }
            await page.evaluate(() => {
              window.__lensFrames = [];
              const t0 = performance.now();
              const tick = () => {
                const sc = document.querySelector('[data-scroller="feed"]');
                const hd = document.querySelector("[data-app-header]");
                const seat = document.querySelector('[data-lens-seat="flow"]');
                window.__lensFrames.push({
                  t: Math.round(performance.now() - t0),
                  top: Math.round(sc.scrollTop),
                  max: Math.round(sc.scrollHeight - sc.clientHeight),
                  centre: hd ? hd.getAttribute("data-centre") : null,
                  bar: !!document.querySelector('[data-app-header] [role="tablist"]'),
                  dock: seat
                    ? Math.round(
                        seat.getBoundingClientRect().bottom -
                          sc.getBoundingClientRect().top +
                          sc.scrollTop,
                      )
                    : null,
                });
                if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
            await dockedTab.click();
            await page.waitForTimeout(1650);
            const frames = await page.evaluate(() => window.__lensFrames);
            const lost = frames.find(
              (f) => !f.bar || f.centre !== "lens" || f.dock === null || f.top < f.dock - 1,
            );
            console.log(
              `FRAME ${tag} ${seeding} ${s.id} ->${id} frames=${frames.length} first-lost=${JSON.stringify(lost || null)}`,
            );
            changes.push({ to: id, docked: true, frames: frames.length, lost: lost || null });
          }
          record(
            tag +
              ` ${s.id} (${seeding}): every frame for 1500 ms after a docked lens change holds the header's bar at or below the docking point (W87, 1468)`,
            changes.length > 0 && changes.every((c) => c.docked && c.frames > 10 && !c.lost),
            JSON.stringify(changes.filter((c) => !c.docked || c.lost).slice(0, 3)),
          );
        }
      }
    }
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

// The ten targeted checks of the B2.1 refinement handoff, per tier. Touch scroll capture and the
// drag-armed state are driven with synthetic events (a real finger or file drag cannot be scripted),
// so each asserts the event-level outcome: defaultPrevented on touchmove, the armed DOM before drop.
async function runTargeted(browserType, bname, [w, h]) {
  const tier = w < 640 ? "compact" : w > 1024 ? "expanded" : "medium";
  const tag = `${bname}-${w}x${h}-targeted`;
  armStart(tag);
  const browser = await launch(browserType);
  // Pointer context: check 2 needs a file drag, which only the pointer mode arms; every other
  // check reads the same on either input mode.
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: false,
    isMobile: false,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 10);
  await mockSupabase(page, db);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const feedTop = () =>
    page.evaluate(() => document.querySelector('[data-scroller="feed"]').scrollTop);
  const setFeedTop = (y) =>
    page.evaluate((y) => {
      document.querySelector('[data-scroller="feed"]').scrollTop = y;
    }, y);
  const centre = () => page.locator("[data-app-header]").getAttribute("data-centre");
  const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
  const closeComposer = async () => {
    await page.keyboard.press("Escape");
    await page.waitForSelector('section[role="dialog"][aria-label="Compose"]', {
      state: "detached",
    });
  };
  try {
    await signIn(page);
    await page.locator("[data-feed] article[data-c]").nth(9).waitFor({ timeout: 15000 });

    // 1. Scroll capture: wheel and touchmove inside the open composer never move the Feed.
    await setFeedTop(160);
    await page.waitForTimeout(100);
    const feedBefore = await feedTop();
    if (tier === "expanded") await page.click("[data-feed] [data-testid='compose']");
    else
      await page.click(
        '[data-testid="compose-floating"], [data-app-header] [data-testid="compose"]',
      );
    await dialog.waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    const ta = dialog.locator('textarea[aria-label="What is going on with you"]');
    await ta.fill(
      Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of a long draft.`).join("\n"),
    );
    await page.waitForTimeout(100);
    const taBox = await ta.boundingBox();
    await page.mouse.move(taBox.x + taBox.width / 2, taBox.y + taBox.height / 2);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    const scrimBox = await page.locator("[data-sheet-scrim]").boundingBox();
    await page.mouse.move(scrimBox.x + 8, scrimBox.y + 8);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    // Ruling 493 narrows the scroll lock: the scrim is cancelled, a vertical scroller inside is
    // consumed at its edges as before, a horizontal scroller keeps its wheel, and touch is left to
    // the browser. With showModal() the background is inert as well, so the page cannot move at all
    // rather than being held still by a cancelled event; the outcome is what is asserted.
    const lock = await page.evaluate(() => {
      const dlg = document.querySelector('section[role="dialog"]');
      const row = dlg.querySelector("[data-verb-row]");
      const fire = (target, dx, dy) => {
        const e = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaX: dx,
          deltaY: dy,
        });
        target.dispatchEvent(e);
        return e.defaultPrevented;
      };
      const touch = (target) => {
        const e = new Event("touchmove", { bubbles: true, cancelable: true });
        target.dispatchEvent(e);
        return e.defaultPrevented;
      };
      const scrim = document.querySelector("[data-sheet-scrim]");
      return {
        // The scrim is the one thing the lock still cancels.
        scrim: fire(scrim, 0, 300),
        // The chip row keeps its wheel: the Sheet's lock leaves a horizontal scroller alone, and
        // the row itself takes the vertical wheel sideways (ruling 493). The proof is the outcome,
        // not the flag: a lock that swallowed the event would leave scrollLeft where it was.
        chipRowMoved: row
          ? (() => {
              if (row.scrollWidth <= row.clientWidth) return true;
              row.scrollLeft = 0;
              fire(row, 0, 300);
              return row.scrollLeft > 0;
            })()
          : true,
        // Touch is the browser's.
        touchInside: touch(dlg),
      };
    });
    const feedAfterWheel = await feedTop();
    record(
      tag +
        " 1. composer open: the page cannot move behind it, the scrim is cancelled, the chip row keeps its wheel and touch is the browser's (ruling 493)",
      feedAfterWheel === feedBefore &&
        lock.scrim &&
        lock.chipRowMoved &&
        lock.touchInside === false,
      `feed ${feedBefore} -> ${feedAfterWheel} lock ${JSON.stringify(lock)}`,
    );

    // 2. Armed drop state before the drop lands; drop adds; leaving clears.
    if (tier !== "medium") {
      await ta.fill("");
      const armedSteps = await page.evaluate(async () => {
        const col = document.querySelector("[data-drop-target]");
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" }));
        const fire = (type) =>
          col.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
        const tick = () => new Promise((r) => setTimeout(r, 60));
        fire("dragenter");
        fire("dragover");
        await tick();
        const armedText = (document.querySelector("[data-drop-armed]") || {}).textContent || "";
        const armedAttr = col.getAttribute("data-armed");
        fire("dragleave");
        await tick();
        const afterLeave = col.getAttribute("data-armed");
        fire("dragenter");
        fire("dragover");
        await tick();
        const reArmed = col.getAttribute("data-armed");
        fire("drop");
        await tick();
        const afterDrop = col.getAttribute("data-armed");
        return { armedText, armedAttr, afterLeave, reArmed, afterDrop };
      });
      await page.waitForTimeout(600);
      const thumbs = await dialog.locator("img[alt='']").count();
      record(
        tag +
          " 2. drag over the fields arms (dashed C frame, tint, copy) before release; leaving clears; drop adds the image",
        armedSteps.armedAttr === "1" &&
          /Drop to add up to 4 images/.test(armedSteps.armedText) &&
          armedSteps.afterLeave === "0" &&
          armedSteps.reArmed === "1" &&
          armedSteps.afterDrop === "0" &&
          thumbs >= 1,
        JSON.stringify({ ...armedSteps, thumbs }),
      );
    }
    await closeComposer();

    if (tier !== "expanded") {
      // 3. Header swap at 72px, both directions, and a fast double crossing.
      await setFeedTop(0);
      await page.waitForTimeout(150);
      const atTop = await centre();
      const bellTop = await page.locator('[data-app-header] [data-testid="bell"]').count();
      await setFeedTop(120);
      await page.waitForTimeout(150);
      const past = await centre();
      const bellPast = await page.locator('[data-app-header] [data-testid="bell"]').count();
      const inFlowHidden = await page.evaluate(
        () => getComputedStyle(document.querySelector("[data-feed] [data-lens-anchor]")).visibility,
      );
      await setFeedTop(0);
      await page.waitForTimeout(150);
      const backTop = await centre();
      const bellBack = await page.locator('[data-app-header] [data-testid="bell"]').count();
      // Fast flick: cross the threshold twice inside one frame, ending above it.
      await page.evaluate(() => {
        const sc = document.querySelector('[data-scroller="feed"]');
        sc.scrollTop = 300;
        sc.scrollTop = 20;
        sc.scrollTop = 400;
        sc.scrollTop = 0;
      });
      await page.waitForTimeout(250);
      const flick1 = await centre();
      await page.evaluate(() => {
        const sc = document.querySelector('[data-scroller="feed"]');
        sc.scrollTop = 10;
        sc.scrollTop = 500;
        sc.scrollTop = 30;
        sc.scrollTop = 260;
      });
      await page.waitForTimeout(250);
      const flick2 = await centre();
      const headerH = (await page.locator("[data-app-header]").boundingBox()).height;
      record(
        tag +
          " 3. past 72px the header pill swaps to LensBar" +
          (tier === "compact" ? " and the bell leaves" : ", bell stays") +
          "; back above they return; fast flick settles on the final side; header stays one row",
        atTop === "compose" &&
          bellTop === 1 &&
          past === "lens" &&
          bellPast === (tier === "compact" ? 0 : 1) &&
          inFlowHidden === "hidden" &&
          backTop === "compose" &&
          bellBack === 1 &&
          flick1 === "compose" &&
          flick2 === "lens" &&
          headerH <= 58,
        JSON.stringify({ atTop, past, bellPast, inFlowHidden, backTop, flick1, flick2, headerH }),
      );

      // 4. Floating composer entry: shows while scrolling, hides 2.5s after, opens the composer.
      await setFeedTop(0);
      await page.waitForTimeout(150);
      const fab = page.locator("[data-fab]");
      const fabAtTop = await fab.getAttribute("data-shown");
      await setFeedTop(200);
      await page.waitForTimeout(350);
      const fabMoving = await fab.getAttribute("data-shown");
      const fabKind = await fab.getAttribute("data-fab");
      await page.waitForTimeout(2900);
      const fabIdle = await fab.getAttribute("data-shown");
      await setFeedTop(260);
      await page.waitForTimeout(350);
      const fabAgain = await fab.getAttribute("data-shown");
      await page.click('[data-testid="compose-floating"]');
      await dialog.waitFor({ timeout: 10000 });
      await page.waitForTimeout(350);
      const fabWhileOpen = await fab.count();
      await closeComposer();
      record(
        tag +
          " 4. floating entry (" +
          fabKind +
          ") appears while scrolling, hides ~2.5s after, reappears on the next scroll, opens the composer, absent while it is open",
        fabAtTop === "0" &&
          fabMoving === "1" &&
          fabKind === (tier === "compact" ? "handle" : "tab") &&
          fabIdle === "0" &&
          fabAgain === "1" &&
          fabWhileOpen === 0,
        JSON.stringify({ fabAtTop, fabMoving, fabKind, fabIdle, fabAgain, fabWhileOpen }),
      );
    } else {
      // 5. Independent column scroll.
      await setFeedTop(0);
      await page.waitForTimeout(100);
      const railTops = () =>
        page.evaluate(() =>
          [...document.querySelectorAll("[data-scroller]")].map((el) => [
            el.getAttribute("data-scroller"),
            el.scrollTop,
          ]),
        );
      const mainBox = await page.locator('[data-scroller="feed"]').boundingBox();
      await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(300);
      const afterFeedWheel = await railTops();
      const leftBox = await page.locator('[data-scroller="left"]').boundingBox();
      await page.mouse.move(leftBox.x + leftBox.width / 2, leftBox.y + leftBox.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(300);
      const afterRailWheel = await railTops();
      const feedMoved = afterFeedWheel.find((r) => r[0] === "feed")[1];
      const feedAfterRail = afterRailWheel.find((r) => r[0] === "feed")[1];
      const railsStill = afterFeedWheel.filter((r) => r[0] !== "feed").every((r) => r[1] === 0);
      const scrollers = afterFeedWheel.length;
      record(
        tag +
          " 5. wheel over the Feed moves only the Feed; wheel over a rail leaves the Feed put (" +
          scrollers +
          " scroll containers)",
        feedMoved > 0 &&
          railsStill &&
          feedAfterRail === feedMoved &&
          scrollers === (w >= 1440 ? 3 : 2),
        JSON.stringify({ afterFeedWheel, afterRailWheel }),
      );

      // 6. Sticky block: control and LensBar pin together once the greeting has left; nothing paints over them.
      await setFeedTop(0);
      await page.waitForTimeout(150);
      const geo0 = await page.evaluate(() => {
        const g = document.querySelector("[data-greeting]").getBoundingClientRect();
        const sc = document.querySelector('[data-scroller="feed"]').getBoundingClientRect();
        return {
          greetBottom: g.bottom - sc.top,
          stuck: document.querySelector("[data-compose-wrap]").getAttribute("data-stuck"),
        };
      });
      await setFeedTop(Math.ceil(geo0.greetBottom) + 8);
      await page.waitForTimeout(250);
      const probe = () =>
        page.evaluate(() => {
          const sc = document.querySelector('[data-scroller="feed"]').getBoundingClientRect();
          const wrap = document.querySelector("[data-compose-wrap]");
          const wb = wrap.getBoundingClientRect();
          const lens = document.querySelector("[data-feed] [data-lens-anchor]");
          const lb = lens.getBoundingClientRect();
          const hits = [];
          for (const y of [
            wb.top + 2,
            wb.top + 30,
            wb.bottom - 2,
            lb.top + 2,
            lb.top + 20,
            lb.bottom - 2,
          ]) {
            const el = document.elementFromPoint(sc.left + sc.width / 2, y);
            hits.push(!!el && (wrap.contains(el) || lens.contains(el)));
          }
          return {
            stuck: wrap.getAttribute("data-stuck"),
            wrapTop: Math.round(wb.top - sc.top),
            wrapH: Math.round(wb.height),
            lensTop: Math.round(lb.top - sc.top),
            hits,
            articleAbove: [...document.querySelectorAll("[data-feed] article")].some(
              (a) =>
                a.getBoundingClientRect().top < lb.bottom - 1 &&
                a.getBoundingClientRect().bottom > sc.top &&
                getComputedStyle(a).zIndex !== "auto",
            ),
          };
        });
      const g1 = await probe();
      await setFeedTop((await feedTop()) + 700);
      await page.waitForTimeout(250);
      const g2 = await probe();
      await setFeedTop((await feedTop()) + 900);
      await page.waitForTimeout(250);
      const g3 = await probe();
      const pinned = (g) =>
        g.stuck === "1" &&
        g.wrapTop === 0 &&
        g.lensTop === g.wrapH &&
        g.hits.every(Boolean) &&
        !g.articleAbove;
      record(
        tag +
          " 6. once the greeting leaves, control and LensBar pin as one block at the column top; no post paints above or through it while scrolling",
        geo0.stuck === "0" && pinned(g1) && pinned(g2) && pinned(g3),
        JSON.stringify({ geo0, g1, g2, g3 }),
      );

      // 13. Ruling 589: the greeting owns the clearance beneath it. The anchor's own ground begins
      // 12px above its border box, because `boxShadow: 0 -12px 0 0 var(--bg)` paints that band, and
      // the anchor's zIndex puts it over the static greeting. Its `margin: -12px 0` does not add to
      // that: it cancels the column's own `gap: 12` exactly, so the border box begins on the
      // greeting's bottom edge rather than 12px above it. The greeting's bottom padding therefore
      // has to clear the shadow's band, and the assertion is on the date's line box rather than on
      // its glyphs, so it does not depend on the display font's metrics. Read at scroll 0 and
      // mid-scroll, because the anchor is sticky in both states.
      const clearance = async () =>
        page.evaluate(() => {
          const gr = document.querySelector("[data-greeting]");
          const a = document.querySelector("[data-feed] [data-lens-anchor]");
          if (!gr || !a) return null;
          const date = gr.lastElementChild.getBoundingClientRect();
          // The band is read off the shadow rather than hardcoded, so the arm follows the anchor if
          // the offset ever changes. rgb(...) carries no px, so the four px values are the
          // shadow's own offsets and blur; index 1 is the y offset, -12.
          const shadow = getComputedStyle(a).boxShadow;
          const px = (shadow.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseFloat);
          const band = Math.abs(px[1] || 0);
          return {
            clearance: Math.round(a.getBoundingClientRect().top - band - date.bottom),
            padBottom: getComputedStyle(gr).paddingBottom,
            gapToAnchor: Math.round(
              a.getBoundingClientRect().top - gr.getBoundingClientRect().bottom,
            ),
            band,
          };
        });
      await setFeedTop(0);
      await page.waitForTimeout(200);
      const c0 = await clearance();
      await setFeedTop(40);
      await page.waitForTimeout(200);
      const c1 = await clearance();
      record(
        tag +
          " 13. the greeting's date renders whole: its line box clears the lens anchor's painted ground at scroll 0 and mid-scroll (589)",
        !!c0 && !!c1 && c0.clearance >= 0 && c1.clearance >= 0,
        JSON.stringify({ c0, c1 }),
      );
      await setFeedTop(0);
      await page.waitForTimeout(150);
    }

    // 7. Read more expands in place; Show less and browser back collapse; scroll unchanged.
    await setFeedTop(0);
    await page.waitForTimeout(150);
    const card = page.locator("[data-feed] article[data-c]").nth(3);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const t0 = await feedTop();
    await card.locator("[data-read-more]").click();
    await page.waitForURL("**/posts/seed-3");
    await card.locator("[data-show-less]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(250);
    const t1 = await feedTop();
    const expandedCount = await page.locator("[data-feed] article[data-expanded='1']").count();
    await card.locator("[data-show-less]").click();
    await page.waitForURL((u) => u.pathname === "/feed");
    await card.locator("[data-read-more]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(250);
    const t2 = await feedTop();
    await card.locator("[data-read-more]").click();
    await page.waitForURL("**/posts/seed-3");
    await card.locator("[data-show-less]").waitFor({ timeout: 10000 });
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/feed");
    await card.locator("[data-read-more]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(250);
    const t3 = await feedTop();
    record(
      tag +
        " 7. Read more expands the same card in place at /posts/:id with scroll unchanged; Show less and browser back collapse it and return the URL",
      expandedCount === 1 && t1 === t0 && t2 === t0 && t3 === t0 && page.url().endsWith("/feed"),
      JSON.stringify({ t0, t1, t2, t3, expandedCount, url: page.url() }),
    );

    // 8. Fresh tab on /posts/:id: expanded card as page content, Back to Feed, no modal, no scrim.
    const fresh = await ctx.newPage();
    await mockSupabase(fresh, db);
    await fresh.goto(BASE + "/posts/seed-2", { waitUntil: "networkidle" });
    const direct = fresh.locator('[data-direct-post="seed-2"]');
    await direct.locator("article[data-c]").waitFor({ timeout: 15000 });
    const bodyClamped = await direct.locator("article[data-c] [data-read-more]").count();
    record(
      tag +
        " 8. fresh tab on /posts/:id renders the expanded card as page content with Back to Feed; no dialog, no scrim",
      (await direct.locator("article[data-c]").count()) === 1 &&
        bodyClamped === 0 &&
        (await fresh.locator('[data-testid="back-to-feed"]').count()) === 1 &&
        (await fresh.locator('[role="dialog"]').count()) === 0 &&
        (await fresh.locator("[data-sheet-scrim]").count()) === 0 &&
        (await fresh.locator("[data-feed] [data-lens-anchor]").count()) === 0,
    );
    await shot(fresh, `${tag}-direct`);
    await fresh.close();

    // 9. Active lens tap toggles the descriptor; switching lenses never moves the bar.
    await setFeedTop(0);
    await page.waitForTimeout(150);
    const bar = page.locator('[data-feed] [role="tablist"][aria-label="Lens"]');
    const scope0 = await page.locator("[data-feed] [data-lens-scope]").getAttribute("data-open");
    await bar.locator('[data-lens="all"]').click();
    await page.waitForTimeout(250);
    const scope1 = await page.locator("[data-feed] [data-lens-scope]").getAttribute("data-open");
    await bar.locator('[data-lens="all"]').click();
    await page.waitForTimeout(250);
    const scope2 = await page.locator("[data-feed] [data-lens-scope]").getAttribute("data-open");
    const y0 = (await bar.boundingBox()).y;
    await bar.locator('[data-lens="mine"]').click();
    await page.waitForURL("**/feed?lens=mine");
    await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const y1 = (await bar.boundingBox()).y;
    await bar.locator('[data-lens="saved"]').click();
    await page.waitForURL("**/feed?lens=saved");
    await page.locator('[data-testid="feed-empty"][data-lens="saved"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const y2 = (await bar.boundingBox()).y;
    let pinnedLens = { ok: true };
    if (tier === "expanded") {
      // From the pinned bar too: the bar stays where it is and the header/column do not jump.
      await bar.locator('[data-lens="all"]').click();
      await page.waitForURL((u) => u.pathname === "/feed" && !u.search);
      await page.locator("[data-feed] article[data-c]").nth(9).waitFor({ timeout: 10000 });
      await setFeedTop(600);
      await page.waitForTimeout(300);
      const py0 = (await bar.boundingBox()).y;
      await bar.locator('[data-lens="mine"]').click();
      await page.waitForURL("**/feed?lens=mine");
      await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      const py1 = (await bar.boundingBox()).y;
      const stuckAfter = await page.locator("[data-compose-wrap]").getAttribute("data-stuck");
      pinnedLens = { ok: Math.abs(py1 - py0) <= 1 && stuckAfter === "1", py0, py1, stuckAfter };
    } else {
      // From the header slot: the header stays in lens mode and the bar does not move.
      await bar.locator('[data-lens="all"]').click();
      await page.waitForURL((u) => u.pathname === "/feed" && !u.search);
      await page.locator("[data-feed] article[data-c]").nth(9).waitFor({ timeout: 10000 });
      await setFeedTop(400);
      await page.waitForTimeout(300);
      const hb = page.locator('[data-app-header] [role="tablist"][aria-label="Lens"]');
      const py0 = (await hb.boundingBox()).y;
      await hb.locator('[data-lens="mine"]').click();
      await page.waitForURL("**/feed?lens=mine");
      await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      const py1 = (await hb.boundingBox()).y;
      const still = await centre();
      pinnedLens = { ok: Math.abs(py1 - py0) <= 1 && still === "lens", py0, py1, still };
    }
    record(
      tag +
        " 9. tapping the active lens toggles the descriptor; switching lenses (in flow and from the pinned or header bar) never moves the bar",
      scope1 !== scope0 && scope2 === scope0 && y0 === y1 && y1 === y2 && pinnedLens.ok,
      JSON.stringify({ scope0, scope1, scope2, y0, y1, y2, pinnedLens }),
    );

    // 11. Ruling 109: a lens change while pinned lands the first item of the new list exactly
    // beneath the pinned block; the block does not move and stays pinned.
    if (tier === "expanded") {
      await bar.locator('[data-lens="all"]').click();
      await page.waitForURL((u) => u.pathname === "/feed" && !u.search);
      await page.locator("[data-feed] article[data-c]").nth(9).waitFor({ timeout: 10000 });
      await setFeedTop(700);
      await page.waitForTimeout(300);
      const seam = () =>
        page.evaluate(() => {
          const sc = document.querySelector('[data-scroller="feed"]').getBoundingClientRect();
          const wrap = document.querySelector("[data-compose-wrap]");
          const lens = document.querySelector("[data-feed] [data-lens-anchor]");
          const lb = lens.getBoundingClientRect();
          const first = document.querySelector(
            "[data-feed] article[data-c], [data-feed] [data-testid='feed-empty']",
          );
          const fb = first ? first.getBoundingClientRect() : null;
          const probe = fb ? document.elementFromPoint(sc.left + sc.width / 2, fb.top + 2) : null;
          return {
            stuck: wrap.getAttribute("data-stuck"),
            wrapTop: Math.round(wrap.getBoundingClientRect().top - sc.top),
            blockBottom: Math.round(lb.bottom - sc.top),
            firstTop: fb ? Math.round(fb.top - sc.top) : null,
            firstTopVisible: !!probe && !!first && first.contains(probe),
            barY: Math.round(lb.top),
          };
        });
      const s0 = await seam();
      await bar.locator('[data-lens="mine"]').click();
      await page.waitForURL("**/feed?lens=mine");
      await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      const s1 = await seam();
      await bar.locator('[data-lens="saved"]').click();
      await page.waitForURL("**/feed?lens=saved");
      await page
        .locator('[data-testid="feed-empty"][data-lens="saved"]')
        .waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      const s2 = await seam();
      const landed = (s) =>
        s.stuck === "1" &&
        s.wrapTop === 0 &&
        s.firstTop != null &&
        s.firstTop - s.blockBottom >= 0 &&
        s.firstTop - s.blockBottom <= 1 &&
        s.firstTopVisible &&
        s.barY === s0.barY;
      record(
        tag +
          " 11. lens change while pinned: first item of the new list sits exactly beneath the pinned block, none of its top hidden, block unmoved and still pinned",
        s0.stuck === "1" && landed(s1) && landed(s2),
        JSON.stringify({ s0, s1, s2 }),
      );
      await shot(page, `${tag}-11-pinned-lens`);
    }

    // 10. Header row per tier.
    const head = await page.evaluate(() => {
      const h = document.querySelector("[data-app-header]");
      const slots = [...h.querySelectorAll('nav[data-pulse="inline"] button')].map((b) =>
        b.getBoundingClientRect(),
      );
      const gaps = slots.slice(1).map((r, i) => Math.round(r.left - slots[i].right));
      return {
        height: h.getBoundingClientRect().height,
        slots: slots.length,
        gaps,
        even: gaps.length === 4 && Math.max(...gaps) - Math.min(...gaps) <= 2,
        home: !!h.querySelector('[data-testid="home-item"]'),
        homeIsIcon: !!h.querySelector('[data-testid="home-item"] span[style*="house.svg"]'),
        logoHref: h.querySelector('[data-testid="home"]').getAttribute("href"),
        rows: [...h.querySelectorAll("nav")].length,
      };
    });
    record(
      tag +
        (tier === "expanded"
          ? " 10. expanded header is one row: logo, five Cs spread evenly, Home icon, bell, avatar"
          : " 10. " + tier + " header has no Home icon; the logo goes Home"),
      tier === "expanded"
        ? head.height <= 66 &&
            head.slots === 5 &&
            head.even &&
            head.home &&
            head.homeIsIcon &&
            head.rows === 1
        : !head.home && head.logoHref === "/feed" && head.slots === 0,
      JSON.stringify(head),
    );

    // 12. Ruling 588: the fade is measured from the card's bottom edge. At expanded the bar is the
    // column's own sticky anchor, which is sticky in both of its states, so the selector carries no
    // [data-stuck] qualifier; below 1024 the header holds the lens bar past 72px and is the edge.
    //
    // Back to All first: items 9 and 11 leave the column on Saved, which is empty by design, and a
    // fade arm with nothing to fade would pass by having nothing to look at.
    await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
    await page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 15000 });
    await setFeedTop(0);
    await page.waitForTimeout(250);
    const fade = await fadeProbe(
      page,
      tier === "expanded" ? "[data-lens-anchor]" : "[data-app-header]",
    );
    record(
      tag +
        " 12. no card is invisible while any part of it is below the bar, none fades before the bar" +
        " is within reach, and the outgoing tail overlaps the next card's arrival (588)",
      fade.ok,
      JSON.stringify(fade.detail),
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
    await shot(page, `${tag}-ERROR`).catch(() => {});
  }
  record(
    tag + " no page errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | ").slice(0, 300),
  );
  await browser.close();
}

const TARGETED_VIEWPORTS = [
  [390, 844],
  [820, 1180],
  [1280, 800],
  [1536, 960],
];

// Silence when DIA times out or errors: identical to no DIA.
// ---------------------------------------------------------------------------
// Ruling 588: the fade's measured edge, asserted from geometry rather than from a fixed scroll.
//
// The rule is one sentence: a card holds opacity 1 until its BOTTOM edge is within
// FADE_UNDER_DISTANCE of the sticky bar's bottom edge, and reaches 0 only once that edge has
// passed under it. Measuring the top edge, as CardFade did until 588, took a tall card to 0 while
// most of it was still on screen holding its full layout box, which is the blank region between
// the bar and the first legible card that this arm exists to catch.
//
// The scroll target is derived from the live geometry (put the first card's bottom `under` px
// below the bar) rather than hardcoded, because one number cannot be inside the fade window at
// 390 and at 1536 alike. A column too short to scroll that far reports reachable: false and is
// judged on the invariant alone: nothing has reached the bar, so nothing may be faded. That is the
// real state at 744 and 820 with the seeded fixture, where the whole list fits the viewport.
// ---------------------------------------------------------------------------
const FADE_UNDER_DISTANCE = 96;

async function fadeProbe(page, barSelector, under = 48) {
  const raw = await page.evaluate(
    async ({ sel, under }) => {
      const twoFrames = () =>
        new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sc = document.querySelector('[data-scroller="feed"]');
      const barBottom = () => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect().bottom : null;
      };
      const read = () =>
        [...document.querySelectorAll("[data-card-fade]")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            h: Math.round(r.height),
            op: Number(getComputedStyle(el).opacity),
          };
        });
      if (!sc) return { err: "no [data-scroller=feed]" };
      if (barBottom() === null) return { err: "the bar selector did not resolve: " + sel };
      if (read().length === 0) return { err: "no [data-card-fade] on the surface" };
      // Converged rather than solved in one step: the bar itself moves as the column scrolls. At
      // expanded the anchor starts in flow below the composer and the greeting and only then
      // becomes sticky at the column top, so a target computed from where the bar was is wrong by
      // however far the bar has since travelled. Four steps settle it at every tier; a column too
      // short to reach the target clamps and is reported as not reachable.
      const max = sc.scrollHeight - sc.clientHeight;
      let needed = sc.scrollTop;
      for (let i = 0; i < 4; i++) {
        needed = sc.scrollTop + (read()[0].bottom - barBottom()) - under;
        sc.scrollTop = Math.min(max, Math.max(0, needed));
        await twoFrames();
        if (Math.abs(read()[0].bottom - barBottom() - under) <= 2) break;
      }
      await twoFrames();
      const scr = sc.getBoundingClientRect();
      return {
        reachable: needed >= -2 && needed <= max + 2,
        scrollTop: Math.round(sc.scrollTop),
        max: Math.round(max),
        bar: Math.round(barBottom()),
        scTop: Math.round(scr.top),
        scBottom: Math.round(scr.bottom),
        cards: read(),
      };
    },
    { sel: barSelector, under },
  );
  if (raw.err) return { ok: false, detail: raw };
  const vis = raw.cards.filter((c) => c.bottom > raw.scTop && c.top < raw.scBottom);
  // Invisible while any part of it is still below the bar: the 588 defect itself, and with it the
  // blank region, since the card that painted nothing is the one that held the gap.
  const invisibleWhileBelow = vis.find((c) => c.bottom > raw.bar + 1 && c.op <= 0.001) || null;
  // Wholly clear of the fade window, so 489's curve has not started.
  const fadedTooEarly =
    vis.find((c) => c.bottom - raw.bar >= FADE_UNDER_DISTANCE + 1 && c.op < 0.999) || null;
  const first = raw.cards[0];
  const next = raw.cards[1];
  const midFade = !!first && first.op > 0.002 && first.op < 0.998;
  // The overlap 588 asks for: the outgoing card's tail is still painting while the next card is
  // fully opaque, rather than one going before the other arrives.
  const overlaps = !raw.reachable || (midFade && !!next && next.op > 0.998);
  return {
    ok:
      !invisibleWhileBelow &&
      !fadedTooEarly &&
      (!raw.reachable || midFade) &&
      overlaps &&
      (raw.reachable || raw.cards.every((c) => c.op > 0.998)),
    detail: {
      reachable: raw.reachable,
      scrollTop: raw.scrollTop,
      max: raw.max,
      bar: raw.bar,
      cards: raw.cards.map((c) => ({ ...c, op: Number(c.op.toFixed(3)) })),
      invisibleWhileBelow,
      fadedTooEarly,
    },
  };
}

// ---------------------------------------------------------------------------
// Ruling 344: the width arm. One arm per engine and viewport, light theme (width does not depend
// on the palette), walking every surface the suites open in the states that change its layout:
// the public profile signed out, the three onboarding screens, the feed with the composer, the
// notification panel and the Account drawer open, Connect's list and mosaic, the owner's profile,
// change password (which /password now reaches through the drawer, handoff 61-S1), sign-in and
// reset. Each
// stop is one check that fails when the document is wider than the viewport at that tier, with
// the offending element named (measureWidth above).
// ---------------------------------------------------------------------------
const WIDTH_STOPS = [
  ["/connect", "connect members"],
  ["/connect?lens=where", "connect where"],
  ["/m/thandiwe-dube", "profile"],
  ["/password", "change password"],
];

async function runWidth(browserType, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-width`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 3);
  // Ruling 469: nothing is prefilled before the Who screen is written.
  const who = {
    name: "",
    username: null,
    suggestion: null,
    avatar_path: null,
    completed: false,
  };
  const where = { city: null, country: null, completed: false };
  const relationship = {
    stance: "exploring",
    stance_label: "Still exploring",
    declared: false,
    completed: false,
  };
  db.onboarding.state = { next: "who", who, where, relationship, onboarded_at: null };
  await mockSupabase(page, db);
  const stop = async (label) => {
    await page.waitForTimeout(600);
    await noOverflow(page, `${tag} ${label}`);
  };
  const visit = async (path, glob, label) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => undefined);
    if (glob) await page.waitForURL(glob, { timeout: 15000 });
    await stop(label);
  };
  try {
    // Signed out first: the public profile is the surface the element ruling 344 names sat on.
    await visit("/m/thandiwe-dube", null, "public profile");
    await visit("/reset", null, "reset request");
    await visit("/sign-in", null, "sign-in");
    await hydrated(page);
    await page.fill('input[type="email"]', "member@test.invalid");
    await page.fill('input[type="password"]', "x");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/welcome", { timeout: 15000 });
    await page.waitForSelector('[data-testid="onboarding-who"]', { timeout: 15000 });
    await stop("onboarding who");
    db.onboarding.state.next = "where";
    db.onboarding.state.who = { ...who, username: "amara-osei", completed: true };
    await visit("/where", "**/where", "onboarding where");
    db.onboarding.state.next = "relationship";
    db.onboarding.state.where = { city: "Nairobi", country: "Kenya", completed: true };
    await visit("/relationship", "**/relationship", "onboarding relationship");
    db.onboarding.state.next = null;
    db.onboarding.state.onboarded_at = new Date().toISOString();
    await visit("/feed", "**/feed", "feed");
    await page.waitForSelector('[data-testid="compose"]');
    await page.click('[data-testid="compose"]');
    // Runs 633 and 635 (H63-CI): `stop`'s bare 600 ms measured this panel mid-slide on WebKit,
    // its edge at 2001 past 1280, as the first unit of a shard with and without a warmed engine.
    // Wait for the resting transform as every other composer arm does; a sheet that never settles
    // is still measured, and still fails, when the wait gives up.
    await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]').catch(() => undefined);
    await stop("composer open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.click('[data-testid="bell"]');
    await stop("notifications open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // Handoff 61-S1: the avatar opens the Account drawer at /settings; Escape returns to /feed.
    await page.click('[data-testid="avatar"]');
    await page.waitForURL("**/settings", { timeout: 15000 });
    await stop("account drawer open");
    await page.keyboard.press("Escape");
    await page.waitForURL("**/feed", { timeout: 15000 }).catch(() => undefined);
    for (const [path, label] of WIDTH_STOPS) await visit(path, null, label);
  } catch (e) {
    record(tag + " completed", false, String(e).slice(0, 400));
  } finally {
    await shot(page, `${tag}-last`).catch(() => undefined);
    await browser.close();
  }
}

async function runSilence(browserType, bname) {
  const tag = `${bname}-390x844-light-silence`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  await mockSupabase(page, db, { inferDelay: 5000 });
  try {
    await signIn(page);
    await page.click('[data-testid="compose"]');
    const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
    await dialog.waitFor();
    await dialog.locator('textarea[aria-label="What is going on with you"]').fill(SAMPLES.convene);
    await dialog.locator('[data-dia="thinking"]').waitFor({ timeout: 3000 });
    await page.waitForTimeout(3800); // budget is 3.5 s (ruling 74)
    record(
      tag + " timeout past 3.5s -> silence, untyped convey, no chip",
      (await dialog.locator("[data-dia]").count()) === 0 &&
        (await dialog.locator('[role="radio"][aria-checked="true"]').count()) ===
          1 /* audience pill only */ &&
        (await dialog
          .locator("article[aria-label='Preview of your post']")
          .getAttribute("data-c")) === "convey",
    );
    await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
    // Short text: no inference at all.
    db.inferCalls = 0;
    await dialog.locator('textarea[aria-label="What is going on with you"]').fill("Hi all");
    await page.waitForTimeout(1200);
    record(tag + " under 8 characters: no inference call", db.inferCalls === 0);
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
  }
  await browser.close();
}

// iOS keyboard surrogate: shrink visualViewport and check data-kb and Publish placement, then a
// pinch-zoom on a thread, which must not read as a keyboard.
async function runKeyboard(browserType, bname) {
  const tag = `${bname}-390x844-keyboard`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const target = new EventTarget();
    const fake = {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: (...a) => target.addEventListener(...a),
      removeEventListener: (...a) => target.removeEventListener(...a),
      dispatchEvent: (e) => target.dispatchEvent(e),
    };
    Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });
    window.__setKeyboard = (kb) => {
      fake.height = window.innerHeight - kb;
      target.dispatchEvent(new Event("resize"));
    };
    // Pinch-zoom: the visual viewport shrinks by the scale and pans, with no keyboard at all.
    window.__setZoom = (scale, offsetTop) => {
      fake.scale = scale;
      fake.height = window.innerHeight / scale;
      fake.offsetTop = offsetTop;
      target.dispatchEvent(new Event("resize"));
    };
  });
  const db = makeMockDb();
  await mockSupabase(page, db);
  try {
    await signIn(page);
    await page.click('[data-testid="compose"]');
    const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
    await dialog.waitFor();
    await page.waitForTimeout(500); // the 300ms slide must finish before geometry is measured
    record(tag + " no data-kb before keyboard", (await dialog.getAttribute("data-kb")) === null);
    await dialog.locator('textarea[aria-label="What is going on with you"]').focus();
    await page.evaluate(() => window.__setKeyboard(336));
    await page.waitForTimeout(100);
    record(
      tag + " data-kb=1 while keyboard tracking active",
      (await dialog.getAttribute("data-kb")) === "1",
    );
    const pb = await dialog.getByRole("button", { name: "Publish" }).boundingBox();
    record(
      tag + " Publish stays above the keyboard",
      pb && pb.y + pb.height <= 844 - 336 + 1,
      JSON.stringify(pb),
    );
    await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
    await page.evaluate(() => window.__setKeyboard(0));
    await page.waitForTimeout(100);
    record(tag + " restores on keyboard dismiss", (await dialog.getAttribute("data-kb")) === null);

    // Chat on #97: a pinch-zoom is not a keyboard. On a thread with no field focused, zoom to 2
    // and back: the thread's frame never goes fixed (1457's keyboard frame) and AppShell's
    // keyboard-close reset never moves a window that was scrolled before the zoom.
    await page.goto(BASE + "/messages", { waitUntil: "networkidle" });
    await page.locator("[data-thread-row] [data-thread-open]").first().click();
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 15000 });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.documentElement.style.overflow = "auto";
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 40);
      return { x: window.scrollX, y: window.scrollY };
    });
    const framePosition = () =>
      page.evaluate(() => {
        const t = document.querySelector("[data-messenger-thread]");
        const frame = t && t.closest("section");
        return frame ? getComputedStyle(frame).position : "no frame";
      });
    await page.evaluate(() => window.__setZoom(2, 200));
    await page.waitForTimeout(150);
    const zoomed = await framePosition();
    await page.evaluate(() => window.__setZoom(1, 0));
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    record(
      tag + " pinch-zoom on a thread is not a keyboard: no fixed frame, window scroll unchanged",
      before.y === 40 &&
        zoomed !== "fixed" &&
        zoomed !== "no frame" &&
        after.x === before.x &&
        after.y === before.y,
      `frame at scale 2: ${zoomed}; window before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`,
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
  }
  await browser.close();
}

// Ruling 1460 (1456's guard): no editable field renders its text under 16px on a touch width, or
// iOS WebKit zooms the page on focus and does not zoom back. Every matrix width under 1024 (1460
// named 390 and 768; 768 is not a matrix width, so this is the superset), on the five places a
// member types: the Feed composer, /messages, a thread, Connect's Filters sheet and the profile
// editor. The computed size is read off every visible input, textarea and contenteditable, the
// types that take no text excluded. The iOS keyboard itself is proved on a phone (358), not here.
const FIELD_WIDTHS = VIEWPORTS.filter(([w]) => w < 1024);
const NO_TEXT_TYPES = ["checkbox", "radio", "file", "range", "hidden", "submit", "button", "color"];

/** Every visible editable field in `scope`: what it is and the text size it renders. */
async function fieldSizes(page, scope) {
  return page.evaluate(
    ({ scope, skip }) => {
      const root = scope ? document.querySelector(scope) : document;
      if (!root) return null;
      const els = root.querySelectorAll('input, textarea, [contenteditable="true"]');
      const out = [];
      for (const el of els) {
        if (
          el.tagName === "INPUT" &&
          skip.includes((el.getAttribute("type") || "text").toLowerCase())
        )
          continue;
        const cs = getComputedStyle(el);
        if (!el.getClientRects().length || cs.visibility === "hidden" || cs.display === "none")
          continue;
        const name =
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          el.getAttribute("data-testid") ||
          el.id ||
          "";
        const type =
          el.tagName === "INPUT" ? "[type=" + (el.getAttribute("type") || "text") + "]" : "";
        out.push({
          el: el.tagName.toLowerCase() + type + (name ? ' "' + name + '"' : ""),
          px: parseFloat(cs.fontSize),
        });
      }
      return out;
    },
    { scope, skip: NO_TEXT_TYPES },
  );
}

async function runFields(browserType, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-fields`;
  armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 2);
  // The profile editor is the owner's (tests/profile.cjs's runOwner).
  Object.assign(db.profile, { mode: "owner" });
  await mockSupabase(page, db);
  const press = (sel) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => el.click());
  // One check per route, each on its own: a route that cannot be reached fails by name and the
  // routes after it still report. `needsField` is false for Connect's Filters, which holds selects.
  const route = async (where, needsField, reach, scope) => {
    let detail;
    let ok = false;
    try {
      await reach();
      const fields = await fieldSizes(page, scope);
      const small = (fields || []).filter((f) => !(f.px >= 16));
      ok = !!fields && small.length === 0 && (!needsField || fields.length > 0);
      detail = !fields
        ? "the scope " + scope + " did not render"
        : small.length
          ? small.map((f) => `${where} at ${w}x${h}: ${f.el} renders ${f.px}px`).join("; ")
          : fields.length
            ? fields.map((f) => `${f.el} ${f.px}px`).join("; ")
            : "no editable field rendered";
    } catch (e) {
      detail = `${where} at ${w}x${h} was not reached: ` + String(e).slice(0, 240);
    }
    record(`${tag} ${where}: no editable field under 16px (1456, 1460)`, ok, detail);
  };
  try {
    await signIn(page);
    await route(
      "Feed composer",
      true,
      async () => {
        await press('[data-testid="compose"]');
        await page.waitForSelector(COMPOSE_SEL);
        await page.waitForTimeout(500);
      },
      COMPOSE_SEL,
    );
    await route("/messages", true, async () => {
      await page.goto(BASE + "/messages", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="thread-list"] [data-thread-row]', {
        timeout: 15000,
      });
      await page.waitForTimeout(300);
    });
    await route("a thread", true, async () => {
      await page.locator("[data-thread-row] [data-thread-open]").first().click();
      await page.waitForURL(/\/messages\/[^/?#]+/, { timeout: 15000 });
      await page.waitForSelector('[data-testid="message-field"]', { timeout: 15000 });
      await page.waitForTimeout(300);
    });
    await route("Connect Members, Filters open", false, async () => {
      await page.goto(BASE + "/connect", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="connect"]', { timeout: 20000 });
      await press('[data-testid="open-filters"]');
      await page.waitForSelector('[role="dialog"][aria-label="Filters"]', { timeout: 15000 });
      await page.waitForTimeout(400);
    });
    await route("the profile editor", true, async () => {
      await page.goto(BASE + "/m/thandiwe-dube", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="profile"]:not([data-view="loading"])', {
        timeout: 20000,
      });
      await press('[data-testid="edit-profile"]');
      await page.waitForSelector('[data-testid="profile"][data-edit="1"]', { timeout: 15000 });
      await page.waitForTimeout(500);
    });
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 300));
  }
  await browser.close();
}

module.exports = {
  // H63-CI: the unit list and the sweep's scope, read by tests/shards.cjs and tests/matrix-summary.cjs.
  fullUnits,
  ADMIN_ARM,
  loadExpected,
  launch,
  makeMockDb,
  seedPosts,
  mockSupabase,
  signIn,
  hydrated,
  record,
  unproven,
  eventId,
  results,
  armStart,
  armCrashed,
  drive,
  watchCrash,
  shot,
  noOverflow,
  measureWidth,
  sheetSettled,
  sheetTokenWidth,
  sheetWidthIs,
  fadeProbe,
  FADE_UNDER_DISTANCE,
  BASE,
  OUT,
  VIEWPORTS,
  THEMES,
  FULL_PREVIEW_AT,
  JWT,
  UID,
  SB,
  CONNECT_MEMBERS,
  CONNECT_SUGGESTED,
  CONNECT_WHERE,
  VOCAB,
  DISCOVERY_SECTIONS,
  DISCOVERY_LENSES,
  SAMPLES,
};

/**
 * H63-CI (rulings 1846, 1847, 1881): the full run as an ordered list of units, one per call the
 * main loop used to make, each with a key that names it the same on both engines. A full run
 * calls every unit in this order, which is the order the loop called them in; a shard (SHARD=k/n,
 * tests/shards.cjs) calls the ones tests/matrix-shards.json gives it, in this order. A unit is the
 * unit of placement because it is the unit of execution: a group runner's arms (runProfile,
 * runMount, runSheets) share state inside the call (profile.cjs's `seenPublic` hands the public
 * arm's ids to the owner arm of the same cell), so a call is never split across shards. `bt` is
 * unread until a unit runs, so `fullUnits(null, name)` lists the keys without a browser.
 */
function fullUnits(bt, bname, only = null) {
  const units = [];
  const unit = (key, run) => units.push({ key, run });
  const cell = ([w, h]) => `${w}x${h}`;
  const strip = require("./lens-strip.cjs");
  for (const vp of only ? [only] : VIEWPORTS) {
    for (const theme of only ? [process.env.THEME || "light"] : THEMES)
      unit(`viewport ${cell(vp)} ${theme}`, () => drive(runViewport, bt, bname, vp, theme));
    unit(`shell ${cell(vp)}`, () => drive(runShell, bt, bname, vp));
    unit(`lens-seat ${cell(vp)}`, () => drive(runLensSeat, bt, bname, vp));
    if (strip.LENS_STRIP_WIDTHS.includes(vp[0]))
      unit(`lens-strip ${cell(vp)}`, () => drive(strip.runLensStrip, bt, bname, vp));
    unit(`width ${cell(vp)}`, () => drive(runWidth, bt, bname, vp));
  }
  if (only) return units;
  unit("publish 390x844 light", () => drive(runPublish, bt, bname, [390, 844], "light"));
  unit("publish 1280x800 dark", () => drive(runPublish, bt, bname, [1280, 800], "dark"));
  unit("guards 390x844 light", () => drive(runPublishGuards, bt, bname, [390, 844], "light"));
  unit("guards 1280x800 dark", () => drive(runPublishGuards, bt, bname, [1280, 800], "dark"));
  unit("silence", () => drive(runSilence, bt, bname));
  unit("keyboard", () => drive(runKeyboard, bt, bname));
  for (const vp of FIELD_WIDTHS) unit(`fields ${cell(vp)}`, () => drive(runFields, bt, bname, vp));
  // Convene Pass 1 (P1-SPEC section 6): the composer's Convene mode and the card.
  unit("convene 390x844 light", () => drive(runConvene, bt, bname, [390, 844], "light"));
  unit("convene 1280x800 dark", () => drive(runConvene, bt, bname, [1280, 800], "dark"));
  unit("convene-zone 390x844 light", () => drive(runConveneZone, bt, bname, [390, 844], "light"));
  unit("convene-zone 1280x800 dark", () => drive(runConveneZone, bt, bname, [1280, 800], "dark"));
  for (const vp of TARGETED_VIEWPORTS)
    unit(`targeted ${cell(vp)}`, () => drive(runTargeted, bt, bname, vp));
  // Brief 3: the profile in its three views plus editing mode, every viewport, both themes.
  const { runProfile } = require("./profile.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`profile ${cell(vp)} ${theme}`, () => runProfile(bt, bname, vp, theme));
  // Brief 4: Connect's four lenses, sheets and rails, every viewport, both themes.
  const { runConnect } = require("./connect.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`connect ${cell(vp)} ${theme}`, () => drive(runConnect, bt, bname, vp, theme));
  // Handoff 55-A: the bell's dot and Connect's for-you dot, every viewport, both themes (61).
  const { runNotifyDots } = require("./notify-dots.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`notify ${cell(vp)} ${theme}`, () => drive(runNotifyDots, bt, bname, vp, theme));
  // Handoff 60-NC: the panel's controls at every cell (61), its flows and the unsubscribe
  // landing page on the compact, medium and expanded cells.
  const nc = require("./notify-controls.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`notify-controls ${cell(vp)} ${theme}`, () =>
        drive(nc.runNotifyControls, bt, bname, vp, theme),
      );
  for (const vp of nc.FLOW_CELLS)
    for (const theme of THEMES) {
      unit(`notify-flows ${cell(vp)} ${theme}`, () =>
        drive(nc.runNotifyFlows, bt, bname, vp, theme),
      );
      unit(`unsubscribed ${cell(vp)} ${theme}`, () =>
        drive(nc.runUnsubscribed, bt, bname, vp, theme),
      );
    }
  // Handoff 61-S1: the Account drawer at every cell (61), its flows on the compact, medium and
  // expanded cells.
  const ac = require("./account.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`account ${cell(vp)} ${theme}`, () => drive(ac.runAccountDrawer, bt, bname, vp, theme));
  for (const vp of ac.FLOW_CELLS)
    for (const theme of THEMES) {
      unit(`account-flows ${cell(vp)} ${theme}`, () =>
        drive(ac.runAccountFlows, bt, bname, vp, theme),
      );
      unit(`account-session ${cell(vp)} ${theme}`, () =>
        drive(ac.runAccountSessionGone, bt, bname, vp, theme),
      );
    }
  // Handoff 62-G: the Feed card's comments on the compact, medium and expanded cells
  // (tests/comments.cjs).
  const cm = require("./comments.cjs");
  for (const vp of cm.FLOW_CELLS)
    for (const theme of THEMES)
      unit(`comments ${cell(vp)} ${theme}`, () => drive(cm.runComments, bt, bname, vp, theme));
  // Brief 10 (handoff 30-C item 13): the member's event page at every cell, its flows on the
  // two representative layouts.
  const {
    runEvent,
    runEventBlocks,
    runEventFlows,
    runGuest,
    runEventLinks,
  } = require("./event.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES) {
      unit(`event ${cell(vp)} ${theme}`, () => drive(runEvent, bt, bname, vp, theme));
      unit(`event-blocks ${cell(vp)} ${theme}`, () => drive(runEventBlocks, bt, bname, vp, theme));
    }
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES)
      unit(`event-flows ${cell(vp)} ${theme}`, () => drive(runEventFlows, bt, bname, vp, theme));
  // Brief 9 (handoff 31-B item 15): Discovery at every width plus 1440, both themes.
  const {
    runDiscovery,
    runDiscoveryFacets,
    runDiscoveryPlace,
    FOLLOWUP_ARMS,
    DISCOVERY_VIEWPORTS,
    FACET_VIEWPORTS,
    PLACE_VIEWPORTS,
  } = require("./discovery.cjs");
  for (const vp of DISCOVERY_VIEWPORTS)
    for (const theme of THEMES)
      unit(`discovery ${cell(vp)} ${theme}`, () => drive(runDiscovery, bt, bname, vp, theme));
  // Handoff 32-B items 1, 2, 6 and 12 with Addendum 1: redirects, facets, ladders, writes, memory.
  for (const [vp, theme] of FACET_VIEWPORTS)
    unit(`discovery-facets ${cell(vp)} ${theme}`, () =>
      drive(runDiscoveryFacets, bt, bname, vp, theme),
    );
  // Handoff 31-D item 7 (1063, 1065, 1067): the lens, the place and the intent.
  for (const [vp, theme] of PLACE_VIEWPORTS)
    unit(`discovery-place ${cell(vp)} ${theme}`, () =>
      drive(runDiscoveryPlace, bt, bname, vp, theme),
    );
  // Handoff 32-B Addenda 4 and 5: one arm per item (1 to 5, and 8), each on its own cells.
  for (const [run, cells] of FOLLOWUP_ARMS)
    for (const [vp, theme] of cells)
      unit(`${run.name} ${cell(vp)} ${theme}`, () => drive(run, bt, bname, vp, theme));
  // Handoff 30-D item 14.3: the public page's guest path on the two representative layouts.
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES)
      unit(`guest ${cell(vp)} ${theme}`, () => drive(runGuest, bt, bname, vp, theme));
  // Handoff 32-B item 9: the alias and short-code paths, on the client.
  unit("event-links 390x844 light", () => drive(runEventLinks, bt, bname, [390, 844], "light"));
  unit("event-links 1280x800 dark", () => drive(runEventLinks, bt, bname, [1280, 800], "dark"));
  // Rulings 193, 194: the vocabulary read served and then failing, on both layouts.
  const { runVocabulary } = require("./vocabulary.cjs");
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES)
      for (const fail of [false, true])
        unit(`vocab ${cell(vp)} ${theme} ${fail ? "failed" : "served"}`, () =>
          drive(runVocabulary, bt, bname, vp, theme, fail),
        );
  // Brief 4B: every auth surface rendered at every viewport and both themes, then the state
  // flows on the two representative layouts.
  const { runAuthLayout, runAuthFlows } = require("./auth.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`auth-layout ${cell(vp)} ${theme}`, () => drive(runAuthLayout, bt, bname, vp, theme));
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES)
      unit(`auth-flows ${cell(vp)} ${theme}`, () => drive(runAuthFlows, bt, bname, vp, theme));
  // Ruling 198 and Brief 4A: the blocked party's view, the blocker's own view, the control end
  // to end and its focus management, on both layouts and both themes.
  const { runBlock, runBlocker, runBlockFlow, runBlockFocus } = require("./block.cjs");
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES) {
      unit(`blocked ${cell(vp)} ${theme}`, () => drive(runBlock, bt, bname, vp, theme));
      unit(`blocker ${cell(vp)} ${theme}`, () => drive(runBlocker, bt, bname, vp, theme));
      unit(`block-flow ${cell(vp)} ${theme}`, () => drive(runBlockFlow, bt, bname, vp, theme));
      unit(`block-focus ${cell(vp)} ${theme}`, () => drive(runBlockFocus, bt, bname, vp, theme));
    }
  // Brief 5 (ruling 279): the three onboarding screens everywhere, the state flows on the
  // two representative layouts.
  const {
    runOnboardingLayout,
    runOnboardingFlows,
    runOnboardingPhotoFormats,
  } = require("./onboarding.cjs");
  for (const vp of VIEWPORTS)
    for (const theme of THEMES)
      unit(`onboarding-layout ${cell(vp)} ${theme}`, () =>
        drive(runOnboardingLayout, bt, bname, vp, theme),
      );
  for (const vp of [
    [390, 844],
    [1280, 800],
  ])
    for (const theme of THEMES)
      unit(`onboarding-flows ${cell(vp)} ${theme}`, () =>
        drive(runOnboardingFlows, bt, bname, vp, theme),
      );
  // Ruling 345: the HEIC and oversized-JPEG arm runs once per engine, at the compact tier.
  unit("onboarding-photo 390x844 light", () =>
    drive(runOnboardingPhotoFormats, bt, bname, [390, 844], "light"),
  );
  // Handoff 58-12C2 (Brief 12, 12C part 2): the member app's recording, one call per moment,
  // at the two representative layouts (tests/record.cjs).
  const { runRecord } = require("./record.cjs");
  unit("record 390x844 light", () => drive(runRecord, bt, bname, [390, 844], "light"));
  unit("record 1280x800 light", () => drive(runRecord, bt, bname, [1280, 800], "light"));
  // Handoff 32-A item 5 (rulings 755, 556, 627): every route that binds a part Strand compile
  // v1790212533284400 changed, read after its open gate, one cell per tier (tests/mount.cjs).
  const { runMount, MOUNT_CELLS } = require("./mount.cjs");
  for (const [vp, theme] of MOUNT_CELLS)
    unit(`mount ${cell(vp)} ${theme}`, () => runMount(bt, bname, vp, theme));
  // Handoff 60-MEDIA-2 (1714 to 1716): the Feed card's edges either side of the expanded tier's
  // widths, at rest and after a 2,000 px scroll, and the profile's portrait and cover opening
  // the viewer on the master (tests/media-sites.cjs).
  const media = require("./media-sites.cjs");
  for (const w of media.FEED_EDGE_WIDTHS)
    unit(`feed-edge ${w}x${media.FEED_EDGE_HEIGHT}`, () =>
      drive(media.runFeedEdge, bt, bname, [w, media.FEED_EDGE_HEIGHT]),
    );
  for (const [vp, theme] of media.PROFILE_CELLS)
    unit(`profile-viewer ${cell(vp)} ${theme}`, () =>
      drive(media.runProfileViewer, bt, bname, vp, theme),
    );
  // Handoff 37-B (1201): every Sheet's enter and exit, frame by frame, on both shapes
  // (tests/sheet.cjs).
  const { runSheets } = require("./sheet.cjs");
  unit("sheets", () => runSheets(bt, bname));
  // Handoff 41-B section 5 (rulings 1346, 1374): the Messenger media routes against the
  // deployment, once per engine, with the two seeded accounts (tests/messenger-media.cjs).
  const { runMessengerMedia } = require("./messenger-media.cjs");
  unit("messenger-media", () => drive(runMessengerMedia, bt, bname));
  // Handoff 56-MOV item 3 (G224): a .mov through the thread's own video input, sent and rendered,
  // and one over the byte ceiling refused as too_large (tests/messenger-composer-video.cjs).
  const { runMessengerComposerVideo } = require("./messenger-composer-video.cjs");
  unit("messenger-composer-video", () => drive(runMessengerComposerVideo, bt, bname));
  // Handoff 41-C item 5 (SPEC 41-14 "Arms"): the Messenger's surfaces, the responsive matrix and
  // the flows on the mock, then the deployment with the two seeded accounts (tests/messenger.cjs).
  const msg = require("./messenger.cjs");
  for (const vp of msg.LAYOUT_CELLS)
    for (const theme of THEMES)
      unit(`messenger-layout ${cell(vp)} ${theme}`, () =>
        drive(msg.runMessengerLayout, bt, bname, vp, theme),
      );
  for (const [vp, theme] of msg.FLOW_CELLS) {
    unit(`messenger-flows ${cell(vp)} ${theme}`, () =>
      drive(msg.runMessengerFlows, bt, bname, vp, theme),
    );
    // Handoff 56-41E item 3: SPEC-41-E's second pass on the same two cells.
    unit(`messenger-reactions ${cell(vp)} ${theme}`, () =>
      drive(msg.runMessengerReactions, bt, bname, vp, theme),
    );
  }
  unit("messenger-live", () => drive(msg.runMessengerLive, bt, bname));
  // Handoff 45-C arm 3 (1377): the member app's theme on a dark device with no stored choice
  // renders as main did at c859d54, at one compact and one expanded width (tests/theme.cjs).
  const { runMemberTheme } = require("./theme.cjs");
  unit("member-theme 390x844", () => drive(runMemberTheme, bt, bname, [390, 844]));
  unit("member-theme 1280x800", () => drive(runMemberTheme, bt, bname, [1280, 800]));
  // H-BS7-RESKIN item 9: the 1A wordmark in --ink and no retired asset requested, on /sign-in, /feed,
  // a public profile and a public event, in each theme (tests/brand.cjs).
  const brand = require("./brand.cjs");
  for (const [vp, theme] of brand.BRAND_CELLS)
    unit(`brand ${cell(vp)} ${theme}`, () => drive(brand.runBrand, bt, bname, vp, theme));
  return units;
}

/**
 * Ruling 283: the job is split by engine, so a run names the engine it drives and its arms are
 * comparable against the arms of the same engine and no other. ENGINE=chromium or ENGINE=webkit
 * runs one; unset keeps the old shape, where WEBKIT=1 adds WebKit alongside Chromium.
 */
function selectEngines() {
  const all = { chromium, webkit };
  const pick = (process.env.ENGINE || "").trim();
  if (!pick) {
    const engines = [["chromium", chromium]];
    if (process.env.WEBKIT === "1") engines.push(["webkit", webkit]);
    return engines;
  }
  const names = pick
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const unknown = names.filter((n) => !all[n]);
  // Loud rather than empty: an ENGINE typo that silently ran nothing would report a green run of
  // no arms at all, which is the shape of false all-clear this PR exists to remove.
  if (unknown.length || !names.length)
    throw new Error(`ENGINE=${pick} names no engine this suite drives (chromium, webkit)`);
  return names.map((n) => [n, all[n]]);
}

if (require.main === module)
  (async () => {
    const only = process.env.ONLY ? JSON.parse(process.env.ONLY) : null;
    if (process.env.SPECIAL) {
      const specialEngines = selectEngines();
      for (const [bname, bt] of specialEngines) {
        if (process.env.SPECIAL.includes("publish"))
          await drive(runPublish, bt, bname, [390, 844], "light");
        if (process.env.SPECIAL.includes("guards")) {
          await drive(runPublishGuards, bt, bname, [390, 844], "light");
          await drive(runPublishGuards, bt, bname, [1280, 800], "dark");
        }
        if (process.env.SPECIAL.includes("keyboard")) await drive(runKeyboard, bt, bname);
        if (process.env.SPECIAL.includes("fields"))
          for (const vp of only ? [only].filter(([w]) => w < 1024) : FIELD_WIDTHS)
            await drive(runFields, bt, bname, vp);
        if (process.env.SPECIAL.includes("convene")) {
          await drive(runConvene, bt, bname, [390, 844], "light");
          await drive(runConvene, bt, bname, [1280, 800], "dark");
          await drive(runConveneZone, bt, bname, [390, 844], "light");
          await drive(runConveneZone, bt, bname, [1280, 800], "dark");
        }
        if (process.env.SPECIAL.includes("silence")) await drive(runSilence, bt, bname);
        if (process.env.SPECIAL.includes("shell"))
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS) {
            await drive(runShell, bt, bname, vp);
            await drive(runLensSeat, bt, bname, vp);
            // Fix PR 09 (G225; 1515, 1575): the strip's shape and its cue.
            const strip = require("./lens-strip.cjs");
            if (strip.LENS_STRIP_WIDTHS.includes(vp[0]))
              await drive(strip.runLensStrip, bt, bname, vp);
          }
        // Ruling 344: the width arm, every viewport.
        if (process.env.SPECIAL.includes("width"))
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            await drive(runWidth, bt, bname, vp);
        if (process.env.SPECIAL.includes("targeted"))
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : TARGETED_VIEWPORTS)
            await drive(runTargeted, bt, bname, vp);
        if (process.env.SPECIAL.includes("profile")) {
          const { runProfile } = require("./profile.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await runProfile(bt, bname, vp, theme);
        }
        // Rulings 193, 194: the vocabulary read served, then forced to fail, on both layouts.
        if (process.env.SPECIAL.includes("vocab")) {
          const { runVocabulary } = require("./vocabulary.cjs");
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              for (const fail of [false, true])
                await drive(runVocabulary, bt, bname, vp, theme, fail);
        }
        // Ruling 198 and Brief 4A: both parties' views, the control end to end, and its focus.
        if (process.env.SPECIAL.includes("block")) {
          const { runBlock, runBlocker, runBlockFlow, runBlockFocus } = require("./block.cjs");
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES) {
              await drive(runBlock, bt, bname, vp, theme);
              await drive(runBlocker, bt, bname, vp, theme);
              await drive(runBlockFlow, bt, bname, vp, theme);
              await drive(runBlockFocus, bt, bname, vp, theme);
            }
        }
        // Brief 5 (ruling 279): the three screens at every viewport and both themes, then the
        // state proofs on the two representative layouts.
        if (process.env.SPECIAL.includes("onboarding")) {
          const {
            runOnboardingLayout,
            runOnboardingFlows,
            runOnboardingPhotoFormats,
          } = require("./onboarding.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runOnboardingLayout, bt, bname, vp, theme);
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runOnboardingFlows, bt, bname, vp, theme);
          // Ruling 345: the HEIC and oversized-JPEG arm runs once per engine, at the compact tier.
          await drive(
            runOnboardingPhotoFormats,
            bt,
            bname,
            [390, 844],
            process.env.THEME || "light",
          );
        }
        // Brief 10 (handoff 30-C item 13): the member's event page at every cell, its flows on the
        // two representative layouts.
        if (process.env.SPECIAL.includes("event")) {
          const {
            runEvent,
            runEventBlocks,
            runEventFlows,
            runGuest,
            runEventLinks,
          } = require("./event.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES) {
              await drive(runEvent, bt, bname, vp, theme);
              await drive(runEventBlocks, bt, bname, vp, theme);
            }
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runEventFlows, bt, bname, vp, theme);
          // Handoff 30-D item 14.3: the public page's guest path on the two representative layouts.
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runGuest, bt, bname, vp, theme);
          // Handoff 32-B item 9: the alias and short-code paths, on the client, at compact and expanded.
          for (const [vp, theme] of [
            [[390, 844], "light"],
            [[1280, 800], "dark"],
          ])
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await drive(runEventLinks, bt, bname, vp, theme);
        }
        if (process.env.SPECIAL.includes("discovery")) {
          const {
            runDiscovery,
            runDiscoveryFacets,
            runDiscoveryPlace,
            FOLLOWUP_ARMS,
            DISCOVERY_VIEWPORTS,
            FACET_VIEWPORTS,
            PLACE_VIEWPORTS,
          } = require("./discovery.cjs");
          for (const vp of only ? [only] : DISCOVERY_VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runDiscovery, bt, bname, vp, theme);
          // Handoff 32-B items 1, 2, 6 and 12 with Addendum 1: redirects, facets, ladders, writes
          // and the rail's memory, one cell per tier plus the wide band.
          for (const [vp, theme] of FACET_VIEWPORTS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await drive(runDiscoveryFacets, bt, bname, vp, theme);
          // Handoff 31-D item 7: the lens, the place and the intent, on their own viewports.
          for (const [vp, theme] of PLACE_VIEWPORTS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await drive(runDiscoveryPlace, bt, bname, vp, theme);
          // Handoff 32-B Addenda 4 and 5: one arm per item (1 to 5, and 8), each on its own cells.
          for (const [run, cells] of FOLLOWUP_ARMS)
            for (const [vp, theme] of cells)
              if (!only || (vp[0] === only[0] && vp[1] === only[1]))
                await drive(run, bt, bname, vp, theme);
        }
        if (process.env.SPECIAL.includes("connect")) {
          const { runConnect } = require("./connect.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runConnect, bt, bname, vp, theme);
        }
        // Handoff 55-A: the bell's dot and Connect's for-you dot, every viewport, both themes.
        if (process.env.SPECIAL.includes("notify")) {
          const { runNotifyDots } = require("./notify-dots.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runNotifyDots, bt, bname, vp, theme);
          // Handoff 60-NC: the panel's controls at every cell, its flows and the landing page on
          // the three tiers' representative cells.
          const nc = require("./notify-controls.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(nc.runNotifyControls, bt, bname, vp, theme);
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : nc.FLOW_CELLS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES) {
              await drive(nc.runNotifyFlows, bt, bname, vp, theme);
              await drive(nc.runUnsubscribed, bt, bname, vp, theme);
            }
        }
        // Handoff 61-S1: the Account drawer at every cell, its flows on the three tiers' cells
        // (tests/account.cjs).
        if (process.env.SPECIAL.includes("account")) {
          const ac = require("./account.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(ac.runAccountDrawer, bt, bname, vp, theme);
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : ac.FLOW_CELLS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES) {
              await drive(ac.runAccountFlows, bt, bname, vp, theme);
              await drive(ac.runAccountSessionGone, bt, bname, vp, theme);
            }
        }
        // Handoff 62-G: the Feed card's comments on the compact, medium and expanded cells
        // (tests/comments.cjs).
        if (process.env.SPECIAL.includes("comments")) {
          const cm = require("./comments.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : cm.FLOW_CELLS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(cm.runComments, bt, bname, vp, theme);
        }
        // Handoff 32-A item 5: the mount arms, one cell per tier (tests/mount.cjs).
        if (process.env.SPECIAL.includes("mount")) {
          const { runMount, MOUNT_CELLS } = require("./mount.cjs");
          for (const [vp, theme] of MOUNT_CELLS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await runMount(bt, bname, vp, theme);
        }
        // Handoff 37-B (1201): every Sheet's enter and exit, frame by frame (tests/sheet.cjs).
        if (process.env.SPECIAL.includes("sheet")) {
          const { runSheets } = require("./sheet.cjs");
          await runSheets(bt, bname, only);
        }
        // Handoff 58-12C2 (Brief 12, 12C part 2): the member app's recording, one call per moment,
        // at the two representative layouts (tests/record.cjs).
        if (process.env.SPECIAL.includes("record")) {
          const { runRecord } = require("./record.cjs");
          for (const vp of only
            ? [only]
            : [
                [390, 844],
                [1280, 800],
              ])
            await drive(runRecord, bt, bname, vp, process.env.THEME || "light");
        }
        // Ruling 1235 (handoff 37-F item 3): the macOS WebKit gate, webkit-macos.yml's `webkit-macos` job (1735).
        // Small by design, because macOS minutes bill at a multiple of Linux: the nine sheet arms
        // (1236's stepped method is the point of the gate) and the sheet-focus arm (1484), the member event page and its blocks at
        // the two representative cells with its flows (the arm G5 hit on run 419 among them), the
        // composer as the publish flow at compact and its guards at expanded (the bottom sheet and
        // the drawer), sign-in's layout at both cells with its flows at compact, and (ruling 1550) the
        // .mov through the composer's own video input, because Linux WebKit's <video> cannot read the
        // fixture at all (run 523) and the Mac port is the only engine here that might; and (56-41E) the
        // reactions arm at both cells. Twenty-four arms.
        if (process.env.SPECIAL.includes("gate")) {
          const { runSheets } = require("./sheet.cjs");
          const { runEvent, runEventBlocks, runEventFlows } = require("./event.cjs");
          const { runAuthLayout, runAuthFlows } = require("./auth.cjs");
          const cells = [
            [[390, 844], "light"],
            [[1280, 800], "dark"],
          ];
          await runSheets(bt, bname, only);
          for (const [vp, theme] of cells)
            if (!only || (vp[0] === only[0] && vp[1] === only[1])) {
              await drive(runEvent, bt, bname, vp, theme);
              await drive(runEventBlocks, bt, bname, vp, theme);
              await drive(runEventFlows, bt, bname, vp, theme);
              await drive(runAuthLayout, bt, bname, vp, theme);
            }
          if (!only || (only[0] === 390 && only[1] === 844)) {
            await drive(runPublish, bt, bname, [390, 844], "light");
            await drive(runAuthFlows, bt, bname, [390, 844], "light");
          }
          if (!only || (only[0] === 1280 && only[1] === 800))
            await drive(runPublishGuards, bt, bname, [1280, 800], "dark");
          const { runMessengerComposerVideo } = require("./messenger-composer-video.cjs");
          await drive(runMessengerComposerVideo, bt, bname);
          // Handoff 56-41E item 3: the reactions arm at both cells, because the drawn glyphs, the
          // picker's Sheet and the portrait player differ on Safari. Twenty-four arms.
          const { runMessengerReactions } = require("./messenger.cjs");
          for (const [vp, theme] of cells)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await drive(runMessengerReactions, bt, bname, vp, theme);
        }
        // Brief 4B (rulings 230 to 236, 240): sign-in's additions, the two reset routes and the
        // signed-in change-password path. The layout pass runs everywhere; the state flows run on
        // the two representative layouts, as vocab and block do.
        // Handoff 40-B section 6: the admin app's arms at ADMIN_BASE, the dna-admin deployment.
        if (process.env.SPECIAL.includes("admin")) {
          const { runAdminSignedOut, runAdminAccounts } = require("./auth.cjs");
          await drive(runAdminSignedOut, bt, bname, [390, 844], "light");
          await drive(runAdminSignedOut, bt, bname, [1280, 800], "dark");
          await drive(runAdminAccounts, bt, bname, [1280, 800], "light");
          // Handoff 45-B (Brief 12 12B): the Overview's page arms and the drawer's focus return (1366).
          const {
            runAdminOverview,
            runAdminOverviewError,
            runAdminDrawerFocus,
          } = require("./overview.cjs");
          await drive(runAdminOverview, bt, bname, [1280, 800], "light");
          await drive(runAdminOverview, bt, bname, [390, 844], "dark");
          await drive(runAdminOverviewError, bt, bname, [1280, 800], "light");
          await drive(runAdminDrawerFocus, bt, bname, [390, 844], "light");
          await drive(runAdminDrawerFocus, bt, bname, [820, 1180], "dark");
          // Handoff 45-C (1377): the admin app follows the device, at both widths and both schemes.
          const { runAdminTheme } = require("./theme.cjs");
          for (const vp of [
            [390, 844],
            [1280, 800],
          ])
            for (const theme of ["light", "dark"]) await drive(runAdminTheme, bt, bname, vp, theme);
          // H-BS7-RESKIN item 9: the admin sign-in and console draw the wordmark in --ink.
          const { runAdminBrand, BRAND_CELLS } = require("./brand.cjs");
          for (const [vp, theme] of BRAND_CELLS) await drive(runAdminBrand, bt, bname, vp, theme);
          // Handoff 45-D (Brief 12, admin Settings): arms 5 to 8.
          const {
            runAdminSettings,
            runAdminOverviewZone,
            runAdminDiaOff,
            runAdminAppearance,
            runAdminStaffRole,
          } = require("./settings.cjs");
          await drive(runAdminSettings, bt, bname, [390, 844], "dark", "admin");
          await drive(runAdminSettings, bt, bname, [820, 1180], "light", "analyst");
          await drive(runAdminSettings, bt, bname, [1280, 800], "light", "admin");
          await drive(runAdminSettings, bt, bname, [1280, 800], "dark", "analyst");
          await drive(runAdminOverviewZone, bt, bname, [1280, 800], "light");
          await drive(runAdminDiaOff, bt, bname, [390, 844], "light");
          await drive(runAdminAppearance, bt, bname, [390, 844]);
          await drive(runAdminAppearance, bt, bname, [1280, 800]);
          // Handoff 45-E: a role without the Overview opens on Settings (1462, 1464).
          await drive(runAdminStaffRole, bt, bname, [390, 844], "dark");
          await drive(runAdminStaffRole, bt, bname, [1280, 800], "light");
        }
        // H-BS7-RESKIN item 9: the member app's brand arms alone (tests/brand.cjs).
        if (process.env.SPECIAL.includes("brand")) {
          const { runBrand, BRAND_CELLS } = require("./brand.cjs");
          for (const [vp, theme] of BRAND_CELLS) await drive(runBrand, bt, bname, vp, theme);
        }
        // Handoff 45-C arm 3: the member app's theme on a dark device with no stored choice.
        if (process.env.SPECIAL.includes("theme")) {
          const { runMemberTheme } = require("./theme.cjs");
          await drive(runMemberTheme, bt, bname, [390, 844]);
          await drive(runMemberTheme, bt, bname, [1280, 800]);
        }
        // Handoff 60-MEDIA-2 Work 2: the Feed card's right edge either side of the expanded tier's
        // widths, at rest and after a 2,000 px scroll (tests/media-sites.cjs).
        if (process.env.SPECIAL.includes("edge")) {
          const { runFeedEdge, FEED_EDGE_WIDTHS, FEED_EDGE_HEIGHT } = require("./media-sites.cjs");
          for (const w of FEED_EDGE_WIDTHS)
            if (!only || only[0] === w) await drive(runFeedEdge, bt, bname, [w, FEED_EDGE_HEIGHT]);
        }
        // Handoff 60-MEDIA-2 Work 3: the profile's portrait and cover open the viewer (1714).
        if (process.env.SPECIAL.includes("viewer")) {
          const { runProfileViewer, PROFILE_CELLS } = require("./media-sites.cjs");
          for (const [vp, theme] of PROFILE_CELLS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              await drive(runProfileViewer, bt, bname, vp, theme);
        }
        // Handoff 41-B section 5: the Messenger media routes on the deployed URL, with the two
        // seeded accounts for real (tests/messenger-media.cjs).
        if (process.env.SPECIAL.includes("media")) {
          const { runMessengerMedia } = require("./messenger-media.cjs");
          await drive(runMessengerMedia, bt, bname);
          // Handoff 56-MOV item 3 (G224): a .mov through the composer's own file input.
          const { runMessengerComposerVideo } = require("./messenger-composer-video.cjs");
          await drive(runMessengerComposerVideo, bt, bname);
          // Handoff 41-C item 5: the surfaces on the deployment with the same two accounts.
          const { runMessengerLive } = require("./messenger.cjs");
          await drive(runMessengerLive, bt, bname);
        }
        // Handoff 41-C item 5 (SPEC 41-14 "Arms"): the Messenger's responsive matrix at 360, 390,
        // 820 and 1280 in both themes, and its flows on the two representative cells, on the mock.
        if (process.env.SPECIAL.includes("messenger")) {
          const m = require("./messenger.cjs");
          for (const vp of m.LAYOUT_CELLS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1]))
              for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
                await drive(m.runMessengerLayout, bt, bname, vp, theme);
          for (const [vp, theme] of m.FLOW_CELLS)
            if (!only || (vp[0] === only[0] && vp[1] === only[1])) {
              await drive(m.runMessengerFlows, bt, bname, vp, theme);
              // Handoff 56-41E item 3: SPEC-41-E's second pass on the same two cells.
              await drive(m.runMessengerReactions, bt, bname, vp, theme);
            }
        }
        if (process.env.SPECIAL.includes("auth")) {
          const { runAuthLayout, runAuthFlows } = require("./auth.cjs");
          for (const vp of process.env.ONLY ? [JSON.parse(process.env.ONLY)] : VIEWPORTS)
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runAuthLayout, bt, bname, vp, theme);
          for (const vp of process.env.ONLY
            ? [JSON.parse(process.env.ONLY)]
            : [
                [390, 844],
                [1280, 800],
              ])
            for (const theme of process.env.THEME ? [process.env.THEME] : THEMES)
              await drive(runAuthFlows, bt, bname, vp, theme);
        }
      }
      finish({ full: false, engines: specialEngines.map(([n]) => n) });
    }
    const engines = selectEngines();
    // H63-CI (rulings 1846, 1847, 1881): SHARD=k/n runs the units tests/matrix-shards.json gives
    // shard k of the engine's n, in the order below, and no other; unset, every unit runs.
    const shard = require("./shards.cjs").fromEnv({ engines, only });
    for (const [bname, bt] of engines) {
      const units = fullUnits(bt, bname, only);
      for (const u of shard ? shard.pick(bname, units) : units) await u.run();
      if (only) {
        finish({ full: false, engines: engines.map(([n]) => n) });
      }
    }
    finish({ full: !shard, shard, engines: engines.map(([n]) => n) });
  })().catch((e) => {
    // Ruling 228: a run that dies mid-flow still owes a report. The arm that was open is short of
    // its declared count and is named as incomplete, rather than the whole run vanishing.
    record("the matrix run completed without throwing", false, String(e).slice(0, 1200));
    try {
      finish({ full: false, engines: [] });
    } catch {
      process.exit(1);
    }
  });
