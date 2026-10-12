// Feed (Home). The surface itself is rendered by the shell layout so it stays mounted beneath
// /posts/:id; this route owns the URL and the ?lens= search contract (ruling 83).
//
// Handoff 60-NC (1557, SPEC 6.4): `?notifications=email` opens the notification panel on its email
// preferences view, once. AppShell reads it from the location and replaces it away. Settings takes
// this control over when it is built (1552), and that build repoints this one parameter. Any other
// value is dropped.
import { createFileRoute } from "@tanstack/react-router";
import { validateLens, type FeedSearch } from "@/lib/lens";

type FeedRouteSearch = FeedSearch & { notifications?: "email" };

function validateFeedSearch(search: Record<string, unknown>): FeedRouteSearch {
  return {
    ...validateLens(search),
    ...(search["notifications"] === "email" ? { notifications: "email" as const } : {}),
  };
}

export const Route = createFileRoute("/_shell/feed")({
  validateSearch: validateFeedSearch,
  component: () => null,
});
