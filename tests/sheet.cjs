// Handoff 37-B (ruling 1201), amended by 37-F (rulings 1236, 1240): every Sheet's enter and exit,
// read from the pixels the engine painted. The founder's two Safari recordings show each sheet
// opening with its panel moving away from its rest position and then snapping to it: the drawer's
// left edge runs from 640 to the window's left edge and jumps back, the bottom sheet rises past the
// window's top and drops. Chat reproduced it on the real `src/components/strand/Sheet.tsx` in
// Playwright's WebKit and Chromium, and found that `getBoundingClientRect`, `offsetLeft` plus the
// computed transform, and the painted pixels disagreed in both engines (37-B's Update, item 5), so
// an arm that reads geometry can pass while the screen is wrong. This arm reads the paint, on the
// deployed build, in both engines, and it was committed and read red before Sheet.tsx was touched.
//
// One arm per surface and cell. The composer is the drawer at 820, 1280 and 2560 and the bottom
// sheet at 390 and 430; Discovery's Filters and the event page's Share are the bottom sheet at 390
// and 430. Every arm paints an 8 px lime outline inside the panel's box so the panel is unambiguous
// in every frame, reads a 64 px band across the panel's path, and reads the panel's leading edge
// per frame as `real/measure.py` in Chat's harness reads it: the first column (drawer) or row
// (bottom sheet) on which more than half the band is lime. The axis is the panel's left edge for
// the drawer and its top edge for the bottom sheet. How the frames are obtained differs by engine,
// and every `SHEET` line names it as `method=`.
//
// WebKit: `method=stepped` (ruling 1236). The session installs Playwright's clock, clicks the
// trigger, waits for the panel's transform transition to exist, pauses it, and steps its
// `currentTime` from 0 to the transition's duration inclusive in 1000/60 ms steps, taking a
// lossless screenshot of the band at each step; the exit is Escape, read the same way, with the
// clock paused first so the `setTimeout(SHEET_DUR)` that unmounts the panel is held until the last
// step has been read, then run so the panel's detach is asserted. The clock is installed but not
// paused during the enter, because Sheet shows the panel after two animation frames and a paused
// clock would never deliver them; the CSS transition itself is driven by the engine's own timeline
// and by the paused animation's `currentTime`, which the fake clock does not touch. Screenshots
// are lossless, so the tolerance is 0.5 CSS px at device scale 1, the handoff's original value.
// The stepped series does not depend on the engine running an animation frame while the
// transition plays, which is what G155 could not get at 2560 by 1440, and it cannot deliver a frame
// out of order, which is what G154 and G160 read from WebKit's screencast: the reorder allowance
// those two carried is retired with this method (1240).
//
// Chromium: `method=video`, unchanged in method from 37-B. The session records the page as video
// (Playwright's own ffmpeg, 25 frames a second), drops a magenta marker on the click and a cyan one
// on the Escape so both instants are frame-exact, then decodes the band from the video. The
// tolerance is 2 video pixels, not 0.5: the video is VP8 with 4:2:0 chroma, so a colour edge is
// resolved to a 2 by 2 block and the lime edge of a panel at rest on y 168.8 reads 168 on one frame
// and 170 on the next, never 169. A 2560-wide cell is recorded at half size and its readings are
// scaled back, so its tolerance is four CSS pixels. A requestAnimationFrame sampler reads the
// panel's box and computed transform per frame beside the video, as a record only.
//
// The assertions are the same in meaning on both series. Rest is where the settled panel sits:
// the last painted enter frame on the video, the settled paint after the transition finished on
// the stepped series. Four on the enter: the painted edge is never on the wrong side of rest by
// more than the tolerance; it never moves away from rest between two frames; the last frame is at
// rest; and the first painted frame is not at rest, so the slide ran. The stepped series adds one:
// step 0 reads the panel wholly off its edge, so the series starts where the transition starts.
// Then Escape, with one assertion: the exit never crosses rest and never turns back toward it, and
// the panel is gone (the video: no lime; the stepped series: the last step off the edge and the
// panel detached once the held timers ran). Every series is printed for every arm, passing or
// failing (ruling 930: a record, not an assertion), as `SHEET <arm> <enter|exit> method=... `,
// because `record()` prints a detail only on failure. A failing Chromium arm's video is kept in
// the job's artefact under `sheet-video/`; a passing arm's is deleted.
//
// Usage: BASE=https://<preview>.dna-web-application.pages.dev SPECIAL=sheet node tests/matrix.cjs
// SHEET_METHOD=stepped|video overrides the engine's method. A harness probe, off by default, for
// reading the stepped mechanism on a machine that has no WebKit; it is never set by a workflow, and
// a Chromium arm run stepped emits one more check than it declares, which the accounting names.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const M = require("./matrix.cjs");
const { seedAttend } = require("./event.cjs");
const { __seedDiscovery: seedDiscovery } = require("./discovery.cjs");

const {
  launch,
  makeMockDb,
  seedPosts,
  mockSupabase,
  signIn,
  record,
  unproven,
  eventId,
  BASE,
  OUT,
  SB,
} = M;

/** 0.5 px, the handoff's tolerance: the stepped series' painted reading, and the video's geometry record. */
const TOL = 0.5;
/** One 4:2:0 chroma block, the video's own resolution for a colour edge, on the video's painted reading. */
const PAINT_TOL = 2;
/** The stepped series' step, one frame at 60 Hz. */
const STEP_MS = 1000 / 60;
/** How long the sampler keeps reading after the panel first appears, or after it leaves. */
const SAMPLE_MS = 700;
/** The sampler's hard stop, in case the panel never appears or never leaves. */
const SAMPLE_CAP_MS = 4000;
/** The video's widest frame; a wider viewport is recorded at half size and scaled back. */
const VIDEO_MAX_W = 1280;
/** The band the decoder reads across the panel's path, in video pixels. */
const BAND = 64;
/** The lime outline painted inside the panel's box, in CSS pixels. */
const OUTLINE = 8;
/** Sheet's transition, SHEET_DUR in src/components/strand/Sheet.tsx. */
const SHEET_DUR = 300;
/** Where the failing arms' videos are kept, under OUT so the job's artefact carries them. */
const VIDEO_DIR = path.join(OUT, "sheet-video");

