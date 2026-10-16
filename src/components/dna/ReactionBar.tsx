// Handoff 62-A, SPEC-62-FEED-CARD 3 (rulings 1798, 1818, 1821, 1633, 1651): the quick bar in
// PostCard's `below` slot. Left to right: the four public reactions, a rule, the two intents, then
// a rule and up to five of the member's most recent picker emoji newest first, all in one strip that
// scrolls sideways (swipe on touch; the wheel, ArrowLeft and ArrowRight on pointer, and at compact
// on pointer two arrows flanking the strip); then the plus, pinned outside the strip so it never
// moves, which opens the full picker. Every character renders as text (EmojiText, 1818). The held
// public reaction and each on intent read aria-pressed; choosing the held one removes it (1817).
// Names: the label on pointer hover through Tooltip; on touch a 500 ms hold shows the label above
// the entry for 1.2 s after release and the tap that ends the hold does nothing (1632, 1633). Asante
// reads Q.asanteA11y, a recent reads its emoji name. Strand's ReactionPicker quick view draws the
// Messenger's eight through ReactionMark with More inside the scrolling row, so the bar is composed
// here from buttons, Tooltip and IconButton until Strand lands the proposal (SPEC 12 proposal 2;
// the G entry in docs/GAPS.md). Closing on a pick, Escape and a tap outside is the host's.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from "react";
import { IconButton } from "@/components/strand/IconButton";
import { Tooltip } from "@/components/strand/Tooltip";
import type { OwnReaction } from "@/lib/reactions";
import { accessibleLabel, visibleLabel } from "@/lib/reactions";
import type { Mode, Tier } from "@/lib/tier";
import type { PostReactionKindRow } from "@/lib/vocabularies";
import { EmojiText } from "./EmojiText";

export const HOLD_MS = 500;
const SHOWN_MS = 1200;

export type ReactionBarProps = {
  /** The six, in the vocabulary's order. */
  kinds: readonly PostReactionKindRow[];
  own: OwnReaction | null;
  intents: readonly string[];
  /** Up to five, newest first, each with the vocabulary's name where it has one. */
  recents: readonly { emoji: string; label: string | null }[];
  onPick: (kind: string, emoji?: string) => void;
  onIntent: (kind: string) => void;
  onMore: () => void;
  mode: Mode;
  tier: Tier;
  /** The plus, for the full picker's Popover on pointer. */
  plusRef?: RefObject<HTMLElement | null> | undefined;
  language?: string | undefined;
  style?: CSSProperties | undefined;
};

/** A touch hold that names an entry (1633): held for HOLD_MS, shown SHOWN_MS after release, the release's tap swallowed. */
function useHoldName(touch: boolean) {
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const hide = useRef<number | null>(null);
  const held = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (hide.current) window.clearTimeout(hide.current);
    },
    [],
  );
  const bind = (key: string) =>
    touch
      ? {
          onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
            if (e.pointerType === "mouse") return;
            held.current = null;
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
              held.current = key;
              setShown(key);
            }, HOLD_MS);
          },
          onPointerUp: () => {
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = null;
            if (hide.current) window.clearTimeout(hide.current);
            hide.current = window.setTimeout(() => setShown(null), SHOWN_MS);
          },
          onPointerCancel: () => {
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = null;
            held.current = null;
            setShown(null);
          },
          onPointerLeave: () => {
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = null;
          },
          onContextMenu: (e: PointerEvent<HTMLButtonElement> | { preventDefault: () => void }) =>
            e.preventDefault(),
        }
      : { onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault() };
  /** Wraps a click so the tap that ends a hold does nothing. */
  const guard = (key: string, fn: () => void) => () => {
    if (held.current === key) {
      held.current = null;
      return;
    }
    fn();
  };
  return { shown, bind, guard };
}

