// Supabase Auth is the one auth path. Session state is shared through a small provider.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabase } from "./supabase";
import { markRecoveryPending } from "./recovery";
import { noteProviderSignIn } from "./auth-flow";

/**
 * Handoff 30-D item 9 (ruling 1033): once a session exists, the member takes any guest rows for
 * their confirmed address, with their edges, through `public.claim_guest_registrations`. Called
 * once per signed-in account per page load, from the initial session read or from SIGNED_IN,
 * whichever comes first; never from `handle_new_user`, which is a trigger and fires before the
 * address is confirmed. It is idempotent and a zero result is normal. It never blocks the shell,
 * and a failure is logged by its code and never by the address.
 */
async function claimGuestRegistrations(sb: SupabaseClient<Database>): Promise<void> {
  try {
    const { error } = await sb.rpc("claim_guest_registrations");
    if (error)
      console.warn(
        JSON.stringify({ event: "claim_guest_registrations_failed", code: error.code ?? null }),
      );
  } catch {
    console.warn(JSON.stringify({ event: "claim_guest_registrations_failed", code: null }));
  }
}

export type Member = {
  id: string;
  name: string;
  email: string | undefined;
  avatar: string | undefined;
  /** The member's public address (/m/:handle), from the members row the sign-up trigger creates (Brief 3). */
  handle?: string | undefined;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  member: Member | null;
  /** W27: re-read the members row (name, handle) after a profile save, so the shell carries it. */
  refreshMember: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  ready: false,
  session: null,
  member: null,
  refreshMember: async () => {},
});

export function memberFromUser(user: User | null | undefined): Member | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta["full_name"] === "string" && meta["full_name"]) ||
    (typeof meta["name"] === "string" && meta["name"]) ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Member";
  const avatar =
    typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : undefined;
  return { id: user.id, name: String(name), email: user.email, avatar };
}

// The members row (Brief 3) carries the handle and the name the member set on their profile;
// auth metadata stays the fallback so the shell renders before the row arrives.
async function withProfile(session: Session | null): Promise<Member | null> {
  const sb = getSupabase();
  const base = memberFromUser(session?.user);
  if (!sb || !base) return base;
  const { data } = await sb.from("members").select("handle,name").eq("id", base.id).maybeSingle();
  return data ? { ...base, handle: data.handle, name: data.name || base.name } : base;
}

type AuthCore = Omit<AuthState, "refreshMember">;

/**
 * Ruling 1746 (D1848; handoff 61-S1, S13): a session revoked elsewhere, by `session_revoke` from
 * another device or by Supabase itself, must sign this device out, and the access token alone cannot
 * say so: it stays valid until it expires and nothing in the app checked it against the server. So
 * the one check lives here, beside the one place the session is held: on every page load and
 * whenever the tab regains focus, `getUser()` asks `/auth/v1/user`. auth-js maps the server's 403
 * `session_not_found` to `AuthSessionMissingError`, removes the local session itself and raises
 * SIGNED_OUT, which the listener below turns into no member; this device then lands on /sign-in.
 * A failed network call is not a sign-out: it comes back as `AuthRetryableFetchError` and changes
 * nothing, and so does any other refusal. Only the server's answer that the session is gone does.
 */
export const SESSION_GONE = "AuthSessionMissingError";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthCore>({ ready: false, session: null, member: null });
  const navigate = useNavigate();
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let inflight = false;
    let active = true;
    const check = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const { data } = await sb.auth.getSession();
        // No local session: nothing to verify, and getUser() would answer the same error offline.
        if (!data.session) return;
        const { error } = await sb.auth.getUser();
        if (!active || !error || error.name !== SESSION_GONE) return;
        setState({ ready: true, session: null, member: null });
        void navigate({ to: "/sign-in", replace: true });
      } catch {
        /* a thrown fetch failure is not the server's answer */
      } finally {
        inflight = false;
      }
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onFocus = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);
  // The account the claim has run for on this page load; a sign-out clears it so the next sign-in
  // claims again. Keyed by user rather than by token, because a refresh is not a new sign-in.
  const claimedFor = useRef<string | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    const claimOnce = (session: Session | null) => {
      const uid = session?.user.id ?? null;
      if (!uid || claimedFor.current === uid) return;
      claimedFor.current = uid;
      void claimGuestRegistrations(sb);
    };
    void sb.auth.getSession().then(async ({ data }) => {
      if (active) claimOnce(data.session);
      const member = await withProfile(data.session);
      if (!active) return;
      // Ruling 1746: the session check below can remove the session while this profile read is in
      // flight, and SIGNED_OUT has then already cleared the state; writing the session read before
      // it back would sign the device in again on a dead session. Write only what the client holds.
      const { data: now } = await sb.auth.getSession();
      if ((now.session?.access_token ?? null) !== (data.session?.access_token ?? null)) return;
      setState({ ready: true, session: data.session, member });
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // Ruling 240: the second reading of a recovery, for the case where the fragment was consumed
      // before this app's own capture could see it. The gate in the root route acts on the flag.
      if (event === "PASSWORD_RECOVERY") markRecoveryPending();
      if (event === "SIGNED_OUT") claimedFor.current = null;
      if (event === "SIGNED_IN") {
        claimOnce(session);
        // 12C part 2: a provider return is the one sign-in that completes here. auth-js 2.115 also
        // raises SIGNED_IN from _recoverAndRefresh on a tab refocus and relays another tab's, so
        // the provider marker, not the event, is what names a sign-in (noteProviderSignIn).
        noteProviderSignIn();
      }
      setState({ ready: true, session, member: memberFromUser(session?.user) });
      void withProfile(session).then((member) => {
        if (active) setState((s) => (s.session === session ? { ...s, member } : s));
      });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  // W27: after a profile save the shell re-reads the members row, so the name it carries (header,
  // greeting, account panel) is the one just saved rather than the one read at sign-in.
  const refreshMember = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const member = await withProfile(data.session);
    setState((s) => (s.session?.user.id === member?.id ? { ...s, member } : s));
  }, []);
  const value = useMemo(() => ({ ...state, refreshMember }), [state, refreshMember]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
