// Brief 14, handoff 41-C, SPEC 41-14 Part C item 2: the thread (extraction 41-14 sections 1.5, 1.6,
// 1.7 and 2). Below expanded it is its own route on Pane's extended route bar with no dock and the
// composer on the safe-area inset (1368, 1369); at expanded the same component renders inside the
// Pane on /messages with the URL still /messages/{thread} (1047, 1023). Reads:
// messenger_messages_view by seq with a cursor on seq, the thread's row from the list cache, the
// settings, the vocabularies, the thread's roster for mentions and Manage. Writes: the wrappers and
// 41-B's routes alone, through src/lib/messenger.ts and src/lib/media.ts. Realtime: thread:{id}
// while open; a message event refetches that one row by seq, a cursor event updates ticks locally
// for a pair and refetches the own rows it touches in a group, a rejoin refetches from the last seq
// held under the `Catching up` line. Every label is the extraction's. No count, presence or typing
// state anywhere; the unsent text lives here, in this tab, and nowhere else (1351).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/strand/Avatar";
import { BlockedMessageLine } from "@/components/strand/BlockedMessageLine";
import { Button } from "@/components/strand/Button";
import { DaySeparator } from "@/components/strand/DaySeparator";
import { DiaLine } from "@/components/strand/DiaLine";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { MediaBlock } from "@/components/strand/MediaBlock";
import type { MenuItem, MenuRule } from "@/components/strand/Menu";
import {
  MessageBubble,
  type MessageReaction,
  type QuickReaction,
} from "@/components/strand/MessageBubble";
import { MessageComposer, type ComposerMention } from "@/components/strand/MessageComposer";
import { Pane } from "@/components/strand/Pane";
import { PinnedStrip } from "@/components/strand/PinnedStrip";
import { reactionGlyphId, reactionGlyphTakesTone } from "@/components/strand/ReactionGlyph";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { Switch } from "@/components/strand/Switch";
import { GroupMark } from "@/components/strand/ThreadRow";
import { Ticks, tickStatus } from "@/components/strand/Ticks";
import { Toast } from "@/components/strand/Toast";
import { VoicePlayer } from "@/components/strand/VoicePlayer";
import { toastStyle } from "@/components/dna/FeedSurface";
import { MessengerPaneContext } from "@/components/dna/MessengerSurface";
import { ReactionPicker } from "@/components/dna/ReactionPicker";
import { useKeyboardViewport } from "@/hooks/use-keyboard-height";
import type { Member } from "@/lib/auth";
import { loadNetwork } from "@/lib/connect";
import type { Json } from "@/lib/database.types";
import { unfurl } from "@/lib/dia";
import { baseOf, toneFor, toneOf, withTone } from "@/lib/emoji";
import { MESSAGE_MEDIA_MAX_BYTES, messageMediaUrl, uploadMessageMedia } from "@/lib/media";
import {
  clockLabel,
  dayKey,
  dayLabel,
  deleteForEveryone,
  diaDismiss,
  edit as editMessage,
  flushCursors,
  groupEmptyLine,
  invitedEmptyLine,
  groupSubtitle,
  invite as inviteMember,
  inviteAccept,
  inviteDecline,
  leave as leaveThread,
  loadDiaSignals,
  loadMessageAt,
  loadMessages,
  loadThread,
  MESSAGE_PAGE,
  MessengerError,
  pinMessage,
  react as reactTo,
  readTo,
  recentReactions,
  refusalOf,
  remove as removeMember,
  report as reportMessage,
  REFUSAL_LINES,
  send as sendMessage,
  setHistory,
  settingsSet,
  subscribeThread,
  systemLine,
  threadC,
  threadRename,
  unpinMessage,
  unreact,
  type MessageView,
  type ThreadView,
} from "@/lib/messenger";
import {
  SETTINGS_KEY,
  SIGNALS_KEY,
  THREADS_KEY,
  refreshThreadRow,
  useMessagingSettings,
  useThreads,
} from "@/lib/messenger-inbox";
import {
  useAudio,
  useAvatarUrl,
  useMessageMedia,
  useMessageMediaLoad,
  useRecorder,
} from "@/lib/messenger-media";
import { firstName, joinNames, nameList } from "@/lib/names";
import { record } from "@/lib/record";
import { useRecordWhen } from "@/lib/record-hooks";
import { clearShellLayout, setShellLayout } from "@/lib/rail-store";
import { getSupabase } from "@/lib/supabase";
import { useMode, useTier } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";

const MESSAGES_KEY = (threadId: string) => ["messenger", "messages", threadId] as const;
const ROSTER_KEY = (threadId: string) => ["messenger", "roster", threadId] as const;

const QUIET = {
  margin: 0,
  fontSize: "var(--text-s)",
  lineHeight: "var(--text-s-lh)",
  color: "var(--ink-3)",
  textWrap: "pretty" as const,
};

const CAPS = {
  fontSize: "var(--text-xs)",
  lineHeight: "var(--text-xs-lh)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase" as const,
  fontWeight: "var(--weight-medium)" as unknown as number,
  color: "var(--ink-3)",
};

const EDIT_WINDOW_MS = 60 * 60_000;
const DELETE_WINDOW_MS = 60 * 3_600_000;
const LIMITED_MS = 20_000;

type RosterMember = { id: string; name: string; role: string; state: string };

type Draft = {
  text: string;
  quote: MessageView | null;
  editing: MessageView | null;
  media: { kind: "image" | "video"; file: File; url: string } | null;
  voice: { blob: Blob; mime: string; durationMs: number } | null;
  preview: { url: string; domain: string; title: string | null; image: string | null } | null;
  previewRemoved: string | null;
  notice: boolean;
  /** H56-MOV item 2: which refusal the attached file met; each is its own state, read on the thread root. */
  refusal: "bad_media" | "too_large" | null;
  failed: { clientId: string } | null;
  mentioned: ComposerMention[];
};

const EMPTY_DRAFT: Draft = {
  text: "",
  quote: null,
  editing: null,
  media: null,
  voice: null,
  preview: null,
  previewRemoved: null,
  notice: false,
  refusal: null,
  failed: null,
  mentioned: [],
};

/** A video's pixel size, read from the composer's attached <video> (H56-MOV). */
type VideoSize = { width: number; height: number };
/** How long a send waits for the attached element's metadata before it goes without a size. */
const VIDEO_MEASURE_MS = 15_000;

