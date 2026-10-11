// Strand `components/dna/BodyBlocks.jsx` at compile v1790410319010950 (correction 30 Part A ask 2,
// ratified with correction 31 under 1153; handoff 33-D). New to the tree; no page binds it in this
// handoff (the first Discovery handoff and Brief 10 Revision 4 do). The compile reads a block's
// kind from `type` or `t` and its images from `items` or `srcs`, and takes `p`, `h` and `gallery`
// as other names for paragraph, heading and group; the port reads them all, as compiled, and types
// the canonical forms that `BodyBlocks.d.ts` names. Dispositions are in
// docs/strand-ports/v1790410319010950.md. At compile v1791654208929113 (H60-MEDIA, 1429, 1643) an
// image block passes its own stored width and height to MediaBlock and loses its 16:9 default, so
// the frame set chooses its frame; a block's own ratio still wins. The video block keeps 16:9, as
// compiled. Record: docs/strand-ports/v1791654208929113-media.md.
import type { CSSProperties, ReactNode } from "react";
import { MediaBlock } from "./MediaBlock";

export type BodyBlock =
  | { type: "paragraph"; text?: string | undefined }
  | { type: "heading"; text?: string | undefined }
  | {
      type: "quote";
      text?: string | undefined;
      /** attribution, plain text */ by?: string | undefined;
    }
  | { type: "list"; items?: string[] | undefined }
  | {
      type: "image";
      src?: string | undefined;
      alt?: string | undefined;
      caption?: string | undefined;
      /** the stored dimensions of the image (1429, 1643): MediaBlock picks the frame from them */
      width?: number | undefined;
      height?: number | undefined;
      /** CSS aspect-ratio form; fixes the frame when given, else the frame set chooses (1643) */
      ratio?: string | undefined;
    }
  /** the group of four: up to four images in one row of square cells */
  | { type: "group"; items?: string[] | undefined; caption?: string | undefined }
  /** one to five 16:9 slides that snap one at a time */
  | {
      type: "carousel";
      items?: string[] | undefined;
      caption?: string | undefined;
      /** the row's accessible name; default "Images" */ title?: string | undefined;
    }
  | {
      type: "video";
      /** the poster */ src?: string | undefined;
      poster?: string | undefined;
      alt?: string | undefined;
      caption?: string | undefined;
      duration?: string | undefined;
      ratio?: string | undefined;
    };

export type BodyBlocksProps = {
  /** Correction 30 (Part A, from v5). Rendered in order; a block with no content renders nothing; no blocks, nothing. */
  blocks?: BodyBlock[];
  /** Heading blocks render as this level. Default 2. */
  headingLevel?: 1 | 2 | 3 | 4;
  style?: CSSProperties | undefined;
};

/** Every field any block may carry, under every name the compile reads. */
type Loose = {
  type?: string;
  t?: string;
  text?: string;
  by?: string;
  items?: string[];
  srcs?: string[];
  src?: string;
  poster?: string;
  alt?: string;
  caption?: string;
  ratio?: string;
  duration?: string;
  title?: string;
  width?: number;
  height?: number;
};

/** Correction 30 (Part A, ask 2). One part rendering an ordered array of blocks, laid out as v5's body blocks draw it: paragraph, heading, quote, list, image, group of four, carousel, video.
 *  Shared with Convey later. A block with no content renders nothing. Read off v5 and carried to tokens (604): blocks 16 apart (--space-4); paragraph 17/1.55 (--text-m, --text-m-lh);
 *  heading in the display face 22/1.25 (--display-s) with 8 above (--space-2); quote in the display face, v5 20/1.35 carried to --display-s, its attribution 13 --ink-3 (--text-xs), 8 above
 *  and below; list 17 with 4 between items (--space-1), indent v5 22 carried to --space-5; image, group and carousel are MediaBlock's kinds under a figure with a 13 --ink-3 caption
 *  (v5 gap 6 carried to --space-2); video is MediaBlock's ratioed video at 16:9 (v5 draws a 16:9 poster with a centred Play). Media in v5 is 14 radius with a 1px line edge, MediaBlock's frame. */
