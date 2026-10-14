// Ported from Strand components/core/Popover.jsx at compile sha256-b1a458dac1bd562f (ruling 1578;
// proposed by SPEC-41-E 2.4, adopted by correction 56; handoff H61-SP). New to the tree, and the
// one file this port adds beyond the handoff's list: ReactionPicker's full view is a Popover on a
// pointer (item 5), and the part it is a section of is Strand's own. The pointer container the
// emoji picker opens in, in Menu's chrome: --surface, a --line border, --radius-l, --shadow-3, at
// --z-menu, width min(100%, 360px). A title row with a Close IconButton; Escape closes; a press
// outside closes; closing returns focus to the trigger; focus moves to the first control in the
// body on open. Pointer only (1578): on touch the picker is a Sheet, which the caller draws; the
// part renders on either mode and leaves the branch to the caller. Portal (default): fixed from the
// anchor's rect, bottom-start, flipped above when the space below is short, clamped inside the
// viewport, repositioned on scroll and resize; `portal={false}` renders in place. role="dialog"
// named by title or label; not modal, so a Tab that leaves the panel closes it. No count, ever.
// Translations, none visible: `useInputMode` is the app's `useMode`; the portal is react-dom's
// `createPortal`, where the compile reads `window.ReactDOM`. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { useMode, type Mode } from "@/lib/tier";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type PopoverProps = {
  open: boolean;
  onClose?: (() => void) | undefined;
  anchorRef?: RefObject<HTMLElement | null> | undefined;
  title?: string | undefined;
  label?: string | undefined;
  input?: Mode | undefined;
  portal?: boolean | undefined;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | undefined;
  width?: string | number | undefined;
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

export function Popover({
  open,
  onClose,
  anchorRef,
  title,
  label,
  input,
  portal = true,
  placement = "bottom-start",
  width = "min(100%, 360px)",
  children,
  style,
}: PopoverProps) {
  const detected = useMode();
  const mode = input || detected;
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const focused = useRef(false);
  const close = (restore = true) => {
    if (onClose) onClose();
    if (!restore) return;
    const t = (returnTo.current || (anchorRef && anchorRef.current)) as HTMLElement | null;
    if (!t || !document.contains(t)) return;
    const f = t.matches && t.matches(FOCUSABLE) ? t : t.querySelector<HTMLElement>(FOCUSABLE);
    (f || t).focus?.({ preventScroll: true });
  };
  const place = useCallback(() => {
    if (!portal || !anchorRef || !anchorRef.current || !box.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const m = box.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const edge = 8;
    const below = vh - a.bottom - gap;
    const above = a.top - gap;
    const up =
      placement.indexOf("top") === 0
        ? above >= m.height || above > below
        : below < m.height && above > below;
    let top = up ? a.top - gap - m.height : a.bottom + gap;
    let left = placement.slice(-3) === "end" ? a.right - m.width : a.left;
    left = Math.max(edge, Math.min(left, vw - edge - m.width));
    top = Math.max(edge, Math.min(top, vh - edge - m.height));
    setPos({ top, left, up });
  }, [portal, anchorRef, placement]);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      focused.current = false;
      return;
    }
    // captured before anything inside takes focus, so Escape and Close return to the trigger
    returnTo.current = document.activeElement;
    place();
    if (!portal) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, portal]);
  useLayoutEffect(() => {
    if (!open || focused.current || (portal && !pos) || !box.current) return;
    const f =
      (body.current && body.current.querySelector<HTMLElement>(FOCUSABLE)) ||
      box.current.querySelector<HTMLElement>(FOCUSABLE);
    if (f) {
      f.focus({ preventScroll: true });
      focused.current = true;
    }
  }, [open, pos, portal]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (
        box.current &&
        t &&
        !box.current.contains(t) &&
        !(anchorRef && anchorRef.current && anchorRef.current.contains(t))
      )
        close(false);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const n = e.relatedTarget as Node | null;
    if (
      n &&
      box.current &&
      !box.current.contains(n) &&
      !(anchorRef && anchorRef.current && anchorRef.current.contains(n))
    )
      close(false);
  };
  const geo: CSSProperties = portal
    ? {
        position: "fixed",
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        visibility: pos ? "visible" : "hidden",
      }
    : {
        position: "absolute",
        top: placement.indexOf("top") === 0 ? "auto" : "calc(100% + 4px)",
        bottom: placement.indexOf("top") === 0 ? "calc(100% + 4px)" : "auto",
        right: placement.slice(-3) === "end" ? 0 : "auto",
        left: placement.slice(-3) === "end" ? "auto" : 0,
      };
  const el = (
    <div
      ref={box}
      role="dialog"
      aria-label={title || label}
      data-popover=""
      data-input={mode}
      data-placement={pos && pos.up ? "top" : "bottom"}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onClick={(e) => e.stopPropagation()}
      style={{
        ...geo,
        zIndex: "var(--z-menu)" as unknown as number,
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        background: "var(--surface)",
        color: "var(--ink)",
        border: "var(--border-thin) solid var(--line)",
        borderRadius: "var(--radius-l)",
        boxShadow: "var(--shadow-3)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          minHeight: 36,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-s)",
            lineHeight: "var(--text-s-lh)",
            fontWeight: "var(--weight-medium)" as unknown as number,
            minWidth: 0,
          }}
        >
          {title}
        </span>
        <IconButton
          name="x"
          label="Close"
          input={mode}
          size={mode === "touch" ? 44 : 36}
          onClick={() => close(true)}
        />
      </div>
      <div ref={body} style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
  if (portal && typeof document !== "undefined") return createPortal(el, document.body);
  return el;
}
