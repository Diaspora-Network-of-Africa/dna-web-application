// Brief 14, handoff 41-C: the Messenger's mock, served by tests/matrix.cjs's mockSupabase for the
// responsive arms (tests/messenger.cjs `runMessengerLayout`). The fixture is EXTRACTION-41-14 section
// 6 as the mock member (Amara Osei) sees it, shaped as the three 41-A projections answer it, so the
// surfaces read exactly what the deployment would: no count column, names cut at three with
// `others`, ticks on own rows, a blocked author's body null. Writes answer as the wrappers do and
// move the fixture, so a flow can read its own effect. Nothing here is accurate about anyone.
const { randomUUID } = require("crypto");

const UID = "00000000-0000-4000-8000-0000000000e1";

const ids = {
  kofi: "11111111-1111-4111-8111-111111111001",
  group: "11111111-1111-4111-8111-111111111002",
  nana: "11111111-1111-4111-8111-111111111003",
  event: "11111111-1111-4111-8111-111111111004",
  space: "11111111-1111-4111-8111-111111111005",
  kwame: "11111111-1111-4111-8111-111111111006",
  book: "11111111-1111-4111-8111-111111111007",
  esi: "11111111-1111-4111-8111-111111111008",
  /** Fix PR 10 items 8 and 9: a group the member is invited to, pushed by the arm that reads it. */
  invited: "11111111-1111-4111-8111-111111111009",
};
/** The media id of the portrait video in Nana's thread; the reactions arm serves its bytes itself. */
const VIDEO_MEDIA = "33333333-3333-4333-8333-333333333001";

