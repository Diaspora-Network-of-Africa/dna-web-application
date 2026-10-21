// Convene Pass 1, step 3: the form Convene supplies to Strand's Composer through `forms.convene`
// (P1-SPEC section 3, rulings 580, 621, 664 to 668, 671, 673, 676, 520, 521, 633, 634). Five named
// sections in order (the invitation, the moment, the door, the program, the send-off), then More
// options in place. Fields that do not apply are absent, never disabled. Every control is
// Strand's; Format and Tickets are the Segment part (673). Keys are un-prefixed here and stored as
// `convene.{key}` by the Composer (664); the read-back lines and the meta line are derived from
// the store and written back as fields of their own (starts_at, ends_at, doors_at, timezone,
// place_text, delivery_intent, expected_window_start, expected_window_end, meta) so publish_post
// reads instants and sentences, never words it has to parse.
//
// Ported from the packet's `convene/p1-convene-form.js` with two stand-ins replaced: place lookup
// is the place-resolve Edge Function (PR 2) and date parsing is src/lib/when.ts. The copy is the
// packet's confirmed content, byte for byte.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/strand/Button";
import { Chip } from "@/components/strand/Chip";
import type { ComposerFormProps } from "@/components/strand/Composer";
import { Icon } from "@/components/strand/Icon";
import { Input } from "@/components/strand/Input";
import { Segment } from "@/components/strand/Segment";
import { Select } from "@/components/strand/Select";
import { Sheet } from "@/components/strand/Sheet";
import { ConvenePlate } from "@/components/dna/ConvenePlate";
import { resolvePlace, type ResolvedPlace, type SuggestedPlace } from "@/lib/dia";
import type { Home } from "@/lib/homes";
import { placeLine, placeParts } from "@/lib/place";
import {
  dateLine,
  instantFor,
  knownZone,
  parseTimeWords,
  parseWhen,
  timeInZone,
  weekdayContradiction,
  windowFor,
} from "@/lib/when";

export type ConveneFormProps = ComposerFormProps & {
  /** The poster: `Presented by` reads their name and is not editable at launch (674). */
  author: { name: string };
  /**
   * The member's homes (633); with none, the line and the chips are absent (690). A tap sets the
   * event's country and the city words together (Session 24); the home's point then narrows the
   * lookup inside that country and anchors nothing alone.
   */
  homes: Home[];
  /**
   * Session 24 (783, 786, 796, 797): the country vocabulary the Country control offers, read at
   * runtime from public.world_countries through the one vocabulary path, in the table's position
   * order. No list lives here. Empty when the read failed, and the control then offers nothing but
   * its placeholder (ruling 194).
   */
  countries: string[];
  /**
   * The member's stated country (public.members.current_country), for ordering only: it is listed
   * first and never selected. Nothing selects a country except the member's choice or a home chip.
   */
  statedCountry: string | null;
  /** The member's Spaces, for More options (Canon 6). */
  spaces: { id: string; name: string }[];
  /** The host's browser zone: an online-only event's zone until a first home exists (ruling owed 7). */
  browserTz: string;
};

type Format = "" | "in_person" | "online" | "hybrid";
type Lookup =
  | { state: "idle" }
  | { state: "none" }
  | { state: "several"; places: SuggestedPlace[] }
  | { state: "unavailable" };

const LOOKUP_PAUSE_MS = 400;
const MIN_QUERY = 3;
// 815: the cap `publish_post` and `event_delivery`'s own constraint both carry. It is here as well
// because a door that holds one of the function's three refusals and not the others still sends the
// member to meet the other two after the Publish, which is the thing the door exists to prevent.
// A Google Maps directions URL in its encoded form runs long enough for this to be reachable.
const MAP_LINK_MAX = 2048;

const CAPS = {
  fontSize: 13,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  fontWeight: 500,
  color: "var(--ink-3)",
};
const QUIET = { fontSize: 15, lineHeight: 1.45, color: "var(--ink-3)" };
const TEXTBTN = {
  all: "unset" as const,
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
const ROW_BOX = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: 10,
  padding: "6px 12px",
  minHeight: 44,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-m)",
  fontSize: 15,
  boxSizing: "border-box" as const,
};

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
// Session 24: a home's country (Mapbox's English name) against the vocabulary's spelling.
const foldName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

