// Handoff 62-G, SPEC-62-FEED-CARD 8.4 (rulings 1651, 1677, 1826; B60 F17 to F20): the comment box at
// the foot of the expanded card. `Input multiline rows=1` with C.write as its label and placeholder;
// the chosen image as `AttachmentTile` (pending while it uploads, Remove); a failed upload as a
// role="alert" line, C.failed, with C.retry and C.remove, the text kept; the control row: Emoji
// (C.emoji, a ghost Button opening the one picker, src/components/dna/ReactionPicker.tsx, whose pick
// inserts at the caret), Add an image (C.image, an IconButton over a hidden file input, one image per
// comment through media-upload), a spacer, Send (C.send, disabled while empty). Replying to a comment
// reads B60 F19's strip, "Replying to {first}" with Cancel. Sticky above the dock at compact.
// Composed from Input, AttachmentTile, IconButton and Button until Strand lands CommentComposer
// (SPEC 12 proposal 9; the G entry).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { AttachmentTile } from "@/components/strand/AttachmentTile";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { Popover } from "@/components/strand/Popover";
import { Sheet } from "@/components/strand/Sheet";
import type { Member } from "@/lib/auth";
import { uploadCommentImage } from "@/lib/comments";
import { toneFor } from "@/lib/emoji";
import { SETTINGS_KEY } from "@/lib/messenger-inbox";
import { loadSettings, settingsSet } from "@/lib/messenger";
import type { Mode, Tier } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";
import { ReactionPicker } from "./ReactionPicker";

/** The body's ceiling, the migration's (comments_body_check). */
export const COMMENT_MAX = 2000;

