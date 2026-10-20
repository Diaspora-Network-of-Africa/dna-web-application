// Brief 9, Convene Pass 2: the Discovery Dashboard, rebuilt to the ruled set (handoff 32-B items 1 to
// 7 with Addenda 1 to 3; rulings 581, 632, 650, 688, 1044, 1063 to 1068, 1076 to 1079, 1082, 1083,
// 1087, 1092 to 1097, 1099, 1105 to 1107, 1110 to 1112), on the parts handoff 32-A ported: PostCard's
// discovery face, Menu, FacetRail's displays and ladders, Input's combobox and Pane's stepping. Handoff
// 33-A binds what Strand correction 28 added to them (1134): the face's link (G100) and its own title
// clamp (G115), the pane at 520 with its height, toolbar and hidden list (G110, 1127), Topics in two
// columns in the compact Sheet only (G102, 1144) and Clear all in the rail's heading row (G111). The
// first Discovery handoff (34-A, 1124 to 1174) restores the search, Filling up, the member's learned
// lane order and the going row (1128, 1138, 1158); its addendum withdraws the Browse lane (1172) and
// centres the lens bar and the search field as one unit (1170, 1171).
//
// One read projection and one write path per surface (CLAUDE.md): everything this surface shows comes
// through `loadDiscovery` (the cards are the Feed's own views, hydrated by post id inside it, 660; the
// going names are `event_going_names` beside `event_presenters`) and Place's options through
// `convene_places()` (1095). Every menu act is an existing write path (item 6): Save is the Feed's
// `setSaved`, Add to calendar the event page's `.ics`, Follow is Connect's `set_follow` wrapper,
// Subscribe `set_subscription` and Not this `dismiss_discovery_item`. The rail's open or collapsed
// state is the member's own row in `member_rail_state` (1111), and the three acts that teach the lane
// order (a card opened, saved or followed from a lane) go only through `noteLaneAct` (1160). Nothing
// here filters, ranks, sorts or counts: the projection chose every lane and every item under row
// policy and answers the lanes in the member's order, and a lane it did not return is absent with no
// heading and no placeholder (632).
//
// Two vocabularies, never one (1093, 1105): the five lenses switch who the events come from, the
// ten lanes are sections of the page. Every lens word comes from `convene_lenses` and every lane
// name from `convene_lanes`; the ids alone live in code.
//
// Layout (1082 as amended by 1094; item 7). The LensBar shows the five lenses with labels always and
// icons at every tier and no seat after the lenses. The FacetRail is collapsed by default at every width: a
// Sheet behind the Filters trigger at compact, and the 64 strip at medium and expanded, opened and
// collapsed by the member and remembered per member per width band. There is no right column. At
// expanded a card opens the event page as Strand's Pane over the lanes (688, 1047): the rail collapses
// to its strip, the card the pane shows is ringed (1083), and Previous and Next step through the lane
// the card was opened from, in its visible order, past what the member dismissed (1044).
//
// A card is a real link to the event's address across its whole face (1067; correction 28, G100): a
// plain click opens the pane at expanded and the route below it, and a new tab, a copied link or a
// middle click is the browser's. At expanded with a pointer, the face's preload warms the event route
// and the page's read under the key EventSurface reads (1067). The read refetches on window focus and
// never live.
//
// No digit renders except in a card's when line: the reason and going rows are words (1096, 1138),
// the where line is a format word and places, and there is no count anywhere.
import { useQuery, useQueryClient, type QueryState } from "@tanstack/react-query";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { EventShareView } from "@/components/dna/EventShareSheet";
import { EVENT_PAGE_KEY } from "@/components/dna/EventSurface";
import { Ghosts } from "@/components/dna/Ghosts";
import { LoadError } from "@/components/dna/LoadError";
import { Button } from "@/components/strand/Button";
import { Chip } from "@/components/strand/Chip";
import { DiaLine } from "@/components/strand/DiaLine";
import { EmptyState } from "@/components/strand/EmptyState";
import {
  FacetRail,
  type FacetAxis,
  type FacetLadder,
  type FacetValue,
} from "@/components/strand/FacetRail";
import { Icon } from "@/components/strand/Icon";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import type { Lens } from "@/components/strand/LensBar";
import { LensSeat, LensSeatBar, LensSeatRow } from "@/components/dna/LensSeat";
import type { MenuProps } from "@/components/strand/Menu";
import { Pane } from "@/components/strand/Pane";
import { PostCard } from "@/components/strand/PostCard";
import { Toast } from "@/components/strand/Toast";
import type { Member } from "@/lib/auth";
import {
  dismissDiscoveryItem,
  GOING_LANES,
  loadConvenePlaces,
  loadDiscovery,
  noteLaneAct,
  setSubscription,
  type ConveneLensId,
  type ConvenePlace,
  type Discovery,
  type DiscoveryFormat,
  type DiscoveryHome,
  type DiscoveryHomeRung,
  type DiscoveryItem,
  type DiscoveryLaneId,
  type DiscoveryPrice,
  type DiscoveryReason,
  type DiscoverySection,
  type DiscoveryWhen,
} from "@/lib/discovery";
import {
  discoveryFacets,
  droppedUnknown,
  facetLists,
  NO_FACETS,
  Q_MAX,
  searchOf,
  type DiscoverySearch,
  type FacetLists,
} from "@/lib/discovery-search";
import { setFollowing } from "@/lib/connect";
import { downloadIcs, eventShareUrl, loadEventPage, type EventPage } from "@/lib/event-page";
import { setSaved } from "@/lib/feed";
import { setHeaderLens } from "@/lib/header-lens-store";
import { useBackToOrigin, type Origin } from "@/lib/origin";
import { PaneShareContext } from "@/lib/pane-share";
import type { EventView } from "@/lib/post-view";
import { readRailCollapsed, railBand, writeRailCollapsed, type RailBand } from "@/lib/rail-memory";
import { setLeftRail, setRightRail, setShellLayout } from "@/lib/rail-store";
import { useShellScroll } from "@/lib/shell-scroll";
import { filterKeysOf } from "@/lib/record";
import { useEmptyStateSeen, useRecordOnChange, useRecordWhen } from "@/lib/record-hooks";
import { useMode, useTier, useWide } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";
import { toastStyle, useShare } from "./FeedSurface";
import { joinNames } from "@/lib/names";

declare module "@tanstack/history" {
  interface HistoryState {
    /** Handoff 32-B item 7 (1083, 1044): the lane a Discovery card was opened from, for stepping. */
    discoveryLane?: string;
  }
}

const TOAST_MS = 2600;
const RAIL_SURFACE = "discovery";

/**
 * The three structural axes' words (item 2, 1095), in the projection's own facet values. These are
 * words in code rather than a vocabulary table; a gap names it (item 11). Price is Free and Paid only.
 */
const FORMAT_OPTIONS: { id: DiscoveryFormat; label: string }[] = [
  { id: "in_person", label: "In person" },
  { id: "online", label: "Online" },
  { id: "hybrid", label: "Hybrid" },
];
const PRICE_OPTIONS: { id: DiscoveryPrice; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "paid", label: "Paid" },
];
const WHEN_OPTIONS: { id: DiscoveryWhen; label: string }[] = [
  { id: "two_weeks", label: "Next two weeks" },
  { id: "this_month", label: "This month" },
  { id: "later", label: "Later" },
];

/** Place's kind words (1095): each option names what it is. */
const PLACE_KIND: Record<ConvenePlace["kind"], string> = {
  city: "City",
  region: "Region",
  country: "Country",
};

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The four lanes whose reason row speaks (1096); every other lane holds the row empty. */
const REASON_LANES: ReadonlySet<DiscoveryLaneId> = new Set([
  "follow",
  "taste",
  "curated",
  "network",
]);

/**
 * The reason row (1096), composed only from the item's reason, in words. Undefined renders the row
 * empty with its height held: a reason with a null name has nothing to say (grounded-or-empty).
 */
function reasonFor(lane: DiscoveryLaneId, reason: DiscoveryReason): string | undefined {
  if (!REASON_LANES.has(lane)) return undefined;
  switch (reason.kind) {
    case "follow":
      return reason.host.name ? "Because you follow " + reason.host.name + "." : undefined;
    case "taste":
      return reason.label ? "Because you follow " + lowerFirst(reason.label) + "." : undefined;
    case "curated":
      return reason.editor.name ? "Curated by " + reason.editor.name + "." : undefined;
    case "network": {
      if ("host" in reason)
        return reason.host.name ? reason.host.name + ", a connection, is hosting." : undefined;
      const names = reason.going.map((p) => p.name);
      if (names.length === 0 || names.some((n) => !n)) return undefined;
      return names.length === 1
        ? names[0] + " is going."
        : joinNames(names as string[]) + " are going.";
    }
    default:
      return undefined;
  }
}

/** Where (item 4): "In person · Accra", "Online", "Hybrid · Accra and London". */
function whereFor(ev: EventView): string {
  if (ev.mode === "virtual") return "Online";
  const word = ev.mode === "hybrid" ? "Hybrid" : "In person";
  const places = joinNames(ev.places);
  return places ? word + " · " + places : word;
}

/** A home as the ladder names it: its city, else its place. */
function homeWord(h: DiscoveryHome): string | null {
  return h.city ?? h.place_name ?? null;
}

const H2: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 22,
  lineHeight: 1.25,
  fontWeight: 600,
  color: "var(--ink)",
};

/** B9-SPEC's medium line (1124, 1171): the search field beside the bar takes 140 to 280, past a 12 gap. */
const SEARCH_MIN = 140;
const SEARCH_MAX = 280;
const SEARCH_GAP = 12;

