// Strand `components/dna/FacetRail.jsx`, first ported at compile v1789885868097915 (ruling 851),
// reconciled at compile v1790212533284400 (handoff 32-A, rulings 862 and 844) with correction 24
// §1 to §4 (1055, 1060) and correction 25 §3 (663, 1102), carried unchanged through
// v1790279130697923 (the part's source hash is 971dbd85bcfd at both), and reconciled at compile
// v1790366257373061 (handoff 33-A; correction 28, ratified 1134) with its items 4 and 5 (G102,
// G111). Before that change the port equalled v1790279130697923's part except for the two things
// below that the app's own tree decides. The archive's .jsx and the bundle agree on every line
// correction 28 touches; the dispositions are in docs/strand-ports/v1790366257373061.md, and
// those for corrections 24 and 25 in docs/strand-ports/v1790212533284400.md.
//
// Rulings the compiled part cites in its own doc comment: 561, 586, 589, 102, 79, 687, 688, 725,
// 944, 1055, 1060, 663, 1085 and 1102. Correction 28's lines cite gaps (G102, G109, G111) and no
// ruling.
// Filters for a list surface. At expanded it is a sticky rail in its own column; at medium the same
// rail; at compact it is a trigger plus the same body inside a Sheet, which is a rendering and not a
// mode. `mode="single"` is one selection across the rail, exposed through `onChange` as
// `{ [axisId]: [optionId] }`; the caller owns the route and the rail never navigates.
// `mode="collapsed"` is a 64px icon strip (612 as amended by 725): one 48px square per axis, named
// from the axis label, tinted when any option in that axis is set. A square is not a control over an
// option — it expands the rail through `onExpand`.
// Arrow keys move focus only; Enter, Space or a click selects (688, 718).
// Correction 24 (1055): `headingAction` is a slot on the rail's heading line (G72), an option may
// wrap and stays inside the nav's padding (G75), an axis may declare `select: "single"` inside a
// multi-select rail and becomes a radiogroup whose choice replaces the axis's value (G76), and an
// axis may carry `ladders`, named rungs selected like options and never numbered (1060).
// Correction 25 (1102): an axis may declare `display` (`chips`, `segment`, `checklist`,
// `combobox`), the facets rendering only; an axis with ladders is the ladder part whatever `display`
// says. The rail form is its own scroller, and its heading is sticky at the scroller's top on
// --surface with a --line hairline once the axes have scrolled under it.
// Correction 28 (1134): a `checklist` axis may set `columns: 2`, and its rows then lay in two grid
// columns once the checklist is 150 wide and in one below (G102). `clearPlacement="heading"` moves
// Clear all from the body's foot into the pinned heading row, between the title and
// `headingAction`, in the rail form only: the compact Sheet keeps it at the foot, and single mode
// has it in neither place (G111; G109 is not in that pass). A caller that passes neither prop
// renders exactly what it rendered at v1790279130697923.
//
// Four of correction 24's and 25's changes alter what an existing caller renders with no new
// prop, and are ported because ruling 844 gives the compile a size and a padding and no app ruling
// keeps the old values: the chip's padding, line height, wrap and max width (24 §2; G75 is this
// app's own ask for it), which take a one-line chip from 36 to 39.75 rather than holding 36 as
// 24 §2 says; the heading pin, whose transparent 1px bottom border moves the axes down 1px at rest
// where 25 §3 says nothing moves; the nav as its own scroller; and the data-axis-id, data-display,
// data-select and data-option markers.
//
// Two things the app's own tree decides rather than the compile:
//   - The compact rendering goes through this repository's `Sheet` as `variant="sheet"` (ruling 618:
//     Strand's Sheet replaced `variant` and `width` with `tier` and `size`, and a caller passing
//     `variant="sheet"` wants `tier="compact"`). Ruling 605's repo-side Sheet migration is
//     unstarted, logged as G30.
//   - The compiled call passes `title`, which Strand's Sheet renders as a visible heading in its own
//     pinned header above a scrolling body, with a Close control. This repository's `Sheet` has no
//     heading, body or close of its own — it focuses `[data-sheet-heading]` when a caller supplies
//     one (480) — so `title` lands on `label`, the dialog's accessible name, and the rail's heading
//     is drawn by this part instead, which is what every other Sheet caller in this tree does. Its
//     scrolling body is drawn here too (handoff 32-A), under a heading row that does not scroll,
//     because 24 §2's taller chips push the lower axes past a sheet that has none. The pinned
//     header's own geometry and its Close control are the Sheet's and arrive with G30.
//
// Bound by `DiscoverySurface` (handoff 31-B) in all three forms, which since 32-B passes
// `headingAction`, an axis `select`, `ladders` and every `display`. Handoff 33-A item 3 has it pass
// `columns: 2` on Topics (G102) and `clearPlacement="heading"` (G111); this file binds neither.
import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Segment } from "./Segment";
import { Sheet } from "./Sheet";

