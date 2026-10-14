// Handoff H61-SP (Strand compile sha256-b1a458dac1bd562f, brief 60-SP items 1 to 21, ratified 1728):
// one focused check per new behaviour the port carries, where the repository keeps such checks for a
// part no page binds yet. The shape is tests/strand-admin.cjs's: the barrel loads through Vite's SSR
// module loader and each part renders through react-dom/server, failing on a throw and on a missing
// landmark. Every check is recorded by name (228); a throw inside a render is a FAIL with the error,
// never a crash of the arm. The checks that need a browser (the cover tap opening the viewer whole,
// the Messenger's bar and pills) stay with tests/media-sites.cjs and tests/messenger.cjs on the
// deployed preview.
//
// 1. `fixedStep` (item 21, 1717): one ratio step at 16:9 is 1.91 / (4/3), so a fixed 16:9 box fills
//    from 1.24:1 to 2.55:1 and shows whole past either bound; 21:9 takes 1.91:1's step, 1.63:1 to
//    3.34:1. Read through `imageFrame` as the discovery face and the public event cover read it.
// 2. `ProfileHeader` with no stored framing renders (1729): the cover box carries
//    data-frame-box="cover" and the portrait is the Avatar; the frame is "pending" until measured.
// 3. A controlled `Tooltip` (item 6) renders its tip on touch while `open` is true, and none while
//    false; an uncontrolled one renders none on touch.
// 4. `ReactionRow` (item 4) in its two modes, `ReactionPicker`'s quick view (item 5), `Comment`
//    (item 2), `TagText` (item 7), `AttachmentTile` (item 11), `Switch` with a hint (item 19) and
//    `Input` with a note (item 9) render their landmarks and no digit.
// Usage: node tests/strand-parts.cjs
const path = require("path");

const ROOT = path.join(__dirname, "..");

let passed = 0,
  failed = 0;
function record(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? ": " + detail : ""));
}

/** Renders `el` to a string, reporting a throw as a failed check rather than ending the arm. */
function render(renderToString, name, el, expect = [], absent = [], noDigit = false) {
  let html;
  try {
    html = renderToString(el);
  } catch (e) {
    record(name, false, "threw " + (e && e.message ? e.message : String(e)));
    return "";
  }
  const missing = expect.filter((s) => !html.includes(s));
  const present = absent.filter((s) => html.includes(s));
  // The text the part shows, tags and their attributes stripped: no count reaches a member (72).
  const text = html.replace(/<[^>]+>/g, "");
  const digit = noDigit && /\d/.test(text) ? text.match(/[^\s]*\d[^\s]*/)[0] : "";
  record(
    name,
    missing.length === 0 && present.length === 0 && !digit,
    (missing.length ? "missing " + JSON.stringify(missing) : "") +
      (present.length ? " present " + JSON.stringify(present) : "") +
      (digit ? " digit " + JSON.stringify(digit) : ""),
  );
  return html;
}

const near = (a, b) => Math.abs(a - b) < 0.005;