/**
 * The search (1124, 1159): one Strand Input. Enter applies the trimmed text as `q`, and applying an
 * empty field removes it; Escape clears the draft and leaves an applied search as it is, so the chip
 * and Clear all are what remove it. The draft follows the applied text whenever that changes (its chip
 * removed, Clear all, Back). The field holds 100 characters, the most the projection takes.
 */
function SearchField({ q, onApply }: { q: string; onApply: (text: string) => void }) {
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  return (
    <div data-discovery-search style={{ minWidth: 0 }}>
      <Input
        role="searchbox"
        aria-label="Search events"
        placeholder="Search events, hosts, places"
        icon="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={Q_MAX}
        value={draft}
        onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onApply(draft.trim());
          } else if (e.key === "Escape" && draft) {
            e.preventDefault();
            setDraft("");
          }
        }}
      />
    </div>
  );
}

/**
 * The line the five Cs centre on (1170): the Pulse dock's five C buttons, in the header at expanded
 * and in the fixed dock below expanded, read as the centre of the box their five faces span. Null when
 * no dock is in the document, and the row centres on itself. Read from the DOM (844), never from a
 * width held in code: the header's row is logo, dock, home and avatar, so where its Cs sit depends on
 * the wordmark's width and the controls' at every viewport.
 */
function pulseAxis(): number | null {
  const cs = document.querySelectorAll<HTMLElement>('nav[aria-label="Pulse"] button[data-c]');
  if (cs.length === 0) return null;
  let left = Infinity;
  let right = -Infinity;
  for (const c of cs) {
    const b = c.getBoundingClientRect();
    left = Math.min(left, b.left);
    right = Math.max(right, b.right);
  }
  return Number.isFinite(left) && right > left ? (left + right) / 2 : null;
}

/** How the row lays the unit: beside with the field at `field` wide, or the field under the bar. Both
 *  centre on the axis, which sits `shift` right of the row's own centre (negative: left). */
type UnitLayout = { beside: boolean; field: number; shift: number };

/**
 * The unit's layout from the laid-out row, bar and dock (1170, 1171). The width available to a unit
 * centred on the axis is the row's less twice the axis's distance from the row's centre. The field
 * takes what that leaves beside the bar and its 12 gap, from 140 to 280; below 140 it takes its own
 * full-width row under the bar. A bar too wide to centre on the axis inside the row centres on the
 * row instead, so nothing is pushed out of it.
 */
function unitLayout(row: HTMLElement, root: HTMLElement): UnitLayout | null {
  // Rects, not offsetWidth: the bar's width is its words' and is not whole, and a whole-pixel reading
  // moves the medium flip by a pixel.
  const box = row.getBoundingClientRect();
  const width = box.width;
  const bar = root.getBoundingClientRect().width;
  if (!width || !bar) return null;
  const centre = box.left + width / 2;
  const axis = pulseAxis();
  const shift = axis === null ? 0 : axis - centre;
  const room = width - 2 * Math.abs(shift);
  if (room < bar) return { beside: false, field: 0, shift: 0 };
  const field = Math.min(SEARCH_MAX, room - bar - SEARCH_GAP);
  return field >= SEARCH_MIN ? { beside: true, field, shift } : { beside: false, field: 0, shift };
}

/**
 * The lens row at medium and expanded (1170, 1171): the lens bar and the search field centre together
 * as one unit on the page's axis, the line the header's five Cs centre on, with the scope line under
 * the bar. The field takes 140 to 280 beside the bar; where the bar, the 12 gap and a 140 field do not
 * fit side by side, the field takes its own full-width row under the bar, as at compact. Measured from
 * the laid-out row, bar and dock, and measured again when any of them resizes (the bar's words settle
 * with the fonts, the header's dock moves when the wordmark loads) and when the window does.
 */
