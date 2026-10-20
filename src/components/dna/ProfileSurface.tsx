// The member profile (Brief 3, B3-Profile-v3 SPEC.md, rulings 122 to 136). One component renders
// the three views (owner, visitor, public) plus the Edit profile mode from the one read projection
// (lib/profile.ts, profile_view): the server decides what the viewer sees; this file only renders
// what arrived. Sections save alone through save_profile_section; drafts are per section, never one
// profile-wide form (ruling 126). Masthead: one ProfileHeader for every view (ruling 136), locked
// and condensing past 120px of the column's scroll (ruling 134), exempt in edit mode.
//
// Brief 4A adds the block control to the Visitor action row and nothing else: one overflow item and
// one confirm sheet, in ProfileBlockControl. Ruling 275, under 212: the masthead carries no origin,
// no current place, no stance label and no local time line, on any view and for any viewer, so
// ProfileHeader no longer takes those props and nothing here composes them.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Audience } from "@/components/strand/AudienceSelect";
import { Avatar } from "@/components/strand/Avatar";
import { BadgeRow } from "@/components/strand/BadgeRow";
import { Button } from "@/components/strand/Button";
import { CCard } from "@/components/dna/CCard";
import { Chip } from "@/components/strand/Chip";
import { CSheetBody } from "@/components/dna/CSheetBody";
import { EmptyState } from "@/components/strand/EmptyState";
import { Icon } from "@/components/strand/Icon";
import { IconButton } from "@/components/strand/IconButton";
import { Input } from "@/components/strand/Input";
import { LinkRow } from "@/components/dna/LinkRow";
import { PatternPicker } from "@/components/dna/PatternPicker";
import { ProfileHeader } from "@/components/strand/ProfileHeader";
import type { MastheadPattern } from "@/components/dna/PatternPicker";
import { RailWidget } from "@/components/strand/RailWidget";
import { BackRow } from "@/components/dna/BackRow";
import { SectionCard } from "@/components/dna/SectionCard";
import { StanceBlock, type Stance, type StanceData } from "@/components/dna/StanceBlock";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { Switch } from "@/components/strand/Switch";
import { Toast } from "@/components/strand/Toast";
import { VisibilitySelect } from "@/components/dna/VisibilitySelect";
import { VocabularyPicker } from "@/components/dna/VocabularyPicker";
import { assetBase, C_LABEL, C_ORDER, type C } from "@/components/strand/cmeta";
import { ProfileBlockControl } from "@/components/dna/ProfileBlockControl";
import { toastStyle } from "@/components/dna/FeedSurface";
import { IntroSheet } from "@/components/dna/IntroSheet";
import { MessageRequestSheet } from "@/components/dna/MessageRequestSheet";
import { openOneToOne, refusalOf, requestSend } from "@/lib/messenger";
import { useAuth } from "@/lib/auth";
import { sendIntroduction } from "@/lib/connect";
import { blockMember, unblockMember } from "@/lib/blocks";
import { openComposer } from "@/lib/composer-store";
import type { Json } from "@/lib/database.types";
import {
  loadProfile,
  loadPublicAttestations,
  respondRequest,
  saveSection,
  SECTION_TITLES,
  setFollow,
  uploadProfileImage,
  withdrawRequest,
  type ActivityC,
  type ProfileView,
  type SectionKey,
  type StanceFields,
} from "@/lib/profile";
import { whenShort } from "@/lib/when";
import { setRail } from "@/lib/rail-store";
import { useEmptyStateSeen, useRecordOnChange } from "@/lib/record-hooks";
import { useTier } from "@/lib/tier";
import { loadVocabularies, type Vocabularies } from "@/lib/vocabularies";

// 1892, 1902: the 1A wordmark in --ink in both themes. The span paints --ink through the file as a
// mask; the hidden img of the same file at the mark's height gives the span its width from the
// file's own ratio, so no ratio is written here (184: size by height, width auto).
const WORDMARK = assetBase() + "wordmark-mono.svg";
const WORDMARK_MASK = `url("${WORDMARK}") center / contain no-repeat`;

const CONDENSE_PX = 120;
// Once condensed, the masthead expands again only near the top. The condensed row is some 250px
// shorter than the hero, so on a browser without scroll anchoring (Safari) the content under the
// finger moves up by that much the moment it condenses; a single threshold would then flip the
// state back and forth around 120px. The release point sits below the collapse point instead.
const RELEASE_PX = 24;
const EDITABLE = [
  "core",
  "about",
  "stance",
  "origin",
  "where",
  "work",
  "skills",
  "languages",
  "intent",
  "links",
] as const;
type EditableId = (typeof EDITABLE)[number];
type FieldId = Exclude<EditableId, "core" | "stance">;

type FieldSpec = {
  k: string;
  label: string;
  kind: "text" | "select" | "vocab";
  options?: string[] | undefined;
  max?: number | undefined;
  maxLength?: number | undefined;
  multiline?: boolean | undefined;
  hint?: string | undefined;
  clamp?: boolean | undefined;
};
type SectionSpec = {
  id: FieldId;
  title: string;
  fields: FieldSpec[];
  emptyLine: string;
  act: string;
};

type Draft = Record<string, string | string[] | undefined>;
type StanceDraft = { stance: Stance; variants: Partial<Record<Stance, StanceFields>> };
type Drafts = Partial<Record<FieldId, Draft>> & {
  core?: { name: string; headline: string };
  stance?: StanceDraft;
};

const ACT: Record<ActivityC, [string, string, string]> = {
  convene: ["Convene", "Convenings attested", "Host or attend a convening"],
  collaborate: ["Collaborate", "Spaces and roles", "Start or join a Space"],
  contribute: ["Contribute", "Contributions fulfilled", "Post or fulfil a Need"],
  convey: ["Convey", "Stories authored", "Share a Story"],
};
const AUD_LABEL: Record<Audience, string> = {
  everyone: "Everyone on DNA",
  connections: "My connections",
  anchored: "Anchored",
};
// Ruling 397: the section is labelled Stance, never Segment. The titles live in src/lib/profile.ts
// since handoff 61-S1, where the Account drawer's Privacy panel reads the same list.
const TITLES = SECTION_TITLES;

