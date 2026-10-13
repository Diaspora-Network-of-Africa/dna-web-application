// Handoff 61-S1: the Account drawer's five panels and their second levels (EXTRACTION-60-SETTINGS
// sections 3.2 to 3.5 and 3.10). Every member-facing string here is the extraction's, verbatim;
// nothing is redesigned: Privacy mounts the profile's own VisibilitySelect (124) and Notifications
// mounts the notification panel's EmailPreferencesView (1552). Each panel owns its reads and its
// second-level state and tells the drawer, through `PanelHost`, which level is open, what its footer
// holds and what its error line reads, so one Sheet carries the lot (G86, G193).
//
// One read and one write path per piece (CLAUDE.md): the audiences through save_profile_section
// (141, 212), the Messenger's settings through messenger_settings_set, the block through
// src/lib/blocks.ts (186, 198, 211), the email view through src/lib/notifications.ts, and the devices
// through sessions_list and session_revoke (src/lib/account.ts). The password level is /password's
// logic moved here unchanged (230; handoff finding 3): verify the current password by a
// re-authentication, then updateUser, then signOutOtherSessions.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/strand/Avatar";
import type { Audience } from "@/components/strand/AudienceSelect";
import { Button } from "@/components/strand/Button";
import { EmptyState } from "@/components/strand/EmptyState";
import { Input } from "@/components/strand/Input";
import { Segment } from "@/components/strand/Segment";
import { Switch } from "@/components/strand/Switch";
import { EmailPreferencesView } from "@/components/dna/NotificationPanel";
import { PasswordField } from "@/components/dna/PasswordField";
import { AUD, VisibilitySelect } from "@/components/dna/VisibilitySelect";
import {
  ACCOUNT_USER_KEY,
  BLOCKED_KEY,
  IDENTITIES_KEY,
  SESSIONS_KEY,
  listSessions,
  loadAccountUser,
  loadBlocked,
  loadIdentities,
  methodsOf,
  requestEmailChange,
  resendEmailChange,
  revokeSession,
  unlinkProvider,
  type BlockedRow,
  type Method,
} from "@/lib/account";
import type { Member } from "@/lib/auth";
import {
  COPY,
  MIN_PASSWORD,
  isEmailShaped,
  passwordFault,
  passwordFaultCopy,
  signOutOtherSessions,
} from "@/lib/auth-flow";
import { unblockMember } from "@/lib/blocks";
import { TONES, toneFor } from "@/lib/emoji";
import { settingsSet } from "@/lib/messenger";
import { SETTINGS_KEY, useMessagingSettings } from "@/lib/messenger-inbox";
import { emailViewKey, loadEmailView } from "@/lib/notifications";
import {
  SECTION_KEYS,
  SECTION_TITLES,
  defaultAudience,
  loadProfile,
  saveSection,
  signedProfileUrl,
  type SectionKey,
} from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import { useThemeChoice, type ThemeChoice } from "@/lib/tier";
import { whenLabel, whenShort } from "@/lib/when";

export type LevelInfo = {
  /** Also the `data-opener` of the control that opened it, where Back and a finished write return. */
  key: string;
  title: string;
};

export type PanelHost = {
  member: Member;
  input: "touch" | "pointer";
  btnSize: "sm" | "md";
  level: LevelInfo | null;
  openLevel: (info: LevelInfo) => void;
  /** `opener` returns focus to the control that opened the level; `title` to the panel's title. */
  closeLevel: (to: "opener" | "title") => void;
  setFooter: (node: ReactNode) => void;
  setError: (line: string | null) => void;
  /** 1553: a panel that has nothing to draw resolves to the root. */
  toRoot: () => void;
};

const CAPS: CSSProperties = {
  fontSize: 13,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: "var(--ink-3)",
};
const ROW_TITLE: CSSProperties = { fontSize: 17, fontWeight: 500, lineHeight: 1.3 };
const SUB: CSSProperties = { fontSize: 15, lineHeight: 1.3, color: "var(--ink-3)" };
const LEAD: CSSProperties = { margin: 0, fontSize: 17, lineHeight: 1.5, textWrap: "pretty" };
const NOTE: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  color: "var(--ink-3)",
  textWrap: "pretty",
};
const SECTION: CSSProperties = { display: "flex", flexDirection: "column" };
const BETWEEN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
const rowStyle = (i: number): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "10px 0",
  borderTop: i ? "1px solid var(--line)" : "none",
});

/** SPEC 4.4 (1566): how long "Saved" stays before the line clears, as the notification panel keeps it. */
const SAVED_MS = 2400;

type RowState = { status: "saving" } | { status: "saved" } | { status: "failed"; prev: string };

