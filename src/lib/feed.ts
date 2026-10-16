// The feed read. Rows come from the `feed` view (security_invoker over posts, so the audience
// predicate is RLS on posts, never a client filter) in strict reverse-chronological order (ruling
// 80). Lens filters are PostgREST predicates on that view. Every row is mapped to the PostView the
// card router renders; the composer preview and the Feed share that one shape.
import type { C } from "@/components/strand/cmeta";
import type { FieldValues } from "@/components/strand/verb-schema";
import type { Member } from "./auth";
import type { Database, Tables, Views } from "./database.types";
import { signedMediaUrl } from "./dia";
import type { EventPerson, EventPresenter } from "./event-page";
import { deliverImageUrl } from "./media";
import { placeLine } from "./place";
import type { LensId } from "./lens";
import {
  cropOf,
  domainOf,
  focalPointOf,
  type EventPresenterView,
  type EventView,
  type PostImage,
  type PostView,
} from "./post-view";
import { getSupabase, type Supabase } from "./supabase";
import { instrumentLabels } from "./vocabularies";
import { browserZone, dateInZone, isPast, knownZone, localLine, whenLabel, whenLine } from "./when";

type FeedRow = Views<"feed">;
type PostRow = Tables<"posts">;

function verbOf(kind: PostRow["created_object_kind"]): C | null {
  switch (kind) {
    case "connection_request":
      return "connect";
    case "event":
      return "convene";
    case "space":
      return "collaborate";
    case "opportunity":
      return "contribute";
    case "story":
      return "convey";
    default:
      return null;
  }
}

function mine(
  value: string | boolean | null | undefined,
): FieldValues[keyof FieldValues] | undefined {
  if (value == null || value === "" || value === false) return undefined;
  return { value, mine: true };
}

/** Ruling 416: the author's core row the view carries under private.can_see_core, or nothing. */
type FeedAuthor = { name: string | null; handle: string | null; avatar_path: string | null };
type FeedPost = PostRow & { feed_author?: FeedAuthor | undefined };

/** The view's columns are nullable in the generated types; a published row always has these. */
function asPost(r: FeedRow): FeedPost | null {
  if (!r.id || !r.author_kind || !r.author_id || !r.created_by || !r.c_category) return null;
  return {
    feed_author: {
      name: r.author_name ?? null,
      handle: r.author_handle ?? null,
      avatar_path: r.author_avatar_path ?? null,
    },
    id: r.id,
    author_kind: r.author_kind,
    author_id: r.author_id,
    created_by: r.created_by,
    c_category: r.c_category,
    body: r.body ?? "",
    anchor_kind: r.anchor_kind,
    anchor_id: r.anchor_id,
    created_object_kind: r.created_object_kind,
    created_object_id: r.created_object_id,
    audience: r.audience ?? "everyone",
    status: r.status ?? "published",
    published_at: r.published_at,
    created_at: r.created_at ?? r.published_at ?? new Date().toISOString(),
  };
}

/** What `event_presenters` answers for one event: the pane's two values (674, 1079, 1121). */
type PresenterRecord = { presented_by: EventPresenter; host: EventPerson | null };

/** The function takes at most 200 ids a call, so a page names its events in slices of 200. */
const PRESENTERS_PER_CALL = 200;

/**
 * Addendum 4 item 1 (1121): the presenter line for a page of events, keyed by event id, from the one
 * database read the event pane's own resolution runs through. A slice that fails answers nothing, and
 * its events keep the author's line (416).
 */
async function eventPresenters(sb: Supabase, ids: string[]): Promise<Map<string, PresenterRecord>> {
  const slices: string[][] = [];
  for (let i = 0; i < ids.length; i += PRESENTERS_PER_CALL)
    slices.push(ids.slice(i, i + PRESENTERS_PER_CALL));
  const answers = await Promise.all(
    slices.map((p_events) => sb.rpc("event_presenters", { p_events })),
  );
  const out = new Map<string, PresenterRecord>();
  for (const { data } of answers) {
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    for (const [id, rec] of Object.entries(data as Record<string, PresenterRecord | null>))
      if (rec) out.set(id, rec);
  }
  return out;
}

