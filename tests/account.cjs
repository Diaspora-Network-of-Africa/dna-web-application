// Handoff 61-S1 (Brief 60-S, EXTRACTION-60-SETTINGS; rulings 1656 to 1672, 1740, 1744, 1745): the
// Account drawer on the deployed preview, with the Supabase surface mocked by tests/matrix.cjs so
// the real client paths run against the shapes the migrations and Supabase Auth answer.
//
// runAccountDrawer, every cell, both themes (six checks):
//   - the avatar opens one drawer at /settings, the old panel's `account-panel` is gone, the title
//     takes focus, and the geometry is the bottom sheet at compact and the 380 drawer above it;
//   - a push row opens its panel at its route with the title focused, and Back returns to the root
//     with focus on the row that pushed (section 7; 480, 423);
//   - the Notifications row is absent while no category carries copy, and /settings/notifications
//     resolves to the root (1553, 1395);
//   - a link to a panel opens the drawer at that panel over the Feed, and Back goes to the root;
//   - Close returns to /feed with focus on the avatar;
//   - no page errors.
// runAccountFlows, at 390, 820 and 1280, both themes (fourteen checks): /password redirects into
//   the password level; a wrong current password and too short a password read B4B's lines and a
//   change signs the other devices out (230); with one method and no password Unlink is not offered
//   and the guard shows; no provider row offers Link (1744) and Unlink runs through its second level;
//   the devices read browser on device and a time, never an IP, and one and all others sign out;
//   the email change's states (A10, A14, A3, A4) with no Cancel (1745); a failed visibility save,
//   receipts save and skin tone save each return the previous value with its line (V4, M5, M6);
//   Link previews sits beside Read receipts; the theme writes the device's choice; Unblock removes
//   the row with no toast and no edge write (198, 211) and leaves the EmptyState; the Notifications
//   row and panel draw once a category carries copy (1552); no page errors.
//
// runAccountSessionGone, at the same three cells, both themes (four checks): ruling 1746, below.
//
// Usage: BASE=https://<id>.dna-web-application.pages.dev SPECIAL=account node tests/matrix.cjs
const M = require("./matrix.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record, shot } = M;

const FLOW_CELLS = [
  [390, 844],
  [820, 1180],
  [1280, 800],
];

const SB_RE = M.SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);

const GOOGLE = {
  identity_id: "i-google",
  id: "g-1",
  user_id: M.UID,
  provider: "google",
  identity_data: { email: "member@test.invalid", sub: "g-1" },
  created_at: "2026-09-01T00:00:00Z",
  last_sign_in_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

async function open(browserType, [w, h], theme) {
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
    // The devices' "Last active" reads in the member's zone; the fixture's instants are UTC.
    timezoneId: "UTC",
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

const title = (page) => page.locator("[data-drawer-title]");
const titleText = async (page) => ((await title(page).textContent()) || "").trim();
const pathOf = (page) => new URL(page.url()).pathname;
const focused = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    return {
      title: a.hasAttribute("data-drawer-title"),
      row: a.getAttribute("data-drawer-row"),
      opener: a.getAttribute("data-opener"),
      testid: a.getAttribute("data-testid"),
      label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40),
    };
  });
const waitTitle = (page, text) =>
  page.waitForFunction(
    (t) => {
      const el = document.querySelector("[data-drawer-title]");
      return !!el && (el.textContent || "").trim() === t;
    },
    text,
    { timeout: 10000 },
  );
const waitFocusTitle = (page) =>
  page
    .waitForFunction(
      () => !!document.activeElement && document.activeElement.hasAttribute("data-drawer-title"),
      null,
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);
const waitPath = (page, p) =>
  page.waitForFunction((x) => location.pathname === x, p, { timeout: 10000 });
const row = (page, id) => page.locator(`[data-drawer-row="${id}"]`);
const back = (page) => page.locator('[data-testid="account-back"]');

async function openDrawer(page) {
  await page.click('[data-testid="avatar"]');
  await waitPath(page, "/settings");
  await title(page).waitFor({ timeout: 10000 });
}

