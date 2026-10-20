// Handoff 62-G, PR 1 (SPEC-62-FEED-CARD 8, 10.1, 10.2; rulings 1677, 1796, 1797, 1809, 1817, 1820,
// 1822, 1844, 1849): the Feed card's comments on the deployed preview, with the Supabase surface
// mocked by tests/matrix.cjs so the real client paths run against the shapes 20261016120100 answers.
//
// runComments, at 390, 820 and 1280, both themes (twelve checks):
//   - the thread renders oldest first, with no sort control (1796);
//   - the head: the commenter's photo and name are one link to /m/{handle}, the post author's own
//     comment carries the Author mark, a withheld commenter has no link and no photo (1817, 1820, 141);
//   - every time is a `time` element whose title is the absolute form, absolute on the expanded card
//     and relative on the Feed's card (10.1);
//   - no digit outside a `time` element in the thread, in See more comments or in a comment's summary
//     (1797), and See more comments reads the next page;
//   - the box sends text and an image through media-upload and comment_post, and the sent comment
//     appears at the thread's end with its image (8.4);
//   - Reply addresses a top-level comment, the reply appears under it, and a reply carries no Reply
//     (1677);
//   - a tap on a comment's React places Asante and the summary changes before the network answers; the
//     post's React likewise (1844);
//   - a refused reaction rolls the summary back and the live region says so (1844);
//   - the collapsed card's newest-comment line: the commenter linked, the text opening the post (8.3);
//   - the tray's rows read 1849's sentences verbatim, people-led, and a reply's row opens the post with
//     the comment in view (10.2);
//   - no page errors.
//
// Usage: BASE=https://<id>.dna-web-application.pages.dev SPECIAL=comments node tests/matrix.cjs
const M = require("./matrix.cjs");

const { launch, makeMockDb, seedPosts, mockSupabase, signIn, record } = M;

const FLOW_CELLS = [
  [390, 844],
  [820, 1180],
  [1280, 800],
];

const SB_RE = M.SB.replace(/\./g, "\\.");
const CANCELLED_MOCK_FETCH = new RegExp(
  `(?:^|[\\s/])${SB_RE}\\S*\\s+due to access control checks\\.?$`,
);

const F2 = "00000000-0000-4000-8000-0000000000f2";
const F3 = "00000000-0000-4000-8000-0000000000f3";
const F4 = "00000000-0000-4000-8000-0000000000f4";
const F5 = "00000000-0000-4000-8000-0000000000f5";
const lerato = { id: F2, name: "Lerato Khumalo", handle: "lerato-khumalo", avatar_path: null };
const ngozi = { id: F3, name: "Ngozi Okafor", handle: "ngozi-okafor", avatar_path: null };
const kwame = { id: F4, name: "Kwame Mensah", handle: "kwame-mensah", avatar_path: null };
const withheld = { id: F5, name: null, handle: null, avatar_path: null, withheld: true };

/** T.absolute, whenLabel's form: "Thu 9 Oct, 10:02". */
const ABSOLUTE = /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/;

const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600e3).toISOString();

/** A 1 by 1 PNG, enough for createImageBitmap to decode and media-upload to take. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** seed-1 is lerato's post. Four comments out of order plus one reply; seed-3 carries a long thread. */
function seedComments(db) {
  const c = (id, post, author, body, hoursAgo, extra = {}) => ({
    id,
    post_id: post,
    parent_id: null,
    author_id: author.id,
    body,
    media: null,
    created_at: at(hoursAgo),
    person: author.id === M.UID ? undefined : author,
    ...extra,
  });
  db.comments.push(
    c("c-third", "seed-1", ngozi, "Third, from Ngozi.", 3),
    c("c-first", "seed-1", kwame, "First, from Kwame.", 5),
    c("c-author", "seed-1", lerato, "The author's own word.", 4),
    c("c-withheld", "seed-1", withheld, "A comment from a member you may not see.", 2),
    c("c-reply", "seed-1", ngozi, "A reply under the first.", 1, { parent_id: "c-first" }),
  );
  for (let i = 0; i < 22; i++)
    db.comments.push(
      c(
        "c-long-" + String(i).padStart(2, "0"),
        "seed-3",
        i % 2 ? ngozi : kwame,
        "A line of the long thread, " + ["one", "two", "three", "four"][i % 4] + ".",
        40 - i,
      ),
    );
  db.commentReactions.push({
    member_id: F3,
    comment_id: "c-first",
    kind: "celebrate",
    emoji: null,
    created_at: at(2),
    person: { ...ngozi, headline: "Designer" },
    network: true,
  });
  db.membersById = db.membersById || {};
  for (const m of [lerato, ngozi, kwame]) db.membersById[m.id] = { ...m };
}

