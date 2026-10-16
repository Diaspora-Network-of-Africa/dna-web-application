// The one card renderer keyed on c_category (brief: card router). The composer preview, the Feed
// list, the in-place expansion and the direct-link view all render through here; there is no second
// renderer (rulings 52, 105).
import type { MouseEvent, ReactNode } from "react";
import { AUDIENCE_LABEL } from "@/components/strand/AudienceSelect";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { PostCard, type PostCardProps } from "@/components/strand/PostCard";
import { CARD_SCHEMA, fieldRows, UNTYPED } from "@/components/strand/verb-schema";
import { memberEventPath } from "@/lib/event-page";
import type { EventSpeakerView, PostView } from "@/lib/post-view";

/**
 * Brief 10 (679, B10-SPEC 3.9): the card's speakers row at every tier. Avatar 32, the name, the
 * role label, horizontally scrollable; accepted only, and absent below one. Drawn as a field row
 * whose value is a node, the same shape as the Space hook (Canon 6, 642), so the card chassis
 * gains no new slot. Pills stop the card's own tap so a scroll of the strip is not a navigation.
 */
function speakersRow(speakers: EventSpeakerView[]): ReactNode {
  return (
    <span
      data-card-speakers
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        scrollbarWidth: "none",
        paddingBottom: 2,
        margin: "2px 0",
        // The strip never widens the card: its intrinsic inline size is contained, so a long row
        // of pills scrolls inside the column instead of pushing the grid past it (ruling 344).
        minWidth: 0,
        contain: "inline-size",
      }}
    >
      {speakers.map((s) => (
        <span
          key={s.party_id}
          data-speaker="accepted"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flex: "none",
            padding: "3px 10px 3px 3px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            whiteSpace: "nowrap",
          }}
        >
          <Avatar name={s.name} src={s.avatar} size={32} />
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{s.name}</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{s.label}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

export type RouterOptions = {
  preview?: boolean | undefined;
  /** PostCard's Feed anatomy (ruling 69). Default: the composer card. */
  feed?: boolean | undefined;
  onMenu?: (() => void) | undefined;
  onClick?: (() => void) | undefined;
  onAct?: (() => void) | undefined;
  saved?: boolean | undefined;
  reacted?: boolean | undefined;
  onReact?: (() => void) | undefined;
  /** 62-A (SPEC 2.2): a 500 ms hold on touch or a pointer hover on React opens the bar. */
  onReactOpen?: (() => void) | undefined;
  /** 62-A (SPEC 5): the reaction summary, rendered in the feed footer between Respond and Save. */
  summary?: ReactNode;
  /** 62-A (SPEC 1, 12; 1651, 1652): the quick bar and the intent prompt, in PostCard's `below`. */
  below?: ReactNode;
  /** 62-A (SPEC 11, 1820): the author's profile address; the avatar and the name open it. */
  authorHref?: string | undefined;
  onAuthor?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  onRespond?: (() => void) | undefined;
  onSave?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  readMoreHref?: string | undefined;
  onReadMore?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  onReadMoreIntent?: (() => void) | undefined;
  /**
   * 1065, 1067: the expanded card's Event hook stays a real link to the member event path; the host
   * intercepts a plain click here to navigate with its origin, on the Read more pattern. Absent, the
   * link is a document navigation.
   */
  onOpenEvent?: ((e: MouseEvent<HTMLElement>, eventId: string) => void) | undefined;
  expanded?: boolean | undefined;
  onCollapse?: (() => void) | undefined;
  actions?: ReactNode;
};

/**
 * Map a PostView to PostCard props. Untyped posts take the convey frame and, under ruling 546 (W54),
 * Convey's kicker; they still carry no title and no action (ruling 68). UNTYPED is that one row.
 */
export function postCardProps(view: PostView, opts: RouterOptions = {}): PostCardProps {
  const schema = view.verb ? CARD_SCHEMA[view.verb] : UNTYPED;
  const c = view.c_category;
  const titleWords = view.verb ? view.fields.title?.value : undefined;
  // Convene Pass 1 (P1-SPEC section 2). Cancelled is the full treatment inside 69's anatomy: kicker
  // `Event cancelled`, the title struck in --ink-3, the body the fact and the host's reason, never
  // clamped, no media, no hook rows, no tap into the event page. Past keeps the kicker and the
  // meta line says `Happened`. The Space hook (Canon 6, 642) renders in the expanded card only,
  // as a text link in Collaborate's text colour, and only when the event is linked to a Space.
  const ev = view.event;
  const cancelled = !!ev?.cancelled;
  // 1643, 1697, 1708: every C's card is framed by its image through the frame set, Convene's with
  // the rest; the Feed passes no ratio (1077's 16:9 now holds for the discovery face's lane card
  // only, which draws its own). Each image carries its stored size and the author's framing
  // (1707, 1709); the expanded card draws a single image whole (1643 item 6).
  const first = view.media[0];
  const media: PostCardProps["media"] = cancelled
    ? undefined
    : view.media.length > 1
      ? { kind: "gallery", items: view.media }
      : first
        ? {
            kind: "image",
            src: first.src,
            alt: "",
            width: first.width,
            height: first.height,
            focalPoint: first.focalPoint,
            crop: first.crop,
            whole: !!opts.expanded,
          }
        : undefined;
  const title: ReactNode =
    typeof titleWords === "string" && titleWords ? (
      cancelled ? (
        <span
          data-cancelled-title
          style={{
            color: "var(--ink-3)",
            textDecoration: "line-through",
            textDecorationColor: "var(--line-strong)",
          }}
        >
          {titleWords}
        </span>
      ) : (
        titleWords
      )
    ) : undefined;
  const hookRows: PostCardProps["fields"] = [];
  // Brief 10 (679): the speakers row, at every tier, above the hooks; absent below one.
  if (ev && !cancelled && ev.speakers.length > 0)
    hookRows.push({ label: "Speakers", icon: "mic", value: speakersRow(ev.speakers) });
  if (ev && !cancelled && opts.expanded) {
    // Brief 10 (1023): the expanded card's hook into the event page, in Convene's colour, the
    // way the Space hook below reads in Collaborate's. This is the Feed's entry into the page; the
    // Feed's onOpenEvent carries its origin so the page's Back row names Feed (1065).
    hookRows.push({
      label: "Event",
      icon: "calendar",
      value: (
        <a
          href={memberEventPath(ev.id)}
          data-hook="event"
          onClick={(e) => {
            e.stopPropagation();
            opts.onOpenEvent?.(e, ev.id);
          }}
          style={{
            color: "var(--c-convene-text)",
            fontWeight: 500,
            textDecoration: "underline",
            textDecorationColor: "var(--line-strong)",
            textUnderlineOffset: 2,
          }}
        >
          Open the event page
        </a>
      ),
    });
    if (ev.space)
      hookRows.push({
        label: "Space",
        icon: "hash",
        value: (
          <a
            href="/collaborate"
            data-hook="space"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: "var(--c-collaborate-text)",
              fontWeight: 500,
              textDecoration: "underline",
              textDecorationColor: "var(--line-strong)",
              textUnderlineOffset: 2,
            }}
          >
            {ev.space.name}
          </a>
        ),
      });
  }
  // The post's own act in its C (rule 3). In the Feed it goes to that C's route; in the composer
  // preview it is inert.
  const actions =
    opts.actions ??
    (schema.action && c !== "system" ? (
      <Button c={c} size="sm" onClick={opts.feed ? opts.onAct : opts.onRespond}>
        {schema.action}
      </Button>
    ) : undefined);
  return {
    c,
    author: view.author_name,
    authorHandle: view.author_handle,
    authorKind: view.author_kind,
    avatarSrc: view.author_avatar,
    meta: view.meta,
    anchor: view.anchor_name,
    audience: AUDIENCE_LABEL(view.audience, view.anchor_name),
    kicker: ev ? (cancelled ? "Event cancelled" : "Event") : schema.kicker,
    title,
    fields: [...fieldRows(view.verb, view.fields), ...hookRows],
    media,
    link: cancelled ? undefined : (view.link ?? undefined),
    actions,
    respondLabel: c === "convene" ? "Ask the host" : "Respond",
    preview: opts.preview,
    feed: opts.feed,
    onMenu: opts.onMenu,
    onClick: cancelled ? undefined : opts.onClick,
    saved: opts.saved,
    reacted: opts.reacted,
    onReact: opts.onReact,
    onReactOpen: opts.onReactOpen,
    summary: opts.summary,
    below: opts.below,
    authorHref: opts.authorHref,
    onAuthor: opts.onAuthor,
    onRespond: opts.onRespond,
    onSave: opts.onSave,
    onShare: opts.onShare,
    readMoreHref: cancelled ? undefined : opts.readMoreHref,
    onReadMore: cancelled ? undefined : opts.onReadMore,
    onReadMoreIntent: cancelled ? undefined : opts.onReadMoreIntent,
    expanded: cancelled ? true : opts.expanded,
    onCollapse: cancelled ? undefined : opts.onCollapse,
  };
}

export function PostCardRouter({ view, ...opts }: { view: PostView } & RouterOptions) {
  const props = postCardProps(view, opts);
  const body = view.event?.cancelled ? view.event.cancelledBody : view.body;
  return <PostCard {...props}>{body || undefined}</PostCard>;
}
