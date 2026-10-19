// SPEC-62-FEED-CARD 10.1 (ruling 1817, handoff 62-G): the one `time` element for a card's meta line, a
// comment's head and a notification row. The server sends the instant absolute; src/lib/when.ts
// formats it, relative within the day and absolute after it, and the absolute form is always the
// element's title. `absolute` forces the absolute text, which the expanded card asks for. A relative
// text is re-read each minute so an open page does not keep saying "Now".
import { useEffect, useState, type CSSProperties } from "react";
import { DAY_MS, timeParts } from "@/lib/when";

const TICK_MS = 60_000;

/** The current minute, re-read on the minute while a relative time is on the page. */
function useMinute(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function TimeStamp({
  iso,
  absolute,
  style,
}: {
  iso: string | null | undefined;
  /** The expanded card: always the absolute form (10.1). */
  absolute?: boolean | undefined;
  style?: CSSProperties | undefined;
}) {
  const recent =
    !absolute &&
    !!iso &&
    Date.now() - new Date(iso).getTime() < DAY_MS &&
    !Number.isNaN(Date.parse(iso));
  const now = useMinute(recent);
  const parts = timeParts(iso, { absolute, now });
  if (!parts || !iso) return null;
  return (
    <time
      dateTime={iso}
      title={parts.title}
      data-time={absolute ? "absolute" : parts.text === parts.title ? "absolute" : "relative"}
      style={style}
    >
      {parts.text}
    </time>
  );
}
