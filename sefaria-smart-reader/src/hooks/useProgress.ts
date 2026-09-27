import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookProgress, LibraryBook, Pace, PersistedState, Settings } from '@/types/sefaria'
import {
  DEFAULT_SETTINGS,
  bookIdFor,
  emptyState,
  loadState,
  saveState,
  unitsCompletedToday,
} from '@/services/storage'
import { chapterOf, displayRef, nextSegmentRef } from '@/utils/ref'
import { clamp, dateKey, recentDateKeys } from '@/utils/format'
import { accentStyle } from '@/data/starterBooks'

/* -------------------------------------------------------------------------- */
/*  Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface BookSummary {
  book: LibraryBook
  progress: BookProgress | null
  /** Pace units completed today, in the book's own pace unit. */
  doneToday: number
  /** Pace units required today. */
  targetToday: number
  /** 0–100 towards today's goal. */
  percentToday: number
  quotaMet: boolean
  /** Display ref of the bookmark, e.g. "Mishneh Torah, Human Dispositions 1:3". */
  whereLabel: string
  /** 0–100 through the book, from the real chapter total. */
  percentBook: number
  /** Chapter number the bookmark sits in (1-based), or 0 when not started. */
  chapterNumber: number
  lastStudiedAt: string | null
  /** Consecutive days with a completed quota, counting back from today. */
  streak: number
  accent: ReturnType<typeof accentStyle>
}

export interface AddBookInput {
  ref: string
  title: string
  heTitle: string
  primaryCategory?: string
  pace: Pace
  accent: LibraryBook['accent']
  /** Total top-level units in the book, for whole-book progress. */
  topLevelTotal: number
  /** Chapter to start from; defaults to the book root. */
  startRef?: string
}

/** Enough of a loaded chapter for the engine to advance across its boundary. */
export interface ChapterHint {
  ref: string
  segmentCount: number
  nextChapterRef: string | null
}

export interface HistoryDay {
  day: string
  byBook: Record<string, number>
  total: number
}

export type ImportResult = { ok: true } | { ok: false; message: string }

export interface UseProgress {
  ready: boolean
  books: LibraryBook[]
  summaries: BookSummary[]
  settings: Settings
  today: string
  history: HistoryDay[]
  /** Number of the last `history.length` days on which anything was studied. */
  activeDays: number

  getSummary: (bookRef: string) => BookSummary | undefined
  getProgress: (bookRef: string) => BookProgress | null

  addBook: (input: AddBookInput) => LibraryBook
  removeBook: (bookId: string) => void
  updatePace: (bookId: string, pace: Pace) => void
  setAccent: (bookId: string, accent: LibraryBook['accent']) => void
  renameBook: (bookId: string, title: string, heTitle: string) => void
  moveBook: (fromIndex: number, toIndex: number) => void

  /** Move the bookmark to an explicit ref. */
  setBookmark: (
    bookId: string,
    target: { ref: string; chapterRef: string; segmentIndex: number; chapterTotal: number },
  ) => void
  /** Credit one unit of today's goal (only for segment-paced books). */
  markUnitStudied: (bookId: string) => void
  /**
   * Mark today's goal complete: top up today's history to the target and move
   * the bookmark to where the next session should begin.
   */
  completeQuota: (bookId: string, chapter?: ChapterHint | null) => void
  /** Undo today's completion, restoring the previous bookmark and credit. */
  undoQuota: (bookId: string) => void

  updateSettings: (patch: Partial<Settings>) => void
  resetAll: () => void
  importState: (raw: string) => ImportResult
  exportState: () => string
}

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

const HISTORY_WINDOW = 14

function shiftDay(key: string, delta: number): string {
  const [y = '0', m = '1', d = '1'] = key.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  date.setDate(date.getDate() + delta)
  return dateKey(date)
}