/** Whose face and handle the presenter row carries: the pane's rule, a member presenter or the host. */
function presenterPerson(rec: PresenterRecord): EventPerson | null {
  const by = rec.presented_by;
  if (by?.kind === "member") return by;
  return rec.host;
}

/** The pane's presenter line (EventSurface): presented_by's name, else the host's. */
function presenterView(
  rec: PresenterRecord | undefined,
  avatarUrls: Map<string, string | undefined>,
): EventPresenterView | null {
  if (!rec) return null;
  const by = rec.presented_by;
  const face = presenterPerson(rec);
  const avatar = face?.avatar_path ? avatarUrls.get(face.avatar_path) : undefined;
  if (by?.kind === "space") return { kind: "space", id: by.id, name: by.name, avatar };
  const person = by ?? rec.host;
  if (!person?.name) return null;
  return { kind: "member", id: person.id, name: person.name, handle: person.handle, avatar };
}

/** Resolve the created objects, media and links for a page of posts and map them to PostViews. */
export async function hydratePosts(
  sb: Supabase,
  member: Member,
  posts: FeedPost[],
): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const by = <T extends string>(kind: T) =>
    posts.filter((p) => p.created_object_kind === kind).map((p) => p.created_object_id as string);
  const spaceIds = new Set<string>([
    ...by("space"),
    ...posts.filter((p) => p.author_kind === "space").map((p) => p.author_id),
    ...posts.filter((p) => p.anchor_kind === "space").map((p) => p.anchor_id as string),
  ]);
  const eventIds = new Set<string>([
    ...by("event"),
    ...posts.filter((p) => p.anchor_kind === "event").map((p) => p.anchor_id as string),
  ]);

  const [media, links, events, spaces, opps, reqs, stories, instruments] = await Promise.all([
    // 1707, 1709: the one post_media read carries the stored size and, through media_id, the
    // author's framing from the media row, which is its one owner (1673). Still one query.
    sb
      .from("post_media")
      .select("*, media:media_id(focal_point, crop)")
      .in("post_id", ids)
      .order("position"),
    sb.from("post_links").select("*").in("post_id", ids),
    eventIds.size
      ? sb
          .from("events")
          .select("*")
          .in("id", [...eventIds])
      : Promise.resolve({ data: [] as Tables<"events">[] }),
    spaceIds.size
      ? sb
          .from("spaces")
          .select("*")
          .in("id", [...spaceIds])
      : Promise.resolve({ data: [] as Tables<"spaces">[] }),
    by("opportunity").length
      ? sb.from("opportunities").select("*").in("id", by("opportunity"))
      : Promise.resolve({ data: [] as Tables<"opportunities">[] }),
    by("connection_request").length
      ? // The intros projection (Brief 4, ruling 157): who and why for either party, never a status.
        sb.rpc("connection_request_intros", { p_ids: by("connection_request") })
      : Promise.resolve({ data: [] as { id: string; to_name: string; why: string | null }[] }),
    by("story").length
      ? sb.from("stories").select("*").in("id", by("story"))
      : Promise.resolve({ data: [] as Tables<"stories">[] }),
    // Ruling 193: the instrument labels are the contribute_instrument vocabulary, read at runtime
    // through the one vocabulary path rather than mapped from a literal in this file. Ruling 194: a
    // read that fails returns nothing, and the Need's instrument row is absent rather than guessed.
    by("opportunity").length ? instrumentLabels(sb) : Promise.resolve({} as Record<string, string>),
  ]);

  const eventMap = new Map((events.data ?? []).map((e) => [e.id, e]));
  // Convene Pass 1 (P1-SPEC section 2): the physical delivery row is what `where` renders; the
  // meeting_link row is host-only under RLS and the card never asks for it. The Space a card hooks
  // to (Canon 6) is fetched by name when the first pass did not already carry it.
  const eventRows = events.data ?? [];
  const eventSpaceIds = eventRows
    .map((e) => e.space_id)
    .filter((id): id is string => !!id && !spaceIds.has(id));
  const [delivery, hookSpaces, speakers, presenters] = await Promise.all([
    eventRows.length
      ? sb
          .from("event_delivery")
          .select("event_id, kind, place_name, place_text, city, country, position")
          .in("event_id", [...eventIds])
          .order("position")
      : Promise.resolve({
          data: [] as Pick<
            Tables<"event_delivery">,
            "event_id" | "kind" | "place_name" | "place_text" | "city" | "country" | "position"
          >[],
        }),
    eventSpaceIds.length
      ? sb.from("spaces").select("id, title").in("id", eventSpaceIds)
      : Promise.resolve({ data: [] as Pick<Tables<"spaces">, "id" | "title">[] }),
    // Brief 10 (679): each card's accepted speakers in one call beside the other per-kind reads,
    // under the named-party policy; a pending invitation is nothing on the card (678).
    eventRows.length
      ? sb.rpc("event_speakers", { p_events: eventRows.map((e) => e.id) })
      : Promise.resolve({
          data: [] as Database["public"]["Functions"]["event_speakers"]["Returns"],
        }),
    // Addendum 4 item 1 (674, 1079, 1121): the presenter line as the event pane resolves it.
    eventRows.length
      ? eventPresenters(
          sb,
          eventRows.map((e) => e.id),
        )
      : Promise.resolve(new Map<string, PresenterRecord>()),
  ]);
  const speakersByEvent = new Map<string, NonNullable<typeof speakers.data>>();
  for (const sp of speakers.data ?? []) {
    const list = speakersByEvent.get(sp.event_id) ?? [];
    list.push(sp);
    speakersByEvent.set(sp.event_id, list);
  }
  const deliveryByEvent = new Map<string, NonNullable<typeof delivery.data>>();
  for (const d of delivery.data ?? []) {
    const list = deliveryByEvent.get(d.event_id) ?? [];
    list.push(d);
    deliveryByEvent.set(d.event_id, list);
  }
  const spaceMap = new Map((spaces.data ?? []).map((s) => [s.id, s]));
  const spaceNames = new Map<string, string>([
    ...[...spaceMap.values()].map((sp) => [sp.id, sp.title] as [string, string]),
    ...(hookSpaces.data ?? []).map((sp) => [sp.id, sp.title] as [string, string]),
  ]);
  const viewerTz = browserZone();
  const now = new Date();
  const oppMap = new Map((opps.data ?? []).map((o) => [o.id, o]));
  const reqMap = new Map((reqs.data ?? []).map((r) => [r.id, r]));
  const storyMap = new Map((stories.data ?? []).map((s) => [s.id, s]));

  // H60-MEDIA Work 3: each image keeps its stored size and its framing beside the signed URL. A
  // null media_id or null framing reads as null, and MediaBlock renders its default.
  const mediaUrls = new Map<string, PostImage[]>();
  for (const m of media.data ?? []) {
    const url = await signedMediaUrl(m.storage_path);
    if (!url) continue;
    const list = mediaUrls.get(m.post_id) ?? [];
    list.push({
      src: url,
      width: m.width,
      height: m.height,
      focalPoint: focalPointOf(m.media?.focal_point),
      crop: cropOf(m.media?.crop),
    });
    mediaUrls.set(m.post_id, list);
  }
  const linkMap = new Map((links.data ?? []).map((l) => [l.post_id, l]));
  // Ruling 416: one signed delivery URL per author avatar the view admitted (never per post).
  const avatarUrls = new Map<string, string | undefined>();
  const NO_AUTHOR: FeedAuthor = { name: null, handle: null, avatar_path: null };
  for (const p of posts) {
    const path = (p.feed_author ?? NO_AUTHOR).avatar_path;
    if (!path || avatarUrls.has(path)) continue;
    avatarUrls.set(
      path,
      await deliverImageUrl("profile-media", path, { width: 80, height: 80, resize: "cover" }),
    );
  }
  // Brief 10 (679): one delivery URL per speaker photo, the same size as the author avatar.
  for (const sp of speakers.data ?? []) {
    const path = sp.avatar_path;
    if (!path || avatarUrls.has(path)) continue;
    avatarUrls.set(
      path,
      await deliverImageUrl("profile-media", path, { width: 80, height: 80, resize: "cover" }),
    );
  }
  // Addendum 4 item 1: the presenter's photo as the pane draws it, the same size again.
  for (const rec of presenters.values()) {
    const path = presenterPerson(rec)?.avatar_path;
    if (!path || avatarUrls.has(path)) continue;
    avatarUrls.set(
      path,
      await deliverImageUrl("profile-media", path, { width: 80, height: 80, resize: "cover" }),
    );
  }

  return posts.map((p): PostView => {
    const verb = verbOf(p.created_object_kind);
    const fields: FieldValues = {};
    const oid = p.created_object_id ?? "";
    let eventView: EventView | undefined;
    let eventMeta: string | undefined;
    if (verb === "convene") {
      // Convene Pass 1 (P1-SPEC section 2). The meta line is `Presented by {presented} · {when} ·
      // {where}`: presented is the poster's name (674), when is the viewer's zone then the event's
      // local time when they differ, a window as words, past as `Happened`; where is the venue and
      // city, `Online`, or `{city} and online`. Cancelled reads `Was set for {local} · {where}`.
      // VERB_SCHEMA carries no convene rows (671); Going, Sponsor and Speakers wait for their
      // tables (508, 630, 678), so the rows carry nothing here.
      const e = eventMap.get(oid);
      if (e) {
        Object.assign(fields, { title: mine(e.title) });
        const rows = deliveryByEvent.get(e.id) ?? [];
        const physical = rows.find((r) => r.kind === "physical");
        // A venue row carries place_name and no words; an area row (Session 23, change 2) carries
        // the member's words in place_text beside the area's name; words alone carry only
        // place_text, and read with the host's country beside them, composed here at read (799):
        // event_delivery.country holds the chosen name and place_text the words only.
        const wordsOnly = !!physical && !physical.place_name && !physical.city;
        // The same dedupe the composer's row and intent line read (807), so the three cannot drift.
        const placeWords = physical
          ? placeLine(
              physical.place_text,
              physical.place_name,
              physical.city,
              wordsOnly ? physical.country : null,
            )
          : "";
        const city = physical?.city ?? null;
        const where =
          e.mode === "virtual"
            ? "Online"
            : e.mode === "hybrid"
              ? city || placeWords
                ? (city || placeWords) + " and online"
                : "Online"
              : placeWords;
        const timing = {
          starts_at: e.starts_at,
          timezone: e.timezone,
          window_basis: e.window_basis,
          expected_window_end: e.expected_window_end,
          city,
        };
        const cancelled = e.status === "cancelled";
        const past = isPast(timing, now);
        const localTz = knownZone(e.timezone) ? e.timezone : viewerTz;
        const when = whenLine(timing, viewerTz, now);
        const wasSetFor = e.starts_at
          ? localLine(e.starts_at, localTz)
          : e.window_basis
            ? e.window_basis + ", date to be confirmed"
            : "";
        const hostName =
          (p.feed_author ?? NO_AUTHOR).name ??
          (p.author_id === member.id ? member.name : "The host");
        const cancelledOn = e.cancelled_at ? dateInZone(new Date(e.cancelled_at), viewerTz) : "";
        // 1121: the presenter line names the presenter as the pane does; every other name keeps 416.
        const presenter = presenterView(presenters.get(e.id), avatarUrls);
        eventMeta = cancelled
          ? ["Was set for " + wasSetFor, where || null].filter(Boolean).join(" · ")
          : ["Presented by " + (presenter?.name ?? hostName), when || null, where || null]
              .filter(Boolean)
              .join(" · ");
        eventView = {
          id: e.id,
          cancelled,
          past,
          cancelledBody: cancelled
            ? "This event will not happen. " +
              hostName +
              " cancelled it" +
              (cancelledOn ? " on " + cancelledOn : "") +
              "." +
              (e.cancelled_reason
                ? "\n\nThe host wrote: " +
                  e.cancelled_reason.trim() +
                  (/[.!?]$/.test(e.cancelled_reason.trim()) ? "" : ".")
                : "") +
              "\n\nIf you had said you were going, you were told by email."
            : null,
          space: e.space_id
            ? { id: e.space_id, name: spaceNames.get(e.space_id) ?? "Space" }
            : null,
          speakers: (speakersByEvent.get(e.id) ?? []).map((sp) => ({
            party_id: sp.party_id,
            name: sp.name,
            label: sp.label,
            avatar: sp.avatar_path ? avatarUrls.get(sp.avatar_path) : undefined,
          })),
          // Handoff 32-B: Discovery's face reads these beside the meta line, from the same rows.
          mode: e.mode,
          family: e.family,
          hostId: e.host_member_id,
          when,
          startsAt: e.starts_at,
          places:
            e.mode === "virtual"
              ? []
              : [
                  ...new Set(
                    rows
                      .filter((r) => r.kind === "physical")
                      .map(
                        (r) =>
                          r.city ??
                          placeLine(
                            r.place_text,
                            r.place_name,
                            r.city,
                            !r.place_name && !r.city ? r.country : null,
                          ),
                      )
                      .filter((w): w is string => !!w),
                  ),
                ],
          presenter,
        };
      }
    } else if (verb === "collaborate") {
      const s = spaceMap.get(oid);
      if (s) {
        const roles = Array.isArray(s.roles_sought)
          ? (s.roles_sought as unknown[]).map(String).join(", ")
          : "";
        Object.assign(fields, {
          title: mine(s.title),
          category: mine(s.category),
          roles: mine(roles),
        });
      }
    } else if (verb === "contribute") {
      const o = oppMap.get(oid);
      if (o)
        Object.assign(fields, {
          title: mine(o.title),
          instrument: mine(instruments[o.instrument]),
          need: mine(o.need),
          by: mine(o.by_text),
        });
    } else if (verb === "connect") {
      const r = reqMap.get(oid);
      if (r) Object.assign(fields, { who: mine(r.to_name), why: mine(r.why) });
    } else if (verb === "convey") {
      const s = storyMap.get(oid);
      if (s) Object.assign(fields, { title: mine(s.title) });
    }
    const link = linkMap.get(p.id);
    const authorSpace = p.author_kind === "space" ? spaceMap.get(p.author_id) : undefined;
    const anchorName =
      p.anchor_kind === "space"
        ? spaceMap.get(p.anchor_id ?? "")?.title
        : p.anchor_kind === "event"
          ? eventMap.get(p.anchor_id ?? "")?.title
          : undefined;
    // Ruling 416: the feed view carries the author's name, handle and avatar path where
    // private.can_see_core admits the author to this viewer; otherwise the three are null and the
    // card renders the role word. A Space keeps its title (U-F9).
    const fa = p.feed_author ?? NO_AUTHOR;
    const seen = fa.name != null;
    const authorName =
      p.author_kind === "space"
        ? (authorSpace?.title ?? "Space")
        : seen
          ? (fa.name as string)
          : p.author_id === member.id
            ? member.name
            : "Member";
    const avatarPath = p.author_kind === "member" ? fa.avatar_path : null;
    return {
      id: p.id,
      c_category: p.c_category,
      verb,
      author_kind: p.author_kind === "space" ? "space" : "member",
      author_id: p.author_id,
      author_name: authorName,
      author_handle: p.author_kind === "member" && seen ? (fa.handle ?? undefined) : undefined,
      author_avatar:
        p.author_kind === "member"
          ? ((avatarPath && avatarUrls.get(avatarPath)) ??
            (p.author_id === member.id ? member.avatar : undefined))
          : undefined,
      body: p.body,
      anchor_name: anchorName,
      audience: p.audience,
      fields,
      media: mediaUrls.get(p.id) ?? [],
      link: link
        ? {
            url: link.url,
            domain: domainOf(link.url),
            title: link.title ?? undefined,
            image: link.image_url ?? undefined,
          }
        : null,
      // The meta line is the absolute time; city and zone arrive with member profiles. A Convene
      // card's meta is the event's line (P1-SPEC section 2).
      meta: eventMeta ?? whenLabel(p.published_at),
      event: eventView,
    };
  });
}

