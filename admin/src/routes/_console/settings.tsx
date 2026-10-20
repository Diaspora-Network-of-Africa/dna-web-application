// Settings (handoff 45-D Part B; EXTRACTION-45-12S, approved as 1413, the contract for the page;
// rulings 1178, 1265, 1381, 1382, 1391 to 1395 and 1410 to 1416). A destination inside the console,
// rendered in ConsoleShell with current="settings": Tabs for Personal and Organization, each card,
// state, save state, sheet and line of copy as the extraction records it, with the build fixes of
// its §5 (no prototype hint, no toasts T1 and T2, var(--z-toast) with no fallback, no aria-sort on a
// table with no sortable column, zones by IANA identifier).
//
// Every option list is read from public.vocabularies() through the console (1392), and a list that
// did not load renders an empty control. Every read and write is a gated definer (admin/src/lib/
// settings.ts); the read-only Organization for a non-admin is decoration over the database's own
// refusal (1391, 1412). Each saving control carries the extraction's status line: Saving, Saved for
// 2.6 s, or its failure sentence in --error with Retry. A failed personal save reverts the value,
// except Appearance, which stays applied on this device and says so (§4 new item 4); a failed
// Organization save reverts and adds no history row (new item 5).
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { DataTable } from "@/components/strand/DataTable";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { Segment } from "@/components/strand/Segment";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { Switch } from "@/components/strand/Switch";
import { Tabs } from "@/components/strand/Tabs";
import { Toast } from "@/components/strand/Toast";
import { getSupabase } from "@/lib/supabase";
import { useMode, useTier } from "@/lib/tier";
import { ADMIN_COPY, SETTINGS_COPY as C } from "../../lib/copy";
import { useConsole } from "../../lib/console";
import {
  dayShort,
  readProjection,
  refreshLine,
  windowWords,
  type WindowRead,
} from "../../lib/overview";
import {
  abandonReplacement,
  checkCurrentCode,
  enrolReplacement,
  finishReplacement,
  type Enrolment,
} from "../../lib/session";
import {
  deviceOf,
  readChangeHistory,
  readReadLog,
  readSessions,
  saveOrgSettings,
  saveStaffSettings,
  stamp,
  zoneLong,
  zoneLongById,
  zoneShortById,
  type HistoryEntry,
  type OrgSettings,
  type ReadEntry,
  type SessionRow,
  type StaffSettings,
  type Zone,
} from "../../lib/settings";
import { setAppearanceCopy } from "../../lib/theme";

export const Route = createFileRoute("/_console/settings")({ component: Settings });

type Tab = "personal" | "org";
type SaveKey = "appearance" | "zone" | "opens" | "company" | "dia";
type Save =
  { phase: "saving" } | { phase: "saved" } | { phase: "failed"; text: string; retry: () => void };
type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "failed" };

const SAVED_MS = 2600;
const TOAST_MS = 4000;

/** The device's own scheme, followed live, for the System reading (row 14). */
function useDeviceScheme(): "light" | "dark" {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return dark ? "dark" : "light";
}

/** 200 ms colour transition on the page and its cards when Appearance changes; none under reduced motion (row 13). */
function useColourTransition(): string {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return reduce
    ? "none"
    : "background-color 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease)";
}

const Card = ({
  children,
  gap = 12,
  transition,
  testid,
}: {
  children: ReactNode;
  gap?: number;
  transition: string;
  testid?: string;
}) => (
  <div
    data-card=""
    data-testid={testid}
    style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap,
      transition,
      minWidth: 0,
    }}
  >
    {children}
  </div>
);

const Head = ({ title, line }: { title: string; line?: string | undefined }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{title}</h2>
    {line && (
      <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)", textWrap: "pretty" }}>{line}</p>
    )}
  </div>
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

const Sunken = ({ children, testid }: { children: ReactNode; testid?: string }) => (
  <p
    data-testid={testid}
    style={{
      margin: 0,
      padding: 16,
      borderRadius: 10,
      background: "var(--bg-sunken)",
      fontSize: 15,
      color: "var(--ink-2)",
      textWrap: "pretty",
    }}
  >
    {children}
  </p>
);

