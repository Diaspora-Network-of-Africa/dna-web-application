// Brief 14, handoff 41-C item 5 (SPEC 41-14 "Arms"; rulings 61, 228, 292, 317): the Messenger
// surfaces. Four arms: `runMessengerReactions` is handoff 56-41E's, SPEC-41-E's second pass on the
// mock (the quick bar, the picker, the tone, Start a group, the rename line, the portrait video).
//
// `runMessengerLayout` is the responsive matrix at the three labeled frames plus 360 (390, 820,
// 1280 and 360), both themes, touch below 1024 and pointer above, against the shared mock
// (tests/messenger-mock.cjs, EXTRACTION-41-14 section 6 shaped as the 41-A projections answer it):
// the header's Messages control and its placement (the 360 compact row is a Done Means line,
// because the prototype did not build 360), the list, the requests, the Pane or the route, the
// thread's parts, the doctrine (no count, nothing in browser storage) and no overflow.
//
// `runMessengerFlows` drives every write the surfaces make against the same mock, at the compact
// touch cell and the expanded pointer cell, and reads both the screen and the wrapper the surface
// called: the receipts sheet once, the pin cap's 1371 toast, mark unread, mute, archive, DIA's
// Dismiss, search with a date bound opening at the message, send, react, edit, delete, a lead's
// pin, the blocked line, the media notice once, the rate-limit line, report, accept.
//
// `runMessengerLive` is SPEC 41-14's Playwright arm against the deployment with the two seeded
// accounts for real (ruling 218): owner-test in the browser, member-test as a second context, in the
// "41-B media arm" group 41-B's arm keeps. Every check is named in LIVE_CHECKS and emitted exactly
// once, in order (317); a check the flow never reached is UNPROVEN, and a run without the account
// secrets emits every check UNPROVEN with the one reason (228). What it leaves on the project: the
// messages it sends, each deleted for everyone by the arm itself, and the thread's settings put
// back as it found them.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const M = require("./matrix.cjs");

const { launch, makeMockDb, mockSupabase, record, unproven, hydrated, BASE, OUT, SB } = M;