async function runAccountDrawer(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} account`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 2);
  await mockSupabase(page, db);
  try {
    await signIn(page);
    await openDrawer(page);
    const titleFocused = await waitFocusTitle(page);
    // The geometry is read once the enter transition has settled, never mid-slide (G281's lesson).
    await M.sheetSettled(page, 'dialog[data-sheet-scrim] section[role="dialog"]');
    const geo = await page.evaluate(() => {
      const panels = Array.from(
        document.querySelectorAll('dialog[data-sheet-scrim] section[role="dialog"]'),
      );
      const p = panels[0];
      const r = p ? p.getBoundingClientRect() : null;
      return {
        dialogs: panels.length,
        label: p ? p.getAttribute("aria-label") : null,
        width: r ? Math.round(r.width) : 0,
        height: r ? Math.round(r.height) : 0,
        right: r ? Math.round(innerWidth - r.right) : null,
        oldPanel: !!document.querySelector('[data-testid="account-panel"]'),
      };
    });
    const compact = w < 640;
    const geometry = compact
      ? Math.abs(geo.height - Math.round(h * 0.8)) <= 2 && geo.width === w
      : geo.width === 380 && geo.right === 0;
    record(
      tag +
        ": the avatar opens one Account drawer at /settings, the old panel is gone, the title takes focus, and it is the bottom sheet at compact and the 380 drawer above (1656, 584)",
      pathOf(page) === "/settings" &&
        geo.dialogs === 1 &&
        geo.label === "Account" &&
        !geo.oldPanel &&
        titleFocused &&
        (await titleText(page)) === "Account" &&
        geometry,
      JSON.stringify({ path: pathOf(page), geo, titleFocused }),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-root`);

    // A push lands on the panel's title; Back returns to the row that pushed (section 7).
    await row(page, "security").click();
    await waitPath(page, "/settings/security");
    await waitTitle(page, "Sign-in and security");
    const pushedFocus = await waitFocusTitle(page);
    const backLabel = await back(page).getAttribute("aria-label");
    await back(page).click();
    await waitPath(page, "/settings");
    await waitTitle(page, "Account");
    await page.waitForTimeout(150);
    const afterBack = await focused(page);
    record(
      tag +
        ": Sign-in and security pushes at its route with the title focused, Back to Account returns to the root with focus on the row (480, 423)",
      pushedFocus && backLabel === "Back to Account" && !!afterBack && afterBack.row === "security",
      JSON.stringify({ pushedFocus, backLabel, afterBack }),
    );

    // 1553: no category carries copy today, so there is no Notifications row and the route resolves
    // to the root.
    const notifRows = await row(page, "notifications").count();
    await page.goto(M.BASE + "/settings/notifications", { waitUntil: "domcontentloaded" });
    await waitPath(page, "/settings");
    await waitTitle(page, "Account");
    record(
      tag +
        ": the Notifications row is absent while no category has copy, and /settings/notifications resolves to the root (1553, 1395)",
      notifRows === 0 && pathOf(page) === "/settings",
      JSON.stringify({ notifRows, path: pathOf(page) }),
    );

    // A link to a panel opens the drawer at that panel over the Feed; Back goes to the root.
    await page.goto(M.BASE + "/settings/privacy", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Privacy");
    const feedUnder = (await page.locator('[data-scroller="feed"]').count()) > 0;
    await back(page).click();
    await waitPath(page, "/settings");
    await waitTitle(page, "Account");
    record(
      tag +
        ": a link to /settings/privacy opens the drawer at Privacy over the Feed, and Back goes to the root (addendum change 1)",
      feedUnder && pathOf(page) === "/settings",
      JSON.stringify({ feedUnder, path: pathOf(page) }),
    );

    // Close returns to /feed, with focus on the avatar (423).
    await page.click('[aria-label="Close"]');
    await waitPath(page, "/feed");
    await page.waitForTimeout(450);
    const closed = await focused(page);
    record(
      tag + ": Close returns to /feed, removes the dialog and returns focus to the avatar (423)",
      pathOf(page) === "/feed" &&
        (await page.locator('section[role="dialog"]').count()) === 0 &&
        !!closed &&
        closed.testid === "avatar",
      JSON.stringify({ path: pathOf(page), closed }),
    );
    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
  } finally {
    await browser.close();
  }
}

