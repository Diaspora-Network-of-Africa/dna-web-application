// Strand `components/admin/ConsoleShell.jsx` at compile v1790885781186000 (proposals 40, rulings
// 1306 and 1308, ratified 1309; handoff 40-D item 1). Dispositions are in
// docs/strand-ports/v1790885781186000.md. Whether this replaces admin/src/components/Shell.tsx is
// the 12B handoff's decision; nothing under admin/ binds it yet (handoff 40-D item 6).
//
// Two divergences, both from handoff 40-D's "Where the source and the tree meet":
//
// Item 1, input mode: `useMode` in src/lib/tier.ts is the app's one input-mode source, where the
// compile reads its own `useInputMode`. Both answer "touch" | "pointer" from `(pointer: coarse)`,
// so nothing is mapped at the call site; `useMode` reads "pointer" until its effect runs.
//
// Item 2, tier: the compile reads --tier-medium and --tier-expanded off the shell's own element
// and returns expanded at a width of exactly 1024, while its own doc comment and the extraction
// say expanded is over --tier-expanded, and `tierFor()` in src/lib/tier.ts returns medium at 1024.
// The shell's own measured width goes through `tierFor()`, so the app has one tier rule and the
// one-pixel difference falls on the ruled side. A given `tier` still wins.
//
// Item 3, focus return (ruling 1366; handoff 45-B item C4): the compile captures the element focus
// returns to in ConsoleMenu's passive effect, after its layout effect has already moved focus into
// the drawer, so the element captured is the drawer's Close button, which unmounts with the drawer
// and leaves focus on the body. The port captures `document.activeElement` in the layout effect
// before the focus call and returns focus to it on close, which is what the extraction's pointer
// contract says ("focus returns to the opener"). Arm C-a in tests/overview.cjs proves it.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { assetBase } from "./cmeta";
import { tierFor, useMode, type Mode, type Tier } from "@/lib/tier";

