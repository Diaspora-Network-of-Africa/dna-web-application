// Brief 4A, the block control (B4A-SPEC.md sections 4, 5, 8, 9, 10 and 11; rulings 198, 207, 208,
// 211, 220, 221, 222). One overflow item and one confirm sheet in two variants, appended to
// Profile's Visitor action row. It is the whole surface: block has no route, no list, no settings
// page and no moderation view, because ruling 198 keeps /m/:handle loading for both parties and
// ruling 208 puts unblock in the same place as block.
//
// This lives on the page, not in Strand (B4A section 4). Profile v3 has no masthead overflow, and
// ruling 221 gives Strand a Menu component that has not landed. Until it does, this spec is
// normative and this file is the implementation; when Menu ships, the panel below is what gets
// swapped for it.
//
// Design pass 01: the focus management this file carried has gone back to Strand. STRAND-HANDOFF
// 3c.2 has landed, so the Sheet now owns `heading focus in, opener focus out, Tab trapped while
// open` (rulings 222, 480, 499): the heading carries data-sheet-heading, the destructive confirm
// carries data-destructive so it is never the default target, and the opener is named through
// returnFocus. B4A section 11's requirement is met by the component rather than by a copy here,
// which is what the amendment asked for.
//
// Copy is verbatim from B4A section 9 and carries no numerals, no toast and no word for the state
// (B4A sections 5 and 13). Nothing here is written to or shown to the other party (ruling 198).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/strand/Button";
import { IconButton } from "@/components/strand/IconButton";
import { Sheet } from "@/components/strand/Sheet";

export type ProfileBlockControlProps = {
  /** The member's first name, for every string that names them. */
  first: string;
  /** The member's full name, for the two sheet headings. */
  name: string;
  /** profile_view.viewer_blocked: the viewer's own block. Never the converse (B4A section 7). */
  blocked: boolean;
  tier: "compact" | "medium" | "expanded";
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
};

const MENU_WIDTH = 240;

const PANEL: CSSProperties = {
  position: "absolute",
  top: 50,
  minWidth: MENU_WIDTH,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  boxShadow: "var(--shadow-3)",
  padding: "6px 0",
  zIndex: 20,
};

const ITEM: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  width: "100%",
  minHeight: 44,
  padding: "0 16px",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  fontWeight: 500,
  color: "var(--ink)",
  cursor: "pointer",
};

