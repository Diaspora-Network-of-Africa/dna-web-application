// The admin app's root (Brief 12 12A-2, handoff 40-B). The member app's AuthProvider, imported and
// not copied (ruling 1291): the same client, the same session in this origin's browser storage, so
// signing in here signs nobody in on the app and the reverse. No onboarding gate, no recovery gate
// and no member chrome: those are the member app's and nothing admin is reachable from it.
import { Outlet, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { setRecordApp } from "@/lib/record";
import appCss from "@/styles.css?url";
import { DEVICE_THEME_SCRIPT, useAppearance } from "../lib/theme";

// 12C part 2 (handoff 58-12C2 section 2): the admin app names itself to the one recorder, so its
// sign-in rows carry app `admin`. The member app sends `app` and calls nothing.
setRecordApp("admin");

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "DNA Admin" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#faf7f2" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Ruling 184's asset contract: the same files, by path, from the shared public/ tree.
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
});

function RootShell({ children }: { children: ReactNode }) {
  // Ruling 438: the CSP nonce this response was rendered with, echoed for the client-side router.
  const nonce = useRouter().options.ssr?.nonce;
  // Rulings 1377 and 1393: the account's appearance, or the device's under System, set before first paint by the script, which carries the
  // same nonce (438) and sits after the stylesheet so it can read the resolved --bg. The attribute
  // it writes is not the server's, hence suppressHydrationWarning on <html>. The body's ground is
  // the token, so no edge of the page shows Tailwind's light --background on a dark device.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {nonce && <meta property="csp-nonce" content={nonce} />}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: DEVICE_THEME_SCRIPT }} />
      </head>
      <body style={{ background: "var(--bg)" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Both themes from the tokens: the account's appearance, or the device under System (1377, 1393).
  useAppearance();
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
