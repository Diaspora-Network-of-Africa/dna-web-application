// Handoff 62-A2 (rulings 1829, 1830): the email link on our own domain. A Supabase email template
// can link straight to the app with the token hash, `https://app.diasporanetwork.africa/<route>?
// token_hash=<hash>&type=<type>`, rather than through the Auth host's own verify endpoint. The app
// exchanges the hash for a session itself with `verifyOtp`, and the member lands where the fragment
// landing of the same type lands today: a recovery on /reset/new's form, held there by the gate in
// the root route until a password is set (240); every other type on the route the link named,
// signed in. This module is the one place that reads `token_hash` off a URL.
//
// The exchange starts the moment the Supabase client exists (`getSupabase`) and the auth provider
// waits for it before it reads the session, so the first `ready` already carries the session the
// link produced and no route ever sees a signed-out visitor who is about to be signed in. The
// fragment landing (`#access_token=…&type=…`) is untouched: supabase-js still consumes it and the
// capture in recovery.ts still records it, because every email already sent carries that shape
// until the templates switch.
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

/** The five types Supabase's email templates send, and the five `verifyOtp` accepts for a hash. */
export const EMAIL_LINK_TYPES = [
  "recovery",
  "signup",
  "magiclink",
  "email_change",
  "invite",
] as const satisfies readonly EmailOtpType[];
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

export type EmailLink = { tokenHash: string; type: EmailLinkType };
/** What the exchange answered: `verified` is false for a used or expired hash. */
export type EmailLinkResult = { type: EmailLinkType; verified: boolean };

function isEmailLinkType(value: string | null): value is EmailLinkType {
  return (EMAIL_LINK_TYPES as readonly string[]).includes(value ?? "");
}

/** The link on the current URL, or null when the URL carries no hash of a known type. */
export function readEmailLink(): EmailLink | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const tokenHash = query.get("token_hash");
  const type = query.get("type");
  if (!tokenHash || !isEmailLinkType(type)) return null;
  return { tokenHash, type };
}

/** Takes the hash and its type off the address so a reload never replays a hash already used. */
function stripEmailLink(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

let settled: Promise<EmailLinkResult | null> | null = null;
let open = false;

/**
 * Starts the exchange for the link on the URL, once per page load; every later call returns the
 * same promise. A URL with no link settles at once with null. Never throws: a refused or failed
 * request is a link that did not verify.
 */
export function startEmailLink(sb: Pick<SupabaseClient, "auth">): Promise<EmailLinkResult | null> {
  if (settled) return settled;
  const link = readEmailLink();
  if (!link) {
    settled = Promise.resolve(null);
    return settled;
  }
  open = true;
  stripEmailLink();
  settled = sb.auth
    .verifyOtp({ token_hash: link.tokenHash, type: link.type })
    .then(({ error }) => {
      open = false;
      return { type: link.type, verified: !error };
    })
    .catch(() => {
      open = false;
      return { type: link.type, verified: false };
    });
  return settled;
}

/** True while an exchange has started and not yet answered. */
export function emailLinkOpen(): boolean {
  return open;
}

/** The exchange's answer, or null once it is known that this load carried no link. */
export function emailLinkSettled(): Promise<EmailLinkResult | null> {
  return settled ?? Promise.resolve(null);
}