/** The composer's drawer widths and its bottom-sheet widths; Filters and Share are bottom sheets. */
const DRAWER_CELLS = [
  [[820, 1180], "light"],
  [[1280, 800], "dark"],
  [[2560, 1440], "light"],
];
const BOTTOM_CELLS = [
  [[390, 844], "light"],
  [[430, 932], "dark"],
];

const SB_RE = SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);
/** As tests/mount.cjs reads them: the sandbox's refusals, never the app's. */
const IGNORED_CONSOLE = new RegExp(
  [
    "fonts\\.g",
    "ERR_CONNECTION_RESET",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_FAILED",
    "\\b(?:400|406|500)\\b",
    CANCELLED_MOCK_FETCH.source,
  ].join("|"),
);

/**
 * Ruling 1236: how an engine's frames are obtained. WebKit steps the transition's clock and
 * screenshots each step; Chromium keeps its video. SHEET_METHOD is the probe override named in the
 * header and is read nowhere else.
 */
function methodOf(engine) {
  const forced = process.env.SHEET_METHOD;
  if (forced === "stepped" || forced === "video") return forced;
  return engine === "webkit" ? "stepped" : "video";
}

/** Every session `context()` opens, in order: `arm()` closes and reads the ones its arm opened even
 *  when the arm's own gate throws before it can hand its session back. */
const opened = [];

async function context(browserType, [w, h], theme, db, tag, plain = false) {
  const browser = await launch(browserType);
  // `plain`: an arm that reads no frames (1484's focus arm) records no video and holds no clock.
  const method = plain ? "plain" : methodOf(tag.split("-")[0]);
  // On the video method the video is the measurement (37-B's revised Stage 1), recorded at the
  // viewport's own size up to VIDEO_MAX_W and at half size past it. The stepped method screenshots
  // at device scale 1, so its readings are CSS pixels and its scale is 1.
  const scale = method === "video" && w > VIDEO_MAX_W ? 2 : 1;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w <= 1024,
    isMobile: w < 1024,
    deviceScaleFactor: 1,
    colorScheme: theme,
    ...(method === "video"
      ? {
          recordVideo: {
            dir: path.join(VIDEO_DIR, tag),
            size: { width: w / scale, height: h / scale },
          },
        }
      : {}),
  });
  const page = await ctx.newPage();
  // Ruling 1236: the clock is installed before the first navigation, running, so the page loads
  // and the enter's two animation frames run as they would; `readSheetStepped` pauses it only for
  // the exit, to hold Sheet's unmount timer while the exit's steps are read.
  if (method === "stepped") await page.clock.install();
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
    const text = String(e);
    if (!CANCELLED_MOCK_FETCH.test(text)) errors.push(text);
  });
  // Handoff 35-C (1191, G147): a console error names its request. The URL comes first so the arms'
  // slice(0, 300) cannot cut it off; where the engine gives the message no location, the last
  // response of 400 or above stands in, marked unconfirmed since it can be a different request
  // from the one that raised the message. The response listener records and never fails an arm.
  const failedResponses = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.request().method()} ${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_CONSOLE.test(m.text()))
      errors.push(
        `${m.location().url || (failedResponses.length ? "(last failed response, unconfirmed) " + failedResponses.at(-1) : "(no url)")} ${m.text()}`,
      );
  });
  const session = { browser, ctx, page, errors, scale, w, h, method };
  opened.push(session);
  return session;
}

async function arm(tag, open, body) {
  M.armStart(tag);
  const from = opened.length;
  try {
    await body(await open());
  } catch (e) {
    record(tag + " flow", false, String(e).slice(0, 400));
  } finally {
    const mine = opened.splice(from);
    const errors = mine.length
      ? [...new Set(mine.flatMap((x) => x.errors))]
      : ["the page never opened"];
    record(
      tag + " no page errors",
      errors.length === 0,
      errors.slice(0, 3).join(" | ").slice(0, 300),
    );
    for (const x of mine) await x.browser.close().catch(() => {});
  }
}

/**
 * Installs the sampler in the page and returns at once; the page-side promise is awaited by
 * `readFrames` after the click or the Escape. Each frame reads the panel's box, its dialog's box
 * and its computed transform. `mode` "enter" stops SAMPLE_MS after the panel first appears; "exit"
 * stops SAMPLE_MS after it is gone. Time is milliseconds from the sampler's own start, which
 * precedes the click by however long the driver takes to dispatch it, so the first present frame's
 * time is also recorded as `firstAt`.
 */
