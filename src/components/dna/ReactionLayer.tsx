// Handoffs 62-A and 62-G: the reaction layer, composed once for a post and for a comment
// (SPEC-62-FEED-CARD 2 to 7, 8.2, 12; rulings 1796 to 1826, 1844). One hook per surface: it reads the
// summary projection once per page beside the marks (post_reaction_rows or comment_reaction_rows,
// never per card), holds which target's bar, prompt, picker and sheet are open, writes through the
// target's two write paths (post_react and post_intent, or comment_react and comment_intent), and
// hands each target its summary, its bar and prompt for `below`, its React state and the author link.
// The overlays (the sheet, the touch picker and the one polite live region) render once, from
// `overlays`. Every string is the extraction's by id. Nothing here counts (1797).
//
// 1844 (Done Means 8): the summary and the intents change the moment the member acts. A reaction
// patches the member's own mark, the kinds in the vocabulary's order, the other mark and the member's
// own photo among the people; an intent patches the member's intents; the refetch after the write
// settles the rest. A refused write rolls the patch back to what was held before it and says so in the
// live region, and the toast carries the same words for a sighted member.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Popover } from "@/components/strand/Popover";
import { Sheet } from "@/components/strand/Sheet";
import type { Member } from "@/lib/auth";
import {
  commentIntent,
  commentReact,
  loadCommentReactionRows,
  type ReactionTarget,
} from "@/lib/comments";
import { baseOf, toneFor } from "@/lib/emoji";
import { SETTINGS_KEY } from "@/lib/messenger-inbox";
import { loadSettings, settingsSet } from "@/lib/messenger";
import { firstName } from "@/lib/names";
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
import { loadVocabularies, type PostReactionKindRow } from "@/lib/vocabularies";
import { IntentPrompt } from "./IntentPrompt";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionSummary } from "./ReactionSummary";
import { WhoReactedSheet, type WhoReactedTarget } from "./WhoReactedSheet";

export type ReactionApi = {
  rows: (ids: string[]) => Promise<Map<string, Summary>>;
  react: (
    id: string,
    kind: string,
    emoji?: string | null,
    picked?: boolean,
  ) => Promise<OwnReaction | null>;
  intent: (id: string, kind: string, on: boolean, line?: string | null) => Promise<string[]>;
};

/** The post's six: 62-A's write paths and projection. */
export const POST_REACTIONS: ReactionApi = {
  rows: loadReactionRows,
  react: postReact,
  intent: postIntent,
};

/** The comment's, the post's rules applied per comment (SPEC 2.2 through 8.2). */
export const COMMENT_REACTIONS: ReactionApi = {
  rows: loadCommentReactionRows,
  react: commentReact,
  intent: commentIntent,
};

export const reactionsKey = (kind: WhoReactedTarget, memberId: string, ids: readonly string[]) =>
  ["reactions", kind, memberId, ids.join(",")] as const;

const EMPTY: Summary = { kinds: [], other: false, people: [], more: false, own: null, intents: [] };

/** The summary with the member's own mark changed, in the vocabulary's order (1844). */
export function patchOwn(
  s: Summary,
  next: OwnReaction | null,
  kinds: readonly PostReactionKindRow[],
  me: { id: string; name: string; handle: string; avatar?: string | undefined },
): Summary {
  const order = kinds.filter((k) => k.class === "public").map((k) => k.value);
  const kindSet = new Set(s.kinds);
  let other = s.other;
  // What the member held is no longer certain to be held by anyone else; the refetch settles it.
  if (next) {
    if (next.kind === "other") other = true;
    else kindSet.add(next.kind);
  }
  const people = s.people.filter((p) => !p.you);
  if (next) people.unshift({ ...me, you: true });
  const shown = people.slice(0, 2);
  return {
    ...s,
    own: next,
    other,
    kinds: order.filter((k) => kindSet.has(k)),
    people: shown,
    more: s.more || people.length > shown.length,
  };
}

export type ReactionLayerProps = {
  summary: ReactNode;
  below: ReactNode;
  reacted: boolean;
  onReact: () => void;
  onReactOpen: () => void;
  authorHref: string | undefined;
};

export type UseReactionLayer = {
  propsFor: (target: ReactionTarget) => ReactionLayerProps;
  overlays: ReactNode;
  /** I.sent and the failure lines, for the surface's own toast slot. */
  toast: string | null;
  /** The author's sheet opened by an intent notification (`?who=`), on that tab. */
  openAuthorSheet: (id: string, tab: string) => void;
  /** The summary held for an id, patched or fetched. */
  summaryOf: (id: string) => Summary | undefined;
};

