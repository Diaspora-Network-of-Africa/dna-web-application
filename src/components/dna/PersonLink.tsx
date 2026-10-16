// Handoff 62-A, SPEC-62-FEED-CARD 11 (ruling 1820): one linked part wherever a member's name
// renders. Avatar and the name in one link named "{name}’s profile" (V.profile) that opens
// /m/{handle}; the click stops at the link and never also opens the card. Variants: the first name
// only, a label in place of the name, `noPhoto` where the photos lead elsewhere in the row (the
// name underlined --line-strong, offset 2), and a second line in --ink-3. A party rendered as a role
// (141) has no photo and no link and never reaches this part. Composed from Strand's Avatar until
// Strand lands PersonLink (SPEC 12 proposal 12; the G entry in docs/GAPS.md).
import { Link } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Avatar } from "@/components/strand/Avatar";
import { firstName } from "@/lib/names";

export type PersonLinkProps = {
  name: string;
  handle: string;
  avatar?: string | undefined;
  /** The photo's size; 20 inline, 24 in a comment line, 32 to 48 in a row. */
  size?: number;
  first?: boolean | undefined;
  /** Words in the name's place (R.you's "You"); the accessible name keeps the member's name. */
  label?: string | undefined;
  noPhoto?: boolean | undefined;
  second?: ReactNode;
  /** The link as its own row on touch is 44 high (498); inline it is --target-min. */
  row?: boolean | undefined;
  weight?: number | undefined;
  onNavigate?: (() => void) | undefined;
  /** Overrides V.profile where the row's whole sentence is the link's name (the sheets' rows). */
  ariaLabel?: string | undefined;
  /** The row's own text column in place of the name span (the sheets' rows). */
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

/** V.profile: "{name}’s profile". */
export const profileLabel = (name: string) => name + "’s profile";

export function PersonLink({
  name,
  handle,
  avatar,
  size = 20,
  first,
  label,
  noPhoto,
  second,
  row,
  weight = 500,
  onNavigate,
  ariaLabel,
  children,
  style,
}: PersonLinkProps) {
  const words = label ?? (first ? firstName(name) : name);
  const stop = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    onNavigate?.();
  };
  return (
    <Link
      to="/m/$handle"
      params={{ handle }}
      search={{}}
      aria-label={ariaLabel ?? profileLabel(name)}
      data-person-link={handle}
      onClick={stop}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: weight,
        color: "inherit",
        textDecoration: noPhoto ? "underline" : "none",
        textDecorationColor: "var(--line-strong)",
        textUnderlineOffset: 2,
        minHeight: row ? 44 : "var(--target-min)",
        minWidth: 0,
        ...style,
      }}
    >
      {!noPhoto && <Avatar name={name} src={avatar} size={size} />}
      {children ?? (
        <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {words}
          </span>
          {second ? (
            <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 400 }}>{second}</span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
