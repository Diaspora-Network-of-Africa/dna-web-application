// Brief 10, Convene Pass 2 (Attend): the parts the member page and the public page share
// (B10-SPEC section 3, items 2 to 10). One drawing per part, so the two projections cannot drift
// in how a fact row, the presenter row or the speakers strip reads (662). Nothing here is fetched:
// every prop is a value the page's projection already chose.
//
// Guardrail 1: no number renders anywhere. The only digits on this surface are dates, times and
// whatever the host wrote into the door line, and every one of them arrives through src/lib/when.ts
// or the host's own words.
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Icon } from "@/components/strand/Icon";
import { LINK_KINDS, linkHref } from "@/components/dna/LinkRow";
import { MediaBlock } from "@/components/strand/MediaBlock";
import { PersonCard } from "@/components/strand/PersonCard";
import type { EventBlock, PresenterLink } from "@/lib/event-page";
import { placeLine } from "@/lib/place";
import { dateLine, knownZone, localLine, timeInZone, whenLine } from "@/lib/when";

export const CAPS: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

export const QUIET: CSSProperties = { fontSize: 13, lineHeight: 1.45, color: "var(--ink-3)" };

export function CapsLabel({ children }: { children: ReactNode }) {
  return <div style={CAPS}>{children}</div>;
}

export type EventTiming = {
  starts_at: string | null;
  ends_at: string | null;
  doors_at: string | null;
  timezone: string | null;
  window_basis: string | null;
  expected_window_end: string | null;
  past: boolean;
  city?: string | null | undefined;
};

/**
 * The calendar row's two lines (SPEC 3.6). The main line is the card's own `when` (P1-SPEC
 * section 2): the viewer's zone, then the event's local time when they differ; a window as words;
 * past as `Happened …`. The sub line is the doors time at the place, or on a past event the end.
 * Every zone is its IANA identifier (898) and the year follows 835.
 */
export function whenLines(t: EventTiming, viewerTz: string, now = new Date()) {
  const main = whenLine(
    {
      starts_at: t.starts_at,
      timezone: t.timezone,
      window_basis: t.window_basis,
      expected_window_end: t.expected_window_end,
      city: t.city ?? null,
    },
    viewerTz,
    now,
  );
  const tz = knownZone(t.timezone) ? t.timezone : knownZone(viewerTz) ? viewerTz : "UTC";
  let sub = "";
  if (t.past && t.ends_at) {
    const end = new Date(t.ends_at);
    sub = "Ended " + dateLine(end, tz, now) + ", " + timeInZone(end, tz) + " " + tz;
  } else if (!t.past && t.doors_at) {
    sub = "Doors " + timeInZone(new Date(t.doors_at), tz) + ", the time at the place";
  }
  return { main, sub };
}

/** The map-pin row's main line: the place, or the format word (SPEC 3.6). */
export function placeWord(
  mode: "in_person" | "virtual" | "hybrid",
  place: {
    place_name: string | null;
    place_text: string | null;
    city: string | null;
    country: string | null;
  } | null,
): string {
  const wordsOnly = !!place && !place.place_name && !place.city;
  const words = place
    ? placeLine(place.place_text, place.place_name, place.city, wordsOnly ? place.country : null)
    : "";
  if (mode === "virtual") return "Online";
  if (mode === "hybrid") return words ? words + " and online" : "Online";
  return words;
}

/** The event's own moment, for a surface with no viewer zone (the public page's server render). */
export function eventOwnWhen(t: EventTiming, now = new Date()): string {
  if (t.starts_at && knownZone(t.timezone)) {
    const line = localLine(t.starts_at, t.timezone, true, now);
    return t.past ? "Happened " + line : line;
  }
  return whenLine(
    {
      starts_at: t.starts_at,
      timezone: t.timezone,
      window_basis: t.window_basis,
      expected_window_end: t.expected_window_end,
      city: t.city ?? null,
    },
    "UTC",
    now,
  );
}

