// Handoff 32-A item 5 (rulings 755, 556, 627): the mount arms. Strand compile v1790212533284400
// changes six parts this app binds (Pane, PostCard, FacetRail, LensBar, Select, Input) and adds
// Menu. Every new prop defaults to 92fbdc3's rendering, so each page that binds a changed part gets
// one arm per route: it opens the page, waits for the gate the page's own suite already waits on,
// then reads the part the page binds and asserts it is mounted in its default configuration — no
// new prop's marker, the floors and tracks the part had, and the structure a caller depends on.
// Where a correction is not gated on a prop and 844 ported it anyway, the arm reads the ported
// rendering and says so in the check's name (FacetRail's wrapping chip, Pane's markers, Select's
// focus rendering, which Chat ratified under 1085).
//
// The set is item 5's table as corrected against the tree (555), with Chat's rulings on it:
//   - /convene/events/$id at expanded binds Discovery's Pane, collapsed FacetRail, LensBar and the
//     list's PostCards, and was missing from the table.
//   - ComposerShell is mounted once, in src/routes/_shell.tsx, on every shell route; its Input, its
//     Select (ConveneForm) and its preview PostCard are read from /feed and from /connect.
//   - The header's LensBar renders only where a surface registers one (Feed, and Discovery at
//     compact) and only once the centre column has scrolled; the shell arm reads its absence on the
//     other shell routes, and the Feed and Discovery arms read it where it renders.
//   - /relationship renders neither a Select nor an Input; its arm reads that.
//
// One cell per tier, so each part's tiered form is read once: compact 390 light, medium 820 dark,
// expanded 1280 light. Every arm emits a fixed number of checks for its key, and the page-error
// check is recorded after the flow so a thrown flow still emits it (ruling 228's count).
const M = require("./matrix.cjs");
const { seedAttend, seedGuest } = require("./event.cjs");
const { __seedDiscovery: seedDiscovery } = require("./discovery.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record, eventId, BASE, SB, VOCAB } = M;

const MOUNT_CELLS = [
  [[390, 844], "light"],
  [[820, 1180], "dark"],
  [[1280, 800], "light"],
];

const SB_RE = SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);
/** As tests/discovery.cjs reads them: the sandbox's refusals, never the app's. */
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
const HANDLE = "thandiwe-dube";
/** tests/event.cjs's public page, seeded by seedGuest. */
const SLUG = "corridor-suppers-accra-3f2a1b";
/** matrix.cjs's Convene sample: DIA reads it as an event and fills the form. */
const CONVENE =
  "We are hosting a Diaspora Builders Dinner in Nairobi on Thu 16 Oct at 19:00. Doors at 18:30. Free for members, bring one person who should be in the room.";

/** Every session `context()` opens, in order: `arm()` closes and reads the ones its arm opened even
 *  when the arm's own gate throws before it can hand its session back. */
const opened = [];

async function context(browserType, [w, h], theme, db) {
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
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
  const session = { browser, page, errors };
  opened.push(session);
  return session;
}

const discoveryDb = () => {
  const db = makeMockDb();
  seedDiscovery(db);
  return db;
};

async function openDiscovery(page, path) {
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

async function openConnect(page) {
  await page.goto(BASE + "/connect", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="connect"]', { timeout: 20000 });
  await page.waitForFunction(
    () => !document.querySelector('[role="status"][aria-label^="Loading"]'),
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(250);
}

async function openProfile(page, search = "") {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.goto(BASE + "/m/" + HANDLE + search, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="profile"]:not([data-view="loading"])', {
    timeout: 20000,
  });
  await page.waitForTimeout(250);
}

async function hydrated(page) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), null, {
    timeout: 15000,
  });
}

/** Centre the target in its scroller before a click, clear of the sticky bars (connect.cjs's tap). */
async function tap(page, loc) {
  await loc.waitFor({ state: "visible", timeout: 20000 });
  for (let i = 0; i < 4; i++) {
    const clear = await loc.evaluate((el) => {
      const sc = el.closest('[data-scroller="feed"]') || document.scrollingElement;
      const r = el.getBoundingClientRect();
      sc.scrollTop += r.top - Math.min(260, window.innerHeight - 180);
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    });
    await page.waitForTimeout(120);
    if (clear) break;
  }
  await loc.click({ timeout: 15000 });
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

/**
 * H63-CI (run 637): the header's Lens tablist mounts a render after the shell's scroll state flips,
 * which scrollCentre's fixed 400 ms does not wait for. Present, no animation running in it, and its
 * box unchanged across two frames, before a reader counts it.
 */
async function lensSettled(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      if (
        el.getAnimations &&
        el.getAnimations({ subtree: true }).some((a) => a.playState === "running")
      )
        return false;
      const r = el.getBoundingClientRect();
      const box = `${r.x},${r.y},${r.width},${r.height}`;
      const prev = el.__settledBox;
      el.__settledBox = box;
      return prev === box;
    },
    selector,
    { timeout: 10000, polling: "raf" },
  );
}

/** AppShell's own flag that the member scrolled past its threshold, and the scroller's offset. */
async function shellScrolled(page) {
  return page.evaluate(() => {
    const t = document.querySelector("[data-tier]");
    const sc = document.querySelector('[data-scroller="feed"]');
    const flag = t ? t.getAttribute("data-scrolled") : null;
    return {
      scrolled: flag === "1",
      detail: `data-scrolled ${flag}, scrollTop ${sc ? Math.round(sc.scrollTop) : "none"}`,
    };
  });
}

async function scrollCentre(page, y) {
  await page.evaluate((top) => {
    const sc = document.querySelector('[data-scroller="feed"]');
    if (!sc) return;
    sc.scrollTop = top;
    sc.dispatchEvent(new Event("scroll"));
  }, y);
  await page.waitForTimeout(400);
}

// ---- The readers. Each returns { ok, detail } over every node its selector finds, and is not ok
// on an empty set, so an arm cannot pass on a part that did not mount. ----

/**
 * Input at rest (correction 25 §5 absent): not a combobox, no listbox, its line (if any) tied by
 * aria-describedby, the field the part's own child as at 92fbdc3 (Chat's ruling on 25 §5: the
 * compile's wrappers render only for the combobox and the leading glyph), the 44 floor and the 1px
 * edge. The field is the one a label[for] names.
 */
function readInputs(page, scope) {
  return page.evaluate((scope) => {
    const roots = Array.from(document.querySelectorAll(scope));
    const fields = roots.flatMap((r) =>
      Array.from(r.querySelectorAll("input, textarea")).filter(
        (el) =>
          !/^(checkbox|radio|file|hidden|password|submit|button)$/i.test(el.type || "") &&
          el.id &&
          document.querySelector(`label[for="${el.id}"]`),
      ),
    );
    const bad = [];
    for (const el of fields) {
      const cs = getComputedStyle(el);
      const root = el.parentElement;
      const rs = root ? getComputedStyle(root) : null;
      const label = document.querySelector(`label[for="${el.id}"]`);
      const desc = el.getAttribute("aria-describedby");
      // The line is the part's own next child after the field; tied means the field names it, and
      // a field with no line names nothing.
      const kids = root ? Array.from(root.children) : [];
      const line = kids[kids.indexOf(el) + 1] || null;
      const why = [];
      if (el.getAttribute("role") === "combobox" || el.hasAttribute("aria-expanded"))
        why.push("combobox");
      if (el.hasAttribute("aria-controls") || el.hasAttribute("aria-autocomplete"))
        why.push("combobox ARIA");
      if (document.getElementById(el.id + "-list")) why.push("listbox");
      if (!root || rs.display !== "flex" || rs.flexDirection !== "column" || rs.rowGap !== "6px")
        why.push("field is not the part's own child");
      if (label && label.parentElement !== root) why.push("label is not the field's sibling");
      if (line && (!line.id || desc !== line.id)) why.push("line not tied by aria-describedby");
      if (line && !line.textContent.trim()) why.push("empty line");
      if (!line && desc) why.push("describedby with no line");
      if (!["true", "false"].includes(el.getAttribute("aria-invalid") || ""))
        why.push("aria-invalid " + el.getAttribute("aria-invalid"));
      if (el.getBoundingClientRect().height < 44) why.push("under the 44 floor");
      if (cs.borderTopWidth !== "1px") why.push("edge " + cs.borderTopWidth);
      if (!el.matches("textarea") && cs.paddingLeft !== "14px") why.push("pad " + cs.paddingLeft);
      if (why.length) bad.push((el.id || el.name) + ": " + why.join(", "));
    }
    return {
      ok: fields.length > 0 && bad.length === 0,
      detail: `${fields.length} field(s)` + (bad.length ? "; " + bad.join(" | ") : ""),
    };
  }, scope);
}

/** Select at rest (24 §5 absent): not invalid, its line (if any) tied by aria-describedby and a
 *  field with no line describing nothing, the 44 floor, the 1px edge and the chevron's 40 pad. */
