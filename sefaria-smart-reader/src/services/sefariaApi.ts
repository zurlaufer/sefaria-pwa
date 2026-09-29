import {
  apiRefToCanonical,
  canonicalRef,
  chapterOf,
  displayRef,
  parseRef,
  stripRange,
} from '@/utils/ref'
import {
  isIndexBook,
  type ApiError,
  type LoadedText,
  type SefariaIndexBook,
  type SefariaIndexNode,
  type SefariaLink,
  type SefariaTextBody,
  type SefariaTextResponse,
  type TextSegment,
} from '@/types/sefaria'

/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */

const ORIGIN = 'https://www.sefaria.org'
const API = `${ORIGIN}/api`

/** Abort a request after this long so the UI never hangs on a dead network. */
const REQUEST_TIMEOUT_MS = 15_000

export const API_ENDPOINTS = {
  /** Sefaria's v3 text endpoint. */
  text: (ref: string) => `${API}/v3/texts/${encodeURIComponent(stripRange(canonicalRef(ref)))}?context=0`,
  /**
   * Commentary links. Sefaria exposes no v3 route for this; the unversioned
   * `/api/links/{ref}` endpoint is the live one and returns a flat array.
   */
  links: (ref: string, type = 'commentary') =>
    `${API}/links/${encodeURIComponent(canonicalRef(ref))}?type=${encodeURIComponent(type)}`,
  /**
   * The library catalogue. Note: `/api/v2/index/` now 404s — the unversioned
   * `/api/index` route is what serves the tree (~4 MB, 6 600+ books), so it is
   * loaded lazily and cached hard.
   */
  index: () => `${API}/index`,
} as const

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class SefariaError extends Error {
  readonly status: number
  readonly kind: ApiError['kind']
  readonly offline: boolean

  constructor(message: string, status: number, kind: ApiError['kind'], offline = false) {
    super(message)
    this.name = 'SefariaError'
    this.status = status
    this.kind = kind
    this.offline = offline
  }

  toApiError(): ApiError {
    return { message: this.message, status: this.status, kind: this.kind, offline: this.offline }
  }
}

function kindForStatus(status: number): ApiError['kind'] {
  if (status === 404) return 'not-found'
  if (status === 0) return 'network'
  if (status >= 500) return 'server'
  return 'unknown'
}

async function errorFromResponse(response: Response): Promise<SefariaError> {
  const { status } = response

  let detail = ''
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') {
      const err = (body as { error?: unknown }).error
      if (typeof err === 'string') detail = err
    }
  } catch {
    /* Body was not JSON; the status alone is enough. */
  }

  let message: string
  if (status === 404) {
    message = detail || 'That reference was not found on Sefaria.'
  } else if (status === 429) {
    message = 'Sefaria is rate limiting us. Please wait a moment and try again.'
  } else if (status >= 500) {
    message = 'Sefaria is having trouble right now. Please try again shortly.'
  } else {
    message = detail || `Request failed (HTTP ${status}).`
  }
  return new SefariaError(message, status, kindForStatus(status))
}

/* -------------------------------------------------------------------------- */
/*  Core fetch                                                                 */
/* -------------------------------------------------------------------------- */

export interface FetchOptions {
  signal?: AbortSignal
  /** Serve strictly from the cache; fail if the resource was never fetched. */
  offlineOnly?: boolean
}

/**
 * JSON fetch with a timeout, abort plumbing and typed errors.
 *
 * The service worker owns HTTP caching for `/api/*` routes; the browser HTTP
 * cache is bypassed to avoid two competing layers of staleness. `offlineOnly`
 * reads straight from the Cache Storage, which also works before the service
 * worker has activated.
 */
async function requestJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  if (options.offlineOnly) {
    if (typeof caches === 'undefined') {
      throw new SefariaError('Offline reading needs a browser with Cache Storage.', 0, 'network', true)
    }
    const cached = await caches.match(url)
    if (cached) return (await cached.json()) as T
    throw new SefariaError(
      'This text has not been downloaded yet, so it is not available offline.',
      0,
      'network',
      true,
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    })

    if (!response.ok) throw await errorFromResponse(response)
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof SefariaError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      // A caller-initiated abort must propagate untouched so React can ignore it.
      if (options.signal?.aborted) throw error
      throw new SefariaError('The request timed out. Check your connection.', 0, 'network')
    }
    if (error instanceof TypeError || (error instanceof Error && error.message.includes('socket connection was closed'))) {
      throw new SefariaError('Could not reach Sefaria. Connection closed unexpectedly or you are offline.', 0, 'network', true)
    }
    throw new SefariaError('Something went wrong loading this text.', 0, 'unknown')
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

