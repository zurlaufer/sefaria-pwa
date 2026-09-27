import type { BookProgress, LibraryBook, PersistedState, Settings } from '@/types/sefaria'
import { clamp, dateKey } from '@/utils/format'

const STORAGE_KEY = 'sefaria-smart-reader/state/v1'
const SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 3,
  theme: 'system',
  showVowels: true,
  showPunctuation: true,
  hebrewFont: 'rhl',
}

export function emptyState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    books: [],
    progress: {},
    history: {},
    settings: { ...DEFAULT_SETTINGS },
  }
}

/* -------------------------------------------------------------------------- */
/*  Reading & writing                                                          */
/* -------------------------------------------------------------------------- */

/** localStorage is unavailable in private mode / SSR; every call must tolerate that. */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return null
    const probe = '__sefaria_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function sanitiseBook(value: unknown): LibraryBook | null {
  if (!isRecord(value)) return null
  const { id, ref, title } = value
  if (typeof id !== 'string' || typeof ref !== 'string' || typeof title !== 'string') return null

  const pace = isRecord(value.pace) ? value.pace : {}
  const unit = pace.unit === 'chapter' ? 'chapter' : 'segment'
  const amount = clamp(Math.trunc(Number(pace.amount)), 1, 999) || 1

  const accents = ['teal', 'gold', 'indigo', 'rose', 'emerald', 'amber'] as const
  const accent = accents.includes(value.accent as (typeof accents)[number])
    ? (value.accent as LibraryBook['accent'])
    : accents[0]

  return {
    id,
    ref,
    title,
    heTitle: typeof value.heTitle === 'string' ? value.heTitle : '',
    primaryCategory: typeof value.primaryCategory === 'string' ? value.primaryCategory : undefined,
    pace: { unit, amount },
    addedAt: typeof value.addedAt === 'string' ? value.addedAt : new Date().toISOString(),
    accent,
    topLevelTotal: Math.max(1, Math.trunc(Number(value.topLevelTotal)) || 1),
  }
}

function sanitiseProgress(value: unknown): BookProgress | null {
  if (!isRecord(value)) return null
  const { ref, chapterRef } = value
  if (typeof ref !== 'string' || typeof chapterRef !== 'string') return null
  return {
    ref,
    chapterRef,
    segmentIndex: Math.max(0, Math.trunc(Number(value.segmentIndex)) || 0),
    totalSegments: Math.max(0, Math.trunc(Number(value.totalSegments)) || 0),
    lastStudiedAt:
      typeof value.lastStudiedAt === 'string' ? value.lastStudiedAt : new Date().toISOString(),
    lastQuotaDate: typeof value.lastQuotaDate === 'string' ? value.lastQuotaDate : null,
  }
}

function sanitiseSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
  return {
    fontSize: clamp(Math.trunc(Number(value.fontSize)) || DEFAULT_SETTINGS.fontSize, 1, 5),
    theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
    showVowels: value.showVowels !== false,
    showPunctuation: value.showPunctuation !== false,
    hebrewFont: value.hebrewFont === 'naskh' ? 'naskh' : 'rhl',
  }
}

/**
 * Load persisted state, repairing anything malformed.
 * Corrupt or partial data degrades to defaults rather than crashing the app.
 */
export function loadState(): PersistedState {
  const store = storage()
  if (!store) return emptyState()

  const raw = store.getItem(STORAGE_KEY)
  if (!raw) return emptyState()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return emptyState()

    const books = Array.isArray(parsed.books)
      ? parsed.books.map(sanitiseBook).filter((b): b is LibraryBook => b !== null)
      : []

    const progress: Record<string, BookProgress> = {}
    if (isRecord(parsed.progress)) {
      for (const [id, value] of Object.entries(parsed.progress)) {
        const clean = sanitiseProgress(value)
        if (clean) progress[id] = clean
      }
    }

    const history: Record<string, Record<string, number>> = {}
    if (isRecord(parsed.history)) {
      for (const [day, byBook] of Object.entries(parsed.history)) {
        if (!isRecord(byBook)) continue
        const entries: Record<string, number> = {}
        for (const [bookId, count] of Object.entries(byBook)) {
          const n = Math.max(0, Math.trunc(Number(count)) || 0)
          if (n > 0) entries[bookId] = n
        }
        if (Object.keys(entries).length) history[day] = entries
      }
    }

    return {
      version: SCHEMA_VERSION,
      books,
      progress,
      history,
      settings: sanitiseSettings(parsed.settings),
    }
  } catch {
    // Unparseable payload — start fresh rather than trapping the user in a
    // broken state they cannot clear from the UI.
    return emptyState()
  }
}

export function saveState(state: PersistedState): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }))
  } catch {
    // Quota exceeded (the Sefaria catalogue is never stored here, so this is
    // unlikely) — drop the write and keep running in memory.
  }
}

/* -------------------------------------------------------------------------- */
/*  Small helpers shared by the hooks                                          */
/* -------------------------------------------------------------------------- */

/** Pace units of `bookId` completed on `day` (0 when none). */
export function unitsCompletedToday(
  history: PersistedState['history'],
  bookId: string,
  day = dateKey(),
): number {
  return history[day]?.[bookId] ?? 0
}

/** Normalise any ref into the stable id used as the library key. */
export function bookIdFor(ref: string): string {
  return ref.replace(/\s+/g, '_')
}
