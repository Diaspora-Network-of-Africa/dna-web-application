// Handoff 62-A, SPEC-62-FEED-CARD 2.1 (ruling 1818): a reaction's character rendered as text, the
// device's own emoji, in an aria-hidden span whose control carries the name. Never ReactionGlyph or
// ReactionEmoji for the six, because ReactionEmoji routes a quick-eight character to the drawn
// glyph; the recents and the picker's characters render the same way.
import type { CSSProperties } from "react";

export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function EmojiText({
  emoji,
  size,
  style,
}: {
  emoji: string;
  size: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      data-emoji={emoji}
      style={{
        display: "block",
        fontSize: Math.round(size * 0.86),
        lineHeight: 1,
        fontFamily: EMOJI_FONT,
        userSelect: "none",
        ...style,
      }}
    >
      {emoji}
    </span>
  );
}
