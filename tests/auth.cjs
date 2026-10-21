// Brief 4B (rulings 230 to 236, 240): the auth surfaces in the browser. Points at BASE with the
// Supabase auth endpoints mocked at the network layer on top of the shared mock, so the real client
// code paths run against a backend whose answers this file controls. Backend behaviour that no
// browser can reach — identity linking across two providers (ruling 234) — lives in
// tests/auth-identity.cjs and is reported there.
// Usage: BASE=https://<preview>.dna-web-application.pages.dev SPECIAL=auth node tests/matrix.cjs
const M = require("./matrix.cjs");

const {
  launch,
  makeMockDb,
  seedPosts,
  mockSupabase,
  signIn,
  record,
  noOverflow,
  BASE,
  SB,
  JWT,
  UID,
} = M;

const RECOVERY_USER = {
  id: UID,
  aud: "authenticated",
  role: "authenticated",
  email: "member@test.invalid",
  user_metadata: { full_name: "Amara Osei" },
  app_metadata: { provider: "email" },
  created_at: new Date().toISOString(),
  // Handoff 61-S1: the Account drawer reads the sign-in methods off the user's identities, and a
  // member with an email identity has a password set, so /password opens "Change your password".
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
};
const RECOVERY_SESSION = {
  access_token: JWT,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "recovery-r",
  user: RECOVERY_USER,
};
/** A live recovery fragment, the shape GoTrue redirects with in the implicit flow. */
const RECOVERY_HASH =
  "#access_token=" +
  JWT +
  "&expires_in=3600&refresh_token=recovery-r&token_type=bearer&type=recovery";
const EXPIRED_HASH =
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

/**
 * Auth endpoints on top of the shared mock. Playwright matches the most recently registered route
 * first, so these win over mockSupabase's generic handler without editing it.
 */
async function mockAuth(page, auth) {
  await page.route(`**/${SB}/auth/v1/**`, async (route) => {
    try {
      await handleAuth(route, auth);
    } catch (e) {
      // Never let a handler failure escape as an uncaught rejection: that ends the process and the
      // run reports nothing at all rather than one failed check.
      console.log("AUTH MOCK ERROR", String(e).slice(0, 160));
      await route.abort().catch(() => undefined);
    }
  });
}

async function handleAuth(route, auth) {
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
  if (p === "/auth/v1/recover") {
    auth.recoverCalls.push({ body: req.postDataJSON(), at: Date.now() });
    if (auth.recoverDelay) await new Promise((r) => setTimeout(r, auth.recoverDelay));
    // The two answers a known and an unknown address could plausibly produce. Neither may reach
    // the surface (ruling 156 applied to auth).
    return auth.recoverFails
      ? json({ code: 400, error_code: "validation_failed", msg: "no such user" }, 400)
      : json({});
  }
  if (p === "/auth/v1/signup") {
    auth.signupCalls.push(req.postDataJSON());
    if (auth.signupWeak)
      return json(
        {
          code: 422,
          error_code: "weak_password",
          msg: "Password is known to be weak and easy to guess, please choose a different one.",
          weak_password: { reasons: ["pwned"] },
        },
        422,
      );
    // Confirm-email on: no session either way, and for an address that already exists GoTrue
    // returns an obfuscated user rather than an error.
    return json({ ...RECOVERY_USER, identities: auth.signupExisting ? [] : [{ id: "i1" }] });
  }
  if (p === "/auth/v1/token") {
    const body = req.postDataJSON() || {};
    auth.tokenCalls.push(body);
    if (auth.wrongCurrent && body.password === auth.wrongCurrent)
      return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login" }, 400);
    return json(RECOVERY_SESSION);
  }
  if (p === "/auth/v1/user" && method === "PUT") {
    auth.updateCalls.push(req.postDataJSON());
    if (auth.updateWeak)
      return json(
        {
          code: 422,
          error_code: "weak_password",
          msg: "Password is known to be weak and easy to guess, please choose a different one.",
          weak_password: { reasons: ["pwned"] },
        },
        422,
      );
    return json(RECOVERY_USER);
  }
  if (p === "/auth/v1/user") return json(RECOVERY_USER);
  if (p === "/auth/v1/logout") {
    auth.logoutScopes.push(url.searchParams.get("scope") || "global");
    return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  }
  if (p === "/auth/v1/authorize") {
    // The provider round trip, cancelled: the member closes the window and the provider sends
    // them back to redirect_to with an access_denied fragment. Served as a document that
    // redirects itself rather than a 302, because route.fulfill refuses a redirect status in
    // WebKit and the refusal escapes the handler as an uncaught exception.
    const back = url.searchParams.get("redirect_to") || BASE + "/sign-in";
    const to = back + "#error=access_denied&error_description=The+user+cancelled";
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: `<!doctype html><meta charset="utf-8"><title>provider</title><script>location.replace(${JSON.stringify(
        to,
      )})</script>`,
    });
  }
  return json({});
}