async function armSampler(page, selector, mode) {
  await page.evaluate(
    ({ selector, mode, sampleMs, capMs }) => {
      const frames = [];
      const t0 = performance.now();
      let firstAt = null;
      let goneAt = null;
      window.__sheetFrames = new Promise((resolve) => {
        const tick = () => {
          const now = performance.now() - t0;
          const p = document.querySelector(selector);
          if (p) {
            if (firstAt == null) firstAt = now;
            const r = p.getBoundingClientRect();
            const d = p.closest("dialog");
            const dr = d ? d.getBoundingClientRect() : null;
            frames.push({
              t: Math.round(now * 10) / 10,
              left: r.left,
              top: r.top,
              w: r.width,
              h: r.height,
              dlg: dr ? { l: dr.left, t: dr.top, r: dr.right, b: dr.bottom } : null,
              tf: getComputedStyle(p).transform,
              shown: d ? d.getAttribute("data-shown") : null,
              open: d ? d.open : null,
            });
          } else {
            if (firstAt != null && goneAt == null) goneAt = now;
            frames.push({ t: Math.round(now * 10) / 10, none: true });
          }
          const done =
            mode === "enter"
              ? firstAt != null && now - firstAt >= sampleMs
              : goneAt != null && now - goneAt >= sampleMs;
          if (done || now >= capMs) resolve({ frames, firstAt, goneAt });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { selector, mode, sampleMs: SAMPLE_MS, capMs: SAMPLE_CAP_MS },
  );
}

async function readFrames(page) {
  return page.evaluate(() => window.__sheetFrames);
}

/**
 * The geometry reading of one sampler frame: the panel's left edge for a drawer (side right), its
 * top edge for a bottom sheet, against the dialog's own box on the same frame. A record only.
 */
function axisOf(frame, shape) {
  if (shape === "drawer") return { pos: frame.left, rest: frame.dlg.r - frame.w };
  return { pos: frame.top, rest: frame.dlg.b - frame.h };
}

/** The geometry series the record carries: `t:pos` per present frame, rounded to a tenth. */
function geometrySeries(frames, shape) {
  return frames
    .filter((f) => !f.none)
    .map((f) => `${f.t}:${Math.round(axisOf(f, shape).pos * 10) / 10}`);
}

/**
 * Playwright's own ffmpeg, which `playwright install` puts beside the browsers, else the PATH's.
 * Playwright's is a minimal build (libvpx and mjpeg in, png and libvpx out, image2 and webm
 * muxers, crop and scale filters), so the decode below asks for nothing beyond that: the video's
 * last seconds, cropped to the band, as one PNG per frame.
 */
function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const d of entries) {
      if (!d.startsWith("ffmpeg")) continue;
      const bin = path.join(root, d, "ffmpeg-linux");
      if (fs.existsSync(bin)) return bin;
    }
  }
  return "ffmpeg";
}

/** Playwright records at a fixed 25 frames a second, every frame written, so a frame's time is its index. */
const VIDEO_FPS = 25;

/**
 * A PNG as ffmpeg's png encoder writes it for rgb24 (8-bit, colour type 2, no interlace): the
 * IDAT stream inflated and each row unfiltered, into one RGB buffer. Dependency-free, because the
 * suite carries no image library and the runner need not either.
 */
function decodePng(file) {
  return decodePngBuffer(fs.readFileSync(file), file);
}

/** The same decoder on a buffer, for the stepped method's screenshots (rgba, colour type 6). */
function decodePngBuffer(d, file = "screenshot") {
  if (d.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  const idat = [];
  while (off < d.length) {
    const len = d.readUInt32BE(off);
    const kind = d.toString("latin1", off + 4, off + 8);
    const body = d.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      if (body[12] !== 0) throw new Error(`${file}: interlaced PNG`);
    } else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  const bpp = type === 2 ? 3 : type === 6 ? 4 : 0;
  if (depth !== 8 || !bpp)
    throw new Error(`${file}: PNG depth ${depth} type ${type} is not rgb24 or rgba`);
  const raw = require("zlib").inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 3] = row[x * bpp];
      out[(y * w + x) * 3 + 1] = row[x * bpp + 1];
      out[(y * w + x) * 3 + 2] = row[x * bpp + 2];
    }
    prev = row;
  }
  return { w, h, buf: out };
}

/**
 * Decodes the last seconds of the video into RGB frames of one band across the panel's path:
 * a horizontal band of BAND rows about the viewport's middle for a drawer (whose leading edge is a
 * column), a vertical band of BAND columns about the middle for a bottom sheet (a row). Each frame
 * carries its time from its index at the video's fixed rate.
 */
