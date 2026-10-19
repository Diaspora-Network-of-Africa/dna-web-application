// /posts/:id (ruling 105): one history entry for an expanded card. Reached from the Feed it is the
// same list with that card expanded in place; landed on directly it is the expanded card as page
// content. The shell layout renders the Feed column for both, so this route owns only the URL and
// the ?lens= search contract the Feed beneath keeps. Handoff 62-A (1802, SPEC 10.2): ?who=help or
// ?who=build is an intent notification's destination, the author's sheet open on that tab; the Feed
// reads it once and drops it from the address. Handoff 62-G (1817, 1849, SPEC 10.2): ?comment=<id>
// is a reply's or a comment intent's destination, the comment scrolled into view in the thread.
import { createFileRoute } from "@tanstack/react-router";
import { validateLens, type FeedSearch } from "@/lib/lens";

export type PostSearch = FeedSearch & { who?: string; comment?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_shell/posts/$id")({
  validateSearch: (search: Record<string, unknown>): PostSearch => {
    const out: PostSearch = validateLens(search);
    const who = search["who"];
    if (typeof who === "string" && /^[a-z_]{1,32}$/.test(who)) out.who = who;
    const comment = search["comment"];
    if (typeof comment === "string" && UUID.test(comment)) out.comment = comment;
    return out;
  },
  component: () => null,
});
