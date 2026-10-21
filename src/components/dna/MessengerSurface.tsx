// Brief 14, handoff 41-C, SPEC 41-14 Part C items 1, 3, 5 and 6: the list at /messages (extraction
// 41-14 sections 1.3, 1.4, 1.9, 1.10 and 2). At expanded it hosts the Pane beside the list column
// at --pane-list-width with the selected row ringed (1047, 1023); below expanded it is the list
// alone with the shell's dock (1368). Reads: messenger_threads_view, messenger_requests_view,
// messenger_search, messenger_dia_signals and messenger_settings through src/lib/messenger.ts and
// the inbox cache in src/lib/messenger-inbox.ts; the vocabularies through src/lib/vocabularies.ts.
// Writes: the wrappers alone. Every label is the extraction's, with the SPEC's overrides 1 (the
// pin cap toast, 1371), 2 (DIA dismissals through messenger_dia_dismiss, 1373) and 3 (native date
// inputs on Input's tokens, 1373). No count anywhere: the dot, names, words. SPEC-41-E adds Start a
// group (section 6, rulings 1579 to 1581): the plus beside Mark all read, the sheet naming the group
// and picking members from the member's connections, the picked members invited and never joined,
// and the landing on the new thread; and the alert line under the title row where pin, accept,
// decline and block read their refusal (section 4, 1582: the fourth pin reads pins_full there).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { Checkbox } from "@/components/strand/Checkbox";
import { DiaLine } from "@/components/strand/DiaLine";
import { EmptyState } from "@/components/strand/EmptyState";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import type { MenuItem, MenuRule } from "@/components/strand/Menu";
import { Pane } from "@/components/strand/Pane";
import { RequestCard } from "@/components/strand/RequestCard";
import { SearchResultRow } from "@/components/strand/SearchResultRow";
import { Segment } from "@/components/strand/Segment";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { ThreadRow } from "@/components/strand/ThreadRow";
import { Toast } from "@/components/strand/Toast";
import { toastStyle } from "@/components/dna/FeedSurface";
import type { Member } from "@/lib/auth";
import { loadNetwork } from "@/lib/connect";
import {
  archive,
  clockLabel,
  createGroup,
  dayLabel,
  diaDismiss,
  FALLBACK_LINES,
  flushCursors,
  lastLineOf,
  loadDiaSignals,
  localDayStart,
  localNextDayStart,
  markUnread,
  MessengerError,
  mute,
  pinThread,
  readTo,
  REFUSAL_LINES,
  refusalOf,
  requestAccept,
  requestRecover,
  requestBlock,
  requestDecline,
  rowKind,
  searchMessages,
  timeWords,
  unarchive,
  unpinThread,
  type MessageView,
  type RefusalWord,
  type RequestView,
  type ThreadView,
} from "@/lib/messenger";
import {
  refreshThreadRow,
  REQUESTS_KEY,
  SETTINGS_KEY,
  SIGNALS_KEY,
  THREADS_KEY,
  useMessagingSettings,
  useRequests,
  useThreads,
} from "@/lib/messenger-inbox";
import { useAvatarUrl } from "@/lib/messenger-media";
import { settingsSet } from "@/lib/messenger";
import { firstName, joinNames, nameList } from "@/lib/names";
import { record } from "@/lib/record";
import { useEmptyStateSeen, useRecordWhen } from "@/lib/record-hooks";
import { clearShellLayout, setShellLayout } from "@/lib/rail-store";
import { getSupabase } from "@/lib/supabase";
import { useMode, useTier } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";

/**
 * True for the thread rendered as this surface's Pane content at expanded (1047). The thread reads
 * it rather than the tier, because the tier hook answers compact on its first render at every
 * width and the tree, not the width, is what decides where the thread is mounted.
 */
export const MessengerPaneContext = createContext(false);

const CAPS = {
  fontSize: "var(--text-xs)",
  lineHeight: "var(--text-xs-lh)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase" as const,
  fontWeight: "var(--weight-medium)" as unknown as number,
  color: "var(--ink-3)",
};

