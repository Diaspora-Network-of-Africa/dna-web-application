// Ported from profile/strand-patch/Profile.jsx (B3-Profile-v3, ruling 132). Behavior unchanged.
// H61-SP: `MastheadPattern` lives here since ProfileHeader became Strand's (compile
// sha256-b1a458dac1bd562f, item 13), because this is the app part that enumerates the three tiles;
// profile.ts and ProfileSurface read it from here.
import type { CSSProperties } from "react";
import { Icon } from "@/components/strand/Icon";
import { assetBase } from "@/components/strand/cmeta";

/** The three curated masthead tiles (guide amendment 4.4, ruling 132). */
export type MastheadPattern = "kente" | "adinkra" | "mudcloth";

/** Curated masthead patterns: three textile tiles, chosen, never uploaded (guide amendment 4.4). */
export const PATTERNS: { id: MastheadPattern; label: string }[] = [
  { id: "kente", label: "Kente" },
  { id: "adinkra", label: "Adinkra" },
  { id: "mudcloth", label: "Mudcloth" },
];

export type PatternPickerProps = {
  value?: MastheadPattern;
  onChange?: ((value: MastheadPattern) => void) | undefined;
  style?: CSSProperties | undefined;
};

export function PatternPicker({ value = "kente", onChange, style }: PatternPickerProps) {
  const base = assetBase();
  return (
    <div
      role="radiogroup"
      aria-label="Masthead pattern"
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {PATTERNS.map((pt) => {
        const on = pt.id === value;
        return (
          <button
            key={pt.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange && onChange(pt.id)}
            style={{
              all: "unset",
              boxSizing: "border-box",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                display: "block",
                width: 132,
                height: 72,
                borderRadius: 10,
                background: "var(--bg-sunken) url(" + base + "patterns/" + pt.id + "-pattern.svg)",
                border: on ? "2px solid var(--ink)" : "1px solid var(--line)",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: on ? "var(--ink)" : "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 24,
              }}
            >
              {on && <Icon name="check" size={14} />}
              {pt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
