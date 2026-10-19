// Ported from the B2-Shell-Feed-v3 extraction, shell/strand-patch/PostCard.jsx (ruling 105, amends
// 85). Adds `expanded` and `onCollapse`: with onReadMore set, the body clamps to 4 lines until
// expanded; expanded unclamps the same instance and swaps the link to "Show less". Brief 2's Feed
// anatomy (ruling 69) stays behind `feed`: meta line in the C's text rung, overflow menu (onMenu),
// divider, four icon-only actions (React, Respond, Save, Share; ruling 72: a single act, no counts).
// Without `feed` the card renders exactly as Brief 1 shipped it (composer preview).
// Production addition: readMoreHref renders "Read more" as a real link (prefetch, new tab) and
// onReadMoreIntent fires after an 80ms hover hold (ruling 84); both default to the bundle's button.
//
// Reconciled at compile v1790212533284400 (handoff 32-A, rulings 862 and 844) with correction 23 §2
// (1083) and correction 25 §1 (1076 to 1079, 1087, 1096, 1097, 1102); the dispositions are in
// docs/strand-ports/v1790212533284400.md. `PostCard` now dispatches on `presentation` before any
// hook runs: `feed` (the default) is the body above, renamed `FeedFace` and otherwise unchanged
// except for `selected`; `discovery` is Convene's fixed-size face. `selected` (1083) draws a 2px
// --ink ring 2px outside the identity frame on either face, with `data-selected` for Pane's
// `selectedKey` follow and `aria-current="true"`; absent, nothing is drawn. The compile carries the
// ring's `box-shadow` transition on every article, selected or not, and so does this port: at rest
// there is no shadow for it to move. The app-only markers and behaviours the compile does not carry
// (data-c, data-expanded, data-kicker, the footer's data-testids and aria-pressed, the handle line,
// the clamp-gated body tap, Read more as a link, Show less) are kept under rulings 84, 105, 416 and
// W54, and both faces read G42's --c-system rungs where the compile writes --line-strong and --ink-3.
// Only `src/components/dna/DiscoverySurface.tsx` passes `presentation="discovery"` and `selected`;
// every other caller renders the feed face.
//
// Reconciled at compile v1790366257373061 (handoff 33-A, rulings 862 and 844): correction 28 with
// correction 29's ask 1 folded in (1130), ratified under 1134; the dispositions are in
// docs/strand-ports/v1790366257373061.md. Before the change this file equalled v1790279130697923
// (whose PostCard is byte-equal to v1790212533284400's) but for the divergences named here. The feed
// face is byte-equal across the two compiles and is unchanged. The discovery face takes: `href`
// (G100, 1067), which renders the title as a real anchor carrying `data-card-open` with a
// `data-card-cover` span at inset 0 spanning the face, so the face opens in a new tab, copies and
// middle-clicks as a link; a plain primary click with no modifier and not already prevented calls
// `onOpen` and prevents the default, and any other click is the browser's. With `href` the article
// carries `data-href` and no click handler of its own, the presenter and the topic stand above the
// cover (position relative, z-index 1) as the ellipsis already did, and the ellipsis is named
// "{menuLabel}: {title}". The two-line clamp moves off the button onto a `data-title-clamp` span
// inside the link or button (G115: WebKit does not clamp a button). Geometry (G113): gap 8, was 12;
// presenter row 36 on pointer, was 32, and --target-primary on touch (498); the last row 28 behind a
// 1px --line rule, one line cut with an ellipsis, was two lines of --text-xs with no rule. `going`
// (the caller's sentence, shown only when `reason` is absent, marked `data-going`) and `onReport`
// (the Menu ends with a rule and `reportLabel`, default "Report", `flag` icon, danger tone) are
// correction 29's ask 1. The ellipsis and the Menu name append a title only when it is a string,
// because this port's title may be a node; the compile concatenates whatever it is given.
//
// At compile v1791654208929113 (H60-MEDIA Work 1; 1432, 1544): the feed face passes the link
// preview its size from the post's media kind, `row` when the post also carries an image, a
// gallery, a strip, a carousel or a video, `full` otherwise, as compiled. `media` reaches
// MediaBlock unchanged, so its new fields (width, height, focalPoint, crop, whole, items as tiles)
// need nothing here. Record: docs/strand-ports/v1791654208929113-media.md.
//
// At compile sha256-b1a458dac1bd562f (brief 60-SP items 1 and 12; FC 5.2 item 1, 1651, 1652; RF 5.2
// item 1, 1697; item 21, 1714; ratified 1728; handoff H61-SP): `below`, on the feed face, renders
// after the footer inside the chassis at the card's padding and 12 gap (`data-below`), so a
// reaction row, the latest comment and the thread sit inside the 1.5px C frame; nothing passes it
// yet (the Feed card's comments are their own handoff). The discovery face keeps its own fixed 16:9
// box and places `media.focalPoint` and `media.crop` through MediaBlock's exported imageFrame and
// placement; under item 21 the box takes --media-fill and `data-frame` (fixed, or fixed-whole for a
// flyer past one ratio step of 16:9, which shows whole). The face still opens the event, never the
// viewer, so it does not render through MediaBlock. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  Fragment,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useMode, type Mode } from "@/lib/tier";
import { Avatar } from "./Avatar";
import { CBadge } from "./CBadge";
import { Icon } from "./Icon";
import { Chip } from "./Chip";
import { IconButton } from "./IconButton";
import { MediaBlock, imageFrame, placement, type MediaBlockProps } from "./MediaBlock";
import { Menu, type MenuProps } from "./Menu";
import type { CardC } from "./cmeta";

