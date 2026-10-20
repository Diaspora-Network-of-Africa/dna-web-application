// Brief 4B: the page-level compositions the auth surfaces share. Handoff section 4 recorded three
// Strand gaps these worked around; Design pass 01 closes two of them. PasswordField is now a Strand
// part with the eye toggle inside the field (ruling 392), and AuthHead plus AuthColumn are the one
// logo-and-heading pattern for auth, onboarding, confirmation and system pages (rulings 377, 390,
// 487, 491). Button still has no loading prop, and the separator, the provider buttons and the
// focusable alert are still compositions rather than components.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AuthColumn, AuthHead } from "@/components/dna/AuthHead";
import { Button } from "@/components/strand/Button";
import { Icon } from "@/components/strand/Icon";
import {
  PROVIDERS,
  PROVIDER_BUTTON_LABEL,
  PROVIDER_MARK,
  PROVIDER_WAITING_LABEL,
  type Provider,
} from "@/lib/auth-flow";

/** Sign-in and sign-up keep their live look and carry no visible heading (handoff section 3). */
export const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * Focus the h1 on a route change and whenever the surface swaps state (rulings 180, 222). Never a
 * submit, never a destructive control. `state` is whatever distinguishes one state of the surface
 * from the next; changing it re-focuses the heading.
 */
export function useHeadingFocus(state?: unknown) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [state]);
  return ref;
}

export function AuthHeading({
  children,
  headingRef,
  hidden,
}: {
  children: ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  hidden?: boolean;
}) {
  return (
    <h1
      ref={headingRef ?? null}
      tabIndex={-1}
      style={
        hidden
          ? VISUALLY_HIDDEN
          : {
              fontFamily: "var(--font-display)",
              fontSize: 32,
              lineHeight: 1.15,
              fontWeight: 700,
              color: "var(--ink)",
              margin: 0,
              outline: "none",
            }
      }
    >
      {children}
    </h1>
  );
}

export function AuthLead({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 17, lineHeight: 1.5, color: "var(--ink-2)", margin: 0 }}>{children}</p>
  );
}

export function AuthSmall({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--ink-3)", margin: 0 }}>{children}</p>
  );
}

/**
 * One alert block under the heading and lead, above the form. It takes focus when it appears
 * (ruling 222, Done Means 8); the offending fields carry the red border and nothing else, so the
 * message is announced once.
 */
export function AuthAlert({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      data-testid="auth-alert"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        border: "1px solid var(--error)",
        background: "var(--surface)",
        borderRadius: "var(--radius-m)",
        padding: "12px 14px",
        fontSize: 15,
        lineHeight: 1.45,
        color: "var(--ink)",
        outline: "none",
      }}
    >
      <span style={{ color: "var(--error)", display: "flex", flex: "none", paddingTop: 1 }}>
        <Icon name="info" size={18} />
      </span>
      <span>{children}</span>
    </div>
  );
}

/** Provider cancelled is a status line and moves no focus (handoff section 2). */
export function AuthStatus({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      data-testid="auth-status"
      style={{ fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}
    >
      {children}
    </div>
  );
}

export function OrSeparator() {
  return (
    <div
      role="separator"
      aria-label="Or"
      style={{ display: "flex", alignItems: "center", gap: 12 }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span style={{ fontSize: 13, color: "var(--ink-3)" }}>or</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

/**
 * The two provider buttons, stacked, gap 12. Ruling 232: a provider mark appears on its own button
 * and nowhere else — no badge, no "verified with", no tier. The mark is alt="" and the label
 * carries the name.
 */
export function ProviderButtons({
  waitingFor,
  disabled,
  onStart,
}: {
  waitingFor: Provider | null;
  disabled: boolean;
  onStart: (p: Provider) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {PROVIDERS.map((p) => (
        <Button
          key={p}
          type="button"
          variant="secondary"
          full
          data-testid={"provider-" + p}
          disabled={disabled}
          onClick={() => onStart(p)}
        >
          <img
            src={PROVIDER_MARK[p]}
            alt=""
            width={18}
            height={18}
            style={{ height: 18, width: "auto", display: "block" }}
          />
          {waitingFor === p ? PROVIDER_WAITING_LABEL[p] : PROVIDER_BUTTON_LABEL[p]}
        </Button>
      ))}
    </div>
  );
}

/**
 * Ruling 487: an auth form holds the top. The head sits at the top of the column, the form follows,
 * and the footer line takes the bottom of the viewport with an auto margin. A page longer than the
 * viewport scrolls and nothing is clipped, which is what centring a column inside a scroller broke.
 */
export function AuthPage({
  heading,
  lead,
  headingRef,
  footer,
  children,
  ...rest
}: {
  heading: ReactNode;
  lead?: ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null> | undefined;
  footer?: ReactNode;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  return (
    <AuthColumn {...(footer ? { footer } : {})} {...rest}>
      <AuthHead
        heading={heading}
        {...(lead ? { lead } : {})}
        {...(headingRef ? { headingRef } : {})}
      />
      {children}
    </AuthColumn>
  );
}

/**
 * Ruling 487: a system or confirmation page centres in the viewport instead, with auto margins, so
 * it still starts at the top and scrolls when it is longer than the frame. One act, never two
 * (B10 item 3); the footer line holds the bottom.
 */
export function SystemPage({
  heading,
  lead,
  headingRef,
  footer,
  children,
  ...rest
}: {
  heading: ReactNode;
  lead?: ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null> | undefined;
  footer?: ReactNode;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  return (
    <AuthColumn centre {...(footer ? { footer } : {})} {...rest}>
      <AuthHead
        heading={heading}
        {...(lead ? { lead } : {})}
        {...(headingRef ? { headingRef } : {})}
      />
      {children}
    </AuthColumn>
  );
}

/** The one linked sentence a system page's footer carries. */
export function FooterLink({
  onClick,
  before,
  link,
  after,
}: {
  onClick: () => void;
  before: string;
  link: string;
  after?: string;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 15,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textAlign: "center",
      }}
    >
      {before}{" "}
      <button
        type="button"
        onClick={onClick}
        style={{
          all: "unset",
          cursor: "pointer",
          color: "var(--ink)",
          fontWeight: 500,
          textDecoration: "underline",
          textUnderlineOffset: 3,
          minHeight: "var(--target-min)",
        }}
      >
        {link}
      </button>
      {after ?? ""}
    </p>
  );
}

/**
 * The "Check your email" state, shared by sign-up (ruling 234: identical whether or not the address
 * already has an account) and by /reset (ruling 156 applied to auth: byte-identical for a known and
 * an unknown address). Neither caller branches on what the server answered, so there is one render
 * path and the markup cannot differ.
 *
 * Design pass 01, B10: it is a system page. One act, never two (item 3) — "Use a different address"
 * — and the second control becomes the footer's linked sentence, which on sign-up is ruling 412's
 * "If you already have an account, sign in instead." (item 4).
 */
export function CheckEmail({
  heading,
  body,
  small,
  onUseDifferent,
  footer,
  headingRef,
}: {
  heading: string;
  body: ReactNode;
  small: string;
  onUseDifferent: () => void;
  footer: ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <SystemPage
      data-testid="check-email"
      heading={heading}
      lead={body}
      {...(headingRef ? { headingRef } : {})}
      footer={footer}
    >
      <AuthSmall>{small}</AuthSmall>
      <Button
        type="button"
        variant="secondary"
        full
        data-testid="use-different"
        onClick={onUseDifferent}
      >
        Use a different address
      </Button>
    </SystemPage>
  );
}