const members = {
  kofi: {
    id: "22222222-2222-4222-8222-222222222001",
    name: "Kofi Boateng",
    headline: "Cold chain logistics, Tema",
  },
  nana: {
    id: "22222222-2222-4222-8222-222222222002",
    name: "Nana Adjei",
    headline: "Community organiser, Osu",
  },
  esi: {
    id: "22222222-2222-4222-8222-222222222003",
    name: "Esi Owusu",
    headline: "Bookkeeper, Kumasi",
  },
  kwame: {
    id: "22222222-2222-4222-8222-222222222004",
    name: "Kwame Mensah",
    headline: "Host, Corridor Suppers",
  },
  adwoa: {
    id: "22222222-2222-4222-8222-222222222005",
    name: "Adwoa Asante",
    headline: "Product designer, Berlin",
  },
  yaa: {
    id: "22222222-2222-4222-8222-222222222006",
    name: "Yaa Mensah",
    headline: "Events, Accra",
  },
  ama: {
    id: "22222222-2222-4222-8222-222222222007",
    name: "Ama Darko",
    headline: "Port operations, Tema",
  },
  femi: {
    id: "22222222-2222-4222-8222-222222222008",
    name: "Femi Adeyemi",
    headline: "Solar finance, Lagos",
  },
  tunde: {
    id: "22222222-2222-4222-8222-222222222009",
    name: "Tunde Bakare",
    headline: "Recruiter, Manchester",
  },
};

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** An instant `days` back at `hh:mm` local, so the day separators read as the extraction names them. */
function at(days, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function msg(threadId, seq, author, body, created, extra = {}) {
  const own = author === UID;
  return {
    message_id: randomUUID(),
    thread_id: threadId,
    seq,
    author_id: author,
    author_name: own ? "Amara Osei" : extra.author_name || "",
    author_avatar_path: null,
    former_member: false,
    body,
    kind: "text",
    media_id: null,
    link_preview: null,
    reply_to: null,
    reactions: [],
    edited: false,
    deleted: false,
    pinned: false,
    blocked: false,
    own,
    tick: own ? 1 : null,
    read_by: null,
    read_by_others: false,
    mentions: null,
    created_at: created,
    edited_at: null,
    media_word: null,
    media_width: null,
    media_height: null,
    ...extra,
  };
}

/**
 * Fix PR 10 items 8 and 9 (1623, 1637, 1638): a community group Esi invited the member to, as
 * messenger_threads_view answers the invitee's own row: state invited, no last line, the inviter
 * named in invited_by_name. Not in the fixture's list, because the layout arm counts seven live
 * rows; the arm that reads it pushes it into M.threads and the kind's row into db.notifications.
 */
function invitedGroupThread(now = Date.now()) {
  return {
    thread_id: ids.invited,
    kind: "community_group",
    name: "Tema cold chain",
    headline: null,
    avatar_path: null,
    other_member_id: null,
    member_names: ["Esi Owusu", "Adwoa Asante"],
    others: false,
    last_line: null,
    last_kind: null,
    last_author_id: null,
    last_seq: null,
    last_activity_at: new Date(now - 10 * MIN).toISOString(),
    unread: false,
    muted: false,
    archived: false,
    pinned: false,
    pinned_at: null,
    invited: true,
    role: "member",
    state: "invited",
    read_seq: 0,
    delivered_seq: 0,
    anchor_kind: null,
    anchor_id: null,
    parent_thread_id: null,
    history_visible_to_new: false,
    created_at: new Date(now - 10 * MIN).toISOString(),
    invited_names: [],
    invited_others: false,
    invited_by_name: "Esi Owusu",
  };
}

/** The bell row the invitation writes (1637), for db.notifications. */
function invitedGroupNotification(now = Date.now()) {
  return {
    id: "n-thread-invitation",
    recipient_member_id: UID,
    kind: "thread_invitation",
    c_category: "connect",
    actor_kind: "member",
    actor_id: members.esi.id,
    object_kind: "thread",
    object_id: ids.invited,
    read_at: null,
    seen_at: null,
    created_at: new Date(now - 10 * MIN).toISOString(),
  };
}

function messengerFixture() {
  const now = Date.now();
  const threads = [
    {
      thread_id: ids.kofi,
      kind: "one_to_one",
      name: members.kofi.name,
      headline: members.kofi.headline,
      avatar_path: null,
      other_member_id: members.kofi.id,
      member_names: [members.kofi.name],
      others: false,
      last_line: "Call me when you can.",
      last_kind: "text",
      last_author_id: UID,
      last_seq: 10,
      last_activity_at: new Date(now - 20_000).toISOString(),
      unread: false,
      muted: false,
      archived: false,
      pinned: true,
      pinned_at: at(3, 9, 0),
      invited: false,
      role: "member",
      state: "active",
      read_seq: 10,
      delivered_seq: 10,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(10, 9, 0),
    },
    {
      thread_id: ids.group,
      kind: "community_group",
      name: "Accra returnees",
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: ["Ama Darko", "Kofi Boateng", "Nana Adjei"],
      others: true,
      last_line: "Running late on Thursday but on my way.",
      last_kind: "text",
      last_author_id: members.esi.id,
      last_seq: 6,
      last_activity_at: new Date(now - 3 * HOUR).toISOString(),
      unread: true,
      muted: false,
      archived: false,
      pinned: true,
      pinned_at: at(4, 9, 0),
      invited: false,
      role: "lead",
      state: "active",
      read_seq: 4,
      delivered_seq: 6,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: false,
      created_at: at(30, 9, 0),
    },
    {
      thread_id: ids.nana,
      kind: "one_to_one",
      name: members.nana.name,
      headline: members.nana.headline,
      avatar_path: null,
      other_member_id: members.nana.id,
      member_names: [members.nana.name],
      others: false,
      last_line: "Lunch next week?",
      last_kind: "text",
      last_author_id: members.nana.id,
      last_seq: 1,
      last_activity_at: at(1, 20, 11),
      unread: true,
      muted: true,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 0,
      delivered_seq: 1,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(12, 9, 0),
    },
    {
      thread_id: ids.event,
      kind: "event_thread",
      name: "Corridor Suppers: Accra",
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: ["Kwame Mensah", "Nana Adjei"],
      others: false,
      last_line: "Can I bring Kofi?",
      last_kind: "text",
      last_author_id: UID,
      last_seq: 3,
      last_activity_at: at(1, 10, 20),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 3,
      delivered_seq: 3,
      anchor_kind: "event",
      anchor_id: "33333333-3333-4333-8333-333333333001",
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(5, 9, 0),
    },
    {
      thread_id: ids.space,
      kind: "space_thread",
      name: "Tema cold chain",
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: ["Kwame Mensah", "Kofi Boateng", "Ama Darko"],
      others: true,
      last_line: "Noted. I will share the port notice here once Kofi sends it.",
      last_kind: "text",
      last_author_id: UID,
      last_seq: 2,
      last_activity_at: at(2, 8, 45),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 2,
      delivered_seq: 2,
      anchor_kind: "space",
      anchor_id: "44444444-4444-4444-8444-444444444001",
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(20, 9, 0),
    },
    {
      thread_id: ids.kwame,
      kind: "one_to_one",
      name: members.kwame.name,
      headline: members.kwame.headline,
      avatar_path: null,
      other_member_id: members.kwame.id,
      member_names: [members.kwame.name],
      others: false,
      last_line: "Good to meet you at the gathering. Let us talk about the harvest.",
      last_kind: "text",
      last_author_id: members.kwame.id,
      last_seq: 1,
      last_activity_at: at(8, 22, 30),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 1,
      delivered_seq: 1,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(8, 22, 0),
    },
    {
      thread_id: ids.book,
      kind: "community_group",
      name: "Diaspora bookkeepers",
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: ["Esi Owusu", "Adwoa Asante"],
      others: false,
      last_line: null,
      last_kind: null,
      last_author_id: null,
      last_seq: null,
      last_activity_at: at(9, 9, 0),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "lead",
      state: "active",
      read_seq: 0,
      delivered_seq: 0,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: false,
      created_at: at(9, 9, 0),
    },
    {
      thread_id: ids.esi,
      kind: "one_to_one",
      name: members.esi.name,
      headline: members.esi.headline,
      avatar_path: null,
      other_member_id: members.esi.id,
      member_names: [members.esi.name],
      others: false,
      last_line: "Thanks for the intro to Adwoa.",
      last_kind: "text",
      last_author_id: members.esi.id,
      last_seq: 1,
      last_activity_at: at(31, 14, 0),
      unread: false,
      muted: false,
      archived: true,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 1,
      delivered_seq: 1,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: at(40, 9, 0),
    },
  ];
  const K = members.kofi.id;
  const kofiMsgs = [
    msg(
      ids.kofi,
      1,
      K,
      "The buyer from Tema came through. Cold storage at the port from November.",
      at(3, 9, 14),
      { author_name: members.kofi.name },
    ),
    msg(ids.kofi, 2, UID, "That is the one from the supper?", at(3, 9, 20), {
      tick: 3,
      // 41-E (1577): the character; the mock keeps the quick eight's base forms as the seed writes them.
      reactions: [
        { reaction: "\u{1F44D}\uFE0F", names: ["Kofi Boateng"], others: false, own: false },
      ],
    }),
    msg(ids.kofi, 3, UID, "Well done. Send the route plan when you have it.", at(3, 11, 10), {
      tick: 3,
      edited: true,
      edited_at: at(3, 11, 12),
    }),
    msg(ids.kofi, 4, UID, null, at(1, 18, 52), { deleted: true }),
    msg(
      ids.kofi,
      5,
      K,
      "The port notice is here https://tema-port.gov.gh/notices/cold-chain",
      at(1, 19, 5),
      {
        author_name: members.kofi.name,
        link_preview: {
          url: "https://tema-port.gov.gh/notices/cold-chain",
          domain: "tema-port.gov.gh",
          title: "Cold chain handling notice, November onward",
          image_url: null,
        },
      },
    ),
    msg(ids.kofi, 6, K, "Yes, the port signed off.", at(0, 8, 15), {
      author_name: members.kofi.name,
    }),
    msg(ids.kofi, 7, UID, "Did the cold chain buyer get back to you?", at(0, 8, 30), { tick: 2 }),
    msg(ids.kofi, 8, UID, "Call me when you can.", at(0, 8, 31), { tick: 1 }),
  ];
  kofiMsgs[2].reply_to = {
    message_id: kofiMsgs[0].message_id,
    seq: 1,
    author_name: members.kofi.name,
    kind: "text",
    deleted: false,
    line: kofiMsgs[0].body,
  };
  const G = ids.group;
  const groupMsgs = [
    msg(G, 1, members.nana.id, "Who is coming to the Thursday meetup at Osu?", at(1, 12, 2), {
      author_name: members.nana.name,
      pinned: true,
    }),
    msg(G, 2, members.yaa.id, null, at(1, 12, 10), {
      author_name: members.yaa.name,
      blocked: true,
    }),
    msg(G, 3, members.ama.id, "@Amara Osei can you confirm the room?", at(1, 12, 30), {
      author_name: members.ama.name,
      mentions: [UID],
    }),
    msg(G, 4, UID, "Confirmed. Room on the first floor.", at(1, 13, 5), {
      tick: 3,
      read_by: ["Ama Darko", "Kofi Boateng", "Nana Adjei"],
      read_by_others: true,
      // The extraction's fixture reads "Thanks by Ama and Nana"; here the reaction carries
      // others so the arm reads the one joiner's "and others" shape (handoff 41-C, ruled in Chat).
      reactions: [
        {
          reaction: "\u{1F64F}",
          names: ["Ama Darko", "Kofi Boateng", "Nana Adjei"],
          others: true,
          own: false,
        },
      ],
    }),
    msg(G, 5, members.kofi.id, "The room from last time.", at(1, 16, 40), {
      author_name: members.kofi.name,
    }),
    msg(G, 6, members.esi.id, "Running late on Thursday but on my way.", at(0, 7, 58), {
      author_name: members.esi.name,
    }),
  ];
  const messages = {
    [ids.kofi]: kofiMsgs,
    [ids.group]: groupMsgs,
    [ids.nana]: [
      msg(ids.nana, 1, members.nana.id, "Lunch next week?", at(1, 20, 11), {
        author_name: members.nana.name,
      }),
      // 41-E (1593): a received portrait video, its dimensions on the row; the bytes come from the
      // arm's own route on /api/messages/media/{id}.
      msg(ids.nana, 2, members.nana.id, null, at(1, 20, 15), {
        author_name: members.nana.name,
        kind: "media",
        media_id: VIDEO_MEDIA,
        media_word: "Video",
        media_width: 124,
        media_height: 320,
      }),
    ],
    [ids.event]: [
      msg(ids.event, 1, members.kwame.id, "Doors at seven. Come hungry.", at(1, 10, 0), {
        author_name: members.kwame.name,
      }),
      msg(
        ids.event,
        2,
        members.nana.id,
        "Bringing two guests, both from the port.",
        at(1, 10, 12),
        { author_name: members.nana.name },
      ),
      msg(ids.event, 3, UID, "Can I bring Kofi?", at(1, 10, 20), { tick: 2 }),
    ],
    [ids.space]: [
      msg(
        ids.space,
        1,
        members.kwame.id,
        "Welcome to the Space thread. Keep it to the cold chain work.",
        at(2, 8, 0),
        { author_name: members.kwame.name },
      ),
      msg(
        ids.space,
        2,
        UID,
        "Noted. I will share the port notice here once Kofi sends it.",
        at(2, 8, 45),
        { tick: 2 },
      ),
    ],
    [ids.kwame]: [
      msg(
        ids.kwame,
        1,
        members.kwame.id,
        "Good to meet you at the gathering. Let us talk about the harvest.",
        at(8, 22, 30),
        { author_name: members.kwame.name },
      ),
    ],
    [ids.book]: [],
    [ids.esi]: [
      msg(ids.esi, 1, members.esi.id, "Thanks for the intro to Adwoa.", at(31, 14, 0), {
        author_name: members.esi.name,
      }),
    ],
  };
  const requests = [
    {
      request_id: "55555555-5555-4555-8555-555555555001",
      sender_id: members.ama.id,
      sender_name: members.ama.name,
      sender_handle: "ama-darko",
      sender_headline: members.ama.headline,
      sender_avatar_path: null,
      sender_stance: "Returnee",
      body: "We met through Kofi at the port. I run operations there and would like to compare notes on the November window, see tema-port.gov.gh/notices.",
      state: "pending",
      created_at: new Date(now - 7 * DAY).toISOString(),
      decided_at: null,
      mutual_names: ["Kofi Boateng", "Nana Adjei"],
      mutual_others: false,
      shared_space_names: ["Accra returnees"],
      shared_space_others: false,
    },
    {
      request_id: "55555555-5555-4555-8555-555555555002",
      sender_id: members.femi.id,
      sender_name: members.femi.name,
      sender_handle: "femi-adeyemi",
      sender_headline: members.femi.headline,
      sender_avatar_path: null,
      sender_stance: "Continental",
      body: "Your post on cold storage finance matched a fund I advise. Open to a conversation?",
      state: "pending",
      created_at: new Date(now - 2 * DAY).toISOString(),
      decided_at: null,
      mutual_names: ["Kwame Mensah"],
      mutual_others: false,
      shared_space_names: [],
      shared_space_others: false,
    },
    {
      request_id: "55555555-5555-4555-8555-555555555003",
      sender_id: members.tunde.id,
      sender_name: members.tunde.name,
      sender_handle: "tunde-bakare",
      sender_headline: members.tunde.headline,
      sender_avatar_path: null,
      sender_stance: "Diaspora",
      body: "Hiring for a logistics lead in Manchester. Interested?",
      state: "declined",
      created_at: new Date(now - 9 * DAY).toISOString(),
      decided_at: new Date(now - 8 * DAY).toISOString(),
      mutual_names: [],
      mutual_others: false,
      shared_space_names: [],
      shared_space_others: false,
    },
  ];
  // Handoff 41-D (held item 4): the projection names the last author, "a former member" for one
  // who deleted their account; the mock member is Amara Osei.
  const nameOf = (id) =>
    id === UID
      ? "Amara Osei"
      : (Object.values(members).find((m) => m.id === id) || {}).name || null;
  for (const t of threads) t.last_author_name = t.last_author_id ? nameOf(t.last_author_id) : null;
  return {
    ids,
    members,
    threads,
    messages,
    requests,
    // Set by an arm to make messenger_settings_set refuse (handoff 61-S1).
    settingsFail: false,
    settings: {
      member_id: UID,
      receipts_enabled: false,
      receipts_chosen_at: new Date(now - 30 * DAY).toISOString(),
      link_previews_enabled: false,
      media_notice_seen_at: new Date(now - 30 * DAY).toISOString(),
      reaction_skin_tone: null,
      updated_at: new Date(now - 30 * DAY).toISOString(),
    },
    /** 41-E (1405): the member's recent emoji, newest first, as messenger_recent_reactions answers. */
    recent: [],
    signals: [
      {
        signal_key: "request:55555555-5555-4555-8555-555555555001",
        line: "Ama Darko sent you a message request a week ago",
        thread_id: null,
        request_id: "55555555-5555-4555-8555-555555555001",
      },
      {
        signal_key: "quiet:" + ids.kwame,
        line: "You and Kwame Mensah were both at the Accra gathering and have not spoken in a while",
        thread_id: ids.kwame,
        request_id: null,
      },
    ],
    writes: [],
    /** Review toggles a flow can set before opening the page. */
    fail: null,
    firstOpen: false,
  };
}

const VOCAB_KEYS = {
  thread_kinds: [
    { value: "one_to_one", label: "One to one", surfaced: true },
    { value: "community_group", label: "Community group", surfaced: true },
    { value: "space_thread", label: "Space thread", surfaced: true },
    { value: "space_topic", label: "Space topic", surfaced: true },
    { value: "event_thread", label: "Event thread", surfaced: true },
    { value: "respond", label: "Respond", surfaced: false },
    { value: "introduction", label: "Introduction", surfaced: false },
  ],
  message_mute_durations: [
    { value: "eight_hours", label: "8 hours" },
    { value: "one_week", label: "1 week" },
    { value: "always", label: "Always" },
  ],
  message_report_reasons: [
    { value: "harassment", label: "Harassment" },
    { value: "spam_or_scam", label: "Spam or a scam" },
    { value: "hate_or_threat", label: "Hate or a threat" },
    { value: "sexual_content", label: "Sexual content" },
    { value: "impersonation", label: "Impersonation" },
    { value: "other", label: "Something else" },
  ],
  // 41-E (1403, 1577): the quick eight, the character as the seed writes it and E9's name.
  message_reaction_quick: [
    { value: "\u{1F44D}\uFE0F", label: "Thumbs up" },
    { value: "\u2764\uFE0F", label: "Heart" },
    { value: "\u{1F64F}", label: "Folded hands" },
    { value: "\u{1F44F}", label: "Clapping" },
    { value: "\u{1F389}", label: "Party" },
    { value: "\u{1F602}", label: "Laughing" },
    { value: "\u{1F62E}", label: "Surprised" },
    { value: "\u{1F622}", label: "Crying" },
  ],
};

function eq(url, key) {
  const v = url.searchParams.get(key);
  return v && v.startsWith("eq.") ? v.slice(3) : null;
}

/**
 * Answers a Messenger request from the fixture, or returns false for a path that is not one.
 * `json(body, status)` fulfils the route; `req` is the Playwright request.
 */
async function handleMessenger({ p, method, url, req, json, db }) {
  const M = db.messenger;
  if (!M) return false;
  const single = (req.headers()["accept"] || "").includes("object");
  const refuse = (word, code = "P0001") =>
    json({ code, message: word, details: null, hint: null }, 400);
  if (p === "/rest/v1/messenger_threads_view") {
    if (M.fail === "threads")
      return json({ code: "PGRST", message: "forced", details: null, hint: null }, 500);
    const id = eq(url, "thread_id");
    const idIn = (url.searchParams.get("thread_id") || "").match(/^in\.\((.*)\)$/);
    const set = idIn ? idIn[1].split(",").map((x) => x.replace(/^"|"$/g, "")) : null;
    // 41-E (1592): every row carries invited_names and invited_others, empty where the fixture names
    // none; Fix PR 10 (1638): and invited_by_name, null where the viewer is not invited.
    let rows = M.threads
      .filter((t) => (!id || t.thread_id === id) && (!set || set.includes(t.thread_id)))
      .map((t) => ({ invited_names: [], invited_others: false, invited_by_name: null, ...t }));
    rows = rows.slice().sort((a, b) => {
      const pa = a.pinned_at ? 1 : 0;
      const pb = b.pinned_at ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (b.last_activity_at || "").localeCompare(a.last_activity_at || "");
    });
    return single ? json(rows[0] || null, rows[0] ? 200 : 406) : json(rows);
  }
  if (p === "/rest/v1/messenger_requests_view") return json(M.requests.slice());
  if (p === "/rest/v1/messenger_messages_view") {
    const t = eq(url, "thread_id");
    let rows = t ? (M.messages[t] || []).slice() : Object.values(M.messages).flat();
    const seq = url.searchParams.get("seq");
    const ids = url.searchParams.get("message_id");
    if (seq && seq.startsWith("eq.")) rows = rows.filter((m) => m.seq === Number(seq.slice(3)));
    if (seq && seq.startsWith("gt.")) rows = rows.filter((m) => m.seq > Number(seq.slice(3)));
    if (seq && seq.startsWith("lt.")) rows = rows.filter((m) => m.seq < Number(seq.slice(3)));
    if (seq && seq.startsWith("in.")) {
      const set = seq.slice(4, -1).split(",").map(Number);
      rows = rows.filter((m) => set.includes(m.seq));
    }
    if (ids && ids.startsWith("in.")) {
      const set = ids
        .slice(4, -1)
        .split(",")
        .map((s) => s.replace(/^"|"$/g, ""));
      rows = rows.filter((m) => set.includes(m.message_id));
    }
    const order = url.searchParams.get("order") || "";
    rows.sort((a, b) => (order.includes("desc") ? b.seq - a.seq : a.seq - b.seq));
    const limit = Number(url.searchParams.get("limit") || 0);
    if (limit) rows = rows.slice(0, limit);
    return single ? json(rows[0] || null, rows[0] ? 200 : 406) : json(rows);
  }
  if (p === "/rest/v1/thread_members") {
    const t = eq(url, "thread_id");
    const th = M.threads.find((x) => x.thread_id === t);
    if (!th) return json([]);
    const names = th.member_names || [];
    const invitedNames = th.invited_names || [];
    const all = Object.values(M.members).filter((m) => names.includes(m.name));
    const invited = Object.values(M.members).filter((m) => invitedNames.includes(m.name));
    return json([
      { member_id: UID, role: th.role, state: "active" },
      ...all.map((m) => ({ member_id: m.id, role: "member", state: "active" })),
      ...invited.map((m) => ({ member_id: m.id, role: "member", state: "invited" })),
    ]);
  }
  // Only the thread's member-name read (MessengerThread: select id,name, id in (...)). Every other
  // members read, the signed-in member's own handle among them (src/lib/auth.tsx), falls through to
  // matrix.cjs's handler.
  const idIn = (url.searchParams.get("id") || "").match(/^in\.\((.*)\)$/);
  if (
    p === "/rest/v1/members" &&
    method === "GET" &&
    idIn &&
    url.searchParams.get("select") === "id,name"
  ) {
    const set = idIn[1].split(",").map((s) => s.replace(/^"|"$/g, ""));
    const rows = [
      { id: UID, name: "Amara Osei" },
      ...Object.values(M.members).map((x) => ({ id: x.id, name: x.name })),
    ];
    return json(rows.filter((r) => set.includes(r.id)));
  }
  // Reads only: the profile's block control writes member_blocks through matrix.cjs's own handler.
  // Handoff 61-S1: the Account drawer's read embeds the blocked member's row (`select` names
  // `members`) and matrix.cjs answers it from db.account.blocked; this answers the Messenger's own.
  if (
    p === "/rest/v1/member_blocks" &&
    method === "GET" &&
    !(url.searchParams.get("select") || "").includes("members")
  )
    return json([{ blocked_id: M.members.yaa.id }]);
  if (p === "/rest/v1/threads" && method === "GET") return json([]);
  if (!p.startsWith("/rest/v1/rpc/messenger_")) return false;
  const fn = p.slice("/rest/v1/rpc/".length);
  const body = method === "POST" ? req.postDataJSON() || {} : {};
  M.writes.push({ fn, body });
  await new Promise((r) => setTimeout(r, 60));
  if (fn === "messenger_settings")
    return json(
      M.firstOpen
        ? { ...M.settings, receipts_chosen_at: null, media_notice_seen_at: null }
        : M.settings,
    );
  if (fn === "messenger_settings_set") {
    // Handoff 61-S1 (tests/account.cjs): the Account drawer's failed-save states (M5, M6).
    if (M.settingsFail) return json({ code: "P0001", message: "That did not save." }, 400);
    if (body.p_receipts !== undefined && body.p_receipts !== null) {
      M.settings.receipts_enabled = body.p_receipts;
      M.settings.receipts_chosen_at = new Date().toISOString();
    }
    if (body.p_link_previews !== undefined && body.p_link_previews !== null)
      M.settings.link_previews_enabled = body.p_link_previews;
    if (body.p_media_notice_seen) M.settings.media_notice_seen_at = new Date().toISOString();
    // 41-E (1576): null leaves it, 'none' clears it, a modifier sets it.
    if (body.p_skin_tone !== undefined && body.p_skin_tone !== null)
      M.settings.reaction_skin_tone = body.p_skin_tone === "none" ? null : body.p_skin_tone;
    M.firstOpen = false;
    return json(M.settings);
  }
  if (fn === "messenger_recent_reactions") return json(M.recent.slice(0, 24));
  if (fn === "messenger_dia_signals") return json(M.signals);
  if (fn === "messenger_dia_dismiss") {
    M.signals = M.signals.filter((s) => s.signal_key !== body.p_key);
    return json(null, 204);
  }
  if (fn === "messenger_search") {
    const q = String(body.p_query || "").toLowerCase();
    const hits = [];
    for (const [tid, list] of Object.entries(M.messages)) {
      if (body.p_thread && body.p_thread !== tid) continue;
      for (const m of list) {
        // 41-E (1591): a system row is never a hit.
        if (m.kind === "system") continue;
        if (m.deleted || !m.body || !m.body.toLowerCase().includes(q)) continue;
        if (body.p_member && m.author_id !== body.p_member) continue;
        if (body.p_before && !(m.created_at < body.p_before)) continue;
        if (body.p_after && !(m.created_at >= body.p_after)) continue;
        hits.push({
          thread_id: tid,
          message_id: m.message_id,
          seq: m.seq,
          created_at: m.created_at,
          headline: m.body,
        });
      }
    }
    hits.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json(hits);
  }
  if (fn === "messenger_send") {
    if (M.fail === "send") return refuse("rate_limited");
    const t = body.p_thread;
    const list = M.messages[t] || (M.messages[t] = []);
    const existing = list.find((m) => m.client_id === body.p_client_id);
    if (existing) return json(existing);
    const seq = (list.length ? list[list.length - 1].seq : 0) + 1;
    const row = msg(t, seq, UID, body.p_body || null, new Date().toISOString(), {
      kind: body.p_kind || "text",
      media_id: body.p_media || null,
      link_preview: body.p_link_preview || null,
    });
    row.client_id = body.p_client_id;
    if (body.p_reply_to) {
      const q = list.find((m) => m.message_id === body.p_reply_to);
      if (q)
        row.reply_to = {
          message_id: q.message_id,
          seq: q.seq,
          author_name: q.own ? "Amara Osei" : q.author_name,
          kind: q.kind,
          deleted: q.deleted,
          line: q.body,
        };
    }
    list.push(row);
    const th = M.threads.find((x) => x.thread_id === t);
    if (th) {
      th.last_line = row.body;
      th.last_kind = row.kind;
      th.last_author_id = UID;
      th.last_seq = seq;
      th.last_activity_at = row.created_at;
      th.archived = false;
    }
    return json({
      id: row.message_id,
      thread_id: t,
      seq,
      client_id: body.p_client_id,
      author_id: UID,
      kind: row.kind,
      body: row.body,
      reply_to: body.p_reply_to || null,
      media_id: row.media_id,
      link_preview: row.link_preview,
      created_at: row.created_at,
      edited_at: null,
      deleted_at: null,
      pinned_by: null,
      author_deleted_at: null,
      search: null,
    });
  }
  const find = (id) => {
    for (const list of Object.values(M.messages)) {
      const m = list.find((x) => x.message_id === id);
      if (m) return m;
    }
    return null;
  };
  if (fn === "messenger_edit") {
    const m = find(body.p_message);
    if (m) {
      m.body = body.p_body;
      m.edited = true;
      m.edited_at = new Date().toISOString();
    }
    return json(m ? { id: m.message_id, seq: m.seq } : null, m ? 200 : 400);
  }
  if (fn === "messenger_delete") {
    const m = find(body.p_message);
    if (m) {
      m.deleted = true;
      m.body = null;
      m.reactions = [];
      m.pinned = false;
      m.link_preview = null;
      m.media_id = null;
    }
    return json({ message_id: body.p_message, storage_path: null });
  }
  if (fn === "messenger_react" || fn === "messenger_unreact") {
    // 41-E (1590, 1577): one row per member, the character as sent; a face refuses a modifier.
    const m = find(body.p_message);
    const reaction = String(body.p_reaction || "");
    const base = reaction.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "").replace(/\uFE0F/g, "");
    const hands = ["\u{1F44D}", "\u{1F64F}", "\u{1F44F}"];
    if (
      fn === "messenger_react" &&
      /[\u{1F3FB}-\u{1F3FF}]/u.test(reaction) &&
      !hands.includes(base)
    )
      return refuse("bad_reaction", "22023");
    if (m) {
      m.reactions = (m.reactions || []).filter((r) => !r.own);
      if (fn === "messenger_react") {
        m.reactions.push({ reaction, names: ["Amara Osei"], others: false, own: true });
        M.recent = [reaction, ...M.recent.filter((x) => x !== reaction)].slice(0, 24);
      }
    }
    return json(null, 204);
  }
  if (fn === "messenger_pin_message" || fn === "messenger_unpin_message") {
    const m = find(body.p_message);
    if (m) {
      for (const x of M.messages[m.thread_id]) x.pinned = false;
      m.pinned = fn === "messenger_pin_message";
    }
    return json(null, 204);
  }
  const thread = () => M.threads.find((x) => x.thread_id === body.p_thread);
  if (fn === "messenger_pin_thread") {
    const pins = M.threads.filter((t) => t.pinned && !t.archived).length;
    if (pins >= 3) return refuse("pins_full");
    const t = thread();
    if (t) {
      t.pinned = true;
      t.pinned_at = new Date().toISOString();
    }
    return json(null, 204);
  }
  if (fn === "messenger_unpin_thread") {
    const t = thread();
    if (t) {
      t.pinned = false;
      t.pinned_at = null;
    }
    return json(null, 204);
  }
  if (fn === "messenger_mark_unread") {
    const t = thread();
    if (t) t.unread = true;
    return json(null, 204);
  }
  if (fn === "messenger_read_to" || fn === "messenger_delivered_to") {
    const t = thread();
    if (t && fn === "messenger_read_to") {
      t.read_seq = Math.max(t.read_seq, body.p_seq);
      t.unread = !!(t.last_seq && t.read_seq < t.last_seq);
    }
    return json(null, 204);
  }
  if (fn === "messenger_mute") {
    const t = thread();
    if (t) t.muted = !!body.p_duration;
    return json(null, 204);
  }
  if (fn === "messenger_archive" || fn === "messenger_unarchive") {
    const t = thread();
    if (t) {
      t.archived = fn === "messenger_archive";
      if (t.archived) {
        t.pinned = false;
        t.pinned_at = null;
      }
    }
    return json(null, 204);
  }
  if (fn === "messenger_request_accept") {
    const r = M.requests.find((x) => x.request_id === body.p_request);
    if (!r) return refuse("not_your_request", "42501");
    M.requests = M.requests.filter((x) => x !== r);
    const id = randomUUID();
    M.threads.unshift({
      thread_id: id,
      kind: "one_to_one",
      name: r.sender_name,
      headline: r.sender_headline,
      avatar_path: null,
      other_member_id: r.sender_id,
      member_names: [r.sender_name],
      others: false,
      last_line: r.body,
      last_kind: "text",
      last_author_id: r.sender_id,
      last_seq: 1,
      last_activity_at: new Date().toISOString(),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "member",
      state: "active",
      read_seq: 1,
      delivered_seq: 1,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: true,
      created_at: new Date().toISOString(),
    });
    M.messages[id] = [
      msg(id, 1, r.sender_id, r.body, new Date().toISOString(), { author_name: r.sender_name }),
    ];
    return json(id);
  }
  if (fn === "messenger_request_decline") {
    const r = M.requests.find((x) => x.request_id === body.p_request);
    if (r) {
      r.state = "declined";
      r.decided_at = new Date().toISOString();
    }
    return json(null, 204);
  }
  if (fn === "messenger_request_recover") {
    const r = M.requests.find((x) => x.request_id === body.p_request);
    if (!r) return refuse("not_your_request", "42501");
    if (r.state !== "declined") return refuse("not_declined");
    r.state = "pending";
    r.decided_at = null;
    return json(null, 204);
  }
  if (fn === "messenger_thread_rename") {
    if (M.fail && M.fail.startsWith("rename:")) return refuse(M.fail.slice(7));
    const t = thread();
    if (!t || t.kind !== "community_group") return refuse("not_renamable");
    t.name = String(body.p_name || "").trim();
    // 41-E (1591): the system row, a fixed event word, never a name.
    const list = M.messages[t.thread_id] || (M.messages[t.thread_id] = []);
    const seq = list.reduce((a, x) => Math.max(a, x.seq), 0) + 1;
    list.push(
      msg(t.thread_id, seq, UID, "renamed", new Date().toISOString(), {
        kind: "system",
        tick: null,
      }),
    );
    return json(null, 204);
  }
  if (fn === "messenger_thread_create_group") {
    // 41-E (1580, 1581): a refusal the arm asked for, else the thread with its picked invited.
    if (M.fail && M.fail.startsWith("create:")) return refuse(M.fail.slice(7));
    const id = randomUUID();
    const picked = Array.isArray(body.p_member_ids) ? body.p_member_ids : [];
    // The picked come from Connect's network fixture (tests/matrix.cjs, loaded by now) as well as
    // the Messenger's own members.
    const known = [...Object.values(M.members), ...require("./matrix.cjs").CONNECT_MEMBERS];
    const names = picked.map((x) => known.find((m) => m.id === x)?.name).filter(Boolean);
    M.threads.unshift({
      thread_id: id,
      kind: "community_group",
      name: String(body.p_name || "").trim(),
      headline: null,
      avatar_path: null,
      other_member_id: null,
      member_names: [],
      others: false,
      last_line: null,
      last_kind: null,
      last_author_id: null,
      last_author_name: null,
      last_seq: null,
      last_activity_at: new Date().toISOString(),
      unread: false,
      muted: false,
      archived: false,
      pinned: false,
      pinned_at: null,
      invited: false,
      role: "lead",
      state: "active",
      read_seq: 0,
      delivered_seq: 0,
      anchor_kind: null,
      anchor_id: null,
      parent_thread_id: null,
      history_visible_to_new: false,
      created_at: new Date().toISOString(),
      invited_names: names.slice(0, 3),
      invited_others: names.length > 3,
    });
    M.messages[id] = [];
    return json(id);
  }
  if (fn === "messenger_request_block") {
    M.requests = M.requests.filter((x) => x.request_id !== body.p_request);
    return json(null, 204);
  }
  if (fn === "messenger_thread_invite_accept" || fn === "messenger_thread_invite_decline") {
    // Fix PR 10 items 8 and 9: Accept makes the viewer's row active, with the inviter's name gone
    // from it and the invitation settled; Decline drops the row and retracts it.
    const th = M.threads.find((x) => x.thread_id === body.p_thread);
    if (!th || th.state !== "invited") return refuse("not_invited", "42501");
    if (fn === "messenger_thread_invite_accept") {
      th.state = "active";
      th.invited = false;
      th.invited_by_name = null;
    } else M.threads = M.threads.filter((x) => x !== th);
    if (db.notifications)
      db.notifications = db.notifications.filter(
        (n) => !(n.kind === "thread_invitation" && n.object_id === body.p_thread),
      );
    return json(null, 204);
  }
  if (fn === "messenger_thread_leave") {
    M.threads = M.threads.filter((x) => x.thread_id !== body.p_thread);
    return json(null, 204);
  }
  if (fn === "messenger_thread_set_history") {
    const t = thread();
    if (t) t.history_visible_to_new = !!body.p_visible;
    return json(null, 204);
  }
  if (fn === "messenger_report") return json(randomUUID());
  if (fn === "messenger_open_one_to_one") {
    const t = M.threads.find((x) => x.other_member_id === body.p_other);
    return t ? json(t.thread_id) : refuse("request_first", "42501");
  }
  return json(null, 204);
}

module.exports = {
  messengerFixture,
  handleMessenger,
  invitedGroupThread,
  invitedGroupNotification,
  VOCAB_KEYS,
  UID,
  ids,
  members,
  VIDEO_MEDIA,
};
