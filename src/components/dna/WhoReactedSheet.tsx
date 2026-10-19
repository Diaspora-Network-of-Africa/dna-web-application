// Handoff 62-A, SPEC-62-FEED-CARD 6 and 7 (rulings 1797, 1799, 1808, 1811, 1813, 1820, 1823, 141):
// the Who reacted sheet. For any reader: the rows post_reactors_visible admits, the viewer's own
// row first as You, each row's photo and name opening the profile, the headline, the relationship
// in words (Connected, Through {name}, or nothing), View profile on rows outside the viewer's
// network only, and the reaction in a 28 ring at the row's end, never on the photo; no tabs, no
// figure, no intent. For the post's author: the same rows under Tabs in the post's C, each tab's
// label carrying its exact figure from post_reactors_author, an intent row with its quoted line,
// a reactor whose name may not reach the author as the role A.role with no photo and no link, and
// the footer act A.panel, disabled until the author's panel ships (H62-D; the G entry). Composed
// from Sheet, Tabs, Avatar and Button until Strand lands WhoReactedSheet and PersonRow (SPEC 12
// proposals 5 and 6; the G entries). Loading and a failed read render words, never a figure.
// Handoff 62-G (SPEC 8.2, 1822): the same sheet for a comment, through comment_reactors_visible and
// comment_reactors_author; `target` names which, and the author's sheet for a comment is the
// commenter's, with no A.panel (the panel is the post's own figures, H62-D).
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Sheet } from "@/components/strand/Sheet";
import { Tabs } from "@/components/strand/Tabs";
import type { CardC } from "@/components/strand/cmeta";
import { loadCommentReactorsAuthor, loadCommentReactorsVisible } from "@/lib/comments";
import {
  accessibleLabel,
  loadReactorsAuthor,
  loadReactorsVisible,
  visibleLabel,
  type AuthorRow,
  type ReactionPerson,
  type ReactorRow,
  type Relationship,
} from "@/lib/reactions";
import type { Mode, Tier } from "@/lib/tier";
import type { PostReactionKindRow } from "@/lib/vocabularies";
import { EmojiText } from "./EmojiText";
import { PersonLink, profileLabel } from "./PersonLink";

export const ROLE_LABEL = "A member outside your network";

export type WhoReactedTarget = "post" | "comment";

export type WhoReactedSheetProps = {
  open: boolean;
  /** 62-G: whose reactions, a post's (the default) or a comment's. */
  target?: WhoReactedTarget | undefined;
  targetId: string;
  c: CardC;
  /** The viewer authored the post: the author's sheet (1813). */
  author: boolean;
  kinds: readonly PostReactionKindRow[];
  tier: Tier;
  mode: Mode;
  /** author: the tab to open on (the intent notification's destination), a kind or "all". */
  initialTab?: string | undefined;
  onClose: () => void;
  language?: string | undefined;
};

/** S.connected, S.through {name}; nothing for self and outside. */
function relationshipWords(
  rel: Relationship | null,
  through: ReactionPerson | null,
): string | null {
  if (rel === "connected") return "Connected";
  if (rel === "through" && through) return "Through " + through.name;
  return null;
}

type RowProps = {
  person: (ReactionPerson & { headline: string | null }) | null;
  kind: string;
  emoji: string | null;
  line: string | null;
  relationship: Relationship | null;
  through: ReactionPerson | null;
  kinds: readonly PostReactionKindRow[];
  mode: Mode;
  language: string | undefined;
  onNavigate: () => void;
};

/** One row (proposal 6): the row link, View profile outside the network, the reaction at the end. */
function PersonRow({
  person,
  kind,
  emoji,
  line,
  relationship,
  through,
  kinds,
  mode,
  language,
  onNavigate,
}: RowProps) {
  const row = kinds.find((k) => k.value === kind);
  const glyph = kind === "other" ? (emoji ?? "") : (row?.emoji ?? "");
  const reactionName =
    kind === "other" ? "Other reactions" : row ? accessibleLabel(row, language) : kind;
  const reactionVisible =
    kind === "other" ? (emoji ?? "") : row ? visibleLabel(row, language) : kind;
  const words = relationshipWords(relationship, through);
  const outside = relationship === "outside" || relationship === "through";
  const name = person ? (person.you ? "You" : person.name) : ROLE_LABEL;
  const ariaName = person
    ? [person.name + ", " + reactionName, words, profileLabel(person.name)]
        .filter(Boolean)
        .join(". ")
    : ROLE_LABEL + ", " + reactionName;
  const textColumn = (
    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: person ? "var(--ink)" : "var(--ink-2)",
        }}
      >
        {name}
      </span>
      {person?.headline ? (
        <span
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {person.headline}
        </span>
      ) : null}
      {words ? (
        <span
          data-row-relationship={relationship}
          style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}
        >
          {words}
        </span>
      ) : null}
      {line ? (
        <span
          aria-label="Their line"
          data-intent-row-line=""
          style={{ fontSize: 15, lineHeight: 1.4, color: "var(--ink)", marginTop: 2 }}
        >
          “{line}”
        </span>
      ) : null}
    </span>
  );
  return (
    <li
      data-reactor-row={person ? person.handle : "role"}
      data-reactor-kind={kind}
      style={{ borderTop: "1px solid var(--line)", listStyle: "none", margin: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64 }}>
        {person ? (
          <PersonLink
            name={person.name}
            handle={person.handle}
            avatar={person.avatar}
            size={40}
            onNavigate={onNavigate}
            style={{ flex: 1, minWidth: 0, gap: 12, padding: "8px 0", textDecoration: "none" }}
            ariaLabel={ariaName}
          >
            {textColumn}
          </PersonLink>
        ) : (
          <div
            role="group"
            aria-label={ariaName}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              gap: 12,
              padding: "8px 0",
              alignItems: "center",
            }}
          >
            <span aria-hidden="true" style={{ width: 40, height: 40, flex: "none" }} />
            {textColumn}
          </div>
        )}
        {person && !person.you && outside && (
          <Button
            variant="ghost"
            size={mode === "touch" ? "md" : "sm"}
            aria-label={"View profile: " + person.name}
            onClick={onNavigate}
            style={{ flex: "none" }}
            data-view-profile={person.handle}
          >
            View profile
          </Button>
        )}
        <span
          aria-hidden="true"
          title={reactionVisible}
          data-row-reaction={kind}
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-pill)",
            background: "var(--bg-sunken)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {glyph ? <EmojiText emoji={glyph} size={16} /> : null}
        </span>
      </div>
    </li>
  );
}

