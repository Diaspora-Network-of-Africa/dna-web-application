// The bell and its list (ruling 82, SPEC section 6). The dot is notifications_dot(): an unseen row
// of a kind the vocabulary renders (1318, 1322), and opening the list marks every row seen, which
// clears it; each row keeps its unread weight until it is opened (1521). The
// list has no route: pointer keeps the 380 popover under the bell; touch gets the standard Sheet at
// 80 percent, not the full-screen inset B2 built (B17 item 3, ruling 492), so it carries the same
// focus trap and restore as every other sheet (480). Every row is a link that names its destination
// before the tap and marks itself read on open (rulings 462, 490). Empty is the launch state, and
// it is the same EmptyState component as every other empty state (B17 item 4).
//
// Handoff 60-NC (SPEC-56-NOTIFICATION-CONTROLS, B56-NotificationPanel-v1):
// - Mark all read (1556, 1564): a quiet button in the head while an unread row renders; a failure
//   keeps the rows' weight and puts one line with Try again under the head, and the head's button
//   is not drawn while that line is up. No toast, no count.
// - The email preferences view (1552, 1553, 1562): `view` is a state of this one panel, 'list' or
//   'email', never a second Sheet, Dialog or route. Its control is drawn only while
//   notification_email_view() names a category with copy, which today is none. Rows, labels and
//   modes come from notification_email_view() and the two vocabularies (1554, 1555); a failed
//   vocabulary renders one line and Try again and never a literal label (1561). When Strand's
//   Sheet `pushed` view is ported (1645), it replaces this `view` state.
// - The icon is `sliders-horizontal`: the bound compile carries no `mail` icon (1568).
// - `openTo="email"` is how the shell opens the panel on its email view from the
//   `?notifications=email` search parameter (1557, SPEC 6.4).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { EmptyState } from "@/components/strand/EmptyState";
import { IconButton } from "@/components/strand/IconButton";
import { NotificationBell } from "@/components/strand/NotificationBell";
import { NotificationListItem } from "@/components/strand/NotificationListItem";
import { Segment } from "@/components/strand/Segment";
import { Sheet } from "@/components/strand/Sheet";
import type { Member } from "@/lib/auth";
import {
  emailViewKey,
  loadEmailView,
  loadNotifications,
  markAllRead,
  markRead,
  markSeen,
  notificationsDot,
  setEmailMode,
} from "@/lib/notifications";
import { loadVocabularies } from "@/lib/vocabularies";
import { useEmptyStateSeen } from "@/lib/record-hooks";
import type { Tier } from "@/lib/tier";
import { timeLabel } from "@/lib/when";
import { POPOVER_STYLE } from "./AppShell";

/** SPEC 4.4 (1566): how long "Saved" stays before the line clears. */
const SAVED_MS = 2400;

type RowState =
  { status: "saving" } | { status: "saved" } | { status: "failed"; prev: string | null };

