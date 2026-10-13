// Handoff 61-S1 (Brief 60-S, the Account drawer; extraction 60-SETTINGS sections 3.2 and 3.10): the
// reads and writes behind Sign-in and security and Blocked members. Everything else the drawer
// touches already has its one path: the profile's audiences through src/lib/profile.ts
// (save_profile_section, 141, 212), the Messenger's settings through src/lib/messenger.ts
// (messenger_settings_set), the block through src/lib/blocks.ts (member_blocks, 186, 198, 211) and
// the email view through src/lib/notifications.ts. Nothing here opens a second way to any of them.
//
// Sessions: `sessions_list()` and `session_revoke(uuid)` (20261013120000) are security definer on
// auth.uid(). The current session is the `session_id` claim of the access token, which the function
// compares server-side; the client never names its own session. A device's browser and device words
// are made here from the user agent the function returns, and an IP address or a location never
// leaves the server (12C privacy rule 1).
//
// Identities and the email change are Supabase Auth's own: `getUserIdentities()`, `unlinkIdentity()`,
// `updateUser({ email })` with the project's secure email change (a confirmation to both addresses,
// 1668) and `resend({ type: "email_change" })`. Cancel the change is held out (1745; docs/GAPS.md).
import type { UserIdentity } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { PROVIDER_LABEL, type Provider } from "./auth-flow";
import { getSupabase, type Supabase } from "./supabase";

function sb(): Supabase {
  const c = getSupabase();
  if (!c) throw new Error("not in browser");
  return c;
}

// ---------------------------------------------------------------------------------------------------
// Devices (S10 to S19)
// ---------------------------------------------------------------------------------------------------

export type Device = {
  id: string;
  /** "Safari on iPhone": browser on device, from the user agent, nothing else. */
  label: string;
  /** ISO instant of the row's last activity (refreshed_at, else updated_at). */
  lastActiveAt: string;
  current: boolean;
};

export const SESSIONS_KEY = (memberId: string) => ["account", "sessions", memberId] as const;

type SessionRow = Database["public"]["Functions"]["sessions_list"]["Returns"][number];

/**
 * Browser on device, from a user agent string. Deliberately coarse: the row's job is to let a member
 * recognise a device of theirs, not to fingerprint it. An agent nothing here recognises reads as
 * "A browser on a device" rather than as a guess.
 */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const browser = /\bEdg(?:e|A|iOS)?\//.test(s)
    ? "Edge"
    : /\bOPR\/|\bOpera\b/.test(s)
      ? "Opera"
      : /\bFirefox\/|\bFxiOS\//.test(s)
        ? "Firefox"
        : /\bCriOS\/|\bChrome\//.test(s)
          ? "Chrome"
          : /\bSafari\//.test(s)
            ? "Safari"
            : "A browser";
  const device = /\biPhone\b/.test(s)
    ? "iPhone"
    : /\biPad\b/.test(s)
      ? "iPad"
      : /\bAndroid\b/.test(s)
        ? "Android"
        : /\bMacintosh\b|\bMac OS X\b/.test(s)
          ? "Mac"
          : /\bWindows\b/.test(s)
            ? "Windows"
            : /\bCrOS\b/.test(s)
              ? "Chromebook"
              : /\bLinux\b/.test(s)
                ? "Linux"
                : "a device";
  return browser + " on " + device;
}

export async function listSessions(): Promise<Device[]> {
  const { data, error } = await sb().rpc("sessions_list");
  if (error) throw error;
  return ((data ?? []) as SessionRow[]).map((r) => ({
    id: r.id,
    label: deviceLabel(r.user_agent),
    lastActiveAt: r.last_active_at,
    current: r.is_current,
  }));
}

