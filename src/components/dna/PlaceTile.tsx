// Ported from connect/strand-patch/Connect.jsx (Brief 4, ruling 165). PlaceTile: one country above
// the floor on Where. One treatment, no band prop, never a count (rulings 111, 158, 159). The
// injected :focus-visible style of the source is the repo stylesheet (.strand-placetile in
// src/styles/strand.css); the reset is written property by property so that ring applies.
import { useState, type CSSProperties } from "react";

export type PlaceTileProps = {
  name: string;
  onPick?: (() => void) | undefined;
  pointer?: boolean | undefined;
  style?: CSSProperties | undefined;
};

export function PlaceTile({ name, onPick, pointer, style }: PlaceTileProps) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={name + ". Show members there."}
      onMouseEnter={() => pointer && setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="strand-placetile"
      data-testid="place-tile"
      style={{
        appearance: "none",
        margin: 0,
        font: "inherit",
        textAlign: "left",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        minHeight: 104,
        padding: 14,
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--c-connect-tint)",
        color: "var(--c-connect-text)",
        fontFamily: "var(--font-sans)",
        filter: hov ? "brightness(0.92)" : "none",
        transition: "filter 150ms var(--ease)",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
          lineHeight: 1.15,
          textWrap: "balance",
        }}
      >
        {name}
      </span>
    </button>
  );
}
