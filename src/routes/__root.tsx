import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useLocation,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/strand/Button";
import { FooterLink, SystemPage } from "@/components/dna/AuthSurface";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";
import {
  isUngated,
  noteInitialState,
  ONBOARDING_ORDER,
  ONBOARDING_ROUTE,
  screenOfPath,
} from "../lib/onboarding";
import { useOnboardingState } from "../lib/onboarding-hooks";
import { captureRecoveryFromUrl, recoveryPending } from "../lib/recovery";
import { record } from "../lib/record";

/**
 * Design pass 01, B10: a system page is one AuthHead over one 480 column, centred in the viewport
 * with auto margins, one act and a footer line at the bottom (rulings 487, 491). The tailwind-shaped
 * default this replaced carried its own type scale, its own colours and a 7xl numeral.
 *
 * The copy is unchanged. B10 item 5 puts the new 404 and 500 lines in the pass's EXTRACTION.md,
 * which did not arrive with this handoff; ruling 496 requires them verbatim, so they are not
 * invented here. Reported as a gap.
 */
function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    <SystemPage
      data-testid="not-found"
      heading="Page not found"
      lead="The page you're looking for doesn't exist or has been moved."
      footer={
        <FooterLink
          before="Lost your way?"
          link="Go home"
          onClick={() => void navigate({ to: "/feed", search: {} })}
        />
      }
    >
      <Button type="button" full onClick={() => void navigate({ to: "/feed", search: {} })}>
        Go home
      </Button>
    </SystemPage>
  );
}

/** The system page for a failed render; Brief 10's public route reuses it for a failed load. */
export function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  // 12C part 2: a failed render, recorded by its code and never its message text.
  useEffect(() => {
    record("client_error", { code: "route_error" });
  }, []);

  // B10 item 3: one act. "Try again" is the act; "Go home" is the footer line.
  return (
    <SystemPage
      data-testid="error-page"
      heading="This page didn't load"
      lead="Something went wrong on our end. You can try refreshing or head back home."
      footer={
        <FooterLink
          before="Still stuck?"
          link="Go home"
          onClick={() => (window.location.href = "/")}
        />
      }
    >
      <Button
        type="button"
        full
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </Button>
    </SystemPage>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "DNA" },
      { name: "description", content: "Diaspora Network Africa" },
      { name: "theme-color", content: "#faf7f2" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "DNA" },
      { property: "og:type", content: "website" },
    ],
    links: [
      // Ruling 433 (U-S10): the two brand faces are self-hosted under public/strand/fonts, so no
      // third party is contacted for type and no preconnect is needed.
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Ruling 184's asset contract: every icon resolves by path from public/, so the redesign is
      // a file overwrite in one directory. The favicon.png line is the founder's own 9 September
      // edit and is left exactly as they set it.
      // Handoff 38-A: browsers request /favicon.ico on their own whatever the head declares, and it
      // answered 404, so a tab kept the icon it had cached for the host (Lovable's). The ICO is
      // generated from icon-512.png and linked first; the favicon.png line below is untouched.
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      // 1885, 1903: the dark tab icon, the square master in dark --ink, after favicon.png so a dark
      // scheme takes it; a light scheme does not match it and keeps the lines above.
      {
        rel: "icon",
        href: "/favicon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Ruling 438: the CSP nonce this response was rendered with, echoed for the client-side router
  // (it reads meta[property="csp-nonce"] at hydration). Absent when no nonce was minted.
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {nonce && <meta property="csp-nonce" content={nonce} />}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Ruling 240: the recovery handler renders /reset/new and never the Feed. A recovery token that
 * lands anywhere in the app — the Site URL included, which is where it lands today — is held here
 * until a password is set, so the session it created is not usable for anything else. Registering
 * /reset/new as the recovery redirect in Supabase's URL configuration removes the detour; this
 * removes the silent sign-in whether or not it is registered.
 */
function RecoveryGate() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    captureRecoveryFromUrl();
    if (!recoveryPending()) return;
    if (pathname.replace(/\/$/, "") === "/reset/new") return;
    void navigate({ to: "/reset/new", replace: true });
  }, [pathname, navigate]);
  return null;
}

/**
 * Brief 5 (SPEC section 1, ruling 307): every guarded route redirects to the first incomplete
 * onboarding screen until onboarded_at is set, decided by onboarding_state() and never inferred
 * client-side. One place, like RecoveryGate above it, so no route can forget. A member who has
 * onboarded and opens an onboarding route is sent to the Feed; a screen already completed is
 * reachable (Back reaches it), a screen ahead of the next one is not. Guarded routes render
 * nothing until the state is known, so the Feed never flashes before the redirect.
 */
function OnboardingGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const { ready, member } = useAuth();
  const enabled = ready && !!member && !recoveryPending();
  const q = useOnboardingState(member?.id, enabled);
  const state = q.data ?? null;
  useEffect(() => {
    if (state) noteInitialState(state);
  }, [state]);

  const screen = screenOfPath(pathname);
  const ungated = isUngated(pathname);
  let target: "/feed" | "/welcome" | "/where" | "/relationship" | null = null;
  if (enabled && q.status === "success" && state) {
    const next = state.next;
    if (next === null) {
      if (screen) target = "/feed";
    } else {
      const want = ONBOARDING_ROUTE[next];
      if (screen) {
        if (ONBOARDING_ORDER.indexOf(screen) > ONBOARDING_ORDER.indexOf(next)) target = want;
      } else if (!ungated) target = want;
    }
  }
  // Only once the router is idle. While a transition is pending the router still renders the
  // previous match (sign-in, after its own redirect to the Feed), and a redirect issued into that
  // window keeps the previous match mounted and its redirect firing: a loop between the two.
  const routerStatus = useRouterState({ select: (s) => s.status });
  // While a transition is pending the router still renders the resolved (previous) match, so a
  // guarded route that is being left must stay held too, or the Feed flashes on its way out.
  const resolvedPath = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const issued = useRef<string | null>(null);
  useEffect(() => {
    if (!target) {
      issued.current = null;
      return;
    }
    if (routerStatus !== "idle") return;
    const key = pathname + " -> " + target;
    if (issued.current === key) return;
    issued.current = key;
    void navigate({ to: target, replace: true, search: {} });
  }, [target, pathname, routerStatus, navigate]);

  const leavingGuarded =
    routerStatus !== "idle" && !isUngated(resolvedPath) && !screenOfPath(resolvedPath);
  const holding =
    enabled &&
    ((!ungated && (q.status === "pending" || target !== null)) ||
      (leavingGuarded && q.status === "success" && !!state && state.next !== null));
  if (holding) return null;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RecoveryGate />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        {/* The composer mounts once inside the shell layout (src/routes/_shell.tsx), not here. */}
        <OnboardingGate>
          <Outlet />
        </OnboardingGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