export function ConveneForm({
  fields,
  setField,
  mine,
  tier,
  diaTag,
  reportValidity,
  author,
  homes,
  spaces,
  browserTz,
  countries,
  statedCountry,
}: ConveneFormProps) {
  const v = (k: string): string => {
    const f = fields[k]?.value;
    return typeof f === "string" ? f : "";
  };
  const flag = (k: string): boolean => fields[k]?.value === true;
  const wide = tier !== "compact";
  const [more, setMore] = useState(false);
  const [windowMode, setWindowMode] = useState(!!v("when_window"));
  const [homeId, setHomeId] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  // Session 23, change 4: Change puts the field into an editing state that holds the resolved
  // row's words and does not look them up again until the text actually changes. Without it the
  // lookup effect saw the same words with no row and re-resolved them before the member could type.
  const [editingFrom, setEditingFrom] = useState<string | null>(null);
  // The chosen country's IANA zones, as the `anchor` dry run answered them (813, 817). Held with
  // the country they belong to so a zone list never outlives the country that asked for it.
  const [zoneList, setZoneList] = useState<{ country: string; zones: string[] | null } | null>(
    null,
  );
  // Pass 4 (P4-SPEC section 3). `infoOpen` is the `Why is my venue not here?` panel. The drag state
  // that sat beside it went with the host-placed pin (ruling 929).
  const [infoOpen, setInfoOpen] = useState(false);
  // The country whose lookup has answered with nothing at least once. P4-SPEC section 3 asks for
  // the info control in `Country chosen, place empty`, and says the panel's claim "renders only
  // where it is true" — but nothing in this tree knows which countries Mapbox holds venues for.
  // `place-resolve` answers one, several, none or unavailable and carries no coverage signal, and
  // `public.world_countries` is two columns, name and position. The two ways to render the drawn
  // state exactly are a hardcoded list of countries, which the fixed-vocabularies absolute
  // forbids, and a coverage column nobody has ratified. So the control waits for grounds: the
  // words this host typed in this country came back with nothing, which is the map's own zero and
  // is the only true thing the surface can say. Reported as the finding and logged as gap G44.
  const [noVenues, setNoVenues] = useState<string | null>(null);
  const session = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "s-" + Math.random().toString(36).slice(2),
  );

  // ---- the door -------------------------------------------------------------------------------
  const format = (v("format") || "") as Format;
  const physical = format === "in_person" || format === "hybrid";
  const virtual = format === "online" || format === "hybrid";
  const placeId = v("place_id");
  const query = v("place_query");
  const home = homes.find((h) => h.id === homeId) ?? null;
  // Session 24: the country the host set for the event, a public.world_countries name. It is the
  // anchor of every lookup (783), the value event_delivery.country stores whether or not a place
  // resolves (799), and never the member's residence.
  const country = v("country");
  const orderedCountries = useMemo(
    () =>
      statedCountry && countries.includes(statedCountry)
        ? [statedCountry, ...countries.filter((c) => c !== statedCountry)]
        : countries,
    [countries, statedCountry],
  );
  // A home's country is Mapbox's name for it; the vocabulary's spelling is matched by a fold so a
  // chip can set the control, and a home whose country the vocabulary does not carry sets no country.
  const vocabularyName = (name: string | null): string | null => {
    if (!name) return null;
    if (countries.includes(name)) return name;
    const key = foldName(name);
    return countries.find((c) => foldName(c) === key) ?? null;
  };
  // Session 23, change 2: a resolved area (place, locality, neighborhood) carries no place_id, so
  // publish_post keeps the member's words in place_text beside the area's name, city and point.
  const areaResolved = v("place_kind") === "area" && !!v("lat");
  const resolved = !!placeId || areaResolved;
  // 807: every composed place line goes through the one dedupe in src/lib/place.ts, so no part
  // repeats another. Mapbox returns the same string as `place_name` and `area` often enough that
  // the naive join printed it twice.
  const labelParts = resolved ? placeParts(v("place_name"), v("place_area"), v("city")) : [];
  const placeLabel = labelParts.join(", ");
  const placeText = physical && !placeId && query.trim().length >= MIN_QUERY ? query.trim() : "";
  // The resolved row reads the same parts as the intent line and in the same order: the member's
  // words for an area (784), the resolved label for a venue, then everything the dedupe kept after
  // them in the quiet ink, the country last (800).
  const rowLeadParts = areaResolved && placeText ? [placeText] : labelParts;
  const rowLead = rowLeadParts.join(", ");
  const rowTail = placeParts(...rowLeadParts, ...labelParts, country).slice(rowLeadParts.length);
  // Never without a country (SPEC 3, Session 24): the door is satisfied by a resolved place, or by
  // a country and at least three typed characters.
  const link = v("link").trim();
  const linkTba = flag("link_tba");
  const linkOk = isUrl(link);

  // The zone is derived, never asked (SPEC 4): the place's for in person and hybrid, the host's
  // browser zone for online (ruling owed 7), and the browser's again while a place stands as words
  // only, because words carry no zone.
  const placeTz = v("place_tz");
  // 813, 817, 821: with no resolved place the zone comes from the country the host chose, never
  // from the host's browser, because the same value interprets the host's typed time. `anchor`
  // answers that country's IANA zones from the function's own runtime ICU. One zone is taken
  // silently (168 countries, the whole corridor among them); several are asked for; null is a
  // runtime that could not say, and there the previous behaviour stands rather than a guess.
  const countryZones = zoneList && zoneList.country === country ? zoneList.zones : null;
  const chosenZone = v("country_tz");
  const zoneFromCountry: string | null = !countryZones
    ? null
    : countryZones.length === 1
      ? (countryZones[0] ?? null)
      : countryZones.includes(chosenZone)
        ? chosenZone
        : null;
  const needsZoneChoice = physical && !resolved && !!countryZones && countryZones.length > 1;
  const tz: string | null = !format
    ? null
    : physical
      ? knownZone(placeTz)
        ? placeTz
        : countryZones
          ? zoneFromCountry
          : browserTz
      : browserTz;
  const tzFromPlace = physical && resolved && knownZone(placeTz);

  // ---- Pass 4's place section (P4-SPEC sections 3 to 7) ----------------------------------------
  // The map's own point is a fact about the resolution, not a position on the plate: the plate
  // carries no projection in this build, so nothing here reads lat or lng as a place on screen.
  const mapPoint = physical && resolved && v("lat") !== "" && v("lng") !== "";
  // Ruling 929: the host-placed point is gone with the control that produced it. `pin_x` and
  // `pin_y` are not read, not written and not carried in the payload; the plate's remaining point
  // is the map's own, which has a coordinate behind it. See ConvenePlate's header and gap G43.
  const nothingFound = lookup.state === "none";
  // 814 and G35: the claim is about this country's coverage and renders only where it is true, so
  // the control appears once a country is chosen and the place field is still empty.
  const infoShown = physical && !!country && !resolved && !query.trim() && noVenues === country;
  // The plate appears once the host has said where to look: a country, and either a resolution or
  // enough typed words for the lookup to have run.
  const plateShown = physical && !!country && (resolved || query.trim().length >= MIN_QUERY);
  // 815: optional, and refused at publish when it is not a link. The form says so where the member
  // can still fix it, in the same words and the same shape the meeting link already uses.
  const mapLink = v("map_link").trim();
  const mapLinkOk = !mapLink || (isUrl(mapLink) && mapLink.length <= MAP_LINK_MAX);
  // The line reads only where the host chose (821); a country with one zone says nothing at all.
  const tzFromChoice = needsZoneChoice && !!zoneFromCountry;

  // ---- the moment ------------------------------------------------------------------------------
  const whenWords = v("when");
  const parsed = useMemo(() => (whenWords.trim() ? parseWhen(whenWords) : null), [whenWords]);
  const parseFailed = !windowMode && whenWords.trim() !== "" && !(parsed && parsed.time);
  const date = parsed?.date ?? (v("when_date") || null);
  const time = parsed?.time ?? (v("when_time") || null);
  const zoneForInstants = tz ?? browserTz;
  const startsAt = !windowMode && date && time ? instantFor(date, time, zoneForInstants) : null;
  const endsTime = parseTimeWords(v("ends"));
  const endsRaw = startsAt && date && endsTime ? instantFor(date, endsTime, zoneForInstants) : null;
  // 634: no end invented, and an end has to follow its start; anything else is left unwritten.
  const endsAt = endsRaw && startsAt && endsRaw > startsAt ? endsRaw : null;
  const doorsTime = parseTimeWords(v("doors"));
  const doorsAt =
    startsAt && date && doorsTime ? instantFor(date, doorsTime, zoneForInstants) : null;
  const windowWords = windowMode ? v("when_window").trim() : "";
  const window = windowWords ? windowFor(windowWords) : null;

  const startDate = startsAt ? new Date(startsAt) : null;
  // Ruling 836: where the weekday the host typed disagrees with the date those same words parsed
  // to, the disagreement is stated and the instant that will be stored is named beside it. The
  // field above still holds the host's own words: nothing is rewritten and nothing is silently
  // corrected. It waits on an instant, because until there is one there is nothing the event
  // "will be stored for" and the sentence would be naming a date the form has not settled.
  const weekdayLine =
    !windowMode && startDate && parsed?.date
      ? weekdayContradiction(whenWords, parsed.date, dateLine(startDate, zoneForInstants))
      : null;
  // Two readings of one moment, and since 898 they are not the same string. `whenText` is the
  // card's derived label (671): it carries the zone inline, as its IANA identifier and never as an
  // abbreviation, and 835's year, because a card reader has no second line to take either from.
  // `whenRead` is the composer's own read-back and names no zone at all — the sentence beneath it
  // does that, and says where the zone came from, which is the whole of what G40 was opened about.
  const momentText = startDate
    ? dateLine(startDate, zoneForInstants) + ", " + timeInZone(startDate, zoneForInstants)
    : "";
  const momentEnd = endsAt ? " to " + timeInZone(new Date(endsAt), zoneForInstants) : "";
  const windowText = windowWords ? windowWords + ", date to be confirmed" : "";
  const whenText = windowMode
    ? windowText
    : momentText
      ? momentText + (tz ? " " + tz : "") + momentEnd
      : "";
  const whenRead = windowMode ? windowText : momentText ? momentText + momentEnd : "";
  // P4-SPEC section 1, which closes G40: four ratified cases and two further readings, each a
  // sentence of its own rather than a comma suffix, and each naming the zone by its identifier.
  // The string `, time zone from the place once it is set` is deleted. It described a state the
  // form has not been in since 813 and 821 — it promised a zone the country had already decided —
  // and it stood in two of the old expression's three branches.
  const whenSuffix = windowMode
    ? ""
    : tzFromPlace
      ? "Time zone " + placeTz + ", from the place."
      : virtual && !physical
        ? "Time zone " +
          browserTz +
          ", from your device. An online event has no country to take it from."
        : tzFromChoice
          ? "Time zone " + zoneFromCountry + ", the zone you chose."
          : zoneFromCountry
            ? "Time zone " + zoneFromCountry + ", from the country."
            : needsZoneChoice
              ? "The time zone comes from the country, and this country has more than one."
              : "The time zone comes from the place, or from the country when no place resolves.";

  // ---- where, intent, validity, meta ------------------------------------------------------------
  // A venue replaces the words; an area stands beside them (change 2). Words that resolved to
  // nothing read with the country beside them, composed here and on the card at read (799), never
  // written into place_text.
  const whereText = placeId
    ? placeLabel
    : areaResolved
      ? placeLine(placeText, ...labelParts)
      : placeText && country
        ? placeLine(placeText, country)
        : placeText;
  const where =
    format === "online"
      ? "Online"
      : format === "hybrid"
        ? (v("city") || whereText) + (v("city") || whereText ? " and online" : "Online")
        : whereText;
  const intent = !format
    ? ""
    : [
        physical && whereText && country ? "In person at " + whereText : null,
        virtual
          ? linkOk
            ? "Online, link with your ticket"
            : linkTba
              ? "Online, link to be announced"
              : null
          : null,
      ]
        .filter(Boolean)
        .join(" and ");
  // 821: where the chosen country carries more than one zone and no place resolved, the door is not
  // satisfied until the host picks one. Nothing else about the door changes.
  const physicalOk =
    !!country &&
    (resolved || !!placeText) &&
    (!needsZoneChoice || !!zoneFromCountry) &&
    // 815: a map link that is not a link is refused by publish_post, so the door holds it here
    // rather than letting the member meet that refusal after the Publish.
    mapLinkOk;
  const virtualOk = linkOk || linkTba;
  const valid =
    !!v("title").trim() &&
    !!format &&
    (windowMode ? !!windowWords : !!startsAt) &&
    (!physical || physicalOk) &&
    (!virtual || virtualOk);
  const meta = ["Presented by " + author.name, whenText || null, where || null]
    .filter(Boolean)
    .join(" · ");

  // Reports on first render and on every change (664).
  useEffect(() => {
    reportValidity(valid);
  }, [valid, reportValidity]);

  // An event that stops being in person keeps no place section, so it keeps neither of the place
  // section's own values. Without this the host fills a map link, switches to Online, and the
  // field is gone while its value is still in the store: `publish_post` then refuses with
  // `A map link belongs to an event with a place.` about a field the form is no longer showing,
  // which is a refusal nobody can act on. `pin_x` and `pin_y` left this list with the control that
  // wrote them (ruling 929).
  useEffect(() => {
    if (physical) return;
    if (v("map_link") !== "") setField("map_link", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physical]);

  // The derived fields publish_post reads (and the preview's meta, 671), written only when they
  // change so the store settles in one pass.
  const derived: Record<string, string> = {
    starts_at: startsAt ?? "",
    ends_at: endsAt ?? "",
    doors_at: doorsAt ?? "",
    timezone: tz ?? "",
    place_text: placeText,
    delivery_intent: intent ? intent + "." : "",
    expected_window_start: window?.start ?? "",
    expected_window_end: window?.end ?? "",
    meta,
  };
  const derivedKey = JSON.stringify(derived);
  useEffect(() => {
    for (const [k, val] of Object.entries(derived)) if (v(k) !== val) setField(k, val, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedKey]);

  // ---- place lookup, resolved never typed (633, SPEC 3) ----------------------------------------
  const pick = (p: ResolvedPlace) => {
    setField("place_id", p.kind === "area" ? "" : p.place_id);
    setField("place_kind", p.kind);
    setField("place_name", p.place_name);
    setField("place_area", p.area ?? "");
    setField("city", p.city ?? "");
    // Ruling 927: the region Mapbox already returned, stored so a surface can name it without a
    // second lookup. Empty where the response carried none, which `publish_post` turns into null.
    setField("region", p.region ?? "");
    setField("lng", String(p.lng));
    setField("lat", String(p.lat));
    setField("place_tz", p.timezone);
    // A venue that resolves in this country is the map holding a venue record for it, so the
    // grounds for the coverage claim are gone. Without this the panel would tell a host that the
    // map holds no venues for Ghana immediately after finding one there.
    setNoVenues(null);
    setLookup({ state: "idle" });
  };
  const unpick = () => {
    for (const k of [
      "place_id",
      "place_kind",
      "place_name",
      "place_area",
      "city",
      "region",
      "lng",
      "lat",
      "place_tz",
    ])
      setField(k, "");
    setLookup({ state: "idle" });
  };
  // The Country control (786): the member's choice or a home chip, nothing else. A change from the
  // open state clears any resolution and keeps the words; a home whose country is not the new one
  // no longer narrows.
  const setCountry = (name: string) => {
    if (name === country) return;
    if (resolved) unpick();
    setField("country", name);
    // The zone belongs to the country that was chosen, so both go when the country changes (813).
    setField("country_tz", "");
    // The host's own point used to be cleared here too, for the same reason: "the point you
    // placed" for a venue in one country is not the point for a venue in another. Ruling 929
    // removed the point, so there is nothing left to clear. The map link is the host's own content
    // and stays, like the words do.
    // The coverage claim belongs to the country it was observed in.
    setNoVenues(null);
    setZoneList(null);
    setEditingFrom(null);
    setLookup({ state: "idle" });
    if (home && vocabularyName(home.country) !== name) setHomeId(null);
  };
  // A home chip (633, 690, Session 24): the country and the city words together, so Place mounts
  // with the city in it and the lookup runs inside that country, narrowed to the home's point.
  const chooseHome = (h: Home) => {
    if (resolved) unpick();
    setHomeId(h.id);
    const name = vocabularyName(h.country);
    if (name) setField("country", name);
    setField("place_query", h.city);
    setEditingFrom(null);
    setLookup({ state: "idle" });
  };
  const choose = async (s: SuggestedPlace) => {
    const r = await resolvePlace({
      action: "retrieve",
      q: query,
      session_token: session.current,
      mapbox_id: s.place_id,
    });
    if (r.state === "one") pick(r.place);
    else if (r.state === "unavailable") setLookup({ state: "unavailable" });
    else {
      setLookup({ state: "none" });
      setNoVenues(country);
    }
  };
  // The country's zones, asked for once per country (813, 817). `anchor` calls Mapbox never, so
  // this costs no Search Box session; it runs for an in-person or hybrid event only, because an
  // online event has no country to derive from (824).
  useEffect(() => {
    if (!physical || !country) return;
    if (zoneList && zoneList.country === country) return;
    let live = true;
    void (async () => {
      const r = await resolvePlace({
        action: "anchor",
        q: "",
        session_token: session.current,
        country_name: country,
      });
      if (!live) return;
      setZoneList({ country, zones: r.state === "anchored" ? r.zones : null });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, physical]);

  useEffect(() => {
    if (!physical || resolved || !country) return;
    const q = query.trim();
    if (editingFrom !== null) {
      // Change 4: the words the row was resolved from are not looked up again as they stand.
      if (q === editingFrom.trim()) return;
      setEditingFrom(null);
    }
    if (q.length < MIN_QUERY) {
      setLookup({ state: "idle" });
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await resolvePlace({
        action: "suggest",
        q,
        session_token: session.current,
        // The host's country is the anchor of every lookup (783); a chosen home narrows inside it
        // (633). Never the member's residence, never the Edge node's IP.
        country_name: country,
        proximity: home ? { lng: home.lng, lat: home.lat } : null,
      });
      if (!live) return;
      if (r.state === "one") pick(r.place);
      else if (r.state === "several") setLookup({ state: "several", places: r.places });
      else if (r.state === "unavailable") setLookup({ state: "unavailable" });
      else {
        setLookup({ state: "none" });
        setNoVenues(country);
      }
    }, LOOKUP_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resolved, physical, homeId, editingFrom, country]);

  // ---- parts -------------------------------------------------------------------------------------
  const lab = (text: string, key: string): ReactNode => (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {text}
      {v(key) !== "" && !mine(key) ? diaTag : null}
    </span>
  );
  const input = (
    key: string,
    label: string,
    extra: {
      placeholder?: string;
      hint?: ReactNode;
      type?: string;
      inputMode?: "url" | "numeric";
      maxLength?: number;
    } = {},
  ) => (
    <Input
      key={key}
      data-convene={key}
      label={lab(label, key)}
      value={v(key)}
      onChange={(e) => setField(key, e.target.value)}
      placeholder={extra.placeholder}
      hint={extra.hint}
      type={extra.type}
      inputMode={extra.inputMode}
      maxLength={extra.maxLength}
    />
  );
  const seg = (key: string, label: string, opts: [string, string][]) => (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>{lab(label, key)}</div>
      <Segment
        label={label}
        options={opts.map(([value, text]) => ({ value, label: text }))}
        value={v(key) || undefined}
        onChange={(val) => setField(key, val)}
      />
    </div>
  );
  const section = (name: string, ...kids: ReactNode[]) => (
    <div
      key={name}
      data-convene-section={name}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={CAPS}>{name}</div>
      {kids}
    </div>
  );
  const grid = (...kids: ReactNode[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: wide ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
        gap: 12,
      }}
    >
      {kids}
    </div>
  );

  // The invitation. 674: Presented by reads the poster's name and is not editable at launch.
  const invitation = section(
    "The invitation",
    input("title", "Title"),
    <Input key="presented_by" label="Presented by" value={author.name} readOnly aria-readonly />,
  );

  // The moment.
  const moment = section(
    "The moment",
    windowMode ? (
      <div key="window" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {input("when_window", "Window", {
          placeholder: "November",
          hint: windowWords
            ? "The card will say: " + windowWords + ", date to be confirmed."
            : "A month or a season. The card says the date is to be confirmed.",
        })}
        <button
          type="button"
          data-convene="have-date"
          onClick={() => {
            setWindowMode(false);
            setField("when_window", "");
          }}
          style={TEXTBTN}
        >
          I have a date
        </button>
      </div>
    ) : (
      <div key="when" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {grid(
          input("when", "When", {
            placeholder: "Thu 16 Oct at 19:00",
            hint: parseFailed
              ? "That did not read as a date and time. Pick them below."
              : undefined,
          }),
          input("ends", "Ends", {
            placeholder: "Optional",
            hint:
              v("ends").trim() && !endsTime
                ? "That did not read as a time."
                : endsRaw && !endsAt
                  ? "Ends after it starts."
                  : undefined,
          }),
        )}
        {parseFailed &&
          grid(
            <Input
              key="when_date"
              data-convene="when_date"
              label="Date"
              type="date"
              value={v("when_date") || parsed?.date || ""}
              onChange={(e) => setField("when_date", e.target.value)}
            />,
            <Input
              key="when_time"
              data-convene="when_time"
              label="Time"
              type="time"
              value={v("when_time")}
              onChange={(e) => setField("when_time", e.target.value)}
            />,
          )}
        <button
          type="button"
          data-convene="give-window"
          onClick={() => {
            setWindowMode(true);
            setField("when", "");
            setField("when_date", "");
            setField("when_time", "");
          }}
          style={TEXTBTN}
        >
          No date yet? Give a window
        </button>
      </div>
    ),
    whenRead ? (
      <div key="when-read" data-convene="when-line" style={QUIET}>
        {whenRead + (whenSuffix ? ". " + whenSuffix : "")}
      </div>
    ) : null,
    weekdayLine ? (
      <div key="weekday" data-convene="weekday-contradiction" style={QUIET}>
        {weekdayLine}
      </div>
    ) : null,
  );

  // The door: format first, then only what the format needs (621, 521). Session 24: Country is
  // the first control of the place block, a Strand Select reading the vocabulary; Place is not in
  // the DOM until a country is chosen (786, 580); above compact the two share one row.
  const countrySelect = (
    <Select
      key="country"
      label={lab("Country", "country")}
      data-convene="country"
      value={country}
      onChange={(e) => setCountry(e.target.value)}
      options={[
        { value: "", label: "Choose a country" },
        ...orderedCountries.map((c) => ({ value: c, label: c })),
      ]}
    />
  );
  const placeInput = input("place_query", "Place", {
    placeholder: "A venue or an area",
    // Session 23, the unavailable state: a lookup that did not run is never "no place found".
    // Session 24 (798): nothing found names the country that was searched. P4-SPEC section 4
    // (ruling 814) rewrites that sentence: the gap is the map's coverage of this country and not
    // the host's typing. It used to end `and you can place the pin yourself`; ruling 929 removed
    // the pin, so the sentence ends where the `unavailable` one does — the words are the event's
    // record of the place and they are enough to publish. G35 is the finding behind it.
    hint:
      lookup.state === "none"
        ? "The map has no venue records in " +
          country +
          ". Your words are kept, and you can publish."
        : lookup.state === "several"
          ? "Several places match. Pick one, or leave it as you wrote it."
          : lookup.state === "unavailable"
            ? "Place search is unavailable right now. Your words are kept, and you can publish."
            : undefined,
  });
  // 821: the zone control, present only where the chosen country carries more than one zone and no
  // place resolved — absent, never disabled (786, 580, 621). The options are the country's own IANA
  // identifiers as the function returned them, with the member's browser zone ordered first when the
  // country holds it and never selected; no display name is invented and no offset is computed.
  // Pass 4 redraws the place block, this control with it.
  const zoneOptions = needsZoneChoice && countryZones ? countryZones : [];
  const orderedZones =
    zoneOptions.includes(browserTz) && zoneOptions.length > 1
      ? [browserTz, ...zoneOptions.filter((z) => z !== browserTz)]
      : zoneOptions;
  // P4-SPEC section 3 (rulings 814, 901, G35). Strand carries no popover part — the correction 17
  // bundle was searched for eight names and returned zero — and `Tooltip` opens on hover and focus
  // only, which 814 forbids as the sole path. So the panel is Strand's `Sheet`, one part and no
  // variant, at every tier.
  //
  // The spec draws it centred at 1280 and 1440. This tree does not have that geometry to give:
  // ruling 492 is written into `Sheet` as "One size on every sheet … canonical and not overridable
  // per surface" — a bottom sheet on compact, a side sheet on medium and expanded — and every
  // other caller in the tree passes exactly `tier === "compact" ? "sheet" : "drawer"`. Taking the
  // drawn anchor would mean a per-surface geometry override, which is the thing 492 forbids and
  // the thing "one part, no variant" is asking for. The spec's `contained` is the prototype's
  // scaled-frame mechanism: `ComposerShell` never passes it, so in the app it is undefined and the
  // dialog opens with `showModal()` on both sheets. Reported rather than resolved here.
  const infoControl = infoShown ? (
    <button
      key="venue-info"
      type="button"
      data-convene="venue-info"
      aria-haspopup="dialog"
      aria-expanded={infoOpen}
      onClick={() => setInfoOpen(true)}
      style={TEXTBTN}
    >
      Why is my venue not here?
    </button>
  ) : null;
  const infoPanel = (
    <Sheet
      key="venue-info-sheet"
      open={infoOpen}
      onClose={() => setInfoOpen(false)}
      variant={tier === "compact" ? "sheet" : "drawer"}
      label={"Venues in " + country}
    >
      <div
        data-convene="venue-info-panel"
        style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 20px 24px" }}
      >
        <h2
          data-sheet-heading
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 22,
            lineHeight: 1.2,
            color: "var(--ink)",
          }}
        >
          Venues in {country}
        </h2>
        <p style={{ margin: 0, ...QUIET }}>
          The map holds no venue records for {country}, so searching will not find your venue. This
          is the map&rsquo;s gap, not a mistake in what you typed.
        </p>
        {/* Ruling 929 on 897's panel line. It read `Type the venue as you say it, then place the
            pin where it is. Both travel with the event.` The second sentence claimed the pin
            travelled and it never did (G43), and the first named the act that produced it, so both
            clauses go with the control. What is left is the half that is true: the words travel, in
            `place_text`. */}
        <p style={{ margin: 0, ...QUIET }}>
          Type the venue as you say it. Your words travel with the event.
        </p>
      </div>
    </Sheet>
  );
  // P4-SPEC section 7 (rulings 815, 816). The hint is a promise this file keeps: the value is read
  // from the store and written to the store and nothing else. It is never parsed, never handed to
  // `resolvePlace`, never given to `instantFor` or `knownZone`, and no point, place or zone is
  // derived from it anywhere in the tree. Removing the field removes no information about where
  // the venue is: the words carry that, in `place_text`, and the resolver's own point carries it
  // where a place resolved. It used to say the pin carried it, which ruling 929 retired along with
  // the pin.
  const mapLinkField = input("map_link", "Map link", {
    placeholder: "Paste a link to a map",
    type: "url",
    inputMode: "url",
    // The field cannot hold more than the column will, so the cap is reached by pasting rather than
    // by publishing. The length clause below still stands, because a draft saved before this cap
    // existed can restore a longer value, and the sentence is `publish_post`'s own refusal rather
    // than a new one invented in a code session.
    maxLength: MAP_LINK_MAX,
    hint:
      mapLink && !isUrl(mapLink)
        ? "A link starts with http:// or https://"
        : mapLink.length > MAP_LINK_MAX
          ? "That map link is too long to keep."
          : "Optional. It opens in the app you took it from. DNA keeps it as a link and never reads it.",
  });
  const plate = (
    <ConvenePlate
      key="plate"
      areaName={v("place_area") || v("city") || ""}
      mapPoint={mapPoint}
      nothingFound={nothingFound}
      area={areaResolved}
    />
  );
  const zoneSelect = needsZoneChoice ? (
    <Select
      key="country-tz"
      label={lab("Time zone", "country_tz")}
      data-convene="country-tz"
      value={zoneFromCountry ?? ""}
      onChange={(e) => setField("country_tz", e.target.value)}
      options={[
        { value: "", label: "Choose a time zone" },
        ...orderedZones.map((z) => ({ value: z, label: z })),
      ]}
    />
  ) : null;
  const placeInner = resolved ? (
    <div
      key="place-row"
      data-convene="place-resolved"
      data-place-kind={areaResolved ? "area" : "venue"}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>
        {lab("Place", "place_query")}
      </div>
      {/* The row itself carries a marker of its own. 807's dedupe is about the parts of the place
          line, and since 898 the block below it holds an identifier that contains a place name —
          `Africa/Accra` — so a count taken over the whole block counts the zone as a part. */}
      <div data-convene="place-row" style={ROW_BOX}>
        <Icon name="map-pin" size={18} style={{ color: "var(--ink-3)", flex: "none" }} />
        {/* The member's words stand beside the resolved area, never replaced by it (change 2); the
            area, the city and the country follow in the quiet ink (800), each part once (807). */}
        <span style={{ flex: 1, minWidth: 0 }}>
          {rowLead}
          <span style={{ color: "var(--ink-3)" }}>
            {rowTail.length ? ", " + rowTail.join(", ") : ""}
          </span>
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            unpick();
            setEditingFrom(query);
          }}
        >
          Change
        </Button>
      </div>
      {/* 898: the identifier, never the abbreviation. The two branches this replaces existed only
          because `zoneAbbr` needed an instant to compute an offset against; an identifier does not
          move, so a zone with no date yet reads the same as one with a date. */}
      {tzFromPlace && (
        <div data-convene="place-tz-line" style={QUIET}>
          Time zone {placeTz}, from the place.
        </div>
      )}
    </div>
  ) : (
    <div key="place-controls" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {wide && country ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
            gap: 12,
          }}
        >
          {countrySelect}
          {placeInput}
        </div>
      ) : (
        <>
          {countrySelect}
          {country ? placeInput : null}
        </>
      )}
      {/* P4-SPEC section 3: under the Country control, once a country is chosen and the place
          field is still empty. The claim the panel makes is about that country's coverage, so it
          renders only where it is true. */}
      {infoControl}
      {zoneSelect}
      {tzFromChoice && (
        <div data-convene="country-tz-line" style={QUIET}>
          Time zone {zoneFromCountry}, from the country.
        </div>
      )}
      {!query.trim() && homes.length > 0 && (
        <div data-convene="homes" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={QUIET}>Near one of your homes</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {homes.map((h) => (
              <Chip key={h.id} selected={homeId === h.id} onClick={() => chooseHome(h)}>
                {h.city}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {lookup.state === "several" && (
        <div
          role="listbox"
          aria-label="Places that match"
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-m)",
            overflow: "hidden",
          }}
        >
          {lookup.places.map((p, i) => (
            <button
              key={p.place_id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => void choose(p)}
              style={{
                all: "unset",
                boxSizing: "border-box",
                cursor: "pointer",
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                minHeight: 44,
                padding: "10px 12px",
                borderTop: i ? "1px solid var(--line)" : 0,
                fontFamily: "var(--font-sans)",
                fontSize: 15,
              }}
            >
              <span style={{ fontWeight: 500 }}>{p.place_name}</span>
              <span style={{ color: "var(--ink-3)" }}>
                {[p.area, p.city].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  // One `place-block` for both readings of the place, so the plate and the map link sit inside it
  // in every state the extraction draws them in (P4-SPEC sections 5 and 7). The resolved row keeps
  // its own `place-resolved` marker and its `data-place-kind`; nothing that read those reads
  // differently.
  const placeBlock = (
    <div
      key="place"
      data-convene="place-block"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {placeInner}
      {plateShown ? plate : null}
      {plateShown ? mapLinkField : null}
      {infoPanel}
    </div>
  );
  const linkBlock = linkTba ? (
    <div
      key="link"
      data-convene="link-tba"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>Meeting link</div>
      <div style={ROW_BOX}>
        <Icon name="link" size={18} style={{ color: "var(--ink-3)", flex: "none" }} />
        <span style={{ flex: 1 }}>Link to be announced</span>
        <Button variant="secondary" size="sm" onClick={() => setField("link_tba", false)}>
          Add it now
        </Button>
      </div>
      <div style={QUIET}>People who are going get it by email when you add it.</div>
    </div>
  ) : (
    <div
      key="link"
      data-convene="link-block"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {input("link", "Meeting link", {
        placeholder: "https://",
        type: "url",
        inputMode: "url",
        hint:
          link && !linkOk
            ? "A link starts with http:// or https://"
            : "Shared with the ticket, never on the card.",
      })}
      <button
        type="button"
        data-convene="announce-later"
        onClick={() => {
          setField("link_tba", true);
          setField("link", "");
        }}
        style={TEXTBTN}
      >
        Announce the link later
      </button>
    </div>
  );
  const door = section(
    "The door",
    seg("format", "Format", [
      ["in_person", "In person"],
      ["online", "Online"],
      ["hybrid", "Hybrid"],
    ]),
    format ? (
      format === "hybrid" && tier === "expanded" ? (
        <div key="rows">{grid(placeBlock, linkBlock)}</div>
      ) : (
        <div key="rows" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {physical && placeBlock}
          {virtual && linkBlock}
        </div>
      )
    ) : null,
    intent ? (
      <div key="intent" data-convene="intent" style={QUIET}>
        {intent + "."}
      </div>
    ) : null,
  );

  // The program (675).
  const program = section(
    "The program",
    <div key="program-line" style={QUIET}>
      Your words above are the program. Media goes with them.
    </div>,
    grid(input("doors", "Doors open", { placeholder: "Optional" })),
  );

  // The send-off. P4-SPEC section 8 states the door's three lines as unchanged behaviour, and two
  // of the three are not in this tree at all: 821's gate has been in force since `e3392e5` — the
  // door does not open until the host picks a zone — but the surface only disabled Publish and
  // left the reason to be inferred. These are the sentences the frames draw for it. The third is
  // the exception: the spec's `Posting publishes the event.` is shorter than the P1-ratified line
  // that has shipped since Pass 1, and a section headed "unchanged behaviour" is not the place a
  // ratified line gets quietly rewritten, so it stands as it is. Reported as the finding.
  const doorLine =
    physical && !country
      ? "Choose the country first."
      : needsZoneChoice && !zoneFromCountry
        ? "Choose the time zone first."
        : "Posting publishes this event. It goes to the Feed and to Convene.";
  const price = v("price_nature");
  const sendoff = section(
    "The send-off",
    seg("price_nature", "Tickets", [
      ["free", "Free"],
      ["paid", "Paid"],
      ["donation", "Donation"],
    ]),
    price === "paid" || price === "donation" ? (
      <div key="amounts" style={QUIET}>
        Amounts are set with ticketing, after this.
      </div>
    ) : null,
    <div
      key="posting"
      data-convene="door-line"
      style={{ fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}
    >
      {doorLine}
    </div>,
  );

  // More options, in place (580). Sponsor is absent until Brief 8's relationships (Pass 1 handoff,
  // ruling owed 3).
  const moreBlock = (
    <div key="more" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        aria-expanded={more}
        data-convene="more"
        onClick={() => setMore((m) => !m)}
        style={{ ...TEXTBTN, gap: 6, textDecoration: "none" }}
      >
        <Icon
          name="chevron-down"
          size={18}
          style={{
            transform: more ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-default) var(--ease)",
          }}
        />
        {more ? "Fewer options" : "More options"}
      </button>
      {more && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {input("capacity", "Capacity", {
            placeholder: "Optional",
            inputMode: "numeric",
            hint: "Only you see this. It never shows on the event.",
          })}
          <Select
            label="Space"
            data-convene="space"
            value={v("space_id")}
            onChange={(e) => setField("space_id", e.target.value)}
            options={[
              { value: "", label: "Not linked to a Space" },
              ...spaces.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      )}
    </div>
  );

  return (
    <div data-convene-form style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {invitation}
      {moment}
      {door}
      {program}
      {sendoff}
      {moreBlock}
    </div>
  );
}