/** V4, M5, M6: one line per row, 56-NC's pattern (P9 to P11). The failed line names the previous value. */
function useRowLines() {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const timers = useRef<Record<string, number>>({});
  const seq = useRef<Record<string, number>>({});
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach((id) => window.clearTimeout(id));
  }, []);
  const begin = (key: string) => {
    const n = (seq.current[key] ?? 0) + 1;
    seq.current[key] = n;
    window.clearTimeout(timers.current[key]);
    setRows((r) => ({ ...r, [key]: { status: "saving" } }));
    return n;
  };
  const current = (key: string, n: number) => seq.current[key] === n;
  const saved = (key: string) => {
    setRows((r) => ({ ...r, [key]: { status: "saved" } }));
    timers.current[key] = window.setTimeout(() => {
      setRows((r) => {
        if (r[key]?.status !== "saved") return r;
        const next = { ...r };
        delete next[key];
        return next;
      });
    }, SAVED_MS);
  };
  const failed = (key: string, prev: string) =>
    setRows((r) => ({ ...r, [key]: { status: "failed", prev } }));
  const line = (key: string): { text: string; failed: boolean } => {
    const st = rows[key];
    if (!st) return { text: "", failed: false };
    if (st.status === "saving") return { text: "Saving", failed: false };
    if (st.status === "saved") return { text: "Saved", failed: false };
    return { text: "Did not save. Still " + st.prev + ".", failed: true };
  };
  return { begin, current, saved, failed, line };
}

function Line({ text, failed, testid }: { text: string; failed: boolean; testid?: string }) {
  return (
    <span
      role={failed ? "alert" : "status"}
      data-testid={testid}
      style={{
        fontSize: 13,
        lineHeight: "18px",
        minHeight: 18,
        color: failed ? "var(--error)" : "var(--ink-3)",
      }}
    >
      {text}
    </span>
  );
}

