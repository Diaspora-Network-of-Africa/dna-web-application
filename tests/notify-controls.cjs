// Handoff 60-NC: the notification panel's controls and the unsubscribe landing page on the deployed
// preview, with the Supabase surface mocked by tests/matrix.cjs so the real client paths run against
// the migrations' answers (SPEC-56-NOTIFICATION-CONTROLS section 10's checks, ruling 61's cells).
//
// runNotifyControls, every cell, both themes (three checks):
//   - with unread rows Mark all read is drawn, and with no category carrying copy the head draws no
//     email control (1553, today's deploy state);
//   - one press gives every row its read weight, removes the button and raises no toast (1556);
//   - no page errors.
// runNotifyFlows, at 390, 820 and 1280, both themes (nine checks): the failure line and its Try
//   again (1564); the email control, the view's heading focus and the rows with the shared default
//   or no pill (1560); a pill press writes and reads back; a failed save returns the previous mode,
//   "Did not save." where there was none (1571); Back and Close return focus (SPEC 5); a failed
//   vocabulary renders no label (1561); sign-in's next (1557); no page errors.
// runUnsubscribed, at 390, 820 and 1280, both themes (five checks): the three server states
//   signed out, Try again's second outcome, the signed-in link opening the panel, no page errors.
//
// Usage: BASE=https://<id>.dna-web-application.pages.dev SPECIAL=notify node tests/matrix.cjs
const M = require("./matrix.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record, shot } = M;

const ACTOR = {
  id: "c4000000-0000-4000-8000-000000000003",
  name: "Kwame Mensah",
  handle: "kwame-mensah",
};
const TOKEN = "a".repeat(64);

/** As tests/mount.cjs reads them (ruling 357): WebKit's refusal of a mocked fetch the page cancelled
 *  on navigation, the sandbox's and never the app's. The landing page arm leaves the Feed for
 *  /email/unsubscribed and back while the Feed's reads are in flight, and those end this way. */
const SB_RE = M.SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);

const row = (id, kind, minutes) => ({
  id,
  recipient_member_id: M.UID,
  kind,
  c_category: "connect",
  actor_kind: "member",
  actor_id: ACTOR.id,
  object_kind: kind === "connection_request" ? "connection_request" : "member",
  object_id: "obj-" + id,
  read_at: null,
  seen_at: null,
  created_at: new Date(Date.now() - minutes * 60e3).toISOString(),
});

/** Two unread rows the vocabulary renders, from one member the mock can name. */
function seedRows(db) {
  db.membersById[ACTOR.id] = { ...ACTOR };
  db.notifications.push(row("n-a", "connection_request", 2), row("n-b", "connection_accepted", 9));
}

/** Connect carries copy with one shared default; Convene carries copy whose kinds disagree. */
function seedCopy(db) {
  const v = db.notify.view;
  Object.assign(
    v.find((x) => x.c === "connect"),
    { has_copy: true, email_default: "off" },
  );
  Object.assign(
    v.find((x) => x.c === "convene"),
    { has_copy: true, email_default: null },
  );
}

async function open(browserType, [w, h], theme) {
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
  const errors = [];
  page.on("pageerror", (e) => {
    const text = String(e.message || e);
    if (!CANCELLED_MOCK_FETCH.test(text)) errors.push(text);
  });
  return { browser, page, errors };
}

const panel = (page) => page.locator('[role="dialog"][aria-label="Notifications"]');
const emailPanel = (page) => page.locator('[role="dialog"][aria-label="Email preferences"]');
const unreadCount = (page) => page.locator('[role="dialog"] [data-unread="1"]').count();
const focusedText = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    return (
      (a.getAttribute("data-testid") ? "#" + a.getAttribute("data-testid") + " " : "") +
      a.tagName.toLowerCase() +
      " " +
      (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)
    );
  });

async function openBell(page) {
  await page.click('[data-testid="bell"]');
  await panel(page).waitFor({ timeout: 10000 });
}

async function runNotifyControls(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} notify-controls`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 2);
  seedRows(db);
  await mockSupabase(page, db);
  try {
    await signIn(page);
    await openBell(page);
    const mark = page.locator('[data-testid="notifications-mark-all"]');
    await mark.waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    record(
      tag +
        ": with unread rows Mark all read is drawn, and with no category carrying copy there is no email control (1556, 1553)",
      (await mark.count()) === 1 &&
        (await unreadCount(page)) === 2 &&
        (await page.locator('[data-testid="notifications-email-control"]').count()) === 0,
      "unread " + (await unreadCount(page)),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-unread`);
    await mark.click();
    await mark.waitFor({ state: "detached", timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    record(
      tag +
        ": one press gives every row its read weight, removes the button and raises no toast (1556)",
      db.notify.markAll === 1 &&
        (await unreadCount(page)) === 0 &&
        (await mark.count()) === 0 &&
        (await page.locator('[role="dialog"] [data-unread-dot]').count()) === 0 &&
        (await page.getByText("These were not marked read.").count()) === 0 &&
        (await page.locator('[data-testid="toast"], [role="status"]:has-text("read")').count()) ===
          0,
      "calls " + db.notify.markAll + ", unread " + (await unreadCount(page)),
    );
    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
  } finally {
    await browser.close();
  }
}

