// Strand `components/dna/BrowseTile.jsx` at compile v1790410319010950 (correction 30 Part A ask 4,
// ruling 1133; its sizes tokens since correction 31 item 1; ratified together under 1153; handoff
// 33-D). New to the tree; no page binds it in this handoff (the first Discovery handoff and Brief 10
// Revision 4 do). The compile takes `input` and reads nothing from it, and the port does the same.
// Dispositions are in docs/strand-ports/v1790410319010950.md.
import { useState, type CSSProperties, type MouseEvent } from "react";
import { Icon } from "./Icon";
import type { C } from "./cmeta";
import type { Mode } from "@/lib/tier";

export type BrowseTileProps = {
  /** topic: the topic's name and the next date in that topic. place: the place's name and its country. Default topic. */
  kind?: "topic" | "place";
  /** Rendered as passed. */
  name?: string;
  /** topic: the next date, composed by the caller (the only digits a tile may carry). place: the country. */
  detail?: string | undefined;
  /** The tile's facet is applied: --c-convene-tint face, the 1.5px --c-convene frame, a check before the detail. */
  selected?: boolean | undefined;
  /** Default convene. */
  c?: C;
  /** The narrowed lane's address: the tile renders as an anchor. */
  href?: string | undefined;
  /** Applies or removes the facet. With href a plain primary click calls it and prevents the default. */
  onSelect?: (() => void) | undefined;
  /** Alias of onSelect. */
  onClick?: (() => void) | undefined;
  /** Accessible name when the visible text is not enough. */
  label?: string | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

/** Correction 30 (Part A, ask 4; 1133). A tile for Discovery's Browse lane, in the discovery face's visual language, as v5 draws it. Two kinds: topic (the topic's name and the next date in
 *  that topic) and place (the place's name and its country). Both render text as passed. Read off v5 and held as tokens since correction 31 (--browse-tile-width 180, --browse-tile-min-height 84): padding 12 14 (carried to --space-3), radius 14 (--radius-l),
 *  --surface with a 1px --line edge; selected takes --c-convene-tint with the 1.5px --c-convene frame (--border-card, the C frame) and a check before the detail line in the C's text rung;
 *  name in the display face (v5 19/1.2, carried to --display-s), detail 13 --ink-3 (--text-xs), the two spaced apart with 6 between (carried to --space-2). Pressed: --bg-sunken while the
 *  pointer is down. One tap target per tile, the whole face; its 84 clears 44 on touch and 36 on pointer. No count, and no digit other than the date the caller passes. */
export function BrowseTile({
  kind = "topic",
  name = "",
  detail,
  selected = false,
  c = "convene",
  href,
  onClick,
  onSelect,
  label,
  style,
}: BrowseTileProps) {
  const [down, setDown] = useState(false);
  const act = onSelect || onClick;
  const bg =
    down && !selected
      ? "var(--bg-sunken)"
      : selected
        ? "var(--c-" + c + "-tint)"
        : "var(--surface)";
  const s: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    flex: "none",
    width: "var(--browse-tile-width)",
    minHeight: "var(--browse-tile-min-height)",
    padding: "var(--space-3)",
    borderRadius: "var(--radius-l)",
    background: bg,
    border: selected
      ? "var(--border-card) solid var(--c-" + c + ")"
      : "var(--border-thin) solid var(--line)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "var(--space-2)",
    fontFamily: "var(--font-sans)",
    color: "var(--ink)",
    textDecoration: "none",
    transition: "background var(--dur-default) var(--ease)",
    outlineOffset: "var(--focus-offset)",
    ...style,
  };
  const press = {
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    onPointerCancel: () => setDown(false),
  };
  const body = (
    <>
      <span
        data-field="name"
        style={
          {
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--display-s)",
            lineHeight: "var(--display-s-lh)",
            textWrap: "pretty",
          } as CSSProperties
        }
      >
        {name}
      </span>
      {detail ? (
        <span
          data-field="detail"
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            color: selected ? "var(--c-" + c + "-text)" : "var(--ink-3)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
          }}
        >
          {selected ? <Icon name="check" size="var(--icon-inline)" /> : null}
          <span style={{ minWidth: 0 }}>{detail}</span>
        </span>
      ) : null}
    </>
  );
  const common = {
    "data-browse-tile": kind,
    "aria-pressed": selected,
    "aria-label": label,
    ...press,
  };
  if (href)
    return (
      <a
        {...common}
        href={href}
        onClick={
          act
            ? (e: MouseEvent<HTMLAnchorElement>) => {
                if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  act();
                }
              }
            : undefined
        }
        style={s}
      >
        {body}
      </a>
    );
  return (
    <button type="button" {...common} onClick={act} style={s}>
      {body}
    </button>
  );
}
