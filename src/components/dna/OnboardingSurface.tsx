// Brief 5, onboarding: the three screens built to onboarding/SPEC.md (approved at ruling 330,
// complete under 331). Every string below is the SPEC's, verbatim (section 3), and no screen
// carries a numeral, a step counter, a progress signal or a deadline (rulings 308, 309). The
// anonymous auth layout is 4B's (section 2): no AppHeader, no PulseDock, no rail.
//
// What this file does not do: filter anything client-side. The gate in the root route decides the
// screen from onboarding_state(); each screen writes once through src/lib/onboarding.ts and then
// navigates. Nothing follows screen three but the Feed (ruling 259).
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/strand/Avatar";
import { Button } from "@/components/strand/Button";
import { Icon } from "@/components/strand/Icon";
import { Input } from "@/components/strand/Input";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { AuthColumn, AuthHead } from "@/components/dna/AuthHead";
import type { Stance } from "@/components/dna/StanceBlock";
import { AuthAlert, useHeadingFocus } from "@/components/dna/AuthSurface";
import {
  deriveUsername,
  emitExplainerOpened,
  isResumedSession,
  onboardingPhotoUrl,
  uploadOnboardingPhoto,
  usernameRefusals,
  usernameValid,
  USERNAME_REFUSAL,
  type OnboardingState,
} from "@/lib/onboarding";
import { useRecordOnChange } from "@/lib/record-hooks";
import { getSupabase } from "@/lib/supabase";
import { useTier, type Tier } from "@/lib/tier";

// ---------------------------------------------------------------------------
// Copy, verbatim (SPEC section 3).
// ---------------------------------------------------------------------------
export const COPY = {
  who: {
    heading: "Welcome to the Diaspora Network of Africa.",
    lead: "Your name, a username and a photo to begin. Where you are, and your relationship to the continent, come next.",
    nameLabel: "Your name",
    nameHint: "As you'd like to be known here.",
    usernameLabel: "Username",
    // Ruling 411: the hint names no count of changes. The two-changes policy stands and is
    // delivered by User Settings (37).
    usernameHint: "We'll suggest one from your name. Pick one you'll keep.",
    photoLabel: "Photo",
    photoAdd: "Add a photo",
    photoChange: "Change photo",
    photoRemove: "Remove",
    photoTooLarge: "That photo is too large. Choose a smaller one and try again.",
    photoFailed:
      "We couldn't add that photo just now. Nothing else you entered is lost. Try again.",
    usernameTaken: "That username is taken. Choose another, or keep the one we suggest.",
    // Ruling 496 (B9 item 4), verbatim: three reasons, each in the field's own line. Continue never
    // disables silently; it submits and the field says why (434).
    usernameCharset: "Usernames use a to z, 0 to 9 and hyphens. Remove the accents and try again.",
    usernameShort: "Usernames are at least three characters.",
    usernameHyphen: "Usernames cannot start or end with a hyphen.",
    continue: "Continue",
  },
  where: {
    heading: "Where are you right now?",
    lead: "The city and country you're living in today. This helps people near you, and people from where you are, find you.",
    cityLabel: "City",
    countryLabel: "Country",
    countryEmpty: "Select a country",
    continue: "Continue",
    back: "Back",
  },
  relationship: {
    heading: "What's your relationship to the continent right now?",
    lead: "There's no wrong answer here, and nothing is permanent. Choose what feels closest to where you are today.",
    chosen: "You're marked as still exploring for now. Change it below if something fits better.",
    footer: "You can change this whenever you like. It's meant to move as you do.",
    explainer: "What these mean, and why we ask",
    finish: "Finish",
    back: "Back",
  },
  resumeLead: "Welcome back. Let's pick up where you left off.",
  saveFailed: "We couldn't save that just now. Nothing you entered is lost. Try again.",
} as const;

