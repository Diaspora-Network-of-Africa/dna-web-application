// Ported from Strand components/core/TokenSuggest.jsx at compile sha256-b1a458dac1bd562f (brief
// 60-SP item 8; HT 5.2 item 2; ratified 1728; handoff H61-SP). New to the tree: MessageComposer's
// mention listbox lifted out into one behaviour, so a field completes the token at the caret, `#`
// for tags and `@` for members, with one listbox. The field keeps its own element and takes the
// combobox (role, aria-autocomplete, aria-expanded, aria-controls, aria-activedescendant); the list
// is role="listbox" with role="option" rows, never a Menu. The caller finds the token at the caret
// and matches it (Strand does no matching) and passes the options and whether the list is open. Up
// to five rows, alphabetical by label by default (`order="given"` keeps the caller's), no count, no
// rank; rows --target-primary high on every input mode (498) with a 28 Avatar when an option carries
// one. ArrowDown and ArrowUp move; Enter or Tab chooses the active row; Escape closes with
// preventDefault and stopPropagation so a Sheet does not also close. A press on a row does not blur
// the field. `useTokenSuggest` is the behaviour, `TokenList` draws the list, `TokenSuggest` is the
// two together for a caller's own field, as a render prop. Translations, none visible: typed props;
// the hook's `useId` is unconditional, as Input's is (the compile reads `id || React.useId()`).
// Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Avatar } from "./Avatar";

export type TokenOption = {
  value: string;
  label: string;
  /** A member's photo URL, or `true` for initials. */
  avatar?: string | true | undefined;
};

export type TokenPlacement = "below" | "above" | "inline";

export type TokenFieldProps = {
  role: "combobox";
  "aria-autocomplete": "list";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  "aria-activedescendant": string | undefined;
  autoComplete: "off";
};

export type TokenSuggestState = {
  expanded: boolean;
  opts: TokenOption[];
  active: number;
  setActive: (i: number) => void;
  choose: (o: TokenOption) => void;
  /** Returns true when it took the key. */
  keyDown: (e: KeyboardEvent<Element>) => boolean;
  fieldProps: TokenFieldProps;
  listId: string;
};

export type UseTokenSuggestOptions = {
  options: readonly TokenOption[] | null | undefined;
  open: boolean;
  onChoose?: ((o: TokenOption) => void) | undefined;
  onClose?: (() => void) | undefined;
  order?: "alpha" | "given" | undefined;
  limit?: number | undefined;
  id?: string | undefined;
};

export function useTokenSuggest({
  options,
  open,
  onChoose,
  onClose,
  order = "alpha",
  limit = 5,
  id,
}: UseTokenSuggestOptions): TokenSuggestState {
  const autoId = useId();
  const uid = (id || autoId) + "-tokens";
  const [active, setActive] = useState(-1);
  const opts = useMemo(() => {
    const o = (options || []).slice();
    if (order === "alpha") o.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return o.slice(0, limit);
  }, [options, order, limit]);
  const expanded = !!open && opts.length > 0;
  const optsKey = opts.map((o) => o.value).join("\u0001");
  useEffect(() => {
    setActive(-1);
  }, [optsKey, expanded]);
  const choose = (o: TokenOption) => {
    if (onChoose) onChoose(o);
    setActive(-1);
  };
  const keyDown = (e: KeyboardEvent<Element>) => {
    if (!expanded) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % opts.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? opts.length - 1 : a - 1));
      return true;
    }
    if ((e.key === "Enter" || e.key === "Tab") && active > -1) {
      e.preventDefault();
      const o = opts[active];
      if (o) choose(o);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (onClose) onClose();
      setActive(-1);
      return true;
    }
    return false;
  };
  const fieldProps: TokenFieldProps = {
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-expanded": expanded,
    "aria-controls": expanded ? uid : undefined,
    "aria-activedescendant": expanded && active > -1 ? uid + "-" + active : undefined,
    autoComplete: "off",
  };
  return { expanded, opts, active, setActive, choose, keyDown, fieldProps, listId: uid };
}

export type TokenListProps = {
  state: TokenSuggestState | null | undefined;
  label?: string | undefined;
  placement?: TokenPlacement | undefined;
  style?: CSSProperties | undefined;
};

export function TokenList({ state, label, placement = "below", style }: TokenListProps) {
  if (!state || !state.expanded) return null;
  const float: CSSProperties =
    placement === "inline"
      ? { position: "static" }
      : {
          position: "absolute",
          left: 0,
          right: 0,
          zIndex: "var(--z-sticky)" as unknown as number,
          boxShadow: "var(--shadow-3)",
          ...(placement === "above" ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
        };
  return (
    <div
      id={state.listId}
      role="listbox"
      aria-label={label}
      data-token-list={placement}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        ...float,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--radius-m)",
        border: "var(--border-thin) solid var(--line)",
        background: "var(--surface)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {state.opts.map((o, i) => (
        <div
          key={o.value}
          id={state.listId + "-" + i}
          role="option"
          aria-selected={i === state.active}
          data-value={o.value}
          onClick={() => state.choose(o)}
          onMouseEnter={() => state.setActive(i)}
          style={{
            boxSizing: "border-box",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            minHeight: "var(--target-primary)",
            padding: "0 var(--space-3)",
            fontSize: "var(--text-s)",
            lineHeight: "var(--text-s-lh)",
            color: "var(--ink)",
            background: i === state.active ? "var(--bg-sunken)" : "transparent",
          }}
        >
          {o.avatar ? (
            <Avatar name={o.label} src={o.avatar === true ? undefined : o.avatar} size={28} />
          ) : null}
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              overflowWrap: "anywhere",
            }}
          >
            {o.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export type TokenSuggestProps = {
  options: readonly TokenOption[] | null | undefined;
  open: boolean;
  onChoose?: ((o: TokenOption) => void) | undefined;
  onClose?: (() => void) | undefined;
  /** The list's name (T2 "Tags"). */
  label?: string | undefined;
  placement?: TokenPlacement | undefined;
  order?: "alpha" | "given" | undefined;
  limit?: number | undefined;
  /** The caller's field, as a render prop taking the combobox props and the key handler. */
  children?:
    | ((props: TokenFieldProps & { onKeyDown: (e: KeyboardEvent<Element>) => void }) => ReactNode)
    | ReactNode;
  style?: CSSProperties | undefined;
};

export function TokenSuggest({
  options,
  open,
  onChoose,
  onClose,
  label,
  placement = "below",
  order,
  limit,
  children,
  style,
}: TokenSuggestProps) {
  const s = useTokenSuggest({ options, open, onChoose, onClose, order, limit });
  const props = { ...s.fieldProps, onKeyDown: (e: KeyboardEvent<Element>) => void s.keyDown(e) };
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: placement === "inline" ? "var(--space-2)" : 0,
        ...style,
      }}
    >
      {placement === "inline" ? <TokenList state={s} label={label} placement="inline" /> : null}
      {typeof children === "function" ? children(props) : children}
      {placement !== "inline" ? <TokenList state={s} label={label} placement={placement} /> : null}
    </div>
  );
}
