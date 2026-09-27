/* -------------------------------------------------------------------------- */
/*  Sefaria REST API wire types                                                */
/*  Verified against the live API (2026-09):                                   */
/*    GET https://www.sefaria.org/api/v3/texts/{ref}?context=0                 */
/*    GET https://www.sefaria.org/api/links/{ref}?type=commentary              */
/*    GET https://www.sefaria.org/api/index                                    */
/* -------------------------------------------------------------------------- */

/**
 * A single rendered version of a text.
 *
 * Sefaria's v3 `text` field is polymorphic:
 *   - `string`      → the ref resolves to exactly one segment
 *   - `string[]`    → the ref resolves to N segments within a single section
 *   - `string[][]`  → the ref *spans* several top-level sections (e.g. a Talmud
 *                     daf boundary such as `Shevuot 31b-32a`); each inner array
 *                     is one top-level section.
 */
export type SefariaTextBody = string | string[] | string[][]

export interface SefariaVersion {
  /** The segment(s) themselves. See {@link SefariaTextBody}. */
  text: SefariaTextBody
  /** Human readable name of this version, e.g. "Torat Emet 363". */
  versionTitle: string
  versionTitleInHebrew?: string
  /** `he` for the base/vocalised text. */
  language: string
  actualLanguage?: string
  /** `he` | `en` — Sefaria always renders Hebrew right-to-left. */
  direction: 'rtl' | 'ltr'
  /** The version Sefaria chose as the default for this ref. */
  isPrimary?: boolean
  /** `locked` | `open`. Locked versions may forbid derivative works. */
  status?: string
  license?: string
  /** NB: Sefaria's API spells this key in lower case. */
  heversionSource?: string
  versionSource?: string
  formatAsPoetry?: string
}

export interface SefariaAvailableVersion {
  versionTitle: string
  versionTitleInHebrew?: string
  language: string
  status?: string
  license?: string
}

/** Raw shape of `GET /api/v3/texts/{ref}`. */
export interface SefariaTextResponse {
  ref: string
  heRef: string
  /** Book title in display form, e.g. "Mishneh Torah, Human Dispositions". */
  book: string
  heBook?: string
  heTitle?: string
  /** Full normalised ref in display form, e.g. "Mishneh Torah, Human Dispositions 1:1". */
  title?: string
  type?: string
  primary_category?: string
  categories?: string[]
  indexTitle?: string
  heIndexTitle?: string
  isComplex?: boolean

  /** Resolved start address, e.g. `["1", "1"]`. */
  sections: string[]
  /** Resolved end address, e.g. `["1", "3"]`. */
  toSections: string[]
  /** The enclosing chapter/daf, e.g. "Genesis 1". */
  sectionRef: string
  heSectionRef?: string
  firstAvailableSectionRef?: string
  /** True when the ref crosses a top-level section boundary. */
  isSpanning: boolean

  /** Next top-level section in display form, or null at the end of a book. */
  next: string | null
  prev: string | null

  /** 1-based addressing depth (Genesis = 2, Mishneh Torah = 2, Talmud = 2). */
  textDepth: number
  /** e.g. ["Chapter", "Halakhah"] */
  sectionNames: string[]
  /** Sefaria's Hebrew addressing names, e.g. ["Perek", "Halakhah"]. */
  addressTypes: string[]

  /**
   * Book-level totals per addressing depth, e.g. `[50, 1533]` for Genesis =
   * 50 chapters / 1533 verses. NOT the length of the requested ref.
   */
  lengths: number[]
  length: number

  versions: SefariaVersion[]
  available_versions?: SefariaAvailableVersion[]
  warnings?: unknown[]
}

/** A `ref` / `sectionRef` as returned by the API, in display form. */
export interface SefariaLink {
  _id?: string
  /** Index title of the commentary, e.g. "Steinsaltz on Mishneh Torah…". */
  index_title: string
  heTitle?: string
  /** The ref of the commentary's own text. */
  ref: string
  sourceRef?: string
  sourceHeRef?: string
  /** The base-text ref this commentary is anchored to. */
  anchorRef?: string
  anchorVerse?: number
  type?: string
  category?: string
  collectiveTitle?: { en?: string; he?: string }
  /** Some links already inline a short Hebrew preview. */
  he?: string
  /** ...and an English preview. */
  text?: string
  commentaryNum?: number
  license?: string
  heLicense?: string
  versionTitle?: string
  heVersionTitle?: string
}

/** Raw shape of `GET /api/index` (the Sefaria library catalogue). */
export interface SefariaIndexCategory {
  category: string
  heCategory: string
  order: number
  en?: string
  he?: string
  contents?: SefariaIndexNode[]
}

export interface SefariaIndexGroup {
  category: string
  heCategory?: string
  en: string
  he: string
  order?: number
  texts?: number
  contents?: SefariaIndexNode[]
}

