// Handoff 45-C item 1 (ruling 1377): the admin app follows the device's appearance, and the member
// app's theme is what it was on main at c859d54.
//
//   admin theme    on ADMIN_BASE, at 390 and 1280 with the device in each scheme and no admin
//                  choice anywhere: the server's markup carries the theme script under the
//                  response's CSP nonce (438); the attribute is on the document before <body> is
//                  parsed (first paint); the Overview's body ground and one card resolve to
//                  strand.css's own --bg and --surface for that scheme (arm 1); a member choice in
//                  `dna.theme` moves nothing; switching the emulated scheme without a reload moves
//                  the attribute, the body ground, the card and the theme-color meta (arm 2).
//   member theme   on BASE, at 390 and 1280 with the device in Dark and no stored choice (arm 3):
//                  the server renders no theme attribute and no theme script, the client sets
//                  data-theme="dark" from the device, --bg resolves to the dark token, nothing is
//                  stored, and a scheme change while the page is open moves nothing, which is
//                  main's behaviour at c859d54 (src/lib/tier.ts `useTheme`, read once on mount).
//
// The expected colours are read from src/styles/strand.css, never written here. Each arm reports
// unproven without its host (228).
// Usage: ADMIN_BASE=https://<id>.dna-admin-1oz.pages.dev SPECIAL=admin node tests/matrix.cjs
const fs = require("fs");
const path = require("path");
const M = require("./matrix.cjs");
const { launch, record, hydrated, makeMockDb, mockSupabase } = M;
const { openOverview } = require("./overview.cjs");

const ADMIN_BASE = (process.env.ADMIN_BASE || "").replace(/\/$/, "");
const BASE = (M.BASE || "").replace(/\/$/, "");

/** --bg and --surface for each theme, from strand.css's first :root block and its dark set. */
function tokens() {
  const css = fs.readFileSync(path.join(__dirname, "..", "src/styles/strand.css"), "utf8");
  const block = (start) => {
    const i = css.search(start);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };
  const read = (src, name) => {
    const m = src.match(new RegExp("\\n\\s*" + name + ":\\s*(#[0-9a-fA-F]{6})\\s*;"));
    return m ? m[1].toLowerCase() : null;
  };
  const light = block(/^:root \{[^}]*\n\s*--bg:/m);
  const dark = block(/^\[data-theme="dark"\] \{[^}]*\n\s*--bg:/m);
  return {
    light: { bg: read(light, "--bg"), surface: read(light, "--surface") },
    dark: { bg: read(dark, "--bg"), surface: read(dark, "--surface") },
  };
}

