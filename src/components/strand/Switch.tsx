// Ported from Strand components/core/Switch.jsx. Behavior unchanged. Re-synced at compile
// v1789537371639386 (correction 13, ruling 703): the label is a block beside the control, so it
// wraps in a narrow host and no caller needs white-space: nowrap. Callers that already fit render
// unchanged. Re-synced at compile sha256-b1a458dac1bd562f (1704, brief 60-SP item 19; handoff
// H61-SP): `hint`, the line Input and Select have, 13px --ink-3 under the label, tied to the switch
// by aria-describedby; with a hint the row aligns to the top. The compile's `id || React.useId()`
// is an unconditional `useId`, as Input's is. Absent, unchanged. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import { useId, type CSSProperties, type ReactNode } from "react";

export type SwitchProps = {
  label?: ReactNode;
  /** 1704 (item 19): a 13px --ink-3 line under the label, tied by aria-describedby. */
  hint?: ReactNode;
  checked?: boolean | undefined;
  onChange?: ((checked: boolean) => void) | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  style?: CSSProperties | undefined;
};

/** Toggle switch with label. 703 (correction 13): the label is a block beside the control, so it wraps in a narrow host
 *  and no caller needs white-space: nowrap. Callers that already fit render unchanged.
 *  1704 (brief 60-SP item 19): `hint`, the line Input and Select have: 13px --ink-3 under the label, beside the control, tied to the switch by aria-describedby.
 *  With a hint the row aligns to the top so the control sits by the label's first line. Absent, unchanged. */
export function Switch({ label, hint, checked, onChange, disabled, id, style }: SwitchProps) {
  const autoId = useId();
  const uid = id || autoId;
  const hintId = uid + "-hint";
  return (
    <label
      htmlFor={uid}
      style={{
        display: "inline-flex",
        alignItems: hint ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontSize: 17,
        ...style,
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: "1 1 auto",
          minWidth: 0,
          lineHeight: 1.3,
          paddingTop: hint ? 10 : 0,
        }}
      >
        <span style={{ display: "block" }}>{label}</span>
        {hint ? (
          <span
            id={hintId}
            style={{
              display: "block",
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--ink-3)",
              textWrap: "pretty",
            }}
          >
            {hint}
          </span>
        ) : null}
      </span>
      <input
        id={uid}
        type="checkbox"
        role="switch"
        checked={!!checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          background: checked ? "var(--ink)" : "var(--line-strong)",
          position: "relative",
          flex: "none",
          marginTop: hint ? 9 : 0,
          transition: "background var(--dur-default) var(--ease)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "var(--surface)",
            transition: "left var(--dur-default) var(--ease)",
          }}
        />
      </span>
    </label>
  );
}