async function runNotifyFlows(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} notify-flows`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 2);
  seedRows(db);
  await mockSupabase(page, db);
  try {
    await signIn(page);

    // 1564: the write fails, the rows keep their weight, the line offers Try again.
    db.notify.failMarkAll = true;
    await openBell(page);
    const mark = page.locator('[data-testid="notifications-mark-all"]');
    await mark.click();
    const line = page.locator('[data-testid="notifications-mark-failed"]');
    await line.waitFor({ timeout: 10000 });
    record(
      tag +
        ": a failed Mark all read keeps every row's weight and shows the line with Try again, and the head's button is not drawn (1564)",
      ((await line.innerText()) || "").includes("These were not marked read.") &&
        (await line.getByRole("button", { name: "Try again" }).count()) === 1 &&
        (await line.getAttribute("role")) === "alert" &&
        (await mark.count()) === 0 &&
        (await unreadCount(page)) === 2,
      "unread " + (await unreadCount(page)),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-mark-failed`);
    db.notify.failMarkAll = false;
    await line.getByRole("button", { name: "Try again" }).click();
    await line.waitFor({ state: "detached", timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const afterRetry = await focusedText(page);
    record(
      tag + ": Try again reads every row, the line goes, and focus is on the heading (SPEC 5)",
      (await line.count()) === 0 &&
        (await unreadCount(page)) === 0 &&
        afterRetry !== null &&
        /^h2 Notifications/.test(afterRetry),
      "focus " + JSON.stringify(afterRetry),
    );
    await page.keyboard.press("Escape");
    await panel(page).waitFor({ state: "detached", timeout: 10000 });

    // 1553, 1560: two categories carry copy; Connect's kinds share off, Convene's disagree.
    seedCopy(db);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="compose"]');
    await openBell(page);
    const control = page.locator('[data-testid="notifications-email-control"]');
    await control.waitFor({ timeout: 10000 });
    await control.click();
    const view = page.locator('[data-testid="notifications-email-view"]');
    await view.waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const rows = view.locator('[data-testid="notifications-email-row"]');
    const connectRow = view.locator('[data-c="connect"]');
    const conveneRow = view.locator('[data-c="convene"]');
    const checked = async (r) => r.locator('[role="radio"][aria-checked="true"]').allInnerTexts();
    const opened = await focusedText(page);
    record(
      tag +
        ": the email control opens the view on its heading, one row per category with copy, the shared default selected and no pill where the kinds disagree (1553, 1560)",
      (await emailPanel(page).count()) === 1 &&
        opened !== null &&
        /^h2 Email preferences/.test(opened) &&
        (await rows.count()) === 2 &&
        (await connectRow.locator('[role="radiogroup"]').getAttribute("aria-label")) ===
          "Connect email" &&
        JSON.stringify(await checked(connectRow)) === '["Off"]' &&
        JSON.stringify(await checked(conveneRow)) === "[]" &&
        JSON.stringify(await connectRow.locator('[role="radio"]').allInnerTexts()) ===
          '["Off","Right away","Daily digest"]',
      "focus " +
        JSON.stringify(opened) +
        ", rows " +
        (await rows.count()) +
        ", connect " +
        JSON.stringify(await checked(connectRow)) +
        ", convene " +
        JSON.stringify(await checked(conveneRow)),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-email`);

    // 1552: a pill press writes the row; the read answers it after a reload.
    await connectRow.getByRole("radio", { name: "Right away" }).click();
    await connectRow.getByText("Saved").waitFor({ timeout: 10000 });
    const wrote = db.notify.saves.slice();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="compose"]');
    await openBell(page);
    await page.locator('[data-testid="notifications-email-control"]').click();
    await view.waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    record(
      tag +
        ": a pill press saves through set_notification_preference and the read answers it after a reload (1552)",
      wrote.length === 1 &&
        wrote[0].p_c === "connect" &&
        wrote[0].p_channel === "email" &&
        wrote[0].p_mode === "immediate" &&
        JSON.stringify(await checked(connectRow)) === '["Right away"]',
      "writes " +
        JSON.stringify(wrote) +
        ", read back " +
        JSON.stringify(await checked(connectRow)),
    );

    // 1571: a failed save returns the row to its previous mode, or to none.
    db.notify.failSave = true;
    await conveneRow.getByRole("radio", { name: "Daily digest" }).click();
    await conveneRow.getByText("Did not save.").waitFor({ timeout: 10000 });
    await connectRow.getByRole("radio", { name: "Off" }).click();
    await connectRow.getByText("Did not save. Still Right away.").waitFor({ timeout: 10000 });
    record(
      tag +
        ': a failed save returns the previous mode and says "Did not save. Still Right away.", and a row with none says "Did not save." with no pill (1571)',
      JSON.stringify(await checked(connectRow)) === '["Right away"]' &&
        JSON.stringify(await checked(conveneRow)) === "[]" &&
        (await connectRow.locator('[role="alert"]').innerText()) ===
          "Did not save. Still Right away." &&
        (await conveneRow.locator('[role="alert"]').innerText()) === "Did not save.",
      "connect " +
        JSON.stringify(await checked(connectRow)) +
        ", convene " +
        JSON.stringify(await checked(conveneRow)),
    );
    db.notify.failSave = false;

    // SPEC 5: Back to the control; Close from the email view to the bell.
    await page.getByRole("button", { name: "Back to notifications" }).click();
    await page.waitForTimeout(300);
    const afterBack = await focusedText(page);
    await page.locator('[data-testid="notifications-email-control"]').click();
    await view.waitFor({ timeout: 10000 });
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await view.waitFor({ state: "detached", timeout: 10000 });
    await page.waitForTimeout(500);
    const afterClose = await focusedText(page);
    record(
      tag +
        ": Back returns focus to the Email preferences control and Close from the email view returns it to the bell (SPEC 5)",
      afterBack !== null &&
        /notifications-email-control/.test(afterBack) &&
        afterClose !== null &&
        /bell|Notifications/.test(afterClose),
      "back " + JSON.stringify(afterBack) + ", close " + JSON.stringify(afterClose),
    );

    // 1561: a vocabulary that answers nothing renders no label.
    db.notify.emptyEmailVocab = true;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="compose"]');
    await openBell(page);
    await page.locator('[data-testid="notifications-email-control"]').click();
    const failed = page.locator('[data-testid="notifications-email-failed"]');
    await failed.waitFor({ timeout: 10000 });
    const viewText = (await view.innerText()) || "";
    record(
      tag +
        ": with the email vocabularies empty the view says it did not load, offers Try again, and renders no label (1561, 194)",
      viewText.includes("Your email preferences did not load.") &&
        (await failed.getByRole("button", { name: "Try again" }).count()) === 1 &&
        (await view.locator('[role="radiogroup"]').count()) === 0 &&
        !/Connect|Convene|Off|Right away|Daily digest/.test(viewText),
      viewText.slice(0, 120),
    );
    db.notify.emptyEmailVocab = false;

    // 1557: sign-in's next maps one word to the email view and drops a URL.
    await page.goto(M.BASE + "/sign-in?next=email-preferences", { waitUntil: "networkidle" });
    await page.waitForURL((u) => u.pathname === "/feed", { timeout: 15000 });
    await view.waitFor({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const landed = { url: page.url(), view: await view.count() };
    await page.goto(M.BASE + "/sign-in?next=https%3A%2F%2Fexample.invalid", {
      waitUntil: "networkidle",
    });
    await page.waitForURL((u) => u.pathname === "/feed", { timeout: 15000 });
    await page.waitForTimeout(600);
    const elsewhere = {
      host: new URL(page.url()).host,
      dialogs: await page
        .locator(
          '[role="dialog"][aria-label="Email preferences"], [role="dialog"][aria-label="Notifications"]',
        )
        .count(),
    };
    record(
      tag +
        ": next=email-preferences lands on /feed with the email view open and the parameter cleared; a URL in next lands on /feed with no panel (1557)",
      landed.view === 1 &&
        !new URL(landed.url).searchParams.has("notifications") &&
        elsewhere.host === new URL(M.BASE).host &&
        elsewhere.dialogs === 0,
      JSON.stringify({ landed, elsewhere }),
    );

    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
  } finally {
    await browser.close();
  }
}

/** The one-click route answers `state` in turn; every request is kept. */
async function routeUnsubscribe(page, answers, seen) {
  await page.route("**/api/email/unsubscribe**", async (route) => {
    const req = route.request();
    seen.push({ method: req.method(), body: req.postData(), url: req.url() });
    const state = answers.length > 1 ? answers.shift() : answers[0];
    await route.fulfill({
      status: state === "refused" ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify({ state }),
    });
  });
}

async function runUnsubscribed(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} unsubscribed`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 2);
  await mockSupabase(page, db);
  const at = M.BASE + "/email/unsubscribed?token=" + TOKEN;
  const main = page.locator('[data-testid="unsubscribed"]');
  const h1 = page.locator("h1");
  try {
    // Signed out: done.
    const seen = [];
    const answers = ["done"];
    await routeUnsubscribe(page, answers, seen);
    await page.goto(at, { waitUntil: "networkidle" });
    await main.waitFor({ timeout: 15000 });
    const doneLink = main.getByRole("link");
    record(
      tag +
        ": signed out, done reads its heading and lead, and the link signs in to the email preferences (1557, 1567)",
      (await main.getAttribute("data-state")) === "done" &&
        ((await h1.innerText()) || "").trim() === "Email from DNA is off." &&
        (await page.getByText("Mail about your account and security still arrives.").count()) ===
          1 &&
        ((await doneLink.innerText()) || "").trim() === "Sign in to choose which emails you get" &&
        (await doneLink.getAttribute("href")) === "/sign-in?next=email-preferences" &&
        seen.length === 1 &&
        seen[0].method === "POST" &&
        seen[0].body === "List-Unsubscribe=One-Click" &&
        seen[0].url.endsWith("/api/email/unsubscribe?token=" + TOKEN),
      JSON.stringify(seen),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-done-out`);

    // Signed out: expired.
    answers.splice(0, answers.length, "expired");
    await page.goto(at, { waitUntil: "networkidle" });
    await main.waitFor({ timeout: 15000 });
    record(
      tag +
        ": signed out, a used or expired link says so and points at the preferences through sign-in",
      (await main.getAttribute("data-state")) === "expired" &&
        ((await h1.innerText()) || "").trim() === "This link no longer works." &&
        ((await main.getByRole("link").innerText()) || "").trim() ===
          "Sign in to open your email preferences",
    );

    // Signed out: refused, then Try again succeeds.
    answers.splice(0, answers.length, "refused", "done");
    await page.goto(at, { waitUntil: "networkidle" });
    await main.waitFor({ timeout: 15000 });
    const refused = {
      state: await main.getAttribute("data-state"),
      heading: ((await h1.innerText()) || "").trim(),
      line: ((await main.locator("p").innerText()) || "").replace(/\s+/g, " ").trim(),
    };
    await page.getByRole("button", { name: "Try again" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="unsubscribed"]')?.getAttribute("data-state") ===
        "done",
      null,
      { timeout: 10000 },
    );
    record(
      tag +
        ": refused says nothing changed with Try again and the sign-in line, and Try again's success renders done (SPEC 6.5)",
      refused.state === "refused" &&
        refused.heading === "Email could not be turned off." &&
        refused.line ===
          "Or sign in and choose Off for each part of DNA in your email preferences." &&
        (await main.getAttribute("data-state")) === "done",
      JSON.stringify(refused),
    );

    // Signed in: done, and the link opens the panel through the shell's parameter.
    answers.splice(0, answers.length, "done");
    await signIn(page);
    await page.goto(at, { waitUntil: "networkidle" });
    await main.waitFor({ timeout: 15000 });
    const inLink = main.getByRole("link");
    const inText = ((await inLink.innerText()) || "").trim();
    const href = await inLink.getAttribute("href");
    await shot(page, `${tag.replace(/ /g, "-")}-done-in`);
    await inLink.click();
    await page.waitForURL((u) => u.pathname === "/feed", { timeout: 15000 });
    await panel(page)
      .waitFor({ timeout: 10000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    record(
      tag +
        ": signed in, the link reads Choose which emails you get and opens the notification panel on /feed with the parameter cleared (SPEC 6.4)",
      inText === "Choose which emails you get" &&
        href === "/feed?notifications=email" &&
        (await panel(page).count()) === 1 &&
        (await page.locator('[data-testid="compose"]').count()) >= 1 &&
        !new URL(page.url()).searchParams.has("notifications"),
      JSON.stringify({ inText, href, url: page.url() }),
    );

    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
  } finally {
    await browser.close();
  }
}

/** The flows' cells: compact, medium and expanded (ruling 67's three frames). */
const FLOW_CELLS = [
  [390, 844],
  [820, 1180],
  [1280, 800],
];

module.exports = { runNotifyControls, runNotifyFlows, runUnsubscribed, FLOW_CELLS };

if (require.main === module) {
  console.log(
    "Run through tests/matrix.cjs: BASE=" + M.BASE + " SPECIAL=notify node tests/matrix.cjs",
  );
}
