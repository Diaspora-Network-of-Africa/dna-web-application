// Brief 10's public event page (B10-SPEC sections 2 and 3, the public projection; rulings 662, 678,
// 680, 1028, 1029; handoff 30-C item 10). Its own render, outside the shell: a top bar with the
// wordmark and Sign in, one column at --content-max, the footer line. Rendered on the server from
// the loader's data, so a link-preview crawler reads the same markup a browser does.
//
// What it never renders: an attendee or a count (626, 680). The RSVP affordance is the guest path's
// entry (handoff 30-D item 8; rulings 532, 1026, 1034): `I am going` for a free event that is neither
// cancelled nor over, into the Guest sheet, whose one write path is the guest-rsvp Edge Function. A
// link arrives as `?g={token}`, is read here after hydration and never in the server loader, is
// opened once, and the address is replaced with the clean `/e/{slug}` at once; the token then lives
// in component state for the visit. Every image comes through the event-media function by slug and
// position or party id (1029), never a storage path, and a pending party is the role alone (678).
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { Icon } from "@/components/strand/Icon";
import { MediaBlock } from "@/components/strand/MediaBlock";
import { assetBase } from "@/components/strand/cmeta";
import { eventMediaUrl } from "@/lib/event-page";
import type { PublicEventPage } from "@/lib/event-public";
import type { GuestAnswer, GuestStatus } from "@/lib/guest";
import { useRecordOnChange } from "@/lib/record-hooks";
import { useTheme, useTier } from "@/lib/tier";
import { GuestSheet, type GuestSheetState } from "./GuestSheet";
import {
  EventBody,
  EventTitle,
  FactRow,
  Facts,
  Kicker,
  PresentedBy,
  People,
  QUIET,
  BlockSections,
  eventOwnWhen,
  placeWord,
} from "./EventParts";

// 1892, 1902: the 1A wordmark in --ink in both themes. The span paints --ink through the file as a
// mask; the hidden img of the same file at the mark's height gives the span its width from the
// file's own ratio, so no ratio is written here (184: size by height, width auto).
const WORDMARK = assetBase() + "wordmark-mono.svg";
const WORDMARK_MASK = `url("${WORDMARK}") center / contain no-repeat`;

/** The quiet line a cancelled page ends on: the card's own sentence (src/lib/feed.ts). */
const CANCELLED_SURVIVES = "If you had said you were going, you were told by email.";

export const PUBLIC_FOOTER =
  "DNA, the Diaspora Network of Africa. Members host and attend across five Cs.";

/** B10-SPEC 3.7, public: the line under `I am going`. */
export const GUEST_FREE_LINE = "Free. You will be asked for an email so the door can reach you.";

const EMAIL_STATE: GuestSheetState = { kind: "email" };
const OPENING_STATE: GuestSheetState = { kind: "opening" };

