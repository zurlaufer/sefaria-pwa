/* -------------------------------------------------------------------------- */
/*  Hebrew text helpers                                                        */
/*                                                                             */
/*  Sefaria returns HTML fragments in which <i> marks words carrying vowel      */
/*  points / cantillation, <big> marks structural emphasis, and <small> marks  */
/*  notes. The points are real Unicode combining marks rather than glyph        */
/*  variants, so hiding them is a text transform, not a CSS concern.            */
/* -------------------------------------------------------------------------- */

/**
 * Hebrew combining marks:
 *   U+0591–U+05AF  cantillation accents
 *   U+05B0–U+05BD  vowel points (niqqud)
 *   U+05BF         rafe
 *   U+05C1–U+05C2  shin / sin dot
 *   U+05C4–U+05C5  upper / lower dot
 *   U+05C7         qamats qatan
 */
const COMBINING_MARKS = /[\u0591-\u05AF\u05B0-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g

/** Maqaf, sof pasuq, paseq, geresh, gershayim. */
const HEBREW_PUNCTUATION = /[־׃׆׳״]/g

/** Any Hebrew block character, used to detect blank segments. */
const HEBREW_BLOCK = /[֐-׿]/g

/**
 * Remove any element that is not on the keep-list, leaving its text behind.
 * A negative lookahead keeps this to a single pass over the markup.
 */
const DISALLOWED_TAGS =
  /<\/?(?!i\b|b\b|em\b|strong\b|big\b|small\b|sup\b|sub\b|br\b|span\b|div\b|p\b)[a-z][a-z0-9]*\b[^>]*>/gi

/**
 * Strip everything Sefaria should never send (scripts, styles, media) and
 * neutralise anything that could execute, while keeping the readable text.
 */
export function sanitizeSefariaHtml(html: string): string {
  let out = html

  // Dangerous elements are removed with their contents.
  out = out.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
  out = out.replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*\/?>/gi, '')

  // Images and media add nothing here and break the reading rhythm.
  out = out.replace(/<(img|video|audio|source|picture|svg|canvas)\b[\s\S]*?(?:\/>|<\/\1\s*>)/gi, '')

  // Neutralise inline event handlers and javascript: URLs.
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/(href|src|xlink:href)\s*=\s*("|')?\s*javascript:[^"'\s>]*("|')?/gi, '')

  // Everything else outside the keep-list is unwrapped.
  out = out.replace(DISALLOWED_TAGS, '')

  return out.replace(/\s{2,}/g, ' ').trim()
}

export interface HebrewTextOptions {
  /** Keep niqqud and cantillation accents. */
  vowels?: boolean
  /** Keep maqaf, sof pasuq and geresh. */
  punctuation?: boolean
}

/**
 * Produce display-safe HTML for a Sefaria segment.
 *
 * Sanitises the markup, then optionally strips Hebrew combining marks so a
 * fluent reader can drop the points when revising — they add noise once the
 * text is familiar.
 */
export function renderHebrew(html: string, options: HebrewTextOptions = {}): string {
  const { vowels = true, punctuation = true } = options
  let out = sanitizeSefariaHtml(html)

  if (!vowels) out = out.replace(COMBINING_MARKS, '')
  if (!punctuation) out = out.replace(HEBREW_PUNCTUATION, '')

  return out.trim()
}

/** Plain-text preview, e.g. for commentary list rows. */
export function toPlainText(html: string): string {
  return sanitizeSefariaHtml(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when a segment carries no readable text (e.g. a spacer verse). */
export function isEmptySegment(html: string): boolean {
  return toPlainText(html).replace(HEBREW_BLOCK, '').length === 0
}