const URL_IN_TEXT = /(https?:\/\/[^\s<>"']+|\b[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;

function sortBySeq(rows: MessageView[]): MessageView[] {
  const seen = new Map<number, MessageView>();
  for (const r of rows) if (r.seq !== null) seen.set(r.seq, r);
  return [...seen.values()].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

function LinkPreview({ preview }: { preview: Json }) {
  const p = (preview ?? {}) as Record<string, unknown>;
  const url = typeof p["url"] === "string" ? p["url"] : "";
  if (!url) return null;
  const image = typeof p["image_url"] === "string" ? (p["image_url"] as string) : null;
  return (
    <MediaBlock
      kind="link"
      src={url}
      domain={typeof p["domain"] === "string" ? (p["domain"] as string) : undefined}
      title={typeof p["title"] === "string" ? (p["title"] as string) : undefined}
      items={image ? [image] : []}
    />
  );
}

/**
 * SPEC-41-E 3 (rulings 1574, 1569, 1583, 1593): a video plays in the browser's own player inside
 * the bubble's frame, its aspect from the message row's own media_width and media_height, 16 / 9
 * only when either is missing, object-fit contain, no duration label and no poster (the poster frame
 * is held: nothing stores one, G entry in docs/GAPS.md). A fetch the route refused or an `error` on
 * the element draws the failed block, M1 and M2; Try again refetches and remounts the player. An
 * image keeps MediaBlock, at its own ratio (1738).
 */
function MessageMedia({
  mediaId,
  width,
  height,
  own,
}: {
  mediaId: string;
  width: number | null;
  height: number | null;
  own: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [broken, setBroken] = useState(false);
  const load = useMessageMediaLoad(mediaId, attempt);
  const media = load.media;
  const retry = () => {
    setBroken(false);
    setAttempt((n) => n + 1);
  };
  const isVideo = media ? media.mime.startsWith("video/") : width !== null || height !== null;
  if (isVideo && (load.status === "failed" || broken))
    return (
      <div
        role="alert"
        data-video-failed
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-l)",
          background: own ? "var(--surface)" : "var(--bg-sunken)",
          border: "1px solid var(--line)",
          minWidth: 220,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-s)",
            lineHeight: "var(--text-s-lh)",
            color: "var(--ink-2)",
          }}
        >
          This video could not load.
        </span>
        <Button variant="secondary" size="sm" onClick={retry} data-video-retry>
          Try again
        </Button>
      </div>
    );
  if (!media) return <span aria-busy="true" style={{ display: "block", minHeight: 44 }} />;
  if (media.mime.startsWith("video/")) {
    const ratio = width && height ? width + " / " + height : "16 / 9";
    return (
      <video
        key={attempt}
        src={media.url}
        controls
        preload="metadata"
        playsInline
        aria-label="Video"
        data-message-video
        data-video-ratio={ratio}
        onError={() => setBroken(true)}
        style={{
          display: "block",
          width: "100%",
          maxWidth: 320,
          aspectRatio: ratio,
          objectFit: "contain",
          borderRadius: "var(--radius-l)",
          background: "var(--ink)",
        }}
      />
    );
  }
  // 1738: the row stores no image dimensions, so the set's `unknown` frame (1.91:1 contained on the
  // fill) must not apply; the image takes the bubble's media width at its own ratio, up to 420 tall.
  return <MediaBlock kind="image" src={media.url} alt="" natural={420} />;
}

function VoiceNote({ mediaId, own }: { mediaId: string; own: boolean }) {
  const media = useMessageMedia(mediaId);
  const audio = useAudio(media?.url ?? null);
  return (
    <VoicePlayer
      duration={audio.duration}
      position={audio.position}
      playing={audio.playing}
      onToggle={audio.toggle}
      onSeek={audio.seek}
      own={own}
    />
  );
}

function sheetHead(title: string, onClose?: () => void): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 56,
        padding: onClose ? "0 8px 0 20px" : "0 20px",
        borderBottom: "1px solid var(--line)",
        flex: "none",
      }}
    >
      <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700 }}>
        {title}
      </h2>
      {onClose && <IconButton name="x" label="Close" onClick={onClose} />}
    </div>
  );
}

const SHEET_BODY = {
  flex: 1,
  overflowY: "auto" as const,
  padding: 20,
  display: "flex",
  flexDirection: "column" as const,
  gap: "var(--space-4)",
};