function readSelects(page, scope) {
  return page.evaluate((scope) => {
    // The select a label[for] names inside the part's own column: a native select another part
    // draws is not read as this one.
    const els = Array.from(document.querySelectorAll(scope)).filter((el) => {
      const root = el.parentElement && el.parentElement.parentElement;
      const label = el.id && document.querySelector(`label[for="${el.id}"]`);
      return (
        !!root && !!label && label.parentElement === root && getComputedStyle(root).rowGap === "6px"
      );
    });
    const bad = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const why = [];
      if (el.getAttribute("aria-invalid") === "true") why.push("invalid");
      const desc = el.getAttribute("aria-describedby");
      const kids = Array.from(el.parentElement.parentElement.children);
      const line = kids[kids.indexOf(el.parentElement) + 1] || null;
      if (line && (!line.id || desc !== line.id)) why.push("line not tied by aria-describedby");
      if (!line && desc) why.push("describedby with no line");
      if (el.getBoundingClientRect().height < 44) why.push("under the 44 floor");
      if (cs.borderTopWidth !== "1px") why.push("edge " + cs.borderTopWidth);
      if (cs.paddingRight !== "40px") why.push("pad " + cs.paddingRight);
      if (why.length) bad.push((el.id || el.name || "select") + ": " + why.join(", "));
    }
    return {
      ok: els.length > 0 && bad.length === 0,
      detail: `${els.length} select(s)` + (bad.length ? "; " + bad.join(" | ") : ""),
    };
  }, scope);
}

/** PostCard's feed face (25 §1 and 23 §2 absent): no presentation marker, not selected, no
 *  aria-current, no ring, the 1.5px identity frame. The discovery face renders
 *  `data-presentation` and no `data-c`, so every `article[data-c]` in the scope is also read as
 *  `article[data-presentation]`: a card that took the other face is read and fails, not dropped. */
function readCards(page, scope) {
  return page.evaluate((scope) => {
    const other = scope.replace(/article\[data-c\]/g, "article[data-presentation]");
    const els = Array.from(
      new Set([
        ...document.querySelectorAll(scope),
        ...(other === scope ? [] : document.querySelectorAll(other)),
      ]),
    );
    const bad = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const why = [];
      if (el.hasAttribute("data-presentation")) why.push("presentation " + el.dataset.presentation);
      if (el.hasAttribute("data-selected")) why.push("data-selected");
      if (el.hasAttribute("aria-current")) why.push("aria-current");
      if (cs.boxShadow !== "none") why.push("shadow " + cs.boxShadow);
      // The inline 1.5px: a display at DPR 1 computes it to 1px (correction 23's own readout).
      if (!el.style.border.startsWith("1.5px ")) why.push("frame " + el.style.border);
      if (why.length) bad.push(why.join(", "));
    }
    return {
      ok: els.length > 0 && bad.length === 0,
      detail: `${els.length} card(s)` + (bad.length ? "; " + bad.join(" | ") : ""),
    };
  }, scope);
}

/** LensBar with no trailing seat (25 §4 absent): no row and no seat, the tablist the wrapper's own
 *  child (tests/matrix.cjs reads its parent for the probe), every child of the tablist a tab, and
 *  the 52 track. */
function readLens(page, selector, tabs) {
  return page.evaluate(
    ({ selector, tabs }) => {
      const els = Array.from(document.querySelectorAll(selector));
      const bad = [];
      for (const t of els) {
        const why = [];
        const kids = Array.from(t.children);
        if (kids.length !== tabs) why.push(kids.length + " children");
        if (kids.some((k) => k.getAttribute("role") !== "tab")) why.push("a child that is no tab");
        if (t.closest("[data-lensbar-row]")) why.push("a trailing row");
        if (t.parentElement && t.parentElement.querySelector("[data-lensbar-trailing]"))
          why.push("a trailing seat");
        if (Math.round(t.getBoundingClientRect().height) !== 52)
          why.push("track " + t.getBoundingClientRect().height);
        if (why.length) bad.push(why.join(", "));
      }
      return {
        ok: els.length === 1 && bad.length === 0,
        detail: `${els.length} bar(s)` + (bad.length ? "; " + bad.join(" | ") : ""),
      };
    },
    { selector, tabs },
  );
}

/** Handoff 32-B's rail (item 2; 1095, 1110): Format, Price and When as segments, Topics as a
 *  checklist, Home as ladders and Place as a combobox, in that order; every control inside its
 *  bound (the nav in the rail form, the Sheet's scrolling body at compact) and nothing scrolling
 *  sideways. The rail form's heading holds its label, the Clear all slot (G111, empty until a facet
 *  is set) and the one Collapse filters action. */
const RAIL_32B = [
  "format:segment",
  "price:segment",
  "when:segment",
  "family:checklist",
  "home:ladders",
  "place:combobox",
];
function readDiscoveryRail(page, selector, { bound = null, heading: needHeading = false } = {}) {
  return page.evaluate(
    ({ selector, bound, needHeading, want }) => {
      const nav = document.querySelector(selector);
      if (!nav) return { ok: false, detail: "no rail" };
      const box0 = bound ? nav.querySelector(bound) : nav;
      if (!box0) return { ok: false, detail: "no " + bound };
      const why = [];
      const got = Array.from(nav.querySelectorAll("[data-axis-id]")).map(
        (g) => g.dataset.axisId + ":" + g.dataset.display,
      );
      if (got.join(",") !== want.join(",")) why.push("axes " + got.join(","));
      const box = box0.getBoundingClientRect();
      const cs = getComputedStyle(box0);
      const right = box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      const controls = Array.from(
        nav.querySelectorAll('[data-axis-id] button, [data-axis-id] input, [role="radio"]'),
      );
      for (const c of controls)
        if (c.getBoundingClientRect().right > right + 0.5)
          why.push((c.textContent || c.getAttribute("placeholder") || "").trim() + " past the pad");
      if (box0.scrollWidth > box0.clientWidth)
        why.push(`scrolls ${box0.scrollWidth}/${box0.clientWidth}`);
      if (needHeading) {
        const heading = nav.querySelector("[data-heading]");
        const action = heading && heading.querySelector("[data-heading-action]");
        if (!heading || !heading.querySelector("h2")) why.push("no heading");
        if (!action || !action.querySelector('button[aria-label="Collapse filters"]'))
          why.push("no Collapse filters action");
      }
      return {
        ok: why.length === 0,
        detail:
          `${got.length} axes, ${controls.length} controls` +
          (why.length ? "; " + why.join(" | ") : ""),
      };
    },
    { selector, bound, needHeading, want: RAIL_32B },
  );
}

/** PostCard's discovery face as 32-B binds it (item 4; 1076 to 1079, 1083, 1087): every card in
 *  the scope the discovery face, 320 wide in a lane and filling its track of 320 or more in a lens's
 *  grid (1125), media at 16:9, no feed face, and ringed only where `ringed` says (the event open in
 *  the pane), never elsewhere. */
function readDiscoveryCards(page, scope, ringed = null) {
  return page.evaluate(
    ({ scope, ringed }) => {
      const slots = Array.from(document.querySelectorAll(scope));
      const bad = [];
      for (const s of slots) {
        const a = s.querySelector("article");
        const m = a && a.querySelector("[data-media]");
        const why = [];
        if (!a || a.getAttribute("data-presentation") !== "discovery")
          why.push("not the discovery face");
        if (s.querySelector("article[data-c]")) why.push("a feed face");
        // A lane's card is 320; in a lens's grid it is the same card filling its track, which is
        // --lane-card-width at least (1125). More on Convene's cards are lanes' (1148).
        const inGrid = !!s.closest("[data-lens-cards]");
        const wide = inGrid ? s.getBoundingClientRect().width : 320;
        if (inGrid && wide < 320 - 0.6) why.push("track " + wide + " under 320");
        if (a && Math.abs(a.getBoundingClientRect().width - wide) > 0.6)
          why.push("width " + a.getBoundingClientRect().width + " for " + wide);
        if (!m || !m.clientHeight || Math.abs(m.clientWidth / m.clientHeight - 16 / 9) > 0.02)
          why.push("media " + (m ? m.clientWidth + "x" + m.clientHeight : "none"));
        const on = !!a && a.hasAttribute("data-selected");
        const want = ringed !== null && s.getAttribute("data-discovery-item") === ringed;
        if (on !== want) why.push(on ? "ringed" : "not ringed");
        if (why.length) bad.push(s.getAttribute("data-discovery-item") + ": " + why.join(", "));
      }
      return {
        ok: slots.length > 0 && bad.length === 0,
        detail: `${slots.length} card(s)` + (bad.length ? "; " + bad.slice(0, 3).join(" | ") : ""),
      };
    },
    { scope, ringed },
  );
}

// ---- The arms. ----

/** Tag, gate, reads, and the page-error check recorded after the flow, whatever it did. Every
 *  session the arm opened is read and closed here, including one whose gate threw. */
