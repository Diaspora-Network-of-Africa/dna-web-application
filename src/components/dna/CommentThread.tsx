// Handoff 62-G, SPEC-62-FEED-CARD 8 (rulings 1677, 1796, 1797, 1809, 1817, 1820, 1822, 1849): the
// Feed card's conversation. Strand `Comment` for each comment and reply, oldest first with no sort
// control (1796), paged with See more comments (C.more, never a number) through post_comments; the
// commenter's photo and name open the profile (1820); the post author's own comment carries the Author
// mark (C.author, 1817); the time is 10.1's `time` element, absolute on the expanded card; the one
// image renders through MediaBlock (1714). Under each comment the action row (8.2): React / Reacted,
// Reply on top-level comments only, and the comment's summary (SPEC 5 at small) opening the reader's
// sheet for that comment, the commenter's own for a comment they wrote; a hold on touch or a hover on
// pointer opens the same bar the post uses, under the comment at the same left padding. The box (8.4)
// at the foot; a sent comment appears at the thread's end with Sending (F16) and Did not send (F17)
// as Strand Comment's own states. The collapsed card's one line (8.3) is `LatestCommentLine`. Nothing
// here counts (1797). Composed from Strand's Comment, Button and MediaBlock until Strand lands
// proposal 8's props (the G entry).
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { Comment } from "@/components/strand/Comment";
import { MediaBlock } from "@/components/strand/MediaBlock";
import type { CardC } from "@/components/strand/cmeta";
import type { Member } from "@/lib/auth";
import { useShellScroll } from "@/lib/shell-scroll";
import {
  CommentError,
  loadComments,
  postComment,
  type CommentPage,
  type CommentView,
  type ReactionTarget,
} from "@/lib/comments";
import { firstName } from "@/lib/names";
import type { PostView } from "@/lib/post-view";
import type { ReactionSummary } from "@/lib/reactions";
import type { Mode, Tier } from "@/lib/tier";
import { CommentBox, type CommentDraftImage } from "./CommentBox";
import { PersonLink } from "./PersonLink";
import { COMMENT_REACTIONS, useReactionLayer, type ReactionLayerProps } from "./ReactionLayer";
import { TimeStamp } from "./TimeStamp";

export const commentsKey = (memberId: string, postId: string) =>
  ["comments", memberId, postId] as const;

/** The role words a withheld commenter reads as (141, 1820); names.ts supplies no comment role yet. */
export const COMMENTER_ROLE = "A member";

const HOLD_MS = 500;

/** The Author mark (C.author, 1817): a quiet caps word in the post's C text colour, before the time. */
function AuthorMark({ c }: { c: CardC }) {
  return (
    <span
      data-comment-author-mark=""
      style={{
        fontSize: 11,
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-caps)",
        fontWeight: 500,
        color: c === "system" ? "var(--c-system-ink)" : "var(--c-" + c + "-text)",
        marginRight: 6,
      }}
    >
      Author
    </span>
  );
}

/**
 * SPEC 8.2: React / Reacted, Reply (top level only) and the comment's summary. React places Asante
 * or removes the held reaction on a tap; a 500 ms hold on touch, or a pointer hover, opens the bar
 * (the layer's `onReactOpen`), and the tap that ends a hold does nothing (1632, 1633).
 */
