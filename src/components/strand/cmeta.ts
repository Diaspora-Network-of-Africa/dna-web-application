// Ported from Strand components/dna/cmeta.js (extraction 3654dd17). Behavior unchanged. C_GLYPH is
// at compile sha256-89356d2d39fef8a6 (1894; docs/strand-ports/sha256-89356d2d39fef8a6.md).
export type C = "connect" | "convene" | "collaborate" | "contribute" | "convey";
export type CardC = C | "system";

export const C_LABEL: Record<C, string> = {
  connect: "Connect",
  convene: "Convene",
  collaborate: "Collaborate",
  contribute: "Contribute",
  convey: "Convey",
};

// Strand compile sha256-89356d2d39fef8a6 (1894): the five Cs' glyphs (1887), the brand slot's 1A
// D + Africa icon (1891), and DIA's Nyansapo under `dia`, which no part reads (1889).
export const C_GLYPH: Record<C | "brand" | "dia", string> = {
  connect: "nkonsonkonson",
  convene: "ti-koro-nko",
  collaborate: "boa-me-na-me-mmoa-wo",
  contribute: "woforo-dua-paa",
  convey: "donno-ntoaso",
  brand: "dna-icon",
  dia: "nyansapo",
};

export const C_ORDER: C[] = ["connect", "convene", "collaborate", "contribute", "convey"];

/**
 * Ruling 400 (under 417): the composer carries no Connect verb. A connection request is not a post;
 * it is written by send_introduction from Connect and from the profile's Connect entry. The four
 * verbs that remain create an object from text, in C order, always visible (ruling 53).
 */
export type ComposerVerb = Exclude<C, "connect">;
export const COMPOSER_VERBS: ComposerVerb[] = ["convene", "collaborate", "contribute", "convey"];

/** Strand assets are served from public/strand (icons/, adinkra/, patterns/). */
export const STRAND_ASSET_BASE = "/strand/";
export function assetBase(): string {
  return STRAND_ASSET_BASE;
}