export function ReactionBar({
  kinds,
  own,
  intents,
  recents,
  onPick,
  onIntent,
  onMore,
  mode,
  tier,
  plusRef,
  language,
  style,
}: ReactionBarProps) {
  const touch = mode === "touch";
  const size = touch ? 44 : 36;
  const strip = useRef<HTMLDivElement>(null);
  const hold = useHoldName(touch);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setEntered(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const publicKinds = kinds.filter((k) => k.class === "public");
  const intentKinds = kinds.filter((k) => k.class === "intent");
  const showArrows = !touch && tier === "compact" && recents.length > 0;

  const entryStyle = (pressed: boolean): CSSProperties => ({
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    width: size,
    height: size,
    flex: "none",
    borderRadius: "var(--radius-pill)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    scrollSnapAlign: "start",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    background: pressed ? "var(--bg-sunken)" : "transparent",
    boxShadow: pressed ? "inset 0 0 0 1.5px var(--ink)" : "none",
  });

  const entry = (
    key: string,
    emoji: string,
    name: string,
    visible: string,
    pressed: boolean,
    act: () => void,
    data: Record<string, string>,
  ): ReactNode => (
    <Tooltip
      key={key}
      label={visible}
      input={mode}
      placement="top"
      open={touch ? hold.shown === key : undefined}
      style={{ flex: "none" }}
    >
      <button
        type="button"
        aria-label={name}
        aria-pressed={pressed}
        data-reaction-entry={key}
        {...data}
        {...hold.bind(key)}
        onClick={hold.guard(key, act)}
        style={entryStyle(pressed)}
      >
        <EmojiText emoji={emoji} size={24} />
      </button>
    </Tooltip>
  );

  const rule = (key: string) => (
    <span
      key={key}
      aria-hidden="true"
      style={{
        width: 1,
        height: 24,
        background: "var(--line-strong)",
        margin: "0 4px",
        flex: "none",
      }}
    />
  );

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = strip.current;
    if (!el || touch) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const el = strip.current;
    if (!el) return;
    const entries = [...el.querySelectorAll<HTMLButtonElement>("button[data-reaction-entry]")];
    const i = entries.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const next = entries[e.key === "ArrowRight" ? i + 1 : i - 1];
    if (!next) return;
    e.preventDefault();
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const scrollBy = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div
      data-reaction-bar=""
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: "var(--radius-pill)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-3)",
        maxWidth: "100%",
        boxSizing: "border-box",
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(4px)",
        transition:
          "opacity var(--dur-default) var(--ease), transform var(--dur-default) var(--ease)",
        ...style,
      }}
    >
      {showArrows && (
        <IconButton
          name="chevron-left"
          label="Scroll back"
          size={36}
          input={mode}
          onClick={() => scrollBy(-120)}
        />
      )}
      <div
        ref={strip}
        role="group"
        aria-label="React"
        data-reaction-strip=""
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          overflowX: "auto",
          scrollbarWidth: "none",
          scrollSnapType: "x proximity",
          minWidth: 0,
          flex: "0 1 auto",
        }}
      >
        {publicKinds.map((k) =>
          entry(
            k.value,
            k.emoji,
            accessibleLabel(k, language),
            visibleLabel(k, language),
            !!own && own.kind === k.value,
            () => onPick(k.value),
            { "data-reaction-kind": k.value },
          ),
        )}
        {intentKinds.length > 0 && rule("rule-intents")}
        {intentKinds.map((k) =>
          entry(
            k.value,
            k.emoji,
            k.label,
            k.label,
            intents.includes(k.value),
            () => onIntent(k.value),
            {
              "data-reaction-intent": k.value,
            },
          ),
        )}
        {recents.length > 0 && rule("rule-recents")}
        {recents.length > 0 && (
          <span
            role="group"
            aria-label="Recent"
            data-reaction-recents=""
            style={{ display: "contents" }}
          >
            {recents.map((r) =>
              entry(
                "recent:" + r.emoji,
                r.emoji,
                r.label ?? r.emoji,
                r.label ?? r.emoji,
                !!own && own.kind === "other" && own.emoji === r.emoji,
                () => onPick("other", r.emoji),
                { "data-reaction-recent": r.emoji },
              ),
            )}
          </span>
        )}
      </div>
      {showArrows && (
        <IconButton
          name="chevron-right"
          label="Scroll on"
          size={36}
          input={mode}
          onClick={() => scrollBy(120)}
        />
      )}
      <span
        ref={plusRef as RefObject<HTMLSpanElement | null>}
        style={{ display: "inline-flex", flex: "none", marginLeft: 4 }}
      >
        <IconButton
          name="plus"
          label="More"
          size={size}
          input={mode}
          aria-haspopup="dialog"
          data-reaction-more=""
          onClick={onMore}
        />
      </span>
    </div>
  );
}
