// Brief 14 (SPEC 41-14 Part A item 5; extraction 41-14 sections 1.6 and 5.4; rulings 1343, 1346),
// ported from the prototype's `composerNode()`. The thread's one composer: the strips above the row
// (the quote, the editing strip, the media draft with its 72px thumbnail, the media notice, the voice
// draft, the link preview draft with its remove control, the upload refusal, the not-sent line with
// Retry, the rate-limit line, the mention picker), then the row: Attach (image or video, no
// document, 1346), the field or the recording line, and Send in the thread's C or the mic. The field
// is a plain textarea on Input's tokens (extraction 5.3: Input has no autosizing single-row mode);
// it wraps, grows to 120px and then scrolls. Enter sends on pointer and Shift+Enter breaks; on touch
// return breaks and the button sends. The mention query is the trailing `@word` of the text; up to
// five members whose name starts with it are offered, and a pick replaces the word with `@Name `.
// Nothing here is stored anywhere: the unsent text is the caller's state for this tab (1351).
//
// At compile sha256-b1a458dac1bd562f (brief 60-SP items 3 and 8; FC 5.2 item 2; HT 5.2 item 2;
// ratified 1728; handoff H61-SP): the comment composer is this part, not a second one.
// `attach={false}` drops Attach and `mic={false}` drops the mic, so Send (or Save) always shows;
// `fieldLabel` names the field (default "Message"; F18), `editingLabel` reads the editing strip
// (default "Editing"; F19) and `cancelLabel` turns each strip's X into that word as a text act
// (F19). The mention listbox runs through TokenSuggest (item 8): the field is the combobox, the list
// a role=listbox, inline, in the caller's order; `tokens` completes `#` through the same behaviour,
// floating above the field, and `note` is Input's quiet line (item 9) under the row. The mention
// query and its matching stay this part's as before (the trailing `@word`, up to five, startsWith),
// where the compile offers every member it is passed. Nothing passes the new props yet. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Menu } from "./Menu";
import { RecordControl, VoiceRecorder } from "./VoiceRecorder";
import { mmss } from "./VoicePlayer";
import { TokenList, useTokenSuggest, type TokenOption, type TokenPlacement } from "./TokenSuggest";
import type { C } from "./cmeta";
import { useMode, type Mode } from "@/lib/tier";

export type ComposerMention = { id: string; name: string; src?: string | undefined };

export type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend?: (() => void) | undefined;
  c?: C | undefined;
  /** `from` is the quoted author's name or `yourself`; the strip reads `Replying to {from}`. */
  quote?: { from: string; text: string } | null | undefined;
  onRemoveQuote?: (() => void) | undefined;
  editing?: boolean | undefined;
  onRemoveEdit?: (() => void) | undefined;
  /** The media draft: the caller's object URL for the thumbnail (MediaBlock image, 1/1). */
  media?: { kind: "image" | "video"; thumbnail: ReactNode } | null | undefined;
  onRemoveMedia?: (() => void) | undefined;
  voice?: { durationMs: number } | null | undefined;
  onRemoveVoice?: (() => void) | undefined;
  /** The link preview draft, rendered by the caller (MediaBlock link), with its remove control here. */
  preview?: ReactNode;
  onRemovePreview?: (() => void) | undefined;
  /** The thread's other members, for the mention picker. */
  mentions?: ComposerMention[] | undefined;
  onMention?: ((member: ComposerMention) => void) | undefined;
  /** The one-time media notice (1346), with its OK. */
  notice?: boolean | undefined;
  onNoticeOk?: (() => void) | undefined;
  /** The upload refusal line, with its OK. */
  error?: string | null | undefined;
  onErrorOk?: (() => void) | undefined;
  /** Not sent: the text stays, a grey mark, Retry. */
  failed?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  /** Rate limited: the line, the field disabled, no number. */
  limited?: boolean | undefined;
  input?: Mode | undefined;
  onAttach?: ((kind: "image" | "video") => void) | undefined;
  /** Seconds elapsed while recording; null when not. */
  recording?: number | null | undefined;
  onRecordStart?: (() => void) | undefined;
  onRecordStop?: (() => void) | undefined;
  onRecordCancel?: (() => void) | undefined;
  /** The attach menu renders in place (a scaled frame) when false; default the body portal. */
  menuPortal?: boolean | undefined;
  /** Item 3: false drops Attach. */
  attach?: boolean | undefined;
  /** Item 3: false drops the mic, so Send (or Save) always shows. `voice` names the attached note. */
  mic?: boolean | undefined;
  /** Item 3 (F18): the field's name. Default "Message". */
  fieldLabel?: string | undefined;
  /** Item 3 (F19): the editing strip's line. Default "Editing". */
  editingLabel?: string | undefined;
  /** Item 3 (F19): turns each strip's X into this word as a text act. */
  cancelLabel?: string | undefined;
  /** Item 8: `#` completion through TokenSuggest, floating above the field; replaces the mention listbox while passed, as compiled. */
  tokens?:
    | {
        options: readonly TokenOption[] | null | undefined;
        open: boolean;
        onChoose?: ((o: TokenOption) => void) | undefined;
        onClose?: (() => void) | undefined;
        label?: string | undefined;
        placement?: TokenPlacement | undefined;
      }
    | undefined;
  /** Item 9: Input's quiet line under the row; "" keeps the region mounted and empty. */
  note?: string | undefined;
  style?: CSSProperties | undefined;
};

