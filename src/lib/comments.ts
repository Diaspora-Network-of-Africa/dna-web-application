// The Feed card's comment layer, the client half (handoff 62-G; rulings 1677, 1796, 1797, 1809, 1817,
// 1820, 1822, 1849). One read projection per surface and one write path per control (the absolute):
// the thread through post_comments, the collapsed card's one line through post_latest_comments, a
// comment's summary through comment_reaction_rows, its two sheets through comment_reactors_visible
// and comment_reactors_author; comment_post, comment_react and comment_intent are the writers.
// Nothing here reads or writes comments, comment_reactions or comment_intents directly, and nothing
// here counts (1797). Every name arrives with the member's id, handle and photo so the name and the
// photo can open the profile (1820); a commenter the viewer may not see arrives with no author at
// all, and the surface renders a role (141). Times arrive absolute and the client formats them (10.1).
// A comment's image rides the post pipeline: media-upload with the post's id puts the master in the
// post's own folder, which the post's readers may already read, and comment_post names its media row.
import type { CardC } from "@/components/strand/cmeta";
import type { FocalPoint, MediaCrop } from "@/components/strand/MediaBlock";
import { signedMediaUrl } from "./dia";
import {
  deliverImageUrl,
  extensionFor,
  IMAGE_MAX_BYTES,
  IMAGE_UPLOAD_TIMEOUT_MS,
  normalizeImage,
} from "./media";
import { cropOf, focalPointOf } from "./post-view";
import {
  type AuthorSheet,
  type ReactionPerson,
  type ReactionSummary,
  type ReactorRow,
  type Relationship,
} from "./reactions";
import { functionsUrl, getSupabase, SUPABASE_PUBLISHABLE_KEY } from "./supabase";

/** A comment's image as the thread renders it through MediaBlock (1714). */
export type CommentImage = {
  id: string;
  src: string;
  width: number | null;
  height: number | null;
  focalPoint: FocalPoint | null;
  crop: MediaCrop | null;
};

/** One comment or reply as post_comments answers it. `author` is null for a withheld name (141) and for a tombstone. */
export type CommentView = {
  id: string;
  postId: string;
  parentId: string | null;
  deleted: boolean;
  you: boolean;
  /** The post author's own comment carries the Author mark (C.author, 1817). */
  isPostAuthor: boolean;
  author: ReactionPerson | null;
  body: string | null;
  media: CommentImage | null;
  createdAt: string;
  editedAt: string | null;
  reactions: ReactionSummary | null;
  replies: CommentView[];
};