export type FacetOption = {
  id: string;
  label: string;
  /** Rendered, disabled and dimmed: an option the corpus cannot serve yet. */
  parked?: boolean | undefined;
  /** Correction 25: a second line in the combobox's suggestion, e.g. the country. Never a count. */
  detail?: string | undefined;
};

/** 1060: one ladder of named rungs inside an axis, e.g. one per home. */
export type FacetLadder = {
  id: string;
  /** Heads the ladder's row when the axis carries more than one ladder. */
  label?: string | undefined;
  rungs: FacetOption[];
};

export type FacetAxis = {
  id: string;
  label: string;
  /** Strand glyph name, used by the collapsed strip (725). */
  icon?: string | undefined;
  options?: FacetOption[] | undefined;
  /** G76 (correction 24): a single axis is a radiogroup and choosing replaces its value. */
  select?: "single" | "multi" | undefined;
  /** 1060: named rungs; when present, `options` is not rendered. */
  ladders?: FacetLadder[] | undefined;
  /** Correction 25: the facets rendering. `segment` needs `select: "single"`. */
  display?: "chips" | "segment" | "checklist" | "combobox" | undefined;
  /** segment: the leading seat that clears the axis. Default "Any". */
  anyLabel?: string | undefined;
  /** combobox: the field's placeholder, its no-match line, the chosen chip's remove word and its
   *  leading glyph (default "map-pin"). Strand ships no copy. */
  placeholder?: string | undefined;
  noMatch?: string | undefined;
  removeLabel?: string | undefined;
  fieldIcon?: string | undefined;
  /** Correction 28, G102. checklist only: 2 lays the rows in two columns once the checklist is 150
   *  wide or wider, one below. Absent (or 1), one column. */
  columns?: 1 | 2 | undefined;
};

/** Selected option ids per axis. An axis with nothing selected carries no key. */
export type FacetValue = Record<string, string[]>;

export type FacetRailProps = {
  axes?: FacetAxis[];
  value?: FacetValue;
  onChange?: ((next: FacetValue) => void) | undefined;
  onClear?: (() => void) | undefined;
  tier?: "compact" | "medium" | "expanded";
  label?: string;
  /** Compact only: whether the sheet is open. The caller owns the state. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  style?: CSSProperties | undefined;
  mode?: "facets" | "single" | "collapsed";
  /** 718 addendum: a collapsed strip declares the selection model of the rail it stands for. */
  select?: "single" | "multi" | undefined;
  /** Compact only: the caller's own pill in place of the default trigger button. */
  trigger?: ((p: { open: boolean; onOpen: () => void; label: string }) => ReactNode) | undefined;
  onExpand?: (() => void) | undefined;
  expandLabel?: string;
  /** G72 (correction 24): the caller's control at the right of the rail's heading line (944's
   *  "Collapse browse"). Rail form only. Absent, the heading holds its label, and the Clear all
   *  slot when `clearPlacement` is "heading". */
  headingAction?: ReactNode;
  /** G111 (correction 28): rail form only. "heading" puts Clear all (shown only when any facet is
   *  set) in the pinned heading row, between the label and `headingAction`. Default "foot". The
   *  compact Sheet keeps it at the body's foot either way. */
  clearPlacement?: "foot" | "heading" | undefined;
};

