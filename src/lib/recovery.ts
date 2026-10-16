// Ruling 240: a valid recovery token reaches the app, no route reads it, and the member lands on
// the Feed already signed in without ever being asked for a password. This module is the half of
// the fix that does not depend on console configuration.
//
// Supabase's client is created with detectSessionInUrl, so the recovery fragment becomes a session
// and is then stripped from the URL. The capture below runs before createClient (getSupabase calls
// it first) and records what the fragment was, so the app still knows a recovery is in flight after
// supabase-js has consumed it. The gate in __root.tsx then holds every route at /reset/new until a
// password is set. Registering /reset/new as the recovery redirect in Supabase's URL configuration
// is the other half; this one holds even when the token lands on the Site URL instead.
const KEY = "dna.auth.recovery";
/** Reset links last one hour (handoff section 2). A flag older than that cannot be a live recovery. */
const TTL_MS = 60 * 60 * 1000;

export type RecoveryState = "none" | "pending" | "expired";
type Stored = { state: Exclude<RecoveryState, "none">; at: number };

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    if (!v || (v.state !== "pending" && v.state !== "expired") || typeof v.at !== "number")
      return null;
    if (Date.now() - v.at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

function write(state: Exclude<RecoveryState, "none">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ state, at: Date.now() } satisfies Stored));
  } catch {
    /* storage unavailable: the in-URL fragment still routes this load correctly. */
  }
}

export function clearRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function recoveryState(): RecoveryState {
  return read()?.state ?? "none";
}

/** True while a recovery session must not be usable for anything but setting a password. */
export function recoveryPending(): boolean {
  return recoveryState() === "pending";
}

export function markRecoveryPending(): void {
  write("pending");
}

export function markRecoveryExpired(): void {
  write("expired");
}

function params(source: string): URLSearchParams {
  return new URLSearchParams(source.replace(/^[#?]/, ""));
}

/**
 * Reads the recovery fragment off the current URL and records it. Idempotent, and safe to call on
 * every load: a URL that carries no recovery leaves the stored state alone.
 *
 * A used or expired fragment link comes back as `error_code=otp_expired` rather than a token;
 * a used or expired hash is learned when the exchange answers, and marked there. Provider
 * cancellation also arrives as `error=access_denied`, so that alone is not read as a recovery: it
 * counts only on /reset/new, where nothing else can have sent the member.
 */
export function captureRecoveryFromUrl(): RecoveryState {
  if (typeof window === "undefined") return "none";
  const hash = params(window.location.hash);
  const query = params(window.location.search);
  const type = hash.get("type") || query.get("type");
  const errorCode = hash.get("error_code") || query.get("error_code");
  const error = hash.get("error") || query.get("error");
  const onLanding = window.location.pathname.replace(/\/$/, "") === "/reset/new";

  // Handoff 62-A2: a recovery link on our domain carries the hash in the query, and the app
  // exchanges it itself (src/lib/email-link.ts); the flag is set from the URL before that exchange
  // answers, so the gate holds from the first render whether the hash is live or not.
  if (
    type === "recovery" &&
    (hash.get("access_token") || query.get("code") || query.get("token_hash"))
  ) {
    markRecoveryPending();
    return "pending";
  }
  if (errorCode === "otp_expired" || (onLanding && (error || errorCode))) {
    markRecoveryExpired();
    return "expired";
  }
  return recoveryState();
}
