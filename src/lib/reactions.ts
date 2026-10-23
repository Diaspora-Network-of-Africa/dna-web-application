// The Feed card's reaction layer, the client half (handoff 62-A; rulings 1796 to 1826). One read
// projection per surface and one write path per control (the absolute): the summary for a page of
// posts through post_reaction_rows, the reader's sheet through post_reactors_visible, the author's
// through post_reactors_author, the recents through member_recent_reactions; post_react and
// post_intent are the two writers. Nothing here reads or writes post_reactions or post_intents
// directly, and nothing here counts: the only figures are the author's own, in the author's sheet
// (1797, 1799). Every name arrives with the member's id, handle and photo so the name and the photo
// can open the profile (1820); the photo's delivery URL is signed here, once per path, as the Feed
// signs an author's (416).
import type { PostReactionKindRow } from "./vocabularies";
import { deliverImageUrls } from "./media";
import { getSupabase } from "./supabase";

/** A person as every projection names them: id, name, handle and the signed photo URL. */
export type ReactionPerson = {
  id: string;
  name: string;
  handle: string;
  avatar?: string | undefined;
  you: boolean;
};

/** The member's own public reaction on a post: a public kind, or other with its character. */
export type OwnReaction = { kind: string; emoji: string | null };

/** The summary of one post (SPEC 5): kinds in fixed order, the other mark, two people, more. */
export type ReactionSummary = {
  kinds: string[];
  other: boolean;
  people: ReactionPerson[];
  more: boolean;
  own: OwnReaction | null;
  intents: string[];
};

export type Relationship = "self" | "connected" | "through" | "outside";

/** One row of the reader's sheet (SPEC 6). */
export type ReactorRow = ReactionPerson & {
  headline: string | null;
  kind: string;
  emoji: string | null;
  relationship: Relationship;
  through: ReactionPerson | null;
};

/** One row of the author's sheet (SPEC 7): a role row carries no person. */
export type AuthorRow = {
  person: (ReactionPerson & { headline: string | null }) | null;
  class: "reaction" | "intent";
  kind: string;
  emoji: string | null;
  line: string | null;
  relationship: Relationship | null;
  through: ReactionPerson | null;
};

export type AuthorSheet = {
  /** Exact figures per kind, plus all and other: the author's own and nowhere else (1799). */
  figures: Record<string, number>;
  rows: AuthorRow[];
};

const SUMMARY_EMPTY: ReactionSummary = {
  kinds: [],
  other: false,
  people: [],
  more: false,
  own: null,
  intents: [],
};

/** The four public kinds and the two intents, split from the vocabulary row list. */
export function splitKinds(rows: readonly PostReactionKindRow[] | undefined) {
  const list = rows ?? [];
  return {
    publicKinds: list.filter((k) => k.class === "public"),
    intentKinds: list.filter((k) => k.class === "intent"),
  };
}

/**
 * The language whose gloss Asante shows (1819): the member's language's primary subtag, read from
 * the document (set by the shell) or the browser. Swahili and the held languages have no row, so
 * the name reads Asante alone.
 */
export function glossLanguage(): string {
  if (typeof document !== "undefined" && document.documentElement.lang)
    return document.documentElement.lang.split("-")[0]?.toLowerCase() ?? "en";
  if (typeof navigator !== "undefined" && navigator.language)
    return navigator.language.split("-")[0]?.toLowerCase() ?? "en";
  return "en";
}

/** Q.asanteGloss: "Asante · Thank you", or the label alone where the language has no gloss. */
export function visibleLabel(kind: PostReactionKindRow, language = glossLanguage()): string {
  const gloss = kind.glosses?.[language];
  return gloss ? kind.label + " · " + gloss : kind.label;
}