async function arm(tag, open, body) {
  M.armStart(tag);
  const from = opened.length;
  try {
    await body(await open());
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    const mine = opened.splice(from);
    const errors = mine.length
      ? [...new Set(mine.flatMap((x) => x.errors))]
      : ["the page never opened"];
    record(
      tag + " no page errors",
      errors.length === 0,
      errors.slice(0, 3).join(" | ").slice(0, 300),
    );
    for (const x of mine) await x.browser.close().catch(() => {});
  }
}

async function runMountFeed(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-feed`;
  const header = w <= 1024;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 8);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      await s.page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 15000 });
      return s;
    },
    async ({ page }) => {
      const lens = await readLens(page, '[data-feed] [role="tablist"][aria-label="Lens"]', 5);
      record(
        tag + " LensBar in the column: five tabs, no trailing seat, the 52 track",
        lens.ok,
        lens.detail,
      );
      const cards = await readCards(page, "[data-feed] article[data-c]");
      record(
        tag + " PostCard: every card the feed face, unselected, no ring, 1.5px frame",
        cards.ok,
        cards.detail,
      );
      await scrollCentre(page, 400);
      const sel = '[data-app-header] [role="tablist"][aria-label="Lens"]';
      if (header) {
        // Run 637: read before the bar had mounted, 0 bar(s). An absent bar still fails the read
        // when the wait gives up.
        await lensSettled(page, sel).catch(() => undefined);
        const hl = await readLens(page, sel, 5);
        record(
          tag + " header LensBar once scrolled: five tabs, no trailing seat, the 52 track",
          hl.ok,
          hl.detail,
        );
      } else {
        const n = await page.locator(sel).count();
        const st = await shellScrolled(page);
        record(
          tag + " header holds no LensBar at expanded, the shell scrolled",
          n === 0 && st.scrolled,
          `${n} bar(s); ${st.detail}`,
        );
      }
    },
  );
}

async function runMountPost(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-post`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 8);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      await s.page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 15000 });
      return s;
    },
    async ({ page }) => {
      // The in-place form (ruling 105): Read more on the Feed opens /posts/$id in the column.
      const card = page
        .locator("[data-feed] article[data-c]")
        .filter({ has: page.locator("[data-read-more]") })
        .first();
      await tap(page, card.locator("[data-read-more]"));
      await page.waitForURL("**/posts/**", { timeout: 15000 });
      await page.locator("[data-feed] [data-show-less]").first().waitFor({ timeout: 15000 });
      const open = await readCards(page, '[data-feed] article[data-c][data-expanded="1"]');
      record(
        tag + " in place: the open card is the feed face, unselected, no ring",
        open.ok,
        open.detail,
      );
      const lens = await readLens(page, '[data-feed] [role="tablist"][aria-label="Lens"]', 5);
      record(
        tag + " in place: LensBar stays in the column with no trailing seat",
        lens.ok,
        lens.detail,
      );
      // Close it the way the Feed suite does before its own direct load (tests/matrix.cjs): Show less
      // pops the URL back to /feed. A document load issued while /posts/$id is open in place is
      // interrupted on WebKit by a navigation back to that post (run 329, all three cells).
      await tap(page, page.locator("[data-feed] [data-show-less]").first());
      await page.waitForURL((u) => u.pathname === "/feed", { timeout: 15000 });
      await page.locator("[data-feed] [data-read-more]").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      // The direct form: a document load of /posts/$id renders the one card and no lens bar.
      await page.goto(BASE + "/posts/seed-1", { waitUntil: "networkidle" });
      await page.locator('[data-direct-post="seed-1"] article[data-c]').waitFor({ timeout: 15000 });
      const direct = await readCards(page, '[data-direct-post="seed-1"] article[data-c]');
      record(
        tag + " direct: the card is the feed face, unselected, no ring",
        direct.ok,
        direct.detail,
      );
      const bars = await page.locator('[role="tablist"]').count();
      record(tag + " direct: no LensBar", bars === 0, bars + " bar(s)");
    },
  );
}

/** ComposerShell's one mount, read from a route: ConveneForm's Inputs and Select, the link Input
 *  and the preview PostCard (Chat's ruling: /feed and /connect). */