export function WhoReactedSheet({
  open,
  target = "post",
  targetId,
  c,
  author,
  kinds,
  tier,
  mode,
  initialTab,
  onClose,
  language,
}: WhoReactedSheetProps) {
  const [tab, setTab] = useState<string>(initialTab ?? "all");
  useEffect(() => {
    setTab(initialTab ?? "all");
  }, [initialTab, targetId, open]);
  const visible = useQuery({
    queryKey: ["reactors", target, "visible", targetId],
    queryFn: () =>
      target === "comment" ? loadCommentReactorsVisible(targetId) : loadReactorsVisible(targetId),
    enabled: open && !author,
  });
  const mine = useQuery({
    queryKey: ["reactors", target, "author", targetId],
    queryFn: () =>
      target === "comment" ? loadCommentReactorsAuthor(targetId) : loadReactorsAuthor(targetId),
    enabled: open && author,
  });
  const navigateAway = () => onClose();
  let list: ReactNode;
  let head: ReactNode = null;
  let foot: ReactNode = null;
  const title = "Who reacted";
  const status = (words: string) => (
    <p role="status" style={{ margin: 0, padding: "12px 0", fontSize: 15, color: "var(--ink-3)" }}>
      {words}
    </p>
  );
  if (!author) {
    const rows: ReactorRow[] = visible.data ?? [];
    list = visible.isPending
      ? status("Loading")
      : visible.isError
        ? status("Could not load who reacted.")
        : rows.length === 0
          ? status("No one yet.")
          : rows.map((r) => (
              <PersonRow
                key={r.id + ":" + r.kind}
                person={r}
                kind={r.kind}
                emoji={r.emoji}
                line={null}
                relationship={r.relationship}
                through={r.through}
                kinds={kinds}
                mode={mode}
                language={language}
                onNavigate={navigateAway}
              />
            ));
  } else {
    const sheet = mine.data;
    const figures = sheet?.figures ?? {};
    const n = (k: string) => String(figures[k] ?? 0);
    const items = [
      { id: "all", label: "All " + n("all") },
      ...kinds.map((k) => ({ id: k.value, label: k.label + " " + n(k.value) })),
    ];
    head = (
      <Tabs
        items={items}
        value={tab}
        onChange={setTab}
        c={c === "system" ? undefined : c}
        style={{ margin: "0 calc(-1 * var(--space-5))", padding: "0 var(--space-5)", flex: "none" }}
      />
    );
    const rows: AuthorRow[] = (sheet?.rows ?? []).filter((r) => tab === "all" || r.kind === tab);
    list = mine.isPending
      ? status("Loading")
      : mine.isError
        ? status("Could not load who reacted.")
        : rows.length === 0
          ? status("No one yet.")
          : rows.map((r, i) => (
              <PersonRow
                key={(r.person?.id ?? "role") + ":" + r.kind + ":" + i}
                person={r.person}
                kind={r.kind}
                emoji={r.emoji}
                line={r.class === "intent" ? r.line : null}
                relationship={r.relationship}
                through={r.through}
                kinds={kinds}
                mode={mode}
                language={language}
                onNavigate={navigateAway}
              />
            ));
    foot =
      target === "post" ? (
        <Button
          variant="ghost"
          size="sm"
          disabled
          data-author-panel=""
          style={{ alignSelf: "flex-start" }}
        >
          See this post’s figures
        </Button>
      ) : null;
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant={tier === "compact" ? "sheet" : "drawer"}
      label={title}
      actions={foot ?? undefined}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 56,
          padding: "0 8px 0 20px",
          borderBottom: head ? "none" : "1px solid var(--line)",
          flex: "none",
        }}
      >
        <h2 data-sheet-heading style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 700 }}>
          {title}
        </h2>
        <IconButton name="x" label="Close" onClick={onClose} />
      </div>
      <div
        data-who-reacted={author ? "author" : "reader"}
        data-who-reacted-target={target}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 20px",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {head}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{list}</ul>
      </div>
    </Sheet>
  );
}
