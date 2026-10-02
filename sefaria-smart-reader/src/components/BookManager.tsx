import { useMemo, useState, type ReactNode } from 'react'
import {
  BookPlus,
  Check,
  ChevronRight,
  Flame,
  Gauge,
  Home,
  Link2,
  MoreHorizontal,
  Share2,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { Badge, Button, Card, CopyButton, EmptyState, Modal, ProgressBar, ProgressRing } from './ui'
import { bookDeepLink, deepLink } from '@/utils/ref'
import { cn, parseDateKey, plural, relativeDay } from '@/utils/format'
import { t } from '@/utils/i18n'
import type { Pace } from '@/types/sefaria'
import type { BookSummary, UseProgress } from '@/hooks/useProgress'
import type { Lang } from '@/utils/i18n'

export interface BookManagerProps {
  summaries: BookSummary[]
  history: UseProgress['history']
  today: string
  onOpen: (bookRef: string) => void
  onAddBook: () => void
  onUpdatePace: (bookId: string, pace: Pace) => void
  onRemove: (bookId: string) => void
  lang?: Lang
}

/**
 * The library dashboard: today's progress across every tracked book, quick
 * actions per book, and the iOS home-screen shortcut helper.
 */
export function BookManager({
  summaries,
  history,
  today,
  onOpen,
  onAddBook,
  onUpdatePace,
  onRemove,
  lang = 'en',
}: BookManagerProps) {
  const [editing, setEditing] = useState<BookSummary | null>(null)
  const [shortcutFor, setShortcutFor] = useState<BookSummary | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<BookSummary | null>(null)

  const totals = useMemo(() => {
    const met = summaries.filter((summary) => summary.quotaMet).length
    const units = summaries.reduce((sum, summary) => sum + Math.min(summary.doneToday, summary.targetToday), 0)
    const streak = summaries.reduce((best, summary) => Math.max(best, summary.streak), 0)
    return { met, units, streak, allMet: summaries.length > 0 && met === summaries.length }
  }, [summaries])

  const recent = useMemo(() => history.slice(-14), [history])
  const maxDay = Math.max(1, ...recent.map((day) => day.total))

  return (
    <div className="space-y-4">
      {/* ------------------------- Daily summary ------------------------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <ProgressRing
            value={summaries.length ? (totals.met / summaries.length) * 100 : 0}
            size={56}
            stroke={5}
            ringClass={totals.allMet ? 'text-emerald-500' : 'text-brand-500'}
          >
            <span className="text-sm font-semibold tabular-nums">
              {totals.met}/{summaries.length}
            </span>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">
              {summaries.length === 0
                ? t('library', lang)
                : totals.allMet
                  ? (lang === 'he' ? 'כל היעדים הושלמו!' : 'All goals met')
                  : totals.met > 0
                    ? (lang === 'he' ? 'המשך כך' : 'Keep going')
                    : (lang === 'he' ? 'היום' : 'Today')}
            </h1>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              {summaries.length === 0
                ? t('noBooksYet', lang)
                : `${totals.units} ${plural(totals.units, t('unit', lang))} ${t('across', lang)} ${plural(summaries.length, t('book', lang))} ${t('today', lang)}.`}
            </p>
            {totals.streak > 0 ? (
              <Badge tone="gold" className="mt-1.5">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {totals.streak} {t('streak', lang)}
              </Badge>
            ) : null}
          </div>

          <Button variant="primary" size="sm" onClick={onAddBook} className="shrink-0">
            <BookPlus className="h-4 w-4" aria-hidden="true" />
            {t('addBook', lang)}
          </Button>
        </div>

        {recent.length > 1 ? (
          <div className="flex items-end gap-0.5 border-t px-4 pt-3 pb-2">
            {recent.map((day) => (
              <div key={day.day} className="group flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-[height] duration-500',
                    day.total > 0 ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700',
                  )}
                  style={{ height: `${Math.max(6, (day.total / maxDay) * 100)}%` }}
                  title={`${day.day}: ${day.total}`}
                />
                <span
                  className={cn(
                    'text-[9px] tabular-nums',
                    day.day === today ? 'font-bold' : 'text-ink-400 dark:text-ink-600',
                  )}
                >
                  {parseDateKey(day.day).getDate()}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* ------------------------- Book list ------------------------- */}
      {summaries.length === 0 ? (
        <EmptyState
          icon={<BookPlus className="h-10 w-10" aria-hidden="true" />}
          title={t('noBooksYet', lang)}
          description={lang === 'he' ? 'הוסף ספר מספריא, הגדר מכסה יומית, ועמוד זה יהפוך ללוח השיעורים היומי שלך.' : 'Add a book from Sefaria, set a daily quota, and this page becomes your daily shiur dashboard.'}
          action={
            <Button variant="primary" onClick={onAddBook}>
              <BookPlus className="h-4 w-4" aria-hidden="true" />
              {t('addYourFirstBook', lang)}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {summaries.map((summary) => (
            <li key={summary.book.id}>
              <BookCard
                summary={summary}
                onOpen={() => onOpen(summary.book.ref)}
                onEditPace={() => setEditing(summary)}
                onShortcut={() => setShortcutFor(summary)}
                onRemove={() => setConfirmRemove(summary)}
                lang={lang}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------- Dialogs ------------------------- */}
      <PaceModal
        summary={editing}
        onClose={() => setEditing(null)}
        onSave={(pace) => {
          if (editing) onUpdatePace(editing.book.id, pace)
          setEditing(null)
        }}
      />

      <ShortcutModal summary={shortcutFor} onClose={() => setShortcutFor(null)} />

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove “${confirmRemove?.book.title ?? ''}”?`}
        description="Your bookmark, daily history and streak for this book will be deleted. The text itself stays on Sefaria."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmRemove(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (confirmRemove) onRemove(confirmRemove.book.id)
                setConfirmRemove(null)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {confirmRemove?.progress ? (
            <>
              You are at <span className="font-medium">{confirmRemove.whereLabel}</span>
              {confirmRemove.percentBook > 0 ? ` — about ${confirmRemove.percentBook}% through the book.` : '.'}
            </>
          ) : (
            'This book has no saved progress yet.'
          )}
        </p>
      </Modal>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Book card                                                                  */
/* -------------------------------------------------------------------------- */

function BookCard({
  summary,
  onOpen,
  onEditPace,
  onShortcut,
  onRemove,
  lang = 'en',
}: {
  summary: BookSummary
  onOpen: () => void
  onEditPace: () => void
  onShortcut: () => void
  onRemove: () => void
  lang?: Lang
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { book, doneToday, targetToday, quotaMet, whereLabel, percentBook, streak, lastStudiedAt } =
    summary
  const unit = book.pace.unit === 'chapter' ? 'chapter' : 'unit'

  const mainTitle = lang === 'he' ? (book.heTitle || book.title) : book.title
  const subTitle = lang === 'he' ? (book.heTitle ? book.title : '') : book.heTitle

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start gap-3 p-3.5">
        <ProgressRing
          value={summary.percentToday}
          size={48}
          stroke={4.5}
          ringClass={quotaMet ? 'text-emerald-500' : summary.accent.ring}
        >
          {quotaMet ? (
            <Check className="h-4.5 w-4.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <span className="text-[11px] font-semibold tabular-nums">{summary.percentToday}%</span>
          )}
        </ProgressRing>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-start"
          aria-label={`Continue ${mainTitle}`}
        >
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold" dir="auto">
              {mainTitle}
            </h3>
            {streak > 0 ? (
              <Flame className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden="true" />
            ) : null}
          </div>

          {subTitle ? (
            <p className="truncate text-xs text-ink-500 dark:text-ink-400" dir="auto">
              {subTitle}
            </p>
          ) : null}

          <p className="mt-1 truncate text-[11px] text-ink-500 dark:text-ink-400" dir="auto">
            {whereLabel}
            {lastStudiedAt ? ` · ${relativeDay(lastStudiedAt.slice(0, 10))}` : ''}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <ProgressBar
              value={summary.percentToday}
              barClass={quotaMet ? 'bg-emerald-500' : summary.accent.bar}
              label={`${book.title} today`}
            />
            <span className="shrink-0 text-[10px] font-medium text-ink-500 tabular-nums dark:text-ink-400">
              {Math.min(doneToday, targetToday)}/{targetToday}
            </span>
          </div>

          <p className="mt-1.5 text-[10px] text-ink-400 dark:text-ink-500">
            {targetToday} {plural(targetToday, unit)}/day
            {percentBook > 0 ? ` · ${percentBook}% through the book` : ''}
            {lastStudiedAt ? '' : ' · not started'}
          </p>
        </button>

        {/* Row actions */}
        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="px-1.5"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Actions for ${book.title}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-4.5 w-4.5" aria-hidden="true" />
          </Button>

          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="surface absolute end-0 z-20 mt-1 w-52 animate-fade-in overflow-hidden rounded-xl border py-1 shadow-lg"
              >
                <MenuItem
                  icon={<Gauge className="h-4 w-4" />}
                  onClick={() => {
                    setMenuOpen(false)
                    onEditPace()
                  }}
                >
                  Change daily goal
                </MenuItem>
                <MenuItem
                  icon={<Smartphone className="h-4 w-4" />}
                  onClick={() => {
                    setMenuOpen(false)
                    onShortcut()
                  }}
                >
                  Create iOS shortcut
                </MenuItem>
                <MenuItem
                  icon={<Link2 className="h-4 w-4" />}
                  onClick={() => {
                    setMenuOpen(false)
                    void navigator.clipboard
                      ?.writeText(bookDeepLink(book.ref))
                      .catch(() => undefined)
                  }}
                >
                  Copy deep link
                </MenuItem>
                <div className="my-1 border-t border-ink-200/70 dark:border-ink-700/70" />
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  danger
                  onClick={() => {
                    setMenuOpen(false)
                    onRemove()
                  }}
                >
                  Remove from library
                </MenuItem>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 border-t px-3 py-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={onOpen}>
          <ChevronRight className="h-4 w-4 -rotate-180" aria-hidden="true" />
          Continue
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onShortcut}
          title="Add this book to your iOS home screen"
          aria-label={`Add ${book.title} to the home screen`}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  danger = false,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors',
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
          : 'hover:bg-ink-100 dark:hover:bg-ink-700/60',
      )}
    >
      <span className="text-ink-400 dark:text-ink-500">{icon}</span>
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Pace editor                                                                */
/* -------------------------------------------------------------------------- */

function PaceModal(props: {
  summary: BookSummary | null
  onClose: () => void
  onSave: (pace: Pace) => void
}) {
  const { summary } = props
  if (!summary) return null
  // Keyed so switching books remounts the editor with that book's pace.
  // The spread is overridden by the narrowed `summary`.
  return <PaceEditor key={summary.book.id} {...props} summary={summary} />
}

function PaceEditor({
  summary,
  onClose,
  onSave,
}: {
  summary: BookSummary
  onClose: () => void
  onSave: (pace: Pace) => void
}) {
  const [pace, setPace] = useState<Pace>(summary.book.pace)

  return (
    <Modal
      open
      onClose={onClose}
      title="Daily goal"
      description={summary.book.title}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => onSave(pace)}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3, 5, 10, 20] as const).map((amount) => (
            <button
              key={`seg-${amount}`}
              type="button"
              onClick={() => setPace({ unit: 'segment', amount })}
              className={chip(pace.unit === 'segment' && pace.amount === amount)}
            >
              {amount} a day
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-ink-500 dark:text-ink-400">
          For segment goals the unit is the book&rsquo;s own — a halacha, a verse or a line of a daf.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((amount) => (
            <button
              key={`chap-${amount}`}
              type="button"
              onClick={() => setPace({ unit: 'chapter', amount })}
              className={chip(pace.unit === 'chapter' && pace.amount === amount)}
            >
              {amount} {plural(amount, 'chapter')}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function chip(active: boolean): string {
  return cn(
    'rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
      : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
  )
}

/* -------------------------------------------------------------------------- */
/*  iOS shortcut helper                                                        */
/* -------------------------------------------------------------------------- */

function ShortcutModal({
  summary,
  onClose,
}: {
  summary: BookSummary | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const link = useMemo(() => (summary ? deepLink(summary.progress?.ref ?? summary.book.ref) : ''), [summary])
  const isIos = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      (/iP(hone|ad|od)/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)),
    [],
  )
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const steps = useMemo(
    () => [
      { title: 'Open this app in Safari', body: 'iOS only adds home-screen icons from Safari — Chrome and Firefox on iOS cannot.' },
      { title: 'Tap the Share button', body: 'The square with an arrow pointing up, in the toolbar at the bottom.' },
      { title: 'Choose “Add to Home Screen”', body: 'Scroll down in the share sheet if you do not see it.' },
      { title: 'Name it and tap Add', body: `Use “${summary?.book.title ?? 'Sefaria'}” so it is easy to find on your home screen.` },
      { title: 'Launch it from the icon', body: 'It opens full screen and drops straight into this book at your saved bookmark.' },
    ],
    [summary],
  )

  if (!summary) return null

  return (
    <Modal
      open
      onClose={onClose}
      title="Home screen shortcut"
      description={summary.book.title}
      scrollable
      footer={
        <Button variant="primary" fullWidth onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="space-y-4">
        {isIos ? (
          <p className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/70 p-3 text-xs text-brand-900 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            You are on iOS, so the five steps below apply directly.
          </p>
        ) : (
          <p className="rounded-lg border border-ink-200 bg-ink-100/60 p-3 text-xs text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
            These steps are for iPhone and iPad. On Android, use your browser&rsquo;s “Add to home screen”
            menu item instead — the shortcut link below works the same way.
          </p>
        )}

        {/* The link itself */}
        <div className="rounded-xl border border-dashed p-3">
          <p className="mb-1.5 text-xs font-medium">This book&rsquo;s link</p>
          <code className="block truncate rounded-lg bg-ink-100 px-2.5 py-2 text-[11px] text-ink-700 dark:bg-ink-900 dark:text-ink-200" dir="ltr">
            {link}
          </code>
          <div className="mt-2 flex gap-2">
            <CopyButton
              value={link}
              size="sm"
              className="flex-1"
              label="Copy link"
              copiedLabel="Link copied"
              onCopied={() => setCopied(true)}
            />
            {canShare ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void navigator
                    .share({ title: summary.book.title, url: link })
                    .catch(() => undefined)
                }
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </Button>
            ) : null}
          </div>
          {copied ? (
            <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              Copied — open it in Safari to continue.
            </p>
          ) : null}
        </div>

        {/* Steps */}
        <ol className="space-y-2.5">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-2.5">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums',
                  summary.accent.bg,
                  'text-white',
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-ink-500 dark:text-ink-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl bg-ink-100/70 p-3 text-[11px] text-ink-600 dark:bg-ink-800/70 dark:text-ink-300">
          <p className="font-medium">Why a shortcut instead of the app?</p>
          <p className="mt-1">
            Each shortcut remembers one book, so tapping the icon jumps straight to that text at your
            last bookmark — no library screen in between. Add one per book you rotate through.
          </p>
        </div>
      </div>
    </Modal>
  )
}
