// H64-FEED1 (ruling 1920): Feed speed phase 1 on the deployed preview, with the Supabase surface
// mocked by tests/matrix.cjs so the real client paths run. The founder's iPhone load of 23 Oct spent
// about 4.5 s signing twenty images one after another while the feed read took 54 ms; this arm seeds
// the same twenty and reads what the page asks storage for.
//
// runFeedSigning, at 390 light and 1280 dark (six checks):
//   - with every post-media signing request held at the network, the twenty cards render their text
//     and each image is MediaBlock's loading frame (`data-loading`) with a height already reserved;
//   - the load signs post media in at most one request, a batch naming all twenty paths, and never
//     one path at a time;
//   - once the images arrive no card and no image frame has changed height;
//   - when the first post image finishes loading, every card's text is already on the page;
//   - a page carrying a gallery (which has no loading state) is still signed in one request, and the
//     gallery draws both its images;
//   - no page errors.
//
// Usage: BASE=https://<id>.dna-web-application.pages.dev SPECIAL=feed-signing node tests/matrix.cjs
const M = require("./matrix.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record } = M;

const CELLS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];
/** The founder's load: twenty images on one page. */
const IMAGES = 20;
/** Four stored sizes, so the loading frame is reserved from more than one of the frame set's ratios. */
const SIZES = [
  [1200, 800],
  [800, 1000],
  [1000, 1000],
  [1600, 900],
];
const SIGN_PATH = "/storage/v1/object/sign/post-media";
const CARD = "[data-feed] [data-post-id] article";

/** Every card's text length, and its image frame's state and size, read off the page. */
function measure(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-feed] [data-post-id]")].map((el) => {
      const article = el.querySelector("article");
      const frame = article ? article.querySelector("[data-media]") : null;
      const a = article ? article.getBoundingClientRect() : null;
      const f = frame ? frame.getBoundingClientRect() : null;
      return {
        id: el.getAttribute("data-post-id"),
        text: article ? (article.textContent || "").length : 0,
        kind: frame ? frame.getAttribute("data-media") : null,
        loading: frame ? frame.hasAttribute("data-loading") : null,
        card: a ? Math.round(a.height * 10) / 10 : null,
        frame: f ? Math.round(f.height * 10) / 10 : null,
      };
    }),
  );
}

