// Ruling 438 (F19): the security headers, in one place, for every response the worker produces.
//
// The Content-Security-Policy keeps script-src at 'self' plus a per-response nonce. TanStack
// Start's SSR emits two inline scripts (the scroll-restoration bootstrap and the router's
// dehydrated state behind the stream barrier), and their content changes per request, so a hash
// cannot cover them and 'unsafe-inline' is the thing this policy exists to refuse.
//
// Rulings 542 and 545: one value, two layers, and no HTMLRewriter pass over the body. The worker
// entry mints it and owns it, so every response it builds carries the matching policy; the render
// reads the same value out of request scope and stamps it on `ssr.nonce`, so every inline script the
// router emits carries it, and echoes it in the shell as `<meta property="csp-nonce">` for the
// client-side router at hydration.
//
// The channel is AsyncLocalStorage rather than a header, and that is the one place this departs from
// ruling 545's letter. Two constraints close off the alternatives:
//
//   * Forward on a request header means rebuilding the incoming Request, and
//     `new Request(request, { headers })` is what ruling 542 names: the dev server's Request is not
//     the global constructor's, so undici reads its internals as undefined and throws before any
//     route renders. Nothing on this path constructs a Request any more.
//   * Back on a response header does work, but only for a 2xx. h3 merges the request event's headers
//     onto a returned Response only when that Response is ok, so a 404 arrived with the nonce stamped
//     in its markup and absent from its policy, which blocks the very scripts the policy exists to
//     allow. Measured on the built worker, not reasoned about.
//
// The store itself lives in src/lib/csp-nonce.server.ts, not here: this module is imported by the
// router and so ships to the client, and `node:async_hooks` cannot be constructed in a browser
// bundle. The import below is reached only from the `.server()` branch, which the isomorphic split
// strips from the client build along with what it imports.
//
// Static assets never run an inline script; their copy of these headers is public/_headers, which
// carries the same policy with script-src 'self' and no nonce.
import { createIsomorphicFn } from "@tanstack/react-start";
import { nonceInScope } from "./csp-nonce.server";
import { SUPABASE_URL } from "./supabase";

/**
 * This response's nonce on the server; undefined on the client, where the meta tag carries it, and
 * undefined outside a request (a build-time render), where the policy falls back to script-src
 * 'self' with no inline script to cover.
 */
export const cspNonce = createIsomorphicFn()
  .server((): string | undefined => nonceInScope())
  .client((): string | undefined => undefined);

// Handoff 62-A2 (rulings 1829, 1830): the Supabase sources are the client's own URL, the custom
// domain auth.diasporanetwork.africa, so the policy and the client cannot name different hosts.
// The static-asset copy in public/_headers carries the same host written out.
const SUPABASE = SUPABASE_URL.replace(/\/$/, "");
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");

export function contentSecurityPolicy(nonce: string | undefined): string {
  const script = nonce ? `script-src 'self' 'nonce-${nonce}'` : "script-src 'self'";
  return [
    "default-src 'self'",
    // Convene Pass 1 (PR 2): place resolution runs through the place-resolve Edge Function, which
    // holds the Mapbox token; the browser makes no Mapbox request, so api.mapbox.com is not allowed.
    `connect-src 'self' ${SUPABASE} ${SUPABASE_WS}`,
    `img-src 'self' data: blob: https: ${SUPABASE}`,
    // Ruling 1569 (amending 438): media plays from object URLs. Messenger hands every <video> and
    // <audio> a blob: URL of bytes it fetched with the bearer (fetchMessageMedia) or the member
    // attached (the composer's measuring element), and without this line media fell back to
    // default-src 'self' and every one of them was refused before it loaded (G223, run 523).
    "media-src 'self' blob:",
    script,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Handoff 30-D item 8.4: a guest's link lands on `/e/{slug}?g={token}`, and the page replaces the
 * address the moment it has read the token; until then, and on every request under `/e/`, nothing
 * this page links to may learn the URL it came from. Every other path keeps ruling 438's value.
 */
export function referrerPolicy(pathname: string): string {
  return pathname === "/e" || pathname.startsWith("/e/")
    ? "no-referrer"
    : "strict-origin-when-cross-origin";
}

/** The six headers of ruling 438, as name and value pairs, for one response. */
export function securityHeaders(nonce: string | undefined, pathname = "/"): [string, string][] {
  return [
    ["Content-Security-Policy", contentSecurityPolicy(nonce)],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", referrerPolicy(pathname)],
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
    ["X-Content-Type-Options", "nosniff"],
    ["Permissions-Policy", "camera=(self), geolocation=(), microphone=()"],
  ];
}

/** A fresh nonce: 128 bits, base64, per response. */
export function mintNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