/** Ids of members with an accepted connection to this member (the adjacency projection, Brief 4), and Spaces where they hold an active role. */
async function networkIds(sb: Supabase, memberId: string) {
  const [{ data: conns }, { data: roles }] = await Promise.all([
    sb.from("member_connections").select("other_id").eq("member_id", memberId),
    sb.from("space_roles").select("space_id").eq("member_id", memberId).eq("status", "active"),
  ]);
  const members = new Set<string>();
  for (const c of conns ?? []) if (c.other_id) members.add(c.other_id);
  return { members: [...members], spaces: (roles ?? []).map((r) => r.space_id) };
}

const inList = (ids: string[]) => "(" + ids.map((i) => '"' + i + '"').join(",") + ")";

/** The Feed for one lens: the `feed` view (RLS-visible, newest first) with the lens as a server-side predicate. */
export async function loadFeed(
  member: Member,
  lens: LensId = "all",
  limit = 50,
): Promise<PostView[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from("feed").select("*");
  if (lens === "mine") {
    q = q.or(`author_id.eq.${member.id},created_by.eq.${member.id}`);
  } else if (lens === "network") {
    const { members, spaces } = await networkIds(sb, member.id);
    if (members.length === 0 && spaces.length === 0) return [];
    const parts: string[] = [];
    if (members.length) parts.push(`and(author_kind.eq.member,author_id.in.${inList(members)})`);
    if (spaces.length) parts.push(`and(author_kind.eq.space,author_id.in.${inList(spaces)})`);
    q = q.or(parts.join(","));
  } else if (lens === "saved") {
    const { data: saves } = await sb
      .from("post_saves")
      .select("post_id")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    const ids = (saves ?? []).map((s) => s.post_id);
    if (ids.length === 0) return [];
    q = q.in("id", ids);
  }
  const { data } = await q
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  const posts = (data ?? []).map(asPost).filter((p): p is PostRow => p !== null);
  return hydratePosts(sb, member, posts);
}

