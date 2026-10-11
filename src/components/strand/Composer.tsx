// Design pass 01, strand-patch/Composer.jsx (rulings 458, 417, 492, 493, 497, 498, W52; supersedes
// the B1-Composer-v3 patch). Everything else is Brief 1 byte for byte, including the patched Sheet,
// the drag-armed drop target, draft autosave, the live PostCard preview and DIA's line.
// 1. The chip row moved out of the middle of the fields column and sits directly above the text
//    area, always visible, before anything is typed (458). It is its own component, VerbRow, so the
//    scroller and its fade are one thing, and a vertical wheel over it scrolls it sideways (493).
// 2. Four chips in C order; connect has left the composer and VERB_SCHEMA with it (417, 498).
// 3. `columns`: 2 is B1's drawer with the preview beside the fields; 1 stacks the preview under the
//    fields, for the side sheet on medium and expanded where two columns do not fit (1219).
// 4. Sheet geometry (ruling 492): 80 percent tall on compact, a side sheet of --sheet-composer-ratio on medium and
//    expanded. B1's 1000px two-column drawer is retired.
// 5. A saved draft returns by invitation (ruling 497): the composer opens empty and offers
//    "Continue your draft" with a discard. Autosave and "Draft saved" are unchanged, and ruling
//    287's clearing on publish is unchanged.
// Production hooks replace the prototype's localStorage draft and data-URL images:
// `draft` + `onDraft` (server-side drafts per member and host context, ruling 56), `upload` (media
// goes through the media-upload Edge Function and Tinify, ruling 55), and the preview renders
// through the shared card router (brief: one PostCard renderer).
//
// Convene Pass 1: rebound to Strand's corrected Composer at compile v1789537371639386 (rulings 664
// to 673, 681; the bundle is the source, this header its summary).
// 6. `forms`: a per-verb form slot (580's third state). A supplied form receives { fields, setField,
//    mine, tier, diaTag, proposed, reportValidity }, sees its keys un-prefixed and has them stored
//    as `{verb}.{key}` (664). The Composer renders it under the verb's caps label and does not read
//    its fields.
// 7. Proposal without selection (635, 667, 668): DIA proposes a verb; the DiaLine carries the
//    proposal, the proposed verb's form mounts with DIA's fills tagged, and no chip carries
//    aria-checked from the read alone. Publish stays off while a proposal stands without a tap; the
//    tap on the proposed chip is the acceptance and keeps DIA's fills.
// 8. `onPublish` returns a promise (665, 666): in flight the fieldset is disabled and aria-busy,
//    the draft stays visible and Publish reads "Publishing"; rejection lands the caller's message in
//    Sheet's error slot with every value intact; resolution closes through onClose('published') and
//    the host navigates in that handler.
// 9. `disabledVerbs` (correction 7, 672): a disabled chip stays in the row with its reason as
//    aria-description and pointer title; on touch a tap on it writes the reason into the DiaLine
//    slot as a status line, and the next tap in the row clears it.
// 10. With a supplied form the preview reads `{c}.title` and `{c}.meta` and nothing else of the
//    form's, and its footer is the card's fixed vocabulary (671).
// 11. Segment fields render through the Segment part (673), the Composer its first caller.
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
  type ReactNode,
} from "react";
import { PostCardRouter } from "@/components/dna/PostCardRouter";
import type { PostView } from "@/lib/post-view";
import { domainOf } from "@/lib/post-view";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { AudienceSelect, AUDIENCE_LABEL, type Audience } from "./AudienceSelect";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { DiaLine, type DiaLineState } from "./DiaLine";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Segment } from "./Segment";
import { COMPOSER_SHEET_WIDTH, Sheet } from "./Sheet";
import { Switch } from "./Switch";
import { type ComposerVerb } from "./cmeta";
import { VERB_ACT } from "./VerbChip";
import { VerbRow } from "@/components/dna/VerbRow";
import {
  UNTYPED,
  VERB_SCHEMA,
  type FieldKey,
  type FieldValue,
  type FieldValues,
  type FormFieldValues,
  type SchemaKey,
  type VerbField,
} from "./verb-schema";

export { VERB_SCHEMA } from "./verb-schema";
// COMPOSER_VERBS is cmeta's and is re-exported from the barrel there; a second re-export here made
// the two paths ambiguous once ruling 417 gave cmeta the ComposerVerb type.

// DIA inference budget. Ruling 54 set 2.5 s; ruling 74 (D176) raises it to 3.5 s after Sonnet-class
// latency measured at 2.2 to 2.9 s per call. The server mirrors this in dia-compose-read.
export const THINK_BUDGET = 3500;
const INFER_DEBOUNCE = 700;
const DRAFT_DEBOUNCE = 800;
const MIN_INFER_CHARS = 8;

