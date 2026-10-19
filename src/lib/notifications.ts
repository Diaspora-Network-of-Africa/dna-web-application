// The notification read path (ruling 82, handoff 55-A): real rows only, recipient-scoped by RLS.
// Reads the member's rows, resolves the names the row copy needs under the caller's RLS, marks one
// read, marks the panel's rows seen, and asks the two dots. Nothing here sends or writes a row: rows
// are written by private.notify inside each engine's own write function (1319), which today are
// Connect's send_introduction and respond_to_request, Convene's invite_event_party and
// respond_to_event_role, and Messenger's request and thread invitation paths. Which kinds render, and
// each kind's C and destination, are the notification_kinds vocabulary's (1318).
import { hasSentence } from "@/components/strand/NotificationListItem";
import { C_ORDER, type C } from "@/components/strand/cmeta";
import type { Database, Tables } from "./database.types";
import { deliverImageUrl } from "./media";
import { getSupabase } from "./supabase";
import { loadVocabularies, type NotificationKindRow } from "./vocabularies";
import { whenLabel } from "./when";

/** 62-A (1820): a person an intent row names, with the signed photo URL for the people-led row. */
export type NotificationPerson = {
  id: string;
  name: string;
  handle: string;
  avatar?: string | undefined;
};

export type NotificationRow = Tables<"notifications">;

const isC = (v: unknown): v is C =>
  typeof v === "string" && (C_ORDER as readonly string[]).includes(v);

/** A row plus the words its copy needs: "{actor} accepted your connection request.", "{object} starts {detail}." */
export type NotificationView = NotificationRow & {
  actor?: string | undefined;
  /** The actor's handle, when the actor is a member. Ruling 462: the row's destination needs it. */
  actorHandle?: string | undefined;
  object?: string | undefined;
  detail?: string | undefined;
  /** Brief 10 (1027): the event an `event_party` row belongs to, so the row can open its page. */
  eventId?: string | undefined;
  /** The engine whose glyph marks the row (66): the kind's C, or the row's own for a context kind. */
  c?: C | undefined;
  /** The kind's destination in words (490), from its vocabulary row. */
  destination?: string | undefined;
  /** Fix PR 10 item 8 (1637): the sentence verbatim where the app owns a kind's copy. */
  text?: string | undefined;
  /** 62-A (1317, 1802, 1820): the actor then the grouped actors an intent row names, in order. */
  people?: NotificationPerson[] | undefined;
  /** 62-A: more people than the two the row shows exist; never a count. */
  others?: boolean | undefined;
  /** 62-G (10.2): the post a comment object belongs to, so a reply's row can open the thread there. */
  postId?: string | undefined;
};

/** The post's first words for N.object (SPEC 10.2): one line, cut at eight words. */
export function firstWords(body: string | null | undefined, words = 8): string {
  const w = (body ?? "").trim().split(/\s+/).filter(Boolean);
  return w.length <= words ? w.join(" ") : w.slice(0, words).join(" ") + "…";
}

/**
 * The kinds the panel renders (1318): a vocabulary row that says `renders` and a sentence in the row
 * part. Keyed by kind for the lookup only; the set is the vocabulary's, never a list kept here.
 */
function renderedKinds(rows: NotificationKindRow[] | undefined): Map<string, NotificationKindRow> {
  return new Map(
    (rows ?? [])
      .filter((k) => k.renders && !!k.destination && hasSentence(k.value))
      .map((k) => [k.value, k]),
  );
}

