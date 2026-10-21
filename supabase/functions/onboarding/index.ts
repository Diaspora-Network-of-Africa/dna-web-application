// onboarding: the transport for Brief 5's three writes, and the place their company-facing signal
// is emitted (ruling 311). Input { screen: "who" | "where" | "relationship", ...fields } or
// { event: "explainer_opened" }. Output { ok: true, result } or { ok: false, error }.
//
// The write itself is the SECURITY DEFINER RPC (onboard_who, onboard_where, onboard_relationship),
// called with the member's own JWT so auth.uid() decides whose row is written; this function adds
// nothing to the write and never touches a table. What it adds is the emit, to the same place
// connect-suggest already logs, never to a new store: screen completed with its number; time on
// screen three; stance declared versus default at finish; photo and username set here versus
// later; the entry path from the auth provider. Abandonment is not emitted, it is inferred from
// onboarding_state(). Explainer opens arrive from the client as an event.
// Logs shapes and durations only. Never logs a name, a username, a place, a photo path or an id.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Screen = "who" | "where" | "relationship";
const SCREEN_NUMBER: Record<Screen, number> = { who: 1, where: 2, relationship: 3 };
// The enum's values, as a guard on what reaches the RPC and the record; no order and no label
// (187). BS7 (1856) adds bridge. Named in H-BS7-STANCE's PR as the one literal list the tree holds.
const STANCES = new Set(["returnee", "kin", "bridge", "anchor", "ally", "exploring"]);

type Body = {
  screen?: unknown;
  event?: unknown;
  name?: unknown;
  username?: unknown;
  avatar_path?: unknown;
  city?: unknown;
  country?: unknown;
  stance?: unknown;
  touched?: unknown;
  elapsed_ms?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** The auth provider from the JWT's app_metadata, read locally; the RPC still verifies the token. */
function entryPath(auth: string): string {
  try {
    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1] ?? "";
    const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/") + pad)) as {
      app_metadata?: { provider?: unknown };
    };
    const p = decoded.app_metadata?.provider;
    return typeof p === "string" && p ? p : "email";
  } catch {
    return "unknown";
  }
}

// Ruling 443 (F24): the record is company-facing shape and duration only. Nothing request-scoped
// rides on it: no JWT sub, no user id, no request id, no header. Any key by one of those names is
// dropped before the line is written, so a future field cannot reintroduce one by accident. The
// platform's own per-request log metadata is outside this function's reach and is F24's remaining
// half, recorded as such.
const IDENTIFIER_KEYS = new Set([
  "sub",
  "user_id",
  "member_id",
  "id",
  "request_id",
  "jwt",
  "authorization",
]);
const emit = (record: Record<string, unknown>) => {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) if (!IDENTIFIER_KEYS.has(k)) clean[k] = v;
  console.log(JSON.stringify(clean));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: { code: "method" } }, 405);
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth))
    return json({ ok: false, error: { code: "unauthorized" } }, 401);
  const started = Date.now();
  const entry = entryPath(auth);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: { code: "bad_json" } }, 400);
  }

  if (body.event === "explainer_opened") {
    emit({
      event: "onboarding_explainer_opened",
      stance: STANCES.has(String(body.stance)) ? String(body.stance) : null,
      entry_path: entry,
    });
    return json({ ok: true });
  }

  const screen = body.screen;
  if (screen !== "who" && screen !== "where" && screen !== "relationship")
    return json({ ok: false, error: { code: "bad_screen" } }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ ok: false, error: { code: "config" } }, 500);
  const sb = createClient(url, anon, { global: { headers: { Authorization: auth } } });

  let call: Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  if (screen === "who") {
    call = sb.rpc("onboard_who", {
      p_name: str(body.name) ?? "",
      p_username: str(body.username),
      p_avatar_path: str(body.avatar_path),
    });
  } else if (screen === "where") {
    call = sb.rpc("onboard_where", {
      p_city: str(body.city) ?? "",
      p_country: str(body.country) ?? "",
    });
  } else {
    const touched = body.touched === true;
    const stance = STANCES.has(String(body.stance)) ? String(body.stance) : null;
    call = sb.rpc("onboard_relationship", {
      p_stance: touched ? stance : null,
      p_touched: touched,
    });
  }

  const { data, error } = await call;
  if (error) {
    emit({
      event: "onboarding_write_refused",
      screen: SCREEN_NUMBER[screen],
      code: error.code ?? null,
      entry_path: entry,
      latency_ms: Date.now() - started,
    });
    return json(
      { ok: false, error: { code: error.code ?? "refused", message: error.message ?? "" } },
      400,
    );
  }
  const result = (data ?? {}) as Record<string, unknown>;
  const status = typeof result["status"] === "string" ? (result["status"] as string) : "ok";

  if (status !== "ok") {
    // taken or invalid: nothing was written; the screen stays and the suggestion still stands.
    emit({ event: "onboarding_username_" + status, screen: 1, entry_path: entry });
    return json({ ok: true, result });
  }

  const record: Record<string, unknown> = {
    event: "onboarding_screen_completed",
    screen: SCREEN_NUMBER[screen],
    entry_path: entry,
    latency_ms: Date.now() - started,
  };
  if (screen === "who") {
    record["photo_set_here"] = !!str(body.avatar_path);
    record["username_from_suggestion"] = result["username"] === result["suggestion"];
    record["username_changes"] = result["username_changes"] ?? null;
  } else if (screen === "relationship") {
    record["declared"] = body.touched === true;
    record["stance"] = result["stance"] ?? null;
    record["time_on_screen_ms"] =
      typeof body.elapsed_ms === "number" && body.elapsed_ms >= 0
        ? Math.floor(body.elapsed_ms)
        : null;
  }
  emit(record);
  return json({ ok: true, result });
});