async function runMountComposer(bt, bname, [w, h], theme, route) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-composer-${route}`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 3);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      if (route === "connect") await openConnect(s.page);
      return s;
    },
    async ({ page }) => {
      // The shell's own opener: `c` anywhere outside a field (src/routes/_shell.tsx).
      await page
        .locator("body")
        .click({ position: { x: 1, y: 1 } })
        .catch(() => {});
      await page.keyboard.press("c");
      const dialog = page.locator('section[role="dialog"][aria-label="Compose"]');
      await dialog.waitFor({ timeout: 10000 });
      await sheetSettled(page, 'section[role="dialog"][aria-label="Compose"]');
      record(tag + " gate: the composer opens on /" + route, (await dialog.count()) === 1);
      await dialog.locator('textarea[aria-label="What is going on with you"]').fill(CONVENE);
      await dialog.locator('[data-dia="done"]').waitFor({ timeout: 8000 });
      await dialog.locator('[role="radio"][aria-label^="Host an Event"]').click();
      await dialog
        .locator('[role="radiogroup"][aria-label="Format"] [role="radio"]', {
          hasText: "In person",
        })
        .click();
      await page.waitForTimeout(200);
      const inputs = await readInputs(page, 'section[aria-label="Compose"] [data-convene-form]');
      record(
        tag + " ConveneForm: every Input at rest, no combobox, the part's own structure",
        inputs.ok,
        inputs.detail,
      );
      const selects = await readSelects(
        page,
        'section[aria-label="Compose"] select[data-convene="country"]',
      );
      record(tag + " ConveneForm: the country Select at rest", selects.ok, selects.detail);
      const preview = await readCards(
        page,
        "section[aria-label=\"Compose\"] article[aria-label='Preview of your post']",
      );
      record(
        tag + " preview: the PostCard is the feed face, unselected, no ring",
        preview.ok,
        preview.detail,
      );
      await dialog.getByRole("button", { name: "Add a link" }).click();
      await dialog.locator('input[placeholder="https://"]').waitFor({ timeout: 8000 });
      const link = await readInputs(page, 'section[aria-label="Compose"]');
      const linkOnly = await page.evaluate(() => {
        const el = document.querySelector(
          'section[aria-label="Compose"] input[placeholder="https://"]',
        );
        return (
          !!el &&
          el.getAttribute("role") === null &&
          !el.hasAttribute("aria-expanded") &&
          el.parentElement &&
          getComputedStyle(el.parentElement).rowGap === "6px"
        );
      });
      record(
        tag + " link: the link Input at rest, no combobox, the part's own structure",
        link.ok && linkOnly,
        link.detail,
      );
    },
  );
}

/**
 * Discovery as handoffs 32-B (items 2, 4 and 7) and 33-A (G100, G102, G110, G111) bind it: it passes
 * the props 32-A ported and those correction 28 added, so this arm reads that configuration rather
 * than 92fbdc3's. The LensBar's five lenses with no trailing
 * seat on the 52 track; every card the discovery face; at compact the Sheet's six axes in their
 * displays, its body reaching the last, and the header's bar once scrolled; above compact the
 * collapsed 64 strip at first load, then the opened rail's axes inside the nav with the heading's
 * one action, pinned in its own scroller.
 */
async function runMountConvene(bt, bname, [w, h], theme, path) {
  const lensArm = path !== "/convene";
  const tag = `${bname}-${w}x${h}-${theme}-mount-${lensArm ? "lens" : "convene"}`;
  const compact = w < 640;
  const tabs = VOCAB.convene_lenses.length;
  await arm(
    tag,
    async () => {
      const s = await context(bt, [w, h], theme, discoveryDb());
      await signIn(s.page);
      await openDiscovery(s.page, path);
      if (lensArm)
        await s.page.waitForSelector(
          '[data-discovery][data-lens="curated"] [data-lens-cards] [data-discovery-item]',
          { timeout: 20000 },
        );
      return s;
    },
    async ({ page }) => {
      const where = compact ? "[data-discovery] [data-lens-anchor]" : "[data-layout-top]";
      const lens = await readLens(
        page,
        `${where} [role="tablist"][aria-label="Convene lens"]`,
        tabs,
      );
      record(
        tag + " LensBar: every lens a tab, no trailing seat, the 52 track",
        lens.ok,
        lens.detail,
      );
      if (lensArm) {
        const on = await page
          .locator(`${where} [role="tab"][data-lens="curated"][aria-selected="true"]`)
          .count();
        record(tag + " LensBar: the route's lens is the selected tab", on === 1, on + " selected");
      }
      const cards = await readDiscoveryCards(page, "[data-discovery-item]", null);
      record(
        tag +
          (lensArm
            ? " PostCard: every card the discovery face, in the lens grid filling its track of 320 or more and at 320 in a lane, media 16:9, none ringed (1125, 1148)"
            : " PostCard: every card the discovery face at 320, media 16:9, none ringed (32-B)"),
        cards.ok,
        cards.detail,
      );
      if (compact) {
        await tap(page, page.locator('[data-testid="filters"]'));
        const dialog = '[role="dialog"][aria-label="Filters"]';
        await page.locator(dialog).waitFor({ timeout: 10000 });
        await page.waitForTimeout(400);
        const rail = await readDiscoveryRail(page, dialog, { bound: "[data-sheet-body]" });
        record(
          tag + " FacetRail in the compact Sheet: the six axes in their displays, inside its body",
          rail.ok,
          rail.detail,
        );
        // The axes run past the sheet at compact, so the part draws the scrolling body this
        // repository's Sheet lacks (G30): its last axis is reachable.
        const reach = await page.evaluate(async (sel) => {
          const d = document.querySelector(sel);
          const body = d && d.querySelector("[data-sheet-body]");
          const groups = d ? d.querySelectorAll("[data-axis-id]") : [];
          const last = groups[groups.length - 1];
          if (!body || !last) return { ok: false, detail: "no body or no axis" };
          body.scrollTop = body.scrollHeight;
          await new Promise((r) => setTimeout(r, 200));
          const b = body.getBoundingClientRect();
          const l = last.getBoundingClientRect();
          return {
            ok: l.top >= b.top - 0.5 && l.bottom <= b.bottom + 0.5,
            detail: `last axis ${Math.round(l.top)}-${Math.round(l.bottom)} in ${Math.round(b.top)}-${Math.round(b.bottom)}, ${body.scrollHeight}/${body.clientHeight}`,
          };
        }, dialog);
        record(
          tag + " FacetRail in the compact Sheet: the body scrolls its last axis into reach",
          reach.ok,
          reach.detail,
        );
        await page.keyboard.press("Escape");
        await page.locator(dialog).waitFor({ state: "detached", timeout: 10000 });
        await scrollCentre(page, 400);
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector("[data-discovery] [data-lens-anchor]"))
              .visibility === "hidden",
          null,
          { timeout: 10000 },
        );
        const hl = await readLens(page, '[data-app-header] [role="tablist"]', tabs);
        record(
          tag + " header LensBar once scrolled at compact: no trailing seat, the 52 track",
          hl.ok,
          hl.detail,
        );
      } else {
        const nav = '[data-scroller="left"] nav[aria-label="Filters"]';
        const strip = await page.evaluate((nav) => {
          const n = document.querySelector(nav);
          if (!n) return { ok: false, detail: "no strip" };
          const wd = Math.round(n.getBoundingClientRect().width);
          const expand = !!n.querySelector('button[aria-label="Show filters"]');
          const axes = n.querySelectorAll("[data-axis-id]").length;
          return { ok: wd === 64 && expand && axes === 0, detail: `width ${wd}, ${axes} axes` };
        }, nav);
        record(
          tag + " FacetRail: the collapsed 64 strip at first load (1094)",
          strip.ok,
          strip.detail,
        );
        await tap(page, page.locator(`${nav} button[aria-label="Show filters"]`));
        await page.locator(`${nav} [data-axis-id]`).first().waitFor({ timeout: 10000 });
        await page.waitForTimeout(300);
        const rail = await readDiscoveryRail(page, nav, { heading: true });
        record(
          tag +
            " FacetRail opened: the six axes in their displays inside the nav, Collapse filters on the heading",
          rail.ok,
          rail.detail,
        );
        const pin = await page.evaluate((sel) => {
          const n = document.querySelector(sel);
          const pinEl = n && n.querySelector("[data-heading-pin]");
          if (!n || !pinEl) return { ok: false, detail: "no pin" };
          const st = getComputedStyle(n);
          return {
            ok:
              pinEl.parentElement === n &&
              st.overflowY === "auto" &&
              !pinEl.hasAttribute("data-scrolled"),
            detail: `overflowY ${st.overflowY}, scrolled ${pinEl.hasAttribute("data-scrolled")}`,
          };
        }, nav);
        record(
          tag + " FacetRail: its own scroller with the heading pinned and at rest (25 §3)",
          pin.ok,
          pin.detail,
        );
      }
    },
  );
}

/** /convene/events/$id at expanded: Discovery with the event page in its Pane (1047). A cold arrival
 *  carries no lane, so the pane steps nowhere: its cluster is the one close control (1083), beside
 *  the toolbar correction 28 adds (Hide list, and Copy link and Share with the event's address under
 *  /e/; G110, 1140, G120). */
async function runMountEvent(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-event`;
  const tabs = VOCAB.convene_lenses.length;
  await arm(
    tag,
    async () => {
      const s = await context(bt, [w, h], theme, discoveryDb());
      await signIn(s.page);
      await s.page.goto(BASE + "/convene/events/" + eventId("loaded"), {
        waitUntil: "networkidle",
      });
      await s.page.waitForSelector('[data-discovery][data-pane-open="1"] [data-event-page]', {
        timeout: 20000,
      });
      await s.page.waitForTimeout(400);
      return s;
    },
    async ({ page }) => {
      const pane = await page.evaluate(() => {
        const list = document.querySelector("[data-discovery] [data-pane-list]");
        const grid = list && list.parentElement;
        const section = grid && grid.children[1];
        if (!list || !grid || !section) return { ok: false, detail: "no pane grid" };
        const g = getComputedStyle(grid);
        const s = getComputedStyle(section);
        const tracks = g.gridTemplateColumns.split(" ");
        const cluster = section.querySelector("[data-pane-cluster]");
        const buttons = cluster ? Array.from(cluster.querySelectorAll("button")) : [];
        const why = [];
        if (grid.getAttribute("data-pane-open") !== "true")
          why.push("open " + grid.getAttribute("data-pane-open"));
        if (grid.children[0] !== list) why.push("list is not the first child");
        // Correction 28 (G110, 1127): Discovery passes paneWidth 520, so the pane is the 520 track
        // and the list takes the rest.
        if (tracks[1] !== "520px" || !(parseFloat(tracks[0]) > 0))
          why.push("tracks " + g.gridTemplateColumns);
        if (
          section.tagName !== "SECTION" ||
          section.hasAttribute("inert") ||
          section.hasAttribute("aria-hidden")
        )
          why.push("section closed");
        if (s.opacity !== "1" || s.visibility !== "visible")
          why.push(`fade ${s.opacity} ${s.visibility}`);
        if (buttons.length !== 1 || buttons[0].getAttribute("aria-label") !== "Back to Discovery")
          why.push("cluster " + buttons.map((b) => b.getAttribute("aria-label")).join(","));
        if (section.querySelector("[data-step]")) why.push("a stepping control");
        return {
          ok: why.length === 0,
          detail: g.gridTemplateColumns + (why.length ? "; " + why.join(" | ") : ""),
        };
      });
      record(
        tag +
          " Pane: open, the 520 pane track, one close control and no step pair on a cold arrival",
        pane.ok,
        pane.detail,
      );
      const strip = await page.evaluate(() => {
        const nav = document.querySelector('[data-scroller="left"] nav[aria-label="Filters"]');
        if (!nav) return { ok: false, detail: "no strip" };
        const items = nav.querySelectorAll('[role="listitem"]').length;
        const expand = nav.querySelector('button[aria-label="Back to Discovery and show filters"]');
        const wd = Math.round(nav.getBoundingClientRect().width);
        return { ok: wd === 64 && !!expand && items > 0, detail: `width ${wd}, ${items} squares` };
      });
      record(tag + " FacetRail: the collapsed 64 strip beside the pane", strip.ok, strip.detail);
      const lens = await readLens(
        page,
        '[data-layout-top] [role="tablist"][aria-label="Convene lens"]',
        tabs,
      );
      record(tag + " LensBar above the pane: no trailing seat, the 52 track", lens.ok, lens.detail);
      const cards = await readDiscoveryCards(
        page,
        "[data-pane-list] [data-discovery-item]",
        eventId("loaded"),
      );
      record(
        tag +
          " PostCard in the pane's list: the discovery face, the open event ringed and no other",
        cards.ok,
        cards.detail,
      );
    },
  );
}

/**
 * A post carrying images of the given stored sizes (H60-MEDIA): `sizes` is `[width, height]` per
 * image, null for an image with no stored size; `framing` is the media row the one post_media read
 * embeds through media_id (1709), and `link` a post_links row. A Convene post creates its event.
 */
