// Ported from Strand components/dna/ImageViewer.jsx at compile v1791654208929113 (1429, 1431,
// 1452, 1453; H60-MEDIA Work 1). New to the tree. MediaBlock owns its open state, so no surface
// wires it. Translations, none visible: the compile's `useInputMode` is the app's `useMode`
// (src/lib/tier.ts), the one input-mode source every port reads; React's synthetic events are
// typed. Its `.strand-viewer::backdrop` rule stays in the part's own <style> element as compiled
// (the CSP allows inline styles; strand.css keeps tokens and Sheet's rules only). `contained` and
// `autoFocus` are carried as compiled; no surface passes either (1547). Record:
// docs/strand-ports/v1791654208929113-media.md.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Icon } from "./Icon";
import { useMode, type Mode } from "@/lib/tier";

export type ImageViewerProps = {
  open: boolean;
  /** The masters, in order. A single image is a list of one. */
  items?: string[];
  /** The image open on entry. */
  index?: number;
  /** One description for every image, or one per image; read by the aria-live region, never an ordinal (1453). */
  alt?: string | string[];
  onIndexChange?: ((index: number) => void) | undefined;
  onClose?: (() => void) | undefined;
  /** 1452: steps through more than one item by default; false holds one image. */
  step?: boolean | undefined;
  /** Renders inside a positioned ancestor instead of the top layer (specimens; no surface passes it, 1547). */
  contained?: boolean | undefined;
  input?: Mode | undefined;
  /** Moves focus to Close on open and back on close; no surface passes false (1547). */
  autoFocus?: boolean | undefined;
  label?: string | undefined;
  style?: CSSProperties | undefined;
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const SWIPE = 48;

/** ImageViewer (1429, 1431). Shows one image whole, at the largest size the screen allows, over a near-black ground.
 *  Opened by tapping a single feed image or a gallery tile; MediaBlock owns that state, so no consumer wires it.
 *  Contract per 480, read off Sheet: native <dialog> (showModal, so the focus trap and Escape are the platform's),
 *  focus moves to Close on open and returns to the control that opened it on close, and the ground closes the viewer on tap.
 *  Close is a visible control, never only a gesture. Escape closes. Tapping the ground outside the image closes.
 *  Motion (604): the image fades and settles by --dur-default on --ease; under prefers-reduced-motion: reduce it is immediate,
 *  matching base.css, which zeroes the three durations rather than switching a second path on.
 *  The ground is the same near-black in both themes, so the viewer's ink is named (--viewer-ink, --viewer-control) rather
 *  than inherited from --ink, which flips. Controls are drawn here, not IconButton: IconButton is styled for a surface ground.
 *  1452: the viewer steps through a gallery by default. With more than one item it steps: chevrons (at the sides on a pointer,
 *  in the footer within thumb reach on touch), ArrowLeft and ArrowRight, and a horizontal swipe. step={false} holds one image.
 *  1453: no position mark, no dots and no count. Stepping does not wrap: at the first or last image the chevron for that
 *  direction is absent, which is the only position cue, matching MediaBlock's carousel, which draws no indicator either.
 *  Where a screen reader needs the change announced, the aria-live region reads the image's own description, never an ordinal. */
export function ImageViewer({
  open,
  items = [],
  index = 0,
  alt = "",
  onIndexChange,
  onClose,
  step,
  contained,
  input,
  autoFocus = true,
  label = "Image",
  style,
}: ImageViewerProps) {
  const dlg = useRef<HTMLDialogElement>(null);
  const restore = useRef<Element | null>(null);
  const from = useRef<number | null>(null);
  const device = useMode();
  const mode = input || device;
  const touch = mode === "touch";
  const reduced = reducedMotion();
  const [entered, setEntered] = useState(reduced);
  const [at, setAt] = useState(index);
  const list = (items || []).filter(Boolean);
  const steps = step === true ? list.length > 1 : step === false ? false : list.length > 1;
  const i = Math.max(0, Math.min(list.length - 1, at));
  const alts = Array.isArray(alt) ? alt : [alt];
  const describe = alts[i] || (Array.isArray(alt) ? "" : alt) || "";
  const close = () => onClose && onClose();
  // 1453: no wrap, so the missing chevron is the end of the gallery
  const to = (n: number) => {
    const next = Math.max(0, Math.min(list.length - 1, n));
    setAt(next);
    if (onIndexChange) onIndexChange(next);
  };
  useEffect(() => {
    setAt(index);
  }, [index, open]);
  useLayoutEffect(() => {
    if (!open) {
      if (entered && !reduced) setEntered(false);
      return;
    }
    const d = dlg.current;
    if (!d) return;
    restore.current = document.activeElement;
    if (!d.open) {
      if (contained) d.show();
      else {
        try {
          d.showModal();
        } catch {
          d.show();
        }
      }
    }
    d.getBoundingClientRect();
    setEntered(true);
    const f = autoFocus ? d.querySelector<HTMLElement>("[data-autofocus]") : null;
    if (f) f.focus({ preventScroll: true });
    return () => {
      try {
        d.close();
      } catch {
        /* already closed */
      }
      if (!autoFocus) return;
      const r = restore.current as HTMLElement | null;
      if (r && r.focus) r.focus({ preventScroll: true });
    };
  }, [open, contained]);
  useEffect(() => {
    const d = dlg.current;
    if (!open || !d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [open]);
  if (!open || !list.length) return null;
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (steps && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      e.stopPropagation();
      to(i + (e.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (e.key !== "Tab" || !dlg.current) return;
    const n = Array.from(dlg.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    const first = n[0];
    const last = n[n.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const ground = (e: MouseEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) close();
  };
  const ctl = (extra?: CSSProperties): CSSProperties => ({
    margin: 0,
    padding: 0,
    border: 0,
    appearance: "none",
    font: "inherit",
    width: touch ? "var(--target-primary)" : 40,
    height: touch ? "var(--target-primary)" : 40,
    boxSizing: "border-box",
    borderRadius: "var(--radius-pill)",
    background: "var(--viewer-control)",
    color: "var(--viewer-ink)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flex: "none",
    outlineOffset: "var(--focus-offset)",
    ...extra,
  });
  const side: CSSProperties | null = touch
    ? null
    : { position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 1 };
  const back = steps && i > 0;
  const on = steps && i < list.length - 1;
  return (
    <dialog
      ref={dlg}
      className="strand-viewer"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === dlg.current) close();
      }}
      style={{
        position: contained ? "absolute" : "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        margin: 0,
        padding: 0,
        border: 0,
        borderRadius: 0,
        boxSizing: "border-box",
        background: contained ? "var(--viewer-scrim)" : "transparent",
        color: "var(--viewer-ink)",
        fontFamily: "var(--font-sans)",
        zIndex: "var(--z-viewer)" as unknown as number,
        display: "flex",
        flexDirection: "column",
        overflow: "clip",
        ...style,
      }}
    >
      <style>{".strand-viewer::backdrop{background:var(--viewer-scrim)}"}</style>
      <div
        onClick={ground}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "var(--space-2)",
          paddingTop: "max(var(--space-2), env(safe-area-inset-top, 0px))",
        }}
      >
        <button type="button" data-autofocus aria-label="Close" onClick={close} style={ctl()}>
          <Icon name="x" size={touch ? 22 : 20} />
        </button>
      </div>
      <div
        onClick={ground}
        onTouchStart={
          steps
            ? (e) => {
                from.current = e.touches[0]?.clientX ?? null;
              }
            : undefined
        }
        onTouchEnd={
          steps
            ? (e) => {
                const x = from.current;
                from.current = null;
                const end = e.changedTouches[0];
                if (x == null || !end) return;
                const dx = end.clientX - x;
                if (Math.abs(dx) > SWIPE) to(i + (dx < 0 ? 1 : -1));
              }
            : undefined
        }
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 var(--viewer-inset)",
          touchAction: steps ? "pan-y" : "auto",
        }}
      >
        {back && side && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => to(i - 1)}
            style={ctl({ ...side, left: "var(--space-2)" })}
          >
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        <img
          src={list[i]}
          alt={describe}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            opacity: entered ? 1 : 0,
            transform: entered ? "none" : "scale(0.985)",
            transition: reduced
              ? "none"
              : "opacity var(--dur-default) var(--ease), transform var(--dur-default) var(--ease)",
          }}
        />
        {on && side && (
          <button
            type="button"
            aria-label="Next image"
            onClick={() => to(i + 1)}
            style={ctl({ ...side, right: "var(--space-2)" })}
          >
            <Icon name="chevron-right" size={20} />
          </button>
        )}
      </div>
      <div
        onClick={ground}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "var(--space-10)",
          padding: "var(--space-2)",
          paddingBottom:
            "max(var(--space-2), env(safe-area-inset-bottom, var(--safe-bottom, 0px)))",
        }}
      >
        {touch && steps && (
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
            <span style={{ width: "var(--target-primary)", height: "var(--target-primary)" }}>
              {back && (
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => to(i - 1)}
                  style={ctl()}
                >
                  <Icon name="chevron-left" size={22} />
                </button>
              )}
            </span>
            <span style={{ width: "var(--target-primary)", height: "var(--target-primary)" }}>
              {on && (
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => to(i + 1)}
                  style={ctl()}
                >
                  <Icon name="chevron-right" size={22} />
                </button>
              )}
            </span>
          </span>
        )}
        <span
          aria-live="polite"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {describe}
        </span>
      </div>
    </dialog>
  );
}