/** The status line under each saving control (§1 shared behaviour; proposed SettingStatus, §6c). */
function Status({
  save,
  size,
  testid,
}: {
  save: Save | undefined;
  size: "sm" | "md";
  testid: string;
}) {
  const color = !save
    ? "var(--ink-3)"
    : save.phase === "failed"
      ? "var(--error)"
      : save.phase === "saved"
        ? "var(--ink-2)"
        : "var(--ink-3)";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testid}
      data-phase={save?.phase ?? "rest"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        minHeight: 24,
        fontSize: 15,
        color,
      }}
    >
      <span>
        {!save
          ? ""
          : save.phase === "saving"
            ? C.saving
            : save.phase === "saved"
              ? C.saved
              : save.text}
      </span>
      {save?.phase === "failed" && (
        <Button variant="secondary" size={size} onClick={save.retry}>
          {C.retry}
        </Button>
      )}
    </div>
  );
}

function Settings() {
  const ctx = useConsole();
  const { settings, vocab, isAdmin, overview } = ctx;
  const tier = useTier();
  const mode = useMode();
  const touch = mode === "touch";
  const compact = tier === "compact";
  const btn: "sm" | "md" = touch ? "md" : "sm";
  const device = useDeviceScheme();
  const transition = useColourTransition();
  const [tab, setTab] = useState<Tab>("personal");
  const [saves, setSaves] = useState<Partial<Record<SaveKey, Save>>>({});
  const timers = useRef<Partial<Record<SaveKey, ReturnType<typeof setTimeout>>>>({});
  const [sheet, setSheet] = useState<"zone" | "signout" | "reenrol" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zones: Zone[] = useMemo(
    () => (vocab && Array.isArray(vocab.reporting_zones) ? vocab.reporting_zones : []),
    [vocab],
  );
  const appearances =
    vocab && Array.isArray(vocab.admin_appearances) ? vocab.admin_appearances : [];
  const grains = vocab && Array.isArray(vocab.overview_grains) ? vocab.overview_grains : [];
  const compares =
    vocab && Array.isArray(vocab.overview_comparisons) ? vocab.overview_comparisons : [];

  const ready = settings.status === "ready" ? settings : null;
  const staff = ready?.staff ?? null;
  const org = ready?.org ?? null;
  const companyZone = org?.reporting_zone ?? null;
  const readZone = staff?.reading_zone ?? companyZone;
  const readZoneShort = readZone ? zoneShortById(zones, readZone) : "";

  useEffect(
    () => () => {
      for (const t of Object.values(timers.current)) if (t) clearTimeout(t);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const setSave = useCallback((key: SaveKey, save: Save | undefined) => {
    const t = timers.current[key];
    if (t) clearTimeout(t);
    setSaves((s) => ({ ...s, [key]: save }));
    if (save?.phase === "saved")
      timers.current[key] = setTimeout(
        () => setSaves((s) => ({ ...s, [key]: undefined })),
        SAVED_MS,
      );
  }, []);

  const raise = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  // ---------------------------------------------------------------------------------------------
  // Personal saves. The value shows at once; the write follows; a failure reverts (§2c).
  // ---------------------------------------------------------------------------------------------
  const saveStaff = useCallback(
    (
      key: SaveKey,
      patch: Partial<StaffSettings>,
      prev: StaffSettings,
      failText: string,
      revert: boolean,
    ) => {
      const sb = getSupabase();
      if (!sb) return;
      const attempt = () => {
        setSave(key, { phase: "saving" });
        saveStaffSettings(sb, patch)
          .then((next) => {
            ctx.setStaff(next);
            setSave(key, { phase: "saved" });
          })
          .catch(() => {
            if (revert) ctx.setStaff(prev);
            setSave(key, {
              phase: "failed",
              text: failText,
              retry: () => {
                if (revert) ctx.setStaff({ ...prev, ...patch });
                attempt();
              },
            });
          });
      };
      ctx.setStaff({ ...prev, ...patch });
      attempt();
    },
    [ctx, setSave],
  );

  const chooseAppearance = (v: string) => {
    if (!staff || v === staff.appearance) return;
    // Applies the moment it is chosen (1393), and stays applied on this device if the save fails.
    setAppearanceCopy(v);
    saveStaff("appearance", { appearance: v }, staff, C.appearanceFailed, false);
  };

  // The zone the person last chose for themselves on this page, so My own zone returns to it; on
  // first use, the first zone in the vocabulary that is not the company's.
  const lastOwn = useRef<string | null>(null);
  const chooseZoneMode = (v: string) => {
    if (!staff || !companyZone) return;
    const own = v === "own";
    if (own === (staff.reading_zone !== null)) return;
    const next = own
      ? (lastOwn.current ?? zones.find((z) => z.value !== companyZone)?.value ?? null)
      : null;
    if (own && !next) return;
    saveStaff(
      "zone",
      { reading_zone: next },
      staff,
      staff.reading_zone !== null ? C.zoneModeFailedOwn : C.zoneModeFailedCompany,
      true,
    );
  };
  const chooseOwnZone = (v: string) => {
    if (!staff || !v || v === staff.reading_zone) return;
    lastOwn.current = v;
    saveStaff(
      "zone",
      { reading_zone: v },
      staff,
      C.yourZoneFailed(
        staff.reading_zone ? zoneShortById(zones, staff.reading_zone) : readZoneShort,
      ),
      true,
    );
  };
  const chooseGrain = (v: string) => {
    if (!staff || v === staff.default_grain) return;
    const prevLabel =
      grains.find((g) => g.value === staff.default_grain)?.label ?? staff.default_grain;
    saveStaff("opens", { default_grain: v }, staff, C.grainFailed(prevLabel), true);
  };
  const chooseCompare = (v: string) => {
    if (!staff || v === staff.default_compare) return;
    saveStaff("opens", { default_compare: v }, staff, C.compareFailed, true);
  };

  // ---------------------------------------------------------------------------------------------
  // Organization saves (admin only; 1391). Success adds the history row at the top; a failure
  // reverts and adds none.
  // ---------------------------------------------------------------------------------------------
  const [history, setHistory] = useState<Load<HistoryEntry[]>>({ status: "loading" });
  const saveOrg = (
    key: SaveKey,
    patch: Partial<OrgSettings>,
    prev: OrgSettings,
    failText: string,
  ) => {
    const sb = getSupabase();
    if (!sb || !isAdmin) return;
    const attempt = () => {
      ctx.setOrg({ ...prev, ...patch });
      setSave(key, { phase: "saving" });
      saveOrgSettings(sb, patch)
        .then((next) => {
          ctx.setOrg(next);
          setSave(key, { phase: "saved" });
          const rows: HistoryEntry[] = [];
          const at = new Date().toISOString();
          if (next.reporting_zone !== prev.reporting_zone)
            rows.push({
              id: -Date.now(),
              at,
              setting: "reporting_zone",
              before: prev.reporting_zone,
              after: next.reporting_zone,
              by: ctx.name,
            });
          if (next.dia_note !== prev.dia_note)
            rows.push({
              id: -Date.now() - 1,
              at,
              setting: "dia_note",
              before: prev.dia_note,
              after: next.dia_note,
              by: ctx.name,
            });
          if (rows.length)
            setHistory((h) =>
              h.status === "ready" ? { status: "ready", data: [...rows, ...h.data] } : h,
            );
        })
        .catch(() => {
          ctx.setOrg(prev);
          setSave(key, { phase: "failed", text: failText, retry: attempt });
        });
    };
    attempt();
  };

  // ---------------------------------------------------------------------------------------------
  // The three reads. The read log and the history log their own read (1178), once per opening of
  // their tab on this page; the sessions are read with Personal.
  // ---------------------------------------------------------------------------------------------
  const [readLog, setReadLog] = useState<Load<ReadEntry[]>>({ status: "loading" });
  const [sessions, setSessions] = useState<Load<SessionRow[]>>({ status: "loading" });
  const opened = useRef<{ personal: boolean; org: boolean }>({ personal: false, org: false });
  useEffect(() => {
    if (!ready) return;
    const sb = getSupabase();
    if (!sb || opened.current[tab]) return;
    opened.current[tab] = true;
    if (tab === "personal") {
      readReadLog(sb)
        .then((data) => setReadLog({ status: "ready", data }))
        .catch(() => setReadLog({ status: "failed" }));
      readSessions(sb)
        .then((data) => setSessions({ status: "ready", data }))
        .catch(() => setSessions({ status: "failed" }));
    } else {
      readChangeHistory(sb)
        .then((data) => setHistory({ status: "ready", data }))
        .catch(() => setHistory({ status: "failed" }));
    }
  }, [ready, tab]);

  // The window line preview (row 21): the window projection for the default grain and comparison
  // in the company zone, written with clock times in the reading zone (1411). A role the Overview
  // refuses is never sent to the projection (45-E item 4), and a read that fails shows no preview.
  const [preview, setPreview] = useState<WindowRead | null>(null);
  const defGrain = staff?.default_grain ?? null;
  const defCompare = staff?.default_compare ?? null;
  useEffect(() => {
    if (!overview || tab !== "personal" || !defGrain || !defCompare || !companyZone) return;
    const sb = getSupabase();
    if (!sb) return;
    let live = true;
    void readProjection(
      sb,
      "window",
      defGrain as WindowRead["grain"],
      defCompare as WindowRead["compare"],
      companyZone,
    ).then((r) => {
      if (live) setPreview(r.status === "ready" ? r.data : null);
    });
    return () => {
      live = false;
    };
  }, [overview, tab, defGrain, defCompare, companyZone]);

  // ---------------------------------------------------------------------------------------------
  // Render.
  // ---------------------------------------------------------------------------------------------
  const currentSession =
    sessions.status === "ready" ? (sessions.data.find((s) => s.current) ?? null) : null;
  const thisDevice =
    deviceOf(currentSession?.user_agent ?? null) ??
    deviceOf(typeof navigator !== "undefined" ? navigator.userAgent : null) ??
    "";

  const segStyle = compact
    ? { flexWrap: "nowrap" as const, overflowX: "auto" as const, paddingBottom: 2 }
    : {};

  const personal = staff && org && companyZone && readZone && (
    <section
      role="tabpanel"
      aria-label={C.tabPersonal}
      data-testid="settings-personal"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>{C.personalLine}</p>

      <Card transition={transition} testid="settings-appearance">
        <Head title={C.appearance} line={C.appearanceLine} />
        <Segment
          label={C.appearance}
          options={appearances}
          value={staff.appearance}
          onChange={chooseAppearance}
        />
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {staff.appearance === "light" || staff.appearance === "dark"
            ? C.appearanceFixed(staff.appearance)
            : C.appearanceSystem(device)}
        </span>
        <Status save={saves.appearance} size={btn} testid="status-appearance" />
      </Card>

      <Card transition={transition} testid="settings-zone">
        <Head
          title={C.zone}
          line={
            staff.reading_zone
              ? C.zoneOwnLine(readZoneShort, zoneLongById(zones, companyZone))
              : C.zoneCompanyLine(zoneLongById(zones, companyZone))
          }
        />
        <Segment
          label={C.zone}
          options={[
            { value: "company", label: C.zoneModeCompany },
            { value: "own", label: C.zoneModeOwn },
          ]}
          value={staff.reading_zone ? "own" : "company"}
          onChange={chooseZoneMode}
        />
        {staff.reading_zone && (
          <Select
            label={C.yourZone}
            hint={C.yourZoneHint}
            options={zones.map((z) => ({ value: z.value, label: zoneLong(z) }))}
            value={staff.reading_zone}
            onChange={(e) => chooseOwnZone(e.target.value)}
            data-testid="settings-own-zone"
          />
        )}
        <Status save={saves.zone} size={btn} testid="status-zone" />
        {preview && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Caps>{C.windowLabel}</Caps>
            <WindowPreview
              w={preview}
              clockTz={readZone}
              ownSentence={
                staff.reading_zone
                  ? C.ownZoneSentence(readZoneShort, zoneShortById(zones, companyZone))
                  : null
              }
            />
          </div>
        )}
      </Card>

      <Card transition={transition} testid="settings-opens">
        <Head title={C.opensTo} line={C.opensToLine} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Caps>{C.grain}</Caps>
          <Segment
            label={C.grainGroup}
            options={grains}
            value={staff.default_grain}
            onChange={chooseGrain}
            style={segStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Caps>{C.compare}</Caps>
          <Segment
            label={C.compareGroup}
            options={compares}
            value={staff.default_compare}
            onChange={chooseCompare}
            style={segStyle}
          />
        </div>
        <Status save={saves.opens} size={btn} testid="status-opens" />
      </Card>

      <Card transition={transition} gap={16} testid="settings-security">
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{C.security}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{C.twoFactor}</span>
          <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{C.twoFactorLine}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 15, color: "var(--ink-2)", textWrap: "pretty" }}>
            {C.reenrolLine}
          </span>
          <Button variant="secondary" size={btn} onClick={() => setSheet("reenrol")}>
            {C.reenrolButton}
          </Button>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
          data-testid="settings-sessions"
        >
          <span style={{ fontSize: 15, fontWeight: 500 }}>{C.sessions}</span>
          {sessions.status === "ready" && (
            <DataTable
              columns={[
                { key: "device", label: C.sessionDevice, sortable: false },
                { key: "last", label: C.sessionLast, sortable: false },
              ]}
              rows={sessions.data.map((s) => {
                const name = deviceOf(s.user_agent) ?? s.user_agent ?? "";
                return {
                  id: s.id,
                  device: s.current ? C.thisDevice(name) : name,
                  last: s.current ? C.activeNow : stamp(s.last_active_at, readZone),
                };
              })}
              sort={{ key: "", dir: "asc" }}
              onSort={() => undefined}
              input={mode}
              caption={C.sessionsCaption}
              footer={C.timesIn(readZoneShort)}
              minWidth={300}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 15, color: "var(--ink-2)", textWrap: "pretty" }}>
            {C.signOutLine}
          </span>
          <Button variant="danger" size={btn} onClick={() => setSheet("signout")}>
            {C.signOutButton}
          </Button>
        </div>
      </Card>

      <Card transition={transition} testid="settings-read-log">
        <Head title={C.readLog} line={C.readLogLine} />
        {readLog.status === "ready" && (
          <ReadLog entries={readLog.data} tz={readZone} zoneShort={readZoneShort} />
        )}
      </Card>
    </section>
  );

  const historyLabel = (setting: string) =>
    setting === "reporting_zone" ? C.companyZone : setting === "dia_note" ? C.dia : setting;
  const historyValue = (setting: string, v: unknown, at: string) =>
    setting === "reporting_zone" && typeof v === "string"
      ? zoneLongById(zones, v, new Date(at))
      : typeof v === "boolean"
        ? v
          ? C.on
          : C.off
        : v == null
          ? ""
          : String(v);

  const organization = org && companyZone && readZone && (
    <section
      role="tabpanel"
      aria-label={C.tabOrg}
      data-testid="settings-org"
      data-read-only={isAdmin ? undefined : ""}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {isAdmin ? (
        <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>{C.adminLine}</p>
      ) : (
        <p
          data-testid="settings-read-only"
          style={{
            margin: 0,
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--bg-sunken)",
            fontSize: 15,
            color: "var(--ink)",
            textWrap: "pretty",
          }}
        >
          {C.readOnly}
        </p>
      )}

      <Card transition={transition} testid="settings-company-zone">
        <Head title={C.companyZone} line={C.companyZoneLine} />
        <span data-testid="company-zone" style={{ fontSize: 19, color: "var(--ink)" }}>
          {zoneLongById(zones, companyZone)}
        </span>
        <div style={{ display: "flex" }}>
          <Button
            variant="secondary"
            size={btn}
            disabled={!isAdmin}
            onClick={() => isAdmin && setSheet("zone")}
          >
            {C.changeZone}
          </Button>
        </div>
        <Status save={saves.company} size={btn} testid="status-company" />
      </Card>

      <Card transition={transition} testid="settings-dia">
        <Head title={C.dia} line={C.diaLine} />
        <Switch
          label={C.diaSwitch}
          checked={org.dia_note}
          disabled={!isAdmin}
          onChange={(v) => {
            if (!isAdmin || v === org.dia_note) return;
            saveOrg("dia", { dia_note: v }, org, C.diaFailed(org.dia_note));
          }}
          style={{ display: "flex", width: "100%" }}
        />
        <Status save={saves.dia} size={btn} testid="status-dia" />
      </Card>

      <Card transition={transition}>
        <Head title={C.policies} line={C.policiesLine} />
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {(
            [
              [C.policyTwoFactor, C.policyTwoFactorLine],
              [C.policyLogged, C.policyLoggedLine],
            ] as const
          ).map(([title, line]) => (
            <li
              key={title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "10px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
              <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card transition={transition} testid="settings-history">
        <Head title={C.history} line={C.historyLine} />
        {history.status === "ready" &&
          (history.data.length === 0 ? (
            <Sunken testid="history-empty">{C.historyEmpty}</Sunken>
          ) : (
            <DataTable
              columns={[
                { key: "when", label: C.historyWhen, sortable: false },
                { key: "setting", label: C.historySetting, sortable: false },
                { key: "before", label: C.historyBefore, sortable: false },
                { key: "after", label: C.historyAfter, sortable: false },
                { key: "by", label: C.historyBy, sortable: false },
              ]}
              rows={history.data.map((h) => ({
                id: String(h.id),
                when: stamp(h.at, readZone),
                setting: historyLabel(h.setting),
                before: historyValue(h.setting, h.before, h.at),
                after: historyValue(h.setting, h.after, h.at),
                by: h.by ?? "",
              }))}
              sort={{ key: "", dir: "asc" }}
              onSort={() => undefined}
              input={mode}
              caption={C.historyCaption}
              footer={C.historyFoot(readZoneShort)}
              minWidth={640}
            />
          ))}
      </Card>
    </section>
  );

  return (
    <div
      data-testid="admin-settings"
      data-tab={tab}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: `24px ${compact ? 16 : 32}px 72px`,
        boxSizing: "border-box",
        background: "var(--bg)",
        color: "var(--ink)",
        transition,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.15,
            }}
          >
            {C.title}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)", textWrap: "pretty" }}>
            {C.line}
          </p>
        </header>
        <Tabs
          items={[
            { id: "personal", label: C.tabPersonal },
            { id: "org", label: C.tabOrg },
          ]}
          value={tab}
          onChange={(id) => setTab(id === "org" ? "org" : "personal")}
        />

        {settings.status === "loading" && (
          <div
            aria-busy="true"
            aria-label={C.loading}
            data-testid="settings-loading"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {[0, 1, 2].map((i) => (
              <Card key={i} transition={transition}>
                <div
                  style={{
                    height: 18,
                    width: "40%",
                    borderRadius: 6,
                    background: "var(--bg-sunken)",
                  }}
                />
                <div
                  style={{
                    height: 14,
                    width: "80%",
                    borderRadius: 6,
                    background: "var(--bg-sunken)",
                  }}
                />
                <div
                  style={{
                    height: 44,
                    width: "100%",
                    borderRadius: 999,
                    background: "var(--bg-sunken)",
                  }}
                />
              </Card>
            ))}
          </div>
        )}
        {settings.status === "failed" && (
          <div
            data-testid="settings-failed"
            style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}
          >
            <Sunken>{ADMIN_COPY.failure}</Sunken>
            <Button variant="secondary" size={btn} onClick={ctx.reloadSettings}>
              {C.retry}
            </Button>
          </div>
        )}
        {ready && (tab === "personal" ? personal : organization)}
      </div>

      {org && companyZone && (
        <ZoneSheet
          open={sheet === "zone"}
          compact={compact}
          zones={zones}
          current={companyZone}
          onClose={() => setSheet(null)}
          onConfirm={(to) => {
            setSheet(null);
            saveOrg(
              "company",
              { reporting_zone: to },
              org,
              C.companyZoneFailed(zoneShortById(zones, org.reporting_zone)),
            );
          }}
        />
      )}
      <SignOutSheet
        open={sheet === "signout"}
        compact={compact}
        device={thisDevice}
        onClose={() => setSheet(null)}
        onConfirm={ctx.signOutEverywhere}
      />
      <ReenrolSheet
        open={sheet === "reenrol"}
        compact={compact}
        onClose={() => setSheet(null)}
        onDone={() => {
          setSheet(null);
          raise(C.reenrolled);
        }}
      />

      {toast && (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 24,
            display: "flex",
            justifyContent: "center",
            zIndex: "var(--z-toast)",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }} data-testid="settings-toast">
            <Toast action={C.dismiss} onAction={() => setToast(null)}>
              {toast}
            </Toast>
          </div>
        </div>
      )}
    </div>
  );
}

