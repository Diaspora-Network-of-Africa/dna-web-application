// Ported from Strand components/core/Input.jsx. label accepts a node. Reconciled at compile
// v1790212533284400 (handoff 32-A, rulings 862 and 844) with correction 25 §5 (663, 1102): the
// combobox on `suggestions`, and the hint or error line tied to the field by aria-describedby.
// Dispositions: docs/strand-ports/v1790212533284400.md.
//
// Kept against the compile: --error where the compile writes --danger (ruling 425; --danger is
// var(--error), so nothing computes differently); ruling 548's two jobs for `error` (below), under
// which a boolean marks the field invalid and leaves the hint in place, where the compile would
// render an empty line; the unconditional `useId()`, where the compile reads `id || React.useId()`,
// a conditional hook; and 92fbdc3's structure on every call that passes neither `suggestions` nor
// `icon`, under Chat's ruling on 25 §5 (see `drawn` below).
//
// Re-synced at compile sha256-b1a458dac1bd562f (brief 60-SP items 8 and 9; HT 5.2 items 2 and 4;
// handoff H61-SP): `tokens` on a multiline field completes the token at the caret through
// TokenSuggest (the field becomes the combobox, the list a role=listbox of up to five rows), and
// `note`, a quiet line separate from `hint` and `error`, --text-xs in --ink-2 after an info icon in
// --ink-3, in a polite role=status region tied by aria-describedby. Not DIA (1300). A field with
// `tokens` takes the compile's wrappers, as the combobox and the glyph do. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "./Icon";
import { TokenList, useTokenSuggest, type TokenOption, type TokenPlacement } from "./TokenSuggest";

/** Brief 60-SP item 8 (HT 5.2 item 2). The token completion a multiline field takes. */
export type InputTokens = {
  options: readonly TokenOption[] | null | undefined;
  open: boolean;
  onChoose?: ((o: TokenOption) => void) | undefined;
  onClose?: (() => void) | undefined;
  /** The list's name (T2 "Tags"); default the field's label. */
  label?: string | undefined;
  /** below (default) or above, for a composer at the foot. */
  placement?: TokenPlacement | undefined;
  order?: "alpha" | "given" | undefined;
};

/** Correction 25 (1102). One suggestion in the combobox's list. */
export type InputSuggestion = {
  value: string;
  label: string;
  /** A second line under the label, e.g. the country for a city. Never a count. */
  detail?: string | undefined;
};

type Field = HTMLInputElement | HTMLTextAreaElement;

type Shared = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  multiline?: boolean | undefined;
  rows?: number;
  id?: string;
  style?: CSSProperties | undefined;
  /** Correction 25 (1102). An array, possibly empty, makes the single-line field a WAI-ARIA 1.2
   *  combobox with a listbox. The caller owns the query and the matching. */
  suggestions?: InputSuggestion[] | undefined;
  /** Enter on the active option, or a press on any option. */
  onSuggestionSelect?: ((s: InputSuggestion) => void) | undefined;
  /** The list's only line when the query is non-empty and nothing matches. Not an option. Strand
   *  ships no copy. A string, as the compile types it. */
  noMatch?: string | undefined;
  /** `overlay` (default) floats the list under the field; `inline` lays it in flow for a scroller
   *  that clips (FacetRail). */
  listbox?: "overlay" | "inline" | undefined;
  /** A leading glyph from Strand's set inside the field, e.g. "search" or "map-pin". */
  icon?: string | undefined;
  /** Item 9 (HT 5.2 item 4): a quiet line separate from `hint` and `error`, --text-xs in --ink-2
   *  after an info icon, in a polite role=status region tied by aria-describedby. Not DIA (1300).
   *  Passing "" keeps the region mounted and empty, so the first line that arrives is announced. */
  note?: string | undefined;
  /** Item 8 (HT 5.2 item 2): on a multiline field, the token completion at the caret. */
  tokens?: InputTokens | undefined;
};
export type InputProps = Shared &
  Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "id"> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style" | "id">;

/**
 * Text input or textarea with label, hint, error.
 *
 * Ruling 548: `error` carries two jobs, the invalid state and the words that explain it, and a
 * caller may pass either. `error={taken || refusals.length > 0}` marks the field invalid without
 * supplying words, because the reason lives in the caller's own block (ruling 434's per-line
 * refusals on OnboardingSurface). Before this, a boolean took the hint's place and rendered as
 * nothing, so the field lost its hint and put no text where it had been; harmless where a block
 * carried the reason, a silent loss anywhere else. A boolean now paints the border and sets
 * aria-invalid, and the hint stays exactly where it was.
 *
 * Correction 25 (1102): passing `suggestions` makes the single-line field a combobox:
 * role=combobox, aria-autocomplete=list, aria-expanded, aria-controls, aria-activedescendant.
 * ArrowDown opens and moves, ArrowUp moves, Enter chooses the active option, Escape closes the list
 * and calls preventDefault so the Pane's guard does not also close (23), and neither does a modal
 * Sheet, since a prevented Escape raises no `cancel` (measured in Chromium); the contained Sheet
 * closes on Escape in a capture listener before this runs (G86). A press on an option does not blur the field. `noMatch`
 * renders as the list's only line, not an option, when the query is non-empty and nothing matches.
 * Options are 44 high on every input mode: a suggestion is a standalone target (498). No count,
 * ever: nothing says how many matched. Hint, error, the focus rendering and every non-combobox call
 * are unchanged; the line is now tied by aria-describedby.
 */
