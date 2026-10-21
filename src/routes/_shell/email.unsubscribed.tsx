// /email/unsubscribed (handoff 60-NC; rulings 1557, 1529, 1559, 1565, 1567; SPEC-56 section 6,
// B56-Unsubscribed-v1). Reached from a non-transactional email's unsubscribe link, signed out or
// signed in. The page reads the token from its URL and sends the one-click request on load to the
// same route the List-Unsubscribe header names, then renders only the state the server returned:
// done, the link expired or already used, or refused. It never guesses.
//
// Signed out it is a system page under the auth head (377, 390, 487), outside the shell's chrome,
// as the public profile is (src/routes/_shell.tsx). Signed in it renders inside the shell, whose
// header carries the wordmark, so no logo band is repeated (1565).
//
// The link opens the notification panel's email view: signed in through `?notifications=email` on
// /feed, signed out through /sign-in with `next=email-preferences`, which sign-in maps to that same
// destination and to nowhere else. No email address, no count, no resubscribe switch (SPEC 6.6).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { SystemPage, useHeadingFocus } from "@/components/dna/AuthSurface";
import { Button } from "@/components/strand/Button";
import { useAuth } from "@/lib/auth";
import { unsubscribe, type UnsubscribeState } from "@/lib/unsubscribe";
import { useTheme, useTier } from "@/lib/tier";

export type UnsubscribedSearch = { token?: string };

export const Route = createFileRoute("/_shell/email/unsubscribed")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  validateSearch: (search: Record<string, unknown>): UnsubscribedSearch => {
    const t = search["token"];
    return typeof t === "string" && /^[0-9a-f]{64}$/.test(t) ? { token: t } : {};
  },
  component: Unsubscribed,
});

/** SPEC 6.3, every string as approved (L1 to L13). */
const COPY = {
  done: {
    heading: "Email from DNA is off.",
    lead: "You will not get email about Connect, Convene, Collaborate, Contribute or Convey. Mail about your account and security still arrives.",
    linkIn: "Choose which emails you get",
    linkOut: "Sign in to choose which emails you get",
  },
  expired: {
    heading: "This link no longer works.",
    lead: "It has expired or was already used. Your email preferences show whether DNA email is on or off.",
    linkIn: "Open your email preferences",
    linkOut: "Sign in to open your email preferences",
  },
  refused: {
    heading: "Email could not be turned off.",
    lead: "Something failed on our side and nothing has changed. Try again in a moment.",
  },
} as const;

const linkStyle: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 8px",
  fontSize: 17,
  fontWeight: 500,
  color: "var(--ink)",
  textUnderlineOffset: 3,
  textAlign: "center",
  textWrap: "pretty",
};

const inlineLink: CSSProperties = { color: "var(--ink)", textUnderlineOffset: 3 };

function Unsubscribed() {
  const { ready, member } = useAuth();
  const { token } = Route.useSearch();
  const tier = useTier();
  useTheme();
  const [state, setState] = useState<UnsubscribeState | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useHeadingFocus(state);

  const send = useCallback(async () => {
    // A URL with no well-formed token cannot name a member: it reads as a link that no longer works.
    if (!token) {
      setState("expired");
      return;
    }
    setBusy(true);
    try {
      setState(await unsubscribe(token));
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void send();
  }, [send]);

  if (!ready || !state) return <div aria-busy="true" data-testid="unsubscribed-pending" />;

  const signedIn = !!member;
  const c = COPY[state];
  const toPrefs = signedIn
    ? ({ to: "/feed", search: { notifications: "email" } } as const)
    : ({ to: "/sign-in", search: { next: "email-preferences" } } as const);
  const headingId = "unsubscribed-heading";

  const act: ReactNode =
    state === "refused" ? (
      <>
        <div style={{ width: "100%", maxWidth: 320 }}>
          {/* SPEC 6.5: the label does not change while the write runs again. */}
          <Button full disabled={busy} onClick={() => void send()} data-testid="unsubscribed-retry">
            Try again
          </Button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--ink-2)",
            textAlign: "center",
            textWrap: "pretty",
          }}
        >
          {signedIn ? (
            <>
              Or{" "}
              <Link {...toPrefs} style={inlineLink}>
                open your email preferences
              </Link>{" "}
              and choose Off for each part of DNA.
            </>
          ) : (
            <>
              Or{" "}
              <Link {...toPrefs} style={inlineLink}>
                sign in
              </Link>{" "}
              and choose Off for each part of DNA in your email preferences.
            </>
          )}
        </p>
      </>
    ) : (
      <Link {...toPrefs} style={linkStyle} data-testid="unsubscribed-link">
        {signedIn ? COPY[state].linkIn : COPY[state].linkOut}
      </Link>
    );

  const main = (
    <main
      aria-labelledby={headingId}
      data-testid="unsubscribed"
      data-state={state}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        alignItems: "center",
        minWidth: 0,
        width: "100%",
      }}
    >
      {act}
    </main>
  );

  if (!signedIn)
    return (
      <SystemPage
        heading={<span id={headingId}>{c.heading}</span>}
        lead={c.lead}
        headingRef={headingRef}
      >
        <div style={{ marginTop: 14 }}>{main}</div>
      </SystemPage>
    );

  const compact = tier === "compact";
  return (
    <div
      style={{
        minHeight: "var(--_shell-visible, 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          width: "100%",
          maxWidth: compact ? 400 : 480,
          margin: "auto",
          padding: compact
            ? "24px 24px 120px"
            : tier === "medium"
              ? "24px 32px 96px"
              : "24px 32px 40px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <h1
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: compact ? 30 : 32,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              textWrap: "balance",
              textAlign: "center",
              color: "var(--ink)",
              outline: "none",
            }}
          >
            {c.heading}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.5,
              color: "var(--ink-2)",
              textWrap: "pretty",
              textAlign: "center",
            }}
          >
            {c.lead}
          </p>
        </div>
        {main}
      </div>
    </div>
  );
}
