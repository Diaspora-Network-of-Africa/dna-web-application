// One-click unsubscribe, the shape both sides share (handoff 60-NC; G245, rulings 1529, 1557, 1572).
// A non-transactional email carries RFC 8058's pair naming UNSUBSCRIBE_PATH with its token, and its
// body links to /email/unsubscribed with the same token; that page sends the same POST on load, so
// a mail client's one click and the page are one request. The server answers one of three states
// and the page renders only that state.

/** The route the List-Unsubscribe header names, relative to the app's origin. */
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";

/** RFC 8058's POST body. The route refuses a POST without it. */
export const ONE_CLICK_BODY = "List-Unsubscribe=One-Click";

export type UnsubscribeState = "done" | "expired" | "refused";

/** A token as email_unsubscribe_mint returns it: 32 random bytes in hex. */
export const isUnsubscribeToken = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

/** The state in a route answer; null when the body is not one. */
export function readUnsubscribeState(body: unknown): UnsubscribeState | null {
  if (!body || typeof body !== "object") return null;
  const s = (body as { state?: unknown }).state;
  return s === "done" || s === "expired" || s === "refused" ? s : null;
}

/** The landing page's request (1557): the same one-click POST a mail client sends. */
export async function unsubscribe(token: string): Promise<UnsubscribeState> {
  try {
    const res = await fetch(UNSUBSCRIBE_PATH + "?token=" + encodeURIComponent(token), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: ONE_CLICK_BODY,
    });
    const body: unknown = await res.json().catch(() => null);
    return readUnsubscribeState(body) ?? "refused";
  } catch {
    return "refused";
  }
}
