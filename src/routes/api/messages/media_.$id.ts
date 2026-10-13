// GET and DELETE /api/messages/media/$id (handoff 41-B section 3; rulings 1346, 1374, 1343, 1352).
//
// GET is delivery: the member comes from the bearer (the client fetches with it and makes an object
// URL for <img>, <video> and <audio>, so no cookie is needed); `messenger_media_locate` answers the
// key only where `messenger_media_access` is true, inside the member's own scope; the object is read
// from R2 through the binding with the Range the client asked for; nothing is transformed (1374) and
// no document is served (1346). 401 signed out, 403 for a member who may not have it, 404 where no
// row or no object exists.
//
// DELETE is the object behind a delete-for-everyone (F4): the client calls `messenger_delete` first,
// which marks the row, and this removes the object and forgets the row; then it sweeps up to twenty
// older marked rows, because Pages has no cron. Returns `{ removed }` for the client to discard, with
// `sweep: "failed"` beside it when the sweep's listing errored (G280: the listing ran read-only under
// PostgREST and failed on every call, and the handler said nothing), so a log or an arm can read it.
//
// `media_.$id` rather than `media.$id`: the underscore keeps this route a sibling of
// /api/messages/media rather than its child, as reset_.new does for /reset/new. This file carries only
// `server`, so TanStack Start prunes it from the client route tree.
import { createFileRoute } from "@tanstack/react-router";
import {
  MESSAGE_MEDIA_BUCKET,
  MESSAGE_MEDIA_SWEEP,
  asLocated,
  isUuid,
  json,
  memberFromRequest,
  messageMediaBucket,
  parseRange,
  refusalFromPostgres,
  refuse,
} from "@/lib/server/messenger-media.server";

export const Route = createFileRoute("/api/messages/media_/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const member = await memberFromRequest(request);
        if (member instanceof Response) return member;
        const id = params.id;
        if (!isUuid(id)) return refuse("not_found");

        const { data, error } = await member.sb.rpc("messenger_media_locate", { p_media: id });
        if (error) return refusalFromPostgres(error);
        const located = asLocated(data);
        if (!located) return refuse("not_found");
        if (!located.allowed || !located.storage_path) return refuse("not_a_member");

        const { bucket, source } = await messageMediaBucket(request);
        const envHeader = { "x-dna-env-source": source };
        if (!bucket) return refuse("unavailable", 503, envHeader);

        const head = await bucket.head(located.storage_path);
        if (!head) return refuse("not_found", 404, envHeader);

        const range = parseRange(request.headers.get("range"), head.size);
        const baseHeaders: Record<string, string> = {
          "content-type":
            head.httpMetadata?.contentType ?? located.mime ?? "application/octet-stream",
          "accept-ranges": "bytes",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "content-disposition": "inline",
          etag: head.httpEtag,
          ...envHeader,
        };
        if (range === "unsatisfiable") {
          return new Response(null, {
            status: 416,
            headers: { ...baseHeaders, "content-range": `bytes */${head.size}` },
          });
        }

        const object = await bucket.get(located.storage_path, range ? { range } : undefined);
        if (!object) return refuse("not_found", 404, envHeader);

        if (range) {
          const end = range.offset + range.length - 1;
          return new Response(object.body, {
            status: 206,
            headers: {
              ...baseHeaders,
              "content-length": String(range.length),
              "content-range": `bytes ${range.offset}-${end}/${head.size}`,
            },
          });
        }
        return new Response(object.body, {
          status: 200,
          headers: { ...baseHeaders, "content-length": String(head.size) },
        });
      },

      DELETE: async ({ request, params }) => {
        const member = await memberFromRequest(request);
        if (member instanceof Response) return member;
        const id = params.id;
        if (!isUuid(id)) return refuse("not_found");

        // The member's own select policy: only the owner reads the row, and only the author could
        // have marked it, so a row another member asks about is a 404 and nothing more.
        const { data: rows, error } = await member.sb
          .from("media")
          .select("storage_path, bucket, delete_requested_at")
          .eq("id", id)
          .limit(1);
        if (error) return refusalFromPostgres(error);
        const row = Array.isArray(rows)
          ? (rows[0] as Record<string, unknown> | undefined)
          : undefined;
        if (
          !row ||
          row["bucket"] !== MESSAGE_MEDIA_BUCKET ||
          typeof row["storage_path"] !== "string"
        )
          return refuse("not_found");
        if (!row["delete_requested_at"])
          return json({ error: "bad_media", detail: "not_marked" }, 409);

        const { bucket, source } = await messageMediaBucket(request);
        const envHeader = { "x-dna-env-source": source };
        if (!bucket) return refuse("unavailable", 503, envHeader);

        let removed = 0;
        try {
          await bucket.delete(row["storage_path"]);
        } catch {
          return refuse("unavailable", 502, envHeader);
        }
        const forgot = await member.sb.rpc("messenger_media_forget", { p_media: id });
        if (forgot.error) return refusalFromPostgres(forgot.error);
        if (forgot.data === true) removed += 1;

        // The sweep (F4): older marked rows, their objects removed and their rows forgotten. A
        // missing object is already gone (R2's delete of an absent key succeeds), so each row is
        // forgotten once its delete has returned; a failed delete leaves the row for the next call.
        // A listing that errors is reported, never swallowed: the member's own row is gone and the
        // answer is still 200, with `sweep: "failed"` so the failure is visible outside the handler.
        const marked = await member.sb.rpc("messenger_media_marked", {
          p_limit: MESSAGE_MEDIA_SWEEP,
        });
        if (marked.error) return json({ removed, sweep: "failed" }, 200, envHeader);
        if (Array.isArray(marked.data)) {
          for (const item of marked.data as Array<Record<string, unknown>>) {
            const mediaId = item["media_id"];
            const key = item["storage_path"];
            if (typeof mediaId !== "string" || typeof key !== "string" || mediaId === id) continue;
            try {
              await bucket.delete(key);
            } catch {
              continue;
            }
            const f = await member.sb.rpc("messenger_media_forget", { p_media: mediaId });
            if (!f.error && f.data === true) removed += 1;
          }
        }
        return json({ removed }, 200, envHeader);
      },
    },
  },
});
