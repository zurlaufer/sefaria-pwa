import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { AddBookModal } from './components/AddBookModal'
import { BookManager } from './components/BookManager'
import { Navbar } from './components/Navbar'
import { ProgressHeader } from './components/ProgressHeader'
import { Reader } from './components/Reader'
import { SettingsPanel } from './components/SettingsPanel'
import { Button } from './components/ui'

import { useProgress } from './hooks/useProgress'
import { useRouter } from './hooks/useRouter'
import { useSefariaText } from './hooks/useSefariaText'
import { useReadingTypography, useTheme } from './hooks/useTheme'

import { resolveRef } from './services/sefariaApi'
import { canonicalRef, chapterOf, isBookRef, parseRef, stripRange } from './utils/ref'
import { t } from './utils/i18n'
import type { AddBookInput } from './hooks/useProgress'
import type { AccentColor, Pace } from './types/sefaria'

export default function App() {
  const progress = useProgress()
  const router = useRouter()
  const { route, navigate, replace, goLibrary, goSettings } = router

  // One dialog is shared by the header, the library and the floating button.
  const [addOpen, setAddOpen] = useState(false)

  useTheme(progress.settings)
  useReadingTypography(progress.settings)

  /* ----------------------------- routing ----------------------------- */

  const bookRef = route.bookRef ? canonicalRef(route.bookRef) : null
  const atRef = route.atRef ? stripRange(canonicalRef(route.atRef)) : null

  /** The exact location the reader should open at, given the URL or the bookmark. */
  const targetRef = useMemo(() => {
    if (!bookRef) return null
    const progressRecord = progress.getProgress(bookRef)
    // The URL wins, so a shared link always opens where the sender intended.
    if (atRef && !isBookRef(atRef)) return atRef
    if (progressRecord) return progressRecord.ref
    return bookRef
  }, [bookRef, atRef, progress])

  // Load a book into the library when routed into one that is not tracked yet.
  useEffect(() => {
    if (!bookRef || !progress.ready) return
    if (progress.getSummary(bookRef)) return
    void resolveRef(bookRef)
      .then((resolved) => {
        progress.addBook({
          ref: resolved.bookRef,
          title: resolved.title,
          heTitle: resolved.heTitle,
          primaryCategory: resolved.primaryCategory,
          topLevelTotal: resolved.topLevelTotal,
          pace: { unit: 'segment', amount: resolved.topLevelTotal <= 12 ? 1 : 2 },
          accent: 'teal',
        })
      })
      .catch(() => {
        /* Unresolvable refs simply are not tracked; the reader still shows them. */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookRef, progress.ready])

  /* ----------------------------- text loading ----------------------------- */

  const chapterRef = useMemo(() => {
    if (!targetRef) return null
    return isBookRef(targetRef) ? targetRef : chapterOf(targetRef)
  }, [targetRef])

  const sefaria = useSefariaText(chapterRef)

  /* ----------------------------- bookmark ----------------------------- */

  const activeIndex = useMemo(() => {
    if (!sefaria.text || !targetRef) return 0
    const match = sefaria.text.segments.findIndex((segment) => segment.ref === targetRef)
    return match >= 0 ? match : 0
  }, [sefaria.text, targetRef])

  const summary = bookRef ? progress.getSummary(bookRef) : undefined

  /** Persist the bookmark, but only after the reader has settled on a chapter. */
  const persistBookmark = useCallback(
    (index: number) => {
      if (!bookRef || !summary || !sefaria.text) return
      const segment = sefaria.text.segments[index]
      if (!segment) return

      progress.setBookmark(bookRef, {
        ref: segment.ref,
        chapterRef: chapterOf(segment.ref),
        segmentIndex: index,
        chapterTotal: sefaria.text.segments.length,
      })

      // Keep the URL in step with the position, without a history entry per tap.
      if (route.atRef !== segment.ref) {
        replace({ view: 'reader', bookRef, atRef: segment.ref })
      }
    },
    [bookRef, summary, sefaria.text, progress, route.atRef, replace],
  )

  const goToSegment = useCallback(
    (index: number) => {
      if (!sefaria.text) return
      const clamped = Math.max(0, Math.min(index, sefaria.text.segments.length - 1))
      persistBookmark(clamped)
    },
    [sefaria.text, persistBookmark],
  )

  const loadChapter = useCallback(
    (nextChapter: string) => {
      persistBookmark(0)
      // `persistBookmark` writes the current position; the chapter switch follows.
      requestAnimationFrame(() => {
        navigate({ view: 'reader', bookRef: nextChapter.split('.')[0] ?? bookRef, atRef: `${nextChapter}.1` })
      })
    },
    [persistBookmark, navigate, bookRef],
  )

  const completeQuota = useCallback(() => {
    if (!bookRef || !sefaria.text) return
    progress.completeQuota(bookRef, {
      ref: chapterOf(sefaria.text.ref),
      segmentCount: sefaria.text.segments.length,
      nextChapterRef: sefaria.text.nextChapter,
    })
  }, [bookRef, sefaria.text, progress])

  /* ----------------------------- actions ----------------------------- */

  const openBook = useCallback(
    (ref: string) => {
      const canonical = canonicalRef(ref)
      navigate({ view: 'reader', bookRef: canonical, atRef: null })
    },
    [navigate],
  )

  const addBook = useCallback(
    (input: AddBookInput) => {
      progress.addBook(input)
    },
    [progress],
  )

  const updateBook = useCallback(
    (ref: string, pace: Pace, accent: AccentColor) => {
      const id = canonicalRef(ref)
      progress.updatePace(id, pace)
      progress.setAccent(id, accent)
    },
    [progress],
  )

  const toggleTheme = useCallback(() => {
    const current = progress.settings.theme
    // light -> dark -> system -> light
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'
    progress.updateSettings({ theme: next })
  }, [progress])

  /* ----------------------------- render ----------------------------- */

  const themeForNav = progress.settings.theme

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Navbar
        view={route.view}
        onNavigate={(view) => (view === 'settings' ? goSettings() : goLibrary())}
        theme={themeForNav}
        onToggleTheme={toggleTheme}
        offline={sefaria.offline}
        bookCount={progress.books.length}
        lang={progress.settings.interfaceLanguage}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4">
        {route.view === 'settings' ? (
          <SettingsPanel
            settings={progress.settings}
            onChange={progress.updateSettings}
            onReset={progress.resetAll}
            onExport={progress.exportState}
            onImport={progress.importState}
            bookCount={progress.books.length}
            activeDays={progress.activeDays}
          />
        ) : route.view === 'library' ? (
          <div className="space-y-4">
            <BookManager
              summaries={progress.summaries}
              history={progress.history}
              today={progress.today}
              onOpen={openBook}
              onAddBook={() => setAddOpen(true)}
              onUpdatePace={progress.updatePace}
              onRemove={progress.removeBook}
              lang={progress.settings.interfaceLanguage}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {summary && sefaria.text ? (
              <ProgressHeader
                summary={summary}
                unitName={sefaria.text.unitName}
                chapterName={sefaria.text.chapterUnitName}
                history={progress.history}
                today={progress.today}
                segmentIndex={activeIndex}
                segmentCount={sefaria.text.segments.length}
                atFirstSegment={activeIndex === 0}
                atLastSegment={activeIndex >= sefaria.text.segments.length - 1}
                onPrev={() => goToSegment(activeIndex - 1)}
                onNext={() => goToSegment(activeIndex + 1)}
                onCompleteQuota={completeQuota}
                onUndoQuota={() => summary.book.id && progress.undoQuota(summary.book.id)}
                onMarkUnit={() => summary.book.id && progress.markUnitStudied(summary.book.id)}
                onPaceChange={(pace) => summary.book.id && progress.updatePace(summary.book.id, pace)}
              />
            ) : null}

            <Reader
              state={sefaria.state}
              activeRef={targetRef}
              activeIndex={activeIndex}
              onSegmentChange={goToSegment}
              onLoadChapter={loadChapter}
              onBack={goLibrary}
              settings={progress.settings}
              onSettingsChange={progress.updateSettings}
              offline={sefaria.offline}
              fromCache={sefaria.fromCache}
              onRetry={sefaria.reload}
              inLibrary={Boolean(summary)}
              onAddToLibrary={() => {
                if (!bookRef) return
                const { book } = parseRef(bookRef)
                void resolveRef(book)
                  .then((resolved) => {
                    addBook({
                      ref: resolved.bookRef,
                      title: resolved.title,
                      heTitle: resolved.heTitle,
                      primaryCategory: resolved.primaryCategory,
                      topLevelTotal: resolved.topLevelTotal,
                      pace: { unit: 'segment', amount: resolved.topLevelTotal <= 12 ? 1 : 2 },
                      accent: 'teal',
                    })
                  })
                  .catch(() => undefined)
              }}
            />
          </div>
        )}
      </main>

      {/* Floating add button, only on the library screen. */}
      {route.view === 'library' && progress.books.length > 0 ? (
        <div className="app-footer pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
          <Button
            variant="primary"
            size="lg"
            className="pointer-events-auto rounded-full shadow-lg"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4.5 w-4.5" aria-hidden="true" />
            {t('addBook', progress.settings.interfaceLanguage)}
          </Button>
        </div>
      ) : null}

      <AddBookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingRefs={progress.books.map((b) => b.ref)}
        onAdd={addBook}
        onUpdate={updateBook}
        onOpen={openBook}
        lang={progress.settings.interfaceLanguage}
      />

      {/* Global footer note */}
      {progress.books.length > 0 && route.view === 'library' ? (
        <footer className="app-footer mx-auto w-full max-w-3xl px-4 pt-6 pb-4 text-center">
          <p className="text-[11px] text-ink-400 dark:text-ink-600">
            Text and commentaries from{' '}
            <a
              href="https://www.sefaria.org"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted underline-offset-2"
            >
              Sefaria.org
            </a>
            . Your library and progress stay on this device.
          </p>
        </footer>
      ) : null}
    </div>
  )
}
