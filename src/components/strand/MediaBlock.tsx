// Ported from Strand components/dna/MediaBlock.jsx at compile v1791654208929113 (1643, brief
// 60-IF, ratified 1673; with W62's 1429 to 1433 and 1543 to 1549 as amended; H60-MEDIA Work 1),
// after compile v1790410319010950 (corrections 30 and 31, 1153; handoff 33-D) and corrections 26
// to 28 (1115, 1117, 1118, 1134). Video and audio kinds are kept for parity with the system; the
// composer never produces them (ruling 55).
//
// 1643: a single image without `ratio` takes the frame of the four-frame set nearest its own
// ratio (--media-frame-tall 4:5, -square 1:1, -photo 4:3, -wide 1.91:1), placed by its focal
// point; past an end by more than that end's own step it shows whole on --media-fill. An author's
// `crop` picks the frame by the region's ratio and is placed exactly when it matches. `whole`
// draws the image at its own ratio for the expanded card. A frame with no `src` yet renders as the
// fill alone. A gallery takes its frame from its lead image and its count. A video poster with
// stored dimensions follows the same rule. `ratio` (1115) still wins. 1429 and 1431: a tapped
// image or tile opens ImageViewer on the master, whole; `openable={false}` returns the plain
// frame. 1432 and 1544: the link preview has two sizes, `full` and `row`. 439 is now the compile's
// own: a non-web link renders as text in both sizes, so the divergence this port carried (G184)
// is no longer kept. One divergence, visible: `natural` (1738): an image whose row stores no
// dimensions, the Messenger log's, draws at the frame's width and its own ratio up to the height
// given, cropped from its centre past it, with no fill, where the compile has only the 1.91:1
// `unknown` frame contained on --media-fill. Translations, none visible: `useInputMode` is the app's `useMode`; the
// compile's `__ds_scope` lookups are imports. Record: docs/strand-ports/v1791654208929113-media.md.
//
// Re-synced at compile sha256-b1a458dac1bd562f (brief 60-SP items 20 and 21; 1711, 1714, 1717;
// ratified 1728; handoff H61-SP). Item 20 (1711): the openable image's button is `width: 100%` and
// `box-sizing: border-box` as compiled, so the width this port carried as its own divergence (G270)
// is now the compile's and the gap closes. Item 21 (1714, 1717): a FIXED BOX (`ratio` given: the
// discovery face's 16:9, the event page's 21:9) keeps its shape; an image within one ratio step of
// the box fills it, placed by its focal point, and further than that shows whole, contained, on
// --media-fill. One ratio step is the set's own neighbour step at the box's ratio: 16:9 sits between
// 4:3 and 1.91:1 and takes 1.91 / (4/3), so it fills from 1.24:1 to 2.55:1; 21:9 is past the wide
// end and takes 1.91:1's step, 1.63:1 to 3.34:1; on a frame of the set, the wider of its two.
// `data-frame` reads `fixed` when it fills and `fixed-whole` when it shows whole. `fixedStep(R)` is
// exported, as the compile exports it. The profile cover is the 1718 exception; ProfileHeader draws
// it. Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
import { ImageViewer } from "./ImageViewer";
import { useMode, type Mode } from "@/lib/tier";

/** A point of an image, as fractions of the master (0 to 1). */
export type FocalPoint = { x: number; y: number };
/** A region of an image, as fractions of the master (0 to 1), written by ImageAdjust (351). */
export type MediaCrop = { x: number; y: number; width: number; height: number };
/** A gallery tile, or a URL. Each tile keeps its crop and is placed by its own focal point (1431, 1643). */
export type MediaImage = {
  src: string;
  alt?: string | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  focalPoint?: FocalPoint | null | undefined;
  crop?: MediaCrop | null | undefined;
};

