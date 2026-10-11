// Brief 10, Convene Pass 2 (Attend): the member's event page (B10-SPEC sections 2 and 3; rulings
// 1023, 1025, 1027, 1030, 1032; handoff 30-C items 6, 7, 9 and 11).
//
// One read: `public.event_page(id)` through src/lib/event-page.ts, and nothing else for the page's
// content. Null is the not-found state. The page renders SPEC section 3 in order with the handoff's
// exceptions, each from a ruling: the invitation notice from `invitations` rows still invited (736,
// 1027); the endpoint line as the link, or the withheld line, or nothing (1025, 1032); partners
// absent until Brief 8's record (1019); Going and the list from `going`, null meaning both are
// absent (508, 645); the past block not built, so a past event renders the past when line and
// `This event has happened.` and no attestation block.
//
// Below expanded this is SPEC's medium layout at both tiers: one column at --content-max inside the
// shell's own scroller, and a Back row that names the page the member arrived from (1065, handoff
// 31-D): the origin record in history state (src/lib/origin.ts), and Discovery when there is none,
// because the page lives under Discovery's route (1047) and Discovery is Convene's front door (628).
// Arrived from that origin in this history, the row goes back, so the router restores the column and
// the lanes; otherwise it navigates to the origin's route and search. At expanded the page is the
// content of Brief 9's Pane on Discovery (1047, handoff 31-B) and scrolls in the pane's body. The
// pane's own `Back to Discovery` replaces the Back row, and the column carries no --content-max cap:
// it is the pane body's width, the cover spans it edge to edge and everything else sits --space-5
// inside it on both sides (1143).
//
// Guardrail 1: no number renders. The going names arrive only at five or more rows, chosen by the
// projection; nothing here counts anything for display.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { BackRow } from "@/components/dna/BackRow";
import { Button } from "@/components/strand/Button";
import { CBadge } from "@/components/strand/CBadge";
import { EmptyState } from "@/components/strand/EmptyState";
import { Icon } from "@/components/strand/Icon";
import { MediaBlock } from "@/components/strand/MediaBlock";
import { NotificationListItem } from "@/components/strand/NotificationListItem";
import { PersonCard } from "@/components/strand/PersonCard";
import { Toast } from "@/components/strand/Toast";
import type { Member } from "@/lib/auth";
import {
  downloadIcs,
  eventShareUrl,
  isFollowing,
  loadEventPage,
  setFollow,
  type EventInvitation,
  type EventPage,
  type RegistrationStatus,
} from "@/lib/event-page";
import { setSubscription } from "@/lib/discovery";
import { deliverImageUrl } from "@/lib/media";
import {
  eventThreadAvailable,
  eventThreadJoin,
  eventThreadOpen,
  openOneToOne,
  refusalOf,
} from "@/lib/messenger";
import { useBackToOrigin } from "@/lib/origin";
import { PaneShareContext } from "@/lib/pane-share";
import { useEmptyStateSeen, useRecordOnChange } from "@/lib/record-hooks";
import { useTier } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";
import { browserZone } from "@/lib/when";
import {
  BlockSections,
  CapsLabel,
  EventBody,
  EventTitle,
  FactRow,
  Facts,
  Kicker,
  PresentedBy,
  People,
  QUIET,
  placeWord,
  whenLines,
} from "./EventParts";
import { EventShareSheet } from "./EventShareSheet";
import { toastStyle } from "./FeedSurface";
import { RoleInvitationSheet } from "./RoleInvitationSheet";
import { RsvpSheet } from "./RsvpSheet";
import { joinNames } from "@/lib/names";

export const EVENT_PAGE_KEY = "event-page";

/** The quiet line a cancelled page ends on: the card's own sentence (src/lib/feed.ts), not a new one. */
const CANCELLED_SURVIVES = "If you had said you were going, you were told by email.";

/**
 * 1143: the cover in Discovery's Pane. It runs back out through the frame's --space-5 sides to the
 * pane body's edges, and it is squared: the pane's rounded corners hold the toolbar row above the
 * body, so the cover's edges meet only straight ones, the bar's hairline above and the pane's
 * border at each side. Its own side borders go, so no side reads as a doubled rule; the top and
 * bottom hairlines stay against the surface.
 */