function DidNotLoad({
  line,
  onRetry,
  size,
  testid,
}: {
  line: string;
  onRetry: () => void;
  size: "sm" | "md";
  testid: string;
}) {
  return (
    <div
      role="status"
      data-testid={testid}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        padding: "8px 0",
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>{line}</span>
      <Button variant="ghost" size={size} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** 1553, 1395: whether any category carries email copy today. */
export function useEmailCopy(member: Member): boolean | null {
  const q = useQuery({ queryKey: emailViewKey(member.id), queryFn: loadEmailView });
  if (!q.data) return q.isError ? false : null;
  return q.data.some((e) => e.hasCopy);
}

/** A second level's footer lives in the drawer's Sheet; the panel sets it from here, rebuilt only
 *  when the state it closes over changes, because a node rebuilt on every render would set the
 *  drawer's state on every render. */
function useLevelFooter(host: PanelHost, active: boolean, make: () => ReactNode, deps: unknown[]) {
  const { setFooter } = host;
  useEffect(() => {
    if (!active) return;
    setFooter(make());
    return () => setFooter(null);
    // `make` reads the deps the caller names; nothing else it closes over changes the footer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, setFooter, ...deps]);
}

// ---------------------------------------------------------------------------------------------------
// Sign-in and security (3.2)
// ---------------------------------------------------------------------------------------------------

export function SecurityPanel({
  host,
  openLevel,
}: {
  host: PanelHost;
  openLevel?: "password" | undefined;
}) {
  const { member, btnSize, level } = host;
  const qc = useQueryClient();
  const user = useQuery({ queryKey: ACCOUNT_USER_KEY(member.id), queryFn: loadAccountUser });
  const identities = useQuery({ queryKey: IDENTITIES_KEY(member.id), queryFn: loadIdentities });
  const sessions = useQuery({ queryKey: SESSIONS_KEY(member.id), queryFn: listSessions });
  const methods: Method[] = methodsOf(identities.data ?? []);
  const hasPassword = methods.some((m) => m.kind === "password" && m.set);
  const providers = methods.filter((m) => m.kind === "provider");
  // A21: the guard while one provider is the only method.
  const onlyProvider =
    identities.isSuccess && !hasPassword && providers.length === 1 ? providers[0] : null;
  const email = user.data?.email ?? member.email ?? "";
  const pending = user.data?.newEmail ?? null;

  // Handoff finding 3: `/password` lands here with the password level open, once.
  const opened = useRef(false);
  useEffect(() => {
    if (openLevel !== "password" || opened.current) return;
    opened.current = true;
    host.openLevel({
      key: "password",
      title: hasPassword ? "Change your password" : "Set a password",
    });
    // The title follows the identities once they answer; the level itself opens at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLevel]);
  useEffect(() => {
    if (level?.key !== "password" || !identities.isSuccess) return;
    const title = hasPassword ? "Change your password" : "Set a password";
    if (level.title !== title) host.openLevel({ key: "password", title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identities.isSuccess, hasPassword]);

  // ----- the email change (A1 to A14) -----
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const openEmail = () => {
    setNewEmail("");
    setEmailError(null);
    host.openLevel({ key: "email", title: "Change your email address" });
  };
  const sendEmail = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (!isEmailShaped(newEmail)) {
      setEmailError("Enter an email address.");
      return;
    }
    setSending(true);
    host.setError(null);
    try {
      await requestEmailChange(newEmail.trim());
      await qc.invalidateQueries({ queryKey: ACCOUNT_USER_KEY(member.id) });
      host.closeLevel("opener");
    } catch {
      host.setError("That did not send. Try again.");
    } finally {
      setSending(false);
    }
  };
  const resend = async () => {
    if (!pending) return;
    try {
      await resendEmailChange(pending);
      setResent(true);
      window.setTimeout(() => setResent(false), SAVED_MS);
    } catch {
      host.setError("That did not send. Try again.");
    }
  };
  useLevelFooter(
    host,
    level?.key === "email",
    () => (
      <Button disabled={sending} onClick={() => void sendEmail()} data-testid="email-send">
        {sending ? "Sending" : "Send confirmation"}
      </Button>
    ),
    [sending, newEmail],
  );

  // ----- unlink (A20 to A26) -----
  const [unlinking, setUnlinking] = useState(false);
  const unlinkTarget =
    level?.key === "unlink"
      ? providers.find((p) => p.label === level.title.replace(/^Unlink (.*)\?$/, "$1"))
      : undefined;
  const openUnlink = (m: Extract<Method, { kind: "provider" }>) =>
    host.openLevel({ key: "unlink", title: "Unlink " + m.label + "?" });
  const doUnlink = async () => {
    if (!unlinkTarget || unlinking) return;
    setUnlinking(true);
    host.setError(null);
    try {
      await unlinkProvider(unlinkTarget.identity);
      await qc.invalidateQueries({ queryKey: IDENTITIES_KEY(member.id) });
      host.closeLevel("title");
    } catch {
      host.setError(unlinkTarget.label + " was not unlinked. Try again.");
    } finally {
      setUnlinking(false);
    }
  };
  useLevelFooter(
    host,
    level?.key === "unlink",
    () => (
      <>
        <Button variant="secondary" onClick={() => host.closeLevel("opener")}>
          Keep
        </Button>
        <Button
          disabled={unlinking || !unlinkTarget}
          onClick={() => void doUnlink()}
          data-testid="unlink-confirm"
        >
          {(unlinking ? "Unlinking " : "Unlink ") + (unlinkTarget?.label ?? "")}
        </Button>
      </>
    ),
    [unlinking, unlinkTarget?.identity.identity_id ?? unlinkTarget?.label],
  );
  const unlinkLead = (() => {
    if (!unlinkTarget) return "";
    const others = [
      hasPassword ? "your password" : null,
      ...providers.filter((p) => p !== unlinkTarget).map((p) => p.label),
    ].filter((v): v is string => !!v);
    return (
      "You will sign in with " +
      others.join(" or ") +
      " instead. You can link " +
      unlinkTarget.label +
      " again any time."
    );
  })();

  // ----- the password (S2 to S9; /password's logic, 230, 414) -----
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwFlag, setPwFlag] = useState<{
    field: "current" | "new" | "confirm";
    line: string;
  } | null>(null);
  const [changing, setChanging] = useState(false);
  const [pwChanged, setPwChanged] = useState(false);
  const openPassword = () => {
    setCur("");
    setPw("");
    setPw2("");
    setPwFlag(null);
    host.openLevel({
      key: "password",
      title: hasPassword ? "Change your password" : "Set a password",
    });
  };
  const submitPassword = async (e?: FormEvent) => {
    e?.preventDefault();
    const sb = getSupabase();
    if (!sb || changing) return;
    setPwFlag(null);
    if (pw.length < MIN_PASSWORD) {
      setPwFlag({ field: "new", line: COPY.tooShort });
      return;
    }
    if (pw !== pw2) {
      setPwFlag({ field: "confirm", line: COPY.differ });
      return;
    }
    setChanging(true);
    try {
      if (hasPassword) {
        // Supabase does not require the current password to change it, so the check the copy
        // promises is made here: a re-authentication that fails is the wrong-current-password state.
        if (!email) return;
        const { error: reauth } = await sb.auth.signInWithPassword({ email, password: cur });
        if (reauth) {
          setPwFlag({ field: "current", line: COPY.wrongCurrent });
          return;
        }
      }
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        // Ruling 414 (W22): the line matches the server's reason, never a guess from a fragment.
        setPwFlag({ field: "new", line: passwordFaultCopy(passwordFault(error)) });
        return;
      }
      // Re-authenticating opened a fresh session for this device, so `others` now covers both the
      // session this device held before and every real other device (230).
      await signOutOtherSessions(sb);
      setPwChanged(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: IDENTITIES_KEY(member.id) }),
        qc.invalidateQueries({ queryKey: SESSIONS_KEY(member.id) }),
      ]);
      host.closeLevel("opener");
    } finally {
      setChanging(false);
    }
  };
  useLevelFooter(
    host,
    level?.key === "password",
    () => (
      <Button
        disabled={changing}
        onClick={() => void submitPassword()}
        data-testid="password-submit"
      >
        {hasPassword
          ? changing
            ? "Changing"
            : "Change password"
          : changing
            ? "Setting your password"
            : "Set password"}
      </Button>
    ),
    [changing, hasPassword, cur, pw, pw2, email],
  );

  // ----- devices (S10 to S19) -----
  const [outing, setOuting] = useState<string | null>(null);
  const [outFailed, setOutFailed] = useState<string | null>(null);
  const [othersBusy, setOthersBusy] = useState(false);
  const signOutDevice = async (id: string) => {
    setOuting(id);
    setOutFailed(null);
    try {
      await revokeSession(id);
      await qc.invalidateQueries({ queryKey: SESSIONS_KEY(member.id) });
    } catch {
      setOutFailed(id);
    } finally {
      setOuting(null);
    }
  };
  const doOthers = async () => {
    const sb = getSupabase();
    if (!sb || othersBusy) return;
    setOthersBusy(true);
    host.setError(null);
    const ok = await signOutOtherSessions(sb);
    setOthersBusy(false);
    if (!ok) {
      host.setError("The other devices were not signed out. Try again.");
      return;
    }
    await qc.invalidateQueries({ queryKey: SESSIONS_KEY(member.id) });
    host.closeLevel("title");
  };
  useLevelFooter(
    host,
    level?.key === "others",
    () => (
      <>
        <Button variant="secondary" onClick={() => host.closeLevel("opener")}>
          Keep
        </Button>
        <Button disabled={othersBusy} onClick={() => void doOthers()} data-testid="others-confirm">
          {othersBusy ? "Signing out" : "Sign out others"}
        </Button>
      </>
    ),
    [othersBusy],
  );

  // ----- the second levels -----
  if (level?.key === "email")
    return (
      <form
        onSubmit={(e) => void sendEmail(e)}
        noValidate
        aria-busy={sending}
        data-testid="email-change"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <p style={LEAD}>
          We send a confirmation to your current address and to the new one. Your email changes when
          you have opened both. Until then you sign in with the current one.
        </p>
        <Input
          label="New email address"
          type="email"
          name="email"
          autoComplete="email"
          value={newEmail}
          onChange={(e) => {
            setNewEmail(e.target.value);
            setEmailError(null);
          }}
          error={emailError ?? undefined}
        />
        <button type="submit" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      </form>
    );
  if (level?.key === "unlink") return <p style={LEAD}>{unlinkLead}</p>;
  if (level?.key === "password")
    return (
      <form
        onSubmit={(e) => void submitPassword(e)}
        noValidate
        aria-busy={changing}
        data-testid="password"
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <p style={LEAD}>
          {hasPassword
            ? "Enter your current password, then the new one twice."
            : "Choose a password for signing in with your email. Google keeps working."}
        </p>
        {hasPassword && (
          <PasswordField
            label="Current password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            autoComplete="current-password"
            error={pwFlag?.field === "current" ? pwFlag.line : undefined}
            required
          />
        )}
        <PasswordField
          label="New password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
          hint="At least ten characters. A phrase you can remember beats a word you will forget."
          error={pwFlag?.field === "new" ? pwFlag.line : undefined}
          required
        />
        {/* Ruling 392: the eye toggle is inside each field; the Show passwords checkbox is gone. */}
        <PasswordField
          label="Confirm new password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password"
          error={pwFlag?.field === "confirm" ? pwFlag.line : undefined}
          required
        />
        <button type="submit" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      </form>
    );
  if (level?.key === "others")
    return (
      <p style={LEAD}>Every other device will need to sign in again. This one stays signed in.</p>
    );

  // ----- the panel -----
  const current = (sessions.data ?? []).find((d) => d.current) ?? null;
  const others = (sessions.data ?? []).filter((d) => !d.current);
  return (
    <div data-drawer-panel="security" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section aria-label="Email address" style={{ ...SECTION, gap: 8 }}>
        <span style={CAPS}>Email address</span>
        <div style={BETWEEN}>
          <span style={{ fontSize: 17, lineHeight: 1.4, minWidth: 0, overflowWrap: "anywhere" }}>
            {email}
          </span>
          <Button variant="ghost" size={btnSize} data-opener="email" onClick={openEmail}>
            Change
          </Button>
        </div>
        {pending && (
          <div
            role="status"
            data-testid="email-pending"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingTop: 10,
              borderTop: "1px solid var(--line)",
            }}
          >
            <span
              style={{ fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)", textWrap: "pretty" }}
            >
              A confirmation is on its way to{" "}
              <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{email}</strong> and to{" "}
              <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{pending}</strong>. Your
              email changes when you have opened both.
            </span>
            {/* A6, Cancel the change, is held out (1745; docs/GAPS.md). */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="ghost" size={btnSize} onClick={() => void resend()}>
                {resent ? "Sent again" : "Resend"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Sign-in methods" style={SECTION}>
        <span style={{ ...CAPS, paddingBottom: 4 }}>Sign-in methods</span>
        {methods.map((m, i) => (
          <div
            key={m.kind === "password" ? "password" : m.provider}
            data-testid="method-row"
            data-method={m.kind === "password" ? "password" : m.provider}
            style={{
              ...BETWEEN,
              padding: "10px 0",
              borderTop: i ? "1px solid var(--line)" : "none",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={ROW_TITLE}>{m.kind === "password" ? "Password" : m.label}</span>
              <span style={{ ...SUB, overflowWrap: "anywhere" }}>
                {m.kind === "password"
                  ? m.set
                    ? "Set"
                    : "Not set"
                  : m.email
                    ? "Linked as " + m.email
                    : "Linked"}
              </span>
            </span>
            {m.kind === "password" ? (
              <Button
                variant="ghost"
                size={btnSize}
                data-opener="password"
                data-testid="password-open"
                onClick={openPassword}
              >
                {m.set ? "Change" : "Set a password"}
              </Button>
            ) : (
              // 1744: no Link act. Unlink is offered only while another method remains.
              (identities.data?.length ?? 0) > 1 && (
                <Button
                  variant="ghost"
                  size={btnSize}
                  data-opener="unlink"
                  data-testid="unlink-open"
                  onClick={() => openUnlink(m)}
                >
                  Unlink
                </Button>
              )
            )}
          </div>
        ))}
        {onlyProvider && (
          <span role="status" data-testid="method-guard" style={{ ...NOTE, paddingTop: 8 }}>
            Set a password or link another method before unlinking {onlyProvider.label}.
          </span>
        )}
        {pwChanged && (
          <span
            role="status"
            data-testid="password-changed"
            style={{
              paddingTop: 8,
              fontSize: 15,
              lineHeight: 1.5,
              color: "var(--ink-2)",
              textWrap: "pretty",
            }}
          >
            Your password is changed. You stay signed in here. Any other device signed in with the
            old password has been signed out.
          </span>
        )}
      </section>

      <section aria-label="Signed-in devices" style={SECTION}>
        <span style={{ ...CAPS, paddingBottom: 4 }}>Signed-in devices</span>
        {sessions.isError ? (
          <DidNotLoad
            line="Your devices did not load."
            size={btnSize}
            testid="devices-failed"
            onRetry={() => void qc.invalidateQueries({ queryKey: SESSIONS_KEY(member.id) })}
          />
        ) : sessions.isSuccess ? (
          <>
            {current && (
              <div
                data-testid="device-row"
                data-current="1"
                style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0" }}
              >
                <span style={ROW_TITLE}>{current.label}</span>
                <span style={SUB}>This device · Active now</span>
              </div>
            )}
            {others.map((d, i) => (
              <div
                key={d.id}
                data-testid="device-row"
                data-session={d.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "10px 0",
                  borderTop: i || current ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={BETWEEN}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={ROW_TITLE}>{d.label}</span>
                    <span style={SUB}>Last active {whenLabel(d.lastActiveAt)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size={btnSize}
                    disabled={outing === d.id}
                    onClick={() => void signOutDevice(d.id)}
                  >
                    {outing === d.id ? "Signing out" : "Sign out"}
                  </Button>
                </div>
                {outFailed === d.id && (
                  <span
                    role="alert"
                    style={{ fontSize: 13, lineHeight: "18px", color: "var(--error)" }}
                  >
                    That device was not signed out. Try again.
                  </span>
                )}
              </div>
            ))}
            {others.length === 0 ? (
              <div
                style={{ padding: "10px 0", borderTop: current ? "1px solid var(--line)" : "none" }}
              >
                <span data-testid="devices-only-this" style={NOTE}>
                  Only this device is signed in.
                </span>
              </div>
            ) : (
              <div style={{ padding: "12px 0 0", borderTop: "1px solid var(--line)" }}>
                <Button
                  variant="secondary"
                  size={btnSize}
                  data-opener="others"
                  data-testid="others-open"
                  onClick={() =>
                    host.openLevel({ key: "others", title: "Sign out all other devices?" })
                  }
                >
                  Sign out all other devices
                </Button>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Privacy (3.3)
// ---------------------------------------------------------------------------------------------------

export function PrivacyPanel({ host }: { host: PanelHost }) {
  const { member, btnSize } = host;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const handle = member.handle ?? "";
  const profile = useQuery({
    queryKey: ["profile", handle, false],
    queryFn: () => loadProfile(handle, false),
    enabled: !!handle,
  });
  const messaging = useMessagingSettings(member);
  const lines = useRowLines();
  const [localVis, setLocalVis] = useState<Partial<Record<SectionKey, Audience>>>({});
  const vis = { ...(profile.data?.visibility ?? {}), ...localVis };
  const audienceLabel = (a: Audience) => AUD.find((x) => x.value === a)?.label ?? a;

  // The one write path (141, 212): save_profile_section('visibility', { section, audience }), one
  // row at a time; a failed save returns the row to its previous value with its line (V4).
  const setVisibility = (section: SectionKey, audience: Audience) => {
    const prev = vis[section] ?? defaultAudience(section);
    if (prev === audience) return;
    const n = lines.begin(section);
    setLocalVis((v) => ({ ...v, [section]: audience }));
    void saveSection("visibility", { section, audience }).then(
      () => {
        if (!lines.current(section, n)) return;
        lines.saved(section);
        void qc.invalidateQueries({ queryKey: ["profile", handle, false] });
        void qc.invalidateQueries({ queryKey: ["profile", handle] });
      },
      () => {
        if (!lines.current(section, n)) return;
        setLocalVis((v) => ({ ...v, [section]: prev }));
        lines.failed(section, audienceLabel(prev));
      },
    );
  };

  // M1, M2, M5 and Link previews (1672 item 12): the Messenger's settings through messenger_settings_set.
  const [localMsg, setLocalMsg] = useState<{ receipts?: boolean; linkPreviews?: boolean }>({});
  const receipts = localMsg.receipts ?? !!messaging.data?.receipts_enabled;
  const linkPreviews = localMsg.linkPreviews ?? !!messaging.data?.link_previews_enabled;
  const setMessaging = (key: "receipts" | "linkPreviews", on: boolean) => {
    const prev = key === "receipts" ? receipts : linkPreviews;
    if (prev === on) return;
    const n = lines.begin(key);
    setLocalMsg((m) => ({ ...m, [key]: on }));
    void settingsSet({ [key]: on }).then(
      (row) => {
        if (!lines.current(key, n)) return;
        qc.setQueryData(SETTINGS_KEY(member.id), row);
        setLocalMsg((m) => {
          const next = { ...m };
          delete next[key];
          return next;
        });
        lines.saved(key);
      },
      () => {
        if (!lines.current(key, n)) return;
        setLocalMsg((m) => ({ ...m, [key]: prev }));
        lines.failed(key, prev ? "On" : "Off");
      },
    );
  };

  const receiptsLine = lines.line("receipts");
  const previewsLine = lines.line("linkPreviews");
  return (
    <div data-drawer-panel="privacy" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section aria-label="Profile visibility" style={{ ...SECTION, gap: 8 }}>
        <span style={CAPS}>Profile visibility</span>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--ink-2)",
            textWrap: "pretty",
          }}
        >
          Who sees each part of your profile. Your name, handle, headline and portrait are always
          visible.
        </p>
        {profile.isError || (profile.isSuccess && !profile.data) ? (
          <DidNotLoad
            line="Your profile did not load."
            size={btnSize}
            testid="visibility-failed"
            onRetry={() => void qc.invalidateQueries({ queryKey: ["profile", handle, false] })}
          />
        ) : profile.data ? (
          <>
            <div style={SECTION}>
              {SECTION_KEYS.map((id, i) => {
                const title =
                  id === "stance"
                    ? (profile.data?.member.stance_label ?? SECTION_TITLES.stance)
                    : SECTION_TITLES[id];
                const l = lines.line(id);
                return (
                  <div
                    key={id}
                    role="group"
                    aria-label={title}
                    data-testid="visibility-row"
                    data-section={id}
                    style={rowStyle(i)}
                  >
                    <div style={BETWEEN}>
                      <span style={ROW_TITLE}>{title}</span>
                      <VisibilitySelect
                        value={vis[id] ?? defaultAudience(id)}
                        onChange={(v) => setVisibility(id, v)}
                      />
                    </div>
                    <Line text={l.text} failed={l.failed} />
                  </div>
                );
              })}
            </div>
            <a
              href={"/m/" + handle}
              onClick={(e) => {
                e.preventDefault();
                void navigate({ to: "/m/$handle", params: { handle }, search: {} });
              }}
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                fontSize: 15,
                fontWeight: 500,
                color: "var(--ink)",
                textDecoration: "underline",
                textDecorationColor: "var(--line-strong)",
                textUnderlineOffset: 2,
              }}
            >
              Open your profile
            </a>
          </>
        ) : null}
      </section>

      <section aria-label="Messaging" style={{ ...SECTION, gap: 6 }}>
        <span style={{ ...CAPS, paddingBottom: 4 }}>Messaging</span>
        <Switch
          label="Read receipts"
          checked={receipts}
          disabled={!messaging.data}
          onChange={(on) => setMessaging("receipts", on)}
          style={{ display: "flex", width: "100%", fontWeight: 500 }}
        />
        <span style={NOTE}>
          Show when you have read a message, and see when others have read yours.
        </span>
        <Line text={receiptsLine.text} failed={receiptsLine.failed} testid="receipts-line" />
        {/* 1672 item 12: Link previews, the other setting the old account panel held, placed beside
            Read receipts as the Messenger's second privacy setting. The extraction places no sentence
            under it, so none is drawn. */}
        <Switch
          label="Link previews"
          checked={linkPreviews}
          disabled={!messaging.data}
          onChange={(on) => setMessaging("linkPreviews", on)}
          style={{ display: "flex", width: "100%", fontWeight: 500, marginTop: 8 }}
        />
        <Line text={previewsLine.text} failed={previewsLine.failed} testid="previews-line" />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Preferences (3.5)
// ---------------------------------------------------------------------------------------------------

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function PreferencesPanel({ host }: { host: PanelHost }) {
  const { member } = host;
  const qc = useQueryClient();
  const [choice, setChoice] = useThemeChoice();
  const messaging = useMessagingSettings(member);
  const lines = useRowLines();
  const [localTone, setLocalTone] = useState<string | null | undefined>(undefined);
  const tone = toneFor(localTone === undefined ? messaging.data?.reaction_skin_tone : localTone);
  // 1576: the tone names come from where the Messenger reads them (src/lib/emoji.ts, TONES).
  const setTone = (modifier: string | null) => {
    const prev = tone;
    if (prev.modifier === modifier) return;
    const n = lines.begin("tone");
    setLocalTone(modifier);
    void settingsSet({ skinTone: modifier ?? "none" }).then(
      (row) => {
        if (!lines.current("tone", n)) return;
        qc.setQueryData(SETTINGS_KEY(member.id), row);
        setLocalTone(undefined);
        lines.saved("tone");
      },
      () => {
        if (!lines.current("tone", n)) return;
        setLocalTone(prev.modifier);
        lines.failed("tone", prev.label);
      },
    );
  };
  const toneLine = lines.line("tone");
  return (
    <div
      data-drawer-panel="preferences"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <section aria-label="Appearance" style={{ ...SECTION, gap: 10 }}>
        <span style={CAPS}>Appearance</span>
        <span style={ROW_TITLE}>Theme</span>
        <Segment
          options={THEME_OPTIONS}
          value={choice}
          label="Theme"
          onChange={(v) => setChoice(v as ThemeChoice)}
        />
        <span style={NOTE}>System follows your device.</span>
      </section>
      <section aria-label="Messaging" style={{ ...SECTION, gap: 10 }}>
        <span style={CAPS}>Messaging</span>
        <span style={ROW_TITLE}>Reaction skin tone</span>
        <div
          role="radiogroup"
          aria-label="Reaction skin tone"
          aria-disabled={!messaging.data || undefined}
          style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
        >
          {TONES.map((t) => {
            const on = t.key === tone.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t.label}
                data-tone={t.key}
                disabled={!messaging.data}
                onClick={() => setTone(t.modifier)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  width: 44,
                  height: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-pill)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxSizing: "border-box",
                    outline: on ? "2px solid var(--ink)" : "1px solid var(--line)",
                    outlineOffset: 2,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "var(--radius-pill)",
                      background: t.hex ?? "var(--ink-4)",
                      display: "block",
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <span data-testid="tone-name" style={NOTE}>
          {tone.label}
        </span>
        <Line text={toneLine.text} failed={toneLine.failed} testid="tone-line" />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Notifications (3.4): 56-NC's email preferences view, the second entry to one control (1552).
// ---------------------------------------------------------------------------------------------------

export function NotificationsPanel({ host }: { host: PanelHost }) {
  const hasCopy = useEmailCopy(host.member);
  const { toRoot } = host;
  const resolved = useRef(false);
  // 1553: while no category carries email copy there is no panel; the route resolves to the root.
  useEffect(() => {
    if (hasCopy !== false || resolved.current) return;
    resolved.current = true;
    toRoot();
  }, [hasCopy, toRoot]);
  if (!hasCopy) return null;
  return (
    <div
      data-drawer-panel="notifications"
      style={{ display: "flex", flexDirection: "column", margin: "0 -16px" }}
    >
      <EmailPreferencesView member={host.member} btnSize={host.btnSize} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Blocked members (3.10)
// ---------------------------------------------------------------------------------------------------

export function BlockedPanel({ host }: { host: PanelHost }) {
  const { member, btnSize, level } = host;
  const qc = useQueryClient();
  const blocked = useQuery({
    queryKey: BLOCKED_KEY(member.id),
    queryFn: () => loadBlocked(member.id),
  });
  const [target, setTarget] = useState<BlockedRow | null>(null);
  const [busy, setBusy] = useState(false);
  const first = (name: string | null) => (name ?? "").split(/\s+/)[0] || "This member";
  const openUnblock = (row: BlockedRow) => {
    setTarget(row);
    host.openLevel({ key: "unblock-" + row.id, title: "Unblock " + (row.name ?? "this member") });
  };
  // B4A's write (src/lib/blocks.ts): the row goes, edges are not restored (211), nothing is told to
  // the other party and no toast is raised (198).
  const doUnblock = async () => {
    if (!target || busy) return;
    setBusy(true);
    host.setError(null);
    try {
      await unblockMember(member.id, target.id);
      await qc.invalidateQueries({ queryKey: BLOCKED_KEY(member.id) });
      setTarget(null);
      host.closeLevel("title");
    } catch {
      host.setError(first(target.name) + " was not unblocked. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const unblockOpen = !!level && level.key.startsWith("unblock-");
  useLevelFooter(
    host,
    unblockOpen,
    () => (
      <>
        <Button
          variant="secondary"
          onClick={() => host.closeLevel("opener")}
          data-testid="unblock-cancel"
        >
          Cancel
        </Button>
        <Button
          disabled={busy || !target}
          onClick={() => void doUnblock()}
          data-testid="unblock-confirm"
        >
          {(busy ? "Unblocking " : "Unblock ") + first(target?.name ?? null)}
        </Button>
      </>
    ),
    [busy, target?.id, target?.name],
  );

  if (unblockOpen && target) {
    const f = first(target.name);
    return (
      <div
        data-testid="unblock-sheet"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontSize: 17,
          lineHeight: 1.5,
          textWrap: "pretty",
        }}
      >
        <p style={{ margin: 0 }}>
          {f} can find you and reach you on DNA again, and sees your profile as any member does.
        </p>
        <p style={{ margin: 0 }}>
          Your connection and follow do not come back. They must be re-made.
        </p>
        <p style={{ margin: 0, fontSize: 15, color: "var(--ink-3)" }}>{f} is not told.</p>
      </div>
    );
  }

  if (blocked.isError)
    return (
      <div data-drawer-panel="blocked">
        <DidNotLoad
          line="Your blocked members did not load."
          size={btnSize}
          testid="blocked-failed"
          onRetry={() => void qc.invalidateQueries({ queryKey: BLOCKED_KEY(member.id) })}
        />
      </div>
    );
  if (!blocked.data) return null;
  if (blocked.data.length === 0)
    return (
      <div
        data-drawer-panel="blocked"
        data-testid="blocked-empty"
        style={{ margin: -20, display: "flex", flexDirection: "column", flex: 1, minHeight: 320 }}
      >
        <EmptyState
          c="brand"
          title="No blocked members."
          body="Block a member from their profile and they appear here."
        />
      </div>
    );
  return (
    <div data-drawer-panel="blocked" style={SECTION}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 15,
          lineHeight: 1.5,
          color: "var(--ink-2)",
          textWrap: "pretty",
        }}
      >
        Members you blocked. They cannot find you or reach you on DNA.
      </p>
      {blocked.data.map((b, i) => (
        <BlockedListRow
          key={b.id}
          row={b}
          index={i}
          size={btnSize}
          onUnblock={() => openUnblock(b)}
        />
      ))}
    </div>
  );
}

function BlockedListRow({
  row,
  index,
  size,
  onUnblock,
}: {
  row: BlockedRow;
  index: number;
  size: "sm" | "md";
  onUnblock: () => void;
}) {
  // Avatar is the identity-mark exception (1714): it fills its shape, centred, from a signed URL.
  const url = useQuery({
    queryKey: ["profile-media", row.avatarPath],
    queryFn: () => signedProfileUrl(row.avatarPath),
    enabled: !!row.avatarPath,
  });
  return (
    <div data-testid="blocked-row" data-member={row.id} style={rowStyle(index)}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={row.name ?? ""} src={url.data} size={32} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={ROW_TITLE}>{row.name ?? "A member"}</span>
            <span style={{ fontSize: 13, lineHeight: 1.3, color: "var(--ink-3)" }}>
              Blocked {whenShort(row.blockedAt)}
            </span>
          </span>
        </span>
        <Button
          variant="ghost"
          size={size}
          data-opener={"unblock-" + row.id}
          data-testid="unblock-open"
          onClick={onUnblock}
        >
          Unblock
        </Button>
      </div>
    </div>
  );
}