/** The tray: the two 1849 kinds, people-led, under the post's C. */
function seedNotifications(db) {
  db.notifications.push(
    {
      id: "n-comment",
      recipient_member_id: M.UID,
      kind: "comment_on_post",
      c_category: "convey",
      actor_kind: "member",
      actor_id: F2,
      object_kind: "post",
      object_id: "seed-0",
      group_key: "post:seed-0",
      grouped_actor_ids: [F3],
      read_at: null,
      seen_at: null,
      created_at: at(2),
    },
    {
      id: "n-reply",
      recipient_member_id: M.UID,
      kind: "reply_to_comment",
      c_category: "convey",
      actor_kind: "member",
      actor_id: F4,
      object_kind: "comment",
      object_id: "c-mine",
      group_key: "comment:c-mine",
      grouped_actor_ids: [],
      read_at: null,
      seen_at: null,
      created_at: at(1),
    },
  );
  db.comments.push({
    id: "c-mine",
    post_id: "seed-0",
    parent_id: null,
    author_id: M.UID,
    body: "My own comment on my own post.",
    media: null,
    created_at: at(6),
  });
}

async function open(browserType, [w, h], theme) {
  const browser = await launch(browserType);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 1024,
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

/** The text of an element with every `time` element's text removed, for the no-digit checks. */
async function textWithoutTimes(locator) {
  return locator.evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("time").forEach((t) => t.remove());
    return clone.textContent || "";
  });
}