const PANE_COVER: CSSProperties = {
  borderRadius: 0,
  borderLeft: "none",
  borderRight: "none",
};
/** 1143's edge-to-edge reach, on a wrapper: MediaBlock's openable image is a button whose own
 *  `margin: 0` follows the caller's style (compile v1791654208929113), so a margin passed in would
 *  be reset. */
const PANE_COVER_REACH: CSSProperties = { marginInline: "calc(-1 * var(--space-5))" };

type Images = { cover?: string | undefined; avatars: Record<string, string> };

async function resolveImages(page: EventPage): Promise<Images> {
  const avatars: Record<string, string> = {};
  const people = [
    ...(page.host ? [page.host] : []),
    ...(page.presented_by?.kind === "member" ? [page.presented_by] : []),
    ...page.speakers.map((s) => ({ id: s.member_id, avatar_path: s.avatar_path })),
    ...(page.going ?? []).map((g) => ({ id: g.member_id, avatar_path: g.avatar_path })),
  ];
  for (const p of people) {
    if (!p.avatar_path || avatars[p.id]) continue;
    const url = await deliverImageUrl("profile-media", p.avatar_path, {
      width: 80,
      height: 80,
      resize: "cover",
    });
    if (url) avatars[p.id] = url;
  }
  const first = page.event.cancelled ? undefined : page.media[0];
  const cover = first
    ? await deliverImageUrl("post-media", first.storage_path, { width: 1440, quality: 80 })
    : undefined;
  return { cover, avatars };
}

