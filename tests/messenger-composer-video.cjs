// Handoff 56-MOV item 3 (G224; rulings 930, 228, 317, 218): a QuickTime video through the Messenger
// composer's own file input on the deployment, with owner-test signed in for real in the browser.
// tests/messenger-media.cjs drives the routes through Playwright's request context and never touches
// the composer; this arm attaches the file where a member does, sends it, and asserts the effect: the
// upload reaches POST /api/messages/media with integer `w` and `h` equal to the fixture's own size,
// and the message renders in the log. A second check attaches a file over the byte ceiling and
// asserts the too_large state, not bad_media, with nothing sent to the route.
//
// The fixture is tests/fixtures/composer-video.mov, 8,997 bytes: two seconds of ffmpeg's testsrc at
// 320x124 (the founder's 2560x992 recording scaled by eight), H.264 Main, yuv420p, no audio, in a
// QuickTime container (ftyp brand 'qt  ', moov after mdat, as a screen recording writes it):
//   ffmpeg -f lavfi -i testsrc=size=320x124:rate=10 -t 2 -c:v libx264 -profile:v main \
//     -pix_fmt yuv420p -an -f mov composer-video.mov
//
// Playwright's WebKit is not Safari, and Playwright's Chromium carries no H.264 decoder: the arm
// proves the composer's path, never Safari. Before it attaches anything it asks the engine, in the
// page, for the fixture's size twice, once through a detached <video> and once through an attached
// one, and prints both as an ENV line (930: a record, not an assertion). An engine whose attached
// element cannot read the fixture cannot exercise the composer's send, and that check reports
// UNPROVEN with what the element returned (228); there the message is sent through the route the
// composer uses, so the reload check (1574: a received video is a <video>, and the thread answers)
// runs in every engine, as the too_large check does.
//
// What it leaves on the project: nothing. The message it sends is deleted for everyone and its object
// removed through DELETE /api/messages/media/{id}, in the "41-B media arm" group messenger-media.cjs
// keeps.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const M = require("./matrix.cjs");
const { liveSignIn } = require("./messenger.cjs");

const { launch, record, unproven, BASE } = M;

const src = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
const SUPABASE_URL = process.env.SUPABASE_URL || (src.match(/"(https:\/\/[a-z0-9.-]+)"/) || [])[1];
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || (src.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];
const GROUP = "41-B media arm";
const FIXTURE = path.join(__dirname, "fixtures/composer-video.mov");
const FIXTURE_W = 320;
const FIXTURE_H = 124;
/** src/lib/media.ts MESSAGE_MEDIA_MAX_BYTES, read from the source so the arm cannot drift from it. */
const MAX_BYTES = Number(
  (fs
    .readFileSync(path.join(__dirname, "../src/lib/media.ts"), "utf8")
    .match(/MESSAGE_MEDIA_MAX_BYTES = (\d+)/) || [])[1],
);

const CHECKS = [
  "owner-test signs in on the deployment and the 41-B group thread opens with its composer (218)",
  "a .mov attached through the thread's video input reaches POST /api/messages/media with integer w and h equal to the fixture's 320 by 124, and the route records it (H56-MOV, 930)",
  "after a fresh load of the thread, the message carrying it renders a <video> of its bytes, not an <img>, and the page answers within 15 s (1574, G250)",
  "a .mov over the byte ceiling takes the too_large state, not bad_media, and nothing reaches the route (H56-MOV item 2)",
];

