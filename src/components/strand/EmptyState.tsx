// Ported from Strand components/dna/EmptyState.jsx; at compile v1790410319010950 (correction 31
// item 4, ruling 1147; ratified with correction 30 under 1153) the part fills the column it sits in:
// no card radius, no inset, the wallpaper running to the column's edges and the block centred in
// the column. It never reads the viewport. A bounded column gives it its height by itself; a page
// that scrolls gives its column the visible height, which the shell publishes as --_shell-visible
// (src/components/dna/AppShell.tsx). `fill`, `stickyTop` and `stickyBottom` were never props of
// Strand's part: the tree carried them from Design pass 01's strand-patch (W38, W48) until handoff
// 33-D moved every caller onto its column, and they are gone.
//
// The one divergence kept from the compile: `title` and `body` are nodes, as the tree has typed
// them since the first port; the compile types them as strings. Every caller passes a string.
import type { CSSProperties, ReactNode } from "react";
import { CBadge } from "./CBadge";
import { assetBase, type C } from "./cmeta";

export type EmptyStateProps = {
  c?: C | "brand";
  title: ReactNode;
  body?: ReactNode;
  /** One act button */
  action?: ReactNode;
  pattern?: "adinkra" | "kente" | "mudcloth";
  style?: CSSProperties | undefined;
};

/** Grounded-or-empty (rule 6). Names the state and offers one act. Never a zero.
 *  Correction 31 (1147): fills the column it sits in. No card radius, no inset; the wallpaper runs to the column's edges and down to the column's visible height, and the badge, title,
 *  body and action sit centred in that visible area. The part never sizes itself to the viewport: it is flex:1 / height:100% / min-height:100% of its container, so a bounded column
 *  (a Pane list or body with height) gives it that height, and a page that scrolls gives it the height the caller sets on the column (e.g. minHeight: calc(100dvh - header) on the column,
 *  not on the part). `fill` and `stickyTop`/`stickyBottom` were never props of this part; they are not added. Every existing caller's props still compile. */
export function EmptyState({
  c = "brand",
  title,
  body,
  action,
  pattern = "adinkra",
  style,
}: EmptyStateProps) {
  return (
    <div
      data-empty-state
      style={{
        flex: "1 1 auto",
        alignSelf: "stretch",
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        padding: "var(--space-10) var(--space-6)",
        background: "var(--bg) url(" + assetBase() + "patterns/" + pattern + "-pattern.svg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div
        data-empty-block
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <CBadge
          c={c}
          size={48}
          style={{ width: "var(--empty-badge)", height: "var(--empty-badge)" }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--display-s)",
            lineHeight: "var(--display-s-lh)",
            color: "var(--ink)",
            maxWidth: "var(--empty-measure)",
          }}
        >
          {title}
        </div>
        {body && (
          <div
            style={{
              fontSize: "var(--text-s)",
              lineHeight: "var(--text-s-lh)",
              color: "var(--ink-2)",
              maxWidth: "var(--empty-measure)",
            }}
          >
            {body}
          </div>
        )}
        {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
      </div>
    </div>
  );
}
