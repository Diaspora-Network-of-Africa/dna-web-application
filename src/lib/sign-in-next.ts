// Where sign-in sends a member next (handoff 60-NC, 1557). One word is accepted and it maps to one
// destination: `email-preferences` opens the notification panel's email view on /feed. Anything else,
// a URL above all, is dropped, so the parameter cannot redirect off the app. Import-free so
// tests/notifications.cjs can load it.

export type SignInNext = "email-preferences";

export function readSignInNext(value: unknown): SignInNext | undefined {
  return value === "email-preferences" ? "email-preferences" : undefined;
}
