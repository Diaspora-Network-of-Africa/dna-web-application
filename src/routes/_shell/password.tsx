// /password (ruling 230): the signed-in change-password path. Since handoff 61-S1 (finding 3) the
// flow lives in the Account drawer's Sign-in and security panel as its password level, and this route
// is a redirect to it, so there is one password flow and not two. The route stays so a bookmark or a
// link that names /password still reaches the flow.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/password")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  beforeLoad: () => {
    throw redirect({
      to: "/settings/$panel",
      params: { panel: "security" },
      search: { open: "password" },
      replace: true,
    });
  },
  component: () => null,
});