export type MediaBlockProps = {
  kind?: "none" | "image" | "gallery" | "video" | "link" | "audio" | "strip" | "carousel";
  src?: string | undefined;
  /** gallery: URLs or tiles; link: the thumbnail; strip and carousel: URLs. */
  items?: (string | MediaImage)[] | undefined;
  alt?: string | undefined;
  title?: string | undefined;
  domain?: string | undefined;
  duration?: string | undefined;
  /** Fixes the media frame to a ratio, in CSS aspect-ratio form ("16/9"). Ruling 1115. image,
   *  gallery and video: replaces the frame the set would choose, placed by the focal point
   *  (1643); a gallery keeps its layout. link and audio ignore it; strip and carousel ignore it. */
  ratio?: string | undefined;
  /** image and video: the stored dimensions that choose the frame and reserve its height (1643). */
  width?: number | null | undefined;
  height?: number | null | undefined;
  /** image, video: the point kept in view, 0 to 1 (1643). */
  focalPoint?: FocalPoint | null | undefined;
  /** image, video: the author's region, 0 to 1 (1643, 351). */
  crop?: MediaCrop | null | undefined;
  /** image: own ratio, uncropped, for the expanded card (1643). */
  whole?: boolean | undefined;
  /** image, a divergence (1738): a caller that stores no dimensions draws the image at the frame's
   *  width and its own ratio, up to this many pixels tall, a taller one cropped from its centre, with
   *  no fill around it. The Messenger log's image message; the set's frame and `whole` do not apply. */
  natural?: number | undefined;
  /** image and gallery: tapping opens ImageViewer (1429, 1431); false returns the plain frame. */
  openable?: boolean | undefined;
  /** image and gallery: a caller that owns the viewer receives the tapped index instead. */
  onOpen?: ((index: number) => void) | undefined;
  /** passed to ImageViewer: false holds one image (1452). */
  step?: boolean | undefined;
  /** link: full (the link is the post's only media) or row (the post also carries images) (1432). */
  size?: "full" | "row" | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

type Frame = { id: string; r: number | null; css: string | null };
type Fit = { frame: Frame; fit: "cover" | "contain"; clamp?: string; r: number | null };
type Ratioed = { frame: { r: number }; fit: "cover" | "contain"; r: number | null };

const FRAMES = [
  { id: "tall", r: 0.8, css: "var(--media-frame-tall)" },
  { id: "square", r: 1, css: "var(--media-frame-square)" },
  { id: "photo", r: 4 / 3, css: "var(--media-frame-photo)" },
  { id: "wide", r: 1.91, css: "var(--media-frame-wide)" },
] as const;
const TALL = FRAMES[0];
const SQUARE = FRAMES[1];
const PHOTO = FRAMES[2];
const WIDE = FRAMES[3];
/** Past an end the image may run by no more than that end's neighbour step and still fill it; further than that it is contained whole. 16:25 (0.64) and 2.74:1. */
const TALL_LIMIT = TALL.r / (SQUARE.r / TALL.r);
const WIDE_LIMIT = WIDE.r * (WIDE.r / PHOTO.r);
const EPS = 1e-3;
/** 1714, 1717: one ratio step at a fixed box of ratio R, as a quotient: the set's neighbour step at the box (past an end, that end's step; on a frame of the set, the wider of its two). */
export function fixedStep(R: number): number {
  const steps = FRAMES.slice(1).map((f, i) => f.r / (FRAMES[i] as { r: number }).r);
  if (R <= TALL.r * (1 + EPS)) return steps[0] as number;
  if (R >= WIDE.r * (1 - EPS)) return steps[steps.length - 1] as number;
  for (let i = 0; i < FRAMES.length - 1; i++) {
    const a = (FRAMES[i] as { r: number }).r;
    const b = (FRAMES[i + 1] as { r: number }).r;
    if (Math.abs(Math.log(R / b)) < EPS) return Math.max(steps[i] as number, steps[i + 1] || 0);
    if (R > a * (1 + EPS) && R < b) return b / a;
  }
  return steps[0] as number;
}
const num = (v: unknown): number | null => {
  const n = Number(v);
  return n > 0 && isFinite(n) ? n : null;
};
const pct = (v: number) => Math.round(v * 10000) / 100 + "%";
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const frameBox = (style: CSSProperties | undefined, bg = "var(--bg-sunken)"): CSSProperties => ({
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid var(--line)",
  background: bg,
  ...style,
});
const cell = (ratio: string): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gridTemplateRows: "minmax(0,1fr)",
  aspectRatio: ratio,
});
const isWeb = (u: unknown) => /^https?:\/\//i.test(String(u || ""));