export async function loadNotifications(memberId: string, limit = 50): Promise<NotificationView[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // 1318: the vocabulary decides what renders. A vocabulary that fails to load leaves the panel
  // empty (194), never a literal list of kinds standing in for it.
  const vocab = await loadVocabularies().catch(() => null);
  const kinds = renderedKinds(vocab?.notification_kinds);
  if (kinds.size === 0) return [];
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_member_id", memberId)
    .in("kind", [...kinds.keys()])
    .order("created_at", { ascending: false })
    .limit(limit);
  // The query already narrows to the rendered kinds; the same test runs on the answer, so a row of
  // any other kind cannot reach the name resolution below whatever the read returned.
  const rows = (data ?? []).filter((r) => kinds.has(r.kind));
  if (rows.length === 0) return [];

  const ids = (kind: NotificationRow["object_kind"]) =>
    rows.filter((r) => r.object_kind === kind && r.object_id).map((r) => r.object_id as string);
  const spaceIds = [
    ...ids("space"),
    ...rows.filter((r) => r.actor_kind === "space").map((r) => r.actor_id as string),
  ];
  // 62-A (1317): an intent row names its actor and the actors grouped into it, which nothing read
  // before this; every one is a members core row the viewer may read. 62-G (1849): a comment row
  // and a reply row are people-led the same way.
  const isIntent = (k: string) => k === "intent_help" || k === "intent_build";
  const isPeople = (k: string) =>
    isIntent(k) || k === "comment_on_post" || k === "reply_to_comment";
  const groupedIds = rows
    .filter((r) => isPeople(r.kind))
    .flatMap((r) => (Array.isArray(r.grouped_actor_ids) ? r.grouped_actor_ids : []));
  const memberActorIds = [
    ...new Set([
      ...rows
        .filter((r) => r.actor_kind === "member" && r.actor_id)
        .map((r) => r.actor_id as string),
      ...groupedIds,
    ]),
  ];
  const postIds = rows
    .filter((r) => isPeople(r.kind) && r.object_kind === "post")
    .map((r) => r.object_id as string);
  // 62-G (1817, 1849): a reply and an intent on a comment point at the comment; its first words are
  // N.object and its post is where the row opens, both read under the comments policy (141).
  const commentIds = rows
    .filter((r) => isPeople(r.kind) && r.object_kind === "comment")
    .map((r) => r.object_id as string);
  // Brief 10 (736, 1027): an event_party object is the member's own event_parties row, readable
  // under its policy, and its event's title; the verb comes from the event_roles vocabulary (1018),
  // never from a literal here (ruling 194: a read that fails leaves the row's verb absent).
  const partyIds = ids("event_party");
  // Fix PR 10 item 8 (1637): a thread's name through messenger_threads_view, the Messenger's one
  // read projection, never threads directly; a thread the viewer no longer reads answers no row.
  const threadIds = ids("thread");
  const [spaces, events, opps, actors, roles, parties, threads, intentPosts, commentRows] =
    await Promise.all([
      spaceIds.length
        ? sb.from("spaces").select("id,title").in("id", spaceIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ids("event").length
        ? sb.from("events").select("id,title,starts_at").in("id", ids("event"))
        : Promise.resolve({
            data: [] as { id: string; title: string; starts_at: string | null }[],
          }),
      ids("opportunity").length
        ? sb.from("opportunities").select("id,title").in("id", ids("opportunity"))
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      memberActorIds.length
        ? sb.from("members").select("id,name,handle,avatar_path").in("id", memberActorIds)
        : Promise.resolve({
            data: [] as { id: string; name: string; handle: string; avatar_path: string | null }[],
          }),
      ids("space").length
        ? sb
            .from("space_roles")
            .select("space_id,role")
            .eq("member_id", memberId)
            .in("space_id", ids("space"))
        : Promise.resolve({ data: [] as { space_id: string; role: "lead" | "member" }[] }),
      partyIds.length
        ? sb.from("event_parties").select("id,event_id,role").in("id", partyIds)
        : Promise.resolve({ data: [] as { id: string; event_id: string; role: string }[] }),
      threadIds.length
        ? sb.from("messenger_threads_view").select("thread_id,name").in("thread_id", threadIds)
        : Promise.resolve({ data: [] as { thread_id: string | null; name: string | null }[] }),
      // 62-A: the post an intent row is about, under the posts policy, for N.object's first words.
      postIds.length
        ? sb.from("feed").select("id,body").in("id", postIds)
        : Promise.resolve({ data: [] as { id: string | null; body: string | null }[] }),
      commentIds.length
        ? sb.from("comments").select("id,body,post_id").in("id", commentIds)
        : Promise.resolve({ data: [] as { id: string; body: string | null; post_id: string }[] }),
    ]);
  const commentOf = new Map((commentRows.data ?? []).map((c) => [c.id, c]));
  const postBody = new Map(
    (intentPosts.data ?? []).filter((p) => !!p.id).map((p) => [p.id as string, p.body ?? ""]),
  );
  // 62-A (1820): one signed delivery URL per person photo the intent rows name.
  const avatarUrls = new Map<string, string | undefined>();
  for (const a of actors.data ?? []) {
    const path = a.avatar_path;
    if (!path || avatarUrls.has(path)) continue;
    avatarUrls.set(
      path,
      await deliverImageUrl("profile-media", path, { width: 80, height: 80, resize: "cover" }),
    );
  }
  const personOf = (id: string): NotificationPerson | null => {
    const a = (actors.data ?? []).find((x) => x.id === id);
    if (!a) return null;
    return {
      id: a.id,
      name: a.name,
      handle: a.handle,
      avatar: a.avatar_path ? avatarUrls.get(a.avatar_path) : undefined,
    };
  };
  const thread = new Map(
    (threads.data ?? [])
      .filter((t) => !!t.thread_id && !!t.name)
      .map((t) => [t.thread_id as string, t.name as string]),
  );
  const party = new Map((parties.data ?? []).map((p) => [p.id, p]));
  const partyEventIds = [...new Set((parties.data ?? []).map((p) => p.event_id))].filter(
    (eid) => !ids("event").includes(eid),
  );
  const partyEvents = partyEventIds.length
    ? await sb.from("events").select("id,title,starts_at").in("id", partyEventIds)
    : { data: [] as { id: string; title: string; starts_at: string | null }[] };
  const roleVerb = new Map((vocab?.event_roles ?? []).map((r) => [r.value, r.verb]));
  const space = new Map((spaces.data ?? []).map((s) => [s.id, s.title]));
  const event = new Map(
    [...(events.data ?? []), ...(partyEvents.data ?? [])].map((e) => [e.id, e]),
  );
  const opp = new Map((opps.data ?? []).map((o) => [o.id, o.title]));
  const actorName = new Map((actors.data ?? []).map((a) => [a.id, a.name]));
  const actorHandle = new Map((actors.data ?? []).map((a) => [a.id, a.handle]));
  const role = new Map((roles.data ?? []).map((r) => [r.space_id, r.role]));

  const views = rows.map((r): NotificationView => {
    const oid = r.object_id ?? "";
    const partyRow = r.object_kind === "event_party" ? party.get(oid) : undefined;
    const objectName =
      r.object_kind === "space"
        ? space.get(oid)
        : r.object_kind === "event"
          ? event.get(oid)?.title
          : r.object_kind === "opportunity"
            ? opp.get(oid)
            : partyRow
              ? event.get(partyRow.event_id)?.title
              : r.object_kind === "thread"
                ? thread.get(oid)
                : undefined;
    // A Space actor has a title; a member actor is named from the members core row (Brief 3), which
    // every signed-in member may read. The request row itself is never read by the sender (ruling 157).
    const actor =
      r.actor_kind === "space" ? space.get(r.actor_id ?? "") : actorName.get(r.actor_id ?? "");
    let detail: string | undefined;
    if (r.kind === "space_role_approved") {
      const rl = role.get(oid);
      detail = rl === "lead" ? "a lead" : rl === "member" ? "a member" : undefined;
    } else if (r.kind === "event_reminder") {
      detail = whenLabel(event.get(oid)?.starts_at) || undefined;
    } else if (r.kind === "role_invitation" && partyRow) {
      detail = roleVerb.get(partyRow.role);
    }
    const kindRow = kinds.get(r.kind);
    const c = kindRow?.c_from_object ? r.c_category : kindRow?.c;
    // 62-A: the people an intent row names, the actor first then the grouped actors in the order
    // they folded in; the row shows two and says "and others" past that, never a count. 62-G: the
    // comment and reply rows likewise (1849).
    const peopleIds = isPeople(r.kind)
      ? [r.actor_id ?? "", ...(Array.isArray(r.grouped_actor_ids) ? r.grouped_actor_ids : [])]
      : [];
    const people = peopleIds.map(personOf).filter((p): p is NotificationPerson => !!p);
    const commentRow = r.object_kind === "comment" ? commentOf.get(oid) : undefined;
    // N.object: the post's first words, or the comment's (an image alone reads as one).
    const peopleObject = !isPeople(r.kind)
      ? undefined
      : r.object_kind === "comment"
        ? commentRow
          ? firstWords(commentRow.body) || "Shared an image"
          : undefined
        : firstWords(postBody.get(oid)) || undefined;
    // 1637: the row reads, verbatim, `{name} invited you to {group}.`
    const text =
      r.kind === "thread_invitation" && actor && objectName
        ? actor + " invited you to " + objectName + "."
        : undefined;
    return {
      ...r,
      text,
      c: isC(c) ? c : undefined,
      destination: kindRow?.destination ?? undefined,
      actor: actor || "A member",
      actorHandle:
        r.actor_kind === "member" ? (actorHandle.get(r.actor_id ?? "") ?? undefined) : undefined,
      object: objectName || peopleObject || undefined,
      detail,
      eventId: partyRow?.event_id,
      people: people.length ? people : undefined,
      others: people.length > 2 ? true : undefined,
      postId: commentRow?.post_id,
    };
  });
  // 194: an invitation whose thread no longer reads (declined, removed) renders nothing rather
  // than a blank name.
  return views.filter((v) => v.kind !== "thread_invitation" || !!v.text);
}

/**
 * Whether the bell shows its dot (82, 1322): notifications_dot() answers from the database, where an
 * unseen row of a kind that renders, from a member the caller does not block either way, raises it.
 * Existence only, never a count. A failed read is no dot.
 */
export async function notificationsDot(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc("notifications_dot");
  return !error && data === true;
}

/** Opening the panel marks the member's rows seen, which clears the dot; each row keeps its weight. */
export async function markSeen(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.rpc("notifications_mark_seen");
  if (error) throw error;
}

/**
 * Whether Connect's slot carries its for-you dot (1481, 1522): a pending request to the member that
 * arrived after they last opened My Network. Existence only. A failed read is no dot.
 */
export async function connectRequestsPending(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc("connect_requests_pending");
  return !error && data === true;
}

/** The one query key the shell's Connect dot and My Network's mark share (1522). */
export const connectPendingKey = (memberId: string) => ["connect-pending", memberId] as const;

/** My Network was opened: the for-you dot clears until a newer request arrives (1522). */
export async function markMyNetworkSeen(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.rpc("mark_surface_seen", { p_surface: "my_network" });
  if (error) throw error;
}

export async function markRead(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

/**
 * Mark all read (1556): the caller's unread rows become read through notifications_mark_all_read(),
 * which takes no member. Throws on a refusal so the panel can keep the rows' weight and say so.
 */
export async function markAllRead(): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { error } = await sb.rpc("notifications_mark_all_read");
  if (error) throw error;
}

/**
 * One email category as notification_email_view() answers it for the caller (1553, 1560): whether a
 * non-transactional kind with a fixed C carries copy, the member's own mode, and the default that
 * every such kind shares (null when they differ or there are none). Labels are never here; they are
 * the notification_categories and notification_email_modes vocabularies' (1554, 1555).
 */
export type EmailCategory = {
  c: string;
  hasCopy: boolean;
  mode: string | null;
  emailDefault: string | null;
};

/** The email view's one read (1553). Throws on a failed read; a malformed entry is dropped. */
export async function loadEmailView(): Promise<EmailCategory[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("notification_email_view");
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  const out: EmailCategory[] = [];
  for (const v of data) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    if (typeof r["c"] !== "string") continue;
    out.push({
      c: r["c"],
      hasCopy: r["has_copy"] === true,
      mode: typeof r["mode"] === "string" ? r["mode"] : null,
      emailDefault: typeof r["email_default"] === "string" ? r["email_default"] : null,
    });
  }
  return out;
}

/** The one query key the email view's read and its saves share. */
export const emailViewKey = (memberId: string) => ["notification-email", memberId] as const;

/** One row's save (1552): the caller's mode for one category on the email channel. */
export async function setEmailMode(c: string, mode: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { error } = await sb.rpc("set_notification_preference", {
    p_c: c as Database["public"]["Enums"]["c_category"],
    p_channel: "email",
    p_mode: mode,
  });
  if (error) throw error;
}
