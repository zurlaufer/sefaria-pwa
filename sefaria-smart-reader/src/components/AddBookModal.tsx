import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookPlus, Check, Search, Sparkles } from 'lucide-react'
import { Badge, Button, Modal, Spinner } from './ui'
import { SefariaError, fetchCatalogue, resolveRef, type CatalogueEntry } from '@/services/sefariaApi'
import { ACCENTS, CATEGORY_ORDER, UNIQUE_STARTER_BOOKS, type StarterBook } from '@/data/starterBooks'
import { cn, plural } from '@/utils/format'
import { t } from '@/utils/i18n'
import type { AccentColor, Pace } from '@/types/sefaria'
import type { AddBookInput } from '@/hooks/useProgress'
import type { Lang } from '@/utils/i18n'

export interface AddBookModalProps {
  open: boolean
  onClose: () => void
  /** Refs already in the library, so they can be marked as added. */
  existingRefs: string[]
  onAdd: (input: AddBookInput) => void
  /** Update pace/colour of a book that is already tracked. */
  onUpdate: (bookRef: string, pace: Pace, accent: AccentColor) => void
  /** Jump straight into a book once the dialog closes. */
  onOpen: (bookRef: string) => void
  lang?: Lang
}

type Mode = 'browse' | 'custom'
type Candidate = StarterBook | CatalogueEntry

interface PendingBook {
  ref: string
  title: string
  heTitle: string
  primaryCategory?: string
  topLevelTotal: number
  unitName: string
}

const SEARCH_THRESHOLD = 2
const MAX_SECTION = 40

/**
 * Add-a-book flow: browse Sefaria's 6 600-book catalogue by category, search
 * it, or paste a raw reference. Pace and accent are chosen in the same dialog.
 */