/** 1432, 1544: the media kinds that make a post "also carry images", so its link unfurl renders as a row rather than full. Video counts. */
const IMAGE_KINDS = ["image", "gallery", "strip", "carousel", "video"];

export type PostCardField = {
  label: string;
  icon?: string | undefined;
  /** Words, or a node when the row is a hook into another C (Convene Pass 1, Canon 6, ruling 642). */
  value: ReactNode;
  mine?: boolean | undefined;
};
export type PostCardLink = {
  url: string;
  domain?: string | undefined;
  title?: string | undefined;
  image?: string | undefined;
};

export type PostCardProps = {
  c?: CardC;
  author?: string | undefined;
  /** Ruling 416: the handle line, rendered under the name when the author's core row is visible. */
  authorHandle?: string | undefined;
  authorKind?: "member" | "space";
  /** 62-G (SPEC 10.1, 1817): a node, so the Feed passes its `time` element; a string renders as before. */
  meta?: ReactNode;
  avatarSrc?: string | undefined;
  anchor?: string | undefined;
  audience?: string | undefined;
  kicker?: string | null | undefined;
  /** Words, or a node: the cancelled event's title is struck in --ink-3 (Convene Pass 1, SPEC 2). */
  title?: ReactNode;
  children?: ReactNode;
  fields?: PostCardField[] | undefined;
  /** The feed face reads a MediaBlock props object; the discovery face reads a source string or
   *  `{ src, alt }`, which is the same object without a kind. The type is one for both faces, so a
   *  string on the feed face type-checks and renders no media, as a kind-less object always has. */
  media?: MediaBlockProps | string | undefined;
  link?: PostCardLink | null | undefined;
  actions?: ReactNode;
  saved?: boolean | undefined;
  onSave?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onRespond?: (() => void) | undefined;
  respondLabel?: string;
  onClick?: (() => void) | undefined;
  preview?: boolean | undefined;
  /** Feed anatomy (ruling 69). Without it the card is the Brief 1 composer card. */
  feed?: boolean | undefined;
  onMenu?: (() => void) | undefined;
  /** When set, the body clamps to four lines and an explicit "Read more" follows it. */
  onReadMore?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  readMoreHref?: string | undefined;
  onReadMoreIntent?: (() => void) | undefined;
  /** Unclamps the body of this same instance (ruling 105). */
  expanded?: boolean | undefined;
  /** Renders "Show less"; absent on the direct-link view, which has "Back to Feed" instead. */
  onCollapse?: (() => void) | undefined;
  reacted?: boolean | undefined;
  onReact?: (() => void) | undefined;
  /** Handoff 62-A (SPEC 2.2, 1633; recorded in docs/strand-ports/sha256-b1a458dac1bd562f.md): on
   *  the feed face a 500 ms hold on React (touch) or a pointer hover opens the quick bar; the tap
   *  that ends a hold does nothing. Absent, React is the tap alone. */
  onReactOpen?: (() => void) | undefined;
  /** Handoff 62-A (SPEC 5, 1822; proposal 4, PostCard `summary`): a node in the feed footer's
   *  space between Respond and Save, where the bare spacer was. Absent, the spacer. */
  summary?: ReactNode;
  /** Handoff 62-A (SPEC 11, 1820; proposal 12): the author's profile address. With it the avatar
   *  and the name are one link named "{author}’s profile" that stops at the link; `onAuthor` takes
   *  a plain click for the app's own navigation. Absent, the header is unchanged. */
  authorHref?: string | undefined;
  onAuthor?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  /** 1083 (correction 23). The card a pane is open on: a 2px --ink ring 2px outside the identity
   *  frame on a --bg gap, `data-selected` and `aria-current="true"`. Absent: unchanged. */
  selected?: boolean | undefined;
  /** Brief 60-SP item 1 (1651, 1652): on the feed face, after the footer, inside the chassis and
   *  its C frame, at the card's padding with a 12 gap. Absent, the card is unchanged. */
  below?: ReactNode;
  /** Correction 25 (1102). `feed` (default) renders exactly as before; `discovery` is the
   *  fixed-size Convene face, which reads only the props below and `c`, `title`, `media`,
   *  `selected` and `style`. */
  presentation?: "feed" | "discovery" | undefined;
  /** discovery: the member's zone first, the event's local second (1099), composed by the caller. */
  when?: string | undefined;
  /** discovery: "In person · Accra", "Online", "Hybrid · Nairobi". */
  where?: string | undefined;
  /** discovery: the presenter's name, beside a 24 Avatar. */
  presenter?: string | undefined;
  presenterSrc?: string | undefined;
  /** discovery: the topic, a Chip in the C; absent when null. */
  topic?: string | undefined;
  /** discovery: DIA's reason in words (1096), one line in a 28 row behind a rule (correction 28).
   *  Absent, the row holds its height empty. Never a number. */
  reason?: string | undefined;
  /** discovery, correction 29 ask 1 (folded into 28, 1130): the caller's going sentence, shown in
   *  the last row when `reason` is absent; `reason` wins when both are passed. One line, cut with an
   *  ellipsis. The part never composes names and never counts; an empty value holds the row. */
  going?: string | undefined;
  /** discovery, correction 29 ask 1: the Menu ends with a rule and Report, danger tone, `flag`
   *  icon. Absent, neither (1097, 1129). */
  onReport?: (() => void) | undefined;
  /** discovery: Report's label. Default "Report". */
  reportLabel?: string | undefined;
  /** discovery, correction 28 (G100, 1067): the event's address. The title renders as a real anchor
   *  with a cover spanning the face, so the face opens in a new tab, copies and middle-clicks; the
   *  ellipsis, presenter and topic stand above the cover. The ellipsis is then named
   *  "{menuLabel}: {title}". */
  href?: string | undefined;
  /** discovery: the whole face opens the event; a press on a control does not. With `href`, a plain
   *  primary click calls it and prevents the default, for the caller's in-app navigation. */
  onOpen?: (() => void) | undefined;
  /** discovery: once, on pointer enter or focus. */
  onPreload?: (() => void) | undefined;
  /** discovery: the presenter's name opens their profile. */
  onPresenter?: (() => void) | undefined;
  /** discovery: the topic chip narrows. */
  onTopic?: (() => void) | undefined;
  /** discovery: the ellipsis Menu's items; absent when they do not apply, never disabled (1102).
   *  No items, no control. */
  menu?: MenuProps["items"] | undefined;
  /** discovery: the ellipsis control's accessible name, and with `href` and a string title,
   *  "{menuLabel}: {title}". Default "More". */
  menuLabel?: string;
  /** discovery: false renders the Menu in place (scaled frames). Default true. */
  menuPortal?: boolean;
  /** discovery: overrides the detected input mode (44 control and 44 presenter row on touch; 36
   *  and 36 on pointer; hover only on pointer). */
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

/** The one card chassis (rule 1). Identity marker is a 1.5px full-frame border in the C color (rule 2).
 *  c="system" is the fallback category: framed in --line-strong, no glyph badge.
 *  fields: structured rows of the created object; a row with mine=true was written by the member (DIA never rewrites it).
 *  Correction 25: dispatches to one of two faces before any hook runs, so hook order never
 *  depends on `presentation`. */
export function PostCard(props: PostCardProps) {
  if (props.presentation === "discovery") return <DiscoveryFace {...props} />;
  return <FeedFace {...props} />;
}

const SELECTED_RING = "0 0 0 2px var(--bg), 0 0 0 4px var(--ink)";

function FeedFace({
  c = "connect",
  author,
  authorHandle,
  authorKind = "member",
  meta,
  avatarSrc,
  anchor,
  audience,
  kicker,
  title,
  children,
  fields,
  media,
  link,
  actions,
  saved,
  onSave,
  onShare,
  onRespond,
  respondLabel = "Respond",
  onClick,
  preview,
  feed,
  onMenu,
  onReadMore,
  readMoreHref,
  onReadMoreIntent,
  expanded,
  onCollapse,
  reacted,
  onReact,
  onReactOpen,
  summary,
  authorHref,
  onAuthor,
  selected,
  below,
  style,
}: PostCardProps) {
  const [, setHover] = useState(false);
  // 62-A (SPEC 2.2, 1633): React's hold on touch and hover on pointer open the bar; the release
  // that ends a hold is swallowed, so a hold reads and never reacts.
  // H62-A1: on iPhone Safari the hold began a text selection across React and the text above it,
  // and the selection held the touch so the bar could not be tapped (16 October, 04:56 PDT). iOS
  // begins its loupe only on a selectable hit node, so the feed footer (the action row) and the
  // React control answer user-select none and -webkit-touch-callout none, and nothing above the
  // row changes: the post body stays selectable. The contextmenu guard below stays for the long
  // press's menu on engines that raise one.
  const reactHold = useRef<number | null>(null);
  const reactHeld = useRef(false);
  const reactPress = onReactOpen
    ? {
        onPointerDown: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse") return;
          reactHeld.current = false;
          if (reactHold.current) window.clearTimeout(reactHold.current);
          reactHold.current = window.setTimeout(() => {
            reactHeld.current = true;
            onReactOpen();
          }, 500);
        },
        onPointerUp: () => {
          if (reactHold.current) window.clearTimeout(reactHold.current);
          reactHold.current = null;
        },
        onPointerCancel: () => {
          if (reactHold.current) window.clearTimeout(reactHold.current);
          reactHold.current = null;
          reactHeld.current = false;
        },
        onPointerLeave: () => {
          if (reactHold.current) window.clearTimeout(reactHold.current);
          reactHold.current = null;
        },
        onPointerEnter: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse") onReactOpen();
        },
        onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      }
    : {};
  const reactClick = () => {
    if (reactHeld.current) {
      reactHeld.current = false;
      return;
    }
    onReact?.();
  };
  const authorLabel = author ? author + "’s profile" : undefined;
  const authorClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    if (!onAuthor) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onAuthor(e);
  };
  const sys = c === "system";
  // G42: the system category has three declared rungs and the card used to write two literals here
  // instead. The frame agreed with --c-system by accident (it holds --line-strong); the label did
  // not, writing --ink-3 where --c-system-ink is --ink. Both now read the tokens, so the declared
  // palette and the shipped card cannot disagree about the system category again. This moves a
  // rendered pixel: a system post's label goes from #77736C to #1A1A18 in light theme.
  const frame = sys ? "var(--c-system)" : "var(--c-" + c + ")";
  const cColor = sys ? "var(--c-system-ink)" : "var(--c-" + c + "-text)";
  const rows = (fields || []).filter((f) => f && f.value);
  const clamp = !!onReadMore && !expanded;
  // Hover intent (ruling 84): the host's prefetch fires after an 80ms mouseenter hold, never on touch.
  const hold = useRef<number | null>(null);
  const clearHold = () => {
    if (hold.current != null) window.clearTimeout(hold.current);
    hold.current = null;
  };
  const linkStyle: CSSProperties = {
    all: "unset",
    cursor: "pointer",
    alignSelf: "flex-start",
    minHeight: 44,
    display: "inline-flex",
    alignItems: "center",
    fontSize: 15,
    fontWeight: 500,
    color: "var(--ink)",
    textDecoration: "underline",
    textDecorationColor: "var(--line-strong)",
    textUnderlineOffset: 2,
    margin: "-10px 0",
  };
  const ReadMoreTag = readMoreHref ? "a" : "button";
  return (
    <article
      aria-label={preview ? "Preview of your post" : undefined}
      data-c={c}
      data-expanded={onReadMore ? (expanded ? "1" : "0") : undefined}
      data-selected={selected ? "" : undefined}
      aria-current={selected ? "true" : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        border: "1.5px solid " + frame,
        boxShadow: selected ? SELECTED_RING : undefined,
        transition: "box-shadow var(--dur-default) var(--ease)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {author && authorHref ? (
          // 62-A (1820): the photo is the same link as the name, hidden from the reading order so
          // the header carries one "{author}’s profile" and not two.
          <a
            href={authorHref}
            aria-hidden="true"
            tabIndex={-1}
            onClick={authorClick}
            data-author-avatar=""
            style={{ display: "inline-flex", flex: "none" }}
          >
            <Avatar
              name={author}
              src={avatarSrc}
              size={40}
              style={authorKind === "space" ? { borderRadius: 6 } : undefined}
            />
          </a>
        ) : (
          author && (
            <Avatar
              name={author}
              src={avatarSrc}
              size={40}
              style={authorKind === "space" ? { borderRadius: 6 } : undefined}
            />
          )
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {author && (
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {authorHref ? (
                <a
                  href={authorHref}
                  aria-label={authorLabel}
                  onClick={authorClick}
                  data-author-link=""
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {author}
                </a>
              ) : (
                author
              )}
              {authorKind === "space" && (
                <span style={{ fontWeight: 400, color: "var(--ink-3)" }}> · Space</span>
              )}
            </div>
          )}
          {authorHandle && authorKind === "member" && (
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-3)",
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              @{authorHandle}
            </div>
          )}
          {(meta || anchor || audience) && (
            <div
              style={{
                fontSize: 13,
                color: feed ? cColor : "var(--ink-3)",
                lineHeight: 1.4,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {meta && <span>{meta}</span>}
              {anchor && (
                <span>
                  {meta ? "· " : ""}In {anchor}
                </span>
              )}
              {audience && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {meta || anchor ? "· " : ""}
                  <Icon
                    name={
                      audience === "Everyone on DNA"
                        ? "globe"
                        : audience === "My connections"
                          ? "users"
                          : "hash"
                    }
                    size={12}
                  />
                  {audience}
                </span>
              )}
            </div>
          )}
        </div>
        {!sys && <CBadge c={c} size={32} />}
        {onMenu && (
          <IconButton
            name="ellipsis"
            label="More"
            size={36}
            onClick={onMenu}
            style={{ marginRight: -8 }}
          />
        )}
      </header>
      <div
        onClick={clamp ? onClick : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          cursor: clamp && onClick ? "pointer" : "default",
        }}
      >
        {kicker && (
          <div
            data-kicker
            style={{
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: cColor,
            }}
          >
            {kicker}
          </div>
        )}
        {title && (
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: 22,
              lineHeight: 1.25,
              textWrap: "pretty",
            }}
          >
            {title}
          </h3>
        )}
        {children && (
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              ...(clamp
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            {children}
          </div>
        )}
        {clamp && onReadMore && (
          <ReadMoreTag
            {...(readMoreHref ? { href: readMoreHref } : { type: "button" as const })}
            aria-expanded={false}
            onClick={(e: MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              onReadMore(e);
            }}
            onMouseEnter={
              onReadMoreIntent
                ? () => {
                    clearHold();
                    hold.current = window.setTimeout(onReadMoreIntent, 80);
                  }
                : undefined
            }
            onMouseLeave={onReadMoreIntent ? clearHold : undefined}
            data-read-more
            style={linkStyle}
          >
            Read more
          </ReadMoreTag>
        )}
        {onReadMore && expanded && onCollapse && (
          <button
            type="button"
            aria-expanded={true}
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            data-show-less
            style={linkStyle}
          >
            Show less
          </button>
        )}
        {rows.length > 0 && (
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "6px 12px",
              fontSize: 15,
              lineHeight: 1.45,
              padding: "10px 12px",
              background: "var(--bg-sunken)",
              borderRadius: 10,
            }}
          >
            {rows.map((f) => (
              <Fragment key={f.label}>
                <dt
                  style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {f.icon && <Icon name={f.icon} size={16} />}
                  {f.label}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {f.value}
                  {preview && f.mine && (
                    <Icon
                      name="pen-line"
                      size={14}
                      title="Written by you"
                      style={{ color: "var(--ink-3)" }}
                    />
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
        )}
      </div>
      {media && typeof media === "object" && media.kind && media.kind !== "none" && (
        <MediaBlock {...media} />
      )}
      {link && link.url && (
        <MediaBlock
          kind="link"
          src={link.url}
          domain={link.domain}
          title={link.title}
          items={link.image ? [link.image] : []}
          size={
            media && typeof media === "object" && IMAGE_KINDS.indexOf(media.kind || "none") >= 0
              ? "row"
              : "full"
          }
        />
      )}
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      {feed ? (
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: -10,
            marginRight: -10,
            marginBottom: -8,
            paddingTop: 8,
            borderTop: "1px solid var(--line)",
            pointerEvents: preview ? "none" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          <IconButton
            name="heart"
            label={reacted ? "Reacted" : "React"}
            active={reacted}
            aria-pressed={!!reacted}
            onClick={reactClick}
            data-testid="react"
            style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
            {...reactPress}
          />
          <IconButton
            name="message-circle"
            label={respondLabel}
            onClick={onRespond}
            data-testid="respond"
          />
          <span
            data-footer-summary=""
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
          >
            {summary}
          </span>
          <IconButton
            name="bookmark"
            label={saved ? "Saved" : "Save"}
            active={saved}
            aria-pressed={!!saved}
            onClick={onSave}
            data-testid="save"
          />
          <IconButton name="share" label="Share" onClick={onShare} data-testid="share" />
        </footer>
      ) : (
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: -4,
            marginLeft: -10,
            marginRight: -10,
            pointerEvents: preview ? "none" : "auto",
          }}
        >
          <button
            type="button"
            onClick={onRespond}
            style={{
              all: "unset",
              cursor: "pointer",
              minHeight: 44,
              padding: "0 10px",
              fontSize: 15,
              fontWeight: 500,
              color: "var(--ink-2)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {respondLabel}
          </button>
          <span style={{ flex: 1 }} />
          <IconButton
            name="bookmark"
            label={saved ? "Saved" : "Save"}
            active={saved}
            onClick={onSave}
          />
          <IconButton name="share" label="Share" onClick={onShare} />
        </footer>
      )}
      {below ? (
        <div
          data-below=""
          style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
        >
          {below}
        </div>
      ) : null}
    </article>
  );
}

/** The discovery face (correction 25 §1: 1076 to 1079, 1087, 1096, 1097; Revision 6 ratified;
 *  correction 28: G100, G113, G115; correction 29's ask 1, 1130; ratified 1134).
 *  Fixed size: every region holds its height whatever the record carries, so a lane of cards is one
 *  height and nothing jumps as data arrives. In order and nothing else: media at 16:9, the flyer
 *  fitted by object-fit cover, the C glyph on --bg-sunken when there is none (never a collapsed
 *  frame); the one control, an ellipsis IconButton on the media's top right on a --surface ground
 *  with a 1px --line edge, 44 touch, 36 pointer, opening Menu with the caller's items (items absent
 *  when they do not apply, never disabled) and, with `onReport`, a rule and Report last in the
 *  danger tone with the `flag` icon (absent, neither); title in the display face, clamped to two
 *  lines on a span inside the link or button and holding two lines' height (1087, G115); when, one
 *  line; where, one line; presenter (24 Avatar and name, onPresenter opens the profile) and topic (a
 *  Chip in the C, onTopic narrows) on one row, 36 on pointer and --target-primary on touch (498);
 *  last, one row of 28 behind a 1px --line rule, one line cut with an ellipsis: DIA's words (1096),
 *  else the caller's `going` sentence, empty and aria-hidden when there is neither. The part never
 *  composes names or counts; no price, badge, count or number. The face sits at gap 8 (G113). The
 *  whole face opens the event (onOpen); a press on a control does not. With `href` (G100, 1067) the
 *  face is a real link: the title is an anchor and a cover inside it spans the face, the presenter
 *  and topic stand above the cover with the ellipsis, a plain primary click calls onOpen and
 *  prevents the default, and a modified or middle click is the browser's. onPreload fires once on
 *  pointer enter and on focus. Pointer hover underlines the title in --line-strong, drawn with
 *  longhands only so a re-render never mixes them with the shorthand (25 §7); the frame stays the C
 *  colour (rule 2). `input` overrides the detected input mode for proofs. The face never shrinks in
 *  a flex lane (flex: none, 25 §7). */
const DISC_TITLE_H = "calc(2 * var(--display-s) * var(--display-s-lh))";
const DISC_REASON_H = 28;
const DISC_LINE: CSSProperties = {
  fontSize: "var(--text-s)",
  lineHeight: "var(--text-s-lh)",
  color: "var(--ink-2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minHeight: "calc(var(--text-s) * var(--text-s-lh))",
};

function DiscoveryFace({
  c = "convene",
  title,
  when,
  where,
  presenter,
  presenterSrc,
  topic,
  reason,
  going,
  media,
  href,
  onOpen,
  onPreload,
  onPresenter,
  onTopic,
  onReport,
  reportLabel = "Report",
  menu = [],
  menuLabel = "More",
  menuPortal = true,
  selected,
  input,
  style,
}: PostCardProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const [hot, setHot] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const preloaded = useRef(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const preload = () => {
    if (preloaded.current) return;
    preloaded.current = true;
    if (onPreload) onPreload();
  };
  // G42, as on the feed face: the system frame reads its own token, which holds --line-strong.
  const frame = c === "system" ? "var(--c-system)" : "var(--c-" + c + ")";
  const img = media ? (typeof media === "string" ? media : media.src) : undefined;
  const alt = media && typeof media === "object" ? media.alt || "" : "";
  // Item 12 (1697) and item 21 (1714): the face's own fixed 16:9 box, the image placed through
  // MediaBlock's imageFrame and placement by its focal point and crop; a flyer past one ratio step
  // of 16:9 shows whole on --media-fill. A string, or an object with no framing, is centred as before.
  const mo: MediaBlockProps = media && typeof media === "object" ? media : {};
  const pf = imageFrame(mo.width, mo.height, mo.crop, "16/9");
  const place = placement(pf, mo.focalPoint, mo.crop);
  // Correction 29's ask 1: Report closes the caller's items behind a rule; absent, neither.
  const items: MenuProps["items"] = onReport
    ? [
        ...(menu || []),
        { rule: true },
        { id: "report", label: reportLabel, icon: "flag", tone: "danger", onSelect: onReport },
      ]
    : menu;
  const hasMenu = (items || []).some((it) => it && !("rule" in it && it.rule));
  // `reason` wins; `going` fills the row only without one; an empty value holds the row.
  const last = reason || going || "";
  const ctl = touch ? 44 : 36;
  const open = (e: MouseEvent<HTMLElement>) => {
    const t = e.target as Element | null;
    if (t && t.closest && t.closest("[data-card-control]")) return;
    if (onOpen) onOpen();
  };
  // With `href`: a plain primary click is the caller's in-app navigation; a modified, middle or
  // already-prevented click is the browser's (new tab, copy, middle-click).
  const onLink = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      !onOpen ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    e.preventDefault();
    onOpen();
  };
  const rowH = touch ? "var(--target-primary)" : 36;
  // The presenter and the topic stand above the link's cover; without `href` there is no cover.
  const above: CSSProperties | null = href ? { position: "relative", zIndex: 1 } : null;
  const clamp: CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textWrap: "pretty",
    overflowWrap: "anywhere",
    textDecorationLine: hot ? "underline" : "none",
    textDecorationColor: "var(--line-strong)",
    textDecorationThickness: 1,
    textUnderlineOffset: 3,
  };
  // The compile appends ": " + title; a title here may be a node, so only a string is appended.
  const named = typeof title === "string" && title ? menuLabel + ": " + title : menuLabel;
  return (
    <article
      data-presentation="discovery"
      data-input={mode}
      data-href={href ? "" : undefined}
      data-selected={selected ? "" : undefined}
      aria-current={selected ? "true" : undefined}
      onClick={href ? undefined : open}
      onMouseEnter={() => {
        if (touch) return;
        setHot(true);
        preload();
      }}
      onMouseLeave={() => setHot(false)}
      onFocus={preload}
      style={{
        position: "relative",
        background: "var(--surface)",
        borderRadius: "var(--radius-l)",
        border: "var(--border-card) solid " + frame,
        boxShadow: selected ? SELECTED_RING : undefined,
        transition: "box-shadow var(--dur-default) var(--ease)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        boxSizing: "border-box",
        width: "var(--lane-card-width)",
        flex: "none",
        cursor: onOpen || href ? "pointer" : "default",
        ...style,
      }}
    >
      <div
        data-media={img ? "image" : "none"}
        data-frame={img ? pf.clamp : undefined}
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          borderRadius: "var(--radius-m)",
          overflow: "hidden",
          background: "var(--media-fill)",
          border: "var(--border-thin) solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {img ? (
          <img
            src={img}
            alt={alt}
            data-focal={mo.focalPoint || mo.crop ? "" : undefined}
            style={{ ...place, position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        ) : (
          <CBadge c={c === "system" ? "brand" : c} size={48} />
        )}
      </div>
      {hasMenu && (
        <span
          ref={anchor}
          data-card-control=""
          style={{
            position: "absolute",
            top: "calc(var(--space-4) + var(--space-2))",
            right: "calc(var(--space-4) + var(--space-2))",
            display: "inline-flex",
            zIndex: 1,
          }}
        >
          <IconButton
            name="ellipsis"
            label={href ? named : menuLabel}
            size={ctl}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            style={{ background: "var(--surface)", border: "var(--border-thin) solid var(--line)" }}
          />
          <Menu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={anchor}
            items={items}
            label={named}
            input={mode}
            portal={menuPortal}
          />
        </span>
      )}
      <h3
        style={{
          margin: 0,
          minHeight: DISC_TITLE_H,
          fontFamily: "var(--font-display)",
          fontWeight: "var(--weight-regular)" as unknown as number,
          fontSize: "var(--display-s)",
          lineHeight: "var(--display-s-lh)",
        }}
      >
        {href ? (
          <a
            href={href}
            data-card-open=""
            onClick={onLink}
            style={{ display: "block", color: "inherit", textDecoration: "none" }}
          >
            <span data-title-clamp="" style={clamp}>
              {title}
            </span>
            <span
              aria-hidden="true"
              data-card-cover=""
              style={{ position: "absolute", inset: 0, borderRadius: "inherit" }}
            />
          </a>
        ) : (
          <button
            type="button"
            data-card-open=""
            onClick={(e) => {
              e.stopPropagation();
              if (onOpen) onOpen();
            }}
            style={{ all: "unset", cursor: "pointer", display: "block" }}
          >
            <span data-title-clamp="" style={clamp}>
              {title}
            </span>
          </button>
        )}
      </h3>
      <div data-row="when" style={DISC_LINE}>
        {when}
      </div>
      <div data-row="where" style={DISC_LINE}>
        {where}
      </div>
      <div
        data-row="presenter"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          minHeight: rowH,
          minWidth: 0,
        }}
      >
        {presenter && (
          <button
            type="button"
            data-card-control=""
            onClick={(e) => {
              e.stopPropagation();
              if (onPresenter) onPresenter();
            }}
            style={{
              all: "unset",
              ...above,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              minHeight: rowH,
              minWidth: 0,
              flex: "0 1 auto",
              fontSize: "var(--text-s)",
              fontWeight: "var(--weight-medium)" as unknown as number,
              color: "var(--ink)",
            }}
          >
            <Avatar name={presenter} src={presenterSrc} size={24} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {presenter}
            </span>
          </button>
        )}
        {topic && (
          <span
            data-card-control=""
            style={{
              ...above,
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              minHeight: rowH,
            }}
          >
            <Chip
              c={c === "system" ? undefined : c}
              onClick={() => {
                if (onTopic) onTopic();
              }}
            >
              {topic}
            </Chip>
          </span>
        )}
      </div>
      <div
        data-row="reason"
        data-going={!reason && going ? "" : undefined}
        aria-hidden={last ? undefined : "true"}
        style={{
          boxSizing: "border-box",
          height: DISC_REASON_H,
          flex: "none",
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          borderTop: "var(--border-thin) solid var(--line)",
          fontSize: "var(--text-xs)",
          lineHeight: "var(--text-xs-lh)",
          color: "var(--ink-3)",
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {last}
        </span>
      </div>
    </article>
  );
}