async function runAccountFlows(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} account-flows`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 2);
  await mockSupabase(page, db);
  const ac = db.account;
  const sheetError = () => page.locator("[data-sheet-error]");
  const text = async (sel) => ((await page.locator(sel).first().textContent()) || "").trim();
  try {
    await signIn(page);

    // 1. /password redirects into the password level (handoff finding 3; 230).
    await page.goto(M.BASE + "/password", { waitUntil: "domcontentloaded" });
    await waitPath(page, "/settings/security");
    await waitTitle(page, "Change your password");
    await page.locator('[data-testid="password"]').waitFor({ timeout: 10000 });
    record(
      tag + ": /password redirects to /settings/security with the password level open (230)",
      pathOf(page) === "/settings/security" &&
        !new URL(page.url()).searchParams.has("open") &&
        (await page.locator('[data-testid="password"]').count()) === 1,
      page.url(),
    );

    // 2. B4B's lines: a wrong current password, then too short (414).
    const cur = page.locator('input[autocomplete="current-password"]');
    const nw = page.locator('input[autocomplete="new-password"]').nth(0);
    const nw2 = page.locator('input[autocomplete="new-password"]').nth(1);
    // Section 7: the drawer moves focus to a pushed level's title on the frame after it renders.
    // A fill that starts before that frame lands can lose its text to the heading (H62-A2, run
    // 609: WebKit filled the new password into a title it had just focused, the field stayed
    // empty and the submit refused it as too short). So the fields are filled only once the
    // title holds focus, which is also what a member sees before they can type.
    await waitFocusTitle(page);
    ac.wrongCurrent = "not-the-current-one";
    await cur.fill("not-the-current-one");
    await nw.fill("lagos-clinic-solar-2026");
    await nw2.fill("lagos-clinic-solar-2026");
    await page.click('[data-testid="password-submit"]');
    await page
      .getByText("That is not your current password.", { exact: false })
      .waitFor({ timeout: 10000 });
    const wrongFlag = await cur.getAttribute("aria-invalid");
    await cur.fill("current-password-ok");
    await nw.fill("short");
    await nw2.fill("short");
    await page.click('[data-testid="password-submit"]');
    await page
      .getByText("Use at least ten characters for your password.")
      .waitFor({ timeout: 5000 });
    record(
      tag +
        ": the password level refuses a wrong current password and too short a password with B4B's lines (414)",
      wrongFlag === "true" &&
        (await page.getByText("Use at least ten characters for your password.").count()) === 1 &&
        (await nw.getAttribute("aria-invalid")) === "true" &&
        ac.updateCalls.filter((c) => c.password !== undefined).length === 0,
      JSON.stringify({ wrongFlag, updates: ac.updateCalls.length }),
    );

    // 3. The devices: browser on device and a time, never an IP; one signs out, then all others.
    // Read before the password change, which signs every other device out (230).
    await back(page).click();
    await waitTitle(page, "Sign-in and security");
    const devices = page.locator('[data-testid="device-row"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="device-row"]').length === 3,
      null,
      { timeout: 10000 },
    );
    const deviceText =
      (await page.locator('section[aria-label="Signed-in devices"]').innerText()) || "";
    ac.revokeFail = true;
    const phone = page.locator('[data-testid="device-row"][data-session="s-phone"]');
    await phone.getByRole("button", { name: "Sign out" }).click();
    await phone.getByText("That device was not signed out. Try again.").waitFor({ timeout: 5000 });
    ac.revokeFail = false;
    await phone.getByRole("button", { name: "Sign out" }).click();
    await phone.waitFor({ state: "detached", timeout: 10000 });
    await page.click('[data-testid="others-open"]');
    await waitTitle(page, "Sign out all other devices?");
    await page.click('[data-testid="others-confirm"]');
    await page.locator('[data-testid="devices-only-this"]').waitFor({ timeout: 10000 });
    record(
      tag +
        ": devices read browser on device with the last activity and no IP, one signs out after its refusal, and Sign out all other devices leaves only this one (S10 to S19)",
      /Safari on Mac\s+This device · Active now/.test(deviceText) &&
        deviceText.includes("Safari on iPhone") &&
        deviceText.includes("Last active Fri 9 Oct, 18:12") &&
        deviceText.includes("Last active Sun 4 Oct, 09:05") &&
        deviceText.includes("Firefox on Windows") &&
        !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(deviceText) &&
        ac.revokeCalls.filter((x) => x === "s-phone").length === 2 &&
        ac.logoutScopes.filter((x) => x === "others").length === 1 &&
        (await devices.count()) === 1,
      JSON.stringify({
        revokes: ac.revokeCalls,
        scopes: ac.logoutScopes,
        devices: deviceText.slice(0, 200),
      }),
    );

    // 4. A change: re-authentication, updateUser, then the other devices sign out (230).
    ac.wrongCurrent = null;
    await page.click('[data-testid="password-open"]');
    await waitTitle(page, "Change your password");
    await waitFocusTitle(page);
    await cur.fill("current-password-ok");
    await nw.fill("lagos-clinic-solar-2026");
    await nw2.fill("lagos-clinic-solar-2026");
    await page.click('[data-testid="password-submit"]');
    await page.locator('[data-testid="password-changed"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(150);
    const afterChange = await focused(page);
    record(
      tag +
        ": a change re-authenticates, writes the password, signs the other devices out and returns to the panel with S3 and focus on Change (230)",
      ac.updateCalls.some((c) => c.password === "lagos-clinic-solar-2026") &&
        ac.logoutScopes.includes("others") &&
        (await titleText(page)) === "Sign-in and security" &&
        (await text('[data-testid="password-changed"]')) ===
          "Your password is changed. You stay signed in here. Any other device signed in with the old password has been signed out." &&
        !!afterChange &&
        afterChange.opener === "password",
      JSON.stringify({ scopes: ac.logoutScopes, afterChange }),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-security`);

    // 5. The email change: A10, A14, then A3 with both addresses and A4; no Cancel (1745).
    await page.locator('[data-opener="email"]').click();
    await waitTitle(page, "Change your email address");
    await page.click('[data-testid="email-send"]');
    await page.getByText("Enter an email address.").waitFor({ timeout: 5000 });
    ac.updateFail = "email";
    await page.fill('input[type="email"]', "amara.osei@newplace.africa");
    await page.click('[data-testid="email-send"]');
    await sheetError().waitFor({ timeout: 10000 });
    const sendFailed = (await sheetError().textContent()) || "";
    ac.updateFail = null;
    await page.click('[data-testid="email-send"]');
    await page.locator('[data-testid="email-pending"]').waitFor({ timeout: 10000 });
    const pendingText = (await text('[data-testid="email-pending"] > span')).replace(/\s+/g, " ");
    await page
      .locator('[data-testid="email-pending"]')
      .getByRole("button", { name: "Resend" })
      .click();
    await page.getByText("Sent again").waitFor({ timeout: 5000 });
    record(
      tag +
        ": the email change refuses an empty address, names a failed send, then reads the pending line to both addresses with Resend and no Cancel (1668, 1745)",
      sendFailed.trim() === "That did not send. Try again." &&
        pendingText ===
          "A confirmation is on its way to member@test.invalid and to amara.osei@newplace.africa. Your email changes when you have opened both." &&
        (await page
          .locator('[data-testid="email-pending"]')
          .getByRole("button", { name: "Sent again" })
          .count()) === 1 &&
        ac.resendCalls === 1 &&
        (await page.getByText("Cancel the change").count()) === 0 &&
        (await titleText(page)) === "Sign-in and security",
      JSON.stringify({ sendFailed, pendingText, resend: ac.resendCalls }),
    );

    // 6. Google only: no Unlink, the guard, Set a password; no Link anywhere (1744).
    ac.identities = [GOOGLE];
    await page.goto(M.BASE + "/settings/security", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Sign-in and security");
    await page.locator('[data-testid="method-guard"]').waitFor({ timeout: 10000 });
    const methodsText =
      (await page.locator('section[aria-label="Sign-in methods"]').innerText()) || "";
    record(
      tag +
        ": with Google the only method, Unlink is not offered, A21 shows, the Password row reads Not set with Set a password, and no row offers Link (1744)",
      (await page.locator('[data-testid="unlink-open"]').count()) === 0 &&
        (await text('[data-testid="method-guard"]')) ===
          "Set a password or link another method before unlinking Google." &&
        /Password\s+Not set/.test(methodsText) &&
        (await page.getByRole("button", { name: "Set a password" }).count()) === 1 &&
        (await page.getByRole("button", { name: /^Link$/ }).count()) === 0 &&
        methodsText.includes("Linked as member@test.invalid"),
      methodsText.slice(0, 200),
    );

    // 7. Two methods: Unlink through its second level, Keep, a refusal, then the unlink.
    ac.identities = [db.account.identities[0], { ...GOOGLE }];
    ac.identities[0] = {
      identity_id: "i-email",
      id: M.UID,
      user_id: M.UID,
      provider: "email",
      identity_data: { email: "member@test.invalid", sub: M.UID },
      created_at: "2026-09-01T00:00:00Z",
      last_sign_in_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    };
    await page.goto(M.BASE + "/settings/security", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Sign-in and security");
    await page.locator('[data-testid="unlink-open"]').waitFor({ timeout: 10000 });
    await page.click('[data-testid="unlink-open"]');
    await waitTitle(page, "Unlink Google?");
    const unlinkLead = await text("[data-sheet-body] p");
    await page.getByRole("button", { name: "Keep" }).click();
    await waitTitle(page, "Sign-in and security");
    await page.waitForTimeout(150);
    const afterKeep = await focused(page);
    await page.click('[data-testid="unlink-open"]');
    await waitTitle(page, "Unlink Google?");
    ac.unlinkFail = true;
    await page.click('[data-testid="unlink-confirm"]');
    await sheetError().waitFor({ timeout: 10000 });
    const unlinkFailed = ((await sheetError().textContent()) || "").trim();
    ac.unlinkFail = false;
    await page.click('[data-testid="unlink-confirm"]');
    await waitTitle(page, "Sign-in and security");
    await page.waitForFunction(() => !document.querySelector('[data-method="google"]'), null, {
      timeout: 10000,
    });
    record(
      tag +
        ": Unlink pushes its second level, Keep returns to the control, a refusal names Google, and the unlink removes the row (A22 to A26)",
      unlinkLead ===
        "You will sign in with your password instead. You can link Google again any time." &&
        !!afterKeep &&
        afterKeep.opener === "unlink" &&
        unlinkFailed === "Google was not unlinked. Try again." &&
        ac.unlinkCalls.filter((x) => x === "i-google").length === 2 &&
        (await page.locator('[data-method="google"]').count()) === 0,
      JSON.stringify({ unlinkLead, afterKeep, unlinkFailed, calls: ac.unlinkCalls }),
    );

    // 8. Privacy: the rows, a failed audience save returns the row and its line (V4), then a save.
    await page.goto(M.BASE + "/settings/privacy", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Privacy");
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="visibility-row"]').length === 14,
      null,
      { timeout: 10000 },
    );
    const about = page.locator('[data-testid="visibility-row"][data-section="about"]');
    db.profile.failSection = "visibility";
    await about.locator("select").selectOption("connections");
    await about.getByText("Did not save. Still Everyone on DNA.").waitFor({ timeout: 10000 });
    const revertedValue = await about.locator("select").inputValue();
    db.profile.failSection = null;
    await about.locator("select").selectOption("connections");
    await about.getByText("Saved").waitFor({ timeout: 10000 });
    const rowTitles = await page
      .locator('[data-testid="visibility-row"] > div > span:first-child')
      .allInnerTexts();
    record(
      tag +
        ": Privacy lists the profile's fourteen sections, a failed audience save returns the row to Everyone on DNA with its line, and a save writes through save_profile_section (V2, V4; 141, 212)",
      rowTitles.join("|") ===
        "About|Returnee|Origin and heritage|Where I am|What I work on|Skills|Languages|What I am here for|Links|Convene|Collaborate|Contribute|Convey|Badges" &&
        revertedValue === "everyone" &&
        (await about.locator("select").inputValue()) === "connections" &&
        db.profile.saves.includes("visibility") &&
        db.profile.visibility.about === "connections",
      JSON.stringify({ rowTitles, revertedValue, saves: db.profile.saves }),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-privacy`);

    // 9. Read receipts and Link previews beside it (M1, M2, M5; 1672 item 12).
    // Switch's input is visually hidden, so the label is what is pressed and the input what is read.
    const receiptsLabel = page.locator('label:has-text("Read receipts")');
    const receipts = receiptsLabel.locator('input[role="switch"]');
    const previews = page.locator('label:has-text("Link previews") input[role="switch"]');
    await receiptsLabel.waitFor({ timeout: 10000 });
    await page.waitForFunction(
      () => {
        const i = document.querySelector('label:has(input[role="switch"]) input[role="switch"]');
        return !!i && !i.disabled;
      },
      null,
      { timeout: 10000 },
    );
    db.messenger.settingsFail = true;
    await receiptsLabel.click();
    await page.getByText("Did not save. Still Off.").waitFor({ timeout: 10000 });
    const receiptsReverted = await receipts.isChecked();
    db.messenger.settingsFail = false;
    await receiptsLabel.click();
    await page
      .locator('[data-testid="receipts-line"]')
      .getByText("Saved")
      .waitFor({ timeout: 10000 });
    record(
      tag +
        ": a failed Read receipts save returns the switch to Off with its line, a save turns it on, and Link previews sits beside it under Messaging (M5; 1672 item 12)",
      receiptsReverted === false &&
        (await receipts.isChecked()) === true &&
        db.messenger.settings.receipts_enabled === true &&
        (await previews.count()) === 1 &&
        (await text('section[aria-label="Messaging"] span')) === "Messaging" &&
        (await page
          .getByText("Show when you have read a message, and see when others have read yours.")
          .count()) === 1,
      JSON.stringify({ receiptsReverted, receipts: db.messenger.settings.receipts_enabled }),
    );

    // 10. Preferences: the theme on the device (1381, 1393) and the skin tone (1576, M6).
    await page.goto(M.BASE + "/settings/preferences", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Preferences");
    const themeGroup = page.getByRole("radiogroup", { name: "Theme" });
    await themeGroup.waitFor({ timeout: 10000 });
    const other = theme === "dark" ? "Light" : "Dark";
    await themeGroup.getByRole("radio", { name: other }).click();
    const switched = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-theme"),
      stored: localStorage.getItem("dna.theme"),
    }));
    await themeGroup.getByRole("radio", { name: "System" }).click();
    const system = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-theme"),
      stored: localStorage.getItem("dna.theme"),
    }));
    const tones = page.getByRole("radiogroup", { name: "Reaction skin tone" });
    await page.waitForFunction(
      () =>
        !document.querySelector(
          '[role="radiogroup"][aria-label="Reaction skin tone"][aria-disabled="true"]',
        ),
      null,
      { timeout: 10000 },
    );
    db.messenger.settingsFail = true;
    await tones.getByRole("radio", { name: "Medium", exact: true }).click();
    await page.getByText("Did not save. Still Not chosen.").waitFor({ timeout: 10000 });
    const toneReverted = await text('[data-testid="tone-name"]');
    db.messenger.settingsFail = false;
    await tones.getByRole("radio", { name: "Medium", exact: true }).click();
    await page.locator('[data-testid="tone-line"]').getByText("Saved").waitFor({ timeout: 10000 });
    record(
      tag +
        ": Theme writes the device's choice and System clears it to follow the device, and a failed skin tone save keeps Not chosen with its line before Medium saves through messenger_settings_set (1381, 1393, 1576, M6)",
      switched.attr === other.toLowerCase() &&
        switched.stored === other.toLowerCase() &&
        system.stored === null &&
        system.attr === theme &&
        toneReverted === "Not chosen" &&
        (await text('[data-testid="tone-name"]')) === "Medium" &&
        db.messenger.settings.reaction_skin_tone === "\u{1F3FD}",
      JSON.stringify({
        switched,
        system,
        toneReverted,
        tone: db.messenger.settings.reaction_skin_tone,
      }),
    );
    await shot(page, `${tag.replace(/ /g, "-")}-preferences`);

    // 11. Blocked members: B4A's sheet as the second level; no toast, no edge write (198, 211).
    await page.goto(M.BASE + "/settings/blocked", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Blocked members");
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="blocked-row"]').length === 2,
      null,
      { timeout: 10000 },
    );
    const firstRow = page.locator('[data-testid="blocked-row"]').first();
    const firstName = await firstRow.locator("span span span").first().innerText();
    await firstRow.locator('[data-testid="unblock-open"]').click();
    await waitTitle(page, "Unblock Yaa Mensah");
    const sheetText = (await page.locator('[data-testid="unblock-sheet"] p').allInnerTexts())
      .join(" ")
      .replace(/\s+/g, " ");
    const confirmLabel = await text('[data-testid="unblock-confirm"]');
    await page.click('[data-testid="unblock-cancel"]');
    await waitTitle(page, "Blocked members");
    await page.waitForTimeout(150);
    const afterCancel = await focused(page);
    await firstRow.locator('[data-testid="unblock-open"]').click();
    await waitTitle(page, "Unblock Yaa Mensah");
    ac.unblockFail = true;
    await page.click('[data-testid="unblock-confirm"]');
    await sheetError().waitFor({ timeout: 10000 });
    const unblockFailed = ((await sheetError().textContent()) || "").trim();
    ac.unblockFail = false;
    await page.click('[data-testid="unblock-confirm"]');
    await waitTitle(page, "Blocked members");
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="blocked-row"]').length === 1,
      null,
      { timeout: 10000 },
    );
    const toasts = await page
      .locator('[data-testid="toast"], [role="status"]:has-text("unblocked")')
      .count();
    record(
      tag +
        ": Unblock pushes B4A's sheet verbatim, Cancel returns to the row's control, a refusal names the member, and the unblock removes the row with no toast and no edge write (198, 211)",
      firstName === "Yaa Mensah" &&
        sheetText ===
          "Yaa can find you and reach you on DNA again, and sees your profile as any member does. Your connection and follow do not come back. They must be re-made. Yaa is not told." &&
        confirmLabel === "Unblock Yaa" &&
        !!afterCancel &&
        afterCancel.opener === "unblock-c4000000-0000-4000-8000-0000000000b1" &&
        unblockFailed === "Yaa was not unblocked. Try again." &&
        ac.unblockCalls.filter((x) => x === "c4000000-0000-4000-8000-0000000000b1").length === 2 &&
        toasts === 0 &&
        db.connect.writes.length === 0 &&
        db.profile.follows.length === 0,
      JSON.stringify({ firstName, sheetText, confirmLabel, afterCancel, unblockFailed, toasts }),
    );

    // 12. The last row goes and the EmptyState stands (B6).
    await page.locator('[data-testid="unblock-open"]').first().click();
    await waitTitle(page, "Unblock Kojo Asante");
    await page.click('[data-testid="unblock-confirm"]');
    await page.locator('[data-testid="blocked-empty"]').waitFor({ timeout: 10000 });
    record(
      tag + ": with no row left the panel is the EmptyState (B6)",
      (await page.getByText("No blocked members.").count()) === 1 &&
        (await page
          .getByText("Block a member from their profile and they appear here.")
          .count()) === 1,
    );
    await shot(page, `${tag.replace(/ /g, "-")}-blocked-empty`);

    // 13. Once a category carries copy, the Notifications row draws and its panel mounts 56-NC's
    // view (1552, 1553).
    Object.assign(
      db.notify.view.find((x) => x.c === "connect"),
      { has_copy: true, email_default: "off" },
    );
    await page.goto(M.BASE + "/settings", { waitUntil: "domcontentloaded" });
    await waitTitle(page, "Account");
    await row(page, "notifications").waitFor({ timeout: 10000 });
    await row(page, "notifications").click();
    await waitPath(page, "/settings/notifications");
    await waitTitle(page, "Notifications");
    await page
      .locator('[data-testid="notifications-email-row"]')
      .first()
      .waitFor({ timeout: 10000 });
    record(
      tag +
        ": with a category carrying copy the Notifications row draws and its panel mounts the email preferences view (1552, 1553)",
      (await page.locator('[data-testid="notifications-email-row"]').count()) === 1 &&
        (await page.locator('[data-testid="notifications-email-view"]').count()) === 1,
      String(await page.locator('[data-testid="notifications-email-row"]').count()),
    );
    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
    await shot(page, `${tag.replace(/ /g, "-")}-failed`).catch(() => undefined);
  } finally {
    await browser.close();
  }
}

// Ruling 1746 (D1848): a session revoked elsewhere signs this device out. The app asks /auth/v1/user
// on every page load and whenever the tab regains focus; the server's 403 session_not_found signs
// the page out locally and lands on /sign-in, and a failed network call does not (the negative
// control, 270). Four checks: on load, the network failure, on focus, no page errors.
async function runAccountSessionGone(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} account-session`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 1);
  await mockSupabase(page, db);
  const ac = db.account;
  const wake = () =>
    page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
  try {
    await signIn(page);

    // 1. On load: the server says the session is gone, the page lands on /sign-in.
    ac.sessionGone = true;
    await page.goto(M.BASE + "/feed", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/sign-in**", { timeout: 15000 });
    // The sign-in form is read once it has hydrated, not at the instant the URL changed.
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    const stored = await page.evaluate(() =>
      Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)),
    );
    record(
      tag +
        ": a 403 session_not_found from /auth/v1/user on load signs the device out and lands on /sign-in (1746)",
      pathOf(page) === "/sign-in" &&
        !stored &&
        (await page.locator('input[type="email"]').count()) === 1,
      JSON.stringify({ path: pathOf(page), stored }),
    );

    // 2. A failed network call is not a sign-out.
    ac.sessionGone = false;
    await signIn(page);
    ac.userFail = "network";
    await wake();
    await page.waitForTimeout(1200);
    record(
      tag + ": a network failure on the focus check signs nothing out (1746; 270)",
      pathOf(page) === "/feed" && (await page.locator('[data-testid="avatar"]').count()) === 1,
      pathOf(page),
    );

    // 3. On focus: the server's answer signs the device out.
    ac.userFail = null;
    ac.sessionGone = true;
    await wake();
    await page.waitForURL("**/sign-in**", { timeout: 15000 });
    record(
      tag +
        ": a 403 session_not_found when the tab regains focus signs the device out and lands on /sign-in (1746)",
      pathOf(page) === "/sign-in" && (await page.locator('[data-testid="avatar"]').count()) === 0,
      pathOf(page),
    );
    record(tag + ": no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    record(tag + ": flow completed", false, String(e && e.message ? e.message : e).slice(0, 300));
    await shot(page, `${tag.replace(/ /g, "-")}-failed`).catch(() => undefined);
  } finally {
    await browser.close();
  }
}

module.exports = { runAccountDrawer, runAccountFlows, runAccountSessionGone, FLOW_CELLS };