export type CommentPage = {
  comments: CommentView[];
  more: boolean;
  /** The cursor the next page is read from, when `more`. */
  next: { createdAt: string; id: string } | null;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

const EMPTY_SUMMARY: ReactionSummary = {
  kinds: [],
  other: false,
  people: [],
  more: false,
  own: null,
  intents: [],
};

/** The signed delivery URL per avatar path, once per path (416's shape). */
async function signAvatars(paths: Iterable<string | null | undefined>) {
  const urls = new Map<string, string | undefined>();
  for (const p of paths) {
    if (!p || urls.has(p)) continue;
    urls.set(
      p,
      await deliverImageUrl("profile-media", p, { width: 80, height: 80, resize: "cover" }),
    );
  }
  return urls;
}

function personOf(v: unknown, urls: Map<string, string | undefined>): ReactionPerson | null {
  const r = rec(v);
  const id = r ? str(r["id"]) : null;
  if (!r || !id) return null;
  const path = str(r["avatar_path"]);
  return {
    id,
    name: str(r["name"]) ?? "",
    handle: str(r["handle"]) ?? "",
    avatar: path ? urls.get(path) : undefined,
    you: r["you"] === true,
  };
}

function summaryOf(v: unknown, urls: Map<string, string | undefined>): ReactionSummary {
  const r = rec(v);
  if (!r) return EMPTY_SUMMARY;
  const own = rec(r["own"]);
  return {
    kinds: Array.isArray(r["kinds"])
      ? r["kinds"].filter((k): k is string => typeof k === "string")
      : [],
    other: r["other"] === true,
    people: Array.isArray(r["people"])
      ? r["people"].map((p) => personOf(p, urls)).filter((p): p is ReactionPerson => !!p)
      : [],
    more: r["more"] === true,
    own:
      own && typeof own["kind"] === "string"
        ? { kind: own["kind"], emoji: str(own["emoji"]) }
        : null,
    intents: Array.isArray(r["intents"])
      ? r["intents"].filter((k): k is string => typeof k === "string")
      : [],
  };
}

/** Every avatar path a page of comments names: authors and the summaries' people, replies included. */
function avatarPathsOf(rows: unknown[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    const r = rec(v);
    if (!r) return;
    const a = rec(r["author"]);
    const ap = a ? str(a["avatar_path"]) : null;
    if (ap) out.push(ap);
    const rx = rec(r["reactions"]);
    if (rx && Array.isArray(rx["people"]))
      for (const p of rx["people"]) {
        const pp = rec(p);
        const path = pp ? str(pp["avatar_path"]) : null;
        if (path) out.push(path);
      }
    if (Array.isArray(r["replies"])) r["replies"].forEach(walk);
  };
  rows.forEach(walk);
  return out;
}

async function imageOf(v: unknown): Promise<CommentImage | null> {
  const r = rec(v);
  const id = r ? str(r["id"]) : null;
  const path = r ? str(r["storage_path"]) : null;
  if (!r || !id || !path) return null;
  const src = await signedMediaUrl(path);
  if (!src) return null;
  return {
    id,
    src,
    width: num(r["width"]),
    height: num(r["height"]),
    focalPoint: focalPointOf(r["focal_point"]),
    crop: cropOf(r["crop"]),
  };
}

async function commentOf(
  v: unknown,
  urls: Map<string, string | undefined>,
): Promise<CommentView | null> {
  const r = rec(v);
  const id = r ? str(r["id"]) : null;
  const postId = r ? str(r["post_id"]) : null;
  if (!r || !id || !postId) return null;
  const replies: CommentView[] = [];
  if (Array.isArray(r["replies"]))
    for (const x of r["replies"]) {
      const c = await commentOf(x, urls);
      if (c) replies.push(c);
    }
  const deleted = r["deleted"] === true;
  return {
    id,
    postId,
    parentId: str(r["parent_id"]),
    deleted,
    you: r["you"] === true,
    isPostAuthor: r["is_post_author"] === true,
    author: deleted ? null : personOf(r["author"], urls),
    body: deleted ? null : str(r["body"]),
    media: deleted ? null : await imageOf(r["media"]),
    createdAt: str(r["created_at"]) ?? "",
    editedAt: str(r["edited_at"]),
    reactions: deleted ? null : summaryOf(r["reactions"], urls),
    replies,
  };
}

/** The thread's page size: top-level comments a call; the server caps it at 50. */
export const COMMENTS_PAGE = 20;

/**
 * One page of the thread (SPEC 8, 1796): top-level comments oldest first after the cursor, each with
 * its replies; more and the next cursor, never a figure. A post the policy did not admit raises.
 */
export async function loadComments(
  postId: string,
  after: { createdAt: string; id: string } | null = null,
  limit = COMMENTS_PAGE,
): Promise<CommentPage> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("post_comments", {
    p_post: postId,
    ...(after ? { p_after: after.createdAt, p_after_id: after.id } : {}),
    p_limit: limit,
  });
  if (error) throw error;
  const d = rec(data);
  const rows = d && Array.isArray(d["comments"]) ? (d["comments"] as unknown[]) : [];
  const urls = await signAvatars(avatarPathsOf(rows));
  const comments: CommentView[] = [];
  for (const v of rows) {
    const c = await commentOf(v, urls);
    if (c) comments.push(c);
  }
  const next = d ? rec(d["next"]) : null;
  const nextCreated = next ? str(next["created_at"]) : null;
  const nextId = next ? str(next["id"]) : null;
  return {
    comments,
    more: d?.["more"] === true,
    next: nextCreated && nextId ? { createdAt: nextCreated, id: nextId } : null,
  };
}

/**
 * The newest comment per post for a page of posts (SPEC 8.3), one call beside the marks and the
 * reaction summaries, never per card. A post with no comment the viewer may read has no key.
 */
export async function loadLatestComments(postIds: string[]): Promise<Map<string, CommentView>> {
  const out = new Map<string, CommentView>();
  const sb = getSupabase();
  const ids = [...new Set(postIds)].filter(Boolean);
  if (!sb || ids.length === 0) return out;
  const { data, error } = await sb.rpc("post_latest_comments", { p_posts: ids });
  if (error) throw error;
  const obj = rec(data);
  if (!obj) return out;
  const urls = await signAvatars(avatarPathsOf(Object.values(obj)));
  for (const [id, v] of Object.entries(obj)) {
    const c = await commentOf(v, urls);
    if (c) out.set(id, c);
  }
  return out;
}

