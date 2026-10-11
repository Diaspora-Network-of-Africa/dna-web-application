// Ported from Strand components/dna/ImageAdjust.jsx at compile v1791654208929113 (348, 351;
// brief 60-IF, 1643, ratified 1673; H60-MEDIA Work 1). New to the tree, exported from the index,
// and mounted by nothing (1710): the composer preview and the author's own post reach it in the
// Reframe build. Translations, none visible: `useInputMode` is the app's `useMode`, and the
// compile's `__ds_scope` lookups (imageFrame, IconButton, Button) are imports. Its `minus` icon is
// `public/strand/icons/minus.svg`, copied from the export. Record:
// docs/strand-ports/v1791654208929113-media.md.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { imageFrame, type FocalPoint, type MediaCrop } from "./MediaBlock";
import { useMode, type Mode } from "@/lib/tier";

/** What ImageAdjust writes: the media row's two framing fields (351). Auto-fit writes both null. */
export type AdjustValue = { focalPoint: FocalPoint | null; crop: MediaCrop | null };

export type ImageAdjustProps = {
  src?: string | undefined;
  alt?: string | undefined;
  /** The master's stored dimensions; the frame is chosen from them by MediaBlock's own rule. */
  width?: number | null | undefined;
  height?: number | null | undefined;
  /** Fixes the frame, as MediaBlock's `ratio` does. */
  ratio?: string | undefined;
  /** Controlled: the media row's `{ focalPoint, crop }`, so the part reopens where the author left it. */
  value?: AdjustValue | null | undefined;
  defaultValue?: AdjustValue | null | undefined;
  onChange?: ((value: AdjustValue) => void) | undefined;
  input?: Mode | undefined;
  /** Zoom past filling the frame, as a multiple. Default 3. */
  maxZoom?: number | undefined;
  /** The frame's name, before the alt. Default "Reframe". */
  label?: string | undefined;
  /** Paints the focus ring for a static frame (specimens only). */
  proofFocus?: boolean | undefined;
  style?: CSSProperties | undefined;
};

type St = { k: number; cx: number; cy: number };
type Drag = St & { x?: number; y?: number; mx?: number; my?: number; dist: number | null };

/** ImageAdjust (348; brief 60-IF, 1643). The optional reframe control: pan and zoom inside a fixed frame.
 *  THE FRAME is the one the card will use, chosen by MediaBlock's own rule from the master's stored width and height (the nearest of the four --media-frame-* tokens),
 *  or the ratio the caller fixes. What is inside the frame here is exactly what MediaBlock draws from the value this part writes, so there is nothing to preview.
 *  AUTO-FIT is the default and reframing is never required: the image fills the frame, centred (or, past the ends of the set, sits whole on --media-fill, as the card shows it).
 *  Zoom is relative to filling the frame and runs to maxZoom (3). For an image the card shows whole, the first step in fills the frame: between whole and filled the frame would
 *  be part fill and part image, which is the chopped look the brief refuses, so the zoom snaps across that span in both directions.
 *  IT WRITES METADATA ONLY (351): onChange receives { focalPoint, crop }. focalPoint {x, y} is the centre of what the frame shows, as fractions of the master; crop
 *  {x, y, width, height} is the region shown, written only when the image is zoomed past filling (or filled from whole); auto-fit writes both as null. The master is never touched.
 *  INPUT. Pointer: drag pans (grab cursor). Touch: one finger pans, two pinch, from the stored dimensions, with touch-action none inside the frame. Keyboard: the frame takes
 *  focus; arrow keys move the frame over the image by 2% of its width or height (10% with Shift), + and - zoom by a step (1.25), every control has a name, and Reset returns to
 *  auto-fit. Controls under the frame: Zoom out, Zoom in (IconButton, 44 on touch and 36 on a pointer), Reset (a ghost Button); each is disabled at its limit, never absent,
 *  so nothing moves under the thumb. No number is shown anywhere (guardrail 2); the image itself is the readout. Filters and colour are out of scope (348). */
const MAX_ZOOM = 3;
const STEP = 1.25;
const NUDGE = 0.02;
const NUDGE_SHIFT = 0.1;
const E = 1e-6;
const num = (v: unknown): number | null => {
  const n = Number(v);
  return n > 0 && isFinite(n) ? n : null;
};
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const pct = (v: number) => Math.round(v * 10000) / 100 + "%";
const round = (v: number) => Math.round(v * 10000) / 10000;