export function NotificationPanel({
  member,
  tier,
  onOpen,
  onChange,
  closeKey,
  openTo,
  onOpenedTo,
}: {
  member: Member;
  tier: Tier;
  onOpen?: (() => void) | undefined;
  /** Mirrors the list's open state to the shell (the floating composer entry hides while open). */
  onChange?: ((open: boolean) => void) | undefined;
  /** Changes when the route changes or the composer opens; the list closes (prototype behaviour). */
  closeKey?: string | undefined;
  /** 1557: open the panel on its email view, once; the shell clears its parameter in onOpenedTo. */
  openTo?: "email" | undefined;
  onOpenedTo?: (() => void) | undefined;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "email">("list");
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  // A row's pick before the read catches up with it; null is "no pill selected" (1560, 1571).
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const saveSeq = useRef<Record<string, number>>({});
  const savedTimers = useRef<Record<string, number>>({});
  const bellWrap = useRef<HTMLSpanElement>(null);
  // SPEC 5: every close returns focus to the bell. The Sheet restores what was focused when it
  // opened, and WebKit does not focus a button on a click, so the bell is named outright.
  const bell = useRef<HTMLElement | null>(null);
  useEffect(() => {
    bell.current = bellWrap.current?.querySelector<HTMLElement>("button") ?? null;
  });
  const heading = useRef<HTMLHeadingElement>(null);
  // The head's two drawn-or-not controls are found by their data attributes inside it, because
  // Strand's Button and IconButton take no ref.
  const headRow = useRef<HTMLDivElement>(null);
  const emailControl = () =>
    headRow.current?.querySelector<HTMLElement>("[data-notifications-email-control]") ?? null;
  const markButton = () =>
    headRow.current?.querySelector<HTMLElement>("[data-notifications-mark-all]") ?? null;
  // Where focus goes once the view has rendered: the heading on open, the control on Back (SPEC 5).
  const focusNext = useRef<"heading" | "control" | null>(null);
  const wasOpen = useRef(false);

  const close = () => setOpen(false);
  useEffect(() => {
    setOpen(false);
  }, [closeKey]);
  useEffect(() => {
    onChange?.(open);
  }, [open, onChange]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const unread = useQuery({
    queryKey: ["unread", member.id],
    queryFn: notificationsDot,
    refetchInterval: 60_000,
  });
  // 1318, 194: the kind vocabulary is what the list renders by. While it has not loaded, or when it
  // fails, the list is empty and the bell shows no dot, so the dot never points at an empty list.
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const kindsLoaded = (vocab.data?.notification_kinds?.length ?? 0) > 0;
  // 1322, 1521: opening the list marks the member's rows seen and the dot is read again.
  useEffect(() => {
    if (!open) return;
    void markSeen()
      .catch(() => undefined)
      .then(() => qc.invalidateQueries({ queryKey: ["unread", member.id] }));
  }, [open, qc, member.id]);
  const list = useQuery({
    queryKey: ["notifications", member.id],
    queryFn: () => loadNotifications(member.id),
    enabled: open,
  });
  // 1553: which categories carry email copy, and the member's modes. Read while the panel is open
  // or the shell asks for the email view, so the head knows whether to draw the control.
  const emailView = useQuery({
    queryKey: emailViewKey(member.id),
    queryFn: loadEmailView,
    enabled: open || openTo === "email",
  });
  const withCopy = (emailView.data ?? []).filter((e) => e.hasCopy);
  const hasControl = withCopy.length > 0;
  // 12C part 2: the panel's empty state, once per appearance (it closes and reopens as new ones).
  useEmptyStateSeen("notifications.none", open && list.isSuccess && list.data.length === 0);

  // 1562: the panel closes whole from either view and the view resets; the next open is the list.
  useEffect(() => {
    if (open) return;
    setView("list");
    setMarkFailed(false);
  }, [open]);

  // SPEC 6.4: the shell's parameter opens the panel on the email view once the read has answered.
  // With no category carrying copy there is no email view to open, so the list opens.
  useEffect(() => {
    if (openTo !== "email" || emailView.isPending) return;
    onOpen?.();
    setOpen(true);
    if (hasControl) {
      setView("email");
      focusNext.current = "heading";
    }
    onOpenedTo?.();
  }, [openTo, emailView.isPending, hasControl, onOpen, onOpenedTo]);

  const pointer = tier === "expanded";

  // SPEC 5: focus lands on the heading when the panel opens on pointer (the Sheet does its own on
  // touch) and when a view opens; Back returns it to the control; any close returns it to the bell
  // on pointer (the Sheet restores its opener on touch).
  useEffect(() => {
    if (open && !wasOpen.current && pointer) focusNext.current = focusNext.current ?? "heading";
    if (!open && wasOpen.current && pointer) bell.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, pointer]);
  useEffect(() => {
    if (!open || !focusNext.current) return;
    const target = focusNext.current;
    const id = requestAnimationFrame(() => {
      const el = target === "heading" ? heading.current : emailControl();
      if (!el) return;
      focusNext.current = null;
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, view, hasControl]);

  /**
   * Ruling 462: a row marks read on open and then goes where its line says it goes. The vocabulary
   * renders only the kinds that have somewhere to go (1318) — connection_accepted opens the other
   * member's profile, connection_request opens My Network, whose first section is Requests (1482),
   * role_invitation opens the event — so every row this list renders has a destination. A kind
   * whose object has no route keeps renders false and never reaches here. Grounded-or-empty applies
   * to a route as much as to a count.
   */
  const go = (n: {
    kind: string;
    actorHandle?: string | undefined;
    eventId?: string | undefined;
    objectId?: string | undefined;
  }) => {
    if (n.kind === "connection_accepted" && n.actorHandle) {
      setOpen(false);
      void navigate({ to: "/m/$handle", params: { handle: n.actorHandle }, search: {} });
      return;
    }
    if (n.kind === "connection_request") {
      setOpen(false);
      void navigate({ to: "/$c", params: { c: "connect" }, search: { lens: "network" } });
      return;
    }
    // Brief 10 (736, 1027): the invitation opens the event page, where the same notice renders at
    // the top with its Respond act into the accept-or-decline sheet (B10-SPEC 3.1).
    if (n.kind === "role_invitation" && n.eventId) {
      setOpen(false);
      void navigate({ to: "/convene/events/$id", params: { id: n.eventId } });
      return;
    }
    // Fix PR 10 item 8 (1623): the invitation opens the group, where Accept and Decline sit.
    if (n.kind === "thread_invitation" && n.objectId) {
      setOpen(false);
      void navigate({ to: "/messages/$thread", params: { thread: n.objectId } });
    }
  };
  const onRow = async (
    id: string,
    read: boolean,
    n: {
      kind: string;
      actorHandle?: string | undefined;
      eventId?: string | undefined;
      objectId?: string | undefined;
    },
  ) => {
    go(n);
    if (read) return;
    await markRead(id);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["notifications", member.id] }),
      qc.invalidateQueries({ queryKey: ["unread", member.id] }),
    ]);
  };
  const toggle = () => {
    setOpen((v) => {
      if (!v) onOpen?.();
      return !v;
    });
  };

  // SPEC 3.2 and 3.3 (1556, 1564): one press reads every row; a failure keeps their weight.
  const hasUnread = (list.data ?? []).some((n) => n.read_at === null);
  const markAll = async () => {
    if (marking) return;
    const onButton = !!document.activeElement && document.activeElement === markButton();
    setMarking(true);
    try {
      await markAllRead();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications", member.id] }),
        qc.invalidateQueries({ queryKey: ["unread", member.id] }),
      ]);
      const fromRetry = markFailed;
      setMarkFailed(false);
      // SPEC 5: focus left on the removed button, or a successful Try again, goes to the heading.
      if (onButton || fromRetry) heading.current?.focus({ preventScroll: true });
    } catch {
      setMarkFailed(true);
    } finally {
      setMarking(false);
    }
  };

  // The email view's words (1554, 1555): both vocabularies, or none of them.
  const modes = vocab.data?.notification_email_modes ?? [];
  const categories = vocab.data?.notification_categories ?? [];
  const vocabFailed =
    vocab.isError ||
    emailView.isError ||
    (vocab.isSuccess && (modes.length === 0 || categories.length === 0));
  const modeLabel = (v: string | null) => modes.find((m) => m.value === v)?.label ?? null;
  const shown = (c: string, mode: string | null, emailDefault: string | null) =>
    c in picked ? (picked[c] ?? null) : (mode ?? emailDefault);

  // SPEC 4.4: each row saves on its own; a press on the selected pill does nothing.
  const pick = (c: string, current: string | null, v: string) => {
    if (v === current) return;
    const seq = (saveSeq.current[c] ?? 0) + 1;
    saveSeq.current[c] = seq;
    window.clearTimeout(savedTimers.current[c]);
    setPicked((p) => ({ ...p, [c]: v }));
    setRowState((s) => ({ ...s, [c]: { status: "saving" } }));
    void setEmailMode(c, v).then(
      () => {
        if (saveSeq.current[c] !== seq) return;
        setRowState((s) => ({ ...s, [c]: { status: "saved" } }));
        void qc.invalidateQueries({ queryKey: emailViewKey(member.id) });
        savedTimers.current[c] = window.setTimeout(() => {
          setRowState((s) => {
            if (s[c]?.status !== "saved") return s;
            const next = { ...s };
            delete next[c];
            return next;
          });
        }, SAVED_MS);
      },
      () => {
        if (saveSeq.current[c] !== seq) return;
        setPicked((p) => ({ ...p, [c]: current }));
        setRowState((s) => ({ ...s, [c]: { status: "failed", prev: current } }));
      },
    );
  };
  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);
  const retryVocab = () => {
    void qc.invalidateQueries({ queryKey: ["vocabularies"] });
    void qc.invalidateQueries({ queryKey: emailViewKey(member.id) });
  };

  const openEmail = () => {
    focusNext.current = "heading";
    setView("email");
  };
  const back = () => {
    focusNext.current = "control";
    setView("list");
  };

  const btnSize = pointer ? "sm" : "md";
  const input = pointer ? "pointer" : "touch";
  const emailOpen = view === "email";
  const showMarkAll = !emailOpen && hasUnread && !markFailed;
  const head = (
    <div
      ref={headRow}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: 56,
        padding: "0 8px 0 16px",
        borderBottom: "1px solid var(--line)",
        flex: "none",
      }}
    >
      {emailOpen && (
        <IconButton
          name="arrow-left"
          label="Back to notifications"
          input={input}
          onClick={back}
          style={{ marginLeft: -8 }}
        />
      )}
      <h2
        ref={heading}
        data-sheet-heading
        tabIndex={-1}
        style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 17, fontWeight: 500, outline: "none" }}
      >
        {emailOpen ? "Email preferences" : "Notifications"}
      </h2>
      {showMarkAll && (
        <Button
          variant="ghost"
          size={btnSize}
          disabled={marking}
          data-notifications-mark-all=""
          data-testid="notifications-mark-all"
          onClick={() => void markAll()}
        >
          Mark all read
        </Button>
      )}
      {!emailOpen && hasControl && (
        <IconButton
          name="sliders-horizontal"
          label="Email preferences"
          input={input}
          data-notifications-email-control=""
          data-testid="notifications-email-control"
          onClick={openEmail}
        />
      )}
      <IconButton name="x" label="Close" onClick={close} />
    </div>
  );
  const failureLine = markFailed && hasUnread && !emailOpen && (
    <div
      role="alert"
      data-testid="notifications-mark-failed"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 8px 6px 16px",
        borderBottom: "var(--border-thin) solid var(--line)",
        flex: "none",
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1.4, color: "var(--ink-2)", textWrap: "pretty" }}>
        These were not marked read.
      </span>
      <Button variant="ghost" size={btnSize} disabled={marking} onClick={() => void markAll()}>
        Try again
      </Button>
    </div>
  );
  const rows: ReactNode = (
    <div
      aria-busy={marking}
      style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0 24px" }}
    >
      {list.data && list.data.length > 0 ? (
        list.data.map((n) => (
          <NotificationListItem
            key={n.id}
            kind={n.kind}
            c={n.c}
            destination={n.destination}
            actor={n.actor}
            object={n.object}
            detail={n.detail}
            text={n.text}
            time={timeLabel(n.created_at)}
            unread={n.read_at === null}
            onClick={() =>
              void onRow(n.id, n.read_at !== null, { ...n, objectId: n.object_id ?? undefined })
            }
            onRespond={
              n.kind === "role_invitation"
                ? () => void onRow(n.id, n.read_at !== null, n)
                : undefined
            }
          />
        ))
      ) : list.isPending ? (
        <p role="status" style={{ margin: 0, padding: "16px", color: "var(--ink-3)" }}>
          Loading
        </p>
      ) : (
        <div
          data-testid="notifications-empty"
          // 1147 (handoff 33-D item 3): the list is the column. Where the panel bounds it (the
          // Sheet), the empty state fills it; the pointer popover sizes to its content. No inset.
          style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
        >
          {/* B17 item 4: the same EmptyState component as every other empty state. */}
          <EmptyState
            c="brand"
            title="Nothing yet."
            body="When a member accepts your connection request, attests a contribution, approves your Space role, or an event you joined is near, it appears here."
          />
        </div>
      )}
    </div>
  );
  // SPEC 4.3 and 4.5: one row per category with copy, in the read's order (the vocabulary's).
  const email: ReactNode = (
    <div
      data-testid="notifications-email-view"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "0 16px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {vocabFailed ? (
        <div
          role="status"
          data-testid="notifications-email-failed"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
            padding: "16px 0",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
            Your email preferences did not load.
          </span>
          <Button variant="ghost" size={btnSize} onClick={retryVocab}>
            Try again
          </Button>
        </div>
      ) : (
        withCopy.map((e) => {
          const label = categories.find((k) => k.value === e.c)?.label;
          if (!label) return null;
          const value = shown(e.c, e.mode, e.emailDefault);
          const st = rowState[e.c];
          const prevLabel = st?.status === "failed" ? modeLabel(st.prev) : null;
          const line =
            st?.status === "saving"
              ? "Saving"
              : st?.status === "saved"
                ? "Saved"
                : st?.status === "failed"
                  ? prevLabel
                    ? "Did not save. Still " + prevLabel + "."
                    : "Did not save."
                  : "";
          const failed = st?.status === "failed";
          return (
            <div
              key={e.c}
              data-testid="notifications-email-row"
              data-c={e.c}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "14px 0 12px",
                borderBottom: "var(--border-thin) solid var(--line)",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
              <Segment
                options={modes}
                value={value ?? undefined}
                label={label + " email"}
                onChange={(v) => pick(e.c, value, v)}
              />
              <span
                role={failed ? "alert" : "status"}
                style={{
                  fontSize: 13,
                  lineHeight: "18px",
                  minHeight: 18,
                  color: failed ? "var(--error)" : "var(--ink-3)",
                }}
              >
                {line}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
  const body = (
    <>
      {head}
      {failureLine}
      {emailOpen ? email : rows}
    </>
  );
  return (
    <>
      <span ref={bellWrap} style={{ display: "contents" }}>
        <NotificationBell
          unread={unread.data === true && kindsLoaded}
          active={open}
          onClick={toggle}
        />
      </span>
      {/* Pointer keeps B2's 380 popover under the bell. Touch takes the standard Sheet at 80
          percent, not the full-screen inset B2 built (B17 item 3, rulings 492, 480). */}
      {pointer ? (
        open && (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={toggle}
              style={{ all: "unset", position: "fixed", inset: 0, zIndex: 40, cursor: "default" }}
            />
            <div
              role="dialog"
              aria-label={emailOpen ? "Email preferences" : "Notifications"}
              style={POPOVER_STYLE}
            >
              {body}
            </div>
          </>
        )
      ) : (
        // Ruling 492: 80 percent tall on compact, a side sheet of --sheet-expanded-width on medium and expanded (1219, 1220). A full-width
        // bottom sheet at 820 is the tablet full screen the ruling forbids.
        <Sheet
          open={open}
          onClose={close}
          returnFocus={bell}
          variant={tier === "compact" ? "sheet" : "drawer"}
          label={emailOpen ? "Email preferences" : "Notifications"}
        >
          {body}
        </Sheet>
      )}
    </>
  );
}
