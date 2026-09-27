import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  MessageSquareQuote,
  Minus,
  Plus,
  RefreshCw,
  Share2,
  Type,
  WifiOff,
} from 'lucide-react'
import { CommentaryDrawer } from './CommentaryDrawer'
import { Button, Card, SkeletonParagraph } from './ui'
import type { ApiError, AsyncState, LoadedText, Settings } from '@/types/sefaria'
import { renderHebrew } from '@/utils/hebrew'
import { chapterDisplay, sefariaUrl } from '@/utils/ref'
import { clamp, cn, plural } from '@/utils/format'

export interface ReaderProps {
  /** Async state of the chapter load. */
  state: AsyncState<LoadedText>
  /** The bookmarked segment ref for the current book. */
  activeRef: string | null
  /** Zero-based index of the active segment inside the loaded chapter. */
  activeIndex: number
  onSegmentChange: (index: number) => void
  onLoadChapter: (chapterRef: string) => void
  onBack: () => void
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  offline: boolean
  fromCache: boolean
  onRetry: () => void
  /** Whether the book is in the user's library (controls bookmark save). */
  inLibrary: boolean
  onAddToLibrary: () => void
}

/**
 * Distraction-free reading surface: RTL Hebrew typography, a font-size and
 * theme switcher, tap-to-commentary on every segment, and a link out to the
 * full Sefaria page.
 */