export function ImageAdjust({
  src,
  alt = "",
  width,
  height,
  ratio,
  value,
  defaultValue,
  onChange,
  input,
  maxZoom = MAX_ZOOM,
  label,
  proofFocus,
  style,
}: ImageAdjustProps) {
  const device = useMode();
  const mode = input || device;
  const touch = mode === "touch";
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const w = num(width) || (nat && nat.w) || null;
  const h = num(height) || (nat && nat.h) || null;
  const f = imageFrame(w, h, null, ratio);
  const fr = f.frame.r ?? 1;
  const r = w && h ? w / h : null;
  const kCover = r ? Math.max(1, r / fr) : 1;
  const kContain = r ? Math.min(1, r / fr) : 1;
  const wholeFirst = !!r && f.fit === "contain";
  const k0 = wholeFirst ? kContain : kCover;
  const kMax = kCover * maxZoom;
  const geo = (k: number) => ({ vw: Math.min(1, 1 / k), vh: r ? Math.min(1, r / (fr * k)) : 1 });
  const settle = (s: St): St => {
    const g = geo(s.k);
    return {
      k: s.k,
      cx: g.vw >= 1 - E ? 0.5 : clamp(s.cx, g.vw / 2, 1 - g.vw / 2),
      cy: g.vh >= 1 - E ? 0.5 : clamp(s.cy, g.vh / 2, 1 - g.vh / 2),
    };
  };
  const read = (v: AdjustValue | null | undefined): St => {
    if (!r || !v) return { k: k0, cx: 0.5, cy: 0.5 };
    const c = v.crop;
    if (c && num(c.width) && num(c.height)) {
      const k = c.width < 1 - E ? 1 / c.width : r / (fr * c.height);
      return settle({
        k: clamp(k, k0, kMax),
        cx: (Number(c.x) || 0) + c.width / 2,
        cy: (Number(c.y) || 0) + c.height / 2,
      });
    }
    if (v.focalPoint)
      return settle({ k: kCover, cx: Number(v.focalPoint.x), cy: Number(v.focalPoint.y) });
    return { k: k0, cx: 0.5, cy: 0.5 };
  };
  const [st, setSt] = useState<St>(() => read(value || defaultValue));
  const sync = JSON.stringify(value === undefined ? null : value) + "|" + r;
  useEffect(() => {
    setSt(read(value || defaultValue));
  }, [sync]);
  const isAuto = (s: St) => s.k <= k0 + E && Math.abs(s.cx - 0.5) < E && Math.abs(s.cy - 0.5) < E;
  const isCropped = (s: St) => s.k > kCover + E || (wholeFirst && s.k >= kCover - E);
  const snap = (k: number) => {
    k = clamp(k, k0, kMax);
    if (wholeFirst && k < kCover - E) k = k < (k0 + kCover) / 2 ? k0 : kCover;
    return k;
  };
  const emit = (s: St) => {
    if (!onChange) return;
    if (isAuto(s)) {
      onChange({ focalPoint: null, crop: null });
      return;
    }
    const g = geo(s.k);
    onChange({
      focalPoint: { x: round(s.cx), y: round(s.cy) },
      crop: isCropped(s)
        ? {
            x: round(s.cx - g.vw / 2),
            y: round(s.cy - g.vh / 2),
            width: round(g.vw),
            height: round(g.vh),
          }
        : null,
    });
  };
  const commit = (s: St) => {
    const n = settle(s);
    setSt(n);
    emit(n);
  };
  const zoomTo = (k: number, ax = 0.5, ay = 0.5) => {
    k = snap(k);
    const a = geo(st.k);
    const b = geo(k);
    const ux = st.cx - a.vw / 2 + ax * a.vw;
    const uy = st.cy - a.vh / 2 + ay * a.vh;
    commit({ k, cx: ux - ax * b.vw + b.vw / 2, cy: uy - ay * b.vh + b.vh / 2 });
  };
  const zoomIn = () => zoomTo(st.k < kCover - E ? kCover : st.k * STEP);
  const zoomOut = () => zoomTo(st.k <= kCover + E ? k0 : Math.max(kCover, st.k / STEP));
  const reset = () => commit({ k: k0, cx: 0.5, cy: 0.5 });
  const base = (): St => ({ cx: st.cx, cy: st.cy, k: st.k });
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!r) return;
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable */
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [p, q] = [...pointers.current.values()];
    if (p && q)
      drag.current = {
        ...base(),
        mx: (p.x + q.x) / 2,
        my: (p.y + q.y) / 2,
        dist: Math.hypot(p.x - q.x, p.y - q.y),
      };
    else drag.current = { ...base(), x: e.clientX, y: e.clientY, dist: null };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId) || !r) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const W = box.current ? box.current.clientWidth : 0;
    if (!W) return;
    const [p, q] = [...pointers.current.values()];
    if (p && q && d.dist) {
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      const k = snap((d.k * dist) / d.dist);
      setSt(
        settle({
          k,
          cx: d.cx - (mx - (d.mx ?? mx)) / (k * W),
          cy: d.cy - ((my - (d.my ?? my)) * r) / (k * W),
        }),
      );
      return;
    }
    setSt(
      settle({
        k: st.k,
        cx: d.cx - (e.clientX - (d.x ?? e.clientX)) / (st.k * W),
        cy: d.cy - ((e.clientY - (d.y ?? e.clientY)) * r) / (st.k * W),
      }),
    );
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const [p] = [...pointers.current.values()];
    if (p) {
      drag.current = { ...base(), x: p.x, y: p.y, dist: null };
      return;
    }
    drag.current = null;
    setDragging(false);
    emit(settle(st));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!r) return;
    const g = geo(st.k);
    const by = e.shiftKey ? NUDGE_SHIFT : NUDGE;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-by, 0],
      ArrowRight: [by, 0],
      ArrowUp: [0, -by],
      ArrowDown: [0, by],
    };
    const m = map[e.key];
    if (m) {
      e.preventDefault();
      e.stopPropagation();
      commit({ k: st.k, cx: st.cx + m[0] * g.vw, cy: st.cy + m[1] * g.vh });
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      e.stopPropagation();
      zoomIn();
      return;
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      e.stopPropagation();
      zoomOut();
    }
  };
  const g = geo(st.k);
  const dispH = r ? (st.k * fr) / r : 1;
  const left = g.vw >= 1 - E ? (1 - st.k) / 2 : -(st.cx - g.vw / 2) * st.k;
  const top = g.vh >= 1 - E ? (1 - dispH) / 2 : -(st.cy - g.vh / 2) * dispH;
  const state = isAuto(st) ? "auto" : isCropped(st) ? "zoomed" : "panned";
  const ctl = (name: string, text: string, disabled: boolean, onClick: () => void) => (
    <IconButton
      name={name}
      label={text}
      size={touch ? 44 : 36}
      input={input}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer" }}
    />
  );
  return (
    <div
      data-adjust=""
      data-input={mode}
      data-state={state}
      data-frame-set={f.frame.id}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", ...style }}
    >
      <div
        ref={box}
        role="group"
        aria-roledescription="image framing"
        tabIndex={0}
        aria-label={
          (label || "Reframe") +
          (alt ? ": " + alt : "") +
          ". Drag to move the image; arrow keys nudge; plus and minus zoom."
        }
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          border: "1px solid var(--line)",
          background: "var(--media-fill)",
          aspectRatio: f.frame.css ?? undefined,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: !r ? "default" : touch ? "default" : dragging ? "grabbing" : "grab",
          outlineOffset: "var(--focus-offset)",
          ...(proofFocus ? { outline: "2px solid var(--focus)" } : {}),
        }}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              if (!(num(width) && num(height)))
                setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
            }}
            style={
              r
                ? {
                    position: "absolute",
                    left: pct(left),
                    top: pct(top),
                    width: pct(st.k),
                    height: "auto",
                    maxWidth: "none",
                    display: "block",
                    pointerEvents: "none",
                  }
                : {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: 0,
                    pointerEvents: "none",
                  }
            }
          />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {ctl("minus", "Zoom out", !r || st.k <= k0 + E, zoomOut)}
        {ctl("plus", "Zoom in", !r || st.k >= kMax - E, zoomIn)}
        <span style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size={touch ? "md" : "sm"}
          disabled={!r || isAuto(st)}
          aria-label="Reset to auto-fit"
          onClick={reset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