export function MessengerThread({ member, threadId }: { member: Member; threadId: string }) {
  const tier = useTier();
  // Expanded: inside the Pane on /messages, where the header row is the thread's own under Pane's
  // close control; otherwise the route form. Read from the tree (MessengerPaneContext), not the tier.
  const inPane = useContext(MessengerPaneContext);
  const compact = tier === "compact";
  const mode = useMode();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const focusSeq = useLocation({
    select: (l) => (l.state as { focusSeq?: number }).focusSeq ?? null,
  });
  const threads = useThreads(member);
  const cached = (threads.data ?? []).find((t) => t.thread_id === threadId) ?? null;
  const threadQ = useQuery({
    queryKey: ["messenger", "thread", threadId],
    queryFn: () => loadThread(threadId),
    enabled: !cached,
  });
  const thread: ThreadView | null = cached ?? threadQ.data ?? null;
  const settings = useMessagingSettings(member);
  const receipts = !!settings.data?.receipts_enabled;
  const previewsOn = !!settings.data?.link_previews_enabled;
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const signals = useQuery({ queryKey: SIGNALS_KEY(member.id), queryFn: loadDiaSignals });
  // 12C part 2: DIA's quiet signal for this thread, shown once per appearance; acted when the
  // member sends into the thread while it shows (the send below).
  const quietSignalShowing = (signals.data ?? []).some((s) => s.thread_id === threadId);
  useRecordWhen("dia_suggestion_shown", quietSignalShowing, { suggestion_kind: "messenger_quiet" });
  // SPEC-41-E 2: the quick eight from the vocabulary (an absent one renders an empty bar), the
  // member's tone from their settings (unchosen is no modifier, 1576), their recent emoji (1405).
  const quick = useMemo(() => vocab.data?.message_reaction_quick ?? [], [vocab.data]);
  const tone = toneFor(settings.data?.reaction_skin_tone ?? null);
  const quickLabel = (emoji: string) =>
    quick.find((q) => baseOf(q.value) === baseOf(emoji))?.label ?? emoji;
  const [more, setMore] = useState<string | null>(null);
  const recent = useQuery({
    queryKey: ["messenger", "recent", member.id],
    queryFn: recentReactions,
    enabled: more !== null,
  });
  const group = !!thread && thread.kind !== "one_to_one";
  const c = threadC(thread?.kind ?? null);
  const lead = thread?.role === "lead" || thread?.role === "co_lead";
  const invited = !!thread?.invited;
  const roster = useQuery({
    queryKey: ROSTER_KEY(threadId),
    queryFn: async (): Promise<RosterMember[]> => {
      const sb = getSupabase();
      if (!sb) return [];
      const { data: tms } = await sb
        .from("thread_members")
        .select("member_id,role,state")
        .eq("thread_id", threadId);
      const ids = (tms ?? []).map((t) => t.member_id);
      if (!ids.length) return [];
      const { data: ms } = await sb.from("members").select("id,name").in("id", ids);
      const name = new Map((ms ?? []).map((m) => [m.id, m.name]));
      return (tms ?? []).map((t) => ({
        id: t.member_id,
        name: name.get(t.member_id) ?? "",
        role: t.role,
        state: t.state,
      }));
    },
    enabled: group,
  });
  const others: ComposerMention[] = useMemo(
    () =>
      (roster.data ?? [])
        .filter((r) => r.id !== member.id && r.state === "active")
        .map((r) => ({ id: r.id, name: r.name })),
    [roster.data, member.id],
  );
  const mentionNames = useMemo(
    () => [...others.map((o) => o.name), member.name, ...nameList(thread?.member_names)],
    [others, member.name, thread?.member_names],
  );

  // Ruling 1457: while the keyboard is up the route's frame is the visible area, so the composer
  // sits on the keyboard and the thread's own bar holds the top; it returns to the shell's height
  // when the keyboard closes. The measurement is the app's one (src/hooks/use-keyboard-height.ts).
  const keyboard = useKeyboardViewport(!inPane);
  const keyboardFrame: CSSProperties | null =
    keyboard.height > 0
      ? {
          position: "fixed",
          top: keyboard.offsetTop,
          left: 0,
          right: 0,
          height: keyboard.viewportHeight,
          zIndex: "calc(var(--z-sticky) + 1)" as unknown as number,
        }
      : null;

  // 1368: below expanded the thread route has no dock and fills the height.
  useEffect(() => {
    if (inPane) return;
    setShellLayout({ mode: "canvas", key: "messages:" + threadId });
    return () => clearShellLayout("messages:" + threadId);
  }, [inPane, threadId]);

  // The log.
  const messages = useQuery({
    queryKey: MESSAGES_KEY(threadId),
    queryFn: () => loadMessages(threadId),
  });
  const rows = useMemo(() => sortBySeq(messages.data ?? []), [messages.data]);
  const maxSeq = rows.length ? (rows[rows.length - 1]?.seq ?? 0) : 0;
  const minSeq = rows.length ? (rows[0]?.seq ?? 0) : 0;
  const [catchingUp, setCatchingUp] = useState(false);
  const [olderDone, setOlderDone] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const say = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  const upsert = useCallback(
    (row: MessageView | null, seq?: number) => {
      qc.setQueryData<MessageView[]>(MESSAGES_KEY(threadId), (prev) => {
        const list = prev ?? [];
        if (!row) return seq !== undefined ? list.filter((r) => r.seq !== seq) : list;
        return sortBySeq([...list.filter((r) => r.seq !== row.seq), row]);
      });
    },
    [qc, threadId],
  );
  const refetchRow = useCallback(
    async (seq: number) => {
      const row = await loadMessageAt(threadId, seq).catch(() => null);
      upsert(row, seq);
      return row;
    },
    [threadId, upsert],
  );
  const refetchRows = useCallback(
    async (seqs: number[]) => {
      const sb = getSupabase();
      if (!sb || !seqs.length) return;
      const { data } = await sb
        .from("messenger_messages_view")
        .select("*")
        .eq("thread_id", threadId)
        .in("seq", seqs);
      for (const r of data ?? []) upsert(r);
    },
    [threadId, upsert],
  );
  const maxSeqRef = useRef(0);
  maxSeqRef.current = maxSeq;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Reading: everything held is read while the thread is open (cursors debounced in the lib).
  useEffect(() => {
    if (maxSeq > 0 && !invited) readTo(threadId, maxSeq);
  }, [threadId, maxSeq, invited]);
  useEffect(() => () => flushCursors(threadId), [threadId]);

  // Realtime (1351).
  useEffect(() => {
    const off = subscribeThread(threadId, {
      onMessage: (seq) => {
        void refetchRow(seq).then(() => {
          if (seq > maxSeqRef.current) readTo(threadId, seq);
        });
      },
      onCursor: (p) => {
        if (p.member_id === member.id) return;
        const own = rowsRef.current.filter((r) => r.own && (r.seq ?? 0) <= p.read_seq);
        if (!group) {
          // A pair: the other member's cursors are the whole story (1336).
          qc.setQueryData<MessageView[]>(MESSAGES_KEY(threadId), (prev) =>
            (prev ?? []).map((r) => {
              if (!r.own || r.seq === null) return r;
              const delivered = r.seq <= p.delivered_seq;
              const read = r.seq <= p.read_seq;
              const tick = read
                ? Math.max(r.tick ?? 1, 2)
                : delivered
                  ? Math.max(r.tick ?? 1, 2)
                  : r.tick;
              return tick === r.tick ? r : { ...r, tick };
            }),
          );
          // The read state depends on both members' receipts, which the projection decides.
          void refetchRows(own.map((r) => r.seq ?? 0).filter((s) => s > 0));
        } else {
          void refetchRows(
            rowsRef.current
              .filter(
                (r) =>
                  r.own &&
                  (r.seq ?? 0) <= Math.max(p.read_seq, p.delivered_seq) &&
                  (r.tick ?? 0) < 3,
              )
              .map((r) => r.seq ?? 0)
              .filter((s) => s > 0),
          );
        }
      },
      onReconnect: () => {
        setCatchingUp(true);
        void loadMessages(threadId, { after: maxSeqRef.current, limit: 200 })
          .then((late) => {
            for (const r of late) upsert(r);
            const top = late.length ? (late[late.length - 1]?.seq ?? 0) : 0;
            if (top > 0) readTo(threadId, top);
          })
          .catch(() => undefined)
          .finally(() => setCatchingUp(false));
      },
    });
    return off;
  }, [threadId, member.id, group, qc, refetchRow, refetchRows, upsert]);

  // Scrolling: the log's foot on open and on a new row; a focused message is brought up and ringed.
  const log = useRef<HTMLDivElement>(null);
  const lastSeen = useRef(0);
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    if (focusSeq && rows.some((r) => r.seq === focusSeq)) return;
    if (maxSeq !== lastSeen.current) {
      lastSeen.current = maxSeq;
      el.scrollTop = el.scrollHeight;
    }
  }, [maxSeq, rows, focusSeq]);
  useEffect(() => {
    if (!focusSeq || !rows.length) return;
    const row = rows.find((r) => r.seq === focusSeq);
    if (!row) {
      if (minSeq > focusSeq && !olderDone)
        void loadMessages(threadId, { before: minSeq, limit: MESSAGE_PAGE }).then((older) => {
          if (!older.length) setOlderDone(true);
          for (const r of older) upsert(r);
        });
      return;
    }
    setFocused(row.message_id ?? null);
    window.setTimeout(() => {
      const el = log.current?.querySelector<HTMLElement>('[data-msg="' + row.message_id + '"]');
      const c = log.current;
      if (el && c) c.scrollTop = el.offsetTop - 72;
    }, 60);
    const t = window.setTimeout(() => setFocused(null), 2200);
    return () => window.clearTimeout(t);
  }, [focusSeq, rows, minSeq, olderDone, threadId, upsert]);
  const loadOlder = () => {
    if (olderDone || !minSeq) return;
    void loadMessages(threadId, { before: minSeq }).then((older) => {
      if (!older.length) setOlderDone(true);
      for (const r of older) upsert(r);
    });
  };

  // The composer's state, this tab only (1351).
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const [sending, setSending] = useState(false);
  const [limitedUntil, setLimitedUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!limitedUntil) return;
    const t = window.setTimeout(() => tick((n) => n + 1), Math.max(0, limitedUntil - Date.now()));
    return () => window.clearTimeout(t);
  }, [limitedUntil]);
  const limited = limitedUntil > Date.now();
  const recorder = useRecorder();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  // H56-MOV: an attached video is measured by a <video> attached to the document, rendered with the
  // composer below, and never by a detached element. Nobody has observed what a detached element
  // returned in Safari; that it returns no size where an attached one does is the hypothesis the
  // founder's Safari walk (Done Means 2) tests. The measurement for the draft's object URL settles
  // once, on loadedmetadata or error, and a send waits on it.
  const measured = useRef<{
    url: string;
    done: Promise<VideoSize | null>;
    settle: (size: VideoSize | null) => void;
  } | null>(null);
  const measure = (url: string) => {
    let settle: (size: VideoSize | null) => void = () => undefined;
    const done = new Promise<VideoSize | null>((resolve) => {
      settle = resolve;
    });
    measured.current = { url, done, settle };
  };
  const onMeasured = (url: string, video: HTMLVideoElement | null) => {
    const m = measured.current;
    if (!m || m.url !== url) return;
    m.settle(
      video && video.videoWidth > 0 && video.videoHeight > 0
        ? { width: video.videoWidth, height: video.videoHeight }
        : null,
    );
  };
  const videoSize = async (media: { file: File; url: string }): Promise<Partial<VideoSize>> => {
    const m = measured.current;
    if (media.file.size > MESSAGE_MEDIA_MAX_BYTES || !m || m.url !== media.url) return {};
    let timer = 0;
    const size = await Promise.race([
      m.done,
      new Promise<null>((resolve) => {
        timer = window.setTimeout(() => resolve(null), VIDEO_MEASURE_MS);
      }),
    ]);
    window.clearTimeout(timer);
    return size ?? {};
  };
  const [picker, setPicker] = useState<string | null>(null);
  // 1739: the open bar closes on a pointerdown or touch outside that message's bar, its inline panel
  // and its own React toggle, and on Escape. Nothing is prevented, so the outside tap still does what
  // it would have done, and the close waits for that tap's click: closing on the pointerdown itself
  // lifts every row under the bar before the pointer is released, and the click then lands on
  // whatever moved under it, or nowhere (another message's React at 1280). No click, as for a
  // scroll or a drag, closes it on pointercancel or 400 ms after the release. Each close names the
  // message it was armed for, so a tap that opens another message's bar is not undone by it. The
  // touch Sheet of the full picker keeps its own close: while it is open nothing here listens, so
  // neither a tap in it nor Escape counts against the bar. Another message's bar opening closes this
  // one because there is one `picker`.
  const sheetOpen = more !== null && mode === "touch";
  useEffect(() => {
    if (!picker || sheetOpen) return;
    const id = picker;
    const inside = (t: EventTarget | null) => {
      if (!(t instanceof Element)) return false;
      const row = t.closest("[data-msg]");
      if (!row || row.getAttribute("data-msg") !== id) return false;
      return !!t.closest("[data-picker], [data-picker-panel], [data-react-toggle]");
    };
    // Closing the bar closes the pointer inline panel with it.
    const close = () => {
      setPicker((p) => (p === id ? null : p));
      setMore((m) => (m === id ? null : m));
    };
    let armed = false;
    let timer = 0;
    const settle = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(close, ms);
    };
    const down = (e: Event) => {
      if (!inside(e.target)) armed = true;
    };
    const up = () => {
      if (armed) settle(400);
    };
    const landed = () => {
      if (armed) settle(0);
    };
    // Captured and prevented, so the Pane's own Escape (which skips a prevented one) leaves the
    // thread open: one Escape closes the innermost layer, the bar.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("touchstart", down, { capture: true, passive: true });
    document.addEventListener("pointerup", up, true);
    document.addEventListener("touchend", up, true);
    document.addEventListener("click", landed, true);
    document.addEventListener("pointercancel", landed, true);
    document.addEventListener("keydown", key, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("touchstart", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("touchend", up, true);
      document.removeEventListener("click", landed, true);
      document.removeEventListener("pointercancel", landed, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [picker, sheetOpen]);
  // H62-G1 (the walk of 20 Oct, item 3): a bar opened on one of the newest messages renders at the
  // log's foot, under the composer, where it cannot be reached; the log only follows a new message.
  // So once a bar opens, the log is scrolled by the least that brings the bar, and the pointer
  // panel with it, inside the log's own visible area. The log alone scrolls, never the window.
  useEffect(() => {
    if (!picker) return;
    const frame = window.requestAnimationFrame(() => {
      const el = log.current;
      const row = el?.querySelector<HTMLElement>('[data-msg="' + CSS.escape(picker) + '"]');
      const parts = row
        ? [...row.querySelectorAll<HTMLElement>("[data-picker], [data-reaction-panel]")]
        : [];
      if (!el || !parts.length) return;
      const box = el.getBoundingClientRect();
      const top = Math.min(...parts.map((p) => p.getBoundingClientRect().top));
      const bottom = Math.max(...parts.map((p) => p.getBoundingClientRect().bottom));
      const pad = 8;
      if (bottom + pad > box.bottom) el.scrollTop += bottom + pad - box.bottom;
      else if (top - pad < box.top) el.scrollTop -= box.top - (top - pad);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [picker, more]);
  const [expandedBlocked, setExpandedBlocked] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<
    | { kind: "info"; row: MessageView }
    | { kind: "report"; row: MessageView; reason: string; note: string; done: boolean }
    | { kind: "leave" }
    | { kind: "manage" }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const err = e instanceof MessengerError ? e : refusalOf(e);
    if (err.word === "rate_limited") setLimitedUntil(Date.now() + LIMITED_MS);
    return err;
  };
  const act = async (
    fn: () => Promise<unknown>,
    done?: string,
    onFail?: (line: string) => void,
  ) => {
    setBusy(true);
    try {
      await fn();
      if (done) say(done);
    } catch (e) {
      const line = fail(e).line;
      if (onFail) onFail(line);
      else say(line);
    } finally {
      setBusy(false);
    }
  };

  // The link preview draft (1343): only while the setting is on, removable before sending.
  const previewTimer = useRef<number | null>(null);
  const onText = (text: string) => {
    const m = URL_IN_TEXT.exec(text);
    const url = m ? (/^https?:\/\//i.test(m[0]) ? m[0] : "https://" + m[0]) : null;
    patch({ text, failed: null });
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    if (!previewsOn || !url) {
      if (!url && draft.preview) patch({ preview: null });
      return;
    }
    if (draft.previewRemoved === url || draft.preview?.url === url) return;
    previewTimer.current = window.setTimeout(() => {
      void unfurl(url).then((meta) => {
        setDraft((d) => {
          if (d.previewRemoved === url || !URL_IN_TEXT.test(d.text)) return d;
          return {
            ...d,
            preview: {
              url,
              domain: url.replace(/^https?:\/\//, "").split("/")[0] ?? "",
              title: meta?.title ?? null,
              image: meta?.image ?? null,
            },
          };
        });
      });
    }, 600);
  };

  const attach = (kind: "image" | "video") => {
    (kind === "image" ? imageInput : videoInput).current?.click();
  };
  const onFile = (kind: "image" | "video", files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const ok = kind === "image" ? file.type.startsWith("image/") : file.type.startsWith("video/");
    if (!ok) {
      patch({ refusal: "bad_media" });
      return;
    }
    // H56-MOV item 2 (G257): a video over the ceiling is refused here, before an object URL exists,
    // so neither the thumbnail's <img> nor the measuring <video> is handed bytes the send would refuse
    // anyway. Runs 534 and 538 of the macOS gate read a 100 MB draft in those two elements holding
    // WebKit's main thread past the arm's 30 s Send click; the send path's own ceiling stays.
    if (kind === "video" && file.size > MESSAGE_MEDIA_MAX_BYTES) {
      patch({ refusal: "too_large" });
      return;
    }
    if (draft.media) URL.revokeObjectURL(draft.media.url);
    const url = URL.createObjectURL(file);
    if (kind === "video") measure(url);
    patch({
      media: { kind, file, url },
      voice: null,
      refusal: null,
      notice: settings.data?.media_notice_seen_at === null,
    });
  };
  // The media notice (1346): once, written on OK.
  const noticeOk = () => {
    patch({ notice: false });
    void settingsSet({ mediaNoticeSeen: true })
      .then((row) => qc.setQueryData(SETTINGS_KEY(member.id), row))
      .catch(() => undefined);
  };

  const startRecording = () => {
    if (draft.editing || limited) return;
    void recorder.start();
  };
  const stopRecording = () => {
    void recorder.stop().then((r) => {
      if (r) patch({ voice: r, media: null });
    });
  };

  const clearDraft = () => {
    if (draft.media) URL.revokeObjectURL(draft.media.url);
    setDraft(EMPTY_DRAFT);
  };

  const sendNow = async () => {
    if (sending || limited || !thread) return;
    if (draft.editing) {
      const body = draft.text.trim();
      if (!body) return;
      setSending(true);
      try {
        await editMessage(draft.editing.message_id ?? "", body);
        await refetchRow(draft.editing.seq ?? 0);
        clearDraft();
      } catch (e) {
        say(fail(e).line);
      } finally {
        setSending(false);
      }
      return;
    }
    const body = draft.text.trim();
    if (!body && !draft.media && !draft.voice) return;
    const clientId = draft.failed?.clientId ?? crypto.randomUUID();
    setSending(true);
    try {
      let mediaId: string | null = null;
      let kind: "text" | "media" | "voice" = "text";
      if (draft.media) {
        const up = await uploadMessageMedia(
          threadId,
          clientId,
          draft.media.file,
          draft.media.kind === "video"
            ? { kind: "video", ...(await videoSize(draft.media)) }
            : { kind: "image" },
        );
        if (!up.ok) {
          if (up.reason === "rate_limited") setLimitedUntil(Date.now() + LIMITED_MS);
          else if (up.reason === "bad_media" || up.reason === "too_large")
            patch({ refusal: up.reason });
          else patch({ failed: { clientId } });
          return;
        }
        mediaId = up.mediaId;
        kind = "media";
      } else if (draft.voice) {
        const up = await uploadMessageMedia(threadId, clientId, draft.voice.blob, {
          kind: "audio",
          durationMs: draft.voice.durationMs,
        });
        if (!up.ok) {
          if (up.reason === "rate_limited") setLimitedUntil(Date.now() + LIMITED_MS);
          else patch({ failed: { clientId } });
          return;
        }
        mediaId = up.mediaId;
        kind = "voice";
      }
      const mentions = draft.mentioned
        .filter((m) => draft.text.includes("@" + m.name))
        .map((m) => m.id);
      const preview =
        previewsOn && draft.preview
          ? ({
              url: draft.preview.url,
              domain: draft.preview.domain,
              title: draft.preview.title,
              image_url: draft.preview.image,
            } as Json)
          : null;
      const row = await sendMessage({
        thread: threadId,
        clientId,
        body: body || null,
        kind,
        replyTo: draft.quote?.message_id ?? null,
        media: mediaId,
        mentions,
        linkPreview: preview,
      });
      if (row) await refetchRow(row.seq);
      if ((signals.data ?? []).some((s) => s.thread_id === threadId))
        record("dia_suggestion_acted", { suggestion_kind: "messenger_quiet" });
      clearDraft();
      void refreshThreadRow(qc, member.id, threadId);
    } catch (e) {
      const err = fail(e);
      if (err.word !== "rate_limited") patch({ failed: { clientId } });
      if (err.word && err.word !== "rate_limited" && err.word !== "empty") say(err.line);
    } finally {
      setSending(false);
    }
  };

  // 2.1, 1590: one reaction per member; a press on the member's own glyph removes it, another
  // replaces it. The bar, and the pointer panel with it, closes --dur-slow after the press so the
  // pop is seen (2.2, 1739a).
  const toggleReaction = (row: MessageView, emoji: string) => {
    const mine = reactionsOf(row).find((r) => r.own);
    void act(async () => {
      if (mine && baseOf(mine.emoji) === baseOf(emoji))
        await unreact(row.message_id ?? "", mine.emoji);
      else await reactTo(row.message_id ?? "", emoji);
      await refetchRow(row.seq ?? 0);
      void qc.invalidateQueries({ queryKey: ["messenger", "recent", member.id] });
    });
    setMore(null);
    window.setTimeout(() => {
      setPicker((p) => (p === row.message_id ? null : p));
      setMore((m) => (m === row.message_id ? null : m));
    }, 300);
  };

  const reactionsOf = (row: MessageView): MessageReaction[] => {
    const list = Array.isArray(row.reactions) ? (row.reactions as Record<string, unknown>[]) : [];
    return list
      .map((r) => {
        const emoji = typeof r["reaction"] === "string" ? (r["reaction"] as string) : "";
        const names = nameList(r["names"]).map((n) => (n === member.name ? "you" : firstName(n)));
        return {
          emoji,
          label: quickLabel(emoji),
          names: joinNames(names, !!r["others"]),
          own: !!r["own"],
          toneFill: toneOf(emoji).hex,
        };
      })
      .filter((r) => r.emoji);
  };
  /** The quick bar for one message: the eight with the member's tone on the hands, pressed where the member's own is that glyph. */
  const quickFor = (row: MessageView): QuickReaction[] => {
    const mine = reactionsOf(row).find((r) => r.own);
    return quick.map((q) => {
      const id = reactionGlyphId(q.value);
      const takesTone = !!id && reactionGlyphTakesTone(id);
      return {
        value: withTone(q.value, takesTone, tone.modifier),
        label: q.label,
        toneFill: takesTone ? tone.hex : null,
        pressed: !!mine && baseOf(mine.emoji) === baseOf(q.value),
      };
    });
  };
  const setTone = (value: string) =>
    void settingsSet({ skinTone: value })
      .then((row) => qc.setQueryData(SETTINGS_KEY(member.id), row))
      .catch((e) => say(fail(e).line));
  const pickerFor = (row: MessageView) => (
    <ReactionPicker
      tone={tone}
      onTone={setTone}
      recent={recent.data ?? []}
      quick={quick}
      onPick={(emoji) => toggleReaction(row, emoji)}
      input={mode}
      listHeight={mode === "pointer" ? 300 : undefined}
    />
  );

  const menuFor = (row: MessageView): (MenuItem | MenuRule | false | null | undefined)[] => {
    const age = Date.now() - new Date(row.created_at ?? 0).getTime();
    const own = !!row.own;
    const items: (MenuItem | MenuRule | false | null)[] = [
      {
        id: "reply",
        label: "Reply",
        icon: "reply",
        onSelect: () => patch({ quote: row, editing: null }),
      },
      { id: "react", label: "React", onSelect: () => setPicker(row.message_id ?? null) },
      own && row.kind === "text" && age < EDIT_WINDOW_MS && !row.deleted
        ? {
            id: "edit",
            label: "Edit",
            onSelect: () =>
              patch({ editing: row, text: row.body ?? "", quote: null, media: null, voice: null }),
          }
        : null,
      group && lead
        ? {
            id: "pin",
            label: row.pinned ? "Unpin" : "Pin",
            icon: "pin",
            onSelect: () =>
              void act(async () => {
                await (row.pinned
                  ? unpinMessage(row.message_id ?? "")
                  : pinMessage(row.message_id ?? ""));
                await qc.invalidateQueries({ queryKey: MESSAGES_KEY(threadId) });
              }),
          }
        : null,
      group && own
        ? { id: "info", label: "Message info", onSelect: () => setSheet({ kind: "info", row }) }
        : null,
      { rule: true },
      own && age < DELETE_WINDOW_MS
        ? {
            id: "delete",
            label: "Delete for everyone",
            tone: "danger",
            onSelect: () =>
              void act(async () => {
                const mediaId = row.media_id;
                const out = await deleteForEveryone(row.message_id ?? "");
                if (out.storage_path && mediaId) {
                  const sb = getSupabase();
                  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
                  if (token)
                    await fetch(messageMediaUrl(mediaId), {
                      method: "DELETE",
                      headers: { Authorization: "Bearer " + token },
                    }).catch(() => undefined);
                }
                await refetchRow(row.seq ?? 0);
              }),
          }
        : null,
      !own
        ? {
            id: "report",
            label: "Report",
            tone: "danger",
            icon: "flag",
            onSelect: () => setSheet({ kind: "report", row, reason: "", note: "", done: false }),
          }
        : null,
    ];
    return items;
  };

  // Header: avatar or group mark, name, subtitle, control (1369).
  const avatar = useAvatarUrl(thread?.avatar_path, 40);
  const subtitle = thread
    ? thread.kind === "one_to_one"
      ? (thread.headline ?? "")
      : groupSubtitle(thread)
    : "";
  const control: ReactNode = !thread ? null : invited ? (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <Button
        c="connect"
        size="sm"
        disabled={busy}
        onClick={() =>
          void act(async () => {
            await inviteAccept(threadId);
            await refreshThreadRow(qc, member.id, threadId);
            await qc.invalidateQueries({ queryKey: MESSAGES_KEY(threadId) });
          })
        }
      >
        Accept
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() =>
          void act(async () => {
            await inviteDecline(threadId);
            await refreshThreadRow(qc, member.id, threadId);
            void navigate({ to: "/messages" });
          })
        }
      >
        Decline
      </Button>
    </div>
  ) : group && lead && (thread.kind === "community_group" || thread.kind === "event_thread") ? (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setSheet({ kind: "manage" })}
      data-testid="manage"
    >
      Manage
    </Button>
  ) : thread.kind === "event_thread" && thread.anchor_id ? (
    <Button
      variant="secondary"
      size="sm"
      c="convene"
      onClick={() =>
        void navigate({ to: "/convene/events/$id", params: { id: thread.anchor_id as string } })
      }
    >
      Open the event
    </Button>
  ) : thread.kind === "community_group" ? (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setSheet({ kind: "leave" })}
      data-testid="leave"
    >
      Leave
    </Button>
  ) : null;
  const mark =
    thread?.kind === "one_to_one" ? (
      <Avatar name={thread.name ?? ""} src={avatar} size={40} />
    ) : (
      <GroupMark size={40} />
    );

  const pinned = group ? rows.find((r) => r.pinned && !r.deleted) : undefined;
  const quietSignal = (signals.data ?? []).find((s) => s.thread_id === threadId);

  // The log.
  const items: ReactNode[] = [];
  let day: string | null = null;
  for (const r of rows) {
    const key = dayKey(r.created_at ?? "");
    if (key !== day) {
      day = key;
      items.push(<DaySeparator key={"d" + r.seq} label={dayLabel(r.created_at ?? "")} />);
    }
    if (r.blocked) {
      items.push(
        <BlockedMessageLine
          key={r.message_id}
          name={r.author_name ?? ""}
          text={r.body}
          time={clockLabel(r.created_at ?? "")}
          expanded={!!expandedBlocked[r.message_id ?? ""]}
          onToggle={() =>
            setExpandedBlocked((e) => ({ ...e, [r.message_id ?? ""]: !e[r.message_id ?? ""] }))
          }
        />,
      );
      continue;
    }
    if (r.kind === "system") {
      // 1591: the rename's line, composed from the author's first name; never a stored name.
      const line = systemLine(r);
      if (line)
        items.push(
          <div
            key={r.message_id}
            data-msg={r.message_id}
            data-system
            role="status"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "var(--space-2) var(--space-4)",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                lineHeight: "var(--text-xs-lh)",
                color: "var(--ink-3)",
                textAlign: "center",
                textWrap: "pretty",
              }}
            >
              {line}
            </span>
          </div>,
        );
      continue;
    }
    const reply = r.reply_to as Record<string, unknown> | null;
    const quote = reply
      ? {
          from: reply["author_name"] === member.name ? "You" : String(reply["author_name"] ?? ""),
          text:
            reply["deleted"] === true
              ? "This message was deleted"
              : typeof reply["line"] === "string"
                ? (reply["line"] as string)
                : reply["kind"] === "voice"
                  ? "Voice note"
                  : reply["kind"] === "media"
                    ? "Image"
                    : "",
        }
      : null;
    const reactions = reactionsOf(r);
    // SPEC-41-E 5 (1397): with previews on and a card rendered, a body that is exactly the URL shows
    // only the card.
    const cardShown = previewsOn && !!r.link_preview;
    const previewUrl =
      cardShown && typeof (r.link_preview as Record<string, unknown>)["url"] === "string"
        ? String((r.link_preview as Record<string, unknown>)["url"])
        : null;
    const bare = !!previewUrl && (r.body ?? "").trim() === previewUrl;
    items.push(
      <MessageBubble
        key={r.message_id}
        id={r.message_id ?? undefined}
        own={!!r.own}
        c={c}
        text={bare ? null : r.body}
        quote={quote}
        media={
          r.kind === "media" && r.media_id ? (
            <MessageMedia
              mediaId={r.media_id}
              width={r.media_width}
              height={r.media_height}
              own={!!r.own}
            />
          ) : undefined
        }
        voice={
          r.kind === "voice" && r.media_id ? (
            <VoiceNote mediaId={r.media_id} own={!!r.own} />
          ) : undefined
        }
        link={cardShown ? <LinkPreview preview={r.link_preview} /> : undefined}
        reactions={reactions}
        edited={!!r.edited}
        pinned={!!r.pinned}
        deleted={!!r.deleted}
        time={clockLabel(r.created_at ?? "")}
        status={tickStatus(r.tick)}
        receipts={receipts}
        senderName={group && !r.own ? r.author_name : null}
        mentionNames={mentionNames}
        focused={focused === r.message_id}
        input={mode}
        onReply={r.deleted ? undefined : () => patch({ quote: r, editing: null })}
        onReact={
          r.deleted
            ? undefined
            : () => setPicker((p) => (p === r.message_id ? null : (r.message_id ?? null)))
        }
        onToggleReaction={(emoji) => toggleReaction(r, emoji)}
        picker={
          picker === r.message_id
            ? {
                quick: quickFor(r),
                onPick: (value) => toggleReaction(r, value),
                onMore: () => setMore(r.message_id ?? null),
                panel:
                  more === r.message_id && mode === "pointer" ? (
                    <div
                      role="dialog"
                      aria-label="React"
                      data-reaction-panel
                      style={{
                        marginTop: 4,
                        width: "min(100%, 360px)",
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-l)",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        boxShadow: "var(--shadow-3)",
                        boxSizing: "border-box",
                        zIndex: "var(--z-menu)" as unknown as number,
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-s)",
                            fontWeight: "var(--weight-medium)" as unknown as number,
                          }}
                        >
                          React
                        </span>
                        <IconButton
                          name="x"
                          label="Close"
                          input={mode}
                          size={36}
                          onClick={() => setMore(null)}
                        />
                      </div>
                      {pickerFor(r)}
                    </div>
                  ) : undefined,
              }
            : null
        }
        menuItems={r.deleted ? [] : menuFor(r)}
      />,
    );
  }
  // 1638 (Fix PR 10 item 9): while the viewer is invited the log reads the inviter's line in place
  // of the group's empty line, and nothing where the name is withheld.
  if (invited && thread) {
    const line = invitedEmptyLine(thread);
    if (line)
      items.push(
        <div
          key="invited"
          data-testid="thread-invited-line"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-6) var(--space-4)",
          }}
        >
          <p style={{ ...QUIET, textAlign: "center" }}>{line}</p>
        </div>,
      );
  } else if (!messages.isPending && !rows.length)
    items.push(
      <div
        key="empty"
        data-testid="thread-empty"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-6) var(--space-4)",
        }}
      >
        <p style={{ ...QUIET, textAlign: "center" }}>
          {group && thread ? groupEmptyLine(thread) : "Nothing yet. Say hello."}
        </p>
      </div>,
    );
  if (quietSignal)
    items.push(
      <div key="dia" style={{ padding: "var(--space-3) var(--space-4) 0" }}>
        <DiaLine
          state="done"
          text={quietSignal.line}
          escapeLabel="Dismiss"
          onNotThis={() =>
            void act(async () => {
              await diaDismiss(quietSignal.signal_key);
              await qc.invalidateQueries({ queryKey: SIGNALS_KEY(member.id) });
            })
          }
        />
      </div>,
    );
  if (catchingUp)
    items.push(
      <div
        key="sync"
        role="status"
        aria-live="polite"
        data-testid="catching-up"
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "var(--space-3) var(--space-4)",
        }}
      >
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
          Catching up on what arrived while you were away
        </span>
      </div>,
    );

  const composer = (
    <>
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile("image", e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          onFile("video", e.target.files);
          e.target.value = "";
        }}
      />
      {draft.media?.kind === "video" && (
        // H56-MOV: the measuring element. Attached, so the engine loads its metadata as it would
        // for a player on the page; invisible, inert and out of flow, so it shifts nothing.
        <video
          key={draft.media.url}
          src={draft.media.url}
          data-testid="video-measure"
          aria-hidden="true"
          tabIndex={-1}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => onMeasured(e.currentTarget.src, e.currentTarget)}
          onError={(e) => onMeasured(e.currentTarget.src, null)}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      )}
      <MessageComposer
        value={draft.text}
        onChange={onText}
        onSend={() => void sendNow()}
        c={c}
        quote={
          draft.quote
            ? {
                from: draft.quote.own ? "yourself" : (draft.quote.author_name ?? ""),
                text:
                  draft.quote.body ??
                  (draft.quote.kind === "voice"
                    ? "Voice note"
                    : draft.quote.kind === "media"
                      ? (draft.quote.media_word ?? "Media")
                      : ""),
              }
            : null
        }
        onRemoveQuote={() => patch({ quote: null })}
        editing={!!draft.editing}
        onRemoveEdit={() => patch({ editing: null, text: "" })}
        media={
          draft.media
            ? {
                kind: draft.media.kind,
                // G257: a video draft's tile carries the play glyph and no src. MediaBlock's video
                // kind draws its src in an <img>, and WebKit decodes a video handed to an <img>: on
                // runs 534 and 539 of the macOS gate the 9 KB fixture in that <img> held the main
                // thread past 30 s while the measuring <video> below, the arm's own probe of the
                // same blob in an identical element, loads its metadata every run. The same change
                // G250 made for the log.
                thumbnail:
                  draft.media.kind === "image" ? (
                    <MediaBlock kind="image" src={draft.media.url} alt="" ratio="1/1" />
                  ) : (
                    <MediaBlock kind="video" ratio="1/1" />
                  ),
              }
            : null
        }
        onRemoveMedia={() => {
          if (draft.media) URL.revokeObjectURL(draft.media.url);
          patch({ media: null, notice: false });
        }}
        voice={draft.voice ? { durationMs: draft.voice.durationMs } : null}
        onRemoveVoice={() => patch({ voice: null })}
        preview={
          previewsOn && draft.preview ? (
            <MediaBlock
              kind="link"
              src={draft.preview.url}
              domain={draft.preview.domain}
              title={draft.preview.title ?? undefined}
              items={draft.preview.image ? [draft.preview.image] : []}
            />
          ) : undefined
        }
        onRemovePreview={() => patch({ preview: null, previewRemoved: draft.preview?.url ?? null })}
        mentions={others}
        onMention={(m) =>
          setDraft((d) => ({ ...d, mentioned: [...d.mentioned.filter((x) => x.id !== m.id), m] }))
        }
        notice={draft.notice}
        onNoticeOk={noticeOk}
        error={draft.refusal ? REFUSAL_LINES[draft.refusal] : null}
        onErrorOk={() => patch({ refusal: null })}
        failed={!!draft.failed}
        onRetry={() => void sendNow()}
        limited={limited}
        input={mode}
        onAttach={attach}
        recording={recorder.elapsed}
        onRecordStart={startRecording}
        onRecordStop={stopRecording}
        onRecordCancel={recorder.cancel}
      />
    </>
  );

  const logNode = (
    <div
      ref={log}
      role="log"
      aria-label="Messages"
      data-testid="message-log"
      onScroll={(e) => {
        if (e.currentTarget.scrollTop < 80) loadOlder();
      }}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "var(--space-2) 0 var(--space-3)",
        overscrollBehavior: "contain",
      }}
    >
      {items}
    </div>
  );

  const strip = pinned ? (
    <PinnedStrip
      from={pinned.own ? "You" : firstName(pinned.author_name)}
      text={
        pinned.body ?? (pinned.kind === "voice" ? "Voice note" : (pinned.media_word ?? "Media"))
      }
      onOpen={() => {
        setFocused(pinned.message_id ?? null);
        const el = log.current?.querySelector<HTMLElement>(
          '[data-msg="' + pinned.message_id + '"]',
        );
        if (el && log.current) log.current.scrollTop = el.offsetTop - 72;
        window.setTimeout(() => setFocused(null), 2200);
      }}
    />
  ) : null;

  // Sheets (561, 584): one decision each.
  const close = () => setSheet(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const closeSheet = () => {
    setSheetError(null);
    close();
  };
  let sheetNode: ReactNode = null;
  const moreRow = more ? rows.find((r) => r.message_id === more) : undefined;
  if (more && moreRow && mode === "touch") {
    // 2.4: the full picker is a Sheet on touch, titled React, at the tier's geometry.
    sheetNode = (
      <Sheet
        open
        onClose={() => setMore(null)}
        variant={compact ? "sheet" : "drawer"}
        label="React"
        actions={
          <Button variant="secondary" onClick={() => setMore(null)}>
            Done
          </Button>
        }
      >
        {sheetHead("React", () => setMore(null))}
        <div style={{ ...SHEET_BODY, overflowY: "hidden" }} data-testid="react-sheet">
          {pickerFor(moreRow)}
        </div>
      </Sheet>
    );
  } else if (sheet?.kind === "info") {
    const r = sheet.row;
    const st = tickStatus(r.tick);
    const readBy = receipts && r.read_by ? joinNames(nameList(r.read_by), !!r.read_by_others) : "";
    const large = receipts && r.read_by === null && (r.tick ?? 0) >= 2 && group;
    sheetNode = (
      <Sheet
        open
        onClose={close}
        variant={compact ? "sheet" : "drawer"}
        label="Message info"
        actions={
          <Button variant="secondary" onClick={close}>
            Done
          </Button>
        }
      >
        {sheetHead("Message info", close)}
        <div style={SHEET_BODY} data-testid="message-info">
          <div
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-m)",
              background: "var(--c-" + c + "-tint)",
              fontSize: "var(--text-s)",
              lineHeight: "var(--text-s-lh)",
            }}
          >
            {r.body ?? (r.kind === "voice" ? "Voice note" : (r.media_word ?? "Media"))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--text-s)",
              }}
            >
              <Ticks status={st === "read" ? "acknowledged" : st} c={c} receipts={receipts} />
              {st === "stored" ? "Sent" : "Delivered"}
            </div>
            {readBy && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-s)",
                }}
              >
                <Ticks status="read" c={c} receipts />
                Read by {readBy}
              </div>
            )}
            {!receipts ? (
              <p style={QUIET}>Read receipts are off, so nothing here says who has read it.</p>
            ) : large ? (
              <p style={QUIET}>This group is large, so who has read it is not shown.</p>
            ) : null}
          </div>
        </div>
      </Sheet>
    );
  } else if (sheet?.kind === "report") {
    const r = sheet.row;
    const first = firstName(r.author_name);
    sheetNode = sheet.done ? (
      <Sheet
        open
        onClose={closeSheet}
        variant={compact ? "sheet" : "drawer"}
        label="Reported"
        actions={
          <Button variant="secondary" onClick={close}>
            Done
          </Button>
        }
      >
        {sheetHead("Reported", close)}
        <div style={SHEET_BODY} data-testid="report-done">
          <p style={QUIET}>
            Thank you. Someone will look at this one message and nothing else from the conversation.{" "}
            {first || "The member"} is not told.
          </p>
        </div>
      </Sheet>
    ) : (
      <Sheet
        open
        onClose={closeSheet}
        variant={compact ? "sheet" : "drawer"}
        label="Report this message"
        error={sheetError}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-destructive
              disabled={!sheet.reason || busy}
              onClick={() =>
                void act(
                  async () => {
                    await reportMessage(
                      r.message_id ?? "",
                      sheet.reason,
                      sheet.note.trim() || null,
                    );
                    setSheetError(null);
                    setSheet({ ...sheet, done: true });
                  },
                  undefined,
                  setSheetError,
                )
              }
              data-testid="report-submit"
            >
              Submit
            </Button>
          </>
        }
      >
        {sheetHead("Report this message", close)}
        <div style={SHEET_BODY} data-testid="report-sheet">
          <div
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-m)",
              background: "var(--bg-sunken)",
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              color: "var(--ink-2)",
            }}
          >
            <b style={{ fontWeight: 500 }}>{r.author_name}: </b>
            {r.body ?? (r.kind === "voice" ? "Voice note" : (r.media_word ?? "Media"))}
          </div>
          <Select
            label="Reason"
            options={[
              { value: "", label: "Choose one" },
              ...(vocab.data?.message_report_reasons ?? []).map((x) => ({
                value: x.value,
                label: x.label,
              })),
            ]}
            value={sheet.reason}
            onChange={(e) => setSheet({ ...sheet, reason: e.target.value })}
          />
          <Input
            label="Anything else, optional"
            value={sheet.note}
            onChange={(e) => setSheet({ ...sheet, note: (e.target as HTMLInputElement).value })}
          />
        </div>
      </Sheet>
    );
  } else if (sheet?.kind === "leave" && thread) {
    const name = thread.name ?? "";
    sheetNode = (
      <Sheet
        open
        onClose={closeSheet}
        variant={compact ? "sheet" : "drawer"}
        label={"Leave " + name + "?"}
        error={sheetError}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Stay
            </Button>
            <Button
              variant="danger"
              data-destructive
              disabled={busy}
              onClick={() =>
                void act(
                  async () => {
                    await leaveThread(threadId);
                    closeSheet();
                    await qc.invalidateQueries({ queryKey: THREADS_KEY(member.id) });
                    void navigate({ to: "/messages" });
                  },
                  "You left " + name + ". Nothing was written in the conversation.",
                  setSheetError,
                )
              }
              data-testid="leave-confirm"
            >
              Leave
            </Button>
          </>
        }
      >
        {sheetHead("Leave " + name + "?", close)}
        <div style={SHEET_BODY}>
          <p style={QUIET}>
            You stop receiving messages from this group. Leaving writes nothing in the conversation.
          </p>
        </div>
      </Sheet>
    );
  } else if (sheet?.kind === "manage" && thread) {
    sheetNode = (
      <ManageSheet
        member={member}
        thread={thread}
        roster={roster.data ?? []}
        compact={compact}
        busy={busy}
        onClose={close}
        onAct={act}
        onChanged={async () => {
          await qc.invalidateQueries({ queryKey: ROSTER_KEY(threadId) });
          await refreshThreadRow(qc, member.id, threadId);
          // 1591: a rename writes a system row; the log reads it here as well as from the channel.
          await qc.invalidateQueries({ queryKey: MESSAGES_KEY(threadId) });
        }}
      />
    );
  }

  const toastNode = toast && (
    <div style={toastStyle(tier)}>
      <Toast>{toast}</Toast>
    </div>
  );

  if (inPane)
    return (
      <div
        data-messenger-thread
        data-thread={threadId}
        data-upload-refusal={draft.refusal ?? undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          background: "var(--bg)",
          fontFamily: "var(--font-sans)",
          color: "var(--ink)",
        }}
      >
        <div
          data-thread-header
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) 56px var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg)",
          }}
        >
          {mark}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 1 }}>
            <span
              style={{
                fontSize: "var(--text-m)",
                fontWeight: 500,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {thread?.name ?? ""}
            </span>
            {subtitle && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--ink-3)",
                  lineHeight: 1.35,
                  textWrap: "pretty",
                }}
              >
                {subtitle}
              </span>
            )}
          </div>
          {control}
        </div>
        {strip}
        {logNode}
        {!invited && composer}
        {sheetNode}
        {toastNode}
      </div>
    );

  return (
    <>
      <Pane
        tier={tier}
        title={thread?.name ?? "Conversation"}
        onBack={() => void navigate({ to: "/messages" })}
        backLabel="Back to Messages"
        avatar={mark}
        subtitle={subtitle || undefined}
        control={control}
        // Ruling 1624 (W92): with no app header below expanded, the thread bar is the route's only
        // chrome at the top and carries the inset the header carried until now (344); with the
        // keyboard up the frame is the visual viewport, whose top is still under the status bar.
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          paddingTop: "env(safe-area-inset-top)",
          boxSizing: "border-box",
          ...keyboardFrame,
        }}
      >
        <div
          data-messenger-thread
          data-keyboard-frame={keyboardFrame ? "" : undefined}
          data-thread={threadId}
          data-upload-refusal={draft.refusal ?? undefined}
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            background: "var(--bg)",
          }}
        >
          {strip}
          {logNode}
          {!invited && (
            <div
              style={{
                flex: "none",
                // On the keyboard there is no home indicator under the composer to clear.
                paddingBottom: keyboardFrame ? 0 : "env(safe-area-inset-bottom)",
                background: "var(--bg)",
              }}
            >
              {composer}
            </div>
          )}
        </div>
      </Pane>
      {sheetNode}
      {toastNode}
    </>
  );
}