async function runFeedSigning(browserType, bname, [w, h], theme) {
  const tag = `${bname} ${w}x${h} ${theme} feed-signing`;
  M.armStart(tag);
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ theme, card }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
      // The first post image to finish loading, and how many cards carried their text right then.
      const probe = { cardsAtFirstImage: null };
      window.__feedSigning = probe;
      document.addEventListener(
        "load",
        (e) => {
          const t = e.target;
          if (probe.cardsAtFirstImage !== null || !(t instanceof HTMLImageElement)) return;
          if (!t.closest(card + " [data-media]")) return;
          probe.cardsAtFirstImage = [...document.querySelectorAll(card)].filter(
            (a) => (a.textContent || "").length > 40,
          ).length;
        },
        true,
      );
    },
    { theme, card: CARD },
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));

  const db = makeMockDb();
  seedPosts(db, IMAGES);
  for (let i = 0; i < IMAGES; i++) {
    const [sw, sh] = SIZES[i % SIZES.length];
    db.post_media.push({
      id: "m-sign-" + i,
      post_id: "seed-" + i,
      storage_path: "seed/sign-" + i + ".jpg",
      width: sw,
      height: sh,
      position: 0,
    });
  }
  await mockSupabase(page, db);

  // Every post-media signing request, by phase. While the phase is `held` each one waits at the
  // network until the gate opens, so whatever the page draws meanwhile it drew without a signed URL.
  const signs = [];
  let phase = "held";
  let open;
  const gate = new Promise((r) => (open = r));
  await page.route(
    (url) => url.pathname.startsWith(SIGN_PATH),
    async (route) => {
      const req = route.request();
      if (req.method() !== "POST") return route.fallback();
      const rest = new URL(req.url()).pathname.slice(SIGN_PATH.length);
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {}
      signs.push({
        phase,
        single: rest.length > 1,
        paths: body && Array.isArray(body.paths) ? body.paths : [decodeURIComponent(rest.slice(1))],
      });
      if (phase === "held") await gate;
      return route.fallback();
    },
  );

  try {
    await signIn(page);
    const rendered = await page
      .waitForFunction(
        ({ card, n }) =>
          [...document.querySelectorAll(card)].filter((a) => (a.textContent || "").length > 40)
            .length >= n,
        { card: CARD, n: IMAGES },
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const held = await measure(page);
    record(
      tag +
        " with the page's image signing held, the cards render their text and each image is MediaBlock's loading frame at a reserved height (1920)",
      rendered &&
        held.length === IMAGES &&
        held.every((c) => c.text > 40 && c.kind === "image" && c.loading === true && c.frame > 0),
      JSON.stringify({ rendered, signsHeld: signs.length, cards: held.slice(0, 4) }),
    );

    phase = "open";
    open();
    const loaded = await page
      .waitForFunction(
        ({ card, n }) => {
          const imgs = [...document.querySelectorAll(card + " [data-media='image'] img")];
          return imgs.length >= n && imgs.every((i) => i.complete && i.naturalWidth > 0);
        },
        { card: CARD, n: IMAGES },
        { timeout: 20000 },
      )
      .then(
        () => true,
        () => false,
      );
    const first = signs.filter((s) => s.phase !== "gallery");
    const asked = new Set(first.flatMap((s) => s.paths));
    record(
      tag +
        " one Feed load signs its post images in at most one request, a batch naming every image (1920)",
      loaded &&
        first.length <= 1 &&
        first.every((s) => !s.single) &&
        db.post_media.every((m) => asked.has(m.storage_path)),
      JSON.stringify({
        loaded,
        requests: first.length,
        single: first.filter((s) => s.single).length,
        paths: asked.size,
      }),
    );

    const after = await measure(page);
    const before = new Map(held.map((c) => [c.id, c]));
    const shifted = after.filter((c) => {
      const b = before.get(c.id);
      return !b || Math.abs(b.card - c.card) > 0.5 || Math.abs(b.frame - c.frame) > 0.5;
    });
    record(
      tag + " no card and no image frame changes height when its image arrives (1920)",
      loaded && held.length === IMAGES && after.length === IMAGES && shifted.length === 0,
      JSON.stringify({ held: held.length, after: after.length, shifted: shifted.slice(0, 4) }),
    );

    const probe = await page.evaluate(() => window.__feedSigning);
    record(
      tag + " every card's text is on the page before any post image finishes loading (1920)",
      !!probe && probe.cardsAtFirstImage === IMAGES,
      JSON.stringify(probe),
    );

    // A gallery has no loading state in MediaBlock, so a page carrying one is signed before it
    // renders; it is still one request. seed-2 is the member's own post, so it is on Mine.
    phase = "gallery";
    db.post_media.push({
      id: "m-sign-gallery",
      post_id: "seed-2",
      storage_path: "seed/sign-gallery.jpg",
      width: 1200,
      height: 800,
      position: 1,
    });
    await page.goto(M.BASE + "/feed?lens=mine", { waitUntil: "domcontentloaded" });
    const gallery = page.locator('[data-post-id="seed-2"] article [data-media="gallery"] img');
    const drawn = await page
      .waitForFunction(
        (sel) => {
          const imgs = [...document.querySelectorAll(sel)];
          return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0);
        },
        '[data-post-id="seed-2"] article [data-media="gallery"] img',
        { timeout: 20000 },
      )
      .then(
        () => true,
        () => false,
      );
    const mine = db.post_media.filter((m) => Number(m.post_id.split("-")[1]) % 2 === 0);
    const second = signs.filter((s) => s.phase === "gallery");
    const askedG = new Set(second.flatMap((s) => s.paths));
    record(
      tag + " a page carrying a gallery is signed in one request and the gallery draws both images",
      drawn &&
        (await gallery.count()) === 2 &&
        second.length === 1 &&
        !second[0].single &&
        mine.every((m) => askedG.has(m.storage_path)),
      JSON.stringify({
        drawn,
        requests: second.length,
        single: second.filter((s) => s.single).length,
        paths: askedG.size,
      }),
    );

    record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    open();
    await browser.close();
  }
}

module.exports = { runFeedSigning, CELLS };