function specs(v: Vocabularies | null): SectionSpec[] {
  const V = v ?? {
    focus: [],
    industries: [],
    regions: [],
    skills: [],
    languages: [],
    intent: [],
    interests: [],
    countries: [],
    world: [],
    heritage: [],
    pathway: [],
    timeline: [],
  };
  return [
    {
      id: "about",
      title: "About",
      fields: [
        { k: "about", label: "About", kind: "text", multiline: true, maxLength: 500, clamp: true },
      ],
      emptyLine: "A short paragraph in your own words. The only free text on the page.",
      act: "Write about yourself",
    },
    {
      id: "origin",
      title: "Origin and heritage",
      fields: [
        { k: "origin_country", label: "Country of origin", kind: "select", options: V.countries },
        { k: "heritage", label: "Heritage", kind: "select", options: V.heritage },
        { k: "pathway", label: "Return pathway", kind: "select", options: V.pathway },
      ],
      emptyLine: "Where your family is from and how you relate to return.",
      act: "Add origin and heritage",
    },
    {
      id: "where",
      title: "Where I am",
      fields: [
        // Ruling 142: the country comes from the world list; origin keeps the African list.
        { k: "current_country", label: "Current country", kind: "select", options: V.world },
        {
          k: "current_place",
          label: "Current location",
          kind: "text",
          hint: "City and time zone, written out. Nairobi, EAT.",
        },
      ],
      emptyLine: "The country and city you are in now.",
      act: "Add where I am",
    },
    {
      id: "work",
      title: "What I work on",
      fields: [
        { k: "focus", label: "Focus areas", kind: "vocab", options: V.focus, max: 3 },
        { k: "industries", label: "Industries", kind: "vocab", options: V.industries, max: 3 },
        { k: "regions", label: "Regional expertise", kind: "vocab", options: V.regions, max: 3 },
      ],
      emptyLine: "Focus areas, industries and regions you know. These are how members find you.",
      act: "Add what I work on",
    },
    {
      id: "skills",
      title: "Skills",
      fields: [{ k: "skills", label: "Skills", kind: "vocab", options: V.skills, max: 5 }],
      emptyLine: "Skills you can bring to a Space or a Need.",
      act: "Add skills",
    },
    {
      id: "languages",
      title: "Languages",
      fields: [{ k: "languages", label: "Languages", kind: "vocab", options: V.languages, max: 6 }],
      emptyLine: "Languages you work in.",
      act: "Add languages",
    },
    {
      id: "intent",
      title: "What I am here for",
      fields: [
        { k: "intent", label: "Intent", kind: "vocab", options: V.intent, max: 3 },
        {
          k: "note",
          label: "In a sentence",
          kind: "text",
          multiline: true,
          hint: "Optional.",
          maxLength: 200,
        },
      ],
      emptyLine: "What you want from the platform, so members know how to help.",
      act: "Add what I am here for",
    },
    {
      id: "links",
      title: "Links",
      fields: [
        { k: "website", label: "Website", kind: "text" },
        { k: "linkedin", label: "LinkedIn", kind: "text", hint: "Handle only." },
        { k: "x", label: "X", kind: "text", hint: "Handle only." },
        { k: "instagram", label: "Instagram", kind: "text", hint: "Handle only." },
      ],
      emptyLine: "Your website and the handles you want members to find.",
      act: "Add links",
    },
  ];
}

/**
 * Ruling 499: a privacy change announces itself in its own words. Composed from the audience
 * vocabulary the member just chose (VisibilitySelect's AUD), so the sentence names the state they
 * set rather than reporting that something saved.
 */
const AUDIENCE_SAID: Record<Audience, string> = {
  everyone: "This section is now open to everyone on DNA.",
  connections: "This section is now open to your connections.",
  anchored: "This section is now open to anchored members.",
};

const LINK_STYLE: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  fontSize: 15,
  fontWeight: 500,
  color: "var(--ink)",
  textDecoration: "underline",
  textDecorationColor: "var(--line-strong)",
  textUnderlineOffset: 2,
  fontFamily: "var(--font-sans)",
};

export type ProfileSurfaceProps = { handle: string; edit: boolean; asPublic: boolean };

