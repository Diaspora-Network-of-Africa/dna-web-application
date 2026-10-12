// The one-click route's handler (handoff 60-NC; G245, rulings 1529, 1572; RFC 8058). Server only.
//
//   POST ?token=<64 hex>  body List-Unsubscribe=One-Click (form-encoded, as RFC 8058 sends it and as
//                         /email/unsubscribed sends it). Calls public.email_unsubscribe with the
//                         publishable key: the token is the credential, so no session is read. The
//                         database turns every category off for the token's member and marks the
//                         token used, or answers expired for a token unknown, malformed, used or
//                         past its 60 days. Answers {state}: done, expired, or refused when the
//                         database could not be asked or answered something else.
//   GET                   changes nothing. A person who opens the header's URL in a browser is sent
//                         on to /email/unsubscribed with the same token, which asks for them.
//
// The answer never names the member, the address or why a token failed.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../supabase";
import { isUnsubscribeToken, type UnsubscribeState } from "../unsubscribe";

/** Asks the database; injected so the handler is testable without a network. */
export type UnsubscribeRpc = (token: string) => Promise<{ data: unknown; error: unknown }>;

export const defaultUnsubscribeRpc: UnsubscribeRpc = async (token) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("email_unsubscribe", { p_token: token });
  return { data, error };
};

const answer = (state: UnsubscribeState, status: number): Response =>
  new Response(JSON.stringify({ state }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Whether a POST body carries RFC 8058's one-click pair. */
export function isOneClickBody(text: string): boolean {
  return new URLSearchParams(text).get("List-Unsubscribe") === "One-Click";
}

export async function handleUnsubscribePost(
  request: Request,
  rpc: UnsubscribeRpc = defaultUnsubscribeRpc,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  const body = await request.text().catch(() => "");
  if (!isOneClickBody(body)) return answer("refused", 400);
  // A malformed token cannot name a member; it reads as a link that no longer works.
  if (!isUnsubscribeToken(token)) return answer("expired", 200);
  try {
    const { data, error } = await rpc(token);
    if (error) return answer("refused", 503);
    if (data === "done") return answer("done", 200);
    if (data === "expired") return answer("expired", 200);
    return answer("refused", 503);
  } catch {
    return answer("refused", 503);
  }
}

export function handleUnsubscribeGet(request: Request): Response {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const to = new URL("/email/unsubscribed", url.origin);
  if (isUnsubscribeToken(token)) to.searchParams.set("token", token);
  return new Response(null, {
    status: 303,
    headers: { Location: to.pathname + to.search, "Cache-Control": "no-store" },
  });
}
