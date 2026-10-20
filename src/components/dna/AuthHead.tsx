// Design pass 01, strand-patch/AuthHead.jsx (rulings 377, 390, 487, 491). One header for auth,
// onboarding, confirmation and system pages:
//
//     logo band (fixed height)  ->  --auth-head-gap  ->  centred h1  ->  centred lead
//
// The band's height never changes with content, which is what 377 asks for: the logo moves only by
// design decision, never because the form under it grew. The logo is top-aligned in the band, not
// centred in it, so the space under the wordmark is the same on every screen.
//
// Three logo scales exist on the platform and nothing else sizes the wordmark (ruling 491): app
// header 24 compact and 28 expanded; auth head 48 compact and 56 above (these tokens); index and
// documents 28. The wordmark resolves by path and is sized by height, width auto (ruling 184).
//
// AuthColumn is the shell under the head. An auth form holds the top; a system or confirmation page
// centres in the viewport with auto margins (ruling 487). Neither is ever centred by a flex
// container that clips its top once the content is taller than the frame.
import type { CSSProperties, ReactNode, RefObject } from "react";
import { assetBase } from "@/components/strand/cmeta";

// 1892, 1902: the 1A wordmark in --ink in both themes. The span paints --ink through the file as a
// mask; the hidden img of the same file at the mark's height gives the span its width from the
// file's own ratio, so no ratio is written here (184: size by height, width auto).
const WORDMARK = assetBase() + "wordmark-mono.svg";
const WORDMARK_MASK = `url("${WORDMARK}") center / contain no-repeat`;

export function AuthHead({
  heading,
  lead,
  headingRef,
}: {
  heading: ReactNode;
  lead?: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null> | undefined;
}) {
  return (
    <div
      className="strand-auth-head"
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}
    >
      <div
        style={{
          height: "var(--_auth-band)",
          paddingTop: "var(--_auth-top)",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          flex: "none",
        }}
      >
        <span
          role="img"
          aria-label="DNA"
          style={{
            display: "block",
            background: "var(--ink)",
            WebkitMask: WORDMARK_MASK,
            mask: WORDMARK_MASK,
          }}
        >
          <img
            src={WORDMARK}
            alt=""
            style={{
              height: "var(--_auth-logo)",
              width: "auto",
              display: "block",
              visibility: "hidden",
            }}
          />
        </span>
      </div>
      <h1
        ref={headingRef ?? null}
        tabIndex={-1}
        style={{
          margin: "var(--auth-head-gap) 0 0",
          fontFamily: "var(--font-display)",
          fontSize: "var(--_auth-heading)",
          lineHeight: 1.15,
          fontWeight: 700,
          color: "var(--ink)",
          textAlign: "center",
          textWrap: "balance",
          outline: "none",
        }}
      >
        {heading}
      </h1>
      {lead && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 17,
            lineHeight: 1.5,
            color: "var(--ink-2)",
            textAlign: "center",
            textWrap: "pretty",
          }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * The page shell under the head. 400 wide on compact, 480 above, centred horizontally.
 * `centre` is the system and confirmation posture (ruling 487): the column takes auto block margins
 * so a page longer than the viewport still starts at the top and scrolls. Without it the column
 * holds the top and `footer` is pushed to the bottom of the viewport with an auto margin.
 */
export function AuthColumn({
  centre,
  footer,
  children,
  style,
  ...rest
}: {
  centre?: boolean | undefined;
  footer?: ReactNode;
  children: ReactNode;
  style?: CSSProperties | undefined;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
        padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
        background: "var(--bg)",
      }}
    >
      <div
        className="strand-auth-col"
        data-centre={centre ? "1" : "0"}
        style={{
          width: "100%",
          maxWidth: "var(--_auth-col)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          ...(centre ? { marginBlock: "auto" } : { flex: "1 0 auto" }),
          ...style,
        }}
        {...rest}
      >
        {children}
        {footer && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