export function ProfileSurface({ handle, edit, asPublic }: ProfileSurfaceProps) {
  const { ready, member: me, refreshMember } = useAuth();
  const tier = useTier();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const compact = tier === "compact";
  const expanded = tier === "expanded";
  const signedOut = ready && !me;
  const publicView = signedOut || asPublic;
  const queryKey = useMemo(
    () => ["profile", handle, me?.id ?? "anon", asPublic],
    [handle, me?.id, asPublic],
  );
  const profileQ = useQuery({
    queryKey,
    queryFn: () => loadProfile(handle, asPublic),
    enabled: ready,
  });
  const profile = profileQ.data ?? null;
  // 12C part 2: a profile loads. No prop and no object (1297): the company learns that profiles
  // are viewed and what follows, never who looked at whom. Keyed on the handle, so a refetch
  // records nothing and the next profile records once.
  useRecordOnChange("profile_viewed", profile ? handle : null);
  useEmptyStateSeen("profile.members_only", signedOut && profileQ.isSuccess && !profile);
  useEmptyStateSeen("profile.missing", ready && !signedOut && profileQ.isSuccess && !profile);
  const owner = !!profile && profile.viewer === "owner";
  const visitor = !!profile && profile.viewer === "member";
  const pub = !!profile && profile.viewer === "anon";
  const editMode = owner && edit;
  const vocabQ = useQuery({
    queryKey: ["profile-vocab"],
    queryFn: loadVocabularies,
    enabled: owner,
  });
  const attestQ = useQuery({
    queryKey: ["public-attestations"],
    queryFn: loadPublicAttestations,
    enabled: publicView,
  });
  // W27: a save re-reads the profile at once (refetch, not only invalidate, so a query that is
  // not mounted as active still resolves before the masthead renders again), and the shell's own
  // copy of the member (name and handle from the members row, read at sign-in) is refreshed with
  // it, so the masthead, the header and the greeting all carry the saved name and headline
  // without a reload.
  const invalidate = useCallback(async () => {
    await qc.refetchQueries({ queryKey: ["profile", handle] });
    await refreshMember();
  }, [qc, handle, refreshMember]);

  // Toast (the host controls mounting).
  const [toast, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastMsg = useCallback((t: string) => {
    setToastText(t);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(null), 2400);
  }, []);

  // Drafts: per section, never one profile-wide form (ruling 126).
  const [drafts, setDrafts] = useState<Drafts>({});
  const [aboutOpen, setAboutOpen] = useState(false);
  const [localVis, setLocalVis] = useState<Partial<Record<SectionKey, Audience>>>({});
  const vis = useMemo(
    () => ({ ...(profile?.visibility ?? {}), ...localVis }),
    [profile?.visibility, localVis],
  );
  useEffect(() => setLocalVis({}), [profile?.visibility]);

  const sectionSpecs = useMemo(() => specs(vocabQ.data ?? null), [vocabQ.data]);

  const initDraft = useCallback(
    (id: EditableId): Drafts[EditableId] => {
      if (!profile) return undefined;
      const s = profile.sections;
      if (id === "core")
        return { name: profile.member.name, headline: profile.member.headline ?? "" };
      if (id === "stance")
        return {
          stance: s.stance?.stance ?? profile.member.stance ?? "returnee",
          variants: { ...(s.stance?.variants ?? {}) },
        };
      const spec = sectionSpecs.find((x) => x.id === id);
      const src = (s[id] ?? {}) as Record<string, string | string[] | undefined>;
      const d: Draft = {};
      for (const f of spec?.fields ?? []) d[f.k] = src[f.k] ?? (f.kind === "vocab" ? [] : "");
      return d;
    },
    [profile, sectionSpecs],
  );

  const committed = useRef<Partial<Record<EditableId, string>>>({});
  const startEdit = useCallback(
    (id: EditableId) => {
      const seed = initDraft(id);
      committed.current[id] = JSON.stringify(seed);
      setDrafts((st) => (editMode ? st : ({ [id]: seed } as Drafts)));
    },
    [editMode, initDraft],
  );

  // Edit profile mode: every editable section opens at once (ruling 126), each autosaving on its
  // own as the member leaves its fields (ruling 398).
  const enteredEdit = useRef(false);
  useEffect(() => {
    if (!editMode || !profile) {
      enteredEdit.current = false;
      return;
    }
    if (enteredEdit.current) return;
    enteredEdit.current = true;
    const all: Record<string, unknown> = {};
    for (const id of EDITABLE) {
      all[id] = initDraft(id);
      committed.current[id] = JSON.stringify(all[id]);
    }
    setDrafts(all as Drafts);
  }, [editMode, profile, initDraft]);
  const enterEdit = () =>
    void navigate({ to: "/m/$handle", params: { handle }, search: { edit: true } });
  const exitEdit = () => {
    setDrafts({});
    void navigate({ to: "/m/$handle", params: { handle }, search: {} });
  };

  // Ruling 398: the section head's one quiet word, Saving then Saved then nothing, is the only
  // trace of a section write. The toast is kept for refusals and for the privacy actions (499).
  const [saveWord, setSaveWord] = useState<Partial<Record<EditableId, "saving" | "saved" | null>>>(
    {},
  );
  const wordTimers = useRef<Partial<Record<EditableId, number>>>({});
  const word = useCallback((id: EditableId, w: "saving" | "saved" | null) => {
    setSaveWord((st) => ({ ...st, [id]: w }));
    const t = wordTimers.current[id];
    if (t != null) window.clearTimeout(t);
    if (w !== "saved") return;
    wordTimers.current[id] = window.setTimeout(
      () => setSaveWord((st) => ({ ...st, [id]: null })),
      2400,
    );
  }, []);

  const saveMut = useMutation({
    mutationFn: async ({
      id,
      section,
      payload,
    }: {
      id: EditableId;
      section: string;
      payload: Record<string, Json | undefined>;
    }) => {
      word(id, "saving");
      await saveSection(section, payload);
      return id;
    },
    onSuccess: async (id) => {
      // Ruling 398: the masthead re-reads on the same invalidation, so a write that touches name,
      // headline or place updates the head in place with no reload (B12 item 2, W27).
      await invalidate();
      word(id, "saved");
    },
    onError: (e: Error, vars) => {
      word(vars.id, null);
      toastMsg(e.message || "That did not save. Try again.");
    },
  });

  /**
   * Ruling 398: text, chips and selections write as the member leaves them. There is no Save
   * button to press, so a field's blur is the trigger; the debounce coalesces tabbing from one
   * field to the next in the same section into a single write. `save_profile_section` is unchanged
   * (B11 item 2); only the trigger and the chrome moved.
   */
  const commitTimer = useRef<number | null>(null);
  const commitSection = (id: EditableId, now = false) => {
    const d = drafts[id];
    // A blur that changed nothing is not a write. Without this every focus pass through a section
    // would call save_profile_section and flash the word for a value nobody touched.
    const shape = d === undefined ? undefined : JSON.stringify(d);
    if (shape === undefined || committed.current[id] === shape) return;
    if (commitTimer.current != null) window.clearTimeout(commitTimer.current);
    const run = () => {
      committed.current[id] = shape;
      saveEdit(id);
    };
    if (now) run();
    else commitTimer.current = window.setTimeout(run, 300);
  };
  /** Focus left the card. Flush the write, then close the editor unless Edit profile holds it open. */
  const leaveSection = (id: EditableId) => {
    commitSection(id, true);
    if (editMode) return;
    setDrafts((st) => {
      const next = { ...st } as Record<string, unknown>;
      delete next[id];
      return next as Drafts;
    });
  };

  const saveEdit = (id: EditableId) => {
    const d = drafts[id];
    if (!d) return;
    if (id === "core") {
      const c = d as { name: string; headline: string };
      if (!c.name.trim()) {
        toastMsg("A name is required.");
        return;
      }
      saveMut.mutate({ id, section: "core", payload: { name: c.name, headline: c.headline } });
      return;
    }
    if (id === "stance") {
      const sd = d as StanceDraft;
      const f = sd.variants[sd.stance] ?? {};
      saveMut.mutate({
        id,
        section: "stance",
        payload: {
          stance: sd.stance,
          timeline: f.timeline ?? null,
          needs: f.needs ?? null,
          base: f.base ?? null,
          offer: f.offer ?? null,
          support: f.support ?? null,
          interests: f.interests ?? [],
        },
      });
      return;
    }
    saveMut.mutate({ id, section: id, payload: d as Record<string, Json> });
  };

  const quickSave = async (
    section: string,
    payload: Record<string, Json | undefined>,
    done = "Saved.",
  ) => {
    try {
      await saveSection(section, payload);
      await invalidate();
      if (done) toastMsg(done);
    } catch (e) {
      toastMsg((e as Error).message || "That did not save. Try again.");
    }
  };
  /**
   * Ruling 499: a privacy change announces itself in its own words, never the quiet Saved. Audience,
   * Private and Share still act on the tap itself (B11 item 3, ruling 397); what changed is that
   * each says what it did rather than borrowing the section-write word.
   */
  const setVisibility = (section: SectionKey, audience: Audience) => {
    setLocalVis((v) => ({ ...v, [section]: audience }));
    void quickSave("visibility", { section, audience }, AUDIENCE_SAID[audience]);
  };

  // Media (ruling 424): the one client pipeline into the profile bucket, then the section save.
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const onPick = async (e: ChangeEvent<HTMLInputElement>, slot: "avatar" | "cover") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const out = await uploadProfileImage(file, slot);
    if (!out.ok) {
      toastMsg(
        out.reason === "too_large"
          ? "That image is too large. Choose a smaller one and try again."
          : "That image did not upload. Try again.",
      );
      return;
    }
    await quickSave(
      "media",
      slot === "avatar" ? { avatar_path: out.path } : { cover_path: out.path },
    );
  };

  // Relationship (rulings 118 to 120).
  const rel = profile?.relationship;
  const first = profile ? (profile.member.name.split(" ")[0] ?? profile.member.name) : "";
  // Ruling 417 (under 400): the composer carries no Connect verb, so "Connect with {first}" opens
  // the introduction sheet and writes through send_introduction, the one write path (ruling 215).
  // The message is optional here (ruling 401); the request sheet Design draws under 401 replaces
  // this sheet when it ships.
  const [introOpen, setIntroOpen] = useState(false);
  // Brief 14 (SPEC 41-14 Part C item 4; lifts 117): Message on a connection's profile opens the
  // pair's thread through messenger_open_one_to_one; Send a request on a non-connection's opens the
  // request sheet, whose write is messenger_request_send (1330, 1341). Reachability is the server's
  // to decide: the sheet shows for every non-connection and a refusal reads as its line.
  const [requestOpen, setRequestOpen] = useState(false);
  const onMessage = () => {
    if (!profile) return;
    void openOneToOne(profile.member.id)
      .then((thread) => navigate({ to: "/messages/$thread", params: { thread } }))
      .catch((e) => toastMsg(refusalOf(e).line));
  };
  const onRequest = () => setRequestOpen(true);
  const [introMessage, setIntroMessage] = useState("");
  const [introSending, setIntroSending] = useState(false);
  const connectWith = () => {
    if (!profile) return;
    setIntroMessage("");
    setIntroOpen(true);
  };
  const sendIntro = async () => {
    if (!profile || introSending) return;
    setIntroSending(true);
    try {
      await sendIntroduction(profile.member.id, introMessage);
      await invalidate();
      setIntroOpen(false);
      toastMsg("Your introduction is with " + first + ".");
    } catch {
      toastMsg("That did not go through. Try again.");
    } finally {
      setIntroSending(false);
    }
  };
  const relAct = async (fn: () => Promise<void>, done?: string) => {
    try {
      await fn();
      await invalidate();
      if (done) toastMsg(done);
    } catch {
      toastMsg("That did not go through. Try again.");
    }
  };

  // Brief 4A: the two block writes. member_blocks carries the whole contract (lib/blocks.ts) and the
  // ruling 198 trigger revokes the relationship, so there is nothing to do here but write and
  // re-read. Ruling 198: nothing is written to, or shown to, the other party. Ruling 211: unblocking
  // restores no edge. The confirm sheet is the only caller, and a failed write says the same neutral
  // thing every other relationship write says, naming no block (B4A sections 8, 9 and 13).
  const blockWrite = useCallback(
    async (fn: (viewer: string, member: string) => Promise<void>) => {
      if (!profile || !me) return;
      try {
        await fn(me.id, profile.member.id);
        await invalidate();
      } catch {
        toastMsg("That did not go through. Try again.");
      }
    },
    [profile, me, invalidate, toastMsg],
  );
  const block = useCallback(() => blockWrite(blockMember), [blockWrite]);
  const unblock = useCallback(() => blockWrite(unblockMember), [blockWrite]);

  // Condensing (ruling 134): the column's scroller, past 120px; edit mode exempt.
  const columnRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);
  const [bleed, setBleed] = useState(0);
  // W60: condensing takes the cover and most of the identity block out of the column, so on a
  // short profile the scroller's clamp pulls scrollTop under RELEASE_PX and the masthead expands
  // again, in a loop. The masthead's height is kept for each state, measured at rest (the cover's
  // height transition finished), and it condenses only while the range left after condensing,
  // scrollHeight - clientHeight - the difference, still exceeds RELEASE_PX. Until a condensed
  // height has been measured the cover's own height stands in, a lower bound on the difference.
  const condensedNow = useRef(false);
  const mastheadPx = useRef<{
    expanded: number | null;
    condensed: number | null;
    cover: number | null;
  }>({ expanded: null, condensed: null, cover: null });
  const measureMasthead = useCallback(() => {
    const head = columnRef.current?.querySelector<HTMLElement>('[data-testid="masthead"]');
    if (!head || editMode) return;
    const cover = head.querySelector<HTMLElement>('[data-testid="cover"]');
    const coverPx = cover ? cover.getBoundingClientRect().height : 0;
    const coverWant = cover ? parseFloat(cover.style.height) : NaN;
    if (!Number.isNaN(coverWant) && Math.abs(coverPx - coverWant) > 0.5) return;
    let px: number;
    if (getComputedStyle(head).display === "contents") {
      const kids = Array.from(head.children) as HTMLElement[];
      if (kids.length === 0) return;
      const first = kids[0]!.getBoundingClientRect();
      const last = kids[kids.length - 1]!.getBoundingClientRect();
      px = last.bottom - first.top;
    } else px = head.getBoundingClientRect().height;
    if (head.dataset["condensed"] === "1") mastheadPx.current.condensed = px;
    else {
      mastheadPx.current.expanded = px;
      mastheadPx.current.cover = coverPx;
    }
  }, [editMode]);
  useEffect(() => {
    const col = columnRef.current;
    if (!col) return;
    const scroller = col.closest("[data-scroller]") as HTMLElement | null;
    if (!scroller) return;
    const onScroll = () => {
      const top = scroller.scrollTop;
      let next: boolean;
      if (condensedNow.current) next = top > RELEASE_PX;
      else if (top <= CONDENSE_PX) next = false;
      else {
        const { expanded: e, condensed: c, cover } = mastheadPx.current;
        const diff = e != null && c != null ? e - c : (cover ?? 0);
        next = scroller.scrollHeight - scroller.clientHeight - diff > RELEASE_PX;
      }
      condensedNow.current = next;
      setCondensed(next);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    col.addEventListener("transitionend", measureMasthead);
    const measure = () => {
      measureMasthead();
      // The banner bleeds to the frame edge on compact, medium and the public column; the rails
      // frame it on the expanded in-shell view (SPEC section 1).
      const inShellExpanded = expanded && !publicView;
      setBleed(
        inShellExpanded ? 0 : Math.max(0, Math.round((scroller.clientWidth - col.clientWidth) / 2)),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      col.removeEventListener("transitionend", measureMasthead);
      ro.disconnect();
    };
  }, [expanded, publicView, profile?.member.id, measureMasthead]);

  // The C sheet on the public close.
  const [cOpen, setCOpen] = useState<C | null>(null);
  const [lastC, setLastC] = useState<C>("connect");
  const openC = (c: C) => {
    setLastC(c);
    setCOpen(c);
  };
  const stepC = (d: number) => {
    const i = C_ORDER.indexOf(lastC);
    openC(C_ORDER[(i + d + 5) % 5] as C);
  };
  // Handoff 63-WS (1866): a signed-out request cannot know whose page it is, but ?edit=1 is the
  // owner's own mode (126) and the one link 1865's email sends, so a page opened with it is the
  // viewer's own link: its Sign in and Join DNA carry next=profile, and sign-in returns the member
  // to their own profile at the handle their row carries, never the URL's. Without edit the two
  // controls are as they were and sign-in lands on the Feed.
  const goSignIn = (join = false) =>
    void navigate({
      to: "/sign-in",
      search: {
        ...(join ? { join: true } : {}),
        ...(edit ? { next: "profile" as const } : {}),
      },
    });

  // Expanded rail content (SPEC section 0.1): context only.
  useEffect(() => {
    if (!expanded || publicView || !profile) {
      setRail(null);
      return;
    }
    const shared = profile.switches?.shared;
    setRail(
      owner ? (
        <>
          <RailWidget
            title="See it as"
            empty="Turn on Share my profile to see it as the public does."
          >
            {shared && (
              <button
                type="button"
                onClick={() =>
                  void navigate({ to: "/m/$handle", params: { handle }, search: { as: "public" } })
                }
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 44,
                  borderTop: "1px solid var(--line)",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                The public sees it
              </button>
            )}
          </RailWidget>
          <RailWidget title="Who sees what" empty="">
            {(Object.keys(TITLES) as SectionKey[]).map((k) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: "1px solid var(--line)",
                  fontSize: 15,
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {k === "stance" && profile.member.stance_label
                    ? profile.member.stance_label
                    : TITLES[k]}
                </span>
                <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
                  {AUD_LABEL[vis[k] ?? (k === "links" ? "connections" : "everyone")]}
                </span>
              </div>
            ))}
          </RailWidget>
        </>
      ) : (
        <RailWidget
          title="In common"
          empty="Nothing in common yet. Connections and Spaces you share appear here."
        >
          {profile.mutuals.map((mu) => (
            <div
              key={mu.handle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Avatar name={mu.name} size={28} />
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{mu.name}</span>
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Connected</span>
              </span>
            </div>
          ))}
          {profile.shared_spaces.map((ss) => (
            <div
              key={ss}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Avatar name={ss} size={28} style={{ borderRadius: 6 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{ss}</span>
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Shared Space</span>
              </span>
            </div>
          ))}
        </RailWidget>
      ),
    );
    return () => setRail(null);
  }, [expanded, publicView, profile, owner, vis, handle, navigate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!ready) return null;

  const gate = signedOut && profileQ.isSuccess && !profile;
  const loading = profileQ.isPending;
  // 1147 (handoff 33-D item 3): the gate and the missing profile are an EmptyState alone in this
  // column, so the column is theirs. In the shell it takes the visible height the shell publishes,
  // less its own top padding; on the public page it takes the rest of that page's bounded scroller.
  const missing = !gate && !loading && !profile;
  const pad = expanded && !publicView ? 24 : 0;

  const body = (
    <div
      ref={columnRef}
      data-testid="profile"
      data-view={profile?.viewer ?? (gate ? "gate" : "loading")}
      data-edit={editMode ? "1" : "0"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        paddingTop: pad,
        minHeight:
          gate || missing
            ? publicView
              ? undefined
              : "calc(var(--_shell-visible) - " + pad + "px)"
            : undefined,
        flex: (gate || missing) && publicView ? "1 1 auto" : undefined,
      }}
    >
      {/* Rulings 396, 486: one Back row for every surface that has a parent. It names the parent,
          sits in the content column, scrolls with the page and is never a banner. Compact and
          medium only; above 1024 the profile has no back row at all. */}
      {!publicView && !expanded && profile && (
        <BackRow
          label={owner ? "Feed" : "Connect"}
          onClick={() =>
            owner
              ? void navigate({ to: "/feed", search: {} })
              : void navigate({ to: "/$c", params: { c: "connect" } })
          }
          style={{ margin: "4px 0 -8px" }}
        />
      )}
      {editMode && (
        <div
          role="status"
          data-testid="edit-bar"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 14px",
            margin: expanded ? "-24px 0 0" : 0,
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Editing your profile</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Each section saves on its own. Nothing changes until you save it.
            </span>
          </span>
          <Button size="sm" onClick={exitEdit} data-testid="edit-done">
            Done
          </Button>
        </div>
      )}
      {gate && (
        <EmptyState
          c="connect"
          title="This profile is for members."
          body="Sign in to see it, or join DNA."
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <Button onClick={() => goSignIn(false)}>Sign in</Button>
              <Button c="connect" variant="secondary" onClick={() => goSignIn(true)}>
                Join DNA
              </Button>
            </div>
          }
        />
      )}
      {missing && (
        <EmptyState
          title="No member at this address."
          body="The link may have changed."
          action={
            <Button variant="secondary" onClick={() => void navigate({ to: "/feed", search: {} })}>
              Back to Feed
            </Button>
          }
        />
      )}
      {loading && (
        <div
          role="status"
          aria-label="Loading profile"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <span
              style={{
                width: 88,
                height: 88,
                borderRadius: 14,
                background: "var(--bg-sunken)",
                flex: "none",
              }}
            />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  height: 26,
                  width: "60%",
                  borderRadius: 6,
                  background: "var(--bg-sunken)",
                }}
              />
              <span
                style={{
                  height: 14,
                  width: "85%",
                  borderRadius: 6,
                  background: "var(--bg-sunken)",
                }}
              />
              <span
                style={{
                  height: 14,
                  width: "45%",
                  borderRadius: 6,
                  background: "var(--bg-sunken)",
                }}
              />
            </span>
          </div>
          <span
            style={{
              height: 120,
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          />
          <span
            style={{
              height: 160,
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          />
        </div>
      )}
      {profile && (
        <ProfileBody
          profile={profile}
          owner={owner}
          visitor={visitor}
          pub={pub}
          editMode={editMode}
          publicView={publicView}
          tier={tier}
          condensed={condensed && !editMode}
          bleed={bleed}
          drafts={drafts}
          setDrafts={setDrafts}
          saveWord={saveWord}
          vis={vis}
          setVisibility={setVisibility}
          sectionSpecs={sectionSpecs}
          vocab={vocabQ.data ?? null}
          startEdit={startEdit}
          commitSection={commitSection}
          leaveSection={leaveSection}
          enterEdit={enterEdit}
          quickSave={quickSave}
          aboutOpen={aboutOpen}
          setAboutOpen={setAboutOpen}
          avatarInput={avatarInput}
          coverInput={coverInput}
          rel={rel}
          first={first}
          connectWith={connectWith}
          onMessage={onMessage}
          onRequest={onRequest}
          relAct={relAct}
          onBlock={block}
          onUnblock={unblock}
          me={me?.id ?? null}
          onViewAsPublic={() =>
            void navigate({ to: "/m/$handle", params: { handle }, search: { as: "public" } })
          }
          openC={openC}
          goSignIn={goSignIn}
        />
      )}
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void onPick(e, "avatar")}
      />
      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void onPick(e, "cover")}
      />
    </div>
  );

  const sheet = (
    <Sheet
      open={!!cOpen}
      onClose={() => setCOpen(null)}
      variant={compact ? "sheet" : "drawer"}
      // Ruling 492: the canonical 40 percent side sheet, never a fixed 560.
      label={"About " + C_LABEL[lastC]}
    >
      <CSheetBody
        c={lastC}
        onPrev={() => stepC(-1)}
        onNext={() => stepC(1)}
        onSignIn={() => goSignIn(true)}
        attestations={attestQ.data ?? {}}
      />
    </Sheet>
  );
  const toastNode = toast && (
    <div style={toastStyle(publicView ? (compact ? "expanded" : "expanded") : tier)}>
      <Toast>{toast}</Toast>
    </div>
  );
  const requestNode = visitor && profile && (
    <MessageRequestSheet
      open={requestOpen}
      member={{
        id: profile.member.id,
        name: profile.member.name,
        headline: profile.member.headline,
        stance: profile.member.stance_label ?? null,
        avatarUrl: profile.avatarUrl,
      }}
      compact={compact}
      onClose={() => setRequestOpen(false)}
      onSend={async (body) => {
        try {
          await requestSend(profile.member.id, body);
        } catch (e) {
          throw refusalOf(e);
        }
        toastMsg("Request sent to " + first + ".");
      }}
    />
  );
  // Ruling 417: the introduction sheet behind "Connect with {first}", signed-in visitors only.
  const introNode = visitor && profile && (
    <IntroSheet
      open={introOpen}
      member={{
        name: profile.member.name,
        headline: profile.member.headline,
        avatarUrl: profile.avatarUrl,
      }}
      message={introMessage}
      onMessage={setIntroMessage}
      onClose={() => setIntroOpen(false)}
      onSend={() => void sendIntro()}
      sending={introSending}
      compact={compact}
      messageRequired={false}
    />
  );

  if (!publicView) {
    return (
      <>
        {body}
        {toastNode}
        {introNode}
        {requestNode}
      </>
    );
  }

  // The public page's own chrome (SPEC section 0.1): signed-out header, no dock, no rails, one
  // column (960 centred inside 1440 on expanded, full width otherwise), the banner bleeding to the edge.
  return (
    <div
      data-testid="public-page"
      data-tier={tier}
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          height: expanded ? 64 : 56,
          // Longhand, never the shorthand plus a longhand for the same value: paddingTop carries
          // the safe-area inset and the sides change with the tier, and useTier flips from compact
          // once on mount at every width, so the two forms would swap and React would warn.
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: 0,
          paddingLeft: expanded ? 32 : 16,
          paddingRight: expanded ? 32 : 16,
          borderBottom: "1px solid var(--line)",
          background: "var(--bg)",
          flex: "none",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
            maxWidth: 1440,
            margin: "0 auto",
          }}
        >
          <a
            href="/"
            aria-label="DNA"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}
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
                  height: expanded ? 28 : 24,
                  width: "auto",
                  display: "block",
                  visibility: "hidden",
                }}
              />
            </span>
          </a>
          {signedOut ? (
            <Button variant="secondary" size="sm" onClick={() => goSignIn(false)}>
              Sign in
            </Button>
          ) : (
            <span />
          )}
        </div>
      </header>
      {asPublic && (
        <div
          role="status"
          data-testid="as-public-banner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minHeight: 40,
            padding: "0 16px",
            background: "var(--ink)",
            color: "var(--on-fill)",
            fontSize: 15,
            flex: "none",
          }}
        >
          <span>Viewing as the public sees it</span>
          <button
            type="button"
            onClick={() => void navigate({ to: "/m/$handle", params: { handle }, search: {} })}
            style={{
              all: "unset",
              cursor: "pointer",
              minHeight: 40,
              display: "inline-flex",
              alignItems: "center",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Back to your profile
          </button>
        </div>
      )}
      <div
        data-scroller="public"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}
      >
        <div
          data-testid="public-column"
          style={{
            display: "flex",
            flexDirection: "column",
            padding: compact ? "0 16px 48px" : "0 32px 48px",
            maxWidth: expanded ? 960 : "none",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            // 1147: the scroller is bounded, so the gate's column fills it; the 48 foot stays below
            // as the page's own scroll room, as it does under a profile.
            minHeight: gate || missing ? "calc(100% + 48px)" : undefined,
          }}
        >
          {body}
        </div>
      </div>
      {sheet}
      {toastNode}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The loaded profile: masthead, controls or actions, sections, close.