function seedMediaPost(db, key, sizes, c, { framing = null, link = null } = {}) {
  const id = "media-" + key;
  const convene = c === "convene";
  const oid = convene ? eventId("media-" + key) : null;
  db.posts.unshift({
    id,
    author_kind: "member",
    author_id: "00000000-0000-4000-8000-0000000000f2",
    created_by: "00000000-0000-4000-8000-0000000000f2",
    author_name: "Kwame Mensah",
    author_handle: "kwame-mensah",
    author_avatar_path: null,
    c_category: c,
    body: "Pictures from the evening, " + key + ".",
    anchor_kind: null,
    anchor_id: null,
    created_object_kind: convene ? "event" : null,
    created_object_id: oid,
    audience: "everyone",
    status: "published",
    published_at: new Date(Date.now() - 600e3).toISOString(),
    created_at: new Date(Date.now() - 600e3).toISOString(),
  });
  if (convene) {
    const starts = new Date(Date.now() + 12 * 86400e3);
    starts.setUTCHours(18, 0, 0, 0);
    db.events.push({
      id: oid,
      host_member_id: "00000000-0000-4000-8000-0000000000f2",
      title: "Corridor Suppers, " + key,
      starts_at: starts.toISOString(),
      ends_at: null,
      doors_at: null,
      when_text: "An evening",
      mode: "in_person",
      family: "small_social",
      ticket_kind: "free",
      space_id: null,
      status: "published",
      timezone: "Africa/Accra",
      time_confirmed: true,
      date_confirmed: true,
      expected_window_start: null,
      expected_window_end: null,
      window_basis: null,
      delivery_intent: null,
      cancelled_at: null,
      cancelled_reason: null,
      slug: "media-" + key,
      created_at: new Date().toISOString(),
    });
    db.event_delivery.push({
      id: "d-media-" + key,
      event_id: oid,
      kind: "physical",
      position: 0,
      place_id: "dXJuOm1ieHBvaTpmcm9udC1yb29t",
      place_name: "Front Room",
      place_text: null,
      city: "Accra",
      country: "Ghana",
    });
  }
  pushMedia(db, id, key, sizes, framing);
  if (link)
    db.post_links.push({
      id: "l-media-" + key,
      post_id: id,
      url: link.url,
      title: link.title ?? null,
      description: null,
      image_url: link.image_url ?? null,
      fetched_at: null,
      created_at: new Date().toISOString(),
    });
  return `[data-post-id="${id}"] article`;
}

/** post_media rows for a post, each with the media row its media_id names, as the read embeds it. */
function pushMedia(db, postId, key, sizes, framing = null) {
  sizes.forEach((size, i) =>
    db.post_media.push({
      id: "m-" + key + "-" + i,
      post_id: postId,
      storage_path: "seed/" + key + "-" + i + ".jpg",
      width: size ? size[0] : null,
      height: size ? size[1] : null,
      position: i,
      media_id: framing ? "md-" + key + "-" + i : null,
      media: framing,
    }),
  );
}

/** The frame set's ratios (tokens --media-frame-*, 1643), as the arms read a frame against them. */
const FRAME_SET = { tall: 4 / 5, square: 1, photo: 4 / 3, wide: 1.91 };

/**
 * One MediaBlock frame inside a card: its `data-frame` and `data-frame-set`, its outer box, the
 * resolved `--media-fill` beside its own background, and its first image's fit and position. A
 * single image's frame is the element carrying `data-media`; a gallery's is the same.
 */
async function readFrame(page, sel) {
  await page.waitForFunction(
    (sel) => {
      const f = document.querySelector(sel + " [data-media]");
      const i = f && f.querySelector("img");
      return !!i && i.complete && i.naturalWidth > 0;
    },
    sel,
    { timeout: 15000 },
  );
  return page.evaluate((sel) => {
    const f = document.querySelector(sel + " [data-media]");
    const img = f.querySelector("img");
    const r = f.getBoundingClientRect();
    const probe = document.createElement("div");
    probe.style.background = "var(--media-fill)";
    document.body.appendChild(probe);
    const fill = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const s = getComputedStyle(img);
    return {
      tag: f.tagName,
      media: f.getAttribute("data-media"),
      frame: f.getAttribute("data-frame"),
      set: f.getAttribute("data-frame-set"),
      layout: f.getAttribute("data-gallery-layout"),
      w: r.width,
      h: r.height,
      bg: getComputedStyle(f).backgroundColor,
      fill,
      fit: s.objectFit,
      position: s.objectPosition,
      imgW: img.getBoundingClientRect().width,
    };
  }, sel);
}

/** The frame's own box measures `ratio` to half a pixel, and the frame fills its column. */
function framed(m, ratio) {
  const why = [];
  if (Math.abs(m.h - m.w / ratio) > 0.5) why.push(`frame ${m.w}x${m.h} for ${ratio.toFixed(3)}`);
  if (m.imgW < 1) why.push("no image width");
  return why;
}

const SIZES = {
  "9x16": [1080, 1920],
  "3x4": [1200, 1600],
  "4x3": [1600, 1200],
  "16x9": [1920, 1080],
  "3x1": [3000, 1000],
};
/** What the set picks for each (EXTRACTION-60-IF §1 and §6): the case and the frame. */
const PICKS = {
  "9x16": ["tall", "tall"],
  "3x4": ["near", "tall"],
  "4x3": ["exact", "photo"],
  "16x9": ["near", "wide"],
  "3x1": ["wide", "wide"],
};

/**
 * H60-MEDIA's Feed checks (1643, 1429 to 1433, 1544, 1697, 1707 to 1709). Five single images land
 * in the frames the set picks, read from the rendered `data-frame`; an image with no stored size is
 * `unknown`, contained on --media-fill; a stored focal point moves the image's rendered position;
 * the expanded card draws `whole`; a tap opens the viewer and Escape returns focus to the image; a
 * gallery's viewer steps on ArrowRight and carries no digit and no dot; a link beside an image is
 * one line with no image and a link alone is full; a mailto: link is no anchor (439); and a
 * Convene post's portrait flyer is framed by its image on the Feed while its lane card stays 16:9.
 *
 * It replaces Addendum 3 item E's arm, whose checks asserted what 1643 retires: the Feed's Convene
 * card at 16:9 (1697 and 1708 frame it by its image), a gallery of three or four in a 16/10 frame
 * (1643 item 4 chooses the gallery's frame from its lead), and one or two images in ea35e8e's box
 * with its 420 cap (1429 and 1643 replace the cap with the frame set).
 */