const FIELD_MIN = 44;
const FIELD_MAX = 120;

export function MessageComposer({
  value,
  onChange,
  onSend,
  c,
  quote,
  onRemoveQuote,
  editing = false,
  onRemoveEdit,
  media,
  onRemoveMedia,
  voice,
  onRemoveVoice,
  preview,
  onRemovePreview,
  mentions = [],
  onMention,
  notice = false,
  onNoticeOk,
  error,
  onErrorOk,
  failed = false,
  onRetry,
  limited = false,
  input,
  onAttach,
  recording = null,
  onRecordStart,
  onRecordStop,
  onRecordCancel,
  menuPortal = true,
  attach: showAttach = true,
  mic: showMic = true,
  fieldLabel = "Message",
  editingLabel = "Editing",
  cancelLabel,
  tokens,
  note,
  style,
}: MessageComposerProps) {
  const detected = useMode();
  const mode = input || detected;
  const touch = mode === "touch";
  const [attachOpen, setAttachOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const attachRef = useRef<HTMLSpanElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const isRecording = recording !== null && recording !== undefined;
  // Grows with the text to the 120 cap, on every render of the field, for engines without
  // `field-sizing: content`.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = FIELD_MIN + "px";
    el.style.height = Math.min(FIELD_MAX, Math.max(FIELD_MIN, el.scrollHeight)) + "px";
  }, [value, isRecording]);
  const mentionMatch = /@([A-Za-z]*)$/.exec(value);
  const mentionQuery = mentionMatch ? (mentionMatch[1] ?? "").toLowerCase() : null;
  const candidates =
    mentionQuery !== null
      ? mentions.filter((m) => m.name.toLowerCase().startsWith(mentionQuery)).slice(0, 5)
      : [];
  const pick = (m: ComposerMention) => {
    onChange(value.replace(/@[A-Za-z]*$/, "@" + m.name + " "));
    onMention?.(m);
    field.current?.focus();
  };
  // Item 8: one listbox for the token at the caret. `tokens` (the `#` completion) replaces the
  // mention list while passed, as compiled; otherwise the mention candidates, in their given order.
  const mopts = useMemo<TokenOption[]>(
    () => candidates.map((m) => ({ value: m.id, label: m.name, avatar: m.src || true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates.map((m) => m.id).join("\u0001")],
  );
  const tk = useTokenSuggest(
    tokens
      ? {
          options: tokens.options,
          open: tokens.open,
          onChoose: tokens.onChoose,
          onClose: tokens.onClose,
        }
      : {
          options: mopts,
          open: mopts.length > 0,
          onChoose: (o) => {
            const m = candidates.find((c) => c.id === o.value);
            if (m) pick(m);
          },
          order: "given",
        },
  );
  const hasContent = !!(value.trim() || media || voice);
  const canSend = (hasContent || editing) && !isRecording && !limited;
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (tk.keyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey && !touch) {
      e.preventDefault();
      if (canSend) onSend?.();
    }
  };
  const strip = (label: string, text: string | null, onRemove: (() => void) | undefined) => (
    <div
      data-strip
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1) var(--space-1) var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-m)",
        background: "var(--bg-sunken)",
        fontSize: "var(--text-xs)",
        lineHeight: "var(--text-xs-lh)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontWeight: "var(--weight-medium)" as unknown as number }}>{label}</span>
        {text && (
          <span
            style={{
              color: "var(--ink-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        )}
      </span>
      {cancelLabel ? (
        textBtn(cancelLabel, onRemove)
      ) : (
        <IconButton name="x" label="Remove" input={mode} size={36} onClick={onRemove} />
      )}
    </div>
  );
  const textBtn = (label: string, onClick: (() => void) | undefined) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        minHeight: "var(--target-min)",
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)" as unknown as number,
        color: "var(--ink)",
        textDecoration: "underline",
        textDecorationColor: "var(--line-strong)",
        textUnderlineOffset: 2,
        fontFamily: "var(--font-sans)",
        flex: "none",
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      data-message-composer
      data-editing={editing ? "1" : undefined}
      data-recording={isRecording ? "1" : undefined}
      style={{
        flex: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3) var(--space-3)",
        borderTop: "1px solid var(--line)",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        ...style,
      }}
    >
      {quote && strip("Replying to " + quote.from, quote.text, onRemoveQuote)}
      {editing && strip(editingLabel, null, onRemoveEdit)}
      {media && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ width: 72, flex: "none" }}>{media.thumbnail}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {strip(
              media.kind === "video" ? "Video attached" : "Image attached",
              null,
              onRemoveMedia,
            )}
          </div>
        </div>
      )}
      {notice && (
        <div
          role="status"
          data-media-notice
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            color: "var(--ink-3)",
            padding: "0 var(--space-1)",
          }}
        >
          <Icon name="shield-check" size={14} />
          <span style={{ flex: 1 }}>Location and camera data are removed from what you send.</span>
          {textBtn("OK", onNoticeOk)}
        </div>
      )}
      {voice && strip("Voice note, " + mmss(voice.durationMs / 1000), null, onRemoveVoice)}
      {preview && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{preview}</div>
          <IconButton name="x" label="Remove the preview" input={mode} onClick={onRemovePreview} />
        </div>
      )}
      {error && (
        <div
          role="alert"
          data-upload-refused
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--error)",
            padding: "0 var(--space-1)",
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          {textBtn("OK", onErrorOk)}
        </div>
      )}
      {failed && (
        <div
          role="alert"
          data-not-sent
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-3)",
            padding: "0 var(--space-1)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--ink-4)",
              flex: "none",
            }}
          />
          <span style={{ flex: 1 }}>Not sent. Your message is still here.</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {limited && (
        <div
          role="status"
          data-rate-limited
          style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)", padding: "0 var(--space-1)" }}
        >
          You are sending quickly. Wait a moment before the next message.
        </div>
      )}
      {!tokens && tk.expanded ? (
        <TokenList state={tk} label="Mention a member" placement="inline" />
      ) : null}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: "var(--space-1)",
        }}
      >
        {!isRecording && !editing && showAttach && (
          <span ref={attachRef} style={{ display: "inline-flex", flex: "none" }}>
            <IconButton
              name="image"
              label="Attach an image or video"
              input={mode}
              aria-haspopup="menu"
              aria-expanded={attachOpen}
              onClick={() => setAttachOpen((o) => !o)}
              data-testid="attach"
            />
            <Menu
              open={attachOpen}
              onClose={() => setAttachOpen(false)}
              anchorRef={attachRef}
              items={[
                { id: "image", label: "Image", icon: "image", onSelect: () => onAttach?.("image") },
                { id: "video", label: "Video", icon: "video", onSelect: () => onAttach?.("video") },
              ]}
              label="Attach"
              input={mode}
              placement="top-start"
              portal={menuPortal}
            />
          </span>
        )}
        {isRecording ? (
          <VoiceRecorder
            input={mode}
            recording
            elapsed={recording ?? 0}
            onCancel={onRecordCancel}
          />
        ) : (
          <textarea
            ref={field}
            rows={1}
            aria-label={fieldLabel}
            placeholder={editing ? "Edit your message" : "Message"}
            {...tk.fieldProps}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            disabled={limited}
            data-testid="message-field"
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: "border-box",
              display: "block",
              width: "100%",
              minHeight: FIELD_MIN,
              maxHeight: FIELD_MAX,
              padding: "11px 12px",
              margin: 0,
              borderRadius: "var(--radius-m)",
              border: "1px solid " + (focus ? "var(--ink)" : "transparent"),
              background: focus ? "var(--surface)" : "var(--bg-sunken)",
              fontFamily: "var(--font-sans)",
              // Ruling 1456: no editable field under 16px on touch, or iOS WebKit zooms on focus.
              fontSize: "var(--text-m)",
              lineHeight: "var(--text-m-lh)",
              color: "var(--ink)",
              resize: "none",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              outline: "none",
              opacity: limited ? 0.6 : 1,
              transition: "border-color var(--dur-default) var(--ease)",
            }}
          />
        )}
        {(hasContent || editing || !showMic) && !isRecording ? (
          <IconButton
            name="send"
            label={editing ? "Save" : "Send"}
            c={c}
            active
            input={mode}
            disabled={!canSend}
            onClick={onSend}
            data-testid="send"
          />
        ) : (
          <RecordControl
            input={mode}
            recording={isRecording}
            onStart={onRecordStart}
            onStop={onRecordStop}
            onCancel={onRecordCancel}
          />
        )}
        {tokens ? (
          <TokenList
            state={tk}
            label={tokens.label || "Tags"}
            placement={tokens.placement || "above"}
          />
        ) : null}
      </div>
      {note != null ? (
        <div
          role="status"
          aria-live="polite"
          data-note=""
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            padding: "0 var(--space-1)",
            color: "var(--ink-2)",
            textWrap: "pretty",
            fontSize: "var(--text-xs)",
            lineHeight: "var(--text-xs-lh)",
            ...(note ? {} : { marginTop: "calc(-1 * var(--space-2))" }),
          }}
        >
          {note ? (
            <>
              <Icon name="info" size={14} style={{ color: "var(--ink-3)", marginTop: 2 }} />
              <span style={{ minWidth: 0 }}>{note}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
