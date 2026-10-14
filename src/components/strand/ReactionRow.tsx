// Ported from Strand components/dna/ReactionRow.jsx at compile sha256-b1a458dac1bd562f (brief
// 60-SP item 4; FC 5.2 item 4; 69, 72, 1651, 1674, 1676; ratified 1728; handoff H61-SP). New to the
// tree: the reaction pills under a message or a post, lifted out of MessageBubble so both read one
// part. One pill per distinct emoji string, the glyph at 18 (drawn for the quick eight, native
// otherwise, a hand in the tone its own modifier names), --radius-pill, 32 tall on touch and
// --target-min on pointer, 4 apart, wrapping. Never a count, anywhere. `names` (default true), the
// Messenger's: the names the surface has joined (1602) follow the glyph in 13px --ink-2, --surface,
// --line, --line-strong when the member is among them. `names={false}`, the Feed's (1674): the glyph
// alone, the viewer's own pill outlined in --ink on --bg-sunken, aria-pressed; the row is
// role="group" named "Reactions" (F3). `onSeeWho` (the post's author only, 1676) adds See who
// reacted (F5) as a text act after the last pill. A press calls onReact with the pill's emoji.
// Motion: the pressed glyph, or the one `pop` names, scales to 1.4 and back once over --dur-slow.
//
// Translations, none visible. The compile draws the glyph through its ReactionEmoji, which reads the
// tone hex off Strand's own SKIN_TONES; the tree keeps the tone hexes in src/lib/emoji.ts, the
// Messenger's one tone source (1404, 1577), so a pill carries `toneFill` from the caller and draws
// through ReactionMark, as MessageBubble's pills already did. The pill's name comes from `label`
// (E9's name from the vocabulary, 1629) or `nameOf`, where the compile reads its QUICK_REACTIONS
// literal. The pop is the tree's `b14-pop` rule in strand.css, which the compile writes as an inline
// keyframe; the class is also the hook tests/messenger.cjs reads. `data-reaction` and
// `data-reaction-label` are the same arm's hooks, carried from MessageBubble. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import { useState, type CSSProperties } from "react";
import { ReactionMark } from "./ReactionGlyph";
import { baseOf } from "@/lib/emoji";
import { useMode, type Mode } from "@/lib/tier";

export type ReactionRowItem = {
  /** The stored character, with its own modifier where it carries one. */
  emoji: string;
  /** E9's glyph name for one of the eight, else the character's name; the accessible name's head. */
  label?: string | undefined;
  /** Already joined in words by the surface (1602): "Ama and Nana", "you". */
  names?: string | undefined;
  own?: boolean | undefined;
  /** The hex of the tone the character's own modifier names, or null for --ink-4 (2.1). */
  toneFill?: string | null | undefined;
};

export type ReactionPop = { key: string; t: number };

export type ReactionRowProps = {
  reactions?: readonly ReactionRowItem[] | undefined;
  /** true (default): the Messenger's pills with names; false: the Feed's glyph-only pills (1674). */
  names?: boolean | undefined;
  onReact?: ((emoji: string) => void) | undefined;
  /** The post's author only (1676). */
  onSeeWho?: (() => void) | undefined;
  seeWhoLabel?: string | undefined;
  /** The group's name in the glyph-only mode (F3). */
  label?: string | undefined;
  /** A name for a character the item does not label. */
  nameOf?: ((emoji: string) => string) | undefined;
  /** The glyph the caller wants popping now, keyed by the base character. */
  pop?: ReactionPop | null | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

/** The character without its modifier or variation selector, for matching one stored reaction against another: the compile's name for the app's `baseOf` (src/lib/emoji.ts), one implementation. */
export const stripTone = (e: string | null | undefined): string => baseOf(e);

export function ReactionRow({
  reactions = [],
  names = true,
  onReact,
  onSeeWho,
  seeWhoLabel = "See who reacted",
  label = "Reactions",
  nameOf,
  pop,
  input,
  style,
}: ReactionRowProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const [own, setOwn] = useState<ReactionPop | null>(null);
  const p = pop && (!own || pop.t >= own.t) ? pop : own;
  if (!reactions.length && !onSeeWho) return null;
  const nm = (r: ReactionRowItem) => r.label ?? (nameOf ? nameOf(r.emoji) : r.emoji);
  const press = (e: string) => {
    setOwn({ key: stripTone(e), t: Date.now() });
    if (onReact) onReact(e);
  };
  const h = touch ? 32 : "var(--target-min)";
  return (
    <div
      data-reaction-row={names ? "names" : "glyphs"}
      data-reactions=""
      role={names ? undefined : "group"}
      aria-label={names ? undefined : label}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        marginTop: names ? 4 : 0,
        ...style,
      }}
    >
      {reactions.map((r) => {
        const popping = !!p && p.key === stripTone(r.emoji);
        const glyph = (
          <span
            key={popping && p ? p.t : "still"}
            className={popping ? "b14-pop" : undefined}
            style={{ display: "inline-flex" }}
          >
            <ReactionMark emoji={r.emoji} size={18} toneFill={r.toneFill ?? null} />
          </span>
        );
        if (names)
          return (
            <button
              key={r.emoji}
              type="button"
              aria-label={nm(r) + ", " + (r.names || "")}
              aria-pressed={!!r.own}
              data-reaction={r.emoji}
              data-reaction-label={nm(r)}
              onClick={() => press(r.emoji)}
              style={{
                all: "unset",
                boxSizing: "border-box",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: h,
                padding: "2px var(--space-2) 2px 6px",
                borderRadius: "var(--radius-pill)",
                border:
                  "var(--border-thin) solid " + (r.own ? "var(--line-strong)" : "var(--line)"),
                background: "var(--surface)",
                fontSize: "var(--text-xs)",
                lineHeight: "var(--text-xs-lh)",
                color: "var(--ink-2)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {glyph}
              {r.names}
            </button>
          );
        return (
          <button
            key={r.emoji}
            type="button"
            aria-label={nm(r)}
            aria-pressed={!!r.own}
            data-own={r.own ? "" : undefined}
            data-reaction={r.emoji}
            data-reaction-label={nm(r)}
            onClick={() => press(r.emoji)}
            style={{
              all: "unset",
              boxSizing: "border-box",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: h,
              minWidth: touch ? 44 : 36,
              padding: "2px var(--space-2)",
              borderRadius: "var(--radius-pill)",
              border: "var(--border-thin) solid " + (r.own ? "var(--ink)" : "var(--line)"),
              background: r.own ? "var(--bg-sunken)" : "var(--surface)",
            }}
          >
            {glyph}
          </button>
        );
      })}
      {onSeeWho ? (
        <button
          type="button"
          onClick={onSeeWho}
          style={{
            all: "unset",
            cursor: "pointer",
            minHeight: touch ? 44 : "var(--target-min)",
            display: "inline-flex",
            alignItems: "center",
            padding: "0 var(--space-1)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-medium)" as unknown as number,
            color: "var(--ink-2)",
            textDecoration: "underline",
            textDecorationColor: "var(--line-strong)",
            textUnderlineOffset: 2,
            fontFamily: "var(--font-sans)",
          }}
        >
          {seeWhoLabel}
        </button>
      ) : null}
    </div>
  );
}
