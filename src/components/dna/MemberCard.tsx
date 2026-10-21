// Ported from Strand components/dna/MemberCard.jsx at compile v1791495246160097 (correction 56,
// ratified 1599; the part rulings 1469 to 1472, ratified 1487 to 1496 and 1530, with 1534, 1540 and
// 1541 applied by the correction; the port handoff 44-MC-R3). Structure matches the source one to
// one: MARK, TONE, Pill, joinNames, useFitName, Wide, MemberCard, MemberCardSkeleton. It stays an app
// part in src/components/dna/ because the app's callers bind it (ConnectSurface, src/lib/connect.ts).
//
// Translations, and nothing else (recorded in docs/strand-ports/v1791495246160097.md):
// - imports resolve to the repo's Strand parts (Button, Icon, DiaLine, IdentityMark, BadgeRow,
//   cmeta's assetBase) and the props carry TypeScript types;
// - the portrait is drawn through the repo's Avatar (handoff item 2), which carries the initials
//   fallback for a photograph that fails to load (Fix PR 10 item 6). The compile's own <img>, its
//   `broken` state, the decoded-size check after each render and the lazy/async attributes are
//   Avatar's business now and are not duplicated here; Avatar's initials tile is styled to the
//   compile's (display face, --display-m, --ink-3) through its style prop;
// - the mutual names join through the platform's one joiner, src/lib/names.ts (handoff 41-C), with
//   the compile's lead and full stop around it, instead of a copy of the compile's joinNames;
// - the arms' hooks: data-testid on the card, the portrait, the action containers, Message, the
//   mutuals line and DIA's reason, beside the compile's own data-field attributes;
// - MEMBER_REL, the wire's relationship states (ruling 214), stays exported for src/lib/connect.ts;
//   the lib maps it onto the part's `context` and `connection` (handoff item 2), never this file;
// - the compile's two element-scoped custom properties, --member-name-base (the authored rung, set
//   on the name) and --member-name-fitted (the settled size, set on the card), carry the repo's
//   `--_` prefix for a property a component declares on itself (scripts/token-check.mjs, ruling 485;
//   --_shell-visible is the standing instance), so the token check does not read them as theme
//   tokens that resolve nowhere. Same values, same elements, same reads.
import {
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/strand/Avatar";
import { BadgeRow, type Attestation } from "@/components/strand/BadgeRow";
import { Button } from "@/components/strand/Button";
import { assetBase } from "@/components/strand/cmeta";
import { DiaLine } from "@/components/strand/DiaLine";
import { Icon } from "@/components/strand/Icon";
import { IdentityMark } from "@/components/strand/IdentityMark";
import type { Mode, Tier } from "@/lib/tier";
import { joinNames } from "@/lib/names";

// Ruling 214: there is no window state on a surface. private.relationship_display maps it to
// sent before the projection returns, so the sender sees the Pending pill and nothing else, and
// cannot separate a decline inside the window from a request still waiting. This is the wire's
// vocabulary; the part reads `context` and `connection`, which src/lib/connect.ts derives from it.
export const MEMBER_REL = ["none", "sent", "received", "connected"] as const;
export type MemberRel = (typeof MEMBER_REL)[number];

/** The part's four contexts (extraction section 3): My Network's five lists are these four. */
export type MemberCardContext = "members" | "suggested" | "requests" | "sent";
export type MemberCardConnection = "none" | "pending" | "connected";

export type MemberCardProps = {
  name: string;
  handle?: string | undefined;
  /** 1488: carried by the data, not drawn. */
  stance?: string | undefined;
  headline?: string | undefined;
  location?: string | undefined;
  src?: string | undefined;
  /** The portrait's focal point, overriding --member-portrait-focus for this member. */
  focus?: string | undefined;
  identified?: boolean | undefined;
  attestations?: Attestation[] | undefined;
  context?: MemberCardContext | undefined;
  connection?: MemberCardConnection | undefined;
  following?: boolean | undefined;
  /** 1336 to 1339 decide where Message may appear; the caller passes it. Defaults to connected. */
  canMessage?: boolean | undefined;
  /** Mutual names, up to three, never a count (ruling 120). */
  mutuals?: string[] | undefined;
  mutualsLead?: string | undefined;
  /** DIA's sentence; suggested only. */
  reason?: string | undefined;
  /** When the request arrived, already formatted (1530). */
  since?: string | undefined;
  /** The sender's note on a request. */
  note?: string | undefined;
  tier?: Tier | undefined;
  input?: Mode | undefined;
  href?: string | undefined;
  onOpen?: (() => void) | undefined;
  onConnect?: (() => void) | undefined;
  onMessage?: (() => void) | undefined;
  onFollow?: (() => void) | undefined;
  onAccept?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
  /** 1534: Withdraw beside Pending in context sent, drawn only when passed. */
  onWithdraw?: (() => void) | undefined;
  style?: CSSProperties | undefined;
};

/** MemberCard (rulings 1469 to 1472, brief 44-W70; ratified 1487 to 1496 and 1530; 1534, 1540 and 1541 applied by correction 56).
 *  The portrait is the card's leading edge, inset by --member-portrait-inset and carrying its own --member-portrait-radius and a centred halo, --member-portrait-shadow,
 *  so it reads as a photograph set into the card rather than part of the white panel (the founder's mock; 1487 rules the inset, the radius and the halo).
 *  At compact the name takes its own lane across the card's head, so it measures against the whole card and not the column beside the portrait: at 360 that column is 138px, in which no 26-character name can sit on one line at a legible size.
 *  One structure at every tier: the card is a column holding the name lane when the name needs one, the portrait row, and the action band at compact. The portrait row carries the 4:5 minimum, so the photograph's
 *  height never depends on the card's own box or on what the bands around it leave over. 1541: the portrait KEEPS that 4:5 crop at its tier width and never stretches; when the content column
 *  is taller, the column grows past it and the portrait holds the top of the row.
 *  At medium and expanded it sits at the head of that column instead — unless the column cannot hold it at --member-name-min-wide, in which case the fit says so and the card promotes it to the same head lane. The lane gives before the size does, at every tier.
 *  Under it the portrait leads a row carrying @handle, headline and location, centred against the portrait's height; at medium and expanded the name sits at the head of that column instead, the content packs to the top and the actions anchor to the card's foot, right justified.
 *  Every line under the name takes the lesser of its own rung and a share of the name's fitted size, and never computes under 12px, so the hierarchy holds and nothing goes illegible.
 *  The column's children stretch, which is what lets the lane define the name's measurement: aligning them to the start would size the name to its own text and defeat the fit. Left justification needs no alignment, since each line starts at the left edge already.
 *  Nothing in the card is cut: the name holds one lane at every tier, its size giving rather than its words; the location wraps rather than give.
 *  The headline is the one bounded line: two rows, ending in an ellipsis, so the card says there is more to read without growing. The full text sits on the element's title.
 *  1488: the stance is not drawn; the prop stays, since the data carries it.
 *  The portrait keeps its focal point (--member-portrait-focus) inside its 4:5 crop; it does not grow with the card (1541).
 *  The context block — when the request arrived, the sender's note, the mutual names, DIA's reason — sits INSIDE the card, between the identity and the actions, and the card grows to hold it
 *  (the founder, reversing this part's earlier answer to guardrail 4, which kept that block outside so it cost the card no height). Reading order is identity, then why, then what you can do about it, at every tier.
 *  Mutual names draw wherever there are mutuals, not only in suggested; the reason line stays DIA's and stays suggested's.
 *  1497: an identified member carries the Identified mark on the portrait's bottom-right corner, 22px at every tier so it holds at 360, drawn over the photograph and over the initials tile alike.
 *  It sits OUTSIDE the portrait panel's aria-hidden wrapper and outside the portrait's link, so a screen reader hears the member's name once and the mark once, and the mark is never a second tab stop.
 *  1497: the attestation badges sit in the context block, after the mutual names and before DIA's reason — so the card reads who, then who attested to them (1530), then why DIA raised them.
 *  Each badge opens to its provenance inside the card, and the card grows for it; no count anywhere (guardrail 1).
 *  1491: the name's size steps down to --member-name-min-compact (15px) or --member-name-min-wide (18px) and stops. Below that floor the name WRAPS to a second line rather than shrink further:
 *  the lane gives first (a name the column beside the portrait cannot hold takes the card's head), then the line count gives, and the size never goes illegible. There is no hard minimum any more.
 *  Compact (360, 390) is a different card, not a squeezed one: the portrait is the leading edge of an identity row, and the actions span the card's foot in their own band, under a hairline.
 *  Each compact action carries its mark or icon with its word and shares the band's width, 44px tall (1489).
 *  The name never truncates: useFitName measures it against its lane and steps the size down until the whole first and last name fits, one line at compact and two wider. No compromise.
 *  Medium and expanded are unchanged: the portrait runs the card's full height and the actions sit bottom right inside the content column.
 *  The headline's two-row clamp is ruled 1490.
 *  Parked, and not this part's work: a crop or focal-point step at upload, so a member chooses the image that fits the panel. It belongs to the profile or the Composer.
 *  W69: the actions live inside the content column, which is minWidth:0 and wraps, so they can never reach the portrait.
 *  1472: no sector chips; they stay on the profile. No count, no score, no completion anywhere.
 *  1470 and 1489: labelled buttons at medium and expanded; at compact the mark or icon with its word, sharing the band across the card's foot.
 *  1534: in context sent, onWithdraw draws Withdraw as the quiet second control beside Pending, and only when the prop is passed.
 *  Hardened in this pass: the portrait carries no alt text and its panel is aria-hidden, since the name sits beside it, so a screen reader hears the member once; it loads
 *  lazily and decodes off the main thread, for a long member list; a portrait that fails to load falls back to the initials tile; an optional focus prop overrides
 *  --member-portrait-focus per member, which is the socket the parked crop step lands in; and the three-action compact band steps its words a rung down, so Connected,
 *  Message and Following never collide at 360.
 *  The Connect action carries the Connect mark (nkonsonkonson). The dock draws that mark bare; here it is always enclosed in a control whose fill is the request's state:
 *  solid --c-connect to send, a dashed edge while the request waits, --c-connect-tint once it is granted. So the states read as a request, never as navigation. */
const MARK = (size: number) => {
  const m = "url(" + assetBase() + "adinkra/nkonsonkonson.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: "currentColor",
        WebkitMask: m,
        mask: m,
        flex: "none",
      }}
    />
  );
};
type Tone = "fill" | "tint" | "wait" | "ghost";
const TONE: Record<
  Tone,
  { background: string; color: string; borderColor: string; borderStyle?: string }
