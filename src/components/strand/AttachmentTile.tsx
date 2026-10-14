// Ported from Strand components/dna/AttachmentTile.jsx at compile sha256-b1a458dac1bd562f (brief
// 60-SP item 11; RF 5.2 item 4; 1695, 1696; ratified 1728; handoff H61-SP). New to the tree: one
// attached image in the post composer's strip and in Edit's, two consumers, one part. An 80 square
// thumbnail (MediaBlock image at 1/1, not openable, placed by the image's own focal point and crop
// so the tile shows what the author kept), Remove image (R7, an x IconButton over its top right on
// --scrim, 44 on touch, 36 on pointer), then Reframe (R1, a text act named "Reframe {alt}", R2),
// then one quiet line: Uploading (R4) while `pending`, with Reframe disabled until the size returns
// from media-upload; Reframed (R3) once its framing is not auto-fit; nothing otherwise.
// role="listitem": the caller's list is named "Attached images" (R9). No count, no ordinal in any
// name. Translations, none visible: `useInputMode` is the app's `useMode`, typed props. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import type { CSSProperties } from "react";
import { IconButton } from "./IconButton";
import { MediaBlock, type FocalPoint, type MediaCrop } from "./MediaBlock";
import { useMode, type Mode } from "@/lib/tier";

export type AttachmentTileProps = {
  src?: string | undefined;
  alt?: string | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  focalPoint?: FocalPoint | null | undefined;
  crop?: MediaCrop | null | undefined;
  /** Uploading: the quiet line reads R4 and Reframe is disabled. */
  pending?: boolean | undefined;
  /** R3: overrides the reading off the framing. */
  reframed?: boolean | undefined;
  onRemove?: (() => void) | undefined;
  onReframe?: (() => void) | undefined;
  /** The tile being reframed now. */
  active?: boolean | undefined;
  removeLabel?: string | undefined;
  reframeLabel?: string | undefined;
  uploadingLabel?: string | undefined;
  reframedLabel?: string | undefined;
  input?: Mode | undefined;
  style?: CSSProperties | undefined;
};

export function AttachmentTile({
  src,
  alt = "",
  width,
  height,
  focalPoint,
  crop,
  pending,
  reframed,
  onRemove,
  onReframe,
  active,
  removeLabel = "Remove image",
  reframeLabel = "Reframe",
  uploadingLabel = "Uploading",
  reframedLabel = "Reframed",
  input,
  style,
}: AttachmentTileProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const done = reframed != null ? reframed : !!(focalPoint || crop);
  const line = pending ? uploadingLabel : done ? reframedLabel : "";
  return (
    <div
      role="listitem"
      data-attachment=""
      data-pending={pending ? "" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        width: 80,
        flex: "none",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: 80 }}>
        <div
          style={{
            opacity: pending ? 0.55 : 1,
            transition: "opacity var(--dur-default) var(--ease)",
            outline: active ? "2px solid var(--ink)" : "none",
            outlineOffset: 2,
            borderRadius: 14,
          }}
        >
          <MediaBlock
            kind="image"
            src={src}
            alt={alt}
            width={width}
            height={height}
            focalPoint={focalPoint}
            crop={crop}
            ratio="1/1"
            openable={false}
            input={mode}
          />
        </div>
        {onRemove ? (
          <IconButton
            name="x"
            label={removeLabel}
            input={mode}
            size={touch ? 44 : 36}
            onClick={onRemove}
            style={{
              position: "absolute",
              top: touch ? -10 : -6,
              right: touch ? -10 : -6,
              color: "var(--on-fill)",
              background: "var(--scrim)",
            }}
          />
        ) : null}
      </div>
      {onReframe ? (
        <button
          type="button"
          aria-label={reframeLabel + (alt ? " " + alt : "")}
          aria-disabled={pending ? "true" : undefined}
          aria-pressed={active ? true : undefined}
          onClick={() => {
            if (!pending) onReframe();
          }}
          style={{
            all: "unset",
            cursor: pending ? "not-allowed" : "pointer",
            minHeight: touch ? 44 : "var(--target-min)",
            display: "inline-flex",
            alignItems: "center",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-medium)" as unknown as number,
            color: pending ? "var(--ink-4)" : "var(--ink)",
            textDecoration: pending ? "none" : "underline",
            textDecorationColor: "var(--line-strong)",
            textUnderlineOffset: 2,
          }}
        >
          {reframeLabel}
        </button>
      ) : null}
      <span
        aria-live="polite"
        style={{
          minHeight: "calc(var(--text-xs) * var(--text-xs-lh))",
          fontSize: "var(--text-xs)",
          lineHeight: "var(--text-xs-lh)",
          color: "var(--ink-3)",
        }}
      >
        {line}
      </span>
    </div>
  );
}