/** One post by id, under the caller's posts RLS. Null when it does not exist or is not visible. */
export async function loadPost(member: Member, id: string): Promise<PostView | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("feed").select("*").eq("id", id).maybeSingle();
  const post = data ? asPost(data) : null;
  if (!post) return null;
  const [view] = await hydratePosts(sb, member, [post]);
  return view ?? null;
}

/**
 * Posts by id, under the caller's posts RLS, hydrated through the same path as the Feed so a card has
 * one read (660). Returned in the order of `ids`; an id the view did not return is dropped.
 */
export async function loadPostsByIds(member: Member, ids: string[]): Promise<PostView[]> {
  const sb = getSupabase();
  const unique = [...new Set(ids)];
  if (!sb || unique.length === 0) return [];
  const { data, error } = await sb.from("feed").select("*").in("id", unique);
  if (error) throw error;
  const posts = (data ?? []).map(asPost).filter((p): p is FeedPost => p !== null);
  const views = await hydratePosts(sb, member, posts);
  const byId = new Map(views.map((v) => [v.id, v]));
  return unique.map((id) => byId.get(id)).filter((v): v is PostView => v !== undefined);
}

/**
 * The member's own save state for a set of posts: existence only, never a count. The react mark
 * left here under handoff 62-A: the card's reaction, the summary and the member's intents come from
 * post_reaction_rows in src/lib/reactions.ts, one call per page (1799, 1822).
 */
