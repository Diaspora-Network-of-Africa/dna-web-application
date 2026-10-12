// Supabase Auth, email and password, plus Google and LinkedIn (rulings 233, 235). The one auth path
// (CLAUDE.md). Sign-up asks for the address and a password only (rulings 432, 384); the name is
// asked once, on onboarding screen one (ruling 307), so nothing is written to user metadata here
// and the composer header and cards read the members row.
//
// Design pass 01, B8. The head is AuthHead, logo 48/56 top-aligned in the fixed band (377, 390,
// 491), and the page's own 80px logo block is gone. The password field is Strand's PasswordField,
// so the eye toggle sits inside the field (392) and a refusal renders in the field's own line,
// carrying Fix PR 02's fault mapping (414). The column holds the top and never centres vertically;
// the footer takes the bottom with an auto margin (487).
//
// Handoff 40-B section 4 (ruling 1291): the email-and-password form itself is SignInForm, shared
// with the admin app's sign-in, so there is one sign-in implementation. This route keeps what is
// the member app's own: the sign-up state, the providers, the reset link and the copy.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  AuthPage,
  CheckEmail,
  FooterLink,
  OrSeparator,
  ProviderButtons,
} from "@/components/dna/AuthSurface";
import { SignInForm, useSignInForm } from "@/components/dna/SignInForm";
import { useAuth } from "@/lib/auth";
import {
  COPY,
  MIN_PASSWORD,
  REVEAL_MS,
  consumeProviderReturn,
  delay,
  isEmailShaped,
  passwordFault,
  passwordFaultCopy,
  startProvider,
  type Provider,
} from "@/lib/auth-flow";
import { recoveryPending } from "@/lib/recovery";
import { readSignInNext, type SignInNext } from "@/lib/sign-in-next";
import { getSupabase } from "@/lib/supabase";
import { useTheme } from "@/lib/tier";

export type SignInSearch = { join?: boolean; email?: string; next?: SignInNext };

export const Route = createFileRoute("/sign-in")({
  // ?join=1 opens the form in its sign-up state (the public profile's "Join DNA", Brief 3).
  // ?email= prefills the address (handoff 30-D item 8.5: the guest's "Create an account" arrives
  // here, on the one sign-up path, with the address the link named).
  // ?next=email-preferences (handoff 60-NC, 1557): after sign-in the member lands on the
  // notification panel's email view. That exact word is the only value kept and it maps to one
  // destination (src/lib/sign-in-next.ts); the parameter never carries a URL, so it cannot redirect
  // off the app.
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const out: SignInSearch = {};
    if (search["join"] === true || search["join"] === "1" || search["join"] === 1) out.join = true;
    const email = typeof search["email"] === "string" ? search["email"].trim() : "";
    if (email && email.length <= 254 && email.includes("@")) out.email = email;
    const next = readSignInNext(search["next"]);
    if (next) out.next = next;
    return out;
  },
  component: SignIn,
});

