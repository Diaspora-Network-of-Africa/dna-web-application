// /api/email/unsubscribe (handoff 60-NC; G245, rulings 1529, 1572; RFC 8058): the HTTPS endpoint
// every non-transactional email's List-Unsubscribe header names. POST turns DNA email off for the
// token's member; GET changes nothing. The handler is src/lib/server/unsubscribe.server.ts.
//
// This file carries only `server`, so TanStack Start prunes it from the client route tree and the
// server-only helper never reaches the browser bundle.
import { createFileRoute } from "@tanstack/react-router";
import { handleUnsubscribeGet, handleUnsubscribePost } from "@/lib/server/unsubscribe.server";

export const Route = createFileRoute("/api/email/unsubscribe")({
  server: {
    handlers: {
      POST: ({ request }) => handleUnsubscribePost(request),
      GET: ({ request }) => handleUnsubscribeGet(request),
    },
  },
});