export type Inference = {
  c: ComposerVerb;
  fields: Partial<Record<FieldKey, string | boolean>>;
  line?: string | undefined;
  confidence?: number | undefined;
  latency_ms?: number | undefined;
};
export type UnfurlMeta = {
  title?: string | null | undefined;
  description?: string | null | undefined;
  image?: string | null | undefined;
  domain?: string | undefined;
};
export type ComposerLink = {
  url: string;
  domain: string;
  title?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
};
export type ComposerImage = {
  preview: string;
  storage_path?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  pending?: boolean | undefined;
};
export type UploadedImage = { storage_path: string; width: number; height: number };

export type DiaRecord = {
  verb: ComposerVerb | null;
  confidence: number | null;
  proposed_fields: Partial<Record<FieldKey, string | boolean>>;
  accepted: boolean;
  member_overrode: boolean;
  latency_ms: number | null;
};

/** What the composer persists as a draft and hands back on publish. */
export type ComposerState = {
  text: string;
  /** The member's chosen verb; only a tap sets it (635). */
  verb: ComposerVerb | null;
  /** DIA's standing proposal, never a selection (667). */
  proposed?: ComposerVerb | null | undefined;
  overridden: boolean;
  fields: FieldValues;
  images: ComposerImage[];
  link: ComposerLink | null;
  audience: Audience;
  asSpace: string;
  dia: { state: DiaLineState; text?: string | undefined };
  diaRecord: DiaRecord | null;
};

export type ComposerSeed = Partial<ComposerState> & { hold?: boolean | undefined };

/** What a supplied form receives (ruling 664). Keys are un-prefixed here; the store holds `{verb}.{key}`. */
export type ComposerFormProps = {
  fields: FormFieldValues;
  setField: (key: string, value: string | boolean, mine?: boolean) => void;
  /** Whether the member wrote this key (true) or DIA filled it (false). */
  mine: (key: string) => boolean;
  tier: "compact" | "medium" | "expanded";
  /** The caps DIA tag a label carries while DIA's fill stands untouched. */
  diaTag: ReactNode;
  /** True while the verb is DIA's proposal and not yet the member's tap (667). */
  proposed: boolean;
  /** Called on first render and every change; Publish gates on the last report (664). */
  reportValidity: (valid: boolean) => void;
};
export type ComposerForm = ComponentType<ComposerFormProps>;

export type ComposerCloseReason = "published";

/**
 * Production divergence (handoff 58-12C2, docs/strand-ports/v1790724894917128.md): what the
 * composer held at the moment it closed, for the recorder's `composer_closed_unpublished` and
 * `dia_suggestion_acted`. The compile's onClose carries the reason alone.
 */
export type ComposerCloseDetail = {
  verb: ComposerVerb | null;
  /** True when any text, image, link or field carried a value. */
  hadText: boolean;
  /** True when the member accepted DIA's proposed verb by tapping its chip (668). */
  diaAccepted: boolean;
};

export type ComposerProps = {
  open: boolean;
  /** Ruling 666: 'published' when the Composer closed itself after onPublish resolved; else the member closed it. */
  onClose?: ((reason?: ComposerCloseReason, detail?: ComposerCloseDetail) => void) | undefined;
  /** Ruling 665: may return a promise; the Composer carries the in-flight and failed states. */
  onPublish?: ((state: ComposerState) => Promise<void> | void) | undefined;
  tier?: "compact" | "medium" | "expanded";
  mode?: "touch" | "pointer" | undefined;
  author?: { name: string; avatar?: string | undefined };
  spaces?: { id: string; name: string }[];
  anchor?: { kind: string; id: string; name: string } | undefined;
  infer?: ((text: string) => Promise<Inference | null>) | undefined;
  unfurl?: ((url: string) => Promise<UnfurlMeta | null>) | undefined;
  upload?: ((file: File) => Promise<UploadedImage | null>) | undefined;
  initialVerb?: ComposerVerb | null | undefined;
  initial?: ComposerSeed | null | undefined;
  draft?: ComposerSeed | null | undefined;
  onDraft?: ((state: ComposerState | null) => void) | undefined;
  contained?: boolean | undefined;
  /** 2 is B1's drawer with the preview beside the fields; 1 stacks it under them (ruling 492). */
  columns?: 1 | 2 | undefined;
  maxImages?: number;
  /**
   * Ruling 193: option lists a field reads from a vocabulary at runtime, keyed by field. The schema
   * carries no literal for these, so a key that is absent leaves the control with no options
   * (ruling 194), which is what a vocabulary that failed to load has to render.
   */
  fieldOptions?: Partial<Record<SchemaKey, string[]>> | undefined;
  /** Ruling 664: the verb's owner supplies its form as content inside the locked shell. */
  forms?: Partial<Record<ComposerVerb, ComposerForm>> | undefined;
  /** Correction 7 (ruling 53): verbs that cannot be chosen here, each with its reason in words. */
  disabledVerbs?: Partial<Record<ComposerVerb, string>> | undefined;
};