/** The refusals comment_post names, each the box's own line; anything else is `failed`. */
export type CommentRefusal =
  | "empty_comment"
  | "body_too_long"
  | "reply_to_reply"
  | "comment_deleted"
  | "bad_media"
  | "media_in_use"
  | "no_such_post"
  | "no_such_comment"
  | "failed";

export class CommentError extends Error {
  reason: CommentRefusal;
  constructor(reason: CommentRefusal, message?: string) {
    super(message ?? reason);
    this.reason = reason;
  }
}

function refusalOf(message: string | undefined): CommentRefusal {
  const m = message ?? "";
  for (const r of [
    "empty_comment",
    "body_too_long",
    "reply_to_reply",
    "comment_deleted",
    "bad_media",
    "media_in_use",
  ] as const)
    if (m.includes(r)) return r;
  if (m.includes("no such post")) return "no_such_post";
  if (m.includes("no such comment")) return "no_such_comment";
  return "failed";
}

/**
 * Write a comment, or a reply to a top-level comment (SPEC 8.4, 1677): text, one image, or both.
 * Answers the comment as the thread renders it. The server notifies the post's author or the
 * comment's author (1849); a self-act notifies no one.
 */
export async function postComment(
  postId: string,
  body: string | null,
  opts: { parentId?: string | null | undefined; mediaId?: string | null | undefined } = {},
): Promise<CommentView> {
  const sb = getSupabase();
  if (!sb) throw new CommentError("failed", "no client");
  const { data, error } = await sb.rpc("comment_post", {
    p_post: postId,
    ...(opts.parentId ? { p_parent: opts.parentId } : {}),
    ...(body ? { p_body: body } : {}),
    ...(opts.mediaId ? { p_media: opts.mediaId } : {}),
  });
  if (error) throw new CommentError(refusalOf(error.message), error.message);
  const urls = await signAvatars(avatarPathsOf([data]));
  const c = await commentOf(data, urls);
  if (!c) throw new CommentError("failed", "no comment answered");
  return c;
}

export type CommentImageUpload =
  | {
      ok: true;
      mediaId: string;
      width: number | null;
      height: number | null;
      /** An object URL of the bytes that were sent, for the tile's own preview. */
      previewUrl: string;
    }
  | { ok: false; reason: "too_large" | "failed" };

/**
 * One image for a comment through media-upload, the one write path of the media pipeline (346 to 348),
 * with the post's id so the master lands in the post's own folder, which the post's readers may
 * read. Normalised on the device first (347); bounded in time (345); the media row's id is what
 * comment_post names. A failed upload keeps the text in the box (SPEC 8.4): the caller's.
 */
export async function uploadCommentImage(file: File, postId: string): Promise<CommentImageUpload> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "failed" };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: "failed" };
  const normalized = await normalizeImage(file);
  const upload = normalized
    ? new File([normalized.blob], "comment." + extensionFor(normalized.type), {
        type: normalized.type,
      })
    : file;
  if (upload.size > IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  const form = new FormData();
  form.append("file", upload);
  form.append("post_id", postId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(functionsUrl("media-upload"), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: form,
      signal: controller.signal,
    });
    if (res.status === 413) return { ok: false, reason: "too_large" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const out = (await res.json()) as {
      media_id?: string;
      width?: number;
      height?: number;
      error?: string;
    };
    if (out.error === "too_large") return { ok: false, reason: "too_large" };
    if (!out.media_id) return { ok: false, reason: "failed" };
    return {
      ok: true,
      mediaId: out.media_id,
      width: typeof out.width === "number" ? out.width : (normalized?.width ?? null),
      height: typeof out.height === "number" ? out.height : (normalized?.height ?? null),
      previewUrl: URL.createObjectURL(upload),
    };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------------
// The comment's reaction layer (SPEC 8.2, 1809, 1822): the post's rules applied per comment, through
// the comment functions, each with the post function's shape so one layer serves both.
// ---------------------------------------------------------------------------------------------------

/** The summary for a set of comments (SPEC 5 at small), keyed by comment id. */
export async function loadCommentReactionRows(
  commentIds: string[],
): Promise<Map<string, ReactionSummary>> {
  const out = new Map<string, ReactionSummary>();
  const sb = getSupabase();
  const ids = [...new Set(commentIds)].filter(Boolean);
  if (!sb || ids.length === 0) return out;
  const { data, error } = await sb.rpc("comment_reaction_rows", { p_comments: ids });
  if (error) throw error;
  const obj = rec(data);
  if (!obj) return out;
  const people = Object.values(obj).flatMap((v) => {
    const r = rec(v);
    return r && Array.isArray(r["people"]) ? (r["people"] as unknown[]) : [];
  });
  const urls = await signAvatars(
    people.map((p) => {
      const r = rec(p);
      return r ? str(r["avatar_path"]) : null;
    }),
  );
  for (const [id, v] of Object.entries(obj)) out.set(id, summaryOf(v, urls));
  for (const id of ids) if (!out.has(id)) out.set(id, EMPTY_SUMMARY);
  return out;
}

/** Set, change or remove the caller's one public reaction on a comment (1817). */
export async function commentReact(
  commentId: string,
  kind: string,
  emoji?: string | null,
  picked = false,
): Promise<{ kind: string; emoji: string | null } | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("comment_react", {
    p_comment: commentId,
    p_kind: kind,
    ...(emoji ? { p_emoji: emoji } : {}),
    p_picked: picked,
  });
  if (error) throw error;
  const r = rec(data);
  return r && typeof r["kind"] === "string" ? { kind: r["kind"], emoji: str(r["emoji"]) } : null;
}

/** Turn an intent on or off on a comment with its optional line (1817); answers the caller's intents. */
export async function commentIntent(
  commentId: string,
  kind: string,
  on: boolean,
  line?: string | null,
): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("comment_intent", {
    p_comment: commentId,
    p_kind: kind,
    p_on: on,
    ...(line ? { p_line: line } : {}),
  });
  if (error) throw error;
  return Array.isArray(data) ? data.filter((k): k is string => typeof k === "string") : [];
}

