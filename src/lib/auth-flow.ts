// Brief 4B: the one place the auth surfaces get their provider calls, their password rules and
// their error copy. Sign-in, sign-up, /reset, /reset/new and /password all read from here, so the
// two states that must be identical rather than similar are identical because they are one string.
import { record } from "./record";
import { getSupabase, type Supabase } from "./supabase";

export type Provider = "google" | "linkedin_oidc";

/**
 * 12C part 2 (handoff 58-12C2): the `reason_class` of a refused password sign-in, from the Supabase
 * error's code and never its message. `invalid_credentials` is wrong_credentials,
 * `email_not_confirmed` is unconfirmed, and anything else is other. A provider return classifies
 * itself in `consumeProviderReturn` below.
 */
export function signInFailureClass(error: {
  code?: string | undefined;
  status?: number | undefined;
}): "wrong_credentials" | "unconfirmed" | "other" {
  const code = (error.code || "").toLowerCase();
  if (code === "invalid_credentials") return "wrong_credentials";
  if (code === "email_not_confirmed") return "unconfirmed";
  return "other";
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  linkedin_oidc: "LinkedIn",
};

/** Ruling 233: email and password, Google and LinkedIn. Apple is not built. */
export const PROVIDERS: Provider[] = ["google", "linkedin_oidc"];

export const PROVIDER_MARK: Record<Provider, string> = {
  // Placeholders (handoff section 5). Resolved by path so the official downloadable assets land as
  // a file overwrite with no component edited.
  google: "/strand/marks/google.svg",
  linkedin_oidc: "/strand/marks/linkedin.svg",
};

/**
 * Handoff section 5: Google permits "Continue with Google"; LinkedIn's terms favour "Sign in with
 * LinkedIn". Both surfaces use the same verb for a provider so a member is never offered a
 * sign-up variant that LinkedIn's terms do not carry.
 */
export const PROVIDER_BUTTON_LABEL: Record<Provider, string> = {
  google: "Continue with Google",
  linkedin_oidc: "Sign in with LinkedIn",
};

export const PROVIDER_WAITING_LABEL: Record<Provider, string> = {
  google: "Waiting for Google",
  linkedin_oidc: "Waiting for LinkedIn",
};

/** Handoff section 2: at least ten characters. Checked here before the request so the message is ours. */
export const MIN_PASSWORD = 10;

export const COPY = {
  mismatch:
    "That email and password do not match an account. Check both and try again, or reset your password.",
  malformed: "Enter an email address, like name@example.com.",
  tooShort: "Use at least ten characters for your password.",
  // Ruling 496, verbatim from the Design pass 01 handoff (B8 item 5).
  breached: "This password has appeared in a data breach. Choose another one.",
  differ: "The two passwords do not match. Type the new password the same way twice.",
  // Ruling 414 (W22): the server's refusals each get their own line. "Should be different from the
  // old password" used to match the too-short rule on the words "should be", so a sixteen-character
  // password was told it needed ten.
  samePassword: "That is the password you already use. Choose a different one.",
  passwordRefused: "That password was not accepted. Choose a different one and try again.",
  wrongCurrent:
    "That is not your current password. Check it and try again. If you have forgotten it, sign out and use Forgot your password.",
  /** Ruling 496, verbatim (B8 item 5). */
  passwordHint: "At least ten characters.",
  /** Ruling 496, verbatim (B8 item 5): the lead on sign-up, now that the name field has gone. */
  signUpLead: "An email address and a password. Your name, a username and a photo come next.",
  /** Ruling 496, verbatim (B8 item 5): sign-up could not be created. */
  signUpFailed: "We couldn't create your account just now. Nothing you entered is lost. Try again.",
  /**
   * Handoff 62-A2: a sign-up, magic-link, invite or email-change hash that did not verify lands on
   * sign-in with this line. New copy, named in the PR: no state existed for it, because the fragment
   * landing of the same types reached sign-in with nothing said.
   */
  linkExpired:
    "This link no longer works. It has been used, or its hour has passed. Sign in to continue.",
  providerError: (p: Provider) =>
    `${PROVIDER_LABEL[p]} could not sign you in just now. Try again, or use your email and password.`,
  providerCancelled: (p: Provider) =>
    `You closed the ${PROVIDER_LABEL[p]} window before finishing. Nothing has changed. Try again, or use your email and password.`,
} as const;

/**
 * The reset "sent" state and the sign-up "Check your email" state reveal at a fixed delay rather
 * than when the server answers, so an address that has an account and one that does not are
 * indistinguishable to a visitor watching the surface. GoTrue's /recover already answers 200 for
 * both, so there is no server-side difference to hide; this closes the client-side one that a
 * response-driven transition would open.
 */
export const REVEAL_MS = 900;

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Deliberately permissive: the server is the authority. This only catches an address with no shape. */
export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function siteOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Registered in Supabase's URL configuration for every deployed origin (see the report). */
export function oauthRedirect(): string {
  return siteOrigin() + "/sign-in";
}

/** Ruling 240: the recovery token lands on the landing route and nowhere else. */
export function recoveryRedirect(): string {
  return siteOrigin() + "/reset/new";
}

const OAUTH_PROVIDER_KEY = "dna.auth.oauth-provider";

export function rememberProvider(p: Provider): void {
  try {
    window.sessionStorage.setItem(OAUTH_PROVIDER_KEY, p);
  } catch {
    /* the returning hash still tells us something went wrong, just not which provider. */
  }
}

export function lastProvider(): Provider | null {
  try {
    const v = window.sessionStorage.getItem(OAUTH_PROVIDER_KEY);
    return v === "google" || v === "linkedin_oidc" ? v : null;
  } catch {
    return null;
  }
}