function decodeBand(file, shape, vw, vh) {
  const cw = shape === "drawer" ? vw : BAND;
  const ch = shape === "drawer" ? BAND : vh;
  const cx = shape === "drawer" ? 0 : Math.floor(vw / 2 - BAND / 2);
  const cy = shape === "drawer" ? Math.floor(vh / 2 - BAND / 2) : 0;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-frames-"));
  try {
    const r = spawnSync(ffmpegPath(), [
      "-v",
      "error",
      "-nostats",
      "-sseof",
      "-10",
      "-i",
      file,
      "-vf",
      `crop=${cw}:${ch}:${cx}:${cy}`,
      "-pix_fmt",
      "rgb24",
      "-vsync",
      "0",
      "-f",
      "image2",
      "-c:v",
      "png",
      path.join(dir, "%05d.png"),
    ]);
    if (r.status !== 0)
      throw new Error(
        `ffmpeg (${ffmpegPath()}) exited ${r.status}: ${String(r.stderr || r.error || "").slice(-400)}`,
      );
    const files = fs.readdirSync(dir).sort();
    const frames = files.map((name, i) => ({
      pts: i / VIDEO_FPS,
      ...decodePng(path.join(dir, name)),
    }));
    if (frames.some((f) => f.w !== cw || f.h !== ch))
      throw new Error(`a decoded frame is not ${cw}x${ch}`);
    return { frames, cw, ch, cx, cy };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const isLime = (b, o) => b[o + 1] > 200 && b[o] < 90 && b[o + 2] < 90;
// The markers are read only inside their own 24 px cell, and the Escape's under the scrim, so the
// magenta test wants both channels bright and the cyan test wants them equal and green-blue: a
// purple C tint or a teal icon elsewhere in the band is never a marker.
const isMagenta = (b, o) => b[o] > 180 && b[o + 2] > 180 && b[o + 1] < 60;
const isCyan = (b, o) =>
  b[o + 1] > 80 && b[o + 2] > 80 && b[o] < 50 && Math.abs(b[o + 1] - b[o + 2]) < 30;
/** The marker's 24 px cell, in the band: at the band's start along the axis, centred across it. */
const MARKER = 24;

/**
 * One decoded frame's reading: the panel's leading edge in video pixels (the first column or row
 * on which more than half the band is lime, null when no lime is painted), and whether the click's
 * magenta or the Escape's cyan marker is painted in the marker's cell. A marker counts when more
 * than a quarter of its cell reads as it, so a partly covered or scrimmed marker still counts and
 * a stray pixel does not.
 */
function readFrame({ buf }, shape, cw, ch, scale) {
  let edge = null;
  if (shape === "drawer") {
    for (let x = 0; x < cw && edge === null; x++) {
      let lime = 0;
      for (let y = 0; y < ch; y++) if (isLime(buf, (y * cw + x) * 3)) lime++;
      if (lime > ch / 2) edge = x;
    }
  } else {
    for (let y = 0; y < ch && edge === null; y++) {
      let lime = 0;
      for (let x = 0; x < cw; x++) if (isLime(buf, (y * cw + x) * 3)) lime++;
      if (lime > cw / 2) edge = y;
    }
  }
  const x0 = shape === "drawer" ? 0 : Math.floor(cw / 2 - MARKER / 2);
  const y0 = shape === "drawer" ? Math.floor(ch / 2 - MARKER / 2) : 0;
  let magenta = 0;
  let cyan = 0;
  for (let y = y0; y < Math.min(ch, y0 + MARKER); y++)
    for (let x = x0; x < Math.min(cw, x0 + MARKER); x++) {
      const o = (y * cw + x) * 3;
      if (isMagenta(buf, o)) magenta++;
      else if (isCyan(buf, o)) cyan++;
    }
  // The marker is MARKER CSS pixels, so MARKER / scale video pixels on a side.
  const quarter = (MARKER / scale) ** 2 / 4;
  return { edge, magenta: magenta > quarter, cyan: cyan > quarter };
}

/**
 * The painted series from the video: `t:edge` per frame from the click's marker, in CSS pixels
 * (video pixels times the recording's scale), split at the Escape's marker into enter and exit.
 * A frame with no lime is `t:-` in the record and absent from the assertions' series.
 */
function paintedSeries(video, shape, scale, vw, vh) {
  const { frames, cw, ch } = decodeBand(video, shape, vw, vh);
  const read = frames.map((f) => ({ pts: f.pts, ...readFrame(f, shape, cw, ch, scale) }));
  const click = read.findIndex((f) => f.magenta);
  const esc = read.findIndex((f, i) => i > click && f.cyan);
  if (click < 0) return { click: -1, esc: -1, enter: [], exit: [], decoded: read.length };
  const t0 = read[click].pts;
  const ms = (f) => Math.round((f.pts - t0) * 1000);
  const px = (f) => (f.edge === null ? null : f.edge * scale);
  const enter = read.slice(click, esc < 0 ? undefined : esc).map((f) => ({ t: ms(f), pos: px(f) }));
  const exit = esc < 0 ? [] : read.slice(esc).map((f) => ({ t: ms(f), pos: px(f) }));
  return { click, esc, enter, exit, decoded: read.length };
}

/** `t:pos` per frame, `-` where no lime is painted, cut five frames after the last painted one. */
function fmtSeries(list) {
  let last = -1;
  list.forEach((f, i) => {
    if (f.pos !== null) last = i;
  });
  return list
    .slice(0, last + 6)
    .map((f) => `${f.t}:${f.pos === null ? "-" : f.pos}`)
    .join(",");
}

/**
 * The four enter assertions of the handoff, on the painted frames that show the panel. Rest is
 * `restAt` where the caller read the settled panel (the stepped method), else the last painted
 * frame's edge (the video), so "the wrong side" is an edge below rest on either axis: left of a
 * drawer's rest, above a bottom sheet's. Strict on both engines: the reorder allowance that G154
 * and G160 carried is retired with the stepped method (1236, 1240).
 */
function judgeEnter(enter, tol, restAt = null) {
  const pos = enter.filter((f) => f.pos !== null).map((f) => f.pos);
  if (!pos.length) return { painted: 0 };
  const rest = restAt ?? pos[pos.length - 1];
  const wrongSide = pos.filter((p) => p < rest - tol);
  const away = [];
  for (let i = 1; i < pos.length; i++) if (pos[i] > pos[i - 1] + tol) away.push(i);
  return {
    painted: pos.length,
    rest,
    wrongSide,
    away,
    atRest: Math.abs(pos[pos.length - 1] - rest) <= tol,
    slid: pos[0] > rest + tol,
    first: pos[0],
    min: Math.min(...pos),
    max: Math.max(...pos),
    last: pos[pos.length - 1],
  };
}

/**
 * The exit: from the rest the enter reached, the painted edge may only ever move away from it,
 * never below it and never back toward it between two frames, until no lime is painted. Strict on
 * both engines (1236, 1240).
 */
function judgeExit(exit, rest, tol) {
  const pos = exit.filter((f) => f.pos !== null).map((f) => f.pos);
  const gone = exit.length > 0 && exit[exit.length - 1].pos === null;
  const wrongSide = pos.filter((p) => p < rest - tol);
  const back = [];
  for (let i = 1; i < pos.length; i++) if (pos[i] < pos[i - 1] - tol) back.push(i);
  return { wrongSide, back, gone, count: pos.length };
}

const fmt = (n) => (n == null ? "null" : Math.round(n * 10) / 10);

/**
 * G155: whether the engine ran no animation frame at all while the enter's transition played,
 * read from the geometry sampler: the last frame off rest and the first frame at rest are the
 * transition's whole duration apart, so no frame existed in which the slide could have been
 * painted. Headless WebKit at 2560 by 1440 on the runner does this (run 402: 2560 at 254 ms, then
 * 1280 at 558 ms, nothing between). A check on the slide is then unprovable there (ruling 228).
 */
// Reached on the video method only: the stepped series (1236) does not depend on the engine running
// a frame while the transition plays, so on WebKit this branch no longer exists.
function unpaintedTransition(frames, shape, tol) {
  const present = frames.filter((f) => !f.none).map((f) => ({ t: f.t, pos: axisOf(f, shape).pos }));
  if (present.length < 2) return null;
  const rest = present[present.length - 1].pos;
  let lastOff = null;
  for (const f of present) if (f.pos > rest + tol) lastOff = f;
  if (!lastOff) return null;
  const firstAt = present.find((f) => f.t > lastOff.t && f.pos <= rest + tol);
  if (!firstAt) return null;
  const gap = firstAt.t - lastOff.t;
  return gap >= SHEET_DUR - 40 ? { from: lastOff.t, to: firstAt.t, gap: Math.round(gap) } : null;
}

/** The panel's selector and its lime outline, common to both methods. */
async function outline(page, label) {
  const sel = `section[role="dialog"][aria-label="${label}"]`;
  // The lime outline: painted inside the panel's box, above its content, and carried by whatever
  // moves the panel, so the panel's painted edge is the first lime column or row.
  await page.addStyleTag({
    content: `${sel}{outline:${OUTLINE}px solid #00ff00 !important;outline-offset:-${OUTLINE}px !important;}`,
  });
  return sel;
}

/**
 * One sheet, opened by the trigger's own click, read on its enter and its exit by the session's
 * method. `label` is the panel's accessible name, `shape` "drawer" or "sheet", `trigger` the
 * selector whose click opens it.
 */
async function readSheet(session, tag, spec) {
  if (session.method === "stepped") return readSheetStepped(session, tag, spec);
  return readSheetVideo(session, tag, spec);
}

/**
 * Chromium, `method=video`: unchanged in method from 37-B. Four checks on the enter and one on the
 * exit, on the painted edge decoded from the video, and the geometry beside it as a record.
 */
async function readSheetVideo(session, tag, { label, shape, trigger }) {
  const { page, ctx, scale, w, h } = session;
  const sel = await outline(page, label);
  const tol = PAINT_TOL * scale;
  const video = await page.video().path();
  await armSampler(page, sel, "enter");
  // The click and its marker in one task, so the marker's first frame is the click's frame. The
  // marker sits inside the decoded band and outside the panel's rest: the drawer's band is the
  // viewport's middle rows and the marker is at its left edge; the sheet's band is the middle
  // columns and the marker is at the top.
  await page.evaluate(
    ({ trigger, shape }) => {
      const m = document.createElement("div");
      m.setAttribute("data-sheet-marker", "click");
      m.style.cssText =
        "position:fixed;width:24px;height:24px;background:#ff00ff;z-index:2147483647;pointer-events:none;" +
        (shape === "drawer" ? "left:0;top:calc(50% - 12px);" : "top:0;left:calc(50% - 12px);");
      document.body.appendChild(m);
      document.querySelector(trigger).click();
    },
    { trigger, shape },
  );
  const geo = await readFrames(page);
  const present = geo.frames.filter((f) => !f.none);
  const tfs = [...new Set(present.map((f) => f.tf))];
  console.log(
    `SHEET ${tag} geometry method=video shape=${shape} firstAt=${fmt(geo.firstAt)} frames=${present.length} ` +
      `series=[${geometrySeries(geo.frames, shape).join(",")}] transforms=${JSON.stringify(tfs)}`,
  );
  // The exit: Escape, which every Sheet answers through its `cancel` listener or its own key
  // handler on the contained path, marked the same way and sampled until the panel detaches.
  await armSampler(page, sel, "exit");
  await page.evaluate((shape) => {
    const m = document.createElement("div");
    m.setAttribute("data-sheet-marker", "escape");
    m.style.cssText =
      "position:fixed;width:24px;height:24px;background:#00ffff;z-index:2147483647;pointer-events:none;" +
      (shape === "drawer" ? "left:0;top:calc(50% - 12px);" : "top:0;left:calc(50% - 12px);");
    document.body.appendChild(m);
  }, shape);
  await page.keyboard.press("Escape");
  const geoExit = await readFrames(page);
  console.log(
    `SHEET ${tag} geometry-exit method=video shape=${shape} series=[${geometrySeries(geoExit.frames, shape).join(",")}]`,
  );
  await page
    .locator(sel)
    .waitFor({ state: "detached", timeout: 8000 })
    .catch(() => {});
  // The screencast delivers a frame only on damage and the video repeats the last one it got, so
  // a page that goes quiet the instant the panel unmounts can end its video on the frame before:
  // at 2560 the drawer's outline sat parked 24 px inside the right edge on every trailing frame.
  // Removing the markers is damage, and the wait lets the frame that shows it land.
  await page.evaluate(() => {
    for (const m of document.querySelectorAll("[data-sheet-marker]")) m.remove();
  });
  await page.waitForTimeout(600);
  // Closing the context is what finishes the video file.
  await ctx.close();
  const painted = paintedSeries(video, shape, scale, w / scale, h / scale);
  const e = judgeEnter(painted.enter, tol);
  console.log(
    `SHEET ${tag} enter method=video shape=${shape} scale=${scale} decoded=${painted.decoded} click=${painted.click} escape=${painted.esc} ` +
      `rest=${fmt(e.rest)} painted=${e.painted} first=${fmt(e.first)} min=${fmt(e.min)} max=${fmt(e.max)} last=${fmt(e.last)} ` +
      `series=[${fmtSeries(painted.enter)}]`,
  );
  const detail = `rest ${fmt(e.rest)}; first ${fmt(e.first)}, min ${fmt(e.min)}, max ${fmt(e.max)}, last ${fmt(e.last)}; ${e.painted} painted frames of ${painted.enter.length} from the click`;
  const x = judgeExit(painted.exit, e.rest ?? 0, tol);
  console.log(
    `SHEET ${tag} exit method=video shape=${shape} from=${fmt(e.rest)} painted=${x.count} gone=${x.gone} ` +
      `series=[${fmtSeries(painted.exit)}]`,
  );
  const checks = [
    [
      " enter: the painted edge is never on the wrong side of rest by more than a chroma block (1201, 37-B)",
      e.painted > 0 && e.wrongSide.length === 0,
      detail +
        (e.painted && e.wrongSide.length
          ? `; ${e.wrongSide.length} frames past rest, furthest ${fmt(Math.min(...e.wrongSide))}`
          : ""),
    ],
    [
      " enter: the painted edge never moves away from rest between two frames (1201, 37-B)",
      e.painted > 0 && e.away.length === 0,
      detail + (e.painted && e.away.length ? `; moved away at frames ${e.away.join(",")}` : ""),
    ],
    [
      " enter: the last painted frame is at rest within a chroma block (1201, 37-B)",
      e.painted > 0 && e.atRest,
      detail,
    ],
    [
      " enter: the first painted frame after the click is not at rest, so the slide ran (1201, 37-B)",
      e.painted > 0 && e.slid,
      detail,
      // Unprovable, not failed, where the engine painted no frame of the transition (G155, 228).
      e.painted > 0 && !e.slid ? unpaintedTransition(geo.frames, shape, tol) : null,
    ],
    [
      " exit: the painted edge leaves one way, never past its rest and never back toward it, and is gone (37-B)",
      e.painted > 0 && x.wrongSide.length === 0 && x.back.length === 0 && x.gone,
      `from ${fmt(e.rest)}; ${x.count} painted frames; ${x.wrongSide.length} past rest; turned back at ${x.back.join(",") || "none"}; gone ${x.gone}`,
    ],
  ];
  for (const [name, ok, why, gap] of checks) {
    if (gap)
      unproven(
        tag + name,
        `the engine ran no animation frame while the ${SHEET_DUR} ms transition played: off rest at ${gap.from} ms, at rest at ${gap.to} ms, ${gap.gap} ms apart, so no frame could show the slide (G155, 228); ${detail}`,
      );
    else record(tag + name, ok, why);
  }
  // A failing arm keeps its video in the artefact; a passing or unprovable arm's is deleted.
  if (checks.every(([, ok, , gap]) => ok || gap))
    fs.rmSync(path.dirname(video), { recursive: true, force: true });
  else console.log(`SHEET ${tag} video kept at ${path.relative(OUT, video)}`);
}

/** Real time on the Node side, never the page's clock, which the stepped method installs and pauses. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Waits for the panel's transform transition to exist and pauses it, polling from Node with real
 * time because the page's own timers may be paused. Returns the transition's duration in ms, or
 * null with the reason when none appeared within `timeoutMs`.
 */
async function pauseTransition(page, sel, timeoutMs) {
  const t0 = Date.now();
  let seen = "no panel";
  while (Date.now() - t0 < timeoutMs) {
    const r = await page.evaluate(async (sel) => {
      const p = document.querySelector(sel);
      if (!p) return { state: "no panel" };
      const a = p
        .getAnimations()
        .find(
          (x) => x.transitionProperty === "transform" || x.constructor.name === "CSSTransition",
        );
      if (!a)
        return {
          state: `panel present, no transform transition, transform ${getComputedStyle(p).transform}`,
        };
      a.pause();
      await a.ready;
      const timing = a.effect.getComputedTiming();
      return { state: "paused", duration: timing.duration, at: a.currentTime };
    }, sel);
    if (r.state === "paused") return r;
    seen = r.state;
    await sleep(5);
  }
  return { state: null, reason: `${seen} within ${timeoutMs} ms` };
}

/**
 * One step of a paused transition: sets its currentTime, forces style, reads the panel's box and
 * transform, and screenshots the band. The screenshot is the paint; the box is a record.
 */
async function readStep(page, sel, shape, t, w, h) {
  const geo = await page.evaluate(
    ({ sel, t }) => {
      const p = document.querySelector(sel);
      if (!p) return null;
      const a =
        p.getAnimations().find((x) => x.transitionProperty === "transform") ?? p.getAnimations()[0];
      if (a) a.currentTime = t;
      const r = p.getBoundingClientRect();
      const d = p.closest("dialog");
      const dr = d ? d.getBoundingClientRect() : null;
      return {
        left: r.left,
        top: r.top,
        w: r.width,
        h: r.height,
        dlg: dr ? { l: dr.left, t: dr.top, r: dr.right, b: dr.bottom } : null,
        tf: getComputedStyle(p).transform,
        animating: !!a,
      };
    },
    { sel, t },
  );
  const edge = await paintedEdge(page, shape, w, h);
  return { t: Math.round(t * 10) / 10, pos: edge, geo };
}

/** The band's painted reading at this instant, in CSS pixels (device scale 1). */
async function paintedEdge(page, shape, w, h) {
  const cw = shape === "drawer" ? w : BAND;
  const ch = shape === "drawer" ? BAND : h;
  const cx = shape === "drawer" ? 0 : Math.floor(w / 2 - BAND / 2);
  const cy = shape === "drawer" ? Math.floor(h / 2 - BAND / 2) : 0;
  const png = await page.screenshot({
    type: "png",
    clip: { x: cx, y: cy, width: cw, height: ch },
    animations: "allow",
    caret: "hide",
  });
  const frame = decodePngBuffer(png);
  if (frame.w !== cw || frame.h !== ch)
    throw new Error(`the screenshot is ${frame.w}x${frame.h}, not the band's ${cw}x${ch}`);
  return readFrame(frame, shape, cw, ch, 1).edge;
}

/** The stepped series as `t:pos`, `-` where no lime is painted. */
const fmtSteps = (list) => list.map((f) => `${f.t}:${f.pos === null ? "-" : f.pos}`).join(",");
/** The geometry beside it, per step, `t:pos` from the box, as a record. */
const fmtStepGeometry = (list, shape) =>
  list
    .map((f) => `${f.t}:${f.geo ? Math.round(axisOf(f.geo, shape).pos * 10) / 10 : "-"}`)
    .join(",");

/**
 * WebKit, `method=stepped` (ruling 1236). The enter's transition is paused and stepped from 0 to its
 * duration; the clock is then paused, Escape pressed, and the exit's transition stepped the same
 * way while the unmount timer is held; then the timers run and the panel's detach is read.
 */
async function readSheetStepped(session, tag, { label, shape, trigger }) {
  const { page, w, h } = session;
  const sel = await outline(page, label);
  const tol = TOL;
  const steps = [];
  for (let t = 0; t < SHEET_DUR; t += STEP_MS) steps.push(t);
  steps.push(SHEET_DUR);
  const failEnter = (why) => {
    console.log(`SHEET ${tag} enter method=stepped shape=${shape} not read: ${why}`);
    record(tag + " enter: the stepped series could be read (1236)", false, why);
  };

  // Enter: the trigger's own click, then the transform transition paused as soon as it exists.
  await page.evaluate((trigger) => document.querySelector(trigger).click(), trigger);
  const enterT = await pauseTransition(page, sel, 4000);
  if (!enterT.state)
    return failEnter(`the panel's transform transition never appeared: ${enterT.reason}`);
  if (Math.abs(enterT.duration - SHEET_DUR) > 1)
    console.log(
      `SHEET ${tag} enter method=stepped the transition's duration is ${enterT.duration}, not SHEET_DUR ${SHEET_DUR}`,
    );
  const enter = [];
  for (const t of steps)
    enter.push(await readStep(page, sel, shape, Math.min(t, enterT.duration), w, h));
  // Settle: finish the transition so the panel is at its layout position with no transform, and
  // read where the settled paint sits. That reading is rest.
  await page.evaluate((sel) => {
    for (const a of document.querySelector(sel)?.getAnimations() ?? []) a.finish();
  }, sel);
  await sleep(50);
  const settled = await readStep(page, sel, shape, 0, w, h);
  console.log(
    `SHEET ${tag} geometry method=stepped shape=${shape} duration=${enterT.duration} pausedAt=${fmt(enterT.at)} ` +
      `series=[${fmtStepGeometry(enter, shape)}] settled=${settled.geo ? fmt(axisOf(settled.geo, shape).pos) : "-"} ` +
      `transforms=${JSON.stringify([...new Set(enter.map((f) => f.geo?.tf))])}`,
  );
  const e = judgeEnter(enter, tol, settled.pos);
  console.log(
    `SHEET ${tag} enter method=stepped shape=${shape} scale=1 steps=${enter.length} rest=${fmt(settled.pos)} painted=${e.painted} ` +
      `step0=${enter[0].pos === null ? "off" : enter[0].pos} first=${fmt(e.first)} min=${fmt(e.min)} max=${fmt(e.max)} last=${fmt(e.last)} ` +
      `series=[${fmtSteps(enter)}]`,
  );
  const detail = `rest ${fmt(settled.pos)} (the settled paint); step 0 ${enter[0].pos === null ? "off the edge" : `at ${enter[0].pos}`}; first ${fmt(e.first)}, min ${fmt(e.min)}, max ${fmt(e.max)}, last ${fmt(e.last)}; ${e.painted} painted of ${enter.length} steps`;

  // Exit: the clock paused first, so the setTimeout(SHEET_DUR) that unmounts the panel is held
  // while the steps are read. pauseAt must not be in the fake clock's past, so it is read from the
  // page and moved a little ahead; the small jump fires nothing of Sheet's, which has no timer yet.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 250);
  await page.keyboard.press("Escape");
  const exitT = await pauseTransition(page, sel, 4000);
  const exit = [];
  let held = true;
  let detached = false;
  // A caller that unmounts the Sheet on close rather than dropping `open` (FacetRail's contained
  // Filters sheet, G191) has no exit transition: the panel detaches at once. The video method read
  // that as no painted exit frame and gone, and this reads it the same way, by name.
  let atOnce = false;
  if (!exitT.state) {
    atOnce = await page.evaluate((sel) => !document.querySelector(sel), sel);
    detached = atOnce;
  }
  if (exitT.state) {
    for (const t of steps) {
      const step = await readStep(page, sel, shape, Math.min(t, exitT.duration), w, h);
      if (!step.geo) held = false;
      exit.push(step);
    }
    await page.evaluate((sel) => {
      for (const a of document.querySelector(sel)?.getAnimations() ?? []) a.finish();
    }, sel);
    // Now the timers: SHEET_DUR and a margin, so the unmount fires and the panel detaches.
    await page.clock.runFor(SHEET_DUR + 100);
    detached = await page
      .locator(sel)
      .waitFor({ state: "detached", timeout: 4000 })
      .then(() => true)
      .catch(() => false);
  }
  const x = judgeExit(exit, settled.pos ?? 0, tol);
  const lastOff = exit.length > 0 && exit[exit.length - 1].pos === null;
  console.log(
    `SHEET ${tag} geometry-exit method=stepped shape=${shape} ` +
      (exitT.state
        ? `duration=${exitT.duration} pausedAt=${fmt(exitT.at)} series=[${fmtStepGeometry(exit, shape)}]`
        : `not read: ${exitT.reason}`),
  );
  console.log(
    `SHEET ${tag} exit method=stepped shape=${shape} from=${fmt(settled.pos)} steps=${exit.length} painted=${x.count} ` +
      `held=${held} lastOff=${lastOff} detached=${detached} atOnce=${atOnce} series=[${fmtSteps(exit)}]`,
  );
  const checks = [
    [
      " enter: step 0 reads the panel wholly off its edge (1236)",
      enter.length > 0 && enter[0].pos === null,
      detail,
    ],
    [
      " enter: the painted edge is never on the wrong side of rest by more than 0.5 px (1201, 1236)",
      e.painted > 0 && e.wrongSide.length === 0,
      detail +
        (e.painted && e.wrongSide.length
          ? `; ${e.wrongSide.length} steps past rest, furthest ${fmt(Math.min(...e.wrongSide))}`
          : ""),
    ],
    [
      " enter: the painted edge never moves away from rest between two steps (1201, 1236)",
      e.painted > 0 && e.away.length === 0,
      detail + (e.painted && e.away.length ? `; moved away at steps ${e.away.join(",")}` : ""),
    ],
    [
      " enter: the last step reads rest within 0.5 px (1201, 1236)",
      e.painted > 0 && settled.pos !== null && e.atRest,
      detail,
    ],
    [
      " enter: the first painted step is not at rest, so the slide ran (1201, 1236)",
      e.painted > 0 && e.slid,
      detail,
    ],
    [
      " exit: the painted edge leaves one way, never past its rest and never back toward it, and the panel is gone (37-B, 1236)",
      exitT.state
        ? held && x.wrongSide.length === 0 && x.back.length === 0 && lastOff && detached
        : atOnce,
      (exitT.state
        ? ""
        : atOnce
          ? "no exit transition: the panel detached at once on Escape (a caller that unmounts on close, G191); "
          : `the exit's transform transition never appeared and the panel is still mounted: ${exitT.reason}; `) +
        `from ${fmt(settled.pos)}; ${x.count} painted of ${exit.length} steps; timers held ${held}; ${x.wrongSide.length} past rest; turned back at ${x.back.join(",") || "none"}; last step off the edge ${lastOff}; detached ${detached}`,
    ],
  ];
  for (const [name, ok, why] of checks) record(tag + name, ok, why);
}

/** The composer, from the header's pill on the Feed. */
async function runSheetComposer(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-sheet-composer`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 3);
      const s = await context(bt, [w, h], theme, db, tag);
      await signIn(s.page);
      return s;
    },
    async (s) => {
      await readSheet(s, tag, {
        label: "Compose",
        shape: w < 640 ? "sheet" : "drawer",
        trigger: '[data-testid="compose"]',
      });
    },
  );
}

/** Discovery's Filters at compact: FacetRail's `contained` bottom sheet behind the Filters pill. */
async function runSheetFilters(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-sheet-filters`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedDiscovery(db);
      const s = await context(bt, [w, h], theme, db, tag);
      await signIn(s.page);
      await s.page.goto(BASE + "/convene", { waitUntil: "networkidle" });
      await s.page.waitForSelector("[data-discovery]", { timeout: 20000 });
      await s.page.waitForFunction(
        () =>
          !!document.querySelector(
            "[data-discovery] [data-lanes], [data-lens-list], [role=alert]",
          ) && !document.querySelector('[role="status"][aria-label="Loading Convene"]'),
        null,
        { timeout: 20000 },
      );
      await s.page.locator('[data-testid="filters"]').waitFor({ timeout: 10000 });
      return s;
    },
    async (s) => {
      await readSheet(s, tag, {
        label: "Filters",
        shape: "sheet",
        trigger: '[data-testid="filters"]',
      });
    },
  );
}

