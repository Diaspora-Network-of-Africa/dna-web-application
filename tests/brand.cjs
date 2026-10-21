// H-BS7-RESKIN item 9 (rulings 1884, 1885, 1887, 1889, 1891, 1892, 1902): the 1A brand on the app
// and the admin, read on the deployment.
//
//   brand         on BASE, at 390 light and 1280 dark: /sign-in, /feed, a public profile and a public
//                 event each draw exactly one wordmark, a role="img" named "DNA" that is
//                 wordmark-mono.svg as a mask painted the theme's --ink, as wide as the file's own
//                 ratio makes it at its height; and no surface requests a retired font, a retired
//                 glyph, logo.png or a third-party font host. Then, once per cell, cmeta.ts's C_GLYPH
//                 is item 3's map and public/strand/adinkra holds exactly the bundle's set.
//   admin brand   on ADMIN_BASE, at 390 light and 1280 dark: the admin sign-in and the console, the
//                 same two readings.
//
// The expected --ink and the wordmark's ratio are read from src/styles/strand.css and
// public/strand/wordmark-mono.svg, never written here. Each arm reports unproven without its host
// (228).
// Usage: SPECIAL=brand node tests/matrix.cjs; ADMIN_BASE=... SPECIAL=admin node tests/matrix.cjs
const fs = require("fs");
const path = require("path");
const M = require("./matrix.cjs");
const { launch, makeMockDb, seedPosts, mockSupabase, signIn, hydrated, record } = M;
const { seedAttend, seedGuest } = require("./event.cjs");
const { mockAdmin } = require("./overview.cjs");

const ROOT = path.join(__dirname, "..");
const BASE = (M.BASE || "").replace(/\/$/, "");
const ADMIN_BASE = (process.env.ADMIN_BASE || "").replace(/\/$/, "");
/** tests/event.cjs's public page, seeded by seedGuest. */
const SLUG = "corridor-suppers-accra-3f2a1b";
const HANDLE = "thandiwe-dube";

/** The glyphs 1887 and 1891 retired, named only so their absence can be checked. */
const RETIRED_GLYPHS = [
  "mpatapo",
  "funtunfunefu-denkyemfunefu",
  "adinkrahene",
  "sankofa",
  "mate-masie",
];
const RETIRED = new RegExp(
  [
    "/strand/fonts/(?:bodoni-moda|alegreya-sans|OFL-)",
    "fonts\\.(?:googleapis|gstatic)\\.com",
    "/strand/adinkra/(?:" + RETIRED_GLYPHS.join("|") + ")\\.svg",
    "/strand/logo\\.png",
  ].join("|"),
  "i",
);

/** Item 3's map (1887, 1889, 1891). */
const GLYPHS = {
  connect: "nkonsonkonson",
  convene: "ti-koro-nko",
  collaborate: "boa-me-na-me-mmoa-wo",
  contribute: "woforo-dua-paa",
  convey: "donno-ntoaso",
  brand: "dna-icon",
  dia: "nyansapo",
};