function ManageSheet({
  member,
  thread,
  roster,
  compact,
  busy,
  onClose,
  onAct,
  onChanged,
}: {
  member: Member;
  thread: ThreadView;
  roster: RosterMember[];
  compact: boolean;
  busy: boolean;
  onClose: () => void;
  onAct: (
    fn: () => Promise<unknown>,
    done?: string,
    onFail?: (line: string) => void,
  ) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const threadId = thread.thread_id ?? "";
  // SPEC-41-E 4, 7: a refusal inside the sheet reads in the Sheet's own error line, not the toast.
  const [error, setError] = useState<string | null>(null);
  const network = useQuery({ queryKey: ["connect", "network", member.id], queryFn: loadNetwork });
  const blocks = useQuery({
    queryKey: ["blocks", member.id],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return [] as string[];
      const { data } = await sb
        .from("member_blocks")
        .select("blocked_id")
        .eq("blocker_id", member.id);
      return (data ?? []).map((b) => b.blocked_id);
    },
  });
  const blocked = new Set(blocks.data ?? []);
  const active = roster.filter((r) => r.state === "active" && r.id !== member.id);
  const invitedRows = roster.filter((r) => r.state === "invited");
  const inThread = new Set(
    roster.filter((r) => r.state === "active" || r.state === "invited").map((r) => r.id),
  );
  const connections = (network.data?.connections ?? []).filter(
    (c) => !inThread.has(c.id) && !blocked.has(c.id),
  );
  const row = (name: string, note: string | null, ctl: ReactNode, key: string) => (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        minHeight: "var(--target-primary)",
      }}
    >
      <Avatar name={name} size={32} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "var(--text-s)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
        {note && <span style={{ color: "var(--ink-3)" }}>, {note}</span>}
      </span>
      {ctl}
    </div>
  );
  const name = thread.name ?? "";
  const [rename, setRename] = useState(name);
  const renameTo = rename.trim();
  const renameOk = renameTo.length >= 1 && renameTo.length <= 80 && renameTo !== name;
  return (
    <Sheet
      open
      onClose={onClose}
      variant={compact ? "sheet" : "drawer"}
      label={"Manage " + name}
      error={error}
      actions={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {sheetHead("Manage " + name, onClose)}
      <div style={SHEET_BODY} data-testid="manage-sheet">
        {thread.kind === "community_group" && (
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}
            data-testid="rename"
          >
            <Input
              label="Name"
              value={rename}
              onChange={(e) => setRename((e.target as HTMLInputElement).value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button
              variant="secondary"
              disabled={busy || !renameOk}
              onClick={() =>
                void onAct(
                  async () => {
                    await threadRename(threadId, renameTo);
                    setError(null);
                    await onChanged();
                  },
                  "Renamed.",
                  setError,
                )
              }
            >
              Rename
            </Button>
          </div>
        )}
        <Switch
          style={{ display: "flex" }}
          label="History for new members. Off: a member who joins sees messages from then on."
          checked={!!thread.history_visible_to_new}
          disabled={busy}
          onChange={(v) =>
            void onAct(async () => {
              await setHistory(threadId, v);
              await onChanged();
            })
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={CAPS}>Members</span>
          {row(member.name, thread.role === "co_lead" ? "you, co-lead" : "you, lead", null, "me")}
          {active.map((r) =>
            row(
              r.name,
              blocked.has(r.id)
                ? "blocked by you"
                : r.role === "lead"
                  ? "lead"
                  : r.role === "co_lead"
                    ? "co-lead"
                    : null,
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onAct(
                    async () => {
                      await removeMember(threadId, r.id);
                      await onChanged();
                    },
                    firstName(r.name) + " was removed.",
                  )
                }
              >
                Remove
              </Button>,
              r.id,
            ),
          )}
          {invitedRows.map((r) =>
            row(
              r.name,
              "invited",
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onAct(async () => {
                    await removeMember(threadId, r.id);
                    await onChanged();
                  })
                }
              >
                Withdraw
              </Button>,
              r.id,
            ),
          )}
        </div>
        {connections.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={CAPS}>Invite from your connections</span>
            {connections.map((cx) =>
              row(
                cx.name,
                null,
                <Button
                  variant="secondary"
                  size="sm"
                  c="connect"
                  disabled={busy}
                  onClick={() =>
                    void onAct(
                      async () => {
                        await inviteMember(threadId, cx.id);
                        setError(null);
                        await onChanged();
                      },
                      firstName(cx.name) + " is invited and shows as invited until they accept.",
                      setError,
                    )
                  }
                >
                  Invite
                </Button>,
                cx.id,
              ),
            )}
          </div>
        )}
        <p style={QUIET}>Pin a message from its own menu. Only one message is pinned at a time.</p>
      </div>
    </Sheet>
  );
}