> = {
  fill: {
    background: "var(--c-connect)",
    color: "var(--c-connect-ink)",
    borderColor: "transparent",
  },
  tint: {
    background: "var(--c-connect-tint)",
    color: "var(--c-connect-text)",
    borderColor: "transparent",
  },
  wait: {
    background: "transparent",
    color: "var(--ink-3)",
    borderColor: "var(--line-strong)",
    borderStyle: "dashed",
  },
  ghost: { background: "transparent", color: "var(--ink-2)", borderColor: "transparent" },
};
/** The icon-only compact square that 1470 first ruled is gone: 1489 rules the word beside the mark, which is Wide below. */
/** A labelled state at medium and expanded: the same tones as Square, read as words. */
function Pill({
  icon,
  text,
  tone,
  touch,
}: {
  icon?: string | undefined;
  text: string;
  tone: Tone;
  touch: boolean;
}) {
  const t = TONE[tone];
  return (
    <span
      style={{
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        minHeight: touch ? "var(--target-primary)" : 36,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-m)",
        border: "var(--border-thin) " + (t.borderStyle || "solid") + " " + t.borderColor,
        background: t.background,
        color: t.color,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-s)",
        lineHeight: 1,
        fontWeight: "var(--weight-medium)",
        whiteSpace: "nowrap",
      }}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {text}
    </span>
  );
}
/** The compile's joinNames, through the platform's one joiner (src/lib/names.ts): "{lead} A, B and C." */
const mutualsLine = (names: string[], lead: string) => lead + " " + joinNames(names) + ".";
/** The name is never truncated, never abbreviated and never wrapped: the whole of it sits on one lane at every tier.
 *  It is measured against its own lane and the size steps down until it fits, to --member-name-min-* and no further (1491).
 *  At that floor the order of giving is: the lane first (promotion to the card's head), then the line count (the name wraps to a second line). The size never goes below the floor, so the name is always legible and always whole. The settled size is published to the column as --_member-name-fitted, and the @handle, headline and location take the lesser of their own rung and a share of it,
 *  so the name stays the largest line in the card however far the fit had to go. An ordinary name never triggers this: at full size the rungs win. Hardened: width and height are both checked; the first step is proportional, so a long name settles in a couple of passes instead of sixty;
 *  it refits when the display face finishes loading, since the fallback's metrics measure differently; it refits when the lane resizes, observing the lane and not itself, so changing
 *  the size cannot feed back into another measurement; and it bails while the lane has no width, as in a card not yet shown.
 *  The authored rung is carried as --_member-name-base on the element, so each pass re-asserts it before measuring instead of clearing the inline value React owns. */