/** '16/9', '16 / 9', '1.91 / 1' or a number, as a number; null when it is none of these. */
export function ratioNum(ratio: string | number | null | undefined): number | null {
  if (ratio == null || ratio === "") return null;
  if (typeof ratio === "number") return num(ratio);
  const p = String(ratio).split("/");
  const a = parseFloat(p[0] ?? "");
  const b = p.length > 1 ? parseFloat(p[1] ?? "") : 1;
  return a > 0 && b > 0 ? a / b : null;
}
/** The frame of the set nearest a ratio, measured as ratios are (by their quotient, not their difference). */
const nearest = (r: number): Frame =>
  FRAMES.reduce<Frame>(
    (best, f) => (Math.abs(Math.log(r / f.r)) < Math.abs(Math.log(r / (best.r ?? 1))) ? f : best),
    FRAMES[0],
  );
/** The author's region, well formed, as fractions of the image; null when absent or malformed. */
const cropOf = (c: MediaCrop | null | undefined): MediaCrop | null => {
  if (!c) return null;
  const w = num(c.width);
  const h = num(c.height);
  if (!w || !h || w > 1 || h > 1) return null;
  return {
    x: clamp01(Math.min(Number(c.x) || 0, 1 - w)),
    y: clamp01(Math.min(Number(c.y) || 0, 1 - h)),
    width: w,
    height: h,
  };
};
/** The point the frame keeps in view: the focal point as passed, else the centre of the author's crop, else null (centred). */
const focalOf = (fp: FocalPoint | null | undefined, c: MediaCrop | null): FocalPoint | null => {
  if (fp && isFinite(Number(fp.x)) && isFinite(Number(fp.y)))
    return { x: clamp01(Number(fp.x)), y: clamp01(Number(fp.y)) };
  if (c) return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  return null;
};

/** 1643: the frame a single image takes, and how it sits in it. frame is one of FRAMES (or the fixed ratio); fit is cover or contain; clamp names the case and is written
 *  to data-frame: exact (the image is its frame), near (nearest frame, cover placed by the focal point, including a little past an end), tall or wide (further past the ends, contained whole), fixed (ratio given), unknown (no dimensions). */
export function imageFrame(
  width: unknown,
  height: unknown,
  crop: MediaCrop | null | undefined,
  ratio: string | number | null | undefined,
): Fit & { clamp: string } {
  const w = num(width);
  const h = num(height);
  const c = cropOf(crop);
  const fixed = ratioNum(ratio);
  const r = w && h ? w / h : null;
  if (fixed) {
    const frame = { id: "fixed", r: fixed, css: String(ratio) };
    // Item 21 (1714, 1717): within one ratio step of the box the image fills it; beyond, it shows whole.
    const rr = r && w && h ? (c ? (w * c.width) / (h * c.height) : r) : null;
    if (rr && Math.abs(Math.log(rr / fixed)) > Math.log(fixedStep(fixed)) * (1 + EPS))
      return { frame, fit: "contain", clamp: "fixed-whole", r };
    return { frame, fit: "cover", clamp: "fixed", r };
  }
  if (!r || !w || !h) return { frame: WIDE, fit: "contain", clamp: "unknown", r: null };
  const rr = c ? (w * c.width) / (h * c.height) : r;
  if (rr < TALL_LIMIT * (1 - EPS)) return { frame: TALL, fit: "contain", clamp: "tall", r };
  if (rr > WIDE_LIMIT * (1 + EPS)) return { frame: WIDE, fit: "contain", clamp: "wide", r };
  const frame = nearest(rr);
  return {
    frame,
    fit: "cover",
    clamp: Math.abs(Math.log(rr / (frame.r ?? 1))) < EPS ? "exact" : "near",
    r,
  };
}

