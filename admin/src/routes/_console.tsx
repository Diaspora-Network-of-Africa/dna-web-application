// The console's gate (handoff 40-B section 3). Signed out, every path lands on the sign-in. Signed
// in, the account's standing is read from public.admin_session_state() and the factor list, and
// exactly one of four screens renders: the refusal for an account with no live role, enrolment at
// aal1 with no verified factor, the code step at aal1 with one, and the shell at aal2. The read is
// repeated after every verification and whenever the session's token changes, because the aal is a
// claim of the token and the database answers from that claim (ruling 1265).
//
// Handoff 45-B Part C item 1: the chrome at aal2 is Strand's ConsoleShell (compile
// v1790885781186000, 1309), which replaced the empty Shell of 40-B. The gate is unchanged above it:
// ConsoleShell is the chrome at aal2 and nothing more. The staff name is the member's own, read the way the member app's
// shell reads it (useAuth's members row), and the role is the first live role's label from the
// platform_role_kinds vocabulary, never a label map in code.
//
// Handoff 45-D Part B: at aal2 the console also reads the vocabularies, the staff member's own
// Settings and the company's, and hands them to its pages through ConsoleProvider. The account's
// appearance is copied into this origin's storage as soon as it is read, so the next first paint
// is the account's (1393). Settings is the last navigation row (1410), and the page that is current
// follows the route. Sign out everywhere ends with the extraction's signed-out screen, which this
// gate renders after the session has gone, in place of the redirect to the sign-in.
//
// Handoff 45-E (1410, 1462, 1464): every live staff role reaches the shell with `access` full, so
// Settings is always available. The Overview row is shown only when the roles hold admin or analyst
// (1311), the projections' own gate, and a role without it that lands on the root is sent to
// Settings with replace, so Back never returns to a page it cannot see.
import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/strand/Button";
import { ConsoleShell } from "@/components/strand/ConsoleShell";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { loadVocabularies, type Vocabularies } from "@/lib/vocabularies";
import {
  readAdminState,
  signOutEverywhere as endEverySession,
  signOutHere,
  type AdminState,
} from "../lib/session";
import { ADMIN_COPY, CONSOLE_DESTINATIONS, OVERVIEW_ROLES, SETTINGS_COPY } from "../lib/copy";
import { ConsoleProvider, type ConsoleContext, type SettingsRead } from "../lib/console";
import { registerZones } from "../lib/overview";
import { readOrgSettings, readStaffSettings } from "../lib/settings";
import { setAppearanceCopy } from "../lib/theme";
import { CodeStep } from "../components/CodeStep";
import { Enrolment } from "../components/Enrolment";
import { Failure } from "../components/Failure";
import { Refusal } from "../components/Refusal";

export const Route = createFileRoute("/_console")({ component: Console });

type Read = { status: "pending" } | { status: "ready"; state: AdminState } | { status: "failed" };