/** The event page's Share below expanded: the Sheet, opened from the share row. */
async function runSheetShare(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-sheet-share`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 1);
      seedAttend(db);
      const s = await context(bt, [w, h], theme, db, tag);
      await signIn(s.page);
      await s.page.goto(BASE + "/convene/events/" + eventId("loaded"), {
        waitUntil: "networkidle",
      });
      await s.page.waitForSelector('[data-event-page][data-event-state="loaded"]', {
        timeout: 15000,
      });
      await s.page.locator('[data-testid="event-share"]').waitFor({ timeout: 10000 });
      return s;
    },
    async (s) => {
      await readSheet(s, tag, {
        label: "Share this event",
        shape: "sheet",
        trigger: '[data-testid="event-share"]',
      });
    },
  );
}

/**
 * Ruling 1484 (W82, Fix PR 08): a sheet's title takes focus with no ring. Notifications at 390,
 * opened by a tap: the heading is the active element and its computed outline is none or of no
 * width. Then Tab: the control it reaches draws its ring, so the fix is the heading's alone.
 */
async function runSheetFocus(bt, bname, [w, h], theme) {
  const tag = `${bname}-${w}x${h}-${theme}-sheet-focus`;
  await arm(
    tag,
    async () => {
      const db = makeMockDb();
      seedPosts(db, 3);
      const s = await context(bt, [w, h], theme, db, tag, true);
      await signIn(s.page);
      return s;
    },
    async (s) => {
      const { page } = s;
      const ring = () =>
        page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          return {
            heading: el.hasAttribute("data-sheet-heading"),
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
            style: cs.outlineStyle,
            width: parseFloat(cs.outlineWidth) || 0,
          };
        });
      await page.locator('[data-testid="bell"]').tap();
      await page
        .locator('[role="dialog"][aria-label="Notifications"] [data-sheet-heading]')
        .waitFor({ timeout: 10000 });
      await page.waitForFunction(
        () => !!document.activeElement && document.activeElement.hasAttribute("data-sheet-heading"),
        null,
        { timeout: 10000 },
      );
      const title = await ring();
      record(
        tag + " the notifications title takes focus on a tap and draws no ring (1484)",
        !!title && title.heading && (title.style === "none" || title.width === 0),
        JSON.stringify(title),
      );
      await page.keyboard.press("Tab");
      await page.waitForTimeout(150);
      const next = await ring();
      record(
        tag + " Tab from the title reaches a control that draws its ring (1484)",
        !!next && !next.heading && next.style !== "none" && next.width > 0,
        JSON.stringify(next),
      );
    },
  );
}

/** Every sheet arm on its cells, in one call per engine, each driven through `M.drive` so a lost web
 *  process retries that arm alone (1237). `only` narrows to one viewport. */
async function runSheets(bt, bname, only = null) {
  const on = (vp) => !only || (vp[0] === only[0] && vp[1] === only[1]);
  for (const [vp, theme] of [...BOTTOM_CELLS, ...DRAWER_CELLS])
    if (on(vp)) await M.drive(runSheetComposer, bt, bname, vp, theme);
  for (const [vp, theme] of BOTTOM_CELLS)
    if (on(vp)) await M.drive(runSheetFilters, bt, bname, vp, theme);
  for (const [vp, theme] of BOTTOM_CELLS)
    if (on(vp)) await M.drive(runSheetShare, bt, bname, vp, theme);
  if (on([390, 844])) await M.drive(runSheetFocus, bt, bname, [390, 844], "light");
}

module.exports = {
  runSheets,
  runSheetComposer,
  runSheetFilters,
  runSheetShare,
  runSheetFocus,
  DRAWER_CELLS,
  BOTTOM_CELLS,
  decodePngBuffer,
};