const QUIET = {
  margin: 0,
  fontSize: "var(--text-s)",
  lineHeight: "var(--text-s-lh)",
  color: "var(--ink-3)",
  textWrap: "pretty" as const,
};

function TextButton({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick: () => void;
  testId?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{
        all: "unset",
        cursor: "pointer",
        minHeight: "var(--target-primary)",
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--text-s)",
        fontWeight: "var(--weight-medium)" as unknown as number,
        color: "var(--ink)",
        textDecoration: "underline",
        textDecorationColor: "var(--line-strong)",
        textUnderlineOffset: 2,
        fontFamily: "var(--font-sans)",
      }}
    >
      {label}
    </button>
  );
}

/** SPEC-41-E 4: the refusal line under the list's title row, --error on --error-tint, with an OK control. */
function AlertStrip({ text, onOk }: { text: string; onOk: () => void }) {
  return (
    <div
      role="alert"
      data-list-alert
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        margin: "0 var(--space-4)",
        padding: "var(--space-1) var(--space-1) var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-m)",
        background: "var(--error-tint)",
        fontSize: "var(--text-xs)",
        lineHeight: "var(--text-xs-lh)",
        color: "var(--error)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, textWrap: "pretty" }}>{text}</span>
      <button
        type="button"
        onClick={onOk}
        style={{
          all: "unset",
          cursor: "pointer",
          minHeight: "var(--target-min)",
          padding: "0 var(--space-2)",
          display: "inline-flex",
          alignItems: "center",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-medium)" as unknown as number,
          color: "var(--error)",
          fontFamily: "var(--font-sans)",
        }}
      >
        OK
      </button>
    </div>
  );
}

/** SPEC-41-E 6.3: the six words the create function raises; any other reads the create fallback (1581). */
const CREATE_WORDS: readonly RefusalWord[] = [
  "not_signed_in",
  "bad_name",
  "no_members",
  "group_full",
  "bad_member",
  "not_your_connection",
];

/**
 * SPEC-41-E 6.2 to 6.4 (1579 to 1581, 1592): the Start a group sheet. The connections come from
 * the same `loadNetwork` read and blocks filter Manage's invite list uses; blocked members and
 * non-connections are not listed. The picked are invited, never joined; Created lands on the thread.
 */
function StartGroupSheet({
  member,
  compact,
  onClose,
  onCreated,
}: {
  member: Member;
  compact: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
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
  const connections = (network.data?.connections ?? []).filter((c) => !blocked.has(c.id));
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const start = () => {
    const trimmed = name.trim();
    const ne = trimmed ? null : REFUSAL_LINES.bad_name;
    const me = picked.length ? null : REFUSAL_LINES.no_members;
    setNameError(ne);
    setMembersError(me);
    if (ne || me) return;
    setSaving(true);
    setError(null);
    createGroup(trimmed, picked)
      .then((id) => onCreated(id))
      .catch((e) => {
        const err = e instanceof MessengerError ? e : refusalOf(e, FALLBACK_LINES.create);
        setError(err.word && CREATE_WORDS.includes(err.word) ? err.line : FALLBACK_LINES.create);
        setSaving(false);
      });
  };
  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setMembersError(null);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      variant={compact ? "sheet" : "drawer"}
      label="Start a group"
      error={error}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button c="connect" disabled={saving} onClick={start} data-testid="start-group">
            Start the group
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 56,
          padding: "0 8px 0 20px",
          borderBottom: "1px solid var(--line)",
          flex: "none",
        }}
      >
        <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700 }}>
          Start a group
        </h2>
        <IconButton name="x" label="Close" onClick={onClose} />
      </div>
      <div
        data-testid="start-group-sheet"
        aria-busy={saving || undefined}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <Input
          label="Name"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName((e.target as HTMLInputElement).value);
            setNameError(null);
          }}
          error={nameError ?? undefined}
          data-testid="group-name"
        />
        <div
          role="group"
          aria-label="Members"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
        >
          <span style={CAPS}>Members, from your connections</span>
          {connections.map((cx) => (
            <div
              key={cx.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                minHeight: "var(--target-primary)",
              }}
            >
              <Avatar name={cx.name} src={cx.avatarUrl} size={32} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "var(--text-s)" }}>{cx.name}</span>
                {cx.headline && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
                    {cx.headline}
                  </span>
                )}
              </span>
              <Checkbox
                label={"Add " + firstName(cx.name)}
                checked={picked.includes(cx.id)}
                onChange={() => toggle(cx.id)}
                style={{ flex: "none" }}
              />
            </div>
          ))}
          {membersError && (
            <span
              role="alert"
              data-members-error
              style={{ fontSize: "var(--text-xs)", color: "var(--error)" }}
            >
              {membersError}
            </span>
          )}
        </div>
        {saving && (
          <p role="status" style={{ ...QUIET, fontSize: "var(--text-xs)" }}>
            Starting
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** The native date input on Input's tokens (override 3, 1373): Strand has no date field yet. */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 140px", minWidth: 0 }}
    >
      <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        aria-label={label}
        data-search-date={label.toLowerCase()}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans)",
          fontSize: 17,
          color: "var(--ink)",
          background: focus ? "var(--surface)" : "var(--bg-sunken)",
          border: "1px solid " + (focus ? "var(--ink)" : "var(--line)"),
          borderRadius: "var(--radius-m)",
          padding: "0 14px",
          minHeight: 44,
          outline: "none",
          transition: "border-color var(--dur-default) var(--ease)",
        }}
      />
    </label>
  );
}