export function EventSurface({
  member,
  id,
  inPane,
}: {
  member: Member;
  id: string;
  /**
   * Handoff 31-B item 12: rendered as the content of Discovery's Pane at expanded (688, 1047), where
   * the pane's own close control (`Back to Discovery`, 700) is the way back, so the page's Back row
   * is omitted. The pane body is unpadded, so the page also carries its own inset there (1143):
   * the cover edge to edge, everything else --space-5 in from each side, and no --content-max cap,
   * since the pane is the bound. Nothing else about the page changes inside the pane.
   */
  inPane?: boolean | undefined;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const tier = useTier();
  const compact = tier === "compact";
  const [toast, setToast] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<{ open: boolean; initial: RegistrationStatus }>({
    open: false,
    initial: "going",
  });
  const [share, setShare] = useState(false);
  // 1156 (G130): in Discovery's pane the page's own Share opens the pane's share view, the one its
  // toolbar opens; outside the pane there is no opener and the page keeps its Sheet.
  const paneShare = useContext(PaneShareContext);
  const [invitation, setInvitation] = useState<EventInvitation | null>(null);

  const pageQ = useQuery({
    queryKey: [EVENT_PAGE_KEY, member.id, id],
    queryFn: () => loadEventPage(id),
  });
  const page = pageQ.data ?? null;
  // 12C part 2: the signed-in event page loads, with the event as its object; keyed on the id so a
  // refetch records nothing. The two empty states, once each per appearance.
  useRecordOnChange("event_page_viewed", page ? id : null, undefined, { kind: "event", id });
  useEmptyStateSeen("event.load_failed", pageQ.isError);
  useEmptyStateSeen("event.not_available", pageQ.isSuccess && !page);
  const hostId = page?.host?.id ?? null;
  // Brief 14 (SPEC 41-14 Part C item 4; 1334, 1384): the event thread. The host opens it through
  // messenger_event_thread_open. Anyone else asks messenger_event_thread_available, which answers
  // true once the host has opened the thread and the viewer is in it or may join it (a going
  // registrant or an accepted named party, never a removed member), and Message joins through
  // messenger_event_thread_join, which answers the thread's id. Eligibility is the server's alone.
  // Message host opens the pair's thread through messenger_open_one_to_one.
  const eventThread = useQuery({
    queryKey: ["messenger", "event-thread", member.id, id],
    queryFn: () => eventThreadAvailable(id),
    enabled: !!page && !page.viewer.is_host,
  });
  const messageEvent = () =>
    void (async () => {
      try {
        const thread = page?.viewer.is_host ? await eventThreadOpen(id) : await eventThreadJoin(id);
        await navigate({ to: "/messages/$thread", params: { thread } });
      } catch (e) {
        setToast(refusalOf(e).line);
        window.setTimeout(() => setToast(null), 2600);
      }
    })();
  const messageHost = () =>
    void (async () => {
      if (!hostId) return;
      try {
        const thread = await openOneToOne(hostId);
        await navigate({ to: "/messages/$thread", params: { thread } });
      } catch (e) {
        setToast(refusalOf(e).line);
        window.setTimeout(() => setToast(null), 2600);
      }
    })();
  const images = useQuery({
    queryKey: [EVENT_PAGE_KEY, "images", member.id, id, page?.event.status ?? ""],
    queryFn: () => resolveImages(page as EventPage),
    enabled: !!page,
    staleTime: 30 * 60_000,
  });
  const following = useQuery({
    queryKey: ["event-follow", member.id, hostId ?? ""],
    queryFn: () => isFollowing(member.id, hostId ?? ""),
    enabled: !!hostId && hostId !== member.id,
  });
  // 1196: the topic's label is a `convene_families` row, read where Discovery reads it.
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const subscribe = useMutation({
    mutationFn: (on: boolean) => setSubscription(page?.event.family ?? "", on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery", member.id] }),
    onSettled: () => qc.invalidateQueries({ queryKey: [EVENT_PAGE_KEY, member.id, id] }),
    onError: () => say("That did not go through. Try again."),
  });
  const follow = useMutation({
    mutationFn: (on: boolean) => setFollow(hostId ?? "", on),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["event-follow", member.id] }),
  });

  // The timer lives in a ref and the one before it is cleared, so a toast raised inside the last one's
  // 2.6s is not blanked by the older timer (G96); the component clears it on unmount, as ConnectSurface
  // does.
  const toastTimer = useRef<number | null>(null);
  const say = (text: string) => {
    setToast(text);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  useEffect(
    () => () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    },
    [],
  );
  const reread = () => qc.invalidateQueries({ queryKey: [EVENT_PAGE_KEY, member.id, id] });
  const { origin: back, go: goBack } = useBackToOrigin();

  // 1147 (handoff 33-D item 3): the error and not-found states' EmptyState fills its column. The
  // page takes the visible height the shell publishes (in the pane, the pane body's own bounded
  // height) plus its own foot padding, so its content box runs to the visible foot, and the empty
  // column takes the rest of it below the Back row.
  const foot = compact ? 130 : 96;
  const frame = (state: string, children: React.ReactNode) => (
    <div
      data-event-page={id}
      data-event-state={state}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight:
          state === "error" || state === "not-found"
            ? "calc(" + (inPane ? "100%" : "var(--_shell-visible)") + " + " + foot + "px)"
            : undefined,
        gap: 20,
        width: "100%",
        // 1143: in the pane the pane is the bound (520, or 720 with the list hidden), so the cover
        // can reach its edges; the standalone page keeps --content-max.
        maxWidth: inPane ? "none" : "var(--content-max)",
        margin: "0 auto",
        boxSizing: "border-box",
        // G78: inside Discovery's Pane the close control no longer floats over the page. Correction
        // 28 gives the pane a top row of its own, the toolbar and the cluster, above the body this
        // page scrolls in, so the page keeps its own top and bottom and reserves nothing (1134).
        // The pane body is unpadded, so in the pane the page carries its own sides, --space-5, and
        // every state inherits them; the cover alone runs back out to the pane's edges (1143).
        padding: compact ? "8px 0 130px" : inPane ? "16px var(--space-5) 96px" : "16px 0 96px",
      }}
    >
      {!inPane && <BackRow label={back.label} onClick={goBack} />}
      {children}
      {toast && (
        <div style={toastStyle(tier)}>
          <Toast>{toast}</Toast>
        </div>
      )}
    </div>
  );

  if (pageQ.isPending)
    return frame(
      "loading",
      <p role="status" style={{ margin: "8px 4px", color: "var(--ink-3)", fontSize: 15 }}>
        Loading
      </p>,
    );
  if (pageQ.isError)
    return frame(
      "error",
      <div data-empty-column style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
        <EmptyState
          c="convene"
          title="This event did not load."
          body="Check your connection and try again."
          action={
            <Button variant="secondary" onClick={() => void pageQ.refetch()}>
              Try again
            </Button>
          }
        />
      </div>,
    );
  if (!page)
    return frame(
      "not-found",
      <div data-empty-column style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
        <EmptyState
          c="convene"
          title="This event is not available."
          body="It may have been removed, or it is not one you can see."
          action={
            <Button variant="secondary" onClick={goBack}>
              {"Back to " + back.label}
            </Button>
          }
        />
      </div>,
    );

  const ev = page.event;
  const presenterName = page.presented_by?.name ?? page.host?.name ?? null;
  const presenterAvatar =
    page.presented_by?.kind === "member"
      ? images.data?.avatars[page.presented_by.id]
      : page.host
        ? images.data?.avatars[page.host.id]
        : undefined;
  const hostName = page.host?.name ?? "The host";
  const reg = page.viewer.registration;
  const going = reg?.status === "going";
  const viewerTz = browserZone();
  const when = whenLines(
    {
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      doors_at: ev.doors_at,
      timezone: ev.timezone,
      window_basis: ev.window_basis,
      expected_window_end: ev.expected_window_end,
      past: ev.past,
      city: page.place?.city ?? null,
    },
    viewerTz,
  );
  const where = placeWord(ev.mode, page.place);
  const invited = page.invitations.filter((i) => i.status === "invited");
  const topic = vocab.data?.convene_families?.find((f) => f.value === ev.family)?.label ?? null;
  // 1318: the invitation notice's glyph and destination line are its kind's vocabulary row.
  const invitationKind =
    vocab.data?.notification_kinds?.find((k) => k.value === "role_invitation") ?? null;
  // Revision 4 (1185): below expanded the RSVP is a bar at the scroller's foot; in the pane it stays
  // in flow after the facts. A past event has nothing to answer, so its line stays in flow.
  const bar = tier !== "expanded" && !ev.past;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = eventShareUrl(origin, ev);

  const state = ev.cancelled
    ? "cancelled"
    : ev.past
      ? "past"
      : ev.full && !going
        ? "full"
        : "loaded";

  const rsvpEl = (
    <div
      data-event-rsvp
      data-rsvp-state={
        ev.past ? "past" : going ? "going" : reg ? "not-going" : ev.full ? "full" : "open"
      }
    >
      {ev.past ? (
        <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>This event has happened.</p>
      ) : going ? (
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
            You are going
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRsvp({ open: true, initial: "going" })}
            data-testid="rsvp-change"
          >
            Change
          </Button>
        </div>
      ) : reg ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, color: "var(--ink-2)" }}>You said not going.</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRsvp({ open: true, initial: "not_going" })}
            data-testid="rsvp-change"
          >
            Change
          </Button>
        </div>
      ) : ev.full ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 500 }}>This event is full</span>
          <span style={{ fontSize: 15, color: "var(--ink-2)" }}>The host has no more room.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              c="convene"
              onClick={() => setRsvp({ open: true, initial: "going" })}
              data-testid="rsvp-going"
            >
              I am going
            </Button>
            <Button
              variant="secondary"
              onClick={() => setRsvp({ open: true, initial: "not_going" })}
              data-testid="rsvp-not-going"
            >
              Not going
            </Button>
          </div>
          {ev.ticket_kind === "free" && <span style={QUIET}>Free.</span>}
        </div>
      )}
    </div>
  );

  return frame(
    state,
    <>
      {/* 1. The invitation notice (736, 1027): the member's own invited rows, and nothing else's. */}
      {!ev.cancelled &&
        invited.map((inv) => (
          <div
            key={inv.party_id}
            data-event-invitation={inv.party_id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <NotificationListItem
              kind="role_invitation"
              c={invitationKind?.c ?? undefined}
              destination={invitationKind?.destination ?? undefined}
              actor={hostName}
              detail={inv.verb}
              unread
              onClick={() => setInvitation(inv)}
              onRespond={() => setInvitation(inv)}
            />
          </div>
        ))}

      {/* 2. Cover: absent when cancelled. In the pane it spans the pane body edge to edge (1143). */}
      {!ev.cancelled && !inPane && page.media.length === 0 && (
        <div
          data-event-cover-fallback
          style={{
            aspectRatio: "16 / 9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-sunken)",
            border: "1px solid var(--line)",
            borderRadius: 14,
          }}
        >
          <CBadge c="convene" size={48} />
        </div>
      )}
      {!ev.cancelled && images.data?.cover && (
        <div
          // Keyed on the place, so a page that settles into the pane after its first render mounts
          // a fresh frame rather than patching MediaBlock's `border` shorthand with side longhands.
          key={inPane ? "pane" : "page"}
          style={inPane ? PANE_COVER_REACH : undefined}
        >
          <MediaBlock
            kind="image"
            src={images.data.cover}
            alt=""
            // 1548 (H60-MEDIA Work 5): the cover's stored size picks its frame from the set (1643),
            // so a portrait flyer stands in 4:5 or shows whole; no ratio is passed. No focal point:
            // event_page returns none and no member can set one until the Reframe build.
            width={page.media[0]?.width}
            height={page.media[0]?.height}
            style={inPane ? PANE_COVER : undefined}
          />
        </div>
      )}

      {/* 3. Kicker and title. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Kicker cancelled={ev.cancelled} />
        <EventTitle title={ev.title} cancelled={ev.cancelled} compact={compact} />
      </div>

      {/* 4. Presented by, with Follow for a member who is not the host. */}
      <PresentedBy
        presenter={presenterName}
        host={page.host?.name ?? null}
        avatarSrc={presenterAvatar}
        headline={page.presented_by?.headline}
        links={page.presented_by?.links}
        action={
          hostId && hostId !== member.id ? (
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={follow.isPending || following.isPending}
                onClick={() => follow.mutate(!following.data)}
                data-testid="event-follow"
                aria-pressed={!!following.data}
              >
                {following.data ? "Following" : "Follow"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                c="convene"
                onClick={messageHost}
                data-testid="event-message-host"
              >
                Message host
              </Button>
            </span>
          ) : undefined
        }
      />

      {/* 5. Cancelled stops here: the host's reason as body, then one quiet line on what survives. */}
      {ev.cancelled ? (
        <>
          {ev.cancelled_reason && <EventBody>{ev.cancelled_reason}</EventBody>}
          <p data-event-cancelled-line style={{ margin: 0, ...QUIET, fontSize: 15 }}>
            {CANCELLED_SURVIVES}
          </p>
        </>
      ) : (
        <>
          {/* 6. Facts. */}
          <Facts>
            {when.main && (
              <FactRow icon="calendar" main={when.main} sub={when.sub || undefined} testId="when" />
            )}
            {where && (
              <FactRow
                icon="map-pin"
                main={where}
                sub={ev.timezone ? "Times at the place are in " + ev.timezone : undefined}
                testId="where"
              />
            )}
            {page.place?.map_link &&
              /^https?:\/\//i.test(page.place.map_link) &&
              ev.mode !== "virtual" &&
              !ev.past &&
              (page.place.place_name || page.place.place_text) && (
                <FactRow
                  icon="map-pin"
                  main={page.place.place_name || page.place.place_text}
                  sub={
                    <a
                      href={page.place.map_link}
                      target="_blank"
                      rel="noreferrer"
                      data-event-map-link
                      style={{
                        color: "var(--c-convene-text)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--line-strong)",
                        textUnderlineOffset: 2,
                      }}
                    >
                      Open in maps
                    </a>
                  }
                  testId="map"
                />
              )}
            {ev.family && topic && (
              <FactRow
                icon="hash"
                main={topic}
                testId="topic"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={subscribe.isPending}
                    aria-pressed={page.viewer.subscribed}
                    onClick={() => subscribe.mutate(!page.viewer.subscribed)}
                    data-testid="event-subscribe"
                  >
                    {page.viewer.subscribed ? "Subscribed" : "Subscribe"}
                  </Button>
                }
              />
            )}
            {(ev.delivery_intent.trim() || page.meeting_url || page.door_withheld) && (
              <FactRow
                icon="info"
                main={ev.delivery_intent.trim() || "How to get in"}
                sub={
                  page.meeting_url ? (
                    <a
                      href={page.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      data-event-door
                      style={{
                        color: "var(--c-convene-text)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--line-strong)",
                        textUnderlineOffset: 2,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {page.meeting_url}
                    </a>
                  ) : page.door_withheld ? (
                    <span data-event-door-withheld>
                      The exact door goes to you once you say you are going.
                    </span>
                  ) : undefined
                }
                testId="intent"
              />
            )}
          </Facts>

          {!bar && rsvpEl}
          {/* Brief 14 (1334, 1384): the event thread, for the host and for whoever may join it. */}
          {!ev.cancelled && (page.viewer.is_host || eventThread.data === true) && (
            <div data-event-message>
              <Button c="convene" size="sm" onClick={messageEvent} data-testid="event-message">
                Message
              </Button>
            </div>
          )}

          {/* 8. Body. */}
          {page.post && <EventBody>{page.post.body}</EventBody>}

          {/* 9. The host's blocks (1186, 1189), then People: accepted parties only (678, 1195). 10. Partners: absent under 1019. */}
          <BlockSections blocks={page.blocks} />
          <People
            people={page.speakers.map((sp) => ({
              key: sp.party_id,
              name: sp.name,
              label: sp.label,
              handle: sp.handle,
              avatarSrc: images.data?.avatars[sp.member_id],
            }))}
            onOpen={(handle) => void navigate({ to: "/m/$handle", params: { handle }, search: {} })}
          />

          {/* 11 and 12. Going and who is going, only when the projection returned rows (508, 645). */}
          {page.going && page.going.length > 0 && (
            <>
              <div data-event-going style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <CapsLabel>{ev.past ? "Went" : "Going"}</CapsLabel>
                {/* The founder's ruling (handoff 41-C): the platform's one joiner and its shape, the
                    names comma-joined then one "and others" ("Ama, Kofi, Nana and others are
                    going"), as Discovery's going row and the Messenger read it. */}
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
                  {joinNames(
                    page.going.slice(0, 3).map((g) => g.name),
                    true,
                  )}
                  {ev.past ? " were there" : " are going"}
                </p>
              </div>
              <div
                data-event-going-list
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <CapsLabel>{ev.past ? "Who was there" : "Who is going"}</CapsLabel>
                <p style={{ margin: 0, ...QUIET }}>
                  Names appear only as each member chose to be seen.
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-2)",
                    gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                  }}
                >
                  {page.going.map((g) => (
                    <div
                      key={g.member_id}
                      data-going-row={
                        g.you ? "you" : g.connection ? "connection" : g.shared ? "shared" : "member"
                      }
                      style={{ display: "flex", flexDirection: "column", gap: 4 }}
                    >
                      <PersonCard
                        layout="tile"
                        name={g.you ? g.name + ", you" : g.name}
                        src={images.data?.avatars[g.member_id]}
                        href={"/m/" + g.handle}
                        onOpen={() =>
                          void navigate({
                            to: "/m/$handle",
                            params: { handle: g.handle },
                            search: {},
                          })
                        }
                      />
                      {g.connection && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            textAlign: "center",
                            color: "var(--c-connect-text)",
                          }}
                        >
                          Connection
                        </span>
                      )}
                      {g.shared && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            textAlign: "center",
                            color: "var(--c-collaborate-text)",
                          }}
                        >
                          Shared
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 13. Share and add to calendar. */}
          <div
            data-event-share-row
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (paneShare ? paneShare() : setShare(true))}
              data-testid="event-share"
            >
              Share
            </Button>
            {going && page.calendar.starts_at ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!downloadIcs(page.calendar, ev.slug))
                    say("The calendar file could not be made.");
                }}
                data-testid="event-calendar"
              >
                Add to calendar
              </Button>
            ) : !ev.past && !going ? (
              <span style={QUIET}>Add to calendar appears once you are going.</span>
            ) : null}
          </div>
          {bar && (
            <div
              data-event-rsvp-bar
              style={{
                position: "sticky",
                bottom:
                  "calc(var(--dock-height) + var(--border-thin) + env(safe-area-inset-bottom))",
                zIndex: "var(--z-sticky)" as unknown as number,
                background: "var(--surface-glass)",
                borderTop: "1px solid var(--line)",
                padding: "var(--space-3) var(--space-4)",
              }}
            >
              {rsvpEl}
            </div>
          )}
        </>
      )}

      <RsvpSheet
        open={rsvp.open}
        onClose={() => setRsvp((r) => ({ ...r, open: false }))}
        page={page}
        compact={compact}
        initial={rsvp.initial}
        onSaved={(text) => {
          setRsvp((r) => ({ ...r, open: false }));
          say(text);
          void reread();
        }}
      />
      <EventShareSheet
        open={share}
        onClose={() => setShare(false)}
        title={ev.title}
        url={shareUrl}
        isPublic={ev.public}
        compact={compact}
        onToast={say}
      />
      <RoleInvitationSheet
        open={!!invitation}
        onClose={() => setInvitation(null)}
        invitation={invitation}
        eventTitle={ev.title}
        hostName={hostName}
        whenLine={when.main}
        placeLine={where}
        compact={compact}
        onAnswered={() => {
          setInvitation(null);
          void reread();
          void qc.invalidateQueries({ queryKey: ["notifications", member.id] });
          void qc.invalidateQueries({ queryKey: ["unread", member.id] });
        }}
      />
    </>,
  );
}
