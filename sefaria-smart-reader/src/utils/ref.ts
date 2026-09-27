/* -------------------------------------------------------------------------- */
/*  Sefaria reference (ref) utilities                                          */
/*                                                                             */
/*  Sefaria uses two equivalent notations for the same address:                */
/*    • underscore form  `Mishneh_Torah,_Human_Dispositions.1.1`  (URL safe)   */
/*    • display form     `Mishneh Torah, Human Dispositions 1:1` (human)       */
/*                                                                             */
/*  This app stores refs in the underscore form, because that is what survives  */
/*  a round trip through the URL, localStorage and deep links without escaping. */
/* -------------------------------------------------------------------------- */

const G_HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'

/** Hebrew numeric label for an index, e.g. 1 -> "א׳", 2 -> "ב׳". */
export function hebrewOrdinal(n: number): string {
  if (!Number.isFinite(n) || n < 1) return String(n)
  if (n > 400) return String(n)
  if (n === 15) return 'טו'
  if (n === 16) return 'טז'
  const base = G_HEBREW_LETTERS[(n - 1) % G_HEBREW_LETTERS.length] ?? String(n)
  return `${base}׳`
}

export interface ParsedRef {
  /** Canonical book ref, underscore form. */
  book: string
  /** Addressing path, e.g. `["1", "1"]` for `Book.1.1`. Empty for a bare book. */
  path: string[]
}

/** Split a ref into its book and addressing path. Sefaria titles contain no `.`. */
export function parseRef(ref: string): ParsedRef {
  const cleaned = canonicalRef(ref)
  const dot = cleaned.indexOf('.')
  if (dot === -1) return { book: cleaned, path: [] }
  return {
    book: cleaned.slice(0, dot),
    path: cleaned.slice(dot + 1).split('.').filter(Boolean),
  }
}

/** Build a canonical ref from parts. */
export function buildRef(book: string, path: readonly string[]): string {
  return path.length ? `${book}.${path.join('.')}` : book
}

/**
 * Normalise any user- or API-supplied ref into the canonical underscore form.
 *
 *   "Mishneh Torah, Human Dispositions 1:1"  ->  "Mishneh_Torah,_Human_Dispositions.1.1"
 *   "Mishneh_Torah,_Human_Dispositions.1.1"  ->  unchanged
 *   "Genesis 1"                              ->  "Genesis.1"
 *   "Shevuot 32a"                            ->  "Shevuot.32a"
 *   "Genesis 1:1-3"                          ->  "Genesis.1.1-3"
 *   "rambam_deot" (legacy alias)             ->  unchanged, passed through to Sefaria
 */