(async () => {
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: "error",
    appType: "custom",
    plugins: [react()],
    resolve: { alias: { "@": path.join(ROOT, "src") } },
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const React = require("react");
    const { renderToString } = require("react-dom/server");
    const h = React.createElement;
    let strand;
    try {
      strand = await server.ssrLoadModule("/src/components/strand/index.ts");
    } catch (e) {
      record("the barrel loads", false, e && e.message ? e.message : String(e));
      throw e;
    }
    record("the barrel loads", true);
    for (const p of [
      "Comment",
      "ReactionRow",
      "ReactionPicker",
      "TagLink",
      "TagText",
      "TokenSuggest",
      "AttachmentTile",
      "ProfileHeader",
      "Popover",
      "fixedStep",
    ])
      record(p + " is exported from src/components/strand", typeof strand[p] === "function");
    if (failed) throw new Error("the barrel is incomplete");

    const {
      fixedStep,
      imageFrame,
      ProfileHeader,
      Tooltip,
      ReactionRow,
      ReactionPicker,
      Comment,
      TagText,
      AttachmentTile,
      Switch,
      Input,
    } = strand;

    // 1. fixedStep at 16:9 and 21:9 against the extraction's bounds.
    const s169 = fixedStep(16 / 9);
    const s219 = fixedStep(21 / 9);
    record(
      "fixedStep(16/9) is 1.91 / (4/3), so 16:9 fills from 1.24:1 to 2.55:1 (1717)",
      near(s169, 1.91 / (4 / 3)) && near(16 / 9 / s169, 1.2405) && near((16 / 9) * s169, 2.5467),
      JSON.stringify({ step: s169, low: 16 / 9 / s169, high: (16 / 9) * s169 }),
    );
    record(
      "fixedStep(21/9) is 1.91:1's step, so 21:9 fills from 1.63:1 to 3.34:1 (1717)",
      near(s219, 1.91 / (4 / 3)) && near(21 / 9 / s219, 1.6283) && near((21 / 9) * s219, 3.3425),
      JSON.stringify({ step: s219, low: 21 / 9 / s219, high: (21 / 9) * s219 }),
    );
    const clampAt = (w, hgt, ratio) => imageFrame(w, hgt, null, ratio).clamp;
    record(
      "imageFrame at 16/9: a 4:3 photograph fills (fixed), a 9:16 flyer shows whole (fixed-whole), a 2.6:1 panorama shows whole",
      clampAt(1600, 1200, "16/9") === "fixed" &&
        clampAt(900, 1600, "16/9") === "fixed-whole" &&
        clampAt(2600, 1000, "16/9") === "fixed-whole" &&
        clampAt(1250, 1000, "16/9") === "fixed" &&
        clampAt(1200, 1000, "16/9") === "fixed-whole",
      JSON.stringify([
        clampAt(1600, 1200, "16/9"),
        clampAt(900, 1600, "16/9"),
        clampAt(2600, 1000, "16/9"),
        clampAt(1250, 1000, "16/9"),
        clampAt(1200, 1000, "16/9"),
      ]),
    );
    record(
      "imageFrame at 21/9: a 16:9 photograph fills, a portrait flyer shows whole, 1.6:1 shows whole and 1.65:1 fills",
      clampAt(1600, 900, "21/9") === "fixed" &&
        clampAt(900, 1600, "21/9") === "fixed-whole" &&
        clampAt(1600, 1000, "21/9") === "fixed-whole" &&
        clampAt(1650, 1000, "21/9") === "fixed",
      JSON.stringify([
        clampAt(1600, 900, "21/9"),
        clampAt(900, 1600, "21/9"),
        clampAt(1600, 1000, "21/9"),
        clampAt(1650, 1000, "21/9"),
      ]),
    );
    record(
      "imageFrame without stored dimensions in a fixed box fills as before (fixed)",
      clampAt(null, null, "16/9") === "fixed",
      clampAt(null, null, "16/9"),
    );

    // 2. A profile with no stored framing renders (1729).
    const member = { name: "Ama Mensah", headline: "Builder", avatar: "/a.jpg", cover: "/c.jpg" };
    render(
      renderToString,
      "ProfileHeader hero with no frames renders: the cover box pending its measure, the portrait an Avatar, Open image on the cover",
      h(ProfileHeader, { member, hero: true, owner: false, coverHeight: 220 }),
      [
        'data-frame-box="cover"',
        'data-frame="pending"',
        'aria-label="Open image"',
        'data-testid="portrait"',
        "Ama Mensah",
      ],
      ['data-frame-box="photo"'],
    );
    render(
      renderToString,
      "ProfileHeader hero split, owner, with a photoFrame renders the framed portrait and Change cover",
      h(ProfileHeader, {
        member,
        hero: true,
        split: true,
        owner: true,
        photoFrame: { width: 1200, height: 1600, focalPoint: { x: 0.5, y: 0.3 }, crop: null },
        coverFrame: { width: 2400, height: 1200, focalPoint: null, crop: null },
      }),
      [
        'data-frame-box="photo"',
        'data-frame-box="cover"',
        'aria-label="Change cover"',
        'data-testid="change-photo"',
      ],
    );
    render(
      renderToString,
      "ProfileHeader with no cover renders the owner's Add a cover and no image",
      h(ProfileHeader, { member: { ...member, cover: null }, hero: true, owner: true }),
      ["Add a cover"],
      ['data-frame-box="cover"'],
    );

    // 3. A controlled Tooltip shows on touch.
    render(
      renderToString,
      "Tooltip open on touch renders its tip, controlled (item 6)",
      h(Tooltip, { label: "Clapping", input: "touch", open: true }, h("button", null, "x")),
      ["Clapping", 'data-controlled=""'],
    );
    render(
      renderToString,
      "Tooltip open={false} on touch renders no tip",
      h(Tooltip, { label: "Clapping", input: "touch", open: false }, h("button", null, "x")),
      [],
      ['role="tooltip"'],
    );
    render(
      renderToString,
      "Tooltip uncontrolled on touch renders no tip",
      h(Tooltip, { label: "Clapping", input: "touch" }, h("button", null, "x")),
      [],
      ['role="tooltip"'],
    );

    // 4. The other parts' landmarks.
    const reactions = [
      { emoji: "\u{1F44D}", label: "Thumbs up", names: "Ama and you", own: true, toneFill: null },
      { emoji: "\u{1F389}", label: "Party", names: "Kofi", own: false, toneFill: null },
    ];
    render(
      renderToString,
      "ReactionRow names mode: a pill per emoji, named by glyph and names, aria-pressed, no digit",
      h(ReactionRow, { reactions, input: "touch" }),
      [
        'data-reaction-row="names"',
        'aria-label="Thumbs up, Ama and you"',
        'aria-pressed="true"',
        "Kofi",
      ],
      [],
      [],
      true,
    );
    render(
      renderToString,
      "ReactionRow glyph mode: role=group named Reactions, the own pill marked, See who reacted for the author",
      h(ReactionRow, { reactions, names: false, onSeeWho: () => {}, input: "pointer" }),
      ['role="group"', 'aria-label="Reactions"', 'data-own=""', "See who reacted"],
    );
    render(
      renderToString,
      "ReactionPicker quick view: role=group React, each glyph named with aria-pressed, More, data-picker and data-quick hooks",
      h(ReactionPicker, {
        view: "quick",
        input: "pointer",
        quick: [
          { value: "\u{1F44D}", label: "Thumbs up", toneFill: null, pressed: true },
          { value: "❤️", label: "Heart", toneFill: null, pressed: false },
        ],
      }),
      [
        'aria-label="React"',
        'data-picker=""',
        'data-quick="\u{1F44D}"',
        'aria-label="Thumbs up"',
        "More",
      ],
    );
    render(
      renderToString,
      "Comment: name, time, Edited, text, Reply at the top level, More",
      h(Comment, {
        name: "Ama Mensah",
        time: "2h",
        edited: true,
        text: "Count me in",
        onReply: () => {},
        menu: [{ id: "report", label: "Report", onSelect: () => {} }],
        input: "pointer",
      }),
      ['data-comment="top"', "Ama Mensah", "Edited", "Count me in", "Reply", 'aria-label="More"'],
    );
    render(
      renderToString,
      "Comment deleted: the tombstone, no name",
      h(Comment, { name: "Ama Mensah", deleted: true }),
      ['data-comment="deleted"', "This comment was deleted."],
      ["Ama Mensah"],
    );
    render(
      renderToString,
      "Comment latest: one button line with the name in bold",
      h(Comment, {
        name: "Ama Mensah",
        text: "Count me in",
        presentation: "latest",
        onOpen: () => {},
      }),
      ['data-comment="latest"', "Ama Mensah", "Count me in"],
    );
    render(
      renderToString,
      "TagText: a parsed body renders its tag as an inline link in the C's text rung, the rest as text",
      h(TagText, {
        parts: ["Meet us at ", { tag: "accra", href: "/tags/accra", text: "#Accra" }, " tonight"],
        c: "convene",
      }),
      ['data-tag=""', 'href="/tags/accra"', "#Accra", "Meet us at ", "var(--c-convene-text)"],
    );
    render(
      renderToString,
      "AttachmentTile pending: Uploading, Reframe disabled, Remove image; role=listitem",
      h(AttachmentTile, {
        src: "/a.jpg",
        alt: "A photo",
        pending: true,
        onRemove: () => {},
        onReframe: () => {},
        input: "touch",
      }),
      [
        'role="listitem"',
        "Uploading",
        'aria-label="Remove image"',
        'aria-label="Reframe A photo"',
        'aria-disabled="true"',
      ],
    );
    render(
      renderToString,
      "AttachmentTile reframed: the Reframed line",
      h(AttachmentTile, {
        src: "/a.jpg",
        width: 1200,
        height: 900,
        focalPoint: { x: 0.2, y: 0.4 },
      }),
      ["Reframed"],
      ["Uploading"],
    );
    render(
      renderToString,
      "Switch with a hint: the hint under the label, tied by aria-describedby",
      h(Switch, {
        label: "Receipts",
        hint: "Others see when you have read a message.",
        checked: true,
      }),
      ["Receipts", "Others see when you have read a message.", "aria-describedby="],
    );
    render(
      renderToString,
      "Input with a note: a polite status region after the info icon, tied by aria-describedby",
      h(Input, {
        label: "Post",
        multiline: true,
        note: "A tag can be up to 40 letters.",
        value: "",
        onChange: () => {},
      }),
      ['role="status"', 'data-note=""', "A tag can be up to 40 letters.", "aria-describedby="],
    );
  } catch (e) {
    if (!failed) record("arm", false, e && e.message ? e.message : String(e));
  } finally {
    await server.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
