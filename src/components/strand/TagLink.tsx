// Ported from Strand components/dna/TagLink.jsx at compile sha256-b1a458dac1bd562f (brief 60-SP
// item 7; HT 5.2 item 1; 1683; ratified 1728; handoff H61-SP). New to the tree. The one tag
// treatment: an inline link in the post's C text colour at --weight-medium, in the author's case,
// no underline at rest, a 1px underline on pointer hover and a 2px --focus ring on keyboard focus;
// never a chip, never a count. `TagText` renders a body the app has already parsed (the pattern
// lives in one app module; Strand does no matching): strings stay text and `{ tag, href, text }`
// parts render as TagLink. Nothing in the tree parses a body yet: the hashtag flow is its own
// handoff, and this part waits for it. Translations, none visible: props are typed, and the
// `:focus-visible` read guards an element without `matches`. Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
import {
  Fragment,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { CardC } from "./cmeta";

export type TagLinkProps = {
  /** The tag's key, without its `#`. */
  tag: string;
  /** The post's C; `system` reads --ink. */
  c?: CardC | undefined;
  /** The tag's page. Without it the tag is an inline button. */
  href?: string | undefined;
  /** A plain primary click with no modifier calls this (preventDefault) for in-app navigation. */
  onOpen?: ((tag: string) => void) | undefined;
  /** The text as the author wrote it; default `#` + tag. */
  children?: ReactNode;
  style?: CSSProperties | undefined;
};

export function TagLink({ tag, c = "connect", href, onOpen, children, style }: TagLinkProps) {
  const [hot, setHot] = useState(false);
  const [ring, setRing] = useState(false);
  const color = c === "system" ? "var(--ink)" : "var(--c-" + c + "-text)";
  const text = children != null ? children : "#" + tag;
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      !onOpen ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    e.preventDefault();
    onOpen(tag);
  };
  const s: CSSProperties = {
    color,
    fontWeight: "var(--weight-medium)" as unknown as number,
    textDecorationLine: hot ? "underline" : "none",
    textDecorationThickness: 1,
    textUnderlineOffset: 2,
    outline: ring ? "2px solid var(--focus)" : "none",
    outlineOffset: 2,
    borderRadius: 2,
    overflowWrap: "anywhere",
    cursor: "pointer",
    ...style,
  };
  const ev = {
    onMouseEnter: () => setHot(true),
    onMouseLeave: () => setHot(false),
    onFocus: (e: FocusEvent<HTMLElement>) =>
      setRing(!!(e.target.matches && e.target.matches(":focus-visible"))),
    onBlur: () => setRing(false),
  };
  if (href)
    return (
      <a href={href} data-tag="" onClick={click} {...ev} style={s}>
        {text}
      </a>
    );
  return (
    <button
      type="button"
      data-tag=""
      onClick={() => onOpen && onOpen(tag)}
      {...ev}
      style={{ all: "unset", display: "inline", font: "inherit", ...s }}
    >
      {text}
    </button>
  );
}

/** One part of a parsed body: a run of text, or a tag with its page and the text as written. */
export type TagPart =
  string | { tag: string; href?: string | undefined; text?: string | undefined };

export type TagTextProps = {
  /** The app's parser output. */
  parts: readonly TagPart[] | null | undefined;
  c?: CardC | undefined;
  onOpenTag?: ((tag: string) => void) | undefined;
};

export function TagText({ parts, c = "connect", onOpenTag }: TagTextProps) {
  return (
    <>
      {(parts || []).map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <TagLink key={i} tag={p.tag} c={c} href={p.href} onOpen={onOpenTag}>
            {p.text}
          </TagLink>
        ),
      )}
    </>
  );
}
