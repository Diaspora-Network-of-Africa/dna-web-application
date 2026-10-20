// The introduction sheet (Brief 4, ruling 119), lifted out of ConnectSurface so the profile's
// Connect entry uses the same component (ruling 417 under 400: the composer carries no Connect
// verb, so "Connect with {first}" calls send_introduction through this sheet instead). Connect
// keeps the message required, as ruling 119's copy says; the profile makes it optional, because
// ruling 401 gives the request one short optional message and the request sheet Design will
// draw under 401 is not built here. Copy is verbatim from the Connect SPEC section 7; the counter
// is the one number a member may see, about their own edit in progress (ruling 254).
import type { ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { Sheet } from "@/components/strand/Sheet";

export const INTRO_MESSAGE_MAX = 300;

export type IntroSheetMember = {
  name: string;
  headline?: string | null | undefined;
  avatarUrl?: string | undefined;
};

export type IntroSheetProps = {
  open: boolean;
  member: IntroSheetMember | null;
  message: string;
  onMessage: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  /** Compact renders the bottom sheet; the other tiers a side drawer (Connect SPEC section 7). */
  compact: boolean;
  /** Connect: true (ruling 119). Profile: false (ruling 401, one short optional message). */
  messageRequired: boolean;
};

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

export function IntroSheet({
  open,
  member,
  message,
  onMessage,
  onClose,
  onSend,
  sending,
  compact,
  messageRequired,
}: IntroSheetProps) {
  const first = member ? firstName(member.name) : "";
  const left = INTRO_MESSAGE_MAX - message.length;
  const canSend = !sending && (messageRequired ? message.trim().length > 0 : true);
  const head = (title: string, extra: ReactNode) => (
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
      <span style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{title}</span>
      {extra}
      <IconButton name="x" label="Close" onClick={onClose} />
    </div>
  );
  const foot = (children: ReactNode) => (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: compact ? "12px 20px 42px" : "12px 20px",
        borderTop: "1px solid var(--line)",
        flex: "none",
      }}
    >
      {children}
    </div>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant={compact ? "sheet" : "drawer"}
      // Ruling 492: one size on every sheet, held by the Sheet's own defaults. The 65 percent
      // drawer and the local 80 percent height are retired; nothing here restates a size.
      label={member ? "Introduce yourself to " + member.name : "Introduce yourself"}
    >
      {member && (
        <>
          {head("Introduce yourself", null)}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={member.name} src={member.avatarUrl} size={48} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 26,
                    lineHeight: 1.15,
                  }}
                >
                  {member.name}
                </span>
                {member.headline && (
                  <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{member.headline}</span>
                )}
              </div>
            </div>
            <Input
              multiline
              rows={6}
              label={"Your message to " + first + (messageRequired ? "" : " (optional)")}
              maxLength={INTRO_MESSAGE_MAX}
              value={message}
              onChange={(e) =>
                onMessage((e.target as HTMLTextAreaElement).value.slice(0, INTRO_MESSAGE_MAX))
              }
              placeholder="Why you, why now. What you noticed on their profile, what you are working on, what you hope comes of it."
              hint={left === 1 ? "1 character left" : left + " characters left"}
              autoFocus
              data-testid="intro-message"
            />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: "var(--ink-3)" }}>
              One message, sent once. It cannot be edited after sending. {first} decides in their
              own time and you will hear when they accept.
            </p>
          </div>
          {foot(
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button c="connect" disabled={!canSend} onClick={onSend} data-testid="send-intro">
                Send introduction
              </Button>
            </>,
          )}
        </>
      )}
    </Sheet>
  );
}