function LensRow({ bar, field }: { bar: ReactNode; field: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<UnitLayout>({ beside: false, field: 0, shift: 0 });
  // Whenever the shell hands the row a bar (it arrives with the vocabulary, after the row), then on
  // every resize of the row, the bar's root, the dock and the header's images.
  useLayoutEffect(() => {
    const el = row.current;
    const root = barRef.current?.firstElementChild;
    if (!el || !(root instanceof HTMLElement)) return;
    const measure = () => {
      const next = unitLayout(el, root);
      if (next)
        setLayout((was) =>
          was.beside === next.beside &&
          Math.abs(was.field - next.field) < 0.5 &&
          Math.abs(was.shift - next.shift) < 0.5
            ? was
            : next,
        );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(root);
    const dock = document.querySelector('nav[aria-label="Pulse"]');
    if (dock) ro.observe(dock);
    for (const img of document.querySelectorAll("header img")) ro.observe(img);
    window.addEventListener("resize", measure);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [bar]);
  const { beside, shift } = layout;
  return (
    <div
      ref={row}
      data-lens-row={beside ? "beside" : "under"}
      style={{ display: "flex", flexDirection: "column", gap: SEARCH_GAP, minWidth: 0 }}
    >
      <div
        data-lens-unit
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: SEARCH_GAP,
          minWidth: 0,
          // Centred in a box narrowed on the side away from the axis by twice the axis's offset, so
          // the unit's centre is the axis and its edges stay inside the row.
          marginLeft: shift > 0 ? 2 * shift : 0,
          marginRight: shift < 0 ? -2 * shift : 0,
        }}
      >
        <div ref={barRef} data-lens-row-bar style={{ flex: "none", minWidth: 0 }}>
          {bar}
        </div>
        {beside && (
          // Level with the seats: the track pads its 44 seats by --space-1 top and bottom.
          <div style={{ flex: "none", width: layout.field, marginTop: "var(--space-1)" }}>
            {field}
          </div>
        )}
      </div>
      {!beside && <div style={{ width: "100%", minWidth: 0 }}>{field}</div>}
    </div>
  );
}

type SeeAll = { to: "/convene"; search: DiscoverySearch } | { lens: ConveneLensId };
/** One lane as the list renders it: its heading's id, its body, and whether See all may apply. */
type LaneEntry = { id: DiscoveryLaneId; body: ReactNode; seeAll: boolean };

export function DiscoverySurface({
  member,
  lens,
  search,
  paneId,
  pane,
}: {
  member: Member;
  lens: ConveneLensId;
  search: DiscoverySearch;
  /** The event open in the pane at expanded, or null. */
  paneId: string | null;
  /** The pane's content: the event route's own outlet. */
  pane: ReactNode;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const tier = useTier();
  const wide = useWide();
  const touch = useMode() === "touch";
  const compact = tier === "compact";
  const expanded = tier === "expanded";
  const paneOpen = expanded && !!paneId;
  const openLane = useLocation({ select: (l) => l.state.discoveryLane });
  const { scrollerRef } = useShellScroll();
  const { shareUrl, copyUrl, toast: shareToast } = useShare();
  const [toast, setToast] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [homes, setHomes] = useState<DiscoveryHome[] | null>(null);
  // The member's own acts on a card, held until the reads they change have answered again (item 6).
  const [savedNow, setSavedNow] = useState<Record<string, boolean>>({});
  const [followNow, setFollowNow] = useState<Record<string, boolean>>({});
  const [subscribedNow, setSubscribedNow] = useState<Record<string, boolean>>({});
  const [railNow, setRailNow] = useState<Partial<Record<RailBand, boolean>>>({});

  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const lensRows = useMemo(() => vocab.data?.convene_lenses ?? [], [vocab.data]);
  const laneRows = useMemo(() => vocab.data?.convene_lanes ?? [], [vocab.data]);
  const familyRows = useMemo(() => vocab.data?.convene_families ?? [], [vocab.data]);
  const knownFamilies = useMemo(
    () => (vocab.data ? (vocab.data.convene_families ?? []).map((f) => f.value) : null),
    [vocab.data],
  );
  const placesRead = useQuery({
    queryKey: ["convene-places", member.id],
    queryFn: loadConvenePlaces,
    staleTime: 60_000,
  });
  const places = useMemo(() => placesRead.data ?? [], [placesRead.data]);
  const knownPlaces = useMemo(
    () => (placesRead.data ? placesRead.data.map((p) => p.id) : null),
    [placesRead.data],
  );

  const lists = useMemo(() => facetLists(search), [search]);
  const known = useMemo(
    () => ({ families: knownFamilies, homes, places: knownPlaces }),
    [knownFamilies, homes, knownPlaces],
  );
  const facets = useMemo(() => ({ lens, ...discoveryFacets(lists, known) }), [lens, lists, known]);
  // 12C part 2: Discovery shows, and each lens or facet change, keyed on the lens and the facet
  // keys that are set (never a value, never the search text); a refetch records nothing.
  const facetKeys = filterKeysOf(lists);
  useRecordOnChange("discovery_viewed", lens + "|" + facetKeys.join(","), {
    lens,
    filter_keys: facetKeys,
  });
  const read = useQuery({
    queryKey: ["discovery", member.id, facets],
    queryFn: () => loadDiscovery(member, facets),
    // A facet change keeps the lens's previous answer on screen until the narrowed one lands; a lens
    // change does not, because the previous lens's lanes are not this lens's.
    placeholderData: (prev: Discovery | null | undefined) =>
      prev && prev.lens === lens ? prev : undefined,
    // 1068: the lanes re-read when the member comes back to the window, never live.
    refetchOnWindowFocus: true,
  });
  const data = read.data ?? null;
  useEffect(() => {
    if (read.data) setHomes(read.data.homes);
  }, [read.data]);

  // An unknown facet value leaves the query once a read has shown it to be unknown (item 2).
  useEffect(() => {
    const next = droppedUnknown(lists, known);
    if (!next) return;
    // `state: true` keeps the history state, so a pane open over the lanes keeps its origin and the
    // lane it steps through while only the search changes.
    void navigate({
      to: ".",
      search: searchOf(next) as never,
      replace: true,
      resetScroll: false,
      state: true,
    });
  }, [lists, known, navigate]);

  // An act's optimistic word stands until every read it changes has answered again (this surface's
  // projection, and the Feed's marks or the event page's follow beside it); then the read is the
  // source, so a change made elsewhere is never hidden behind it. A failed re-read keeps the word.
  const reread = (keys: string[][], drop: () => void) =>
    void Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey }))).then(
      drop,
      () => undefined,
    );
  const unset =
    <V,>(key: string) =>
    (m: Record<string, V>) => {
      const n = { ...m };
      delete n[key];
      return n;
    };

  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), TOAST_MS);
  };

  // The rail's memory (1111): the member's row for this band, else collapsed; never written on load.
  const band = railBand(tier, wide);
  const railRead = useQuery({
    queryKey: ["rail-state", member.id, RAIL_SURFACE, band],
    queryFn: () => readRailCollapsed(member.id, RAIL_SURFACE, band as RailBand),
    enabled: !!band,
    staleTime: Infinity,
  });
  const railCollapsed = band ? (railNow[band] ?? railRead.data ?? true) : true;
  const setRailCollapsed = (collapsed: boolean) => {
    if (!band) return;
    setRailNow((r) => ({ ...r, [band]: collapsed }));
    writeRailCollapsed(member.id, RAIL_SURFACE, band, collapsed).then(
      () => qc.setQueryData(["rail-state", member.id, RAIL_SURFACE, band], collapsed),
      () => {
        setRailNow((r) => ({ ...r, [band]: !collapsed }));
        say("That did not go through. Try again.");
      },
    );
  };

  // Navigation. The lens is the path, the facets the query; a lens change keeps the facets (693).
  const setLens = (id: ConveneLensId) =>
    void (id === "all"
      ? navigate({ to: "/convene", search, resetScroll: false })
      : navigate({ to: "/convene/$lens", params: { lens: id }, search, resetScroll: false }));
  const setFacets = (next: FacetLists) =>
    void (lens === "all"
      ? navigate({ to: "/convene", search: searchOf(next), resetScroll: false })
      : navigate({
          to: "/convene/$lens",
          params: { lens },
          search: searchOf(next),
          resetScroll: false,
        }));
  // At expanded the event opens as the pane over the lanes, which stay where they are (688); below it
  // the event page is its own route (1023). Either way it is one navigation, and it carries the origin
  // (1063, 1065) and the lane it was opened from, which Previous and Next step through (1083).
  const origin: Origin =
    lens === "all"
      ? { label: "Discovery", to: "/convene", params: {}, search }
      : { label: "Discovery", to: "/convene/$lens", params: { lens }, search };
  const openEvent = (eventId: string, lane: DiscoveryLaneId, replace = false) =>
    void navigate({
      to: "/convene/events/$id",
      params: { id: eventId },
      search,
      resetScroll: false,
      replace,
      state: (prev) => ({ ...prev, origin, discoveryLane: lane }),
    });
  // G100: the face's address is the location `openEvent` navigates to, facets and all, so the link a
  // member copies or opens in a new tab is the page a plain click shows (1067).
  const eventHref = (eventId: string) =>
    router.buildLocation({ to: "/convene/events/$id", params: { id: eventId }, search }).href;
  // The pane closes to the lens it was opened from, with its facets (1063, 719). An event opened from
  // outside Discovery (the Feed's Event hook) closes to that origin by 1065's rule.
  const toOrigin = useBackToOrigin();
  const closeToDiscovery = () =>
    void (lens === "all"
      ? navigate({ to: "/convene", search, resetScroll: false })
      : navigate({ to: "/convene/$lens", params: { lens }, search, resetScroll: false }));
  const fromElsewhere = !!toOrigin.arrivedFrom && toOrigin.arrivedFrom.to === "/feed";
  const closePane = fromElsewhere ? toOrigin.go : closeToDiscovery;
  // The event page's one read, under EventSurface's key.
  const pageKey = (eventId: string) => [EVENT_PAGE_KEY, member.id, eventId];
  const warmPage = (eventId: string) =>
    void qc.prefetchQuery({
      queryKey: pageKey(eventId),
      queryFn: () => loadEventPage(eventId),
      staleTime: 30_000,
    });
  // 1067: preload at expanded with a pointer warms the event route and the page's one read under
  // EventSurface's key, so the pane opens with data. Never at compact or medium, never on touch.
  const warmEvent = (eventId: string) => {
    void router.preloadRoute({ to: "/convene/events/$id", params: { id: eventId }, search });
    warmPage(eventId);
  };
  // 1140, G120: Share and Copy link in the card's menu, and Copy link in the pane's toolbar, hand over
  // the address
  // the event page's own Share hands over, built by `eventShareUrl` from that page's read: the public
  // page under /e/ when event_page says there is one (1028), and the member page, which always opens
  // the event, when there is none or the read fails or answers nothing. A share sheet and, on WebKit,
  // a clipboard write need the press's activation, so a read already cached is used inside the press:
  // the pane's page once the pane has loaded it, and a card's by hover intent at expanded (1067), or
  // once the read its ellipsis's press starts (`warmMenu`) has answered. A read that has failed, or
  // is paused offline, hands over the member address inside the press. A press made while the read
  // runs waits for its first answer only, and the gesture may not survive that wait (G131). A wait
  // is dropped once a later press overtakes it: one of the same control, or one on another event. So
  // a late answer never writes over a later copy or opens a sheet the member has moved past, while a
  // Copy link followed by a Share on the same event hands over both.
  const handPresses = useRef<{ kind: "copy" | "share"; eventId: string }[]>([]);
  const handOver = (eventId: string, kind: "copy" | "share") => {
    const to = kind === "copy" ? copyUrl : shareUrl;
    const seq = handPresses.current.push({ kind, eventId }) - 1;
    const overtaken = () =>
      handPresses.current.slice(seq + 1).some((p) => p.kind === kind || p.eventId !== eventId);
    const give = (page: EventPage | null) =>
      void to(eventShareUrl(window.location.origin, page?.event ?? { id: eventId }));
    // The read's answer so far: its page; null once an attempt has failed or none is running;
    // undefined while its first attempt runs.
    const answer = (s: QueryState<EventPage | null> | undefined) =>
      s?.data !== undefined
        ? s.data
        : s?.fetchStatus === "fetching" && !s.fetchFailureCount
          ? undefined
          : null;
    const key = pageKey(eventId);
    const was = qc.getQueryState<EventPage | null>(key);
    if (
      was?.data === undefined &&
      !was?.fetchFailureCount &&
      (was?.fetchStatus ?? "idle") === "idle"
    )
      warmPage(eventId);
    const cache = qc.getQueryCache();
    const query = cache.find<EventPage | null>({ queryKey: key, exact: true });
    const now = answer(query?.state);
    if (now !== undefined) return give(now);
    // Never `fetchQuery` here: it joins a read already running, and EventSurface's query retries a
    // failed read three times, which held the hand-over about seven seconds past the press (G131).
    const stop = cache.subscribe(({ query: q, type }) => {
      if (overtaken()) return stop();
      if (q !== query) return;
      const then = type === "removed" ? null : answer(q.state);
      if (then === undefined) return;
      stop();
      give(then);
    });
  };
  // The press that opens a card's menu starts the page's read, at every tier, so the menu's Share and
  // Copy link find it cached once it answers, one event_page round trip after the press (G131). Read
  // on the card's wrapper from the ellipsis's own `aria-haspopup`, because the part names no callback
  // for its menu opening (844).
  const warmMenu = (eventId: string) => (e: { target: EventTarget }) => {
    if (e.target instanceof Element && e.target.closest('[aria-haspopup="menu"]'))
      warmPage(eventId);
  };

  const dismiss = async (item: DiscoveryItem, lane: DiscoveryLaneId) => {
    const key = lane + ":" + item.event_id;
    setDismissed((s) => new Set(s).add(key));
    say("Fewer like this in your lanes.");
    try {
      await dismissDiscoveryItem(item.event_id, lane);
    } catch {
      setDismissed((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
      say("That did not go through. Try again.");
    }
  };

  // The lens set (693, 1093): every word from the vocabulary; the seat reads `short`.
  const lenses: Lens<ConveneLensId>[] = useMemo(
    () => lensRows.map((l) => ({ id: l.value, label: l.short, icon: l.icon, scope: l.scope })),
    [lensRows],
  );
  const lensScope = lensRows.find((l) => l.value === lens)?.scope;
  const familyLabel = (family: string | null) =>
    family ? (familyRows.find((f) => f.value === family)?.label ?? null) : null;

  // Place (1095): the first chosen city names the Near lane "While you are in {city}".
  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? null;
  const chosenCity = lists.place.find((p) => p.startsWith("city|"));
  const nearCity = chosenCity ? placeName(chosenCity) : null;
  const laneName = (id: DiscoveryLaneId) =>
    id === "near" && nearCity
      ? "While you are in " + nearCity
      : (laneRows.find((l) => l.value === id)?.name ?? null);

  // Filters (item 2, 1095, 1110; B9-SPEC Revision 2's Filters line): Format, Price, When, Topics,
  // Home, Place, in that order; no count.
  const ladders: FacetLadder[] = (homes ?? []).flatMap((h) => {
    const w = homeWord(h);
    if (!w) return [];
    const rungs = [
      { id: h.id + ":in", label: "In " + w },
      { id: h.id + ":around", label: "Around " + w },
      ...(h.region ? [{ id: h.id + ":region", label: h.region }] : []),
      ...(h.country ? [{ id: h.id + ":country", label: h.country }] : []),
      { id: "anywhere", label: "Anywhere" },
    ];
    return [{ id: h.id, label: w, rungs }];
  });
  const axes: FacetAxis[] = [
    {
      id: "format",
      label: "Format",
      icon: "map-pin",
      select: "single",
      display: "segment",
      anyLabel: "Any",
      options: FORMAT_OPTIONS,
    },
    {
      id: "price",
      label: "Price",
      icon: "ticket",
      select: "single",
      display: "segment",
      anyLabel: "Any",
      options: PRICE_OPTIONS,
    },
    {
      id: "when",
      label: "When",
      icon: "clock",
      select: "single",
      display: "segment",
      anyLabel: "Any",
      options: WHEN_OPTIONS,
    },
    {
      id: "family",
      label: "Topics",
      icon: "hash",
      display: "checklist",
      // 1144: one column in the FacetRail, where two wrapped its labels to three and four lines; the
      // compact Sheet's two columns (G102) are `sheetAxes` below.
      options: familyRows.map((f) => ({ id: f.value, label: f.label })),
    },
    ...(ladders.length
      ? [{ id: "home", label: "Home", icon: "house", select: "single" as const, ladders }]
      : []),
    {
      id: "place",
      label: "Place",
      icon: "globe",
      display: "combobox",
      placeholder: "Anywhere in the world",
      removeLabel: "Remove",
      options: places.map((p) => ({
        id: p.id,
        label: p.name,
        detail:
          p.kind === "country" || !p.country
            ? PLACE_KIND[p.kind]
            : PLACE_KIND[p.kind] + ", " + p.country,
      })),
    },
  ];
  // B9-SPEC Revision 5's Filters line (1144): the compact Sheet's axes are the rail's with Topics in
  // two columns (G102), derived here so the axes are listed once.
  const sheetAxes = axes.map((a) => (a.id === "family" ? { ...a, columns: 2 as const } : a));
  const railValue: FacetValue = {};
  for (const k of ["format", "price", "when", "family", "place"] as const)
    if (lists[k].length) railValue[k] = [...lists[k]];
  if (lists.home[0]) railValue["home"] = [lists.home[0] + ":" + (lists.rung[0] ?? "in")];
  const onRail = (next: FacetValue) => {
    const rung = (next["home"] ?? [])[0];
    const [homeId, step] = rung && rung !== "anywhere" ? rung.split(":") : [];
    setFacets({
      format: (next["format"] ?? []).filter((v): v is DiscoveryFormat =>
        FORMAT_OPTIONS.some((o) => o.id === v),
      ),
      price: (next["price"] ?? []).filter((v): v is DiscoveryPrice =>
        PRICE_OPTIONS.some((o) => o.id === v),
      ),
      when: (next["when"] ?? [])
        .slice(0, 1)
        .filter((v): v is DiscoveryWhen => WHEN_OPTIONS.some((o) => o.id === v)),
      family: next["family"] ?? [],
      home: homeId ? [homeId] : [],
      rung: homeId && step && step !== "in" ? [step as DiscoveryHomeRung] : [],
      place: next["place"] ?? [],
      // The search is not a rail axis: a change in the rail keeps it (1159).
      q: lists.q,
    });
  };
  const clearFacets = () => setFacets(NO_FACETS);
  // The search (1124): Enter applies it beside whatever the rail holds, and an empty field removes it.
  const applySearch = (text: string) => setFacets({ ...lists, q: text });

  // Applied facets as removable Chips at compact (SPEC section 4), each by its own word; a value no
  // read has named yet shows no chip. An applied search is the first chip, its own text beside the
  // search glyph (1124).
  const chips: { key: string; label: ReactNode; remove: () => void }[] = [];
  if (lists.q)
    chips.push({
      key: "q",
      label: (
        <>
          <Icon name="search" size={14} />
          <span data-search-chip>{lists.q}</span>
        </>
      ),
      remove: () => setFacets({ ...lists, q: "" }),
    });
  const without = (axis: keyof FacetLists, v: string) =>
    setFacets({ ...lists, [axis]: (lists[axis] as string[]).filter((x) => x !== v) } as FacetLists);
  for (const a of axes) {
    if (a.id === "home") {
      const v = railValue["home"]?.[0];
      const label = v && ladders.flatMap((l) => l.rungs).find((r) => r.id === v)?.label;
      if (label)
        chips.push({
          key: "home:" + v,
          label,
          remove: () => setFacets({ ...lists, home: [], rung: [] }),
        });
      continue;
    }
    for (const v of lists[a.id as keyof FacetLists] ?? []) {
      const label = a.options?.find((o) => o.id === v)?.label;
      if (label)
        chips.push({
          key: a.id + ":" + v,
          label,
          remove: () => without(a.id as keyof FacetLists, v),
        });
    }
  }
  const chipRow = chips.length ? (
    <div data-applied-facets style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {chips.map((c) => (
        <Chip key={c.key} onRemove={c.remove}>
          {c.label}
        </Chip>
      ))}
    </div>
  ) : null;

  // The homes line (690, 726, 1050): map-pin and the homes in order, absent with none.
  const homeWords = (homes ?? []).map(homeWord).filter((w): w is string => !!w);
  const homesLine = homeWords.length ? (
    <div
      data-homes-line
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        lineHeight: 1.4,
        color: "var(--ink-2)",
      }}
    >
      <Icon name="map-pin" size={16} />
      <span>{joinNames(homeWords)}</span>
    </div>
  ) : null;

  // Rulings 1465 and 1466: the bar's packing and its seat are the lens seat's, shared with the Feed
  // and Connect (src/components/dna/LensSeat.tsx). Labels always and icons at every tier, and each
  // seat sized to its own word, never stretched across the row (item 7, 1145). At compact the seat
  // is the in-content row that scrolls sideways (B9-SPEC's compact line): nothing is squeezed and
  // the page does not pan. At medium and expanded the bar is in the shell's lens row,
  // `[data-layout-top]`, `min-content`, which is the track's own width because no seat wraps,
  // capped at the row and centred in it. The scope line is the root's own and wraps to that width,
  // so it stays under the bar's start edge and never widens the root past the track to pull the bar
  // off centre.
  const seatBar = {
    lenses,
    value: lens,
    onChange: setLens,
    scope: lensScope,
    c: "convene" as const,
    label: "Convene lens",
  };
  // The search (1124) in each tier's place: full width under the lens bar at compact, and in the lens
  // row beside the bar at medium and expanded (`LensRow`).
  const searchField = <SearchField q={lists.q} onApply={applySearch} />;

  // The shell's `lanes` mode, the rails and the header lens, each set while mounted and cleared on
  // unmount (rail-store.ts, header-lens-store.ts). The key names the surface and never the lens
  // (ruling 1468, W74): a lens change is not a surface change, so the shell does not reset the
  // scroll on it. With the bar in the header the seat holds the docking point; with the bar in the
  // page or the lens row the scroll stays where it is. The pane opening over the lanes keeps the key
  // too, so the lanes stay where the member left them (688). There is no right column (item 7).
  const lensKey = lenses.map((l) => l.id + l.label).join("|");
  const railShut = paneOpen || railCollapsed;
  useEffect(() => {
    setShellLayout({
      mode: "lanes",
      rail: railShut ? "collapsed" : "open",
      key: "discovery",
      top: compact ? null : (
        <LensSeatRow>
          <LensRow
            bar={lenses.length ? <LensSeatBar {...seatBar} shape="row" /> : null}
            field={searchField}
          />
        </LensSeatRow>
      ),
    });
    // The row reads the lens set, the lens, its scope and the search; listing those is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, railShut, lens, lensKey, lensScope, search]);
  useEffect(() => {
    if (compact) {
      setLeftRail(null);
      return;
    }
    setLeftRail({
      label: null,
      node: railShut ? (
        <FacetRail
          mode="collapsed"
          axes={axes}
          value={railValue}
          label="Filters"
          expandLabel={paneOpen ? "Back to Discovery and show filters" : "Show filters"}
          onExpand={() => {
            // Item 3 (D6; 1094, 1111): the strip is the rail's own toggle. With the pane open it
            // closes the pane and shows the filters, as its name says; the write is the member's
            // toggle, never the pane's, and nothing is written when the rail is already open.
            if (railCollapsed) setRailCollapsed(false);
            if (paneOpen) closeToDiscovery();
          }}
        />
      ) : (
        <FacetRail
          tier="expanded"
          axes={axes}
          value={railValue}
          onChange={onRail}
          onClear={clearFacets}
          label="Filters"
          // G111 (correction 28): Clear all in the pinned heading row, so it stays in view as the
          // axes scroll beneath it. The rail is its own scroller only when its height is bounded
          // (25 §3), so it takes its column's height less the sticky inset it rests at, and the
          // heading pins inside it rather than scrolling away with the column.
          clearPlacement="heading"
          style={{ maxHeight: "calc(100% - var(--space-4))" }}
          headingAction={
            <IconButton
              name="panel-left-close"
              label="Collapse filters"
              size={touch ? 44 : 36}
              onClick={() => setRailCollapsed(true)}
            />
          }
        />
      ),
    });
    // The rail reads the axes' sources and the current facets; listing those is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compact,
    railShut,
    railCollapsed,
    paneOpen,
    band,
    touch,
    lists,
    familyRows,
    homes,
    places,
    lens,
    search,
  ]);
  useEffect(() => {
    setRightRail(null);
  }, []);
  useEffect(() => {
    if (!compact || lenses.length === 0) {
      setHeaderLens(null);
      return;
    }
    setHeaderLens({
      lenses,
      value: lens,
      onChange: (id: string) => setLens(id as ConveneLensId),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, lenses, lens, search]);
  useEffect(
    () => () => {
      setShellLayout(null);
      setLeftRail(null);
      setRightRail(null);
      setHeaderLens(null);
    },
    [],
  );

  // The lanes as this member may see them now: the projection's, in the order it answered them (the
  // member's learned order over the base order, 1160; never re-sorted here), less what they dismissed.
  const sections: DiscoverySection[] = (data?.sections ?? []).map((s) => ({
    ...s,
    items: s.items.filter((i) => !dismissed.has(s.section + ":" + i.event_id)),
  }));

  // 650, 1046: DIA's one sentence for a member who follows no host, in plain text with the host's name
  // unlinked (1053).
  const suggest = data?.suggest ?? null;
  const sentence =
    suggest && suggest.host.name && (lens === "all" || lens === "follow")
      ? "You follow no host yet. " +
        suggest.host.name +
        " hosts " +
        suggest.title +
        (suggest.city ? " in " + suggest.city : "") +
        "; follow them and their events start here."
      : null;

  const followedIds = new Set((data?.follows ?? []).map((f) => f.id));
  const subscribedFamilies = new Set((data?.subscriptions ?? []).map((s) => s.family));

  /** The menu (1097): items in the ruled order; an item that does not apply is absent. The saved and
   *  going marks are the answer's the card came from (`src`): each answer reads them for its own
   *  items, so a More on Convene card reads the second answer's (1148). */
  const menuFor = (
    item: DiscoveryItem,
    lane: DiscoveryLaneId,
    src: Discovery | null,
  ): MenuProps["items"] => {
    const post = item.post;
    const ev = post.event;
    const postId = post.id ?? "";
    const saved = postId ? (savedNow[postId] ?? !!src?.saved.has(postId)) : false;
    const going = !!src?.going.has(item.event_id);
    const hostId = ev?.hostId ?? "";
    // 1121: the Follow item names the presenter as the pane does, and follows the host as it does.
    const presenter = ev?.presenter?.name ?? post.author_name;
    const presenterKind = ev?.presenter?.kind ?? post.author_kind;
    const canFollow = presenterKind === "member" && !!hostId && hostId !== member.id && !!presenter;
    const following = hostId ? (followNow[hostId] ?? followedIds.has(hostId)) : false;
    const family = ev?.family ?? "";
    const topic = familyLabel(family);
    const subscribed = family ? (subscribedNow[family] ?? subscribedFamilies.has(family)) : false;
    return [
      // 1140: an event always has an address, so both are always present.
      {
        id: "share",
        label: "Share",
        icon: "share",
        onSelect: () => handOver(item.event_id, "share"),
      },
      {
        id: "copy",
        label: "Copy link",
        icon: "link",
        onSelect: () => handOver(item.event_id, "copy"),
      },
      !!postId && {
        id: "save",
        label: saved ? "Saved" : "Save",
        icon: "bookmark",
        onSelect: () => {
          setSavedNow((s) => ({ ...s, [postId]: !saved }));
          setSaved(member.id, postId, !saved).then(
            // 1160: a save from a lane teaches the order, written before the re-read this save
            // makes so the lane's place on it is the projection's; an unsave teaches nothing.
            () =>
              void (saved ? Promise.resolve() : noteLaneAct(lane, "save")).then(() =>
                reread(
                  [
                    ["discovery", member.id],
                    ["marks", member.id],
                  ],
                  () => setSavedNow(unset(postId)),
                ),
              ),
            () => {
              setSavedNow((s) => ({ ...s, [postId]: saved }));
              say("That did not go through. Try again.");
            },
          );
        },
      },
      // 1097: only for an event the member is going to, and only one with a date, which is the
      // event page's own rule for its calendar file.
      going &&
        !!ev?.startsAt && {
          id: "calendar",
          label: "Add to calendar",
          icon: "calendar",
          onSelect: () => {
            void qc
              .fetchQuery({
                queryKey: [EVENT_PAGE_KEY, member.id, item.event_id],
                queryFn: () => loadEventPage(item.event_id),
                staleTime: 30_000,
              })
              .then(
                (page) => {
                  if (!page || !downloadIcs(page.calendar, page.event.slug))
                    say("The calendar file could not be made.");
                },
                () => say("The calendar file could not be made."),
              );
          },
        },
      { rule: true },
      canFollow && {
        id: "follow",
        label: (following ? "Following " : "Follow ") + presenter,
        icon: "user-plus",
        onSelect: () => {
          setFollowNow((f) => ({ ...f, [hostId]: !following }));
          setFollowing(hostId, !following).then(
            // 1160: as Save, a follow from a lane teaches the order and an unfollow does not.
            () =>
              void (following ? Promise.resolve() : noteLaneAct(lane, "follow")).then(() =>
                reread(
                  [
                    ["discovery", member.id],
                    ["event-follow", member.id],
                  ],
                  () => setFollowNow(unset(hostId)),
                ),
              ),
            () => {
              setFollowNow((f) => ({ ...f, [hostId]: following }));
              say("That did not go through. Try again.");
            },
          );
        },
      },
      !!family &&
        !!topic && {
          id: "subscribe",
          label: (subscribed ? "Subscribed to " : "Subscribe to ") + topic,
          icon: "bell",
          onSelect: () => {
            setSubscribedNow((s) => ({ ...s, [family]: !subscribed }));
            setSubscription(family, !subscribed).then(
              () => reread([["discovery", member.id]], () => setSubscribedNow(unset(family))),
              () => {
                setSubscribedNow((s) => ({ ...s, [family]: subscribed }));
                say("That did not go through. Try again.");
              },
            );
          },
        },
      { rule: true },
      { id: "not", label: "Not this", icon: "x", onSelect: () => void dismiss(item, lane) },
    ];
  };

  // The going row (1124, 1128, 1138, 1158): outside the relationship lanes, the three first names
  // `event_going_names` gave for the event, comma-joined, then "and others are going.": "Ama, Kojo,
  // Efua and others are going." (Chat, Session 34), which is `joinNames` with others, the shape the
  // platform's one joiner takes (handoff 41-C). Nothing when it gave none. The relationship lanes keep their reason (1096), and the
  // part lets a reason win over a going sentence.
  const goingFor = (lane: DiscoveryLaneId, eventId: string, src: Discovery | null) => {
    const names = GOING_LANES.has(lane) ? src?.goingNames.get(eventId) : undefined;
    return names && names.length > 0 ? joinNames(names, true) + " are going." : undefined;
  };

  /** One card, from the answer `src` it came from; `inGrid` fills its track in the lens grid. */
  const card = (
    item: DiscoveryItem,
    lane: DiscoveryLaneId,
    src: Discovery | null,
    inGrid = false,
  ) => {
    const post = item.post;
    const ev = post.event;
    const title = post.fields["title"]?.value;
    const topic = familyLabel(ev?.family ?? null);
    const family = ev?.family ?? null;
    // 1121: the presenter row reads the pane's presenter, name, face and handle from one record; a
    // card the read answered nothing for keeps the author's line (416).
    const shown = ev?.presenter;
    const presenterHandle = shown ? shown.handle : post.author_handle;
    return (
      <div
        key={lane + ":" + item.event_id}
        data-discovery-item={item.event_id}
        data-section={lane}
        // The selected ring (1083) is drawn 4 outside the face. With the pane bounded, the list
        // follows the open card to its column's top; this margin brings the ring into view with it.
        style={{ flex: "none", scrollSnapAlign: "start", scrollMarginBlock: 4 }}
        onPointerDownCapture={warmMenu(item.event_id)}
        onClickCapture={warmMenu(item.event_id)}
      >
        <PostCard
          presentation="discovery"
          c="convene"
          // 1125: in a lens's grid the same card fills its track, which is --lane-card-width at
          // least and a fraction of the column past it; in a lane it keeps the part's own width.
          style={inGrid ? { width: "100%" } : undefined}
          // G115 (1087; correction 28): the part clamps the title on a span inside its link, so the
          // title is the string itself and the ellipsis is named "More: {title}".
          title={typeof title === "string" ? title : undefined}
          // G100 (1067; correction 28): the face is a real link to the address the plain click
          // navigates to, so a new tab, a copied link and a middle click open the event; a plain
          // primary click is still `onOpen`, the pane at expanded and the route below it.
          href={eventHref(item.event_id)}
          when={ev?.when || undefined}
          where={ev ? whereFor(ev) : undefined}
          presenter={(shown ? shown.name : post.author_name) || undefined}
          presenterSrc={shown ? shown.avatar : post.author_avatar}
          topic={topic ?? undefined}
          reason={reasonFor(lane, item.reason)}
          going={goingFor(lane, item.event_id, src)}
          // Items 12 and 21 (1697, 1714, 1717): the face places the flyer by its stored size and
          // framing; past one ratio step of 16:9 it shows whole on --media-fill.
          media={post.media[0] ? { kind: "image", ...post.media[0] } : undefined}
          menu={menuFor(item, lane, src)}
          selected={paneOpen && paneId === item.event_id && (openLane ?? lane) === lane}
          onOpen={() => {
            // 1160: a card opened from a lane is one of the three acts that teach the order; the
            // pane's Previous and Next go through `openEvent` alone and teach nothing.
            void noteLaneAct(lane, "open");
            openEvent(item.event_id, lane);
          }}
          onPreload={expanded && !touch ? () => warmEvent(item.event_id) : undefined}
          onPresenter={
            presenterHandle
              ? () => void navigate({ to: "/m/$handle", params: { handle: presenterHandle } })
              : undefined
          }
          onTopic={
            family && !lists.family.includes(family)
              ? () => setFacets({ ...lists, family: [...lists.family, family] })
              : undefined
          }
        />
      </div>
    );
  };

  const sentenceLine = (
    <DiaLine state="done" text={sentence ?? undefined} style={{ alignItems: "flex-start" }} />
  );

  // See all (item 3; 1092, 1112, 1122): Happening soon applies the two weeks, the four relationship
  // lanes switch to their lens, and This weekend, Join from anywhere, New this week and Near your
  // homes carry none. Format is single-choice, so no See all writes a Format value (1122).
  const seeAllOf = (id: DiscoveryLaneId): SeeAll | null => {
    if (id === "soon") return { to: "/convene", search: { ...search, when: "two_weeks" } };
    if (id === "curated" || id === "follow" || id === "taste" || id === "network")
      return { lens: id };
    return null;
  };
  const seeAllLink = (id: DiscoveryLaneId, to: SeeAll) => (
    <a
      href={
        "lens" in to
          ? router.buildLocation({ to: "/convene/$lens", params: { lens: to.lens }, search }).href
          : router.buildLocation({ to: "/convene", search: to.search }).href
      }
      data-see-all={id}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if ("lens" in to) setLens(to.lens);
        else void navigate({ to: "/convene", search: to.search, resetScroll: false });
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flex: "none",
        minHeight: touch ? "var(--target-primary)" : 36,
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        fontWeight: 500,
        color: "var(--c-convene-text)",
        textDecoration: "underline",
        textDecorationColor: "var(--line-strong)",
        textUnderlineOffset: 2,
      }}
    >
      See all
    </a>
  );

  const lane = (id: DiscoveryLaneId, first: boolean, body: ReactNode, withSeeAll: boolean) => {
    const name = laneName(id);
    const hid = "lane-" + id;
    const to = withSeeAll ? seeAllOf(id) : null;
    return (
      <section
        key={id}
        data-lane={id}
        aria-labelledby={name ? hid : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
          ...(first ? null : { borderTop: "1px solid var(--line)", paddingTop: 20, marginTop: 20 }),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {name && (
            <h2 id={hid} style={H2}>
              {name}
            </h2>
          )}
          {to && seeAllLink(id, to)}
        </div>
        {body}
      </section>
    );
  };

  // 1065: the router's element restoration keys each lane on its id, so Back returns every lane to
  // where the member left it. The shell's scrollToTopSelectors name the columns only, never a lane.
  const laneRow = (id: DiscoveryLaneId, children: ReactNode) => (
    <div
      className="dna-lane"
      data-lane-row
      data-scroll-restoration-id={"discovery-lane-" + id}
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        scrollSnapType: "x proximity",
        scrollbarWidth: "none",
        alignItems: "flex-start",
        // The selected ring sits 4px outside the card (1083), so the row keeps --space-1 above it.
        padding: "var(--space-1) 0 var(--space-2)",
        // Inline, the padding is drawn back out by a negative margin and repeated as scroll padding,
        // so the first card lines up with the lane's heading. Only expanded rings a card (the pane
        // opens there), so only expanded keeps --space-1 beside it, drawn back on the left alone: the
        // expanded column has no end padding to take it, and overflow at the start never scrolls.
        // This is the lane padding its own scroller, which Pane cannot do for it (1151): inside the
        // pane's list column, which pads --space-2 (1150), a selected first card's ring sits inside
        // the list's scrollport by 4 and inside the lane's own by 0. Medium keeps none: with 4px
        // there, Chrome re-snapped the router's restore on Back 4px short (1065).
        ...(compact
          ? { margin: "0 -16px", paddingLeft: 16, paddingRight: 16, scrollPaddingInline: 16 }
          : expanded
            ? {
                marginLeft: "calc(-1 * var(--space-1))",
                minWidth: 0,
                paddingLeft: "var(--space-1)",
                paddingRight: "var(--space-1)",
                scrollPaddingInline: "var(--space-1)",
              }
            : { minWidth: 0 }),
      }}
    >
      {children}
    </div>
  );

  // All's lanes (685, 1092) as an answer `src` gave them, in the order it answered them, each as its
  // cards, and a lane with none absent (632). See all applies as on All wherever All's lanes render,
  // under All and in More on Convene (1148).
  const laneEntries = (from: DiscoverySection[], src: Discovery | null) =>
    from.flatMap<LaneEntry>((s) => {
      if (s.items.length === 0) return [];
      return [
        {
          id: s.section,
          body: laneRow(
            s.section,
            s.items.map((it) => card(it, s.section, src)),
          ),
          seeAll: true,
        },
      ];
    });

  // All: each lane the projection returned, and the Communities lane as its sentence alone when the
  // member follows no host, placed among the lanes around it by the answer's `lane_order` (1160),
  // never by a position held here.
  const followLane = sections.find((s) => s.section === "follow");
  const sentenceLane =
    lens === "all" && !!sentence && (!followLane || followLane.items.length === 0);
  const eventLanes = lens === "all" ? laneEntries(sections, data) : [];
  // Search with no match (B9-SPEC's States): every lane dropped under the search, or the lens's own.
  const noMatch =
    !!lists.q &&
    !!data &&
    (lens === "all"
      ? eventLanes.length === 0
      : !sections.some((s) => s.section === lens && s.items.length > 0));
  const laneList = [...eventLanes];
  if (sentenceLane && !noMatch) {
    const order = data?.laneOrder ?? [];
    const at = order.indexOf("follow");
    const after = at < 0 ? -1 : laneList.findIndex((l) => order.indexOf(l.id) > at);
    laneList.splice(after < 0 ? laneList.length : after, 0, {
      id: "follow",
      body: sentenceLine,
      seeAll: false,
    });
  }
  // The search's EmptyState takes the search and every facet with it (1124), and fills its column
  // (1147).
  const noMatchState = (
    <EmptyState
      c="convene"
      title="Nothing matches that search."
      action={
        <Button variant="secondary" onClick={clearFacets}>
          Clear all
        </Button>
      }
    />
  );
  const lanesView = noMatch ? (
    <div data-empty-column style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
      {noMatchState}
    </div>
  ) : (
    <div data-lanes style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {laneList.map((l, i) => lane(l.id, i === 0, l.body, l.seeAll))}
    </div>
  );

  // A lens (693, 1105): its one lane as a grid of the same card filling the column (1125), or the
  // EmptyState.
  const lensLane: DiscoveryLaneId | null = lens === "all" ? null : lens;
  const lensSection = lensLane ? sections.find((s) => s.section === lensLane) : undefined;
  // 1147 (handoff 33-D item 3): the lens's EmptyState fills its own column, which takes the rest of
  // the list's height; the surface root takes the visible height the shell publishes, and in the
  // pane the list column's own bounded height.
  // Under a search that matched nothing, the lens shows the search's EmptyState in place of its own
  // or of the Communities sentence (B9-SPEC's States).
  const lensCards = !!lensSection && lensSection.items.length > 0;
  const lensSentence = lensLane === "follow" && !!sentence && !lensCards && !noMatch;
  const lensEmpty = !!lensLane && !lensCards && !lensSentence;
  // 12C part 2: DIA's one sentence, shown where it renders (All's follow lane, or the lens's own);
  // it carries no act, so nothing records acted for it. And the two empty states, once each per
  // appearance: the search with no match, and a lens with nothing in it.
  useRecordWhen("dia_suggestion_shown", (sentenceLane && !noMatch) || !!lensSentence, {
    suggestion_kind: "discovery_line",
  });
  useEmptyStateSeen("discovery.no_match", noMatch);
  useEmptyStateSeen("discovery.lens_empty", lensEmpty && !noMatch);

  // More on Convene (1148, 1174). The grid's column count is read from the laid-out grid, wherever the
  // pane puts it, on every resize, and never shown. While the lens's cards are fewer than those
  // columns, All's lanes follow beneath them from a second read of the projection with the same
  // facets under All and `without` set to the lens. The projection removes the lens's events, exactly
  // the ones that lens's own read returns, before it applies the floors (`private.convene_thresholds`),
  // so a lane the removal thins below its floor is absent, and the surface removes nothing and holds no
  // count. A lens with no events keeps its EmptyState and reads nothing more.
  const [columns, setColumns] = useState(0);
  const gridRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const read = () =>
      setColumns(getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setColumns(0);
    };
  }, []);
  const shortHere =
    !!lensLane && lensCards && columns > 0 && (lensSection?.items.length ?? 0) < columns;
  // 688: the pane narrows the list to its own column, where the grid lays fewer tracks, but the lanes
  // stay where the member left them. So More on Convene stays while the pane is open if it showed as
  // the pane opened, and a card opened from it keeps its place, its ring and its steps (1044, 1083).
  const [shortOutside, setShortOutside] = useState(false);
  useEffect(() => {
    if (!paneOpen) setShortOutside(shortHere);
  }, [paneOpen, shortHere]);
  const short = shortHere || (paneOpen && shortOutside && lensCards);
  const allFacets = useMemo(
    () => ({ ...facets, lens: "all" as const, ...(lensLane ? { without: lensLane } : {}) }),
    [facets, lensLane],
  );
  const moreRead = useQuery({
    // Its own key: the same facets under All with the lens left out are not All's read, so this no
    // longer shares All's cache and carries `without` in the key.
    queryKey: ["discovery", member.id, allFacets],
    queryFn: () => loadDiscovery(member, allFacets),
    enabled: short,
    refetchOnWindowFocus: true,
  });
  const more = short ? (moreRead.data ?? null) : null;
  // The answer's sections are More on Convene's lanes, before this member's dismissals: stepping reads
  // these, as it reads the lens's own lane before them (1044).
  const moreLanes: DiscoverySection[] = more?.sections ?? [];
  const moreEntries = laneEntries(
    moreLanes.map((s) => ({
      ...s,
      items: s.items.filter((i) => !dismissed.has(s.section + ":" + i.event_id)),
    })),
    more,
  );
  const moreView = moreEntries.length ? (
    <section
      data-more-on-convene
      aria-labelledby="more-on-convene"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        borderTop: "1px solid var(--line)",
        paddingTop: 20,
        marginTop: 4,
      }}
    >
      <h2 id="more-on-convene" style={H2}>
        More on Convene
      </h2>
      <div data-lanes style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {moreEntries.map((l, i) => lane(l.id, i === 0, l.body, l.seeAll))}
      </div>
    </section>
  ) : null;
  const lensView = lensLane ? (
    <div
      data-lens-list={lensLane}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        minWidth: 0,
        flex: lensEmpty ? "1 1 auto" : undefined,
      }}
    >
      {laneName(lensLane) && <h2 style={H2}>{laneName(lensLane)}</h2>}
      {lensSentence ? (
        sentenceLine
      ) : lensSection && lensCards ? (
        <>
          <div
            ref={gridRef}
            data-lens-cards
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(var(--lane-card-width), 1fr))",
              gap: 12,
              minWidth: 0,
            }}
          >
            {lensSection.items.map((it) => card(it, lensLane, data, true))}
          </div>
          {moreView}
        </>
      ) : (
        <div
          data-empty-column
          style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}
        >
          {noMatch ? (
            noMatchState
          ) : (
            <EmptyState
              c="convene"
              title="Nothing in this lens yet."
              body="Widen the lens or browse another way."
              action={
                <Button variant="secondary" onClick={() => setLens("all")}>
                  Back to All
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  ) : null;

  const body = read.isError ? (
    <LoadError
      title="Convene could not load."
      body="Check your connection and try again."
      onRetry={() => void read.refetch()}
    />
  ) : !read.data && read.isPending ? (
    <Ghosts label="Loading Convene" lane={lens === "all"} />
  ) : lens === "all" ? (
    lanesView
  ) : (
    lensView
  );
  // 1147: the column an EmptyState fills, the lens's own or the search's, takes the visible height.
  const emptyLensView =
    (lensEmpty || (lens === "all" && noMatch)) && !read.isError && !(!read.data && read.isPending);

  // Pane stepping (1083, 1044): Previous and Next across the lane the open card came from, in its
  // order, to the nearest neighbours the member has not dismissed. The open card is found in the lane
  // as the projection answered it, so dismissing the card that is open still steps from its place.
  // An event opened from outside Discovery, or not in the lane the projection answered, steps nowhere.
  const stepLane =
    paneOpen && openLane
      ? [...(data?.sections ?? []), ...moreLanes].find((s) => s.section === openLane)
      : undefined;
  const stepIds = stepLane ? stepLane.items.map((i) => i.event_id) : [];
  const at = paneId ? stepIds.indexOf(paneId) : -1;
  const kept = (id: string) => !dismissed.has(openLane + ":" + id);
  const prevId = at > -1 ? stepIds.slice(0, at).reverse().find(kept) : undefined;
  const nextId = at > -1 ? stepIds.slice(at + 1).find(kept) : undefined;
  const stepping =
    stepLane && at > -1
      ? {
          onPrevious: () => {
            if (prevId) openEvent(prevId, stepLane.section, true);
          },
          onNext: () => {
            if (nextId) openEvent(nextId, stepLane.section, true);
          },
          hasPrevious: !!prevId,
          hasNext: !!nextId,
          previousLabel: "Previous event",
          nextLabel: "Next event",
        }
      : {};

  // G110 (B9-SPEC's pane line; 1127, 1136, correction 28): the pane at 520 with the list taking
  // the rest, bounded to the feed column's own height less the 16 that starts it level with the
  // rail strip (1136), so the list column and the pane body each scroll on their own and the column
  // itself never does. That height is the frame less the header, the lens row, the 16 and the
  // canvas's foot (see the wrapper below), and it holds at every expanded width.
  //
  // The toolbar (Hide or show the list, Copy link, Share) and the cluster (Previous event, Next
  // event, Back to Discovery) share the pane's top row. Hide list keeps the list the same element,
  // hidden and inert with its scroll kept, and centres the pane at 720; it lasts while the pane is
  // open and resets when it closes. Copy link is the card menu's own (`handOver`, 1140, G120): the
  // open event's address as its page builds it, from the read the pane already made, so it is
  // present for every event the pane opens. Share opens the share view below (1156).
  const [listHidden, setListHidden] = useState(false);
  useEffect(() => {
    if (!paneOpen) setListHidden(false);
  }, [paneOpen]);
  const paneItem =
    paneOpen && paneId
      ? [...(data?.sections ?? []), ...moreLanes]
          .flatMap((s) => s.items)
          .find((i) => i.event_id === paneId)
      : undefined;
  // An observer only: EventSurface makes this read under the same key, and this never fetches.
  const paneRead = useQuery({
    queryKey: [EVENT_PAGE_KEY, member.id, paneId ?? ""],
    queryFn: () => loadEventPage(paneId ?? ""),
    enabled: false,
  });
  const paneTitleField = paneItem?.post.fields["title"]?.value;
  // The pane and its toolbar are named by the event; until its title is known, by "Event".
  const paneTitle =
    (typeof paneTitleField === "string" ? paneTitleField : null) ??
    paneRead.data?.event.title ??
    "Event";

  // Previous and Next replace the event under the same pane, so the body starts each one at its top.
  // The body is the part's own scroller (correction 28), reached from this surface's root.
  const paneRoot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    paneRoot.current?.querySelector<HTMLElement>("[data-pane-body]")?.scrollTo({ top: 0 });
  }, [paneId]);

  // The share view in the pane (1156, G130; handoff 34-A item 7). The toolbar's Share and the event
  // page's own Share open one view, `EventShareView`, in the pane body in place of the page, which
  // stays mounted and hidden beneath it. The toolbar's Share is its toggle and is pressed while it
  // shows. The view's close control and Escape inside it return to the page, at the place the page
  // was left and with focus back on the control that opened it; Previous, Next and closing the pane
  // close it too, since it belongs to the event it opened on. Copy link and the card menu's Share are
  // unchanged (1140).
  const [shareFor, setShareFor] = useState<string | null>(null);
  const shareOpen = paneOpen && !!paneId && shareFor === paneId;
  useEffect(() => {
    setShareFor(null);
  }, [paneId, paneOpen]);
  const shareBack = useRef<{ id: string; top: number; opener: HTMLElement | null } | null>(null);
  const refocus = useRef(false);
  const openShare = useCallback(() => {
    if (!paneId) return;
    const body = paneRoot.current?.querySelector<HTMLElement>("[data-pane-body]");
    shareBack.current = {
      id: paneId,
      top: body?.scrollTop ?? 0,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    setShareFor(paneId);
  }, [paneId]);
  const closeShare = (toOpener: boolean) => {
    refocus.current = toOpener;
    setShareFor(null);
  };
  useLayoutEffect(() => {
    const root = paneRoot.current;
    const body = root?.querySelector<HTMLElement>("[data-pane-body]");
    if (shareOpen) {
      // As Sheet does for its own heading: the heading takes focus, so the view is read first.
      body?.scrollTo({ top: 0 });
      const h = root?.querySelector<HTMLElement>("[data-pane-share] [data-sheet-heading]");
      if (h && !h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      h?.focus({ preventScroll: true });
      return;
    }
    const back = shareBack.current;
    shareBack.current = null;
    // Only back to the page it opened on: Previous and Next start the next page at its top.
    if (!back || back.id !== paneId) return;
    if (body) body.scrollTop = back.top;
    if (refocus.current && back.opener?.isConnected) back.opener.focus({ preventScroll: true });
    refocus.current = false;
  }, [shareOpen, paneId]);
  // The part names no pressed state for its tools, so the surface writes it on the part's own Share
  // button (844): true while the view shows, false otherwise. G141 asks Strand for the prop.
  useLayoutEffect(() => {
    paneRoot.current
      ?.querySelector<HTMLElement>('[data-pane-toolbar] [data-tool="share"]')
      ?.setAttribute("aria-pressed", shareOpen ? "true" : "false");
  }, [shareOpen, paneOpen, paneId, listHidden]);
  const shareEvent = paneRead.data?.event;
  const shareView =
    shareOpen && paneId ? (
      <div
        data-pane-share
        onKeyDown={(e) => {
          if (e.key !== "Escape" || e.defaultPrevented) return;
          // Before the pane's own Escape, which closes the pane.
          e.preventDefault();
          closeShare(true);
        }}
        style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
      >
        <EventShareView
          title={shareEvent?.title ?? paneTitle}
          // Built as the page builds its own: the member address until the page's read answers.
          url={eventShareUrl(window.location.origin, shareEvent ?? { id: paneId })}
          isPublic={!!shareEvent?.public}
          onClose={() => closeShare(true)}
          onToast={say}
        />
      </div>
    ) : null;
  // Ruling 1503: at medium and expanded the bar is in the shell's lens row and never docks, so a lens
  // change made while the column is scrolled past the lanes' top returns the lanes to their top; at
  // or above it nothing moves. The top is measured, never assumed 0: the column's first block after
  // the header row, whichever the new lens renders (its lanes, its list or the empty column). The
  // column's position is read in render, before the new lens commits, because the ghosts it shows
  // while it loads are shorter than the lanes and the column clamps to them; the target is held
  // until the lens's own content has rendered, then set. Compact is the seat's (`holdLensDock`,
  // 1468), and the pane opening over the lanes is not a lens change (688).
  const LANES_TOP =
    '[data-discovery] > :is([data-lanes], [data-lens-list], [data-empty-column], [aria-label="Loading Convene"])';
  const lensWas = useRef(lens);
  const scrollWas = useRef(0);
  const laneTarget = useRef<number | null>(null);
  if (lensWas.current !== lens && scrollerRef.current)
    scrollWas.current = scrollerRef.current.scrollTop;
  useLayoutEffect(() => {
    if (lensWas.current === lens) return;
    lensWas.current = lens;
    laneTarget.current = null;
    if (compact) return;
    const column = scrollerRef.current;
    const first = column?.querySelector<HTMLElement>(LANES_TOP);
    if (!column || !first) return;
    const top = Math.round(
      first.getBoundingClientRect().top - column.getBoundingClientRect().top + column.scrollTop,
    );
    laneTarget.current = Math.min(scrollWas.current, top);
    column.scrollTop = laneTarget.current;
  });
  // The lens's content arrives in steps, so the target is set again as the column grows until it
  // holds, for at most two seconds and never once the member has scrolled the column themselves.
  const laneSettle = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const column = scrollerRef.current;
    const target = laneTarget.current;
    if (target === null || !column) return;
    const first = column.querySelector<HTMLElement>(LANES_TOP);
    if (!first || first.getAttribute("aria-label") === "Loading Convene") return;
    laneTarget.current = null;
    laneSettle.current?.();
    const settle = () => {
      column.scrollTop = target;
      return Math.abs(column.scrollTop - target) < 1;
    };
    const root = first.parentElement;
    if (settle() || !root) return;
    const ro = new ResizeObserver(() => {
      if (settle()) stop();
    });
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const timer = window.setTimeout(() => stop(), 2000);
    function stop() {
      ro.disconnect();
      window.clearTimeout(timer);
      events.forEach((e) => column?.removeEventListener(e, stop));
      laneSettle.current = null;
    }
    events.forEach((e) => column.addEventListener(e, stop, { passive: true }));
    ro.observe(root);
    laneSettle.current = stop;
  });
  useEffect(() => () => laneSettle.current?.(), []);

  // 688: the lanes stay where the member left them. With the pane bounded the feed column cannot
  // scroll (its offset clamps to 0) and the list column scrolls instead. So the card at the list
  // column's top is kept, with its distance from that top, and when the pane closes the feed column
  // is scrolled to put the same card at the same distance. A card, not an offset: a lens's grid lays
  // fewer and narrower tracks in the list column than in the full one, so its cards sit elsewhere.
  // While the list is hidden its layout has no width, so the place it was hidden at is the one kept.
  const listAnchor = useRef<{ item: string; section: string; at: number } | null>(null);
  const hiddenNow = useRef(listHidden);
  hiddenNow.current = listHidden;
  useLayoutEffect(() => {
    if (!paneOpen) {
      const column = scrollerRef.current;
      const kept = listAnchor.current;
      listAnchor.current = null;
      if (!column || !kept) return;
      const el = Array.from(column.querySelectorAll<HTMLElement>("[data-discovery-item]")).find(
        (e) => e.dataset["discoveryItem"] === kept.item && e.dataset["section"] === kept.section,
      );
      if (el)
        column.scrollTop +=
          el.getBoundingClientRect().top - column.getBoundingClientRect().top - kept.at;
      return;
    }
    const list = paneRoot.current?.querySelector<HTMLElement>("[data-pane-list]");
    if (!list) return;
    const keep = () => {
      if (hiddenNow.current) return;
      if (list.scrollTop <= 0) {
        listAnchor.current = null;
        return;
      }
      const top = list.getBoundingClientRect().top;
      const first = Array.from(list.querySelectorAll<HTMLElement>("[data-discovery-item]")).find(
        (e) => e.getBoundingClientRect().bottom > top,
      );
      listAnchor.current = first
        ? {
            item: first.dataset["discoveryItem"] ?? "",
            section: first.dataset["section"] ?? "",
            at: first.getBoundingClientRect().top - top,
          }
        : null;
    };
    keep();
    list.addEventListener("scroll", keep, { passive: true });
    return () => list.removeEventListener("scroll", keep);
  }, [paneOpen, scrollerRef]);

  // The list follows the open card (1083): Pane's `selectedKey` brings it into the bounded list
  // column's view vertically, its face below the column's --space-2 padding so the ring drawn 4
  // outside it stays whole (correction 30, G123). A lane scrolls sideways, which Pane does not
  // reach, so the card is brought into view here too, ring and lane both.
  // Hidden, the list has no width to follow in. Shown again on the card it was hidden on, it keeps
  // its place (the hidden list keeps its scroll: Pane does not follow while it is hidden, correction
  // 30, G128); shown on another, reached by Previous or Next while it was hidden, it brings that card
  // into view.
  const hiddenOn = useRef<string | null>(null);
  useEffect(() => {
    if (!paneOpen || !paneId) {
      hiddenOn.current = null;
      return;
    }
    if (listHidden) {
      if (hiddenOn.current === null) hiddenOn.current = paneId;
      return;
    }
    const was = hiddenOn.current;
    hiddenOn.current = null;
    if (was === paneId) return;
    // Compared as data, never built into a selector: the id is the route's own param.
    const el = Array.from(
      document.querySelectorAll<HTMLElement>("[data-discovery] [data-discovery-item]"),
    ).find(
      (e) =>
        e.dataset["discoveryItem"] === paneId && (!openLane || e.dataset["section"] === openLane),
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [paneOpen, paneId, openLane, listHidden]);

  const toasts = (
    <>
      {(toast || shareToast) && (
        <div style={toastStyle(tier)}>
          <Toast>{toast ?? shareToast}</Toast>
        </div>
      )}
    </>
  );
  const laneStyle = <style>{".dna-lane::-webkit-scrollbar{display:none}"}</style>;
  // Medium and expanded: the homes line and the applied chips. With the pane open the row moves
  // into the list column, so rail, list and pane start level (B9-SPEC Revision 2's pane line).
  const headerRow =
    homesLine || chipRow ? (
      <div
        data-header-row
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 16px",
          ...(paneOpen ? { marginBottom: 16 } : null),
        }}
      >
        {homesLine}
        {chipRow}
      </div>
    ) : null;

  if (paneOpen)
    return (
      <div
        ref={paneRoot}
        data-discovery
        data-lens={lens}
        data-pane-open="1"
        // The feed column is a flex column of a definite height, so this wrapper fills it and the
        // pane's `height` of 100% is the column's own, less this top. The top is the collapsed
        // FacetRail strip's sticky inset, so rail, list and pane start level (the pane line).
        style={{
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingTop: "var(--space-4)",
        }}
      >
        {laneStyle}
        <Pane
          tier="expanded"
          list={
            // 1147: the list column is bounded, so an empty lens's column fills it from here.
            <div
              data-pane-list-content
              style={
                emptyLensView
                  ? { display: "flex", flexDirection: "column", minHeight: "100%" }
                  : undefined
              }
            >
              {headerRow}
              {body}
            </div>
          }
          title={paneTitle}
          paneWidth={520}
          height="100%"
          listHidden={listHidden}
          onToggleList={() => setListHidden((h) => !h)}
          onCopyLink={paneId ? () => handOver(paneId, "copy") : undefined}
          onShare={paneId ? () => (shareOpen ? closeShare(false) : openShare()) : undefined}
          onClose={closePane}
          closeLabel={"Back to " + (fromElsewhere ? toOrigin.origin.label : "Discovery")}
          // Correction 30 (G128): Pane does not follow while the list is hidden, and on Show list
          // follows only if the open event changed, so the open event is the key throughout.
          selectedKey={paneId ?? undefined}
          {...stepping}
        >
          <PaneShareContext.Provider value={paneId ? openShare : null}>
            {shareView}
            {/* The page stays mounted beneath the view, laid out as the body's own child. */}
            <div data-pane-page style={{ display: shareOpen ? "none" : "contents" }}>
              {pane}
            </div>
          </PaneShareContext.Provider>
        </Pane>
        {toasts}
      </div>
    );

  return (
    <div
      data-discovery
      data-lens={lens}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        minHeight: emptyLensView ? "var(--_shell-visible)" : undefined,
      }}
    >
      {laneStyle}
      {compact ? (
        <>
          {lenses.length ? <LensSeat {...seatBar} /> : null}
          {/* B9-SPEC's compact line (1124): the search field full width under the lens bar. */}
          {searchField}
          <div
            data-first-row
            // B9-SPEC's compact line: one row of the homes and the Filters trigger. FacetRail's compact
            // Sheet is `contained`: absolute, with no z-index of its own, so the discovery faces
            // after this row (each `position: relative`) painted over it. A flex item's z-index
            // lifts the row, Sheet and all, above the lanes without becoming the Sheet's containing
            // block (G109).
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              zIndex: "var(--z-sheet)" as unknown as number,
            }}
          >
            {homesLine ?? <span />}
            <FacetRail
              tier="compact"
              axes={sheetAxes}
              value={railValue}
              onChange={onRail}
              onClear={clearFacets}
              label="Filters"
              open={browseOpen}
              onOpenChange={setBrowseOpen}
              trigger={({ open, onOpen, label }) => (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  onClick={onOpen}
                  data-testid="filters"
                  style={{ minHeight: touch ? "var(--target-primary)" : 36 }}
                >
                  <Icon name="sliders-horizontal" size={16} />
                  {label}
                </Button>
              )}
            />
          </div>
          {/* B9-SPEC's compact line: the applied chips and Clear all, only when a facet or a search
              is set. */}
          {chipRow && (
            <div
              data-applied-row
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}
            >
              {chipRow}
              <Button variant="ghost" size="sm" onClick={clearFacets}>
                Clear all
              </Button>
            </div>
          )}
        </>
      ) : (
        headerRow
      )}
      {body}
      {toasts}
    </div>
  );
}