async function runMountMedia(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-media`;
  const cards = {};
  const supper = eventId("discovery-supper");
  await arm(
    tag,
    async () => {
      const db = discoveryDb();
      for (const k of Object.keys(SIZES)) cards[k] = seedMediaPost(db, k, [SIZES[k]], "convey");
      cards.unsized = seedMediaPost(db, "unsized", [null], "convey");
      cards.focal = seedMediaPost(db, "focal", [SIZES["16x9"]], "convey", {
        framing: { focal_point: { x: 0.8, y: 0.14 }, crop: null },
      });
      cards.gallery = seedMediaPost(
        db,
        "gallery",
        [
          [1600, 1200],
          [1200, 1600],
          [1200, 1200],
        ],
        "convey",
      );
      cards.withLink = seedMediaPost(db, "with-link", [SIZES["4x3"]], "convey", {
        link: {
          url: "https://example.org/the-corridor-suppers-and-what-the-evening-taught-us",
          title: "The Corridor Suppers and what the evening taught us about the room",
          image_url: "/favicon.png",
        },
      });
      cards.linkOnly = seedMediaPost(db, "link-only", [], "convey", {
        link: {
          url: "https://example.org/reading",
          title: "A reading list",
          image_url: "/favicon.png",
        },
      });
      cards.mailto = seedMediaPost(db, "mailto", [], "convey", {
        link: { url: "mailto:hello@example.org", title: "Write to us" },
      });
      // Discovery's supper event, its post carrying a portrait flyer (1697, 1708).
      pushMedia(db, "post-d-supper", "supper", [SIZES["3x4"]]);
      cards.convene = '[data-post-id="post-d-supper"] article';
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      await s.page.locator(cards["3x1"]).waitFor({ timeout: 15000 });
      return s;
    },
    async ({ page }) => {
      const bad = [];
      for (const k of Object.keys(SIZES)) {
        const m = await readFrame(page, cards[k]);
        const [frame, set] = PICKS[k];
        const why = framed(m, FRAME_SET[set]);
        if (m.frame !== frame || m.set !== set) why.push(`${m.frame}/${m.set}`);
        if ((frame === "tall" || frame === "wide") !== (m.fit === "contain"))
          why.push("fit " + m.fit);
        if (why.length) bad.push(k + ": " + why.join(", "));
      }
      record(
        tag +
          " a 9:16, a 3:4, a 4:3, a 16:9 and a 3:1 image land in the frames the set picks: tall, tall, photo, wide, wide (1643)",
        bad.length === 0,
        bad.join(" | ") || "all five",
      );

      const un = await readFrame(page, cards.unsized);
      record(
        tag + " a feed image with no stored size renders unknown, contained on --media-fill (1643)",
        un.frame === "unknown" &&
          un.set === "wide" &&
          un.fit === "contain" &&
          un.bg === un.fill &&
          framed(un, FRAME_SET.wide).length === 0,
        JSON.stringify({ frame: un.frame, set: un.set, fit: un.fit, bg: un.bg, fill: un.fill }),
      );

      const plain = await readFrame(page, cards["16x9"]);
      const focal = await readFrame(page, cards.focal);
      record(
        tag +
          " a stored focal_point moves the image's placement: 16:9 centred, then held to the top by a subject at y 0.14 (1643, 1709)",
        plain.position === "50% 50%" && focal.position === "50% 0%" && focal.frame === "near",
        `plain ${plain.position}; focal ${focal.position}`,
      );

      const conveneFeed = await readFrame(page, cards.convene);
      const lane = await (async () => {
        await openDiscovery(page, "/convene");
        const sel = `[data-discovery-item="${supper}"] article [data-media]`;
        await page.locator(sel).first().waitFor({ timeout: 15000 });
        return page.evaluate((sel) => {
          const m = document.querySelector(sel);
          return { w: m.clientWidth, h: m.clientHeight };
        }, sel);
      })();
      record(
        tag +
          " a Convene post's portrait flyer: framed by its image on the Feed (4:5), 16:9 on its Discovery lane card (1697, 1708)",
        conveneFeed.set === "tall" &&
          framed(conveneFeed, FRAME_SET.tall).length === 0 &&
          !!lane.h &&
          Math.abs(lane.w / lane.h - 16 / 9) <= 0.02,
        `feed ${conveneFeed.frame}/${conveneFeed.set} ${Math.round(conveneFeed.w)}x${Math.round(conveneFeed.h)}; lane ${lane.w}x${lane.h}`,
      );
      await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
      await page.locator(cards["4x3"]).waitFor({ timeout: 15000 });

      // The viewer: a tap opens it, Escape closes it and returns focus to the image (1429, 480).
      const open = `${cards["4x3"]} button[data-media="image"]`;
      await tap(page, page.locator(open));
      const shown = await page
        .waitForSelector("dialog.strand-viewer[open]", { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      const whole = shown
        ? await page.evaluate(() => {
            const img = document.querySelector("dialog.strand-viewer[open] img");
            return !!img && getComputedStyle(img).objectFit === "contain";
          })
        : false;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const back = await page.evaluate(
        (sel) => ({
          closed: !document.querySelector("dialog.strand-viewer[open]"),
          focus: !!document.activeElement && document.activeElement.matches(sel),
        }),
        open,
      );
      record(
        tag +
          " tapping a feed image opens the viewer on the image whole; Escape closes it and returns focus to the image (1429, 1431)",
        shown && whole && back.closed && back.focus,
        JSON.stringify({ shown, whole, ...back }),
      );

      // The gallery steps forward on ArrowRight, and nothing in the viewer is a digit or a dot (1452, 1453).
      await tap(page, page.locator(`${cards.gallery} [data-media="gallery"] button`).first());
      await page.waitForSelector("dialog.strand-viewer[open]", { timeout: 8000 }).catch(() => null);
      const src = () =>
        page.evaluate(() => {
          const i = document.querySelector("dialog.strand-viewer[open] img");
          return i ? i.getAttribute("src") : null;
        });
      const first = await src();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(250);
      const second = await src();
      const marks = await page.evaluate(() => {
        const d = document.querySelector("dialog.strand-viewer[open]");
        if (!d) return ["no viewer"];
        const out = [];
        const DOT = /[·•∙●○․]/;
        for (const el of [d, ...d.querySelectorAll("*")]) {
          if (el.tagName === "STYLE") continue;
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join("");
          const named = [
            el.getAttribute("aria-label"),
            el.getAttribute("alt"),
            el.getAttribute("title"),
          ]
            .filter(Boolean)
            .join(" ");
          if (/\d/.test(own + " " + named) || DOT.test(own + " " + named))
            out.push(el.tagName + ": " + (own + " " + named).trim());
        }
        return out;
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      record(
        tag +
          " inside a gallery, ArrowRight steps the viewer forward, and no element in the viewer carries a digit or a dot (1452, 1453)",
        !!first && !!second && first !== second && marks.length === 0,
        JSON.stringify({ stepped: first !== second, marks: marks.slice(0, 3) }),
      );

      const links = await page.evaluate(({ withLink, linkOnly, mailto }) => {
        const read = (sel) => {
          const l = document.querySelector(sel + ' [data-media="link"]');
          if (!l) return null;
          return {
            tag: l.tagName,
            size: l.getAttribute("data-link-size"),
            imgs: l.querySelectorAll("img").length,
            h: l.getBoundingClientRect().height,
            anchors: l.querySelectorAll("a").length + (l.closest("a") ? 1 : 0),
          };
        };
        return { withLink: read(withLink), linkOnly: read(linkOnly), mailto: read(mailto) };
      }, cards);
      const row = links.withLink;
      const full = links.linkOnly;
      record(
        tag +
          " a post with an image and a link renders the link as one line with no image; a post with only a link renders it full (1432, 1544)",
        !!row &&
          row.size === "row" &&
          row.imgs === 0 &&
          row.h <= 46 &&
          !!full &&
          full.size === "full" &&
          full.imgs === 1,
        JSON.stringify({ row, full }),
      );
      const mail = links.mailto;
      record(
        tag + " a mailto: link renders no anchor (439)",
        !!mail && mail.tag !== "A" && mail.anchors === 0,
        JSON.stringify(mail),
      );

      // The expanded card draws the single image whole: its own ratio, uncropped (1643 item 6).
      await page.goto(BASE + "/posts/media-3x4", { waitUntil: "networkidle" });
      const ex = await readFrame(page, '[data-post-id="media-3x4"] article');
      record(
        tag + " the expanded card draws its image whole, at the image's own ratio (1643)",
        ex.frame === "whole" && ex.fit === "contain" && Math.abs(ex.h - ex.w / (3 / 4)) <= 1,
        `${ex.frame} ${ex.fit} ${Math.round(ex.w)}x${Math.round(ex.h)}`,
      );
    },
  );
}

/**
 * The event pages' covers follow the frame set (1548, H60-MEDIA Work 5): a cover with stored
 * portrait dimensions renders in the portrait frame on the member page (the pane at expanded, its
 * own route below) and on the public page below two columns; above 1024 the public page's cover
 * keeps 1185's 21:9 across both columns. It replaces Addendum 3 item D's arm, which asserted the
 * 420px cover of ea35e8e's box that 1429 and 1643 retire. H61-SP (Strand compile
 * sha256-b1a458dac1bd562f, brief 60-SP item 21, 1717): the 21:9 box is a fixed box, so the portrait
 * cover, past one ratio step of 21:9 (1.63:1 to 3.34:1), shows whole on --media-fill inside it
 * (data-frame fixed-whole) where it was cropped to fill (fixed); the box's own shape is unchanged.
 */
async function runMountCovers(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-covers`;
  await arm(
    tag,
    async () => {
      const db = discoveryDb();
      seedGuest(db);
      db.attend.pages[eventId("loaded")].media = [
        { position: 0, storage_path: "seed/loaded.jpg", width: 1200, height: 1600 },
      ];
      db.attend.publicPages[SLUG].media = [{ position: 0, width: 1200, height: 1600 }];
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      return s;
    },
    async ({ page }) => {
      await page.goto(BASE + "/convene/events/" + eventId("loaded"), {
        waitUntil: "networkidle",
      });
      await page.waitForSelector('[data-event-page][data-event-state="loaded"]', {
        timeout: 20000,
      });
      const member = await readFrame(page, "[data-event-page]");
      const mw = framed(member, FRAME_SET.tall);
      record(
        tag +
          " the member event page's cover with stored portrait dimensions renders in the portrait frame (1548, 1643)",
        member.media === "image" && member.set === "tall" && mw.length === 0,
        `${member.frame}/${member.set} ${Math.round(member.w)}x${Math.round(member.h)}` +
          (mw.length ? "; " + mw.join(", ") : ""),
      );
      await page.evaluate((p) => {
        window.history.pushState({}, "", p);
        window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      }, "/e/" + SLUG);
      await page.waitForSelector(`[data-public-event="${SLUG}"]`, { timeout: 15000 });
      const pub = await readFrame(page, `[data-public-event="${SLUG}"]`);
      const two = w > 1024;
      const pw = framed(pub, two ? 21 / 9 : FRAME_SET.tall);
      record(
        tag +
          (two
            ? " the public event page's cover is 21:9 across both columns (1185), the portrait cover whole inside it (item 21, 1717)"
            : " the public event page's cover with stored portrait dimensions renders in the portrait frame (1548)"),
        (two ? pub.frame === "fixed-whole" : pub.set === "tall") && pw.length === 0,
        `${pub.frame}/${pub.set} ${Math.round(pub.w)}x${Math.round(pub.h)}` +
          (pw.length ? "; " + pw.join(", ") : ""),
      );
    },
  );
}

