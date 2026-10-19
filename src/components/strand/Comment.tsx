// Ported from Strand components/dna/Comment.jsx at compile sha256-b1a458dac1bd562f (brief 60-SP
// item 2; FC 5.2 item 3, 2.2; 1652, 1677; ratified 1728; handoff H61-SP). New to the tree, and
// bound by nothing yet: the Feed card's comments are their own handoff and this part waits for it.
// One comment on a post, in PostCard's `below`. The row: a 32 Avatar (24 on a reply), the name at
// --weight-bold in --text-s, the meta line in --text-xs --ink-3 (the time, then " · Edited" (F14);
// while sending, "Sending" (F16) stands where the time goes), the text in --text-s with links and
// tags as the caller renders them (TagText), and the acts: Reply (F13) on a top-level comment only
// (one level, 1677), and More (F22), an ellipsis IconButton (44 touch, 36 pointer) opening Menu
// with the caller's items. Failed: "Did not send." in --error with Try again (F17), role="alert".
// deleted: the tombstone, "This comment was deleted." (F15) with no avatar, name or acts; its
// replies stay under it. replies: one level, indented to the text's edge, each a Comment with
// `reply` set. presentation="latest": the collapsed card's one line (F10), one button that opens
// the expanded card. No count of anything. Translations, none visible: `useInputMode` is the app's
// `useMode`; typed props. Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
//
// Handoff 62-G (SPEC-62-FEED-CARD 8, 12 proposal 8; rulings 1809, 1817, 1820, 1822; G306), as
// divergences kept until a compile carries them: `nameHref` and `onName` make the avatar and the name
// one link named "{name}’s profile" (V.profile) that opens the profile and stops at the link; `time`
// takes a node, so the head carries the 10.1 `time` element; `mark` renders before the time (the
// Author mark, C.author); `media` renders after the text (the one image, through MediaBlock); and
// `actions` renders the caller's action row (React, Reply, the comment's summary) where the part's own
// Reply act stood, which is then not drawn. A call that passes none of them renders as the port did.
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";
import { Menu, type MenuProps } from "./Menu";
import { useMode, type Mode } from "@/lib/tier";

const XS: CSSProperties = { fontSize: "var(--text-xs)", lineHeight: "var(--text-xs-lh)" };

function Act({
  label,
  onClick,
  touch,
  tone,
}: {
  label: string;
  onClick: (() => void) | undefined;
  touch: boolean;
  tone?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        minHeight: touch ? 44 : "var(--target-min)",
        display: "inline-flex",
        alignItems: "center",
        padding: "0 var(--space-1)",
        margin: "0 calc(-1 * var(--space-1))",
        ...XS,
        fontWeight: "var(--weight-medium)" as unknown as number,
        color: tone || "var(--ink-2)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {label}
    </button>
  );
}

