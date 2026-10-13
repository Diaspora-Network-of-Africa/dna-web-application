// Handoff 41-B section 5 (rulings 1346, 1374; 1343; 228): the Messenger media routes on the deployed
// preview, driven through Playwright's request context against BASE with the two seeded accounts
// (ruling 218), for real. Nothing is mocked: the bearer comes from Supabase Auth, the thread is a
// community group the owner leads with member-test in it, the bytes go to R2 through POST
// /api/messages/media, come back through GET /api/messages/media/{id} with the Range the arm asks
// for, are refused signed out and to a member no message carries them to, and go when the message
// is deleted for everyone and DELETE removes the object.
//
// The thread is a group and never the pair's one_to_one, on purpose. The pair's thread needs a
// request and an accept between the two accounts (they are not connected on the project), and a
// committed request row is exactly what the 41-A live arms must not find: their openPair sends a
// fresh request inside a rolled-back transaction and is refused with request_exists while one
// stands. Run 473's live job showed that after this arm's first version left one. A group costs
// the pair nothing: created once by name, reused on every later run, member-test invited and
// accepted once, and no 41-A arm reads a group it did not create.
//
// What this leaves on the project: that one group thread, and per run two messages that end
// deleted for everyone (body null, media_id null) in it; every media row and every object is removed
// by the arm itself. The third-member refusal (a member outside the thread) is the live-db arm's,
// acted as the admin persona in SQL, because the runner holds credentials for two accounts and no
// third; here the 403 is the thread's other member asking for an object no message carries to them
// yet, which messenger_media_access refuses the same way.
//
// Handoff 41-D (1396) adds a .mov made by the runner's ffmpeg, uploaded, served and removed the same
// way; with no ffmpeg on the runner its two checks report UNPROVEN with that reason (228).
//
// Every check is named in CHECKS and emitted exactly once, in order, so the arm's count is fixed
// (ruling 317): a check the flow never reached is emitted UNPROVEN, and a run without the account
// secrets or without the binding emits every check UNPROVEN with the one reason, which is what a
// fork PR gets (228).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { request: pwRequest } = require("playwright");
const M = require("./matrix.cjs");

const { record, unproven, BASE } = M;

const src = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
const SUPABASE_URL =
  process.env.SUPABASE_URL || (src.match(/"(https:\/\/[a-z]+\.supabase\.co)"/) || [])[1];
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || (src.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];

const CHECKS = [
  "both test members sign in (ruling 218)",
  "the deployment carries the MESSAGE_MEDIA binding, and a body whose bytes disagree with the declared type is refused with bad_media (1374)",
  "a 1 KB JPEG uploads through the route and records one media row with its size (1346, 1374)",
  "the owner reads it back: 200, image/jpeg, nosniff, private no-store, inline, Accept-Ranges (1346)",
  "a Range request is served as 206 with Content-Range and the bytes asked for (1346)",
  "signed out, the object is refused with 401 (1346)",
  "the thread's other member, before a message carries it, is refused with 403 (1346, 1349)",
  "the thread's other member, once a message carries it, reads it: 200 (1346)",
  "a 1 KB WebM uploads as video/webm with its dimensions (1374)",
  "the WebM is served with video/webm and its full length (1346)",
  "DELETE of a row no delete-for-everyone has marked is refused with 409 (1343, F4)",
  "messenger_delete marks both rows and DELETE removes each object, answering removed (1343, F4)",
  "after the delete each GET answers 404 (F4)",
  "an H.264 .mov made by ffmpeg uploads through the route as video/quicktime with its dimensions (1396)",
  "the .mov is served as video/quicktime with its full length, and once a delete-for-everyone marks it DELETE removes it (1396, 1343)",
];

/**
 * Handoff 41-D (1396): a one-second 320x240 H.264 QuickTime file made by the runner's ffmpeg, the
 * container an iPhone or a desktop screen recording writes (ftyp brand 'qt  '). Null when ffmpeg is
 * not on the runner or cannot encode H.264, and the two .mov checks then report UNPROVEN with that
 * reason (228); the bytes are never stubbed.
 */