function ActionRow({
  layer,
  reply,
  onReply,
  mode,
}: {
  layer: ReactionLayerProps;
  reply: boolean;
  onReply: (() => void) | undefined;
  mode: Mode;
}) {
  const touch = mode === "touch";
  const hold = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => clear, []);
  const act = (label: string, onClick: () => void, extra: Record<string, unknown> = {}) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        minHeight: touch ? 44 : 24,
        display: "inline-flex",
        alignItems: "center",
        padding: "0 var(--space-1)",
        margin: "0 calc(-1 * var(--space-1))",
        fontSize: 13,
        lineHeight: 1.4,
        fontWeight: 500,
        color: "var(--ink-2)",
        fontFamily: "var(--font-sans)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      {...extra}
    >
      {label}
    </button>
  );
  return (
    <div
      data-comment-actions=""
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        minHeight: touch ? 44 : 24,
        marginTop: -6,
        minWidth: 0,
      }}
    >
      {act(
        layer.reacted ? "Reacted" : "React",
        () => {
          if (held.current) {
            held.current = false;
            return;
          }
          layer.onReact();
        },
        {
          "aria-pressed": layer.reacted,
          "data-comment-react": "",
          style: {
            all: "unset",
            cursor: "pointer",
            minHeight: touch ? 44 : 24,
            display: "inline-flex",
            alignItems: "center",
            padding: "0 var(--space-1)",
            margin: "0 calc(-1 * var(--space-1))",
            fontSize: 13,
            lineHeight: 1.4,
            fontWeight: 500,
            color: layer.reacted ? "var(--ink)" : "var(--ink-2)",
            textDecoration: layer.reacted ? "underline" : "none",
            textDecorationColor: "var(--line-strong)",
            textUnderlineOffset: 2,
            fontFamily: "var(--font-sans)",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          },
          onPointerDown: (e: { pointerType: string }) => {
            if (e.pointerType === "mouse") return;
            held.current = false;
            clear();
            hold.current = window.setTimeout(() => {
              held.current = true;
              layer.onReactOpen();
            }, HOLD_MS);
          },
          onPointerUp: clear,
          onPointerCancel: () => {
            clear();
            held.current = false;
          },
          onPointerLeave: clear,
          onPointerEnter: (e: { pointerType: string }) => {
            if (e.pointerType === "mouse") layer.onReactOpen();
          },
          onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
        },
      )}
      {!reply && onReply ? act("Reply", onReply, { "data-comment-reply": "" }) : null}
      {layer.summary}
    </div>
  );
}

type Pending = {
  clientId: string;
  parentId: string | null;
  body: string;
  image: CommentDraftImage | null;
  status: "sending" | "failed";
};

/** Every comment and reply a page holds, flattened, deleted ones left out. */
function flat(pages: readonly CommentPage[]): CommentView[] {
  const out: CommentView[] = [];
  for (const page of pages)
    for (const c of page.comments) {
      if (!c.deleted) out.push(c);
      out.push(...c.replies.filter((r) => !r.deleted));
    }
  return out;
}

export type CommentThreadProps = {
  post: PostView;
  member: Member;
  tier: Tier;
  mode: Mode;
  /** A notification's destination (10.2): the comment to scroll to once the thread holds it. */
  focusCommentId?: string | null | undefined;
  onNavigate?: (() => void) | undefined;
  /** H62-G1 (1905): the comment control's press count; each new one lands on the box once loaded. */
  land?: number | undefined;
  /** H62-G1 (1905): closes the section and returns to the Feed at the card (the card's Show less). */
  onClose?: (() => void) | undefined;
};

