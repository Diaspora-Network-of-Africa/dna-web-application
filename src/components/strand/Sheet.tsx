// Design pass 01, strand-patch/Sheet.jsx (rulings 480, 492, 493, 499). Supersedes the composer
// patch's Sheet: every sheet on the platform mounts this one (block, unblock, intro, request,
// composer, filters) and none keeps a local implementation.
// - The surface is a native `dialog` opened with showModal(), so the browser owns the top layer,
//   the inert background and the Escape key (ruling 499). `contained` opens the same dialog with
//   the `open` attribute for a scaled device frame, where the top layer escapes the frame's
//   clipping; this component supplies the trap either way.
// - Focus lands on [data-sheet-heading] if present, otherwise on the first focusable control that
//   does not carry data-destructive. A destructive action is never the default target (222).
// - Focus is trapped while open and returns to the element that opened the sheet on close (423).
// - The action row is a `footer` in the dialog's flex column, never an overlay: a sticky bar that
//   cannot overlap cannot obscure the focused control when the body scrolls (WCAG 2.4.11, 480).
//   Pass it as `actions`.
// - Scroll lock cancels the scrim only (ruling 493). Inside the dialog a vertical scroller is
//   consumed at its edges, a horizontal scroller keeps its wheel, and touch is left to the browser.
// - One size on every sheet (ruling 492): a bottom sheet 80 percent tall on compact, a side sheet
//   `min(60%, the feed card's width plus Sheet's padding and hairline)` on medium and expanded
//   (1219, 1220), read from the --sheet-* tokens in strand.css and never written as a number here.
//   Never full screen. The composer takes the same width through its own token (1200, 1219).
// Production addition: keyboardHeight (px, from visualViewport) insets the dialog above the
// software keyboard so the sheet sits above it, and marks the panel with data-kb="1".
//
// Re-synced at compile sha256-b1a458dac1bd562f (brief 60-SP items 14 and 18; RF 5.2 item 5, 60-S;
// 1704; handoff H61-SP). `pushed`, a second view inside the same sheet, as one prop
// `{ title, onBack, backLabel }`: a title row reads Back (IconButton arrow-left, R8) before the
// pushed title in the display face, with Close beside it; Escape goes back rather than closing
// while a view is pushed; focus moves to the pushed heading when the view arrives and back to the
// sheet's own `[data-sheet-heading]` when it returns. The body and footer are the caller's for the
// view. This Sheet draws no title row of its own (callers draw theirs in `children`), so the pushed
// row is the one row the part draws, above `children`, and a caller hides its own head while a view
// is pushed. `size="account"` (1704) reads --sheet-panel-width above compact, so the account drawer
// no longer passes a number; `size="notification"` reads --sheet-notification-width and
// `size="composer"` --sheet-composer-ratio, the width the composer already passed. The compile's
// `tier` is this Sheet's `variant`, so a caller keeps its compact switch. The compile's z-index per
// size is not drawn here: showModal() stacks the top layer by open order (499). Absent, unchanged.
// Record: docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { IconButton } from "./IconButton";

export const SHEET_DUR = 300;

/** Ruling 492, canonical and not overridable per surface. */
export const SHEET_HEIGHT = "80%";
// The medium and expanded tokens are equal (1220), so one default serves both tiers.
export const SHEET_WIDTH = "var(--sheet-expanded-width)";
export const COMPOSER_SHEET_WIDTH = "var(--sheet-composer-ratio)";

/** Brief 60-SP item 14 (RF 5.2 item 5): a second view inside the same sheet. */
export type SheetPushed = {
  title: string;
  onBack: () => void;
  /** R8, default "Back". */
  backLabel?: string | undefined;
};