function useFitName(
  wide: boolean,
  head: boolean,
  deps: unknown[],
  onBreach: (() => void) | undefined,
) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lane = el.parentElement;
    let busy = false;
    const fit = () => {
      if (busy) return;
      busy = true;
      el.style.fontSize = "var(--_member-name-base)"; // re-assert the authored rung rather than clearing it: React diffs against its own props and would never restore a cleared inline value
      el.style.whiteSpace = "nowrap";
      const cs = getComputedStyle(el);
      const floor =
        parseFloat(
          cs.getPropertyValue(wide ? "--member-name-min-wide" : "--member-name-min-compact"),
        ) || (wide ? 18 : 15);
      let s = parseFloat(cs.fontSize);
      const over = () =>
        el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5;
      if (el.clientWidth > 0 && over()) {
        const guess = Math.max(floor, Math.floor(s * (el.clientWidth / el.scrollWidth) * 2) / 2);
        if (guess < s) {
          s = guess;
          el.style.fontSize = s + "px";
        }
        for (let i = 0; i < 24 && s > floor && over(); i++) {
          s = Math.max(floor, s - 0.5);
          el.style.fontSize = s + "px";
        }
        if (over()) {
          // at the floor the size has given all it may (1491). The lane gives next, and after that the line count: the name wraps rather than shrink into illegibility
          if (!head && onBreach) onBreach();
          else {
            el.style.whiteSpace = "normal";
            el.style.overflow = "visible";
          }
        }
      }
      const host = (el.closest("[data-member-card]") as HTMLElement | null) || lane; // the settled size is published to the card, so every line under the name scales from it wherever it sits and the hierarchy survives whatever the fit lands on
      if (host) host.style.setProperty("--_member-name-fitted", s + "px");
      busy = false;
    };
    fit();
    if (document.fonts && document.fonts.status !== "loaded") void document.fonts.ready.then(fit);
    if (typeof ResizeObserver !== "function" || !lane) return;
    const ro = new ResizeObserver(fit);
    ro.observe(lane);
    return () => ro.disconnect();
    // The compile passes the caller's own dependency list through; the hook measures what that list names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