export async function loadMarks(
  memberId: string,
  postIds: string[],
): Promise<{ saved: Set<string> }> {
  const sb = getSupabase();
  const saved = new Set<string>();
  if (!sb || postIds.length === 0) return { saved };
  const { data } = await sb
    .from("post_saves")
    .select("post_id")
    .eq("member_id", memberId)
    .in("post_id", postIds);
  for (const row of data ?? []) saved.add(row.post_id);
  return { saved };
}

export async function setSaved(memberId: string, postId: string, on: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (on) {
    const { error } = await sb.from("post_saves").insert({ member_id: memberId, post_id: postId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await sb
      .from("post_saves")
      .delete()
      .eq("member_id", memberId)
      .eq("post_id", postId);
    if (error) throw error;
  }
}

/** Spaces where the member holds an active role: the "Post as" dropdown (RPC re-checks server-side). */
export async function loadMemberSpaces(memberId: string): Promise<{ id: string; name: string }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: roles } = await sb
    .from("space_roles")
    .select("space_id")
    .eq("member_id", memberId)
    .eq("status", "active");
  const ids = (roles ?? []).map((r) => r.space_id);
  if (ids.length === 0) return [];
  const { data: spaces } = await sb.from("spaces").select("id,title").in("id", ids).order("title");
  return (spaces ?? []).map((s) => ({ id: s.id, name: s.title }));
}
