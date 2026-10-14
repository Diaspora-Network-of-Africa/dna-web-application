// Ported from Strand components/dna/ProfileHeader.jsx at compile sha256-b1a458dac1bd562f (brief
// 60-SP item 13; RF 5.2 item 3; Brief 3's 122, 127, 212, 275; 1694, 1714, 1718, 1719, 1729;
// ratified 1728; handoff H61-SP). Strand landed the part from the app's staged
// profile/strand-patch/Profile.jsx with three changes: its own IdentityMark replaces the staged
// copy; `coverFrame` and `photoFrame` ({ width, height, focalPoint, crop } from the media rows)
// replace `coverFocus`, which is gone; and the cover is reframed in its tier's own box (1694): the
// band is measured, its ratio fixes the frame, and MediaBlock's exported imageFrame and placement
// put the image in it. 1718 makes the cover the exception to 1714's fixed-box rule: it always
// fills its band by the focal point, at every tier, and is never shown whole on the fill; a tap on
// it opens ImageViewer on the whole image ("Open image", MediaBlock's string). Without stored
// dimensions the file's own are read on load; the band measurement is batched to the next frame
// (note 3). 1719: the portrait stays square in the plate, filled and placed by the focal point;
// without a frame it is the Avatar as before. This file replaces src/components/dna/ProfileHeader.tsx
// (one implementation); `MastheadPattern` now lives with PatternPicker, the app part that
// enumerates the three tiles. Ruling 275 under 212: the core row is name, handle, avatar, headline,
// identity tier and pattern, and nothing else.
//
// Divergences, kept and visible, each under 1714 (every image a member uploads opens full size on
// tap) as 60-MEDIA-2 Work 3 built them and tests/media-sites.cjs reads them: the portrait opens the
// viewer on the master for every viewer ("Open photo of {name}"), where the compile's plate is the
// owner's change control and a visitor's nothing; the owner's camera badge is then its own button,
// "Change your photo"; one viewer serves the cover and the portrait and returns focus to the control
// that opened it, because Safari does not focus a button on a click. The owner's Change cover
// IconButton sits on a wrapper (G136). The data-testid hooks (masthead, cover, portrait, open-cover,
// change-photo, add-cover, masthead-condensed) are the profile arms'. Translations, none visible:
// `assetBase()` for the compile's STRAND_ASSET_BASE read; typed props; the compile's `member.cover`
// viewer alt "" is kept. Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { IdentityMark } from "./IdentityMark";
import { ImageViewer } from "./ImageViewer";
import { imageFrame, placement, type FocalPoint, type MediaCrop } from "./MediaBlock";
import { assetBase } from "./cmeta";

/** A media row's framing, as the projection hands it: the stored size and the author's framing (351). */
export type MediaFrame = {
  width?: number | null | undefined;
  height?: number | null | undefined;
  focalPoint?: FocalPoint | null | undefined;
  crop?: MediaCrop | null | undefined;
};

export type ProfileHeaderMember = {
  name: string;
  headline?: string | null | undefined;
  avatar?: string | null | undefined;
  cover?: string | null | undefined;
  /** The textile tile behind the masthead (ruling 132); default kente. */
  pattern?: string | null | undefined;
};

export type ProfileHeaderProps = {
  member: ProfileHeaderMember;
  /** The cover's media row framing; absent, the cover fills its band from its centre (1729). */
  coverFrame?: MediaFrame | undefined;
  /** The portrait's media row framing; absent, the portrait is the Avatar. */
  photoFrame?: MediaFrame | undefined;
  identified?: boolean | undefined;
  actions?: ReactNode;
  onAvatar?: (() => void) | undefined;
  onCover?: (() => void) | undefined;
  owner?: boolean | undefined;
  hero?: boolean | undefined;
  split?: boolean | undefined;
  condensed?: boolean | undefined;
  lock?: boolean | undefined;
  condensedAvatar?: number;
  bleed?: number;
  gutter?: number | undefined;
  coverHeight?: number;
  avatarSize?: number;
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

const ONE: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const num = (v: unknown): number | null => {
  const n = Number(v);
  return n > 0 && isFinite(n) ? n : null;
};

/** The box an element occupies, read once and on every resize, batched to the next frame (note 3). */
function useBox<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number } | null] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        setBox((b) =>
          b && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5
            ? b
            : { w: r.width, h: r.height },
        );
    };
    read();
    if (typeof ResizeObserver !== "function") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return [ref, box];
}

/** One image in a box the caller sizes, always filling it by the focal point (1718, 1719): a frame the fixed-box rule would contain is drawn covered instead.
 *  data-frame reads fill, or pending until the box and the image's size are known. With onOpen the box is a button, Open image. */
