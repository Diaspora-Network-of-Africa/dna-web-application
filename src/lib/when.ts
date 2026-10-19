// Dates the way the system writes them (Strand content fundamentals): "Thu 16 Oct, 19:00".
// Notification times shorten to "Today, 10:12" and "Yesterday, 18:40" inside the last two days.
//
// Convene Pass 1 (SPEC section 3 "The moment", section 2 "The meta line"; rulings 520, 634, 676):
// the one date module. The member's words are parsed here in the event's own time zone and read
// back in one quiet line; a parse that yields no time is the picker's cue, never a guess. Every
// zone name and abbreviation is derived through Intl from an IANA zone: nothing here holds a table
// of zones. Parser: chrono-node (confidence High on the SPEC's English forms). No second date
// module exists in this tree, by the handoff's instruction.
import { format, isToday, isYesterday } from "date-fns";
import * as chrono from "chrono-node";

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "EEE d MMM, HH:mm");
}

/**
 * "Sat 23 Aug" for a timestamp; empty when absent. Profile's badge and section dates, and under
 * ruling 1530 the attestation `when` on every surface, formatted here before it reaches a Strand
 * part, which never formats a date. Moved from src/lib/profile.ts by handoff 44-MC-R3 so the one
 * formatter lives in the one date module.
 */
export function whenShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "EEE d MMM");
}

// ---------------------------------------------------------------------------------------------
// SPEC-62-FEED-CARD 10.1 (ruling 1817, handoff 62-G): every time on a card, under a comment and in the
// notification tray is a `time` element whose title is the absolute form (T.absolute, whenLabel's
// "Thu 9 Oct, 10:02"). Its visible text is relative within the day (T.relative: "Now" under a minute,
// then "5m", then "10h", up to a day) and the absolute form after the day; the expanded card always
// shows the absolute form. Times arrive absolute from the server and are formatted here, once, so
// the card, the comment and the tray cannot drift (src/components/dna/TimeStamp.tsx renders them).
// ---------------------------------------------------------------------------------------------

export const DAY_MS = 24 * 60 * 60 * 1000;

/** T.relative: "Now", "5m" or "10h" for an instant within the last day; null at or past it. */
export function relativeWithinDay(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  if (diff >= DAY_MS) return null;
  if (diff < 60_000) return "Now";
  if (diff < 60 * 60_000) return Math.floor(diff / 60_000) + "m";
  return Math.floor(diff / (60 * 60_000)) + "h";
}

/**
 * The two forms every `time` element carries (10.1): the absolute title, and the visible text,
 * relative within the day unless `absolute` asks for the absolute form (the expanded card).
 */
export function timeParts(
  iso: string | null | undefined,
  opts: { absolute?: boolean | undefined; now?: Date | undefined } = {},
): { text: string; title: string } | null {
  const title = whenLabel(iso);
  if (!title) return null;
  const relative = opts.absolute ? null : relativeWithinDay(iso, opts.now ?? new Date());
  return { text: relative ?? title, title };
}

export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return "Today, " + format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday, " + format(d, "HH:mm");
  return format(d, "EEE d MMM");
}

// ---------------------------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------------------------