/** --ink in each theme, from strand.css's first :root block and its dark set. */
function inks() {
  const css = fs.readFileSync(path.join(ROOT, "src/styles/strand.css"), "utf8");
  const block = (start) => {
    const i = css.search(start);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };
  const read = (src) => {
    const m = src.match(/\n\s*--ink:\s*(#[0-9a-fA-F]{6})\s*;/);
    return m ? m[1].toLowerCase() : null;
  };
  return {
    light: read(block(/^:root \{[^}]*\n\s*--bg:/m)),
    dark: read(block(/^\[data-theme="dark"\] \{[^}]*\n\s*--bg:/m)),
  };
}

/** The wordmark's own width over height, from the file's viewBox. */
function ratio() {
  const svg = fs.readFileSync(path.join(ROOT, "public/strand/wordmark-mono.svg"), "utf8");
  const m = svg.match(/viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

const rgb = (hex) =>
  hex
    ? `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    : null;

/** C_GLYPH as cmeta.ts declares it, read from the source. */
function cmetaGlyphs() {
  const src = fs.readFileSync(path.join(ROOT, "src/components/strand/cmeta.ts"), "utf8");
  const body = (src.match(/export const C_GLYPH[^=]*=\s*\{([^}]*)\}/) || [])[1] || "";
  return Object.fromEntries(
    [...body.matchAll(/^\s*([a-z]+):\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]),
  );
}

/** A context in `theme`, with every request it makes recorded. */
async function context(browser, [w, h], theme) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const requests = [];
  ctx.on("request", (r) => requests.push(r.url()));
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ theme }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
    },
    { theme },
  );
  return { ctx, page, requests };
}

/** The wordmark in `scope` once its sizing image has loaded and the fonts have settled. */
async function readMark(page, scope) {
  await page.waitForFunction(
    (scope) => {
      const el = document.querySelector(scope + ' [role="img"][aria-label="DNA"]');
      const img = el && el.querySelector("img");
      return !!img && img.complete && el.getBoundingClientRect().width > 0;
    },
    scope,
    { timeout: 20000 },
  );
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((scope) => {
    const marks = Array.from(document.querySelectorAll(scope + ' [role="img"][aria-label="DNA"]'));
    const el = marks[0];
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const mask = cs.maskImage && cs.maskImage !== "none" ? cs.maskImage : cs.webkitMaskImage || "";
    const img = el.querySelector("img");
    return {
      count: marks.length,
      theme: document.documentElement.getAttribute("data-theme"),
      colour: cs.backgroundColor,
      mask,
      img: img ? img.getAttribute("src") : null,
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
    };
  }, scope);
}

/**
 * The three readings one surface owes: the mark, its width, and what the surface requested. `theme`
 * is the theme the page renders, and `attr` the data-theme it carries for it: the signed-out public
 * profile applies no theme on main (it calls no useTheme), so it renders light with no attribute on
 * a dark device, and its mark is read against the light --ink it is actually drawn on.
 */
function readings(tag, surface, theme, mark, requests, inkOf, want, attr = theme) {
  const ink = inkOf[theme];
  record(
    `${tag} | ${surface}: one wordmark, role img "DNA", wordmark-mono.svg masked in ${theme} --ink ${ink}`,
    mark.count === 1 &&
      mark.theme === attr &&
      mark.colour === rgb(ink) &&
      /\/strand\/wordmark-mono\.svg/.test(mark.mask) &&
      /\/strand\/wordmark-mono\.svg$/.test(mark.img || ""),
    JSON.stringify(mark),
  );
  record(
    `${tag} | ${surface}: the wordmark's width is the file's ratio at its height`,
    !!want && mark.h > 0 && Math.abs(mark.w - mark.h * want) <= 1,
    `${mark.w} x ${mark.h}, file ratio ${want}`,
  );
  const retired = requests.filter((u) => RETIRED.test(u));
  record(
    `${tag} | ${surface}: no request for a retired font, glyph or logo.png`,
    retired.length === 0 && requests.some((u) => /\/strand\/wordmark-mono\.svg/.test(u)),
    retired.length ? retired.join(" ").slice(0, 300) : `${requests.length} requests`,
  );
}

/** The member app's four surfaces in one cell, then the asset set. */
async function runBrand(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-brand`;
  M.armStart(tag);
  if (!BASE) {
    M.unproven(tag, "BASE is not set, so there is no member deployment to read");
    return;
  }
  const ink = inks();
  const want = ratio();
  const browser = await launch(browserType);
  try {
    // /sign-in, signed out.
    {
      const s = await context(browser, [w, h], theme);
      await mockSupabase(s.page, makeMockDb());
      await s.page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
      await hydrated(s.page);
      const mark = await readMark(s.page, ".strand-auth-head");
      readings(tag, "/sign-in", theme, mark, s.requests, ink, want);
      await s.ctx.close();
    }
    // /feed, signed in.
    {
      const s = await context(browser, [w, h], theme);
      const db = makeMockDb();
      seedPosts(db, 3);
      await mockSupabase(s.page, db);
      await signIn(s.page);
      const mark = await readMark(s.page, "[data-app-header]");
      readings(tag, "/feed", theme, mark, s.requests, ink, want);
      await s.ctx.close();
    }
    // A public profile, signed out, as tests/profile.cjs's public arm opens it.
    {
      const s = await context(browser, [w, h], theme);
      const db = makeMockDb();
      seedPosts(db, 2);
      Object.assign(db.profile, { mode: "stranger", switches: { shared: true, private: false } });
      await mockSupabase(s.page, db);
      await s.page.goto(BASE + "/m/" + HANDLE, { waitUntil: "networkidle" });
      await s.page.waitForSelector('[data-testid="public-page"]', { timeout: 20000 });
      const mark = await readMark(s.page, '[data-testid="public-page"]');
      readings(tag, "public profile", "light", mark, s.requests, ink, want, null);
      await s.ctx.close();
    }
    // A public event, signed out, by a client navigation from /sign-in (tests/event.cjs's clientGo):
    // a document request would render on the server, which the mock cannot reach.
    {
      const s = await context(browser, [w, h], theme);
      const db = makeMockDb();
      seedPosts(db, 1);
      seedAttend(db);
      seedGuest(db);
      await mockSupabase(s.page, db);
      await s.page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
      await hydrated(s.page);
      await s.page.evaluate((p) => {
        window.history.pushState({}, "", p);
        window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      }, "/e/" + SLUG);
      await s.page.waitForSelector(`[data-public-event="${SLUG}"]`, { timeout: 15000 });
      const mark = await readMark(s.page, `[data-public-event="${SLUG}"]`);
      readings(tag, "public event", theme, mark, s.requests, ink, want);
      await s.ctx.close();
    }
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    await browser.close().catch(() => undefined);
  }
  const glyphs = cmetaGlyphs();
  record(
    `${tag} | cmeta.ts C_GLYPH is item 3's map, dia among it (1887, 1889, 1891)`,
    JSON.stringify(glyphs) === JSON.stringify(GLYPHS),
    JSON.stringify(glyphs),
  );
  const set = fs.readdirSync(path.join(ROOT, "public/strand/adinkra")).sort();
  const wantSet = [...Object.values(GLYPHS).map((g) => g + ".svg"), "PROVENANCE.md"].sort();
  record(
    `${tag} | public/strand/adinkra holds the seven glyphs and PROVENANCE.md, and no retired file`,
    JSON.stringify(set) === JSON.stringify(wantSet),
    set.join(","),
  );
}

/** The admin app's sign-in and console in one cell. The console follows the device (1377). */
async function runAdminBrand(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-admin brand`;
  M.armStart(tag);
  if (!ADMIN_BASE) {
    M.unproven(tag, "ADMIN_BASE is not set, so there is no admin deployment to read");
    return;
  }
  const ink = inks();
  const want = ratio();
  const browser = await launch(browserType);
  try {
    const s = await context(browser, [w, h], theme);
    await mockAdmin(s.page, { calls: [], dia: [], fail: null });
    await s.page.goto(ADMIN_BASE + "/sign-in", { waitUntil: "networkidle" });
    await hydrated(s.page);
    const signInMark = await readMark(s.page, ".strand-auth-head");
    const signInRequests = s.requests.splice(0);
    readings(tag, "admin /sign-in", theme, signInMark, signInRequests, ink, want);
    await s.page.fill('input[type="email"]', "founder@test.invalid");
    await s.page.fill('input[type="password"]', "x");
    await s.page.click('button[type="submit"]');
    await s.page.waitForSelector('[data-testid="admin-overview"]', { timeout: 20000 });
    const consoleMark = await readMark(s.page, "[data-console-shell]");
    // The console is a client navigation, so its file requests are cached; the sign-in's count.
    readings(
      tag,
      "admin console",
      theme,
      consoleMark,
      [...signInRequests, ...s.requests],
      ink,
      want,
    );
    await s.ctx.close();
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

const BRAND_CELLS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];

module.exports = { runBrand, runAdminBrand, BRAND_CELLS };
