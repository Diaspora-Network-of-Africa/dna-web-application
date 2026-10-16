// Handoff 62-A, SPEC-62-FEED-CARD 4 (rulings 1798, 1802, 1820): the intent prompt, opened from
// I can help or Let's build in the bar when the intent is off. On touch a Sheet at the tier's
// geometry titled with the label, Skip and Send in its footer; on pointer a Popover anchored to
// the `below` slot with the two buttons right-aligned under the field. The body: I.line "Only
// {first} sees this." with {first} a PersonLink of the post's author at 20, then one optional
// multiline field (I.field, the placeholder per intent), autofocused on pointer only. Send is
// disabled until there is text; Skip sets the intent with no line. Composed from Sheet, Popover,
// Input and Button until Strand lands IntentPrompt (SPEC 12 proposal 7; the G entry).
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { Popover } from "@/components/strand/Popover";
import { Sheet } from "@/components/strand/Sheet";
import type { CardC } from "@/components/strand/cmeta";
import type { Mode, Tier } from "@/lib/tier";
import type { PostReactionKindRow } from "@/lib/vocabularies";
import { PersonLink } from "./PersonLink";

export const INTENT_LINE_MAX = 240;

export type IntentPromptProps = {
  open: boolean;
  kind: PostReactionKindRow;
  c: CardC;
  author: { name: string; handle: string; avatar?: string | undefined };
  mode: Mode;
  tier: Tier;
  /** pointer: the `below` slot the Popover anchors to. */
  anchorRef?: RefObject<HTMLElement | null> | undefined;
  onSend: (line: string) => void;
  onSkip: () => void;
  onClose: () => void;
};

const PLACEHOLDER: Record<string, string> = {
  help: "What you can offer",
  build: "What you have in mind",
};

export function IntentPrompt({
  open,
  kind,
  c,
  author,
  mode,
  tier,
  anchorRef,
  onSend,
  onSkip,
  onClose,
}: IntentPromptProps) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const line = text.trim();
  const send = () => {
    if (!line) return;
    onSend(line.slice(0, INTENT_LINE_MAX));
    setText("");
  };
  const skip = () => {
    onSkip();
    setText("");
  };
  const body: ReactNode = (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      data-intent-prompt={kind.value}
    >
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.5,
          color: "var(--ink-2)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        <span>Only</span>
        <PersonLink
          name={author.name}
          handle={author.handle}
          avatar={author.avatar}
          size={20}
          first
        />
        <span>sees this.</span>
      </p>
      <Input
        label="Add a line, optional"
        multiline
        rows={2}
        placeholder={PLACEHOLDER[kind.value] ?? ""}
        value={text}
        maxLength={INTENT_LINE_MAX}
        onChange={(e) => setText(e.target.value)}
        autoFocus={mode === "pointer"}
        data-intent-line=""
      />
    </div>
  );
  const skipButton = (
    <Button variant="secondary" onClick={skip} data-intent-skip="">
      Skip
    </Button>
  );
  const sendButton = (
    <Button c={c === "system" ? undefined : c} disabled={!line} onClick={send} data-intent-send="">
      Send
    </Button>
  );
  if (mode === "touch") {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        variant={tier === "compact" ? "sheet" : "drawer"}
        label={kind.label}
        actions={
          <>
            {skipButton}
            {sendButton}
          </>
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
            {kind.label}
          </h2>
          <IconButton name="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>{body}</div>
      </Sheet>
    );
  }
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      title={kind.label}
      input="pointer"
      portal={false}
    >
      {body}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        {skipButton}
        {sendButton}
      </div>
    </Popover>
  );
}
