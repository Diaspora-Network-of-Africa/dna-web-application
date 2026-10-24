// One Supabase client for the browser. The canonical DNA project (dgspjevjoblujcoljvkn) at its
// custom domain, auth.diasporanetwork.africa (handoff 62-A2, rulings 1829, 1830), is the default so
// preview deployments work without configuring env; VITE_* overrides win when set. The
// supabase.co host keeps serving, and nothing in the tree names it any more: the CSP in csp.ts and
// the admin's headers derive their Supabase sources from this one constant.
// Publishable keys are public by design; RLS is the boundary.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { startEmailLink } from "./email-link";
import { captureRecoveryFromUrl } from "./recovery";

export const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  "https://auth.diasporanetwork.africa";
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  "sb_publishable_yuc09jnHUXWQfMbbAp5_ng_2zXPNU0x";

export type Supabase = SupabaseClient<Database>;

let client: Supabase | null = null;

/** Browser-only singleton. Returns null during SSR; callers run inside effects. */
export function getSupabase(): Supabase | null {
  if (typeof window === "undefined") return null;
  if (!client) {
    // Ruling 240: detectSessionInUrl consumes the recovery fragment and strips it, so the fragment
    // is read and recorded before the client exists. Without this the app cannot tell a recovery
    // sign-in from any other one, which is exactly how the token reached the Feed.
    captureRecoveryFromUrl();
    client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    // Handoff 62-A2: a link on our domain carries `?token_hash=…&type=…` instead of a fragment, and
    // the app exchanges it for a session itself. Started here so the exchange is in flight before
    // the auth provider reads the session, and it waits for the answer (src/lib/auth.tsx).
    void startEmailLink(client);
  }
  return client;
}

export function functionsUrl(name: string): string {
  return SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/" + name;
}
