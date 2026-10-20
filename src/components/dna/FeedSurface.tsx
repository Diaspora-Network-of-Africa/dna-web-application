// Feed (Home), SPEC v3 section 3. Expanded: the composer control (track-shaped), the greeting, then
// the LensBar and the list; the control and the LensBar pin together as one block once the greeting
// has left the column (ruling 104). Compact and medium: the LensBar then the list; the in-flow bar
// hides (keeping its height) while the header holds the compact LensBar past 72px. Read more expands
// the same PostCard in place at /posts/:id and Show less or back collapses it; a direct landing on
// /posts/:id renders the expanded card as page content with "Back to Feed" (ruling 105). Strict
// reverse-chronological posts through the one card router, three ghost cards while loading,
// EmptyState per lens, Save and React as existence toggles (rulings 80 to 86).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { Ghosts } from "@/components/dna/Ghosts";
import { PostCardRouter } from "@/components/dna/PostCardRouter";
import { Button } from "@/components/strand/Button";
import { CardFade } from "@/components/dna/CardFade";
import { LensSeat } from "@/components/dna/LensSeat";
import { EmptyState } from "@/components/strand/EmptyState";
import { Icon } from "@/components/strand/Icon";
import { IconButton } from "@/components/strand/IconButton";
import { Toast } from "@/components/strand/Toast";
import type { ComposerVerb } from "@/components/strand/cmeta";
import type { Member } from "@/lib/auth";
import { openComposer } from "@/lib/composer-store";
import { loadLatestComments } from "@/lib/comments";
import { loadFeed, loadMarks, loadPost, setSaved } from "@/lib/feed";
import { CommentThread, LatestCommentLine } from "./CommentThread";
import { useFeedReactions } from "./FeedReactions";
import type { FeedView } from "@/lib/feed-view";
import { setHeaderLens } from "@/lib/header-lens-store";
import { LENSES, lensSearch, parseLens, type LensId } from "@/lib/lens";
import type { Origin } from "@/lib/origin";
import type { PostView } from "@/lib/post-view";
import { useShellScroll } from "@/lib/shell-scroll";
import { record } from "@/lib/record";
import { useEmptyStateSeen, useRecordOnChange } from "@/lib/record-hooks";
import { useMode, useTier } from "@/lib/tier";
import { COMPOSER_HOST } from "./AppShell";

/** One share path and its toast. `shareUrl` hands a URL to the share sheet, or to the clipboard where
 *  there is none; `copyUrl` hands it to the clipboard. Each calls the browser before any await, so a
 *  caller that has its URL at the press stays inside the press. `share` is the Feed's: a post's
 *  address. Discovery hands over the event page's address through the other two (1140, G120). */
export function useShare() {
  const [toast, setToast] = useState<string | null>(null);
  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  };
  const shareUrl = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say("Link copied.");
    } catch {
      say(url);
    }
  };
  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied.");
    } catch {
      say(url);
    }
  };
  const share = (id: string) => shareUrl(window.location.origin + "/posts/" + id);
  return { share, shareUrl, copyUrl, toast };
}

export function toastStyle(tier: "compact" | "medium" | "expanded") {
  return {
    position: "fixed" as const,
    left: 0,
    right: 0,
    bottom:
      tier === "compact"
        ? "calc(76px + env(safe-area-inset-bottom))"
        : tier === "medium"
          ? "calc(80px + env(safe-area-inset-bottom))"
          : 24,
    display: "flex",
    justifyContent: "center",
    zIndex: 70,
    pointerEvents: "none" as const,
  };
}