/** Compact's action: the mark or icon with its word, sharing the band's width, 44px tall. tight is the three-action band at 360, a rung down so the words never collide. */
function Wide({
  mark,
  icon,
  text,
  label,
  tone,
  onClick,
  status,
  tight,
  solo,
  testid,
}: {
  mark?: boolean | undefined;
  icon?: string | undefined;
  text: string;
  label: string;
  tone: Tone;
  onClick?: (() => void) | undefined;
  status?: boolean | undefined;
  tight?: boolean | undefined;
  solo?: boolean | undefined;
  testid?: string | undefined;
}) {
  const t = TONE[tone];
  const [hover, setHover] = useState(false),
    [down, setDown] = useState(false);
  const g = tight ? 14 : 16;
  const glyph = mark ? MARK(g) : icon ? <Icon name={icon} size={g} /> : null;
  const box: CSSProperties = {
    boxSizing: "border-box",
    display: "inline-flex",
    flex: solo ? "0 0 auto" : "1 1 0",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-1)",
    minHeight: "var(--target-primary)",
    padding: solo ? "0 var(--space-3)" : "0 var(--space-1)",
    borderRadius: "var(--radius-m)",
    border: "var(--border-thin) " + (t.borderStyle || "solid") + " " + t.borderColor,
    background: t.background,
    color: t.color,
    fontFamily: "var(--font-sans)",
    fontSize: tight ? "var(--text-xs)" : "var(--text-s)",
    lineHeight: 1,
    fontWeight: "var(--weight-medium)",
    whiteSpace: "nowrap",
  };
  if (status)
    return (
      <span role="img" aria-label={label} style={box}>
        {glyph}
        {text}
      </span>
    );
  const fx: CSSProperties =
    tone === "fill"
      ? { filter: down ? "brightness(0.86)" : hover ? "brightness(0.92)" : "none" }
      : { background: down ? "var(--line)" : hover ? "var(--bg-sunken)" : t.background };
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testid}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDown(false);
      }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{ ...box, ...fx, cursor: "pointer", outlineOffset: "var(--focus-offset)" }}
    >
      {glyph}
      {text}
    </button>
  );
}