/* -------------------------------------------------------------------------- */
/*  Text normalisation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Flatten Sefaria's polymorphic `text` payload into a plain segment list.
 *
 * - `string`     → a single segment
 * - `string[]`   → N segments inside one section
 * - `string[][]` → the ref spans sections; each inner array is one section
 *   (e.g. a Talmud daf boundary, `Shevuot 31b-32a`)
 */
export function flattenTextBody(body: SefariaTextBody): string[] {
  if (typeof body === 'string') return [body]
  if (!body.length) return []
  if (typeof body[0] === 'string') return body as string[]
  return (body as string[][]).flat()
}

/** The nested grouping of a spanning payload, or a normalised single-level list. */
function textGroups(body: SefariaTextBody): string[][] {
  if (typeof body === 'string') return [[body]]
  if (!body.length) return []
  if (typeof body[0] === 'string') return (body as string[]).map((part) => [part])
  return body as string[][]
}

/** Prefer the vocalised Hebrew base text over any other available version. */
function pickVersion(response: SefariaTextResponse) {
  const versions = response.versions ?? []
  return (
    versions.find((v) => v.isPrimary) ??
    versions.find((v) => v.language === 'he') ??
    versions[0] ??
    null
  )
}

const EN_UNIT_NAMES: Record<string, string> = {
  Chapter: 'Chapter',
  Halakhah: 'Halakhah',
  Halakhot: 'Halakhah',
  Verse: 'Verse',
  Perek: 'Perek',
  Mishnah: 'Mishnah',
  Midrash: 'Midrash',
  Sefer: 'Sefer',
  Integer: 'Daf',
  Line: 'Line',
  Taz: 'Taz',
  Paragraph: 'Paragraph',
}

/**
 * Turn Sefaria's addressing names into readable unit labels.
 * `level` is 1 for the top-level address (perek / daf) and `textDepth` for the
 * deepest one (halacha / verse / daf line).
 */
function unitLabel(response: SefariaTextResponse, level: number): { en: string; he: string } {
  // Talmud addresses dafs; Sefaria's own name for that level is "Integer".
  if (response.primary_category === 'Talmud') {
    return level === 1 ? { en: 'Daf', he: 'דף' } : { en: 'Daf line', he: 'שורה' }
  }

  const index = Math.max(0, level - 1)
  const he = response.addressTypes?.[index]
  const en = response.sectionNames?.[index]
  if (!en && !he) return { en: 'Verse', he: 'פסוק' }
  return { en: EN_UNIT_NAMES[en ?? ''] ?? en ?? 'Verse', he: he ?? en ?? 'פסוק' }
}

/**
 * Build the segment list for a loaded chapter.
 *
 * Segment refs are derived from the response's own `book` field rather than the
 * requested ref, so titles containing commas, apostrophes or spaces stay correct.
 */
function buildSegments(response: SefariaTextResponse, body: SefariaTextBody): TextSegment[] {
  const bookRef = response.book.replace(/\s+/g, '_')
  const [fromChapter = '1'] = response.sections
  const groups = textGroups(body)

  const segments: TextSegment[] = []
  groups.forEach((group, groupIndex) => {
    // For a spanning ref the outer array holds one entry per crossed section.
    const chapterPart = response.isSpanning
      ? (response.sections[groupIndex] ?? fromChapter)
      : fromChapter
    group.forEach((he, offset) => {
      const ref = `${bookRef}.${chapterPart}.${offset + 1}`
      segments.push({ index: segments.length, ref, displayRef: displayRef(ref), he })
    })
  })

  return segments
}