export type CommentProps = {
  name: string;
  avatarSrc?: string | undefined;
  /** 62-G (1820): the avatar and the name as one link to the profile; `onName` takes a plain click. */
  nameHref?: string | undefined;
  onName?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  /** 62-G (10.1): a node, the `time` element whose title is the absolute form. */
  time?: ReactNode;
  /** 62-G (1817): the Author mark, before the time. */
  mark?: ReactNode;
  /** 62-G (SPEC 8.4): the one image, after the text. */
  media?: ReactNode;
  /** 62-G (SPEC 8.2): the action row under the comment; with it the part draws no Reply of its own. */
  actions?: ReactNode;
  /** F14. */
  edited?: boolean | undefined;
  /** F16: "Sending" stands where the time goes, the text at 0.7 opacity, no acts. */
  sending?: boolean | undefined;
  /** F17: "Did not send." with Try again. */
  failed?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  /** The caller renders it, through TagText for a parsed body. */
  text?: ReactNode;
  /** Top level only (1677). */
  onReply?: (() => void) | undefined;
  replyLabel?: string | undefined;
  /** F22: the caller's items (Edit, Delete; Delete, a rule, Report; Report). */
  menu?: MenuProps["items"] | undefined;
  menuLabel?: string | undefined;
  menuPortal?: boolean | undefined;
  /** F15: the tombstone; replies kept. */
  deleted?: boolean | undefined;
  deletedText?: string | undefined;
  /** One level of replies, each a Comment with `reply`. */
  replies?: ReactNode;
  reply?: boolean | undefined;
  /** `latest`: the collapsed card's one line (F10), a button that calls onOpen. */
  presentation?: "thread" | "latest" | undefined;
  onOpen?: (() => void) | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

export function Comment({
  name,
  avatarSrc,
  nameHref,
  onName,
  time,
  mark,
  media,
  actions,
  edited,
  sending,
  failed,
  onRetry,
  text,
  onReply,
  replyLabel = "Reply",
  menu,
  menuLabel = "More",
  menuPortal = true,
  deleted,
  deletedText = "This comment was deleted.",
  replies,
  reply,
  presentation,
  onOpen,
  input,
  style,
}: CommentProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  if (presentation === "latest")
    return (
      <button
        type="button"
        data-comment="latest"
        onClick={onOpen}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          display: "block",
          width: "100%",
          minHeight: touch ? 44 : "var(--target-min)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-s)",
          lineHeight: touch ? "44px" : "var(--target-min)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        <span style={{ fontWeight: "var(--weight-bold)" as unknown as number }}>{name}</span>{" "}
        <span>{text}</span>
      </button>
    );
  const size = reply ? 24 : 32;
  const kids = replies ? (
    <div
      data-replies=""
      style={{
        paddingLeft: "calc(32px + var(--space-2))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {replies}
    </div>
  ) : null;
  if (deleted)
    return (
      <div
        data-comment="deleted"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          fontFamily: "var(--font-sans)",
          ...style,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-s)",
            lineHeight: "var(--text-s-lh)",
            color: "var(--ink-3)",
          }}
        >
          {deletedText}
        </p>
        {kids}
      </div>
    );
  const hasMenu = (menu || []).some((it) => !!it && !("rule" in it && it.rule));
  const nameClick = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!onName) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onName(e);
  };
  const avatar = <Avatar name={name} src={avatarSrc} size={size} />;
  const nameSpan = (
    <span
      style={{
        fontSize: "var(--text-s)",
        lineHeight: "var(--text-s-lh)",
        fontWeight: "var(--weight-bold)" as unknown as number,
      }}
    >
      {name}
    </span>
  );
  return (
    <div
      data-comment={reply ? "reply" : "top"}
      data-sending={sending ? "" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", minWidth: 0 }}
      >
        {nameHref ? (
          // 62-G (1820): the photo is the same link as the name, hidden from the reading order so the
          // head carries one "{name}’s profile" and not two.
          <a
            href={nameHref}
            aria-hidden="true"
            tabIndex={-1}
            onClick={nameClick}
            data-comment-avatar=""
            style={{ display: "inline-flex", flex: "none" }}
          >
            {avatar}
          </a>
        ) : (
          avatar
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-2)",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {nameHref ? (
              <a
                href={nameHref}
                aria-label={name + "’s profile"}
                onClick={nameClick}
                data-comment-name=""
                style={{ color: "inherit", textDecoration: "none", minWidth: 0 }}
              >
                {nameSpan}
              </a>
            ) : (
              nameSpan
            )}
            {mark && !sending ? mark : null}
            <span style={{ ...XS, color: "var(--ink-3)" }}>
              {sending ? "Sending" : time}
              {edited && !sending ? " · Edited" : ""}
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--text-s)",
              lineHeight: "var(--text-s-lh)",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {text}
          </div>
          {media ? <div data-comment-media="">{media}</div> : null}
          {failed ? (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                ...XS,
                color: "var(--error)",
              }}
            >
              <span>Did not send.</span>
              <Act label="Try again" onClick={onRetry} touch={touch} tone="var(--ink)" />
            </div>
          ) : null}
          {actions && !sending && !failed ? (
            actions
          ) : !reply && onReply && !sending && !failed ? (
            <div style={{ display: "flex" }}>
              <Act label={replyLabel} onClick={onReply} touch={touch} />
            </div>
          ) : null}
        </div>
        {hasMenu && !sending ? (
          <span
            ref={anchor}
            style={{
              position: "relative",
              display: "inline-flex",
              flex: "none",
              marginTop: touch ? -10 : -6,
              marginRight: touch ? -10 : -6,
            }}
          >
            <IconButton
              name="ellipsis"
              label={menuLabel}
              input={mode}
              size={touch ? 44 : 36}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            />
            <Menu
              open={open}
              onClose={() => setOpen(false)}
              anchorRef={anchor}
              items={menu || []}
              label={menuLabel}
              input={mode}
              portal={menuPortal}
              placement="bottom-end"
            />
          </span>
        ) : null}
      </div>
      {kids}
    </div>
  );
}
