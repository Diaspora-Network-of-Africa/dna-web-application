// Handoff 61-S1, the Account drawer (Brief 60-S; EXTRACTION-60-SETTINGS, approved under 1701 against
// compile v1791654208929113; rulings 1641, 1656 to 1672, 1740, 1741, 1744, 1745). One account
// control (1656): the avatar opens `/settings`, and this drawer replaces the custom account dialog
// AppShell kept until this handoff. Nothing from that panel survives beside it: Dark theme moved to
// Preferences, Read receipts and Link previews to Privacy, Change password into Sign-in and security.
//
// One Sheet, with a view state inside it (finding 2 of the handoff; G86, G193): the root, a panel and
// a second level are states of this one dialog, never a second Sheet or Dialog. Back sits in the head
// as 56-NC's email view drew it. When Strand's pushed view ports (1645), that view replaces this
// state; nothing in src/components/strand/ changed for it (docs/strand-ports/v1790724894917128.md).
//
// Routes (addendum change 1): `/settings` is the root, each panel keeps its route, a second level
// keeps its panel's route. A link to a panel opens the drawer at that panel over the Feed (the shell
// treats `/settings*` as the Feed underneath, src/lib/feed-view.ts); Back goes to the root; Close,
// Escape, the scrim or a drag return to `/feed`. `/settings/notifications` resolves to the root while
// no category carries email copy (1553, 1395).
//
// Geometry: the bottom sheet at Sheet's canonical 80 percent on compact (584, 492); above compact the
// drawer variant at the extraction's 380, the width the notification panel's popover already uses
// (extraction section 8 item 2 and 5.2 item 1, where Strand is asked to name it). Written once here.
//
// Focus (section 7; 480, 423): open lands on the title (Sheet's own heading focus); a push lands on
// the pushed title and the body scrolls to its top; Back from a panel returns to the row that pushed
// it; Back from a second level returns to the control that opened it, and so does a second level's
// successful write; Close returns to the avatar, named outright because WebKit does not focus a
// button on a click (as NotificationPanel names the bell).
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Icon } from "@/components/strand/Icon";
import { IconButton } from "@/components/strand/IconButton";
import { Sheet, SHEET_DUR } from "@/components/strand/Sheet";
import type { Member } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { useTier } from "@/lib/tier";
import {
  BlockedPanel,
  NotificationsPanel,
  PreferencesPanel,
  PrivacyPanel,
  SecurityPanel,
  useEmailCopy,
  type PanelHost,
  type LevelInfo,
} from "./AccountPanels";

// Extraction section 1 and 8 item 2: the drawer's width above compact is 380. Since compile
// sha256-b1a458dac1bd562f (1704, brief 60-SP item 18) it is Sheet's `size="account"`, which reads
// --sheet-panel-width, and no number is written here.

export type PanelId = "security" | "privacy" | "notifications" | "preferences" | "blocked";

export const PANEL_IDS: readonly PanelId[] = [
  "security",
  "privacy",
  "notifications",
  "preferences",
  "blocked",
];

export function isPanelId(v: unknown): v is PanelId {
  return typeof v === "string" && (PANEL_IDS as readonly string[]).includes(v);
}

/** R1 and R3: the drawer's title at the root, and each panel's. */
export const PANEL_TITLES: Record<PanelId, string> = {
  security: "Sign-in and security",
  privacy: "Privacy",
  notifications: "Notifications",
  preferences: "Preferences",
  blocked: "Blocked members",
};

export const CAPS: CSSProperties = {
  fontSize: 13,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: "var(--ink-3)",
};

const ROW: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 48,
  padding: "8px 12px 8px 20px",
  width: "100%",
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
};

type FocusNext = { kind: "title" } | { kind: "row"; id: string } | { kind: "opener"; key: string };