export function CommentThread({
  post,
  member,
  tier,
  mode,
  focusCommentId,
  land,
  onClose,
}: CommentThreadProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const postId = post.id ?? "";
  const key = commentsKey(member.id, postId);
  const thread = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => loadComments(postId, pageParam),
    initialPageParam: null as { createdAt: string; id: string } | null,
    getNextPageParam: (last) => (last.more ? last.next : null),
    enabled: !!postId,
  });
  const pages = useMemo(() => thread.data?.pages ?? [], [thread.data]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollerRef } = useShellScroll();
  // H62-G1 (1905): the box (with the section's close) is brought into the visible area by the least
  // scroll of the shell's own scroller, never by scrollIntoView, which also scrolls the window on
  // iPhone (104, 1457). The visible foot is the fixed dock's top below expanded, as the shell
  // measures it. At compact the box is sticky above the dock (8.4), so it shows once the thread's
  // top is a box's height above that foot, and the landing goes no further into the thread. A box
  // already in view does not move the page at all.
  const revealFoot = () => {
    const sc = scrollerRef.current;
    const root = rootRef.current;
    const foot = root?.querySelector<HTMLElement>("[data-comment-box]");
    if (!sc || !root || !foot) return;
    const box = sc.getBoundingClientRect();
    let bottom = box.bottom;
    const dock = document.querySelector<HTMLElement>('[data-pulse="dock"]');
    if (dock && getComputedStyle(dock).position === "fixed")
      bottom = Math.min(bottom, dock.getBoundingClientRect().top);
    const r = foot.getBoundingClientRect();
    const end =
      getComputedStyle(foot).position === "sticky"
        ? Math.min(r.bottom, root.getBoundingClientRect().top + r.height)
        : r.bottom;
    const by = end + 12 - bottom;
    if (by <= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sc.scrollTo({ top: sc.scrollTop + by, behavior: reduce ? "auto" : "smooth" });
  };
  const landed = useRef<number | undefined>(undefined);
  const top = useMemo(() => pages.flatMap((p) => p.comments), [pages]);
  const all = useMemo(() => flat(pages), [pages]);
  const ids = useMemo(() => all.map((c) => c.id), [all]);
  const initial = useMemo(() => {
    const m = new Map<string, ReactionSummary>();
    for (const c of all) if (c.reactions) m.set(c.id, c.reactions);
    return m;
  }, [all]);
  const targetOf = (c: CommentView): ReactionTarget => ({
    id: c.id,
    c: post.c_category,
    author: {
      id: c.author?.id ?? (c.you ? member.id : undefined),
      name: c.author?.name ?? (c.you ? member.name : COMMENTER_ROLE),
      handle: c.author?.handle ?? "",
      avatar: c.author?.avatar,
    },
  });
  const layer = useReactionLayer({
    kind: "comment",
    api: COMMENT_REACTIONS,
    member,
    ids,
    targets: all.map(targetOf),
    tier,
    mode,
    initial,
    size: "small",
  });

  const [pending, setPending] = useState<Pending[]>([]);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const send = useMutation({
    mutationFn: (p: Pending) =>
      postComment(postId, p.body || null, { parentId: p.parentId, mediaId: p.image?.mediaId }),
    onSuccess: (comment, p) => {
      // The sent comment appears at the thread's end (8.4), or under its parent, from the server's
      // own answer; the pending row goes.
      qc.setQueryData<typeof thread.data>(key, (data) => {
        if (!data) return data;
        const list = data.pages.map((pg) => ({ ...pg, comments: [...pg.comments] }));
        if (comment.parentId) {
          for (const pg of list)
            pg.comments = pg.comments.map((c) =>
              c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c,
            );
        } else {
          const last = list[list.length - 1];
          if (last) last.comments.push(comment);
          else list.push({ comments: [comment], more: false, next: null });
        }
        return { ...data, pages: list };
      });
      setPending((rows) => rows.filter((r) => r.clientId !== p.clientId));
      void qc.invalidateQueries({ queryKey: ["comments", "latest", member.id] });
    },
    onError: (_e: unknown, p) => {
      setPending((rows) =>
        rows.map((r) => (r.clientId === p.clientId ? { ...r, status: "failed" } : r)),
      );
    },
  });
  const start = (body: string, image: CommentDraftImage | null) => {
    const p: Pending = {
      clientId: Math.random().toString(36).slice(2),
      parentId: replyTo?.id ?? null,
      body,
      image,
      status: "sending",
    };
    setPending((rows) => [...rows, p]);
    setReplyTo(null);
    send.mutate(p);
  };
  const retry = (p: Pending) => {
    setPending((rows) =>
      rows.map((r) => (r.clientId === p.clientId ? { ...r, status: "sending" } : r)),
    );
    send.mutate(p);
  };
  const failedReason = (): string | null => {
    const e = send.error;
    if (!(e instanceof CommentError)) return null;
    switch (e.reason) {
      case "body_too_long":
        return "The comment is too long.";
      case "comment_deleted":
      case "reply_to_reply":
      case "no_such_comment":
        return "That comment is no longer here.";
      case "bad_media":
      case "media_in_use":
        return "The image did not attach.";
      default:
        return null;
    }
  };

  // H62-G1: a new press of the comment control lands once the page has loaded, so the box does not
  // move off again as the comments arrive.
  useEffect(() => {
    if (land === undefined || landed.current === land || thread.isPending) return;
    landed.current = land;
    const frame = window.requestAnimationFrame(revealFoot);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land, thread.isPending]);

  // 10.2: a notification's destination, the comment, scrolled into view once the thread holds it;
  // the next page is read while it is not here and more exist.
  const focused = useRef(false);
  useEffect(() => {
    if (!focusCommentId || focused.current) return;
    const el = document.querySelector<HTMLElement>(
      `[data-comment-id="${CSS.escape(focusCommentId)}"]`,
    );
    if (el) {
      focused.current = true;
      el.scrollIntoView({ block: "center" });
      return;
    }
    if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
  }, [focusCommentId, all, thread]);

  const nameHref = (c: CommentView) => (c.author?.handle ? "/m/" + c.author.handle : undefined);
  const renderComment = (c: CommentView, reply: boolean): ReactNode => {
    const props = c.deleted ? null : layer.propsFor(targetOf(c));
    const name = c.author?.name ?? (c.you ? member.name : COMMENTER_ROLE);
    return (
      <div
        key={c.id}
        data-comment-id={c.id}
        data-comment-withheld={!c.deleted && !c.author && !c.you ? "" : undefined}
      >
        <Comment
          name={name}
          avatarSrc={c.author?.avatar ?? (c.you ? member.avatar : undefined)}
          nameHref={nameHref(c)}
          onName={() => {
            // 1820: the head opens the profile in the app, a modified click is the browser's.
            if (c.author?.handle)
              void navigate({ to: "/m/$handle", params: { handle: c.author.handle }, search: {} });
          }}
          deleted={c.deleted}
          reply={reply}
          mark={c.isPostAuthor ? <AuthorMark c={post.c_category} /> : undefined}
          time={<TimeStamp iso={c.createdAt} absolute />}
          edited={!!c.editedAt}
          text={c.body ?? undefined}
          media={
            c.media ? (
              <div style={{ maxWidth: 320 }} data-comment-image="">
                <MediaBlock
                  kind="image"
                  src={c.media.src}
                  alt=""
                  width={c.media.width}
                  height={c.media.height}
                  focalPoint={c.media.focalPoint}
                  crop={c.media.crop}
                />
              </div>
            ) : undefined
          }
          actions={
            props ? (
              <>
                <ActionRow
                  layer={props}
                  reply={reply}
                  onReply={
                    reply
                      ? undefined
                      : () => {
                          // H62-G1: the field takes focus inside the tap, which is what lets iPhone
                          // raise its keyboard, and without the focus's own scroll; the box then
                          // comes into view by the shell's scroller.
                          setReplyTo(c);
                          rootRef.current
                            ?.querySelector<HTMLElement>("[data-comment-field]")
                            ?.focus({ preventScroll: true });
                          window.requestAnimationFrame(revealFoot);
                        }
                  }
                  mode={mode}
                />
                {props.below}
              </>
            ) : undefined
          }
          input={mode}
          replies={
            !reply && (c.replies.length > 0 || pending.some((p) => p.parentId === c.id)) ? (
              <>
                {c.replies.map((r) => renderComment(r, true))}
                {pending.filter((p) => p.parentId === c.id).map((p) => renderPending(p, true))}
              </>
            ) : undefined
          }
        />
      </div>
    );
  };
  const renderPending = (p: Pending, reply: boolean): ReactNode => (
    <div key={p.clientId} data-comment-pending={p.status}>
      <Comment
        name={member.name}
        avatarSrc={member.avatar}
        reply={reply}
        sending={p.status === "sending"}
        failed={p.status === "failed"}
        onRetry={() => retry(p)}
        text={
          <>
            {p.body}
            {p.status === "failed" && failedReason() ? (
              <span style={{ display: "block", color: "var(--ink-3)", fontSize: 13 }}>
                {failedReason()}
              </span>
            ) : null}
          </>
        }
        media={
          p.image ? (
            <div style={{ maxWidth: 320 }}>
              <MediaBlock
                kind="image"
                src={p.image.previewUrl}
                alt=""
                width={p.image.width}
                height={p.image.height}
                openable={false}
              />
            </div>
          ) : undefined
        }
        input={mode}
      />
    </div>
  );

  const compact = tier === "compact";
  return (
    <div
      ref={rootRef}
      data-comment-thread=""
      style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}
    >
      {thread.isPending ? (
        <p role="status" style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>
          Loading
        </p>
      ) : thread.isError ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>
          The comments did not load.
        </p>
      ) : null}
      {top.length > 0 || pending.some((p) => !p.parentId) ? (
        <div
          data-comments=""
          style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}
        >
          {top.map((c) => renderComment(c, false))}
          {pending.filter((p) => !p.parentId).map((p) => renderPending(p, false))}
        </div>
      ) : null}
      {thread.hasNextPage && (
        <Button
          variant="ghost"
          size={mode === "touch" ? "md" : "sm"}
          disabled={thread.isFetchingNextPage}
          onClick={() => void thread.fetchNextPage()}
          style={{ alignSelf: "flex-start", marginLeft: -12 }}
          data-comments-more=""
        >
          See more comments
        </Button>
      )}
      <CommentBox
        member={member}
        postId={postId}
        mode={mode}
        tier={tier}
        replyingTo={
          replyTo ? { id: replyTo.id, first: firstName(replyTo.author?.name) || "them" } : null
        }
        onCancelReply={() => setReplyTo(null)}
        onSend={start}
        onClose={onClose}
        compact={compact}
      />
      {layer.overlays}
    </div>
  );
}