const CHIP = (on: boolean, parked?: boolean): CSSProperties => ({
  all: "unset",
  boxSizing: "border-box",
  cursor: parked ? "default" : "pointer",
  minHeight: 36,
  maxWidth: "100%",
  padding: "var(--space-2) var(--space-4)",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "var(--radius-pill)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-s)",
  lineHeight: "var(--text-s-lh)",
  fontWeight: "var(--weight-medium)" as unknown as number,
  textAlign: "left",
  overflowWrap: "anywhere",
  color: parked ? "var(--ink-4)" : on ? "var(--ink)" : "var(--ink-2)",
  background: on ? "var(--bg-sunken)" : "transparent",
  border: on ? "var(--border-card) solid var(--ink)" : "var(--border-thin) solid var(--line)",
  opacity: parked ? 0.6 : 1,
  transition:
    "background var(--dur-default) var(--ease), border-color var(--dur-default) var(--ease)",
});

export function FacetRail({
  axes = [],
  value = {},
  onChange,
  onClear,
  tier = "expanded",
  label = "Filters",
  open,
  onOpenChange,
  style,
  mode = "facets",
  select,
  trigger,
  onExpand,
  expandLabel = "Show " + label.toLowerCase(),
  headingAction,
  clearPlacement = "foot",
}: FacetRailProps) {
  // Declared before the collapsed return: DiscoverySurface swaps one instance between `collapsed`
  // and `facets`, so a hook after that return would change the hook count on the swap.
  const [scrolled, setScrolled] = useState(false);
  // 718 addendum: a collapsed strip declares the selection model of the rail it stands for;
  // `select="single"` is the Hub's strip.
  const railSingle = mode === "single" || (mode === "collapsed" && select === "single");
  const axisSingle = (axis: FacetAxis) => railSingle || axis.select === "single";
  const set = (axis: FacetAxis, optionId: string) => {
    if (railSingle) {
      onChange?.({ [axis.id]: [optionId] });
      return;
    }
    // G76: choose, not toggle.
    if (axis.select === "single") {
      onChange?.({ ...value, [axis.id]: [optionId] });
      return;
    }
    const cur = value[axis.id] || [];
    const next: FacetValue = {
      ...value,
      [axis.id]:
        cur.indexOf(optionId) > -1 ? cur.filter((o) => o !== optionId) : cur.concat(optionId),
    };
    if (!next[axis.id]?.length) delete next[axis.id];
    onChange?.(next);
  };
  const drop = (axis: FacetAxis, optionId: string) => {
    const next: FacetValue = {
      ...value,
      [axis.id]: (value[axis.id] || []).filter((o) => o !== optionId),
    };
    if (!next[axis.id]?.length) delete next[axis.id];
    onChange?.(next);
  };
  const clearAxis = (axis: FacetAxis) => {
    const next: FacetValue = { ...value };
    delete next[axis.id];
    onChange?.(next);
  };
  const isOn = (axisId: string, optionId: string) => (value[axisId] || []).indexOf(optionId) > -1;
  const any = Object.keys(value).some((k) => (value[k] || []).length > 0);
  const onAxisKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!fwd && !back) return;
    const opts = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    );
    const i = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    // 718: arrows move focus only; Enter, Space or click selects.
    opts[(i + (fwd ? 1 : opts.length - 1)) % opts.length]?.focus();
  };

  if (mode === "collapsed") {
    // 612, as amended by 725: an icon strip at expanded when the pane is open. One 48px square per
    // axis, named from the axis label, icon caller-supplied from Strand's set, tinted when any
    // option in the axis is set. A square is not a control over an option; it expands the rail.
    return (
      <nav
        aria-label={label}
        style={{
          position: "sticky",
          top: "var(--space-4)",
          zIndex: "var(--z-rail)" as unknown as number,
          alignSelf: "flex-start",
          width: 64,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2)",
          background: "var(--surface)",
          border: "var(--border-thin) solid var(--line)",
          borderRadius: "var(--radius-l)",
          boxShadow: "var(--shadow-0)",
          ...style,
        }}
      >
        <button
          type="button"
          aria-label={expandLabel}
          title={expandLabel}
          onClick={() => onExpand?.()}
          style={{
            all: "unset",
            boxSizing: "border-box",
            cursor: "pointer",
            width: 48,
            height: 48,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-m)",
            color: "var(--ink-2)",
          }}
        >
          <Icon name="chevron-right" size={20} />
        </button>
        <div
          role="list"
          aria-label={label}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            paddingTop: "var(--space-2)",
            borderTop: "var(--border-thin) solid var(--line)",
          }}
        >
          {axes.map((axis) => {
            const on = (value[axis.id] || []).length > 0;
            return (
              <div key={axis.id} role="listitem">
                <button
                  type="button"
                  aria-label={axis.label}
                  title={axis.label}
                  aria-pressed={on}
                  data-axis={axis.id}
                  onClick={() => onExpand?.()}
                  style={{
                    all: "unset",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    width: 48,
                    height: 48,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-m)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-medium)" as unknown as number,
                    letterSpacing: "var(--tracking-caps)",
                    textTransform: "uppercase",
                    color: on ? "var(--ink)" : "var(--ink-2)",
                    background: on ? "var(--bg-sunken)" : "transparent",
                    border: on
                      ? "var(--border-card) solid var(--ink)"
                      : "var(--border-thin) solid transparent",
                    transition:
                      "background var(--dur-default) var(--ease), border-color var(--dur-default) var(--ease)",
                  }}
                >
                  {axis.icon ? <Icon name={axis.icon} size={20} /> : axis.label.slice(0, 2)}
                </button>
              </div>
            );
          })}
        </div>
      </nav>
    );
  }

  // 1060 and 1085: an axis with ladders is the ladder part whatever `display` says. The single
  // rail and its strip ignore `display`, and a segment needs a single axis.
  const displayOf = (axis: FacetAxis) => {
    if (axis.ladders && axis.ladders.length) return "ladders";
    if (mode !== "facets") return "chips";
    const d = axis.display || "chips";
    if (d === "segment" && axis.select !== "single") return "chips";
    return d;
  };
  const chip = (axis: FacetAxis, o: FacetOption, first: boolean) => {
    const on = isOn(axis.id, o.id);
    const sgl = axisSingle(axis);
    const axisHas = (value[axis.id] || []).length > 0;
    // The roving stop: the checked option, else the first (on the single rail, the rail's first).
    const tab = sgl
      ? on || (!axisHas && first && (railSingle ? !any && axis === axes[0] : true))
        ? 0
        : -1
      : undefined;
    return (
      <button
        key={o.id}
        type="button"
        role={sgl ? "radio" : undefined}
        aria-checked={sgl ? on : undefined}
        aria-pressed={sgl ? undefined : on}
        tabIndex={tab}
        disabled={o.parked}
        aria-disabled={o.parked || undefined}
        data-option={o.id}
        onClick={() => set(axis, o.id)}
        style={CHIP(on, o.parked)}
      >
        {o.label}
      </button>
    );
  };
  const body = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {axes.map((axis) => {
        const disp = displayOf(axis);
        const own = disp === "segment" || disp === "combobox";
        return (
          <div
            key={axis.id}
            role={
              own
                ? undefined
                : axisSingle(axis) && (disp === "chips" || disp === "ladders")
                  ? "radiogroup"
                  : "group"
            }
            aria-labelledby={own ? undefined : "facet-" + axis.id}
            data-axis-id={axis.id}
            data-display={disp}
            data-select={axisSingle(axis) ? "single" : "multi"}
            onKeyDown={disp === "combobox" ? undefined : onAxisKey}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
          >
            <div
              id={"facet-" + axis.id}
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              {axis.label}
            </div>
            {disp === "segment" ? (
              <Segment
                label={axis.label}
                options={[{ value: "", label: axis.anyLabel || "Any" }].concat(
                  (axis.options || []).map((o) => ({ value: o.id, label: o.label })),
                )}
                value={(value[axis.id] || [])[0] || ""}
                onChange={(v) => (v ? set({ ...axis, select: "single" }, v) : clearAxis(axis))}
              />
            ) : disp === "checklist" ? (
              // G102: each track is at least half of 150 less the gap and never less than half the
              // checklist less the gap, so the second column opens at 150 and a third never does.
              <div
                data-columns={axis.columns === 2 ? "2" : undefined}
                style={
                  axis.columns === 2
                    ? {
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(max(calc((150px - var(--space-2)) / 2), calc((100% - var(--space-2)) / 2)), 1fr))",
                        columnGap: "var(--space-2)",
                      }
                    : { display: "flex", flexDirection: "column" }
                }
              >
                {(axis.options || []).map((o) => {
                  const on = isOn(axis.id, o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      data-option={o.id}
                      disabled={o.parked}
                      onClick={() => set(axis, o.id)}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: o.parked ? "default" : "pointer",
                        minHeight: 44,
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-s)",
                        lineHeight: "var(--text-s-lh)",
                        color: o.parked ? "var(--ink-4)" : "var(--ink)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: "none",
                          width: 22,
                          height: 22,
                          boxSizing: "border-box",
                          borderRadius: "var(--radius-s)",
                          border:
                            "var(--border-card) solid " +
                            (on ? "var(--ink)" : "var(--line-strong)"),
                          background: on ? "var(--ink)" : "var(--surface)",
                          color: "var(--on-fill)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background var(--dur-micro) var(--ease)",
                        }}
                      >
                        {on && <Icon name="check" size={14} />}
                      </span>
                      <span style={{ minWidth: 0 }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : disp === "combobox" ? (
              <ComboAxis
                axis={axis}
                chosen={value[axis.id] || []}
                onPick={(id) => set(axis, id)}
                onDrop={(id) => drop(axis, id)}
              />
            ) : axis.ladders && axis.ladders.length ? (
              axis.ladders.map((ld, li) => (
                <div
                  key={ld.id}
                  data-ladder={ld.id}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
                >
                  {(axis.ladders || []).length > 1 && ld.label && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
                      {ld.label}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {(ld.rungs || []).map((o, oi) => chip(axis, o, li === 0 && oi === 0))}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {(axis.options || []).map((o, oi) => chip(axis, o, oi === 0))}
              </div>
            )}
          </div>
        );
      })}
      {/* G111: under `clearPlacement="heading"` the rail form draws Clear all in its heading row
          instead; the compact Sheet keeps it here. */}
      {!railSingle && (clearPlacement !== "heading" || tier === "compact") && (
        <div aria-live="polite" role="status" style={{ minHeight: 0 }}>
          {any && (
            <Button variant="ghost" size="sm" onClick={() => onClear?.()}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (tier === "compact") {
    const openIt = () => onOpenChange?.(true);
    return (
      <>
        {trigger ? (
          trigger({ open: !!open, onOpen: openIt, label })
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={!!open}
            onClick={openIt}
            style={style}
          >
            {label}
          </Button>
        )}
        {open && (
          // Ruling 618: the compiled call is `tier="compact"`, which this repository's Sheet spells
          // `variant="sheet"`. Its `title` is the dialog's accessible name here, because this Sheet
          // renders no heading of its own (G30), so the heading below stands in (480). Nor does it
          // render the scrolling body Strand's Sheet pins that title above, which 25 §3's "every
          // display renders in it" relies on, so the part draws the two as this repository's other
          // Sheet callers with a scroller do: the heading in a row that does not scroll, the axes in
          // a body that does. At rest nothing moves, and the axes the chips' 24 §2 height pushes
          // past the sheet stay reachable. This heading row is the stand-in for Strand's Sheet
          // title, which carries no Clear all, so it never takes G111's slot: whatever
          // `clearPlacement` says, Clear all stays at the body's foot here (28 item 5).
          <Sheet open onClose={() => onOpenChange?.(false)} variant="sheet" label={label} contained>
            <div style={{ flex: "none", padding: "var(--space-5) var(--space-5) 0" }}>
              <h2
                data-sheet-heading
                tabIndex={-1}
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--display-s)",
                  lineHeight: "var(--display-s-lh)",
                  fontWeight: "var(--weight-semibold)" as unknown as number,
                }}
              >
                {label}
              </h2>
            </div>
            <div
              data-sheet-body
              style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-5)" }}
            >
              {body}
            </div>
          </Sheet>
        )}
      </>
    );
  }

  return (
    <nav
      aria-label={label}
      data-rail-scroller=""
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      style={{
        position: "sticky",
        top: "var(--space-4)",
        zIndex: "var(--z-rail)" as unknown as number,
        alignSelf: "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        padding: "var(--space-5)",
        background: "var(--surface)",
        border: "var(--border-thin) solid var(--line)",
        borderRadius: "var(--radius-l)",
        boxShadow: "var(--shadow-0)",
        // 25 §3: the rail is its own scroller; the caller bounds its height through `style`.
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div
        data-heading-pin=""
        data-scrolled={scrolled ? "" : undefined}
        style={{
          position: "sticky",
          top: "calc(-1 * var(--space-5))",
          zIndex: 1,
          flex: "none",
          margin: "calc(-1 * var(--space-5)) calc(-1 * var(--space-5)) calc(-1 * var(--space-3))",
          padding: "var(--space-5) var(--space-5) var(--space-3)",
          background: "var(--surface)",
          borderBottom: "var(--border-thin) solid " + (scrolled ? "var(--line)" : "transparent"),
          transition: "border-color var(--dur-default) var(--ease)",
        }}
      >
        <div
          data-heading
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            minHeight: headingAction ? 44 : undefined,
            margin: headingAction ? "calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0" : 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--display-s)",
              lineHeight: "var(--display-s-lh)",
              fontWeight: "var(--weight-semibold)" as unknown as number,
            }}
          >
            {label}
          </h2>
          {/* G111: the live region is drawn whenever the placement asks for it, empty until a
              facet is set, as the foot's is, so filling it is announced. */}
          {!railSingle && clearPlacement === "heading" && (
            <div
              aria-live="polite"
              role="status"
              data-clear-slot=""
              style={{ flex: "none", display: "flex", alignItems: "center" }}
            >
              {any && (
                <Button variant="ghost" size="sm" onClick={() => onClear?.()}>
                  Clear all
                </Button>
              )}
            </div>
          )}
          {headingAction && (
            <div
              data-heading-action
              style={{ flex: "none", display: "flex", alignItems: "center" }}
            >
              {headingAction}
            </div>
          )}
        </div>
      </div>
      {body}
    </nav>
  );
}

/** Correction 25 §3: the combobox display (Place). Prefix match on each word of the label and the
 *  detail; chosen options leave the list and render as removable chips under the field. Nothing
 *  says how many matched. */
function ComboAxis({
  axis,
  chosen,
  onPick,
  onDrop,
}: {
  axis: FacetAxis;
  chosen: string[];
  onPick: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const words = (s: string | undefined) =>
    (s || "")
      .toLowerCase()
      .split(/[\s,·()-]+/)
      .filter(Boolean);
  const hit = (o: FacetOption) =>
    !!ql &&
    (o.label.toLowerCase().indexOf(ql) === 0 ||
      words(o.label)
        .concat(words(o.detail))
        .some((w) => w.indexOf(ql) === 0));
  const sugg = (axis.options || [])
    .filter((o) => !o.parked && chosen.indexOf(o.id) < 0 && hit(o))
    .slice(0, 8)
    .map((o) => ({ value: o.id, label: o.label, detail: o.detail }));
  const byId: Record<string, FacetOption> = {};
  (axis.options || []).forEach((o) => {
    byId[o.id] = o;
  });
  const nameOf = (id: string) => byId[id]?.label || id;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <Input
        aria-labelledby={"facet-" + axis.id}
        icon={axis.fieldIcon || "map-pin"}
        placeholder={axis.placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        suggestions={sugg}
        onSuggestionSelect={(s) => {
          onPick(s.value);
          setQ("");
        }}
        noMatch={axis.noMatch}
        listbox="inline"
      />
      {chosen.length > 0 && (
        <div
          role="list"
          aria-label={axis.label}
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
        >
          {chosen.map((id) => (
            <div key={id} role="listitem" style={{ maxWidth: "100%", display: "flex" }}>
              <button
                type="button"
                data-chosen={id}
                aria-label={(axis.removeLabel || "Remove") + " " + nameOf(id)}
                onClick={() => onDrop(id)}
                style={{ ...CHIP(true, false), gap: "var(--space-2)" }}
              >
                <span style={{ minWidth: 0 }}>{nameOf(id)}</span>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
