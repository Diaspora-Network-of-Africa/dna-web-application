// The one vocabulary read (rulings 193, 194). Every fixed vocabulary a surface offers comes from
// public.vocabularies() at runtime; no component keeps a list of its own, and nothing here supplies
// a default. A vocabulary that fails to load is absent, and the control that reads it renders empty
// (ruling 194: grounded-or-empty applies to an option list exactly as it applies to a card).
//
// Named for the projection, not for a surface: Profile (Brief 3), the Composer (Brief 1) and the
// Feed (Brief 2) all read this one path.
import type { Stance } from "@/components/dna/StanceBlock";
import type { C } from "@/components/strand/cmeta";
import type { ConveneLensId, DiscoveryLaneId } from "./discovery";
import { getSupabase, type Supabase } from "./supabase";

export type Vocabularies = {
  focus: string[];
  industries: string[];
  regions: string[];
  skills: string[];
  languages: string[];
  intent: string[];
  interests: string[];
  countries: string[];
  /** Current location list (ruling 142): the world; countries is the African list. */
  world: string[];
  /** Ruling 187: the stance vocabulary from public.member_stances, in its own position order. */
  stances: { value: Stance; label: string }[];
  heritage: string[];
  pathway: string[];
  timeline: string[];
  /**
   * Ruling 193: the contribute_instrument enum, in enum order. Machine values with the label the
   * projection derives, because unlike the other three enums this one's values are not display text.
   */
  instrument: { value: string; label: string }[];
  /** Rulings 1018 and 678: the roles a host can name on an event, and the verb its invitation reads. */
  event_roles: { value: string; label: string; verb: string }[];
  /** Rulings 657, 1037 and 1038: Convene's category families, in the discovery report's order. */
  convene_families: { value: string; label: string; schema_org: string[] }[];
  /**
   * Rulings 693, 925, 729, 1041 and 1093: Convene's lens set, All then the four who-lenses. The id is
   * structural; every word a surface shows comes from here.
   */
  convene_lenses: {
    value: ConveneLensId;
    name: string;
    short: string;
    icon: string;
    scope: string;
  }[];
  /** Rulings 1092, 1105, 1124 and 1172: Discovery's ten lanes, in their base order, each with its name. */
  convene_lanes: { value: DiscoveryLaneId; name: string }[];
  /**
   * Ruling 1186: the kinds of host-written block an event page holds, in page order, each with the
   * heading its section shows. No surface keeps a heading map; the first consumer is Brief 8's Hub.
   */
  event_block_kinds: { value: string; label: string }[];
  /** Brief 14 (1331): Messenger's thread kinds; surfaced false marks respond and introduction. */
  thread_kinds: { value: string; label: string; surfaced: boolean }[];
  /** Brief 14 (1348): the three mute durations. */
  message_mute_durations: { value: string; label: string }[];
  /** Brief 14 (1349): the six report reasons, as Extraction 41-14 rendered them. */
  message_report_reasons: { value: string; label: string }[];
  /**
   * Brief 14, 41-E (1403, 1577): the quick bar's eight emoji in 1403's order, the character as
   * `value` and E9's glyph name as `label`. A bar that reads none renders empty, never literals.
   */
  message_reaction_quick: { value: string; label: string }[];
  /** Ruling 1177: the platform roles and their labels, in position order; the admin console's bar reads a role's label here. */
  platform_role_kinds: { value: string; label: string }[];
  /** Handoff 45-D (1381, 1393): the admin app's appearances; system follows each device. */
  admin_appearances: { value: string; label: string }[];
  /** Handoff 45-D (1304, 1392): the Overview's grains, values as the projections take them. */
  overview_grains: { value: string; label: string }[];
  /** Handoff 45-D (1304, 1392): the Overview's comparisons. */
  overview_comparisons: { value: string; label: string }[];
  /**
   * Handoff 45-D (1382, 1394): the reporting zones by IANA identifier, each with its name and city,
   * and the standard abbreviation shown only where the runtime names the zone by a bare offset.
   */
  reporting_zones: { value: string; name: string; city: string; abbreviation: string }[];
  /**
   * Handoff 55-A (1318, 1325, 490): the notification kinds in position order. No component keeps a
   * kind map; the row's C and its destination line come from here.
   */
  notification_kinds: NotificationKindRow[];
  /**
   * Handoff 60-NC (1554): the email modes in the order the email view's Segment shows them. The one
   * owner of the mode set; no component keeps a mode label.
   */
  notification_email_modes: { value: string; label: string }[];
  /**
   * Handoff 60-NC (1555): the email categories, the five Cs then system, keyed by c_category. The
   * email view's row labels come from here.
   */
  notification_categories: { value: string; label: string }[];
  /**
   * Handoff 62-A (1798, 1818, 1819): the six reactions of a Feed post in the bar's order, each with
   * its class (public or intent), its emoji character, its label verbatim and Asante's glosses keyed
   * by language. No component keeps the six as literals; a bar that reads none renders empty.
   */
  post_reaction_kinds: PostReactionKindRow[];
};

/** One reaction kind (62-A). `glosses` is empty for every kind but asante. */
export type PostReactionKindRow = {
  value: string;
  class: "public" | "intent";
  emoji: string;
  label: string;
  glosses: Record<string, string>;
};

/**
 * One notification kind (1318). `c` is null where the kind takes its C from the object's context
 * (`c_from_object`, 1325), and the row's own `c_category` then names it. A kind renders only where
 * `renders` holds and the row part has a sentence for it (src/components/strand/NotificationListItem).
 */
export type NotificationKindRow = {
  value: string;
  c: C | null;
  c_from_object: boolean;
  destination: string | null;
  renders: boolean;
};

export async function loadVocabularies(): Promise<Vocabularies | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("vocabularies");
  if (error) throw error;
  return (data as unknown as Vocabularies) ?? null;
}

/**
 * The instrument labels the Feed needs to render a Need's row, keyed by enum value. Empty when the
 * vocabulary does not load, which leaves the row absent rather than guessed (ruling 194). Cached for
 * the session because a feed page hydrates many posts and the vocabulary does not move under them.
 */
let instrumentCache: Record<string, string> | null = null;

export async function instrumentLabels(sb: Supabase): Promise<Record<string, string>> {
  if (instrumentCache) return instrumentCache;
  const { data, error } = await sb.rpc("vocabularies");
  if (error || !data || typeof data !== "object") return {};
  const rows = (data as unknown as Partial<Vocabularies>).instrument;
  if (!Array.isArray(rows)) return {};
  const map: Record<string, string> = {};
  for (const r of rows) if (r && r.value && r.label) map[r.value] = r.label;
  instrumentCache = map;
  return map;
}