function relationshipOf(v: unknown): Relationship {
  return v === "self" || v === "connected" || v === "through" ? v : "outside";
}

const rowAvatarPaths = (rows: unknown[]): string[] =>
  rows.flatMap((v) => {
    const r = rec(v);
    if (!r) return [];
    const out = [str(r["avatar_path"])];
    const t = rec(r["through"]);
    if (t) out.push(str(t["avatar_path"]));
    return out.filter((p): p is string => !!p);
  });

/** The reader's sheet for a comment (SPEC 6 through 8.2): the rows the caller may see, never an intent. */
export async function loadCommentReactorsVisible(commentId: string): Promise<ReactorRow[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("comment_reactors_visible", { p_comment: commentId });
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  const urls = await signAvatars(rowAvatarPaths(rows));
  const out: ReactorRow[] = [];
  for (const v of rows) {
    const r = rec(v);
    const person = personOf(v, urls);
    if (!r || !person) continue;
    out.push({
      ...person,
      headline: str(r["headline"]),
      kind: str(r["kind"]) ?? "asante",
      emoji: str(r["emoji"]),
      relationship: relationshipOf(r["relationship"]),
      through: personOf(r["through"], urls),
    });
  }
  return out;
}

/** The commenter's own sheet (SPEC 7 through 8.2): every row with exact figures; a withheld name is a role row (141). */
export async function loadCommentReactorsAuthor(commentId: string): Promise<AuthorSheet> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("comment_reactors_author", { p_comment: commentId });
  if (error) throw error;
  const d = rec(data);
  const rows = d && Array.isArray(d["rows"]) ? (d["rows"] as unknown[]) : [];
  const figuresIn = d ? rec(d["figures"]) : null;
  const figures: Record<string, number> = {};
  for (const [k, v] of Object.entries(figuresIn ?? {}))
    figures[k] = typeof v === "number" ? v : Number(v) || 0;
  const urls = await signAvatars(rowAvatarPaths(rows));
  return {
    figures,
    rows: rows.flatMap((v) => {
      const r = rec(v);
      if (!r) return [];
      const person = personOf(v, urls);
      return [
        {
          person: person ? { ...person, headline: str(r["headline"]) } : null,
          class: r["class"] === "intent" ? ("intent" as const) : ("reaction" as const),
          kind: str(r["kind"]) ?? "asante",
          emoji: str(r["emoji"]),
          line: str(r["line"]),
          relationship: person ? relationshipOf(r["relationship"]) : null,
          through: personOf(r["through"], urls),
        },
      ];
    }),
  };
}

/** What the reaction layer needs of the thing it decorates, a post or a comment (one layer, two targets). */
export type ReactionTarget = {
  id: string;
  c: CardC;
  /** The author, for the intent prompt's line and the author's sheet (1813): name, handle, photo. */
  author: { id: string | undefined; name: string; handle: string; avatar?: string | undefined };
};
