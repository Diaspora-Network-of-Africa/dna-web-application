// /settings (handoff 61-S1, Brief 60-S; EXTRACTION-60-SETTINGS addendum change 1): the Account
// drawer's root, and the layout every panel route renders inside, so one Sheet stays mounted across
// the root and its panels. The Feed is the page underneath (src/lib/feed-view.ts treats /settings*
// as the Feed), the shell renders it, and this route renders the drawer over it. The avatar opens
// this route; Close returns to /feed. Signed-in only: the shell layout redirects an anonymous visitor
// to sign in before this renders. noindex, as every member surface is.
import { createFileRoute, Outlet, useParams, useSearch } from "@tanstack/react-router";
import { AccountDrawer, isPanelId } from "@/components/dna/AccountDrawer";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { member } = useAuth();
  const params = useParams({ strict: false }) as { panel?: string };
  const search = useSearch({ strict: false }) as { open?: string };
  if (!member) return null;
  const panel = isPanelId(params.panel) ? params.panel : null;
  return (
    <>
      <AccountDrawer
        member={member}
        panel={panel}
        openLevel={panel === "security" && search.open === "password" ? "password" : undefined}
      />
      <Outlet />
    </>
  );
}