/** Normalise a raw v3 payload into the shape the reader consumes. */
export function normaliseTextResponse(response: SefariaTextResponse): LoadedText {
  const version = pickVersion(response)
  if (!version) {
    throw new SefariaError('Sefaria returned no text for this reference.', 404, 'not-found')
  }

  const segments = buildSegments(response, version.text)
  if (!segments.length) {
    throw new SefariaError('This section is empty in the available version.', 404, 'not-found')
  }

  const bookRef = response.book.replace(/\s+/g, '_')
  const unit = unitLabel(response, response.textDepth)
  const chapterUnit = unitLabel(response, 1)
  const first = segments[0]
  if (!first) throw new SefariaError('This section is empty.', 404, 'not-found')

  return {
    ref: stripRange(canonicalRef(response.ref)),
    resolvedRef: stripRange(canonicalRef(response.ref)),
    heRef: response.heRef,
    bookRef,
    bookTitle: response.book,
    heBook: response.heBook || response.heTitle || '',
    segments,
    nextChapter: response.next ? apiRefToCanonical(response.next, response.book) : null,
    prevChapter: response.prev ? apiRefToCanonical(response.prev, response.book) : null,
    firstSegmentRef: first.ref,
    textDepth: response.textDepth,
    unitName: unit.en,
    unitNameHe: unit.he,
    chapterUnitName: chapterUnit.en,
    chapterUnitNameHe: chapterUnit.he,
    versionTitle: version.versionTitle,
    license: version.license,
    sourceUrl: `https://www.sefaria.org/${response.ref.replace(/ /g, '_')}`,
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch a chapter / daf / section of a Sefaria text.
 *
 * The reader always requests a *chapter-level* ref so the whole unit is
 * available for rendering, bookmarking and progress arithmetic.
 */
export async function fetchText(ref: string, options: FetchOptions = {}): Promise<LoadedText> {
  const target = stripRange(canonicalRef(ref))
  if (!target) throw new SefariaError('No reference was provided.', 400, 'unknown')

  const response = await requestJson<SefariaTextResponse>(API_ENDPOINTS.text(target), options)
  if (!response || typeof response !== 'object' || !Array.isArray(response.versions)) {
    throw new SefariaError('Sefaria returned an unexpected response.', 0, 'parse')
  }
  return normaliseTextResponse(response)
}

/**
 * Warm the cache for the next chapter without blocking the UI.
 * Best-effort: failures are swallowed, and the service worker stores the result
 * in the `sefaria-texts` cache so the next chapter opens instantly next time.
 */
export function prefetchText(ref: string): void {
  if (typeof window === 'undefined') return
  const target = stripRange(canonicalRef(ref))
  if (!target) return
  void fetch(API_ENDPOINTS.text(target), { headers: { Accept: 'application/json' } }).catch(
    () => undefined,
  )
}

/**
 * Fetch the commentaries linked to a verse / halacha / daf.
 * The endpoint returns a flat array of link records.
 */
export async function fetchCommentaryLinks(
  ref: string,
  options: FetchOptions & { type?: string } = {},
): Promise<SefariaLink[]> {
  const { type = 'commentary', ...rest } = options
  const target = stripRange(canonicalRef(ref))
  if (!target) return []

  const data = await requestJson<SefariaLink[] | { refs?: SefariaLink[] }>(
    API_ENDPOINTS.links(target, type),
    rest,
  )

  const links = Array.isArray(data) ? data : (data.refs ?? [])
  return links
    .filter((link): link is SefariaLink => Boolean(link) && typeof link.ref === 'string')
    .map((link) => ({ ...link, ref: canonicalRef(link.ref) }))
}

/* -------------------------------------------------------------------------- */
/*  Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export type CatalogueEntry = SefariaIndexBook & {
  /** Canonical underscore ref used everywhere else in the app. */
  ref: string
  /** Lowercased haystack for fast client-side search. */
  searchKey: string
}

let indexCache: CatalogueEntry[] | null = null
let indexPromise: Promise<CatalogueEntry[]> | null = null

function walk(node: SefariaIndexNode, out: CatalogueEntry[]): void {
  if (isIndexBook(node)) {
    out.push({
      ...node,
      ref: node.title.replace(/\s+/g, '_'),
      searchKey: `${node.title} ${node.heTitle} ${(node.categories ?? []).join(' ')}`.toLowerCase(),
    })
    return
  }
  for (const child of node.contents ?? []) walk(child, out)
}

/** Load and flatten the Sefaria catalogue into a searchable book list. */
export function fetchCatalogue(options: FetchOptions = {}): Promise<CatalogueEntry[]> {
  if (options.signal) return loadCatalogue(options)
  if (indexCache) return Promise.resolve(indexCache)
  if (indexPromise) return indexPromise

  indexPromise = loadCatalogue(options).catch((error: unknown) => {
    indexPromise = null
    throw error
  })
  return indexPromise
}

async function loadCatalogue(options: FetchOptions): Promise<CatalogueEntry[]> {
  const tree = await requestJson<SefariaIndexNode[]>(API_ENDPOINTS.index(), options)
  const books: CatalogueEntry[] = []
  for (const node of tree) walk(node, books)
  books.sort((a, b) => a.title.localeCompare(b.title))
  indexCache = books
  return books
}

/** The catalogue, if it has already been fetched this session. */
export function peekCatalogue(): CatalogueEntry[] | null {
  return indexCache
}

/** Look up a book in the already-loaded catalogue, or null. */
export function findBookInCatalogue(needle: string): CatalogueEntry | null {
  if (!indexCache) return null
  const key = canonicalRef(needle).toLowerCase()
  const spaced = key.replace(/_/g, ' ')
  return (
    indexCache.find((b) => b.ref.toLowerCase() === key) ??
    indexCache.find((b) => b.title.toLowerCase() === spaced) ??
    null
  )
}

/** Everything the "add a book" flow needs to know about a reference. */
export interface ResolvedRef {
  bookRef: string
  title: string
  heTitle: string
  primaryCategory?: string
  /** Canonical ref of the book's first chapter/daf. */
  firstChapterRef: string
  /** Canonical ref of the first addressable segment. */
  firstSegmentRef: string
  nextChapterRef: string | null
  unitName: string
  unitNameHe: string
  /** Total top-level units in the book, from Sefaria's `lengths[0]`. */
  topLevelTotal: number
}

/**
 * Validate a ref and read back the resolved book metadata.
 *
 * A bare book ref (e.g. "Genesis") is resolved by probing its first chapter,
 * which is cheap; only if that 404s — as it does for Talmud, where chapters are
 * dafs — does this fall back to querying the whole book for
 * `firstAvailableSectionRef`.
 */
export async function resolveRef(
  ref: string,
  options: FetchOptions = {},
): Promise<ResolvedRef> {
  const target = stripRange(canonicalRef(ref))
  if (!target) throw new SefariaError('Enter a Sefaria reference to continue.', 400, 'unknown')

  const { book, path } = parseRef(target)
  const attempts = path.length ? [target] : [`${book}.1`, book]
  let lastError: SefariaError | null = null

  for (const attempt of attempts) {
    try {
      const response = await requestJson<SefariaTextResponse>(API_ENDPOINTS.text(attempt), options)
      if (!Array.isArray(response.versions)) continue

      const bookRef = response.book.replace(/\s+/g, '_')
      const unit = unitLabel(response, response.textDepth)
      const firstSegment = response.firstAvailableSectionRef
        ? apiRefToCanonical(response.firstAvailableSectionRef, response.book)
        : `${bookRef}.1`

      return {
        bookRef,
        title: response.book,
        heTitle: response.heBook || response.heTitle || '',
        primaryCategory: response.primary_category,
        firstChapterRef: chapterOf(firstSegment),
        firstSegmentRef: firstSegment,
        nextChapterRef: response.next ? apiRefToCanonical(response.next, response.book) : null,
        unitName: unit.en,
        unitNameHe: unit.he,
        // `lengths` is book-level: [total top-level units, total segments].
        topLevelTotal: Math.max(1, response.lengths?.[0] ?? 1),
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (error instanceof SefariaError) {
        // Only a 404 justifies another guess; anything else is a real failure.
        if (error.kind === 'not-found') {
          lastError = error
          continue
        }
        throw error
      }
      throw error
    }
  }

  throw lastError ?? new SefariaError('That reference was not found on Sefaria.', 404, 'not-found')
}
