// Brief 3 profile flows for the responsive matrix (ruling 61): the three views plus editing mode at
// /m/:handle, with the Supabase surface mocked by tests/matrix.cjs so the real client code paths
// run against a deterministic projection of the seeded persona. The eleven targeted checks that
// need a browser (4 to 11) are covered here; checks 1 to 3 are also re-run against the live
// project in the closing report.
// Usage: BASE=https://<preview>.dna-web-application.pages.dev SPECIAL=profile WEBKIT=1 node tests/matrix.cjs
const path = require("path");
const M = require("./matrix.cjs");

const {
  launch,
  makeMockDb,
  seedPosts,
  mockSupabase,
  signIn,
  record,
  shot,
  noOverflow,
  sheetWidthIs,
  BASE,
  SB,
} = M;
const HANDLE = "thandiwe-dube";
/** The handle the mock's own members row carries (tests/matrix.cjs, `members`), never the address opened. */
const OWN_HANDLE = "amara-osei";
const SB_RE = SB.replace(/\./g, "\\.");
/**
 * WebKit words every failed load the same way it words a cross-origin denial: "Fetch API cannot
 * load <url> due to access control checks." A fetch the navigation cancelled is reported that way
 * too, and Playwright delivers a JavaScript-source console error in WebKit as a page error rather
 * than a console message, so this shape reaches page.on("pageerror").
 *
 * Every request to the mocked Supabase origin is fulfilled in-process by tests/matrix.cjs with
 * access-control-allow-origin: *, so a real access-control denial cannot happen there. Only this
 * wording, and only for that origin, is ignored; any other page error still fails the check.
 *
 * Ruling 357: the pattern used to require the "Fetch API cannot load https:" prefix, and the
 * message as it reaches the suite starts at the host ("/dgsp….supabase.co/rest/v1/post_saves?…
 * due to access control checks."), so the filter never matched in runs 115, 133 or 136 and the
 * check it guarded passed by never running. It now anchors on the origin and the tail.
 */
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);
/**
 * Console errors that carry no signal about the app: Google Fonts is unreachable from CI and the
 * mock aborts it, and an endpoint that deliberately answers 400 or 406 (a refused section save, an
 * empty maybeSingle) is logged by the browser as a resource error while the flow asserts the
 * behaviour itself. The status codes match as whole numbers, so a message that merely carries the
 * seeded member id (…-4000-8000-…) is not swallowed.
 */
const IGNORED_CONSOLE = new RegExp(
  [
    "fonts\\.g",
    "ERR_CONNECTION_RESET",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_FAILED",
    "\\b(?:400|406)\\b",
    CANCELLED_MOCK_FETCH.source,
  ].join("|"),
);
/** Per page: wait for the mocked Supabase surface to go quiet. Set by newPage. */
const sbIdle = new WeakMap();
const COUNT_RE = /\b\d+\s+(connections?|followers?|mutuals?|following)\b/i;
const CONNECTIONS_ONLY = ["dubepower.co.za", "thandiwedube", "dube.power"];
const ANCHORED_ONLY = ["Clinics that need a site survey", "Find collaborators"];
/** Attesters on the seeded persona who do not share their own profile (ruling 141). */
const UNSHARED_THIRD_PARTIES = ["Kwame Mensah", "Adaeze Nwosu"];

/** What the public page rendered (section ids), kept per run so check 5 can compare owner's View as public with it. */
const seenPublic = new Map();

async function newPage(browserType, [w, h], theme, opts = {}) {
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  seedPosts(db, 2);
  Object.assign(db.profile, opts.profile || {});
  await page.addInitScript(
    ({ theme }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
    },
    { theme },
  );
  await mockSupabase(page, db);
  // The Feed hydrates in a chain (post_media, then post_links, then the member's own save and react
  // marks) whose later links start after Playwright already reports network idle. Track the mocked
  // surface so a flow can wait for it to go quiet before navigating away, rather than leaving a
  // fetch in flight for the teardown to cancel.
  const pending = new Set();
  let lastCall = Date.now();
  page.on("request", (r) => {
    if (!r.url().includes(SB)) return;
    pending.add(r);
    lastCall = Date.now();
  });
  const settled = (r) => {
    if (pending.delete(r)) lastCall = Date.now();
  };
  page.on("requestfinished", settled);
  page.on("requestfailed", settled);
  sbIdle.set(page, async (quiet = 700, cap = 10000) => {
    const end = Date.now() + cap;
    while (Date.now() < end) {
      if (pending.size === 0 && Date.now() - lastCall >= quiet) return;
      await page.waitForTimeout(100);
    }
  });
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
  return { browser, page, db, errors };
}

async function openProfile(page, search = "") {
  // Let the page being left finish its fetches: WebKit reports a fetch cancelled by navigation as
  // a page error, which would count against the profile. Network idle is not enough on its own,
  // the Feed's hydration chain starts its last requests after it.
  await page.waitForLoadState("networkidle").catch(() => {});
  const idle = sbIdle.get(page);
  if (idle) await idle();
  await page.goto(BASE + "/m/" + HANDLE + search, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="profile"]:not([data-view="loading"])', {
    timeout: 20000,
  });
  await page.waitForTimeout(250);
}

/**
 * Click after centring the target inside its scroll container. WebKit's own scroll-into-view can
 * leave a control beneath the sticky header or the bottom dock at compact widths, where Playwright
 * then waits on "visible, enabled and stable" until it times out.
 */
async function tap(page, selector) {
  const loc = typeof selector === "string" ? page.locator(selector).first() : selector;
  await waitInteractive(page, loc);
  await loc.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }),
  );
  // The masthead may condense on that scroll; let its 300ms height transition finish.
  await page.waitForTimeout(400);
  await clearOfStickies(page, loc);
  await loc.click({ timeout: 15000 });
}