export function AddBookModal({
  open,
  onClose,
  existingRefs,
  onAdd,
  onUpdate,
  onOpen,
  lang = 'en',
}: AddBookModalProps) {
  const [mode, setMode] = useState<Mode>('browse')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(CATEGORY_ORDER[0] ?? 'Tanakh')
  const [catalogue, setCatalogue] = useState<CatalogueEntry[] | null>(null)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [loadingCatalogue, setLoadingCatalogue] = useState(false)

  const [draft, setDraft] = useState<PendingBook | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const [pace, setPace] = useState<Pace>({ unit: 'segment', amount: 2 })
  const [accent, setAccent] = useState<AccentColor>('teal')
  const [customRef, setCustomRef] = useState('')

  const existing = useMemo(() => new Set(existingRefs), [existingRefs])
  const alreadyTracked = draft ? existing.has(draft.ref) : false

  /* ------------------------- reset when reopened ------------------------- */

  useEffect(() => {
    if (!open) return
    setMode('browse')
    setQuery('')
    setDraft(null)
    setResolveError(null)
    setCustomRef('')
    setPace({ unit: 'segment', amount: 2 })
    setAccent(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]?.value ?? 'teal')
  }, [open])

  /* ------------------------- catalogue (lazy, cached) ------------------------- */

  useEffect(() => {
    if (!open || catalogue !== null) return
    let cancelled = false
    setLoadingCatalogue(true)

    void fetchCatalogue()
      .then((books) => {
        if (cancelled) return
        setCatalogue(books)
        setLoadingCatalogue(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setCatalogueError(
          error instanceof SefariaError
            ? error.message
            : 'The Sefaria catalogue could not be loaded.',
        )
        setLoadingCatalogue(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, catalogue])

  /* ------------------------- browse sections ------------------------- */

  const sections = useMemo<Array<{ title: string; books: Candidate[]; hint?: string }>>(() => {
    if (mode === 'custom') return []
    const needle = query.trim().toLowerCase()

    if (needle.length >= SEARCH_THRESHOLD) {
      const source: Candidate[] = catalogue ?? [...UNIQUE_STARTER_BOOKS]
      const matches = source
        .filter((book) => searchKeyOf(book).includes(needle))
        .slice(0, 60)
      return [{ title: `${matches.length} ${t('results', lang)}`, books: matches }]
    }

    if (catalogue) {
      const starters = UNIQUE_STARTER_BOOKS.filter((book) => matchesCategory(book, category))
      const all = catalogue.filter((book) => (book.primary_category ?? '') === category)
      return [
        ...(starters.length
          ? [{ title: t('suggestedForDailyShiur', lang), books: starters as Candidate[] }]
          : []),
        { title: `${t('allOf', lang)} ${t(category, lang)}`, books: all.slice(0, MAX_SECTION), hint: `${all.length} ${t('books', lang)}` },
      ]
    }

    return [
      {
        title: t('suggested', lang),
        books: UNIQUE_STARTER_BOOKS.filter((book) => matchesCategory(book, category)),
      },
    ]
  }, [mode, query, catalogue, category, lang])

  const isSearching = query.trim().length >= SEARCH_THRESHOLD
  const showSpinner = loadingCatalogue && !isSearching

  /* ------------------------- selection ------------------------- */

  const pick = useCallback((book: Candidate) => {
    setResolveError(null)
    setDraft({
      ref: book.ref,
      title: book.title,
      heTitle: book.heTitle,
      primaryCategory: 'category' in book ? book.category : book.primary_category,
      topLevelTotal: 0,
      unitName: '',
    })
    setPace({ unit: 'segment', amount: 'defaultPace' in book ? book.defaultPace : 2 })
    if ('accent' in book) setAccent(book.accent)
  }, [])

  const resolveCustom = useCallback(async () => {
    const value = customRef.trim()
    if (!value) return
    setResolving(true)
    setResolveError(null)

    try {
      const resolved = await resolveRef(value)
      setDraft({
        ref: resolved.bookRef,
        title: resolved.title,
        heTitle: resolved.heTitle,
        primaryCategory: resolved.primaryCategory,
        topLevelTotal: resolved.topLevelTotal,
        unitName: resolved.unitName,
      })
      setPace({ unit: 'segment', amount: resolved.topLevelTotal <= 12 ? 1 : 2 })
    } catch (error) {
      setResolveError(
        error instanceof SefariaError ? error.message : 'That reference could not be checked on Sefaria.',
      )
    } finally {
      setResolving(false)
    }
  }, [customRef])

  const confirm = useCallback(() => {
    if (!draft) return
    if (alreadyTracked) {
      onUpdate(draft.ref, pace, accent)
    } else {
      onAdd({
        ref: draft.ref,
        title: draft.title,
        heTitle: draft.heTitle,
        primaryCategory: draft.primaryCategory,
        topLevelTotal: draft.topLevelTotal || 1,
        pace,
        accent,
      })
    }
    onClose()
    onOpen(draft.ref)
  }, [draft, alreadyTracked, onAdd, onUpdate, onClose, onOpen, pace, accent])

  /* ------------------------- configure step ------------------------- */

  if (draft) {
    const unitName = draft.unitName || 'Halakhah'
    const unit = pace.unit === 'chapter' ? 'chapter' : unitName.toLowerCase()

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={alreadyTracked ? 'Update daily goal' : 'Set your daily goal'}
        description={
          alreadyTracked
            ? `${draft.title} is already in your library.`
            : 'Pick a pace you can keep. You can change it any time.'
        }
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" onClick={confirm}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {alreadyTracked ? 'Save changes' : 'Add to library'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="surface rounded-xl border p-3">
            <p className="truncate text-sm font-semibold" dir="auto">
              {draft.title}
            </p>
            {draft.heTitle ? (
              <p className="truncate text-xs text-ink-500 dark:text-ink-400" dir="rtl">
                {draft.heTitle}
              </p>
            ) : null}
            {draft.primaryCategory ? (
              <Badge className="mt-1.5">{draft.primaryCategory}</Badge>
            ) : null}
          </div>

          <fieldset>
            <legend className="text-sm font-medium">
              {pace.amount} {plural(pace.amount, unit)} a day
            </legend>
            <p className="mt-0.5 mb-2 text-xs text-ink-500 dark:text-ink-400">
              For example: “{pace.amount} {plural(pace.amount, unit)}” each day.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3, 5, 10, 20] as const).map((amount) => (
                <button
                  key={`segment-${amount}`}
                  type="button"
                  onClick={() => setPace({ unit: 'segment', amount })}
                  className={chipClass(pace.unit === 'segment' && pace.amount === amount)}
                >
                  {amount} {plural(amount, unitName.toLowerCase())}
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((amount) => (
                <button
                  key={`chapter-${amount}`}
                  type="button"
                  onClick={() => setPace({ unit: 'chapter', amount })}
                  className={chipClass(pace.unit === 'chapter' && pace.amount === amount)}
                >
                  {amount} {plural(amount, 'chapter')}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Accent colour</legend>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAccent(option.value)}
                  aria-label={option.value}
                  aria-pressed={accent === option.value}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition-transform',
                    option.bg,
                    accent === option.value
                      ? 'scale-110 border-ink-800 dark:border-ink-100'
                      : 'border-transparent hover:scale-105',
                  )}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>
    )
  }

  /* ------------------------- browse step ------------------------- */

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a book"
      description="Search all of Sefaria, or paste a reference directly."
      scrollable
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
          {(['browse', 'custom'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                mode === value
                  ? 'bg-[var(--app-surface)] shadow-sm'
                  : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200',
              )}
            >
              {value === 'browse' ? 'Browse' : 'Paste a ref'}
            </button>
          ))}
        </div>

        {mode === 'browse' ? (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search every book — try “Rambam” or “Shevuot”"
                aria-label="Search the Sefaria catalogue"
                className="surface h-11 w-full rounded-xl border pr-3 pl-9 text-sm outline-none placeholder:text-ink-400 focus:border-brand-500"
              />
            </div>

            {!isSearching ? (
              <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {CATEGORY_ORDER.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategory(name)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      category === name
                        ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                        : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
                    )}
                  >
                    {t(name, lang)}
                  </button>
                ))}
              </div>
            ) : null}

            {catalogueError ? (
              <p className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {catalogueError} The curated list below still works, and you can paste a reference instead.
              </p>
            ) : null}

            {showSpinner ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">
                <Spinner />
                {t('loading', lang)}
              </div>
            ) : sections.every((section) => section.books.length === 0) ? (
              <p className="py-8 text-center text-sm text-ink-500 dark:text-ink-400">
                Nothing matched “{query}”. Try pasting the reference instead.
              </p>
            ) : (
              <div className="space-y-4">
                {sections.map((section) =>
                  section.books.length === 0 ? null : (
                    <section key={section.title}>
                      <h3 className="mb-1 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase dark:text-ink-400">
                        {section.title}
                        {section.hint ? (
                          <span className="font-normal normal-case opacity-70">{section.hint}</span>
                        ) : null}
                      </h3>
                      <ul className="divide-y divide-ink-200/70 dark:divide-ink-700/70">
                        {section.books.map((book) => {
                          const added = existing.has(book.ref)
                          return (
                            <li key={book.ref}>
                              <button
                                type="button"
                                onClick={() => pick(book)}
                                disabled={added}
                                className="flex w-full items-center gap-3 py-2.5 text-start disabled:opacity-55"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium" dir="auto">
                                    {lang === 'he' ? (book.heTitle || book.title) : book.title}
                                  </span>
                                  <span className="block truncate text-xs text-ink-500 dark:text-ink-400" dir="auto">
                                    {lang === 'he' ? (book.heTitle ? book.title : '') : book.heTitle}
                                    {'defaultPace' in book && !added ? ` · ${book.defaultPace}/day` : ''}
                                  </span>
                                </span>
                                {added ? (
                                  <Badge tone="success">
                                    <Check className="h-3 w-3" aria-hidden="true" />
                                    Added
                                  </Badge>
                                ) : (
                                  <BookPlus className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ),
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Sefaria reference</span>
              <input
                type="text"
                value={customRef}
                onChange={(event) => setCustomRef(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void resolveCustom()
                  }
                }}
                placeholder="Mishneh Torah, Human Dispositions 1:1"
                dir="auto"
                className="surface h-11 w-full rounded-xl border px-3 text-sm outline-none placeholder:text-ink-400 focus:border-brand-500"
              />
            </label>

            <Button
              variant="primary"
              fullWidth
              loading={resolving}
              onClick={() => void resolveCustom()}
              disabled={!customRef.trim()}
            >
              {resolving ? 'Checking Sefaria…' : 'Check this reference'}
            </Button>

            {resolveError ? (
              <p className="rounded-lg border border-rose-300/60 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {resolveError}
              </p>
            ) : null}

            <div className="rounded-xl border border-dashed p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-gold-500" aria-hidden="true" />
                What you can paste
              </p>
              <ul className="space-y-1 text-[11px] text-ink-500 dark:text-ink-400">
                {[
                  'A book: “Genesis”, “Berakhot”, “Pirkei Avot”',
                  'A chapter: “Genesis 1”, “Shevuot 32a”',
                  'A location: “Mishneh Torah, Human Dispositions 1:1”',
                  'An API path: “Shevuot.32a.5”',
                ].map((example) => (
                  <li key={example} className="flex gap-1.5">
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0">{example}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
                Names must use Sefaria&rsquo;s current spelling. If a name is ambiguous, search the{' '}
                <button
                  type="button"
                  onClick={() => setMode('browse')}
                  className="underline decoration-dotted underline-offset-2"
                >
                  Browse
                </button>{' '}
                tab instead.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function chipClass(active: boolean): string {
  return cn(
    'rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
      : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
  )
}

function searchKeyOf(book: Candidate): string {
  if ('searchKey' in book) return book.searchKey
  return `${book.title} ${book.heTitle} ${book.category}`.toLowerCase()
}

function matchesCategory(book: StarterBook, category: string): boolean {
  if (book.category === category) return true
  // "Rambam" volumes also belong under Halakhah.
  return category === 'Halakhah' && book.category === 'Rambam'
}
