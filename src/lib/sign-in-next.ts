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
