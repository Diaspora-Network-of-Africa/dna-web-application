// /settings/{panel} (handoff 61-S1; EXTRACTION-60-SETTINGS addendum change 1): one panel of the
// Account drawer, which the /settings layout route renders so the Sheet stays mounted across a push
// and a Back. The five panels this PR ships (1740) are security, privacy, notifications, preferences
// and blocked; anything else is the root. `?open=password` is how /password lands here with the
// password level open (handoff finding 3): the drawer consumes it once.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { isPanelId } from "@/components/dna/AccountDrawer";

export type SettingsPanelSearch = { open?: "password" };

export const Route = createFileRoute("/_shell/settings/$panel")({
  validateSearch: (search: Record<string, unknown>): SettingsPanelSearch =>
    search["open"] === "password" ? { open: "password" } : {},
  beforeLoad: ({ params }) => {
    if (!isPanelId(params.panel)) throw redirect({ to: "/settings", replace: true });
  },
  component: () => null,
});
