// The backing shape every card renders from (brief section 3). Built by the composer for its
// preview and by the Feed host from database rows; both go through PostCardRouter.
import type { Audience } from "@/components/strand/AudienceSelect";
import type { C, CardC } from "@/components/strand/cmeta";
import type { FieldValues } from "@/components/strand/verb-schema";
import type { FocalPoint, MediaCrop } from "@/components/strand/MediaBlock";

/** One post image as the Feed renders it (H60-MEDIA Work 3). */
export type PostImage = {
  /** Empty while the Feed's one signing call is in flight (H64-FEED1), and MediaBlock draws its loading frame. */
  src: string;
  /** H64-FEED1: the storage path of an image the Feed signs after the cards render. */
  path?: string | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  focalPoint?: FocalPoint | null | undefined;
  crop?: MediaCrop | null | undefined;
};

/** A media row's `focal_point`, as ImageAdjust writes it (351): `{x, y}` in 0 to 1; null otherwise. */
export function focalPointOf(v: unknown): FocalPoint | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = Number(o["x"]);
  const y = Number(o["y"]);
  return isFinite(x) && isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

/** A media row's `crop`, as ImageAdjust writes it (351): `{x, y, width, height}` in 0 to 1; null otherwise. */
export function cropOf(v: unknown): MediaCrop | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = Number(o["x"]);
  const y = Number(o["y"]);
  const width = Number(o["width"]);
  const height = Number(o["height"]);
  const ok =
    [x, y, width, height].every((n) => isFinite(n)) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1.0001 &&
    y + height <= 1.0001;
  return ok ? { x, y, width, height } : null;
}

export type LinkView = {
  url: string;
  domain?: string | undefined;
  title?: string | undefined;
  image?: string | undefined;
};

/**
 * Convene Pass 1 (P1-SPEC section 2): what the card needs of the event beyond the meta line, all of
 * it derived at read. `past` from the start or the window's end (ruling owed 5), never stored;
 * `cancelled` from status, with the sentence the card renders in place of the body; `space` only
 * when the event is linked to one (Canon 6), for the expanded card's hook row.
 */
export type EventView = {
  /** The event's id: the expanded card's hook into its page (Brief 10, ruling 1023). */
  id: string;
  cancelled: boolean;
  past: boolean;
  /** The cancelled card's body: the fact and the host's reason verbatim (SPEC 2). */
  cancelledBody: string | null;
  space: { id: string; name: string } | null;
  /** Brief 10 (679): the accepted speakers, from `event_speakers`, for the card's row. */
  speakers: EventSpeakerView[];
  /**
   * Handoff 32-B (1076 to 1079, 1099): what Discovery's fixed-size face reads beside the meta line,
   * from the same rows the meta line is built from. `when` is the meta line's own when, the viewer's
   * zone first and the event's local time second; `places` is each physical row's city in position
   * order (its place words where it names no city), empty for an online event; `family` is the
   * convene_families value, whose label comes from the vocabulary. `startsAt` is the row's own
   * start, null for an event with no date yet, which has no calendar file (1097).
   */
  mode: "in_person" | "virtual" | "hybrid";
  family: string | null;
  hostId: string;
  when: string;
  startsAt: string | null;
  places: string[];
  /**
   * Addendum 4 item 1 (674, 1079, 1121): the presenter line as the event pane names it, read from
   * `event_presenters`: the latest published post's author, a member or a Space, else the host. The
   * avatar is the pane's (a member presenter's own, otherwise the host's) and the handle is a member
   * presenter's own. Null where the read answered nothing, and the line keeps the author's (416).
   */
  presenter: EventPresenterView | null;
};

export type EventPresenterView = {
  kind: "member" | "space";
  id: string;
  name: string;
  handle?: string | undefined;
  avatar?: string | undefined;
};

export type EventSpeakerView = {
  party_id: string;
  name: string;
  label: string;
  avatar?: string | undefined;
};

export type PostView = {
  id?: string | undefined;
  c_category: CardC;
  /** The verb that created an object; null for an untyped Convey post. */
  verb: C | null;
  author_kind: "member" | "space";
  /** Handoff 62-A: the author's id, so the Feed knows the viewer's own post (the author's sheet, 1813). */
  author_id?: string | undefined;
  author_name: string;
  /** Ruling 416: the handle line under the name, only when the viewer may see the core row. */
  author_handle?: string | undefined;
  author_avatar?: string | undefined;
  body: string;
  anchor_name?: string | undefined;
  audience: Audience;
  fields: FieldValues;
  /** The post's images, at most four, in position order (1707, 1709): the signed or object URL,
   *  the stored size that picks the frame (1643), and the author's framing from the media row,
   *  null where the row or its framing is absent so MediaBlock renders its default. */
  media: PostImage[];
  link?: LinkView | null | undefined;
  /** The meta line's words where they are not a time: a Convene card's event line (P1-SPEC 2). */
  meta?: string | undefined;
  /** 62-G (SPEC 10.1): the post's instant, absolute from the server; the card formats it. */
  published_at?: string | null | undefined;
  /** Present on a Convene card (created object of kind event). */
  event?: EventView | undefined;
};

export function domainOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return url;
  }
}