/**
 * Ruling 357, as tests/event.cjs, tests/profile.cjs and tests/connect.cjs apply it: WebKit words a
 * fetch the navigation cancelled as an access-control denial ("… due to access control checks."),
 * and Playwright delivers it as a page error. Every request to the mocked origin is fulfilled
 * in-process with access-control-allow-origin: *, so a real denial cannot happen there. Only this
 * wording, and only for that origin, is ignored; any other page error still fails the check.
 */
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB.replace(/\./g, "\\.")}\\S*\\s+due to access control checks\\.?$`,
);

const IGNORED_CONSOLE = new RegExp(
  [
    "fonts\\.g",
    "ERR_CONNECTION_RESET",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_FAILED",
    "\\b(?:400|406)\\b",
  ].join("|"),
);

/** The 1371 toast, override 1 of SPEC 41-14. */
const PIN_CAP = "Unpin a conversation to pin this one.";

/** E9, in 1403's order: what the quick bar's eight buttons are named. */
const QUICK_LABELS = [
  "Thumbs up",
  "Heart",
  "Folded hands",
  "Clapping",
  "Party",
  "Laughing",
  "Surprised",
  "Crying",
];

function armCheck(tag, list) {
  const emitted = new Set();
  const check = (label, ok, detail = "") => {
    if (!list.includes(label)) throw new Error("undeclared check: " + label);
    if (emitted.has(label)) return;
    emitted.add(label);
    record(`${tag} | ${label}`, !!ok, detail);
  };
  // One check this engine cannot exercise: unproven with its reason, never a pass (228).
  const skip = (label, why) => {
    if (!list.includes(label)) throw new Error("undeclared check: " + label);
    if (emitted.has(label)) return;
    emitted.add(label);
    unproven(`${tag} | ${label}`, why);
  };
  const rest = (why) => {
    for (const label of list) {
      if (emitted.has(label)) continue;
      emitted.add(label);
      unproven(`${tag} | ${label}`, why);
    }
  };
  return { check, rest, skip };
}

async function newPage(browserType, [w, h], theme, prepare) {
  const browser = await launch(browserType);
  const touch = w <= 1024;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const db = makeMockDb();
  if (prepare) prepare(db);
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
    const text = String(e.message || e);
    if (!IGNORED_CONSOLE.test(text) && !CANCELLED_MOCK_FETCH.test(text)) errors.push(text);
  });
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !IGNORED_CONSOLE.test(m.text()) &&
      !CANCELLED_MOCK_FETCH.test(m.text())
    )
      errors.push(`${m.location().url || "(no url)"} ${m.text()}`.slice(0, 300));
  });
  return { browser, page, db, errors, touch };
}

async function signInMock(page) {
  await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill('input[type="email"]', "member@test.invalid");
  await page.fill('input[type="password"]', "x");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/feed", { timeout: 15000 });
  // As tests/matrix.cjs's signIn: the Feed has rendered, so the sign-in's own navigation is over
  // before the arm starts one (on WebKit a goto issued earlier was interrupted by it, run 485).
  await page.waitForSelector('[data-testid="compose"]', { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

async function openMessages(page) {
  await page.goto(BASE + "/messages", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="thread-list"] [data-thread-row]', { timeout: 15000 });
  await page.waitForTimeout(300);
}

/** Every localStorage and sessionStorage key the page holds that names the Messenger (1351). */
async function messengerStorage(page) {
  return page.evaluate(() => {
    const keys = [];
    for (const s of [localStorage, sessionStorage])
      for (let i = 0; i < s.length; i++) keys.push(s.key(i) || "");
    return keys.filter((k) => /messag|thread|b14|dia\.|draft:m/i.test(k));
  });
}

// ---------------------------------------------------------------------------------------------------
// 1. The responsive matrix.
// ---------------------------------------------------------------------------------------------------

const LAYOUT_CHECKS = [
  "the Messages control sits after the bell and before the avatar on the header's one row (1334; 360 compact placement)",
  "the control is named New messages with the 8px dot while an unmuted, unarchived thread is unread, and carries aria-current on /messages at expanded (82, 1344, 1624)",
  "at expanded the header's side tracks are 200 with the control passed, and below expanded the row has no grid (5.1)",
  "the list reads Messages, Mark all read, the search field and the filters toggle (1.3)",
  "Requests renders the caps line, DIA's line with Dismiss and two cards, each with Accept, Decline and Block, and Declined behind one control (1.4, 1341, 1350)",
  "seven live rows render, the muted row reads Muted, the pinned rows read Pinned, and Archived sits behind one control (1.3, 1339, 1348)",
  "no row, card or line on the list carries a numeral outside a time (69, 82, guardrail 3)",
  "at expanded the Pane beside the list shows its empty state; below it the list keeps the dock, carries no app header, and its title row and search sit on the top inset in one sticky block (1047, 1368, 1624)",
  "opening a row reaches /messages/{thread}: ringed in the Pane at expanded, its own route on Pane's bar with Back to Messages, the subtitle, no dock and no app header below (1023, 1368, 1369, 1624)",
  "the thread reads day separators, a quote, a reaction as glyph name and name, edited, a deleted line, and ticks named Sent or Delivered with receipts off (1336, 1343, 1345, 1577)",
  "the composer sits inside the viewport with Attach, the field and the mic (1.6, 1368)",
  "a group thread reads its members and a reaction's names as names then one and others, the pinned strip and the collapsed blocked line (1317, 1349, 1577, 1371)",
  "nothing the Messenger holds is in localStorage or sessionStorage (1351)",
  "no horizontal overflow on the list or the thread (61)",
  "no page error (316)",
];

async function runMessengerLayout(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme}-messenger`;
  M.armStart(tag);
  const { check, rest } = armCheck(tag, LAYOUT_CHECKS);
  const expanded = w > 1024;
  let browser;
  try {
    const opened = await newPage(browserType, vp, theme);
    browser = opened.browser;
    const { page, db, errors } = opened;
    await signInMock(page);
    // Ruling 1624: below expanded /messages carries no app header, so the header's row is read on
    // the Feed, where the sign-in landed; at expanded it is read on /messages, where it is current.
    if (expanded) await openMessages(page);
    else await page.waitForSelector("[data-app-header]", { timeout: 10000 });

    const head = await page.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect() || null;
      const b = r('[data-testid="bell"]');
      const m = r('[data-testid="messages"]');
      const a = r('[data-testid="avatar"]');
      const row = document.querySelector("[data-app-header] > div");
      return {
        b,
        m,
        a,
        grid: row ? getComputedStyle(row).gridTemplateColumns : "",
        display: row ? getComputedStyle(row).display : "",
        label: document.querySelector('[data-testid="messages"]')?.getAttribute("aria-label"),
        current: document.querySelector('[data-testid="messages"]')?.getAttribute("aria-current"),
        dot: !!document.querySelector('[data-testid="messages-dot"]'),
        dotSize: (() => {
          const d = document.querySelector('[data-testid="messages-dot"]');
          return d ? getComputedStyle(d).width : "";
        })(),
      };
    });
    const sameRow =
      head.b &&
      head.m &&
      head.a &&
      Math.abs(head.b.top - head.m.top) < 4 &&
      Math.abs(head.m.top - head.a.top) < 8;
    check(
      LAYOUT_CHECKS[0],
      sameRow && head.b.right <= head.m.left + 1 && head.m.right <= head.a.left + 1,
      JSON.stringify({ b: head.b, m: head.m, a: head.a }),
    );
    check(
      LAYOUT_CHECKS[1],
      head.label === "New messages" &&
        head.dot &&
        head.dotSize === "8px" &&
        (expanded ? head.current === "page" : head.current !== "page"),
      JSON.stringify(head),
    );
    check(
      LAYOUT_CHECKS[2],
      expanded
        ? head.display === "grid" && /^200px .+ 200px$/.test(head.grid)
        : head.display !== "grid",
      head.display + " " + head.grid,
    );
    if (!expanded) await openMessages(page);

    const list = await page.evaluate(() => {
      const t = (s) => document.querySelector(s)?.textContent?.trim() || "";
      const req = document.querySelector('[data-testid="requests"]');
      const cards = [
        ...document.querySelectorAll(
          '[data-testid="requests"] [data-request-card]:not([data-declined])',
        ),
      ];
      const rows = [...document.querySelectorAll('[data-testid="thread-list"] [data-thread-row]')];
      return {
        h1: t("h1"),
        markAll: !!document.querySelector('[data-testid="mark-all-read"]'),
        search: document
          .querySelector('[data-testid="message-search"]')
          ?.getAttribute("placeholder"),
        filters: document
          .querySelector('[data-testid="search-filters"]')
          ?.getAttribute("aria-label"),
        caps: req ? req.textContent.includes("Requests") : false,
        dia: req
          ? [...req.querySelectorAll('[data-dia="done"] button')].map((b) => b.textContent.trim())
          : [],
        cards: cards.map((c) => [...c.querySelectorAll("button")].map((b) => b.textContent.trim())),
        declined: t('[data-testid="declined-toggle"]'),
        rows: rows.map((r) => r.textContent),
        archived: t('[data-testid="archived-toggle"]'),
        listText: [
          document.querySelector('[data-testid="requests"]'),
          document.querySelector('[data-testid="thread-list"]'),
        ]
          .map((n) => n?.innerText || "")
          .join("\n"),
        pane: document.querySelector("[data-pane-open]")?.textContent || "",
        dock: !!document.querySelector('[data-pulse="dock"]'),
        header: !!document.querySelector("[data-app-header]"),
        chrome: (() => {
          const c = document.querySelector("[data-list-chrome]");
          if (!c) return null;
          const r = c.getBoundingClientRect();
          const h1 = c.querySelector("h1");
          return {
            top: Math.round(r.top),
            sticky: getComputedStyle(c).position,
            h1: !!h1,
            search: !!c.querySelector('[data-testid="message-search"]'),
          };
        })(),
      };
    });
    check(
      LAYOUT_CHECKS[3],
      list.h1 === "Messages" &&
        list.markAll &&
        list.search === "Search messages" &&
        list.filters === "Filters",
      JSON.stringify({
        h1: list.h1,
        markAll: list.markAll,
        search: list.search,
        filters: list.filters,
      }),
    );
    check(
      LAYOUT_CHECKS[4],
      list.caps &&
        list.dia.includes("Dismiss") &&
        list.cards.length === 2 &&
        list.cards.every((b) => b.join(",") === "Accept,Decline,Block") &&
        list.declined === "Declined",
      JSON.stringify({ dia: list.dia, cards: list.cards, declined: list.declined }),
    );
    check(
      LAYOUT_CHECKS[5],
      list.rows.length === 7 &&
        list.rows.filter((r) => r.includes("Muted")).length === 1 &&
        list.rows.filter((r) => r.includes("Pinned")).length === 2 &&
        list.archived === "Archived",
      list.rows.length + " rows; archived " + list.archived,
    );
    // Times are the one numeral a list may carry; the fixture's list renders words for every time.
    check(
      LAYOUT_CHECKS[6],
      !/\d/.test(list.listText),
      list.listText.match(/.{0,30}\d.{0,30}/)?.[0] || "",
    );
    check(
      LAYOUT_CHECKS[7],
      expanded
        ? list.pane.includes("Open a conversation to read it here.") &&
            list.pane.includes("The list stays where it is.") &&
            list.header
        : list.dock &&
            !list.pane &&
            !list.header &&
            !!list.chrome &&
            list.chrome.top === 0 &&
            list.chrome.sticky === "sticky" &&
            list.chrome.h1 &&
            list.chrome.search,
      expanded
        ? list.pane.slice(0, 120) + " header " + list.header
        : JSON.stringify({ dock: list.dock, header: list.header, chrome: list.chrome }),
    );
    const listOverflow = await M.measureWidth(page);

    // Open Kofi's thread.
    await page.locator("[data-thread-row] [data-thread-open]").first().click();
    await page.waitForURL("**/messages/" + db.messenger.ids.kofi, { timeout: 10000 });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 10000 });
    await page.waitForTimeout(400);
    const th = await page.evaluate((exp) => {
      const sel = document.querySelector('[data-thread-row][data-selected="true"]');
      const back = document.querySelector('button[aria-label="Back to Messages"]');
      const sub =
        document.querySelector("[data-pane-subtitle]")?.textContent ||
        document.querySelector("[data-thread-header]")?.textContent ||
        "";
      const comp = document.querySelector("[data-message-composer]")?.getBoundingClientRect();
      return {
        selected: !!sel && getComputedStyle(sel).outlineStyle !== "none",
        back: !!back,
        sub,
        dock: !!document.querySelector('[data-pulse="dock"]'),
        header: !!document.querySelector("[data-app-header]"),
        days: [...document.querySelectorAll("[data-day-separator]")].map((d) =>
          d.getAttribute("aria-label"),
        ),
        quote: !!document.querySelector("[data-quote]"),
        reaction: [...document.querySelectorAll("[data-reaction]")].map((r) =>
          r.getAttribute("aria-label"),
        ),
        edited: !!document.querySelector("[data-edited]"),
        deleted: [...document.querySelectorAll('[data-deleted="1"]')].map((d) => d.textContent),
        ticks: [...document.querySelectorAll("[data-ticks]")].map((t) =>
          t.getAttribute("aria-label"),
        ),
        compBottom: comp ? comp.bottom : -1,
        compH: window.innerHeight,
        attach: !!document.querySelector('[data-testid="attach"]'),
        field: !!document.querySelector('[data-testid="message-field"]'),
        mic: !!document.querySelector('[data-testid="record"]'),
        exp,
      };
    }, expanded);
    check(
      LAYOUT_CHECKS[8],
      expanded
        ? th.selected && th.sub.includes("Cold chain logistics, Tema") && th.header
        : th.back && th.sub.includes("Cold chain logistics, Tema") && !th.dock && !th.header,
      JSON.stringify({
        selected: th.selected,
        back: th.back,
        sub: th.sub.slice(0, 60),
        dock: th.dock,
        header: th.header,
      }),
    );
    check(
      LAYOUT_CHECKS[9],
      th.days.includes("Yesterday") &&
        th.days.includes("Today") &&
        th.quote &&
        th.reaction.includes("Thumbs up, Kofi") &&
        th.edited &&
        th.deleted.some((t) => t.includes("This message was deleted")) &&
        th.ticks.length > 0 &&
        th.ticks.every((t) => t === "Sent" || t === "Delivered"),
      JSON.stringify({ days: th.days, reaction: th.reaction, ticks: th.ticks }),
    );
    check(
      LAYOUT_CHECKS[10],
      th.attach && th.field && th.mic && th.compBottom > 0 && th.compBottom <= th.compH + 1,
      JSON.stringify({ bottom: th.compBottom, h: th.compH }),
    );
    const threadOverflow = await M.measureWidth(page);
    await M.shot(page, `${tag}-thread`);

    // The group.
    await page.goto(BASE + "/messages/" + db.messenger.ids.group, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 10000 });
    const grp = await page.evaluate(() => ({
      sub:
        document.querySelector("[data-pane-subtitle]")?.textContent ||
        document.querySelector("[data-thread-header]")?.textContent ||
        "",
      reactions: [...document.querySelectorAll("[data-reaction]")].map((r) =>
        r.getAttribute("aria-label"),
      ),
      strip: document.querySelector("[data-pinned-strip]")?.textContent || "",
      blocked: document.querySelector("[data-blocked-line] button")?.textContent || "",
    }));
    check(
      LAYOUT_CHECKS[11],
      grp.sub.includes("Ama Darko, Kofi Boateng, Nana Adjei and others") &&
        !grp.sub.includes(", and others") &&
        grp.reactions.includes("Folded hands, Ama, Kofi, Nana and others") &&
        grp.strip.includes("Pinned") &&
        grp.strip.includes("Nana: Who is coming") &&
        grp.blocked === "Blocked message",
      JSON.stringify(grp),
    );
    const keys = await messengerStorage(page);
    check(LAYOUT_CHECKS[12], keys.length === 0, keys.join(","));
    check(
      LAYOUT_CHECKS[13],
      listOverflow.ok && threadOverflow.ok,
      [listOverflow.detail, threadOverflow.detail].filter(Boolean).join("; "),
    );
    check(LAYOUT_CHECKS[14], errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    rest("the flow ended before this check ran");
    if (browser) await browser.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------------------------------
// 2. The flows, against the mock.
// ---------------------------------------------------------------------------------------------------

const FLOW_CHECKS = [
  "the receipts sheet opens once while receipts_chosen_at is null, Off selected, and Continue writes messenger_settings_set(false) (1345)",
  "after the choice the sheet does not open again (1345)",
  "a third pin is taken, and a fourth is refused with pins_full's line under the title row, OK clearing it (1335, 1371, 1582)",
  "Mark as unread writes messenger_mark_unread and the row reads unread (1344)",
  "Mute for 8 hours writes messenger_mute with eight_hours and the row reads Muted (1348)",
  "Archive writes messenger_archive, the row leaves the list and returns under Archived with its note (1339)",
  "DIA's Dismiss writes messenger_dia_dismiss with the signal's key and the line goes (1350, 1373)",
  "a search with a During date bound calls messenger_search with the day's bounds and its result opens the thread at the message, ringed (1338, 1347, 1373)",
  "a send writes messenger_send with a client_id, the bubble lands with one tick named Sent, and the field clears (1336, 1351)",
  "React offers the eight glyphs in 1403's order, and a pick writes messenger_react with the character and reads as the glyph name and you (1403, 1577)",
  "Edit writes messenger_edit and the bubble reads edited (1343)",
  "Delete for everyone writes messenger_delete and the bubble reads This message was deleted (1343)",
  "a lead's Pin writes messenger_pin_message and the pinned strip names it, and Message info reads Read by as names then one and others (1317, 1345, 1371)",
  "the blocked line expands to the member's name, blocked (1349)",
  "the media notice shows once before the first upload and OK writes messenger_settings_set(media_notice_seen) (1346)",
  "a rate-limited send reads the extraction's line, with no number, and disables the field (1353)",
  "Report writes messenger_report with the reason and reads the plain confirmation (1349, 1350)",
  "Accept writes messenger_request_accept, toasts, and opens the new thread (1341)",
  "a group row reads {first name}: before someone else's last message (held item 4)",
  "Recover writes messenger_request_recover, says Back in Requests., opens no thread and the card is back in Requests (1341)",
  "a group lead's Manage draws Rename, which writes messenger_thread_rename and says Renamed., and an event thread's Manage draws no Rename (1387)",
  "nothing the Messenger holds is in localStorage or sessionStorage (1351)",
  "no page error (316)",
];

function writesOf(db, fn) {
  return db.messenger.writes.filter((w) => w.fn === fn);
}

/** Opens a row's or a bubble's menu: the ellipsis on pointer, a 450 ms press on touch. */
async function openMenu(page, container, touch, label) {
  if (touch) {
    const target = (await container.locator("[data-bubble]").count())
      ? container.locator("[data-bubble]").first()
      : container;
    await target.dispatchEvent("pointerdown", { button: 0, pointerType: "touch", isPrimary: true });
    await page.waitForTimeout(560);
    await target.dispatchEvent("pointerup", { button: 0, pointerType: "touch", isPrimary: true });
  } else {
    await container.hover();
    await container.locator(`button[aria-label="${label}"]`).first().click();
  }
  await page.waitForSelector('[role="menu"]', { timeout: 5000 });
}

async function pick(page, label) {
  await page.locator(`[role="menu"] [role="menuitem"]:has-text("${label}")`).first().click();
  await page.waitForTimeout(350);
}

async function toastText(page) {
  return page
    .locator('[role="status"]')
    .allTextContents()
    .then((t) => t.join(" | "))
    .catch(() => "");
}

async function runMessengerFlows(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme}-messenger flows`;
  M.armStart(tag);
  const { check, rest } = armCheck(tag, FLOW_CHECKS);
  let browser;
  try {
    const opened = await newPage(browserType, vp, theme, (db) => {
      db.messenger.firstOpen = true;
    });
    browser = opened.browser;
    const { page, db, errors, touch } = opened;
    const Mx = db.messenger;
    const rowOf = (name) =>
      page.locator(`[data-thread-row]:has([data-thread-name]:text-is("${name}"))`).first();
    await signInMock(page);
    await page.goto(BASE + "/messages", { waitUntil: "networkidle" });

    // 1, 2. Receipts, once.
    const sheet = await page
      .waitForSelector('[data-testid="receipts-sheet"]', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    const off = await page
      .locator('[data-testid="receipts-sheet"] [role="radio"][aria-checked="true"]')
      .textContent()
      .catch(() => "");
    if (sheet) await page.click('[data-testid="receipts-continue"]');
    await page.waitForTimeout(400);
    const set = writesOf(db, "messenger_settings_set").at(-1);
    check(
      FLOW_CHECKS[0],
      sheet && off === "Off" && !!set && set.body.p_receipts === false,
      JSON.stringify({ sheet, off, set: set?.body }),
    );
    await openMessages(page);
    const again = await page.locator('[data-testid="receipts-sheet"]').count();
    check(FLOW_CHECKS[1], again === 0, "sheets " + again);
    // Handoff 41-D (held item 4): Esi wrote the group's last line; emitted as check 19.
    const esiFirst = Mx.members.esi.name.split(/\s+/)[0];
    const groupRow = Mx.threads.find((t) => t.thread_id === Mx.ids.group);
    const groupWant = esiFirst + ": " + groupRow.last_line;
    const groupLine = (await rowOf("Accra returnees").textContent()) ?? "";

    // 3. Pins: two pinned in the fixture; Nana is the third, Corridor Suppers the refused fourth.
    await openMenu(page, rowOf("Nana Adjei"), touch, "Actions for Nana Adjei");
    await pick(page, "Pin");
    const third =
      writesOf(db, "messenger_pin_thread").length === 1 &&
      Mx.threads.filter((t) => t.pinned).length === 3;
    await openMenu(
      page,
      rowOf("Corridor Suppers: Accra"),
      touch,
      "Actions for Corridor Suppers: Accra",
    );
    await pick(page, "Pin");
    await page.waitForSelector("[data-list-alert]", { timeout: 5000 }).catch(() => undefined);
    const alert1 = await page
      .locator("[data-list-alert]")
      .textContent()
      .catch(() => "");
    await page
      .locator('[data-list-alert] button:has-text("OK")')
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(200);
    const alertGone = (await page.locator("[data-list-alert]").count()) === 0;
    check(
      FLOW_CHECKS[2],
      third && alert1.includes(PIN_CAP) && alertGone,
      JSON.stringify({ alert1: alert1.slice(0, 120), alertGone }),
    );

    // 4. Mark as unread on Kofi.
    await openMenu(page, rowOf("Kofi Boateng"), touch, "Actions for Kofi Boateng");
    await pick(page, "Mark as unread");
    await page.waitForTimeout(300);
    const unread = await rowOf("Kofi Boateng").getAttribute("data-unread");
    check(
      FLOW_CHECKS[3],
      writesOf(db, "messenger_mark_unread").length === 1 && unread === "1",
      "data-unread " + unread,
    );

    // 5. Mute Kofi for 8 hours.
    await openMenu(page, rowOf("Kofi Boateng"), touch, "Actions for Kofi Boateng");
    await pick(page, "Mute for 8 hours");
    await page.waitForTimeout(300);
    const mute = writesOf(db, "messenger_mute").at(-1);
    const mutedText = await rowOf("Kofi Boateng").textContent();
    check(
      FLOW_CHECKS[4],
      !!mute && mute.body.p_duration === "eight_hours" && mutedText.includes("Muted"),
      JSON.stringify(mute?.body),
    );

    // 6. Archive Kwame.
    await openMenu(page, rowOf("Kwame Mensah"), touch, "Actions for Kwame Mensah");
    await pick(page, "Archive");
    await page.waitForTimeout(300);
    const live = await page
      .locator('[data-testid="thread-list"] [data-thread-name]:text-is("Kwame Mensah")')
      .count();
    await page.click('[data-testid="archived-toggle"]');
    await page.waitForTimeout(200);
    const archivedRows = await page
      .locator('[aria-label="Archived"] [data-thread-name]')
      .allTextContents();
    const note = await page
      .getByText("An archived conversation comes back to the list when a new message arrives.")
      .count();
    check(
      FLOW_CHECKS[5],
      writesOf(db, "messenger_archive").length === 1 &&
        live === 0 &&
        archivedRows.includes("Kwame Mensah") &&
        note === 1,
      JSON.stringify({ live, archivedRows, note }),
    );

    // 7. DIA's Dismiss on the request line.
    await page
      .locator('[data-testid="requests"] [data-dia="done"] button:has-text("Dismiss")')
      .click();
    await page.waitForTimeout(400);
    const dis = writesOf(db, "messenger_dia_dismiss").at(-1);
    const lineGone =
      (await page.locator('[data-testid="requests"] [data-dia="done"]').count()) === 0;
    check(
      FLOW_CHECKS[6],
      !!dis && dis.body.p_key.startsWith("request:") && lineGone,
      JSON.stringify(dis?.body),
    );

    // 8. Search with a During bound, then open the result.
    await page.fill(
      '[data-testid="message-search"] input, input[placeholder="Search messages"]',
      "port signed",
    );
    await page.click('[data-testid="search-filters"]');
    const today = await page.evaluate(() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    });
    await page.fill('input[data-search-date="during"]', today);
    await page.waitForSelector("[data-search-result]", { timeout: 8000 }).catch(() => undefined);
    const call = writesOf(db, "messenger_search").at(-1);
    const resCount = await page.locator("[data-search-result]").count();
    if (resCount) await page.locator("[data-search-result]").first().click();
    await page.waitForURL("**/messages/" + Mx.ids.kofi, { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const ringed = await page.evaluate(() =>
      [...document.querySelectorAll("[data-msg] [data-bubble]")].some(
        (b) => getComputedStyle(b).outlineStyle === "solid",
      ),
    );
    check(
      FLOW_CHECKS[7],
      !!call && !!call.body.p_after && !!call.body.p_before && resCount === 1 && ringed,
      JSON.stringify({ args: call?.body, resCount, ringed }),
    );

    // 9. Send.
    await page.goto(BASE + "/messages/" + Mx.ids.kofi, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 8000 });
    await page.fill('[data-testid="message-field"]', "Sent from the arm.");
    await page.click('[data-testid="send"]');
    await page.waitForTimeout(600);
    const sent = writesOf(db, "messenger_send").at(-1);
    const landed = page.locator('[data-msg]:has-text("Sent from the arm.")').last();
    const tick = await landed
      .locator("[data-ticks]")
      .getAttribute("aria-label")
      .catch(() => "");
    const cleared = await page.inputValue('[data-testid="message-field"]').catch(() => "x");
    check(
      FLOW_CHECKS[8],
      !!sent && /^[0-9a-f-]{36}$/.test(sent.body.p_client_id) && tick === "Sent" && cleared === "",
      JSON.stringify({ client: sent?.body.p_client_id, tick, cleared }),
    );

    // 10. React to Kofi's first message with Thanks.
    const kofiFirst = page
      .locator('[data-msg]:has-text("The buyer from Tema came through.")')
      .first();
    if (touch) {
      await openMenu(page, kofiFirst, true, "");
      await pick(page, "React");
    } else {
      await kofiFirst.hover();
      await kofiFirst.locator('[data-cluster] button:has-text("React")').click();
    }
    const words = await page
      .locator("[data-picker] button[data-quick]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    await page.locator('[data-picker] button[aria-label="Folded hands"]').click();
    await page.waitForTimeout(500);
    const r = writesOf(db, "messenger_react").at(-1);
    const shown = await kofiFirst
      .locator("[data-reaction]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    check(
      FLOW_CHECKS[9],
      JSON.stringify(words) === JSON.stringify(QUICK_LABELS) &&
        !!r &&
        r.body.p_reaction === "\u{1F64F}" &&
        shown.includes("Folded hands, you"),
      JSON.stringify({ words, r: r?.body, shown }),
    );

    // 11. Edit the message just sent.
    await openMenu(page, landed, touch, "Message actions");
    await pick(page, "Edit");
    const editing = await page.getByText("Editing", { exact: true }).count();
    await page.fill('[data-testid="message-field"]', "Sent from the arm, edited.");
    await page.click('[data-testid="send"]');
    await page.waitForTimeout(500);
    const ed = writesOf(db, "messenger_edit").at(-1);
    const editedRow = page.locator('[data-msg]:has-text("Sent from the arm, edited.")').last();
    check(
      FLOW_CHECKS[10],
      editing === 1 && !!ed && (await editedRow.locator("[data-edited]").count()) === 1,
      JSON.stringify({ editing, ed: ed?.body }),
    );

    // 12. Delete it for everyone.
    await openMenu(page, editedRow, touch, "Message actions");
    await pick(page, "Delete for everyone");
    await page.waitForTimeout(500);
    const del = writesOf(db, "messenger_delete").at(-1);
    const deletedLines = await page.locator('[data-deleted="1"]').allTextContents();
    check(
      FLOW_CHECKS[11],
      !!del && deletedLines.filter((t) => t.includes("This message was deleted")).length === 2,
      JSON.stringify({ del: del?.body, deletedLines: deletedLines.length }),
    );

    // 13, 14. The group: pin Ama's message as its lead, read Message info's Read by on the lead's
    // own message with receipts on (1345), and expand the blocked line.
    Mx.settings.receipts_enabled = true;
    await page.goto(BASE + "/messages/" + Mx.ids.group, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 8000 });
    const ama = page.locator('[data-msg]:has-text("can you confirm the room?")').first();
    await openMenu(page, ama, touch, "Message actions");
    await pick(page, "Pin");
    await page.waitForTimeout(600);
    const pin = writesOf(db, "messenger_pin_message").at(-1);
    const strip = await page
      .locator("[data-pinned-strip]")
      .textContent()
      .catch(() => "");
    const ownGroup = page
      .locator('[data-msg]:has-text("Confirmed. Room on the first floor.")')
      .first();
    await openMenu(page, ownGroup, touch, "Message actions");
    await pick(page, "Message info");
    const info = await page
      .locator('[data-testid="message-info"]')
      .textContent({ timeout: 5000 })
      .catch(() => "");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    Mx.settings.receipts_enabled = false;
    check(
      FLOW_CHECKS[12],
      !!pin &&
        strip.includes("Ama: @Amara Osei can you confirm the room?") &&
        info.includes("Read by Ama Darko, Kofi Boateng, Nana Adjei and others") &&
        !info.includes(", and others"),
      JSON.stringify({ strip, info: info.slice(0, 160) }),
    );
    await page.locator("[data-blocked-line] button").click();
    const blk = await page.locator("[data-blocked-line]").textContent();
    check(
      FLOW_CHECKS[13],
      blk.includes("Hide blocked message") && blk.includes("Yaa Mensah, blocked"),
      blk,
    );

    // 15. The media notice, once, on the first attach.
    Mx.settings.media_notice_seen_at = null;
    await page.goto(BASE + "/messages/" + Mx.ids.kofi, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 8000 });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page
      .locator('input[type="file"][accept="image/*"]')
      .setInputFiles({ name: "arm.png", mimeType: "image/png", buffer: png });
    await page.waitForTimeout(300);
    const notice = await page
      .locator("[data-media-notice]")
      .textContent()
      .catch(() => "");
    if (notice) await page.locator('[data-media-notice] button:has-text("OK")').click();
    await page.waitForTimeout(300);
    const seen = writesOf(db, "messenger_settings_set").filter(
      (x) => x.body.p_media_notice_seen === true,
    ).length;
    check(
      FLOW_CHECKS[14],
      notice.includes("Location and camera data are removed from what you send.") && seen === 1,
      JSON.stringify({ notice, seen }),
    );
    await page
      .locator('[data-strip] button[aria-label="Remove"]')
      .first()
      .click()
      .catch(() => undefined);

    // 16. Rate limited.
    Mx.fail = "send";
    await page.fill('[data-testid="message-field"]', "Too quick.");
    await page.click('[data-testid="send"]');
    await page.waitForTimeout(500);
    const limitLine = await page
      .locator("[data-rate-limited]")
      .textContent()
      .catch(() => "");
    const disabled = await page
      .locator('[data-testid="message-field"]')
      .isDisabled()
      .catch(() => false);
    check(
      FLOW_CHECKS[15],
      limitLine === "You are sending quickly. Wait a moment before the next message." &&
        !/\d/.test(limitLine) &&
        disabled,
      JSON.stringify({ limitLine, disabled }),
    );
    Mx.fail = null;

    // 17. Report Kofi's message.
    const kofiMsg = page.locator('[data-msg]:has-text("Yes, the port signed off.")').first();
    await openMenu(page, kofiMsg, touch, "Message actions");
    await pick(page, "Report");
    await page.waitForSelector('[data-testid="report-sheet"]', { timeout: 5000 });
    await page.locator('[data-testid="report-sheet"] select').selectOption("spam_or_scam");
    await page.click('[data-testid="report-submit"]');
    await page
      .waitForSelector('[data-testid="report-done"]', { timeout: 5000 })
      .catch(() => undefined);
    const rep = writesOf(db, "messenger_report").at(-1);
    const done = await page
      .locator('[data-testid="report-done"]')
      .textContent()
      .catch(() => "");
    check(
      FLOW_CHECKS[16],
      !!rep &&
        rep.body.p_reason === "spam_or_scam" &&
        done.includes(
          "Thank you. Someone will look at this one message and nothing else from the conversation. Kofi is not told.",
        ),
      JSON.stringify({ rep: rep?.body, done: done.slice(0, 140) }),
    );
    await page.keyboard.press("Escape");

    // 18. Accept Femi's request.
    await openMessages(page);
    await page
      .locator('[data-request-card]:has-text("Femi Adeyemi") button:has-text("Accept")')
      .click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: 8000 }).catch(() => undefined);
    const acc = writesOf(db, "messenger_request_accept").at(-1);
    const t2 = await toastText(page);
    check(
      FLOW_CHECKS[17],
      !!acc && t2.includes("Accepted. You can reply now.") && !page.url().endsWith("/messages"),
      JSON.stringify({ acc: acc?.body, url: page.url() }),
    );

    // 19. The group row's prefix, read before any write of this flow touched the group's last line.
    check(
      FLOW_CHECKS[18],
      groupLine.includes(groupWant),
      JSON.stringify({ want: groupWant, row: groupLine.slice(0, 160) }),
    );

    // 20. Recover Tunde's declined request (handoff 41-D, 1341).
    await openMessages(page);
    await page.click('[data-testid="declined-toggle"]');
    await page
      .locator(
        '[data-request-card][data-declined="1"]:has-text("Tunde") button:has-text("Recover")',
      )
      .click();
    await page.waitForTimeout(400);
    const rec = writesOf(db, "messenger_request_recover").at(-1);
    const t3 = await toastText(page);
    const back = await page
      .locator('[data-request-card]:not([data-declined]):has-text("Tunde")')
      .count();
    check(
      FLOW_CHECKS[19],
      !!rec &&
        rec.body.p_request === "55555555-5555-4555-8555-555555555003" &&
        t3.includes("Back in Requests.") &&
        writesOf(db, "messenger_request_accept").length === 1 &&
        page.url().endsWith("/messages") &&
        back === 1,
      JSON.stringify({ rec: rec?.body, toast: t3.slice(0, 120), back, url: page.url() }),
    );

    // 21. Rename (handoff 41-D, 1387): the group the mock member leads, then an event thread they lead.
    await page.goto(BASE + "/messages/" + Mx.ids.group, { waitUntil: "networkidle" });
    await page.click('[data-testid="manage"]');
    await page.waitForSelector('[data-testid="manage-sheet"]', { timeout: 5000 });
    const field = page.locator('[data-testid="rename"] input');
    await field.fill("Accra returnees, Thursdays");
    await page.locator('[data-testid="rename"] button:has-text("Rename")').click();
    await page.waitForTimeout(400);
    const ren = writesOf(db, "messenger_thread_rename").at(-1);
    const t4 = await toastText(page);
    Mx.threads.find((t) => t.thread_id === Mx.ids.event).role = "lead";
    await page.goto(BASE + "/messages/" + Mx.ids.event, { waitUntil: "networkidle" });
    await page.click('[data-testid="manage"]');
    await page.waitForSelector('[data-testid="manage-sheet"]', { timeout: 5000 });
    const eventRename = await page.locator('[data-testid="rename"]').count();
    check(
      FLOW_CHECKS[20],
      !!ren &&
        ren.body.p_thread === Mx.ids.group &&
        ren.body.p_name === "Accra returnees, Thursdays" &&
        t4.includes("Renamed.") &&
        eventRename === 0,
      JSON.stringify({ ren: ren?.body, toast: t4.slice(0, 120), eventRename }),
    );
    await page.keyboard.press("Escape");

    const keys = await messengerStorage(page);
    check(FLOW_CHECKS[21], keys.length === 0, keys.join(","));
    check(FLOW_CHECKS[22], errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    rest("the flow ended before this check ran");
    if (browser) await browser.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------------------------------
// 3. The deployment, with the two seeded accounts.
// ---------------------------------------------------------------------------------------------------

const src = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
const SUPABASE_URL =
  process.env.SUPABASE_URL || (src.match(/"(https:\/\/[a-z]+\.supabase\.co)"/) || [])[1];
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || (src.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];
const GROUP = "41-B media arm";

const LIVE_CHECKS = [
  "owner-test and member-test sign in on the deployment (218)",
  "the group renders as a row on /messages and its thread opens at /messages/{thread} (1047, 1023)",
  "a text send lands with one tick named Sent (1336)",
  "it turns to two ticks once member-test's client, open on the thread, acknowledges it (1336, 1351)",
  "member-test's Messages control carries the dot while the message is unread (82, 1344)",
  "a press on the quick bar's Folded hands writes the character and the pill reads the glyph name and you (1577, 1590)",
  "an edit reads edited (1343)",
  "a pin reads in the pinned strip (1371)",
  "Mark as unread lights the row (1344)",
  "Mute for 8 hours reads Muted on the row, and Unmute takes it off (1348)",
  "an archived thread returns to the list when a new message arrives (1339)",
  "search with a During date bound opens the thread at the message (1338, 1347)",
  "the receipts sheet opens exactly while receipts_chosen_at is null (1345)",
  "the media notice opens exactly while media_notice_seen_at is null (1346)",
  "an image sent through 41-B's route renders in the bubble (1346)",
  "a voice note recorded in the composer renders with the player (1346)",
  "a delete for everyone reads This message was deleted (1343)",
  "nothing the Messenger holds is in browser storage (1351)",
];

// ---------------------------------------------------------------------------------------------------
// Handoff 56-41E item 3: the Messenger's second pass on the mock, at the compact touch cell and the
// expanded pointer cell, in the macOS gate too (the glyphs and the Sheet differ on Safari).
// ---------------------------------------------------------------------------------------------------
const REACT_CHECKS = [
  "React opens the quick bar: eight drawn glyphs in 1403's order, named E9, one row that never wraps, then More (1403, 1404, 1586)",
  "a press writes messenger_react with the character and the pill reads the glyph name and you; a second glyph replaces the first and one own pill remains (1577, 1590)",
  "More opens the full picker, a Sheet on touch and an inline panel on pointer, with the search, the tone row with Not chosen first and checked, and the library's groups (1406, 1578, 1584)",
  "the emoji data came from the app's own origin, nothing reached cdn.jsdelivr.net, and nothing named frimousse is in localStorage or sessionStorage (1351, 1577)",
  "choosing a tone writes messenger_settings_set(p_skin_tone), the hands then carry the modifier and the faces carry none (1576, 1577)",
  "a pick from the picker writes messenger_react, and Recent leads with it on the next open (1405)",
  "Start a group from the plus: Start with no name reads Give the group a name., with no members reads Pick at least one connection. (1579, 1581)",
  "Start the group writes messenger_thread_create_group with the picked connection, lands on the new thread, and the empty line and the subtitle read the invited form (1580, 1592)",
  "a create refusal reads its word's line in the sheet's error line, and a word outside the six reads the create fallback (1581, 1409)",
  "Rename writes one system row rendered as {first name} renamed the group., and a search for the word returns nothing (1591)",
  "a received portrait video's player is taller than wide with the row's own ratio, object-fit contain and no label beside it (1593, 1583)",
  "a video the route refuses reads This video could not load., and Try again refetches and remounts the player (1574)",
  "every quick glyph is named E9's name, and on pointer resting on one shows a tooltip reading the same name, none on touch (1613, 1621, 1146)",
  "a grid cell for a quick glyph reads E9's name and a non-quick cell keeps the library's, and a toned Recent cell reads its name with the tone words (1621, 1628, 1629)",
  "a group's empty line reads is here for one name with no others and are here for two (1592, W90)",
  "an avatar whose signed URL answers 400 renders the initials with no img (W91)",
  "the Messages dot lights for an invited thread with nothing unread, and the bell row reads the invitation and opens the group (1623, 1637, 1335)",
  "an invited thread's row reads Invited by the inviter and its log reads the inviter's line; after Accept neither, and the dot clears (1638)",
  "nothing the Messenger holds is in localStorage or sessionStorage (1351)",
  "no page error (316)",
  "a press on a quick glyph pops in the bar, and the bar, with the pointer panel, is gone once the pop has shown, a real tap on touch (1739a)",
  "a press inside the bar, on More or inside the panel or the touch Sheet keeps the bar; a tap outside closes it, panel and all, and still lands, the message field taking focus (1739b)",
  "Escape closes the bar and the pointer panel, and the thread stays open (1739c)",
  "opening another message's bar closes the first: one bar, on the second message (1739d)",
  "a message image fills the bubble's media width at its own ratio up to 420 tall, cropped from its centre, in the 14 radius 1px --line frame with no fill beside it, data-frame natural, and a tap opens ImageViewer (1738, 1429)",
];

/** 1738: a portrait the row stores no size for, 600 by 900, painted edge to edge in one colour. */
const IMAGE_MEDIA = "33333333-3333-4333-8333-333333333002";
const PORTRAIT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">' +
  '<rect width="600" height="900" fill="#d0021b"/></svg>';

async function runMessengerReactions(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname}-${w}x${h}-${theme}-messenger reactions`;
  M.armStart(tag);
  const { check, rest, skip } = armCheck(tag, REACT_CHECKS);
  let browser;
  try {
    const opened = await newPage(browserType, vp, theme);
    browser = opened.browser;
    const { page, db, errors, touch } = opened;
    const Mx = db.messenger;
    const mock = require("./messenger-mock.cjs");
    const dataRequests = [];
    page.on("request", (r) => {
      const u = r.url();
      if (/emojibase|jsdelivr/.test(u)) dataRequests.push(u);
    });
    // The portrait fixture: VP9 where Chromium decodes it, H.264 where WebKit does; the route serves
    // the bytes the way the deployment's media route would, and refuses when the arm says so.
    const fixture = path.join(
      __dirname,
      "fixtures",
      bname === "webkit" ? "portrait-video.mp4" : "portrait-video.webm",
    );
    const fixtureMime = bname === "webkit" ? "video/mp4" : "video/webm";
    let refuseVideo = false;
    await page.route(`**/api/messages/media/${mock.VIDEO_MEDIA}`, (route) => {
      if (refuseVideo) return route.fulfill({ status: 403, body: "" });
      return route.fulfill({
        status: 200,
        headers: { "content-type": fixtureMime, "access-control-allow-origin": "*" },
        body: fs.readFileSync(fixture),
      });
    });
    await signInMock(page);
    await page.goto(BASE + "/messages/" + Mx.ids.kofi, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 10000 });
    const kofiFirst = page
      .locator('[data-msg]:has-text("The buyer from Tema came through.")')
      .first();
    const openBar = async () => {
      if (await page.locator("[data-picker]").count()) return;
      if (touch) {
        await openMenu(page, kofiFirst, true, "");
        await pick(page, "React");
      } else {
        await kofiFirst.hover();
        await kofiFirst.locator('[data-cluster] button:has-text("React")').click();
      }
      await page.waitForSelector("[data-picker]", { timeout: 5000 });
    };

    // 1. The bar.
    await openBar();
    const bar = await page.locator("[data-picker] button[data-quick]").evaluateAll((els) => ({
      labels: els.map((e) => e.getAttribute("aria-label")),
      tops: els.map((e) => Math.round(e.getBoundingClientRect().top)),
      drawn: els.map((e) => !!e.querySelector("svg[data-glyph]")),
    }));
    const more = await page.locator("[data-picker] [data-more]").count();
    check(
      REACT_CHECKS[0],
      JSON.stringify(bar.labels) === JSON.stringify(QUICK_LABELS) &&
        bar.drawn.every(Boolean) &&
        new Set(bar.tops).size === 1 &&
        more === 1,
      JSON.stringify(bar),
    );

    // 2. One reaction per member.
    await page.locator('[data-picker] button[aria-label="Folded hands"]').click();
    await page.waitForTimeout(600);
    const first = writesOf(db, "messenger_react").at(-1);
    const pill1 = await kofiFirst
      .locator("[data-reaction]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    await openBar();
    await page.locator('[data-picker] button[aria-label="Thumbs up"]').click();
    await page.waitForTimeout(600);
    const second = writesOf(db, "messenger_react").at(-1);
    const ownPills = await kofiFirst.locator('[data-reaction][aria-pressed="true"]').count();
    const ownRows = (Mx.messages[Mx.ids.kofi][0].reactions || []).filter((r) => r.own).length;
    check(
      REACT_CHECKS[1],
      !!first &&
        first.body.p_reaction === "\u{1F64F}" &&
        pill1.includes("Folded hands, you") &&
        !!second &&
        second.body.p_reaction === "\u{1F44D}\uFE0F" &&
        ownPills === 1 &&
        ownRows === 1,
      JSON.stringify({ first: first?.body, pill1, second: second?.body, ownPills, ownRows }),
    );

    // 3. The full picker.
    const pickerRoot = touch
      ? '[data-testid="react-sheet"] [data-reaction-picker]'
      : "[data-reaction-panel] [data-reaction-picker]";
    const openPicker = async () => {
      await openBar();
      await page.locator("[data-picker] [data-more]").click();
      await page.waitForSelector(pickerRoot, { timeout: 8000 });
      // Frimousse's first button is its hidden row sizer, named ""; the first named cell is a glyph.
      await page
        .locator(pickerRoot + ' [data-emoji-viewport] button:not([aria-label=""])')
        .first()
        .waitFor({ timeout: 15000 });
    };
    const closePicker = async () => {
      if (touch) {
        await page.keyboard.press("Escape");
      } else await page.locator('[data-reaction-panel] button[aria-label="Close"]').click();
      await page.waitForTimeout(400);
    };
    await openPicker();
    const pk = await page.evaluate((root) => {
      const r = document.querySelector(root);
      const tones = [...r.querySelectorAll('[data-tone-row] [role="radio"]')];
      return {
        search: !!r.querySelector("[data-emoji-search]"),
        toneLabels: tones.map((t) => t.getAttribute("aria-label")),
        checked: tones.map((t) => t.getAttribute("aria-checked")),
        sheet: !!document.querySelector('[data-testid="react-sheet"]'),
        panel: !!document.querySelector("[data-reaction-panel]"),
        text: r.textContent || "",
      };
    }, pickerRoot);
    check(
      REACT_CHECKS[2],
      pk.search &&
        pk.toneLabels[0] === "Not chosen" &&
        pk.checked[0] === "true" &&
        pk.toneLabels.length === 6 &&
        (touch ? pk.sheet && !pk.panel : pk.panel && !pk.sheet) &&
        pk.text.includes("Smileys & emotion"),
      JSON.stringify({ ...pk, text: pk.text.slice(0, 80) }),
    );
    const storage = await page.evaluate(() => {
      const keys = [];
      try {
        for (const k of Object.keys(localStorage))
          if (/frimousse/i.test(k)) keys.push("local:" + k);
      } catch {}
      try {
        for (const k of Object.keys(sessionStorage))
          if (/frimousse/i.test(k)) keys.push("session:" + k);
      } catch {}
      return keys;
    });
    const own = dataRequests.filter((u) => u.startsWith(BASE + "/emojibase/17.0.0/en/"));
    const cdn = dataRequests.filter((u) => /jsdelivr/.test(u));
    check(
      REACT_CHECKS[3],
      own.length >= 2 && cdn.length === 0 && storage.length === 0,
      JSON.stringify({ own: own.length, cdn, storage }),
    );

    // 4. The tone.
    await page.locator(pickerRoot + ' [data-tone="medium"]').click();
    await page.waitForTimeout(500);
    const toneWrite = writesOf(db, "messenger_settings_set").at(-1);
    await closePicker();
    await openBar();
    const toned = await page
      .locator("[data-picker] button[data-quick]")
      .evaluateAll((els) =>
        els.map((e) => [e.getAttribute("aria-label"), e.getAttribute("data-quick")]),
      );
    const byLabel = Object.fromEntries(toned);
    // Folded hands, not the member's own Thumbs up, which a press would remove (2.1).
    await page.locator('[data-picker] button[aria-label="Folded hands"]').click();
    await page.waitForTimeout(600);
    const tonedWrite = writesOf(db, "messenger_react").at(-1);
    check(
      REACT_CHECKS[4],
      !!toneWrite &&
        toneWrite.body.p_skin_tone === "\u{1F3FD}" &&
        byLabel["Thumbs up"] === "\u{1F44D}\u{1F3FD}" &&
        byLabel["Folded hands"] === "\u{1F64F}\u{1F3FD}" &&
        byLabel["Laughing"] === "\u{1F602}" &&
        !!tonedWrite &&
        tonedWrite.body.p_reaction === "\u{1F64F}\u{1F3FD}",
      JSON.stringify({ toneWrite: toneWrite?.body, byLabel, tonedWrite: tonedWrite?.body }),
    );

    // 5. A pick from the picker, then Recent.
    await openPicker();
    const cell = page
      .locator(pickerRoot + ' [data-emoji-viewport] button:not([aria-label=""])')
      .first();
    const picked = await cell.getAttribute("aria-label");
    await cell.click();
    await page.waitForTimeout(600);
    const pickWrite = writesOf(db, "messenger_react").at(-1);
    await openPicker();
    const recentFirst = await page
      .locator(pickerRoot + " [data-recent] [data-recent-emoji]")
      .first()
      .getAttribute("data-recent-emoji")
      .catch(() => null);
    await closePicker();
    check(
      REACT_CHECKS[5],
      !!pickWrite &&
        !!pickWrite.body.p_reaction &&
        pickWrite.body.p_reaction === Mx.recent[0] &&
        recentFirst === pickWrite.body.p_reaction,
      JSON.stringify({ picked, pickWrite: pickWrite?.body, recentFirst, recent: Mx.recent }),
    );

    // 12. The quick bar's names and tooltips (Fix PR 10 item 3).
    await openBar();
    const quickNames = await page
      .locator("[data-picker] button[data-quick]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    let tipText = null;
    if (!touch) {
      await page.locator('[data-picker] button[aria-label="Clapping"]').hover();
      await page.waitForTimeout(900);
      tipText = await page
        .locator("[data-tooltip]")
        .first()
        .textContent()
        .catch(() => null);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
    }
    const tipCount = await page.locator("[data-tooltip]").count();
    check(
      REACT_CHECKS[12],
      JSON.stringify(quickNames) === JSON.stringify(QUICK_LABELS) &&
        (touch ? tipCount === 0 : tipText === "Clapping" && tipCount === 0),
      JSON.stringify({ quickNames, tipText, tipCount, touch }),
    );

    // 13. The grid's and Recent's names (1621, 1628, 1629).
    await openPicker();
    await page.locator(pickerRoot + " [data-emoji-search]").fill("party");
    await page.waitForTimeout(700);
    const partyCells = await page
      .locator(pickerRoot + ' [data-emoji-viewport] button:not([aria-label=""])')
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    await page.locator(pickerRoot + " [data-emoji-search]").fill("");
    await page.waitForTimeout(500);
    const recentNames = await page
      .locator(pickerRoot + " [data-recent] [data-recent-emoji]")
      .evaluateAll((els) =>
        els.map((e) => [e.getAttribute("data-recent-emoji"), e.getAttribute("aria-label")]),
      );
    const tonedRecent = recentNames.find(([e]) => e === "\u{1F64F}\u{1F3FD}");
    await closePicker();
    check(
      REACT_CHECKS[13],
      partyCells.includes("Party") &&
        partyCells.includes("Partying face") &&
        !!tonedRecent &&
        tonedRecent[1] === "Folded hands: medium skin tone" &&
        recentNames.every(([e, n]) => !!n && n !== e),
      JSON.stringify({ partyCells, recentNames }),
    );

    // 14. The empty line's verb (1592, W90): one name with no others, then two.
    const emptyGroup = (id, names) => ({
      thread_id: id,
      kind: "community_group",
      name: "Verb check " + names.length,
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: names,
      others: false,
      last_line: null,
      last_kind: null,
      last_author_id: null,
      last_seq: null,
      last_activity_at: new Date().toISOString(),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 0,
      delivered_seq: 0,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: new Date().toISOString(),
    });
    const oneId = "11111111-1111-4111-8111-111111111021";
    const twoId = "11111111-1111-4111-8111-111111111022";
    Mx.threads.push(
      emptyGroup(oneId, ["Lerato Khumalo"]),
      emptyGroup(twoId, ["Kwame Mensah", "Nana Adjei"]),
    );
    Mx.messages[oneId] = [];
    Mx.messages[twoId] = [];
    const emptyLineOf = async (id) => {
      await page.goto(BASE + "/messages/" + id, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="thread-empty"]', { timeout: 10000 });
      return (await page.locator('[data-testid="thread-empty"]').textContent()) || "";
    };
    const oneLine = await emptyLineOf(oneId);
    const twoLine = await emptyLineOf(twoId);
    Mx.threads = Mx.threads.filter((t) => t.thread_id !== oneId && t.thread_id !== twoId);
    check(
      REACT_CHECKS[14],
      oneLine === "Nobody has written yet. Lerato Khumalo is here." &&
        twoLine === "Nobody has written yet. Kwame Mensah and Nana Adjei are here.",
      JSON.stringify({ oneLine, twoLine }),
    );

    // 15. A stale signed avatar (W91): the signed URL answers 400, the row shows its initials.
    const kofiRow = Mx.threads.find((t) => t.thread_id === Mx.ids.kofi);
    kofiRow.avatar_path = "avatars/kofi-stale.png";
    let staleHits = 0;
    await page.route(
      (u) => /\/sign\/.*kofi-stale/.test(u.href),
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        staleHits++;
        return route.fulfill({ status: 400, contentType: "application/json", body: "{}" });
      },
    );
    await openMessages(page);
    const kofiLocator = page.locator('[data-thread-row]:has-text("Kofi Boateng")').first();
    await page
      .waitForFunction(
        () => {
          const row = Array.from(document.querySelectorAll("[data-thread-row]")).find((r) =>
            (r.textContent || "").includes("Kofi Boateng"),
          );
          return (
            !!row &&
            !row.querySelector("img") &&
            !!row.querySelector('span[aria-label="Kofi Boateng"]')
          );
        },
        null,
        { timeout: 8000 },
      )
      .catch(() => undefined);
    const stale = await kofiLocator.evaluate((row) => ({
      img: row.querySelectorAll("img").length,
      initials: row.querySelector('span[aria-label="Kofi Boateng"]')?.textContent || "",
    }));
    kofiRow.avatar_path = null;
    // The re-signing of a dropped or aged entry is the unit read's (tests/avatar-cache.cjs): a
    // page load here starts the cache empty, so a second open proves nothing about the drop.
    check(
      REACT_CHECKS[15],
      stale.img === 0 && stale.initials === "KB" && staleHits >= 1,
      JSON.stringify({ stale, staleHits }),
    );

    // 16, 17. The invitation (Fix PR 10 items 8 and 9): nothing unread, one invited thread.
    for (const t of Mx.threads) t.unread = false;
    Mx.threads.unshift(mock.invitedGroupThread());
    db.notifications.push(mock.invitedGroupNotification());
    db.membersById[mock.members.esi.id] = {
      id: mock.members.esi.id,
      name: mock.members.esi.name,
      handle: "esi-owusu",
    };
    await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
    await page
      .locator('[data-testid="messages-dot"]')
      .waitFor({ timeout: 10000 })
      .catch(() => undefined);
    const dotLit = await page.evaluate(() => ({
      dot: document.querySelectorAll('[data-testid="messages-dot"]').length,
      label: document.querySelector('[data-testid="messages"]')?.getAttribute("aria-label"),
    }));
    await page.click('[data-testid="bell"]');
    const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
    await panel.waitFor({ timeout: 10000 });
    const inviteRow = panel.locator('button[data-kind="thread_invitation"]');
    await inviteRow.waitFor({ timeout: 10000 });
    const inviteText = ((await inviteRow.textContent()) || "").replace(/\s+/g, " ");
    const inviteDest = await inviteRow.getAttribute("data-destination");
    const inviteC = await inviteRow.locator('[role="img"][aria-label="Connect"]').count();
    await inviteRow.click();
    await page
      .waitForURL("**/messages/" + Mx.ids.invited, { timeout: 10000 })
      .catch(() => undefined);
    const landedOnGroup = page.url().endsWith("/messages/" + Mx.ids.invited);
    check(
      REACT_CHECKS[16],
      dotLit.dot === 1 &&
        dotLit.label === "New messages" &&
        inviteText.includes("Esi Owusu invited you to Tema cold chain.") &&
        inviteDest === "Opens the group" &&
        inviteC === 1 &&
        landedOnGroup,
      JSON.stringify({
        dotLit,
        inviteText: inviteText.slice(0, 120),
        inviteDest,
        inviteC,
        landedOnGroup,
      }),
    );
    await page
      .locator('[data-testid="thread-invited-line"]')
      .waitFor({ timeout: 10000 })
      .catch(() => undefined);
    const invitedLog =
      (await page
        .locator('[data-testid="thread-invited-line"]')
        .textContent()
        .catch(() => "")) || "";
    await openMessages(page);
    const invitedRowText =
      (await page
        .locator('[data-thread-row]:has-text("Tema cold chain")')
        .first()
        .textContent()
        .catch(() => "")) || "";
    await page.goto(BASE + "/messages/" + Mx.ids.invited, { waitUntil: "networkidle" });
    await page
      .locator(
        '[data-thread-header] button:has-text("Accept"), section[aria-label="Tema cold chain"] button:has-text("Accept")',
      )
      .first()
      .click();
    await page.waitForTimeout(800);
    const acceptWrite = writesOf(db, "messenger_thread_invite_accept").at(-1);
    const afterAccept = await page.evaluate(() => ({
      invitedLine: document.querySelectorAll('[data-testid="thread-invited-line"]').length,
      empty: document.querySelector('[data-testid="thread-empty"]')?.textContent || "",
    }));
    await openMessages(page);
    const acceptedRowText =
      (await page
        .locator('[data-thread-row]:has-text("Tema cold chain")')
        .first()
        .textContent()
        .catch(() => "")) || "";
    await page.goto(BASE + "/feed", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const dotAfter = await page.locator('[data-testid="messages-dot"]').count();
    check(
      REACT_CHECKS[17],
      invitedLog === "Esi Owusu invited you. Accept to read the conversation." &&
        invitedRowText.includes("Invited by Esi Owusu") &&
        !invitedRowText.includes("Nobody has written yet") &&
        !!acceptWrite &&
        acceptWrite.body.p_thread === Mx.ids.invited &&
        afterAccept.invitedLine === 0 &&
        afterAccept.empty.startsWith("Nobody has written yet.") &&
        !acceptedRowText.includes("Invited by") &&
        dotAfter === 0,
      JSON.stringify({
        invitedLog,
        invitedRowText: invitedRowText.slice(0, 80),
        acceptWrite: acceptWrite?.body,
        afterAccept,
        acceptedRowText: acceptedRowText.slice(0, 80),
        dotAfter,
      }),
    );
    Mx.threads = Mx.threads.filter((t) => t.thread_id !== Mx.ids.invited);

    // 6, 7, 8. Start a group.
    await openMessages(page);
    await page.locator('[data-testid="start-group-open"]').click();
    await page.waitForSelector('[data-testid="start-group-sheet"]', { timeout: 8000 });
    await page.locator('[data-testid="start-group"]').click();
    await page.waitForTimeout(300);
    const nameErr = await page.locator('[data-testid="start-group-sheet"]').textContent();
    await page.locator('[data-testid="group-name"]').fill("Tema port crew");
    await page.locator('[data-testid="start-group"]').click();
    await page.waitForTimeout(300);
    const membersErr = await page
      .locator("[data-members-error]")
      .textContent()
      .catch(() => "");
    check(
      REACT_CHECKS[6],
      nameErr.includes("Give the group a name.") && membersErr === "Pick at least one connection.",
      JSON.stringify({ nameErr: nameErr.slice(0, 120), membersErr }),
    );
    await page.locator('[data-testid="start-group-sheet"] label:has-text("Add Lerato")').click();
    await page.locator('[data-testid="start-group"]').click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="thread-empty"]', { timeout: 10000 });
    const created = writesOf(db, "messenger_thread_create_group").at(-1);
    const landing = await page.evaluate(() => ({
      empty: document.querySelector('[data-testid="thread-empty"]')?.textContent || "",
      sub:
        document.querySelector("[data-pane-subtitle]")?.textContent ||
        document.querySelector("[data-thread-header]")?.textContent ||
        "",
    }));
    const newId = page.url().split("/").pop();
    check(
      REACT_CHECKS[7],
      !!created &&
        created.body.p_name === "Tema port crew" &&
        JSON.stringify(created.body.p_member_ids) ===
          JSON.stringify(["c4000000-0000-4000-8000-000000000004"]) &&
        Mx.threads[0].thread_id === newId &&
        landing.empty === "Nobody has written yet. Lerato Khumalo, invited." &&
        landing.sub.includes("Lerato Khumalo, invited"),
      JSON.stringify({ created: created?.body, landing, newId }),
    );
    const refusedWith = async (word) => {
      Mx.fail = "create:" + word;
      await openMessages(page);
      await page.locator('[data-testid="start-group-open"]').click();
      await page.waitForSelector('[data-testid="start-group-sheet"]', { timeout: 8000 });
      await page.locator('[data-testid="group-name"]').fill("Refused");
      await page.locator('[data-testid="start-group-sheet"] label:has-text("Add Lerato")').click();
      await page.locator('[data-testid="start-group"]').click();
      await page.waitForSelector("[data-sheet-error]", { timeout: 8000 });
      const line = await page.locator("[data-sheet-error]").textContent();
      const stillOpen = await page.locator('[data-testid="start-group-sheet"]').count();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      Mx.fail = null;
      return { line: (line || "").trim(), stillOpen };
    };
    const refusedWord = await refusedWith("not_your_connection");
    const refusedOther = await refusedWith("too_long");
    check(
      REACT_CHECKS[8],
      refusedWord.line === "Only your connections can be added. Connect with them first." &&
        refusedWord.stillOpen === 1 &&
        refusedOther.line === "The group was not started. Try again.",
      JSON.stringify({ refusedWord, refusedOther }),
    );

    // 9. Rename, the system line, the search.
    await page.goto(BASE + "/messages/" + Mx.ids.group, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 10000 });
    await page.locator('[data-testid="manage"]').click();
    await page.waitForSelector('[data-testid="rename"]', { timeout: 8000 });
    await page.locator('[data-testid="rename"] input').fill("Accra returnees, Osu");
    await page.locator('[data-testid="rename"] button:has-text("Rename")').click();
    await page.waitForTimeout(700);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const systemLines = await page.locator("[data-system]").allTextContents();
    const systemRows = (Mx.messages[Mx.ids.group] || []).filter((m) => m.kind === "system");
    await openMessages(page);
    await page.fill('[data-testid="message-search"]', "renamed");
    await page.waitForTimeout(900);
    const noResults = await page.locator('[data-testid="no-results"]').count();
    const hits = await page
      .locator('[role="list"][aria-label="Results"] [data-search-result]')
      .count();
    check(
      REACT_CHECKS[9],
      systemRows.length === 1 &&
        systemRows[0].body === "renamed" &&
        systemLines.length === 1 &&
        systemLines[0] === "Amara renamed the group." &&
        noResults === 1 &&
        hits === 0,
      JSON.stringify({ systemLines, systemRows: systemRows.length, noResults, hits }),
    );
    await page.fill('[data-testid="message-search"]', "");

    // 10, 11. The portrait video, and the failed block.
    await page.goto(BASE + "/messages/" + Mx.ids.nana, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-message-video], [data-video-failed]", { timeout: 15000 });
    await page.waitForTimeout(800);
    const video = await page.evaluate(() => {
      const v = document.querySelector("[data-message-video]");
      if (!v) return { present: false, failed: !!document.querySelector("[data-video-failed]") };
      const box = v.getBoundingClientRect();
      const bubble = v.closest("[data-bubble]");
      return {
        present: true,
        w: Math.round(box.width),
        h: Math.round(box.height),
        ratio: v.getAttribute("data-video-ratio"),
        fit: getComputedStyle(v).objectFit,
        error: v.error ? v.error.code : null,
        bubbleText: (bubble && bubble.textContent) || "",
        poster: v.hasAttribute("poster"),
        controls: v.hasAttribute("controls"),
      };
    });
    if (video.present && video.error === null)
      check(
        REACT_CHECKS[10],
        video.h > video.w &&
          video.ratio === "124 / 320" &&
          video.fit === "contain" &&
          video.bubbleText === "" &&
          video.controls &&
          !video.poster,
        JSON.stringify(video),
      );
    else
      skip(
        REACT_CHECKS[10],
        "this engine did not decode the portrait fixture (" + JSON.stringify(video) + ")",
      );
    refuseVideo = true;
    await page.goto(BASE + "/messages/" + Mx.ids.nana, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-video-failed]", { timeout: 15000 });
    const failedText = await page.locator("[data-video-failed]").textContent();
    refuseVideo = false;
    await page.locator("[data-video-retry]").click();
    const remounted = await page
      .waitForSelector("[data-message-video]", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check(
      REACT_CHECKS[11],
      failedText.includes("This video could not load.") &&
        failedText.includes("Try again") &&
        remounted,
      JSON.stringify({ failedText, remounted }),
    );

    // 20 to 23. The bar's dismissal (1739), on Kofi's thread. A press is a real tap on touch, so
    // WebKit's touch path is what the gate's two cells read, and a click on pointer.
    const tapOrClick = (loc) => (touch ? loc.tap() : loc.click());
    const barState = () =>
      page.evaluate(() => ({
        bars: [...document.querySelectorAll("[data-picker]")].map(
          (b) => b.closest("[data-msg]")?.getAttribute("data-msg") || "",
        ),
        panel: document.querySelectorAll("[data-reaction-panel]").length,
        sheet: document.querySelectorAll('[data-testid="react-sheet"]').length,
        pop: document.querySelectorAll("[data-picker] .b14-pop").length,
        focus: document.activeElement?.getAttribute("data-testid") || "",
      }));
    await page.goto(BASE + "/messages/" + Mx.ids.kofi, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-messenger-thread] [data-msg]", { timeout: 10000 });
    const kofiId = await kofiFirst.getAttribute("data-msg");
    const openPanel = async () => {
      await tapOrClick(page.locator("[data-picker] [data-more]"));
      await page.waitForSelector(touch ? '[data-testid="react-sheet"]' : "[data-reaction-panel]", {
        timeout: 8000,
      });
    };

    // 20 (a): pressed, the glyph pops in the bar; 700 ms on, the bar and the panel are gone.
    await openBar();
    if (!touch) await openPanel();
    const withPanel = await barState();
    await tapOrClick(page.locator('[data-picker] button[aria-label="Heart"]'));
    const atPress = await barState();
    await page.waitForTimeout(700);
    const afterPick = await barState();
    check(
      REACT_CHECKS[20],
      (touch || withPanel.panel === 1) &&
        atPress.bars.length === 1 &&
        atPress.pop >= 1 &&
        afterPick.bars.length === 0 &&
        afterPick.panel === 0,
      JSON.stringify({ withPanel, atPress, afterPick }),
    );

    // 21 (b): inside keeps it; outside closes it and the tap still lands.
    await openBar();
    await openPanel();
    const searchIn = touch
      ? '[data-testid="react-sheet"] [data-emoji-search]'
      : "[data-reaction-panel] [data-emoji-search]";
    await tapOrClick(page.locator(searchIn).first());
    await page.waitForTimeout(200);
    const inPanel = await barState();
    if (touch) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
    const sheetClosed = await barState();
    // The bar's own ground, between its glyphs: a pointerdown there is inside.
    await page.locator("[data-picker]").dispatchEvent("pointerdown", {
      button: 0,
      pointerType: touch ? "touch" : "mouse",
      isPrimary: true,
    });
    await page.waitForTimeout(100);
    const onBar = await barState();
    await tapOrClick(page.locator('[data-testid="message-field"]'));
    await page.waitForTimeout(200);
    const outside = await barState();
    check(
      REACT_CHECKS[21],
      inPanel.bars.length === 1 &&
        (touch ? inPanel.sheet === 1 : inPanel.panel === 1) &&
        sheetClosed.bars.length === 1 &&
        sheetClosed.sheet === 0 &&
        onBar.bars.length === 1 &&
        outside.bars.length === 0 &&
        outside.panel === 0 &&
        outside.focus === "message-field",
      JSON.stringify({ inPanel, sheetClosed, onBar, outside }),
    );

    // 22 (c): Escape.
    await openBar();
    if (!touch) await openPanel();
    const beforeEsc = await barState();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const afterEsc = await barState();
    const threadOpen = await kofiFirst.isVisible();
    check(
      REACT_CHECKS[22],
      beforeEsc.bars.length === 1 &&
        (touch || beforeEsc.panel === 1) &&
        afterEsc.bars.length === 0 &&
        afterEsc.panel === 0 &&
        threadOpen,
      JSON.stringify({ beforeEsc, afterEsc, threadOpen }),
    );

    // 23 (d): another message's bar.
    await openBar();
    const otherId = await page.evaluate(
      (first) =>
        [...document.querySelectorAll("[data-messenger-thread] [data-msg]")]
          .filter((m) => !m.hasAttribute("data-deleted") && m.querySelector("[data-bubble]"))
          .map((m) => m.getAttribute("data-msg"))
          .find((id) => id && id !== first) || "",
      kofiId,
    );
    const other = page.locator(`[data-msg="${otherId}"]`);
    if (touch) {
      await openMenu(page, other, true, "");
      await pick(page, "React");
    } else {
      await other.hover();
      await other.locator("[data-cluster] [data-react-toggle]").click();
    }
    await page.waitForTimeout(200);
    const otherBar = await barState();
    check(
      REACT_CHECKS[23],
      !!otherId && otherBar.bars.length === 1 && otherBar.bars[0] === otherId,
      JSON.stringify({ kofiId, otherId, otherBar }),
    );
    await page.keyboard.press("Escape");

    // 24. The message image (1738): a 600 by 900 portrait with no stored size, on Nana's thread.
    await page.route(`**/api/messages/media/${IMAGE_MEDIA}`, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "image/svg+xml", "access-control-allow-origin": "*" },
        body: PORTRAIT_SVG,
      }),
    );
    const nanaMsgs = Mx.messages[Mx.ids.nana];
    const imageRow = {
      ...nanaMsgs[0],
      message_id: "22222222-2222-4222-8222-222222222738",
      seq: nanaMsgs.length + 1,
      body: null,
      kind: "media",
      media_id: IMAGE_MEDIA,
      media_word: "Image",
      media_width: null,
      media_height: null,
      reactions: [],
      created_at: new Date().toISOString(),
    };
    nanaMsgs.push(imageRow);
    await page.goto(BASE + "/messages/" + Mx.ids.nana, { waitUntil: "networkidle" });
    const frameSel = `[data-msg="${imageRow.message_id}"] [data-media="image"]`;
    await page.waitForFunction(
      (sel) => {
        const img = document.querySelector(sel + " img");
        return !!img && img.complete && img.naturalWidth > 0;
      },
      frameSel,
      { timeout: 15000 },
    );
    const im = await page.evaluate((sel) => {
      const f = document.querySelector(sel);
      const img = f.querySelector("img");
      const wrap = f.parentElement;
      const fr = f.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      const cs = getComputedStyle(f);
      const is = getComputedStyle(img);
      const probe = document.createElement("span");
      probe.style.color = "var(--line)";
      document.body.appendChild(probe);
      const line = getComputedStyle(probe).color;
      probe.remove();
      const bw = parseFloat(cs.borderLeftWidth);
      return {
        frame: f.getAttribute("data-frame"),
        fw: fr.width,
        wrapW: wrap.getBoundingClientRect().width,
        inner: { l: fr.left + bw, r: fr.right - bw, t: fr.top + bw, b: fr.bottom - bw },
        img: { l: ir.left, r: ir.right, t: ir.top, b: ir.bottom, w: ir.width, h: ir.height },
        radius: cs.borderTopLeftRadius,
        border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
        line,
        bg: cs.backgroundColor,
        fit: is.objectFit,
        pos: is.objectPosition,
      };
    }, frameSel);
    const near = (a, b) => Math.abs(a - b) <= 0.75;
    const wantH = Math.min(im.img.w * 1.5, 420);
    const filled =
      near(im.img.l, im.inner.l) &&
      near(im.img.r, im.inner.r) &&
      near(im.img.t, im.inner.t) &&
      near(im.img.b, im.inner.b) &&
      /rgba\(0, 0, 0, 0\)|transparent/.test(im.bg);
    await tapOrClick(page.locator(frameSel));
    const viewer = await page
      .waitForSelector("dialog.strand-viewer[open] img", { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    Mx.messages[Mx.ids.nana] = nanaMsgs.filter((m) => m.message_id !== imageRow.message_id);
    check(
      REACT_CHECKS[24],
      im.frame === "natural" &&
        near(im.fw, im.wrapW) &&
        im.fw <= 320.5 &&
        near(im.img.h, wantH) &&
        filled &&
        im.radius === "14px" &&
        im.border === "1px solid " + im.line &&
        im.fit === "cover" &&
        im.pos === "50% 50%" &&
        viewer,
      JSON.stringify({ ...im, wantH, filled, viewer }),
    );

    const keys = await messengerStorage(page);
    check(REACT_CHECKS[18], keys.length === 0, keys.join(","));
    // The 403 the arm's own route answered for check 12 and the 400 the stale-avatar route answered
    // for check 16 are the console lines it expects.
    const unexpected = errors.filter(
      (e) =>
        !/\/api\/messages\/media\/.*\b403\b/.test(e) &&
        !/kofi-stale.*\b400\b|\b400\b.*kofi-stale/.test(e),
    );
    check(REACT_CHECKS[19], unexpected.length === 0, unexpected.slice(0, 3).join(" | "));
    await M.shot(page, `${tag}-video`);
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    rest("the flow ended before this check ran");
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function liveSignIn(page, email, password) {
  await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(feed|welcome|messages)/, { timeout: 25000 });
  // The landing surface's own reads settle before the arm navigates away from it (run 485).
  await page.waitForLoadState("networkidle");
}

/** A synthetic microphone so MediaRecorder records real bytes in either engine (WebM Opus, MP4 AAC). */
async function syntheticMic(ctx) {
  await ctx.addInitScript(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    md.getUserMedia = async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      osc.frequency.value = 330;
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      return dest.stream;
    };
  });
}