async function runMessengerComposerVideo(browserType, bname) {
  const tag = `${bname}-messenger-composer-video`;
  M.armStart(tag);
  const emitted = new Set();
  const check = (label, ok, detail = "") => {
    if (!CHECKS.includes(label)) throw new Error("undeclared check: " + label);
    if (emitted.has(label)) return;
    emitted.add(label);
    record(`${tag} | ${label}`, !!ok, detail);
  };
  const skip = (label, why) => {
    if (emitted.has(label)) return;
    emitted.add(label);
    unproven(`${tag} | ${label}`, why);
  };
  const rest = (why) => {
    for (const label of CHECKS) skip(label, why);
  };

  const { OWNER_EMAIL, OWNER_PASSWORD } = process.env;
  if (!OWNER_EMAIL || !OWNER_PASSWORD) {
    rest("OWNER_* is not set, so no account can sign in");
    return;
  }
  if (!SUPABASE_URL || !KEY || !Number.isInteger(MAX_BYTES)) {
    rest("the Supabase URL, the publishable key or the byte ceiling could not be read from source");
    return;
  }

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
    return { status: r.status, text: await r.text() };
  };
  const rest_ = async (token, q) => {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + q, {
      headers: { apikey: KEY, Authorization: "Bearer " + token },
    });
    return r.json().catch(() => null);
  };

  let browser;
  let token = null;
  let messageId = null;
  let mediaId = null;
  const big = path.join(os.tmpdir(), "composer-over-" + crypto.randomUUID() + ".mov");
  try {
    const t = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const tb = await t.json().catch(() => null);
    token = tb && tb.access_token ? tb.access_token : null;
    const rows = token
      ? await rest_(
          token,
          "messenger_threads_view?select=thread_id&kind=eq.community_group&role=eq.lead&state=eq.active&name=eq." +
            encodeURIComponent(GROUP) +
            "&order=created_at.asc&limit=1",
        )
      : null;
    const threadId = Array.isArray(rows) && rows[0] ? rows[0].thread_id : null;
    if (!threadId) {
      rest(
        token
          ? "41-B's group thread was not found; tests/messenger-media.cjs creates it on its first run"
          : "owner-test's token was not issued",
      );
      return;
    }

    browser = await launch(browserType);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const posts = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/messages/media")
        posts.push(r);
    });
    await liveSignIn(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(BASE + "/messages/" + threadId, { waitUntil: "networkidle" });
    if ((await page.locator('[data-testid="receipts-sheet"]').count()) > 0) {
      await page.click('[data-testid="receipts-continue"]');
      await page.waitForTimeout(800);
    }
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 15000 });
    const videoInput = page.locator('input[type="file"][accept="video/*"]');
    check(
      CHECKS[0],
      (await videoInput.count()) === 1,
      "video inputs " + (await videoInput.count()),
    );

    // What this engine answers for the fixture, detached and attached, before the composer is asked.
    const fixture = fs.readFileSync(FIXTURE);
    const probe = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "video/quicktime" });
      const ask = (attach) =>
        new Promise((resolve) => {
          const url = URL.createObjectURL(blob);
          const v = document.createElement("video");
          v.preload = "metadata";
          v.muted = true;
          const done = (out) => {
            clearTimeout(timer);
            v.remove();
            URL.revokeObjectURL(url);
            resolve(out);
          };
          const timer = setTimeout(
            () =>
              done({
                event: "none in 15 s",
                readyState: v.readyState,
                networkState: v.networkState,
              }),
            15000,
          );
          v.onloadedmetadata = () =>
            done({ event: "loadedmetadata", width: v.videoWidth, height: v.videoHeight });
          v.onerror = () =>
            done({
              event: "error",
              code: v.error ? v.error.code : null,
              message: v.error ? v.error.message : null,
            });
          if (attach) {
            v.setAttribute("aria-hidden", "true");
            v.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
            document.body.appendChild(v);
          }
          v.src = url;
        });
      return {
        canPlayType: document.createElement("video").canPlayType("video/quicktime"),
        detached: await ask(false),
        attached: await ask(true),
      };
    }, fixture.toString("base64"));
    console.log(`ENV ${tag} | the fixture in this engine: ${JSON.stringify(probe)}`);

    const dismissNotice = async () => {
      await page.waitForTimeout(500);
      if ((await page.locator("[data-media-notice]").count()) > 0)
        await page.locator('[data-media-notice] button:has-text("OK")').click();
    };

    // 4. Over the ceiling, first, on the thread before this run sends anything into it: the
    // fixture's bytes, then zeros to one byte past it. First because run 526 (macOS WebKit) could not
    // reload the thread once it held the sent video message: the field never became visible in 15 s
    // and a screenshot timed out, which G250 records. The composer takes the too_large state at the
    // attach, before an object URL exists (G257: on runs 534 and 538 the draft's bytes in the
    // thumbnail's <img> and the measuring <video> held WebKit's main thread past a 30 s Send click),
    // so there is no Send to press: the draft stays empty, the refusal line is up, no measuring
    // element is mounted, and nothing is posted.
    fs.copyFileSync(FIXTURE, big);
    fs.truncateSync(big, MAX_BYTES + 1);
    const before = posts.length;
    await page.locator('input[type="file"][accept="video/*"]').setInputFiles(big);
    await dismissNotice();
    const overState = await page
      .waitForSelector("[data-messenger-thread][data-upload-refusal]", { timeout: 15000 })
      .then((el) => el.getAttribute("data-upload-refusal"))
      .catch(() => null);
    const shown = await page
      .locator("[data-upload-refused]")
      .isVisible()
      .catch(() => false);
    const overDraft = await page.evaluate(() => ({
      send: document.querySelectorAll('[data-testid="send"]').length,
      measure: document.querySelectorAll('[data-testid="video-measure"]').length,
      blobs: [...document.querySelectorAll("img, video")].filter((el) => el.src.startsWith("blob:"))
        .length,
    }));
    check(
      CHECKS[3],
      overState === "too_large" &&
        shown &&
        posts.length === before &&
        overDraft.send === 0 &&
        overDraft.measure === 0 &&
        overDraft.blobs === 0,
      `state ${overState}; line shown ${shown}; posts to the route ${posts.length - before}; ` +
        `draft after the attach ${JSON.stringify(overDraft)}`,
    );

    // A fresh load of the same thread, so the oversized draft is gone before the fixture is attached.
    await page.goto(BASE + "/messages/" + threadId, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="message-field"]', { timeout: 15000 });

    const a = probe.attached;
    if (a.event !== "loadedmetadata" || a.width !== FIXTURE_W || a.height !== FIXTURE_H) {
      const why = `this engine's attached <video> cannot read the fixture: ${JSON.stringify(a)}`;
      skip(CHECKS[1], why);
      // The composer cannot measure here, so the message check 3 reads is sent through the route the
      // composer uses, with the size the fixture carries and owner-test's bearer: a <video> element is
      // drawn whether or not this engine can decode the bytes, so 1574's rendering is still proven.
      const sentClient = crypto.randomUUID();
      const up = await fetch(
        `${BASE}/api/messages/media?thread=${threadId}&client_id=${sentClient}&w=${FIXTURE_W}&h=${FIXTURE_H}`,
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "content-type": "video/quicktime" },
          body: fixture,
        },
      );
      const upBody = await up.json().catch(() => null);
      mediaId = upBody && upBody.media_id ? upBody.media_id : null;
      if (mediaId)
        await rpc(token, "messenger_send", {
          p_thread: threadId,
          p_client_id: sentClient,
          p_body: null,
          p_kind: "media",
          p_reply_to: null,
          p_media: mediaId,
        });
      console.log(
        `ENV ${tag} | sent through the route for check 3: ${up.status} ${JSON.stringify(upBody)}`,
      );
    } else {
      // 2. Attach through the thread's own video input, send, read the request the route received.
      // What the input handed the composer, read in the capture phase before the thread's handler
      // clears the input, and every answer the route gave, are printed as records (930) so a refusal
      // names where it happened rather than only that it did.
      await page.evaluate(() => {
        document.addEventListener(
          "change",
          (e) => {
            const f = e.target && e.target.files && e.target.files[0];
            if (f) window.__h56File = { name: f.name, type: f.type, size: f.size };
          },
          true,
        );
      });
      const answers = [];
      page.on("response", (r) => {
        if (new URL(r.url()).pathname === "/api/messages/media")
          answers.push(r.request().method() + " " + r.status());
      });
      page.on("requestfailed", (r) => {
        if (new URL(r.url()).pathname === "/api/messages/media")
          answers.push("failed " + ((r.failure() && r.failure().errorText) || ""));
      });
      await videoInput.setInputFiles({
        name: "composer-video.mov",
        mimeType: "video/quicktime",
        buffer: fixture,
      });
      await dismissNotice();
      // The wait's rejection is handled the moment it is made (G257): on run 534 the Send click
      // took over 30 s to become actionable on macOS WebKit, so the timeout rejected while the click
      // was still pending, nothing had caught it, and Node killed the gate before the arms after this
      // one ran. A slow Send now records this check failed, with the composer's state and the
      // failstate screenshot, and the gate goes on (1237: a crash is never a pass, and never silent).
      const sentReq = page
        .waitForRequest(
          (r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/messages/media",
          { timeout: 30000 },
        )
        .catch(() => null);
      await page.click('[data-testid="send"]', { timeout: 30000 }).catch(() => undefined);
      const req = await sentReq;
      const res = req ? await req.response() : null;
      const body = res ? await res.json().catch(() => null) : null;
      mediaId = body && body.media_id ? body.media_id : null;
      const q = req ? new URL(req.url()).searchParams : new URLSearchParams();
      const w = q.get("w");
      const h = q.get("h");
      const refusal = await page
        .locator("[data-messenger-thread]")
        .first()
        .getAttribute("data-upload-refusal");
      const state = await page.evaluate(() => {
        const v = document.querySelector('[data-testid="video-measure"]');
        return {
          file: window.__h56File || null,
          measure: v
            ? {
                readyState: v.readyState,
                networkState: v.networkState,
                width: v.videoWidth,
                height: v.videoHeight,
                error: v.error ? { code: v.error.code, message: v.error.message } : null,
                blob: v.src.startsWith("blob:"),
              }
            : null,
        };
      });
      console.log(
        `ENV ${tag} | the composer at send: ${JSON.stringify({ ...state, refusal, answers })}`,
      );
      check(
        CHECKS[1],
        !!req &&
          /^\d+$/.test(w || "") &&
          /^\d+$/.test(h || "") &&
          Number(w) === FIXTURE_W &&
          Number(h) === FIXTURE_H &&
          (req.headers()["content-type"] || "") === "video/quicktime" &&
          !!res &&
          res.status() === 200 &&
          !!mediaId &&
          body.mime === "video/quicktime" &&
          body.width === FIXTURE_W &&
          body.height === FIXTURE_H,
        req
          ? `w=${w} h=${h} type=${req.headers()["content-type"]}; ${res ? res.status() : "-"} ${JSON.stringify(body)}`
          : `no request reached the route; refusal ${refusal}; ${JSON.stringify({ ...state, answers })}`,
      );
    }
    // 3. The message the route's object went out in, read after a fresh load of the thread, which
    // is the load run 526 could not complete while the message drew its video as an <img> (G250):
    // the field answers within the arm's own wait, and the message carries a <video> on an object
    // URL and no <img> (1574).
    for (let i = 0; i < 10 && mediaId && !messageId; i++) {
      const found = await rest_(
        token,
        "messenger_messages_view?select=message_id&thread_id=eq." +
          threadId +
          "&media_id=eq." +
          mediaId +
          "&limit=1",
      );
      messageId = Array.isArray(found) && found[0] ? found[0].message_id : null;
      if (!messageId) await page.waitForTimeout(1000);
    }
    let answered = false;
    let shape = null;
    if (messageId) {
      await page.goto(BASE + "/messages/" + threadId, { waitUntil: "domcontentloaded" });
      answered = await page
        .waitForSelector('[data-testid="message-field"]', { state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      await page
        .locator(`[data-msg="${messageId}"] video`)
        .first()
        .waitFor({ state: "attached", timeout: 15000 })
        .catch(() => undefined);
      shape = await page
        .evaluate((id) => {
          const m = document.querySelector(`[data-msg="${id}"]`);
          if (!m) return null;
          const v = m.querySelector("video");
          return {
            video: !!v,
            blob: !!v && v.src.startsWith("blob:"),
            controls: !!v && v.controls,
            img: m.querySelectorAll('img[src^="blob:"]').length,
          };
        }, messageId)
        .catch(() => null);
    }
    check(
      CHECKS[2],
      answered && !!shape && shape.video && shape.blob && shape.controls && shape.img === 0,
      messageId
        ? `message ${messageId}; field answered ${answered}; ${JSON.stringify(shape)}`
        : "no message carries it",
    );
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
  } finally {
    rest("the flow ended before this check ran");
    fs.rmSync(big, { force: true });
    // Leave nothing: the message deleted for everyone, then its object removed.
    if (token && messageId)
      await rpc(token, "messenger_delete", { p_message: messageId }).catch(() => undefined);
    if (token && mediaId)
      await fetch(BASE + "/api/messages/media/" + mediaId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      }).catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
}

module.exports = { runMessengerComposerVideo, CHECKS };
