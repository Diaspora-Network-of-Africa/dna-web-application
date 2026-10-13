// The one shell, mounted once at the app root by the _shell layout route (ruling 69): AppHeader as
// one row (five Cs inline plus the Home icon on expanded; composer entry or LensBar in the centre
// slot on compact and medium, rulings 99, 107), the dock on compact and medium (ruling 100), and the
// expanded canvas as three independent scroll containers (ruling 104). Matches B2-Shell-Feed-v3
// SPEC.md sections 1 and 2. The document never scrolls inside the shell: every tier scrolls its own
// Feed column, and the 72px header swap plus the 2.5s floating composer entry read that scroller.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { AppHeader, MessagesControl } from "@/components/strand/AppHeader";
import { Icon } from "@/components/strand/Icon";
import { PulseDock, type PulseState } from "@/components/strand/PulseDock";
import type { C } from "@/components/strand/cmeta";
import { LeftRail, RightRail } from "@/components/dna/Rails";
import { NotificationPanel } from "@/components/dna/NotificationPanel";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import type { Member } from "@/lib/auth";
import { openComposer, useComposerState } from "@/lib/composer-store";
import { isSettingsPath, type FeedView } from "@/lib/feed-view";
import { useHeaderLens } from "@/lib/header-lens-store";
import { connectPendingKey, connectRequestsPending } from "@/lib/notifications";
import { useMessengerInbox } from "@/lib/messenger-inbox";
import { useColumnPad, useLeftRail, useRightRail, useShellLayout } from "@/lib/rail-store";
import { ShellScrollProvider, useScrollState } from "@/lib/shell-scroll";
import { useTheme, useTier, useWide } from "@/lib/tier";

export const COMPOSER_HOST = "feed";

/** Popover chrome of the expanded notification list (SPEC section 6). The account panel that shared it
 *  is the Account drawer since handoff 61-S1 (src/components/dna/AccountDrawer.tsx). */
export const POPOVER_STYLE = {
  position: "fixed" as const,
  top: 60,
  right: 32,
  width: 380,
  maxHeight: 560,
  zIndex: 50,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  boxShadow: "var(--shadow-3)",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden",
  animation: "strand-fade var(--dur-default) var(--ease)",
};

const DRAG_OPEN_PX = 24;

