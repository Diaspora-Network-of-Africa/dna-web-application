// Ported from profile/strand-patch/Profile.jsx (B3-Profile-v3, rulings 122, 127, 130, 131, 134,
// 136). One masthead for every view: `hero` is the locked, condensing banner;
// `hero && split` the expanded public split banner; neither is the in-column card form. The ground
// carries the member's textile tile (ruling 132), the one place a pattern sits behind a page head.
// Mate masie appears nowhere on the profile (ruling 133).
//
// Ruling 275, under ruling 212: the core row is name, handle, avatar, headline, identity tier and
// pattern, and nothing else, at any scope and for any viewer. Origin, current place, the segment
// label and the place-derived local time line left it and obey admit_section as sections. The props
// that carried them (`originCountry`, `currentPlace`, `segmentLabel`, `timeLine`) are gone rather
// than left unpassed, because a component that still accepts a prop the doctrine forbids is a prop
// somebody eventually passes.
//
// 1714 (handoff 60-MEDIA-2 Work 3): the portrait and the cover open Strand's ImageViewer on the
// master, whole, for every viewer. The owner's change controls are their own: the camera badge on
// the portrait is a button of its own where a photo is set (with none, the portrait itself still
// asks for one), and the cover keeps its corner IconButton. Their framing (1718's square portrait and
// 1719's cover filling its band, each placed by its focal point) is Strand item 13's and is not
// restyled here; docs/media-sites.md holds the cover's raw <img> as that item's.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { Icon } from "@/components/strand/Icon";
import { IconButton } from "@/components/strand/IconButton";
import { IdentityMark } from "@/components/strand/IdentityMark";
import { ImageViewer } from "@/components/strand/ImageViewer";
import { assetBase } from "@/components/strand/cmeta";

export type MastheadPattern = "kente" | "adinkra" | "mudcloth";

export type ProfileHeaderMember = {
  name: string;
  headline?: string | null | undefined;
  avatar?: string | null | undefined;
  cover?: string | null | undefined;
  coverFocus?: string | null | undefined;
  pattern?: MastheadPattern | null | undefined;
};

export type ProfileHeaderProps = {
  member: ProfileHeaderMember;
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

export function ProfileHeader({
  member,
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
  // alone says whether it shows. Focus goes back to the control that opened it: Safari does not
  // focus a button on a click, so the viewer's own restore would land on the body there.
  const [view, setView] = useState<{ src: string; alt: string; open: boolean } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const viewOpen = !!view?.open;
  useEffect(() => {
    if (viewOpen || !opener.current) return;
    opener.current.focus({ preventScroll: true });
    opener.current = null;
  }, [viewOpen]);
  const openView = (src: string, alt: string) => (e: { currentTarget: HTMLElement }) => {
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
  const viewAvatar = member.avatar ? openView(member.avatar, member.name) : undefined;
  const portraitAct = viewAvatar ?? (owner ? onAvatar : undefined);
  const portraitLabel = viewAvatar
    ? "Open photo of " + member.name
    : owner
      ? "Change your photo"
      : member.name;
  /** The owner's change control on the portrait: drawn as the camera badge it always was, its own
   *  button where the portrait opens the viewer, and the portrait's aria-hidden mark otherwise. */
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
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <Icon name="camera" size={icon} />
      </button>
    ) : (
      <span aria-hidden="true" style={{ ...look, boxSizing: "border-box" }}>
        <Icon name="camera" size={icon} />
      </span>
    );
  };
  /** The cover's image, a button that opens it whole; out of the tab order while condensed away. */
  const coverImage = (img: CSSProperties, hidden?: boolean) =>
    member.cover ? (
      <button
        type="button"
        onClick={openView(member.cover, member.name + ", cover")}
        aria-label={"Open cover of " + member.name}
        data-testid="open-cover"
        tabIndex={hidden ? -1 : undefined}
        style={{
          appearance: "none",
          border: 0,
          margin: 0,
          padding: 0,
          font: "inherit",
          background: "none",
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "zoom-in",
          outlineOffset: "calc(-1 * var(--focus-offset))",
        }}
      >
        <img src={member.cover} alt="" style={img} />
      </button>
    ) : null;
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
        // G136: the placement sits on a wrapper, so the Tooltip's host span wraps the button.
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
        <Avatar
          name={member.name}
          src={member.avatar ?? undefined}
          size={size}
          style={{ borderRadius: r - pad }}
        />
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
    // Expanded public: one locked banner, split. Identity panel at left, cover photo at right. No text over the image, nothing overlaps.
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
              background: member.cover ? "var(--bg-sunken)" : "var(--bg-sunken) url(" + tile + ")",
            }}
          >
            {coverImage({
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: member.coverFocus || "center 35%",
              display: "block",
            })}
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
        <Avatar
          name={member.name}
          src={member.avatar ?? undefined}
          size={avatarSize}
          style={{ borderRadius: 18 }}
        />
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
              background: member.cover ? "var(--bg-sunken)" : "var(--bg-sunken) url(" + tile + ")",
              transition: "height var(--dur-default) var(--ease)",
            }}
          >
            {coverImage(
              {
                width: "100%",
                height: coverHeight,
                objectFit: "cover",
                objectPosition: member.coverFocus || "center 35%",
                display: "block",
              },
              condensed,
            )}
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
              ? "var(--bg-sunken)"
              : "var(--bg-sunken) url(" + base + "patterns/kente-pattern.svg)",
            border: member.cover ? "none" : "1px solid var(--line)",
            boxSizing: "border-box",
          }}
        >
          {coverImage({
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: member.coverFocus || "center 35%",
            display: "block",
          })}
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
            // G136: the placement sits on a wrapper, so the Tooltip's host span wraps the button.
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
