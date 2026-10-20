// The Overview: the CEO weekly review, read the same way every time (Brief 12 12B, handoff 45-B
// Part C; SPEC-40-12B Part C; EXTRACTION-40-12B as amended by R2, which wins where they disagree).
// The console's index route, rendered inside ConsoleShell with current="overview". It reads the
// five projections in parallel on every grain and comparison change and renders each block from its
// own result, so one failing projection shows its cards in MeasureCard's error state with Try again
// while the rest render. Every sentence is written in admin/src/lib/overview.ts from the
// projections' structured values; no figure renders without a value behind it: a null with
// not_connected renders the part's not-connected state, a zero where the extraction gives an empty
// sentence renders that sentence (grounded-or-empty). DIA's note arrives from the admin-dia-note Edge
// Function after the page has rendered and never holds it up (Part D item 4).
//
// Handoff 45-D (1394, 1411, 1382, 1391): every projection and DIA's note are read in the company
// reporting zone from the Organization settings, so the week is the company's for everyone; a
// staff member's own reading zone moves only the clock times, and the window line then says so in
// the extraction's sentence (45-12S §2f). The page opens on the person's default grain and
// comparison, whose options are the vocabularies (1392). With DIA's note off for the company the
// note block is not rendered and the function is not called. The page waits on the console's
// Settings read; if it fails, the window's error state offers Try again.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BarList, type BarListRow } from "@/components/strand/BarList";
import { DataTable } from "@/components/strand/DataTable";
import { DiaNote, type DiaStatement } from "@/components/strand/DiaNote";
import { MeasureCard, type MeasureCardProps } from "@/components/strand/MeasureCard";
import { Segment } from "@/components/strand/Segment";
import { StackedBars } from "@/components/strand/StackedBars";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { useMode, useTier } from "@/lib/tier";
import { joinNames } from "@/lib/names";
import { ADMIN_COPY, ONBOARDING_COPY, SETTINGS_COPY } from "../../lib/copy";
import { useConsole } from "../../lib/console";
import { zoneShortById } from "../../lib/settings";
import {
  DIRECTION_LABELS,
  ONBOARDING_STEPS,
  SIDE_LABELS,
  SOURCE_LABELS,
  changeWords,
  fmt,
  moment,
  readDiaNote,
  readProjection,
  refreshLine,
  trendOf,
  windowWords,
  type Compare,
  type DiaStatementWire,
  type Grain,
  type ReadKey,
  type Reads,
  type WindowWords,
} from "../../lib/overview";

export const Route = createFileRoute("/_console/")({ component: Overview });

const LOADING: Reads = {
  window: { status: "loading" },
  mobilization: { status: "loading" },
  levers: { status: "loading" },
  network: { status: "loading" },
  company: { status: "loading" },
};
const KEYS: ReadKey[] = ["window", "mobilization", "levers", "network", "company"];

const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2
    id={id}
    style={{
      margin: 0,
      fontFamily: "var(--font-display)",
      fontWeight: 600,
      fontSize: 26,
      lineHeight: 1.2,
    }}
  >
    {children}
  </h2>
);
const Caps = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      fontSize: 13,
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--ink-3)",
    }}
  >
    {children}
  </span>
);
const Lead = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{children}</span>
);
const Grid = ({ cols, children }: { cols: string; children: ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>{children}</div>
);

type Block = "mobilization" | "levers" | "network" | "company";
const BLOCK_WORD: Record<Block, string> = {
  mobilization: "mobilization",
  levers: "levers",
  network: "network",
  company: "company lines",
};

function Overview() {
  const { settings, reloadSettings, overview } = useConsole();
  // A role the projections refuse never reads one (45-E item 4). The gate sends it to Settings, but
  // the router's location moves before its matches, so this page can be rendered for a moment on
  // the way there; it renders nothing, and reads nothing, for that moment.
  if (!overview) return null;
  if (settings.status === "ready")
    return (
      <OverviewPage
        companyZone={settings.org.reporting_zone}
        readingZone={settings.staff.reading_zone}
        defaultGrain={settings.staff.default_grain as Grain}
        defaultCompare={settings.staff.default_compare as Compare}
        diaNote={settings.org.dia_note}
      />
    );
  return (
    <div
      data-testid="admin-overview"
      data-settings={settings.status}
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "24px 16px 64px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {settings.status === "failed" ? (
          <MeasureCard
            label="Window"
            state="error"
            errorTitle="The window could not load."
            errorText={ADMIN_COPY.failure}
            onRetry={reloadSettings}
          />
        ) : (
          <span aria-busy="true" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Reading the period…
          </span>
        )}
      </div>
    </div>
  );
}

