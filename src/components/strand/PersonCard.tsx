// Strand `components/dna/PersonCard.jsx` at compile v1790724894917128 (correction 35, ratified
// under 1229 and 1230; handoff 37-E item 3), which adds `readOnly` to the part first ported at
// v1790410319010950 (correction 30 Part A ask 3, every size a token since correction 31 item 1;
// ratified together under 1153; handoff 33-D). The public event page's People binds the read-only
// layout; the interactive layouts are unchanged. Divergence carried from the other ports: the
// device's input mode comes from `useMode` in src/lib/tier.ts, where the compile reads
// `(pointer: coarse)` in render. Dispositions are in docs/strand-ports/v1790724894917128.md.
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import type { C } from "./cmeta";
import { useMode, type Mode } from "@/lib/tier";

export type PersonCardProps = {
  /** Rendered as passed; the part never looks a name up or composes one. */
  name?: string;
  /** Row layout only: caps line in the C's text rung, e.g. "Host", "Speaker", "Sponsor, chosen by the host". */
  role?: ReactNode;
  /** Row layout only: one line under the role, e.g. a partner's note. */
  note?: ReactNode;
  /** Avatar photo; initials otherwise. */
  src?: string | undefined;
  /** row (People, Partners): 56 avatar, name in the display face, role, note. tile (Going): 48 avatar over the name, centred. Default row. */
  layout?: "row" | "tile";
  /** Colours the role line. Default convene. */
  c?: C;
  /** The profile's address: the card renders as an anchor. */
  href?: string | undefined;
  /** In-app open; with href a plain primary click calls it and prevents the default. Without href the card is a button. */
  onOpen?: (() => void) | undefined;
  /** Accessible name. Default "Open {name}". */
  openLabel?: string | undefined;
  /** Correction 35 (1230, G162): the same card as a plain div for display-only contexts (the public event page's People): no button, no link, no focus stop, no hover edge. */
  readOnly?: boolean | undefined;
  /** Overrides the detected input mode (hover edge on pointer only). */
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

/** Correction 30 (Part A, ask 3). The card v5 draws for People, Partners and the Going tile. Two layouts read off the drawing; every size is a token since correction 31 (--avatar-card 56, --avatar-tile 48, --person-card-min-height 84, --person-tile-min-height 112).
 *  row (People, Partners): a 56 Avatar left; name in the display face (v5 20/1.2, carried to --display-s); role in caps at --tracking-caps, medium, in the C's text rung (v5 12, carried to --text-xs);
 *  an optional line (v5 14/1.4 --ink-2, carried to --text-xs). Card: --surface, 1px --line edge, --radius-l, min height 84; v5 padding and gap 14 carried to --space-3; edge --line-strong on hover.
 *  tile (Going): a 48 Avatar over the name at --text-xs medium, centred, balanced; padding v5 14 8 12 carried to --space-4 --space-2 --space-3; min height 112.
 *  The whole card is one control that opens the profile: an anchor with href, else a button with onOpen. A name renders only as the caller passes it; the part never looks one up.
 *  Correction 35 (1230, G162): readOnly renders the same card as a plain div for display-only contexts (the public event page's People): no button, no link, no focus stop, no hover edge. */
export function PersonCard({
  name = "",
  role,
  note,
  src,
  layout = "row",
  c = "convene",
  href,
  onOpen,
  openLabel,
  readOnly = false,
  input,
  style,
}: PersonCardProps) {
  const [hot, setHot] = useState(false);
  const detected = useMode();
  const touch = input ? input === "touch" : detected === "touch";
  const tile = layout === "tile";
  const base: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "flex",
    fontFamily: "var(--font-sans)",
    color: "var(--ink)",
    textDecoration: "none",
    background: "var(--surface)",
    borderRadius: "var(--radius-l)",
    border: "var(--border-thin) solid " + (hot && !touch ? "var(--line-strong)" : "var(--line)"),
    transition: "border-color var(--dur-default) var(--ease)",
    outlineOffset: "var(--focus-offset)",
  };
  const geom: CSSProperties = tile
    ? {
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--space-2)",
        padding: "var(--space-4) var(--space-2) var(--space-3)",
        minHeight: "var(--person-tile-min-height)",
      }
    : {
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        minHeight: "var(--person-card-min-height)",
      };
  const label = openLabel || "Open " + name;
  const body = tile ? (
    <>
      <Avatar name={name} src={src} size="var(--avatar-tile)" radius="var(--radius-m)" />
      <span
        data-field="name"
        style={
          {
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            fontWeight: "var(--weight-medium)",
            textWrap: "balance",
          } as CSSProperties
        }
      >
        {name}
      </span>
    </>
  ) : (
    <>
      <Avatar name={name} src={src} size="var(--avatar-card)" radius="var(--radius-m)" />
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          minWidth: 0,
          flex: 1,
        }}
      >
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
        {role ? (
          <span
            data-field="role"
            style={{
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              fontWeight: "var(--weight-medium)" as unknown as number,
              color: "var(--c-" + c + "-text)",
            }}
          >
            {role}
          </span>
        ) : null}
        {note ? (
          <span
            data-field="note"
            style={{
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              color: "var(--ink-2)",
            }}
          >
            {note}
          </span>
        ) : null}
      </span>
    </>
  );
  const on = {
    onMouseEnter: () => setHot(true),
    onMouseLeave: () => setHot(false),
    onFocus: () => setHot(true),
    onBlur: () => setHot(false),
  };
  if (readOnly)
    return (
      <div
        data-person-card={layout}
        data-readonly=""
        style={{
          ...base,
          ...geom,
          cursor: "default",
          border: "var(--border-thin) solid var(--line)",
          transition: "none",
          ...style,
        }}
      >
        {body}
      </div>
    );
  if (href)
    return (
      <a
        data-person-card={layout}
        href={href}
        aria-label={label}
        onClick={
          onOpen
            ? (e: MouseEvent<HTMLAnchorElement>) => {
                if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
        {...on}
        style={{ ...base, ...geom, ...style }}
      >
        {body}
      </a>
    );
  return (
    <button
      type="button"
      data-person-card={layout}
      aria-label={label}
      onClick={onOpen}
      {...on}
      style={{ ...base, ...geom, ...style }}
    >
      {body}
    </button>
  );
}