/** The Overview's window line as it would read (row 21, §2f). */
function WindowPreview({
  w,
  clockTz,
  ownSentence,
}: {
  w: WindowRead;
  clockTz: string;
  ownSentence: string | null;
}) {
  const words = windowWords(w, clockTz);
  return (
    <div
      data-testid="settings-window-preview"
      style={{
        background: "var(--bg-sunken)",
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontSize: 15,
        lineHeight: 1.45,
        color: "var(--ink-2)",
      }}
    >
      <span>
        <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{words.periodLong}</strong>,{" "}
        {words.cmpLong}
      </span>
      <span>{refreshLine(w, clockTz)}</span>
      {ownSentence && <span style={{ color: "var(--ink)" }}>{ownSentence}</span>}
    </div>
  );
}

/** Row 32: newest first, grouped by day in the reading zone, with the foot and the empty state. */
function ReadLog({
  entries,
  tz,
  zoneShort,
}: {
  entries: ReadEntry[];
  tz: string;
  zoneShort: string;
}) {
  if (entries.length === 0) return <Sunken testid="read-log-empty">{C.readLogEmpty}</Sunken>;
  const today = dayShort(new Date(), tz);
  const days: { label: string; items: { id: number; time: string; what: string }[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const day = dayShort(d, tz);
    const label = day === today ? `${C.today}, ${day}` : day;
    let g = days.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      days.push(g);
    }
    const what = e.page ? (e.block ? `${e.page}, ${e.block}` : e.page) : e.projection;
    g.items.push({ id: e.id, time: stamp(e.at, tz).split(", ").pop() ?? "", what });
  }
  return (
    <>
      <div data-testid="read-log" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {days.map((d) => (
          <div key={d.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "var(--ink-3)",
              }}
            >
              {d.label}
            </h3>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {d.items.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px minmax(0, 1fr)",
                    gap: 12,
                    padding: "8px 0",
                    borderTop: "1px solid var(--line)",
                    fontSize: 15,
                  }}
                >
                  <span style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                    {r.time}
                  </span>
                  <span style={{ color: "var(--ink)" }}>{r.what}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{C.readLogFoot(zoneShort)}</span>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// The three sheets (§2d): a bottom sheet at compact, side-anchored above it; a title row with Close;
// every button 44px (size md) in both input modes.
// ---------------------------------------------------------------------------------------------------

function SheetFrame({
  open,
  compact,
  title,
  onClose,
  error,
  actions,
  children,
  testid,
}: {
  open: boolean;
  compact: boolean;
  title: string;
  onClose: (() => void) | undefined;
  error?: string | null;
  actions: ReactNode;
  children: ReactNode;
  testid: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant={compact ? "sheet" : "drawer"}
      label={title}
      error={error ?? null}
      actions={actions}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 56,
          padding: "0 8px 0 20px",
          borderBottom: "1px solid var(--line)",
          flex: "none",
        }}
      >
        <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 500 }}>
          {title}
        </h2>
        {onClose && <IconButton name="x" label="Close" onClick={onClose} />}
      </div>
      <div
        data-testid={testid}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {children}
      </div>
    </Sheet>
  );
}