// ---------------------------------------------------------------------------

type BodyProps = {
  profile: ProfileView;
  owner: boolean;
  visitor: boolean;
  pub: boolean;
  editMode: boolean;
  publicView: boolean;
  tier: "compact" | "medium" | "expanded";
  condensed: boolean;
  bleed: number;
  drafts: Drafts;
  setDrafts: (fn: (d: Drafts) => Drafts) => void;
  saveWord: Partial<Record<EditableId, "saving" | "saved" | null>>;
  vis: Partial<Record<SectionKey, Audience>>;
  setVisibility: (section: SectionKey, audience: Audience) => void;
  sectionSpecs: SectionSpec[];
  vocab: Vocabularies | null;
  startEdit: (id: EditableId) => void;
  commitSection: (id: EditableId) => void;
  leaveSection: (id: EditableId) => void;
  enterEdit: () => void;
  quickSave: (
    section: string,
    payload: Record<string, Json | undefined>,
    done?: string,
  ) => Promise<void>;
  aboutOpen: boolean;
  setAboutOpen: (fn: (v: boolean) => boolean) => void;
  avatarInput: React.RefObject<HTMLInputElement | null>;
  coverInput: React.RefObject<HTMLInputElement | null>;
  rel: ProfileView["relationship"];
  first: string;
  connectWith: () => void;
  onMessage: () => void;
  onRequest: () => void;
  relAct: (fn: () => Promise<void>, done?: string) => Promise<void>;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
  me: string | null;
  onViewAsPublic: () => void;
  openC: (c: C) => void;
  goSignIn: (join?: boolean) => void;
};

