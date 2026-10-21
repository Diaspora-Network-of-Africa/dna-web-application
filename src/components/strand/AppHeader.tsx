// Ported from the B2-Shell-Feed-v3 extraction, shell/strand-patch/AppHeader.jsx (ruling 99, amends
// 78). Expanded: one row centred in the page max width: logo, five labelled Cs (PulseDock inline),
// then at right Home (unlabelled house icon), bell (children), avatar. No second C row. Compact and
// medium: logo, centre slot, bell, avatar. The centre slot is the composer entry (the Lens Bar
// track's shape: --bg-sunken, --radius-m, 44 tall, not a pill) or the compact LensBar once the
// member has scrolled into the Feed (`lensBar`). At the compact tier the bell leaves with the
// composer, because logo, lens bar, bell and avatar do not fit one 360-wide row; avatar stays at the
// far right. Bell and composer return at the top. The logo always goes Home (/feed).
// Ruling 1000 retired `lensBar.dense`, which said both "suppress the active lens's icon" and "this
// is the compact tier": the first is gone (see `LensBar`) and the second is what the bell needs, so
// the bell reads `tier` and the flag that answered two questions is not replaced by another one.
// `variant` stays the layout switch — expanded is a different row — and `tier` is the shell's own
// three-way tier, which is the axis the bell asks about, because `variant` reads "compact" at the
// medium tier too and the bell belongs in the row there.
// Ruling 1175, built as 1190: at expanded the row is three tracks, the sides equal (`SIDE_TRACK`), so the
// five Cs centre on the row's centre rather than on what is left between the logo and the controls.
// Production additions: homeHref renders the logo and Home item as real links (hover-intent prefetch,
// ruling 84); onIntentC prefetches a C route from the inline dock; maxWidth takes "none", so the
// expanded row can take a surface's own edges, as Discovery's canvas under 1123.
// Brief 14 (SPEC 41-14 Part A item 2; extraction 41-14 section 5.1, the staged
// `messages/strand-patch/AppHeader.jsx`; amends 99, 1175, 1190): a `messages` slot, rendered after the
// bell at both variants. At expanded the side tracks grow to `SIDE_TRACK_FOUR` only when the slot is
// passed, so every existing caller keeps 148 and renders unchanged. At compact and medium the control
// sits after the bell and before the avatar, and unlike the bell it stays on the dense lens row at the
// compact tier (1334: the control is beside the bell at every tier, and the compact row at 360 places
// it beside the lens bar where the bell leaves). `MessagesControl` is exported beside the header: the
// message-circle IconButton with NotificationBell's 8px --pulse-for-you dot and no numeral (82, 1344).
import { Fragment, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { LensBar, type Lens } from "./LensBar";
import { PulseDock, type PulseState } from "./PulseDock";
import { assetBase, type C } from "./cmeta";

/**
 * Expanded: the row is three tracks, the two sides this wide and the dock between them (1175, 1190),
 * so the five Cs centre on the row's centre whatever the wordmark's width. It is the controls'
 * group: Home 44, the bell 44, the avatar's button 44 and the two 8 gaps between them. The
 * side tracks are equal by construction, not by what sits in them, and the controls' group is the
 * wider of the two, so the row reserves its width on both sides. `minmax(0, 1fr) auto minmax(0, 1fr)`
 * would size the dock to its content and pack the Cs; the dock is meant to keep filling its track.
 */
const SIDE_TRACK = 44 * 3 + 8 * 2;
/** Brief 14 (5.1): four controls, Home, the bell, Messages and the avatar, with three 8 gaps: 200. */
const SIDE_TRACK_FOUR = 44 * 4 + 8 * 3;

export type HeaderLensBar<Id extends string = string> = {
  lenses: Lens<Id>[];
  value: Id;
  onChange?: ((id: Id) => void) | undefined;
};

export type AppHeaderProps = {
  variant?: "compact" | "expanded";
  /** The shell's tier (rulings 58 to 60). The bell's compact-row rule reads this, not `variant`. */
  tier?: "compact" | "medium" | "expanded";
  homeActive?: boolean | undefined;
  onHome?: ((e: MouseEvent<HTMLElement>) => void) | undefined;
  /** Home link target, rendered as an anchor so it prefetches and opens in a new tab. */
  homeHref?: string | undefined;
  onHomeIntent?: (() => void) | undefined;
  member?: { name?: string | undefined; src?: string | undefined };
  onCompose?: (() => void) | undefined;
  composePlaceholder?: string;
  onAvatar?: (() => void) | undefined;
  avatarActive?: boolean | undefined;
  /** Expanded only: the five-C slots inside the row. */
  cActive?: C | null | undefined;
  cStates?: Partial<Record<C, PulseState>> | undefined;
  onSelectC?: ((c: C) => void) | undefined;
  onIntentC?: ((c: C) => void) | undefined;
  /** Compact and medium only: the LensBar takes the centre slot while the member is in the list. */
  lensBar?: HeaderLensBar | null | undefined;
  maxWidth?: number | "none" | undefined;
  children?: ReactNode;
  /** Brief 14 (1334, 1344): the Messages control, after the bell at both variants. Absent, the row is
   *  as it was, side tracks included. */
  messages?: ReactNode;
  style?: CSSProperties | undefined;
};

export type MessagesControlProps = {
  /** Any unmuted, unarchived thread is unread: the dot, never a numeral (82). */
  unread: boolean;
  /** On a /messages route: `aria-current="page"`. */
  active?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
};

/** The Messages control (Brief 14, ruling 1344): message-circle, named `Messages` or `New messages`,
 *  NotificationBell's dot shape. Mounted in AppHeader's `messages` slot; no surface composes its own. */
export function MessagesControl({ unread, active, onClick, style }: MessagesControlProps) {
  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "none", ...style }}>
      <IconButton
        name="message-circle"
        label={unread ? "New messages" : "Messages"}
        active={active}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        data-testid="messages"
        data-unread={unread ? "1" : undefined}
      />
      {unread && (
        <span
          aria-hidden="true"
          data-testid="messages-dot"
          style={{
            position: "absolute",
            top: 9,
            right: 9,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--pulse-for-you)",
            border: "2px solid var(--bg)",
            boxSizing: "content-box",
            pointerEvents: "none",
            transition: "background var(--dur-default) var(--ease)",
          }}
        />
      )}
    </span>
  );
}