export function FactRow({
  icon,
  main,
  sub,
  testId,
  action,
}: {
  icon: string;
  main: ReactNode;
  sub?: ReactNode;
  testId?: string | undefined;
  /** A control at the row's end, e.g. the topic row's Subscribe. */
  action?: ReactNode;
}) {
  return (
    <div
      data-fact={testId}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0" }}
    >
      <Icon name={icon} size={18} style={{ marginTop: 2, color: "var(--ink-2)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, lineHeight: 1.45, color: "var(--ink)" }}>{main}</div>
        {sub && <div style={QUIET}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return (
    <div
      data-event-facts
      style={{
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        padding: "4px 0",
      }}
    >
      {children}
    </div>
  );
}

export function Kicker({ cancelled }: { cancelled: boolean }) {
  return (
    <div
      data-event-kicker
      style={{ ...CAPS, color: cancelled ? "var(--ink-3)" : "var(--c-convene-text)" }}
    >
      {cancelled ? "Event cancelled" : "Event"}
    </div>
  );
}

export function EventTitle({
  title,
  cancelled,
  compact,
}: {
  title: string;
  cancelled: boolean;
  compact: boolean;
}) {
  return (
    <h1
      data-event-title
      style={{
        margin: 0,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: compact ? 26 : 32,
        lineHeight: 1.15,
        color: cancelled ? "var(--ink-3)" : "var(--ink)",
        textDecoration: cancelled ? "line-through" : "none",
        textDecorationColor: "var(--line-strong)",
        textWrap: "pretty",
      }}
    >
      {title}
    </h1>
  );
}

export function PresentedBy({
  presenter,
  host,
  avatarSrc,
  action,
  headline,
  links,
}: {
  presenter: string | null;
  host: string | null;
  avatarSrc?: string | undefined;
  action?: ReactNode;
  /** 1225: the presenter's one-line headline, as admitted for the viewer; a quiet line. */
  headline?: string | null | undefined;
  /** 1225: the presenter's links, as admitted for the viewer. */
  links?: PresenterLink[] | undefined;
}) {
  const name = presenter ?? host ?? "";
  return (
    <div data-event-presenter style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar name={name} src={avatarSrc} size={40} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Presented by {name}
        </span>
        {headline && (
          <span data-event-presenter-headline style={{ ...QUIET, fontSize: 15 }}>
            {headline}
          </span>
        )}
        {host && host !== presenter && <span style={QUIET}>Hosted by {host}</span>}
        {links && links.length > 0 && <PresenterLinks links={links} />}
      </div>
      {action}
    </div>
  );
}

/** One accepted person on the page: the name, the role's own label, and where the card goes. */
export type PersonEntry = {
  key: string;
  name: string;
  label: string;
  avatarSrc?: string | undefined;
  /** The profile's address. Absent on the public page, where the card is not a control. */
  handle?: string | undefined;
};

/**
 * People (Revision 4, 678, 1195): accepted parties as PersonCard rows under the heading People, and on
 * the public page a pending party as its role label alone in plain type, with no card. Absent below
 * one. With `onOpen` a card opens the profile; without it (the public page) the card is PersonCard's
 * read-only layout at compile v1790724894917128 (correction 35, 1230): a plain div with nothing
 * wrapped around it, so the card's own text is what a reader reads. That closes G162's PersonCard
 * half, which until 37-E drew the interactive card inside an inert wrapper under a composed group
 * label.
 */
export function People({
  people,
  pending = [],
  onOpen,
}: {
  people: PersonEntry[];
  pending?: { key: string; label: string }[];
  onOpen?: ((handle: string) => void) | undefined;
}) {
  if (people.length === 0 && pending.length === 0) return null;
  return (
    <div data-event-speakers style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <CapsLabel>People</CapsLabel>
      {people.map((p) =>
        onOpen && p.handle ? (
          <div key={p.key} data-speaker="accepted">
            <PersonCard
              name={p.name}
              role={p.label}
              src={p.avatarSrc}
              href={"/m/" + p.handle}
              onOpen={() => onOpen(p.handle as string)}
            />
          </div>
        ) : (
          <div key={p.key} data-speaker="accepted">
            <PersonCard name={p.name} role={p.label} src={p.avatarSrc} readOnly />
          </div>
        ),
      )}
      {pending.map((r) => (
        <p
          key={r.key}
          data-speaker="pending"
          style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}
        >
          {r.label}
        </p>
      ))}
    </div>
  );
}

/**
 * A presenter's links (1225): the profile's own kind labels and icons, as anchors to the address
 * `linkHref` gives the stored value (37-E item 4, 1232: the one address rule, shared with LinkRow).
 * A value with no address is not drawn here.
 */
export function PresenterLinks({ links }: { links: PresenterLink[] }) {
  const items = links.flatMap((l) => {
    const href = linkHref(l.kind, l.url);
    return href ? [{ ...l, href }] : [];
  });
  if (items.length === 0) return null;
  return (
    <div
      data-event-presenter-links
      style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1) var(--space-4)" }}
    >
      {items.map((l) => {
        const kind = LINK_KINDS.find((k) => k.k === l.kind);
        return (
          <a
            key={l.kind + l.url}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: "var(--target-min)",
              fontSize: 13,
              color: "var(--ink-2)",
              textDecoration: "underline",
              textDecorationColor: "var(--line-strong)",
              textUnderlineOffset: 2,
            }}
          >
            <Icon name={kind?.icon ?? "link"} size={14} />
            {kind?.label ?? l.url}
          </a>
        );
      })}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The host-written sections (1186, 1189): consecutive blocks grouped by kind, each group under its
 * first block's own `label`, in the order the read serves them. A page with no blocks renders nothing,
 * heading included. The kind picks the drawing (structure); no heading string lives here.
 */
export function BlockSections({
  blocks,
  columns = false,
}: {
  blocks: EventBlock[];
  /** Links in a grid of `minmax(280px, 1fr)` tracks, where the column is wide enough for two. */
  columns?: boolean;
}) {
  const groups: { kind: EventBlock["kind"]; items: EventBlock[] }[] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (last && last.kind === b.kind) last.items.push(b);
    else groups.push({ kind: b.kind, items: [b] });
  }
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map((g, i) => (
        <div
          key={g.kind + i}
          data-event-block-section={g.kind}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <CapsLabel>{g.items[0]?.label}</CapsLabel>
          {g.kind === "link" && (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: columns ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr",
              }}
            >
              {g.items.map((b, j) =>
                b.kind === "link" ? (
                  <MediaBlock
                    key={j}
                    kind="link"
                    src={b.payload.url}
                    title={b.payload.label || hostOf(b.payload.url)}
                    domain={hostOf(b.payload.url)}
                  />
                ) : null,
              )}
            </div>
          )}
          {g.kind === "programme" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {g.items.map((b, j) =>
                b.kind === "programme" ? (
                  <div
                    key={j}
                    data-programme-row
                    style={{
                      display: "grid",
                      gridTemplateColumns: "max-content minmax(0, 1fr)",
                      alignItems: "center",
                      columnGap: "var(--space-4)",
                      minHeight: "var(--target-primary)",
                      borderTop: j === 0 ? undefined : "1px solid var(--line)",
                    }}
                  >
                    <span
                      data-programme-at
                      style={{
                        fontSize: 15,
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--ink-2)",
                      }}
                    >
                      {b.payload.at}
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                      {b.payload.line}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          )}
          {g.kind === "note" &&
            g.items.map((b, j) =>
              b.kind === "note" ? (
                <div
                  key={j}
                  data-note-row
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "6px 0" }}
                >
                  <Icon name="info" size={18} style={{ marginTop: 2, color: "var(--ink-2)" }} />
                  <span
                    style={{
                      fontSize: 15,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {b.payload.text}
                  </span>
                </div>
              ) : null,
            )}
        </div>
      ))}
    </>
  );
}

/** The body (SPEC 3.8): 17, pre-wrap, the host's words as written. */
export function EventBody({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <p
      data-event-body
      style={{
        margin: 0,
        fontSize: 17,
        lineHeight: 1.5,
        color: "var(--ink)",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </p>
  );
}
