// /settings, the root of the Account drawer (handoff 61-S1). The layout route renders the drawer;
// this route owns the URL and renders nothing of its own.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/")({ component: () => null });