export function AccountDrawer({
  member,
  panel,
  openLevel,
}: {
  member: Member;
  /** The panel the route names; null at the root. */
  panel: PanelId | null;
  /** `/password` redirects here with the password level open (handoff finding 3). */
  openLevel?: "password" | undefined;
}) {
  const tier = useTier();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const compact = tier === "compact";
  const pointer = tier === "expanded";
  const input = pointer ? "pointer" : "touch";
  const btnSize = pointer ? "sm" : "md";

  const [open, setOpen] = useState(true);
  const [level, setLevel] = useState<LevelInfo | null>(null);
  const [footer, setFooter] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const focusNext = useRef<FocusNext | null>(null);
  const avatar = useRef<HTMLElement | null>(null);
  const lastPanel = useRef<PanelId | null>(panel);

  // The avatar, named for Sheet's restore (423): what Sheet captured on open is whatever was focused
  // when the route mounted, which on WebKit after a tap is the body.
  useEffect(() => {
    avatar.current = document.querySelector<HTMLElement>('[data-testid="avatar"]');
  });

  // A panel change from the route: a push (root to panel) lands on the title; a Back (panel to root)
  // lands on the row that pushed, when nothing else has claimed the next focus. Cleared levels go
  // with the panel.
  useLayoutEffect(() => {
    const prev = lastPanel.current;
    lastPanel.current = panel;
    if (prev === panel) return;
    setLevel(null);
    setError(null);
    setFooter(null);
    if (!focusNext.current) {
      focusNext.current = panel ? { kind: "title" } : prev ? { kind: "row", id: prev } : null;
    }
  }, [panel]);

  // Section 7: where focus lands after a push, a Back or a second level's close, once the view has
  // rendered. A push also scrolls the body to its top.
  const levelKey = level?.key ?? null;
  useEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    const id = requestAnimationFrame(() => {
      focusNext.current = null;
      if (next.kind === "title") {
        body.current?.scrollTo({ top: 0 });
        heading.current?.focus({ preventScroll: true });
        return;
      }
      const sel =
        next.kind === "row"
          ? `[data-drawer-row="${next.id}"]`
          : `[data-opener="${next.key.replace(/"/g, "")}"]`;
      const el = body.current?.querySelector<HTMLElement>(sel) ?? null;
      (el ?? heading.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [panel, levelKey]);

  // Handoff finding 3: `/password` lands here as `/settings/security?open=password`. The panel opens
  // the level once; the parameter is replaced away so a reload or a Back does not open it again
  // (the pattern 1557 set for `?notifications=email`).
  useEffect(() => {
    if (openLevel !== "password" || panel !== "security") return;
    const loc = router.state.location;
    const rest = { ...(loc.search as Record<string, unknown>) };
    delete rest["open"];
    router.history.replace(
      loc.pathname + router.options.stringifySearch(rest) + (loc.hash ? "#" + loc.hash : ""),
    );
  }, [openLevel, panel, router]);

  const close = useCallback(() => {
    setOpen(false);
    // Sheet's exit runs, its restore returns focus to the avatar, then the route leaves.
    window.setTimeout(() => {
      if (router.state.location.pathname.startsWith("/settings"))
        void navigate({ to: "/feed", search: {} });
    }, SHEET_DUR + 20);
  }, [navigate, router]);

  const push = (id: PanelId) => {
    focusNext.current = { kind: "title" };
    void navigate({ to: "/settings/$panel", params: { panel: id } });
  };
  const back = () => {
    if (level) {
      const key = level.key;
      setLevel(null);
      setError(null);
      setFooter(null);
      focusNext.current = { kind: "opener", key };
      return;
    }
    if (panel) focusNext.current = { kind: "row", id: panel };
    void navigate({ to: "/settings" });
  };

  const host: PanelHost = {
    member,
    input,
    btnSize,
    level,
    openLevel: (info) => {
      setError(null);
      setLevel(info);
      focusNext.current = { kind: "title" };
    },
    closeLevel: (to) => {
      const key = level?.key;
      setLevel(null);
      setError(null);
      setFooter(null);
      focusNext.current = to === "title" || !key ? { kind: "title" } : { kind: "opener", key: key };
    },
    setFooter,
    setError,
    toRoot: () => {
      void navigate({ to: "/settings", replace: true });
    },
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    qc.clear();
    void navigate({ to: "/sign-in" });
  };

  const title = level ? level.title : panel ? PANEL_TITLES[panel] : "Account";
  const backLabel = level
    ? "Back to " + (panel ? PANEL_TITLES[panel] : "Account")
    : "Back to Account";
  const atRoot = !panel && !level;

  // R6: the Back control's accessible name names what it returns to.
  const head = (
    <div
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
      {!atRoot && (
        <IconButton
          name="arrow-left"
          label={backLabel}
          input={input}
          onClick={back}
          data-testid="account-back"
          style={{ marginLeft: -8 }}
        />
      )}
      <h2
        ref={heading}
        data-sheet-heading
        data-drawer-title
        tabIndex={-1}
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontSize: 17,
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          outline: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h2>
      <IconButton name="x" label="Close" input={input} onClick={close} />
    </div>
  );

  const root = (
    <div data-drawer-panel="root" style={{ display: "flex", flexDirection: "column" }}>
      {/* The head: avatar, name and the email address, shown here and nowhere public (428). It
          navigates to the profile's edit mode. */}
      <button
        type="button"
        data-drawer-row="identity"
        onClick={() => {
          if (!member.handle) return;
          void navigate({
            to: "/m/$handle",
            params: { handle: member.handle },
            search: { edit: true },
          });
        }}
        style={{ ...ROW, minHeight: 64, padding: "12px 12px 12px 20px" }}
      >
        <Avatar name={member.name} src={member.avatar} size={40} />
        <span
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{member.name}</span>
          <span
            data-testid="account-email"
            style={{
              fontSize: 13,
              lineHeight: 1.3,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {member.email}
          </span>
        </span>
        <Icon name="chevron-right" size={20} style={{ color: "var(--ink-3)", flex: "none" }} />
      </button>
      <RootGroups member={member} push={push} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "4px 0",
          borderTop: "1px solid var(--line)",
        }}
      >
        <button
          type="button"
          data-drawer-row="signout"
          data-testid="account-sign-out"
          onClick={() => void signOut()}
          style={{ ...ROW, padding: "8px 20px", fontSize: 17, fontWeight: 500 }}
        >
          <Icon name="arrow-left" size={20} style={{ color: "var(--ink-3)", flex: "none" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Sign out</span>
        </button>
      </div>
    </div>
  );

  const content =
    panel === "security" ? (
      <SecurityPanel host={host} openLevel={openLevel} />
    ) : panel === "privacy" ? (
      <PrivacyPanel host={host} />
    ) : panel === "preferences" ? (
      <PreferencesPanel host={host} />
    ) : panel === "notifications" ? (
      <NotificationsPanel host={host} />
    ) : panel === "blocked" ? (
      <BlockedPanel host={host} />
    ) : (
      root
    );

  return (
    <Sheet
      open={open}
      onClose={close}
      returnFocus={avatar}
      variant={compact ? "sheet" : "drawer"}
      size="account"
      label={title}
      actions={footer}
      error={error}
    >
      {head}
      <div
        ref={body}
        data-sheet-body
        data-drawer-level={level?.key ?? panel ?? "root"}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: atRoot ? "0 0 4px" : 20,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {content}
      </div>
    </Sheet>
  );
}

/** Section 1's table, R2 to R4: the groups and their rows. Your data, Delete account, My hashtags
 *  and Hidden posts are not drawn (1740, 1741, 1653). The Notifications row is drawn only while a
 *  category carries email copy (1553, 1395), which NotificationsRow reads. */
function RootGroups({ member, push }: { member: Member; push: (id: PanelId) => void }) {
  const navigate = useNavigate();
  const handle = member.handle;
  const profile = (edit: boolean) => {
    if (!handle) return;
    void navigate({
      to: "/m/$handle",
      params: { handle },
      search: edit ? { edit: true } : {},
    });
  };
  type Row = { id: string; label: string; sub?: string; push?: PanelId; go?: () => void };
  const groups: { label: string; rows: Row[] }[] = [
    { label: "You", rows: [{ id: "view", label: "View my profile", go: () => profile(false) }] },
    {
      label: "My work",
      rows: [
        {
          id: "posts",
          label: "My posts and updates",
          go: () => void navigate({ to: "/feed", search: { lens: "mine" } }),
        },
        {
          id: "saved",
          label: "Saved items",
          go: () => void navigate({ to: "/feed", search: { lens: "saved" } }),
        },
      ],
    },
    {
      label: "Account",
      rows: [
        {
          id: "profile",
          label: "Profile",
          sub: "Name, headline, portrait, About",
          go: () => profile(true),
        },
        { id: "security", label: PANEL_TITLES.security, push: "security" },
        { id: "privacy", label: PANEL_TITLES.privacy, push: "privacy" },
        { id: "notifications", label: PANEL_TITLES.notifications, push: "notifications" },
        { id: "preferences", label: PANEL_TITLES.preferences, push: "preferences" },
      ],
    },
    {
      label: "Content and safety",
      rows: [{ id: "blocked", label: PANEL_TITLES.blocked, push: "blocked" }],
    },
  ];
  return (
    <>
      {groups.map((g) => (
        <div
          key={g.label}
          role="group"
          aria-label={g.label}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "4px 0",
            borderTop: "1px solid var(--line)",
          }}
        >
          <span style={{ ...CAPS, padding: "10px 20px 4px" }}>{g.label}</span>
          {g.rows.map((r) =>
            r.id === "notifications" ? (
              <NotificationsRow key={r.id} member={member} onPush={() => push("notifications")} />
            ) : (
              <DrawerRow
                key={r.id}
                id={r.id}
                label={r.label}
                sub={r.sub}
                push={!!r.push}
                onClick={() => (r.push ? push(r.push) : r.go?.())}
              />
            ),
          )}
        </div>
      ))}
    </>
  );
}

function DrawerRow({
  id,
  label,
  sub,
  push,
  onClick,
}: {
  id: string;
  label: string;
  sub?: string | undefined;
  push: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" data-drawer-row={id} onClick={onClick} style={ROW}>
      <span
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
        {sub && (
          <span
            style={{
              fontSize: 15,
              lineHeight: 1.3,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {push && (
        <Icon name="chevron-right" size={20} style={{ color: "var(--ink-3)", flex: "none" }} />
      )}
    </button>
  );
}

/** 1553, 1395: the Notifications row exists only while notification_email_view() names a category
 *  with copy. Today it names none, so the row is absent. */
function NotificationsRow({ member, onPush }: { member: Member; onPush: () => void }) {
  const hasCopy = useEmailCopy(member);
  if (!hasCopy) return null;
  return <DrawerRow id="notifications" label={PANEL_TITLES.notifications} push onClick={onPush} />;
}