export type CommentDraftImage = {
  mediaId: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

export type CommentBoxProps = {
  member: Member;
  postId: string;
  mode: Mode;
  tier: Tier;
  /** B60 F19: the comment being replied to, by its author's first name; null for a top-level comment. */
  replyingTo?: { id: string; first: string } | null | undefined;
  onCancelReply?: (() => void) | undefined;
  /** Hands the trimmed body and the uploaded image's media id; the thread writes through comment_post. */
  onSend: (body: string, image: CommentDraftImage | null) => void;
  /** The thread's own failure line, when its send did not go (F17 is on the comment; this is the box's). */
  onEmojiPicked?: ((emoji: string) => void) | undefined;
  compact: boolean;
};

type Upload =
  | { status: "none" }
  | { status: "uploading"; file: File; previewUrl: string }
  | { status: "done"; file: File; image: CommentDraftImage }
  | { status: "failed"; file: File; previewUrl: string; reason: "too_large" | "failed" };

export function CommentBox({
  member,
  postId,
  mode,
  tier,
  replyingTo,
  onCancelReply,
  onSend,
  compact,
}: CommentBoxProps) {
  const qc = useQueryClient();
  const touch = mode === "touch";
  const fieldId = useId();
  const [text, setText] = useState("");
  const [upload, setUpload] = useState<Upload>({ status: "none" });
  const [picker, setPicker] = useState(false);
  const caret = useRef<{ start: number; end: number } | null>(null);
  const emojiAnchor = useRef<HTMLSpanElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // The one picker's tone and quick eight, the Messenger's (1651, 1776).
  const settings = useQuery({
    queryKey: SETTINGS_KEY(member.id),
    queryFn: loadSettings,
    enabled: picker,
  });
  const vocab = useQuery({ queryKey: ["vocabularies"], queryFn: loadVocabularies });
  const tone = toneFor(settings.data?.reaction_skin_tone ?? null);
  const quick = vocab.data?.message_reaction_quick ?? [];
  const setTone = (value: string) =>
    void settingsSet({ skinTone: value })
      .then((row) => qc.setQueryData(SETTINGS_KEY(member.id), row))
      .catch(() => undefined);

  const field = () =>
    (document.getElementById(fieldId) as HTMLTextAreaElement | HTMLInputElement | null) ?? null;
  const rememberCaret = () => {
    const el = field();
    if (!el) return;
    caret.current = {
      start: el.selectionStart ?? text.length,
      end: el.selectionEnd ?? text.length,
    };
  };
  /** SPEC 3.2 and 8.4: the chosen emoji inserts at the caret, and the caret lands after it. */
  const insert = (emoji: string) => {
    const at = caret.current ?? { start: text.length, end: text.length };
    const next = text.slice(0, at.start) + emoji + text.slice(at.end);
    setText(next.slice(0, COMMENT_MAX));
    const pos = at.start + emoji.length;
    caret.current = { start: pos, end: pos };
    window.requestAnimationFrame(() => {
      const el = field();
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        // A field that does not take a range keeps its own caret.
      }
    });
    setPicker(false);
  };

  useEffect(() => {
    if (replyingTo) window.requestAnimationFrame(() => field()?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyingTo?.id]);

  const start = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setUpload({ status: "uploading", file, previewUrl });
    const out = await uploadCommentImage(file, postId);
    if (out.ok) {
      URL.revokeObjectURL(previewUrl);
      setUpload({
        status: "done",
        file,
        image: {
          mediaId: out.mediaId,
          previewUrl: out.previewUrl,
          width: out.width,
          height: out.height,
        },
      });
    } else setUpload({ status: "failed", file, previewUrl, reason: out.reason });
  };
  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void start(file);
  };
  const remove = () => {
    if (upload.status === "uploading" || upload.status === "failed")
      URL.revokeObjectURL(upload.previewUrl);
    if (upload.status === "done") URL.revokeObjectURL(upload.image.previewUrl);
    setUpload({ status: "none" });
  };

  const body = text.trim();
  const image = upload.status === "done" ? upload.image : null;
  const canSend = (body.length > 0 || !!image) && upload.status !== "uploading";
  const send = () => {
    if (!canSend) return;
    onSend(body, image);
    setText("");
    setUpload({ status: "none" });
    caret.current = null;
  };

  const control = touch ? 44 : 36;
  let tile: ReactNode = null;
  if (upload.status !== "none") {
    const src = upload.status === "done" ? upload.image.previewUrl : upload.previewUrl;
    tile = (
      <div role="list" aria-label="Attached image" style={{ display: "flex" }}>
        <AttachmentTile
          src={src}
          alt=""
          width={upload.status === "done" ? upload.image.width : undefined}
          height={upload.status === "done" ? upload.image.height : undefined}
          pending={upload.status === "uploading"}
          onRemove={remove}
          removeLabel="Remove"
          input={mode}
        />
      </div>
    );
  }
  const pickerBody = (
    <ReactionPicker
      tone={tone}
      onTone={setTone}
      recent={[]}
      quick={quick}
      onPick={insert}
      input={mode}
      listHeight={300}
    />
  );
  return (
    <div
      ref={boxRef}
      data-comment-box=""
      data-replying-to={replyingTo?.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "8px 0",
        position: compact ? "sticky" : undefined,
        bottom: compact ? "calc(var(--dock-height) + env(safe-area-inset-bottom))" : undefined,
        background: "var(--surface)",
        zIndex: compact ? 2 : undefined,
      }}
    >
      {replyingTo && (
        <div
          data-reply-strip=""
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-2)",
            minHeight: touch ? 44 : "var(--target-min)",
          }}
        >
          <span>Replying to {replyingTo.first}</span>
          <Button variant="ghost" size="sm" onClick={onCancelReply} data-reply-cancel="">
            Cancel
          </Button>
        </div>
      )}
      <Input
        id={fieldId}
        multiline
        rows={1}
        label={
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            {replyingTo ? "Write a reply" : "Write a comment"}
          </span>
        }
        placeholder={replyingTo ? "Write a reply" : "Write a comment"}
        aria-label={replyingTo ? "Write a reply" : "Write a comment"}
        value={text}
        maxLength={COMMENT_MAX}
        onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setText(e.target.value)
        }
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        data-comment-field=""
      />
      {tile}
      {upload.status === "failed" && (
        <div
          role="alert"
          data-comment-upload-failed=""
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--error)",
            flexWrap: "wrap",
          }}
        >
          <span>The image did not upload.</span>
          <Button variant="ghost" size="sm" onClick={() => void start(upload.file)}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={remove}>
            Remove
          </Button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span ref={emojiAnchor} style={{ position: "relative", display: "inline-flex" }}>
          <Button
            variant="ghost"
            size={touch ? "md" : "sm"}
            aria-haspopup="dialog"
            aria-expanded={picker}
            onClick={() => {
              rememberCaret();
              setPicker((v) => !v);
            }}
            data-comment-emoji=""
          >
            Emoji
          </Button>
          {picker && !touch && (
            <Popover
              open
              onClose={() => setPicker(false)}
              anchorRef={emojiAnchor}
              title="React"
              input="pointer"
              portal={false}
              placement="top-start"
            >
              {pickerBody}
            </Popover>
          )}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
          style={{ display: "none" }}
          data-comment-file=""
          aria-hidden="true"
          tabIndex={-1}
        />
        <IconButton
          name="image"
          label="Add an image"
          size={control}
          input={mode}
          disabled={upload.status !== "none"}
          onClick={() => fileInput.current?.click()}
          data-comment-image=""
        />
        <span style={{ flex: 1 }} />
        <IconButton
          name="send"
          label="Send"
          size={control}
          input={mode}
          disabled={!canSend}
          onClick={send}
          data-comment-send=""
        />
      </div>
      {picker && touch && (
        <Sheet
          open
          onClose={() => setPicker(false)}
          variant={tier === "compact" ? "sheet" : "drawer"}
          label="React"
          actions={
            <Button variant="secondary" onClick={() => setPicker(false)}>
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
            <IconButton name="x" label="Close" onClick={() => setPicker(false)} />
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "hidden",
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ReactionPicker
              tone={tone}
              onTone={setTone}
              recent={[]}
              quick={quick}
              onPick={insert}
              input={mode}
            />
          </div>
        </Sheet>
      )}
    </div>
  );
}