export function useReactionLayer({
  kind,
  api,
  member,
  ids,
  targets,
  tier,
  mode,
  initial,
  size = "default",
}: {
  kind: WhoReactedTarget;
  api: ReactionApi;
  member: Member;
  ids: readonly string[];
  targets: readonly ReactionTarget[];
  tier: Tier;
  mode: Mode;
  /** Summaries the surface already holds (the thread's answer carries each comment's), so the first paint reads them. */
  initial?: Map<string, Summary> | undefined;
  /** The comment's summary is SPEC 5 at `small`. */
  size?: "default" | "small" | undefined;
}): UseReactionLayer {
  const qc = useQueryClient();
  const language = glossLanguage();
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const kinds = useMemo(() => vocab.data?.post_reaction_kinds ?? [], [vocab.data]);
  const { intentKinds } = useMemo(() => splitKinds(kinds), [kinds]);
  const key = reactionsKey(kind, member.id, ids);
  const summaries = useQuery({
    queryKey: key,
    queryFn: () => api.rows([...ids]),
    enabled: ids.length > 0,
    ...(initial ? { initialData: initial, staleTime: 30_000 } : {}),
  });
  const [bar, setBar] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ id: string; kind: string } | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; tab: string } | null>(null);
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
      next.set(id, fn(next.get(id) ?? EMPTY));
      return next;
    });
  const restore = (id: string, prev: Summary | undefined) =>
    qc.setQueryData<Map<string, Summary>>(key, (cur) => {
      const next = new Map(cur ?? []);
      if (prev) next.set(id, prev);
      else next.delete(id);
      return next;
    });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reactions", kind, member.id] });
  const me = {
    id: member.id,
    name: member.name,
    handle: member.handle ?? "",
    avatar: member.avatar,
  };

  const labelOf = (own: OwnReaction) => {
    if (own.kind === "other") return own.emoji ?? "";
    const k = kinds.find((x) => x.value === own.kind);
    return k ? accessibleLabel(k, language) : own.kind;
  };
  const react = useMutation({
    mutationFn: ({
      id,
      kind: k,
      emoji,
      picked,
    }: {
      id: string;
      kind: string;
      emoji?: string | undefined;
      picked?: boolean | undefined;
    }) => api.react(id, k, emoji, picked),
    onMutate: ({ id, kind: k, emoji }) => {
      const prev = summaryOf(id);
      const s = prev ?? EMPTY;
      const held =
        !!s.own &&
        s.own.kind === k &&
        (k !== "other" || baseOf(s.own.emoji ?? "") === baseOf(emoji ?? ""));
      patch(id, (cur) =>
        patchOwn(
          cur,
          held ? null : { kind: k, emoji: k === "other" ? (emoji ?? null) : null },
          kinds,
          me,
        ),
      );
      return { prev };
    },
    onSuccess: (own, { id }) => {
      patch(id, (s) => ({ ...s, own }));
    },
    onError: (_e, { id }, ctx) => {
      restore(id, ctx?.prev);
      announce("Could not save the reaction.");
      say("Could not save the reaction.");
    },
    onSettled: () => void invalidate(),
  });
  const intent = useMutation({
    mutationFn: ({
      id,
      kind: k,
      on,
      line,
    }: {
      id: string;
      kind: string;
      on: boolean;
      line?: string | undefined;
    }) => api.intent(id, k, on, line),
    onMutate: ({ id, kind: k, on }) => {
      const prev = summaryOf(id);
      const order = intentKinds.map((x) => x.value);
      patch(id, (s) => {
        const set = new Set(s.intents);
        if (on) set.add(k);
        else set.delete(k);
        return { ...s, intents: order.filter((x) => set.has(x)) };
      });
      return { prev };
    },
    onSuccess: (intents, { id }) => patch(id, (s) => ({ ...s, intents })),
    onError: (_e, { id }, ctx) => {
      restore(id, ctx?.prev);
      announce("Could not save that.");
      say("Could not save that.");
    },
    onSettled: () => void invalidate(),
  });

  const pick = (id: string, k: string, emoji?: string, picked = false) => {
    const own = summaryOf(id)?.own ?? null;
    const held =
      !!own && own.kind === k && (k !== "other" || baseOf(own.emoji ?? "") === baseOf(emoji ?? ""));
    const next: OwnReaction = { kind: k, emoji: k === "other" ? (emoji ?? null) : null };
    react.mutate({ id, kind: k, emoji, picked });
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
  const onIntentTap = (id: string, k: string) => {
    const s = summaryOf(id);
    const row = intentKinds.find((x) => x.value === k);
    if (!row) return;
    if (s?.intents.includes(k)) {
      intent.mutate({ id, kind: k, on: false });
      announce(row.label + ", removed.");
      return;
    }
    setPrompt({ id, kind: k });
  };
  const targetOf = (id: string) => targets.find((t) => t.id === id);
  const sendIntent = (line: string | null) => {
    if (!prompt) return;
    const row = intentKinds.find((x) => x.value === prompt.kind);
    const t = targetOf(prompt.id);
    const first = firstName(t?.author.name);
    intent.mutate({ id: prompt.id, kind: prompt.kind, on: true, line: line ?? undefined });
    if (line) say("Sent to " + first + ".");
    announce((row?.label ?? prompt.kind) + ", on. Only " + first + " sees it.");
    setPrompt(null);
    setBar(null);
  };

  // Escape and a press outside close the bar (SPEC 3). H62-G1 (1905), the Messenger's 1739 rule: the
  // close waits for the outside press's click, because closing on the pointerdown lifts everything
  // under the bar before the release, and the click then lands on whatever moved under the pointer
  // or nowhere. That was the walk's lost React and Reply: the post's bar, open above the thread from
  // a pass over the post's React, closed on the press of a comment's React and lifted the thread
  // away from it, so comment_react was never sent. No click (a scroll, a drag) closes it on
  // pointercancel or 400 ms after the release. Only a press that began while the bar was open arms
  // it, so the release that ends the hold which opened the bar does not close it.
  useEffect(() => {
    if (!bar) return;
    const id = bar;
    const close = () => {
      if (!prompt && !picker) setBar((b) => (b === id ? null : b));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    let armed = false;
    let timer = 0;
    const settle = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(close, ms);
    };
    const onDown = (e: PointerEvent) => {
      const el = belowRefs.current.get(id);
      armed = !(el && e.target instanceof Node && el.contains(e.target));
    };
    const onUp = () => {
      if (armed) settle(400);
    };
    const landed = () => {
      if (armed) settle(0);
      armed = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("click", landed, true);
    window.addEventListener("pointercancel", landed, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("click", landed, true);
      window.removeEventListener("pointercancel", landed, true);
    };
  }, [bar, prompt, picker]);

  const openAuthorSheet = useCallback((id: string, tab: string) => setSheet({ id, tab }), []);

  const propsFor = (t: ReactionTarget): ReactionLayerProps => {
    const id = t.id;
    const s = summaryOf(id);
    const recentRows = (recents.data ?? []).map((e) => ({
      emoji: e,
      label: recentNames.data?.get(e) ?? null,
    }));
    const promptRow =
      prompt && prompt.id === id ? intentKinds.find((k) => k.value === prompt.kind) : undefined;
    const below =
      bar === id || (prompt && prompt.id === id) || picker === id ? (
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
              onPick={(k, emoji) => pick(id, k, emoji)}
              onIntent={(k) => onIntentTap(id, k)}
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
              c={t.c}
              author={{ name: t.author.name, handle: t.author.handle, avatar: t.author.avatar }}
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
          size={size}
          onOpen={() => setSheet({ id, tab: "all" })}
        />
      ),
      below,
      reacted: !!s?.own,
      onReact: () => onReactTap(id),
      onReactOpen: () => setBar(id),
      authorHref: t.author.handle ? "/m/" + t.author.handle : undefined,
    };
  };

  const sheetTarget = sheet ? targetOf(sheet.id) : undefined;
  const promptTarget = prompt ? targetOf(prompt.id) : undefined;
  const promptRowTouch =
    prompt && mode === "touch" ? intentKinds.find((k) => k.value === prompt.kind) : undefined;
  const pickerTarget = picker ? targetOf(picker) : undefined;
  const overlays = (
    <>
      <div
        aria-live="polite"
        data-reaction-live={kind}
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
      {sheet && sheetTarget && (
        <WhoReactedSheet
          open
          target={kind}
          targetId={sheet.id}
          c={sheetTarget.c}
          author={!!sheetTarget.author.id && sheetTarget.author.id === member.id}
          kinds={kinds}
          tier={tier}
          mode={mode}
          initialTab={sheet.tab}
          onClose={() => setSheet(null)}
          language={language}
        />
      )}
      {promptRowTouch && promptTarget && (
        <IntentPrompt
          open
          kind={promptRowTouch}
          c={promptTarget.c}
          author={{
            name: promptTarget.author.name,
            handle: promptTarget.author.handle,
            avatar: promptTarget.author.avatar,
          }}
          mode={mode}
          tier={tier}
          onSend={(line) => sendIntent(line)}
          onSkip={() => sendIntent(null)}
          onClose={() => setPrompt(null)}
        />
      )}
      {picker && pickerTarget && mode === "touch" && (
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
  return { propsFor, overlays, toast, openAuthorSheet, summaryOf };
}