/** The five cards (rulings 300, 331), in this order. Title, body, label. */
export const STANCE_CARDS: { value: Stance; title: string; body: string; label: string }[] = [
  {
    value: "returnee",
    title: "Returnee",
    body: "You're of the African Diaspora and you're moving toward the continent in some way. That might be visiting more often, investing, building something, relocating one day, or simply keeping the door open. Return looks different for everyone, and all of it counts.",
    label: "I am a Returnee",
  },
  {
    value: "kin",
    title: "Kin",
    body: "You're of the African Diaspora and return isn't your path, and that's completely alright. You're here for the people, the culture, the ideas and the work. Connection matters on its own terms, and you belong here without needing a plan.",
    label: "I am Kin",
  },
  {
    value: "anchor",
    title: "Anchor",
    body: "You're on the continent, living and rooted there. You might have been born there or found your way back, you might be building something or teaching, studying, creating, raising a family. What matters is that you're present, and that when the Diaspora reaches toward this work, you're who they reach.",
    label: "I am an Anchor",
  },
  {
    value: "ally",
    title: "Ally",
    body: "You're not of the Diaspora, and you're choosing to show up anyway. What you bring might be capital, expertise, networks, time or advocacy, and it strengthens the work. You walk alongside. You support and partner. You don't represent.",
    label: "I am an Ally",
  },
  {
    value: "exploring",
    title: "Still exploring",
    body: "You've arrived and you're not ready to name where you fit yet, which is honestly the most reasonable place to start. Take your time, look around, and choose when it feels right. Nothing here is waiting on you.",
    label: "I'm still exploring",
  },
];

/** The explainer sheet (SPEC section 7), verbatim. */
export const EXPLAINER = {
  h2: "What these mean, and why we ask",
  lead: "DNA connects people across the African Diaspora and the continent, and the way it finds people for you starts here. Your answer shapes who you're suggested to, and who sees you when they search by relationship. It never ranks you, and no one is ever shown a score.",
  meanKicker: "What the five mean",
  mean: [
    "Returnee and Kin are both of the Diaspora. The difference is direction, not belonging. A Returnee is moving toward the continent in some way; Kin has chosen a different path and is here for the people, the culture and the work.",
    "An Anchor is on the continent, born there or returned and rooted. They are who the Diaspora reaches.",
    "An Ally is not of the Diaspora and chooses to contribute. They walk alongside.",
    "Still exploring is a real answer, and most people start there.",
  ],
  changesKicker: "What changes when you choose",
  changes: [
    {
      term: "Returnee",
      body: "DNA points you toward Anchors on the continent and members building in the same direction, at whatever pace suits the life you have. You surface when someone looks for people facing the continent.",
    },
    {
      term: "Kin",
      body: "DNA looks for people rather than plans: members who share your city, your heritage or your work, wherever they sit. Nothing assumes you are moving, and nothing asks you about it again.",
    },
    {
      term: "Anchor",
      body: "You become reachable to a Diaspora looking for partners on the ground, in your city and your field. Intros, Space invitations and event asks tend to arrive here first, because you are who they reach.",
    },
    {
      term: "Ally",
      body: "DNA matches what you bring to the Needs and Spaces that asked for it. You are never put in front of the Diaspora as one of them. You walk alongside, and the distinction holds everywhere it matters.",
    },
    {
      term: "Still exploring",
      body: "Nothing narrows. You are suggested broadly and you see the whole network while you look around. DNA records that you have not answered yet, not that you answered no.",
    },
  ],
  returnTitle: "The Return",
  returnBody:
    "The Return is DNA's name for the movement of the Diaspora back toward the continent, in every form it takes: visits, investment, building, relocation, advocacy. You don't have to be part of it to be part of DNA.",
  close:
    "You can change your answer whenever you like, and changing it changes nothing about what you've already done here.",
  done: "Got it",
} as const;

// ---------------------------------------------------------------------------
// The frame (SPEC section 2): logo, heading, lead, then the screen's own content.
// ---------------------------------------------------------------------------
const LEAD: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.5,
  color: "var(--ink-2)",
  margin: 0,
  textAlign: "center",
};

export function OnboardingFrame({
  screen,
  heading,
  lead,
  children,
}: {
  screen: "who" | "where" | "relationship";
  heading: string;
  lead: string;
  children: ReactNode;
}) {
  const headingRef = useHeadingFocus(screen);
  // 12C part 2 (1615): each screen's first render in a load, for the viewing funnel; the lever's
  // Started and drop-off come from members, never from this row.
  useRecordOnChange("onboarding_step_viewed", screen, { step: screen });
  return (
    <AuthColumn
      data-testid={"onboarding-" + screen}
      // Ruling 413 (B9 item 1): a Sign out text link in the footer of every onboarding screen.
      footer={<OnboardingSignOut />}
    >
      <main aria-label={heading} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* B9 item 5 with rulings 377, 390, 491: the same head as auth. The logo drops from 80 to
            48/56, top-aligned in the fixed band, so it never moves because the screen under it
            grew. Onboarding holds the top and never centres vertically (487). It sits inside the
            landmark so the landmark's own name and its first heading are the same words. */}
        <AuthHead
          heading={heading}
          lead={
            <span data-testid="onboarding-lead">{isResumedSession() ? COPY.resumeLead : lead}</span>
          }
          headingRef={headingRef}
        />
        {children}
      </main>
    </AuthColumn>
  );
}