export function ProfileBlockControl({
  first,
  name,
  blocked,
  tier,
  onBlock,
  onUnblock,
}: ProfileBlockControlProps) {
  const compact = tier === "compact";
  const [menu, setMenu] = useState(false);
  // The panel is anchored below the trigger at left 0 (B4A section 4). The trigger is the last
  // control in a wrapping row, so at 360 and 390 that edge can sit within 240 of the frame; the
  // panel then flips to the trigger's right edge rather than crossing it, because ruling 61's
  // matrix is checked for horizontal overflow at every width.
  const [flip, setFlip] = useState(false);
  const [sheet, setSheet] = useState<null | "block" | "unblock">(null);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  /** The element the Sheet returns focus to. Captured when the sheet opens (rulings 222, 480). */
  const opener = useRef<HTMLElement | null>(null);
  // Strand's IconButton is a ported function component that takes no ref (rulings 70, 72: system
  // changes happen in Strand first, so the page does not grow one here). The trigger is its own
  // button inside this wrapper, so the wrapper addresses it.
  const triggerEl = () =>
    wrap.current?.querySelector<HTMLButtonElement>('[data-testid="block-menu-trigger"]') ?? null;

  const toTrigger = useCallback(() => triggerEl()?.focus(), []);

  const openMenu = () => {
    const el = triggerEl();
    if (el) {
      const r = el.getBoundingClientRect();
      // The panel must fit the scroller it sits in, not only the window: at expanded the feed
      // column ends well inside the viewport, and a wider face (1884) left it 11px past that edge.
      const scroller = el.closest("[data-scroller]");
      const edge = Math.min(
        document.documentElement.clientWidth,
        scroller ? scroller.getBoundingClientRect().right : Infinity,
      );
      setFlip(r.left + MENU_WIDTH > edge - 8);
    }
    setMenu(true);
  };

  const closeMenu = useCallback(
    (restore: boolean) => {
      setMenu(false);
      if (restore) toTrigger();
    },
    [toTrigger],
  );

  // Esc closes and returns focus to the trigger; pointer down outside closes (B4A section 4).
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu(true);
      }
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (triggerEl()?.contains(t as Node)) return;
      if (item.current?.parentElement?.contains(t as Node)) return;
      closeMenu(false);
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", down, true);
    item.current?.focus();
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", down, true);
    };
  }, [menu, closeMenu]);

  /** Every dismissal, and the confirm itself, returns focus to the ellipsis trigger: the Sheet
   *  restores `returnFocus` after its exit finishes, so nothing here races it. */
  const closeSheet = useCallback(() => setSheet(null), []);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await (sheet === "unblock" ? onUnblock() : onBlock());
      closeSheet();
    } finally {
      setBusy(false);
    }
  };

  const verb = blocked ? "Unblock" : "Block";
  const body = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "24px 24px 32px",
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <h2
        data-sheet-heading
        tabIndex={-1}
        style={{
          margin: 0,
          outline: "none",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 26,
          lineHeight: 1.2,
          color: "var(--ink)",
          textWrap: "balance",
        }}
      >
        {verb} {name}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(sheet === "unblock"
          ? [
              `${first} can find you and reach you on DNA again, and sees your profile as any member does.`,
              "Your connection and follow do not come back. They must be re-made.",
            ]
          : [
              `${first} will not find you or reach you on DNA.`,
              `${first} will see only what a signed-out visitor sees of your profile.`,
              "Your connection and any follow between you end.",
            ]
        ).map((line) => (
          <p key={line} style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "var(--ink)" }}>
            {line}
          </p>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--ink-3)" }}>
        {sheet === "unblock"
          ? `${first} is not told.`
          : `${first} is not told. You can undo this from ${first}’s profile.`}
      </p>
      <div style={{ display: "flex", gap: 8, paddingTop: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={closeSheet} data-testid="block-cancel">
          Cancel
        </Button>
        <Button
          variant={sheet === "unblock" ? "primary" : "danger"}
          onClick={() => void confirm()}
          disabled={busy}
          // Ruling 222: a destructive action is never the sheet's default focus target.
          data-destructive={sheet === "block" ? "" : undefined}
          data-testid="block-confirm"
        >
          {verb} {first}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      ref={wrap}
      style={{ position: "relative", display: "inline-flex" }}
      data-testid="block-control"
    >
      <IconButton
        name="ellipsis"
        label="More"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => (menu ? closeMenu(true) : openMenu())}
        style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-m)" }}
        data-testid="block-menu-trigger"
      />
      {menu && (
        <div
          role="menu"
          aria-label="More"
          data-testid="block-menu"
          style={flip ? { ...PANEL, right: 0 } : { ...PANEL, left: 0 }}
        >
          <button
            ref={item}
            type="button"
            role="menuitem"
            onClick={() => {
              // The menu item unmounts with the menu, so the sheet returns focus to the trigger
              // that opened the menu, which is the control the member last saw (ruling 222).
              opener.current = triggerEl();
              setMenu(false);
              setSheet(blocked ? "unblock" : "block");
            }}
            style={ITEM}
            data-testid="block-menu-item"
          >
            {verb} {first}
          </button>
        </div>
      )}
      <Sheet
        open={!!sheet}
        onClose={closeSheet}
        variant={compact ? "sheet" : "drawer"}
        returnFocus={opener}
        // Ruling 492: the canonical 40 percent side sheet, never a fixed 560.
        label={`${verb} ${first}`}
      >
        {body}
      </Sheet>
    </div>
  );
}
