// Ported from profile/strand-patch/Profile.jsx (B3-Profile-v3, ruling 130; guide amendment 4.2).
// The five Cs for the public close: --shadow-2 at rest (the deck exception); hover takes the C
// colour (ruling 129), no lift, no fill; tap opens the C sheet.
import { useState, type CSSProperties } from "react";
import { CBadge } from "@/components/strand/CBadge";
import { Icon } from "@/components/strand/Icon";
import { C_INFO } from "./cinfo";
import type { C } from "@/components/strand/cmeta";

export type CCardProps = { c: C; onOpen: (c: C) => void; style?: CSSProperties | undefined };

export function CCard({ c, onOpen, style }: CCardProps) {
  const [h, setH] = useState(false);
  const info = C_INFO[c];
  return (
    <button
      type="button"
      data-testid={"c-card-" + c}
      onClick={() => onOpen(c)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        appearance: "none",
        margin: 0,
        font: "inherit",
        color: "inherit",
        textDecoration: "none",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: "20px 14px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid " + (h ? "var(--c-" + c + ")" : "var(--line)"),
        boxShadow: "var(--shadow-2)",
        fontFamily: "var(--font-sans)",
        transition: "border-color var(--dur-default) var(--ease)",
        minHeight: 44,
        width: "100%",
        ...style,
      }}
    >
      <CBadge c={c} size={48} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
          lineHeight: 1.2,
          color: h ? "var(--c-" + c + "-text)" : "var(--ink)",
          transition: "color var(--dur-default) var(--ease)",
        }}
      >
        {info.label}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" }}>
        {info.line}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--c-" + c + "-text)",
          minHeight: 24,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Learn more <Icon name="chevron-right" size={14} />
      </span>
    </button>
  );
}