function ThreadRowView({
  t,
  me,
  selected,
  href,
  onOpen,
  onIntent,
  items,
}: {
  t: ThreadView;
  me: Member;
  selected: boolean;
  href: string;
  onOpen: () => void;
  onIntent: () => void;
  items: (MenuItem | MenuRule | false | null | undefined)[];
}) {
  const mode = useMode();
  const src = useAvatarUrl(t.avatar_path, 44);
  return (
    <ThreadRow
      name={t.name ?? ""}
      kind={rowKind(t.kind)}
      src={src}
      lastLine={lastLineOf(t, me.id)}
      time={timeWords(t.last_activity_at ?? t.created_at)}
      unread={!!t.unread}
      muted={!!t.muted}
      pinned={!!t.pinned}
      selected={selected}
      archived={!!t.archived}
      input={mode}
      href={href}
      onOpen={onOpen}
      onIntent={onIntent}
      items={items}
    />
  );
}

function RequestCardView({
  r,
  busy,
  declined,
  onAct,
}: {
  r: RequestView;
  busy: boolean;
  declined: boolean;
  onAct: (kind: "accept" | "decline" | "block" | "recover") => void;
}) {
  const src = useAvatarUrl(r.sender_avatar_path, 44);
  return (
    <RequestCard
      name={r.sender_name ?? ""}
      src={src}
      headline={r.sender_headline}
      stance={r.sender_stance}
      text={r.body ?? ""}
      mutuals={joinNames(nameList(r.mutual_names), !!r.mutual_others)}
      shared={joinNames(nameList(r.shared_space_names), !!r.shared_space_others)}
      declined={declined}
      busy={busy}
      onAccept={() => onAct("accept")}
      onDecline={() => onAct("decline")}
      onBlock={() => onAct("block")}
      onRecover={() => onAct("recover")}
    />
  );
}