function SignIn() {
  const { ready, member } = useAuth();
  const navigate = useNavigate();
  const { join, email: prefill, next } = Route.useSearch();
  useTheme();
  const [mode, setMode] = useState<"in" | "up">(join ? "up" : "in");
  // The form's state, in the shared hook: email, password, the alert and status lines, the field
  // flags, the password refusal (ruling 392, B8 item 3: in the field's own line) and busy.
  const form = useSignInForm(prefill ?? "");
  const { email, password, setPassword, setAlert, setStatus, setFlag, setRefusal, setBusy, clear } =
    form;
  const [waitingFor, setWaitingFor] = useState<Provider | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // A provider round trip that failed comes back here rather than to the Feed, so the two states
  // the copy names have somewhere to render (handoff section 2).
  useEffect(() => {
    // 12C part 2: the lib consumes the return (forgets the provider, strips the fragment, records
    // the refusal); this route only renders the copy.
    const back = consumeProviderReturn();
    if (!back) return;
    if (back.kind === "cancelled") setStatus(COPY.providerCancelled(back.provider));
    else setAlert(COPY.providerError(back.provider));
    // The hook's setters are stable for the life of the route; this runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ruling 240: a recovery session is held at /reset/new by the gate in the root route, so this
  // route must not race it to the Feed.
  useEffect(() => {
    if (!ready || !member || recoveryPending()) return;
    void navigate(
      next === "email-preferences"
        ? { to: "/feed", search: { notifications: "email" } }
        : { to: "/feed", search: {} },
    );
  }, [ready, member, navigate, next]);

  const onProvider = async (p: Provider) => {
    clear();
    setWaitingFor(p);
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await startProvider(sb, p);
    if (error) {
      setWaitingFor(null);
      setAlert(COPY.providerError(p));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    if (mode === "in") {
      // The shared sign-in: the shape check, then the request. The mismatch line never says which
      // of the two was wrong (handoff section 2).
      await form.signIn(sb, COPY.mismatch);
      return;
    }
    clear();
    if (!isEmailShaped(email)) {
      setFlag("email");
      setAlert(COPY.malformed);
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFlag("password");
      setRefusal(COPY.tooShort);
      return;
    }
    setBusy(true);
    try {
      // Ruling 384: no name is collected here, so none is written. Onboarding screen one is the
      // one place a member's name is set (307, 469).
      const signUp = sb.auth.signUp({
        email,
        password,
        // Ruling 432 (U-A1): no display name here; onboarding screen one asks for it (ruling 307).
        options: { emailRedirectTo: window.location.origin + "/feed" },
      });
      // Ruling 234: the state is identical whether or not the address already has an account, so
      // it reveals on a fixed delay and never on the shape of the answer. Only a password the
      // server refuses outright pulls the member back to the form.
      const [{ error }] = await Promise.all([signUp, delay(REVEAL_MS)]);
      if (error) {
        // Ruling 414: every password refusal is named by its real reason. Anything that is not a
        // password fault keeps the anti-enumeration state below (ruling 234).
        const fault = passwordFault(error);
        if (fault !== "other" || /password/i.test(error.message || "")) {
          setFlag("password");
          setRefusal(passwordFaultCopy(fault));
          return;
        }
        // Ruling 496: the page could not create the account, and nothing typed is lost.
        setAlert(COPY.signUpFailed);
        return;
      }
      setSent(email);
    } finally {
      setBusy(false);
    }
  };

  if (sent !== null)
    return (
      <CheckEmail
        heading="Check your email"
        body={`We sent a confirmation link to ${sent}. Open it to finish creating your account. It works once and for one hour.`}
        small="Nothing arrived after a few minutes? Check the address above and your spam folder."
        onUseDifferent={() => {
          setSent(null);
          setPassword("");
        }}
        // Ruling 412 (B10 item 4), verbatim: the second act becomes the footer's linked sentence.
        footer={
          <FooterLink
            before="If you already have an account,"
            link="sign in"
            after=" instead."
            onClick={() => {
              setSent(null);
              setMode("in");
              setPassword("");
            }}
          />
        }
      />
    );

  const up = mode === "up";

  return (
    <AuthPage
      heading={up ? "Create your account" : "Sign in"}
      {...(up ? { lead: COPY.signUpLead } : {})}
      footer={
        <FooterLink
          before={up ? "Already a member?" : "New here?"}
          link={up ? "Sign in" : "Create an account"}
          onClick={() => {
            clear();
            setMode(up ? "in" : "up");
          }}
        />
      }
    >
      <SignInForm
        form={form}
        onSubmit={(e) => void submit(e)}
        pending={waitingFor !== null}
        passwordAutoComplete={up ? "new-password" : "current-password"}
        {...(up ? { passwordHint: COPY.passwordHint } : {})}
        submitLabel={up ? "Create account" : "Sign in"}
        busyLabel={up ? "Creating your account" : "Signing in"}
        forgot={
          // Sign-in additions, in DOM order after the Password field (handoff section 1): the link
          // first, left-aligned under the field; the separator and the provider buttons after the
          // submit, which is where sign-up carries them too.
          !up && (
            <button
              type="button"
              data-testid="forgot-password"
              onClick={() => void navigate({ to: "/reset" })}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                minHeight: "var(--target-primary)",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--ink-2)",
              }}
            >
              Forgot your password?
            </button>
          )
        }
      >
        <OrSeparator />
        <ProviderButtons
          waitingFor={waitingFor}
          disabled={form.busy || waitingFor !== null}
          onStart={(p) => void onProvider(p)}
        />
      </SignInForm>
    </AuthPage>
  );
}
