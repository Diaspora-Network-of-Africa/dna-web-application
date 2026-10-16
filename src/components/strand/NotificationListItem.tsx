// Design pass 01, B17 (rulings 462, 480, 490), on handoff 55-A's vocabulary (1318). Two changes on
// the B2-Shell-Feed row:
// 1. Every row names its destination in words, so the member can read where the tap goes before
//    taking it (490). The words are the kind's `destination` in public.notification_kinds, passed in
//    by the caller; the row is a link in behaviour and the destination line is part of its
//    accessible name.
// 2. The unread dot carries a hidden "Unread" label in a --target-min hit area (480). The dot is
//    still 8px; what grew is the box around it, which is inside a row that is itself the target.
//
// No kind map lives here (1318, N4). The kind's C (ruling 66) and its destination come from the
// vocabulary row through `c` and `destination`; whether a kind renders is the row's `renders` and
// `hasSentence` below together. What stays is the per-kind sentence in `parts()`: that is the Strand
// row part, the words a row of each kind reads, and a kind with no sentence here does not render.
//
// Handoff 62-A (SPEC-62-FEED-CARD 10.2; rulings 1802, 1817, 1820, 1823; proposal 10, recorded in
// docs/strand-ports/sha256-b1a458dac1bd562f.md): `intent_help` and `intent_build` read N.help1 to
// N.help3 and N.build1 to N.build2 from the people the caller passes, and a row that carries
// `people` is people-led: the photos lead in a fixed 58 column (one at 40, or two at 32 overlapping
// by a fifth), each name in the sentence its own link, and the C marks the post's line under the
// sentence, never a photo. Existing kinds keep their badge-led row until H62-B moves them.
import { useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { CBadge } from "./CBadge";
import type { C } from "./cmeta";

type Part = string | [string, 1];

/** N.help1 to N.help3, N.build1 and N.build2: the names, then the verb that agrees with them. */
function intentSentence(kind: string, names: readonly string[], others: boolean): Part[] {
  const list = names.slice(0, 2);
  const one = list.length === 1 && !others;
  const out: Part[] = [];
  list.forEach((n, i) => {
    if (i === 1) out.push(others ? ", " : " and ");
    out.push([n, 1]);
  });
  if (others) out.push(" and others");
  if (kind === "intent_help") out.push(" can help with your post");
  else out.push(one ? " wants to build with you" : " want to build with you");
  return out;
}

function parts(row: {
  kind: string;
  actor?: string | undefined;
  /** 62-A: the people an intent row names, in the row's order; `others` when more exist. */
  names?: readonly string[] | undefined;
  others?: boolean | undefined;
  /** The object's name and its qualifier. The Connect kinds name neither; a kind that reads them
   *  gains its sentence here when its row part ships (G242). */
  object?: string | undefined;
  detail?: string | undefined;
  /** Strand correction 15 (736): the caller's sentence, verbatim, where a kind takes one. */
  text?: string | undefined;
}): Part[] {
  switch (row.kind) {
    case "connection_accepted":
      // Ruling 461: the intro wording left with the composer's Connect verb (417).
      return [[row.actor ?? "", 1], " accepted your connection request."];
    case "connection_request":
      return [[row.actor ?? "", 1], " wants to connect."];
    case "role_invitation":
      // 736: the caller's sentence verbatim; Strand ships no invitation copy. The app composes it
      // as `{actor} invited you to {verb} this event.` with the verb from the event_roles
      // vocabulary (handoff 30-C item 11), and passes it as `text`; `detail` is that verb.
      return row.text
        ? [row.text]
        : [[row.actor ?? "", 1], " invited you to " + (row.detail ?? "") + " this event."];
    case "thread_invitation":
      // Fix PR 10 item 8 (1637, 1623): the app composes `{name} invited you to {group}.` and passes
      // it as `text`, as it does for role_invitation; a port divergence recorded in the ports log.
      return row.text
        ? [row.text]
        : [[row.actor ?? "", 1], " invited you to " + (row.object ?? "") + "."];
    case "intent_help":
    case "intent_build": {
      const names = row.names && row.names.length ? row.names : [row.actor ?? "A member"];
      return intentSentence(row.kind, names, !!row.others);
    }
    default:
      return [""];
  }
}

/**
 * Whether the row part has a sentence for a kind (handoff 55-A). A kind renders only where its
 * vocabulary row says `renders` and this is true, so a kind the database renders before its Strand
 * part ships reads nothing rather than a blank line.
 */
export function hasSentence(kind: string): boolean {
  return parts({ kind }).some((p) => (Array.isArray(p) ? true : p !== ""));
}

export type NotificationListItemProps = {
  kind: string;
  /** The engine whose glyph marks the row (ruling 66), from the kind's vocabulary row or, for a
   *  context-derived kind, the row's own C (1325). Absent, no glyph renders (194). */
  c?: C | undefined;
  /** The kind's destination in words (490), from its vocabulary row. Absent, no line renders. */
  destination?: string | undefined;
  actor?: string | undefined;
  object?: string | undefined;
  detail?: string | undefined;
  /** 736: the sentence verbatim, for a kind whose copy the caller owns (`role_invitation`). */
  text?: string | undefined;
  time?: string | undefined;
  unread?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** 736: `role_invitation` carries one Respond act beside the row; absent, no act renders. */
  onRespond?: (() => void) | undefined;
  /** 62-A (1820): the people the row names, in order; with them the row is people-led. */
  people?:
    | readonly { id: string; name: string; handle: string; avatar?: string | undefined }[]
    | undefined;
  /** 62-A: more people than the two shown exist ("and others"); never a count. */
  others?: boolean | undefined;
  /** 62-A: one photo or a name opens that profile. */
  onPerson?: ((handle: string) => void) | undefined;
  /** 62-A: two photos are one control that opens the sheet (R.open). */
  onPeople?: (() => void) | undefined;
  /** 62-A: touch gives the post's line a 44 target; pointer --target-min. */
  input?: "touch" | "pointer" | undefined;
  style?: CSSProperties | undefined;
};

/** One notification row (ruling 82). The C glyph marks which engine wrote the row (ruling 66). Unread: dot and 500 weight. */
export function NotificationListItem({
  kind,
  c,
  destination,
  actor,
  object,
  detail,
  text: sentence,
  time,
  unread,
  onClick,
  onRespond,
  people,
  others,
  onPerson,
  onPeople,
  input,
  style,
}: NotificationListItemProps) {
  const [hover, setHover] = useState(false);
  const names = people?.map((p) => p.name);
  const handleOf = new Map((people ?? []).map((p) => [p.name, p.handle]));
  const text: ReactNode[] = parts({
    kind,
    actor,
    object,
    detail,
    text: sentence,
    names,
    others,
  }).map((p, i) =>
    Array.isArray(p) ? (
      people && handleOf.has(p[0]) ? (
        // 62-A (1820): a name in the sentence is its own link, underlined --line-strong.
        <a
          key={i}
          href={"/m/" + handleOf.get(p[0])}
          aria-label={p[0] + "’s profile"}
          data-person-link={handleOf.get(p[0])}
          onClick={(e) => {
            e.stopPropagation();
            if (!onPerson || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onPerson(handleOf.get(p[0]) ?? "");
          }}
          style={{
            fontWeight: 700,
            color: "inherit",
            textDecoration: "underline",
            textDecorationColor: "var(--line-strong)",
            textUnderlineOffset: 2,
          }}
        >
          {p[0]}
        </a>
      ) : (
        <b key={i} style={{ fontWeight: 700 }}>
          {p[0]}
        </b>
      )
    ) : (
      p
    ),
  );
  const rowStyle: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 16px",
    minHeight: 56,
    background: hover ? "var(--bg-sunken)" : "transparent",
    fontFamily: "var(--font-sans)",
    color: "var(--ink)",
    textAlign: "left",
    transition: "background var(--dur-default) var(--ease)",
    ...style,
  };
  const body = (
    <>
      {c && <CBadge c={c} size={32} />}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            fontWeight: unread ? 500 : 400,
            textWrap: "pretty",
          }}
        >
          {text}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-3)",
            lineHeight: 1.4,
          }}
        >
          {/* Ruling 490: the destination, in words, before the tap. */}
          {destination && <span data-destination-line>{destination}</span>}
          {time && destination && <span aria-hidden="true">·</span>}
          {time && <span>{time}</span>}
        </span>
      </span>
      {unread && (
        // Ruling 480: a hidden label and a --target-min hit area. The dot itself stays 8px.
        <span
          role="img"
          aria-label="Unread"
          data-unread-dot
          style={{
            width: "var(--target-min)",
            height: "var(--target-min)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
            marginTop: 2,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--pulse-for-you)",
            }}
          />
        </span>
      )}
    </>
  );
  if (people && people.length > 0) {
    // 62-A (SPEC 10.2, proposal 10): the people-led row. The photos lead in a fixed 58 column; one
    // photo opens that profile, two are one control that opens the sheet; the sentence, then the
    // post's line led by the C badge at 20, which is the row's own target; then the time and the
    // unread dot. The C never sits on a photo (1823).
    const two = people.slice(0, 2);
    const photos = (
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {two.map((p, i) => (
          <Avatar
            key={p.id}
            name={p.name}
            src={p.avatar}
            size={two.length === 1 ? 40 : 32}
            style={{
              marginLeft: i === 0 ? 0 : -6,
              boxShadow: "0 0 0 1.5px var(--bg)",
              position: "relative",
              zIndex: 2 - i,
            }}
          />
        ))}
      </span>
    );
    const first = two[0];
    const column = (
      <button
        type="button"
        aria-label={two.length === 1 && first ? first.name + "’s profile" : "See who reacted"}
        data-notification-people={String(two.length)}
        onClick={(e) => {
          e.stopPropagation();
          if (two.length === 1 && first) onPerson?.(first.handle);
          else onPeople?.();
        }}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          width: 58,
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
          flex: "none",
        }}
      >
        {photos}
      </button>
    );
    const lineHeight = input === "touch" ? 44 : "var(--target-min)";
    return (
      <div
        data-kind={kind}
        data-unread={unread ? "1" : undefined}
        data-destination={destination}
        data-people-led=""
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ ...rowStyle, cursor: "default", padding: "10px 16px" }}
      >
        {column}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingTop: 2,
          }}
        >
          <span
            style={{
              fontSize: 15,
              lineHeight: 1.4,
              fontWeight: unread ? 500 : 400,
              textWrap: "pretty",
            }}
          >
            {text}
          </span>
          <button
            type="button"
            onClick={onClick}
            aria-label={(destination ? destination + ": " : "") + (object ?? "")}
            data-notification-object=""
            style={{
              all: "unset",
              boxSizing: "border-box",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: lineHeight,
              margin: input === "touch" ? "-10px 0" : 0,
              fontSize: 13,
              color: "var(--ink-3)",
              lineHeight: 1.4,
              minWidth: 0,
              textAlign: "left",
            }}
          >
            {c && <CBadge c={c} size={20} />}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {object ?? destination}
            </span>
          </button>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          {time && (
            <span style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>{time}</span>
          )}
          {unread && (
            <span
              role="img"
              aria-label="Unread"
              data-unread-dot
              style={{
                width: "var(--target-min)",
                height: "var(--target-min)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ink)" }}
              />
            </span>
          )}
        </span>
      </div>
    );
  }
  if (kind === "role_invitation" && onRespond) {
    // Correction 15 (736): the row and its act are two controls, so the row is a div and not a
    // button here; the sentence is the row's hit target and Respond is the act, whose accessible
    // name is "Respond" followed by the sentence.
    const plain = parts({ kind, actor, object, detail, text: sentence })
      .map((p) => (Array.isArray(p) ? p[0] : p))
      .join("");
    return (
      <div
        data-kind={kind}
        data-unread={unread ? "1" : undefined}
        data-destination={destination}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ ...rowStyle, cursor: "default", alignItems: "center" }}
      >
        <button
          type="button"
          onClick={onClick}
          style={{
            all: "unset",
            boxSizing: "border-box",
            cursor: "pointer",
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            textAlign: "left",
            color: "inherit",
            fontFamily: "inherit",
          }}
        >
          {body}
        </button>
        <Button
          variant="secondary"
          size="sm"
          c="convene"
          aria-label={"Respond" + (plain ? ": " + plain : "")}
          onClick={onRespond}
          style={{ flex: "none" }}
          data-testid="notification-respond"
        >
          Respond
        </Button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-kind={kind}
      data-unread={unread ? "1" : undefined}
      data-destination={destination}
      style={rowStyle}
    >
      {body}
    </button>
  );
}