export function MemberCard({
  name = "",
  handle,
  headline,
  location,
  src,
  focus,
  identified = false,
  attestations = [],
  context = "members",
  connection = "none",
  following = false,
  canMessage,
  mutuals = [],
  mutualsLead = "You both know",
  reason,
  since,
  note,
  tier = "expanded",
  input,
  href,
  onOpen,
  onConnect,
  onMessage,
  onFollow,
  onAccept,
  onDismiss,
  onWithdraw,
  style,
}: MemberCardProps) {
  const [hot, setHot] = useState(false);
  const touch = input
    ? input === "touch"
    : typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const compact = tier === "compact";
  const size = touch ? "md" : "sm";
  const portraitWidth = compact
    ? "var(--member-portrait-compact)"
    : tier === "medium"
      ? "var(--member-portrait-medium)"
      : "var(--member-portrait-expanded)";
  const portraitHeight = "calc(" + portraitWidth + " * 5 / 4)"; // 1541: the 4:5 crop at the tier width. The panel is this tall and no taller, whatever the column beside it does
  const rowMin = "calc(" + portraitHeight + " + 2 * var(--member-portrait-inset))"; // the row holding the portrait is never shorter than the panel's own 4:5 crop and its inset, at every tier, so the photograph's height is intrinsic and never what the bands around it leave over
  const open = onOpen
    ? (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          onOpen();
        }
      }
    : undefined;
  // The repo's Avatar draws the photograph and, when it fails to load, the initials (Fix PR 10 item
  // 6); its style prop sets the panel-filling frame, the focal point and the compile's initials tile.
  const leading = (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--bg-sunken)",
        borderRadius: "var(--member-portrait-radius)",
        boxShadow: "var(--member-portrait-shadow)",
        overflow: "hidden",
      }}
    >
      <Avatar
        name={name}
        src={src}
        size="100%"
        radius={0}
        initialSize="var(--display-m)"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: focus || "var(--member-portrait-focus)",
          display: "flex",
          background: "var(--bg-sunken)",
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          lineHeight: 1,
          color: "var(--ink-3)",
          letterSpacing: "0.02em",
        }}
      />
    </span>
  );
  // the mark sits on this wrapper, not inside the panel and not inside the panel's link: both are aria-hidden, so a mark placed in them would be silent, and inside the link it would be a second route to the same profile
  const portrait = (
    <span
      data-field="portrait"
      data-testid="portrait"
      style={{
        position: "relative",
        flex: "none",
        width: portraitWidth,
        height: portraitHeight,
        alignSelf: "flex-start",
        margin: "var(--member-portrait-inset)",
      }}
    >
      {href ? (
        <a
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          onClick={open}
          style={{ position: "absolute", inset: 0, display: "block", textDecoration: "none" }}
        >
          {leading}
        </a>
      ) : (
        leading
      )}
      {identified ? (
        <IdentityMark
          style={{
            position: "absolute",
            right: "var(--member-mark-offset)",
            bottom: "var(--member-mark-offset)",
          }}
        />
      ) : null}
    </span>
  );

  const message = canMessage != null ? canMessage : connection === "connected"; // 1336 to 1339 decide where Message may appear; the caller passes canMessage where they allow it
  const base: (string | null)[] =
    context === "requests"
      ? ["accept", "dismiss"]
      : context === "sent"
        ? ["pending", onWithdraw ? "withdraw" : null]
        : connection === "pending"
          ? ["pending", "follow"]
          : connection === "connected"
            ? ["connected", message ? "message" : null, "follow"]
            : ["connect", "follow"];
  const acts = (context === "suggested" ? base.concat("dismiss") : base).filter(
    (k): k is string => !!k,
  ); // a member can refuse a suggestion from the card, so DIA's suggestions are tunable where they are read
  const tight = compact && acts.length > 2;
  const solo = compact && (acts.length === 1 || context === "sent"); // a lone Pending is a state, not a control: it sizes to its words rather than stretching the band, which would read as a button. With Withdraw beside it (1534) both size to their words, so the quiet control stays quiet
  const draw: Record<string, () => ReactNode> = {
    connect: () =>
      compact ? (
        <Wide
          mark
          text="Connect"
          label={"Connect with " + name}
          tone="fill"
          onClick={onConnect}
          tight={tight}
        />
      ) : (
        <Button c="connect" size={size} onClick={onConnect} style={{ gap: "var(--space-2)" }}>
          {MARK(18)}Connect
        </Button>
      ),
    pending: () =>
      compact ? (
        <Wide
          mark
          text="Pending"
          label="Request pending"
          tone="wait"
          status
          tight={tight}
          solo={solo}
        />
      ) : (
        <Pill tone="wait" text="Pending" touch={touch} />
      ),
    withdraw: () =>
      compact ? (
        <Wide
          icon="x"
          text="Withdraw"
          label={"Withdraw the request to " + name}
          tone="ghost"
          onClick={onWithdraw}
          tight={tight}
          solo={solo}
        />
      ) : (
        <Button
          variant="ghost"
          size={size}
          onClick={onWithdraw}
          aria-label={"Withdraw the request to " + name}
        >
          Withdraw
        </Button>
      ),
    connected: () =>
      compact ? (
        <Wide mark text="Connected" label="Connected" tone="tint" status tight={tight} />
      ) : (
        <Pill tone="tint" icon="check" text="Connected" touch={touch} />
      ),
    message: () =>
      compact ? (
        <Wide
          icon="message-circle"
          text="Message"
          label={"Message " + name}
          tone="fill"
          onClick={onMessage}
          tight={tight}
          testid="card-message"
        />
      ) : (
        <Button c="connect" size={size} onClick={onMessage} data-testid="card-message">
          Message
        </Button>
      ),
    follow: () =>
      compact ? (
        <Wide
          icon={following ? "check" : "user-plus"}
          text={following ? "Following" : "Follow"}
          label={following ? "Following " + name : "Follow " + name}
          tone={following ? "tint" : "ghost"}
          onClick={onFollow}
          tight={tight}
        />
      ) : (
        <Button variant={following ? "secondary" : "ghost"} size={size} onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </Button>
      ),
    accept: () =>
      compact ? (
        <Wide
          icon="check"
          text="Accept"
          label={"Accept " + name}
          tone="fill"
          onClick={onAccept}
          tight={tight}
        />
      ) : (
        <Button c="connect" size={size} onClick={onAccept}>
          Accept
        </Button>
      ),
    dismiss: () =>
      compact ? (
        <Wide
          icon="x"
          text="Dismiss"
          label={context === "suggested" ? "Dismiss this suggestion" : "Dismiss " + name}
          tone="ghost"
          onClick={onDismiss}
          tight={tight}
        />
      ) : (
        <Button
          variant="ghost"
          size={size}
          onClick={onDismiss}
          aria-label={context === "suggested" ? "Dismiss this suggestion" : undefined}
        >
          Dismiss
        </Button>
      ),
  };
  const actionList = acts.map((k) => <Fragment key={k}>{draw[k]?.()}</Fragment>);

  const [promote, setPromote] = useState(false); // a name the column beside the portrait cannot hold at its floor takes a lane of its own across the card's head, at any tier
  const lastFit = useRef(name + "|" + tier);
  if (lastFit.current !== name + "|" + tier) {
    lastFit.current = name + "|" + tier;
    if (promote) setPromote(false);
  }
  const head = compact || promote; // the name sits in its own lane across the card's head
  const nameRef = useFitName(!compact, head, [name, tier, promote], () => setPromote(true));
  const nameEl = (
    <span
      ref={nameRef}
      data-field="name"
      style={
        {
          "--_member-name-base": tier === "expanded" ? "var(--display-m)" : "var(--display-s)",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--_member-name-base)",
          lineHeight: tier === "expanded" ? "var(--display-m-lh)" : "var(--display-s-lh)",
          minWidth: 0,
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
        } as CSSProperties
      }
    >
      {name}
    </span>
  );
  const showReason = context === "suggested" && !!reason; // DIA's sentence is the suggestion's own; the mutual names are not, and draw wherever there are mutuals
  const hasContext =
    !!since || !!note || mutuals.length > 0 || attestations.length > 0 || showReason;
  const contextBlock = hasContext ? (
    <div
      data-field="context"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}
    >
      {since ? (
        <span
          data-field="since"
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            color: "var(--ink-3)",
          }}
        >
          {since}
        </span>
      ) : null}
      {note ? (
        <span
          data-field="note"
          style={{
            fontSize: compact ? "var(--text-xs)" : "var(--text-s)",
            lineHeight: 1.5,
            color: "var(--ink-2)",
            background: "var(--bg-sunken)",
            borderRadius: "var(--radius-m)",
            padding: "var(--space-2) var(--space-3)",
            textWrap: "pretty",
          }}
        >
          {note}
        </span>
      ) : null}
      {mutuals.length ? (
        <span
          data-field="mutuals"
          data-testid="mutuals"
          style={{
            fontSize: compact ? "var(--text-xs)" : "var(--text-s)",
            lineHeight: "var(--text-s-lh)",
            color: "var(--ink-2)",
            textWrap: "pretty",
          }}
        >
          {mutualsLine(mutuals, mutualsLead)}
        </span>
      ) : null}
      {attestations.length ? (
        <BadgeRow
          attestations={attestations}
          compact={compact}
          style={{ marginTop: "var(--space-1)" }}
        />
      ) : null}
      {showReason ? (
        <div data-field="reason" data-testid="reason" style={{ minWidth: 0 }}>
          <DiaLine state="done" text={reason} style={{ fontSize: "var(--text-s)", minHeight: 0 }} />
        </div>
      ) : null}
    </div>
  ) : null;
  const nameBlock = href ? (
    <a
      href={href}
      onClick={open}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      style={{
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        color: "var(--ink)",
        textDecorationLine: hot && !touch ? "underline" : "none",
        textDecorationColor: "var(--line-strong)",
        textUnderlineOffset: "2px",
        outlineOffset: "var(--focus-offset)",
        borderRadius: "var(--radius-s)",
      }}
    >
      {nameEl}
    </a>
  ) : (
    nameEl
  );
  const identity = (
    <div
      data-field="identity"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: compact ? "center" : "flex-start",
        gap: compact ? "var(--space-1)" : "var(--space-2)",
        flex: 1,
        minWidth: 0,
        padding: compact
          ? "var(--space-2) var(--member-portrait-inset) var(--member-portrait-inset)"
          : head
            ? "var(--space-2) var(--space-4) var(--space-3)"
            : "var(--space-3) var(--space-4)",
      }}
    >
      {head ? null : nameBlock}
      {handle ? (
        <span
          data-field="handle"
          style={{
            fontSize:
              "max(12px, min(var(--text-s), calc(var(--_member-name-fitted, 99px) * 0.85)))",
            lineHeight: "var(--text-s-lh)",
            color: "var(--ink-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {handle}
        </span>
      ) : null}
      {headline ? (
        <span
          data-field="headline"
          title={headline}
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: compact
              ? "max(12px, min(var(--text-xs), calc(var(--_member-name-fitted, 99px) * 0.8)))"
              : "max(12px, min(var(--text-s), calc(var(--_member-name-fitted, 99px) * 0.8)))",
            lineHeight: 1.45,
            color: "var(--ink)",
            textWrap: "pretty",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {headline}
        </span>
      ) : null}
      {location ? (
        <span
          data-field="location"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-1)",
            fontSize: compact
              ? "max(12px, min(var(--text-xs), calc(var(--_member-name-fitted, 99px) * 0.8)))"
              : "var(--text-s)",
            lineHeight: compact ? "var(--text-xs-lh)" : "var(--text-s-lh)",
            color: "var(--ink-2)",
            minWidth: 0,
            textWrap: "pretty",
          }}
        >
          <Icon
            name="map-pin"
            size={compact ? 13 : 14}
            style={{ color: "var(--ink-4)", flex: "none", marginTop: "0.15em" }}
          />
          {location}
        </span>
      ) : null}
      {compact ? null : contextBlock}
      {compact ? null : (
        <div
          data-field="actions"
          data-testid="card-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: acts.length > 2 ? "var(--space-1)" : "var(--space-2)",
            marginTop: "auto",
            paddingTop: "var(--space-2)",
            alignSelf: "stretch",
          }}
        >
          {actionList}
        </div>
      )}
    </div>
  );
  const body = (
    <div
      data-field="body"
      style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, minHeight: rowMin }}
    >
      {portrait}
      {identity}
    </div>
  );
  const card = (
    <div
      data-member-card={context}
      data-testid="member-card"
      data-tier={tier}
      data-name-lane={head ? "head" : "column"}
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: compact ? "var(--member-card-min-height)" : 0,
        background: "var(--surface)",
        border:
          "var(--border-thin) solid " + (hot && !touch ? "var(--line-strong)" : "var(--line)"),
        borderRadius: "var(--radius-l)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        transition: "border-color var(--dur-default) var(--ease)",
        ...style,
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
    >
      {head ? (
        <div
          data-field="nameRow"
          style={{
            minWidth: 0,
            overflow: "hidden",
            padding: compact
              ? "var(--member-portrait-inset) var(--member-portrait-inset) 0"
              : "var(--member-portrait-inset) var(--space-4) 0",
          }}
        >
          {nameBlock}
        </div>
      ) : null}
      {body}
      {compact && contextBlock ? (
        <div style={{ padding: "0 var(--member-portrait-inset) var(--space-3)" }}>
          {contextBlock}
        </div>
      ) : null}
      {compact ? (
        <div
          data-field="actions"
          data-testid="card-actions"
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: "var(--space-1)",
            padding: "var(--space-2)",
            borderTop: "var(--border-thin) solid var(--line)",
          }}
        >
          {actionList}
        </div>
      ) : null}
    </div>
  );
  return card;
}