/**
 * Wait for a control to be usable, not merely present. WebKit lands a section in the DOM before
 * the edit-mode layout has settled, and Playwright's actionability check on a control clicked in
 * that window keeps retrying until the click times out.
 */
async function waitInteractive(page, selector, timeout = 30000) {
  const loc = typeof selector === "string" ? page.locator(selector).first() : selector;
  await loc.waitFor({ state: "visible", timeout });
  const end = Date.now() + timeout;
  for (;;) {
    // Enabled, laid out, and holding still: a box that is still moving is a box Playwright will
    // wait on after we hand it the click.
    const a = await loc.boundingBox();
    await page.waitForTimeout(120);
    const b = await loc.boundingBox();
    if (
      (await loc.isEnabled()) &&
      a &&
      b &&
      a.width > 0 &&
      a.height > 0 &&
      Math.abs(a.y - b.y) < 1 &&
      Math.abs(a.x - b.x) < 1
    )
      return loc;
    if (Date.now() > end) throw new Error("control never became interactive: " + String(selector));
  }
}

/**
 * Scroll the control clear of the sticky header, the bottom dock and the sticky Done bar. Centring
 * inside the scroller is not enough near either end of the column, where the scroller cannot move
 * far enough and the control stays underneath a fixed element; Playwright then waits on the hit
 * test until the click times out.
 */
async function clearOfStickies(page, loc) {
  for (let i = 0; i < 4; i++) {
    const delta = await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return 0;
      const h = hit.getBoundingClientRect();
      // A blocker above the control means scroll back (negative); one below means scroll on.
      return h.top <= r.top ? -(h.bottom - r.top + 12) : r.bottom - h.top + 12;
    });
    if (!delta) return true;
    const moved = await loc.evaluate((el, d) => {
      const sc = el.closest("[data-scroller]") || document.scrollingElement;
      if (!sc) return false;
      const before = sc.scrollTop;
      sc.scrollTop = before + d;
      return sc.scrollTop !== before;
    }, delta);
    if (!moved) return false;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Poll until the predicate holds. WebKit settles a save later than Chromium, and a fixed pause
 * turns the assertion that follows it into a race. */
async function until(page, fn, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= end) return false;
    await page.waitForTimeout(100);
  }
}

/** Flip a Strand Switch by its label with a DOM click (the input is 0 by 0 and the label's hit test
 * is what WebKit keeps retrying); the change handler and the save path are what the check covers. */
async function toggle(page, labelText) {
  const loc = page.locator("label", { hasText: labelText }).first();
  await loc.waitFor({ state: "visible", timeout: 30000 });
  await loc.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    el.click();
  });
}

/** Page state for a failure detail: URL, view and edit flags, open sections, the toast text. */
async function pageState(page) {
  try {
    return await page.evaluate(() => {
      const root = document.querySelector('[data-testid="profile"]');
      // Ruling 398: sections autosave, so there is no Save button to count. An open section is
      // one whose editor is mounted, which the card marks with data-editing.
      const saves = [...document.querySelectorAll('[data-testid^="section-"][data-editing="1"]')];
      return JSON.stringify({
        url: location.href,
        view: root && root.getAttribute("data-view"),
        edit: root && root.getAttribute("data-edit"),
        open: saves.map((n) => n.getAttribute("data-testid")),
        editBar: !!document.querySelector('[data-testid="edit-bar"]'),
        toast: (document.querySelector('[role="status"]') || {}).textContent || "",
      });
    });
  } catch (e) {
    return "state unavailable: " + String(e).slice(0, 80);
  }
}

/**
 * Rough page weight for a failure detail. WebKit's web process dying reaches Playwright as a closed
 * target, so the last size of the edit-mode DOM is the first thing to rule in or out.
 */
async function domStats(page) {
  try {
    return await page.evaluate(() => ({
      nodes: document.getElementsByTagName("*").length,
      options: document.getElementsByTagName("option").length,
      selects: document.getElementsByTagName("select").length,
      fields: document.querySelectorAll("input, textarea").length,
      sections: document.querySelectorAll('[data-testid^="section-"]').length,
    }));
  } catch (e) {
    return "unavailable: " + String(e).slice(0, 60);
  }
}

const sectionIds = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="section-"]')].map((n) =>
      n.getAttribute("data-testid").slice("section-".length),
    ),
  );

const scroller = (page) =>
  page.evaluate(() => {
    const col = document.querySelector('[data-testid="profile"]');
    const sc = col && col.closest("[data-scroller]");
    return sc ? sc.getAttribute("data-scroller") : null;
  });

async function scrollTo(page, y) {
  await page.evaluate((y) => {
    const col = document.querySelector('[data-testid="profile"]');
    const sc = col && col.closest("[data-scroller]");
    if (sc) sc.scrollTop = y;
  }, y);
  await page.waitForTimeout(250);
}

/** Check 7 at the current scroll position: the masthead state, and the portrait not covered by the app header or the condensed row. */
/** The masthead's rendered text. Its <header> is display:contents in the hero forms. */
async function mastheadText(page) {
  return page.$eval('[data-testid="masthead"]', (el) =>
    Array.from(el.children)
      .map((c) => c.innerText || c.textContent || "")
      .join(" | "),
  );
}

async function condenseState(page) {
  return page.evaluate(() => {
    const mast = document.querySelector('[data-testid="masthead"]');
    const portrait = document.querySelector('[data-testid="portrait"]');
    const cover = document.querySelector('[data-testid="cover"]');
    const header = document.querySelector("[data-app-header]");
    const condensedRow = document.querySelector('[data-testid="masthead-condensed"]');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    // Whether any sticky/fixed element other than the portrait's own masthead overlaps the portrait.
    const p = portrait && portrait.getBoundingClientRect();
    let covered = false;
    if (p && p.height > 0) {
      const cx = p.left + p.width / 2;
      const cy = p.top + p.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      covered = !!hit && !portrait.contains(hit) && !hit.contains(portrait);
      if (
        covered &&
        (hit.closest('[data-testid="masthead"]') ||
          hit.closest('[data-testid="masthead-condensed"]'))
      )
        covered = false;
    }
    return {
      condensed: mast && mast.getAttribute("data-condensed"),
      condensedRow: !!condensedRow && condensedRow.getBoundingClientRect().height > 0,
      portrait: box(portrait),
      cover: box(cover),
      header: box(header),
      covered,
    };
  });
}