async function runMountConnect(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-connect`;
  const expanded = w > 1024;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 1);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      await openConnect(s.page);
      return s;
    },
    async ({ page }) => {
      const lens = await readLens(page, '[role="tablist"][aria-label="Connect lens"]', 4);
      record(tag + " LensBar: four tabs, no trailing seat, the 52 track", lens.ok, lens.detail);
      if (expanded) {
        const sel = await readSelects(page, 'aside[aria-label="Filters"] select');
        record(tag + " Select: every filter at rest", sel.ok, sel.detail);
      } else {
        await tap(page, page.locator('[data-testid="open-filters"]'));
        const dialog = '[role="dialog"][aria-label="Filters"]';
        await page.locator(dialog).waitFor({ timeout: 10000 });
        await page.waitForTimeout(400);
        const sel = await readSelects(page, dialog + " select");
        record(tag + " Select: every filter in the sheet at rest", sel.ok, sel.detail);
        await page.keyboard.press("Escape");
        await page.locator(dialog).waitFor({ state: "detached", timeout: 10000 });
      }
      await tap(
        page,
        page
          .locator(
            '[role="tablist"][aria-label="Connect lens"] [role="tab"][aria-label^="Suggested:"]',
          )
          .first(),
      );
      const card = page
        .locator('[data-testid="lens-suggested"] [data-testid="member-card"]')
        .first();
      await card.waitFor({ timeout: 15000 });
      await tap(page, card.getByRole("button", { name: /^Connect( with .*)?$/ }));
      const dialog = '[role="dialog"][aria-label^="Introduce yourself to"]';
      await page.locator(dialog).waitFor({ timeout: 10000 });
      const intro = await readInputs(page, dialog);
      record(
        tag + " IntroSheet: the message Input at rest, the part's own structure",
        intro.ok,
        intro.detail,
      );
    },
  );
}

async function runMountProfile(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-profile`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 2);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      await openProfile(s.page);
      return s;
    },
    async (s) => {
      const { page } = s;
      await tap(page, page.locator('[data-testid="edit-profile"]'));
      await page.waitForSelector('[data-testid="profile"][data-edit="1"]', { timeout: 15000 });
      await page.waitForTimeout(300);
      const stance = await readSelects(page, '[data-testid="section-stance"] select');
      record(tag + " StanceBlock: its Selects at rest", stance.ok, stance.detail);
      const selects = await readSelects(
        page,
        '[data-testid="profile"] [data-testid^="section-"] select',
      );
      record(tag + " ProfileSurface: every section Select at rest", selects.ok, selects.detail);
      const inputs = await readInputs(page, '[data-testid="profile"]');
      record(
        tag +
          " ProfileSurface and StanceBlock: every Input at rest, hints tied, the part's own structure",
        inputs.ok,
        inputs.detail,
      );
      // The visitor's IntroSheet, a stranger's view of the same profile.
      const db = makeMockDb();
      seedPosts(db, 2);
      db.profile.mode = "stranger";
      const v = await context(bt, [w, h], theme, db);
      try {
        await signIn(v.page);
        await openProfile(v.page);
        await tap(v.page, v.page.locator('[data-testid="connect-with"]'));
        const dialog = '[role="dialog"][aria-label^="Introduce yourself to"]';
        await v.page.locator(dialog).waitFor({ timeout: 10000 });
        const intro = await readInputs(v.page, dialog);
        record(tag + " visitor IntroSheet: the message Input at rest", intro.ok, intro.detail);
      } finally {
        s.errors.push(...v.errors);
        await v.browser.close().catch(() => {});
      }
    },
  );
}

const freshState = () => ({
  next: "who",
  who: { name: "", username: null, suggestion: null, avatar_path: null, completed: false },
  where: { city: null, country: null, completed: false },
  relationship: {
    stance: "exploring",
    stance_label: "Still exploring",
    declared: false,
    completed: false,
  },
  onboarded_at: null,
});

async function signInTo(page, glob) {
  await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
  // G140: the form is touched only once hydrated, as tests/matrix.cjs's signIn does.
  await M.hydrated(page);
  await page.fill('input[type="email"]', "member@test.invalid");
  await page.fill('input[type="password"]', "x");
  await page.click('button[type="submit"]');
  await page.waitForURL(glob, { timeout: 15000 });
}

async function runMountOnboarding(bt, bname, [w, h], theme, screen) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-${screen}`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 1);
      db.onboarding.state = freshState();
      const s = await context(bt, [w, h], theme, db);
      await signInTo(s.page, "**/welcome");
      await s.page.waitForSelector('[data-testid="onboarding-who"]', { timeout: 15000 });
      if (screen !== "welcome") {
        const st = db.onboarding.state;
        st.who = {
          name: "Amara Osei",
          username: "amara",
          suggestion: null,
          avatar_path: null,
          completed: true,
        };
        st.next = "where";
        if (screen === "relationship") {
          st.where = { city: "Nairobi", country: "Kenya", completed: true };
          st.next = "relationship";
        }
        await s.page.goto(BASE + "/" + screen, { waitUntil: "domcontentloaded" });
        await s.page.waitForSelector(`[data-testid="onboarding-${screen}"]`, { timeout: 15000 });
      }
      await s.page.waitForTimeout(400);
      return s;
    },
    async ({ page }) => {
      if (screen === "welcome") {
        const inputs = await readInputs(page, '[data-testid="onboarding-who"]');
        record(
          tag + " the name and username Inputs at rest, the part's own structure",
          inputs.ok,
          inputs.detail,
        );
      } else if (screen === "where") {
        const inputs = await readInputs(page, '[data-testid="onboarding-where"]');
        record(tag + " the city Input at rest, the part's own structure", inputs.ok, inputs.detail);
        const sel = await readSelects(page, 'select[data-testid="country"]');
        record(tag + " the country Select at rest", sel.ok, sel.detail);
        // 24 §5 as ratified (1085): Select takes Input's focus rendering, --surface and --ink.
        const focus = await page.evaluate(async () => {
          const el = document.querySelector('select[data-testid="country"]');
          // Resolve the four tokens the way the select resolves them, on a probe with a real edge.
          const probe = document.createElement("div");
          probe.style.border = "1px solid";
          document.body.appendChild(probe);
          const tok = (v, prop) => {
            probe.style[prop] = v;
            return getComputedStyle(probe)[prop];
          };
          const want = {
            surface: tok("var(--surface)", "backgroundColor"),
            sunken: tok("var(--bg-sunken)", "backgroundColor"),
            ink: tok("var(--ink)", "borderTopColor"),
            line: tok("var(--line)", "borderTopColor"),
          };
          probe.remove();
          const read = () => {
            const s = getComputedStyle(el);
            return { bg: s.backgroundColor, edge: s.borderTopColor };
          };
          const rest = read();
          el.focus();
          await new Promise((r) => setTimeout(r, 350));
          const on = read();
          el.blur();
          await new Promise((r) => setTimeout(r, 350));
          const off = read();
          const ok =
            rest.bg === want.sunken &&
            on.bg === want.surface &&
            on.edge === want.ink &&
            off.bg === want.sunken &&
            off.edge === want.line;
          return { ok, detail: JSON.stringify({ rest, on, off, want }) };
        });
        record(
          tag + " the Select takes Input's focus rendering and returns at rest (1085)",
          focus.ok,
          focus.detail.slice(0, 300),
        );
      } else {
        const found = await page.evaluate(() => {
          const main = document.querySelector('[data-testid="onboarding-relationship"]');
          return {
            selects: main.querySelectorAll("select").length,
            fields: main.querySelectorAll(
              'textarea, input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])',
            ).length,
          };
        });
        record(
          tag + " renders no Select and no Input (item 5's table said it did; 555)",
          found.selects === 0 && found.fields === 0,
          JSON.stringify(found),
        );
      }
    },
  );
}

async function runMountGuest(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-guest`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 1);
      seedAttend(db);
      seedGuest(db);
      const s = await context(bt, [w, h], theme, db);
      // Signed out, on a page of the deployment, then a client navigation (tests/event.cjs's
      // clientGo): a document request would render on the server, which the mock cannot reach.
      await s.page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
      await s.page.evaluate((p) => {
        window.history.pushState({}, "", p);
        window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      }, "/e/" + SLUG);
      await s.page.waitForSelector(`[data-public-event="${SLUG}"]`, { timeout: 15000 });
      await s.page.locator("[data-guest-rsvp]").waitFor({ timeout: 10000 });
      return s;
    },
    async ({ page }) => {
      await page.click('[data-testid="guest-going"]');
      const dialog = 'section[role="dialog"][aria-label="I am going"]';
      await page.locator(dialog).waitFor({ timeout: 8000 });
      const inputs = await readInputs(page, dialog);
      record(
        tag + " GuestSheet: the email Input at rest, the part's own structure",
        inputs.ok,
        inputs.detail,
      );
    },
  );
}