/** How the image sits in a frame: contained whole and centred on the fill; the author's crop placed exactly when its ratio is the frame's; otherwise cover, positioned so the
 *  focal point lands in the frame where it sits in the image (object-position is solved from the share of the image the frame shows along the cropped axis). */
export function placement(
  f: Fit | Ratioed,
  focalPoint: FocalPoint | null | undefined,
  crop: MediaCrop | null | undefined,
): CSSProperties {
  const base: CSSProperties = { display: "block", width: "100%", height: "100%", minHeight: 0 };
  if (f.fit === "contain") return { ...base, objectFit: "contain" };
  const c = cropOf(crop);
  const fr = f.frame.r ?? 1;
  const r = f.r;
  if (c && r && Math.abs(Math.log((r * c.width) / c.height / fr)) < 0.03)
    return {
      display: "block",
      position: "absolute",
      left: pct(-c.x / c.width),
      top: pct(-c.y / c.height),
      width: pct(1 / c.width),
      height: pct(1 / c.height),
      maxWidth: "none",
    };
  const fp = focalOf(focalPoint, c);
  if (!fp) return { ...base, objectFit: "cover" };
  let px = fp.x;
  let py = fp.y;
  if (r) {
    const vw = Math.min(1, fr / r);
    const vh = Math.min(1, r / fr);
    px = vw < 1 - EPS ? (fp.x - vw / 2) / (1 - vw) : 0.5;
    py = vh < 1 - EPS ? (fp.y - vh / 2) / (1 - vh) : 0.5;
  }
  return {
    ...base,
    objectFit: "cover",
    objectPosition: pct(clamp01(px)) + " " + pct(clamp01(py)),
  };
}

/** Shared media block. kind: none | image | gallery | video | link | audio | strip | carousel (correction 30). Gallery capped at 4.
 *  1643 (brief 60-IF): a single image without ratio takes the frame nearest its own ratio from four (tokens --media-frame-tall 4:5, -square 1:1, -photo 4:3, -wide 1.91:1),
 *  placed by its FOCAL POINT; past an end by more than that end's own step it shows whole, contained, on --media-fill, never black. An author's CROP picks the frame by the
 *  region's ratio and is placed exactly when it matches. `whole` draws the image at its own ratio, uncropped, for the expanded card. Stored dimensions reserve the frame's
 *  height before the image loads, and a frame with no src yet renders as the fill alone. No stored dimensions renders the 1.91:1 frame contained (grounded-or-empty).
 *  An explicit ratio still wins (1115). A video poster follows the same frame rule when its dimensions are stored. A gallery takes one of the same four frames by its
 *  lead's orientation and its count, each tile placed by its own focal point.
 *  1429, 1431: tapping a single image, or any gallery tile, opens ImageViewer on that image, whole. MediaBlock owns the viewer's state and stops the click, so a card's
 *  own onClick does not also fire; openable={false} returns the plain frame.
 *  1432: the link preview has two sizes carrying the same information, full and row. 439 holds in both: a link that is not a web address renders as text with no anchor. */
export function MediaBlock(props: MediaBlockProps) {
  const kind = props.kind || "none";
  if (kind === "none") return null;
  if (kind === "strip") return <Strip items={urls(props.items)} style={props.style} />;
  if (kind === "carousel")
    return <Carousel items={urls(props.items)} title={props.title} style={props.style} />;
  if (kind === "image") return <Single {...props} />;
  if (kind === "gallery") return <GalleryBlock {...props} />;
  if (kind === "video") return <Video {...props} />;
  if (kind === "link") return <LinkPreview {...props} />;
  if (kind === "audio") return <AudioBlock {...props} />;
  return null;
}

const urls = (items: MediaBlockProps["items"]): string[] =>
  (items || []).map((it) => (typeof it === "string" ? it : it && it.src)).filter(Boolean);