/** A leaf of the catalogue is a book. NB: the key is `title`, not `en`. */
export interface SefariaIndexBook {
  title: string
  heTitle: string
  primary_category?: string
  categories: string[]
  corpus?: string
  order?: number
  enShortDesc?: string
  heShortDesc?: string
  enDesc?: string
  heDesc?: string
}

export type SefariaIndexNode = SefariaIndexCategory | SefariaIndexGroup | SefariaIndexBook

/* -------------------------------------------------------------------------- */
/*  Normalised domain types consumed by the UI                                  */
/* -------------------------------------------------------------------------- */

export function isIndexBook(node: SefariaIndexNode): node is SefariaIndexBook {
  return typeof (node as SefariaIndexBook).title === 'string'
}

/** One addressable unit of text: a verse, a halacha, a daf line, … */
export interface TextSegment {
  /** Zero-based index within the loaded chapter. */
  index: number
  /** Canonical ref, underscore form: `Mishneh_Torah,_Human_Dispositions.1.1`. */
  ref: string
  /** Display ref: `Mishneh Torah, Human Dispositions 1:1`. */
  displayRef: string
  /** Hebrew HTML exactly as returned by Sefaria (nikud + cantillation intact). */
  he: string
}

export interface LoadedText {
  /** Canonical chapter-level ref that was requested. */
  ref: string
  /** Normalised ref the API resolved to. */
  resolvedRef: string
  heRef: string
  /** Canonical book ref, underscore form. */
  bookRef: string
  bookTitle: string
  heBook: string
  segments: TextSegment[]
  /** Canonical ref of the next chapter/daf, or null at the end of the book. */
  nextChapter: string | null
  prevChapter: string | null
  /** Canonical ref of the first segment on this chapter. */
  firstSegmentRef: string
  textDepth: number
  /** English name for the deepest address, e.g. "Halakhah" or "Daf". */
  unitName: string
  /** Sefaria's own Hebrew addressing name for the deepest address. */
  unitNameHe: string
  /** English name for the top-level address, e.g. "Perek" or "Daf". */
  chapterUnitName: string
  /** Sefaria's Hebrew addressing name for the top-level address. */
  chapterUnitNameHe: string
  versionTitle: string
  license?: string
  sourceUrl: string
}

/* -------------------------------------------------------------------------- */
/*  Library / progress domain types                                            */
/* -------------------------------------------------------------------------- */

export type PaceUnit = 'segment' | 'chapter'

export interface Pace {
  unit: PaceUnit
  /** How many `unit`s to learn per day. Always >= 1. */
  amount: number
}

export interface LibraryBook {
  id: string
  /** Canonical book ref, underscore form. */
  ref: string
  title: string
  heTitle: string
  primaryCategory?: string
  pace: Pace
  addedAt: string
  /** Tailwind-friendly accent used for the progress ring. */
  accent: AccentColor
  /**
   * Total number of top-level units in the book (chapters for Tanakh, halachot
   * of a mishneh torah volume, dafim for a tractate). Taken from Sefaria's
   * `lengths[0]`, and used for honest whole-book progress.
   */
  topLevelTotal: number
}

export type AccentColor = 'teal' | 'gold' | 'indigo' | 'rose' | 'emerald' | 'amber'

export interface BookProgress {
  /** The bookmarked segment ref (canonical). */
  ref: string
  /** The chapter/daf containing the bookmark (canonical). */
  chapterRef: string
  /** Index of the bookmark inside its chapter. */
  segmentIndex: number
  /** Lifetime count of segments studied. */
  totalSegments: number
  /** ISO timestamp of the last time the reader was opened for this book. */
  lastStudiedAt: string
  /** Date (YYYY-MM-DD) the daily quota was last marked complete. */
  lastQuotaDate: string | null
}

export type Settings = {
  /** 1–5, mapped to `--reader-size`. */
  fontSize: number
  theme: 'light' | 'dark' | 'system'
  /** Render cantillation/vowel colour accents, or plain text. */
  showVowels: boolean
  showPunctuation: boolean
  /** Hebrew typeface. */
  hebrewFont: 'rhl' | 'naskh'
}

export type PersistedState = {
  version: number
  books: LibraryBook[]
  progress: Record<string, BookProgress>
  /**
   * Day (`YYYY-MM-DD`) -> bookId -> pace units completed that day.
   * Counted in the book's own pace unit: segments for a "3 halachot a day"
   * book, chapters for a "1 perek a day" book.
   */
  history: Record<string, Record<string, number>>
  settings: Settings
}

/* -------------------------------------------------------------------------- */
/*  Async state helpers                                                        */
/* -------------------------------------------------------------------------- */

export type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: ApiError }

export interface ApiError {
  message: string
  /** HTTP status, or 0 for network / offline failures. */
  status: number
  kind: 'network' | 'not-found' | 'server' | 'parse' | 'unknown'
  /** True when the request never reached the network. */
  offline: boolean
}
