import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookMarked, ChevronDown, ExternalLink, Loader2, MessageSquareQuote, X } from 'lucide-react'
import { Badge, Button, SkeletonParagraph } from './ui'
import { SefariaError, fetchCommentaryLinks, fetchText } from '@/services/sefariaApi'
import { displayRef, sefariaUrl } from '@/utils/ref'
import { renderHebrew, toPlainText } from '@/utils/hebrew'
import { cn } from '@/utils/format'
import type { SefariaLink } from '@/types/sefaria'

export interface CommentaryDrawerProps {
  /** The ref whose commentaries should be shown, or null when closed. */
  ref: string | null
  onClose: () => void
  /** True when the device is offline. */
  offline: boolean
  /** Strip vowel points in the drawer, matching the reader setting. */
  showVowels: boolean
  /** Hebrew typeface in use. */
  hebrewFont: 'rhl' | 'naskh'
}

interface CommentaryEntry {
  key: string
  title: string
  heTitle: string
  ref: string
  /** Raw link preview as Sefaria sent it, or '' when the link carries none. */
  preview: string
  previewIsHebrew: boolean
  /** Raw full text, fetched the first time the entry is expanded. */
  full: string
  sefariaLink: string
  license?: string
  expanded: boolean
  loading: boolean
  error: string | null
}

const PREVIEW_LIMIT = 240
const FULL_LIMIT = 6000

/**
 * Bottom slide-over listing the commentaries Sefaria links to the current
 * verse / halacha / daf. Most link records already inline a preview, so the
 * drawer is useful immediately; expanding one fetches the full text.
 */