/** Q.asanteA11y: "Asante, thank you", the gloss lowered after a pause; the label alone otherwise. */
export function accessibleLabel(kind: PostReactionKindRow, language = glossLanguage()): string {
  const gloss = kind.glosses?.[language];
  return gloss ? kind.label + ", " + gloss.charAt(0).toLowerCase() + gloss.slice(1) : kind.label;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** One delivery URL per avatar path, the signings in parallel (H64-FEED1, 1920). */
function signAvatars(paths: Iterable<string | null | undefined>) {
  return deliverImageUrls("profile-media", paths, { width: 80, height: 80, resize: "cover" });
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

const avatarPathsOf = (rows: unknown[]): string[] =>
  rows.flatMap((v) => {
    const r = rec(v);
    if (!r) return [];
    const out = [str(r["avatar_path"])];
    const t = rec(r["through"]);
    if (t) out.push(str(t["avatar_path"]));
    return out.filter((p): p is string => !!p);
  });

/**
 * The summary for a page of posts (SPEC 5), one call beside the Feed's marks, never per card. Posts
 * the policy did not admit are absent from the answer; a missing key reads as no reactions.
 */
export async function loadReactionRows(postIds: string[]): Promise<Map<string, ReactionSummary>> {
  const out = new Map<string, ReactionSummary>();
  const sb = getSupabase();
  const ids = [...new Set(postIds)].filter(Boolean);
  if (!sb || ids.length === 0) return out;
  const { data, error } = await sb.rpc("post_reaction_rows", { p_posts: ids });
  if (error) throw error;
  const obj = rec(data);
  if (!obj) return out;
  const people = Object.values(obj).flatMap((v) => {
    const r = rec(v);
    return r && Array.isArray(r["people"]) ? (r["people"] as unknown[]) : [];
  });
  const urls = await signAvatars(avatarPathsOf(people));
  for (const [id, v] of Object.entries(obj)) {
    const r = rec(v);
    if (!r) continue;
    const own = rec(r["own"]);
    out.set(id, {
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
    });
  }
  for (const id of ids) if (!out.has(id)) out.set(id, SUMMARY_EMPTY);
  return out;
}

/**
 * Set, change or remove the caller's one public reaction (SPEC 2.2, 1817). Choosing the held
 * reaction removes it and the answer is null. `picked` marks a choice from the full picker, which
 * joins the recents (1821); a pick on the strip passes false.
 */
export async function postReact(
  postId: string,
  kind: string,
  emoji?: string | null,
  picked = false,
): Promise<OwnReaction | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("post_react", {
    p_post: postId,
    p_kind: kind,
    ...(emoji ? { p_emoji: emoji } : {}),
    p_picked: picked,
  });
  if (error) throw error;
  const r = rec(data);
  return r && typeof r["kind"] === "string" ? { kind: r["kind"], emoji: str(r["emoji"]) } : null;
}

/** Turn an intent on or off with its optional line (SPEC 4). Answers the caller's intents on the post. */
export async function postIntent(
  postId: string,
  kind: string,
  on: boolean,
  line?: string | null,
): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("post_intent", {
    p_post: postId,
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

/** The reader's sheet (SPEC 6): the rows the caller may see, the caller first. Never an intent. */
export async function loadReactorsVisible(postId: string): Promise<ReactorRow[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("post_reactors_visible", { p_post: postId });
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  const urls = await signAvatars(avatarPathsOf(rows));
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

/** The author's sheet (SPEC 7): every row with exact figures; a withheld name is a role row (141). */
export async function loadReactorsAuthor(postId: string): Promise<AuthorSheet> {
  const sb = getSupabase();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("post_reactors_author", { p_post: postId });
  if (error) throw error;
  const d = rec(data);
  const rows = d && Array.isArray(d["rows"]) ? (d["rows"] as unknown[]) : [];
  const figuresIn = d ? rec(d["figures"]) : null;
  const figures: Record<string, number> = {};
  for (const [k, v] of Object.entries(figuresIn ?? {}))
    figures[k] = typeof v === "number" ? v : Number(v) || 0;
  const urls = await signAvatars(avatarPathsOf(rows));
  const out: AuthorRow[] = [];
  for (const v of rows) {
    const r = rec(v);
    if (!r) continue;
    const person = personOf(v, urls);
    out.push({
      person: person ? { ...person, headline: str(r["headline"]) } : null,
      class: r["class"] === "intent" ? "intent" : "reaction",
      kind: str(r["kind"]) ?? "asante",
      emoji: str(r["emoji"]),
      line: str(r["line"]),
      relationship: person ? relationshipOf(r["relationship"]) : null,
      through: personOf(r["through"], urls),
    });
  }
  return { figures, rows: out };
}

/** The caller's up to five most recent picker emoji, newest first (1821); empty until the picker has been used. */
export async function loadRecentReactions(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("member_recent_reactions");
  if (error) throw error;
  return Array.isArray(data) ? data.filter((e): e is string => typeof e === "string") : [];
}

/**
 * The vocabulary's names for a set of characters (the recents' accessible names), read from
 * message_reaction_emoji by its base; a character the vocabulary does not hold is left unnamed.
 */
export async function emojiLabels(emoji: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const sb = getSupabase();
  const list = [...new Set(emoji)].filter(Boolean);
  if (!sb || list.length === 0) return out;
  const { data } = await sb.from("message_reaction_emoji").select("emoji,label").in("emoji", list);
  for (const r of data ?? []) out.set(r.emoji, r.label);
  return out;
}