export function Reader({
  state,
  activeRef,
  activeIndex,
  onSegmentChange,
  onLoadChapter,
  onBack,
  settings,
  onSettingsChange,
  offline,
  fromCache,
  onRetry,
  inLibrary,
  onAddToLibrary,
}: ReaderProps) {
  const text = state.data
  const [commentaryRef, setCommentaryRef] = useState<string | null>(null)
  const [fontOpen, setFontOpen] = useState(false)
  const activeSegmentRef = useRef<HTMLLIElement>(null)

  const fontSize = clamp(settings.fontSize, 1, 5)
  const hebrewClass = settings.hebrewFont === 'naskh' ? 'hebrew-text--alt' : ''

  /* ------------------------- keep the bookmark visible ------------------------- */

  useEffect(() => {
    if (state.status !== 'success') return
    const timer = setTimeout(() => {
      activeSegmentRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 120)
    return () => clearTimeout(timer)
  }, [activeIndex, activeRef, state.status, text?.ref])

  /* ------------------------- gestures: swipe to turn ------------------------- */

  const touch = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((event: TouchEvent) => {
    const t = event.touches[0]
    if (t) touch.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      const start = touch.current
      const t = event.changedTouches[0]
      touch.current = null
      if (!start || !t || !text) return

      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      // Horizontal, and clearly not a vertical scroll.
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return

      // In an RTL reading flow, swiping left advances.
      if (dx < 0) onSegmentChange(Math.min(text.segments.length - 1, activeIndex + 1))
      else onSegmentChange(Math.max(0, activeIndex - 1))
    },
    [text, activeIndex, onSegmentChange],
  )

  /* ------------------------- actions ------------------------- */

  const openCommentary = useCallback(
    (segmentRef: string) => setCommentaryRef(segmentRef),
    [],
  )

  const adjustFont = useCallback(
    (delta: number) => {
      onSettingsChange({ fontSize: clamp(fontSize + delta, 1, 5) })
    },
    [fontSize, onSettingsChange],
  )

  const share = useCallback(async () => {
    if (!activeRef) return
    const url = sefariaUrl(activeRef)
    const payload = { title: chapterDisplay(activeRef), text: `${chapterDisplay(activeRef)} — ${url}`, url }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
      await navigator.clipboard.writeText(url)
    } catch {
      /* The user dismissed the share sheet. */
    }
  }, [activeRef])

  const segments = useMemo(() => text?.segments ?? [], [text])

  const nextChapter = text?.nextChapter ?? null
  const prevChapter = text?.prevChapter ?? null

  /* ------------------------- render ------------------------- */

  return (
    <div className="mx-auto max-w-3xl px-3 pb-28 sm:px-4">
      {/* ---------------- Top bar ---------------- */}
      <div className="app-shell sticky top-14 z-20 -mx-3 mb-3 border-b bg-[var(--app-bg)]/90 px-3 backdrop-blur-md sm:-mx-4 sm:px-4">
        <div className="flex items-center gap-1.5 py-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="px-2" aria-label="Back to library">
            <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" dir="auto">
              {text?.bookTitle ?? 'Loading…'}
            </p>
            <p className="truncate text-[11px] text-ink-500 dark:text-ink-400" dir="auto">
              {text ? chapterDisplay(text.ref) : ''}
              {text ? ` · ${text.versionTitle}` : ''}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => setFontOpen((v) => !v)}
            aria-label="Reading options"
            aria-expanded={fontOpen}
          >
            <Type className="h-4.5 w-4.5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => void share()}
            aria-label="Share this passage"
            disabled={!activeRef}
          >
            <Share2 className="h-4.5 w-4.5" aria-hidden="true" />
          </Button>
        </div>

        {fontOpen ? (
          <div className="animate-fade-in space-y-2 border-t py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Text size</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => adjustFont(-1)}
                  disabled={fontSize <= 1}
                  aria-label="Smaller text"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold tabular-nums">{fontSize}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => adjustFont(1)}
                  disabled={fontSize >= 5}
                  aria-label="Larger text"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Hebrew font</span>
              <div className="flex gap-1">
                {(['rhl', 'naskh'] as const).map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => onSettingsChange({ hebrewFont: font })}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      settings.hebrewFont === font
                        ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                        : 'border-ink-200 hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800',
                    )}
                  >
                    {font === 'rhl' ? 'Frank Ruhl' : 'Noto Serif'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle
                label="Vowel points"
                checked={settings.showVowels}
                onChange={(showVowels) => onSettingsChange({ showVowels })}
              />
              <Toggle
                label="Punctuation"
                checked={settings.showPunctuation}
                onChange={(showPunctuation) => onSettingsChange({ showPunctuation })}
              />
            </div>
          </div>
        ) : null}
      </div>

      {offline || fromCache ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-gold-300/20 px-2.5 py-1.5 text-[11px] text-gold-600 dark:bg-gold-400/10 dark:text-gold-300">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {fromCache
            ? 'Showing a saved copy of this chapter — you are offline.'
            : 'You are offline. Previously read chapters are still available.'}
        </p>
      ) : null}

      {/* ---------------- Body ---------------- */}
      {state.status === 'loading' && !text ? (
        <LoadingSkeleton />
      ) : state.status === 'error' && !text ? (
        <ErrorState error={state.error} onRetry={onRetry} onBack={onBack} />
      ) : text ? (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="no-overscroll-x"
        >
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b bg-ink-100/50 px-4 py-2 dark:bg-ink-900/40">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold" dir="auto">
                  {text.bookTitle}
                </p>
                <p className="truncate text-[11px] text-ink-500 dark:text-ink-400" dir="auto">
                  {chapterDisplay(text.ref)} · {plural(text.segments.length, text.unitName)} 1–
                  {text.segments.length}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-400 dark:text-ink-500" dir="rtl">
                {text.heBook || text.heRef}
              </span>
            </div>

            <ol className="divide-y divide-ink-200/60 dark:divide-ink-700/60">
              {segments.map((segment, index) => {
                const isActive = index === activeIndex
                return (
                  <li
                    key={segment.ref}
                    ref={isActive ? activeSegmentRef : undefined}
                    className={cn(
                      'group relative scroll-mt-32 transition-colors',
                      isActive && 'bg-brand-50/70 dark:bg-brand-950/25',
                    )}
                  >
                    {/* Active marker in the RTL gutter. */}
                    <span
                      className={cn(
                        'absolute inset-y-0 end-0 w-1 transition-colors',
                        isActive ? 'bg-brand-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />

                    <div className="flex items-start gap-2 px-4 py-4 ps-5 sm:px-6 sm:ps-7">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSegmentChange(index)
                        }}
                        className="mt-0.5 shrink-0 font-hebrew text-[11px] text-ink-400 tabular-nums transition-colors hover:text-brand-600 dark:hover:text-brand-300"
                        aria-label={`Go to ${text.unitName.toLowerCase()} ${index + 1}`}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        {index + 1}
                      </button>

                      <p
                        className={cn(
                          'hebrew-text min-w-0 flex-1 text-ink-800 dark:text-ink-100',
                          hebrewClass,
                        )}
                        style={{ fontSize: 'var(--reader-size)' }}
                        dir="rtl"
                        lang="he"
                        dangerouslySetInnerHTML={{
                          __html: renderHebrew(segment.he, {
                            vowels: settings.showVowels,
                            punctuation: settings.showPunctuation,
                          }),
                        }}
                      />
                    </div>

                    {/* Per-segment actions */}
                    <div
                      className={cn(
                        'flex items-center gap-1 px-4 pb-2.5 ps-5 transition-opacity sm:px-6 sm:ps-7',
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                        'max-sm:opacity-100',
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openCommentary(segment.ref)}
                      >
                        <MessageSquareQuote className="h-3 w-3" aria-hidden="true" />
                        Commentaries
                      </Button>
                      <a
                        href={sefariaUrl(segment.ref)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-ink-500 hover:bg-ink-200/60 dark:text-ink-400 dark:hover:bg-ink-700/60"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        Sefaria
                      </a>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          {/* ---------------- Chapter paging ---------------- */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              onClick={() => prevChapter && onLoadChapter(prevChapter)}
              disabled={!prevChapter}
            >
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => nextChapter && onLoadChapter(nextChapter)}
              disabled={!nextChapter}
            >
              Next chapter
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {!inLibrary ? (
            <div className="mt-4 rounded-2xl border border-dashed p-4 text-center">
              <p className="text-sm font-medium">Not tracking this book yet</p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                Add it to your library to set a daily goal and keep your place.
              </p>
              <Button variant="primary" size="sm" className="mt-3" onClick={onAddToLibrary}>
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Add to library
              </Button>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[11px] text-ink-400 dark:text-ink-500">
            Source: Sefaria{text.versionTitle ? ` · ${text.versionTitle}` : ''}
            {text.license ? ` · ${text.license}` : ''}
          </p>
        </div>
      ) : null}

      {/* ---------------- Commentary drawer ---------------- */}
      <CommentaryDrawer
        ref={commentaryRef}
        onClose={() => setCommentaryRef(null)}
        offline={offline}
        showVowels={settings.showVowels}
        hebrewFont={settings.hebrewFont}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-brand-600"
      />
      {label}
    </label>
  )
}

function LoadingSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-6 p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2.5">
            <div className="skeleton h-3 w-8" />
            <SkeletonParagraph lines={2} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function ErrorState({
  error,
  onRetry,
  onBack,
}: {
  error: ApiError | null
  onRetry: () => void
  onBack: () => void
}) {
  const offline = error?.offline ?? false
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
        {offline ? <WifiOff className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
      </div>
      <h2 className="text-base font-semibold">
        {offline ? 'No connection' : 'This chapter could not be loaded'}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
        {error?.message ?? 'An unexpected error occurred.'}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back to library
        </Button>
      </div>
    </Card>
  )
}