/**
 * SPEC 8.3: the collapsed card's one line. A PersonLink (photo 24 and the name) opening the
 * commenter's profile, then the text in a button opening the post; a withheld commenter reads as a
 * role with no photo and no link (141, 1820). Nothing counts.
 */
export function LatestCommentLine({
  comment,
  member,
  mode,
  onOpen,
}: {
  comment: CommentView;
  member: Member;
  mode: Mode;
  onOpen: () => void;
}) {
  const touch = mode === "touch";
  const words = comment.body ?? (comment.media ? "Shared an image" : "");
  return (
    <div
      data-comment="latest"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: touch ? 44 : "var(--target-min)",
        minWidth: 0,
      }}
    >
      {comment.author ? (
        <PersonLink
          name={comment.author.name}
          handle={comment.author.handle}
          avatar={comment.author.avatar}
          size={24}
          style={{ flex: "none", fontSize: 15 }}
        />
      ) : comment.you ? (
        <PersonLink
          name={member.name}
          handle={member.handle ?? ""}
          avatar={member.avatar}
          size={24}
          style={{ flex: "none", fontSize: 15 }}
        />
      ) : (
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)", flex: "none" }}>
          {COMMENTER_ROLE}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        data-comment-latest-text=""
        style={{
          all: "unset",
          cursor: "pointer",
          flex: 1,
          minWidth: 0,
          minHeight: touch ? 44 : "var(--target-min)",
          display: "inline-flex",
          alignItems: "center",
          fontSize: 15,
          lineHeight: 1.4,
          color: "var(--ink)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {words}
        </span>
      </button>
    </div>
  );
}