/** 1643: the single image. The nearest frame of the set, the focal point placing what the frame cannot hold, whole on the fill past the ends; `whole` for the expanded card. Tapping opens the viewer. */
function Single({
  src,
  alt = "",
  width,
  height,
  ratio,
  focalPoint,
  crop,
  whole,
  natural,
  openable = true,
  step,
  onOpen,
  input,
  style,
}: MediaBlockProps) {
  const [open, setOpen] = useState(false);
  const device = useMode();
  const mode = input || device;
  const touch = mode === "touch";
  const w = num(width);
  const h = num(height);
  const f: Fit & { clamp: string } = natural
    ? { frame: { id: "natural", r: null, css: null }, fit: "cover", clamp: "natural", r: null }
    : whole
      ? {
          frame: { id: "whole", r: w && h ? w / h : null, css: w && h ? w + " / " + h : null },
          fit: "contain",
          clamp: "whole",
          r: w && h ? w / h : null,
        }
      : imageFrame(width, height, crop, ratio);
  const box: CSSProperties = {
    ...frameBox(style, natural ? "transparent" : "var(--media-fill)"),
    position: "relative",
    ...(natural ? { display: "block" } : {}),
    ...(f.frame.css ? cell(f.frame.css) : {}),
  };
  const data = {
    "data-media": "image",
    "data-frame": f.clamp,
    "data-frame-set": f.frame.id,
  };
  if (!src) return <div {...data} data-loading="" style={box} />;
  const img = (
    <img
      src={src}
      alt={openable ? "" : alt}
      width={w || undefined}
      height={h || undefined}
      style={
        natural
          ? {
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: natural,
              objectFit: "cover",
              objectPosition: "50% 50%",
            }
          : f.frame.css
            ? placement(f, focalPoint, crop)
            : { display: "block", width: "100%", height: "auto" }
      }
    />
  );
  if (!openable)
    return (
      <div {...data} style={box}>
        {img}
      </div>
    );
  return (
    <>
      <button
        type="button"
        {...data}
        aria-label={alt ? "Open image: " + alt : "Open image"}
        onClick={(e) => {
          e.stopPropagation();
          if (onOpen) onOpen(0);
          else setOpen(true);
        }}
        style={{
          // Item 20 (1711): the button fills its container, as the plain frame does; G270 closes.
          width: "100%",
          boxSizing: "border-box",
          ...box,
          margin: 0,
          padding: 0,
          font: "inherit",
          color: "inherit",
          appearance: "none",
          cursor: touch ? "pointer" : "zoom-in",
          outlineOffset: "var(--focus-offset)",
        }}
      >
        {img}
      </button>
      <ImageViewer
        open={open}
        items={[src]}
        alt={alt}
        step={step}
        input={input}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const tileOf = (it: string | MediaImage | null | undefined): Partial<MediaImage> =>
  typeof it === "string" ? { src: it } : it || {};
const orient = (t: Partial<MediaImage>) => {
  const w = num(t.width);
  const h = num(t.height);
  if (!w || !h) return "landscape";
  const r = w / h;
  return r < 1 - EPS ? "portrait" : r > 1 + EPS ? "landscape" : "square";
};

/** 1643 item 4: the gallery's frame comes from the set, chosen by the lead image's orientation and the count, and the layout goes with it.
 *  Two: side by side; a portrait lead takes 4:3 (two 2:3 tiles), any other 1.91:1 (two near-square tiles).
 *  Three: a portrait lead stands down the left of a 4:3 frame (a 2:3 tile) beside two 4:3 tiles; any other lead lies across the top two thirds of a 1:1 frame (a 3:2 tile) over two 3:2 tiles.
 *  Four: a 2 by 2 of the lead's own frame, 4:5, 1:1 or 4:3, so a set of phone photographs keeps its shape. ratio (1115) replaces the frame and keeps the layout. */
export function galleryFrame(
  tiles: Partial<MediaImage>[],
  ratio: string | number | null | undefined,
) {
  const n = tiles.length;
  const lead = orient(tiles[0] || {});
  const fixed = ratioNum(ratio);
  let frame: Frame;
  let layout: "columns" | "lead-left" | "lead-top" | "grid";
  if (n <= 2) {
    frame = lead === "portrait" ? PHOTO : WIDE;
    layout = "columns";
  } else if (n === 3) {
    frame = lead === "portrait" ? PHOTO : SQUARE;
    layout = lead === "portrait" ? "lead-left" : "lead-top";
  } else {
    frame = lead === "portrait" ? TALL : lead === "square" ? SQUARE : PHOTO;
    layout = "grid";
  }
  return {
    frame,
    layout,
    lead,
    r: fixed || (frame.r ?? 1),
    css: fixed ? String(ratio) : (frame.css ?? undefined),
  };
}
/** A tile's own ratio inside the gallery frame (ratio R), so its image is placed by its focal point against the shape it is really shown in. */
const tileRatio = (layout: string, R: number, i: number) =>
  layout === "columns"
    ? R / 2
    : layout === "lead-top"
      ? 1.5 * R
      : layout === "lead-left"
        ? i === 0
          ? R / 2
          : R
        : R;

/** 1431: gallery tiles keep their crop, each placed by its own focal point (1643); tapping any tile opens that image whole in the viewer. Tile labels carry no ordinal, so no count reaches a screen reader either. */
function GalleryBlock({
  items = [],
  ratio,
  openable = true,
  step,
  onOpen,
  input,
  style,
}: MediaBlockProps) {
  const [at, setAt] = useState<number | null>(null);
  const device = useMode();
  const mode = input || device;
  const touch = mode === "touch";
  const g = (items || [])
    .map(tileOf)
    .filter((t): t is MediaImage => !!t.src)
    .slice(0, 4);
  if (!g.length) return null;
  const gf = galleryFrame(g, ratio);
  const grid: CSSProperties = {
    ...frameBox(style, "var(--media-fill)"),
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows:
      gf.layout === "columns"
        ? "minmax(0,1fr)"
        : gf.layout === "lead-top"
          ? "minmax(0,2fr) minmax(0,1fr)"
          : "minmax(0,1fr) minmax(0,1fr)",
    gap: 2,
    aspectRatio: gf.css,
  };
  const place = (i: number): CSSProperties => ({
    gridColumn: gf.layout === "lead-top" && i === 0 ? "span 2" : undefined,
    gridRow: gf.layout === "lead-left" && i === 0 ? "span 2" : undefined,
  });
  const img = (t: MediaImage, i: number) => {
    const w = num(t.width);
    const h = num(t.height);
    const tf: Ratioed = {
      frame: { r: tileRatio(gf.layout, gf.r, i) },
      fit: "cover",
      r: w && h ? w / h : null,
    };
    return <img src={t.src} alt="" style={placement(tf, t.focalPoint, t.crop)} />;
  };
  const tileBox: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    minHeight: 0,
    background: "var(--media-fill)",
  };
  const data = {
    "data-media": "gallery",
    "data-frame-set": gf.frame.id,
    "data-gallery-layout": gf.layout,
  };
  if (!openable)
    return (
      <div {...data} style={grid}>
        {g.map((t, i) => (
          <div key={i} style={{ ...tileBox, ...place(i) }}>
            {img(t, i)}
          </div>
        ))}
      </div>
    );
  return (
    <>
      <div {...data} style={grid}>
        {g.map((t, i) => (
          <button
            key={i}
            type="button"
            aria-label={t.alt ? "Open image: " + t.alt : "Open image"}
            onClick={(e) => {
              e.stopPropagation();
              if (onOpen) onOpen(i);
              else setAt(i);
            }}
            style={{
              margin: 0,
              padding: 0,
              border: 0,
              font: "inherit",
              color: "inherit",
              appearance: "none",
              cursor: touch ? "pointer" : "zoom-in",
              outlineOffset: "var(--focus-offset)",
              ...tileBox,
              ...place(i),
            }}
          >
            {img(t, i)}
          </button>
        ))}
      </div>
      <ImageViewer
        open={at != null}
        items={g.map((t) => t.src)}
        alt={g.map((t) => t.alt || "")}
        index={at || 0}
        step={step}
        input={input}
        onClose={() => setAt(null)}
      />
    </>
  );
}

/** Correction 30 (G119) for the ratioed poster. 1643 guardrail 4: a poster with stored dimensions follows the frame rule, contained past the ends, placed by its focal point; with neither ratio nor dimensions it stays 16:9 as before. */
function Video({
  src,
  alt = "",
  duration,
  ratio,
  width,
  height,
  focalPoint,
  crop,
  style,
}: MediaBlockProps) {
  const frame = frameBox(style, "var(--media-fill)");
  const play = (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "var(--surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink)",
        }}
      >
        <Icon name="play" size={24} />
      </span>
    </span>
  );
  const stamp = duration && (
    <span
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        background: "var(--inverse-bg)",
        color: "var(--inverse-ink)",
        fontSize: 13,
        padding: "2px 8px",
        borderRadius: 6,
      }}
    >
      {duration}
    </span>
  );
  const f =
    ratioNum(ratio) || (num(width) && num(height)) ? imageFrame(width, height, crop, ratio) : null;
  if (f)
    return (
      <div
        data-media="video"
        data-frame={f.clamp}
        data-frame-set={f.frame.id}
        style={{ ...frame, position: "relative", ...cell(f.frame.css ?? "16/9") }}
      >
        {src && <img src={src} alt={alt} style={placement(f, focalPoint, crop)} />}
        {play}
        {stamp}
      </div>
    );
  return (
    <div data-media="video" style={{ ...frame, position: "relative", aspectRatio: "16/9" }}>
      {src && (
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {play}
      {stamp}
    </div>
  );
}

/** 1432: the link preview in two sizes, same information. 439: a link that is not a web address renders as text without an anchor, in both sizes. */
function LinkPreview({ src, domain, title, items = [], size = "full", style }: MediaBlockProps) {
  const web = isWeb(src);
  const thumb = urls(items)[0];
  const body =
    size === "row" ? (
      <>
        {domain && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              color: "var(--ink-3)",
              flex: "none",
              whiteSpace: "nowrap",
            }}
          >
            {domain}
          </span>
        )}
        {domain && title && (
          <span aria-hidden="true" style={{ color: "var(--line-strong)", flex: "none" }}>
            {"\u00B7"}
          </span>
        )}
        {title && (
          <span
            style={{
              fontSize: "var(--text-s)",
              lineHeight: "var(--text-s-lh)",
              fontWeight: "var(--weight-medium)" as unknown as number,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
        )}
      </>
    ) : (
      <>
        {thumb && (
          <img
            src={thumb}
            alt=""
            style={{
              width: "var(--link-thumb-full)",
              height: "var(--link-thumb-full)",
              objectFit: "cover",
              flex: "none",
              display: "block",
            }}
          />
        )}
        <span
          style={{
            padding: "var(--space-2) var(--space-3)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "var(--space-1)",
          }}
        >
          {domain && (
            <span
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                lineHeight: "var(--text-xs-lh)",
                color: "var(--ink-3)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {domain}
            </span>
          )}
          {title && (
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                fontSize: "var(--text-s)",
                lineHeight: "var(--text-s-lh)",
                fontWeight: "var(--weight-medium)" as unknown as number,
              }}
            >
              {title}
            </span>
          )}
        </span>
      </>
    );
  const box: CSSProperties =
    size === "row"
      ? {
          ...frameBox(style),
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          minHeight: "var(--target-primary)",
          boxSizing: "border-box",
          textDecoration: "none",
          color: "inherit",
        }
      : { ...frameBox(style), display: "flex", textDecoration: "none", color: "inherit" };
  if (!web)
    return (
      <div data-media="link" data-link-size={size} data-link="text" style={box}>
        {body}
      </div>
    );
  return (
    <a
      data-media="link"
      data-link-size={size}
      href={src}
      target="_blank"
      rel="noreferrer"
      style={box}
    >
      {body}
    </a>
  );
}