function Framed({
  src,
  frame = {},
  h,
  alt = "",
  role,
  onOpen,
  testId,
  hidden,
}: {
  src: string;
  frame?: MediaFrame | undefined;
  h?: number | null | undefined;
  alt?: string | undefined;
  role: "cover" | "photo";
  onOpen?: ((e: SyntheticEvent<HTMLElement>) => void) | undefined;
  testId?: string | undefined;
  hidden?: boolean | undefined;
}) {
  const [ref, box] = useBox<HTMLElement>();
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const w = num(frame.width) || (nat && nat.w);
  const ih = num(frame.height) || (nat && nat.h);
  const f0 = box ? imageFrame(w, ih, frame.crop, box.w / box.h) : null;
  const f = f0 && { ...f0, fit: "cover" as const };
  const st: CSSProperties = f
    ? placement(f, frame.focalPoint, frame.crop)
    : { display: "block", width: "100%", height: "100%", objectFit: "cover" };
  const boxStyle: CSSProperties = {
    position: h != null ? "absolute" : "relative",
    left: 0,
    right: 0,
    top: 0,
    height: h != null ? h : "100%",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    background: "var(--media-fill)",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr)",
    gridTemplateRows: "minmax(0,1fr)",
  };
  const img = (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => {
        if (!(num(frame.width) && num(frame.height)))
          setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
      }}
      style={st}
    />
  );
  const data = { "data-frame-box": role, "data-frame": f ? "fill" : "pending" };
  if (onOpen)
    return (
      <button
        ref={ref as RefObject<HTMLButtonElement>}
        type="button"
        {...data}
        aria-label="Open image"
        data-testid={testId}
        tabIndex={hidden ? -1 : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(e);
        }}
        style={{
          ...boxStyle,
          margin: 0,
          padding: 0,
          border: 0,
          font: "inherit",
          color: "inherit",
          appearance: "none",
          cursor: "zoom-in",
          outlineOffset: "calc(-1 * var(--focus-offset))",
        }}
      >
        {img}
      </button>
    );
  return (
    <div ref={ref as RefObject<HTMLDivElement>} {...data} style={boxStyle}>
      {img}
    </div>
  );
}