const has = (v: unknown) => v != null && String(v).trim() !== "";
const some = (a: unknown): a is string[] => Array.isArray(a) && a.some(has);
const PRETTY = { textWrap: "pretty" } as CSSProperties;

export function BodyBlocks({ blocks = [], headingLevel = 2, style }: BodyBlocksProps) {
  const H = ("h" + headingLevel) as "h1" | "h2" | "h3" | "h4";
  const fig = (key: number, child: ReactNode, caption: string | undefined) => (
    <figure
      key={key}
      style={{ margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      {child}
      {has(caption) && (
        <figcaption
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            color: "var(--ink-3)",
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
  const out = blocks
    .map((block, i) => {
      if (!block) return null;
      const b = block as Loose;
      const t = b.type || b.t;
      if (t === "paragraph" || t === "p")
        return has(b.text) ? (
          <p
            key={i}
            data-block="paragraph"
            style={{
              margin: 0,
              fontSize: "var(--text-m)",
              lineHeight: "var(--text-m-lh)",
              ...PRETTY,
            }}
          >
            {b.text}
          </p>
        ) : null;
      if (t === "heading" || t === "h")
        return has(b.text) ? (
          <H
            key={i}
            data-block="heading"
            style={{
              margin: "var(--space-2) 0 0",
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-regular)" as unknown as number,
              fontSize: "var(--display-s)",
              lineHeight: "var(--display-s-lh)",
              ...PRETTY,
            }}
          >
            {b.text}
          </H>
        ) : null;
      if (t === "quote")
        return has(b.text) ? (
          <blockquote
            key={i}
            data-block="quote"
            style={{
              margin: 0,
              padding: "var(--space-2) 0",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--display-s)",
                lineHeight: "var(--display-s-lh)",
                ...PRETTY,
              }}
            >
              {b.text}
            </p>
            {has(b.by) && (
              <cite
                style={{
                  fontStyle: "normal",
                  fontSize: "var(--text-xs)",
                  lineHeight: "var(--text-xs-lh)",
                  color: "var(--ink-3)",
                }}
              >
                {b.by}
              </cite>
            )}
          </blockquote>
        ) : null;
      if (t === "list")
        return some(b.items) ? (
          <ul
            key={i}
            data-block="list"
            style={{
              margin: 0,
              paddingLeft: "var(--space-5)",
              fontSize: "var(--text-m)",
              lineHeight: "var(--text-m-lh)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
            }}
          >
            {b.items.filter(has).map((x, j) => (
              <li key={j}>{x}</li>
            ))}
          </ul>
        ) : null;
      if (t === "image")
        return has(b.src)
          ? fig(
              i,
              <MediaBlock
                kind="image"
                src={b.src}
                alt={b.alt || ""}
                width={b.width}
                height={b.height}
                ratio={b.ratio}
              />,
              b.caption,
            )
          : null;
      const images = b.items || b.srcs;
      if (t === "group" || t === "gallery")
        return some(images)
          ? fig(i, <MediaBlock kind="strip" items={images.filter(has)} />, b.caption)
          : null;
      if (t === "carousel")
        return some(images)
          ? fig(
              i,
              <MediaBlock kind="carousel" items={images.filter(has)} title={b.title} />,
              b.caption,
            )
          : null;
      if (t === "video")
        return has(b.src) || has(b.poster)
          ? fig(
              i,
              <MediaBlock
                kind="video"
                src={b.poster || b.src}
                alt={b.alt || ""}
                ratio={b.ratio || "16 / 9"}
                duration={b.duration}
              />,
              b.caption,
            )
          : null;
      return null;
    })
    .filter(Boolean);
  if (!out.length) return null;
  return (
    <div
      data-body-blocks
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        ...style,
      }}
    >
      {out}
    </div>
  );
}