function greetingFor(name: string, now: Date) {
  const hr = now.getHours();
  const first = name.split(/\s+/)[0] || name;
  const part = hr < 12 ? "Good morning, " : hr < 18 ? "Good afternoon, " : "Good evening, ";
  const today = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
  return { greeting: part + first + ".", today };
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FeedSurface({ member, view }: { member: Member; view: FeedView }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const tier = useTier();
  const expandedTier = tier === "expanded";
  const search = useSearch({ strict: false }) as { lens?: string; who?: string; comment?: string };
  const mode = useMode();
  const lens = parseLens(search.lens);
  const { share, toast: shareToast } = useShare();
  const { scrollerRef, scrolled } = useShellScroll();

  // Expanded: the composer control pins once the greeting has fully left the column's own viewport
  // (IntersectionObserver, root = the column, threshold 0). It releases only once the greeting
  // re-emerges beneath the pinned control (a second observer whose root is inset by the control's
  // measured height), so a lens change that lands the new list exactly beneath the pinned block
  // (ruling 109) leaves the greeting under the control without unpinning. Toggling only position,
  // ground and z-index (never the wrapper's size) keeps the boundary free of layout feedback.
  const greetRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const g = greetRef.current;
    const root = scrollerRef.current;
    if (!g || !root || !expandedTier) {
      setStuck(false);
      return;
    }
    const pillH = pillRef.current?.offsetHeight ?? 80;
    const leave = new IntersectionObserver(
      ([e]) => {
        if (e && !e.isIntersecting) setStuck(true);
      },
      { root, threshold: 0 },
    );
    const back = new IntersectionObserver(
      ([e]) => {
        if (e && e.isIntersecting) setStuck(false);
      },
      { root, threshold: 0, rootMargin: `-${pillH + 2}px 0px 0px 0px` },
    );
    leave.observe(g);
    back.observe(g);
    return () => {
      leave.disconnect();
      back.disconnect();
    };
  }, [expandedTier, scrollerRef, view.kind]);

  const listMode = view.kind !== "direct";
  const feed = useQuery({
    queryKey: ["feed", member.id, lens],
    queryFn: () => loadFeed(member, lens),
    enabled: listMode,
  });
  const posts = listMode ? feed.data : undefined;
  // 12C part 2: the Feed shows, and each lens change; a direct landing on /posts/:id is not the
  // Feed showing and records nothing. Keyed on the lens, so a refetch records nothing.
  useRecordOnChange("feed_viewed", listMode ? lens : null, { lens });
  useEmptyStateSeen("feed.lens_empty", !!posts && posts.length === 0);
  // In-place expansion needs the post in this list; otherwise the direct view carries it.
  const directId =
    view.kind === "direct"
      ? view.id
      : view.kind === "expanded" && posts && !posts.some((p) => p.id === view.id)
        ? view.id
        : null;
  const expandedId = view.kind === "expanded" && !directId ? view.id : null;
  const cached = directId
    ? qc
        .getQueriesData<PostView[]>({ queryKey: ["feed", member.id] })
        .flatMap(([, data]) => data ?? [])
        .find((p) => p.id === directId)
    : undefined;
  const single = useQuery({
    queryKey: ["post", member.id, directId ?? ""],
    queryFn: () => loadPost(member, directId ?? ""),
    enabled: !!directId,
    initialData: cached,
    staleTime: cached ? 30_000 : 0,
  });

  const ids = (directId ? [directId] : (posts ?? []).map((p) => p.id)).filter(
    (i): i is string => !!i,
  );
  const marks = useQuery({
    queryKey: ["marks", member.id, ids.join(",")],
    queryFn: () => loadMarks(member.id, ids),
    enabled: ids.length > 0,
  });
  const invalidateMarks = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["marks", member.id] }),
      qc.invalidateQueries({ queryKey: ["rails", member.id] }),
      lens === "saved" ? qc.invalidateQueries({ queryKey: ["feed", member.id, "saved"] }) : null,
    ]);
  const save = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setSaved(member.id, id, on),
    onSettled: () => void invalidateMarks(),
  });
  const [pending, setPending] = useState<Set<string>>(new Set());
  const savedOf = (id: string) =>
    pending.has(id) ? !marks.data?.saved.has(id) : !!marks.data?.saved.has(id);
  useEffect(() => {
    setPending(new Set());
  }, [marks.data]);
  const toggleSaved = (id: string) => {
    const on = !savedOf(id);
    setPending((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    save.mutate({ id, on });
  };
  // Handoff 62-A: the reaction layer, one summary read per page beside the marks (SPEC 5), the
  // bar and the prompt in `below`, the sheets and the live region as overlays.
  const shownPosts = [...(posts ?? []), ...(single.data ? [single.data] : [])];
  const reactions = useFeedReactions({ member, ids, posts: shownPosts, tier, mode });
  // Handoff 62-G (SPEC 8.3): the newest comment per post, one read per page beside the marks; the
  // collapsed card's `below` shows it as one line, and the expanded card shows the thread instead.
  const latest = useQuery({
    queryKey: ["comments", "latest", member.id, ids.join(",")],
    queryFn: () => loadLatestComments(ids),
    enabled: ids.length > 0,
  });
  // SPEC 10.2 (1802): an intent notification lands on the author's sheet at that tab, once; the
  // parameter leaves the address so a refresh does not reopen it.
  const openedWho = useRef<string | null>(null);
  useEffect(() => {
    const who = search.who;
    const id = view.kind === "direct" ? view.id : null;
    if (!who || !id || openedWho.current === id + ":" + who) return;
    if (!shownPosts.some((p) => p.id === id)) return;
    openedWho.current = id + ":" + who;
    reactions.openAuthorSheet(id, who);
    void navigate({
      to: "/posts/$id",
      params: { id },
      search: lensSearch(lens),
      replace: true,
      resetScroll: false,
    });
  });

  // Lens selection is a history entry (?lens=). Selecting from the pinned bar or the header slot
  // never moves the bar: on expanded the column scrolls so the first item of the new list sits
  // exactly beneath the pinned block, offset by the block's measured height (ruling 109); on compact
  // and medium the lens seat sets the scroller to the docking point so the header stays in lens
  // mode (1468, `holdLensDock`, the one function all three lens surfaces use).
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const setLens = (id: LensId) => {
    void navigate({ to: "/feed", search: lensSearch(id), resetScroll: false });
  };
  // Handoff 31-B item 4: the header's lens slot, which the shell read from the Feed's props until
  // Discovery became a second surface with one. Registered while the list shows (Feed and the
  // in-place expansion), never on the direct view, which is what the shell's `onFeed` meant.
  useEffect(() => {
    if (view.kind === "direct") {
      setHeaderLens(null);
      return;
    }
    setHeaderLens({
      lenses: LENSES,
      value: lens,
      onChange: (id: string) =>
        void navigate({ to: "/feed", search: lensSearch(id as LensId), resetScroll: false }),
    });
  }, [view.kind, lens, navigate]);
  useEffect(() => () => setHeaderLens(null), []);
  const placeRef = useRef<{ lens: LensId; stuck: boolean }>({ lens, stuck });
  placeRef.current.stuck = stuck;
  useIsoLayoutEffect(() => {
    if (placeRef.current.lens === lens) return;
    placeRef.current.lens = lens;
    const a = anchorRef.current;
    const sc = scrollerRef.current;
    const list = listRef.current;
    if (!a || !sc || !list || !expandedTier || !placeRef.current.stuck) return;
    // The block's extent is measured live: control wrapper plus the lens seat as pinned.
    const blockBottom = a.getBoundingClientRect().bottom - sc.getBoundingClientRect().top;
    sc.scrollTop = Math.max(0, Math.round(list.offsetTop - blockBottom));
  }, [lens, expandedTier, scrollerRef]);

  // H62-G1 (1905): the comment control lands on the card's comment section. It expands a collapsed
  // card as Read more does, and on an expanded card it lands again; the press count makes a second
  // press a new request. The thread does the landing once it has loaded. Read more and every other
  // opening clear it, so only the comment control lands.
  const [land, setLand] = useState<{ id: string; n: number } | null>(null);
  const landOn = (id: string) => setLand((l) => ({ id, n: (l?.n ?? 0) + 1 }));
  // Read more expands in place: a pushState to /posts/:id carrying fromFeed, scroll untouched.
  const openPost = (id: string) => {
    setLand(null);
    // 12C part 2: a post opened from its card, with the card's C and the post as the object.
    const c = posts?.find((p) => p.id === id)?.c_category;
    record("card_opened", c ? { card_c: c } : {}, { kind: "post", id });
    void navigate({
      to: "/posts/$id",
      params: { id },
      search: lensSearch(lens),
      resetScroll: false,
      state: { fromFeed: true },
    });
  };
  // Show less pops the entry the expansion pushed; a landing without that entry returns to Feed.
  const collapse = () => {
    if (view.kind === "expanded" && window.history.length > 1) router.history.back();
    else void navigate({ to: "/feed", search: lensSearch(lens), replace: true });
  };
  const goFeed = () => {
    const sc = scrollerRef.current;
    if (sc) sc.scrollTop = 0;
    void navigate({ to: "/feed", search: lensSearch(lens) });
  };
  useEffect(() => {
    if (!expandedId || !(view.kind === "expanded" && view.reveal)) return;
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-post-id="${CSS.escape(expandedId)}"]`,
    );
    card?.scrollIntoView({ block: "nearest" });
  }, [expandedId, view]);
  // 1065, 1067: the expanded card's Event hook opens the event page with the Feed as its origin, so
  // the page's Back row names Feed and goes back to this card. A modified or non-primary click is
  // the browser's.
  const openEvent = (e: MouseEvent<HTMLElement>, eventId: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const origin: Origin = { label: "Feed", to: "/feed", params: {}, search: lensSearch(lens) };
    void navigate({
      to: "/convene/events/$id",
      params: { id: eventId },
      search: {},
      resetScroll: false,
      state: { origin },
    });
  };
  const warmPost = (p: PostView) => {
    if (!expandedTier || !p.id) return;
    const id = p.id;
    void qc.prefetchQuery({
      queryKey: ["post", member.id, id],
      queryFn: () => loadPost(member, id),
      staleTime: 30_000,
    });
  };
  const compose = (verb: ComposerVerb) => openComposer({ host: COMPOSER_HOST, initialVerb: verb });
  const act = (c: ComposerVerb) => (
    <Button c={c} onClick={() => compose(c)}>
      Share a Story
    </Button>
  );
  const firstName = member.name.split(/\s+/)[0] || member.name;
  const empty =
    lens === "network"
      ? {
          c: "connect" as const,
          title: "Nobody in your network yet.",
          // Ruling 418: the action leaves the composer (ruling 400) and goes to Connect.
          body: "Posts from your connections appear here.",
          action: (
            <Button c="connect" onClick={() => void navigate({ to: "/connect", search: {} })}>
              Find people on Connect
            </Button>
          ),
        }
      : lens === "mine"
        ? {
            c: "convey" as const,
            title: "You have not posted yet.",
            body: "Start with what is going on with you.",
            action: act("convey"),
          }
        : lens === "saved"
          ? {
              c: "brand" as const,
              title: "Nothing saved yet.",
              body: "Use the bookmark on any post and find it here.",
              action: undefined,
            }
          : {
              c: "brand" as const,
              title: "Welcome to DNA, " + firstName + ".",
              body: "Feed fills as members post and as you connect. Start with what is going on with you.",
              action: act("convey"),
            };

  const { greeting, today } = greetingFor(member.name, new Date());
  const scope = LENSES.find((l) => l.id === lens)?.scope;
  const cardFor = (p: PostView, opts: { expanded: boolean; inPlace: boolean }) => {
    const id = p.id ?? "";
    const href = router.buildLocation({
      to: "/posts/$id",
      params: { id },
      search: lensSearch(lens),
    }).href;
    const rx = reactions.propsFor(p);
    const newest = latest.data?.get(id);
    // 62-G: the bar and the prompt first, then the thread on the expanded card or the newest comment
    // as one line on the collapsed card (SPEC 3, 8.3), all in PostCard's `below`.
    const below =
      rx.below || opts.expanded || newest ? (
        <>
          {rx.below}
          {opts.expanded ? (
            <CommentThread
              post={p}
              member={member}
              tier={tier}
              mode={mode}
              focusCommentId={search.comment ?? null}
              land={land?.id === id ? land.n : undefined}
              onClose={opts.inPlace ? collapse : undefined}
            />
          ) : newest ? (
            <LatestCommentLine
              comment={newest}
              member={member}
              mode={mode}
              onOpen={() => (opts.inPlace ? openPost(id) : undefined)}
            />
          ) : null}
        </>
      ) : null;
    return (
      <div key={id} data-post-id={id}>
        <PostCardRouter
          view={p}
          feed
          saved={savedOf(id)}
          onSave={() => toggleSaved(id)}
          {...rx}
          below={below}
          onAuthor={() => {
            if (p.author_handle)
              void navigate({ to: "/m/$handle", params: { handle: p.author_handle }, search: {} });
          }}
          onShare={() => void share(id)}
          onRespond={
            opts.expanded
              ? () => landOn(id)
              : opts.inPlace
                ? () => {
                    openPost(id);
                    landOn(id);
                  }
                : undefined
          }
          onClick={opts.inPlace ? () => openPost(id) : undefined}
          onAct={() => {
            if (p.c_category !== "system")
              void navigate({ to: "/$c", params: { c: p.c_category } });
          }}
          readMoreHref={opts.inPlace ? href : undefined}
          onReadMore={
            opts.inPlace
              ? (e) => {
                  const me = e as unknown as {
                    metaKey?: boolean;
                    ctrlKey?: boolean;
                    shiftKey?: boolean;
                  };
                  if (me.metaKey || me.ctrlKey || me.shiftKey) return;
                  e.preventDefault();
                  openPost(id);
                }
              : undefined
          }
          onReadMoreIntent={opts.inPlace ? () => warmPost(p) : undefined}
          onOpenEvent={openEvent}
          expanded={opts.expanded}
          onCollapse={opts.inPlace && opts.expanded ? collapse : undefined}
        />
      </div>
    );
  };

  // 1147 (handoff 33-D item 3): an empty lens fills the column. The root takes the visible height
  // the shell publishes, and the list and its empty wrapper carry it down, so EmptyState's
  // wallpaper runs to the column's edges and its block sits centred in what the member sees.
  const emptyLens = !directId && !!posts && posts.length === 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: emptyLens ? "var(--_shell-visible)" : undefined,
      }}
      data-feed
    >
      {directId ? (
        <div
          data-direct-post={directId}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: expandedTier ? 24 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              minHeight: 44,
              margin: "-8px 0 0 -10px",
            }}
          >
            <IconButton name="arrow-left" label="Back to Feed" onClick={goFeed} />
            <button
              type="button"
              onClick={goFeed}
              data-testid="back-to-feed"
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--ink)",
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Feed
            </button>
          </div>
          {single.data ? (
            cardFor(single.data, { expanded: true, inPlace: false })
          ) : single.isPending ? (
            <p role="status" style={{ margin: "8px 4px", color: "var(--ink-3)", fontSize: 15 }}>
              Loading
            </p>
          ) : (
            <p data-testid="post-missing" style={{ margin: "8px 4px", color: "var(--ink-2)" }}>
              This post is not available.
            </p>
          )}
        </div>
      ) : (
        <>
          {expandedTier && (
            <>
              <div
                ref={pillRef}
                data-compose-wrap
                data-stuck={stuck ? "1" : "0"}
                style={{
                  position: stuck ? "sticky" : "static",
                  top: 0,
                  zIndex: stuck ? 6 : undefined,
                  background: stuck ? "var(--bg)" : "transparent",
                  padding: "24px 0 12px",
                  marginBottom: -12,
                }}
              >
                <button
                  type="button"
                  onClick={() => openComposer({ host: COMPOSER_HOST })}
                  aria-label="Open the composer"
                  data-testid="compose"
                  style={{
                    all: "unset",
                    boxSizing: "border-box",
                    cursor: "text",
                    width: "100%",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 14px",
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--radius-m)",
                    color: "var(--ink-3)",
                    fontSize: 15,
                  }}
                >
                  <Icon name="pen-line" size={16} />
                  <span>What is going on with you?</span>
                </button>
              </div>
              <div
                ref={greetRef}
                data-greeting
                // Ruling 589: the greeting owns the clearance beneath it. The lens anchor below is
                // sticky with `padding: 12px 0; margin: -12px 0` and `boxShadow: 0 -12px 0 0
                // var(--bg)`, all of which satisfy 104 and do not change. The negative top margin
                // cancels this column's own `gap: 12` exactly (measured: the anchor's border box
                // begins on the greeting's bottom edge, not 12px above it), so the overlap is the
                // shadow alone: 12px of --bg painted over the greeting's bottom edge, of which the
                // block had only 4px of padding to give, and the date's descender row went under
                // it. 12 to clear the date's whole line box plus the 4 the block already had. Keyed
                // on the line box rather than the glyphs, so it holds for any display font metrics.
                style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0 16px" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: 26,
                    lineHeight: 1.2,
                  }}
                >
                  {greeting}
                </span>
                {/* B14 item 1 (W32): the greeting date is --ink-2, never --ink-3 and never a
                    literal, so it holds contrast on dark at every tier. */}
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{today}</span>
              </div>
            </>
          )}
          {/* Ruling 1466: the bar's spacing and position are the lens seat's, as on Connect and
              Convene; 1465: icon and word on every lens, each seat its own word's width, in a row
              that scrolls sideways at compact. At expanded the seat follows the greeting and pins
              under the composer once the greeting has left (109, 589). */}
          <LensSeat
            seatRef={anchorRef}
            follows="greeting"
            pinTop={stuck ? 80 : 0}
            stuck={expandedTier ? stuck : undefined}
            lenses={LENSES}
            value={lens}
            onChange={setLens}
            scope={scope}
            collapsed={expandedTier ? stuck : scrolled}
          />
          <div
            ref={listRef}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: emptyLens ? "1 1 auto" : undefined,
            }}
          >
            {posts === undefined && <Ghosts />}
            {posts && posts.length === 0 && (
              <div
                data-testid="feed-empty"
                data-lens={lens}
                style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}
              >
                <EmptyState
                  c={empty.c}
                  title={empty.title}
                  body={empty.body}
                  action={empty.action}
                />
              </div>
            )}
            {/* Rulings 489, 588: opacity alone across --fade-under-distance, measured from the
                card's bottom edge against the sticky bar's bottom edge, on --fade-under-ease.
                Nothing translates, nothing scales, and reduced motion holds it at 1. At expanded
                the bar is the column's own sticky block; below 1024 the header holds the lens bar
                past 72px, so the header is the edge. The anchor is sticky in both of its expanded
                states and its live bottom is correct in both, so the selector carries no
                [data-stuck] qualifier (ruling 588): with one, it failed to resolve until the
                greeting had left and bar.current() fell back to stickyBottom = 0, the top of the
                window rather than the bar. */}
            {posts &&
              posts.map((p) => (
                <CardFade
                  key={p.id}
                  stickySelector={expandedTier ? "[data-lens-anchor]" : "[data-app-header]"}
                  stickyBottom={0}
                  scroller={scrollerRef.current}
                >
                  {cardFor(p, { expanded: p.id === expandedId, inPlace: true })}
                </CardFade>
              ))}
          </div>
        </>
      )}
      {reactions.overlays}
      {(shareToast || reactions.toast) && (
        <div style={toastStyle(tier)}>
          <Toast>{shareToast ?? reactions.toast}</Toast>
        </div>
      )}
    </div>
  );
}
