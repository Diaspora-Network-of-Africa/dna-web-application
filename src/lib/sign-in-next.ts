// Where sign-in sends a member next (handoff 60-NC, 1557; handoff 63-WS, 1866). Two words are
// accepted and each maps to one destination: `email-preferences` opens the notification panel's
// email view on /feed; `profile` opens the member's own profile in Edit profile mode, at the handle
// their own members row carries and never one the URL named. Anything else, a URL or a handle above
// all, is dropped, so the parameter cannot redirect off the app or onto another member's page.
// Import-free so tests/notifications.cjs can load it.

export type SignInNext = "email-preferences" | "profile";

export function readSignInNext(value: unknown): SignInNext | undefined {
  if (value === "email-preferences" || value === "profile") return value;
  return undefined;
}

// Handoff 63-WS (1866): a provider round trip comes back to a bare /sign-in (src/lib/auth-flow.ts,
// oauthRedirect), so a word in the URL would be lost on the way, and on main it is, for
// email-preferences as much as for profile. The word is held in sessionStorage beside the provider
// marker (auth-flow.ts, rememberProvider): set when the member presses a provider button, read once
// when the route mounts again on the return, and forgotten. A marker rather than a URL parameter,
// which is the shape the tree already uses to carry state across that round trip. A trip the member
// abandons leaves the marker for the next mount of /sign-in in the same tab, as the provider
// marker does, and that mount consumes it.
const NEXT_KEY = "dna.auth.sign-in-next";

export function rememberSignInNext(next: SignInNext | undefined): void {
  try {
    if (next) window.sessionStorage.setItem(NEXT_KEY, next);
    else window.sessionStorage.removeItem(NEXT_KEY);
  } catch {
    /* storage unavailable: the return lands on the Feed, as before 63-WS. */
  }
}

let consumed: { next: SignInNext | undefined } | null = null;

/**
 * The word a provider round trip carried: read off the marker once per document and forgotten
 * there, and the same answer for every later call on that document, so a route that mounts twice
 * on the return reads the word both times. Undefined off the client and on a document that
 * carried none.
 */
export function consumeSignInNext(): SignInNext | undefined {
  if (consumed) return consumed.next;
  try {
    const next = readSignInNext(window.sessionStorage.getItem(NEXT_KEY));
    window.sessionStorage.removeItem(NEXT_KEY);
    consumed = { next };
    return next;
  } catch {
    return undefined;
  }
}