// Ruling 400: no Connect line; the composer carries no Connect verb.
const DIA_LINE: Record<ComposerVerb, string> = {
  convene: "DIA read this as an Event.",
  collaborate: "DIA read this as a Space.",
  contribute: "DIA read this as a Need.",
  convey: "DIA read this as a Story.",
};

const EMPTY_FORMS: Partial<Record<ComposerVerb, ComposerForm>> = {};
const EMPTY_DISABLED: Partial<Record<ComposerVerb, string>> = {};

/** The Universal Post Composer (Brief 1). One shell for every verb; DIA suggests, the member decides. */
export function Composer({
  open,
  onClose,
  onPublish,
  tier = "compact",
  mode,
  author = { name: "You" },
  spaces = [],
  anchor,
  infer,
  unfurl,
  upload,
  initialVerb,
  initial,
  draft,
  onDraft,
  contained,
  columns,
  maxImages = 4,
  fieldOptions,
  forms = EMPTY_FORMS,
  disabledVerbs = EMPTY_DISABLED,
}: ComposerProps) {
  const touch = (mode || (tier === "expanded" ? "pointer" : "touch")) === "touch";
  /**
   * Ruling 492: in the side sheet on a medium or expanded viewport two columns do not fit, so the
   * preview stacks under the fields at every tier unless the host asks for B1's two-column drawer.
   * Compact and medium already shared the stacked layout (ruling 58).
   */
  const stacked = (columns ?? 1) === 1;
  // Ruling 497: a saved draft returns by invitation. `initial` (a host-supplied seed, such as the
  // profile's anchored open) still seeds directly; a saved draft does not. The composer opens empty
  // and offers "Continue your draft"; only that tap applies it.
  const seed: ComposerSeed = useMemo(() => initial || {}, [initial]);
  const [offerDone, setOfferDone] = useState(false);
  const [text, setText] = useState(seed.text || "");
  // The member's chosen verb; only a tap sets it (635).
  const [verb, setVerb] = useState<ComposerVerb | null>(seed.verb || initialVerb || null);
  // DIA's proposal; never marks a chip (667).
  const [proposed, setProposed] = useState<ComposerVerb | null>(seed.proposed || null);
  const [overridden, setOverridden] = useState(!!(seed.overridden || initialVerb));
  const [fv, setFv] = useState<FieldValues>(seed.fields || {});
  const [images, setImages] = useState<ComposerImage[]>(seed.images || []);
  const [link, setLink] = useState<ComposerLink | null>(seed.link || null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<Audience>(
    seed.audience || (anchor ? "anchored" : "everyone"),
  );
  const [asSpace, setAsSpace] = useState(seed.asSpace || "");
  const [dia, setDia] = useState<{ state: DiaLineState; text?: string | undefined }>(
    seed.dia || { state: null },
  );
  const [diaRecord, setDiaRecord] = useState<DiaRecord | null>(seed.diaRecord || null);
  const [drafted, setDrafted] = useState(false);
  // The offer stands while the composer is untouched and a draft exists for this host context.
  const invited = !!draft && !initial && !initialVerb;
  const [picker, setPicker] = useState(false);
  // Ruling 665: publish in flight, and the caller's failure message.
  const [pending, setPending] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  // Ruling 664: the supplied form's single validity report; unset means invalid.
  const [formValid, setFormValid] = useState(false);
  // Ruling 672: a disabled chip's reason, shown in the DiaLine slot after a touch tap; the next tap
  // in the row clears it.
  const [reasonShown, setReasonShown] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const run = useRef(0);
  const kb = useKeyboardHeight(open && touch && stacked);
  // The verb whose form mounts: chosen, else proposed (635).
  const active: ComposerVerb | null = verb || proposed;
  const c: ComposerVerb = active || "convey";
  const schema = active ? VERB_SCHEMA[active] : UNTYPED;
  const form: ComposerForm | undefined = active ? forms[active] : undefined;
  const uploading = images.some((i) => i.pending);
  const has =
    text.trim().length > 0 ||
    images.length > 0 ||
    !!link ||
    Object.values(fv).some((f) => f && f.value);
  const setField = (key: FieldKey, value: string | boolean, mine = true) =>
    setFv((s) => ({ ...s, [key]: { value, mine } }));
  // Ruling 664: a supplied form's keys are namespaced `{verb}.{key}` in the store; the form sees
  // them un-prefixed.
  const ns = active ? active + "." : "";
  const formFields = useMemo<FormFieldValues>(
    () =>
      Object.fromEntries(
        Object.entries(fv)
          .filter(([k]) => k.startsWith(ns))
          .map(([k, v]) => [k.slice(ns.length), v]),
      ) as FormFieldValues,
    [fv, ns],
  );
  const formSetField = (key: string, value: string | boolean, mine = true) =>
    setField((ns + key) as FieldKey, value, mine);
  const formMine = (k: string) => {
    const f = fv[(ns + k) as FieldKey];
    return !!(f && f.mine);
  };
  const nsRead = (k: string): FieldValue | undefined => fv[(ns + k) as FieldKey];
  // A new verb's form has not reported yet; mount itself does not reset a report already made.
  const prevActive = useRef(active);
  useEffect(() => {
    if (prevActive.current !== active) {
      prevActive.current = active;
      setFormValid(false);
    }
  }, [active]);
  // The offer stands only while the composer is still empty; once the member has typed, applying
  // the draft would overwrite their own words.
  const showOffer = invited && !offerDone && !has;

  // Ruling 497. Continuing applies the saved draft in one act; discarding clears it and the offer.
  const continueDraft = () => {
    const d = draft;
    if (!d) return;
    setText(d.text || "");
    setVerb(d.verb || null);
    setProposed(d.proposed || null);
    setOverridden(!!d.overridden);
    setFv(d.fields || {});
    setImages(d.images || []);
    setLink(d.link || null);
    setAudience(d.audience || (anchor ? "anchored" : "everyone"));
    setAsSpace(d.asSpace || "");
    setDia(d.dia || { state: null });
    setDiaRecord(d.diaRecord || null);
    setDrafted(true);
    setOfferDone(true);
  };
  const discardDraft = () => {
    setOfferDone(true);
    setDrafted(false);
    onDraft?.(null);
  };

  // Inference: debounce, pending state, resolve or stay silent. Never after the member has chosen.
  useEffect(() => {
    if (!open || overridden || !infer || (initial && initial.hold)) return;
    const t = text.trim();
    if (t.length < MIN_INFER_CHARS) {
      if (!overridden) {
        setProposed(null);
        setDia({ state: null });
      }
      return;
    }
    const id = ++run.current;
    const h = setTimeout(async () => {
      setDia({ state: "thinking" });
      const started = Date.now();
      const res = await Promise.race([
        infer(t),
        new Promise<null>((r) => setTimeout(() => r(null), THINK_BUDGET)),
      ]).catch(() => null);
      if (id !== run.current) return;
      // A disabled verb is never proposed (53).
      if (!res || !res.c || disabledVerbs[res.c]) {
        setDia({ state: null });
        return;
      }
      // 635, 667: proposed, never selected. The chip stays unchecked; the DiaLine and the proposed
      // fields carry the read.
      setProposed(res.c);
      setFv((s) => {
        const n: FieldValues = { ...s };
        (Object.entries(res.fields || {}) as [FieldKey, string | boolean][]).forEach(([k, v]) => {
          const cur = n[k];
          if (!cur || !cur.mine) n[k] = { value: v, mine: false };
        });
        return n;
      });
      // Accepted only by the member's tap on the proposed chip (668); recorded there.
      setDiaRecord({
        verb: res.c,
        confidence: res.confidence ?? null,
        proposed_fields: res.fields || {},
        accepted: false,
        member_overrode: false,
        latency_ms: res.latency_ms ?? Date.now() - started,
      });
      setDia({ state: "done", text: res.line || DIA_LINE[res.c] });
    }, INFER_DEBOUNCE);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, open, overridden]);

  // Draft autosave (ruling 56): server-side through onDraft. The indicator is the only trace.
  const snapshot = (): ComposerState => ({
    text,
    verb,
    proposed,
    overridden,
    fields: fv,
    images: images.filter((i) => !i.pending && i.storage_path),
    link,
    audience,
    asSpace,
    dia,
    diaRecord,
  });
  const latest = useRef<{ has: boolean; state: ComposerState; dirty: boolean; published: boolean }>(
    {
      has,
      state: snapshot(),
      dirty: false,
      published: false,
    },
  );
  latest.current = { ...latest.current, has, state: snapshot() };
  useEffect(() => {
    if (!open || !onDraft) return;
    latest.current.dirty = true;
    const h = setTimeout(() => {
      // Ruling 287: no draft writer runs once a publish has been initiated. A timer already in
      // flight when Publish is pressed would otherwise fire during or just after the RPC and upsert
      // the draft back with the post id the RPC has just consumed. `dirty` is left as it is, so the
      // unmount flush, which refuses on the same flag, still agrees with this one.
      if (latest.current.published) return;
      latest.current.dirty = false;
      if (has) {
        onDraft(latest.current.state);
        setDrafted(true);
      } else {
        onDraft(null);
        setDrafted(false);
      }
    }, DRAFT_DEBOUNCE);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, verb, proposed, fv, images, link, audience, asSpace, has, open]);
  // Closing with content keeps the draft: flush a pending debounce when the composer unmounts.
  useEffect(() => {
    return () => {
      const l = latest.current;
      if (onDraft && l.dirty && !l.published) onDraft(l.has ? l.state : null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open && taRef.current && !touch) taRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || touch) return;
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canPublish) void publish();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const notThis = () => {
    setOverridden(true);
    setProposed(null);
    setVerb(null);
    setDia({ state: null });
    setFv(
      (s) => Object.fromEntries(Object.entries(s).filter(([, f]) => f && f.mine)) as FieldValues,
    );
    setDiaRecord((r) => (r ? { ...r, accepted: false, member_overrode: true } : r));
  };
  // A hand-picked verb silences the read (53, 635). 668: a tap on the proposed chip is the
  // acceptance and keeps DIA's fills; another chip is an override.
  const choose = (v: ComposerVerb) => {
    if (disabledVerbs[v]) return;
    setOverridden(true);
    setVerb(v);
    setProposed(null);
    setDia({ state: null });
    setDiaRecord((r) => (r ? { ...r, accepted: r.verb === v, member_overrode: r.verb !== v } : r));
  };
  // 672: touch only. A tap on a disabled chip changes no selection and shows its reason in the
  // DiaLine slot; the next tap anywhere in the row clears it. Pointer keeps title and
  // aria-description (correction 7). The chip is read at the row.
  const rowTap = (disabledVerb: ComposerVerb | null) => {
    if (reasonShown) {
      setReasonShown(null);
      return;
    }
    if (disabledVerb && disabledVerbs[disabledVerb]) setReasonShown(disabledVerbs[disabledVerb]!);
  };

  // Armed drop state (ruling 107, pointer): the whole fields column is the target. dragenter and
  // dragleave nest, so a depth counter tells a real exit from a move between children.
  const hasFiles = (e: DragEvent<HTMLElement>) =>
    !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
  const dragProps = touch
    ? {}
    : {
        onDragEnter: (e: DragEvent<HTMLFieldSetElement>) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current++;
          setArmed(true);
        },
        onDragOver: (e: DragEvent<HTMLFieldSetElement>) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = images.length >= maxImages ? "none" : "copy";
          if (!armed) setArmed(true);
        },
        onDragLeave: (e: DragEvent<HTMLFieldSetElement>) => {
          if (!hasFiles(e)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setArmed(false);
        },
        onDrop: (e: DragEvent<HTMLFieldSetElement>) => {
          e.preventDefault();
          dragDepth.current = 0;
          setArmed(false);
          addFiles(e.dataTransfer.files);
        },
      };
  useEffect(() => {
    if (!open) return;
    const end = () => {
      dragDepth.current = 0;
      setArmed(false);
    };
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, [open]);

  const addFiles = (files: FileList | File[] | null) => {
    const list = Array.from(files || [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, maxImages - images.length));
    list.forEach((f) => {
      const preview = URL.createObjectURL(f);
      const img: ComposerImage = { preview, pending: !!upload };
      setImages((s) => (s.length < maxImages ? [...s, img] : s));
      if (upload) {
        upload(f)
          .then((res) => {
            setImages((s) =>
              res
                ? s.map((i) =>
                    i.preview === preview
                      ? {
                          ...i,
                          storage_path: res.storage_path,
                          width: res.width,
                          height: res.height,
                          pending: false,
                        }
                      : i,
                  )
                : s.filter((i) => i.preview !== preview),
            );
          })
          .catch(() => setImages((s) => s.filter((i) => i.preview !== preview)));
      }
    });
    setPicker(false);
  };

  const addLink = async () => {
    const u = url.trim();
    if (!u) return;
    const host = domainOf(u);
    setLink({ url: u, domain: host });
    setLinkOpen(false);
    setUrl("");
    if (unfurl) {
      const meta = await unfurl(u).catch(() => null);
      if (meta)
        setLink((l) =>
          l && l.url === u
            ? {
                ...l,
                title: meta.title ?? undefined,
                description: meta.description ?? undefined,
                image: meta.image ?? undefined,
                domain: meta.domain ?? l.domain,
              }
            : l,
        );
    }
  };

  const space = spaces.find((s) => s.id === asSpace);
  // 671, preview by convention: with a supplied form the preview reads exactly `{c}.title` and
  // `{c}.meta` from the store and nothing else of the form's; its action row is the card's fixed
  // vocabulary, never VERB_SCHEMA[c].action. Without a form, unchanged.
  const convTitle = form ? nsRead("title") : undefined;
  const convMeta = form ? nsRead("meta") : undefined;
  const view: PostView = {
    c_category: c,
    verb: active,
    author_kind: space ? "space" : "member",
    author_name: space ? space.name : author.name,
    author_avatar: space ? undefined : author.avatar,
    body: text,
    anchor_name: anchor && anchor.name,
    audience,
    fields: form ? (convTitle ? { title: convTitle } : {}) : fv,
    meta:
      form && typeof convMeta?.value === "string" && convMeta.value ? convMeta.value : undefined,
    media: images.map((i) => ({ src: i.preview, width: i.width, height: i.height })),
    link: link
      ? { url: link.url, domain: link.domain, title: link.title, image: link.image }
      : null,
  };

  // 664: a supplied form gates Publish on its report alone. 668: proposed alone never publishes.
  // VERB_SCHEMA verbs keep `has`.
  const canPublish =
    !!onPublish && !pending && !uploading && !(proposed && !verb) && (form ? formValid : has);

  // Ruling 665 / 666: in flight the fields stay mounted and read-only and Publish reads
  // "Publishing"; failure lands the caller's message in Sheet's error slot with the draft
  // untouched; resolution closes through onClose('published').
  // Production divergence (handoff 58-12C2): what the composer held when it closed, for the
  // recorder. Read at the moment of the close, never earlier.
  const closeDetail = (): ComposerCloseDetail => ({
    verb: active,
    hadText: has,
    diaAccepted: !!diaRecord?.accepted,
  });

  const publish = async () => {
    if (!onPublish || !canPublish) return;
    setFail(null);
    setPending(true);
    // Mark before the host closes the shell so the unmount flush never re-saves a published draft.
    latest.current.published = true;
    try {
      await onPublish(snapshot());
      setPending(false);
      onClose?.("published", closeDetail());
    } catch (err) {
      latest.current.published = false;
      setPending(false);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Publishing did not go through. Your draft is here. Try again.";
      setFail(msg);
    }
  };

  const preview = has ? <PostCardRouter view={view} preview /> : null;

  const diaTag = (
    <span
      style={{
        marginLeft: 8,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        fontWeight: 500,
      }}
    >
      DIA
    </span>
  );

  const fieldEl = (f: VerbField): ReactNode => {
    const v = fv[f.key] || { value: "", mine: true };
    const filled = v.value != null && v.value !== "" && v.value !== false;
    const lab = (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {f.label}
        {filled && !v.mine && diaTag}
      </span>
    );
    if (f.kind === "toggle")
      return (
        <Switch
          key={f.key}
          label={f.label}
          checked={!!v.value}
          onChange={(x) => setField(f.key, x)}
          style={{ width: "100%", paddingRight: 2 }}
        />
      );
    // 673: the Segment part, the Composer its first caller.
    if (f.kind === "segment")
      return (
        <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>{lab}</div>
          <Segment
            label={f.label}
            options={fieldOptions?.[f.key] ?? f.options ?? []}
            value={typeof v.value === "string" ? v.value : undefined}
            onChange={(o) => setField(f.key, o)}
          />
        </div>
      );
    return (
      <Input
        key={f.key}
        label={lab}
        multiline={f.multiline}
        rows={2}
        value={typeof v.value === "string" ? v.value : ""}
        onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setField(f.key, e.target.value)
        }
      />
    );
  };

  const attach = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {touch ? (
          <IconButton
            name="image"
            label="Add an image"
            active={picker}
            onClick={() => setPicker((p) => !p)}
            disabled={images.length >= maxImages}
          />
        ) : (
          <IconButton
            name="image"
            label="Add an image"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={images.length >= maxImages}
          />
        )}
        <IconButton
          name="link"
          label="Add a link"
          active={linkOpen}
          onClick={() => setLinkOpen((o) => !o)}
        />
        <span style={{ flex: 1 }} />
        {!touch && (
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Drop images anywhere here</span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      {picker && touch && (
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => camRef.current && camRef.current.click()}>
            <Icon name="camera" size={20} />
            Take a photo
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current && fileRef.current.click()}>
            <Icon name="images" size={20} />
            Choose from library
          </Button>
        </div>
      )}
      {linkOpen && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Input
            label="Link"
            placeholder="https://"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setUrl(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addLink();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button variant="secondary" onClick={() => void addLink()} disabled={!url.trim()}>
            Add
          </Button>
        </div>
      )}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <span
              key={img.preview + i}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              <img
                src={img.preview}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: img.pending ? 0.6 : 1,
                }}
              />
              {/* G136: the placement sits on a wrapper, so the Tooltip's host span wraps the button
                  and the tooltip is placed against it; the button lands where it did. */}
              <span style={{ position: "absolute", top: -8, right: -8, display: "flex" }}>
                <IconButton
                  name="x"
                  label="Remove image"
                  size={44}
                  onClick={() => setImages((s) => s.filter((_, j) => j !== i))}
                  style={{ color: "var(--on-fill)", background: "var(--scrim)" }}
                />
              </span>
            </span>
          ))}
        </div>
      )}
      {link && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 6px 6px 12px",
            border: "1px solid var(--line)",
            borderRadius: 10,
            fontSize: 15,
          }}
        >
          <Icon name="link" size={18} style={{ color: "var(--ink-3)" }} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {link.title || link.domain}
          </span>
          <IconButton name="x" label="Remove link" onClick={() => setLink(null)} />
        </div>
      )}
    </div>
  );

  // 664: the verb's owner authors its form as content inside the locked shell; it is rendered as a
  // component keyed on the verb so its own hooks mount and unmount with it. Falls back to
  // VERB_SCHEMA's fields when no form is given for the verb.
  const Form = form;
  const formBody = Form ? (
    <Form
      key={active ?? "none"}
      fields={formFields}
      setField={formSetField}
      mine={formMine}
      tier={tier}
      diaTag={diaTag}
      proposed={!verb && !!proposed}
      reportValidity={setFormValid}
    />
  ) : (
    schema.fields.map(fieldEl)
  );

  const free = maxImages - images.length;
  // Ruling 665: the fields column is a fieldset so an in-flight publish disables every control in
  // one attribute and reads aria-busy, with the draft still visible.
  const fields = (
    <fieldset
      {...dragProps}
      disabled={pending || undefined}
      aria-busy={pending || undefined}
      data-drop-target
      data-armed={armed ? "1" : "0"}
      style={{
        all: "unset",
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        borderRadius: 14,
        outlineStyle: "dashed",
        outlineWidth: 1.5,
        outlineColor: armed ? "var(--c-" + c + ")" : "transparent",
        outlineOffset: 12,
        background: armed ? "var(--c-" + c + "-tint)" : "transparent",
        opacity: pending ? 0.6 : 1,
        transition:
          "background var(--dur-default) var(--ease), opacity var(--dur-default) var(--ease)",
      }}
    >
      {armed && (
        <div
          aria-live="assertive"
          data-drop-armed
          style={{
            position: "absolute",
            inset: -12,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            borderRadius: 14,
            background: "var(--c-" + c + "-tint)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1.5px solid var(--c-" + c + ")",
              color: "var(--ink)",
              fontSize: 15,
              fontWeight: 500,
              boxShadow: "var(--shadow-3)",
            }}
          >
            <Icon name="upload" size={20} style={{ color: "var(--c-" + c + "-text)" }} />
            {free <= 0
              ? "Four images is the limit"
              : free === 1
                ? "Drop to add 1 image"
                : "Drop to add up to " + free + " images"}
          </div>
        </div>
      )}
      {showOffer && (
        <div
          data-draft-offer
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "10px 12px",
            borderRadius: "var(--radius-m)",
            background: "var(--bg-sunken)",
            fontSize: 15,
            color: "var(--ink-2)",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>You have a draft here.</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={continueDraft}
            data-testid="continue-draft"
          >
            Continue your draft
          </Button>
          <Button variant="ghost" size="sm" onClick={discardDraft} data-testid="discard-draft">
            Discard
          </Button>
        </div>
      )}
      {/* Ruling 458: the chip row sits directly above the text area and is always visible. */}
      <VerbRow
        value={verb}
        onChoose={choose}
        compact={stacked}
        disabled={disabledVerbs}
        onRowTap={touch ? rowTap : undefined}
      />
      <textarea
        ref={taRef}
        aria-label="What is going on with you"
        placeholder="What is going on with you?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={stacked ? 4 : 6}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "none",
          outline: "none",
          resize: "none",
          background: "transparent",
          color: "var(--ink)",
          fontFamily: "var(--font-sans)",
          fontSize: 19,
          lineHeight: 1.5,
          padding: 0,
          minHeight: 44,
        }}
      />
      {reasonShown ? (
        <div
          role="status"
          aria-live="polite"
          data-verb-reason
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 24,
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.4,
            color: "var(--ink-3)",
          }}
        >
          {reasonShown}
        </div>
      ) : (
        <DiaLine state={dia.state} text={dia.text} onNotThis={notThis} />
      )}
      {active && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingTop: 4,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "var(--c-" + active + "-text)",
              paddingTop: 12,
            }}
          >
            {VERB_ACT[active]}
          </div>
          {formBody}
        </div>
      )}
      {attach}
      <AudienceSelect value={audience} onChange={setAudience} anchor={anchor && anchor.name} />
    </fieldset>
  );

  const header = (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "calc(var(--space-3) / 2) var(--space-2) calc(var(--space-3) / 2) var(--space-5)", // 1217: the 57px toolbar row at every tier
        borderBottom: "1px solid var(--line)",
        flex: "none",
      }}
    >
      <Avatar
        name={view.author_name}
        src={view.author_avatar}
        size={32}
        style={space ? { borderRadius: 6 } : undefined}
      />
      {spaces.length ? (
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <select
            aria-label="Post as"
            value={asSpace}
            onChange={(e) => setAsSpace(e.target.value)}
            disabled={pending}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ink)",
              padding: "0 24px 0 4px",
              minHeight: 44,
              cursor: "pointer",
            }}
          >
            <option value="">{author.name}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={16}
            style={{ position: "absolute", right: 4, color: "var(--ink-3)", pointerEvents: "none" }}
          />
        </div>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 700, padding: "0 4px" }}>{author.name}</span>
      )}
      {anchor && (
        <span
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          in {anchor.name}
        </span>
      )}
      <span style={{ flex: 1 }} />
      {drafted && has && <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Draft saved</span>}
      <IconButton name="x" label="Close" onClick={() => onClose?.(undefined, closeDetail())} />
    </header>
  );

  const publishBtn = (
    <Button
      c={active || undefined}
      disabled={!canPublish}
      aria-busy={pending || undefined}
      onClick={() => void publish()}
      full={tier === "compact"}
    >
      {pending ? "Publishing" : "Publish"}
    </Button>
  );
  const col = {
    width: "100%",
    boxSizing: "border-box" as const,
  };
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <Sheet
      open={open}
      onClose={() => onClose?.(undefined, closeDetail())}
      variant={tier === "compact" ? "sheet" : "drawer"}
      label="Compose"
      contained={contained}
      keyboardHeight={kb}
      // Ruling 492: 80 percent tall on compact; on medium and expanded the width is
      // --sheet-composer-ratio, min(60%, the feed card's width plus padding) (1219, 1220). Never full screen; B1's 1000px drawer is retired.
      width={COMPOSER_SHEET_WIDTH}
      // Ruling 665: the caller's failure message, above the action row, with the draft intact.
      error={fail}
      // Ruling 480: the action row is a footer in the dialog's flex column, never an overlay.
      actions={
        tier === "compact" ? (
          <div style={{ ...col, display: "flex" }}>{publishBtn}</div>
        ) : (
          <>
            <span style={{ marginRight: "auto", fontSize: 13, color: "var(--ink-3)" }}>
              {isMac ? "⌘ Enter to publish · Esc to close" : "Ctrl Enter to publish · Esc to close"}
            </span>
            {publishBtn}
          </>
        )
      }
    >
      {header}
      {stacked ? (
        <Fragment>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 24px" }}>
            <div style={{ ...col, display: "flex", flexDirection: "column", gap: 24 }}>
              {fields}
              {preview && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 13,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      color: "var(--ink-3)",
                    }}
                  >
                    How it will appear
                  </div>
                  {preview}
                </div>
              )}
            </div>
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 400px",
            }}
          >
            <div
              style={{
                overflowY: "auto",
                padding: "20px 24px 24px",
                borderRight: "1px solid var(--line)",
              }}
            >
              {fields}
            </div>
            <div style={{ overflowY: "auto", padding: "20px 24px", background: "var(--bg)" }}>
              {preview}
            </div>
          </div>
        </Fragment>
      )}
    </Sheet>
  );
}

export { AUDIENCE_LABEL };