export function canonicalRef(input: string): string {
  const trimmed = input
    .trim()
    .replace(/^[\s"'“”‘’]+/, '')
    .replace(/[\s"'“”‘’]+$/, '')
  if (!trimmed) return ''

  // Already canonical, or an opaque legacy alias such as `rambam_deot`:
  // leave untouched and let the Sefaria API resolve or reject it.
  if (trimmed.includes('_')) return trimmed
  if (/^[A-Za-z0-9.]+$/.test(trimmed)) return trimmed

  // Display form: everything before the final space is the book title, the
  // remainder is the address ("1", "32a", "1:1", "1:1-3", "1:2:3").
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace === -1) return trimmed

  const book = trimmed.slice(0, lastSpace).replace(/\s+/g, '_')
  const address = trimmed.slice(lastSpace + 1).replace(/\s+/g, '').replace(/:/g, '.')
  return address ? `${book}.${address}` : book
}

/**
 * Drop any trailing range from a ref, keeping the start address.
 *   "Genesis.1.1-3" -> "Genesis.1.1"   "Genesis.1-2" -> "Genesis.1"
 */
export function stripRange(ref: string): string {
  const canonical = canonicalRef(ref)
  const { book, path } = parseRef(canonical)
  const last = path[path.length - 1]
  if (!path.length || !last?.includes('-')) return canonical
  return buildRef(book, [...path.slice(0, -1), last.split('-')[0] ?? last])
}

/**
 * Convert a ref from the API's display form into the canonical form, using the
 * response's own `book` value so titles ending in a digit stay unambiguous.
 */
export function apiRefToCanonical(apiRef: string, bookDisplay: string): string {
  const trimmed = apiRef.trim()
  const book = bookDisplay.trim()
  if (book && trimmed.toLowerCase().startsWith(book.toLowerCase())) {
    const tail = trimmed.slice(book.length).trim()
    if (!tail) return book.replace(/\s+/g, '_')
    return `${book.replace(/\s+/g, '_')}.${tail.replace(/\s+/g, '.')}`
  }
  return canonicalRef(trimmed)
}

/** Human-readable form: `Mishneh_Torah,_Human_Dispositions.1.1` -> "Mishneh Torah, Human Dispositions 1:1". */
export function displayRef(ref: string): string {
  const { book, path } = parseRef(ref)
  const bookPart = book.replace(/_/g, ' ')
  if (!path.length) return bookPart
  const [head = '', ...tail] = path
  return tail.length ? `${bookPart} ${head}:${tail.join(':')}` : `${bookPart} ${head}`
}

/** Just the book title in display form. */
export function bookTitle(ref: string): string {
  return parseRef(ref).book.replace(/_/g, ' ')
}

/** The enclosing chapter/daf: `Mishneh_Torah,_Human_Dispositions.1.1` -> `..._Dispositions.1`. */
export function chapterOf(ref: string): string {
  const { book, path } = parseRef(ref)
  const [head] = path
  return head ? `${book}.${head}` : book
}

/** The chapter/daf title in display form, e.g. "Mishneh Torah, Human Dispositions 1". */
export function chapterDisplay(ref: string): string {
  return displayRef(chapterOf(ref))
}

/** Deep segment one level down, 1-based: `Book.1.4` -> `Book.1.5`. */
export function nextSegmentRef(ref: string): string {
  const { book, path } = parseRef(ref)
  if (path.length < 2) return ref
  const last = path[path.length - 1]
  const n = last ? Number.parseInt(last, 10) : Number.NaN
  if (!Number.isFinite(n)) return ref
  const next = [...path]
  next[next.length - 1] = String(n + 1)
  return buildRef(book, next)
}

/** Deep segment one level back, 1-based. Returns the ref itself at the first. */
export function prevSegmentRef(ref: string): string {
  const { book, path } = parseRef(ref)
  if (path.length < 2) return ref
  const last = path[path.length - 1]
  const n = last ? Number.parseInt(last, 10) : Number.NaN
  if (!Number.isFinite(n) || n <= 1) return ref
  const next = [...path]
  next[next.length - 1] = String(n - 1)
  return buildRef(book, next)
}

/**
 * Ref of the Nth (0-based) segment inside a chapter.
 *
 * Relies on segments inside a chapter being addressed 1..N densely, which
 * Sefaria guarantees at the verse / halacha / daf-line level (verified for
 * Tanakh, Mishnah, Mishneh Torah and Talmud). Callers holding a loaded chapter
 * should prefer the segment refs the API itself returned.
 */
export function segmentRefAt(chapterRef: string, index: number): string {
  const { book, path } = parseRef(chapterRef)
  return buildRef(book, [...path, String(index + 1)])
}

/** True when the ref addresses a whole book rather than a location within it. */
export function isBookRef(ref: string): boolean {
  return parseRef(ref).path.length === 0
}

/**
 * Best-effort forward walk of `steps` segments with no network access.
 * Only used as a fallback when the enclosing chapter has not been loaded;
 * it deliberately does not guess across a chapter boundary.
 */
export function advanceRef(ref: string, steps: number): string {
  let out = ref
  for (let i = 0; i < Math.max(0, steps); i += 1) out = nextSegmentRef(out)
  return out
}

/** Deep link to a book only: `https://host/?book=Mishneh_Torah,_Human_Dispositions`. */
export function bookDeepLink(bookRef: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/+$/,
    '',
  )
  const { book } = parseRef(bookRef)
  return `${base}/?book=${encodeURIComponent(book)}`
}

/** Deep link to a specific location: `https://host/book/Genesis/1/1`. */
export function deepLink(ref: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/+$/,
    '',
  )
  const { book, path } = parseRef(ref)
  if (!path.length) return `${base}/?book=${encodeURIComponent(book)}`
  return `${base}/book/${book}/${path.join('/')}`
}

/** Link to the corresponding page on sefaria.org. */
export function sefariaUrl(ref: string): string {
  return `https://www.sefaria.org/${encodeURIComponent(displayRef(ref).replace(/ /g, '_'))}`
}

/** "Halakhah 3 of 7" style label for a position inside a chapter. */
export function positionLabel(index: number, total: number, unitName: string): string {
  return `${unitName} ${index + 1} of ${total}`
}
