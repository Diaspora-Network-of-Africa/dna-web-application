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
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  time?: string | undefined;
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
  time,
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
        <Avatar name={name} src={avatarSrc} size={size} />
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
            <span
              style={{
                fontSize: "var(--text-s)",
                lineHeight: "var(--text-s-lh)",
                fontWeight: "var(--weight-bold)" as unknown as number,
              }}
            >
              {name}
            </span>
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
          {!reply && onReply && !sending && !failed ? (
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