function ProfileBody(p: BodyProps) {
  const {
    profile,
    owner,
    visitor,
    pub,
    editMode,
    publicView,
    tier,
    condensed,
    bleed,
    drafts,
    vis,
  } = p;
  const compact = tier === "compact";
  // The C deck's bleed past the column's padding: never more than the gutter the column actually
  // has (measured above as `bleed`: 16 on compact, 32 on the medium public column), 24 at most.
  const deckBleed = Math.min(24, bleed);
  const expanded = tier === "expanded";
  const m = profile.member;
  const s = profile.sections;
  const shared = !!profile.switches?.shared;
  const priv = !!profile.switches?.private;
  const split = expanded && publicView;
  const coverH = compact ? 150 : expanded ? (publicView ? 300 : 220) : 200;
  const avatarSize = compact ? 80 : expanded ? (publicView ? 128 : 104) : 96;
  const setDraft = (id: FieldId, patch: Draft) =>
    p.setDrafts((st) => ({ ...st, [id]: { ...((st[id] as Draft | undefined) ?? {}), ...patch } }));

  const ownerHint = priv
    ? "Private hides your profile from everyone who is not connected to you. Nothing else shows."
    : shared
      ? "Anyone with the link sees your core row and the sections set to Everyone on DNA. Connections-only and Anchored sections stay inside. Anchored means members who share a Space role or an attested event with you."
      : "Only signed-in members can open your profile. Turn on Share my profile to give the link to anyone.";

  const actions = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {visitor && (
        <>
          {/* B4A section 4: one wrapping row, gap 8, every control 44 tall, the overflow last. The
              relationship group is display:contents so its controls are items of this row rather
              than a block that wraps as a unit. Ruling 198: no relationship object means the pair is
              blocked, and a blocked pair gets no Connect action and no Follow, in either direction;
              every other visitor has one. The overflow is there for all of them, because blocking is
              symmetric in availability and the blocked party may block back. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {p.rel && (
              <div
                data-testid="relationship"
                data-state={p.rel.state}
                style={{ display: "contents" }}
              >
                {p.rel.state === "none" && (
                  <Button c="connect" onClick={p.connectWith} data-testid="connect-with">
                    Connect with {p.first}
                  </Button>
                )}
                {p.rel.state === "none" && (
                  <Button
                    variant="secondary"
                    c="connect"
                    onClick={p.onRequest}
                    data-testid="send-request"
                  >
                    Send a request
                  </Button>
                )}
                {p.rel?.state === "sent" && (
                  <Button
                    variant="secondary"
                    c="connect"
                    onClick={() => void p.relAct(() => withdrawRequest(p.me as string, m.id))}
                  >
                    Request sent
                  </Button>
                )}
                {p.rel?.state === "received" && (
                  <>
                    <Button
                      c="connect"
                      onClick={() =>
                        void p.relAct(
                          () => respondRequest(p.me as string, m.id, true),
                          "You and " + p.first + " are connected.",
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void p.relAct(() => respondRequest(p.me as string, m.id, false))
                      }
                    >
                      Decline
                    </Button>
                  </>
                )}
                {p.rel?.state === "connected" && (
                  <Button c="connect" onClick={p.onMessage} data-testid="profile-message">
                    Message
                  </Button>
                )}
                {p.rel?.state === "connected" && (
                  <span
                    data-testid="connected"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: "var(--radius-m)",
                      background: "var(--c-connect-tint)",
                      color: "var(--c-connect-text)",
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    <Icon name="check" size={16} />
                    Connected
                  </span>
                )}
                <Button
                  variant="secondary"
                  aria-pressed={!!p.rel?.following}
                  onClick={() =>
                    void p.relAct(() => setFollow(p.me as string, m.id, !p.rel?.following))
                  }
                  data-testid="follow"
                >
                  {p.rel?.following ? "Following" : "Follow"}
                </Button>
              </div>
            )}
            <ProfileBlockControl
              first={p.first}
              name={m.name}
              blocked={!!profile.viewer_blocked}
              tier={tier}
              onBlock={p.onBlock}
              onUnblock={p.onUnblock}
            />
          </div>
          {p.rel?.state === "received" && (
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>
              {p.first} asked to connect with you.
            </p>
          )}
          {!expanded && profile.mutuals.length > 0 && (
            <div
              data-testid="mutuals"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 15,
                color: "var(--ink-2)",
              }}
            >
              {profile.mutuals.map((mu) => (
                <span
                  key={mu.handle}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Avatar name={mu.name} size={24} />
                  {mu.name}
                </span>
              ))}
              <span style={{ color: "var(--ink-3)" }}>
                {profile.mutuals.length === 1
                  ? "is a connection you share"
                  : "are connections you share"}
              </span>
            </div>
          )}
        </>
      )}
      {owner && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!editMode && (
              <>
                <Button size="sm" onClick={p.enterEdit} data-testid="edit-profile">
                  Edit profile
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => p.startEdit("core")}
                  data-testid="edit-core"
                >
                  Edit name and headline
                </Button>
              </>
            )}
            {shared && (
              <Button
                variant="ghost"
                size="sm"
                onClick={p.onViewAsPublic}
                data-testid="view-as-public"
              >
                View as public
              </Button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <Switch
              label="Private profile"
              checked={priv}
              onChange={(v) =>
                void p.quickSave(
                  "switches",
                  { private: v },
                  v
                    ? "Your profile is private. Members see your core row and nothing else."
                    : "Your profile is open to members again.",
                )
              }
              style={{ fontSize: 15 }}
            />
            <Switch
              label="Share my profile"
              checked={shared}
              onChange={(v) =>
                void p.quickSave(
                  "switches",
                  { shared: v },
                  v
                    ? "Your profile link now works for anyone."
                    : "Your profile link no longer works outside DNA.",
                )
              }
              style={{ fontSize: 15, borderTop: "1px solid var(--line)" }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--ink-3)" }}>
            {ownerHint}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "var(--ink-3)",
                flex: 1,
              }}
            >
              Badges
            </span>
            <VisibilitySelect
              value={vis.badges ?? "everyone"}
              onChange={(v) => p.setVisibility("badges", v)}
            />
          </div>
        </>
      )}
      {/* Strand's BadgeRow (1530, handoff 44-MC-R3): the lib already mapped the fields and formatted
          `when` (toAttestations); the wrapper carries the arm's hook and nothing else. */}
      {!pub && profile.badges.length > 0 && (
        <div data-testid="badges">
          <BadgeRow attestations={profile.badges} />
        </div>
      )}
    </div>
  );

  // Sections, in order (SPEC section 3). A visitor's absent section never mounts.
  const cards: ReactNode[] = [];
  const pushField = (spec: SectionSpec) => {
    const id = spec.id;
    const data = s[id] as Record<string, string | string[] | undefined> | undefined;
    const editing = !!drafts[id];
    if (!owner && !data) return;
    const cur = editing ? (drafts[id] as Draft) : (data ?? {});
    const solo = spec.fields.length === 1;
    const rows = spec.fields
      .map((f) => {
        const v = cur[f.k];
        if (Array.isArray(v) ? !v.length : !v) return null;
        return { f, v };
      })
      .filter((x): x is { f: FieldSpec; v: string | string[] } => !!x);
    const isEmpty = rows.length === 0;
    if (!owner && isEmpty) return;
    cards.push(
      <SectionCard
        key={id}
        testId={"section-" + id}
        title={spec.title}
        owner={owner}
        editing={editing}
        keepVisibility={editMode}
        onEdit={() => p.startEdit(id)}
        onCommit={() => p.commitSection(id)}
        onLeave={() => p.leaveSection(id)}
        save={p.saveWord[id] ?? null}
        visibility={vis[id] ?? (id === "links" ? "connections" : "everyone")}
        onVisibility={owner ? (v) => p.setVisibility(id, v) : undefined}
        empty={isEmpty && !editing ? spec.emptyLine : null}
        emptyAct={isEmpty && !editing ? spec.act : null}
        onEmptyAct={() => p.startEdit(id)}
      >
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {spec.fields.map((f) => {
              const v = cur[f.k];
              if (f.kind === "vocab")
                return (
                  <VocabularyPicker
                    key={f.k}
                    label={f.label}
                    options={f.options ?? []}
                    value={(v as string[] | undefined) ?? []}
                    onChange={(x) => setDraft(id, { [f.k]: x })}
                    max={f.max}
                  />
                );
              if (f.kind === "select")
                return (
                  <Select
                    key={f.k}
                    label={f.label}
                    value={(v as string | undefined) ?? ""}
                    options={[
                      { value: "", label: "Choose" },
                      ...(f.options ?? []).map((o) => ({ value: o, label: o })),
                    ]}
                    onChange={(e) => setDraft(id, { [f.k]: e.target.value })}
                  />
                );
              const text = (v as string | undefined) ?? "";
              return (
                <Input
                  key={f.k}
                  label={f.label}
                  value={text}
                  onChange={(e) => setDraft(id, { [f.k]: (e.target as HTMLInputElement).value })}
                  multiline={!!f.multiline}
                  rows={4}
                  hint={f.maxLength ? text.length + " of " + f.maxLength : f.hint}
                  maxLength={f.maxLength}
                />
              );
            })}
          </div>
        ) : id === "links" ? (
          <LinkRow links={cur as Record<string, string>} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map(({ f, v }) => {
              const long = !!f.clamp && typeof v === "string" && v.length > 220;
              return (
                <div key={f.k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {!solo && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{f.label}</div>}
                  {Array.isArray(v) ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {v.map((x) => (
                        <Chip key={x}>{x}</Chip>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div
                        style={
                          long && !p.aboutOpen
                            ? {
                                fontSize: 17,
                                lineHeight: 1.5,
                                textWrap: "pretty",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }
                            : { fontSize: 17, lineHeight: 1.5, textWrap: "pretty" }
                        }
                      >
                        {v}
                      </div>
                      {long && (
                        <button
                          type="button"
                          aria-expanded={p.aboutOpen}
                          onClick={() => p.setAboutOpen((o) => !o)}
                          style={{ ...LINK_STYLE, alignSelf: "flex-start", margin: "-10px 0" }}
                        >
                          {p.aboutOpen ? "Show less" : "Read more"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>,
    );
  };

  const about = p.sectionSpecs.find((x) => x.id === "about");
  if (about) pushField(about);

  // Stance block (ruling 122; the axis is stance since Brief 5, ruling 300).
  {
    const stanceEditing = !!drafts.stance;
    const sd = drafts.stance;
    const stanceId: Stance | undefined = stanceEditing
      ? sd?.stance
      : (s.stance?.stance ?? m.stance);
    const fields: StanceFields = stanceEditing
      ? (sd?.variants[sd.stance] ?? {})
      : (s.stance?.fields ?? {});
    // Ruling 187: the heading follows the stance being edited, so it reads the vocabulary rather
    // than member.stance_label, which is the saved one. Ruling 194 (handoff 30-B): the vocabulary is
    // the heading's only source. When it does not load the heading is empty, never the saved label
    // and never a literal, so a failed read is visible as a failed read.
    const stanceLabel = stanceId
      ? (p.vocab?.stances?.find((o) => o.value === stanceId)?.label ?? null)
      : null;
    const stanceEmpty = !Object.values(fields).some((v) => (Array.isArray(v) ? v.length : !!v));
    const present = owner || (!!s.stance && !stanceEmpty);
    if (present) {
      const data: StanceData = { ...fields, stance: stanceId };
      cards.push(
        <SectionCard
          key="stance"
          testId="section-stance"
          // SectionCard's title is a string that feeds the h2, the section's aria-label and the edit
          // control's label. An absent label passes the empty string, so the h2 renders no text and
          // no literal stands in for a vocabulary that did not load (ruling 194).
          title={stanceLabel ?? ""}
          owner={owner}
          editing={stanceEditing}
          keepVisibility={editMode}
          onEdit={() => p.startEdit("stance")}
          onCommit={() => p.commitSection("stance")}
          onLeave={() => p.leaveSection("stance")}
          save={p.saveWord.stance ?? null}
          visibility={vis.stance ?? "everyone"}
          onVisibility={owner ? (v) => p.setVisibility("stance", v) : undefined}
          // Ruling 397 for the word, and ruling 187 for the enumeration. The line used to read
          // "Say where you stand: returning, anchored on the continent, an ally, or still
          // exploring." — four of the five stances ruling 300 locks, with Kin missing, and a stance
          // label map written as prose, which 187 says no component keeps. Naming the fifth would
          // keep the map; the line names none and the chooser reads public.member_stances, which is
          // the one label source. Whether a prompt may enumerate a vocabulary at all is raised for
          // a ruling, not settled here.
          empty={
            stanceEmpty && !stanceEditing
              ? "Say where you stand. The stance you choose sets what this section asks for."
              : null
          }
          emptyAct={stanceEmpty && !stanceEditing ? "Choose your stance" : null}
          onEmptyAct={() => p.startEdit("stance")}
        >
          <StanceBlock
            stance={stanceId ?? "exploring"}
            data={data}
            editing={stanceEditing}
            interestOptions={p.vocab?.interests ?? []}
            timelineOptions={p.vocab?.timeline}
            stanceOptions={p.vocab?.stances}
            onChange={(d) =>
              p.setDrafts((st) => {
                const prev = st.stance ?? { stance: stanceId ?? "returnee", variants: {} };
                const nextStance = (d.stance ?? prev.stance) as Stance;
                if (nextStance !== prev.stance)
                  return { ...st, stance: { ...prev, stance: nextStance } };
                const { stance: _stance, ...rest } = d;
                return {
                  ...st,
                  stance: {
                    ...prev,
                    variants: {
                      ...prev.variants,
                      [nextStance]: { ...(prev.variants[nextStance] ?? {}), ...rest },
                    },
                  },
                };
              })
            }
          />
        </SectionCard>,
      );
    }
  }

  for (const spec of p.sectionSpecs) if (spec.id !== "about") pushField(spec);

  // Activity (ruling 125): grounded-or-empty.
  for (const c of Object.keys(ACT) as ActivityC[]) {
    const items = s[c] ?? [];
    if (!owner && !s[c]) continue;
    if (!owner && items.length === 0) continue;
    const isEmpty = items.length === 0;
    cards.push(
      <SectionCard
        key={c}
        testId={"section-" + c}
        title={ACT[c][1]}
        c={c}
        owner={owner}
        visibility={vis[c] ?? "everyone"}
        onVisibility={owner ? (v) => p.setVisibility(c, v) : undefined}
        empty={
          isEmpty
            ? "Nothing here yet. It fills as your " + ACT[c][0] + " activity is attested."
            : null
        }
        emptyAct={isEmpty ? ACT[c][2] : null}
        onEmptyAct={() => openComposer({ host: "profile", initialVerb: c })}
      >
        <ul
          style={{
            listStyle: "none",
            margin: "0 -16px -16px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--line)",
          }}
        >
          {items.map((it, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}
              >
                <span
                  style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35, textWrap: "pretty" }}
                >
                  {it.title}
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>
                  {it.sub}
                  {it.when && c !== "collaborate" ? " · " + whenShort(it.when) : ""}
                </span>
              </div>
              {it.completed && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    flex: "none",
                  }}
                >
                  <Icon name="circle-check" size={14} />
                  Completed
                </span>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>,
    );
  }

  const sectionsStyle: CSSProperties =
    pub && !compact
      ? { columns: expanded ? 3 : 2, columnGap: 16, paddingTop: 4 }
      : { display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 };
  const wrapStyle: CSSProperties =
    pub && !compact
      ? {
          breakInside: "avoid",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
        }
      : { display: "flex", flexDirection: "column" };

  const coreEditing = !!drafts.core;
  const coreDraft = drafts.core ?? { name: "", headline: "" };

  return (
    <>
      <ProfileHeader
        member={{
          name: m.name,
          headline: m.headline,
          avatar: profile.avatarUrl,
          cover: profile.coverUrl,
          pattern: m.pattern as MastheadPattern,
        }}
        // Item 13 (1718, 1719, 1729): the frames come from the media rows through profile.ts; a
        // missing frame is undefined here, never a default in the part.
        coverFrame={profile.coverFrame}
        photoFrame={profile.photoFrame}
        identified={m.tier !== "account"}
        owner={owner}
        onAvatar={() => p.avatarInput.current?.click()}
        onCover={() => p.coverInput.current?.click()}
        hero
        split={split}
        lock={!editMode}
        condensed={condensed}
        condensedAvatar={compact ? 64 : 88}
        bleed={bleed}
        gutter={compact ? 16 : 32}
        coverHeight={coverH}
        avatarSize={avatarSize}
        actions={pub ? undefined : actions}
      />
      {editMode && (
        <SectionCard title="Masthead pattern" owner testId="section-pattern">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>
            The textile behind your name on the shared profile. Saves as you pick.
          </p>
          <PatternPicker
            value={m.pattern as MastheadPattern}
            onChange={(v) => void p.quickSave("pattern", { pattern: v })}
          />
        </SectionCard>
      )}
      {coreEditing && (
        <SectionCard
          title="Name and headline"
          owner
          editing
          testId="section-core"
          save={p.saveWord.core ?? null}
          onCommit={() => p.commitSection("core")}
          onLeave={() => p.leaveSection("core")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="Name"
              value={coreDraft.name}
              onChange={(e) =>
                p.setDrafts((st) => ({
                  ...st,
                  core: {
                    ...(st.core ?? { name: "", headline: "" }),
                    name: (e.target as HTMLInputElement).value,
                  },
                }))
              }
              hint="The only required field."
            />
            <Input
              label="Headline"
              value={coreDraft.headline}
              onChange={(e) =>
                p.setDrafts((st) => ({
                  ...st,
                  core: {
                    ...(st.core ?? { name: "", headline: "" }),
                    headline: (e.target as HTMLInputElement).value,
                  },
                }))
              }
              hint="One line, up to 140 characters. What you do, in your words."
              maxLength={140}
            />
          </div>
        </SectionCard>
      )}
      {(owner || !profile.private) && (
        <div data-testid="sections" style={sectionsStyle}>
          {cards.map((card, i) => (
            <div key={i} style={wrapStyle}>
              {card}
            </div>
          ))}
        </div>
      )}
      {pub && (
        <div
          data-testid="public-close"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16,
            padding: "32px 0 8px",
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              lineHeight: 1.2,
              textWrap: "pretty",
              maxWidth: 520,
            }}
          >
            {p.first} is on DNA. This is how members move together.
          </div>
          <div
            data-testid="c-deck"
            style={
              expanded
                ? {
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                    gap: 12,
                    width: "100%",
                    margin: "8px 0",
                  }
                : {
                    display: "flex",
                    gap: 12,
                    overflowX: "auto",
                    scrollSnapType: "x mandatory",
                    // Ruling 344: the strip bleeds to the column's edge and no further. It bled
                    // 24 on both tiers against the compact column's 16 gutter, which put its right
                    // edge 8 past the viewport at 360, 390 and 430 and let the public page pan.
                    width: `calc(100% + ${deckBleed * 2}px)`,
                    margin: `8px -${deckBleed}px`,
                    padding: `0 ${deckBleed}px 8px`,
                    boxSizing: "border-box",
                    WebkitOverflowScrolling: "touch",
                  }
            }
          >
            {C_ORDER.map((c) => (
              <div
                key={c}
                style={
                  expanded
                    ? { minWidth: 0, display: "flex" }
                    : {
                        flex: "none",
                        width: compact ? 240 : 260,
                        scrollSnapAlign: "start",
                        display: "flex",
                      }
                }
              >
                <CCard c={c} onOpen={p.openC} />
              </div>
            ))}
          </div>
          <Button c="connect" onClick={() => p.goSignIn(true)} data-testid="join-dna">
            Join DNA
          </Button>
          <button
            type="button"
            onClick={() => p.goSignIn(false)}
            style={{ ...LINK_STYLE, color: "var(--ink-2)" }}
          >
            Already a member? Sign in
          </button>
        </div>
      )}
      {visitor && profile.dia_line && (
        <p
          data-testid="dia-line"
          style={{
            margin: 0,
            padding: "0 4px",
            fontSize: 15,
            lineHeight: 1.45,
            color: "var(--ink-2)",
            fontStyle: "italic",
          }}
        >
          {profile.dia_line}
        </p>
      )}
    </>
  );
}