export function MessengerSurface({
  member,
  threadId,
  pane,
}: {
  member: Member;
  /** The open thread, at expanded: the Pane's content is `pane`. */
  threadId: string | null;
  pane: ReactNode;
}) {
  const tier = useTier();
  const expanded = tier === "expanded";
  const compact = tier === "compact";
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const threads = useThreads(member);
  const requests = useRequests(member);
  const settings = useMessagingSettings(member);
  const signals = useQuery({ queryKey: SIGNALS_KEY(member.id), queryFn: loadDiaSignals });
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const say = (t: string) => {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [showDeclined, setShowDeclined] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [withMember, setWithMember] = useState("");
  const [inThread, setInThread] = useState("");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [during, setDuring] = useState("");
  const [receiptChoice, setReceiptChoice] = useState<"on" | "off">("off");
  const [receiptsSaving, setReceiptsSaving] = useState(false);
  // SPEC-41-E 4: pin, accept, decline and block read their refusal in a line under the title row.
  const [alert, setAlert] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);

  // 1047, 612: at expanded the surface is the canvas, no rails, bounded, the Pane beside the list.
  useEffect(() => {
    if (!expanded) return;
    setShellLayout({ mode: "canvas", key: "messages", maxWidth: 1120 });
    return () => clearShellLayout("messages");
  }, [expanded]);
  useEffect(() => () => flushCursors(), []);

  const all = useMemo(() => threads.data ?? [], [threads.data]);
  const live = useMemo(() => all.filter((t) => !t.archived), [all]);
  const archived = useMemo(() => all.filter((t) => !!t.archived), [all]);
  const pending = useMemo(
    () => (requests.data ?? []).filter((r) => r.state === "pending"),
    [requests.data],
  );
  const declined = useMemo(
    () => (requests.data ?? []).filter((r) => r.state === "declined"),
    [requests.data],
  );
  const anyUnreadLive = live.some((t) => !!t.unread);
  const mutes = vocab.data?.message_mute_durations ?? [];
  const requestSignal = (signals.data ?? []).find((s) => s.request_id);
  // 12C part 2: DIA's request signal, shown once per appearance; acted when the member answers the
  // request it names (onRequest below). And the two empty states, once each per appearance.
  useRecordWhen("dia_suggestion_shown", !!requestSignal, { suggestion_kind: "messenger_request" });
  useEmptyStateSeen(
    "messenger.no_conversations",
    threads.isSuccess && !all.length && !pending.length && !declined.length,
  );
  useEmptyStateSeen("messenger.no_thread_open", expanded && !threadId);

  const refreshRow = async (id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb
      .from("messenger_threads_view")
      .select("*")
      .eq("thread_id", id)
      .maybeSingle();
    qc.setQueryData<ThreadView[]>(THREADS_KEY(member.id), (prev) => {
      const list = (prev ?? []).filter((t) => t.thread_id !== id);
      return data ? [data, ...list] : list;
    });
  };
  const act = async (id: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(id);
    try {
      await fn();
      if (done) say(done);
    } catch (e) {
      const err = e instanceof MessengerError ? e : refusalOf(e);
      setAlert(err.line);
    } finally {
      setBusy(null);
    }
  };
  const threadPath = (id: string) =>
    router.buildLocation({ to: "/messages/$thread", params: { thread: id } }).href;
  const openThread = (id: string) =>
    void navigate({ to: "/messages/$thread", params: { thread: id } });
  const warm = (id: string) =>
    void router.preloadRoute({ to: "/messages/$thread", params: { thread: id } });

  const rowItems = (t: ThreadView): (MenuItem | MenuRule | false | null | undefined)[] => {
    const id = t.thread_id ?? "";
    const touch = () => refreshRow(id);
    const muteItems: (MenuItem | MenuRule)[] = t.muted
      ? [
          {
            id: "unmute",
            label: "Unmute",
            onSelect: () => void act(id, () => mute(id, null).then(touch)),
          },
        ]
      : mutes.map((m) => ({
          id: "mute:" + m.value,
          label: m.value === "always" ? "Mute always" : "Mute for " + m.label,
          onSelect: () => void act(id, () => mute(id, m.value).then(touch)),
        }));
    return [
      {
        id: "pin",
        label: t.pinned ? "Unpin" : "Pin",
        icon: "pin",
        onSelect: () =>
          void act(id, () => (t.pinned ? unpinThread(id) : pinThread(id)).then(touch)),
      },
      {
        id: "unread",
        label: t.unread ? "Mark as read" : "Mark as unread",
        onSelect: () =>
          void act(id, async () => {
            if (t.unread) {
              readTo(id, t.last_seq ?? 0);
              flushCursors(id);
            } else await markUnread(id);
            await touch();
          }),
      },
      { rule: true },
      ...muteItems,
      { rule: true },
      {
        id: "archive",
        label: t.archived ? "Unarchive" : "Archive",
        icon: "archive",
        onSelect: () =>
          void act(id, async () => {
            await (t.archived ? unarchive(id) : archive(id));
            await touch();
            if (!t.archived && threadId === id) void navigate({ to: "/messages" });
          }),
      },
    ];
  };

  const onRequest = (r: RequestView, kind: "accept" | "decline" | "block" | "recover") => {
    const id = r.request_id ?? "";
    const first = firstName(r.sender_name);
    // 12C part 2: answering the request DIA's signal names is acting on the signal.
    if ((kind === "accept" || kind === "decline") && requestSignal?.request_id === id)
      record("dia_suggestion_acted", { suggestion_kind: "messenger_request" });
    void act(id, async () => {
      if (kind === "accept") {
        const thread = await requestAccept(id);
        await qc.invalidateQueries({ queryKey: REQUESTS_KEY(member.id) });
        if (thread) {
          await refreshRow(thread);
          say("Accepted. You can reply now.");
          openThread(thread);
        }
        return;
      }
      if (kind === "decline") {
        await requestDecline(id);
        say("Declined. It is kept under Declined if you change your mind.");
      } else if (kind === "block") {
        await requestBlock(id);
        say("Blocked. " + first + " cannot message you.");
      } else {
        await requestRecover(id);
        say("Back in Requests.");
      }
      await qc.invalidateQueries({ queryKey: REQUESTS_KEY(member.id) });
      await qc.invalidateQueries({ queryKey: SIGNALS_KEY(member.id) });
    });
  };

  const markAllRead = () =>
    void act("all", async () => {
      for (const t of live) if (t.unread && t.thread_id) readTo(t.thread_id, t.last_seq ?? 0);
      flushCursors();
      await new Promise((r) => setTimeout(r, 400));
      await qc.invalidateQueries({ queryKey: THREADS_KEY(member.id) });
    });

  const dismiss = (key: string) =>
    void act(key, async () => {
      await diaDismiss(key);
      await qc.invalidateQueries({ queryKey: SIGNALS_KEY(member.id) });
    });

  // Search (1338, 1347): phrase, with, in thread, before, after, during; results open at the match.
  const searching = !!(q.trim() || withMember || inThread || before || after || during);
  const filters = useMemo(() => {
    const f: { member?: string; thread?: string; before?: string; after?: string } = {};
    if (withMember) f.member = withMember;
    if (inThread) f.thread = inThread;
    if (during) {
      const a = localDayStart(during);
      const b = localNextDayStart(during);
      if (a) f.after = a;
      if (b) f.before = b;
    } else {
      if (before) {
        const b = localDayStart(before);
        if (b) f.before = b;
      }
      if (after) {
        const a = localDayStart(after);
        if (a) f.after = a;
      }
    }
    return f;
  }, [withMember, inThread, before, after, during]);
  const results = useQuery({
    queryKey: ["messenger", "search", member.id, q.trim(), filters],
    queryFn: async () => {
      const hits = await searchMessages(q.trim(), filters);
      const ids = hits.map((h) => h.message_id);
      const sb = getSupabase();
      let rows: MessageView[] = [];
      if (sb && ids.length) {
        const { data } = await sb.from("messenger_messages_view").select("*").in("message_id", ids);
        rows = data ?? [];
      }
      const byId = new Map(rows.map((r) => [r.message_id ?? "", r]));
      return hits.map((h) => ({ hit: h, row: byId.get(h.message_id) ?? null }));
    },
    enabled: searching && !!q.trim(),
  });
  const threadName = (id: string | null) => all.find((t) => t.thread_id === id)?.name ?? "";
  const withOptions = live
    .filter((t) => t.kind === "one_to_one" && t.other_member_id)
    .map((t) => ({ value: t.other_member_id as string, label: t.name ?? "" }));

  const head = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-2)",
        padding: "0 var(--space-2) 0 var(--space-4)",
        minHeight: "var(--target-primary)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontWeight: "var(--weight-bold)" as unknown as number,
          fontSize: "var(--display-m)",
          lineHeight: "var(--display-m-lh)",
        }}
      >
        Messages
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
        {threads.data && anyUnreadLive && (
          <Button variant="secondary" size="sm" onClick={markAllRead} data-testid="mark-all-read">
            Mark all read
          </Button>
        )}
        {threads.data && (
          <IconButton
            name="plus"
            label="Start a group"
            onClick={() => setGroupOpen(true)}
            data-testid="start-group-open"
          />
        )}
      </div>
    </div>
  );
  const alertNode = alert ? <AlertStrip text={alert} onOk={() => setAlert(null)} /> : null;

  const searchBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "0 var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}>
        <Input
          icon="search"
          placeholder="Search messages"
          value={q}
          onChange={(e) => setQ((e.target as HTMLInputElement).value)}
          style={{ flex: 1, minWidth: 0 }}
          data-testid="message-search"
        />
        <IconButton
          name="sliders-horizontal"
          label={filtersOpen ? "Hide filters" : "Filters"}
          active={filtersOpen}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
          data-testid="search-filters"
        />
      </div>
      {filtersOpen && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <Select
            label="With"
            options={[{ value: "", label: "Any" }, ...withOptions]}
            value={withMember}
            onChange={(e) => setWithMember(e.target.value)}
            style={{ flex: "1 1 140px", minWidth: 0 }}
          />
          <Select
            label="In thread"
            options={[
              { value: "", label: "Any" },
              ...live.map((t) => ({ value: t.thread_id ?? "", label: t.name ?? "" })),
            ]}
            value={inThread}
            onChange={(e) => setInThread(e.target.value)}
            style={{ flex: "1 1 140px", minWidth: 0 }}
          />
          <DateField label="Before" value={before} onChange={setBefore} />
          <DateField label="After" value={after} onChange={setAfter} />
          <DateField label="During" value={during} onChange={setDuring} />
        </div>
      )}
    </div>
  );

  const resultsNode = (() => {
    const hits = results.data ?? [];
    if (!q.trim())
      return (
        <div style={{ padding: "var(--space-6) var(--space-4)" }}>
          <p style={QUIET}>No messages match. Change the words or widen the dates.</p>
        </div>
      );
    if (results.isPending)
      return (
        <div
          role="status"
          aria-label="Searching"
          style={{ padding: "var(--space-6) var(--space-4)" }}
        />
      );
    if (!hits.length)
      return (
        <div style={{ padding: "var(--space-6) var(--space-4)" }}>
          <p style={QUIET} data-testid="no-results">
            No messages match. Change the words or widen the dates.
          </p>
        </div>
      );
    return (
      <div role="list" aria-label="Results" style={{ display: "flex", flexDirection: "column" }}>
        {hits.map(({ hit, row }) => (
          <SearchResultRow
            key={hit.message_id}
            thread={threadName(hit.thread_id)}
            from={row?.own ? member.name : (row?.author_name ?? "")}
            day={dayLabel(hit.created_at)}
            time={clockLabel(hit.created_at)}
            text={row?.body ?? hit.headline.replace(/<\/?b>/g, "")}
            onOpen={() =>
              void navigate({
                to: "/messages/$thread",
                params: { thread: hit.thread_id },
                state: { focusSeq: hit.seq } as never,
              })
            }
          />
        ))}
      </div>
    );
  })();

  const requestsNode =
    pending.length || declined.length ? (
      <section
        aria-label="Requests"
        data-testid="requests"
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        {pending.length > 0 && (
          <div style={{ padding: "0 var(--space-4)" }}>
            <span style={CAPS}>Requests</span>
          </div>
        )}
        {requestSignal && (
          <div style={{ padding: "0 var(--space-4)" }}>
            <DiaLine
              state="done"
              text={requestSignal.line}
              escapeLabel="Dismiss"
              onNotThis={() => dismiss(requestSignal.signal_key)}
            />
          </div>
        )}
        {pending.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              padding: "0 var(--space-4)",
            }}
          >
            {pending.map((r) => (
              <RequestCardView
                key={r.request_id}
                r={r}
                busy={busy === r.request_id}
                declined={false}
                onAct={(k) => onRequest(r, k)}
              />
            ))}
          </div>
        )}
        {declined.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              padding: "0 var(--space-4)",
            }}
          >
            <TextButton
              label={showDeclined ? "Hide declined" : "Declined"}
              onClick={() => setShowDeclined((v) => !v)}
              testId="declined-toggle"
            />
            {showDeclined && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {declined.map((r) => (
                  <RequestCardView
                    key={r.request_id}
                    r={r}
                    busy={busy === r.request_id}
                    declined
                    onAct={(k) => onRequest(r, k)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    ) : null;

  const rows = (list: ThreadView[]) =>
    list.map((t) => (
      <ThreadRowView
        key={t.thread_id}
        t={t}
        me={member}
        selected={expanded && threadId === t.thread_id}
        href={threadPath(t.thread_id ?? "")}
        onOpen={() => openThread(t.thread_id ?? "")}
        onIntent={() => warm(t.thread_id ?? "")}
        items={rowItems(t)}
      />
    ));

  const listNode = (
    <div
      role="list"
      aria-label="Conversations"
      data-testid="thread-list"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: expanded ? "0 var(--space-1)" : 0,
      }}
    >
      {rows(live)}
    </div>
  );

  const archivedNode =
    archived.length > 0 ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: "0 var(--space-4)",
        }}
      >
        <TextButton
          label={showArchived ? "Hide archived" : "Archived"}
          onClick={() => setShowArchived((v) => !v)}
          testId="archived-toggle"
        />
        {showArchived && (
          <div
            role="list"
            aria-label="Archived"
            style={{
              display: "flex",
              flexDirection: "column",
              margin: "0 calc(-1 * var(--space-4))",
            }}
          >
            {rows(archived)}
          </div>
        )}
        {showArchived && (
          <p style={{ ...QUIET, fontSize: "var(--text-xs)" }}>
            An archived conversation comes back to the list when a new message arrives.
          </p>
        )}
      </div>
    ) : null;

  let body: ReactNode;
  if (threads.isPending)
    body = (
      <div
        role="status"
        aria-label="Loading your conversations"
        data-testid="threads-loading"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          padding: "0 var(--space-4)",
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: "block",
              height: 56,
              borderRadius: "var(--radius-m)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          />
        ))}
      </div>
    );
  else if (threads.isError)
    body = (
      <div
        role="alert"
        data-testid="threads-error"
        style={{
          margin: "0 var(--space-4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          padding: "var(--space-5)",
          borderRadius: "var(--radius-l)",
          background: "var(--surface)",
          border: "1px solid var(--error)",
        }}
      >
        <span style={{ fontSize: "var(--text-m)", fontWeight: 700 }}>
          Your conversations could not load.
        </span>
        <p style={QUIET}>Check your connection and try again.</p>
        <Button variant="secondary" size="sm" onClick={() => void threads.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (!all.length && !pending.length && !declined.length)
    body = (
      <div
        style={{
          padding: "0 var(--space-4)",
          display: "flex",
          minHeight: expanded ? "100%" : "var(--_shell-visible, 420px)",
        }}
      >
        <EmptyState
          c="brand"
          pattern="kente"
          title="No conversations yet."
          body="Message a connection from their profile or card, a Space you belong to, an event you are attending, or the host of that event. The thread starts here."
        />
      </div>
    );
  else
    body = (
      <>
        {expanded && searchBlock}
        {searching ? (
          resultsNode
        ) : (
          <>
            {requestsNode}
            {listNode}
            {archivedNode}
          </>
        )}
      </>
    );
  const hasSearch =
    !threads.isPending && !threads.isError && !!(all.length || pending.length || declined.length);

  // Ruling 1624 (W92; EXTRACTION-44-W68 section 5): below expanded the list carries no app header,
  // so its title row and search unit are one block that paints the top inset itself and stays while
  // the body scrolls, with a hairline under it. Loading, empty and error keep the title row and drop
  // the search unit. At expanded the list is the Pane's and nothing here changes.
  const chrome = expanded ? (
    <>
      {head}
      {alertNode}
    </>
  ) : (
    <div
      data-list-chrome
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--z-sticky)" as unknown as number,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        paddingTop: compact
          ? "env(safe-area-inset-top)"
          : "calc(var(--space-3) + env(safe-area-inset-top))",
        paddingBottom: "var(--space-3)",
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {head}
      {alertNode}
      {hasSearch && searchBlock}
    </div>
  );

  const column = (
    <div
      data-messenger-list
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        paddingBottom: "var(--space-6)",
        // Below expanded the shell's main pads 12/16 (compact) or 24/32 (medium); the list's rows
        // run to the edges as the prototype draws them, with their own 16 inside, and under 1624 the
        // chrome runs to the top as well, so the inset is the list's own.
        margin: expanded ? 0 : compact ? "-12px -16px 0" : "-24px -32px 0",
        minHeight: expanded ? "100%" : undefined,
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
      }}
    >
      {chrome}
      {body}
    </div>
  );

  // SPEC-41-E 6: the sheet, and the landing on the new thread with its row in the list cache.
  const groupSheet = groupOpen && (
    <StartGroupSheet
      member={member}
      compact={compact}
      onClose={() => setGroupOpen(false)}
      onCreated={(id) => {
        setGroupOpen(false);
        void refreshThreadRow(qc, member.id, id);
        openThread(id);
      }}
    />
  );

  // First open (1345, 1346): the receipts choice, once, not dismissable.
  const receiptsSheet = settings.data && settings.data.receipts_chosen_at === null && (
    <Sheet
      open
      variant={compact ? "sheet" : "drawer"}
      label="Read receipts"
      actions={
        <Button
          c="connect"
          disabled={receiptsSaving}
          onClick={() => {
            setReceiptsSaving(true);
            void settingsSet({ receipts: receiptChoice === "on" })
              .then((row) => qc.setQueryData(SETTINGS_KEY(member.id), row))
              .catch((e) => say(refusalOf(e).line))
              .finally(() => setReceiptsSaving(false));
          }}
          data-testid="receipts-continue"
        >
          Continue
        </Button>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 56,
          padding: "0 20px",
          borderBottom: "1px solid var(--line)",
          flex: "none",
        }}
      >
        <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700 }}>
          Read receipts
        </h2>
      </div>
      <div
        data-testid="receipts-sheet"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-m)",
            lineHeight: "var(--text-m-lh)",
            textWrap: "pretty",
          }}
        >
          Show when you have read a message, and see when others have read yours?
        </p>
        <Segment
          label="Read receipts"
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          value={receiptChoice}
          onChange={(v) => setReceiptChoice(v === "on" ? "on" : "off")}
        />
        <p style={QUIET}>You are asked once. Change it any time in your account.</p>
      </div>
    </Sheet>
  );

  const toastNode = toast && (
    <div style={toastStyle(tier)}>
      <Toast>{toast}</Toast>
    </div>
  );

  if (!expanded)
    return (
      <>
        {column}
        {receiptsSheet}
        {groupSheet}
        {toastNode}
      </>
    );

  const open = all.find((t) => t.thread_id === threadId);
  return (
    <div
      data-messenger
      style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <Pane
        tier="expanded"
        list={column}
        selected={!!threadId}
        selectedKey={threadId ?? undefined}
        title={open?.name ?? (threadId ? "Conversation" : "Messages")}
        height="100%"
        onClose={threadId ? () => void navigate({ to: "/messages" }) : undefined}
        closeLabel="Close the conversation"
        empty={
          <div
            style={{
              padding: "var(--space-6)",
              height: "100%",
              display: "flex",
              boxSizing: "border-box",
            }}
          >
            <EmptyState
              c="brand"
              pattern="adinkra"
              title="Open a conversation to read it here."
              body="The list stays where it is."
            />
          </div>
        }
      >
        <MessengerPaneContext.Provider value>{pane}</MessengerPaneContext.Provider>
      </Pane>
      {receiptsSheet}
      {groupSheet}
      {toastNode}
    </div>
  );
}
