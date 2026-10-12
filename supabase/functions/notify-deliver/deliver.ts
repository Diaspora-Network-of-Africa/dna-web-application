// notify-deliver's work on claimed rows (handoff 55-A; 60-NC; rulings 1321, 1520, 477, 1529, 1572,
// G245). Pure of Deno and of imports, so tests/notifications.cjs can load it and read exactly what is
// passed to sendMail; index.ts supplies the real database, sender and origin.
//
// Each claimed row is settled once through `settle`:
//   suppressed  the address is in private.email_suppressions (a hard bounce or a complaint);
//   failed      no address, the unsubscribe token could not be minted, or Resend refused the message
//               or returned no id;
//   skipped     the kind carries no copy (1520: a kind enqueues only with both its subject and its
//               line, so this is a row whose copy was withdrawn after it queued);
//   sent        only once Resend has returned the message's id (1321).
//
// Every non-transactional email, immediate or digest, carries RFC 8058's pair (477, G245):
// `List-Unsubscribe: <{origin}/api/email/unsubscribe?token=...>` and
// `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and its body's last line is the landing page
// `{origin}/email/unsubscribed?token=...` with the same token. The token is minted through
// email_unsubscribe_mint before sendMail, so a send that fails still leaves a readable row (1572).
// Transactional mail carries neither header and no link (477), and mints nothing.
//
// A digest row is one message, as an immediate row is: no copy is approved for a combined digest,
// so this sends each row's own subject and line at its due time rather than invent one (G275).

export type Claimed = {
  id: string;
  mode: "immediate" | "digest";
  member_id: string;
  email: string | null;
  suppressed: boolean;
  kind: string;
  c: string;
  subject: string | null;
  line: string | null;
  transactional: boolean;
  created_at: string;
};

export type Outgoing = {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
};

export type DeliverDeps = {
  /** The app's origin, from APP_ORIGIN, with no trailing slash. */
  appOrigin: string;
  /** email_unsubscribe_mint for one outbox row: the token, or null when the mint failed. */
  mint: (outboxId: string) => Promise<string | null>;
  send: (message: Outgoing) => Promise<{ ok: boolean; status: number; id?: string }>;
  settle: (id: string, state: string, resendId?: string, error?: string) => Promise<void>;
};

/** The route the List-Unsubscribe header names; mirrors src/lib/unsubscribe.ts UNSUBSCRIBE_PATH. */
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";
/** The landing page the body's link opens. */
export const UNSUBSCRIBED_PAGE = "/email/unsubscribed";

export function readClaimed(value: unknown): Claimed[] {
  if (!Array.isArray(value)) return [];
  const out: Claimed[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.member_id !== "string") continue;
    if (r.mode !== "immediate" && r.mode !== "digest") continue;
    out.push({
      id: r.id,
      mode: r.mode,
      member_id: r.member_id,
      email: typeof r.email === "string" && r.email ? r.email : null,
      suppressed: r.suppressed === true,
      kind: typeof r.kind === "string" ? r.kind : "",
      c: typeof r.c === "string" ? r.c : "",
      subject: typeof r.subject === "string" && r.subject.trim() ? r.subject : null,
      line: typeof r.line === "string" && r.line.trim() ? r.line : null,
      transactional: r.transactional === true,
      created_at: typeof r.created_at === "string" ? r.created_at : "",
    });
  }
  return out;
}

/**
 * The message for one row. A non-transactional row needs its token and carries the pair and the
 * link; a transactional row carries neither (477).
 */
export function messageFor(
  row: Claimed & { email: string; subject: string; line: string },
  appOrigin: string,
  token: string | null,
): Outgoing {
  if (row.transactional || token === null)
    return { to: row.email, subject: row.subject, text: row.line + "\n" };
  const q = "?token=" + encodeURIComponent(token);
  return {
    to: row.email,
    subject: row.subject,
    text: row.line + "\n\n" + appOrigin + UNSUBSCRIBED_PAGE + q + "\n",
    headers: {
      "List-Unsubscribe": "<" + appOrigin + UNSUBSCRIBE_PATH + q + ">",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export async function deliver(rows: Claimed[], deps: DeliverDeps): Promise<void> {
  for (const row of rows) {
    if (!row.email) {
      await deps.settle(row.id, "failed", undefined, "no_address");
      continue;
    }
    if (row.suppressed) {
      await deps.settle(row.id, "suppressed", undefined, "suppressed_address");
      continue;
    }
    if (!row.subject || !row.line) {
      await deps.settle(row.id, "skipped", undefined, "no_copy");
      continue;
    }
    let token: string | null = null;
    if (!row.transactional) {
      // 477, G245: a non-transactional email goes with its one-click pair or it does not go.
      token = await deps.mint(row.id);
      if (!token) {
        await deps.settle(row.id, "failed", undefined, "no_unsubscribe_token");
        continue;
      }
    }
    const sent = await deps.send(
      messageFor(
        { ...row, email: row.email, subject: row.subject, line: row.line },
        deps.appOrigin,
        token,
      ),
    );
    if (sent.ok && sent.id) await deps.settle(row.id, "sent", sent.id);
    else
      await deps.settle(
        row.id,
        "failed",
        undefined,
        sent.ok ? "no_resend_id" : "status_" + sent.status,
      );
  }
}