function computeStreak(history: PersistedState['history'], bookId: string, today: string): number {
  // A streak stays alive if today is not done yet, so start from yesterday.
  let cursor = unitsCompletedToday(history, bookId, today) > 0 ? today : shiftDay(today, -1)
  let streak = 0
  while (streak < 400 && unitsCompletedToday(history, bookId, cursor) > 0) {
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

/** 1-based index of the chapter a bookmark sits in, or 0 when not addressable. */
function chapterNumberOf(ref: string): number {
  const [, first = ''] = ref.split('.')
  const n = Number.parseInt(first, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Whole-book progress, using Sefaria's real top-level unit count. */
function bookPercent(progress: BookProgress | null, totalUnits: number): number {
  const chapter = chapterNumberOf(progress?.ref ?? '')
  if (!progress || chapter <= 0 || totalUnits <= 0) return 0
  return clamp(Math.round((chapter / totalUnits) * 100), 0, 100)
}

/**
 * Walk `steps` segments forward, crossing into the next chapter when the
 * current one runs out. `chapter` is optional; without it the walk stays inside
 * the current chapter rather than guessing at a boundary.
 */
function advanceSegments(
  from: { ref: string; chapterRef: string; segmentIndex: number },
  steps: number,
  chapter: ChapterHint | null | undefined,
): { ref: string; chapterRef: string; segmentIndex: number } {
  let ref = from.ref
  let chapterRef = from.chapterRef
  let segmentIndex = from.segmentIndex
  let remaining = Math.max(0, steps)
  let guard = 0

  while (remaining > 0 && guard < 1000) {
    guard += 1
    const known = chapter && chapter.ref === chapterRef ? chapter.segmentCount : 0

    if (known > 0 && segmentIndex + 1 < known) {
      segmentIndex += 1
      ref = nextSegmentRef(ref)
      remaining -= 1
      continue
    }

    const nextChapter = chapter && chapter.ref === chapterRef ? chapter.nextChapterRef : null
    if (!nextChapter) break
    chapterRef = nextChapter
    segmentIndex = 0
    ref = `${nextChapter}.1`
    remaining -= 1
  }

  return { ref, chapterRef, segmentIndex }
}

/**
 * Step over one whole chapter from the bookmark's chapter.
 *
 * Only a single hop can be resolved without walking the whole chapter chain, so
 * a multi-chapter goal advances one chapter per call and re-advances as the
 * reader works through the intermediate ones. That keeps the bookmark honest
 * rather than guessing at refs that were never fetched.
 */
function advanceOneChapter(
  from: { ref: string; chapterRef: string; segmentIndex: number },
  chapter: ChapterHint | null | undefined,
): { ref: string; chapterRef: string; segmentIndex: number } {
  const chapterRef =
    chapter && chapter.ref === from.chapterRef && chapter.nextChapterRef
      ? chapter.nextChapterRef
      : from.chapterRef
  return { ref: `${chapterRef}.1`, chapterRef, segmentIndex: 0 }
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

interface QuotaSnapshot {
  ref: string
  chapterRef: string
  segmentIndex: number
  unitsDone: number
}

export function useProgress(): UseProgress {
  const [state, setState] = useState<PersistedState>(() => emptyState())
  const [ready, setReady] = useState(false)
  const today = dateKey()

  // Pre-quota state per book, so the completion button can be undone.
  const snapshots = useRef<Record<string, QuotaSnapshot | undefined>>({})

  // Hydrate after first paint so a large persisted state never blocks render.
  useEffect(() => {
    setState(loadState())
    setReady(true)
  }, [])

  // Debounced writes: completing a quota touches several keys in a row.
  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => saveState(state), 150)
    return () => clearTimeout(id)
  }, [state, ready])

  const update = useCallback((updater: (prev: PersistedState) => PersistedState) => {
    setState(updater)
  }, [])

  /* ------------------------------ reads --------------------------------- */

  const summaries = useMemo<BookSummary[]>(() => {
    return state.books.map((book) => {
      const progress = state.progress[book.id] ?? null
      const doneToday = unitsCompletedToday(state.history, book.id, today)
      const targetToday = book.pace.amount
      return {
        book,
        progress,
        doneToday,
        targetToday,
        percentToday: clamp(Math.round((doneToday / targetToday) * 100), 0, 100),
        quotaMet: doneToday >= targetToday,
        whereLabel: progress ? displayRef(progress.ref) : 'Not started yet',
        percentBook: bookPercent(progress, book.topLevelTotal),
        chapterNumber: chapterNumberOf(progress?.ref ?? ''),
        lastStudiedAt: progress?.lastStudiedAt ?? null,
        streak: computeStreak(state.history, book.id, today),
        accent: accentStyle(book.accent),
      }
    })
  }, [state.books, state.progress, state.history, today])

  const summariesByRef = useMemo(() => {
    const map = new Map<string, BookSummary>()
    for (const summary of summaries) map.set(summary.book.ref, summary)
    return map
  }, [summaries])

  const history = useMemo<HistoryDay[]>(
    () =>
      recentDateKeys(HISTORY_WINDOW, today).map((day) => {
        const byBook = state.history[day] ?? {}
        return { day, byBook, total: Object.values(byBook).reduce((a, b) => a + b, 0) }
      }),
    [state.history, today],
  )

  const activeDays = useMemo(() => history.filter((day) => day.total > 0).length, [history])

  /* ------------------------------ writes -------------------------------- */

  const addBook = useCallback(
    (input: AddBookInput): LibraryBook => {
      const bookRef = bookIdFor(input.ref)
      const existing = state.books.find((b) => b.ref === bookRef)
      if (existing) return existing

      const book: LibraryBook = {
        id: bookRef,
        ref: bookRef,
        title: input.title,
        heTitle: input.heTitle,
        primaryCategory: input.primaryCategory,
        pace: { unit: input.pace.unit, amount: clamp(Math.trunc(input.pace.amount) || 1, 1, 999) },
        addedAt: new Date().toISOString(),
        accent: input.accent,
        topLevelTotal: Math.max(1, Math.trunc(input.topLevelTotal) || 1),
      }

      const startRef = input.startRef ?? bookRef
      const progress: BookProgress = {
        ref: startRef,
        chapterRef: chapterOf(startRef),
        segmentIndex: 0,
        totalSegments: 0,
        lastStudiedAt: new Date().toISOString(),
        lastQuotaDate: null,
      }

      update((prev) => ({
        ...prev,
        books: [...prev.books, book],
        progress: { ...prev.progress, [book.id]: progress },
      }))
      return book
    },
    [state.books, update],
  )

  const removeBook = useCallback(
    (bookId: string) => {
      snapshots.current[bookId] = undefined
      update((prev) => {
        const progress = { ...prev.progress }
        delete progress[bookId]

        const nextHistory: PersistedState['history'] = {}
        for (const [day, byBook] of Object.entries(prev.history)) {
          const rest = { ...byBook }
          delete rest[bookId]
          if (Object.keys(rest).length) nextHistory[day] = rest
        }

        return { ...prev, books: prev.books.filter((b) => b.id !== bookId), progress, history: nextHistory }
      })
    },
    [update],
  )

  const updatePace = useCallback(
    (bookId: string, pace: Pace) => {
      update((prev) => ({
        ...prev,
        books: prev.books.map((b) =>
          b.id === bookId
            ? { ...b, pace: { unit: pace.unit, amount: clamp(Math.trunc(pace.amount) || 1, 1, 999) } }
            : b,
        ),
      }))
    },
    [update],
  )

  const setAccent = useCallback(
    (bookId: string, accent: LibraryBook['accent']) => {
      update((prev) => ({
        ...prev,
        books: prev.books.map((b) => (b.id === bookId ? { ...b, accent } : b)),
      }))
    },
    [update],
  )

  const renameBook = useCallback(
    (bookId: string, title: string, heTitle: string) => {
      update((prev) => ({
        ...prev,
        books: prev.books.map((b) =>
          b.id === bookId ? { ...b, title: title.trim() || b.title, heTitle: heTitle.trim() } : b,
        ),
      }))
    },
    [update],
  )

  const moveBook = useCallback(
    (fromIndex: number, toIndex: number) => {
      update((prev) => {
        const books = [...prev.books]
        if (fromIndex < 0 || fromIndex >= books.length) return prev
        const target = clamp(Math.trunc(toIndex), 0, books.length - 1)
        const [moved] = books.splice(fromIndex, 1)
        if (!moved) return prev
        books.splice(target, 0, moved)
        return { ...prev, books }
      })
    },
    [update],
  )

  const setBookmark = useCallback<UseProgress['setBookmark']>(
    (bookId, target) => {
      update((prev) => {
        const previous = prev.progress[bookId]
        if (!previous) return prev
        const next: BookProgress = {
          ref: target.ref,
          chapterRef: target.chapterRef,
          segmentIndex: Math.max(0, target.segmentIndex),
          totalSegments: Math.max(previous.totalSegments, target.chapterTotal),
          lastStudiedAt: new Date().toISOString(),
          lastQuotaDate: previous.lastQuotaDate,
        }
        return { ...prev, progress: { ...prev.progress, [bookId]: next } }
      })
    },
    [update],
  )

  const markUnitStudied = useCallback(
    (bookId: string) => {
      update((prev) => {
        const book = prev.books.find((b) => b.id === bookId)
        if (!book) return prev
        // A chapter-paced goal is only ever met by the "complete" button.
        if (book.pace.unit !== 'segment') return prev

        const done = prev.history[today]?.[bookId] ?? 0
        // Never credit past the goal: only the button may mark a day as met.
        if (done >= book.pace.amount) return prev

        return {
          ...prev,
          history: { ...prev.history, [today]: { ...(prev.history[today] ?? {}), [bookId]: done + 1 } },
        }
      })
    },
    [update, today],
  )

  const completeQuota = useCallback<UseProgress['completeQuota']>(
    (bookId, chapter) => {
      update((prev) => {
        const book = prev.books.find((b) => b.id === bookId)
        const current = prev.progress[bookId]
        if (!book || !current) return prev

        const done = prev.history[today]?.[bookId] ?? 0
        const target = book.pace.amount
        // Already met today: re-completing must not double-credit.
        if (done >= target) return prev

        snapshots.current[bookId] = {
          ref: current.ref,
          chapterRef: current.chapterRef,
          segmentIndex: current.segmentIndex,
          unitsDone: done,
        }

        const from = {
          ref: current.ref,
          chapterRef: current.chapterRef,
          segmentIndex: current.segmentIndex,
        }
        const next =
          book.pace.unit === 'chapter'
            ? advanceOneChapter(from, chapter)
            : advanceSegments(from, target - done, chapter)

        const progress: BookProgress = {
          ...current,
          ref: next.ref,
          chapterRef: next.chapterRef,
          segmentIndex: next.segmentIndex,
          totalSegments: current.totalSegments + (target - done),
          lastStudiedAt: new Date().toISOString(),
          lastQuotaDate: today,
        }

        return {
          ...prev,
          history: { ...prev.history, [today]: { ...(prev.history[today] ?? {}), [bookId]: target } },
          progress: { ...prev.progress, [bookId]: progress },
        }
      })
    },
    [update, today],
  )

  const undoQuota = useCallback<UseProgress['undoQuota']>(
    (bookId) => {
      const snapshot = snapshots.current[bookId]
      update((prev) => {
        const current = prev.progress[bookId]
        if (!current) return prev

        const byBook = { ...(prev.history[today] ?? {}) }
        if (snapshot) byBook[bookId] = snapshot.unitsDone
        else delete byBook[bookId]

        const history = { ...prev.history }
        if (Object.keys(byBook).length) history[today] = byBook
        else delete history[today]

        const progress: BookProgress = snapshot
          ? {
              ...current,
              ref: snapshot.ref,
              chapterRef: snapshot.chapterRef,
              segmentIndex: snapshot.segmentIndex,
              lastQuotaDate: null,
            }
          : { ...current, lastQuotaDate: null }

        return { ...prev, history, progress: { ...prev.progress, [bookId]: progress } }
      })
      snapshots.current[bookId] = undefined
    },
    [update, today],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((prev) => ({ ...prev, settings: { ...DEFAULT_SETTINGS, ...prev.settings, ...patch } }))
    },
    [update],
  )

  const resetAll = useCallback(() => {
    snapshots.current = {}
    setState(emptyState())
  }, [])

  const exportState = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importState = useCallback<UseProgress['importState']>((raw) => {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: 'That file does not contain reader data.' }
      }
      // Round-trip through the sanitiser so imports obey the same rules as
      // locally-created state, then re-read to get the cleaned version.
      saveState({ ...emptyState(), ...(parsed as Partial<PersistedState>) })
      setState(loadState())
      return { ok: true }
    } catch {
      return { ok: false, message: 'That file is not valid JSON.' }
    }
  }, [])

  const getSummary = useCallback(
    (bookRef: string) => summariesByRef.get(bookIdFor(bookRef)),
    [summariesByRef],
  )

  const getProgress = useCallback(
    (bookRef: string) => state.progress[bookIdFor(bookRef)] ?? null,
    [state.progress],
  )

  return {
    ready,
    books: state.books,
    summaries,
    settings: state.settings,
    today,
    history,
    activeDays,
    getSummary,
    getProgress,
    addBook,
    removeBook,
    updatePace,
    setAccent,
    renameBook,
    moveBook,
    setBookmark,
    markUnitStudied,
    completeQuota,
    undoQuota,
    updateSettings,
    resetAll,
    importState,
    exportState,
  }
}