/** Whether Intl knows this zone; an unknown zone renders nothing rather than a wrong offset. */
export function knownZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The browser's zone (ruling owed 7: an online-only event takes the host's own zone at publish). */
export function browserZone(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return knownZone(z) ? z : "UTC";
  } catch {
    return "UTC";
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function partsIn(instant: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const get = (type: string) =>
    Number(f.formatToParts(instant).find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** The zone's offset from UTC at an instant, in minutes. */
export function zoneOffsetMinutes(tz: string, instant: Date): number {
  const p = partsIn(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
  const truncated = Math.floor(instant.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/** The instant a wall-clock time in a zone names. Two passes settle a DST edge. */
export function zonedInstant(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0, 0);
  const off1 = zoneOffsetMinutes(tz, new Date(guess));
  let instant = guess - off1 * 60000;
  const off2 = zoneOffsetMinutes(tz, new Date(instant));
  if (off2 !== off1) instant = guess - off2 * 60000;
  return new Date(instant);
}

/**
 * The zone's short name at an instant, as Intl gives it ("GMT", "BST", "GMT+3").
 *
 * Ruling 898 took this off every member-facing Convene surface: a display abbreviation is an
 * invented name, and for any zone observing daylight saving it is a computed offset that moves
 * twice a year, so one stored instant reads `EDT` on one surface and `America/New_York` on
 * another. It reads clean in the Accra frames only because Africa/Accra is GMT all year. The
 * function is not deleted (P4-SPEC section 2) and no caller in this tree renders it; whoever adds
 * one is adding a display name, which is what 821 and 898 refuse.
 */
export function zoneAbbr(tz: string, instant: Date): string {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" });
    return f.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "Thu 15 Oct" for an instant read in a zone. */
export function dateInZone(instant: Date, tz: string): string {
  const p = partsIn(instant, tz);
  const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return WEEKDAYS[wd] + " " + p.day + " " + MONTHS[p.month - 1];
}

/** "19:00" for an instant read in a zone. */
export function timeInZone(instant: Date, tz: string): string {
  const p = partsIn(instant, tz);
  return pad(p.hour) + ":" + pad(p.minute);
}

/**
 * Ruling 835: the year appears where the date is outside the year it is being read in, and not
 * inside it. Read in the zone the date is read in, so a New Year's Eve instant does not gain or
 * lose a year by which side of the date line the reader is on.
 */
export function outsideThisYear(instant: Date, tz: string, now = new Date()): boolean {
  return partsIn(instant, tz).year !== partsIn(now, tz).year;
}

/** "Thu 16 Oct" inside the year being read in, "Thu 16 Sep 2027" outside it (ruling 835). */
export function dateLine(instant: Date, tz: string, now = new Date()): string {
  const base = dateInZone(instant, tz);
  return outsideThisYear(instant, tz, now) ? base + " " + partsIn(instant, tz).year : base;
}

/**
 * "Thu 16 Sep 2027, 19:00 Africa/Accra": the event's own reading of its start (SPEC 2, 3), with
 * 835's year and 898's identifier. The zone is named by its IANA identifier and never by an
 * abbreviation, on this surface and on every other member-facing Convene surface.
 */
export function localLine(iso: string, tz: string, withZone = true, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || !knownZone(tz)) return "";
  return dateLine(d, tz, now) + ", " + timeInZone(d, tz) + (withZone ? " " + tz : "");
}

/**
 * The rail's stored-instant line (P4-SPEC section 2): the host's words are echoed above it, and
 * this names the instant those words were stored as, in the event's own zone. The echo and this
 * line are the whole answer to what the words became; nothing here rewrites them.
 */
export function storedLine(iso: string, tz: string, now = new Date()): string {
  const line = localLine(iso, tz, true, now);
  return line ? "Stored as " + line : "";
}

// ---------------------------------------------------------------------------------------------
// The member's words
// ---------------------------------------------------------------------------------------------

export type ParsedWhen = {
  /** yyyy-mm-dd the words named; present whenever a date was read. */
  date: string | null;
  /** HH:mm the words named; null when the words carried no time (the picker's cue). */
  time: string | null;
};

/**
 * Read the member's words for the moment. `now` anchors a year-less date to the next occurrence.
 * A time is reported only when the words state one: "15 October at 19:00" carries 19:00, "next
 * Thursday evening" does not, and the SPEC treats the second as a failed parse for the instant.
 */
export function parseWhen(words: string, now = new Date()): ParsedWhen | null {
  const t = words.trim();
  if (!t) return null;
  const results = chrono.en.GB.parse(t, now, { forwardDate: true });
  const r = results[0];
  if (!r) return null;
  const s = r.start;
  if (!s.isCertain("day") && !s.isCertain("weekday")) return null;
  const date = s.get("year") + "-" + pad(s.get("month") ?? 1) + "-" + pad(s.get("day") ?? 1);
  const time = s.isCertain("hour")
    ? pad(s.get("hour") ?? 0) + ":" + pad(s.get("minute") ?? 0)
    : null;
  return { date, time };
}

// ---------------------------------------------------------------------------------------------
// Ruling 836: the weekday the host typed, against the weekday the date they typed falls on
// ---------------------------------------------------------------------------------------------

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?\b/i, 0],
  [/\bmon(?:day)?\b/i, 1],
  [/\btue(?:s|sday)?\b/i, 2],
  [/\bwed(?:s|nesday)?\b/i, 3],
  [/\bthu(?:r|rs|rsday)?\b/i, 4],
  [/\bfri(?:day)?\b/i, 5],
  [/\bsat(?:urday)?\b/i, 6],
];

const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * The weekday the words name, and the host's own token for it, or null where they name none. Each
 * pattern is anchored at both ends so `sunset` is not a Sunday and `March` is not a Tuesday: a
 * contradiction stated from a false reading is worse than none stated at all.
 */
export function typedWeekday(words: string): { index: number; word: string } | null {
  for (const [re, index] of WEEKDAY_WORDS) {
    const m = re.exec(words);
    if (m) return { index, word: m[0] };
  }
  return null;
}

/** The weekday a yyyy-mm-dd falls on, 0 to 6, or null when it is not a date. */
export function weekdayOf(date: string): number | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

/**
 * Ruling 836's sentence, or null where the words and the date agree. The host's words are never
 * rewritten: the contradiction is stated, the day the date actually falls on is named, and the
 * instant that will be stored is named beside it. `date` is yyyy-mm-dd, the date the words parsed
 * to; `stored` is that date read back through the event's own zone, which is what 835 governs.
 */
export function weekdayContradiction(words: string, date: string, stored: string): string | null {
  const typed = typedWeekday(words);
  const actual = weekdayOf(date);
  if (!typed || actual === null || typed.index === actual) return null;
  const year = date.slice(0, 4);
  return (
    "You wrote " +
    typed.word +
    ". The date you wrote falls on a " +
    WEEKDAYS_FULL[actual] +
    " in " +
    year +
    ". Your words are kept; the event will be stored for " +
    stored +
    "."
  );
}

/** A time alone ("22:00", "7pm", "18:30"), as HH:mm; null when the words carry none. */
export function parseTimeWords(words: string, now = new Date()): string | null {
  const t = words.trim();
  if (!t) return null;
  const r = chrono.en.GB.parse(t, now)[0];
  if (!r || !r.start.isCertain("hour")) return null;
  return pad(r.start.get("hour") ?? 0) + ":" + pad(r.start.get("minute") ?? 0);
}

/** yyyy-mm-dd plus HH:mm in a zone, as an ISO instant. Null on anything malformed. */
export function instantFor(date: string, time: string, tz: string): string | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm || !knownZone(tz)) return null;
  const d = zonedInstant(+dm[1]!, +dm[2]!, +dm[3]!, +tm[1]!, +tm[2]!, tz);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type Window = { start: string; end: string };

/**
 * Ruling 520: an honest window in words. When the words name a month ("November", "Nov 2027") the
 * expected window is that month's first and last day; any other words stand as the basis alone.
 */
export function windowFor(words: string, now = new Date()): Window | null {
  const t = words.trim();
  if (!t) return null;
  const m = t.match(/^([A-Za-z]{3,9})(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const idx = MONTHS.findIndex((mo) => m[1]!.toLowerCase().startsWith(mo.toLowerCase()));
  if (idx < 0) return null;
  let year = m[2] ? +m[2] : now.getFullYear();
  if (!m[2] && idx < now.getMonth()) year += 1;
  const last = new Date(Date.UTC(year, idx + 1, 0)).getUTCDate();
  return {
    start: year + "-" + pad(idx + 1) + "-01",
    end: year + "-" + pad(idx + 1) + "-" + pad(last),
  };
}

// ---------------------------------------------------------------------------------------------
// The card's meta line (SPEC section 2)
// ---------------------------------------------------------------------------------------------

export type EventTiming = {
  starts_at: string | null;
  timezone: string | null;
  window_basis: string | null;
  expected_window_end: string | null;
  city: string | null;
};

/** Ruling owed 5: past is derived at read from the start, or the window's end, never stored. */
export function isPast(
  t: Pick<EventTiming, "starts_at" | "expected_window_end">,
  now = new Date(),
): boolean {
  if (t.starts_at) return new Date(t.starts_at).getTime() < now.getTime();
  if (t.expected_window_end) {
    const end = new Date(t.expected_window_end + "T23:59:59Z");
    return end.getTime() < now.getTime();
  }
  return false;
}

/**
 * `when` for the meta line: the date in the viewer's zone, then the event's local time when they
 * differ (`Thu 16 Oct, 21:00 Africa/Nairobi, 19:00 in Accra`); a window as words (`November, date
 * to be confirmed`); past as `Happened Thu 16 Oct, 19:00 Africa/Accra`. Every zone is its IANA
 * identifier (898) and the year follows 835 through `dateLine`.
 */
export function whenLine(t: EventTiming, viewerTz: string, now = new Date()): string {
  if (!t.starts_at) return t.window_basis ? t.window_basis + ", date to be confirmed" : "";
  const d = new Date(t.starts_at);
  if (Number.isNaN(d.getTime())) return "";
  const eventTz = knownZone(t.timezone) ? t.timezone : null;
  if (isPast(t, now)) {
    const tz = eventTz ?? (knownZone(viewerTz) ? viewerTz : "UTC");
    // The injected clock, here too: without it 835's year is decided against the real wall clock
    // while the rest of the line is decided against `now`, so one call could put the year on a
    // past event and leave it off a future one in the same render.
    return "Happened " + localLine(t.starts_at, tz, true, now);
  }
  const vtz = knownZone(viewerTz) ? viewerTz : (eventTz ?? "UTC");
  let line = dateLine(d, vtz, now) + ", " + timeInZone(d, vtz) + " " + vtz;
  if (eventTz && zoneOffsetMinutes(eventTz, d) !== zoneOffsetMinutes(vtz, d)) {
    line += ", " + timeInZone(d, eventTz) + (t.city ? " in " + t.city : " " + eventTz);
  }
  return line;
}
