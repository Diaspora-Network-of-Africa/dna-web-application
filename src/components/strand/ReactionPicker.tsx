// Ported from Strand components/dna/ReactionPicker.jsx at compile sha256-b1a458dac1bd562f (brief
// 60-SP item 5; FC 5.2 item 7, 58's proposal; 1403, 1404, 1576, 1577, 1586, 1587, 1621, 1628,
// 1629, 1632, 1633; ratified 1728; handoff H61-SP). New to the tree: one picker for the Messenger
// and the Feed, composed once from the same data.
//
// view="quick": the quick bar, as MessageBubble drew it: one row that never wraps, the eight in
// 1403's order, 44 on touch and 36 on pointer, 2 apart, in a --surface pill with a --line border and
// 2 padding, then More (Button ghost sm). role="group" named "React"; each glyph a button named by
// its emoji with aria-pressed. At 390 the row scrolls sideways to reach More. On pointer each
// glyph's name shows in a Tooltip on hover or focus. On touch a press held for `holdMs` (500) shows
// the name in a controlled Tooltip and the tap the release makes is swallowed (1632, 1633): a hold
// reads, it never reacts.
// view="full": the full picker, a Sheet on touch and a Popover on pointer, titled React (F8). In
// order: Search emoji; the Skin tone radiogroup, Not chosen first; Recent; the groups as the caller
// passes them; then the name line at the foot, which reads the focused or hovered emoji's name on
// pointer and the held one on touch, and holds its height empty otherwise. A search narrows every
// group to the emoji whose name contains it; nothing matching reads "No emoji match." (F8). Cells
// 44 on touch, 36 on pointer; the eight draw as drawn wherever they appear. Picking calls onPick
// with the character, a hand with the member's modifier (1577). No count, ever.
//
// Translations, none visible. The compile reads the eight, their names and the tone hexes off its
// own ReactionGlyph literals (QUICK_REACTIONS, SKIN_TONES, HAND_EMOJI); the tree reads the eight
// from `message_reaction_quick` through vocabularies() (1629, the fixed-vocabulary absolute) and
// the tones from src/lib/emoji.ts (1404, 1577), so the quick view takes `quick` as the caller
// already composes it (value, label, toneFill, pressed) and the full view takes `tones` and the
// groups' own `takesTone`, where the compile's `withTone` tones a literal list of hands. The pop is
// the tree's `b14-pop` rule in strand.css. `data-picker`, `data-quick`, `data-more`,
// `data-emoji-search`, `data-tone-row`, `data-tone`, `data-recent`, `data-recent-emoji` and
// `data-emoji-viewport` are tests/messenger.cjs's hooks, carried from the parts they were read on.
// On touch the full view's Sheet draws its title row here, because the tree's Sheet takes no
// `title`; the heading carries data-sheet-heading for Sheet's focus. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Popover } from "./Popover";
import { ReactionMark } from "./ReactionGlyph";
import { stripTone, type ReactionPop } from "./ReactionRow";
import { Sheet } from "./Sheet";
import { Tooltip } from "./Tooltip";
import { withTone } from "@/lib/emoji";
import { useMode, type Mode } from "@/lib/tier";

export type ReactionPickerQuick = {
  /** The character the press stores, with the member's modifier on a hand (2.1). */
  value: string;
  /** E9's glyph name, from the vocabulary. */
  label: string;
  /** The hands' fill: the member's tone, or null for --ink-4 (1576). */
  toneFill: string | null;
  /** The member's own reaction on this message is this glyph. */
  pressed: boolean;
};

export type ReactionPickerTone = {
  key: string;
  /** The modifier character, or null for Not chosen. */
  modifier: string | null;
  label: string;
  /** The swatch; null draws --ink-4. */
  hex: string | null;
};

export type ReactionPickerEmoji = {
  emoji: string;
  name: string;
  /** Whether the character takes the member's modifier when picked (1577). */
  takesTone?: boolean | undefined;
};

export type ReactionPickerGroup = {
  id?: string | undefined;
  label: string;
  emoji: readonly ReactionPickerEmoji[];
};

const CAPS: CSSProperties = {
  fontSize: "var(--text-xs)",
  lineHeight: "var(--text-xs-lh)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase",
  fontWeight: "var(--weight-medium)" as unknown as number,
  color: "var(--ink-3)",
};

