// Handoff 62-A: the Feed's reaction layer, composed for the card (SPEC-62-FEED-CARD 2 to 7, 12;
// rulings 1796 to 1826). One hook the Feed calls: it reads the summary projection once per page
// beside the marks (post_reaction_rows, never per card), holds which card's bar, prompt, picker and
// sheet are open, writes through post_react and post_intent (the two write paths), and hands each
// card its summary for the footer, its bar and prompt for `below`, its React state and the author
// link. The overlays (the sheet, the touch picker, the toast and the one polite live region) render
// once, from `overlays`. Every string is the extraction's by id. Nothing here counts (1797).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Popover } from "@/components/strand/Popover";
import { Sheet } from "@/components/strand/Sheet";
import type { Member } from "@/lib/auth";
import { baseOf, toneFor } from "@/lib/emoji";
import { SETTINGS_KEY } from "@/lib/messenger-inbox";
import { loadSettings, settingsSet } from "@/lib/messenger";
import { firstName } from "@/lib/names";
import type { PostView } from "@/lib/post-view";
import {
  accessibleLabel,
  emojiLabels,
  glossLanguage,
  loadReactionRows,
  loadRecentReactions,
  postIntent,
  postReact,
  splitKinds,
  type OwnReaction,
  type ReactionSummary as Summary,
} from "@/lib/reactions";
import type { Mode, Tier } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";
import { IntentPrompt } from "./IntentPrompt";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionSummary } from "./ReactionSummary";
import { WhoReactedSheet } from "./WhoReactedSheet";

export const reactionsKey = (memberId: string, ids: readonly string[]) =>
  ["reactions", memberId, ids.join(",")] as const;

export type FeedReactionProps = {
  summary: ReactNode;
  below: ReactNode;
  reacted: boolean;
  onReact: () => void;
  onReactOpen: () => void;
  authorHref: string | undefined;
};