function OverviewPage({
  companyZone,
  readingZone,
  defaultGrain,
  defaultCompare,
  diaNote,
}: {
  companyZone: string;
  readingZone: string | null;
  defaultGrain: Grain;
  defaultCompare: Compare;
  diaNote: boolean;
}) {
  const { session } = useAuth();
  const { vocab } = useConsole();
  const [grain, setGrain] = useState<Grain>(defaultGrain);
  const [compare, setCompare] = useState<Compare>(defaultCompare);
  // Days and weeks in the company zone (1394); clock times in the reading zone (1411).
  const tz = companyZone;
  const clockTz = readingZone ?? companyZone;
  const grainOptions = vocab && Array.isArray(vocab.overview_grains) ? vocab.overview_grains : [];
  const compareOptions =
    vocab && Array.isArray(vocab.overview_comparisons) ? vocab.overview_comparisons : [];
  const zones = vocab && Array.isArray(vocab.reporting_zones) ? vocab.reporting_zones : [];
  const tier = useTier();
  const mode = useMode();
  const touch = mode === "touch";
  const compact = tier === "compact",
    expanded = tier === "expanded";
  const [reads, setReads] = useState<Reads>(LOADING);
  const [dia, setDia] = useState<{ loading: boolean; statements: DiaStatementWire[] }>({
    loading: diaNote,
    statements: [],
  });
  const run = useRef(0);
  const token = session?.access_token ?? null;

  const scroller = useRef<HTMLDivElement | null>(null);
  const refs = {
    mob: useRef<HTMLElement | null>(null),
    corr: useRef<HTMLDivElement | null>(null),
    lev: useRef<HTMLElement | null>(null),
    net: useRef<HTMLElement | null>(null),
    co: useRef<HTMLElement | null>(null),
  };

  // One read per projection; a later grain or comparison supersedes an earlier read by run id.
  const readOne = useCallback(
    (key: ReadKey, id: number) => {
      const sb = getSupabase();
      if (!sb) return;
      void readProjection(sb, key, grain, compare, tz).then((r) => {
        if (run.current !== id) return;
        setReads((prev) => ({ ...prev, [key]: r }));
      });
    },
    [grain, compare, tz],
  );

  useEffect(() => {
    if (!token) return;
    const id = ++run.current;
    setReads(LOADING);
    for (const k of KEYS) readOne(k, id);
    // DIA's note off for the company: no block and no call (1391).
    if (!diaNote) return;
    setDia({ loading: true, statements: [] });
    const sb = getSupabase();
    if (!sb) return;
    const ctl = new AbortController();
    void readDiaNote(sb, grain, compare, tz, ctl.signal).then((statements) => {
      if (run.current !== id) return;
      setDia({ loading: false, statements });
    });
    return () => ctl.abort();
  }, [token, grain, compare, tz, readOne, diaNote]);

  const retry = (key: ReadKey) => {
    setReads((prev) => ({ ...prev, [key]: { status: "loading" } }));
    readOne(key, run.current);
  };

  // The window's words come from the window projection, or from any projection that carries the
  // same window when that one failed, so the cards still name their period.
  const windowPart =
    reads.window.status === "ready"
      ? reads.window.data
      : reads.mobilization.status === "ready"
        ? reads.mobilization.data
        : reads.levers.status === "ready"
          ? reads.levers.data
          : null;
  const words: WindowWords | null = windowPart ? windowWords(windowPart, clockTz) : null;
  const winShort = words?.short ?? "";
  const hasCmp = words?.hasComparison ?? false;
  const loading = (k: ReadKey) => reads[k].status === "loading";
  const failed = (k: ReadKey) => reads[k].status === "failed";

  const onGo = (block: string) => {
    const m = scroller.current;
    const target =
      block === "By corridor"
        ? refs.corr.current
        : block === "The levers"
          ? refs.lev.current
          : block === "The network"
            ? refs.net.current
            : block === "Company lines"
              ? refs.co.current
              : refs.mob.current;
    if (!m || !target) return;
    const top =
      target.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 16;
    m.scrollTo({ top, behavior: "smooth" });
  };

  /** Props every card in a block shares in its loading and error states. */
  const stateOf = (block: Block, label: string): Partial<MeasureCardProps> => {
    const key: ReadKey = block;
    if (loading(key)) return { state: "loading" };
    if (failed(key))
      return {
        state: "error",
        errorTitle: `${label} could not load.`,
        errorText: `The ${BLOCK_WORD[block]} projection did not answer. The rest of the page is current.`,
        onRetry: () => retry(key),
      };
    return { state: "data" };
  };

  // ---------------------------------------------------------------------------------------------
  // 2. Mobilization
  // ---------------------------------------------------------------------------------------------
  const mob = reads.mobilization.status === "ready" ? reads.mobilization.data : null;
  const isPartial = !!mob && mob.source.some((s) => s.status === "not_connected");
  const mobEmpty = !!mob && mob.acts === 0;
  const depthEngaging = mob ? mob.depth.points.map((p) => p.engaging) : [];
  const depthLeading = mob ? mob.depth.points.map((p) => p.leading) : [];
  const depthNotYet: BarListRow[] = [
    { id: "collab", label: "Collaborating", value: null, note: "Not yet measurable" },
    { id: "contrib", label: "Contributing", value: null, note: "Not yet measurable" },
  ];
  const directions: BarListRow[] = (mob?.direction ?? []).map((d) => ({
    id: d.key,
    label: DIRECTION_LABELS[d.key] ?? d.key,
    value: d.value,
  }));
  const sourceMax = Math.max(1, ...(mob?.source ?? []).map((s) => s.value ?? 0));
  const sources: BarListRow[] = (mob?.source ?? []).map((s) => ({
    id: s.key,
    label: SOURCE_LABELS[s.key] ?? s.key,
    value: s.status === "connected" ? s.value : null,
    note: "Not yet connected",
    max: sourceMax,
  }));
  const sourceLine = isPartial
    ? "Partner confirmations arrive with the Relationships console. DNA system confirmations arrive with Convene check-in and EDLMS milestones."
    : "Every act records its source, so on-platform acts stay separable from partner-reported ones.";
  const corridorRows = (mob?.corridors ?? []).map((c) => ({
    id: c.id,
    name: c.label,
    acts: c.acts,
    mob: c.mobilized,
    bridge: c.bridging,
  }));
  const corrFooter = mob
    ? `${fmt(mob.outside_corridor)} acts in this period happened outside any corridor. ${
        touch ? "Tap" : "Click"
      } a column heading to sort.`
    : undefined;

  // ---------------------------------------------------------------------------------------------
  // 3. The levers
  // ---------------------------------------------------------------------------------------------
  const lev = reads.levers.status === "ready" ? reads.levers.data : null;
  type Lever = { title: string; props: Partial<MeasureCardProps> };
  const levers: Lever[] = (() => {
    const base = (label: string) => stateOf("levers", label);
    if (!lev)
      return [
        "Invites",
        "Onboarding",
        "Time to first act",
        "Introductions",
        "RSVP going",
        "Events",
        "Attestations",
        "Posts by C",
        "Story-led acts",
      ].map((title) => ({ title, props: base(title) }));
    const measure = (
      title: string,
      m: { value: number; comparison: number | null; series?: { value: number }[] },
      unit: string,
      lines: string[],
      emptyText: string,
      tag?: string,
    ): Lever => ({
      title,
      props:
        m.value === 0
          ? { state: "empty", emptyText }
          : {
              state: "data",
              value: fmt(m.value),
              unit,
              change: changeWords(m.value, m.comparison, hasCmp),
              trend: trendOf(m.series as { start: string; value: number }[] | undefined),
              lines,
              ...(tag ? { tag } : {}),
            },
    });
    const intro = lev.introductions;
    const answer =
      intro.answer_days.value == null
        ? []
        : [
            `Typical time to answer ${fmt(intro.answer_days.value)} days` +
              (hasCmp && intro.answer_days.comparison != null
                ? intro.answer_days.value < intro.answer_days.comparison
                  ? `, down from ${fmt(intro.answer_days.comparison)}`
                  : intro.answer_days.value > intro.answer_days.comparison
                    ? `, up from ${fmt(intro.answer_days.comparison)}`
                    : `, no change from ${fmt(intro.answer_days.comparison)}`
                : ""),
          ];
    const tfa = lev.time_to_first_act;
    const posts = lev.posts.by_c;
    // 1364 as 1615 connects it, lines verbatim from 1619: the figure stays Completed; Started is
    // members created in the period; the drop-off names the screen where most of those who have
    // not finished are, the screens joined by the one joiner on a tie, and reads that everyone has
    // finished when nobody who started is partway. A period with no member created is empty.
    const ob = lev.onboarding;
    const partway = ONBOARDING_STEPS.map((s) => ob.drop_off.by_step[s] ?? 0);
    const most = Math.max(...partway);
    const stopped =
      most === 0
        ? ONBOARDING_COPY.allFinished
        : ONBOARDING_COPY.stoppedAt(
            joinNames(
              ONBOARDING_STEPS.filter((s, i) => partway[i] === most).map(
                (s) => ONBOARDING_COPY.screen[s],
              ),
            ),
          );
    const onboarding: Lever =
      ob.started.value === 0
        ? { title: "Onboarding", props: { state: "empty", emptyText: ONBOARDING_COPY.empty } }
        : {
            title: "Onboarding",
            props: {
              state: "data",
              value: fmt(ob.completed.value),
              unit: "completed",
              change: changeWords(ob.completed.value, ob.completed.comparison, hasCmp),
              trend: trendOf(ob.completed.series),
              lines: [ONBOARDING_COPY.started(fmt(ob.started.value)), stopped],
            },
          };
    return [
      // 1363: not connected until 12E; MeasureCard's default sentence.
      { title: "Invites", props: { state: "notConnected" } },
      onboarding,
      // 1365: computed now; empty until a member onboarded in the period has an act.
      {
        title: "Time to first act",
        props:
          tfa.value == null
            ? { state: "empty", emptyText: "No new member has had a first act yet." }
            : {
                state: "data",
                value: fmt(tfa.value),
                unit: "days, median",
                change: changeWords(tfa.value, tfa.comparison, hasCmp),
                lines: ["New members who joined in the period"],
              },
      },
      measure(
        "Introductions",
        intro.sent,
        "sent",
        [
          `${fmt(intro.accepted.value)} accepted, ${changeWords(
            intro.accepted.value,
            intro.accepted.comparison,
            hasCmp,
          ).toLowerCase()}`,
          ...answer,
        ],
        "No introductions sent in this period.",
      ),
      measure(
        "RSVP going",
        lev.rsvp_going,
        "going",
        ["A plan to attend. Attendance is confirmed by attestation."],
        "No RSVPs in this period.",
        "Intent",
      ),
      measure(
        "Events",
        lev.events.held,
        "held",
        [`${fmt(lev.events.filled.value)} filled their capacity`],
        "No events held in this period.",
      ),
      measure(
        "Attestations",
        lev.attestations,
        "by context",
        [
          `${fmt(lev.attestations.by_context.event_attendance)} event attendance`,
          `${fmt(lev.attestations.by_context.hosting)} hosting`,
          `${fmt(lev.attestations.by_context.other)} other`,
        ],
        "No attestations in this period.",
      ),
      measure(
        "Posts by C",
        lev.posts,
        "posts",
        [
          `Convey ${fmt(posts["convey"] ?? 0)}, Convene ${fmt(posts["convene"] ?? 0)}, Connect ${fmt(
            posts["connect"] ?? 0,
          )}`,
          "Collaborate and Contribute arrive with their engines",
        ],
        "No posts in this period.",
      ),
      {
        title: "Story-led acts",
        props: {
          state: "notConnected",
          notConnectedText: "Attribution arrives with the behaviour log. Not yet connected.",
        },
      },
    ];
  })();

  // ---------------------------------------------------------------------------------------------
  // 4. The network
  // ---------------------------------------------------------------------------------------------
  const net = reads.network.status === "ready" ? reads.network.data : null;
  const asOf = net ? `As of ${moment(new Date(net.as_of), clockTz)}.` : "";
  const sides: BarListRow[] = (net?.by_side ?? []).map((s) => ({
    id: s.side,
    label: SIDE_LABELS[s.side] ?? s.side,
    value: s.value,
  }));
  const stances: BarListRow[] = (net?.by_stance ?? []).map((s) => ({
    id: s.stance,
    label: s.label,
    value: s.value,
  }));
  const densityRows: BarListRow[] = (net?.corridors ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    value: c.density,
    note: "No joined members yet",
    ...(c.threshold != null ? { threshold: c.threshold } : {}),
  }));
  const densityEmpty = !!net && densityRows.every((r) => r.value == null || r.value === 0);
  const densityFormat = (v: number, row: BarListRow) =>
    row.threshold != null
      ? `${v.toFixed(2)} against ${row.threshold.toFixed(2)}, ${v >= row.threshold ? "above" : "below"}`
      : `${v.toFixed(2)}. No threshold set`;

  // ---------------------------------------------------------------------------------------------
  // 5. Company lines, 6. DIA's note
  // ---------------------------------------------------------------------------------------------
  const company: { title: string; line: string }[] = [
    {
      title: "Partnerships",
      line: "Nothing here yet. Fills from the Relationships console: pipeline by stage, from identified to renewed.",
    },
    {
      title: "Newsletter",
      line: "Nothing here yet. Fills when the newsletter sends: subscribers, consent and complaint rate.",
    },
    {
      title: "Revenue",
      line: "Nothing here yet. Fills with paid ticketing. What this line shows waits on the free and paid boundary.",
    },
    {
      title: "Chapters",
      line: "Nothing here yet. Fills from the business track once chapters are defined.",
    },
  ];
  const statements: DiaStatement[] = dia.statements.map((s) => ({
    text: s.text,
    block: s.block,
    onGo,
  }));

  const windowLine = (() => {
    if (words && windowPart)
      return (
        <>
          <span>
            <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{words.periodLong}</strong>,{" "}
            {words.cmpLong}
          </span>
          {reads.window.status === "ready" && (
            <span>{refreshLine(reads.window.data, clockTz)}</span>
          )}
          {readingZone && (
            <span data-testid="overview-own-zone" style={{ color: "var(--ink)" }}>
              {SETTINGS_COPY.ownZoneSentence(
                zoneShortById(zones, readingZone),
                zoneShortById(zones, companyZone),
              )}
            </span>
          )}
        </>
      );
    if (failed("window"))
      return (
        <MeasureCard
          label="Window"
          state="error"
          errorTitle="The window could not load."
          errorText="The window projection did not answer. The rest of the page is current."
          onRetry={() => retry("window")}
        />
      );
    return <span aria-busy="true">Reading the period…</span>;
  })();

  return (
    <div
      ref={scroller}
      data-testid="admin-overview"
      data-grain={grain}
      data-compare={compare}
      data-zone={tz}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: `24px ${compact ? 16 : 32}px 64px`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* 1. Controls */}
        <section
          aria-label="Controls"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.15,
                color: "var(--ink)",
              }}
            >
              Overview
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>
              The weekly business review, read the same way every time.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Caps>Time grain</Caps>
              <Segment
                label="Time grain"
                options={grainOptions}
                value={grain}
                onChange={(v) => setGrain(v as Grain)}
                style={
                  compact && touch
                    ? { flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }
                    : {}
                }
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Caps>Compare with</Caps>
              <Segment
                label="Comparison"
                options={compareOptions}
                value={compare}
                onChange={(v) => setCompare(v as Compare)}
                style={
                  compact && touch
                    ? { flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }
                    : {}
                }
              />
            </div>
          </div>
          <div
            data-testid="overview-window"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              fontSize: 15,
              lineHeight: 1.45,
              color: "var(--ink-2)",
            }}
          >
            {windowLine}
            {isPartial && (
              <span style={{ color: "var(--ink-3)" }}>
                Two sources are not yet connected: partner confirmations and DNA system
                confirmations. Blocks that read them say so.
              </span>
            )}
          </div>
        </section>

        {/* 2. Mobilization */}
        <section
          aria-labelledby="h-mob"
          ref={refs.mob}
          data-testid="overview-mobilization"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <H2 id="h-mob">Mobilization</H2>
          {mobEmpty ? (
            <MeasureCard
              label="Mobilized Members"
              window={winShort}
              size="xl"
              state="empty"
              emptyText="No acts in this period yet. An act arrives when a member co-attends an event and is attested, accepts an introduction, hosts an event that happened, or a partner confirms one. Until then, read the levers below."
            />
          ) : (
            <>
              <Grid cols={expanded ? "2fr 1fr" : "1fr"}>
                <MeasureCard
                  label="Mobilized Members"
                  window={winShort}
                  size="xl"
                  {...(mob
                    ? {
                        value: fmt(mob.mobilized.value),
                        change: changeWords(mob.mobilized.value, mob.mobilized.comparison, hasCmp),
                        trend: trendOf(mob.mobilized.series),
                        trendLabels: words?.trendLabels,
                        lines: [
                          "Members with at least one confirmed act in the trailing 28 days, at the end of the period.",
                        ],
                      }
                    : {})}
                  {...stateOf("mobilization", "Mobilized Members")}
                />
                <MeasureCard
                  label="Bridging acts"
                  window={winShort}
                  size="l"
                  {...(mob
                    ? {
                        value: fmt(mob.bridging.value),
                        change: changeWords(mob.bridging.value, mob.bridging.comparison, hasCmp),
                        trend: trendOf(mob.bridging.series),
                        lines: ["Acts between a diaspora-side and a continent-side party."],
                      }
                    : {})}
                  {...stateOf("mobilization", "Bridging acts")}
                />
              </Grid>
              <Grid cols={expanded ? "1fr 1fr 1fr" : compact ? "1fr" : "1fr 1fr"}>
                <MeasureCard
                  label="Depth"
                  window={winShort}
                  lines={[
                    "Collaborating and Contributing arrive with the Spaces and Contribute engines.",
                  ]}
                  {...stateOf("mobilization", "Depth")}
                >
                  {mob && (
                    <>
                      <StackedBars
                        series={[depthEngaging, depthLeading]}
                        legend={["Engaging", "Leading"]}
                        height={88}
                        label="Acts by kind over time"
                      />
                      <BarList rows={depthNotYet} />
                    </>
                  )}
                </MeasureCard>
                <MeasureCard
                  label="Direction"
                  window={winShort}
                  lines={[
                    "Side is where each party lived when the act happened. Stance is kept beside it, never merged.",
                  ]}
                  {...stateOf("mobilization", "Direction")}
                >
                  {mob && <BarList rows={directions} />}
                </MeasureCard>
                <MeasureCard
                  label="Source"
                  window={winShort}
                  lines={[sourceLine]}
                  {...stateOf("mobilization", "Source")}
                >
                  {mob && <BarList rows={sources} />}
                </MeasureCard>
              </Grid>
              <div ref={refs.corr} data-testid="overview-corridors">
                <MeasureCard
                  label="By corridor"
                  window={winShort}
                  {...stateOf("mobilization", "By corridor")}
                >
                  {mob && (
                    <DataTable
                      columns={[
                        { key: "name", label: "Corridor" },
                        { key: "acts", label: "Acts", numeric: true },
                        { key: "mob", label: "Mobilized members", numeric: true },
                        { key: "bridge", label: "Bridging acts", numeric: true },
                      ]}
                      rows={corridorRows}
                      defaultSort={{ key: "acts", dir: "desc" }}
                      input={mode}
                      caption="Acts, mobilized members and bridging acts by corridor"
                      footer={corrFooter}
                    />
                  )}
                </MeasureCard>
              </div>
            </>
          )}
        </section>

        {/* 3. The levers */}
        <section
          aria-labelledby="h-lev"
          ref={refs.lev}
          data-testid="overview-levers"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <H2 id="h-lev">The levers</H2>
            <Lead>Inputs the company controls. {winShort}.</Lead>
          </div>
          <Grid cols={expanded ? "1fr 1fr 1fr" : compact ? "1fr" : "1fr 1fr"}>
            {levers.map((l) => (
              <MeasureCard key={l.title} label={l.title} size="m" {...l.props} />
            ))}
          </Grid>
        </section>

        {/* 4. The network */}
        <section
          aria-labelledby="h-net"
          ref={refs.net}
          data-testid="overview-network"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <H2 id="h-net">The network</H2>
            <Lead>Who is here. {asOf}</Lead>
          </div>
          <Grid cols={expanded ? "1fr 1fr 1fr 1.4fr" : compact ? "1fr" : "1fr 1fr"}>
            <MeasureCard
              label="Three numbers, never merged"
              {...stateOf("network", "Three numbers, never merged")}
            >
              {net &&
                (
                  [
                    { v: fmt(net.registered), label: "Registered", def: "Created an account." },
                    { v: null, label: "Admitted", def: "Passed the invite boundary." },
                    { v: fmt(net.joined), label: "Joined", def: "Completed onboarding." },
                  ] as { v: string | null; label: string; def: string }[]
                ).map((k) => (
                  <div
                    key={k.label}
                    style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 6 }}
                  >
                    {k.v == null ? (
                      // 1362: no invite boundary is recorded, so the figure is replaced, not guessed.
                      <span
                        style={{
                          fontSize: 17,
                          lineHeight: "var(--display-l-lh)",
                          minHeight: "var(--display-l)",
                          display: "flex",
                          alignItems: "flex-end",
                          color: "var(--ink-3)",
                        }}
                      >
                        Not yet connected.
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 400,
                          fontSize: "var(--display-l)",
                          lineHeight: "var(--display-l-lh)",
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {k.v}
                      </span>
                    )}
                    <span style={{ fontSize: 15, color: "var(--ink)" }}>{k.label}</span>
                    <span style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>
                      {k.def}
                    </span>
                  </div>
                ))}
            </MeasureCard>
            <MeasureCard
              label="Joined members by side"
              {...stateOf("network", "Joined members by side")}
            >
              {net && <BarList rows={sides} />}
            </MeasureCard>
            <MeasureCard
              label="Joined members by stance"
              lines={[
                "Two breakdowns of the same joined members. A Returnee in Accra is continent side with Returnee stance.",
              ]}
              {...stateOf("network", "Joined members by stance")}
            >
              {net && <BarList rows={stances} />}
            </MeasureCard>
            <div
              style={{
                gridColumn: expanded || compact ? "auto" : "1 / -1",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MeasureCard
                label="Corridor density against its threshold"
                window={winShort}
                lines={[
                  "Density is the average number of connections per joined member, counting only connections between members of the same corridor. The tick is the internal threshold. Thresholds are company-facing and never shown to members.",
                ]}
                style={{ flex: 1 }}
                {...(densityEmpty
                  ? {
                      state: "empty",
                      emptyText:
                        "No acts in any corridor this period, so density does not move. Thresholds stay as set.",
                    }
                  : stateOf("network", "Corridor density against its threshold"))}
              >
                {net && !densityEmpty && (
                  <BarList rows={densityRows} format={densityFormat} barHeight={10} />
                )}
              </MeasureCard>
            </div>
          </Grid>
        </section>

        {/* 5. Company lines */}
        <section
          aria-labelledby="h-co"
          ref={refs.co}
          data-testid="overview-company"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <H2 id="h-co">Company lines</H2>
          <Grid cols={expanded ? "1fr 1fr 1fr 1fr" : compact ? "1fr" : "1fr 1fr"}>
            {company.map((c) => (
              <MeasureCard
                key={c.title}
                label={c.title}
                {...(loading("company") || failed("company")
                  ? stateOf("company", c.title)
                  : { state: "empty", emptyText: c.line })}
              />
            ))}
          </Grid>
        </section>

        {/* 6. DIA's note, when the company has it on (1391) */}
        {diaNote && (
          <section aria-label="DIA's note for the week" data-testid="overview-dia">
            <DiaNote
              title="DIA's note for the week"
              statements={statements}
              loading={dia.loading}
            />
          </section>
        )}
      </div>
    </div>
  );
}