/** Signs one other device out. The server refuses the current session and another member's row. */
export async function revokeSession(id: string): Promise<void> {
  const { error } = await sb().rpc("session_revoke", { p_session_id: id });
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------------
// The account's address and methods (A1 to A26, S2 to S9)
// ---------------------------------------------------------------------------------------------------

export type AccountUser = {
  email: string | null;
  /** The address a confirmation is pending for, while Supabase Auth holds one. */
  newEmail: string | null;
};

export const ACCOUNT_USER_KEY = (memberId: string) => ["account", "user", memberId] as const;
export const IDENTITIES_KEY = (memberId: string) => ["account", "identities", memberId] as const;

export async function loadAccountUser(): Promise<AccountUser> {
  const { data, error } = await sb().auth.getUser();
  if (error) throw error;
  const u = data.user;
  const pending = (u as { new_email?: string | null | undefined }).new_email ?? null;
  return { email: u.email ?? null, newEmail: pending && pending !== u.email ? pending : null };
}

export type Method =
  | { kind: "password"; set: boolean }
  | {
      kind: "provider";
      provider: Provider;
      label: string;
      identity: UserIdentity;
      /** A18: the address the provider carries, when it does. */
      email: string | null;
    };

export function isProvider(v: string): v is Provider {
  return v === "google" || v === "linkedin_oidc";
}

export async function loadIdentities(): Promise<UserIdentity[]> {
  const { data, error } = await sb().auth.getUserIdentities();
  if (error) throw error;
  return data?.identities ?? [];
}

/**
 * The three rows of Sign-in methods (A16), from the identities. A password reads Set when an email
 * identity exists, which is what Supabase Auth keeps for an account that signed up with an address
 * and a password. Whether setting a first password on a provider-only account adds that identity is
 * not read here; see docs/GAPS.md.
 */
export function methodsOf(identities: UserIdentity[]): Method[] {
  const hasEmail = identities.some((i) => i.provider === "email");
  const rows: Method[] = [{ kind: "password", set: hasEmail }];
  for (const provider of ["google", "linkedin_oidc"] as Provider[]) {
    const identity = identities.find((i) => i.provider === provider);
    if (!identity) continue;
    const d = (identity.identity_data ?? {}) as Record<string, unknown>;
    rows.push({
      kind: "provider",
      provider,
      label: PROVIDER_LABEL[provider],
      identity,
      email: typeof d["email"] === "string" ? d["email"] : null,
    });
  }
  return rows;
}

export async function unlinkProvider(identity: UserIdentity): Promise<void> {
  const { error } = await sb().auth.unlinkIdentity(identity);
  if (error) throw error;
}

/** A11: the confirmation to both addresses, under the project's secure email change (1668). */
export async function requestEmailChange(email: string): Promise<void> {
  const { error } = await sb().auth.updateUser({ email });
  if (error) throw error;
}

/** A4: the same two confirmations again. */
export async function resendEmailChange(email: string): Promise<void> {
  const { error } = await sb().auth.resend({ type: "email_change", email });
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------------
// Blocked members (B1 to B7)
// ---------------------------------------------------------------------------------------------------

export type BlockedRow = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarPath: string | null;
  blockedAt: string;
};

export const BLOCKED_KEY = (memberId: string) => ["account", "blocked", memberId] as const;

/**
 * The member's own member_blocks rows, each with the blocked member's row embedded through the
 * table's blocked_id foreign key. Both reads are existing projections under their own policies: the
 * blocker's rows (member_blocks_owner_select) and the member's core (members_member_select, which
 * admits every signed-in viewer to a member who is not Private). A Private blocked member's row is
 * therefore absent and the row renders without a name.
 */
export async function loadBlocked(viewerId: string): Promise<BlockedRow[]> {
  const { data, error } = await sb()
    .from("member_blocks")
    .select(
      "blocked_id, created_at, member:members!member_blocks_blocked_id_fkey(name, handle, avatar_path)",
    )
    .eq("blocker_id", viewerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const m = (
      r as { member?: { name?: string; handle?: string; avatar_path?: string | null } | null }
    ).member;
    return {
      id: r.blocked_id,
      name: m?.name ?? null,
      handle: m?.handle ?? null,
      avatarPath: m?.avatar_path ?? null,
      blockedAt: r.created_at,
    };
  });
}