export type ConsoleDestination = {
  id: string;
  label: string;
  /** One explanatory line under the label, e.g. "Reports from every surface, the queue and the first takedowns." */
  line?: string | undefined;
  /** false renders "Not yet" at right, aria-disabled, and does nothing. Default true. */
  available?: boolean | undefined;
};
export type ConsoleShellProps = {
  /** The signed-in staff member: name in the bar, role in caps under it (hidden at compact). The only person the console names. */
  staff: { name: string; role?: string | undefined };
  destinations: ConsoleDestination[];
  /** id of the current destination (aria-current page). */
  current?: string | undefined;
  onNavigate?: ((id: string) => void) | undefined;
  onSignOut?: (() => void) | undefined;
  /** The word beside the mark. Default "Admin". */
  word?: string | undefined;
  /** compact | medium | expanded. Follows the shell's own width through tierFor() when absent. */
  tier?: Tier | undefined;
  /** pointer | touch. Follows the device when absent. */
  input?: Mode | undefined;
  /** full renders navigation and the page; none keeps the bar and shows `noRoleText` alone. Default full. */
  access?: "full" | "none" | undefined;
  /** The one sentence for access none. */
  noRoleText?: string | undefined;
  /** Title of the navigation drawer at compact and medium. Default "Console". */
  menuTitle?: string | undefined;
  /** The page. */
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

/** ConsoleShell (1306, 1308). The admin app's chrome; mounted once at the admin root, no page composes its own (69 applied to the console).
 *  Top bar --console-bar-height 56 on --bg with a 1px --line below: mark (logo.png at 24), the word (default "Admin"), staff name over role (13px caps; role hidden at compact), Sign out (Button ghost sm).
 *  Expanded (over --tier-expanded): a --console-nav-width 248 left navigation, 44px rows, --radius-m. Compact and medium: a navigation opener (IconButton panel-left-open, "Open navigation") in the bar
 *  and the shell's own ConsoleMenu, a left-anchored navigation drawer (native <dialog>, focus trap, Escape, scrim --scrim at --z-scrim, panel at --z-sheet). It is not a Sheet: a sheet holds one decision and has no navigation of its own (561).
 *  Destinations: current (aria-current page, --ink, 500, --bg-sunken ground), available (--ink-2, hover --bg-sunken, onNavigate(id)), not yet available (`available: false`: --ink-3, "Not yet" at right, aria-disabled, cursor not-allowed, does nothing). Each with one explanatory line (--ink-3, 13px).
 *  No role (`access="none"`): the bar stays; navigation and page are gone; one 19px sentence under the bar (`noRoleText`).
 *  Motion: the drawer enters from its left edge by one transform transition of --dur-slow on --ease (as Sheet, 1229); immediate under prefers-reduced-motion.
 *  Pointer: hover grounds on rows and Sign out. Touch: tap; the drawer closes on scrim tap, Close or choosing a destination. `tier` and `input` follow the container and device unless given.
 *  Both themes from tokens; nothing branches on theme. The mark is the colour PNG on either ground (readme: no monochrome variant). */
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
function useShellTier(ref: RefObject<HTMLDivElement | null>, given: Tier | undefined): Tier {
  const [t, setT] = useState<Tier>(given || "expanded");
  useLayoutEffect(() => {
    if (given) {
      setT(given);
      return undefined;
    }
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const read = () => setT(tierFor(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [given, ref]);
  return t;
}
export function ConsoleShell({
  staff,
  destinations = [],
  current,
  onNavigate,
  onSignOut,
  word = "Admin",
  tier,
  input,
  access = "full",
  noRoleText = "Your role does not include this page. Sign out and ask the founder for a role that does.",
  menuTitle = "Console",
  children,
  style,
}: ConsoleShellProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const t = useShellTier(root, tier);
  const device = useMode();
  const mode = input || device,
    touch = mode === "touch";
  const [open, setOpen] = useState(false);
  const wide = t === "expanded";
  const logo = assetBase() + "logo.png";
  const go = (id: string) => {
    setOpen(false);
    if (onNavigate) onNavigate(id);
  };
  const nav = <ConsoleNav destinations={destinations} current={current} onGo={go} touch={touch} />;
  return (
    <div
      ref={root}
      data-console-shell={t}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: wide ? 16 : 8,
          height: "var(--console-bar-height)",
          padding: wide ? "0 24px" : "0 8px 0 8px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg)",
          boxSizing: "border-box",
          flex: "none",
          position: "sticky",
          top: 0,
          zIndex: "var(--z-sticky)",
        }}
      >
        {!wide && access === "full" && (
          <IconButton
            name="panel-left-open"
            label="Open navigation"
            input={mode}
            onClick={() => setOpen(true)}
            aria-expanded={open}
          />
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: 1,
            paddingLeft: wide ? 0 : 4,
          }}
        >
          <img src={logo} alt="DNA" style={{ height: 24, display: "block", flex: "none" }} />
          <span
            style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)", whiteSpace: "nowrap" }}
          >
            {word}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            minWidth: 0,
            lineHeight: 1.2,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 160,
            }}
          >
            {staff.name}
          </span>
          {staff.role && t !== "compact" && (
            <span
              style={{
                fontSize: 13,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              {staff.role}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </header>
      {access !== "full" ? (
        <p
          style={{
            margin: 0,
            padding: "var(--space-6) var(--space-5)",
            fontSize: 19,
            lineHeight: 1.5,
            color: "var(--ink)",
            maxWidth: "var(--content-max)",
            textWrap: "pretty",
          }}
        >
          {noRoleText}
        </p>
      ) : (
        <div style={{ display: "flex", flex: 1, minHeight: 0, alignItems: "stretch" }}>
          {wide && (
            <nav
              aria-label="Console"
              style={{
                width: "var(--console-nav-width)",
                flex: "none",
                padding: "var(--space-4) var(--space-3)",
                boxSizing: "border-box",
                borderRight: "1px solid var(--line)",
              }}
            >
              {nav}
            </nav>
          )}
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      )}
      {!wide && access === "full" && (
        <ConsoleMenu open={open} onClose={() => setOpen(false)} title={menuTitle} input={mode}>
          {nav}
        </ConsoleMenu>
      )}
    </div>
  );
}
function ConsoleNav({
  destinations,
  current,
  onGo,
  touch,
}: {
  destinations: ConsoleDestination[];
  current: string | undefined;
  onGo: (id: string) => void;
  touch: boolean;
}) {
  const [hot, setHot] = useState<string | null>(null);
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {destinations.map((d) => {
        const cur = d.id === current,
          off = d.available === false;
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => !off && !cur && onGo(d.id)}
              aria-current={cur ? "page" : undefined}
              aria-disabled={off || undefined}
              aria-describedby={d.line ? "console-line-" + d.id : undefined}
              onMouseEnter={() => !touch && setHot(d.id)}
              onMouseLeave={() => setHot(null)}
              style={{
                all: "unset",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
                minHeight: 44,
                padding: "8px 12px",
                borderRadius: "var(--radius-m)",
                cursor: off ? "not-allowed" : cur ? "default" : "pointer",
                background: cur
                  ? "var(--bg-sunken)"
                  : hot === d.id && !off
                    ? "var(--bg-sunken)"
                    : "transparent",
                transition: "background var(--dur-default) var(--ease)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  fontSize: 15,
                  lineHeight: 1.4,
                  fontWeight: cur ? 500 : 400,
                  color: off ? "var(--ink-3)" : cur ? "var(--ink)" : "var(--ink-2)",
                }}
              >
                <span>{d.label}</span>
                {off && (
                  <span
                    style={{
                      fontSize: 13,
                      letterSpacing: "var(--tracking-caps)",
                      textTransform: "uppercase",
                      color: "var(--ink-4)",
                      flex: "none",
                    }}
                  >
                    Not yet
                  </span>
                )}
              </span>
              {d.line && (
                <span
                  id={"console-line-" + d.id}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    // 1649 (brief 60-SP item 15, compile sha256-b1a458dac1bd562f): the explanatory
                    // line reads --ink-2; --ink-3 measured 4.00:1 on the current row's tint.
                    color: off ? "var(--ink-4)" : "var(--ink-2)",
                    textWrap: "pretty",
                  }}
                >
                  {d.line}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
/** The shell's own navigation drawer. Left-anchored at --console-nav-width; a bottom sheet is not used because navigation is read top to bottom from the left edge, where the opener sits. */
function ConsoleMenu({
  open,
  onClose,
  title,
  input,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  input: Mode;
  children: ReactNode;
}) {
  const dlg = useRef<HTMLDialogElement | null>(null);
  // Ruling 1366: the element focus returns to, captured before the drawer takes focus (header, item 3).
  const returnTo = useRef<Element | null>(null);
  const reduced = reducedMotion();
  const [entered, setEntered] = useState(reduced),
    [gone, setGone] = useState(true);
  useLayoutEffect(() => {
    if (open) {
      setGone(false);
      returnTo.current = document.activeElement;
      const d = dlg.current;
      if (d && !d.open) d.show();
      if (d) d.getBoundingClientRect();
      setEntered(true);
      const f = d && d.querySelector<HTMLElement>(FOCUSABLE);
      if (f) f.focus({ preventScroll: true });
      return undefined;
    }
    setEntered(false);
    const d = dlg.current;
    const ms =
      reduced || !d ? 0 : parseFloat(getComputedStyle(d).getPropertyValue("--dur-slow")) || 300;
    const tm = setTimeout(() => setGone(true), ms);
    return () => clearTimeout(tm);
    // As compiled: the effect runs on `open` alone. `reduced` is read fresh on each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const d = dlg.current;
        if (!d) return;
        const f = Array.from(d.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!f.length) return;
        const a = f[0],
          z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          if (z) z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          if (a) a.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      const prev = returnTo.current;
      returnTo.current = null;
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus();
    };
    // As compiled: the listener is attached when the drawer opens and released when it closes, and
    // the element focus returns to is the one the layout effect captured before the drawer took
    // focus (1366). Keying on `onClose` as well would release and re-attach mid-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (gone && !open) return null;
  return (
    <>
      <div
        data-console-scrim
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--scrim)",
          zIndex: "var(--z-scrim)",
          opacity: entered && open ? 1 : 0,
          transition: reduced ? "none" : "opacity var(--dur-slow) var(--ease)",
        }}
      />
      <dialog
        ref={dlg}
        aria-label={title}
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          margin: 0,
          padding: 0,
          border: "none",
          borderRight: "1px solid var(--line)",
          width: "var(--console-nav-width)",
          maxWidth: "85%",
          height: "100%",
          maxHeight: "none",
          background: "var(--surface)",
          color: "var(--ink)",
          zIndex: "var(--z-sheet)",
          display: "flex",
          flexDirection: "column",
          overflow: "clip",
          transform: entered && open ? "none" : "translateX(-100%)",
          transition: reduced ? "none" : "transform var(--dur-slow) var(--ease)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            height: 57,
            padding: "6px 8px 6px 20px",
            boxSizing: "border-box",
            borderBottom: "1px solid var(--line)",
            flex: "none",
          }}
        >
          <span
            style={{
              fontSize: 13,
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "var(--ink-3)",
            }}
          >
            {title}
          </span>
          <IconButton name="x" label="Close" input={input} onClick={onClose} />
        </div>
        <nav aria-label="Console" style={{ padding: "var(--space-3)", overflowY: "auto", flex: 1 }}>
          {children}
        </nav>
      </dialog>
    </>
  );
}