/** S1, admin only. Opens on the current zone with the confirm disabled until another is chosen (1415). */
function ZoneSheet({
  open,
  compact,
  zones,
  current,
  onClose,
  onConfirm,
}: {
  open: boolean;
  compact: boolean;
  zones: Zone[];
  current: string;
  onClose: () => void;
  onConfirm: (zone: string) => void;
}) {
  const [pending, setPending] = useState(current);
  useEffect(() => {
    if (open) setPending(current);
  }, [open, current]);
  const same = pending === current;
  const currentZone = zones.find((z) => z.value === current);
  return (
    <SheetFrame
      open={open}
      compact={compact}
      title={C.zoneSheet}
      onClose={onClose}
      testid="sheet-zone"
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            {C.keepZone(currentZone ? currentZone.name : current)}
          </Button>
          <Button variant="primary" size="md" disabled={same} onClick={() => onConfirm(pending)}>
            {same ? C.changeTheZone : C.changeTo(zoneShortById(zones, pending))}
          </Button>
        </>
      }
    >
      <Select
        label={C.newZone}
        options={zones.map((z) => ({ value: z.value, label: zoneLong(z) }))}
        value={pending}
        onChange={(e) => setPending(e.target.value)}
        data-testid="sheet-zone-select"
      />
      <p style={{ margin: 0, fontSize: 17, color: "var(--ink)", textWrap: "pretty" }}>
        {same ? C.zoneIsCurrent : C.zoneWillMove(zoneShortById(zones, pending))}
      </p>
      <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)", textWrap: "pretty" }}>
        {C.zoneSheetLine}
      </p>
    </SheetFrame>
  );
}

