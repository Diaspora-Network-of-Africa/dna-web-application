// Handoff 60-MEDIA-2 (rulings 1714 to 1716). Work 2's Feed edge: at each width the first card's
// right edge against its column, whether its right border is painted, at rest and after a 2,000 px
// scroll. Every reading is printed as one EDGE line, so the before and after tables are read off a
// run's log rather than re-derived.
const M = require("./matrix.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record, BASE } = M;

/** Work 2's widths: either side of 1024's tier line, of 1280 and of 1440's right column. */
const FEED_EDGE_WIDTHS = [1024, 1025, 1100, 1180, 1279, 1280, 1439, 1440];
const FEED_EDGE_HEIGHT = 900;

async function session(browserType, [w, h], db, theme = "light") {
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    // The founder reads this on a Retina Mac and an iPhone: two device pixels per CSS pixel, so a
    // 1.5px border on a half-pixel edge is drawn as it is there.
    deviceScaleFactor: 2,
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
  page.on("pageerror", (e) => errors.push(String(e)));
  return { browser, page, errors };
}

/**
 * The first card in view below the sticky bar (the column's lens anchor at expanded, the header
 * below it), its column and the canvas. `clip` is the right edge of the narrowest box an ancestor
 * clips the card to (overflow other than visible, at its padding box less any scrollbar);
 * `clearance` is the space between the card's right border and its scroller's own edge, which is
 * where an overlay scrollbar draws while the column scrolls; `y` is the row the pixels are read on.
 */
function readEdge(page) {
  return page.evaluate(() => {
    const round = (v) => (v == null ? null : Math.round(v * 100) / 100);
    const scroller = document.querySelector('[data-scroller="feed"]');
    const sr = scroller ? scroller.getBoundingClientRect() : null;
    const bar =
      document.querySelector("[data-lens-anchor]") || document.querySelector("[data-app-header]");
    const barBottom = Math.max(sr ? sr.top : 0, bar ? bar.getBoundingClientRect().bottom : 0);
    const cards = [...document.querySelectorAll("[data-feed] article[data-c]")];
    const card =
      cards.find((c) => {
        const r = c.getBoundingClientRect();
        return sr && Math.min(r.bottom, sr.bottom) - Math.max(r.top, barBottom) >= 60;
      }) || null;
    const canvas = document.querySelector("[data-canvas]");
    let canvasContent = null;
    let canvasOverflow = null;
    if (canvas) {
      const cs = getComputedStyle(canvas);
      canvasContent = canvas.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      canvasOverflow = canvas.scrollWidth - canvas.clientWidth;
    }
    const base = {
      vw: document.documentElement.clientWidth,
      canvasContent: round(canvasContent),
      canvasOverflow,
      column: sr ? round(sr.width) : null,
    };
    if (!card || !scroller) return { ...base, card: null };
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const bw = parseFloat(cs.borderRightWidth) || 0;
    let clip = document.documentElement.clientWidth;
    for (let el = card.parentElement; el; el = el.parentElement) {
      if (getComputedStyle(el).overflowX !== "visible") {
        const er = el.getBoundingClientRect();
        clip = Math.min(clip, er.left + el.clientLeft + el.clientWidth);
      }
    }
    const y = Math.round((Math.max(r.top, barBottom) + Math.min(r.bottom, sr.bottom)) / 2);
    const hit = document.elementFromPoint(r.right - bw / 2, y);
    const hitLeft = document.elementFromPoint(r.left + bw / 2, y);
    const columnRight = sr.left + scroller.clientLeft + scroller.clientWidth;
    // Where the right-border hit misses, how wide the missed band is (scanned leftward a pixel at a
    // time from the border until the card answers) and what is stacked at the border, so a miss can
    // be told apart: the scroller's own scrollbar hit area, or something painted over the card.
    let band = 0;
    if (!(hit && (hit === card || card.contains(hit))))
      for (let dx = 1; dx <= 80; dx++) {
        const h = document.elementFromPoint(r.right - bw / 2 - dx, y);
        band = dx;
        if (h && (h === card || card.contains(h))) break;
      }
    const stack = document
      .elementsFromPoint(r.right - bw / 2, y)
      .slice(0, 4)
      .map((el) => el.tagName.toLowerCase() + (el === card ? "(card)" : ""));
    return {
      ...base,
      columnRight: round(columnRight),
      cardLeft: round(r.left),
      cardRight: round(r.right),
      cardWidth: round(r.width),
      border: bw,
      borderColor: cs.borderRightColor,
      surface: cs.backgroundColor,
      clip: round(clip),
      clearance: round(columnRight - r.right),
      band,
      stack,
      scrollbar: scroller.offsetWidth - scroller.clientWidth - scroller.clientLeft * 2,
      hit: !!hit && (hit === card || card.contains(hit)),
      // What answers the hit test half a pixel inside the right border: the card, or what covers it.
      hitAt: hit
        ? hit.tagName.toLowerCase() +
          (hit.getAttribute("data-scroller")
            ? `[data-scroller=${hit.getAttribute("data-scroller")}]`
            : "")
        : null,
      hitLeft: !!hitLeft && (hitLeft === card || card.contains(hitLeft)),
      within: r.right <= columnRight + 0.5 && r.right <= clip + 0.5,
      y,
      scrollTop: Math.round(scroller.scrollTop),
    };
  });
}

const rgb = (css) => (String(css).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Painted pixels, never geometry alone: a one-row screenshot across each border, and the border
 * counts as painted when a pixel on it is nearer the border's colour than the card's own surface is
 * (antialiasing at a fractional edge leaves a blend, which still reads nearer).
 */
async function paintedEdges(page, e) {
  const { decodePngBuffer } = require("./sheet.cjs");
  const want = rgb(e.borderColor);
  const surface = rgb(e.surface);
  const limit = dist(want, surface) / 2;
  const at = async (x0) => {
    const x = Math.max(0, Math.floor(x0));
    const png = await page.screenshot({ clip: { x, y: e.y, width: 4, height: 1 } });
    const { w, buf } = decodePngBuffer(png);
    let best = Infinity;
    for (let i = 0; i < w; i++)
      best = Math.min(best, dist([buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]], want));
    return { best: Math.round(best), ok: best <= limit };
  };
  const right = await at(e.cardRight - Math.max(2, e.border) - 1);
  const left = await at(e.cardLeft - 1);
  return { right, left, limit: Math.round(limit) };
}

const fmt = (e, px) =>
  e.card === null
    ? `vw ${e.vw}, canvas ${e.canvasContent}, column ${e.column}, no card in view`
    : `vw ${e.vw}, canvas content ${e.canvasContent} (overflow ${e.canvasOverflow}), column ${e.column} ` +
      `right ${e.columnRight}, card ${e.cardLeft} to ${e.cardRight} (width ${e.cardWidth}, border ${e.border}), ` +
      `clip ${e.clip}, clearance ${e.clearance}, hit ${e.hit}/${e.hitLeft} (${e.hitAt}), ` +
      `pixels right ${px ? px.right.best : "-"} left ${px ? px.left.best : "-"} (limit ${px ? px.limit : "-"}), ` +
      `scrollTop ${e.scrollTop}`;

/** One reading: the geometry, then the pixels at the same instant, printed as an EDGE line. */
async function reading(page, bname, w, when) {
  const e = await readEdge(page);
  const px = e.card === null ? null : await paintedEdges(page, e);
  console.log(`EDGE ${bname} ${w} ${when} ${JSON.stringify({ ...e, px })}`);
  // Clearance is the fix's own property (Work 2): a card flush with its scroller's edge has its right
  // border under the scroller's overlay scrollbar while the column scrolls, which the Mac port reads
  // as a hit test that misses the card; neither Linux engine draws that scrollbar over content.
  const ok =
    e.card !== null &&
    e.within &&
    e.clearance > 0 &&
    e.hit &&
    e.hitLeft &&
    !!px &&
    px.right.ok &&
    px.left.ok;
  return { e, px, ok };
}

async function runFeedEdge(bt, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-feed-edge`;
  M.armStart(tag);
  let s = null;
  try {
    const db = makeMockDb();
    seedPosts(db, 24);
    s = await session(bt, [w, h], db);
    await signIn(s.page);
    await s.page.locator("[data-feed] article[data-c]").first().waitFor({ timeout: 15000 });
    await s.page.waitForTimeout(300);
    const rest = await reading(s.page, bname, w, "rest");
    record(
      tag + " at rest: the first card's edges are within its column and its borders painted",
      rest.ok,
      fmt(rest.e, rest.px),
    );
    await s.page.evaluate(() => {
      const sc = document.querySelector('[data-scroller="feed"]');
      if (sc) sc.scrollTop += 2000;
    });
    await s.page.waitForTimeout(400);
    const moved = await reading(s.page, bname, w, "scrolled");
    record(
      tag +
        " after a 2,000 px scroll: the first card in view is within its column and its borders painted",
      moved.ok && moved.e.scrollTop > 0,
      fmt(moved.e, moved.px),
    );
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    const errors = s ? s.errors : ["the page never opened"];
    record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    if (s) await s.browser.close().catch(() => {});
  }
}

// Handoff 60-MEDIA-2 Work 3 (1714): the profile's portrait and cover open Strand's ImageViewer on
// the master, whole, and Escape returns focus to what was tapped. Read as a visitor (the stranger
// view of the seeded profile) and as the owner, whose change controls are their own.
const PROFILE_CELLS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];

/** The viewer open on the image the control draws: the master's own URL, contained whole. */
async function opensWhole(page, control, image) {
  await page.locator(control).first().click();
  const shown = await page
    .waitForSelector("dialog.strand-viewer[open] img", { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  const read = await page.evaluate(
    ({ image }) => {
      const v = document.querySelector("dialog.strand-viewer[open] img");
      const own = document.querySelector(image);
      return {
        viewer: v ? v.getAttribute("src") : null,
        master: own ? own.getAttribute("src") : null,
        fit: v ? getComputedStyle(v).objectFit : null,
      };
    },
    { image },
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const back = await page.evaluate(
    (sel) => ({
      closed: !document.querySelector("dialog.strand-viewer[open]"),
      focus: !!document.activeElement && document.activeElement.matches(sel),
    }),
    control,
  );
  const ok = shown && !!read.master && read.viewer === read.master && read.fit === "contain";
  return {
    ok,
    back: back.closed && back.focus,
    detail: JSON.stringify({ shown, ...read, ...back }),
  };
}

async function runProfileViewer(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-profile-viewer`;
  M.armStart(tag);
  const sessions = [];
  try {
    for (const mode of ["stranger", "owner"]) {
      const db = makeMockDb();
      seedPosts(db, 2);
      if (mode === "stranger") db.profile.mode = "stranger";
      const s = await session(bt, [w, h], db, theme);
      sessions.push(s);
      await signIn(s.page);
      await s.page.goto(BASE + "/m/thandiwe-dube", { waitUntil: "networkidle" });
      await s.page.waitForSelector('[data-testid="profile"]:not([data-view="loading"])', {
        timeout: 20000,
      });
      await s.page.waitForSelector('[data-testid="portrait"] img', { timeout: 15000 });
      const who = mode === "stranger" ? "a visitor" : "the owner";
      const portrait = await opensWhole(
        s.page,
        '[data-testid="portrait"]',
        '[data-testid="portrait"] img',
      );
      record(
        `${tag} ${who}: tapping the portrait opens the viewer on the master, whole (1714)`,
        portrait.ok,
        portrait.detail,
      );
      record(
        `${tag} ${who}: Escape closes the portrait's viewer and returns focus to the portrait`,
        portrait.back,
        portrait.detail,
      );
      const cover = await opensWhole(
        s.page,
        '[data-testid="open-cover"]',
        '[data-testid="open-cover"] img',
      );
      record(
        `${tag} ${who}: tapping the cover opens the viewer on the master, whole (1714)`,
        cover.ok,
        cover.detail,
      );
      record(
        `${tag} ${who}: Escape closes the cover's viewer and returns focus to the cover`,
        cover.back,
        cover.detail,
      );
      if (mode === "owner") {
        const change = await s.page.evaluate(() => {
          const b = document.querySelector('[data-testid="change-photo"]');
          return {
            present: !!b,
            label: b ? b.getAttribute("aria-label") : null,
            tag: b ? b.tagName : null,
          };
        });
        record(
          `${tag} the owner: changing the photo is its own control, the camera badge`,
          change.present && change.tag === "BUTTON" && change.label === "Change your photo",
          JSON.stringify(change),
        );
      }
    }
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    const errors = sessions.length ? sessions.flatMap((x) => x.errors) : ["the page never opened"];
    record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    for (const x of sessions) await x.browser.close().catch(() => {});
  }
}

module.exports = {
  runFeedEdge,
  runProfileViewer,
  FEED_EDGE_WIDTHS,
  FEED_EDGE_HEIGHT,
  PROFILE_CELLS,
  readEdge,
};