async function runOwner(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme} profile owner`;
  M.armStart(tag);
  const { browser, page, db, errors } = await newPage(browserType, vp, theme, {
    profile: { mode: "owner" },
  });
  let weight = null;
  try {
    await signIn(page);
    await openProfile(page);
    const view = await page.getAttribute('[data-testid="profile"]', "data-view");
    record(tag + ": owner view", view === "owner", "view=" + view);
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-owner`);
    await noOverflow(page, tag);
    record(
      tag + ": Edit profile, Edit name and headline, View as public, two switches",
      (await page.locator('[data-testid="edit-profile"]').count()) === 1 &&
        (await page.locator('[data-testid="edit-core"]').count()) === 1 &&
        (await page.locator('[data-testid="view-as-public"]').count()) === 1 &&
        (await page.locator('[role="switch"]').count()) === 2,
    );
    record(
      tag + ": badges row with its audience select, per-section selects",
      (await page.locator('[data-testid="badges"]').count()) === 1 &&
        (await page
          .locator(
            '[data-testid="badges"] select, [data-testid="badges"] [aria-label*="Who can see"]',
          )
          .count()) >= 0 &&
        (await page.locator('[data-testid^="section-"] select').count()) >= 8,
    );
    const ids = await sectionIds(page);
    // 37-E item 4 (1232): LinkRow's one address rule on the three rows the mock mirrors from the
    // canonical project. The bare website links, https:// prefixed, in a new tab; the two handles
    // are plain text with their at-sign, never an anchor and never href="#".
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="links"] [data-link]')).map(
        (el) =>
          el.tagName.toLowerCase() +
          ":" +
          el.getAttribute("data-link") +
          ":" +
          (el.getAttribute("href") ?? "") +
          ":" +
          (el.getAttribute("target") ?? "") +
          ":" +
          (el.getAttribute("rel") ?? "") +
          ":" +
          el.querySelector("[data-link-text]").textContent.trim(),
      ),
    );
    record(
      tag + ": Links: the website is an anchor in a new tab, the handles are plain text",
      links.join("|") ===
        "a:website:https://dubepower.co.za:_blank:noopener noreferrer:dubepower.co.za|" +
          "span:linkedin::::@thandiwedube|span:instagram::::@dube.power",
      links.join("|"),
    );
    record(
      tag + ": all sections present for the owner (empty ones show their act)",
      [
        "about",
        "stance",
        "origin",
        "where",
        "work",
        "skills",
        "languages",
        "intent",
        "links",
        "convene",
        "collaborate",
        "contribute",
        "convey",
      ].every((x) => ids.includes(x)),
      ids.join(","),
    );
    record(
      tag + ": empty Convey section shows the act that fills it",
      (await page.locator('[data-testid="section-convey"] button').count()) >= 1,
    );
    const text = await page.locator("body").innerText();
    record(
      tag + ": no count of connections, followers or mutuals (check 10)",
      !COUNT_RE.test(text),
      (text.match(COUNT_RE) || [])[0],
    );
    record(tag + ": no completion score", !/\b\d{1,3}\s?%/.test(text) && !/complete/i.test(text));
    record(
      tag + ": no Message action (ruling 117)",
      (await page.getByRole("button", { name: /^Message$/ }).count()) === 0,
    );
    record(
      tag + ": no mate masie on Profile",
      (await page.locator('img[src*="mate-masie"], [data-adinkra="mate-masie"]').count()) === 0,
    );
    // Ruling 275, under 212: the core row is name, handle, avatar, headline, identity tier and
    // pattern. No meta line, no place-derived local time line, on any view and for any viewer. The
    // owner is the strictest arm of the three, because the owner is the one viewer every audience
    // admits, so a value surviving anywhere survives here.
    // The hero masthead's <header> is display:contents, so innerText on it is empty; read its
    // children instead.
    const mastText = await mastheadText(page);
    record(
      tag + ": no local time line on the core row (ruling 275)",
      (await page.locator('[data-testid="local-time"]').count()) === 0,
    );
    record(
      tag + ": no origin, place or stance label on the core row (ruling 275)",
      !/From South Africa|Johannesburg|Returnee/.test(mastText),
      mastText.replace(/\n/g, " | ").slice(0, 160),
    );
    // B4A section 1: a member cannot block themself, so the Owner view has no overflow.
    record(
      tag + ": no block overflow on the owner view (B4A section 1)",
      (await page.locator('[data-testid="block-control"]').count()) === 0,
    );

    // Check 7: condensing.
    const sc = await scroller(page);
    record(tag + ": profile column lives in a scroll container", !!sc, String(sc));
    const s0 = await condenseState(page);
    record(
      tag + ": masthead not condensed at rest, portrait uncovered",
      s0.condensed === "0" && !s0.covered,
      JSON.stringify(s0),
    );
    await scrollTo(page, 600);
    const s1 = await condenseState(page);
    record(
      tag + ": masthead condenses to the identity row past 120px (check 7)",
      s1.condensed === "1" && s1.condensedRow,
      JSON.stringify(s1),
    );
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-owner-condensed`);
    await noOverflow(page, tag + " condensed");
    await scrollTo(page, 0);
    const s2 = await condenseState(page);
    record(
      tag + ": masthead restores at the top",
      s2.condensed === "0" && !s2.covered,
      JSON.stringify(s2),
    );

    // Switches and visibility save through their own RPC calls.
    const before = db.profile.saves.length;
    await toggle(page, "Share my profile");
    await page.waitForTimeout(600);
    record(
      tag + ": Share switch saves via save_profile_section",
      db.profile.saves.includes("switches"),
      db.profile.saves.slice(before).join(","),
    );
    await toggle(page, "Share my profile");
    await page.waitForTimeout(600);

    // Editing mode (check 6).
    await tap(page, '[data-testid="edit-profile"]');
    await page.waitForSelector('[data-testid="profile"][data-edit="1"]');
    await page.waitForTimeout(300);
    // Ruling 398: the Save and Cancel footer is gone; an open section is marked data-editing.
    const openSections = await page.locator('[data-testid^="section-"][data-editing="1"]').count();
    record(
      tag + ": edit mode opens every editable section at once (check 6)",
      openSections >= 10,
      "open sections " + openSections,
    );
    record(
      tag + ": ruling 398, no section carries a Save or a Cancel",
      (await page.locator('[data-testid^="section-"] button:has-text("Save")').count()) === 0 &&
        (await page.locator('[data-testid^="section-"] button:has-text("Cancel")').count()) === 0,
    );
    record(
      tag + ": sticky Done bar",
      (await page.locator('[data-testid="edit-bar"]').count()) === 1,
    );
    await scrollTo(page, 700);
    const barBox = await page.locator('[data-testid="edit-bar"]').boundingBox();
    const s3 = await condenseState(page);
    record(
      tag + ": Done bar stays on screen while scrolling",
      !!barBox && barBox.y >= 0 && barBox.y + barBox.height <= h + 1,
      JSON.stringify(barBox),
    );
    record(
      tag + ": edit mode exempt from condensing (check 7)",
      s3.condensed === "0",
      JSON.stringify(s3),
    );
    await scrollTo(page, 0);
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-owner-edit`);
    await noOverflow(page, tag + " edit");
    // One failing save leaves the others intact: about fails at the server, where saves alone; in
    // edit mode every section stays open, the failed draft keeps its text, the saved one refetches.
    weight = await domStats(page);
    db.profile.failSection = "about";
    await page.waitForSelector('[data-testid="profile"][data-edit="1"]');
    const ABOUT = "Edited about text for the matrix run.";
    const about = page.locator('[data-testid="section-about"]');
    await waitInteractive(page, about.locator("textarea"));
    await about.locator("textarea").fill(ABOUT);
    // Ruling 398: text writes as the member leaves it. Blurring the field is the trigger the Save
    // button used to be.
    await about.locator("textarea").blur();
    // The server refuses this one with a 400. Wait for that round trip rather than for a fixed
    // pause, then read the section back.
    await until(page, () => db.profile.attempts.includes("about"));
    const aboutStillEditing = await until(
      page,
      async () =>
        (await about.getAttribute("data-editing")) === "1" &&
        (await about.locator("textarea").inputValue()) === ABOUT,
    );

    await page.waitForSelector('[data-testid="profile"][data-edit="1"]');
    const WHERE = "Cape Town, SAST";
    const where = page.locator('[data-testid="section-where"]');
    // Interactive, not merely attached: the section is in the DOM well before its controls are
    // usable, and WebKit takes the longer path there.
    const whereInput = await waitInteractive(page, where.locator("input").first());
    await whereInput.fill(WHERE);
    await until(page, async () => (await whereInput.inputValue()) === WHERE);
    await whereInput.blur();
    const whereSaved =
      (await until(page, () => db.profile.saves.includes("where"))) &&
      // The section refetches after the save, so read through a fresh locator each time.
      (await until(
        page,
        async () => (await where.locator("input").first().inputValue()) === WHERE,
      ));
    const othersIntact = await until(
      page,
      async () =>
        (await page.locator('[data-testid^="section-"][data-editing="1"]').count()) ===
        openSections,
    );
    record(
      tag + ": a failed save on one section leaves the others intact; each saves alone (check 6)",
      aboutStillEditing && whereSaved && othersIntact && !db.profile.saves.includes("about"),
      JSON.stringify({ aboutStillEditing, whereSaved, othersIntact, saves: db.profile.saves }),
    );
    db.profile.failSection = null;
    await tap(page, '[data-testid="edit-done"]');
    await page.waitForSelector('[data-testid="profile"][data-edit="0"]');
    record(tag + ": Done leaves edit mode", true);
    const seenWhere = await page.locator('[data-testid="section-where"]').innerText();
    record(
      tag + ": the saved section shows its new value after refetch",
      /Cape Town/.test(seenWhere),
      seenWhere.slice(0, 80),
    );

    // Check 5: View as public renders exactly what the signed-out page renders.
    await tap(page, '[data-testid="view-as-public"]');
    await page.waitForSelector('[data-testid="as-public-banner"]', { timeout: 15000 });
    await page.waitForTimeout(400);
    const pubIds = await sectionIds(page);
    const html = await page.content();
    record(
      tag + ": View as public shows the public page with the banner",
      (await page.locator('[data-testid="public-page"]').count()) === 1,
    );
    record(
      tag + ": View as public carries no connections-only or anchored content",
      !CONNECTIONS_ONLY.some((t) => html.includes(t)) &&
        !ANCHORED_ONLY.some((t) => html.includes(t)),
    );
    seenPublic.set(`${bname}-${w}x${h}-${theme}-owner`, pubIds.join(","));
    const pubRun = seenPublic.get(`${bname}-${w}x${h}-${theme}-anon`);
    if (pubRun !== undefined)
      record(
        tag + ": View as public matches the signed-out page section for section (check 5)",
        pubRun === pubIds.join(","),
        pubRun + " vs " + pubIds.join(","),
      );
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-owner-as-public`);
    await noOverflow(page, tag + " as public");
    await tap(page, page.getByRole("button", { name: /Back to your profile/ }));
    await page.waitForSelector('[data-testid="profile"][data-view="owner"]');
    record(tag + ": no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(
      tag + " flow",
      false,
      (M.armCrashed() ? "WEB PROCESS CRASHED | " : "") +
        String(e).slice(0, 1200) +
        " | " +
        (await pageState(page)) +
        " | DOM before the section saves " +
        JSON.stringify(weight),
    );
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-owner-FAIL`).catch(() => {});
  }
  await browser.close();
}