async function runMountAuth(bt, bname, [w, h], theme, route) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-${route}`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 1);
      const s = await context(bt, [w, h], theme, db);
      await s.page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded" });
      await s.page.waitForSelector(
        route === "reset" ? '[data-testid="reset-request"]' : 'button[type="submit"]',
        { timeout: 15000 },
      );
      await hydrated(s.page);
      return s;
    },
    async ({ page }) => {
      const inputs = await readInputs(page, "body");
      record(tag + " the email Input at rest, the part's own structure", inputs.ok, inputs.detail);
    },
  );
}

/** Item 5's first row, read on the live view: the header's LensBar is AppHeader's only where a
 *  surface registers one, so the shell routes that register none show none once scrolled, and
 *  Connect, which registers since Fix PR 08 (1467), shows its own. */
async function runMountShell(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-shell`;
  const expanded = w > 1024;
  const routes = [
    ["/connect", null],
    ["/m/" + HANDLE, '[data-testid="profile"]:not([data-view="loading"])'],
    ["/password", '[data-testid="password"]'],
    ["/collaborate", '[data-testid="c-stub"]'],
  ];
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 2);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      return s;
    },
    async ({ page }) => {
      for (const [path, gate] of routes) {
        if (gate) {
          await page.goto(BASE + path, { waitUntil: "networkidle" });
          await page.waitForSelector(gate, { timeout: 20000 });
        } else await openConnect(page);
        await scrollCentre(page, 400);
        const n = await page.locator('[data-app-header] [role="tablist"]').count();
        const st = await shellScrolled(page);
        // At expanded the header never takes a lens (AppShell's own guard), so the check says so.
        // Connect registers its bar since Fix PR 08 (1467), so below expanded the header holds it.
        // Handoff 61-S1: /password redirects into the Account drawer over the Feed, and the Feed
        // registers its bar, so below expanded the header holds the Feed's once scrolled.
        const docks = (path === "/connect" || path === "/password") && !expanded;
        record(
          tag +
            (expanded
              ? ` ${path}: the shell scrolled, the header holds no LensBar at expanded`
              : path === "/password" && docks
                ? ` ${path}: the shell scrolled, the header holds the Feed's LensBar under the drawer (61-S1)`
                : docks
                  ? ` ${path}: the shell scrolled, the header holds Connect's LensBar (1467)`
                  : ` ${path}: the shell scrolled, the header holds no LensBar (no surface registers one)`),
          n === (docks ? 1 : 0) && st.scrolled,
          `${n} bar(s); ${st.detail}`,
        );
      }
    },
  );
}

/**
 * Handoff 33-D item 4 (1147; correction 31 item 4): EmptyState fills the column it sits in, at
 * Discovery's empty lens, the Feed's and Connect's. The column is the element that holds the part,
 * which each surface now gives the height (the shell publishes the visible height as
 * --_shell-visible and the surface carries it down). Read on the page as rendered:
 *   - the wallpaper, the part's own box, against the column's content box, all four sides within 1;
 *   - the block's centre against the centre of what is visible of the column: below any sticky
 *     chrome over it, above the fixed dock, inside the scroller;
 *   - the radius 0;
 *   - the column's foot at the visible foot: the dock's top below expanded, the scroller's bottom at
 *     expanded, and in Discovery's lanes the canvas foot, the scroller's bottom padding.
 */
function readEmpty(page) {
  return page.evaluate(() => {
    const es = document.querySelector("[data-empty-state]");
    if (!es) return null;
    const r1 = (v) => Math.round(v * 10) / 10;
    const col = es.parentElement;
    const cs = getComputedStyle(col);
    const cb = col.getBoundingClientRect();
    const content = {
      left: cb.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      top: cb.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
      right: cb.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
      bottom: cb.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom),
    };
    const w = es.getBoundingClientRect();
    let sc = es;
    while (sc && !sc.hasAttribute("data-scroller")) sc = sc.parentElement;
    if (!sc) return null;
    const sb = sc.getBoundingClientRect();
    const lanes = !!document.querySelector("[data-canvas][data-layout]") && sc.tagName === "MAIN";
    let foot = sb.bottom - (lanes ? parseFloat(getComputedStyle(sc).paddingBottom) || 0 : 0);
    const dock = document.querySelector('[data-pulse="dock"]');
    if (dock && getComputedStyle(dock).position === "fixed")
      foot = Math.min(foot, dock.getBoundingClientRect().top);
    let top = Math.max(sb.top, cb.top);
    for (const e of sc.querySelectorAll("*")) {
      if (getComputedStyle(e).position !== "sticky") continue;
      const r = e.getBoundingClientRect();
      if (r.bottom > top && r.top <= top && r.left < cb.right && r.right > cb.left) top = r.bottom;
    }
    const bottom = Math.min(cb.bottom, foot);
    const block = (es.querySelector("[data-empty-block]") || es).getBoundingClientRect();
    return {
      sides: [
        w.left - content.left,
        w.top - content.top,
        content.right - w.right,
        content.bottom - w.bottom,
      ].map(r1),
      centre: r1((block.top + block.bottom) / 2 - (top + bottom) / 2),
      radius: getComputedStyle(es).borderRadius,
      foot: [r1(cb.bottom), r1(foot)],
    };
  });
}

const emptyFills = (m) => ({
  ok:
    !!m &&
    m.sides.every((v) => Math.abs(v) <= 1) &&
    Math.abs(m.centre) <= 1 &&
    m.radius === "0px" &&
    Math.abs(m.foot[0] - m.foot[1]) <= 1,
  detail: JSON.stringify(m),
});

async function runMountEmpty(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-mount-empty`;
  await arm(
    tag,
    async () => {
      // The Feed's Mine lens with nothing posted.
      const db = makeMockDb();
      seedPosts(db, 0);
      const s = await context(bt, [w, h], theme, db);
      await signIn(s.page);
      return s;
    },
    async ({ page }) => {
      await page.goto(BASE + "/feed?lens=mine", { waitUntil: "networkidle" });
      await page
        .locator('[data-testid="feed-empty"] [data-empty-state]')
        .waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      const feed = emptyFills(await readEmpty(page));
      record(
        tag +
          " Feed, an empty lens: EmptyState fills its column, the block centred in the visible area (1147)",
        feed.ok,
        feed.detail,
      );
      // Connect's Members lens with nobody in it.
      const cdb = makeMockDb();
      seedPosts(cdb, 1);
      Object.assign(cdb.connect, { membersEmpty: true, whereEmpty: true, suggestFail: true });
      const c = await context(bt, [w, h], theme, cdb);
      await signIn(c.page);
      await c.page.goto(BASE + "/connect", { waitUntil: "networkidle" });
      await c.page.getByText("Nobody here yet.").waitFor({ timeout: 20000 });
      await c.page.waitForTimeout(400);
      const connect = emptyFills(await readEmpty(c.page));
      record(
        tag +
          " Connect, Members with nobody: EmptyState fills its column, the block centred in the visible area (1147)",
        connect.ok,
        connect.detail,
      );
      // Discovery's Curated lens with nothing in it.
      const ddb = discoveryDb();
      ddb.discovery.sections = { ...ddb.discovery.sections, curated: [] };
      const d = await context(bt, [w, h], theme, ddb);
      await signIn(d.page);
      await openDiscovery(d.page, "/convene/curated");
      await d.page.getByText("Nothing in this lens yet.").waitFor({ timeout: 20000 });
      await d.page.waitForTimeout(400);
      const discovery = emptyFills(await readEmpty(d.page));
      record(
        tag +
          " Discovery, an empty lens: EmptyState fills its column, the block centred in the visible area (1147)",
        discovery.ok,
        discovery.detail,
      );
    },
  );
}

// Ruling 1237: each arm is driven through `M.drive`, so a lost web process retries that arm alone.
async function runMount(bt, bname, vp, theme) {
  await M.drive(runMountFeed, bt, bname, vp, theme);
  await M.drive(runMountPost, bt, bname, vp, theme);
  await M.drive(runMountComposer, bt, bname, vp, theme, "feed");
  await M.drive(runMountComposer, bt, bname, vp, theme, "connect");
  await M.drive(runMountConvene, bt, bname, vp, theme, "/convene");
  await M.drive(runMountConvene, bt, bname, vp, theme, "/convene/curated");
  // At expanded /convene/events/$id is Discovery with the pane (1047); below it is Brief 10's own
  // route, which binds none of the changed parts.
  if (vp[0] > 1024) await M.drive(runMountEvent, bt, bname, vp, theme);
  await M.drive(runMountConnect, bt, bname, vp, theme);
  await M.drive(runMountProfile, bt, bname, vp, theme);
  await M.drive(runMountOnboarding, bt, bname, vp, theme, "welcome");
  await M.drive(runMountOnboarding, bt, bname, vp, theme, "where");
  await M.drive(runMountOnboarding, bt, bname, vp, theme, "relationship");
  await M.drive(runMountGuest, bt, bname, vp, theme);
  await M.drive(runMountAuth, bt, bname, vp, theme, "sign-in");
  await M.drive(runMountAuth, bt, bname, vp, theme, "reset");
  await M.drive(runMountShell, bt, bname, vp, theme);
  // H60-MEDIA (1643, 1429 to 1433, 1544, 1548): the frame set, the viewer, the two link sizes and
  // the covers, replacing Addendum 3 items D and E.
  await M.drive(runMountMedia, bt, bname, vp, theme);
  await M.drive(runMountCovers, bt, bname, vp, theme);
  // Handoff 33-D item 4 (1147): EmptyState fills its column on Discovery, the Feed and Connect.
  await M.drive(runMountEmpty, bt, bname, vp, theme);
}

module.exports = { runMount, MOUNT_CELLS, runMountEmpty, readEmpty, emptyFills };