export function PublicEventSurface({ page, slug }: { page: PublicEventPage; slug: string }) {
  useTheme();
  const tier = useTier();
  const compact = tier === "compact";
  const navigate = useNavigate();
  const ev = page.event;
  // 12C part 2: the public page /e/{slug} loads, a public kind recorded signed out with the tab's
  // session id (1298). event_public_page carries no event id by design (its `event` object omits
  // it), so this row carries no object until the projection names one (docs/GAPS.md).
  useRecordOnChange("event_page_viewed", slug);

  // The guest's own state for this visit: the link's token and the last answer the function gave.
  const [token, setToken] = useState<string | null>(null);
  const [guest, setGuest] = useState<{ status: GuestStatus | null; email: string } | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; initial: GuestSheetState }>({
    open: false,
    initial: EMAIL_STATE,
  });

  // Item 8.4: a `?g=` arrival. Read after hydration, never in the loader, and keyed on the router's
  // own search string so a client navigation onto the same page reads it too; the address is
  // replaced before the link is opened, so nothing the page renders or links to carries the token.
  const searchStr = useLocation({ select: (l) => l.searchStr });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const g = new URLSearchParams(searchStr || window.location.search).get("g");
    if (!g) return;
    setToken(g);
    setSheet({ open: true, initial: OPENING_STATE });
    void navigate({ to: "/e/$slug", params: { slug }, search: {}, replace: true });
  }, [navigate, slug, searchStr]);

  const onAnswer = useCallback(
    (a: GuestAnswer) => setGuest({ status: a.status, email: a.email }),
    [],
  );
  const onExpired = useCallback(() => {
    setToken(null);
    setGuest(null);
  }, []);
  const closeSheet = useCallback(() => setSheet((sh) => ({ ...sh, open: false })), []);
  const openEmail = () => setSheet({ open: true, initial: EMAIL_STATE });
  const openChange = () => {
    if (!token || !guest || !guest.status) return openEmail();
    setSheet({
      open: true,
      initial: { kind: "existing", status: guest.status, email: guest.email },
    });
  };
  const showRsvp = ev.ticket_kind === "free" && !ev.cancelled && !ev.past;
  const when = eventOwnWhen({
    starts_at: ev.starts_at,
    ends_at: ev.ends_at,
    doors_at: ev.doors_at,
    timezone: ev.timezone,
    window_basis: ev.window_basis,
    expected_window_end: ev.expected_window_end,
    past: ev.past,
    city: page.place?.city ?? null,
  });
  const where = placeWord(ev.mode, page.place);
  const cover = !ev.cancelled && page.media[0] ? page.media[0] : null;
  const people = page.speakers.map((sp) => ({
    key: sp.party_id,
    name: sp.name,
    label: sp.label,
    avatarSrc: sp.has_photo ? eventMediaUrl(slug, { party: sp.party_id }) : undefined,
  }));
  const pending = page.pending_roles.map((r, i) => ({
    key: "pending-" + r.role + "-" + i,
    label: r.label,
  }));
  // Revision 4 (1185): above 1024 the facts and the RSVP sit in a sticky left column beside the story;
  // a cancelled page keeps its one column. At compact the guest RSVP is a bar at the foot.
  const twoCol = tier === "expanded" && !ev.cancelled;
  const bar = compact && showRsvp;
  const rsvpEl = showRsvp ? (
    <div
      data-guest-rsvp
      data-rsvp-state={
        guest?.status === "going" ? "going" : guest?.status === "not_going" ? "not-going" : "open"
      }
    >
      {guest?.status === "going" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span
            data-rsvp-pill
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 16px",
              borderRadius: "var(--radius-pill)",
              background: "var(--c-convene-tint)",
              color: "var(--c-convene-text)",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            <Icon name="check" size={18} />
            You are going.
          </span>
          <Button variant="secondary" size="sm" onClick={openChange} data-testid="guest-change">
            Change
          </Button>
        </div>
      ) : guest?.status === "not_going" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, color: "var(--ink-2)" }}>You said not going.</span>
          <Button variant="secondary" size="sm" onClick={openChange} data-testid="guest-change">
            Change
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <Button c="convene" onClick={openEmail} data-testid="guest-going">
              I am going
            </Button>
          </div>
          <span style={QUIET}>{GUEST_FREE_LINE}</span>
        </div>
      )}
    </div>
  ) : null;
  const story = (
    <>
      <EventBody>{page.body}</EventBody>
      <BlockSections blocks={page.blocks} columns={twoCol} />
      <People people={people} pending={pending} />
    </>
  );

  const coverEl = cover ? (
    <MediaBlock
      kind="image"
      src={eventMediaUrl(slug, { position: cover.position })}
      alt=""
      // 1548 (H60-MEDIA Work 5): below two columns the cover's stored size picks its frame from
      // the set (1643); at two columns 1185's 21:9 still wins. No focal point: the projection
      // returns none and no member can set one until the Reframe build.
      width={cover.width}
      height={cover.height}
      ratio={twoCol ? "21/9" : undefined}
    />
  ) : null;
  const headEl = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Kicker cancelled={ev.cancelled} />
      <EventTitle title={ev.title} cancelled={ev.cancelled} compact={compact} />
    </div>
  );
  const presenterEl = (
    <PresentedBy
      presenter={page.presented_by.name}
      host={page.host?.name ?? null}
      headline={page.presented_by.headline}
      links={page.presented_by.links}
    />
  );
  const factsEl = (
    <Facts>
      {when && <FactRow icon="calendar" main={when} testId="when" />}
      {where && (
        <FactRow
          icon="map-pin"
          main={where}
          sub={ev.timezone ? "Times at the place are in " + ev.timezone : undefined}
          testId="where"
        />
      )}
      {ev.delivery_intent.trim() && (
        <FactRow
          icon="info"
          main={ev.delivery_intent.trim()}
          sub="The exact door goes to people who are going."
          testId="intent"
        />
      )}
    </Facts>
  );
  const layout = ev.cancelled ? (
    <>
      {headEl}
      {presenterEl}
      {ev.cancelled_reason && <EventBody>{ev.cancelled_reason}</EventBody>}
      <p data-event-cancelled-line style={{ margin: 0, ...QUIET, fontSize: 15 }}>
        {CANCELLED_SURVIVES}
      </p>
    </>
  ) : twoCol ? (
    <>
      {coverEl}
      <div
        data-public-columns
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-page-side-column) minmax(0, 1fr)",
          columnGap: "var(--space-8)",
          alignItems: "start",
        }}
      >
        <div
          data-public-aside
          style={{
            position: "sticky",
            top: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {presenterEl}
          {factsEl}
          {rsvpEl && (
            <div
              data-public-rsvp-card
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-l)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
              }}
            >
              {rsvpEl}
            </div>
          )}
        </div>
        <div
          data-public-story
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: "var(--content-max)",
          }}
        >
          {headEl}
          {story}
        </div>
      </div>
    </>
  ) : (
    <>
      {coverEl}
      {headEl}
      {presenterEl}
      {factsEl}
      {!bar && rsvpEl}
      {story}
      {bar && (
        <div
          data-guest-rsvp-bar
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: "var(--z-sticky)" as unknown as number,
            marginInline: -16,
            background: "var(--surface-glass)",
            borderTop: "1px solid var(--line)",
            padding:
              "var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom))",
          }}
        >
          {rsvpEl}
        </div>
      )}
    </>
  );

  return (
    <div
      data-public-event={slug}
      data-event-state={ev.cancelled ? "cancelled" : ev.past ? "past" : "loaded"}
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: compact ? "0 16px" : "0 32px",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 56,
            width: "100%",
            maxWidth: 1440,
            margin: "0 auto",
          }}
        >
          <a
            href="/"
            aria-label="DNA"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}
          >
            <span
              role="img"
              aria-label="DNA"
              style={{
                display: "block",
                background: "var(--ink)",
                WebkitMask: WORDMARK_MASK,
                mask: WORDMARK_MASK,
              }}
            >
              <img
                src={WORDMARK}
                alt=""
                style={{ height: 24, width: "auto", display: "block", visibility: "hidden" }}
              />
            </span>
          </a>
          <a href="/sign-in" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm" tabIndex={-1}>
              Sign in
            </Button>
          </a>
        </div>
      </header>
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: twoCol ? "var(--page-max)" : "var(--content-max)",
          margin: "0 auto",
          boxSizing: "border-box",
          padding: compact ? "16px 16px 48px" : "32px 32px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {layout}
      </main>
      <GuestSheet
        open={sheet.open}
        onClose={closeSheet}
        slug={slug}
        compact={compact}
        initial={sheet.initial}
        token={token}
        onAnswer={onAnswer}
        onExpired={onExpired}
      />
      <footer
        style={{
          padding: "24px 16px calc(24px + env(safe-area-inset-bottom))",
          textAlign: "center",
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--ink-3)",
          borderTop: "1px solid var(--line)",
        }}
      >
        {PUBLIC_FOOTER}{" "}
        <a href="/sign-in" style={{ color: "var(--ink-2)" }}>
          Sign in
        </a>
      </footer>
    </div>
  );
}
