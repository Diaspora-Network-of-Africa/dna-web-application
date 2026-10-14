// Strand `components/core/Tooltip.jsx` at compile v1790410319010950 (correction 31 item 3, ruling
// 1146; corrections 30 and 31 ratified together under 1153, handoff 33-D). The compile rebuilt the
// part; the tree had never ported its earlier form. Dispositions are in
// docs/strand-ports/v1790410319010950.md.
//
// Divergence carried from the other ports (PostCard, Menu, LensBar): the input mode comes from
// `useMode` in src/lib/tier.ts, the app's one input-mode source, where the compile reads its own
// `useInputMode`. Both answer `(pointer: coarse)` and follow its changes; `useMode` reads "pointer"
// until its effect runs, so the first paint on a touch device can hold a tooltip only if a pointer
// rested on the control before hydration, and the effect below hides it the moment the mode turns.
//
// The part measures its host span, as compiled. A caller that positions an IconButton absolutely
// puts the placement on a wrapper around it, so the host span wraps the button and the tooltip is
// placed against the control (G136).
//
// Re-synced at compile sha256-b1a458dac1bd562f (brief 60-SP item 6; FC 5.2 item 6, carried from
// 58; 1632, 1633; handoff H61-SP): `open` makes the part controlled. While it is passed, hover and
// focus do not toggle it, and it shows on touch too, so a held press can name its control
// (ReactionPicker's hold at 500 ms). Still aria-hidden: the control keeps its name. Absent, the
// part is unchanged. Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useMode, type Mode } from "@/lib/tier";

/** When the last tooltip hid, shared by every instance, for --tooltip-grace. */
let lastHide = 0;
const readMs = (name: string) => {
  if (typeof document === "undefined") return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v.endsWith("ms")
    ? parseFloat(v)
    : v.endsWith("s")
      ? parseFloat(v) * 1000
      : parseFloat(v) || 0;
};

export type TooltipProps = Omit<HTMLAttributes<HTMLSpanElement>, "style" | "children"> & {
  /** The control's label; the tooltip repeats it visually only. The child keeps the accessible name. */
  label: string;
  children?: ReactNode;
  /** Default bottom; flips to stay inside the viewport. */
  placement?: "bottom" | "top" | undefined;
  /** Overrides the detected input mode; touch renders no tooltip. */
  input?: Mode | undefined;
  /** Item 6 (1632, 1633): controlled. Shows while true on any input, touch included; hover and
   *  focus no longer toggle it. Absent, uncontrolled as before. */
  open?: boolean | undefined;
  style?: CSSProperties | undefined;
};

/** Tooltip (1146, correction 31). Wraps one control and names it. Appears --tooltip-delay after the pointer rests on the control or keyboard focus reaches it; once one is showing,
 *  a neighbour's shows at once for --tooltip-grace after the last hid. Hides on Escape, blur and pointer leave; the pointer may move onto the tooltip without closing it (WCAG 1.4.13).
 *  The child keeps its accessible name (aria-label); the tooltip is aria-hidden so it is not announced twice, and it carries no id the child points at. No tooltip on touch.
 *  Below the control by default, flipping above when the viewport's foot is too near; shifted sideways to stay inside. Fixed position, --z-tooltip, so no scroller clips it.
 *  Brief 60-SP item 6 (1632, 1633): `open` makes it controlled. While `open` is passed, hover and focus do not toggle it, and it shows on touch too, so a held press can name
 *  its control (the caller's long press at 500 ms). Still aria-hidden: the control keeps its name. Absent, the part is unchanged. */
export function Tooltip({
  label,
  children,
  placement = "bottom",
  input,
  open,
  style,
  ...rest
}: TooltipProps) {
  const detected = useMode();
  const mode = input || detected;
  const [hover, setOn] = useState(false);
  const controlled = open !== undefined;
  const on = controlled ? !!open : hover;
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const host = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
  const showRef = useRef<() => void>(() => {});
  const hideRef = useRef<() => void>(() => {});
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = 0;
    }
  };
  const [waited, setWaited] = useState<number | null>(null);
  const show = () => {
    if (controlled || mode === "touch" || !label) return;
    clear();
    const grace = readMs("--tooltip-grace");
    if (Date.now() - lastHide < grace) {
      setWaited(0);
      setOn(true);
    } else {
      const d = readMs("--tooltip-delay");
      setWaited(d);
      timer.current = setTimeout(() => setOn(true), d);
    }
  };
  const hide = () => {
    clear();
    if (on) lastHide = Date.now();
    setOn(false);
  };
  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (mode === "touch" && hover) hide();
  }, [mode]);
  // Correction 31: `input` overrides the detected mode, as PersonCard and BrowseTile take it, so a touch specimen can be drawn on a pointer device.
  useLayoutEffect(() => {
    if (!on || !host.current || !tip.current) {
      if (!on) setPos(null);
      return;
    }
    const gap =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tooltip-gap")) || 0;
    const a = host.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let below = placement !== "top";
    if (below && a.bottom + gap + t.height > vh && a.top - gap - t.height >= 0) below = false;
    if (!below && a.top - gap - t.height < 0 && a.bottom + gap + t.height <= vh) below = true;
    const top = below ? a.bottom + gap : a.top - gap - t.height;
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(gap, Math.min(vw - gap - t.width, left));
    setPos({ top, left, below });
  }, [on, label, placement]);
  useEffect(() => {
    // bound once; Escape hides a showing tooltip and cancels a pending one, without waiting on a re-render to attach
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideRef.current();
    }; // showing or still pending: Escape cancels either
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  // Native pointerover/pointerout on the host (the events the browser fires), so the part does not depend on React's enter/leave synthesis.
  // Over from outside the host shows; out to outside the host hides, unless the pointer went onto the tooltip itself.
  showRef.current = show;
  hideRef.current = hide;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const outside = (n: EventTarget | null) =>
      !n || (!el.contains(n as Node) && !(tip.current && tip.current.contains(n as Node)));
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (outside(e.relatedTarget)) showRef.current();
    };
    const out = (e: PointerEvent) => {
      if (outside(e.relatedTarget)) hideRef.current();
    };
    el.addEventListener("pointerover", over);
    el.addEventListener("pointerout", out);
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerout", out);
    };
  }, []);
  return (
    <span
      ref={host}
      data-tooltip-host
      data-tooltip-waited={on && waited != null ? waited : undefined}
      style={{ display: "inline-flex", ...style }}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
      {...rest}
    >
      {children}
      {on && (controlled || mode !== "touch") ? (
        <span
          ref={tip}
          role="tooltip"
          aria-hidden="true"
          data-tooltip
          data-controlled={controlled ? "" : undefined}
          data-placement={pos ? (pos.below ? "bottom" : "top") : undefined}
          style={{
            position: "fixed",
            top: pos ? pos.top : 0,
            left: pos ? pos.left : 0,
            visibility: pos ? "visible" : "hidden",
            zIndex: "var(--z-tooltip)" as unknown as number,
            maxWidth: "var(--tooltip-max-width)",
            background: "var(--inverse-bg)",
            color: "var(--inverse-ink)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            padding: "var(--space-1) var(--space-2)",
            borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-2)",
            whiteSpace: "nowrap",
            pointerEvents: "auto",
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