function makeAuth() {
  return {
    recoverCalls: [],
    signupCalls: [],
    tokenCalls: [],
    updateCalls: [],
    logoutScopes: [],
    recoverFails: false,
    recoverDelay: 0,
    signupExisting: false,
    signupWeak: false,
    updateWeak: false,
    wrongCurrent: null,
  };
}

/**
 * Wait for hydration before touching a control. Every auth route calls useTheme, which stamps
 * data-theme on the document element in an effect, so the attribute's arrival is the client taking
 * over from the server-rendered markup.
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

/**
 * Ruling 318: what the recovery arm was looking at when it gave up.
 *
 * The arm has failed only in WebKit, and in Chromium never: runs 113, 115 attempt 2, 116, 117 and
 * 119, at three viewport and theme pairs. Every one of those failures recorded nothing but the
 * selector it timed out on, which is why the cause is unestablished rather than merely unfixed.
 * Three different endings present as the same missing element: a stage that never left `form`
 * because the submit was rejected, a stage that flipped to `expired` because updateUser answered
 * with an error, and a submit whose promise never settled. This tells them apart when it next fires.
 *
 * It records; it does not rescue. The arm stays red (ruling 206).
 */
async function recoveryState(page, auth) {
  const state = { url: "unavailable", rendered: [], alert: "", busy: null };
  try {
    state.url = page.url();
    for (const id of ["reset-new", "reset-done", "reset-expired", "auth-alert", "compose"])
      if ((await page.locator(`[data-testid="${id}"]`).count()) > 0) state.rendered.push(id);
    if (state.rendered.includes("auth-alert"))
      state.alert = (await page.locator('[data-testid="auth-alert"]').innerText()).slice(0, 140);
    state.busy = await page
      .getAttribute('[data-testid="reset-new"]', "aria-busy")
      .catch(() => null);
  } catch (e) {
    // A dead web process cannot answer; ruling 316's flag on the record says which case this is.
    state.url = "state unavailable: " + String(e).slice(0, 140);
  }
  return (
    JSON.stringify(state) +
    ` | updateUser calls ${auth.updateCalls.length} | logout scopes ${JSON.stringify(auth.logoutScopes)}`
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
  const db = makeMockDb();
  seedPosts(db, 1);
  const auth = makeAuth();
  await page.addInitScript(
    ({ theme }) => {
      try {
        localStorage.setItem("dna.theme", theme);
      } catch {}
    },
    { theme },
  );
  await mockSupabase(page, db);
  await mockAuth(page, auth);
  return { browser, page, db, auth };
}

/** The reset "sent" state for one server answer, with the markup and the time it took to reveal. */
async function sentState(browserType, vp, theme, tune) {
  const { browser, page, auth } = await open(browserType, vp, theme);
  tune(auth);
  await page.goto(BASE + "/reset", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="reset-request"]');
  await hydrated(page);
  await page.fill('input[type="email"]', "same@test.invalid");
  // Handoff 37-F (G194): the interval is read in the page, from the form's submit event to the
  // sent state's insertion, on the page's own clock. Read from Node it carried the driver's round
  // trip and a fresh session's cold start, and on the macOS runner (1235) that added up to a
  // second to whichever of the two runs happened to be cold (1833 against 1066 ms, then 1320
  // against 2106), which the check read as a timed answer. What the check judges is what the
  // surface does between submit and reveal, and that is what this measures; the wall clock beside
  // it stays a record.
  await page.evaluate(() => {
    const t = { submitted: null, shown: null };
    window.__reveal = t;
    document.addEventListener("submit", () => (t.submitted ??= performance.now()), true);
    new MutationObserver((_, o) => {
      if (document.querySelector('[data-testid="check-email"]')) {
        t.shown = performance.now();
        o.disconnect();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  const started = Date.now();
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="check-email"]', { timeout: 15000 });
  const wall = Date.now() - started;
  const inPage = await page.evaluate(() => window.__reveal);
  const elapsed =
    inPage.submitted != null && inPage.shown != null
      ? Math.round(inPage.shown - inPage.submitted)
      : wall;
  const html = await page.locator('[data-testid="check-email"]').evaluate((el) => el.outerHTML);
  await browser.close();
  return { html, elapsed, wall, inPage: inPage.submitted != null, calls: auth.recoverCalls.length };
}

/**
 * The responsive half (ruling 61): every new surface rendered at every viewport and both themes,
 * with the additions in place and no horizontal overflow. One browser, four navigations, so it is
 * cheap enough to run across the whole matrix. The state flows live in runAuthFlows, which runs on
 * the two representative layouts the way tests/block.cjs and tests/vocabulary.cjs do.
 */
async function runAuthLayout(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-auth`;
  M.armStart(tag + " layout");
  {
    const { browser, page } = await open(browserType, [w, h], theme);
    try {
      await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('button[type="submit"]');
      await hydrated(page);
      const order = await page.evaluate(() => {
        const form = document.querySelector("form");
        const marks = [
          ['input[type="password"]', "password"],
          ['[data-testid="forgot-password"]', "forgot"],
          ['button[type="submit"]', "submit"],
          ['[role="separator"]', "separator"],
          ['[data-testid="provider-google"]', "google"],
          ['[data-testid="provider-linkedin_oidc"]', "linkedin"],
        ];
        const nodes = marks
          .map(([sel, name]) => [form.querySelector(sel), name])
          .filter(([el]) => el);
        const all = Array.from(form.querySelectorAll("*"));
        return nodes
          .sort((a, b) => all.indexOf(a[0]) - all.indexOf(b[0]))
          .map(([, name]) => name)
          .join(">");
      });
      record(
        tag + ": sign-in additions in DOM order after the Password field",
        order === "password>forgot>submit>separator>google>linkedin",
        order,
      );
      record(
        tag + ": the separator names itself",
        (await page.locator('[role="separator"][aria-label="Or"]').count()) === 1,
      );
      record(
        tag + ": provider marks are decorative and the label carries the name",
        (await page.locator('[data-testid="provider-google"] img[alt=""]').count()) === 1 &&
          (await page.locator('[data-testid="provider-google"]').innerText()).includes("Google"),
      );
      record(
        tag + ": the h1 names the surface",
        (await page.locator("h1").innerText()).trim() === "Sign in",
      );
      // Design pass 01, B8 item 2: the head is AuthHead and the logo has left the form, so the
      // form itself opens on Email and Password.
      const above = await page.evaluate(() => {
        const form = document.querySelector("form");
        return Array.from(form.querySelectorAll("img, input"))
          .map((el) => (el.tagName === "IMG" ? "logo" : el.getAttribute("type")))
          .join(">");
      });
      record(
        tag + ": the form opens on Email then Password, with no logo inside it",
        above.startsWith("email>password"),
        above,
      );
      // Ruling 491: the logo is 48 on compact and 56 above, top-aligned in a band whose height
      // never changes with content, and the column under it never centres vertically.
      const head = await page.evaluate(() => {
        const band = document.querySelector(".strand-auth-head > div");
        const img = band && band.querySelector("img");
        const col = document.querySelector(".strand-auth-col");
        const cs = band && getComputedStyle(band);
        return {
          band: band ? Math.round(band.getBoundingClientRect().height) : 0,
          logo: img ? Math.round(img.getBoundingClientRect().height) : 0,
          top: cs ? cs.paddingTop : "",
          centre: col ? col.getAttribute("data-centre") : "",
        };
      });
      const wide = w >= 640;
      record(
        tag + ": the auth head is a fixed band with the logo top-aligned at 48/56 (ruling 491)",
        head.band === (wide ? 100 : 84) &&
          head.logo === (wide ? 56 : 48) &&
          head.top === (wide ? "20px" : "16px"),
        JSON.stringify(head),
      );
      record(
        tag + ": an auth column holds the top and never centres vertically (ruling 487)",
        head.centre === "0",
        JSON.stringify(head),
      );
      // Ruling 392: the eye toggle is inside the field, says what the tap will do, and there is no
      // Show passwords checkbox anywhere.
      record(
        tag + ": the password field carries the in-field eye toggle (ruling 392)",
        (await page.locator('[data-testid="password-eye"][aria-pressed="false"]').count()) === 1 &&
          (await page.locator('[data-testid="password-eye"]').getAttribute("aria-label")) ===
            "Show password" &&
          (await page.getByText("Show passwords").count()) === 0,
      );
      await noOverflow(page, tag + ": sign-in");

      // The reset request surface.
      await page.goto(BASE + "/reset", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="reset-request"]');
      await hydrated(page);
      record(
        tag + ": /reset names itself",
        (await page.locator("h1").innerText()).trim() === "Reset your password",
      );
      await noOverflow(page, tag + ": reset request");

      // The reset landing in the state members actually hit.
      await page.goto(BASE + "/reset/new" + EXPIRED_HASH, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="reset-expired"]', { timeout: 15000 });
      await hydrated(page);
      await noOverflow(page, tag + ": reset landing expired");

      // The signed-in change-password surface, inside the shell. The shared signIn waits for the
      // shell to finish mounting; navigating on the bare waitForURL raced the shell's own
      // navigation in WebKit and lost the goto. Since handoff 61-S1 (finding 3) /password redirects
      // into the Account drawer's password level at /settings/security, the one password flow.
      await signIn(page);
      await page.goto(BASE + "/password", { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/settings/security**", { timeout: 15000 });
      await page.waitForSelector('[data-testid="password"]', { timeout: 15000 });
      await hydrated(page);
      // The form mounts before the drawer's enter finishes; the width is read once the Sheet has
      // settled, never mid-slide (webkit-macos run 17 read the panel 127 px past the viewport).
      await M.sheetSettled(page, 'dialog[data-sheet-scrim] section[role="dialog"]');
      record(
        tag + ": /password renders in the shell content column",
        (await page.locator("header").count()) > 0 &&
          (await page.locator("[data-drawer-title]").innerText()).trim() === "Change your password",
      );
      await noOverflow(page, tag + ": change password");
    } catch (e) {
      record(tag + ": layout pass completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }
}

/**
 * The state flows: the two identities the brief names, ruling 240's gate, and every error state.
 * Backend-shaped rather than layout-shaped, so they run on the two representative layouts.
 */
async function runAuthFlows(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-auth`;
  M.armStart(tag + " flows");

  // 2. The alert block takes focus, and the offending fields carry the border and nothing else.
  {
    const { browser, page } = await open(browserType, [w, h], theme);
    try {
      await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
      await hydrated(page);
      await page.fill('input[type="email"]', "not-an-address");
      await page.fill('input[type="password"]', "whatever-long-enough");
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="auth-alert"]');
      const focused = await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") === "auth-alert",
      );
      record(tag + ": the alert takes focus when it appears", focused);
      record(
        tag + ": the alert is the only place the message appears",
        (await page.getByText("Enter an email address, like name@example.com.").count()) === 1,
      );
      record(
        tag + ": the malformed address flags the Email field",
        (await page.locator('input[type="email"][aria-invalid="true"]').count()) === 1 &&
          (await page.locator('input[type="password"][aria-invalid="true"]').count()) === 0,
      );
    } catch (e) {
      record(tag + ": alert flow completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }

  // 3. Provider cancelled is a status line and moves no focus.
  {
    const { browser, page } = await open(browserType, [w, h], theme);
    try {
      await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
      await hydrated(page);
      await page.click('[data-testid="provider-google"]');
      await page.waitForSelector('[data-testid="auth-status"]', { timeout: 15000 });
      const text = await page.locator('[data-testid="auth-status"]').innerText();
      record(
        tag + ": provider cancelled renders as a status line",
        text.startsWith("You closed the Google window before finishing."),
        text.slice(0, 60),
      );
      record(
        tag + ": provider cancelled is not an alert and moves no focus",
        (await page.locator('[data-testid="auth-alert"]').count()) === 0 &&
          (await page.evaluate(
            () => document.activeElement?.getAttribute("data-testid") !== "auth-status",
          )),
      );
      await noOverflow(page, tag + ": provider cancelled");
    } catch (e) {
      record(tag + ": provider cancelled flow completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }

  // 4. The two reset "sent" states, byte-identical and revealed at the same moment. The address is
  //    the same in both runs; only the server's answer differs, so any difference in the markup or
  //    the timing would be a difference the surface derived from the answer.
  {
    try {
      const known = await sentState(browserType, [w, h], theme, () => {});
      const unknown = await sentState(browserType, [w, h], theme, (a) => {
        a.recoverFails = true;
        a.recoverDelay = 1500;
      });
      record(
        tag + ": the two reset sent states are byte-identical",
        known.html === unknown.html,
        known.html === unknown.html ? "" : "markup differs",
      );
      record(
        tag + ": both requests actually reached the server",
        known.calls === 1 && unknown.calls === 1,
        `${known.calls} / ${unknown.calls}`,
      );
      // The reveal is a fixed delay, so a 1500ms answer and an instant one land together. The
      // interval is the page's own (G194); the wall clock is printed beside it as a record.
      console.log(
        `REVEAL ${tag} known=${known.elapsed}ms (wall ${known.wall}ms, in-page ${known.inPage}) unknown=${unknown.elapsed}ms (wall ${unknown.wall}ms, in-page ${unknown.inPage})`,
      );
      record(
        tag + ": the reveal does not time the answer",
        Math.abs(known.elapsed - unknown.elapsed) < 600,
        `${known.elapsed}ms vs ${unknown.elapsed}ms in the page (wall ${known.wall}ms vs ${unknown.wall}ms)`,
      );
    } catch (e) {
      record(tag + ": reset sent parity flow completed", false, String(e).slice(0, 200));
    }
  }

  // 5. Ruling 240: a valid recovery token never reaches the Feed. It lands on the Site URL, which is
  //    the state the ruling was observed in, and the app still renders /reset/new.
  {
    const { browser, page, auth } = await open(browserType, [w, h], theme);
    try {
      await page.goto(BASE + "/" + RECOVERY_HASH, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="reset-new"]', { timeout: 15000 });
      await hydrated(page);
      record(
        tag + ": a recovery token on the Site URL renders /reset/new",
        new URL(page.url()).pathname.replace(/\/$/, "") === "/reset/new",
        page.url(),
      );
      record(
        tag + ": the Feed never rendered",
        (await page.locator('[data-testid="compose"]').count()) === 0,
      );
      // The gate holds: a signed-in recovery session cannot walk to the Feed.
      await page.goto(BASE + "/feed", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="reset-new"]', { timeout: 15000 });
      await hydrated(page);
      record(
        tag + ": the recovery session is held at /reset/new",
        new URL(page.url()).pathname.replace(/\/$/, "") === "/reset/new",
        page.url(),
      );

      await page.fill('input[autocomplete="new-password"] >> nth=0', "correct horse battery");
      await page.fill('input[autocomplete="new-password"] >> nth=1', "correct horse stapler");
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="auth-alert"]');
      record(
        tag + ": mismatched passwords flag Confirm and nothing else",
        (await page.locator('[data-testid="auth-alert"]').innerText()).startsWith(
          "The two passwords do not match.",
        ),
      );

      await page.fill('input[autocomplete="new-password"] >> nth=1', "correct horse battery");
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="reset-done"]', { timeout: 15000 });
      record(
        tag + ": setting the password signs out other devices",
        auth.logoutScopes.includes("others"),
        JSON.stringify(auth.logoutScopes),
      );
      record(
        tag + ": the success state says so",
        (await page.locator('[data-testid="reset-done"]').innerText()).includes(
          "Any other device signed in with the old password has been signed out.",
        ),
      );
      await page.click('[data-testid="continue-to-dna"]');
      await page.waitForSelector('[data-testid="compose"]', { timeout: 15000 });
      record(
        tag + ": Continue to DNA reaches the Feed once a password is set",
        new URL(page.url()).pathname === "/feed",
        page.url(),
      );
      await noOverflow(page, tag + ": reset landing");
    } catch (e) {
      // Ruling 318, and ruling 206: red, with enough recorded to classify the next firing.
      record(
        tag + ": recovery landing flow completed",
        false,
        String(e).slice(0, 400) + " | " + (await recoveryState(page, auth)),
      );
    }
    await browser.close();
  }

  // 6. The state members actually hit: a used or expired link.
  {
    const { browser, page } = await open(browserType, [w, h], theme);
    try {
      await page.goto(BASE + "/reset/new" + EXPIRED_HASH, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="reset-expired"]', { timeout: 15000 });
      await hydrated(page);
      const text = await page.locator('[data-testid="reset-expired"]').innerText();
      record(
        tag + ": an expired link says nothing changed",
        text.includes("This link no longer works") &&
          text.includes("Nothing about your account has changed."),
      );
      await page.click('[data-testid="request-new-link"]');
      await page.waitForSelector('[data-testid="reset-request"]', { timeout: 15000 });
      record(
        tag + ": Request a new link returns to /reset",
        new URL(page.url()).pathname === "/reset",
        page.url(),
      );
      await noOverflow(page, tag + ": expired link");
    } catch (e) {
      record(tag + ": expired link flow completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }

  // 7. Sign-up: the "Check your email" state is the same whether or not the address has an account.
  {
    const shots = [];
    for (const existing of [false, true]) {
      const { browser, page, auth } = await open(browserType, [w, h], theme);
      try {
        auth.signupExisting = existing;
        await page.goto(BASE + "/sign-in?join=1", { waitUntil: "domcontentloaded" });
        // Rulings 432 and 384: sign-up asks for the address and a password only. Name is
        // collected on onboarding screen one (307), so the form opens on the email address.
        await page.waitForSelector('input[autocomplete="email"]');
        await hydrated(page);
        await page.fill('input[type="email"]', "same@test.invalid");
        await page.fill('input[type="password"]', "correct horse battery");
        await page.click('button[type="submit"]');
        await page.waitForSelector('[data-testid="check-email"]', { timeout: 15000 });
        shots.push(
          await page.locator('[data-testid="check-email"]').evaluate((el) => el.outerHTML),
        );
      } catch (e) {
        record(tag + ": sign-up check-email flow completed", false, String(e).slice(0, 200));
      }
      await browser.close();
    }
    record(
      tag + ": the sign-up Check your email state is identical either way",
      shots.length === 2 && shots[0] === shots[1],
    );
  }

  // 8. Sign-up refuses a breached password by name (ruling 231).
  {
    const { browser, page, auth } = await open(browserType, [w, h], theme);
    try {
      auth.signupWeak = true;
      await page.goto(BASE + "/sign-in?join=1", { waitUntil: "domcontentloaded" });
      // Rulings 432, 384: no name field on sign-up.
      await page.waitForSelector('input[autocomplete="email"]');
      await hydrated(page);
      await page.fill('input[type="email"]', "same@test.invalid");
      await page.fill('input[type="password"]', "password123456");
      await page.click('button[type="submit"]');
      // Rulings 392, 414, 496 (B8 items 3 and 5): the refusal renders in the field's own line,
      // where the member is looking, and carries the pass's verbatim wording.
      await page.waitForSelector('[data-testid="password-refusal"]');
      record(
        tag + ": a breached password is named as one, in the field's own line",
        (await page.locator('[data-testid="password-refusal"]').innerText()).trim() ===
          "This password has appeared in a data breach. Choose another one.",
      );
      record(
        tag + ": a refused password does not reach Check your email",
        (await page.locator('[data-testid="check-email"]').count()) === 0,
      );
    } catch (e) {
      record(tag + ": breached password flow completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }

  // 9. /password, signed in and inside the shell. Since handoff 61-S1 (finding 3) it redirects into
  // the Account drawer's password level, the one password flow: the refusal renders in the field's
  // own line (414) and the done state is the S3 status line on Sign-in and security.
  {
    const { browser, page, auth } = await open(browserType, [w, h], theme);
    try {
      auth.wrongCurrent = "not-my-password";
      await signIn(page);
      await page.goto(BASE + "/password", { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/settings/security**", { timeout: 15000 });
      await page.waitForSelector('[data-testid="password"]', { timeout: 15000 });
      await hydrated(page);
      await M.sheetSettled(page, 'dialog[data-sheet-scrim] section[role="dialog"]');
      record(
        tag + ": /password renders inside the shell",
        (await page.locator("header").count()) > 0,
      );
      await page.fill('input[autocomplete="current-password"]', "not-my-password");
      await page.fill('input[autocomplete="new-password"] >> nth=0', "correct horse battery");
      await page.fill('input[autocomplete="new-password"] >> nth=1', "correct horse battery");
      await page.click('[data-testid="password-submit"]');
      await page.waitForSelector('[data-testid="password-refusal"]');
      record(
        tag + ": the wrong current password is named and only that field is flagged",
        (await page.locator('[data-testid="password-refusal"]').innerText()).startsWith(
          "That is not your current password.",
        ) &&
          (await page
            .locator('input[autocomplete="current-password"][aria-invalid="true"]')
            .count()) === 1 &&
          (await page.locator('input[aria-invalid="true"]').count()) === 1,
      );
      await page.fill('input[autocomplete="current-password"]', "my-real-password");
      await page.click('[data-testid="password-submit"]');
      await page.waitForSelector('[data-testid="password-changed"]', { timeout: 15000 });
      record(
        tag + ": changing the password signs out other devices",
        auth.logoutScopes.includes("others"),
        JSON.stringify(auth.logoutScopes),
      );
      record(
        tag + ": the member stays signed in here",
        (await page.locator('[data-testid="password-changed"]').innerText()).includes(
          "You stay signed in here.",
        ),
      );
      await noOverflow(page, tag + ": change password");
    } catch (e) {
      record(tag + ": change password flow completed", false, String(e).slice(0, 200));
    }
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Handoff 40-B section 6: the admin app at its own host, ADMIN_BASE, the dna-admin deployment this
// run uploaded. Three browser arms; the fourth, the bundles, is tests/admin-bundles.cjs. Arm 1 runs
// signed out against the deployment with nothing mocked, because a signed-out visit makes no
// request the arm needs to control. Arms 2 and 3 sign the two seeded accounts in for real
// (MEMBER_* and OWNER_*, the secrets the live job already holds) and read what the console renders
// from public.admin_session_state(): the refusal for member-test, which holds no role, and the
// enrolment or the code step for owner-test, which holds editor. The founder's aal2 path is a
// device check (61) and no arm. Without the host or the credentials each arm reports unproven (228).
// Usage: ADMIN_BASE=https://<id>.dna-admin.pages.dev SPECIAL=admin node tests/matrix.cjs

const ADMIN_BASE = (process.env.ADMIN_BASE || "").replace(/\/$/, "");
const ADMIN_H1 = "h1";

async function adminContext(browserType, [w, h], theme) {
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
  return { browser, page };
}

async function heading(page) {
  return (
    await page
      .locator(ADMIN_H1)
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
}

/** Arm 1: signed out, `/` and any other path land on the sign-in, with no sign-up and no provider. */
async function runAdminSignedOut(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-admin signed-out`;
  M.armStart(tag);
  if (!ADMIN_BASE) {
    M.unproven(tag, "ADMIN_BASE is not set, so there is no admin deployment to read");
    return;
  }
  const { browser, page } = await adminContext(browserType, [w, h], theme);
  try {
    for (const path of ["/", "/anything"]) {
      await page.goto(ADMIN_BASE + path, { waitUntil: "networkidle" });
      await hydrated(page);
      await page.waitForURL("**/sign-in", { timeout: 15000 }).catch(() => undefined);
      record(
        `${tag} | ${path} lands on the sign-in`,
        new URL(page.url()).pathname === "/sign-in",
        page.url(),
      );
    }
    record(`${tag} | the heading reads Admin`, (await heading(page)) === "Admin");
    record(
      `${tag} | no provider button`,
      (await page.locator('[data-testid^="provider-"]').count()) === 0,
    );
    const text = await page.locator("body").innerText();
    record(
      `${tag} | no sign-up`,
      !/Create an account|Create your account/.test(text),
      text.slice(0, 120),
    );
    // Ruling 1329: the line asks for an email to support, and the link is a mailto to the address
    // it shows with the subject set. The address is read off the page, never spelled here (387).
    const supportHref =
      (await page.getAttribute('[data-testid="admin-support-link"]', "href")) || "";
    const supportText = (
      (await page
        .locator('[data-testid="admin-support-link"]')
        .innerText()
        .catch(() => "")) || ""
    ).trim();
    record(
      `${tag} | the reset line asks for an email to support`,
      /Forgot your password\? Email \S+@\S+ and we will reset it\./.test(
        (
          await page
            .locator('[data-testid="admin-reset-line"]')
            .innerText()
            .catch(() => "")
        )
          .replace(/\s+/g, " ")
          .trim(),
      ),
    );
    record(
      `${tag} | the address is a mailto with the subject`,
      supportText.includes("@") &&
        supportHref === "mailto:" + supportText + "?subject=Admin%20password%20reset",
      supportHref,
    );
    await noOverflow(page, `${tag} |`);
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 200));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function adminSignIn(page, email, password) {
  await page.goto(ADMIN_BASE + "/sign-in", { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

/**
 * Arms 2 and 3: the two seeded accounts, for real. member-test holds no role and is refused with
 * a sentence and a sign-out; owner-test holds editor and at aal1 sees enrolment or the code step,
 * and the enrolment must produce a QR code, which is what proves TOTP is enabled on the project
 * (handoff section 3, item 6). Neither ever sees the shell.
 */
async function runAdminAccounts(browserType, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-admin accounts`;
  M.armStart(tag);
  const { MEMBER_EMAIL, MEMBER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
  if (!ADMIN_BASE) {
    M.unproven(tag, "ADMIN_BASE is not set, so there is no admin deployment to read");
    return;
  }
  if (!MEMBER_EMAIL || !MEMBER_PASSWORD || !OWNER_EMAIL || !OWNER_PASSWORD) {
    M.unproven(tag, "MEMBER_* and OWNER_* are not set, so no account can sign in");
    return;
  }
  const shellShown = async (page) =>
    (await page.locator('[data-testid="admin-shell"]').count()) > 0;

  // member-test: refused.
  {
    const { browser, page } = await adminContext(browserType, [w, h], theme);
    try {
      await adminSignIn(page, MEMBER_EMAIL, MEMBER_PASSWORD);
      await page.waitForSelector('[data-testid="admin-refusal"]', { timeout: 20000 });
      record(
        `${tag} | member-test reads No admin access`,
        (await heading(page)) === "No admin access",
      );
      record(
        `${tag} | the refusal line`,
        (await page.locator("body").innerText()).includes(
          "This account does not have access to the DNA admin console.",
        ),
      );
      record(`${tag} | member-test never sees the shell`, !(await shellShown(page)));
      await page.click('[data-testid="admin-sign-out"]');
      await page.waitForURL("**/sign-in", { timeout: 15000 }).catch(() => undefined);
      record(
        `${tag} | sign out returns to the sign-in`,
        new URL(page.url()).pathname === "/sign-in",
        page.url(),
      );
    } catch (e) {
      record(`${tag} member flow`, false, String(e).slice(0, 200));
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  // owner-test: a role at aal1, so the second step and never the shell.
  {
    const { browser, page } = await adminContext(browserType, [w, h], theme);
    try {
      await adminSignIn(page, OWNER_EMAIL, OWNER_PASSWORD);
      await page.waitForSelector('[data-testid="admin-enrol"], [data-testid="admin-code"]', {
        timeout: 20000,
      });
      const h1 = await heading(page);
      record(
        `${tag} | owner-test sees enrolment or the code step`,
        h1 === "Set up two-step sign-in" || h1 === "Two-step sign-in",
        h1,
      );
      record(`${tag} | owner-test never sees the shell`, !(await shellShown(page)));
      if (h1 === "Set up two-step sign-in") {
        // The QR code and the secret are what enrolment is; without them TOTP is off on the project.
        const qr = await page
          .waitForSelector('[data-testid="admin-qr"]', { timeout: 20000 })
          .then(() => true)
          .catch(() => false);
        const alert = await page
          .locator('[data-testid="auth-alert"]')
          .innerText()
          .catch(() => "");
        record(`${tag} | enrolment shows a QR code and the secret`, qr, alert.slice(0, 120));
      } else {
        record(
          `${tag} | the code step offers the Code field`,
          (await page.locator('input[autocomplete="one-time-code"]').count()) === 1,
        );
      }
    } catch (e) {
      record(`${tag} owner flow`, false, String(e).slice(0, 200));
    } finally {
      // The session lives in this context's storage and goes with it; no sign-out control exists on
      // the second step, by the copy table.
      await browser.close().catch(() => undefined);
    }
  }
}

module.exports = { runAuthLayout, runAuthFlows, runAdminSignedOut, runAdminAccounts };