/** Ruling 413: 44 tall, --ink-2, underlined, offset 3. A link, not a button. */
function OnboardingSignOut() {
  return (
    <button
      type="button"
      data-testid="onboarding-sign-out"
      onClick={() => void getSupabase()?.auth.signOut()}
      style={{
        all: "unset",
        cursor: "pointer",
        alignSelf: "center",
        display: "inline-flex",
        alignItems: "center",
        minHeight: "var(--target-primary)",
        fontSize: 15,
        fontWeight: 500,
        color: "var(--ink-2)",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      Sign out
    </button>
  );
}

/** Back (SPEC section 2): after the primary control, never before the heading. */
function BackButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Button type="button" variant="ghost" data-testid="back" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Screen one: who you are (SPEC section 4).
// ---------------------------------------------------------------------------
export type WhoSubmit = (input: {
  name: string;
  username: string;
  avatarPath: string;
}) => Promise<"ok" | "taken" | "failed">;

export function WhoScreen({ state, onSubmit }: { state: OnboardingState; onSubmit: WhoSubmit }) {
  const tier = useTier();
  // B9 item 2, ruling 469: the field starts empty and is never derived from the email local part.
  // A member who has already written screen one and come back still sees what they wrote.
  const [name, setName] = useState(state.who.completed ? state.who.name : "");
  // The suggestion fills the field until the member types in it; typing replaces it (section 4).
  // B9 item 2, ruling 469: with the name field starting empty the suggestion has nothing to derive
  // from yet, so it starts empty too and follows the name as the member types it. Deriving it from
  // the server's stored name would carry the email local part in through the back door.
  const [usernameTyped, setUsernameTyped] = useState(state.who.completed);
  const [username, setUsername] = useState(state.who.completed ? (state.who.username ?? "") : "");
  const [photoPath, setPhotoPath] = useState<string | null>(state.who.avatar_path);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  /** Ruling 434 (B9 item 4): the reason a username was refused, in the field's own line. */
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // The object URL last handed to the preview, revoked whenever it is replaced so a rapid re-pick
  // does not leak. A resume-loaded signed URL is not an object URL and is left alone.
  const objectUrlRef = useRef<string | null>(null);

  // Resume: the saved photo renders in its chosen state.
  useEffect(() => {
    let live = true;
    if (state.who.avatar_path)
      void onboardingPhotoUrl(state.who.avatar_path).then((u) => {
        if (live && u) setPhotoUrl(u);
      });
    return () => {
      live = false;
    };
  }, [state.who.avatar_path]);

  // Revoke a preview object URL still held when the screen unmounts.
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const onName = (v: string) => {
    setName(v);
    if (!usernameTyped) setUsername(deriveUsername(v));
  };
  const onUsername = (v: string) => {
    setUsernameTyped(true);
    // The server lowercases (ruling 334); doing it here means a capital is never a refusal.
    setUsername(v.toLowerCase());
    setTaken(false);
  };
  // Ruling 434: the reasons this username is refused, each rendered on its own line below the
  // field, so Continue disables only with a visible reason (W17, U-O2).
  const refusals = usernameRefusals(username.trim());

  const showPreview = (url: string | undefined) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url && url.startsWith("blob:") ? url : null;
    setPhotoUrl(url);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setAlert(null);
    setUploading(true);
    try {
      const out = await uploadOnboardingPhoto(file);
      if (!out.ok) {
        setAlert(out.reason === "too_large" ? COPY.who.photoTooLarge : COPY.who.photoFailed);
        return;
      }
      setPhotoPath(out.path);
      showPreview(out.previewUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /**
   * Ruling 434 (B9 item 4): Continue never disables silently. `ready` gates on the three things the
   * screen asks for and never on whether the username will do, so a username that will not do is
   * refused in words under the field rather than by a dead button nobody can interrogate. The photo
   * gate (324) still holds Continue, because the screen says so.
   */
  const ready = name.trim().length > 0 && username.trim().length > 0 && !!photoPath;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy || !photoPath) return;
    setAlert(null);
    setTaken(false);
    if (refusals.length > 0) return;
    setBusy(true);
    try {
      const r = await onSubmit({
        name: name.trim(),
        username: username.trim(),
        avatarPath: photoPath,
      });
      // Ruling 434: taken is a reason like any other, so it joins the lines under the field
      // rather than the alert block at the top of the screen.
      if (r === "taken") setTaken(true);
      else if (r === "failed") setAlert(COPY.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const size = tier === "compact" ? 96 : 120;
  const disabled = busy || uploading;
  return (
    <OnboardingFrame screen="who" heading={COPY.who.heading} lead={COPY.who.lead}>
      {alert && <AuthAlert>{alert}</AuthAlert>}
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        aria-busy={disabled}
        data-testid="who-form"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <Input
          label={COPY.who.nameLabel}
          hint={COPY.who.nameHint}
          value={name}
          onChange={(e) => onName((e.target as HTMLInputElement).value)}
          autoComplete="name"
          disabled={disabled}
          data-testid="name"
          required
        />
        <Input
          label={COPY.who.usernameLabel}
          hint={COPY.who.usernameHint}
          error={taken || refusals.length > 0}
          value={username}
          onChange={(e) => onUsername((e.target as HTMLInputElement).value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          data-testid="username"
          required
        />
        {(refusals.length > 0 || taken) && (
          <div
            role="status"
            data-testid="username-refusals"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: -16,
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--error)",
            }}
          >
            {refusals.map((r) => (
              <span key={r}>{USERNAME_REFUSAL[r]}</span>
            ))}
            {taken && <span>{COPY.who.usernameTaken}</span>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>
            {COPY.who.photoLabel}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {/* Ruling 330: Strand's Avatar at the profile's portrait sizes on the 4px --bg plate. */}
            <div
              data-testid="photo-plate"
              data-state={photoUrl ? "chosen" : "empty"}
              style={{ padding: 4, background: "var(--bg)", borderRadius: 22, flex: "none" }}
            >
              {photoUrl ? (
                <Avatar name={name} src={photoUrl} size={size} style={{ borderRadius: 18 }} />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: size,
                    height: size,
                    borderRadius: 18,
                    background: "var(--bg-sunken)",
                    color: "var(--ink-3)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="camera" size={24} />
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              data-testid="photo-input"
              style={{ display: "none" }}
              onChange={(e) => void pick(e.target.files?.[0])}
              disabled={disabled}
            />
            {photoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="photo-change"
                  disabled={disabled}
                  onClick={() => fileRef.current?.click()}
                >
                  {COPY.who.photoChange}
                </Button>
                <button
                  type="button"
                  data-testid="photo-remove"
                  disabled={disabled}
                  onClick={() => {
                    setPhotoPath(null);
                    showPreview(undefined);
                  }}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                  }}
                >
                  {COPY.who.photoRemove}
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                data-testid="photo-add"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
              >
                {COPY.who.photoAdd}
              </Button>
            )}
          </div>
        </div>
        <Button type="submit" full data-testid="continue" disabled={!ready || disabled}>
          {COPY.who.continue}
        </Button>
      </form>
    </OnboardingFrame>
  );
}

// ---------------------------------------------------------------------------
// Screen two: where you are (SPEC section 5).
// ---------------------------------------------------------------------------
export type WhereSubmit = (input: { city: string; country: string }) => Promise<"ok" | "failed">;

export function WhereScreen({
  state,
  world,
  onSubmit,
  onBack,
}: {
  state: OnboardingState;
  /** Ruling 242's world list, from vocabularies(); empty while it loads or if it did not. */
  world: string[];
  onSubmit: WhereSubmit;
  onBack: () => void;
}) {
  const [city, setCity] = useState(state.where.city ?? "");
  const [country, setCountry] = useState(state.where.country ?? "");
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = city.trim().length > 0 && country.length > 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setAlert(null);
    setBusy(true);
    try {
      const r = await onSubmit({ city: city.trim(), country });
      if (r === "failed") setAlert(COPY.saveFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <OnboardingFrame screen="where" heading={COPY.where.heading} lead={COPY.where.lead}>
      {alert && <AuthAlert>{alert}</AuthAlert>}
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        aria-busy={busy}
        data-testid="where-form"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <Input
          label={COPY.where.cityLabel}
          value={city}
          onChange={(e) => setCity((e.target as HTMLInputElement).value)}
          autoComplete="address-level2"
          disabled={busy}
          data-testid="city"
          required
        />
        <Select
          label={COPY.where.countryLabel}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={busy}
          data-testid="country"
          options={[
            { value: "", label: COPY.where.countryEmpty },
            ...world.map((v) => ({ value: v, label: v })),
          ]}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Button type="submit" full data-testid="continue" disabled={!ready || busy}>
            {COPY.where.continue}
          </Button>
          <BackButton onClick={onBack} disabled={busy} label={COPY.where.back} />
        </div>
      </form>
    </OnboardingFrame>
  );
}

// ---------------------------------------------------------------------------
// Screen three: relationship to the continent (SPEC section 6).
// ---------------------------------------------------------------------------
export type RelationshipSubmit = (input: {
  stance: Stance;
  touched: boolean;
  elapsedMs: number;
}) => Promise<"ok" | "failed">;

function cardBleed(tier: Tier): CSSProperties {
  if (tier !== "expanded") return { display: "flex", flexDirection: "column", gap: 12 };
  // Ruling 320: one row of five where all five fit, out of the 400 column to 1200 (40 inset each
  // side of the 1280 frame); equal heights; no horizontal scroll at any width.
  return {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    width: "min(1200px, calc(100vw - 80px))",
    marginLeft: "calc(50% - min(600px, 50vw - 40px))",
    alignItems: "stretch",
  };
}

function StanceCard({
  card,
  checked,
  focusable,
  disabled,
  onSelect,
  onKey,
  cardRef,
}: {
  card: (typeof STANCE_CARDS)[number];
  checked: boolean;
  focusable: boolean;
  disabled: boolean;
  onSelect: () => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={card.title}
      tabIndex={focusable ? 0 : -1}
      data-testid={"stance-card-" + card.value}
      data-checked={checked ? "1" : "0"}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={onKey}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-l)",
        border: checked ? "1.5px solid var(--ink)" : "1px solid var(--line)",
        padding: checked ? "19.5px 18.5px" : "20px 19px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: disabled ? "default" : "pointer",
        outline: "none",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "flex",
            color: checked ? "var(--c-connect)" : "var(--ink-3)",
            flex: "none",
          }}
        >
          <Icon name={checked ? "circle-dot" : "circle"} size={22} />
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {card.title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--ink-2)" }}>
        {card.body}
      </p>
      <span
        style={{
          marginTop: "auto",
          fontSize: 15,
          fontWeight: checked ? 700 : 500,
          color: checked ? "var(--ink)" : "var(--ink-3)",
        }}
      >
        {card.label}
      </span>
    </div>
  );
}

export function RelationshipScreen({
  state,
  onSubmit,
  onBack,
}: {
  state: OnboardingState;
  onSubmit: RelationshipSubmit;
  onBack: () => void;
}) {
  const tier = useTier();
  const headingText = COPY.relationship.heading;
  const [stance, setStance] = useState<Stance>(state.relationship.stance);
  // SPEC section 6: set by any selection, including re-selecting the default, never by opening
  // the explainer. The chosen line hides the moment it turns true and never returns (ruling 329).
  const [touched, setTouched] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [explainer, setExplainer] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mountedAt = useRef(Date.now());

  const select = (i: number, focus: boolean) => {
    const card = STANCE_CARDS[i];
    if (!card) return;
    setStance(card.value);
    setTouched(true);
    if (focus) cardRefs.current[i]?.focus();
  };
  const onKey = (i: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (busy) return;
    const n = STANCE_CARDS.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select((i + 1) % n, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select((i - 1 + n) % n, true);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(i, false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAlert(null);
    setBusy(true);
    try {
      const r = await onSubmit({ stance, touched, elapsedMs: Date.now() - mountedAt.current });
      if (r === "failed") setAlert(COPY.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const checkedIndex = STANCE_CARDS.findIndex((c) => c.value === stance);
  return (
    <OnboardingFrame screen="relationship" heading={headingText} lead={COPY.relationship.lead}>
      {!touched && (
        <div
          role="status"
          data-testid="chosen-line"
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--ink)",
            textAlign: "center",
            padding: "10px 14px",
            borderRadius: "var(--radius-m)",
            background: "var(--bg-sunken)",
          }}
        >
          {COPY.relationship.chosen}
        </div>
      )}
      {alert && <AuthAlert>{alert}</AuthAlert>}
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        aria-busy={busy}
        data-testid="relationship-form"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <div
          role="radiogroup"
          aria-label={headingText}
          data-testid="stance-cards"
          style={cardBleed(tier)}
        >
          {STANCE_CARDS.map((card, i) => (
            <StanceCard
              key={card.value}
              card={card}
              checked={i === checkedIndex}
              focusable={i === checkedIndex}
              disabled={busy}
              onSelect={() => select(i, false)}
              onKey={onKey(i)}
              cardRef={(el) => {
                cardRefs.current[i] = el;
              }}
            />
          ))}
        </div>
        <p style={LEAD} data-testid="stance-footer">
          {COPY.relationship.footer}
        </p>
        <button
          type="button"
          data-testid="explainer-link"
          disabled={busy}
          onClick={() => {
            setExplainer(true);
            emitExplainerOpened(stance);
          }}
          style={{
            all: "unset",
            cursor: "pointer",
            alignSelf: "center",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--ink)",
            textDecoration: "underline",
          }}
        >
          {COPY.relationship.explainer}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Button type="submit" full data-testid="finish" disabled={busy}>
            {COPY.relationship.finish}
          </Button>
          <BackButton onClick={onBack} disabled={busy} label={COPY.relationship.back} />
        </div>
      </form>
      <ExplainerSheet
        open={explainer}
        tier={tier}
        // Ruling 222's return to the link is the Sheet's, not a copy here: it restores to whatever
        // held focus when the sheet opened, and only once the top layer has actually gone.
        onClose={() => setExplainer(false)}
      />
    </OnboardingFrame>
  );
}

// ---------------------------------------------------------------------------
// The explainer sheet (SPEC section 7; rulings 222, 248, 321).
// ---------------------------------------------------------------------------
export function ExplainerSheet({
  open,
  tier,
  onClose,
}: {
  open: boolean;
  tier: Tier;
  onClose: () => void;
}) {
  const compact = tier === "compact";
  // Ruling 222's focus-on-open and its Tab trap are the Sheet's. A second copy here raced it: the
  // Sheet focuses on a frame and this focused on a 30ms timer, so whichever landed last won, and on
  // WebKit (whose rAF inside a freshly opened dialog runs later than 30ms) that was the Sheet's
  // fallback control rather than the heading. data-sheet-heading is the whole wiring now.

  const para: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" };
  const kicker: CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ink-3)",
  };
  const done = (
    <Button
      type="button"
      data-testid="explainer-done"
      onClick={onClose}
      full={compact}
      style={compact ? undefined : { maxWidth: 280 }}
    >
      {EXPLAINER.done}
    </Button>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant={compact ? "sheet" : "drawer"}
      // Ruling 492: 80 percent tall on compact, 40 percent wide above; the Sheet holds both.
      label={EXPLAINER.h2}
    >
      <div
        data-testid="explainer-sheet"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: compact ? "20px 20px 8px" : "40px 32px 16px",
          }}
        >
          <div
            style={{
              maxWidth: compact ? undefined : 620,
              margin: compact ? undefined : "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 28,
            }}
          >
            <h2
              data-sheet-heading
              tabIndex={-1}
              data-testid="explainer-h2"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                lineHeight: 1.2,
                fontWeight: 600,
                color: "var(--ink)",
                margin: 0,
                outline: "none",
              }}
            >
              {EXPLAINER.h2}
            </h2>
            <p style={para}>{EXPLAINER.lead}</p>
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={kicker}>{EXPLAINER.meanKicker}</p>
              {EXPLAINER.mean.map((t) => (
                <p key={t.slice(0, 24)} style={para}>
                  {t}
                </p>
              ))}
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <p style={{ ...kicker, marginBottom: 4 }}>{EXPLAINER.changesKicker}</p>
              {EXPLAINER.changes.map((row) => (
                <div
                  key={row.term}
                  style={{
                    display: "grid",
                    gridTemplateColumns: compact ? "1fr" : "132px 1fr",
                    gap: compact ? 4 : 12,
                    borderTop: "1px solid var(--line)",
                    padding: "12px 0",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 19,
                      lineHeight: 1.25,
                      color: "var(--ink)",
                    }}
                  >
                    {row.term}
                  </span>
                  <span style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    {row.body}
                  </span>
                </div>
              ))}
            </section>
            <section
              style={{
                background: "var(--bg-sunken)",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 19,
                  lineHeight: 1.25,
                  color: "var(--ink)",
                }}
              >
                {EXPLAINER.returnTitle}
              </span>
              <p style={para}>{EXPLAINER.returnBody}</p>
            </section>
            <p style={para}>{EXPLAINER.close}</p>
            {!compact && <div style={{ marginBottom: 24 }}>{done}</div>}
          </div>
        </div>
        {compact && (
          <div
            style={{ flex: "none", padding: "12px 20px 20px", borderTop: "1px solid var(--line)" }}
          >
            {done}
          </div>
        )}
      </div>
    </Sheet>
  );
}