/** S2. Confirm ends every session, this one included; the console then shows the signed-out screen. */
function SignOutSheet({
  open,
  compact,
  device,
  onClose,
  onConfirm,
}: {
  open: boolean;
  compact: boolean;
  device: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  return (
    <SheetFrame
      open={open}
      compact={compact}
      title={C.signOutSheet}
      onClose={busy ? undefined : onClose}
      error={error}
      testid="sheet-signout"
      actions={
        <>
          <Button variant="secondary" size="md" disabled={busy} onClick={onClose}>
            {C.staySignedIn}
          </Button>
          <Button
            variant="danger"
            size="md"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              onConfirm()
                .catch(() => setError(ADMIN_COPY.failure))
                .finally(() => setBusy(false));
            }}
          >
            {C.signOutButton}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 17, color: "var(--ink)", textWrap: "pretty" }}>
        {C.signOutBody(device)}
      </p>
    </SheetFrame>
  );
}

/** S3: the current code on the existing factor, then the new entry, its code, and the old one removed. */
function ReenrolSheet({
  open,
  compact,
  onClose,
  onDone,
}: {
  open: boolean;
  compact: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [newCode, setNewCode] = useState("");
  const [newError, setNewError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const oldFactor = useRef<string | null>(null);
  const [enrolled, setEnrolled] = useState<Enrolment | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCode("");
    setCodeError(undefined);
    setNewCode("");
    setNewError(undefined);
    setFailure(null);
    setEnrolled(null);
    oldFactor.current = null;
  }, [open]);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const cancel = () => {
    const sb = getSupabase();
    if (sb && enrolled) void abandonReplacement(sb, enrolled.factorId);
    onClose();
  };

  const checkCode = async () => {
    const sb = getSupabase();
    if (!sb || code.length !== 6) return;
    setBusy(true);
    setFailure(null);
    try {
      const { outcome, factorId } = await checkCurrentCode(sb, code);
      if (outcome === "wrong") {
        setCodeError(C.codeMismatch);
        return;
      }
      if (outcome !== "ok" || !factorId) {
        setFailure(ADMIN_COPY.failure);
        return;
      }
      oldFactor.current = factorId;
      setEnrolled(await enrolReplacement(sb));
      setStep(2);
    } catch {
      setFailure(ADMIN_COPY.failure);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const sb = getSupabase();
    if (!sb || !enrolled || !oldFactor.current || newCode.length !== 6) return;
    setBusy(true);
    setFailure(null);
    try {
      const outcome = await finishReplacement(sb, oldFactor.current, enrolled.factorId, newCode);
      if (outcome === "wrong") {
        setNewError(C.codeMismatch);
        return;
      }
      if (outcome !== "ok") {
        setFailure(ADMIN_COPY.failure);
        return;
      }
      setEnrolled(null);
      onDone();
    } catch {
      setFailure(ADMIN_COPY.failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetFrame
      open={open}
      compact={compact}
      title={C.reenrolSheet}
      onClose={busy ? undefined : cancel}
      error={failure}
      testid="sheet-reenrol"
      actions={
        <>
          <Button variant="secondary" size="md" disabled={busy} onClick={cancel}>
            {C.cancel}
          </Button>
          {step === 1 ? (
            <Button
              variant="primary"
              size="md"
              disabled={busy || code.length !== 6}
              onClick={() => void checkCode()}
            >
              {C.continue}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={busy || newCode.length !== 6}
              onClick={() => void finish()}
            >
              {C.finish}
            </Button>
          )}
        </>
      }
    >
      {step === 1 ? (
        <>
          <p style={{ margin: 0, fontSize: 17, color: "var(--ink)", textWrap: "pretty" }}>
            {C.reenrolStep1}
          </p>
          <Input
            label={C.currentCode}
            hint={C.sixDigits}
            error={codeError}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(e) => {
              setCode(digits(e.target.value));
              setCodeError(undefined);
            }}
            data-testid="reenrol-current"
          />
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 17, color: "var(--ink)", textWrap: "pretty" }}>
            {C.reenrolStep2}
          </p>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 10,
              background: enrolled ? "#fff" : "var(--bg-sunken)",
              border: "1px dashed var(--line-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: enrolled ? 8 : 16,
              boxSizing: "border-box",
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            {enrolled ? (
              <img
                src={enrolled.qrCode}
                alt={C.enrolmentPlaceholder}
                width={144}
                height={144}
                style={{ display: "block" }}
              />
            ) : (
              C.enrolmentPlaceholder
            )}
          </div>
          {enrolled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{ADMIN_COPY.secretLabel}</span>
              <code style={{ fontSize: 15, wordBreak: "break-all", color: "var(--ink)" }}>
                {enrolled.secret}
              </code>
            </div>
          )}
          <Input
            label={C.newCode}
            hint={C.sixDigits}
            error={newError}
            value={newCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(e) => {
              setNewCode(digits(e.target.value));
              setNewError(undefined);
            }}
            data-testid="reenrol-new"
          />
        </>
      )}
    </SheetFrame>
  );
}