async function runMessengerLive(browserType, bname) {
  const tag = `${bname}-messenger-live`;
  M.armStart(tag);
  const { check, rest, skip } = armCheck(tag, LIVE_CHECKS);
  const { MEMBER_EMAIL, MEMBER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
  if (!MEMBER_EMAIL || !MEMBER_PASSWORD || !OWNER_EMAIL || !OWNER_PASSWORD) {
    rest("MEMBER_* and OWNER_* are not set, so no account can sign in");
    return;
  }
  if (!SUPABASE_URL || !KEY) {
    rest("the Supabase URL or publishable key could not be read from src/lib/supabase.ts");
    return;
  }
  let browser;
  const sent = [];
  let ownerToken = null;
  let threadId = null;
  const rpc = async (token, fn, args) => {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: r.status, body, text };
  };
  const token = async (email, password) => {
    const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const b = await r.json().catch(() => null);
    return b && b.access_token ? b.access_token : null;
  };
  try {
    ownerToken = await token(OWNER_EMAIL, OWNER_PASSWORD);
    const memberToken = await token(MEMBER_EMAIL, MEMBER_PASSWORD);
    browser = await launch(browserType);
    const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await syntheticMic(ownerCtx);
    const memberCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ownerCtx.newPage();
    const peer = await memberCtx.newPage();
    const errors = [];
    // Ruling 357 on the deployment: WebKit words a fetch a navigation cancelled as an
    // access-control denial, and the arm navigates away from surfaces whose reads are in flight
    // (run 485: the Feed's avatar signing and post_saves read). Only that wording, and only for the
    // project's own host, is ignored; any other page error still fails the check.
    const cancelled = new RegExp(
      `(?:^|[\\s/])${SUPABASE_URL.replace(/^https:\/\//, "").replace(/\./g, "\\.")}\\S*\\s+due to access control checks\\.?$`,
    );
    page.on("pageerror", (e) => {
      const text = String(e.message || e);
      if (!cancelled.test(text)) errors.push(text);
    });
    await liveSignIn(page, OWNER_EMAIL, OWNER_PASSWORD);
    await liveSignIn(peer, MEMBER_EMAIL, MEMBER_PASSWORD);
    check(LIVE_CHECKS[0], !!ownerToken && !!memberToken, ownerToken ? "" : "owner token missing");

    // The thread, as 41-B's arm keeps it.
    const settingsBefore = await rpc(ownerToken, "messenger_settings", {});
    const r = await fetch(
      SUPABASE_URL +
        "/rest/v1/messenger_threads_view?select=thread_id,archived,muted,pinned&kind=eq.community_group&role=eq.lead&name=eq." +
        encodeURIComponent(GROUP) +
        "&order=created_at.asc&limit=1",
      { headers: { apikey: KEY, Authorization: "Bearer " + ownerToken } },
    );
    const rows = await r.json().catch(() => []);
    threadId = Array.isArray(rows) && rows[0] ? rows[0].thread_id : null;
    if (!threadId) {
      rest(
        "41-B's group thread was not found; tests/messenger-media.cjs creates it on its first run",
      );
      return;
    }
    if (rows[0].archived) await rpc(ownerToken, "messenger_unarchive", { p_thread: threadId });
    if (rows[0].muted) await rpc(ownerToken, "messenger_mute", { p_thread: threadId });

    // 13. The receipts sheet: open exactly while the setting is unchosen.
    await page.goto(BASE + "/messages", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const chosen = settingsBefore.body && settingsBefore.body.receipts_chosen_at;
    const sheetShown = (await page.locator('[data-testid="receipts-sheet"]').count()) > 0;
    check(
      LIVE_CHECKS[12],
      sheetShown === !chosen,
      `chosen ${chosen ? "yes" : "no"}; sheet ${sheetShown}`,
    );
    if (sheetShown) {
      await page.click('[data-testid="receipts-continue"]');
      await page.waitForTimeout(800);
    }

    // 2. The row and the thread.
    const row = page
      .locator(`[data-thread-row]:has([data-thread-name]:text-is("${GROUP}"))`)
      .first();
    await row.waitFor({ timeout: 15000 });
    await row.locator("[data-thread-open]").click();
    await page.waitForURL("**/messages/" + threadId, { timeout: 15000 });
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 15000 });
    check(LIVE_CHECKS[1], page.url().endsWith("/messages/" + threadId));

    // 3, 4, 5. A send, its first tick, the peer's dot, then the second tick.
    const words = "41-C arm " + crypto.randomUUID().slice(0, 8);
    await page.fill('[data-testid="message-field"]', words);
    await page.click('[data-testid="send"]');
    const mine = page.locator(`[data-msg]:has-text("${words}")`).last();
    await mine.waitFor({ timeout: 15000 });
    const id = await mine.getAttribute("data-msg");
    if (id) sent.push(id);
    const first = await mine.locator("[data-ticks]").getAttribute("aria-label");
    check(LIVE_CHECKS[2], first === "Sent", "tick " + first);
    await peer.goto(BASE + "/messages", { waitUntil: "networkidle" });
    await peer.waitForTimeout(1500);
    const dot = await peer.locator('[data-testid="messages-dot"]').count();
    check(LIVE_CHECKS[4], dot === 1, "dot " + dot);
    await peer.goto(BASE + "/messages/" + threadId, { waitUntil: "networkidle" });
    await peer.locator(`[data-msg]:has-text("${words}")`).waitFor({ timeout: 15000 });
    // The peer's cursors are debounced two seconds; then the owner's page reads the row again.
    await peer.waitForTimeout(3500);
    let second = "";
    for (let i = 0; i < 6 && second !== "Delivered" && second !== "Read"; i++) {
      await page.waitForTimeout(2000);
      second =
        (await mine
          .locator("[data-ticks]")
          .getAttribute("aria-label")
          .catch(() => "")) || "";
      if (i === 3) await page.reload({ waitUntil: "networkidle" });
    }
    check(LIVE_CHECKS[3], second === "Delivered" || second === "Read", "tick " + second);

    // 6. React (41-E): the quick bar of eight, drawn from vocabularies().message_reaction_quick.
    // Until 20261008150700 is on the project the vocabulary carries no quick key, the bar renders
    // empty and messenger_react takes the five words, so the check is unproven, never a pass (228).
    await mine.hover();
    await mine.locator('[data-cluster] button:has-text("React")').click();
    await page.waitForSelector("[data-picker]", { timeout: 10000 });
    const quickCount = await page.locator("[data-picker] button[data-quick]").count();
    if (quickCount === 0) {
      skip(
        LIVE_CHECKS[5],
        "the quick bar is empty: 20261008150000 to 20261008150700 are not on the project yet",
      );
      // React again toggles the bar off. Not Escape: at expanded the thread sits in a Pane whose
      // guard closes on Escape (correction 23), which is how run 536 lost the thread here.
      await mine.hover();
      await mine.locator('[data-cluster] button:has-text("React")').click();
      await page.waitForTimeout(300);
    } else {
      await page.locator('[data-picker] button[aria-label="Folded hands"]').click();
      await page.waitForTimeout(1500);
      const reacts = await mine
        .locator("[data-reaction]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      check(
        LIVE_CHECKS[5],
        quickCount === 8 && reacts.some((t) => t === "Folded hands, you"),
        JSON.stringify({ quickCount, reacts }),
      );
    }

    // 7. Edit.
    await mine.hover();
    await mine.locator('button[aria-label="Message actions"]').click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await page.fill('[data-testid="message-field"]', words + " edited");
    await page.click('[data-testid="send"]');
    await page.waitForTimeout(1500);
    check(LIVE_CHECKS[6], (await mine.locator("[data-edited]").count()) === 1);

    // 8. Pin (owner-test leads the group).
    await mine.hover();
    await mine.locator('button[aria-label="Message actions"]').click();
    await page.locator('[role="menuitem"]:has-text("Pin")').first().click();
    await page.waitForTimeout(1500);
    const strip = await page
      .locator("[data-pinned-strip]")
      .textContent()
      .catch(() => "");
    check(LIVE_CHECKS[7], strip.includes(words), strip.slice(0, 120));

    // 9, 10, 11. Row acts from the list.
    await page.goto(BASE + "/messages", { waitUntil: "networkidle" });
    const lrow = page
      .locator(`[data-thread-row]:has([data-thread-name]:text-is("${GROUP}"))`)
      .first();
    await lrow.waitFor({ timeout: 15000 });
    const act = async (label) => {
      await lrow.hover();
      await lrow.locator(`button[aria-label="Actions for ${GROUP}"]`).click();
      await page.locator(`[role="menuitem"]:has-text("${label}")`).first().click();
      await page.waitForTimeout(1500);
    };
    await act("Mark as unread");
    check(LIVE_CHECKS[8], (await lrow.getAttribute("data-unread")) === "1");
    await act("Mute for 8 hours");
    const mutedNow = (await lrow.textContent()).includes("Muted");
    await act("Unmute");
    const unmuted = !(await lrow.textContent()).includes("Muted");
    check(LIVE_CHECKS[9], mutedNow && unmuted, `muted ${mutedNow} unmuted ${unmuted}`);
    await act("Archive");
    // The archive reaches the deployment and the row's refresh comes back over the network, so the
    // list is polled rather than read once (run 488 read it once, at 1.5 s).
    let gone = false;
    for (let i = 0; i < 10 && !gone; i++) {
      gone =
        (await page
          .locator(`[data-testid="thread-list"] [data-thread-name]:text-is("${GROUP}")`)
          .count()) === 0;
      if (!gone) await page.waitForTimeout(800);
    }
    const back = await rpc(memberToken, "messenger_send", {
      p_thread: threadId,
      p_client_id: crypto.randomUUID(),
      p_body: "41-C arm, from member-test",
    });
    if (back.body && back.body.id) sent.push({ id: back.body.id, token: memberToken });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const returned =
      (await page
        .locator(`[data-testid="thread-list"] [data-thread-name]:text-is("${GROUP}")`)
        .count()) === 1;
    check(
      LIVE_CHECKS[10],
      gone && returned,
      `gone ${gone} returned ${returned} send ${back.status}`,
    );

    // 12. Search with a During bound.
    await page.fill('input[placeholder="Search messages"]', words.split(" ").pop());
    await page.click('[data-testid="search-filters"]');
    const today = await page.evaluate(() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    });
    await page.fill('input[data-search-date="during"]', today);
    await page.locator("[data-search-result]").first().waitFor({ timeout: 15000 });
    await page.locator("[data-search-result]").first().click();
    await page.waitForURL("**/messages/" + threadId, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const ringed = await page.evaluate(() =>
      [...document.querySelectorAll("[data-msg] [data-bubble]")].some(
        (b) => getComputedStyle(b).outlineStyle === "solid",
      ),
    );
    check(LIVE_CHECKS[11], ringed);

    // 14, 15. The media notice and an image.
    const seenBefore = settingsBefore.body && settingsBefore.body.media_notice_seen_at;
    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
      "base64",
    );
    await page
      .locator('input[type="file"][accept="image/*"]')
      .setInputFiles({ name: "arm.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await page.waitForTimeout(500);
    const noticeShown = (await page.locator("[data-media-notice]").count()) > 0;
    check(
      LIVE_CHECKS[13],
      noticeShown === !seenBefore,
      `seen ${seenBefore ? "yes" : "no"}; notice ${noticeShown}`,
    );
    if (noticeShown) await page.locator('[data-media-notice] button:has-text("OK")').click();
    await page.click('[data-testid="send"]');
    let img = 0;
    for (let i = 0; i < 10 && !img; i++) {
      await page.waitForTimeout(1500);
      img = await page.evaluate(
        () =>
          [...document.querySelectorAll('[data-msg][data-own="1"] img')].filter(
            (i) => i.src.startsWith("blob:") && i.naturalWidth > 0,
          ).length,
      );
    }
    check(LIVE_CHECKS[14], img > 0, "rendered images " + img);

    // 16. A voice note from the synthetic microphone, where the engine can record one at all: a
    // MediaRecorder for one of the composer's three mimes and createMediaStreamDestination for the
    // synthetic microphone. An engine without either cannot exercise the check (228).
    const recordable = await page.evaluate(() => {
      const AC = window.AudioContext || window.webkitAudioContext;
      return {
        recorder:
          typeof MediaRecorder !== "undefined" &&
          ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].some((m) =>
            MediaRecorder.isTypeSupported(m),
          ),
        destination: !!AC && typeof AC.prototype.createMediaStreamDestination === "function",
      };
    });
    if (!recordable.recorder || !recordable.destination) {
      skip(
        LIVE_CHECKS[15],
        `this engine cannot record a voice note: MediaRecorder for webm or mp4 audio ${recordable.recorder ? "present" : "absent"}, createMediaStreamDestination ${recordable.destination ? "present" : "absent"}`,
      );
    } else {
      await page.click('[data-testid="record"]');
      await page.waitForTimeout(2600);
      await page.click('[data-testid="record"]');
      await page.waitForTimeout(800);
      await page.click('[data-testid="send"]').catch(() => undefined);
      let player = 0;
      for (let i = 0; i < 10 && !player; i++) {
        await page.waitForTimeout(1500);
        player = await page.locator('[data-msg][data-own="1"] [data-voice-player]').count();
      }
      check(LIVE_CHECKS[15], player > 0, "players " + player);
    }

    // 17. Delete for everyone, the text message.
    await page.goto(BASE + "/messages/" + threadId, { waitUntil: "networkidle" });
    const m2 = page.locator(`[data-msg="${id}"]`);
    await m2.waitFor({ timeout: 15000 });
    await m2.hover();
    await m2.locator('button[aria-label="Message actions"]').click();
    await page.locator('[role="menuitem"]:has-text("Delete for everyone")').click();
    await page.waitForTimeout(1500);
    const delText = await page
      .locator(`[data-msg="${id}"]`)
      .textContent()
      .catch(() => "");
    check(LIVE_CHECKS[16], delText.includes("This message was deleted"), delText.slice(0, 80));

    const keys = await messengerStorage(page);
    check(
      LIVE_CHECKS[17],
      keys.length === 0 && errors.length === 0,
      keys.join(",") + " " + errors.slice(0, 2).join(" | "),
    );
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    rest("the flow ended before this check ran");
    // Put the thread back: every message this run sent, deleted for everyone by its author, and
    // the owner's own cursors and acts left as an ordinary read.
    if (ownerToken && threadId) {
      const own = await fetch(
        SUPABASE_URL +
          "/rest/v1/messenger_messages_view?select=message_id,deleted,own,body&thread_id=eq." +
          threadId +
          "&own=is.true&deleted=is.false",
        { headers: { apikey: KEY, Authorization: "Bearer " + ownerToken } },
      )
        .then((r) => r.json())
        .catch(() => []);
      for (const m of Array.isArray(own) ? own : [])
        await rpc(ownerToken, "messenger_delete", { p_message: m.message_id }).catch(
          () => undefined,
        );
      for (const s of sent)
        if (typeof s === "object")
          await rpc(s.token, "messenger_delete", { p_message: s.id }).catch(() => undefined);
      await rpc(ownerToken, "messenger_unarchive", { p_thread: threadId }).catch(() => undefined);
      await rpc(ownerToken, "messenger_mute", { p_thread: threadId }).catch(() => undefined);
    }
    if (browser) await browser.close().catch(() => undefined);
  }
}

/** The layout cells: SPEC 41-14's 360, 390, 820 and 1280, each in both themes. */
const LAYOUT_CELLS = [
  [360, 800],
  [390, 844],
  [820, 1180],
  [1280, 800],
];
/** The flow cells: compact on touch, expanded on pointer. */
const FLOW_CELLS = [
  [[390, 844], "light"],
  [[1280, 800], "dark"],
];

module.exports = {
  runMessengerLayout,
  runMessengerFlows,
  runMessengerReactions,
  runMessengerLive,
  LAYOUT_CELLS,
  FLOW_CELLS,
  LAYOUT_CHECKS,
  FLOW_CHECKS,
  REACT_CHECKS,
  LIVE_CHECKS,
  liveSignIn,
};