const rgb = (hex) =>
  hex
    ? `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    : null;

/** What the page resolves: the attribute, the body ground, the first Mobilization card, the meta. */
async function resolved(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const card = document.querySelector(
      '[data-testid="overview-mobilization"] section[aria-label]',
    );
    const meta = document.querySelector('meta[name="theme-color"]');
    return {
      theme: root.getAttribute("data-theme"),
      prepaint: root.hasAttribute("data-prepaint"),
      body: getComputedStyle(document.body).backgroundColor,
      card: card ? getComputedStyle(card).backgroundColor : null,
      // The build's minifier writes a six-digit hex that repeats in pairs as three (#111111 is
      // #111, BS7), and the script copies the resolved --bg as written, so the colour is read in
      // its six-digit form before it is compared with strand.css's.
      meta: meta
        ? (meta.getAttribute("content") || "")
            .toLowerCase()
            .replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, "#$1$1$2$2$3$3")
        : null,
      stored: (() => {
        try {
          return localStorage.getItem("dna.theme");
        } catch {
          return "unreadable";
        }
      })(),
    };
  });
}

/** Arms 1 and 2: the admin Overview in the device's scheme, then the other, without a reload. */
async function runAdminTheme(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-admin theme`;
  M.armStart(tag);
  if (!ADMIN_BASE) {
    M.unproven(tag, "ADMIN_BASE is not set, so there is no admin deployment to read");
    return;
  }
  const other = theme === "dark" ? "light" : "dark";
  const tok = tokens();
  record(
    `${tag} | strand.css declares --bg and --surface in both themes`,
    !!(tok.light.bg && tok.light.surface && tok.dark.bg && tok.dark.surface),
    JSON.stringify(tok),
  );
  const browser = await launch(browserType);
  try {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: w <= 1024,
      isMobile: w < 1024,
      deviceScaleFactor: 1,
      colorScheme: theme,
      timezoneId: "UTC",
    });
    const page = await ctx.newPage();
    // A member choice for the other scheme, in the key the member app reads: the admin app reads
    // no stored choice (1377), so the device must win. And the attribute as <body> arrives, which
    // is before the first paint of anything in it.
    await page.addInitScript(
      ({ other }) => {
        try {
          localStorage.setItem("dna.theme", other);
        } catch {}
        window.__themeAtBody = "unseen";
        new MutationObserver((list, obs) => {
          for (const m of list)
            for (const n of m.addedNodes)
              if (n.nodeName === "BODY") {
                window.__themeAtBody = document.documentElement.getAttribute("data-theme");
                obs.disconnect();
                return;
              }
        }).observe(document, { childList: true, subtree: true });
      },
      { other },
    );

    // The server's markup: one theme script, under this response's nonce (438).
    const res = await page.request.get(ADMIN_BASE + "/sign-in");
    const csp = res.headers()["content-security-policy"] || "";
    const html = await res.text();
    const policyNonce = (csp.match(/'nonce-([^']+)'/) || [])[1] || null;
    const scriptNonce =
      (html.match(/<script[^>]*\snonce="([^"]+)"[^>]*>try\{var r=document\.documentElement/) ||
        [])[1] || null;
    record(
      `${tag} | the server's markup carries the theme script under the response's CSP nonce (438)`,
      !!policyNonce && scriptNonce === policyNonce,
      `policy ${policyNonce}, script ${scriptNonce}`,
    );

    await openOverview(page, { calls: [], dia: [], fail: null, diaEmpty: true });
    await hydrated(page);
    const atBody = await page.evaluate(() => window.__themeAtBody);
    record(
      `${tag} | data-theme is ${theme} before <body> is parsed, so the first paint is ${theme}`,
      atBody === theme,
      String(atBody),
    );
    const a = await resolved(page);
    record(`${tag} | data-theme follows the device: ${theme}`, a.theme === theme, a.theme);
    record(`${tag} | the pre-paint mark is cleared once hydrated`, !a.prepaint);
    record(
      `${tag} | the body ground resolves to ${theme} --bg ${tok[theme].bg} (arm 1)`,
      a.body === rgb(tok[theme].bg),
      a.body,
    );
    record(
      `${tag} | a card resolves to ${theme} --surface ${tok[theme].surface} (arm 1)`,
      a.card === rgb(tok[theme].surface),
      String(a.card),
    );
    record(
      `${tag} | the theme-color meta is ${theme} --bg`,
      a.meta === tok[theme].bg,
      String(a.meta),
    );
    record(`${tag} | the member's stored choice is not read or rewritten`, a.stored === other);

    // Arm 2: the setting changes while the page is open.
    await page.emulateMedia({ colorScheme: other });
    await page
      .waitForFunction((t) => document.documentElement.getAttribute("data-theme") === t, other, {
        timeout: 5000,
      })
      .catch(() => undefined);
    const b = await resolved(page);
    record(
      `${tag} | switching the device to ${other} without a reload moves data-theme (arm 2)`,
      b.theme === other,
      b.theme,
    );
    record(
      `${tag} | and the body ground to ${other} --bg ${tok[other].bg} (arm 2)`,
      b.body === rgb(tok[other].bg),
      b.body,
    );
    record(
      `${tag} | and the card to ${other} --surface ${tok[other].surface}`,
      b.card === rgb(tok[other].surface),
      String(b.card),
    );
    record(
      `${tag} | and the theme-color meta to ${other} --bg`,
      b.meta === tok[other].bg,
      String(b.meta),
    );
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 200));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Arm 3: the member app on a dark device with no stored choice, as main renders it at c859d54. */
async function runMemberTheme(browserType, bname, [w, h]) {
  const tag = `${bname}-${w}x${h}-dark-member theme`;
  M.armStart(tag);
  if (!BASE) {
    M.unproven(tag, "BASE is not set, so there is no member deployment to read");
    return;
  }
  const tok = tokens();
  const browser = await launch(browserType);
  try {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: w <= 1024,
      isMobile: w < 1024,
      deviceScaleFactor: 1,
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await mockSupabase(page, makeMockDb());

    const res = await page.request.get(BASE + "/sign-in");
    const html = await res.text();
    const open = (html.match(/<html[^>]*>/) || [""])[0];
    record(
      `${tag} | the server renders no theme attribute and no theme script, as on main`,
      !!open && !/data-theme|data-prepaint/.test(open) && !/prefers-color-scheme/.test(html),
      open,
    );

    await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
    await hydrated(page);
    const a = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      prepaint: document.documentElement.hasAttribute("data-prepaint"),
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().toLowerCase(),
      stored: localStorage.getItem("dna.theme"),
    }));
    record(
      `${tag} | the client sets data-theme="dark" from the device`,
      a.theme === "dark",
      a.theme,
    );
    record(`${tag} | --bg resolves to the dark token ${tok.dark.bg}`, a.bg === tok.dark.bg, a.bg);
    record(`${tag} | no choice is stored without the switch`, a.stored === null, String(a.stored));
    record(`${tag} | the admin's pre-paint mark never appears`, !a.prepaint);

    // main reads the device once, on mount, and does not follow a change while the page is open.
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForTimeout(500);
    const after = await page.getAttribute("html", "data-theme");
    record(
      `${tag} | a scheme change while open leaves data-theme as main does`,
      after === "dark",
      String(after),
    );
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 200));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

module.exports = { runAdminTheme, runMemberTheme };