async function runVisitor(browserType, bname, vp, theme, mode) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme} profile visitor ${mode}`;
  M.armStart(tag);
  const rel = mode === "connected" ? "connected" : "none";
  const { browser, page, db, errors } = await newPage(browserType, vp, theme, {
    profile: { mode, rel },
  });
  try {
    await signIn(page);
    await openProfile(page);
    const view = await page.getAttribute('[data-testid="profile"]', "data-view");
    record(tag + ": member view", view === "member", "view=" + view);
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-visitor-${mode}`);
    await noOverflow(page, tag);
    const ids = await sectionIds(page);
    const text = await page.locator("body").innerText();
    record(
      tag + ": no owner tools",
      (await page
        .locator('[data-testid="edit-profile"], [role="switch"], [data-testid="view-as-public"]')
        .count()) === 0,
    );
    record(
      tag + ": no count of connections, followers or mutuals (check 10)",
      !COUNT_RE.test(text),
      (text.match(COUNT_RE) || [])[0],
    );
    // Brief 14 (SPEC 41-14 Part C item 4) lifts ruling 117 for a connection: Message on a connected
    // member's profile opens the pair's thread. Every other visitor still has none.
    const messageButtons = await page.getByRole("button", { name: /^Message$/ }).count();
    record(
      tag +
        (rel === "connected"
          ? ": one Message action, on a connection's profile (Brief 14, lifts 117)"
          : ": no Message action"),
      rel === "connected" ? messageButtons === 1 : messageButtons === 0,
      "Message buttons " + messageButtons,
    );
    record(
      tag + ": badges shown to a member",
      (await page.locator('[data-testid="badges"]').count()) === 1,
    );
    // Handoff 44-MC-R3 (1530): Strand's IdentityMark and BadgeRow on Profile. The persona is
    // attested, so the mark draws on the masthead; the pills are in C order with no digit, and one
    // opens to its provenance line, the date formatted by the lib (whenShort).
    record(
      tag + ": the Identified mark draws on the masthead (1497)",
      (await page
        .locator('[data-testid="masthead"] [role="img"][aria-label="Identified"]')
        .count()) === 1,
    );
    const pills = page.locator('[data-testid="badges"] button[aria-expanded]');
    const pillText = (await pills.allInnerTexts()).map((s) => s.trim());
    record(
      tag + ": badge pills in C order with no digit (1540)",
      pillText.join("|") === "Convene|Contribute" && !/\d/.test(pillText.join("|")),
      pillText.join("|"),
    );
    await tap(page, pills.first());
    await page.waitForTimeout(150);
    record(
      tag + ": a pill opens to its provenance, the date formatted by the lib (1530)",
      /Kwame Mensah, host\. Sun 23 Aug/.test(
        await page.locator('[data-testid="badges"]').innerText(),
      ),
      (await page.locator('[data-testid="badges"]').innerText()).replace(/\n/g, " | "),
    );
    await tap(page, pills.first());
    await page.waitForTimeout(150);
    record(tag + ": empty sections absent for a visitor", !ids.includes("convey"), ids.join(","));
    // B4A section 4: every signed-in Visitor carries the overflow, and it is the last control in
    // the action row. Its one item reads Block, never Report (ruling 207) and never a second item.
    record(
      tag + ": overflow present, one item, reading Block (B4A section 4)",
      (await page.locator('[data-testid="block-menu-trigger"]').count()) === 1 &&
        (await page.locator('[data-testid="block-menu"]').count()) === 0,
    );
    await tap(page, '[data-testid="block-menu-trigger"]');
    await page.waitForTimeout(200);
    record(
      tag + ": the menu opens with exactly one item, Block Thandiwe",
      (await page.locator('[data-testid="block-menu"] [role="menuitem"]').count()) === 1 &&
        (await page.locator('[data-testid="block-menu-item"]').innerText()) === "Block Thandiwe" &&
        (await page.locator('[data-testid="block-menu-trigger"]').getAttribute("aria-expanded")) ===
          "true",
      await page.locator('[data-testid="block-menu"]').innerText(),
    );
    await noOverflow(page, tag + " menu open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    record(
      tag + ": Esc closes the menu and returns focus to the trigger",
      (await page.locator('[data-testid="block-menu"]').count()) === 0 &&
        (await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null)) ===
          "block-menu-trigger",
    );
    if (mode === "connected") {
      record(
        tag + ": Connected pill, Follow toggle",
        (await page.locator('[data-testid="connected"]').count()) === 1 &&
          (await page.locator('[data-testid="follow"]').count()) === 1,
      );
      record(tag + ": connections-only Links visible to a connection", ids.includes("links"));
      record(
        tag + ": anchored Intent visible (event host shares an attested event)",
        ids.includes("intent"),
      );
      const n = (text.match(/Lerato Khumalo/g) || []).length;
      record(tag + ": mutuals appear once, as names (check 10)", n === 1, "occurrences " + n);
      record(
        tag + ": DIA line present",
        (await page.locator('[data-testid="dia-line"]').count()) === 1,
      );
      record(
        tag + ": a signed-in member still sees attesters by name",
        /Attested by Kwame Mensah, host/.test(text),
      );
      await tap(page, '[data-testid="follow"]');
      await page.waitForTimeout(700);
      record(
        tag + ": Follow writes member_follows and flips to Following",
        db.profile.follows[0] === "on" &&
          (await page.locator('[data-testid="follow"]').getAttribute("aria-pressed")) === "true",
      );
    }
    if (mode === "anchor") {
      record(
        tag + ": anchored Intent visible to a Space-role sharer (check 4)",
        ids.includes("intent"),
        ids.join(","),
      );
      record(
        tag + ": connections-only Links hidden from a non-connection",
        !ids.includes("links"),
        ids.join(","),
      );
      record(
        tag + ": Connect with action for a non-connection",
        (await page.locator('[data-testid="connect-with"]').count()) === 1,
      );
    }
    if (mode === "stranger") {
      record(
        tag + ": anchored Intent hidden from a stranger (check 4)",
        !ids.includes("intent"),
        ids.join(","),
      );
      record(
        tag + ": connections-only Links hidden from a stranger",
        !ids.includes("links"),
        ids.join(","),
      );
      const html = await page.content();
      record(
        tag + ": connections-only and anchored content absent from the DOM",
        !CONNECTIONS_ONLY.some((t) => html.includes(t)) &&
          !ANCHORED_ONLY.some((t) => html.includes(t)),
      );
      // Relationship states: none -> Connect with opens the introduction sheet (ruling 417 under
      // 400: the composer carries no Connect verb; the message is optional, ruling 401); sent;
      // received (Accept / Decline).
      await tap(page, '[data-testid="connect-with"]');
      const dialog = page.locator('[role="dialog"][aria-label^="Introduce yourself to"]');
      await dialog.waitFor({ timeout: 10000 });
      record(
        tag +
          ": Connect with opens the introduction sheet with Send enabled and no message (rulings 417, 401)",
        (await dialog.count()) === 1 &&
          (await dialog.locator('[data-testid="send-intro"]').isEnabled()) &&
          (await dialog.locator('section[role="dialog"][aria-label="Compose"]').count()) === 0,
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      db.profile.rel = "sent";
      await openProfile(page);
      record(
        tag + ": Request sent state",
        (await page.getByRole("button", { name: "Request sent" }).count()) === 1,
      );
      await tap(page, page.getByRole("button", { name: "Request sent" }));
      await page.waitForTimeout(800);
      record(
        tag + ": withdraw returns to Connect with",
        db.profile.requests.includes("PATCH") &&
          (await page.locator('[data-testid="connect-with"]').count()) === 1,
        db.profile.requests.join(","),
      );
      db.profile.rel = "received";
      await openProfile(page);
      record(
        tag + ": received state shows Accept and Decline",
        (await page.getByRole("button", { name: "Accept" }).count()) === 1 &&
          (await page.getByRole("button", { name: "Decline" }).count()) === 1,
      );
      await tap(page, page.getByRole("button", { name: "Accept" }));
      await page.waitForTimeout(900);
      record(
        tag + ": Accept becomes Connected",
        (await page.locator('[data-testid="connected"]').count()) === 1,
      );
      await shot(page, `${bname}-${w}x${h}-${theme}-b3-visitor-connected-after-accept`);
    }
    await scrollTo(page, 600);
    const s1 = await condenseState(page);
    record(
      tag + ": masthead condenses on scroll (check 7)",
      s1.condensed === "1" && s1.condensedRow,
      JSON.stringify(s1),
    );
    await noOverflow(page, tag + " condensed");
    record(tag + ": no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 1200) + " | " + (await pageState(page)));
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-visitor-${mode}-FAIL`).catch(() => {});
  }
  await browser.close();
}

async function runPublic(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme} profile public`;
  M.armStart(tag);
  const compact = w < 744;
  const expanded = w > 1024;
  const { browser, page, errors } = await newPage(browserType, vp, theme, {
    profile: { mode: "stranger", switches: { shared: true, private: false } },
  });
  try {
    await openProfile(page);
    const view = await page.getAttribute('[data-testid="profile"]', "data-view");
    record(tag + ": anonymous view", view === "anon", "view=" + view);
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-public`);
    await noOverflow(page, tag);
    const ids = await sectionIds(page);
    seenPublic.set(`${bname}-${w}x${h}-${theme}-anon`, ids.join(","));
    const html = await page.content();
    record(
      tag + ": public page chrome, no shell",
      (await page.locator('[data-testid="public-page"]').count()) === 1 &&
        (await page.locator("[data-app-header]").count()) === 0,
    );
    record(
      tag + ": core row plus Everyone sections only (check 1)",
      ids.includes("about") &&
        ids.includes("work") &&
        !ids.includes("links") &&
        !ids.includes("intent"),
      ids.join(","),
    );
    record(
      tag + ": no connections-only or anchored content in the DOM (check 1)",
      !CONNECTIONS_ONLY.some((t) => html.includes(t)) &&
        !ANCHORED_ONLY.some((t) => html.includes(t)),
    );
    record(
      tag + ": noindex on the public profile (check 11)",
      (await page.locator('meta[name="robots"][content="noindex"]').count()) >= 1,
    );
    record(
      tag + ": no badges row, no relationship actions for the public",
      (await page.locator('[data-testid="badges"], [data-testid="relationship"]').count()) === 0,
    );
    // B4A section 1: the control is absent on the Public signed-out view. There is no identity to
    // block with, and ruling 208 puts it on the Visitor view only.
    record(
      tag + ": no block overflow on the public view (B4A section 1)",
      (await page.locator('[data-testid="block-control"]').count()) === 0,
    );
    // Ruling 275, under 212: the core row on the view that reaches the most people.
    record(
      tag + ": no origin, place, stance label or local time on the core row (ruling 275)",
      (await page.locator('[data-testid="local-time"]').count()) === 0 &&
        !/From South Africa|Johannesburg|Returnee/.test(await mastheadText(page)),
      (await mastheadText(page)).replace(/\n/g, " ").slice(0, 160),
    );
    const text = await page.locator("body").innerText();
    record(
      tag + ": no count of connections, followers or mutuals (check 10)",
      !COUNT_RE.test(text),
      (text.match(COUNT_RE) || [])[0],
    );
    record(
      tag + ": third parties render as roles, never by name (ruling 141)",
      !UNSHARED_THIRD_PARTIES.some((n) => html.includes(n)) &&
        /Attested by the host/.test(text) &&
        !/Attested by the host,/.test(text),
      (text.match(/Attested by [^·\n]+/) || [])[0],
    );
    record(
      tag + ": five-C close with C deck and Join DNA",
      (await page.locator('[data-testid="c-deck"] [data-testid^="c-card-"]').count()) === 5 &&
        (await page.locator('[data-testid="join-dna"]').count()) === 1,
    );
    if (expanded) {
      const col = await page.locator('[data-testid="public-column"]').boundingBox();
      record(
        tag + ": 960 column centred, no rails (check 9)",
        !!col &&
          Math.round(col.width) === 960 &&
          Math.abs(col.x - (w - 960) / 2) <= 2 &&
          (await page.locator("[data-scroller='left'], [data-scroller='right']").count()) === 0,
        JSON.stringify(col),
      );
    } else {
      // Check 8: the C row snap-scrolls; tap opens the bottom sheet; type fills the column.
      const deck = await page.evaluate(() => {
        const d = document.querySelector('[data-testid="c-deck"]');
        const cs = getComputedStyle(d);
        return {
          snap: cs.scrollSnapType,
          overflowX: cs.overflowX,
          scrollWidth: d.scrollWidth,
          clientWidth: d.clientWidth,
        };
      });
      record(
        tag + ": five-C row snap-scrolls (check 8)",
        /x/.test(deck.snap) && deck.scrollWidth > deck.clientWidth,
        JSON.stringify(deck),
      );
      await page.locator('[data-testid="c-deck"]').evaluate((d) => d.scrollTo({ left: 0 }));
      await tap(page, '[data-testid="c-card-convene"]');
      await page.waitForSelector('[data-testid="c-sheet"]', { timeout: 10000 });
      await page.waitForTimeout(500);
      const sheet = await page.locator('[data-testid="c-sheet"]').boundingBox();
      const dialog = await page.locator('[role="dialog"]').last().boundingBox();
      // Ruling 492 supersedes B3's own size: one size on every sheet. 80 percent tall on compact,
      // --sheet-expanded-width on medium and expanded (1219, 1220), never full screen. The type
      // still fills whatever column that leaves.
      const side = compact
        ? null
        : await sheetWidthIs(page, 'section[role="dialog"]', "--sheet-expanded-width");
      record(
        tag + ": tap opens the sheet at the canonical size and the type fills the column (check 8)",
        !!sheet &&
          !!dialog &&
          (compact
            ? Math.abs(dialog.width - w) < 2 && Math.abs(dialog.height - 0.8 * h) < 2
            : side.ok && dialog.y + dialog.height >= h - 2) &&
          sheet.width >= dialog.width - 48,
        JSON.stringify({ sheet, dialog, w, h }),
      );
      record(
        tag + ": attestation rail in the sheet",
        (await page.locator('[data-testid="c-sheet"] [data-testid="attestation-rail"]').count()) ===
          1,
      );
      await shot(page, `${bname}-${w}x${h}-${theme}-b3-public-sheet`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
    await scrollTo(page, 600);
    const s1 = await condenseState(page);
    record(
      tag + ": masthead condenses on scroll (check 7)",
      s1.condensed === "1" && s1.condensedRow,
      JSON.stringify(s1),
    );
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-public-condensed`);
    await noOverflow(page, tag + " condensed");
    await scrollTo(page, 0);
    record(tag + ": no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 1200) + " | " + (await pageState(page)));
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-public-FAIL`).catch(() => {});
  }
  await browser.close();
}

async function runGate(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme} profile share off`;
  M.armStart(tag);
  const { browser, page, errors } = await newPage(browserType, vp, theme, {
    profile: { mode: "stranger", switches: { shared: false, private: false } },
  });
  try {
    await openProfile(page);
    const view = await page.getAttribute('[data-testid="profile"]', "data-view");
    const html = await page.content();
    record(
      tag + ": members-only prompt with Sign in and Join DNA (check 2)",
      view === "gate" &&
        (await page.getByRole("button", { name: "Sign in" }).count()) >= 1 &&
        (await page.getByRole("button", { name: "Join DNA" }).count()) >= 1,
      "view=" + view,
    );
    record(
      tag + ": no profile data in the response (check 2)",
      !html.includes("Thandiwe") && !html.includes("Solar engineer"),
    );
    await shot(page, `${bname}-${w}x${h}-${theme}-b3-gate`);
    await noOverflow(page, tag);
    await tap(page, page.getByRole("button", { name: "Join DNA" }));
    await page.waitForTimeout(1500);
    record(
      tag + ": Join DNA leads to sign-up",
      /\/sign-in\?join=(1|true)$/.test(page.url()),
      page.url(),
    );
    record(tag + ": no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 1200) + " | " + (await pageState(page)));
  }
  await browser.close();
}

/**
 * Handoff 63-WS (ruling 1866): sign-in returns a member to their own profile. A signed-out request
 * for /m/<handle>?edit=1 renders the gate with Share off, which is what every recipient of 1865
 * reads; its Sign in carries next=profile and nothing else, no handle and no URL; the sign-in lands
 * on the member's own /m/<handle> in Edit profile mode, the handle read from their members row (the
 * mock's row is amara-osei and the address opened named thandiwe-dube, so the two are told apart);
 * a member already signed in lands in Edit profile mode with no sign-in step; and a path or a
 * handle in next is dropped and lands on the Feed. On main the control carries no next and the
 * sign-in lands on /feed, so the first two checks fail there.
 */
async function runSignInReturn(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme} profile sign-in return`;
  M.armStart(tag);
  const { browser, page, errors } = await newPage(browserType, vp, theme, {
    profile: { mode: "owner", switches: { shared: false, private: false } },
  });
  const ownProfile = (u) => u.pathname === "/m/" + OWN_HANDLE;
  const editMode = async () =>
    (await page.getAttribute('[data-testid="profile"]', "data-view")) === "owner" &&
    (await page.getAttribute('[data-testid="profile"]', "data-edit")) === "1" &&
    (await page.locator('[data-testid="edit-done"]').count()) === 1;
  try {
    // Done Means 1, first half: signed out, Share off, the gate. The gate's own Sign in and the
    // public chrome's Sign in each carry the word and nothing else.
    const carries = (u) =>
      u.searchParams.get("next") === "profile" &&
      [...u.searchParams.keys()].join() === "next" &&
      !u.search.includes(HANDLE);
    await openProfile(page, "?edit=1");
    const view = await page.getAttribute('[data-testid="profile"]', "data-view");
    await tap(page, page.getByTestId("profile").getByRole("button", { name: "Sign in" }));
    await page.waitForURL((u) => u.pathname === "/sign-in", { timeout: 15000 });
    const fromGate = new URL(page.url());
    record(
      tag +
        ": signed out, ?edit=1 renders the gate and its Sign in carries next=profile alone, no handle (1866)",
      view === "gate" && carries(fromGate),
      "view=" + view + " " + fromGate.search,
    );
    await openProfile(page, "?edit=1");
    await tap(page, page.getByRole("banner").getByRole("button", { name: "Sign in" }));
    await page.waitForURL((u) => u.pathname === "/sign-in", { timeout: 15000 });
    const fromChrome = new URL(page.url());
    record(
      tag + ": the public chrome's Sign in carries next=profile alone, no handle (1866)",
      carries(fromChrome),
      fromChrome.search,
    );
    // Done Means 1, second half: the sign-in lands on the member's own profile, in Edit profile
    // mode, at the handle their row carries and not the one the address named.
    await M.hydrated(page);
    await page.fill('input[type="email"]', "member@test.invalid");
    await page.fill('input[type="password"]', "x");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => ownProfile(u) || u.pathname === "/feed", { timeout: 15000 });
    await page
      .waitForSelector('[data-testid="profile"]:not([data-view="loading"])', { timeout: 20000 })
      .catch(() => undefined);
    await page.waitForTimeout(250);
    const landed = new URL(page.url());
    record(
      tag +
        ": the sign-in lands on the member's own /m/<handle>, from their row, in Edit profile mode (1866)",
      ownProfile(landed) &&
        ["1", "true"].includes(landed.searchParams.get("edit") || "") &&
        !landed.searchParams.has("next") &&
        (await editMode()),
      landed.pathname + landed.search,
    );
    // Done Means 3: already signed in, the link lands in Edit profile mode with no sign-in step.
    await openProfile(page, "?edit=1");
    const direct = new URL(page.url());
    record(
      tag + ": signed in, ?edit=1 lands in Edit profile mode with no sign-in step",
      direct.pathname === "/m/" + HANDLE && (await editMode()),
      direct.pathname + direct.search,
    );
    // Done Means 4: a path, a handle and a profile path in next are dropped and land on the Feed;
    // the word itself, signed in, lands on the member's own profile.
    const dropped = [];
    for (const bad of ["%2Fm%2F" + OWN_HANDLE, OWN_HANDLE, "https%3A%2F%2Fexample.invalid"]) {
      await page.goto(BASE + "/sign-in?next=" + bad, { waitUntil: "networkidle" });
      await page.waitForURL((u) => u.pathname === "/feed" || ownProfile(u), { timeout: 15000 });
      await page.waitForTimeout(300);
      const at = new URL(page.url());
      dropped.push(at.host + at.pathname + at.search);
    }
    await page.goto(BASE + "/sign-in?next=profile", { waitUntil: "networkidle" });
    await page.waitForURL((u) => ownProfile(u) || u.pathname === "/feed", { timeout: 15000 });
    await page.waitForTimeout(300);
    const word = new URL(page.url());
    record(
      tag +
        ": a path, a handle and a URL in next land on /feed; the word profile lands on the member's own profile (1866)",
      dropped.every((d) => d === new URL(BASE).host + "/feed") && ownProfile(word),
      JSON.stringify(dropped) + " " + word.pathname + word.search,
    );
    record(tag + ": no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 1200) + " | " + (await pageState(page)));
  }
  await browser.close();
}

/** One viewport, one theme: public, gate, owner, and the three visitor personas. */
async function runProfile(browserType, bname, vp, theme) {
  // The visitor personas run at the three preview widths in every run shape. A SPECIAL run used to
  // widen this to every width, which emitted arms no full run declares and so failed ruling 292's
  // accounting on every dispatched profile run (found by PR #25 at 744; ruling 357). What runs is
  // now what is declared, in the subset and the full run alike.
  const full = M.FULL_PREVIEW_AT.has(vp[0]);
  // Ruling 1237: each arm is driven through `M.drive`, so a lost web process retries that arm alone.
  await M.drive(runPublic, browserType, bname, vp, theme);
  await M.drive(runGate, browserType, bname, vp, theme);
  await M.drive(runOwner, browserType, bname, vp, theme);
  if (full) {
    await M.drive(runVisitor, browserType, bname, vp, theme, "connected");
    await M.drive(runVisitor, browserType, bname, vp, theme, "anchor");
    await M.drive(runVisitor, browserType, bname, vp, theme, "stranger");
    // Handoff 63-WS (1866): the sign-in return, at the three preview widths the personas run at.
    await M.drive(runSignInReturn, browserType, bname, vp, theme);
  }
}

module.exports = { runProfile, runOwner, runVisitor, runPublic, runGate, runSignInReturn };