export function forgetProvider(): void {
  try {
    window.sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
  } catch {
    /* nothing to forget */
  }
}

const EXPIRED_LINK_KEY = "dna.auth.expired-link";

/**
 * Handoff 62-A2: the marker for an email link whose hash did not verify, set by the auth provider
 * before it sends the visitor to sign-in and read once by that route. A marker rather than a URL
 * parameter, so the shell's own redirect to sign-in cannot drop it on the way.
 */
export function noteExpiredLink(): void {
  try {
    window.sessionStorage.setItem(EXPIRED_LINK_KEY, "1");
  } catch {
    /* storage unavailable: the visitor lands on sign-in with nothing said, as before 62-A2. */
  }
}

/** True once per expired link: reads the marker and forgets it. */
export function consumeExpiredLink(): boolean {
  try {
    const v = window.sessionStorage.getItem(EXPIRED_LINK_KEY);
    if (v) window.sessionStorage.removeItem(EXPIRED_LINK_KEY);
    return !!v;
  } catch {
    return false;
  }
}

export type ProviderReturn = { provider: Provider; kind: "cancelled" | "error" } | null;

/**
 * Reads a failed provider round trip off the URL the provider sent the member back to. Success
 * carries a token and is handled by supabase-js; only the failures land here.
 */
export function readProviderReturn(): ProviderReturn {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const error = hash.get("error") || query.get("error");
  if (!error) return null;
  if ((hash.get("error_code") || query.get("error_code")) === "otp_expired") return null;
  const provider = lastProvider();
  if (!provider) return null;
  return { provider, kind: error === "access_denied" ? "cancelled" : "error" };
}

/**
 * 12C part 2: the one place a failed provider round trip is consumed. Reads it, forgets the
 * provider, strips the fragment and records `sign_in_failed` as provider_cancelled or
 * provider_error, with no member (1616). The route renders the copy from what this returns.
 */
export function consumeProviderReturn(): ProviderReturn {
  const back = readProviderReturn();
  if (!back) return null;
  forgetProvider();
  stripAuthFragment();
  record("sign_in_failed", {
    reason_class: back.kind === "cancelled" ? "provider_cancelled" : "provider_error",
  });
  return back;
}

/**
 * 12C part 2: a provider sign-in that completed. auth-js raises SIGNED_IN for it after
 * detectSessionInUrl consumes the return, and also on a tab refocus and from another tab, so the
 * event alone is not a sign-in. The marker `rememberProvider` set before the redirect is what
 * tells them apart: it exists only between the member's press and the return, so SIGNED_IN with it
 * present is the return, recorded once with the provider the member chose and then forgotten.
 * Without the marker nothing is recorded (see docs/GAPS.md, the provider-method gap).
 */
export function noteProviderSignIn(): void {
  const p = lastProvider();
  if (!p) return;
  forgetProvider();
  record("sign_in_succeeded", { method: p });
}

/** Clears an auth fragment off the URL so a reload does not replay the state it produced. */
export function stripAuthFragment(): void {
  if (typeof window === "undefined") return;
  if (!window.location.hash && !window.location.search.includes("error")) return;
  const url = new URL(window.location.href);
  for (const key of ["error", "error_code", "error_description", "code", "type", "token_hash"])
    url.searchParams.delete(key);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

/**
 * Ruling 234: one address is one account. Identity linking on a verified matching email is a
 * project setting, not a client call, so nothing here forks on provider; the surface offers the
 * same member the same account whichever button they press. Verified by tests/auth-identity.cjs.
 */
export async function startProvider(sb: Supabase, provider: Provider): Promise<{ error: boolean }> {
  rememberProvider(provider);
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirect() },
  });
  if (error) {
    forgetProvider();
    return { error: true };
  }
  return { error: false };
}

export type PasswordFault = "short" | "breached" | "same" | "other";

type PasswordError = {
  message?: string | undefined;
  code?: string | undefined;
  weak_password?: { reasons?: string[] | undefined } | null | undefined;
} | null;

/**
 * Ruling 414 (W22): GoTrue's password rejections mapped to their real reasons. The code is read
 * first (weak_password carries its reasons: pwned, length, characters; same_password is its own
 * code), the message second, and nothing is inferred from a fragment two refusals share.
 */
export function passwordFault(error: PasswordError): PasswordFault {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toLowerCase();
  const reasons = (error?.weak_password?.reasons || []).map((r) => String(r).toLowerCase());
  if (code === "same_password" || message.includes("different from the old")) return "same";
  if (reasons.includes("pwned")) return "breached";
  if (reasons.includes("length")) return "short";
  if (
    message.includes("pwned") ||
    message.includes("breach") ||
    message.includes("known to be weak")
  )
    return "breached";
  if (/at least \d+ characters/.test(message) || message.includes("too short")) return "short";
  return "other";
}

/** The alert line for a fault, from the one copy table (ruling 414). */
export function passwordFaultCopy(fault: PasswordFault): string {
  if (fault === "short") return COPY.tooShort;
  if (fault === "breached") return COPY.breached;
  if (fault === "same") return COPY.samePassword;
  return COPY.passwordRefused;
}

/**
 * Makes the copy true rather than assumed: "Any other device signed in with the old password has
 * been signed out." `others` revokes every session but the one making the call, so this device
 * stays signed in and every other refresh token is dead.
 */
export async function signOutOtherSessions(sb: Supabase): Promise<boolean> {
  const { error } = await sb.auth.signOut({ scope: "others" });
  return !error;
}

export function client(): Supabase | null {
  return getSupabase();
}