/** Press and hold: after `ms` the name shows; the click the release produces is swallowed. */
function useHold(ms: number, touch: boolean) {
  const [held, setHeld] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
  const swallow = useRef(false);
  const end = () => {
    clearTimeout(timer.current);
    setHeld(null);
  };
  const bind = (key: string) =>
    touch
      ? {
          onPointerDown: () => {
            swallow.current = false;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              swallow.current = true;
              setHeld(key);
            }, ms);
          },
          onPointerUp: end,
          onPointerCancel: end,
          onPointerLeave: end,
          onContextMenu: (e: SyntheticEvent) => e.preventDefault(),
        }
      : {};
  const guard = (fn: () => void) => (e: SyntheticEvent) => {
    if (swallow.current) {
      swallow.current = false;
      e.preventDefault();
      return;
    }
    fn();
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { held, bind, guard };
}

export type ReactionPickerProps = {
  view?: "quick" | "full" | undefined;
  /** quick: the eight as the caller composed them from the vocabulary; an empty list is an empty bar, never literals. */
  quick?: readonly ReactionPickerQuick[] | undefined;
  onPick?: ((emoji: string) => void) | undefined;
  /** quick: More, which opens the full view. */
  onMore?: (() => void) | undefined;
  moreLabel?: string | undefined;
  /** The group's name, and the full view's title (F8). */
  title?: string | undefined;
  /** quick, touch: the hold that names a glyph (1633). */
  holdMs?: number | undefined;
  /** quick: the row's own alignment in a column, the sender's side. */
  align?: "start" | "end" | undefined;
  /** full: the member's tone and the tone set, Not chosen first (1576). */
  tone?: ReactionPickerTone | undefined;
  tones?: readonly ReactionPickerTone[] | undefined;
  /** full: writes the member's choice, a modifier character or null for Not chosen. */
  onTone?: ((modifier: string | null) => void) | undefined;
  /** full: the member's own reaction on the message, to mark its cell. */
  value?: string | null | undefined;
  groups?: readonly ReactionPickerGroup[] | undefined;
  /** full: the member's recent emoji, newest first (1405). */
  recent?: readonly string[] | undefined;
  /** full: a name for a character the groups do not carry (Recent's toned forms); null renders no cell. */
  nameOf?: ((emoji: string) => string | null) | undefined;
  open?: boolean | undefined;
  onClose?: (() => void) | undefined;
  /** full, pointer: the control the Popover anchors to. */
  anchorRef?: RefObject<HTMLElement | null> | undefined;
  /** full, touch: compact is the bottom sheet, the others the side sheet. */
  tier?: "compact" | "medium" | "expanded" | undefined;
  contained?: boolean | undefined;
  portal?: boolean | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

export function ReactionPicker({
  view = "quick",
  quick = [],
  onPick,
  onMore,
  moreLabel = "More",
  title = "React",
  holdMs = 500,
  align = "start",
  tone,
  tones = [],
  onTone,
  value,
  groups = [],
  recent = [],
  nameOf,
  open,
  onClose,
  anchorRef,
  tier = "compact",
  contained,
  portal = true,
  input,
  style,
}: ReactionPickerProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const [pop, setPop] = useState<ReactionPop | null>(null);
  const hold = useHold(holdMs, touch);
  const pick = (e: string) => {
    setPop({ key: stripTone(e), t: Date.now() });
    if (onPick) onPick(e);
  };
  if (view === "quick") {
    const size = touch ? 44 : 36;
    return (
      <div
        role="group"
        aria-label={title}
        data-reaction-picker="quick"
        data-picker=""
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "nowrap",
          gap: 2,
          marginTop: 2,
          padding: 2,
          borderRadius: "var(--radius-pill)",
          background: "var(--surface)",
          border: "var(--border-thin) solid var(--line)",
          maxWidth: "100%",
          overflowX: "auto",
          scrollbarWidth: "none",
          boxSizing: "border-box",
          alignSelf: align === "end" ? "flex-end" : "flex-start",
          ...style,
        }}
      >
        {quick.map((q) => {
          const popping = !!pop && pop.key === stripTone(q.value);
          const btn = (
            <button
              type="button"
              aria-label={q.label}
              aria-pressed={q.pressed}
              data-quick={q.value}
              {...hold.bind(q.value)}
              onClick={hold.guard(() => pick(q.value))}
              style={{
                all: "unset",
                cursor: "pointer",
                width: size,
                height: size,
                borderRadius: "var(--radius-pill)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: q.pressed ? "var(--bg-sunken)" : "transparent",
                boxSizing: "border-box",
                flex: "none",
                WebkitTouchCallout: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              <span
                key={popping && pop ? pop.t : "still"}
                className={popping ? "b14-pop" : undefined}
                style={{ display: "inline-flex" }}
              >
                <ReactionMark emoji={q.value} size={24} toneFill={q.toneFill} />
              </span>
            </button>
          );
          return (
            <Tooltip
              key={q.value}
              label={q.label}
              input={mode}
              open={touch ? hold.held === q.value : undefined}
              style={{ flex: "none" }}
            >
              {btn}
            </Tooltip>
          );
        })}
        <Button variant="ghost" size="sm" onClick={onMore} style={{ flex: "none" }} data-more>
          {moreLabel}
        </Button>
      </div>
    );
  }
  return (
    <FullPicker
      mode={mode}
      touch={touch}
      tone={tone ?? tones[0]}
      tones={tones}
      onTone={onTone}
      value={value}
      pick={pick}
      groups={groups}
      recent={recent}
      nameOf={nameOf}
      title={title}
      open={!!open}
      onClose={onClose}
      anchorRef={anchorRef}
      tier={tier}
      contained={contained}
      portal={portal}
      hold={hold}
      style={style}
    />
  );
}

type FullProps = {
  mode: Mode;
  touch: boolean;
  tone: ReactionPickerTone | undefined;
  tones: readonly ReactionPickerTone[];
  onTone: ((modifier: string | null) => void) | undefined;
  value: string | null | undefined;
  pick: (emoji: string) => void;
  groups: readonly ReactionPickerGroup[];
  recent: readonly string[];
  nameOf: ((emoji: string) => string | null) | undefined;
  title: string;
  open: boolean;
  onClose: (() => void) | undefined;
  anchorRef: RefObject<HTMLElement | null> | undefined;
  tier: "compact" | "medium" | "expanded";
  contained: boolean | undefined;
  portal: boolean;
  hold: ReturnType<typeof useHold>;
  style: CSSProperties | undefined;
};

function FullPicker({
  mode,
  touch,
  tone,
  tones,
  onTone,
  value,
  pick,
  groups,
  recent,
  nameOf,
  title,
  open,
  onClose,
  anchorRef,
  tier,
  contained,
  portal,
  hold,
  style,
}: FullProps) {
  const [q, setQ] = useState("");
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      setQ("");
      setLit(null);
    }
  }, [open]);
  const size = touch ? 44 : 36;
  const modifier = tone?.modifier ?? null;
  const toneHex = tone?.hex ?? null;
  /** Every character the groups carry, by its base: its name and whether it takes a tone. */
  const known = useMemo(() => {
    const m = new Map<string, ReactionPickerEmoji>();
    for (const g of groups) for (const e of g.emoji) m.set(stripTone(e.emoji), e);
    return m;
  }, [groups]);
  const nm = (e: string): string | null => {
    const own = nameOf ? nameOf(e) : null;
    if (own) return own;
    return known.get(stripTone(e))?.name ?? null;
  };
  const takes = (e: string) => !!known.get(stripTone(e))?.takesTone;
  const pressed = (e: string) => !!value && stripTone(value) === stripTone(e);
  const cell = (e: string, k: string) => {
    const name = nm(e);
    if (!name) return null;
    const toned = withTone(e, takes(e), modifier);
    return (
      <button
        key={k + e}
        type="button"
        aria-label={name}
        aria-pressed={pressed(e)}
        data-emoji={toned}
        {...hold.bind(e)}
        onClick={hold.guard(() => pick(toned))}
        onMouseEnter={() => setLit(e)}
        onMouseLeave={() => setLit(null)}
        onFocus={() => setLit(e)}
        onBlur={() => setLit(null)}
        style={{
          all: "unset",
          cursor: "pointer",
          width: size,
          height: size,
          borderRadius: "var(--radius-m)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          background: pressed(e) ? "var(--bg-sunken)" : "transparent",
          WebkitTouchCallout: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <ReactionMark emoji={toned} size={24} toneFill={takes(e) ? toneHex : null} />
      </button>
    );
  };
  const grid = (list: readonly string[], k: string) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(" + size + "px, 1fr))",
        gap: 2,
      }}
    >
      {list.map((e) => cell(e, k))}
    </div>
  );
  const needle = q.trim().toLowerCase();
  const all = groups
    .map((g) => ({
      ...g,
      list: g.emoji
        .filter(
          (x) =>
            !needle ||
            String(x.name || "")
              .toLowerCase()
              .indexOf(needle) >= 0,
        )
        .map((x) => x.emoji),
    }))
    .filter((g) => g.list.length);
  const shown = touch ? hold.held : lit;
  const body = (
    <div
      data-reaction-picker="full"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", ...style }}
    >
      <Input
        icon="search"
        placeholder="Search emoji"
        aria-label="Search emoji"
        value={q}
        onChange={(e) => setQ((e.target as HTMLInputElement).value)}
        data-emoji-search=""
      />
      <div
        role="radiogroup"
        aria-label="Skin tone"
        data-tone-row=""
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}
      >
        <span style={CAPS}>Skin tone</span>
        {tones.map((x) => {
          const on = tone ? x.key === tone.key : x.modifier === null;
          return (
            <button
              key={x.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={x.label}
              data-tone={x.key}
              onClick={() => onTone && onTone(x.modifier)}
              style={{
                all: "unset",
                cursor: "pointer",
                width: touch ? 44 : 28,
                height: touch ? 44 : 28,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: x.hex || "var(--ink-4)",
                  outline: on ? "2px solid var(--ink)" : "1px solid var(--line)",
                  outlineOffset: 2,
                }}
              />
            </button>
          );
        })}
      </div>
      <div
        data-emoji-viewport=""
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}
      >
        {needle ? (
          all.length ? (
            grid(([] as string[]).concat(...all.map((g) => g.list)), "s")
          ) : (
            <p
              role="status"
              data-emoji-empty=""
              style={{
                margin: 0,
                fontSize: "var(--text-s)",
                lineHeight: "var(--text-s-lh)",
                color: "var(--ink-3)",
              }}
            >
              No emoji match.
            </p>
          )
        ) : (
          <>
            {recent.length ? (
              <div
                data-recent=""
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
              >
                <span style={CAPS}>Recent</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(" + size + "px, 1fr))",
                    gap: 2,
                  }}
                >
                  {recent.map((e) => {
                    // Recent holds the stored character, tone and all (1405); its cell carries that
                    // character and the name the data gives it (1628, 1629), or renders nothing.
                    const name = nm(e);
                    if (!name) return null;
                    return (
                      <button
                        key={"r" + e}
                        type="button"
                        aria-label={name}
                        aria-pressed={pressed(e)}
                        data-recent-emoji={e}
                        {...hold.bind(e)}
                        onClick={hold.guard(() => pick(e))}
                        onMouseEnter={() => setLit(e)}
                        onMouseLeave={() => setLit(null)}
                        onFocus={() => setLit(e)}
                        onBlur={() => setLit(null)}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          width: size,
                          height: size,
                          borderRadius: "var(--radius-m)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxSizing: "border-box",
                          background: pressed(e) ? "var(--bg-sunken)" : "transparent",
                          WebkitTouchCallout: "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                      >
                        <ReactionMark
                          emoji={e}
                          size={24}
                          toneFill={
                            tones.find((t) => !!t.modifier && e.includes(t.modifier))?.hex ?? null
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {all.map((g) => (
              <div
                key={g.id || g.label}
                role="group"
                aria-label={g.label}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
              >
                <span style={CAPS}>{g.label}</span>
                {grid(g.list, g.id || g.label)}
              </div>
            ))}
          </>
        )}
      </div>
      <div
        aria-hidden="true"
        data-name-line=""
        style={{
          minHeight: "calc(var(--text-s) * var(--text-s-lh))",
          paddingTop: "var(--space-2)",
          borderTop: "var(--border-thin) solid var(--line)",
          fontSize: "var(--text-s)",
          lineHeight: "var(--text-s-lh)",
          color: "var(--ink-2)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        {shown ? (
          <>
            <ReactionMark
              emoji={withTone(shown, takes(shown), modifier)}
              size={18}
              toneFill={takes(shown) ? toneHex : null}
            />
            {nm(shown)}
          </>
        ) : null}
      </div>
    </div>
  );
  if (touch) {
    const head: ReactNode = (
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          padding:
            "calc(var(--space-3) / 2) var(--space-2) calc(var(--space-3) / 2) var(--space-5)",
          borderBottom: "var(--border-thin) solid var(--line)",
        }}
      >
        <h2
          data-sheet-heading
          tabIndex={-1}
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--display-s)",
            lineHeight: "var(--display-s-lh)",
            fontWeight: "var(--weight-semibold)" as unknown as number,
            outline: "none",
          }}
        >
          {title}
        </h2>
        {onClose ? <IconButton name="x" label="Close" input={mode} onClick={onClose} /> : null}
      </div>
    );
    return (
      <Sheet
        open={open}
        onClose={onClose}
        variant={tier === "compact" ? "sheet" : "drawer"}
        label={title}
        contained={contained}
      >
        {head}
        <div
          data-sheet-body
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "var(--space-5)",
            fontSize: "var(--text-m)",
            lineHeight: "var(--text-m-lh)",
          }}
        >
          {body}
        </div>
      </Sheet>
    );
  }
  return (
    <Popover
      open={open}
      portal={portal}
      input={mode}
      anchorRef={anchorRef}
      title={title}
      onClose={onClose}
    >
      {body}
    </Popover>
  );
}