function movBytes() {
  const { spawnSync } = require("child_process");
  const os = require("os");
  const file = path.join(os.tmpdir(), "messenger-media-" + crypto.randomUUID() + ".mov");
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:rate=10",
      "-t",
      "1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-f",
      "mov",
      file,
    ],
    { encoding: "utf8" },
  );
  if (r.error || r.status !== 0) {
    return {
      bytes: null,
      why: r.error
        ? "ffmpeg is not on the runner (" + String(r.error.code || r.error.message) + ")"
        : "ffmpeg could not encode an H.264 .mov: " + String(r.stderr || "").slice(0, 160),
    };
  }
  try {
    return { bytes: fs.readFileSync(file), why: null };
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/** A 1 KB JPEG: SOI, APP0 JFIF, padding, EOI. The route sniffs the head; R2 stores the bytes. */
function jpegBytes() {
  const b = Buffer.alloc(1024, 0);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).copy(b);
  b[1022] = 0xff;
  b[1023] = 0xd9;
  return b;
}

/** A 1 KB WebM: the EBML header id, then padding. */
function webmBytes() {
  const b = Buffer.alloc(1024, 0);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f]).copy(b);
  return b;
}

async function runMessengerMedia(browserType, bname) {
  const tag = `${bname}-messenger-media`;
  M.armStart(tag);
  const emitted = new Set();
  const check = (label, ok, detail = "") => {
    if (!CHECKS.includes(label)) throw new Error("undeclared check: " + label);
    emitted.add(label);
    record(`${tag} | ${label}`, ok, detail);
  };
  const skipRest = (why) => {
    for (const label of CHECKS) {
      if (emitted.has(label)) continue;
      emitted.add(label);
      unproven(`${tag} | ${label}`, why);
    }
  };

  const { MEMBER_EMAIL, MEMBER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
  if (!MEMBER_EMAIL || !MEMBER_PASSWORD || !OWNER_EMAIL || !OWNER_PASSWORD) {
    skipRest("MEMBER_* and OWNER_* are not set, so no account can sign in");
    return;
  }
  if (!SUPABASE_URL || !KEY) {
    skipRest("the Supabase URL or publishable key could not be read from src/lib/supabase.ts");
    return;
  }

  const api = await pwRequest.newContext({ baseURL: BASE, ignoreHTTPSErrors: false });
  const signIn = async (email, password) => {
    const r = await api.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      headers: { apikey: KEY, "content-type": "application/json" },
      data: { email, password },
    });
    const body = await r.json().catch(() => null);
    return body && body.access_token
      ? { token: body.access_token, id: body.user && body.user.id }
      : null;
  };
  const rpc = async (token, fn, args) => {
    const r = await api.post(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      data: args,
    });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* a void function answers an empty body */
    }
    return { status: r.status(), body, text };
  };
  const rest = async (token, q) => {
    const r = await api.get(SUPABASE_URL + "/rest/v1/" + q, {
      headers: { apikey: KEY, Authorization: "Bearer " + token },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  const media = (token, method, pathname, opts = {}) =>
    api.fetch(BASE + pathname, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(opts.headers || {}),
      },
      ...(opts.data !== undefined ? { data: opts.data } : {}),
      maxRedirects: 0,
    });
  const errorWord = async (r) => {
    const body = await r.json().catch(() => null);
    return body && body.error ? body.error : null;
  };
  const describe = async (r) =>
    `${r.status()} ${(await r.text().catch(() => "")).slice(0, 160)} env=${r.headers()["x-dna-env-source"] || "-"}`;

  try {
    // 1. Both accounts, for real.
    const owner = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    const member = await signIn(MEMBER_EMAIL, MEMBER_PASSWORD);
    check(
      CHECKS[0],
      !!owner && !!member && !!owner.id && !!member.id,
      owner ? (member ? "" : "member sign-in failed") : "owner sign-in failed",
    );
    if (!owner || !member) {
      skipRest("sign-in did not return an access token");
      return;
    }

    // The group: the community group named GROUP that owner-test leads, read through
    // messenger_threads_view as the owner (role lead, state active, the oldest when more than one
    // exists), reused when present and created with member-test in it only when absent, so every
    // run leaves at most this one thread on the project. member-test accepts the invitation once;
    // a later run finds them active and the accept is refused as not_invited, which is the steady
    // state and not a failure.
    const GROUP = "41-B media arm";
    const openGroup = async () => {
      const mine = await rest(
        owner.token,
        "messenger_threads_view?select=thread_id,kind,name,role,state,created_at" +
          "&kind=eq.community_group&role=eq.lead&state=eq.active&name=eq." +
          encodeURIComponent(GROUP) +
          "&order=created_at.asc&limit=1",
      );
      let id = Array.isArray(mine.body) && mine.body.length ? mine.body[0].thread_id : null;
      if (!id) {
        const made = await rpc(owner.token, "messenger_thread_create_group", {
          p_name: GROUP,
          p_member_ids: [member.id],
        });
        id = made.status === 200 && typeof made.body === "string" ? made.body : null;
      }
      if (!id) return null;
      await rpc(member.token, "messenger_thread_invite_accept", { p_thread: id });
      return id;
    };
    const thread = await openGroup();
    if (!thread) {
      skipRest(
        "the arm's group thread could not be found or created through messenger_thread_create_group",
      );
      return;
    }

    // 2. The binding, read through a refusal: a declared JPEG whose bytes are not one. The route
    //    reads the binding before it sniffs, so a 503 here names a deployment with no binding and
    //    a 400 names one with it, and x-dna-env-source says which shape answered on this host.
    const probe = await media(
      owner.token,
      "POST",
      `/api/messages/media?thread=${thread}&client_id=${crypto.randomUUID()}&w=1&h=1`,
      { headers: { "content-type": "image/jpeg" }, data: Buffer.alloc(64, 0x41) },
    );
    const envSource = probe.headers()["x-dna-env-source"] || "-";
    if (probe.status() === 503 && (await errorWord(probe)) === "unavailable") {
      check(
        CHECKS[1],
        false,
        `the preview deployment has no MESSAGE_MEDIA binding (x-dna-env-source: ${envSource})`,
      );
      skipRest(
        `the preview deployment has no MESSAGE_MEDIA binding (x-dna-env-source: ${envSource})`,
      );
      return;
    }
    // Ruling 930: a record and not an assertion. record() prints no detail for a passing check, so
    // the shape the binding was read through on this host is printed here, where a reader can quote it.
    console.log(`ENV ${tag} | x-dna-env-source on ${BASE}: ${envSource} (probe ${probe.status()})`);
    check(
      CHECKS[1],
      probe.status() === 400 &&
        (await errorWord(probe)) === "bad_media" &&
        envSource !== "none" &&
        envSource !== "-",
      `binding read through ${envSource}; probe ${probe.status()}`,
    );

    // 3. The JPEG.
    const jpegClient = crypto.randomUUID();
    const up = await media(
      owner.token,
      "POST",
      `/api/messages/media?thread=${thread}&client_id=${jpegClient}&w=1&h=1`,
      { headers: { "content-type": "image/jpeg" }, data: jpegBytes() },
    );
    const upBody = await up.json().catch(() => null);
    const jpegId = upBody && upBody.media_id;
    if (up.status() === 503 && upBody && upBody.detail === "function_missing") {
      skipRest(
        "the 41-B migration (20261002150000) is not on the project yet: messenger_media_record is missing",
      );
      return;
    }
    check(
      CHECKS[2],
      up.status() === 200 &&
        !!jpegId &&
        upBody.mime === "image/jpeg" &&
        upBody.width === 1 &&
        upBody.height === 1 &&
        upBody.byte_size === 1024,
      await describe(up),
    );
    if (!jpegId) {
      skipRest("the JPEG upload did not answer a media id");
      return;
    }

    // 4. The owner reads it back.
    const got = await media(owner.token, "GET", `/api/messages/media/${jpegId}`);
    const gh = got.headers();
    const gotBytes = await got.body().catch(() => Buffer.alloc(0));
    check(
      CHECKS[3],
      got.status() === 200 &&
        (gh["content-type"] || "").startsWith("image/jpeg") &&
        gh["x-content-type-options"] === "nosniff" &&
        gh["cache-control"] === "private, no-store" &&
        gh["content-disposition"] === "inline" &&
        gh["accept-ranges"] === "bytes" &&
        gotBytes.length === 1024 &&
        gotBytes[0] === 0xff &&
        gotBytes[1023] === 0xd9,
      `${got.status()} type=${gh["content-type"]} nosniff=${gh["x-content-type-options"]} cache=${gh["cache-control"]} disp=${gh["content-disposition"]} ranges=${gh["accept-ranges"]} bytes=${gotBytes.length} env=${gh["x-dna-env-source"] || "-"}`,
    );

    // 5. A Range.
    const part = await media(owner.token, "GET", `/api/messages/media/${jpegId}`, {
      headers: { range: "bytes=100-199" },
    });
    const partBytes = await part.body().catch(() => Buffer.alloc(0));
    check(
      CHECKS[4],
      part.status() === 206 &&
        part.headers()["content-range"] === "bytes 100-199/1024" &&
        partBytes.length === 100,
      `${part.status()} content-range=${part.headers()["content-range"]} bytes=${partBytes.length}`,
    );

    // 6. Signed out.
    const anon = await media(null, "GET", `/api/messages/media/${jpegId}`);
    check(
      CHECKS[5],
      anon.status() === 401 && (await errorWord(anon)) === "not_signed_in",
      await describe(anon),
    );

    // 7. The other member, before any message carries it.
    const before = await media(member.token, "GET", `/api/messages/media/${jpegId}`);
    check(
      CHECKS[6],
      before.status() === 403 && (await errorWord(before)) === "not_a_member",
      await describe(before),
    );

    // 8. The message, then the other member reads it.
    const sentJpeg = await rpc(owner.token, "messenger_send", {
      p_thread: thread,
      p_client_id: jpegClient,
      p_body: null,
      p_kind: "media",
      p_reply_to: null,
      p_media: jpegId,
    });
    const jpegMessage = sentJpeg.status === 200 && sentJpeg.body ? sentJpeg.body.id : null;
    const after = await media(member.token, "GET", `/api/messages/media/${jpegId}`);
    check(
      CHECKS[7],
      !!jpegMessage &&
        after.status() === 200 &&
        (after.headers()["content-type"] || "").startsWith("image/jpeg"),
      `send ${sentJpeg.status} ${jpegMessage ? "" : sentJpeg.text.slice(0, 120)}; get ${await describe(after)}`,
    );

    // 9. The WebM.
    const webmClient = crypto.randomUUID();
    const upWebm = await media(
      owner.token,
      "POST",
      `/api/messages/media?thread=${thread}&client_id=${webmClient}&w=16&h=9`,
      { headers: { "content-type": "video/webm" }, data: webmBytes() },
    );
    const webmBody = await upWebm.json().catch(() => null);
    const webmId = webmBody && webmBody.media_id;
    check(
      CHECKS[8],
      upWebm.status() === 200 &&
        !!webmId &&
        webmBody.mime === "video/webm" &&
        webmBody.width === 16 &&
        webmBody.height === 9 &&
        webmBody.byte_size === 1024,
      await describe(upWebm),
    );

    // 10. Served as video/webm.
    const gotWebm = webmId
      ? await media(owner.token, "GET", `/api/messages/media/${webmId}`)
      : null;
    const webmBytesBack = gotWebm
      ? await gotWebm.body().catch(() => Buffer.alloc(0))
      : Buffer.alloc(0);
    check(
      CHECKS[9],
      !!gotWebm &&
        gotWebm.status() === 200 &&
        (gotWebm.headers()["content-type"] || "").startsWith("video/webm") &&
        gotWebm.headers()["content-length"] === "1024" &&
        webmBytesBack.length === 1024,
      gotWebm ? await describe(gotWebm) : "no WebM id",
    );

    // 11. DELETE before any mark.
    const early = webmId
      ? await media(owner.token, "DELETE", `/api/messages/media/${webmId}`)
      : null;
    check(
      CHECKS[10],
      !!early && early.status() === 409 && (await errorWord(early)) === "bad_media",
      early ? await describe(early) : "no WebM id",
    );

    // 12. Mark and DELETE one row at a time: messenger_delete the JPEG, DELETE it, then the same
    //     for the WebM. Never both marks first: every DELETE sweeps up to twenty older marked rows
    //     (F4), so once the project's backlog is short the JPEG's sweep would take the WebM's row
    //     before the WebM's own DELETE asked for it, and that DELETE would read 404 (G280's drain
    //     did exactly that on run 589, `removed: 2` then `not_found`). A row the arm has not yet
    //     marked is one the sweep cannot reach.
    const sentWebm = webmId
      ? await rpc(owner.token, "messenger_send", {
          p_thread: thread,
          p_client_id: webmClient,
          p_body: null,
          p_kind: "media",
          p_reply_to: null,
          p_media: webmId,
        })
      : { status: 0, body: null, text: "no WebM id" };
    const webmMessage = sentWebm.status === 200 && sentWebm.body ? sentWebm.body.id : null;
    const delJpegMsg = jpegMessage
      ? await rpc(owner.token, "messenger_delete", { p_message: jpegMessage })
      : { status: 0, body: null, text: "no JPEG message" };
    const rmJpeg = await media(owner.token, "DELETE", `/api/messages/media/${jpegId}`);
    const rmJpegBody = await rmJpeg.json().catch(() => null);
    const delWebmMsg = webmMessage
      ? await rpc(owner.token, "messenger_delete", { p_message: webmMessage })
      : { status: 0, body: null, text: "no WebM message" };
    const rmWebm = webmId
      ? await media(owner.token, "DELETE", `/api/messages/media/${webmId}`)
      : null;
    const rmWebmBody = rmWebm ? await rmWebm.json().catch(() => null) : null;
    check(
      CHECKS[11],
      delJpegMsg.status === 200 &&
        delWebmMsg.status === 200 &&
        rmJpeg.status() === 200 &&
        !!rmJpegBody &&
        rmJpegBody.removed >= 1 &&
        !!rmWebm &&
        rmWebm.status() === 200 &&
        !!rmWebmBody &&
        rmWebmBody.removed >= 1,
      `messenger_delete ${delJpegMsg.status}/${delWebmMsg.status}; DELETE jpeg ${rmJpeg.status()} ${JSON.stringify(rmJpegBody)}; DELETE webm ${rmWebm ? rmWebm.status() : "-"} ${JSON.stringify(rmWebmBody)}`,
    );

    // 13. Gone.
    const goneJpeg = await media(owner.token, "GET", `/api/messages/media/${jpegId}`);
    const goneWebm = webmId
      ? await media(owner.token, "GET", `/api/messages/media/${webmId}`)
      : null;
    check(
      CHECKS[12],
      goneJpeg.status() === 404 && !!goneWebm && goneWebm.status() === 404,
      `jpeg ${await describe(goneJpeg)}; webm ${goneWebm ? await describe(goneWebm) : "-"}`,
    );

    // 14, 15. The .mov (handoff 41-D, 1396): uploaded, served back whole, then marked and removed.
    const mov = movBytes();
    if (!mov.bytes) {
      unproven(`${tag} | ${CHECKS[13]}`, mov.why);
      unproven(`${tag} | ${CHECKS[14]}`, mov.why);
      emitted.add(CHECKS[13]);
      emitted.add(CHECKS[14]);
    } else {
      const movClient = crypto.randomUUID();
      const upMov = await media(
        owner.token,
        "POST",
        `/api/messages/media?thread=${thread}&client_id=${movClient}&w=320&h=240`,
        { headers: { "content-type": "video/quicktime" }, data: mov.bytes },
      );
      const movBody = await upMov.json().catch(() => null);
      const movId = movBody && movBody.media_id;
      check(
        CHECKS[13],
        upMov.status() === 200 &&
          !!movId &&
          movBody.mime === "video/quicktime" &&
          movBody.width === 320 &&
          movBody.height === 240 &&
          movBody.byte_size === mov.bytes.length,
        `${mov.bytes.length} bytes; ${await describe(upMov)}`,
      );
      const gotMov = movId ? await media(owner.token, "GET", `/api/messages/media/${movId}`) : null;
      const movBack = gotMov ? await gotMov.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
      const sentMov = movId
        ? await rpc(owner.token, "messenger_send", {
            p_thread: thread,
            p_client_id: movClient,
            p_body: null,
            p_kind: "media",
            p_reply_to: null,
            p_media: movId,
          })
        : { status: 0, body: null, text: "no .mov id" };
      const movMessage = sentMov.status === 200 && sentMov.body ? sentMov.body.id : null;
      const delMovMsg = movMessage
        ? await rpc(owner.token, "messenger_delete", { p_message: movMessage })
        : { status: 0, body: null, text: "no .mov message" };
      const rmMov = movId
        ? await media(owner.token, "DELETE", `/api/messages/media/${movId}`)
        : null;
      const rmMovBody = rmMov ? await rmMov.json().catch(() => null) : null;
      check(
        CHECKS[14],
        !!gotMov &&
          gotMov.status() === 200 &&
          (gotMov.headers()["content-type"] || "").startsWith("video/quicktime") &&
          movBack.length === mov.bytes.length &&
          Buffer.compare(movBack, mov.bytes) === 0 &&
          delMovMsg.status === 200 &&
          !!rmMov &&
          rmMov.status() === 200 &&
          !!rmMovBody &&
          rmMovBody.removed >= 1,
        `get ${gotMov ? await describe(gotMov) : "-"}; send ${sentMov.status}; messenger_delete ${delMovMsg.status}; DELETE ${rmMov ? rmMov.status() : "-"} ${JSON.stringify(rmMovBody)}`,
      );
    }
  } catch (e) {
    record(`${tag} flow`, false, String(e).slice(0, 600));
    skipRest("the flow threw before this check ran");
  } finally {
    skipRest("the flow ended before this check ran");
    await api.dispose().catch(() => undefined);
  }
}

module.exports = { runMessengerMedia, CHECKS };