export function Input({
  label,
  hint,
  error,
  multiline,
  rows = 4,
  id,
  style,
  suggestions,
  onSuggestionSelect,
  noMatch,
  listbox = "overlay",
  icon,
  note,
  tokens,
  ...rest
}: InputProps) {
  const autoId = useId();
  const uid = id || autoId;
  const noteId = uid + "-note";
  const tk = useTokenSuggest({
    options: tokens ? tokens.options : [],
    open: !!(tokens && multiline && tokens.open),
    onChoose: tokens?.onChoose,
    onClose: tokens?.onClose,
    order: tokens?.order,
    id: uid,
  });
  const [focus, setFocus] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The two jobs, separated: invalid is the state, message is the words, and only words render.
  const invalid = !!error;
  const message = typeof error === "boolean" ? null : error;
  const combo = Array.isArray(suggestions) && !multiline;
  const listId = uid + "-list";
  const descId = uid + "-desc";
  const q = rest.value != null ? String(rest.value) : "";
  const opts = combo ? suggestions : [];
  const optsKey = combo ? opts.map((o) => o.value).join("\u0001") : "";
  useEffect(() => {
    setActive(-1);
  }, [optsKey]);
  const expanded =
    combo && focus && listOpen && (opts.length > 0 || (!!noMatch && q.trim() !== ""));
  const field: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
    fontSize: 17,
    lineHeight: 1.5,
    color: "var(--ink)",
    background: focus ? "var(--surface)" : "var(--bg-sunken)",
    border: "1px solid " + (invalid ? "var(--error)" : focus ? "var(--ink)" : "var(--line)"),
    borderRadius: "var(--radius-m)",
    padding: multiline ? "10px 14px" : icon ? "0 14px 0 40px" : "0 14px",
    minHeight: 44,
    outline: "none",
    resize: "vertical",
    transition: "border-color var(--dur-default) var(--ease)",
  };
  const choose = (o: InputSuggestion) => {
    if (onSuggestionSelect) onSuggestionSelect(o);
    setListOpen(false);
    setActive(-1);
  };
  const { onKeyDown: userKey, onChange: userChange, onFocus: userFocus, onBlur: userBlur } = rest;
  const userClick = rest.onClick;
  const comboProps = combo
    ? {
        role: "combobox",
        "aria-autocomplete": "list" as const,
        "aria-expanded": expanded,
        "aria-controls": listId,
        "aria-activedescendant": expanded && active > -1 ? listId + "-" + active : undefined,
        autoComplete: "off",
        onChange: (e: ChangeEvent<Field>) => {
          setListOpen(true);
          if (userChange) (userChange as (e: ChangeEvent<Field>) => void)(e);
        },
        onClick: (e: MouseEvent<Field>) => {
          setListOpen(true);
          if (userClick) (userClick as (e: MouseEvent<Field>) => void)(e);
        },
        onKeyDown: (e: KeyboardEvent<Field>) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!listOpen) {
              setListOpen(true);
              return;
            }
            if (opts.length) setActive((a) => (a + 1) % opts.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (opts.length) setActive((a) => (a <= 0 ? opts.length - 1 : a - 1));
          } else if (e.key === "Enter" && expanded && active > -1) {
            e.preventDefault();
            const o = opts[active];
            if (o) choose(o);
          } else if (e.key === "Escape" && expanded) {
            e.preventDefault();
            e.stopPropagation();
            setListOpen(false);
            setActive(-1);
          }
          if (userKey) (userKey as (e: KeyboardEvent<Field>) => void)(e);
        },
      }
    : {};
  const common = {
    id: uid,
    "aria-invalid": invalid,
    "aria-describedby":
      [message || hint ? descId : null, note != null ? noteId : null].filter(Boolean).join(" ") ||
      undefined,
  };
  const tokenProps =
    tokens && multiline
      ? {
          ...tk.fieldProps,
          onKeyDown: (e: KeyboardEvent<Field>) => {
            if (!tk.keyDown(e) && userKey) (userKey as (e: KeyboardEvent<Field>) => void)(e);
          },
        }
      : {};
  const handlers = {
    onFocus: (e: FocusEvent<Field>) => {
      setFocus(true);
      if (userFocus) (userFocus as (e: FocusEvent<Field>) => void)(e);
    },
    onBlur: (e: FocusEvent<Field>) => {
      setFocus(false);
      setListOpen(false);
      if (userBlur) (userBlur as (e: FocusEvent<Field>) => void)(e);
    },
  };
  const list = expanded && (
    <div
      id={listId}
      role="listbox"
      aria-label={typeof label === "string" ? label : undefined}
      data-listbox={listbox}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        ...(listbox === "inline"
          ? { position: "static" }
          : {
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: "var(--z-sticky)" as unknown as number,
              boxShadow: "var(--shadow-3)",
            }),
        boxSizing: "border-box",
        padding: "var(--space-1)",
        background: "var(--surface)",
        border: "var(--border-thin) solid var(--line)",
        borderRadius: "var(--radius-m)",
        display: "flex",
        flexDirection: "column",
        maxHeight: 264,
        overflowY: "auto",
      }}
    >
      {opts.length ? (
        opts.map((o, i) => (
          <div
            key={o.value}
            id={listId + "-" + i}
            role="option"
            aria-selected={i === active}
            data-value={o.value}
            onClick={() => choose(o)}
            onMouseEnter={() => setActive(i)}
            style={{
              boxSizing: "border-box",
              minHeight: 44,
              padding: "var(--space-2) var(--space-3)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              borderRadius: "var(--radius-s)",
              cursor: "pointer",
              background: i === active ? "var(--bg-sunken)" : "transparent",
              boxShadow: i === active ? "inset 0 0 0 1px var(--line)" : "none",
              fontFamily: "var(--font-sans)",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-s)",
                lineHeight: "var(--text-s-lh)",
                fontWeight: "var(--weight-medium)" as unknown as number,
                color: "var(--ink)",
              }}
            >
              {o.label}
            </span>
            {o.detail && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  lineHeight: "var(--text-xs-lh)",
                  color: "var(--ink-3)",
                }}
              >
                {o.detail}
              </span>
            )}
          </div>
        ))
      ) : (
        <div
          role="presentation"
          data-no-match=""
          style={{
            minHeight: 44,
            padding: "var(--space-2) var(--space-3)",
            display: "flex",
            alignItems: "center",
            fontSize: "var(--text-s)",
            color: "var(--ink-3)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {noMatch}
        </div>
      )}
    </div>
  );
  const fieldEl = multiline ? (
    <textarea
      rows={rows}
      {...common}
      {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
      {...handlers}
      {...tokenProps}
      style={field}
    />
  ) : (
    <input
      {...common}
      {...(rest as InputHTMLAttributes<HTMLInputElement>)}
      {...handlers}
      {...comboProps}
      style={field}
    />
  );
  // Handoff 32-A, Chat's ruling on correction 25 §5 ("every non-combobox call is unchanged"): the
  // compile nests the field in two wrappers on every call. Measured on this app's callers at 390
  // and 1280, a single-line field holds its box and a textarea does not: inside the block
  // `position: relative` wrapper it is inline-level, sits on the line's baseline and leaves 7.5px
  // under itself, so its line and everything below it move. The wrappers therefore render only
  // when a prop that needs them is passed (the combobox's list, or the leading glyph); every other
  // call keeps 92fbdc3's structure. Divergent, with the mismatch filed for Strand in docs/GAPS.md.
  const drawn = combo || !!icon || !!(tokens && multiline);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label htmlFor={uid} style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>
          {label}
        </label>
      )}
      {drawn ? (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: listbox === "inline" ? 4 : 0,
          }}
        >
          <div style={{ position: "relative" }}>
            {icon && (
              <Icon
                name={icon}
                size={18}
                style={{
                  position: "absolute",
                  left: 14,
                  top: 13,
                  color: "var(--ink-3)",
                  pointerEvents: "none",
                }}
              />
            )}
            {fieldEl}
          </div>
          {list}
          {tokens && multiline ? (
            <TokenList
              state={tk}
              label={tokens.label || (typeof label === "string" ? label : undefined)}
              placement={tokens.placement || "below"}
            />
          ) : null}
        </div>
      ) : (
        fieldEl
      )}
      {(message || hint) && (
        <div
          id={descId}
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: message ? "var(--error)" : "var(--ink-3)",
          }}
        >
          {message || hint}
        </div>
      )}
      {note != null && (
        <div
          id={noteId}
          role="status"
          aria-live="polite"
          data-note=""
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            color: "var(--ink-2)",
            textWrap: "pretty",
            ...(note ? {} : { marginTop: -6 }),
          }}
        >
          {note ? (
            <>
              <Icon name="info" size={14} style={{ color: "var(--ink-3)", marginTop: 2 }} />
              <span style={{ minWidth: 0 }}>{note}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