function Console() {
  const { ready, session, member } = useAuth();
  const navigate = useNavigate();
  const [read, setRead] = useState<Read>({ status: "pending" });
  const [vocab, setVocab] = useState<Vocabularies | null>(null);
  const [settings, setSettings] = useState<SettingsRead>({ status: "loading" });
  const [signedOutEverywhere, setSignedOutEverywhere] = useState(false);
  const token = session?.access_token ?? null;
  const pathname = useLocation({ select: (l) => l.pathname });
  const current = pathname.replace(/\/+$/, "") === "/settings" ? "settings" : "overview";
  const roles = useMemo(() => (read.status === "ready" ? read.state.roles : []), [read]);
  const overview = roles.some((r) => (OVERVIEW_ROLES as readonly string[]).includes(r));

  useEffect(() => {
    if (ready && !session && !signedOutEverywhere) void navigate({ to: "/sign-in", replace: true });
  }, [ready, session, signedOutEverywhere, navigate]);

  const reread = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const state = await readAdminState(sb);
      setRead({ status: "ready", state });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "admin_session_state_failed",
          code: (error as { code?: string } | null)?.code ?? null,
        }),
      );
      setRead({ status: "failed" });
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setRead({ status: "pending" });
      return;
    }
    void reread();
  }, [token, reread]);

  // The role's label, and every option list, is vocabulary (1177, 1392): read once the shell is
  // about to render. A failed read leaves every list empty, never a literal (194).
  const atShell = read.status === "ready" && read.state.holds_role && read.state.aal === "aal2";
  useEffect(() => {
    if (!atShell) return;
    let live = true;
    loadVocabularies()
      .then((v) => {
        if (!live || !v) return;
        if (Array.isArray(v.reporting_zones)) registerZones(v.reporting_zones);
        setVocab(v);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [atShell]);

  // Both Settings rows, read together; the Overview waits on them for its zone and defaults.
  const [settingsRun, setSettingsRun] = useState(0);
  useEffect(() => {
    if (!atShell) return;
    const sb = getSupabase();
    if (!sb) return;
    let live = true;
    setSettings({ status: "loading" });
    Promise.all([readStaffSettings(sb), readOrgSettings(sb)])
      .then(([staff, org]) => {
        if (!live) return;
        setAppearanceCopy(staff.appearance);
        setSettings({ status: "ready", staff, org });
      })
      .catch((error: unknown) => {
        if (!live) return;
        console.warn(
          JSON.stringify({
            event: "admin_settings_read_failed",
            code: (error as { code?: string } | null)?.code ?? null,
          }),
        );
        setSettings({ status: "failed" });
      });
    return () => {
      live = false;
    };
  }, [atShell, settingsRun]);

  // A role without the Overview opens on Settings (1464).
  const toSettings = atShell && !overview && current === "overview";
  useEffect(() => {
    if (toSettings) void navigate({ to: "/settings", replace: true });
  }, [toSettings, navigate]);
  const destinations = useMemo(
    () =>
      overview ? CONSOLE_DESTINATIONS : CONSOLE_DESTINATIONS.filter((d) => d.id !== "overview"),
    [overview],
  );

  const roleLabels = useMemo<Record<string, string>>(
    () =>
      vocab && Array.isArray(vocab.platform_role_kinds)
        ? Object.fromEntries(vocab.platform_role_kinds.map((k) => [k.value, k.label]))
        : {},
    [vocab],
  );
  const name = member?.name ?? "";
  const context = useMemo<ConsoleContext>(
    () => ({
      roles,
      isAdmin: roles.includes("admin"),
      overview,
      name,
      settings,
      vocab,
      reloadSettings: () => setSettingsRun((n) => n + 1),
      setStaff: (staff) => setSettings((s) => (s.status === "ready" ? { ...s, staff } : s)),
      setOrg: (org) => setSettings((s) => (s.status === "ready" ? { ...s, org } : s)),
      signOutEverywhere: async () => {
        const sb = getSupabase();
        if (!sb) throw new Error("no client");
        setSignedOutEverywhere(true);
        try {
          await endEverySession(sb);
        } catch (error) {
          setSignedOutEverywhere(false);
          throw error;
        }
      },
    }),
    [roles, overview, name, settings, vocab],
  );

  // Extraction §2d S2: the signed-out screen, after every session has ended, this one included.
  if (signedOutEverywhere && ready && !session)
    return (
      <div
        data-testid="admin-signed-out-everywhere"
        style={{ minHeight: "100dvh", padding: "0 16px", boxSizing: "border-box" }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: "48px auto 0",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
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
            {SETTINGS_COPY.signedOutTitle}
          </h1>
          <p style={{ margin: 0, fontSize: 17, color: "var(--ink-2)", textWrap: "pretty" }}>
            {SETTINGS_COPY.signedOutLine}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setSignedOutEverywhere(false);
              void navigate({ to: "/sign-in", replace: true });
            }}
          >
            {SETTINGS_COPY.signInAgain}
          </Button>
        </div>
      </div>
    );

  // Nothing renders until the standing is known, so the shell never flashes before a refusal.
  if (!ready || !session) return null;
  if (read.status === "pending") return null;
  if (read.status === "failed") return <Failure onRetry={() => void reread()} />;
  const { state } = read;
  if (!state.holds_role) return <Refusal />;
  if (state.aal !== "aal2")
    return state.verified_factor ? (
      <CodeStep onVerified={() => void reread()} />
    ) : (
      <Enrolment onVerified={() => void reread()} />
    );
  if (toSettings) return null;
  const firstRole = state.roles[0];
  const role = firstRole ? (roleLabels[firstRole] ?? firstRole) : undefined;
  return (
    <div data-testid="admin-shell" data-access="full" style={{ height: "100dvh" }}>
      <ConsoleShell
        staff={{ name: member?.name ?? "", role }}
        destinations={destinations}
        current={current}
        word={ADMIN_COPY.shellHeading}
        access="full"
        menuTitle={ADMIN_COPY.menuTitle}
        onNavigate={(id) => {
          if (id === "overview") void navigate({ to: "/" });
          if (id === "settings") void navigate({ to: "/settings" });
        }}
        onSignOut={() => {
          const sb = getSupabase();
          if (sb) void signOutHere(sb);
        }}
        style={{ height: "100%" }}
      >
        <ConsoleProvider value={context}>
          <Outlet />
        </ConsoleProvider>
      </ConsoleShell>
    </div>
  );
}
