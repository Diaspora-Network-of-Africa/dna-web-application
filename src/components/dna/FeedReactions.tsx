// Handoff 62-A: the Feed's reaction layer for posts (SPEC-62-FEED-CARD 2 to 7, 12; rulings 1796 to
// 1826), since handoff 62-G one call of the shared layer in ReactionLayer.tsx, which comments share
// (SPEC 8.2): the post's six write paths and projections, each PostView as a target, the author's
// sheet for the viewer's own post (1813). Nothing here counts (1797).
import type { ReactNode } from "react";
import type { Member } from "@/lib/auth";
import type { ReactionTarget } from "@/lib/comments";
import type { PostView } from "@/lib/post-view";
import type { Mode, Tier } from "@/lib/tier";
import { POST_REACTIONS, useReactionLayer, type ReactionLayerProps } from "./ReactionLayer";

export { reactionsKey } from "./ReactionLayer";

export type FeedReactionProps = ReactionLayerProps;

export type UseFeedReactions = {
  propsFor: (post: PostView) => FeedReactionProps;
  overlays: ReactNode;
  /** I.sent and the failure lines, for the Feed's own toast slot. */
  toast: string | null;
  /** The author's sheet opened by an intent notification (`?who=`), on that tab. */
  openAuthorSheet: (postId: string, tab: string) => void;
};

/** A post as the layer sees it: its id, its C and its author for the prompt's line and the sheets. */
export function postTarget(post: PostView): ReactionTarget {
  return {
    id: post.id ?? "",
    c: post.c_category,
    author: {
      id: post.author_kind === "member" ? post.author_id : undefined,
      name: post.author_name,
      handle: post.author_kind === "member" ? (post.author_handle ?? "") : "",
      avatar: post.author_avatar,
    },
  };
}

export function useFeedReactions({
  member,
  ids,
  posts,
  tier,
  mode,
}: {
  member: Member;
  ids: readonly string[];
  posts: readonly PostView[];
  tier: Tier;
  mode: Mode;
}): UseFeedReactions {
  const layer = useReactionLayer({
    kind: "post",
    api: POST_REACTIONS,
    member,
    ids,
    targets: posts.map(postTarget),
    tier,
    mode,
  });
  return {
    propsFor: (post) => layer.propsFor(postTarget(post)),
    overlays: layer.overlays,
    toast: layer.toast,
    openAuthorSheet: layer.openAuthorSheet,
  };
}