export function AppShell({
  member,
  active,
  homeActive,
  feedView,
  closeKey,
  children,
}: {
  member: Member;
  /** The C whose route is showing; null on Feed (Home) and /posts/:id. */
  active: C | null;
  homeActive: boolean;
  /** What the Feed column shows; null on a C route. */
  feedView: FeedView | null;
  /** Changes on route change or composer open; open panels close (prototype behaviour). */
  closeKey: string;
  children: ReactNode;
}) {
  const tier = useTier();
  const wide = useWide();
  const navigate = useNavigate();
  const router = useRouter();
  // The stored or device theme is stamped on the document here, once per shell mount; the choice
  // itself moved to the Account drawer's Preferences (handoff 61-S1, 1381, 1393).
  useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  // Handoff 60-NC (1557, SPEC 6.4): `?notifications=email`, validated by the shell route, opens the
  // panel on its email view once; the panel calls back when it has, and the parameter is replaced
  // away so a reload or a Back does not open it again.
  const notificationsTo = useLocation({
    select: (l) =>
      (l.search as { notifications?: unknown }).notifications === "email" ? "email" : undefined,
  });
  const clearNotificationsTo = useCallback(() => {
    const loc = router.state.location;
    const rest = { ...(loc.search as Record<string, unknown>) };
    delete rest["notifications"];
    router.history.replace(
      loc.pathname + router.options.stringifySearch(rest) + (loc.hash ? "#" + loc.hash : ""),
    );
  }, [router]);
  const composer = useComposerState();
  const leftRail = useLeftRail();
  const rightRail = useRightRail();
  // Brief 4: a surface may ask for the content column's own padding (Connect's 0/24/48, SPEC 2).
  // It asked for a --bg-sunken ground with it until ruling 590 revoked 181; the column now keeps
  // the shell's own ground on every surface, so nothing here paints one.
  const inset = useColumnPad() === "inset";
  const expanded = tier === "expanded";
  const compact = tier === "compact";
  // Handoff 31-B item 4: a surface's named layout mode. `lanes` replaces the Feed's centred track
  // with a full-width top row over independent columns at medium and expanded; compact is one
  // column in every mode, so the mode does not reach the grid there.
  const layout = useShellLayout();
  const lanes = layout?.mode === "lanes" && !compact;
  // Brief 14 (1368, 1047): the Messenger's canvas mode, see src/lib/rail-store.ts.
  const canvas = layout?.mode === "canvas";
  // Brief 14 (1334, 1344): the inbox for the life of the session and the Messages control's dot.
  const inbox = useMessengerInbox(member);
  // 1481, 1522: Connect's slot carries the for-you dot while a request arrived after the member last
  // opened My Network. One read on the bell's interval feeds the header's row and the dock alike;
  // nothing else in either is a state, so the dot is all they carry.
  const connectPending = useQuery({
    queryKey: connectPendingKey(member.id),
    queryFn: connectRequestsPending,
    refetchInterval: 60_000,
  });
  const cStates: Partial<Record<C, PulseState>> | undefined =
    connectPending.data === true ? { connect: "for-you" } : undefined;
  const registeredLens = useHeaderLens();
  const scrollerRef = useRef<HTMLElement | null>(null);
  // A stable ref callback: an inline one is detached (null) during every commit and re-attached
  // after the children's layout effects, which would leave the Feed's placement effect without
  // its scroller on a lens change.
  const attachScroller = useCallback((el: HTMLElement | null) => {
    scrollerRef.current = el;
  }, []);
  const { scrolled, moving, onScroll, scrollToTop } = useScrollState(scrollerRef);
  // W58 (ruling 465) has two halves and this is the second one. The first is the cause and it is
  // fixed in src/router.tsx: the router was carrying the outgoing location's scroller position onto
  // the incoming one. The second is the order. The router applies its scroll work from an
  // onRendered subscription, which can land after a child's mount effect has already measured, and
  // ProfileSurface's condense effect measures scrollTop on mount (ruling 134). A measurement that
  // reads the outgoing surface's offset condenses the masthead before the scroll is corrected, and
  // that is the race three findings hit on WebKit this week.
  //
  // So the position is settled here, in a layout effect: after the new surface has committed and
  // before any passive effect can read scrollTop. scrollToTop also re-derives `scrolled` and
  // `moving` from 0, so the header does not keep the outgoing surface's swapped state. A back
  // navigation still restores its saved position, because the router's restore runs after this.
  //
  // Feed and /posts/:id are one surface (ruling 105): expanding a card in place keeps the column's
  // position, and a lens change keeps the same pathname, so neither resets. A surface in a named
  // layout carries its own key (handoff 31-B): Discovery's pane opening over its lanes changes the
  // pathname and keeps the key, so the lanes stay where the member left them (688). The key names
  // the surface, never its lens (ruling 1468, W74): a lens change is not a surface change, so it
  // never reaches this reset, and where the bar is held in the header the seat keeps it there
  // (`holdLensDock`, src/components/dna/LensSeat.tsx). The other reader of the key is
  // `clearShellLayout` in src/lib/rail-store.ts, which the Messenger's two keys alone call.
  const pathname = useLocation({ select: (l) => l.pathname });
  const surface = feedView ? "feed" : layout ? "layout:" + layout.key : pathname;
  const onMessages = pathname === "/messages" || pathname.startsWith("/messages/");
  // Ruling 1624 (W92; EXTRACTION-44-W68, 1458): below expanded the Messenger carries no app header.
  // The list's own title row and search sit on the top inset and the thread bar is the route's only
  // chrome; the dock stays on the list and on no thread (1368), which the canvas layout already
  // decides. At expanded the header and the Pane are unchanged.
  const bareMessenger = onMessages && !expanded;
  useLayoutEffect(() => {
    scrollToTop();
  }, [surface, scrollToTop]);
  // 1147 (correction 31; handoff 33-D item 3): a surface's empty column fills the visible height of
  // this column, from the top of main's content box to the column's visible foot. The foot is the
  // fixed dock's top edge below expanded and the scroller's own bottom at expanded; in the lanes
  // canvas it is the canvas foot, the scroller's bottom padding (B9-SPEC's 24 at expanded, the
  // dock's clearance at medium). The shell measures it rather than stating it in a calc, because
  // the header's height under a top inset and the dock's overlap are layout facts of its own
  // elements, and publishes it on main as --_shell-visible, in px, for a surface root to take as
  // its min-height. EmptyState itself never reads the viewport (1147).
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const host = sc.tagName === "MAIN" ? sc : sc.querySelector<HTMLElement>(":scope > main");
    if (!host) return;
    const measure = () => {
      const box = sc.getBoundingClientRect();
      const top =
        box.top +
        (host === sc ? 0 : host.offsetTop) +
        parseFloat(getComputedStyle(host).paddingTop);
      let foot = box.bottom - (lanes ? parseFloat(getComputedStyle(sc).paddingBottom) || 0 : 0);
      const dock = document.querySelector<HTMLElement>('[data-pulse="dock"]');
      if (dock && getComputedStyle(dock).position === "fixed")
        foot = Math.min(foot, dock.getBoundingClientRect().top);
      host.style.setProperty("--_shell-visible", Math.max(0, foot - top) + "px");
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tier, lanes, inset, canvas]);
  // Proof the shell mounted once: the stamp is set on mount and never changes across routes.
  const mounted = useRef<string>("");
  if (!mounted.current) mounted.current = String(Date.now());
  useEffect(() => {
    document.documentElement.setAttribute("data-shell", mounted.current);
  }, []);
  // Ruling 1457: iOS scrolls the window, not the shell's scroller, to keep a focused field above
  // the keyboard, and the document never scrolls inside the shell (104), so nothing scrolls it
  // back. When the keyboard closes, a window left scrolled is returned to the origin, on every
  // route. Rechecked a frame later, because the window can settle after visualViewport's resize.
  const keyboard = useKeyboardHeight(true);
  const keyboardWasUp = useRef(false);
  useEffect(() => {
    if (keyboard > 0) {
      keyboardWasUp.current = true;
      return;
    }
    if (!keyboardWasUp.current) return;
    keyboardWasUp.current = false;
    const reset = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [keyboard]);
  // Handoff 61-S1 (1656): the avatar opens the Account drawer at /settings, one control, replacing
  // the account dialog this shell drew. The drawer is the /settings route's, over the Feed.
  const onSettings = isSettingsPath(pathname);
  const openAccount = () => {
    if (onSettings) return;
    void navigate({ to: "/settings" });
  };

  const go = (c: C) => {
    void navigate({ to: "/$c", params: { c } });
  };
  const warm = (c: C) => void router.preloadRoute({ to: "/$c", params: { c } });
  const homeHref = router.buildLocation({ to: "/feed", search: {} }).href;
  const goHome = () => {
    scrollToTop();
    void navigate({ to: "/feed", search: {} });
  };
  const compose = () => {
    openComposer({ host: COMPOSER_HOST });
  };

  // The floating composer entry (ruling 107): mounted on Feed while nothing sits over it; shown while
  // the member is scrolling past 72px and for 2.5s after the last scroll event. Tap or a 24px drag
  // (up on compact, left on medium) opens the composer.
  const onFeed = feedView?.kind === "feed" || feedView?.kind === "expanded";
  const fabMount = !expanded && onFeed && !composer.open && !notifOpen;
  const fabShown = fabMount && moving;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const tabDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const tabMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.x - e.clientX > DRAG_OPEN_PX || d.y - e.clientY > DRAG_OPEN_PX) {
      drag.current = null;
      compose();
    }
  };
  const tabEnd = () => {
    drag.current = null;
  };

  // Rulings 107 and 947: below expanded, past 72px of the shell's scroller, the header takes the
  // lens bar of whichever surface registered one (src/lib/header-lens-store.ts). The Feed, Connect
  // (1467) and Discovery register; every other surface keeps the composer entry.
  const headerLens = !expanded && scrolled ? registeredLens : null;
  const bottomPad = compact
    ? "calc(112px + env(safe-area-inset-bottom))"
    : "calc(96px + env(safe-area-inset-bottom))";
  /** H60-MEDIA-2: the expanded Feed column's clearance between a card and its scroller's edge. */
  const FEED_EDGE = 16;
  const feedEdge = feedView && !inset ? FEED_EDGE : 0;
  // Scroll anchoring is off on every column: the pinned block toggles position on the greeting's
  // visibility, and Chrome's anchoring would otherwise walk scrollTop back across the threshold.
  const column = {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
    overflowAnchor: "none" as const,
    position: "relative" as const,
  };

  return (
    <ShellScrollProvider value={{ scrollerRef, scrolled, moving, scrollToTop }}>
      <div
        data-tier={tier}
        data-scrolled={scrolled ? "1" : "0"}
        data-moving={moving ? "1" : "0"}
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--ink)",
        }}
      >
        {!bareMessenger && (
          <AppHeader
            variant={expanded ? "expanded" : "compact"}
            tier={tier}
            homeActive={homeActive}
            homeHref={homeHref}
            onHome={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              goHome();
            }}
            onHomeIntent={() => void router.preloadRoute({ to: "/feed", search: {} })}
            member={{ name: member.name, src: member.avatar }}
            onCompose={compose}
            onAvatar={openAccount}
            avatarActive={onSettings}
            cActive={active}
            cStates={cStates}
            onSelectC={go}
            onIntentC={warm}
            lensBar={headerLens}
            messages={
              <MessagesControl
                unread={inbox.unread}
                active={onMessages}
                onClick={() => void navigate({ to: "/messages" })}
              />
            }
            // 1123: on Discovery (the `lanes` layout) at expanded the header's row takes the canvas's
            // edges, 5% of the viewport each side with no maximum; every other surface keeps 1440.
            maxWidth={lanes && expanded ? "none" : undefined}
            style={{
              // Ruling 344: the safe-area insets live here and on the dock, once. viewport-fit=cover
              // is declared in the root route's head, so on a notched phone the header's row starts
              // below the status bar and, in landscape, clear of the notch on either side.
              paddingTop: "env(safe-area-inset-top)",
              paddingLeft: `calc(${lanes && expanded ? "5vw" : expanded ? "32px" : "16px"} + env(safe-area-inset-left))`,
              paddingRight: `calc(${lanes && expanded ? "5vw" : expanded ? "32px" : "8px"} + env(safe-area-inset-right))`,
              height: "auto",
              minHeight: expanded ? 64 : 56,
              zIndex: 20,
            }}
          >
            <NotificationPanel
              member={member}
              tier={tier}
              onChange={setNotifOpen}
              closeKey={closeKey}
              openTo={notificationsTo}
              onOpenedTo={clearNotificationsTo}
            />
          </AppHeader>
        )}
        {canvas && layout ? (
          <div
            data-canvas
            data-layout="canvas"
            style={
              expanded
                ? {
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    maxWidth: layout.maxWidth ?? 1120,
                    margin: "0 auto",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    padding: "24px 32px",
                    overflow: "hidden",
                  }
                : {
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }
            }
          >
            {/* main stays the second child of the root in every grid (handoff 31-B). */}
            {null}
            <main
              ref={attachScroller}
              data-scroller="feed"
              onScroll={onScroll}
              style={{
                ...column,
                overflowY: "hidden",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: 0,
              }}
            >
              {children}
            </main>
          </div>
        ) : lanes && layout && layout.mode === "lanes" ? (
          <div
            data-canvas
            data-layout={layout.mode}
            data-rail={layout.rail}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              boxSizing: "border-box",
              display: "grid",
              // B9-SPEC's tiers (1082 as amended by 1094): the rail 240 open at medium and 280 at
              // expanded, 64 collapsed (687, 725); the lanes take the rest; the 320 right column
              // only at 1440 and only while the surface gives it content, so the pane (612)
              // removes the column rather than blanking it. Discovery gives it none (1094).
              gridTemplateColumns:
                (layout.rail === "collapsed" ? "64px" : expanded ? "280px" : "240px") +
                " minmax(0, 1fr)" +
                (wide && rightRail ? " 320px" : ""),
              gridTemplateRows: "auto minmax(0, 1fr)",
              columnGap: 24,
              // B9-SPEC's expanded line as 1123 rules it: at expanded the canvas has no maximum width and a
              // gutter of 5% of the viewport each side; medium keeps its medium line's 32.
              padding: expanded ? "0 5vw" : "0 32px",
              overflow: "hidden",
            }}
          >
            {/* Ruling 946: the lens bar is its own full-width row above the columns. It precedes
                main in the DOM, as the bar precedes the list on every lens surface, and it takes
                the first child slot the other grids leave empty, so main is the second child of
                the root in every grid and the route beneath it is never remounted by a switch.
                The space above the bar is the lens seat's own (1466, LensSeatRow); the row keeps
                only its 16 above the columns. */}
            <div
              data-layout-top
              style={{ gridColumn: "1 / -1", gridRow: 1, minWidth: 0, padding: "0 0 16px" }}
            >
              {layout.top}
            </div>
            <main
              ref={attachScroller}
              data-scroller="feed"
              onScroll={onScroll}
              style={{
                ...column,
                gridColumn: 2,
                gridRow: 2,
                display: "flex",
                flexDirection: "column",
                // B9-SPEC's expanded line: the canvas's 24 at the foot at expanded. Below it the column
                // keeps the shell's clearance of the fixed Pulse dock, which is 65 tall at medium,
                // where the medium line's 64 would put the last row's edge beneath it.
                padding: "0 0 " + (expanded ? "24px" : bottomPad),
              }}
            >
              {children}
            </main>
            {/* Ruling 945: the rail scrolls on its own. In this mode a slot with no label renders
                its content with no landmark of its own, because the content names itself (the
                FacetRail is nav[aria-label=Filters]) and a second landmark of the same name would
                be announced twice. */}
            {leftRail?.label ? (
              <aside
                aria-label={leftRail.label}
                data-scroller="left"
                style={{
                  ...column,
                  gridColumn: 1,
                  gridRow: 2,
                  padding: "0 0 " + (expanded ? "48px" : bottomPad),
                }}
              >
                {leftRail.node}
              </aside>
            ) : (
              // Block, not flex: a rail part sized for a row (FacetRail's `alignSelf: flex-start`)
              // takes the column's width here rather than shrinking to its own content.
              <div
                data-scroller="left"
                style={{
                  ...column,
                  gridColumn: 1,
                  gridRow: 2,
                  padding: "0 0 " + (expanded ? "48px" : bottomPad),
                }}
              >
                {leftRail?.node}
              </div>
            )}
            {wide && rightRail && (
              <div
                data-scroller="right"
                role={rightRail.label ? "complementary" : undefined}
                aria-label={rightRail.label ?? undefined}
                style={{
                  ...column,
                  gridColumn: 3,
                  gridRow: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  padding: "0 0 48px",
                }}
              >
                {rightRail.node}
              </div>
            )}
          </div>
        ) : expanded ? (
          <div
            data-canvas
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              maxWidth: 1440,
              margin: "0 auto",
              boxSizing: "border-box",
              display: "grid",
              // H60-MEDIA-2 Work 2: the column's 680 minimum yields where the canvas cannot hold it
              // beside the rail and the gap (1025 to 1027, where it overran the content box by up to
              // 3), rather than spilling into the padding the canvas clips at. From 1440 the three
              // tracks always fit.
              gridTemplateColumns: wide
                ? "260px minmax(680px, 760px) 320px"
                : "260px minmax(min(680px, 100% - 284px), 760px)",
              gap: 24,
              justifyContent: "center",
              alignItems: "stretch",
              padding: "0 32px",
              overflow: "hidden",
            }}
          >
            {/* The `lanes` grid's top row holds this slot (handoff 31-B). Every grid keeps main as
                the second child of the same root element, so a surface that switches the shell
                into or out of a named layout is reconciled in place and never remounted. */}
            {null}
            {/* main precedes both rails in the DOM (ruling 174); grid placement puts the rails in
                columns 1 and 3, so keyboard order reaches the content before any rail control. */}
            <main
              ref={attachScroller}
              data-scroller="feed"
              onScroll={onScroll}
              style={{
                ...column,
                gridColumn: 2,
                gridRow: 1,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                // No top padding of its own: the composer control's wrapper carries it (SPEC 3.0).
                // The bottom pad keeps a short list able to hold the pinned block's scroll position.
                // An inset surface (Connect) carries its own padding: 0 24 48 (Connect SPEC 2).
                // H60-MEDIA-2 Work 2: on the Feed the scroller runs FEED_EDGE into the gaps either side
                // and pads it back, so a card keeps its width and its border stands clear of the
                // scroller's edge, where the Mac's overlay scrollbar draws while the column scrolls.
                // Flush, the card's right border was under it after any scroll at every expanded
                // width. Other surfaces on this grid (Profile measures its own bleed) are unchanged.
                margin: feedEdge ? "0 -" + feedEdge + "px" : undefined,
                padding: inset ? "0 24px 48px" : "0 " + feedEdge + "px calc(100dvh - 240px)",
              }}
            >
              {children}
            </main>
            {leftRail && leftRail.label === null ? (
              // An empty rail renders no landmark (ruling 170): the column stays reserved.
              <div data-scroller="left" style={{ ...column, gridColumn: 1, gridRow: 1 }} />
            ) : (
              <aside
                aria-label={leftRail?.label ?? "Your quick state"}
                data-scroller="left"
                style={{
                  ...column,
                  gridColumn: 1,
                  gridRow: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  padding: "24px 0 48px",
                }}
              >
                {leftRail ? leftRail.node : <LeftRail member={member} />}
              </aside>
            )}
            {wide &&
              (rightRail && rightRail.label === null ? (
                <div data-scroller="right" style={{ ...column, gridColumn: 3, gridRow: 1 }} />
              ) : (
                <aside
                  aria-label={rightRail?.label ?? "DIA suggests"}
                  data-scroller="right"
                  style={{
                    ...column,
                    gridColumn: 3,
                    gridRow: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                    padding: "24px 0 48px",
                  }}
                >
                  {rightRail ? rightRail.node : <RightRail />}
                </aside>
              ))}
          </div>
        ) : (
          <div
            ref={attachScroller}
            data-scroller="feed"
            onScroll={onScroll}
            style={{
              ...column,
              flex: 1,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* The `lanes` grid's top row slot: main stays the second child in every grid. */}
            {null}
            <main
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: compact ? `12px 16px ${bottomPad}` : `24px 32px ${bottomPad}`,
                maxWidth: 680,
                margin: "0 auto",
                width: "100%",
                boxSizing: "border-box",
                // Viewport plus 40 so a short list can still hold the header's lens position (SPEC 1).
                minHeight: "calc(100dvh + 40px)",
              }}
            >
              {children}
            </main>
          </div>
        )}
        {!expanded && !canvas && (
          <PulseDock
            fixed
            active={active ?? undefined}
            states={cStates}
            onSelect={go}
            // Longhands, not the shorthand: the shorthand used to wipe the dock's own safe-area
            // bottom padding on the medium tier (ruling 344).
            style={
              compact
                ? undefined
                : {
                    paddingLeft: "calc(120px + env(safe-area-inset-left))",
                    paddingRight: "calc(120px + env(safe-area-inset-right))",
                  }
            }
          />
        )}
        {fabMount && (
          <div
            aria-hidden={!fabShown}
            data-fab={compact ? "handle" : "tab"}
            data-shown={fabShown ? "1" : "0"}
            style={
              compact
                ? {
                    position: "fixed",
                    left: "50%",
                    marginLeft: -32,
                    bottom: "calc(65px + env(safe-area-inset-bottom, 0px))",
                    width: 64,
                    height: 30,
                    overflow: "hidden",
                    zIndex: 15,
                    pointerEvents: fabShown ? "auto" : "none",
                  }
                : {
                    position: "fixed",
                    right: 0,
                    top: "50%",
                    marginTop: -28,
                    width: 32,
                    height: 56,
                    overflow: "hidden",
                    zIndex: 30,
                    pointerEvents: fabShown ? "auto" : "none",
                  }
            }
          >
            <button
              type="button"
              onClick={compose}
              onPointerDown={tabDown}
              onPointerMove={tabMove}
              onPointerUp={tabEnd}
              onPointerCancel={tabEnd}
              aria-label="Open the composer"
              tabIndex={fabShown ? 0 : -1}
              data-testid="compose-floating"
              style={
                compact
                  ? {
                      appearance: "none",
                      border: 0,
                      // One shorthand, never the shorthand plus a longhand for the same value:
                      // useTier starts compact, so on any viewport at 640 and above this element
                      // rerenders from this branch to the other one, and React warns when the two
                      // forms swap. The 6 is the same 6 paddingTop carried.
                      padding: "6px 0 0",
                      margin: 0,
                      font: "inherit",
                      cursor: "pointer",
                      touchAction: "none",
                      width: 64,
                      height: 30,
                      borderRadius: "var(--radius-m) var(--radius-m) 0 0",
                      background: "var(--c-connect)",
                      color: "var(--c-connect-ink)",
                      display: "inline-flex",
                      alignItems: "flex-start",
                      boxSizing: "border-box",
                      justifyContent: "center",
                      transform: fabShown ? "translateY(0)" : "translateY(30px)",
                      transition: "transform var(--dur-default) var(--ease)",
                    }
                  : {
                      appearance: "none",
                      border: 0,
                      padding: 0,
                      margin: 0,
                      font: "inherit",
                      cursor: "pointer",
                      touchAction: "none",
                      width: 32,
                      height: 56,
                      borderRadius: "var(--radius-m) 0 0 var(--radius-m)",
                      background: "var(--c-connect)",
                      color: "var(--c-connect-ink)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "var(--shadow-2)",
                      opacity: 0.92,
                      transform: fabShown ? "translateX(0)" : "translateX(40px)",
                      transition: "transform var(--dur-default) var(--ease)",
                    }
              }
            >
              <Icon name="pen-line" size={18} />
            </button>
          </div>
        )}
      </div>
    </ShellScrollProvider>
  );
}