export type SheetProps = {
  open: boolean;
  onClose?: (() => void) | undefined;
  variant?: "sheet" | "drawer";
  label?: string;
  /** 492's named exceptions (611) and 1704's: the side-sheet width each reads above compact.
   *  `account` is --sheet-panel-width; `notification` --sheet-notification-width; `composer`
   *  --sheet-composer-ratio. `width` still wins when both are passed. */
  size?: "default" | "composer" | "notification" | "account" | undefined;
  /** Side-sheet width. Defaults to --sheet-expanded-width; the composer passes --sheet-composer-ratio (equal, 1219). */
  width?: number | string | undefined;
  /** Bottom-sheet height. Defaults to the canonical 80%. */
  height?: number | string | undefined;
  contained?: boolean | undefined;
  side?: "right" | "left" | undefined;
  keyboardHeight?: number | undefined;
  /** The action row. Rendered as a footer in the dialog's flex column, never as an overlay. */
  actions?: ReactNode;
  /**
   * Ruling 665 (Convene Pass 1, compile v1789537371639386): the caller's failure message, rendered
   * in a status region above the action row with everything else untouched. Null renders nothing.
   */
  error?: string | null | undefined;
  /** Overrides the default focus target. Never point it at a destructive control. */
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  /** Overrides where focus returns on close. Defaults to whatever was focused when it opened. */
  returnFocus?: RefObject<HTMLElement | null> | HTMLElement | null | undefined;
  /** Item 14: a second view inside the same sheet; Back and the title replace the caller's title row,
   *  Escape goes back, focus moves to the pushed heading and back again. Absent, unchanged. */
  pushed?: SheetPushed | undefined;
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

const SIZE_WIDTH: Record<NonNullable<SheetProps["size"]>, string> = {
  default: "var(--sheet-expanded-width)",
  composer: "var(--sheet-composer-ratio)",
  notification: "var(--sheet-notification-width)",
  account: "var(--sheet-panel-width)",
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/** Stacked surface for compose and tray flows. variant "sheet": bottom sheet with drag handle and
 *  safe-area inset (touch). variant "drawer": side panel (pointer, and the medium tier). The scrim
 *  closes; Esc closes; the drag handle released past 120px closes. */
export function Sheet({
  open,
  onClose,
  variant = "sheet",
  label,
  size = "default",
  width,
  height,
  contained,
  side = "right",
  keyboardHeight = 0,
  actions,
  error,
  initialFocus,
  returnFocus,
  pushed,
  children,
  style,
}: SheetProps) {
  const [dy, setDy] = useState(0);
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(open);
  const start = useRef<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pushedHeading = useRef<HTMLHeadingElement>(null);
  // Item 14: the pushed view's Back, read through a ref so the key handlers below need no rebind.
  const pushedRef = useRef(pushed);
  pushedRef.current = pushed;
  const back = () => {
    const p = pushedRef.current;
    if (p) p.onBack();
  };
  // Focus moves to the pushed heading when a view arrives and back to the sheet's own heading when it
  // returns; the first render takes Sheet's ordinary open focus below.
  const pushedKey = pushed ? pushed.title : "";
  const firstPush = useRef(true);
  useEffect(() => {
    if (firstPush.current) {
      firstPush.current = false;
      return;
    }
    if (!open) return;
    const target = pushedRef.current
      ? pushedHeading.current
      : panel.current?.querySelector<HTMLElement>("[data-sheet-heading]");
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [pushedKey, open]);

  // Mount, then the top layer, then the enter transition. The element stays mounted until the exit
  // finishes so the 300ms out is real rather than an unmount.
  useEffect(() => {
    if (open) {
      opener.current = (document.activeElement as HTMLElement | null) ?? null;
      setMounted(true);
      let inner = 0;
      const id = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(id);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), SHEET_DUR);
    return () => clearTimeout(t);
  }, [open]);

  // showModal() in production (ruling 499); the `open` attribute inside a scaled frame, where the
  // top layer escapes the frame's clipping.
  useEffect(() => {
    const d = dlg.current;
    if (!d || !mounted) return;
    if (contained) {
      if (!d.open) d.setAttribute("open", "");
      return;
    }
    if (!d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
    }
    return () => {
      if (d.open) d.close();
    };
  }, [mounted, contained]);

  // Focus in on open: the heading first, so the first thing read is the content; otherwise the
  // first focusable control that is not destructive (222). Focus out on close, to the opener (423).
  //
  // Handoff 37-B (1201): the focus never scrolls. On open the panel is translated its own size off
  // screen, and a focus that scrolls its target into view scrolls the nearest scroll container to
  // reach it: the dialog itself while it was a scroll container (its `overflow: hidden`, now
  // `clip` in strand.css), the shell's scroller on the contained path. The panel is then painted
  // at layout plus transform minus that offset, which is the transform alone, until the transition
  // ends and the offset clamps back to zero: the drawer runs from its rest to the window's left
  // edge and snaps back, the bottom sheet rises past the top and drops. Read frame by frame from
  // painted pixels by tests/sheet.cjs on WebKit and Chromium. showModal()'s own focusing steps
  // scroll too, which is what the `clip` is for; this is the component's own focus.
  const restore = useCallback(() => {
    const target =
      returnFocus && "current" in returnFocus
        ? returnFocus.current
        : (returnFocus ?? opener.current);
    target?.focus?.();
  }, [returnFocus]);
  useEffect(() => {
    if (!open || !mounted) return;
    const p = panel.current;
    if (!p) return;
    const id = requestAnimationFrame(() => {
      const explicit = initialFocus?.current;
      const heading = p.querySelector<HTMLElement>("[data-sheet-heading]");
      const safe = focusables(p).find((el) => !el.hasAttribute("data-destructive"));
      const target = explicit ?? heading ?? safe ?? p;
      if (target === heading && heading && !heading.hasAttribute("tabindex"))
        heading.setAttribute("tabindex", "-1");
      // Ruling 1484 (W82): the heading takes focus so the first thing read is the content, and it
      // draws no ring. It is `tabindex="-1"`, so Tab never reaches it, and WebKit matches
      // strand.css's global `:focus-visible` on a script focus that follows a tap, which ringed the
      // notifications title on iPhone Safari. Inline, so it outranks that rule here and nowhere
      // else: every control keeps its ring under keyboard focus. A heading a caller made tabbable
      // keeps its ring too.
      if (target === heading && heading && heading.getAttribute("tabindex") === "-1")
        heading.style.outline = "none";
      target.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, mounted, initialFocus]);
  // The restore waits for the exit to finish, not merely for `open` to flip. While the dialog is
  // still in the top layer the browser holds focus inside it, so a focus() call on the opener at
  // that moment is a no-op and the member is left on the sheet's own last control. The showModal
  // effect's cleanup closes the dialog on the same commit that clears `mounted`, and React runs
  // every cleanup before every effect, so by the time this runs the top layer is gone.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) wasOpen.current = true;
  }, [open]);
  useEffect(() => {
    if (mounted || !wasOpen.current) return;
    wasOpen.current = false;
    restore();
  }, [mounted, restore]);

  // The Tab trap, and the dialog's `cancel`. showModal() already traps Tab, but `contained` does
  // not, and the explicit trap keeps one behaviour on both paths.
  //
  // An Escape inside the dialog is not handled here (G193, G86; handoff 38-B). It was, for
  // `contained` only, and a window listener in the capture phase runs before every handler inside
  // the sheet, so it took the Escape that Input's combobox and Menu handle for themselves and
  // ignored the `defaultPrevented` they set; while the showModal path handled no keydown at all and
  // waited for the dialog's `cancel`, which the browser raises after the keydown has bubbled, and by
  // then a Pane above the sheet had already read an unmarked Escape and closed itself (1084). Both
  // paths now handle an Escape inside the dialog in its own `onKeyDown` below, at keydown, after the
  // sheet's descendants and before its ancestors, which is the order React's synthetic bubbling
  // gives for free.
  //
  // An Escape whose target is outside the dialog, which focus fallen to `body` produces (G195), is
  // the browser's on the showModal path: the top layer holds the dialog and the close request
  // arrives as `cancel`. A contained dialog is not modal and raises no `cancel`, so that Escape is
  // closed from here, for `contained` only and only when the target is outside the dialog. It never
  // crosses a Pane's subtree, so marking it costs the Pane nothing, and it is what the branch this
  // replaces did for every Escape.
  //
  // `cancel` stays as the path for a close request that does not arrive as a keydown inside the
  // dialog: the outside-target Escape above, and a close request the platform raises with no key.
  // Preventing the keydown's default ends the browser's close request, so `cancel` never follows an
  // Escape the handler below took.
  //
  // `mounted` is in the deps because the dialog element does not exist on the commit where `open`
  // first turns true: that render still returns null and only the effect below it sets `mounted`.
  // Without it the cancel listener would be attached to nothing, Escape would close the dialog
  // natively, and React would go on believing the sheet was open.
  //
  // There is deliberately no listener on the dialog's `close` event. It looks like the safety net
  // for a close the component did not initiate, and it is not: the effect above closes the dialog
  // in its own cleanup, so under React's development double-invoke that close reaches a listener
  // still attached from the first pass and shuts the sheet a fifth of a second after it opened.
  // `cancel` is the event that carries a close request, and that is the case that needed covering.
  useEffect(() => {
    if (!open || !mounted) return;
    const d = dlg.current;
    // Item 14: while a view is pushed, Escape goes back rather than closing.
    const cancel = (e: Event) => {
      e.preventDefault();
      if (pushedRef.current) back();
      else onClose?.();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contained && d && !(e.target instanceof Node && d.contains(e.target))) {
          e.preventDefault();
          if (pushedRef.current) back();
          else onClose?.();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const p = panel.current;
      if (!p) return;
      const list = focusables(p);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0] as HTMLElement;
      const last = list[list.length - 1] as HTMLElement;
      const active = document.activeElement as HTMLElement | null;
      // The heading is tabindex -1, so it is never in `list`: shift-Tab from it has to wrap to the
      // last control like shift-Tab from `first` does. showModal() confines Tab to the dialog on
      // its own, but the contained path has no top layer to lean on.
      if (e.shiftKey && (active === first || !active || !list.includes(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    d?.addEventListener("cancel", cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      d?.removeEventListener("cancel", cancel);
      window.removeEventListener("keydown", key, true);
    };
  }, [open, mounted, contained, onClose]);

  // Scroll lock, narrowed (ruling 493). The host does not scroll while the sheet is mounted and a
  // wheel that lands on the scrim is cancelled; inside the dialog a vertical scroller is consumed
  // at its edges so nothing chains to the page, and a horizontal scroller keeps its wheel. Touch is
  // left to the browser.
  useEffect(() => {
    if (!mounted) return;
    const d = dlg.current;
    if (!d) return;
    const host = contained ? d.parentElement : document.documentElement;
    const body = contained ? null : document.body;
    const prev = host ? host.style.overflow : "";
    const prevB = body ? body.style.overflow : "";
    if (host) host.style.overflow = "hidden";
    if (body) body.style.overflow = "hidden";
    const scroller = (t: EventTarget | null): { el: HTMLElement; axis: "x" | "y" } | null => {
      for (let n = t instanceof HTMLElement ? t : null; n && n !== d; n = n.parentElement) {
        const s = getComputedStyle(n);
        if ((s.overflowX === "auto" || s.overflowX === "scroll") && n.scrollWidth > n.clientWidth)
          return { el: n, axis: "x" };
        if ((s.overflowY === "auto" || s.overflowY === "scroll") && n.scrollHeight > n.clientHeight)
          return { el: n, axis: "y" };
      }
      return null;
    };
    const wheel = (e: WheelEvent) => {
      const inPanel =
        !!panel.current && e.target instanceof Node && panel.current.contains(e.target);
      if (!inPanel) {
        // The scrim. With showModal() a wheel over the backdrop targets the dialog itself.
        e.preventDefault();
        return;
      }
      const sc = scroller(e.target);
      if (!sc) {
        e.preventDefault();
        return;
      }
      if (sc.axis === "x") return; // the chip row keeps its wheel
      const up = e.deltaY < 0;
      const atTop = sc.el.scrollTop <= 0;
      const atEnd = sc.el.scrollTop + sc.el.clientHeight >= sc.el.scrollHeight - 1;
      if ((up && atTop) || (!up && atEnd)) e.preventDefault();
      e.stopPropagation();
    };
    d.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if (host) host.style.overflow = prev || "";
      if (body) body.style.overflow = prevB || "";
      d.removeEventListener("wheel", wheel);
    };
  }, [mounted, contained]);

  if (!mounted) return null;
  const sheet = variant === "sheet";
  const left = side === "left";
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current == null) return;
    setDy(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (dy > 120) onClose?.();
    start.current = null;
    setDy(0);
  };
  const rm =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = rm ? "0ms" : SHEET_DUR + "ms var(--ease)";
  const hidden = sheet ? "translateY(100%)" : "translateX(" + (left ? "-" : "") + "100%)";
  const len = (v: number | string) => (typeof v === "number" ? v + "px" : v);
  const w = sheet ? "100%" : len(width ?? SIZE_WIDTH[size]);
  const h = sheet
    ? keyboardHeight > 0
      ? "calc(100% - 8px)"
      : len(height ?? SHEET_HEIGHT)
    : "100%";
  return (
    <dialog
      ref={dlg}
      className="strand-sheet"
      // The top-layer element carries the scrim and the inert background; the panel inside carries
      // the dialog itself. Presentational here so a screen reader announces one dialog, not two
      // nested ones, and so every surface keeps selecting the panel it always selected.
      role="presentation"
      data-sheet-scrim
      data-shown={shown ? "1" : "0"}
      onClick={(e) => {
        if (e.target === dlg.current) onClose?.();
      }}
      // G193, G86 (handoff 38-B): an Escape this sheet handles stops here. React's synthetic keydown
      // follows the React tree, in which a sheet a Pane renders is the pane's descendant even though
      // the dialog sits in the top layer, and Pane closes on any Escape whose `defaultPrevented` is
      // false (1084). So the sheet marks the keydown it takes, on both paths, and closes itself on
      // it. It yields to an Escape a descendant already took, Input's open list or a Menu, and where
      // two sheets nest the inner one runs first and the outer yields the same way, so only the
      // topmost handles it. An Escape from outside the dialog never reaches this handler: on the
      // showModal path the browser's close request, which `cancel` above turns into the same close,
      // and on the contained path the window listener above, close the sheet on it.
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault();
        if (pushedRef.current) back();
        else onClose?.();
      }}
      style={{
        position: contained ? "absolute" : "fixed",
        bottom: keyboardHeight > 0 ? keyboardHeight : 0,
        height: keyboardHeight > 0 ? "calc(100% - " + keyboardHeight + "px)" : "100%",
        display: "flex",
        alignItems: sheet ? "flex-end" : "stretch",
        justifyContent: sheet ? "center" : left ? "flex-start" : "flex-end",
        // The contained path draws its own scrim; showModal() paints ::backdrop instead.
        background: contained ? "var(--scrim)" : "transparent",
        opacity: contained ? (shown ? 1 : 0) : 1,
        transition: contained ? "opacity " + ease : undefined,
        overscrollBehavior: "contain",
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-kb={keyboardHeight > 0 ? "1" : undefined}
        style={{
          background: "var(--surface)",
          boxShadow: "var(--shadow-3)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          width: w,
          maxWidth: "100%",
          height: h,
          maxHeight: "100%",
          borderRadius: sheet ? "14px 14px 0 0" : 0,
          borderLeft: sheet || left ? "none" : "1px solid var(--line)",
          borderRight: left ? "1px solid var(--line)" : "none",
          paddingBottom:
            sheet && keyboardHeight === 0
              ? "env(safe-area-inset-bottom, var(--safe-bottom, 0px))"
              : 0,
          overscrollBehavior: "contain",
          ...style,
          transform: dy ? "translateY(" + dy + "px)" : shown ? "none" : hidden,
          transition: dy ? "none" : "transform " + ease,
        }}
      >
        {sheet && (
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-hidden="true"
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              touchAction: "none",
              flex: "none",
            }}
          >
            <span style={{ width: 36, height: 4, borderRadius: 2, background: "var(--ink-4)" }} />
          </div>
        )}
        {pushed && (
          <div
            data-sheet-title="pushed"
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-2)",
              padding: "calc(var(--space-3) / 2) var(--space-2)",
              borderBottom: "var(--border-thin) solid var(--line)",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
              }}
            >
              <IconButton name="arrow-left" label={pushed.backLabel || "Back"} onClick={back} />
              <h2
                ref={pushedHeading}
                tabIndex={-1}
                style={{
                  margin: 0,
                  minWidth: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--display-s)",
                  lineHeight: "var(--display-s-lh)",
                  fontWeight: "var(--weight-regular)" as unknown as number,
                  outline: "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pushed.title}
              </h2>
            </div>
            {onClose && <IconButton name="x" label="Close" onClick={() => onClose()} />}
          </div>
        )}
        {children}
        {/* Ruling 665: the caller's failure message, in a live region above the action row. */}
        <div aria-live="polite" role="status" style={{ flex: "none" }}>
          {error && (
            <p
              data-sheet-error
              style={{
                margin: 0,
                padding: "var(--space-3) var(--space-5)",
                background: "var(--error-tint)",
                color: "var(--error)",
                fontSize: "var(--text-s)",
                lineHeight: 1.45,
                borderTop: "var(--border-thin) solid var(--line)",
              }}
            >
              {error}
            </p>
          )}
        </div>
        {actions && (
          <footer
            data-sheet-actions
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              padding: "12px 20px",
              borderTop: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            {actions}
          </footer>
        )}
      </section>
    </dialog>
  );
}