/** App shell header (ruling 69). Mounted once at the app root; no surface composes its own. */
export function AppHeader({
  variant = "compact",
  tier = "compact",
  homeActive,
  onHome,
  homeHref,
  onHomeIntent,
  member = {},
  onCompose,
  composePlaceholder = "What is going on with you?",
  onAvatar,
  avatarActive,
  cActive,
  cStates,
  onSelectC,
  onIntentC,
  lensBar,
  maxWidth = 1440,
  children,
  messages,
  style,
}: AppHeaderProps) {
  const exp = variant === "expanded";
  // Brief 14 (5.1): the side track reserves the fourth control only when the slot is passed.
  const side = messages !== undefined && messages !== null ? SIDE_TRACK_FOUR : SIDE_TRACK;
  // 1892, 1902, compile sha256-89356d2d39fef8a6 (1894): the 1A wordmark in --ink in both themes. The
  // span paints --ink through the file as a mask; the hidden img of the same file at the mark's height
  // gives the span its width from the file's own ratio, where the compile writes height x 3.2022, so
  // no ratio is written here (184: size by height, width auto; docs/strand-ports/sha256-89356d2d39fef8a6.md).
  const wordmark = assetBase() + "wordmark-mono.svg";
  const wordmarkMask = `url("${wordmark}") center / contain no-repeat`;
  const [hh, setHh] = useState(false);
  const HomeTag = homeHref ? "a" : "button";
  const homeProps = homeHref ? { href: homeHref } : { type: "button" as const };
  const showLens = !exp && !!lensBar;
  // Expanded groups Home, the bell and the avatar into the row's third track; below it they stay the
  // row's own children, so compact and medium are the DOM they were.
  const Ctl = exp ? "div" : Fragment;
  return (
    <header
      data-app-header
      data-centre={showLens ? "lens" : "compose"}
      style={{
        display: "flex",
        height: exp ? 64 : 56,
        // Longhand, never the shorthand: the host supplies paddingTop, paddingLeft and paddingRight
        // for the safe-area insets (ruling 344), and an element that carries both forms makes React
        // warn every time the tier flips, which it does once on mount at every width above compact.
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: exp ? 32 : 16,
        paddingRight: exp ? 32 : 8,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        boxSizing: "border-box",
        flex: "none",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: exp ? 8 : 6,
          ...(exp
            ? {
                display: "grid",
                gridTemplateColumns: `${side}px minmax(0, 1fr) ${side}px`,
              }
            : {}),
          width: "100%",
          maxWidth: exp ? maxWidth : undefined,
          margin: "0 auto",
          minWidth: 0,
        }}
      >
        <HomeTag
          {...homeProps}
          onClick={onHome}
          onMouseEnter={onHomeIntent}
          aria-label="Home"
          aria-current={homeActive && !exp ? "page" : undefined}
          data-testid="home"
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            flex: "none",
            justifySelf: "start",
          }}
        >
          <span
            role="img"
            aria-label="DNA"
            style={{
              display: "block",
              background: "var(--ink)",
              WebkitMask: wordmarkMask,
              mask: wordmarkMask,
            }}
          >
            <img
              src={wordmark}
              alt=""
              style={{
                height: exp ? 28 : 24,
                width: "auto",
                display: "block",
                visibility: "hidden",
              }}
            />
          </span>
        </HomeTag>
        {!exp &&
          (showLens && lensBar ? (
            // `compact` already stretches the track (change-list item 50); the packing is named
            // anyway so no call site leaves it to a default. `icons` is not passed: a compact bar
            // renders icon-first, where the prop is not read.
            <LensBar
              compact
              width="fill"
              lenses={lensBar.lenses}
              value={lensBar.value}
              onChange={lensBar.onChange}
              style={{ flex: 1, minWidth: 0 }}
            />
          ) : (
            <button
              type="button"
              onClick={onCompose}
              aria-label="Open the composer"
              data-testid="compose"
              style={{
                all: "unset",
                boxSizing: "border-box",
                cursor: "text",
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                background: "var(--bg-sunken)",
                borderRadius: "var(--radius-m)",
                color: "var(--ink-3)",
                fontSize: 15,
              }}
            >
              <Icon name="pen-line" size={16} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {composePlaceholder}
              </span>
            </button>
          ))}
        {exp && (
          <PulseDock
            inline
            active={cActive ?? undefined}
            states={cStates}
            onSelect={onSelectC}
            onIntent={onIntentC}
            style={{ flex: 1, justifyContent: "space-evenly", minWidth: 0, padding: "0 24px" }}
          />
        )}
        <Ctl
          {...(exp
            ? { style: { display: "flex", alignItems: "center", gap: 8, justifySelf: "end" } }
            : {})}
        >
          {exp && (
            <HomeTag
              {...homeProps}
              onClick={onHome}
              aria-label="Home"
              aria-current={homeActive ? "page" : undefined}
              onMouseEnter={() => {
                setHh(true);
                onHomeIntent?.();
              }}
              onMouseLeave={() => setHh(false)}
              data-testid="home-item"
              style={{
                all: "unset",
                cursor: "pointer",
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                flex: "none",
                color: homeActive ? "var(--ink)" : "var(--ink-3)",
                background: hh ? "var(--bg-sunken)" : "transparent",
                transition:
                  "background var(--dur-default) var(--ease), color var(--dur-default) var(--ease)",
              }}
            >
              <Icon name="house" size={22} />
            </HomeTag>
          )}
          {!(showLens && tier === "compact") && children}
          {/* Brief 14 (5.1): after the bell, before the avatar; stays on the dense lens row. */}
          {messages}
          <button
            type="button"
            onClick={onAvatar}
            aria-label="Your profile"
            aria-expanded={avatarActive === undefined ? undefined : !!avatarActive}
            data-testid="avatar"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <Avatar name={member.name ?? ""} src={member.src} size={exp ? 36 : 32} />
          </button>
        </Ctl>
      </div>
    </header>
  );
}
