// Handoff 62-A, SPEC-62-FEED-CARD 5 (rulings 1799, 1817, 1819, 1822): the reaction summary, one
// control in PostCard's action row between Respond and Save. The glyph cluster in fixed order, then
// the one neutral other mark; up to two photos of people in the viewer's network overlapping by a
// fifth; at medium and expanded one names line that truncates and never wraps. Never a number
// (1797). Tapping it opens the reader's sheet, or the author's for the author (1813); its names
// reach the profiles through the sheet, since the summary is one control (1822). Nothing renders
// when the post has no reactions. Composed from Strand's Avatar and Icon until Strand lands
// ReactionRow's in-row mode and PostCard's summary slot (SPEC 12 proposals 3 and 4; the G entries).
import { Avatar } from "@/components/strand/Avatar";
import { Icon } from "@/components/strand/Icon";
import { joinNames } from "@/lib/names";
import type { ReactionSummary as Summary } from "@/lib/reactions";
import type { PostReactionKindRow } from "@/lib/vocabularies";
import type { Mode, Tier } from "@/lib/tier";
import { EmojiText } from "./EmojiText";

export type ReactionSummaryProps = {
  summary: Summary | undefined;
  kinds: readonly PostReactionKindRow[];
  tier: Tier;
  mode: Mode;
  onOpen: () => void;
  /** A comment's summary (7.2): rings 20, characters 16, photos 20 overlapping 4, text 13. */
  size?: "default" | "small" | undefined;
};

/** R.one to R.twoMore and R.you: the names line, or null where no network name is visible. */
export function summaryLine(summary: Summary): string | null {
  const names = summary.people.map((p) => (p.you ? "You" : p.name));
  if (names.length === 0) return null;
  return joinNames(names, summary.more);
}

export function ReactionSummary({
  summary,
  kinds,
  tier,
  mode,
  onOpen,
  size = "default",
}: ReactionSummaryProps) {
  if (!summary || (summary.kinds.length === 0 && !summary.other)) return null;
  const small = size === "small";
  const ring = small ? 20 : 24;
  const glyph = small ? 16 : 20;
  const photo = small ? 20 : 24;
  const overlap = small ? -4 : -5;
  const byKind = new Map(kinds.map((k) => [k.value, k]));
  const used = summary.kinds.map((k) => byKind.get(k)).filter((k): k is PostReactionKindRow => !!k);
  const line = summaryLine(summary);
  const showNames = !small && tier !== "compact" && line !== null;
  const label = "Reactions: " + (line ?? "Others") + ". See who reacted";
  return (
    <button
      type="button"
      data-reaction-summary=""
      data-summary-kinds={summary.kinds.join(",")}
      data-summary-other={summary.other ? "1" : "0"}
      data-summary-people={String(summary.people.length)}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px",
        borderRadius: "var(--radius-pill)",
        minHeight: mode === "touch" ? 44 : 36,
        maxWidth: "100%",
        minWidth: 0,
        flex: "1 1 auto",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", alignItems: "center", flex: "none" }}
      >
        {used.map((k, i) => (
          <span
            key={k.value}
            data-summary-glyph={k.value}
            style={{
              width: ring,
              height: ring,
              borderRadius: "var(--radius-pill)",
              background: "var(--surface)",
              boxShadow: "0 0 0 1.5px var(--surface)",
              marginLeft: i === 0 ? 0 : -6,
              zIndex: used.length + 1 - i,
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmojiText emoji={k.emoji} size={glyph} />
          </span>
        ))}
        {summary.other && (
          <span
            data-summary-glyph="other"
            style={{
              width: ring,
              height: ring,
              borderRadius: "var(--radius-pill)",
              background: "var(--surface)",
              boxShadow: "0 0 0 1.5px var(--surface)",
              marginLeft: used.length ? -6 : 0,
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: ring - 4,
                height: ring - 4,
                borderRadius: "var(--radius-pill)",
                background: "var(--bg-sunken)",
                color: "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="ellipsis" size={small ? 12 : 14} />
            </span>
          </span>
        )}
      </span>
      {summary.people.length > 0 && (
        <span
          aria-hidden="true"
          style={{ display: "inline-flex", alignItems: "center", flex: "none" }}
        >
          {summary.people.slice(0, 2).map((p, i) => (
            <Avatar
              key={p.id}
              name={p.name}
              src={p.avatar}
              size={photo}
              style={{
                marginLeft: i === 0 ? 0 : overlap,
                boxShadow: "0 0 0 1.5px var(--surface)",
                position: "relative",
                zIndex: 2 - i,
              }}
            />
          ))}
        </span>
      )}
      {showNames && (
        <span
          data-summary-names=""
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            color: "var(--ink-2)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {line}
        </span>
      )}
    </button>
  );
}