export function CommentaryDrawer({
  ref,
  onClose,
  offline,
  showVowels,
  hebrewFont,
}: CommentaryDrawerProps) {
  const [entries, setEntries] = useState<CommentaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const linkRequest = useRef(0)
  const entriesRef = useRef<CommentaryEntry[]>([])
  const open = Boolean(ref)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  /* ---------------------------- load links ---------------------------- */

  const loadLinks = useCallback((target: string, offlineOnly: boolean) => {
    const id = ++linkRequest.current
    setLoading(true)
    setError(null)
    setFromCache(offlineOnly)

    void fetchCommentaryLinks(target, { offlineOnly })
      .then((links) => {
        if (id !== linkRequest.current) return
        setEntries(links.map(toEntry))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== linkRequest.current) return
        setError(err instanceof SefariaError ? err.message : 'Commentaries could not be loaded right now.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!ref) return
    linkRequest.current += 1
    setEntries([])
    setError(null)
    loadLinks(ref, false)
  }, [ref, loadLinks])

  // Offline fallback: fall back to the last cached link list for this ref.
  useEffect(() => {
    if (!ref || !error || !offline || fromCache) return
    loadLinks(ref, true)
  }, [ref, error, offline, fromCache, loadLinks])

  /* ---------------------------- expand one ---------------------------- */

  const toggle = useCallback((key: string) => {
    const current = entriesRef.current.find((entry) => entry.key === key)
    if (!current) return

    const expanding = !current.expanded
    setEntries((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, expanded: expanding } : entry)),
    )
    if (!expanding || current.full || current.loading) return

    setEntries((prev) => prev.map((entry) => (entry.key === key ? { ...entry, loading: true } : entry)))

    void fetchText(current.ref)
      .then((text) => {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.key === key
              ? {
                  ...entry,
                  loading: false,
                  error: null,
                  // Kept raw; the row sanitises once the reader's vowel
                  // setting is known.
                  full: text.segments.map((segment) => segment.he).join(' '),
                }
              : entry,
          ),
        )
      })
      .catch((err: unknown) => {
        const message =
          err instanceof SefariaError ? err.message : 'This commentary could not be loaded.'
        setEntries((prev) =>
          prev.map((entry) => (entry.key === key ? { ...entry, loading: false, error: message } : entry)),
        )
      })
  }, [])

  /* ---------------------------- escape / focus ---------------------------- */

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const timer = setTimeout(() => panelRef.current?.focus(), 60)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!ref) return null

  const withPreview = entries.filter((entry) => entry.preview).length

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Commentaries on ${displayRef(ref)}`}
        tabIndex={-1}
        className="surface relative flex max-h-[85dvh] w-full max-w-2xl animate-slide-up flex-col rounded-t-3xl border-t shadow-drawer outline-none"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink-300" />

        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquareQuote
                className="h-4 w-4 text-brand-600 dark:text-brand-300"
                aria-hidden="true"
              />
              Commentaries
            </h2>
            <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400" dir="auto">
              {displayRef(ref)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-1 px-2"
            onClick={onClose}
            aria-label="Close commentaries"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        {fromCache ? (
          <div className="shrink-0 px-4 pb-1">
            <Badge tone="gold">Showing saved commentaries — you are offline</Badge>
          </div>
        ) : null}

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {loading ? (
            <div className="space-y-4 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <SkeletonParagraph lines={1} />
                  <SkeletonParagraph lines={2} />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="rounded-xl border border-rose-300/60 bg-rose-50/70 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              Sefaria has no commentaries linked to this segment.
            </p>
          ) : (
            <>
              {withPreview < entries.length ? (
                <p className="pb-1 text-[11px] text-ink-400 dark:text-ink-500">
                  {entries.length - withPreview} of {entries.length} need a fetch — tap any entry to load it.
                </p>
              ) : null}

              <ul className="divide-y divide-ink-200/70 dark:divide-ink-700/70">
                {entries.map((entry) => (
                  <li key={entry.key}>
                    <CommentaryRow
                      entry={entry}
                      showVowels={showVowels}
                      hebrewFont={hebrewFont}
                      onToggle={() => toggle(entry.key)}
                    />
                  </li>
                ))}
              </ul>

              <a
                href={sefariaUrl(ref)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open this segment on Sefaria
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentaryRow({
  entry,
  onToggle,
  showVowels,
  hebrewFont,
}: {
  entry: CommentaryEntry
  onToggle: () => void
  showVowels: boolean
  hebrewFont: 'rhl' | 'naskh'
}) {
  const hebrewFontClass = hebrewFont === 'naskh' ? 'font-hebrewAlt' : 'font-hebrew'
  const isHebrew = entry.previewIsHebrew || Boolean(entry.full)
  const source = entry.full || entry.preview

  // Sanitised here rather than on store, because the vowel setting belongs to
  // the reader and can change while the drawer is open.
  const body = useMemo(() => {
    if (!source) return ''
    const html = isHebrew
      ? renderHebrew(source, { vowels: showVowels })
      : escapeHtml(toPlainText(source))
    return truncateHtml(html, entry.full ? FULL_LIMIT : PREVIEW_LIMIT)
  }, [source, isHebrew, showVowels, entry.full])

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 text-start"
        aria-expanded={entry.expanded}
      >
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-ink-400 transition-transform',
            entry.expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{entry.title}</span>
            {entry.heTitle ? (
              <span className="text-xs text-ink-500 dark:text-ink-400" dir="rtl">
                {entry.heTitle}
              </span>
            ) : null}
          </span>

          {entry.loading ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-400">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Loading text…
            </span>
          ) : entry.error ? (
            <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{entry.error}</span>
          ) : body ? (
            <span
              className={cn(
                'mt-1 block text-sm leading-relaxed text-ink-600 dark:text-ink-300',
                isHebrew && hebrewFontClass,
                isHebrew && 'hebrew-text text-[0.95rem] leading-[1.85]',
              )}
              dir={isHebrew ? 'rtl' : 'auto'}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <span className="mt-1 block text-xs text-ink-400">Tap to load the text</span>
          )}
        </span>
      </button>

      {entry.expanded ? (
        <div className="mt-2.5 ms-6 space-y-2">
          {entry.license ? <Badge>{entry.license}</Badge> : null}
          <div>
            <a
              href={entry.sefariaLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
            >
              <BookMarked className="h-3 w-3" aria-hidden="true" />
              Read the full text on Sefaria
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toEntry(link: SefariaLink): CommentaryEntry {
  // Hebrew is preferred: it is the primary reading surface in this app.
  const previewIsHebrew = Boolean(link.he)
  const preview = link.he ?? link.text ?? ''

  return {
    key: link._id ?? link.ref,
    title: link.index_title,
    heTitle: link.heTitle ?? link.collectiveTitle?.he ?? '',
    ref: link.ref,
    preview,
    previewIsHebrew,
    full: '',
    sefariaLink: sefariaUrl(link.ref),
    license: link.license ?? link.heLicense,
    expanded: false,
    loading: false,
    error: null,
  }
}

/** Cap already-sanitised Sefaria HTML so a long commentary cannot bloat the DOM. */
function truncateHtml(html: string, max: number): string {
  return html.length > max ? `${html.slice(0, max).trimEnd()}…` : html
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