/** MemberCardSkeleton (ruling 1499): the card's own shell while the member is still loading, not a generic grey block.
 *  It draws what the card draws — the name lane, the portrait panel at its 4:5 minimum, two content lines, and the action band at compact — from the same tokens and
 *  the same tier widths, so a list does not reflow when the data lands. Static --bg-sunken blocks: no shimmer and no pulse, since nothing else in Strand animates a
 *  placeholder and a moving card in a long list reads as activity the member does not have.
 *  aria-hidden, with no text: the list that draws it owns aria-busy, so a screen reader is told the list is loading once rather than once per card. */
export function MemberCardSkeleton({
  tier = "expanded",
  style,
}: {
  tier?: Tier | undefined;
  style?: CSSProperties | undefined;
}) {
  const compact = tier === "compact";
  const portraitWidth = compact
    ? "var(--member-portrait-compact)"
    : tier === "medium"
      ? "var(--member-portrait-medium)"
      : "var(--member-portrait-expanded)";
  const rowMin = "calc(" + portraitWidth + " * 5 / 4 + 2 * var(--member-portrait-inset))";
  const blk = (w: string | number, h: string | number, r?: string) => (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        borderRadius: r || "var(--radius-s)",
        background: "var(--bg-sunken)",
      }}
    />
  );
  const lane = (
    <div
      style={{
        padding: compact
          ? "var(--member-portrait-inset) var(--member-portrait-inset) 0"
          : "var(--member-portrait-inset) var(--space-4) 0",
      }}
    >
      {blk("62%", tier === "expanded" ? 30 : 26)}
    </div>
  );
  const lines = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        flex: 1,
        minWidth: 0,
        justifyContent: compact ? "center" : "flex-start",
        padding: compact
          ? "var(--space-2) var(--member-portrait-inset) var(--member-portrait-inset)"
          : "var(--space-2) var(--space-4) var(--space-3)",
      }}
    >
      {blk("45%", 13)}
      {blk("80%", 13)}
      {compact ? null : (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)",
            marginTop: "auto",
            paddingTop: "var(--space-2)",
          }}
        >
          {blk(104, 36, "var(--radius-m)")}
          {blk(84, 36, "var(--radius-m)")}
        </div>
      )}
    </div>
  );
  return (
    <div
      data-member-card-skeleton={tier}
      aria-hidden="true"
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: compact ? "var(--member-card-min-height)" : 0,
        background: "var(--surface)",
        border: "var(--border-thin) solid var(--line)",
        borderRadius: "var(--radius-l)",
        overflow: "hidden",
        ...style,
      }}
    >
      {lane}
      <div
        style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, minHeight: rowMin }}
      >
        <span
          style={{
            flex: "none",
            width: portraitWidth,
            height: "calc(" + portraitWidth + " * 5 / 4)",
            alignSelf: "flex-start",
            margin: "var(--member-portrait-inset)",
            background: "var(--bg-sunken)",
            borderRadius: "var(--member-portrait-radius)",
          }}
        />
        {lines}
      </div>
      {compact ? (
        <div
          style={{
            display: "flex",
            gap: "var(--space-1)",
            padding: "var(--space-2)",
            borderTop: "var(--border-thin) solid var(--line)",
          }}
        >
          {blk("50%", "var(--target-primary)", "var(--radius-m)")}
          {blk("50%", "var(--target-primary)", "var(--radius-m)")}
        </div>
      ) : null}
    </div>
  );
}
