// What the Feed column shows for a location (ruling 105). /feed is the list. /posts/:id reached from
// the Feed in this session (history state carries fromFeed) is the same list with that card expanded
// in place; /posts/:id landed on directly renders the expanded card as page content with a
// "Back to Feed" row. Either way the URL is one history entry: expand pushes, collapse pops.
import type { ParsedHistoryState } from "@tanstack/history";

declare module "@tanstack/history" {
  interface HistoryState {
    /** Set by the Feed when it pushes /posts/:id, so the card expands in place and back collapses it. */
    fromFeed?: boolean;
    /** Set when the expansion was requested away from the card (a rail row): scroll it into view. */
    reveal?: boolean;
  }
}

export type FeedView =
  | { kind: "feed" }
  | { kind: "expanded"; id: string; reveal: boolean }
  | { kind: "direct"; id: string };

export function postIdOf(pathname: string): string | null {
  if (!pathname.startsWith("/posts/")) return null;
  const raw = pathname.slice("/posts/".length).split("/")[0] ?? "";
  try {
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    return raw || null;
  }
}

export function feedViewOf(
  pathname: string,
  state: ParsedHistoryState | undefined,
): FeedView | null {
  const id = postIdOf(pathname);
  if (id) {
    return state?.fromFeed
      ? { kind: "expanded", id, reveal: !!state.reveal }
      : { kind: "direct", id };
  }
  // Handoff 61-S1 (EXTRACTION-60-SETTINGS addendum change 1): the Account drawer opens over the Feed,
  // from the avatar and from a link to a panel alike, so /settings and its panels show the list.
  return pathname === "/feed" || isSettingsPath(pathname) ? { kind: "feed" } : null;
}

/** /settings and every route under it. */
export function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}
