// notify-deliver: the outbox's one sender (handoff 55-A; rulings 1321, 1520, 477, 387).
//
// POST, from private.notify_deliver_kick through pg_net once a minute while a queued row is due. The
// caller proves itself with the x-cron-token header, which public.notify_deliver_token_ok compares
// against the vault secret notify_deliver_token; anything else is 401 and nothing is read.
//
// The rows come from public.notify_outbox_claim, which takes due queued rows under for update skip
// locked and marks them sending, so two runs never hold the same row. What happens to each row is
// deliver.ts (handoff 60-NC): every non-transactional email, immediate or digest, carries RFC 8058's
// one-click pair naming /api/email/unsubscribe and a link to /email/unsubscribed with a token minted
// through public.email_unsubscribe_mint before the send (G245, 1529, 1572); transactional mail
// carries neither (477). Rows are settled one at a time through public.notify_outbox_settle.
//
// APP_ORIGIN (the app's origin, the same secret event-mail and guest-rsvp read) names the links. It
// is checked before anything is claimed, so a missing secret leaves the queue untouched.
//
// Under 1520 no kind carries copy, so nothing is enqueued and this drains an empty queue.
//
// Server to server, so no CORS. It deploys with JWT verification off (verify_jwt = false): the
// cron token is the gate. supabase/config.toml is absent (S54-13, G233), so the setting travels with
// the deploy call, deploy_edge_function's verify_jwt, and this line records it. It logs counts and
// states only: no address, no subject, no body, no token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendMail } from "../_shared/mail.ts";
import { deliver, readClaimed } from "./deliver.ts";

const CLAIM_LIMIT = 50;

Deno.serve(async (req: Request) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST", ...headers } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appOrigin = (Deno.env.get("APP_ORIGIN") ?? "").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey || !/^https:\/\//.test(appOrigin)) {
    console.log(JSON.stringify({ event: "notify_deliver_misconfigured" }));
    return json({ error: "Not available right now." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = req.headers.get("x-cron-token") ?? "";
  if (!token || token.length > 512) return json({ error: "Not allowed." }, 401);
  const check = await admin.rpc("notify_deliver_token_ok", { p_token: token });
  if (check.error) {
    console.log(
      JSON.stringify({ event: "notify_deliver_token_check_failed", code: check.error.code }),
    );
    return json({ error: "Not available right now." }, 500);
  }
  if (check.data !== true) return json({ error: "Not allowed." }, 401);

  const claim = await admin.rpc("notify_outbox_claim", { p_limit: CLAIM_LIMIT });
  if (claim.error) {
    console.log(JSON.stringify({ event: "notify_deliver_claim_failed", code: claim.error.code }));
    return json({ error: "Not available right now." }, 500);
  }
  const rows = readClaimed(claim.data);

  const tally: Record<string, number> = {};
  const settle = async (id: string, state: string, resendId?: string, error?: string) => {
    tally[state] = (tally[state] ?? 0) + 1;
    const r = await admin.rpc("notify_outbox_settle", {
      p_id: id,
      p_state: state,
      p_resend_id: resendId ?? null,
      p_error: error ?? null,
    });
    if (r.error)
      console.log(JSON.stringify({ event: "notify_deliver_settle_failed", code: r.error.code }));
  };

  await deliver(rows, {
    appOrigin,
    mint: async (outboxId) => {
      const r = await admin.rpc("email_unsubscribe_mint", { p_outbox_id: outboxId });
      if (r.error || typeof r.data !== "string" || !r.data) {
        console.log(
          JSON.stringify({ event: "notify_deliver_mint_failed", code: r.error?.code ?? null }),
        );
        return null;
      }
      return r.data;
    },
    send: (m) => sendMail(m),
    settle,
  });

  console.log(JSON.stringify({ event: "notify_deliver_run", claimed: rows.length, ...tally }));
  return json({ ok: true, claimed: rows.length });
});