/** Unchanged. */
function AudioBlock({ title, duration, style }: MediaBlockProps) {
  return (
    <div
      style={{
        ...frameBox(style),
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--surface)",
      }}
    >
      <button
        type="button"
        aria-label="Play"
        style={{
          all: "unset",
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--ink)",
          color: "var(--on-fill)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flex: "none",
        }}
      >
        <Icon name="play" size={20} />
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            height: 3,
            background: "var(--line)",
            borderRadius: 2,
            marginTop: 8,
          }}
        />
      </span>
      <span style={{ fontSize: 13, color: "var(--ink-3)", flex: "none" }}>{duration}</span>
    </div>
  );
}

/** Correction 30 (Part A, from v5's body blocks): the group of four. Four images in one row of square cells, no outer frame; v5 draws 4 × 1fr, gap 6, cell radius 10, a 1px line
 *  edge per cell. Carried to tokens: gap --space-2, radius --radius-m, edge --border-thin --line. Fewer than four renders what is passed in the same four tracks; none renders nothing. */
function Strip({ items, style }: { items: string[]; style?: CSSProperties | undefined }) {
  const g = items.slice(0, 4);
  if (!g.length) return null;
  return (
    <div
      data-media="strip"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
        gap: "var(--space-2)",
        ...style,
      }}
    >
      {g.map((s, i) => (
        <div
          key={i}
          style={{
            borderRadius: "var(--radius-m)",
            overflow: "hidden",
            border: "var(--border-thin) solid var(--line)",
            background: "var(--bg-sunken)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gridTemplateRows: "minmax(0,1fr)",
            aspectRatio: "1 / 1",
          }}
        >
          <img
            src={s}
            alt=""
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              minHeight: 0,
              objectFit: "cover",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Correction 30 (Part A): the carousel. One to five 16:9 slides that snap one at a time, as v5 draws it: a row scrolling sideways, gap 8 (--space-2), each slide --carousel-slide (86%) of the row so the next
 *  slide's edge shows, radius 14 (--radius-l), a 1px line edge, --bg-sunken behind the image; the scrollbar is hidden. v5 draws no position indicator and none is drawn here (no digit anywhere).
 *  Keyboard: the row takes focus; ArrowLeft and ArrowRight move one slide and mark the event handled, so a Pane around it does not step. */
/** Correction 31 item 2: the carousel scrolls smoothly, and instantly under prefers-reduced-motion: reduce. No other switch. */
const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function Carousel({
  items,
  title = "Images",
  style,
}: {
  items: string[];
  title?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const g = items.slice(0, 5);
  const ref = useRef<HTMLDivElement>(null);
  if (!g.length) return null;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const row = ref.current;
    if (!row) return;
    const kids = Array.from(row.children) as HTMLElement[];
    const first = kids[0];
    if (!first) return;
    e.preventDefault();
    const second = kids[1];
    const step = second ? second.offsetLeft - first.offsetLeft : row.clientWidth;
    const i = Math.round(row.scrollLeft / step);
    const to = Math.max(0, Math.min(kids.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
    const target = kids[to] ?? first;
    row.scrollTo({
      left: target.offsetLeft - first.offsetLeft,
      behavior: reduced() ? "auto" : "smooth",
    });
  };
  return (
    <div
      ref={ref}
      data-media="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
      tabIndex={0}
      onKeyDown={onKey}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        overflowX: "auto",
        overflowY: "hidden",
        scrollSnapType: "x mandatory",
        scrollbarWidth: "none",
        outlineOffset: "var(--focus-offset)",
        borderRadius: "var(--radius-l)",
        ...style,
      }}
    >
      {g.map((s, i) => (
        <div
          key={i}
          role="group"
          aria-roledescription="slide"
          style={{
            flex: "none",
            width: "var(--carousel-slide)",
            scrollSnapAlign: "start",
            borderRadius: "var(--radius-l)",
            overflow: "hidden",
            border: "var(--border-thin) solid var(--line)",
            background: "var(--bg-sunken)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gridTemplateRows: "minmax(0,1fr)",
            aspectRatio: "16 / 9",
          }}
        >
          <img
            src={s}
            alt=""
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              minHeight: 0,
              objectFit: "cover",
            }}
          />
        </div>
      ))}
    </div>
  );
}