async function runComments(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} comments`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 4);
  seedComments(db);
  seedNotifications(db);
  await mockSupabase(page, db);
  const touch = w < 1024;
  try {
    await signIn(page);

    // 8.3: the collapsed card's one line on seed-1: the newest comment the viewer may read is the
    // reply (1 hour ago, Ngozi's); its name is a link and its text opens the post.
    const card1 = page.locator('[data-post-id="seed-1"]');
    const latest = card1.locator('[data-comment="latest"]');
    await latest.waitFor({ timeout: 15000 });
    const latestLink = latest.locator("[data-person-link]");
    const feedTime = card1.locator("article header time").first();
    const feedTimeText = (await feedTime.count()) ? (await feedTime.textContent()) || "" : "";
    const feedTimeTitle = (await feedTime.count()) ? await feedTime.getAttribute("title") : null;
    record(
      tag + " the collapsed card shows the newest comment as one line, the commenter linked (8.3)",
      (await latestLink.getAttribute("href")) === "/m/ngozi-okafor" &&
        ((await latest.locator("[data-comment-latest-text]").textContent()) || "").includes(
          "A reply under the first.",
        ) &&
        !/\d/.test(await textWithoutTimes(latest)),
      JSON.stringify({
        href: await latestLink.getAttribute("href"),
        text: await latest.textContent(),
      }),
    );
    record(
      tag + " the Feed card's time is relative within the day with the absolute title (10.1)",
      /^\d+h$/.test(feedTimeText.trim()) && !!feedTimeTitle && ABSOLUTE.test(feedTimeTitle),
      JSON.stringify({ text: feedTimeText, title: feedTimeTitle }),
    );
    await latest.locator("[data-comment-latest-text]").click();
    await page.waitForURL("**/posts/seed-1**", { timeout: 15000 });
    const thread = page.locator("[data-comment-thread]");
    await thread.waitFor({ timeout: 15000 });
    await thread.locator('[data-comment-id="c-withheld"]').waitFor({ timeout: 15000 });

    // 1796: oldest first. The seed pushed them out of order.
    const order = await thread
      .locator("[data-comments] > [data-comment-id]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-comment-id")));
    record(
      tag + " the thread renders oldest first, with no sort control (1796)",
      JSON.stringify(order) === JSON.stringify(["c-first", "c-author", "c-third", "c-withheld"]) &&
        (await thread.locator("select, [data-sort]").count()) === 0,
      JSON.stringify(order),
    );

    // 1817, 1820, 141: the head.
    const authorRow = thread.locator('[data-comment-id="c-author"]');
    const firstRow = thread.locator('[data-comment-id="c-first"]');
    const withheldRow = thread.locator('[data-comment-id="c-withheld"]');
    record(
      tag +
        " the head: name and photo one link to the profile, the Author mark on the author's own comment, a withheld commenter unlinked",
      (await authorRow.locator("[data-comment-author-mark]").count()) === 1 &&
        ((await authorRow.locator("[data-comment-author-mark]").textContent()) || "").trim() ===
          "Author" &&
        (await firstRow.locator("[data-comment-author-mark]").count()) === 0 &&
        (await firstRow.locator("[data-comment-name]").first().getAttribute("href")) ===
          "/m/kwame-mensah" &&
        (await firstRow.locator("[data-comment-name]").first().getAttribute("aria-label")) ===
          "Kwame Mensah’s profile" &&
        (await firstRow.locator("[data-comment-avatar]").count()) >= 1 &&
        (await withheldRow.locator("[data-comment-name], [data-comment-avatar]").count()) === 0 &&
        (await withheldRow.getAttribute("data-comment-withheld")) !== null,
      JSON.stringify({
        marks: await thread.locator("[data-comment-author-mark]").count(),
        withheldLinks: await withheldRow.locator("a").count(),
      }),
    );

    // 10.1: every time in the expanded card is a `time` element, absolute, with the absolute title.
    const times = await page
      .locator('[data-direct-post] time, [data-post-id="seed-1"] time')
      .evaluateAll((els) =>
        els.map((e) => ({ text: (e.textContent || "").trim(), title: e.getAttribute("title") })),
      );
    record(
      tag +
        " every time on the expanded card is a time element, absolute, with the absolute title (10.1)",
      times.length >= 5 &&
        times.every((t) => !!t.title && ABSOLUTE.test(t.title) && t.text === t.title),
      JSON.stringify(times.slice(0, 3)) + " of " + times.length,
    );

    // 1797: no digit outside a time element in the thread or a comment's summary.
    const threadText = await textWithoutTimes(thread);
    const summaryText = await thread.locator("[data-reaction-summary]").first().textContent();
    record(
      tag + " no digit in the thread or a comment's summary outside the time elements (1797)",
      !/\d/.test(threadText) &&
        !/\d/.test(summaryText || "") &&
        (await thread.locator("[data-reaction-summary]").count()) >= 1,
      JSON.stringify({ digits: (threadText.match(/\d+/g) || []).slice(0, 5), summaryText }),
    );

    // 1844: the comment's React changes the summary before the network answers, then holds.
    db.commentReactDelayMs = 1500;
    const thirdRow = thread.locator('[data-comment-id="c-third"]');
    const thirdReact = thirdRow.locator("[data-comment-react]").first();
    const before = await thirdRow.locator("[data-reaction-summary]").count();
    await thirdReact.click();
    await page.waitForTimeout(150);
    const pressedEarly = await thirdReact.getAttribute("aria-pressed");
    const kindsEarly = await thirdRow
      .locator("[data-reaction-summary]")
      .first()
      .getAttribute("data-summary-kinds");
    const payloadsEarly = db.rpcPayloads.filter((x) => x.fn === "comment_react").length;
    await page.waitForTimeout(1800);
    const pressedLate = await thirdReact.getAttribute("aria-pressed");
    const kindsLate = await thirdRow
      .locator("[data-reaction-summary]")
      .first()
      .getAttribute("data-summary-kinds");
    db.commentReactDelayMs = 0;
    record(
      tag +
        " a tap on a comment's React places Asante and the summary changes before the network answers (1844)",
      before === 0 &&
        pressedEarly === "true" &&
        kindsEarly === "asante" &&
        payloadsEarly === 1 &&
        pressedLate === "true" &&
        kindsLate === "asante" &&
        db.commentReactions.some((r) => r.comment_id === "c-third" && r.member_id === M.UID),
      JSON.stringify({ pressedEarly, kindsEarly, pressedLate, kindsLate, payloadsEarly }),
    );

    // 1844: the post's React likewise.
    db.reactDelayMs = 1500;
    const postCard = page.locator('[data-post-id="seed-1"] article');
    const postReact = postCard.locator('[data-testid="react"]');
    await postReact.click();
    await page.waitForTimeout(150);
    const postPressedEarly = await postReact.getAttribute("aria-pressed");
    const postSummaryEarly = await postCard
      .locator("[data-footer-summary] [data-reaction-summary]")
      .getAttribute("data-summary-kinds");
    await page.waitForTimeout(1800);
    db.reactDelayMs = 0;
    record(
      tag + " a tap on the post's React changes its summary before the network answers (1844)",
      postPressedEarly === "true" &&
        (postSummaryEarly || "").split(",").includes("asante") &&
        db.reactions.some((r) => r.post_id === "seed-1" && r.member_id === M.UID),
      JSON.stringify({ postPressedEarly, postSummaryEarly }),
    );

    // 1844: a refused write rolls the change back and says so in the live region.
    db.reactFail = true;
    const firstReact = firstRow.locator("[data-comment-react]").first();
    await firstReact.click();
    await page.waitForTimeout(700);
    const live = (await page.locator('[data-reaction-live="comment"]').textContent()) || "";
    record(
      tag + " a refused reaction rolls the summary back and the live region says so (1844)",
      (await firstReact.getAttribute("aria-pressed")) === "false" &&
        live.includes("Could not save the reaction.") &&
        !db.commentReactions.some((r) => r.comment_id === "c-first" && r.member_id === M.UID),
      JSON.stringify({ pressed: await firstReact.getAttribute("aria-pressed"), live }),
    );

    // 8.4: text and an image, through media-upload and comment_post; the sent comment at the end.
    const box = page.locator("[data-comment-box]");
    await box.locator("[data-comment-field]").fill("A comment with a picture");
    await box
      .locator("[data-comment-file]")
      .setInputFiles({ name: "pic.png", mimeType: "image/png", buffer: PNG });
    await box.locator('[role="list"][aria-label="Attached image"] [role="listitem"]').waitFor({
      timeout: 15000,
    });
    await page.waitForFunction(
      () => !document.querySelector("[data-comment-box] [data-comment-send]:disabled"),
      null,
      { timeout: 15000 },
    );
    await box.locator("[data-comment-send]").click();
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll("[data-comments] > [data-comment-id]");
        const last = rows[rows.length - 1];
        return !!last && !!last.querySelector("[data-comment-image]");
      },
      null,
      { timeout: 15000 },
    );
    const sent = db.rpcPayloads.filter((x) => x.fn === "comment_post").pop();
    const lastId = await page
      .locator("[data-comments] > [data-comment-id]")
      .last()
      .getAttribute("data-comment-id");
    record(
      tag +
        " the box sends text and an image, and the sent comment appears at the thread's end (8.4)",
      !!sent &&
        sent.body.p_body === "A comment with a picture" &&
        typeof sent.body.p_media === "string" &&
        sent.body.p_media.startsWith("m-") &&
        !sent.body.p_parent &&
        !!lastId &&
        lastId.startsWith("c-") &&
        (await box.locator("[data-comment-field]").inputValue()) === "",
      JSON.stringify({ body: sent && sent.body, lastId }),
    );

    // 1677: Reply on a top-level comment; the reply lands under it and carries no Reply.
    await firstRow.locator("[data-comment-reply]").first().click();
    await box.locator("[data-reply-strip]").waitFor({ timeout: 5000 });
    const strip = (await box.locator("[data-reply-strip]").textContent()) || "";
    await box.locator("[data-comment-field]").fill("Replying here");
    await box.locator("[data-comment-send]").click();
    await page.waitForFunction(
      () =>
        !!document.querySelector(
          '[data-comment-id="c-first"] [data-replies] [data-comment-id]:last-child',
        ) &&
        (
          document.querySelector(
            '[data-comment-id="c-first"] [data-replies] [data-comment-id]:last-child',
          ).textContent || ""
        ).includes("Replying here"),
      null,
      { timeout: 15000 },
    );
    const replyPayload = db.rpcPayloads.filter((x) => x.fn === "comment_post").pop();
    const replyRows = firstRow.locator("[data-replies] [data-comment-id]");
    record(
      tag +
        " Reply addresses the comment, the reply appears under it, and a reply carries no Reply (1677)",
      strip.includes("Replying to Kwame") &&
        !!replyPayload &&
        replyPayload.body.p_parent === "c-first" &&
        replyPayload.body.p_body === "Replying here" &&
        (await replyRows.count()) === 2 &&
        (await replyRows.locator("[data-comment-reply]").count()) === 0 &&
        (await box.locator("[data-reply-strip]").count()) === 0,
      JSON.stringify({ strip, parent: replyPayload && replyPayload.body.p_parent }),
    );

    // 1797: the long thread's See more comments carries no digit and reads the next page.
    await page.goto(M.BASE + "/posts/seed-3", { waitUntil: "networkidle" });
    const more = page.locator("[data-comments-more]");
    await more.waitFor({ timeout: 15000 });
    const moreText = (await more.textContent()) || "";
    const shownBefore = await page.locator("[data-comments] > [data-comment-id]").count();
    await more.click();
    await page.waitForFunction(
      (n) => document.querySelectorAll("[data-comments] > [data-comment-id]").length > n,
      shownBefore,
      { timeout: 15000 },
    );
    const shownAfter = await page.locator("[data-comments] > [data-comment-id]").count();
    const firstShown = await page
      .locator("[data-comments] > [data-comment-id]")
      .first()
      .getAttribute("data-comment-id");
    record(
      tag +
        " See more comments carries no digit and reads the next page, oldest first (1796, 1797)",
      moreText.trim() === "See more comments" &&
        !/\d/.test(moreText) &&
        shownBefore === 20 &&
        shownAfter === 22 &&
        firstShown === "c-long-00" &&
        (await more.count()) === 0,
      JSON.stringify({ moreText, shownBefore, shownAfter, firstShown }),
    );

    // 10.2 (1849): the tray's rows, people-led, verbatim; the reply's row opens the post with the
    // comment in view.
    await page.click('[data-testid="bell"]');
    const rowComment = page.locator('[data-kind="comment_on_post"]');
    const rowReply = page.locator('[data-kind="reply_to_comment"]');
    await rowComment.waitFor({ timeout: 15000 });
    const commentSentence = ((await rowComment.textContent()) || "").replace(/\s+/g, " ");
    const replySentence = ((await rowReply.textContent()) || "").replace(/\s+/g, " ");
    const trayTime = rowComment.locator("time").first();
    const trayTitle = (await trayTime.count()) ? await trayTime.getAttribute("title") : null;
    record(
      tag + " the tray's rows read 1849's sentences verbatim, people-led, with 10.1 times",
      commentSentence.includes("Lerato Khumalo and Ngozi Okafor commented on your post") &&
        replySentence.includes("Kwame Mensah replied to your comment") &&
        replySentence.includes("My own comment on my own post.") &&
        (await rowComment.locator("[data-person-link]").count()) === 2 &&
        (await rowComment.getAttribute("data-people-led")) !== null &&
        !!trayTitle &&
        ABSOLUTE.test(trayTitle),
      JSON.stringify({ commentSentence, replySentence, trayTitle }),
    );
    await rowReply.locator("[data-notification-object]").click();
    await page.waitForURL("**/posts/seed-0?comment=c-mine", { timeout: 15000 });
    await page.locator('[data-comment-id="c-mine"]').waitFor({ timeout: 15000 });
    record(
      tag + " a reply's row opens the post with the comment in view (10.2)",
      page.url().includes("/posts/seed-0?comment=c-mine") &&
        (await page.locator('[data-comment-id="c-mine"]').count()) === 1,
      page.url(),
    );

    record(tag + " no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await browser.close();
  }
}

/**
 * H62-G1 (ruling 1905), at 390, 820 and 1280, both themes (six checks). The founder's walk found the
 * comment control landing nowhere near the comments, no way to close them, and React and Reply
 * saving nothing. On the compact and medium cells every control is a touch tap, the path the matrix's
 * `click` never took; at 1280 the post's bar is open over the thread when the comment's React is
 * pressed, the walk's Mac Safari case. Each check reads the page, not the code:
 *   - the comment control: the card's top is the same at the press and at the click, and once the
 *     thread has loaded the comment field and Show less stand in the visible column above the dock;
 *   - React saves: comment_react is sent for the comment and React reads Reacted;
 *   - Reply saves: the field holds focus right after the tap, and comment_post carries the parent;
 *     the reply renders under it;
 *   - Show less returns to /feed with the card collapsed at the place it held under the lens seat
 *     before it opened (the seat's own height can change with the scope line's latch, 405);
 *   - React and Reply survive a reload: the post landed on directly reads Reacted and the reply;
 *   - no page errors.
 * The iPhone keyboard (Done Means 3) cannot be driven on Linux WebKit; its proof is the founder's
 * walk on the deployment (627).
 */
async function runCommentsLanding(browserType, bname, vp, theme) {
  const [w, h] = vp;
  const tag = `${bname} ${w}x${h} ${theme} comments-g1`;
  M.armStart(tag);
  const { browser, page, errors } = await open(browserType, vp, theme);
  const db = makeMockDb();
  seedPosts(db, 4);
  const at2 = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600e3).toISOString();
  for (let i = 0; i < 6; i++)
    db.comments.push({
      id: "g1-" + i,
      post_id: "seed-1",
      parent_id: null,
      author_id: (i % 2 ? ngozi : kwame).id,
      body:
        "A comment the member reads before they answer, number " +
        ["one", "two", "three"][i % 3] +
        ".",
      media: null,
      created_at: at2(30 - i),
      person: i % 2 ? ngozi : kwame,
    });
  db.membersById = db.membersById || {};
  for (const m of [lerato, ngozi, kwame]) db.membersById[m.id] = { ...m };
  await mockSupabase(page, db);
  const touch = w < 1024;
  const press = async (locator) => {
    const b = await locator.boundingBox();
    if (!b) throw new Error("no box to press");
    if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  /** A control at the column's middle before a press, clear of the pinned block and the dock. */
  const centre = async (locator) => {
    await locator.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
  };
  /** The visible column: the scroller's box, its foot the fixed dock's top where there is one. */
  const view = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-post-id="seed-1"]');
      const sc = card && card.closest("main, [data-shell-scroller]");
      const scroller =
        [...document.querySelectorAll("*")].find(
          (e) =>
            e.contains(card) &&
            getComputedStyle(e).overflowY === "auto" &&
            e.scrollHeight > e.clientHeight,
        ) || sc;
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
      const dock = document.querySelector('[data-pulse="dock"]');
      const foot =
        dock && getComputedStyle(dock).position === "fixed"
          ? Math.min(box.bottom, dock.getBoundingClientRect().top)
          : box.bottom;
      const rect = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
      };
      const seat = document.querySelector("[data-lens-anchor]");
      const seatBottom = seat ? seat.getBoundingClientRect().bottom : 0;
      return {
        path: location.pathname,
        top: card ? Math.round(card.getBoundingClientRect().top) : null,
        underSeat: card ? Math.round(card.getBoundingClientRect().top - seatBottom) : null,
        visTop: Math.round(box.top),
        foot: Math.round(foot),
        field: rect('[data-post-id="seed-1"] [data-comment-field]'),
        close: rect('[data-post-id="seed-1"] [data-comments-close]'),
        thread: !!document.querySelector('[data-post-id="seed-1"] [data-comment-thread]'),
      };
    });
  const inView = (r, v) => !!r && r.top >= v.visTop && r.bottom <= v.foot + 1;
  try {
    await signIn(page);
    const card = page.locator('[data-post-id="seed-1"]');
    await card.locator('[data-testid="respond"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const before = await view();

    // 1. The comment control.
    await page.evaluate(() => {
      const top = () =>
        Math.round(document.querySelector('[data-post-id="seed-1"]').getBoundingClientRect().top);
      window.__g1 = [];
      const rec = () => window.__g1.push(top());
      addEventListener("pointerdown", rec, { capture: true, once: true });
      addEventListener("click", rec, { capture: true, once: true });
    });
    await press(card.locator('[data-testid="respond"]'));
    await page.locator('[data-post-id="seed-1"] [data-comment-id="g1-5"]').waitFor();
    // The landing's settle pass runs 600 ms after the first; read the page once both have run.
    await page.waitForTimeout(2000);
    const tops = await page.evaluate(() => window.__g1);
    const landed = await view();
    record(
      tag +
        " the comment control: the card holds still under the press, and the comment field and Show less land in view (1905)",
      tops.length === 2 &&
        tops[0] === before.top &&
        tops[1] === before.top &&
        landed.path === "/posts/seed-1" &&
        inView(landed.field, landed) &&
        inView(landed.close, landed),
      JSON.stringify({ tops, before: before.top, landed }),
    );

    // 2. React, by touch at 390 and 820; at 1280 with the post's bar open above the thread.
    const row = card.locator('[data-comment-id="g1-0"]');
    const react = row.locator("[data-comment-react]").first();
    await centre(react);
    let postBar = null;
    if (!touch) {
      // The pointer crosses the post's own React on its way down, as the walk's did; its bar opens
      // over the thread, and the comment's React sits under it.
      const heart = card.locator('[data-testid="react"]').first();
      const hb = await heart.boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.waitForTimeout(300);
      postBar = await card.locator(":scope > * [data-reaction-below]").count();
      const rb = await react.boundingBox();
      await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 4 });
      await page.waitForTimeout(300);
    }
    await press(react);
    await page.waitForTimeout(600);
    const reacts = db.rpcPayloads.filter((x) => x.fn === "comment_react");
    record(
      tag +
        (touch
          ? " a tap on a comment's React sends comment_react and reads Reacted (1905, 1817)"
          : " with the post's bar open, a press on a comment's React sends comment_react and reads Reacted (1905, 1739)"),
      reacts.length === 1 &&
        reacts[0].body.p_comment === "g1-0" &&
        reacts[0].body.p_kind === "asante" &&
        (await react.getAttribute("aria-pressed")) === "true" &&
        (touch || postBar > 0),
      JSON.stringify({ reacts: reacts.map((x) => x.body), postBar }),
    );

    // 3. Reply.
    await page.mouse.move(2, 2);
    const reply = row.locator("[data-comment-reply]").first();
    await centre(reply);
    await press(reply);
    const focused = await page.evaluate(
      () => document.activeElement && document.activeElement.hasAttribute("data-comment-field"),
    );
    await page.waitForTimeout(400);
    await card.locator("[data-comment-field]").fill("A reply from the landing arm.");
    await centre(card.locator("[data-comment-send]"));
    await press(card.locator("[data-comment-send]"));
    await page.waitForTimeout(600);
    const posted = db.rpcPayloads.filter((x) => x.fn === "comment_post").pop();
    const under = await row.locator('[data-comment="reply"]').allTextContents();
    record(
      tag +
        " Reply: the field holds focus right after the tap, and comment_post carries the parent (1905, 1677)",
      focused === true &&
        !!posted &&
        posted.body.p_parent === "g1-0" &&
        under.some((t) => t.includes("A reply from the landing arm.")),
      JSON.stringify({ focused, posted: posted && posted.body, under: under.length }),
    );

    // 4. Show less, from the box's foot.
    const close = card.locator("[data-comments-close]");
    await centre(close);
    await press(close);
    await page.waitForURL("**/feed", { timeout: 10000 });
    await page.waitForTimeout(800);
    const back = await view();
    record(
      tag + " Show less returns to the Feed with the card closed where it was (1905)",
      back.path === "/feed" &&
        !back.thread &&
        Math.abs(back.underSeat - before.underSeat) <= 1 &&
        back.top >= back.visTop &&
        back.top < back.foot,
      JSON.stringify({ before: before.underSeat, after: back.underSeat, back }),
    );

    // 5. Both survive a reload.
    await page.goto(M.BASE + "/posts/seed-1", { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    const row2 = page.locator('[data-post-id="seed-1"] [data-comment-id="g1-0"]');
    await row2.waitFor({ timeout: 10000 });
    const pressed = await row2.locator("[data-comment-react]").first().getAttribute("aria-pressed");
    const replies = await row2.locator('[data-comment="reply"]').allTextContents();
    record(
      tag + " React and Reply survive a reload (1905)",
      pressed === "true" && replies.some((t) => t.includes("A reply from the landing arm.")),
      JSON.stringify({ pressed, replies: replies.length }),
    );
    record(tag + " no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }
}

module.exports = { runComments, runCommentsLanding, FLOW_CELLS };