export type UseFeedReactions = {
  propsFor: (post: PostView) => FeedReactionProps;
  overlays: ReactNode;
  /** I.sent and the failure lines, for the Feed's own toast slot. */
  toast: string | null;
  /** The author's sheet opened by an intent notification (`?who=`), on that tab. */
  openAuthorSheet: (postId: string, tab: string) => void;
};

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
  const qc = useQueryClient();
  const language = glossLanguage();
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const kinds = useMemo(() => vocab.data?.post_reaction_kinds ?? [], [vocab.data]);
  const { intentKinds } = useMemo(() => splitKinds(kinds), [kinds]);
  const key = reactionsKey(member.id, ids);
  const summaries = useQuery({
    queryKey: key,
    queryFn: () => loadReactionRows([...ids]),
    enabled: ids.length > 0,
  });
  const [bar, setBar] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ postId: string; kind: string } | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ postId: string; tab: string } | null>(null);
  const [live, setLive] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  };
  const announce = (text: string) => {
    setLive("");
    window.setTimeout(() => setLive(text), 30);
  };
  const belowRefs = useRef(new Map<string, HTMLDivElement | null>());
  const plusRef = useRef<HTMLElement | null>(null);
  const belowRefFor = (id: string) => ({
    current: belowRefs.current.get(id) ?? null,
  });

  // The recents and their names, read once the bar opens (1821); the picker's pick refetches them.
  const recents = useQuery({
    queryKey: ["reactions", "recent", member.id],
    queryFn: loadRecentReactions,
    enabled: bar !== null,
  });
  const recentNames = useQuery({
    queryKey: ["reactions", "recent-names", (recents.data ?? []).join(",")],
    queryFn: () => emojiLabels(recents.data ?? []),
    enabled: (recents.data ?? []).length > 0,
  });
  // The full picker's tone and quick eight, the Messenger's (1651, 1776).
  const settings = useQuery({
    queryKey: SETTINGS_KEY(member.id),
    queryFn: loadSettings,
    enabled: picker !== null,
  });
  const tone = toneFor(settings.data?.reaction_skin_tone ?? null);
  const quick = useMemo(() => vocab.data?.message_reaction_quick ?? [], [vocab.data]);
  const setTone = (value: string) =>
    void settingsSet({ skinTone: value })
      .then((row) => qc.setQueryData(SETTINGS_KEY(member.id), row))
      .catch(() => say("Could not save the skin tone."));

  const summaryOf = (id: string): Summary | undefined => summaries.data?.get(id);
  const patch = (id: string, fn: (s: Summary) => Summary) =>
    qc.setQueryData<Map<string, Summary>>(key, (prev) => {
      const next = new Map(prev ?? []);
      const cur = next.get(id) ?? {
        kinds: [],
        other: false,
        people: [],
        more: false,
        own: null,
        intents: [],
      };
      next.set(id, fn(cur));
      return next;
    });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reactions", member.id] });

  const labelOf = (own: OwnReaction) => {
    if (own.kind === "other") return own.emoji ?? "";
    const k = kinds.find((x) => x.value === own.kind);
    return k ? accessibleLabel(k, language) : own.kind;
  };
  const react = useMutation({
    mutationFn: ({
      id,
      kind,
      emoji,
      picked,
    }: {
      id: string;
      kind: string;
      emoji?: string | undefined;
      picked?: boolean | undefined;
    }) => postReact(id, kind, emoji, picked),
    onMutate: ({ id, kind, emoji }) => {
      patch(id, (s) => {
        const held =
          !!s.own &&
          s.own.kind === kind &&
          (kind !== "other" || baseOf(s.own.emoji ?? "") === baseOf(emoji ?? ""));
        return {
          ...s,
          own: held ? null : { kind, emoji: kind === "other" ? (emoji ?? null) : null },
        };
      });
    },
    onSuccess: (own, { id }) => {
      patch(id, (s) => ({ ...s, own }));
    },
    onError: () => say("Could not save the reaction."),
    onSettled: () => void invalidate(),
  });
  const intent = useMutation({
    mutationFn: ({
      id,
      kind,
      on,
      line,
    }: {
      id: string;
      kind: string;
      on: boolean;
      line?: string | undefined;
    }) => postIntent(id, kind, on, line),
    onSuccess: (intents, { id }) => patch(id, (s) => ({ ...s, intents })),
    onError: () => say("Could not save that."),
    onSettled: () => void invalidate(),
  });

  const pick = (id: string, kind: string, emoji?: string, picked = false) => {
    const own = summaryOf(id)?.own ?? null;
    const held =
      !!own &&
      own.kind === kind &&
      (kind !== "other" || baseOf(own.emoji ?? "") === baseOf(emoji ?? ""));
    const next: OwnReaction = { kind, emoji: kind === "other" ? (emoji ?? null) : null };
    react.mutate({ id, kind, emoji, picked });
    if (picked) void qc.invalidateQueries({ queryKey: ["reactions", "recent", member.id] });
    if (held) announce("Reaction removed");
    else if (own) announce("Reaction changed to " + labelOf(next));
    else announce("Reacted with " + labelOf(next));
    setBar(null);
    setPicker(null);
  };
  const onReactTap = (id: string) => {
    const own = summaryOf(id)?.own ?? null;
    if (own) pick(id, own.kind, own.emoji ?? undefined);
    else pick(id, "asante");
  };
  const onIntentTap = (id: string, kind: string) => {
    const s = summaryOf(id);
    const row = intentKinds.find((k) => k.value === kind);
    if (!row) return;
    if (s?.intents.includes(kind)) {
      intent.mutate({ id, kind, on: false });
      announce(row.label + ", removed.");
      return;
    }
    setPrompt({ postId: id, kind });
  };
  const postOf = (id: string) => posts.find((p) => p.id === id);
  const sendIntent = (line: string | null) => {
    if (!prompt) return;
    const row = intentKinds.find((k) => k.value === prompt.kind);
    const post = postOf(prompt.postId);
    const first = firstName(post?.author_name);
    intent.mutate({ id: prompt.postId, kind: prompt.kind, on: true, line: line ?? undefined });
    if (line) say("Sent to " + first + ".");
    announce((row?.label ?? prompt.kind) + ", on. Only " + first + " sees it.");
    setPrompt(null);
    setBar(null);
  };

  // Escape and a press outside close the bar (SPEC 3).
  useEffect(() => {
    if (!bar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !prompt && !picker) setBar(null);
    };
    const onDown = (e: PointerEvent) => {
      const el = belowRefs.current.get(bar);
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      if (!prompt && !picker) setBar(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [bar, prompt, picker]);

  const openAuthorSheet = useCallback(
    (postId: string, tab: string) => setSheet({ postId, tab }),
    [],
  );

  const propsFor = (post: PostView): FeedReactionProps => {
    const id = post.id ?? "";
    const s = summaryOf(id);
    const isAuthor = post.author_kind === "member" && post.author_handle === member.handle;
    const recentRows = (recents.data ?? []).map((e) => ({
      emoji: e,
      label: recentNames.data?.get(e) ?? null,
    }));
    const promptRow =
      prompt && prompt.postId === id ? intentKinds.find((k) => k.value === prompt.kind) : undefined;
    const author = {
      name: post.author_name,
      handle: post.author_handle ?? "",
      avatar: post.author_avatar,
    };
    const below =
      bar === id || (prompt && prompt.postId === id) || picker === id ? (
        <div
          ref={(el) => {
            belowRefs.current.set(id, el);
          }}
          data-reaction-below=""
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
            position: "relative",
          }}
        >
          {bar === id && (
            <ReactionBar
              kinds={kinds}
              own={s?.own ?? null}
              intents={s?.intents ?? []}
              recents={recentRows}
              onPick={(kind, emoji) => pick(id, kind, emoji)}
              onIntent={(kind) => onIntentTap(id, kind)}
              onMore={() => setPicker(id)}
              mode={mode}
              tier={tier}
              plusRef={plusRef}
              language={language}
            />
          )}
          {promptRow && mode === "pointer" && (
            <IntentPrompt
              open
              kind={promptRow}
              c={post.c_category}
              author={author}
              mode={mode}
              tier={tier}
              anchorRef={belowRefFor(id)}
              onSend={(line) => sendIntent(line)}
              onSkip={() => sendIntent(null)}
              onClose={() => setPrompt(null)}
            />
          )}
          {picker === id && mode === "pointer" && (
            <Popover
              open
              onClose={() => setPicker(null)}
              anchorRef={plusRef}
              title="React"
              input="pointer"
              portal={false}
            >
              <ReactionPicker
                tone={tone}
                onTone={setTone}
                recent={recents.data ?? []}
                quick={quick}
                onPick={(emoji) => pick(id, "other", emoji, true)}
                input={mode}
                listHeight={300}
              />
            </Popover>
          )}
        </div>
      ) : null;
    return {
      summary: (
        <ReactionSummary
          summary={s}
          kinds={kinds}
          tier={tier}
          mode={mode}
          onOpen={() => setSheet({ postId: id, tab: "all" })}
        />
      ),
      below,
      reacted: !!s?.own,
      onReact: () => onReactTap(id),
      onReactOpen: () => setBar(id),
      authorHref:
        post.author_kind === "member" && post.author_handle
          ? "/m/" + post.author_handle
          : undefined,
    };
  };

  const sheetPost = sheet ? postOf(sheet.postId) : undefined;
  const promptPost = prompt ? postOf(prompt.postId) : undefined;
  const promptRowTouch =
    prompt && mode === "touch" ? intentKinds.find((k) => k.value === prompt.kind) : undefined;
  const pickerPost = picker ? postOf(picker) : undefined;
  const overlays = (
    <>
      <div
        aria-live="polite"
        data-reaction-live=""
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {live}
      </div>
      {sheet && sheetPost && (
        <WhoReactedSheet
          open
          postId={sheet.postId}
          c={sheetPost.c_category}
          author={sheetPost.author_kind === "member" && sheetPost.author_handle === member.handle}
          kinds={kinds}
          tier={tier}
          mode={mode}
          initialTab={sheet.tab}
          onClose={() => setSheet(null)}
          language={language}
        />
      )}
      {promptRowTouch && promptPost && (
        <IntentPrompt
          open
          kind={promptRowTouch}
          c={promptPost.c_category}
          author={{
            name: promptPost.author_name,
            handle: promptPost.author_handle ?? "",
            avatar: promptPost.author_avatar,
          }}
          mode={mode}
          tier={tier}
          onSend={(line) => sendIntent(line)}
          onSkip={() => sendIntent(null)}
          onClose={() => setPrompt(null)}
        />
      )}
      {picker && pickerPost && mode === "touch" && (
        <Sheet
          open
          onClose={() => setPicker(null)}
          variant={tier === "compact" ? "sheet" : "drawer"}
          label="React"
          actions={
            <Button variant="secondary" onClick={() => setPicker(null)}>
              Done
            </Button>
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 56,
              padding: "0 8px 0 20px",
              borderBottom: "1px solid var(--line)",
              flex: "none",
            }}
          >
            <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700 }}>
              React
            </h2>
            <IconButton name="x" label="Close" onClick={() => setPicker(null)} />
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "hidden",
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
            data-testid="react-sheet"
          >
            <ReactionPicker
              tone={tone}
              onTone={setTone}
              recent={recents.data ?? []}
              quick={quick}
              onPick={(emoji) => pick(picker, "other", emoji, true)}
              input={mode}
            />
          </div>
        </Sheet>
      )}
    </>
  );
  return { propsFor, overlays, toast, openAuthorSheet };
}