export function ProfileHeader({
  member,
  coverFrame,
  photoFrame,
  identified,
  actions,
  onAvatar,
  onCover,
  owner,
  hero,
  split,
  condensed,
  lock = true,
  condensedAvatar = 64,
  bleed = 0,
  gutter,
  coverHeight = 220,
  avatarSize = 112,
  children,
  style,
}: ProfileHeaderProps) {
  const base = assetBase();
  const overlap = Math.round(avatarSize * (hero ? 0.5 : 0.55));
  const tile = base + "patterns/" + (member.pattern || "kente") + "-pattern.svg";
  const gut = gutter != null ? gutter : Math.max(16, bleed);
  const stick: CSSProperties = lock
    ? { position: "sticky", top: 0, zIndex: 3 }
    : { position: "relative" };
  // The image open in the viewer, kept through the close so the viewer fades out on it; `open`
  // alone says whether it shows. Focus goes back to the control that opened it (1714 divergence).
  const [view, setView] = useState<{ src: string; alt: string; open: boolean } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const viewOpen = !!view?.open;
  useEffect(() => {
    if (viewOpen || !opener.current) return;
    opener.current.focus({ preventScroll: true });
    opener.current = null;
  }, [viewOpen]);
  const openView = (src: string, alt: string) => (e: SyntheticEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setView({ src, alt, open: true });
  };
  const viewer = (
    <ImageViewer
      open={viewOpen}
      items={view ? [view.src] : []}
      alt={view?.alt ?? ""}
      step={false}
      onClose={() => setView((v) => (v ? { ...v, open: false } : v))}
    />
  );
  const cover = (h: number | null, hidden?: boolean) =>
    member.cover ? (
      <Framed
        src={member.cover}
        frame={coverFrame}
        h={h}
        role="cover"
        testId="open-cover"
        hidden={hidden}
        onOpen={openView(member.cover, "")}
      />
    ) : null;
  const viewAvatar = member.avatar ? openView(member.avatar, member.name) : undefined;
  const portraitAct = viewAvatar ?? (owner ? onAvatar : undefined);
  const portraitLabel = viewAvatar
    ? "Open photo of " + member.name
    : owner
      ? "Change your photo"
      : member.name;
  const photo = (size: number, r: number) =>
    member.avatar && photoFrame ? (
      <span
        role="img"
        aria-label={member.name}
        style={{
          width: size,
          height: size,
          borderRadius: r,
          overflow: "hidden",
          flex: "none",
          display: "block",
          position: "relative",
        }}
      >
        <Framed src={member.avatar} frame={photoFrame} role="photo" />
      </span>
    ) : (
      <Avatar
        name={member.name}
        src={member.avatar ?? undefined}
        size={size}
        style={{ borderRadius: r }}
      />
    );
  /** The owner's change control on the portrait: the camera badge, its own button where the portrait opens the viewer. */
  const badge = (box: number, icon: number, own: boolean) => {
    const look: CSSProperties = {
      position: "absolute",
      left: -6,
      bottom: -6,
      width: box,
      height: box,
      borderRadius: 999,
      background: "var(--surface)",
      border: "1px solid var(--line)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ink-2)",
      boxSizing: "border-box",
    };
    return own ? (
      <button
        type="button"
        onClick={onAvatar}
        aria-label="Change your photo"
        data-testid="change-photo"
        style={{
          ...look,
          appearance: "none",
          margin: 0,
          padding: 0,
          font: "inherit",
          cursor: "pointer",
        }}
      >
        <Icon name="camera" size={icon} />
      </button>
    ) : (
      <span aria-hidden="true" style={look}>
        <Icon name="camera" size={icon} />
      </span>
    );
  };
  const coverTools = owner && (
    <>
      {!member.cover && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={onCover}
            style={{ background: "var(--surface)" }}
            data-testid="add-cover"
          >
            <Icon name="image" size={16} />
            Add a cover
          </Button>
        </div>
      )}
      {member.cover && (
        <span style={{ position: "absolute", right: 12, top: 12, display: "flex" }}>
          <IconButton
            name="camera"
            label="Change cover"
            size={36}
            onClick={onCover}
            style={{ background: "var(--surface)", borderRadius: 10 }}
          />
        </span>
      )}
    </>
  );
  const plate = (size: number, pad: number, r: number) => (
    <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
      <button
        type="button"
        onClick={portraitAct}
        aria-label={portraitLabel}
        disabled={!portraitAct}
        data-testid="portrait"
        style={{
          appearance: "none",
          border: 0,
          margin: 0,
          font: "inherit",
          position: "relative",
          display: "inline-flex",
          flex: "none",
          padding: pad,
          borderRadius: r,
          background: "var(--surface)",
          cursor: viewAvatar ? "zoom-in" : owner ? "pointer" : "default",
        }}
      >
        {photo(size, r - pad)}
        {identified && (
          <IdentityMark
            size={size >= 100 ? 24 : 18}
            style={{ position: "absolute", right: -4, bottom: -4 }}
          />
        )}
        {owner && !viewAvatar && badge(28, 13, false)}
      </button>
      {owner && viewAvatar && badge(28, 13, true)}
    </span>
  );
  const condensedRowFn = () => (
    <div
      data-testid="masthead-condensed"
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px " + gut + "px" }}
    >
      {plate(condensedAvatar, 4, 18)}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.1, ...ONE }}>
          {member.name}
        </span>
        {member.headline && (
          <span style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.3, ...ONE }}>
            {member.headline}
          </span>
        )}
      </div>
    </div>
  );
  const slot = (actions || children) && (
    <div style={{ padding: "8px 16px 0" }}>{actions || children}</div>
  );

  if (hero && split) {
    if (condensed)
      return (
        <header
          aria-label="Member"
          data-testid="masthead"
          data-condensed="1"
          style={{ display: "contents" }}
        >
          <div
            style={{
              ...stick,
              margin: "0 -" + bleed + "px",
              background: "var(--bg-sunken) url(" + tile + ")",
              borderBottom: "1px solid var(--line)",
              fontFamily: "var(--font-sans)",
              color: "var(--ink)",
            }}
          >
            {condensedRowFn()}
          </div>
          {slot}
          {viewer}
        </header>
      );
    return (
      <header
        aria-label="Member"
        data-testid="masthead"
        data-condensed="0"
        style={{ display: "contents" }}
      >
        <div
          style={{
            ...stick,
            height: coverHeight,
            margin: "0 -" + bleed + "px",
            display: "grid",
            gridTemplateColumns: "520px minmax(0,1fr)",
            overflow: "hidden",
            background: "var(--bg-sunken) url(" + tile + ")",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-sans)",
            color: "var(--ink)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 12,
              padding: "20px 32px 28px " + Math.max(32, gut) + "px",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", minWidth: 0 }}>
              {plate(avatarSize, 6, 24)}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: 44,
                    lineHeight: 1.02,
                    letterSpacing: "-0.01em",
                    textWrap: "balance",
                    overflowWrap: "anywhere",
                  }}
                >
                  {member.name}
                </h1>
                {member.headline && (
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontStyle: "italic",
                      fontSize: 20,
                      lineHeight: 1.3,
                      color: "var(--ink-2)",
                      textWrap: "pretty",
                    }}
                  >
                    {member.headline}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  style={{ width: 48, height: 1, background: "var(--ink-3)", margin: "4px 0 2px" }}
                />
              </div>
            </div>
          </div>
          <div
            data-testid="cover"
            style={{
              position: "relative",
              overflow: "hidden",
              background: member.cover ? "var(--media-fill)" : "var(--bg-sunken) url(" + tile + ")",
            }}
          >
            {cover(null)}
            {coverTools}
          </div>
        </div>
        {slot}
        {viewer}
      </header>
    );
  }

  const avatarBtn = (
    <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
      <button
        type="button"
        onClick={portraitAct}
        aria-label={portraitLabel}
        disabled={!portraitAct}
        data-testid="portrait"
        style={{
          all: "unset",
          position: "relative",
          cursor: viewAvatar ? "zoom-in" : owner ? "pointer" : "default",
          flex: "none",
          borderRadius: 18,
          boxShadow: hero ? "none" : "0 0 0 4px var(--bg)",
          background: "var(--bg)",
        }}
      >
        {photo(avatarSize, 18)}
        {identified && (
          <IdentityMark size={24} style={{ position: "absolute", right: -6, bottom: -6 }} />
        )}
        {owner && !viewAvatar && badge(30, 14, false)}
      </button>
      {owner && viewAvatar && badge(30, 14, true)}
    </span>
  );

  return (
    <header
      aria-label="Member"
      data-testid="masthead"
      data-condensed={hero && condensed ? "1" : "0"}
      style={
        hero
          ? { display: "contents" }
          : {
              display: "flex",
              flexDirection: "column",
              gap: 16,
              fontFamily: "var(--font-sans)",
              color: "var(--ink)",
              ...style,
            }
      }
    >
      {hero && (
        <div
          style={{
            ...stick,
            margin: "0 -" + bleed + "px",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-sunken) url(" + tile + ")",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-sans)",
            color: "var(--ink)",
          }}
        >
          <div
            data-testid="cover"
            style={{
              position: "relative",
              height: condensed ? 0 : coverHeight,
              overflow: "hidden",
              background: member.cover ? "var(--media-fill)" : "var(--bg-sunken) url(" + tile + ")",
              transition: "height var(--dur-default) var(--ease)",
            }}
          >
            {cover(coverHeight, condensed)}
            {!condensed && coverTools}
          </div>
          {condensed ? (
            condensedRowFn()
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "0 " + gut + "px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  marginTop: -overlap - 6,
                }}
              >
                {plate(avatarSize, 6, 24)}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 0,
                    paddingBottom: 2,
                  }}
                >
                  {member.headline && (
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: 17,
                        lineHeight: 1.3,
                        color: "var(--ink-2)",
                        textWrap: "pretty",
                      }}
                    >
                      {member.headline}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: 34,
                    lineHeight: 1.02,
                    letterSpacing: "-0.01em",
                    textWrap: "balance",
                    overflowWrap: "anywhere",
                  }}
                >
                  {member.name}
                </h1>
              </div>
            </div>
          )}
        </div>
      )}
      {!hero && (
        <div
          data-testid="cover"
          style={{
            position: "relative",
            height: coverHeight,
            borderRadius: 14,
            overflow: "hidden",
            background: member.cover
              ? "var(--media-fill)"
              : "var(--bg-sunken) url(" + base + "patterns/kente-pattern.svg)",
            border: member.cover ? "none" : "1px solid var(--line)",
            boxSizing: "border-box",
          }}
        >
          {cover(null)}
          {owner && !member.cover && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={onCover}
                style={{ background: "var(--surface)" }}
              >
                <Icon name="image" size={16} />
                Add a cover
              </Button>
            </div>
          )}
          {owner && member.cover && (
            <span style={{ position: "absolute", right: 8, top: 8, display: "flex" }}>
              <IconButton
                name="camera"
                label="Change cover"
                size={36}
                onClick={onCover}
                style={{ background: "var(--surface)", borderRadius: 10 }}
              />
            </span>
          )}
        </div>
      )}
      {!hero && (
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            marginTop: -overlap - 16,
            padding: "0 16px",
          }}
        >
          {avatarBtn}
        </div>
      )}
      {!hero && (
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            padding: "0 16px",
            fontFamily: "var(--font-sans)",
            color: "var(--ink)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: 36,
                lineHeight: 1.1,
                textWrap: "balance",
                overflowWrap: "anywhere",
              }}
            >
              {member.name}
            </h1>
            {member.headline && (
              <div
                style={{ fontSize: 17, lineHeight: 1.4, color: "var(--ink-2)", textWrap: "pretty" }}
              >
                {member.headline}
              </div>
            )}
          </div>
        </div>
      )}
      {hero ? slot : <div style={{ padding: "0 16px" }}>{actions || children}</div>}
      {viewer}
    </header>
  );
}
