import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  Download,
  FileJson,
  Flame,
  HardDrive,
  Minus,
  Monitor,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  Type,
  Upload,
} from 'lucide-react'
import { Badge, Button, Card, Modal } from './ui'
import { cn, dateKey, plural } from '@/utils/format'
import { t } from '@/utils/i18n'
import type { Settings } from '@/types/sefaria'
import type { ImportResult } from '@/hooks/useProgress'

export interface SettingsPanelProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  /** Wipe the library, all progress and the settings themselves. */
  onReset: () => void
  /** Serialise the whole state as JSON. */
  onExport: () => string
  /** Replace the whole state from a JSON string. */
  onImport: (raw: string) => ImportResult
  bookCount: number
  /** Days with anything studied, within the history window. */
  activeDays: number
}

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const HEBREW_FONTS = [
  { value: 'rhl', label: 'Frank Ruhl', note: 'Warm, high-contrast' },
  { value: 'naskh', label: 'Noto Serif', note: 'Neutral, formal' },
] as const

const FONT_SIZE_NOTES = ['Smallest', 'Small', 'Default', 'Large', 'Largest'] as const

/**
 * Reading preferences, plus the export / import / reset controls for the
 * library. Nothing here touches Sefaria: preferences are local, and the data
 * tools act only on what is stored in this browser.
 */
export function SettingsPanel({
  settings,
  onChange,
  onReset,
  onExport,
  onImport,
  bookCount,
  activeDays,
}: SettingsPanelProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [importText, setImportText] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const fontSize = Math.min(5, Math.max(1, Math.trunc(settings.fontSize) || 3))
  const lang = settings.interfaceLanguage || 'en'

  /* ----------------------------- export ----------------------------- */

  const handleExport = useCallback(() => {
    const payload = onExport()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sefaria-reader-${dateKey()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [onExport])

  /* ----------------------------- import ----------------------------- */

  const applyImport = useCallback(
    (raw: string) => {
      const result: ImportResult = onImport(raw)
      if (result.ok) {
        setImportError(null)
        setImportText('')
        setImportOpen(false)
        return
      }
      setImportError(result.message)
    },
    [onImport],
  )

  const onFilePicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      // Reset first so picking the same file twice still fires a change event.
      event.target.value = ''
      void file
        .text()
        .then((text) => applyImport(text))
        .catch(() => setImportError('That file could not be read.'))
    },
    [applyImport],
  )

  const canPaste = importText.trim().length > 0

  /* ----------------------------- render ----------------------------- */

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t('settings', lang)}</h1>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          Reading preferences are saved on this device and apply everywhere.
        </p>
      </div>

      {/* ------------------------- Appearance ------------------------- */}
      <Section title={t('appearance', lang)} icon={<Type className="h-4 w-4" aria-hidden="true" />}>
        <Row label={t('interfaceLanguage', lang)}>
          <div className="flex gap-1.5">
            {[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange({ interfaceLanguage: item.value as 'en' | 'he' })}
                aria-pressed={lang === item.value}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  lang === item.value
                    ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                    : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label={t('theme', lang)} hint="Follows your system setting until you override it.">
          <div className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ theme: value })}
                aria-pressed={settings.theme === value}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                  settings.theme === value
                    ? 'bg-[var(--app-surface)] shadow-sm'
                    : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </Row>

        <Row
          label="Text size"
          hint={FONT_SIZE_NOTES[fontSize - 1] ?? 'Default'}
          right={
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={() => onChange({ fontSize: Math.max(1, fontSize - 1) })}
                disabled={fontSize <= 1}
                aria-label="Smaller text"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{fontSize}</span>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={() => onChange({ fontSize: Math.min(5, fontSize + 1) })}
                disabled={fontSize >= 5}
                aria-label="Larger text"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          }
        />

        <Row label="Hebrew font">
          <div className="flex gap-1.5">
            {HEBREW_FONTS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => onChange({ hebrewFont: font.value })}
                aria-pressed={settings.hebrewFont === font.value}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  settings.hebrewFont === font.value
                    ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                    : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
                )}
              >
                {font.label}
                <span className="ms-1.5 hidden font-normal opacity-70 sm:inline">{font.note}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Vowel points" hint="Show niqqud and cantillation marks.">
          <Switch
            checked={settings.showVowels}
            onChange={(showVowels) => onChange({ showVowels })}
            label="Vowel points"
          />
        </Row>

        <Row label="Punctuation" hint="Maqaf, sof pasuq and geresh.">
          <Switch
            checked={settings.showPunctuation}
            onChange={(showPunctuation) => onChange({ showPunctuation })}
            label="Punctuation"
          />
        </Row>
      </Section>

      {/* ------------------------- Your data ------------------------- */}
      <Section title="Your data" icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}>
        <div className="flex items-stretch gap-2">
          <Stat
            icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            value={String(bookCount)}
            label={bookCount === 1 ? 'book tracked' : 'books tracked'}
          />
          <Stat
            icon={<Flame className="h-4 w-4" aria-hidden="true" />}
            value={String(activeDays)}
            label={activeDays === 1 ? 'active day' : 'active days'}
          />
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-ink-100/70 p-3 text-[11px] text-ink-600 dark:bg-ink-800/70 dark:text-ink-300">
          <ShieldCheck
            className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
          Your library, bookmarks and history live in this browser only. There is no account and
          nothing is uploaded. Clearing site data will erase them, so export a backup if you want to
          keep it.
        </p>

        <Row label="Backup" hint="Download every book, bookmark and streak as JSON.">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import
            </Button>
          </div>
        </Row>

        <Row label="Storage" hint="Chapters you have read are cached for offline use.">
          <Badge>
            <HardDrive className="h-3 w-3" aria-hidden="true" />
            Cached automatically
          </Badge>
        </Row>
      </Section>

      {/* ------------------------- Reset ------------------------- */}
      <Section title="Reset" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} tone="danger">
        <Row
          label="Delete everything"
          hint="Removes all books, bookmarks, history and preferences. The texts on Sefaria are untouched."
          right={
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Reset app
            </Button>
          }
        />
      </Section>

      <p className="pt-1 text-center text-[11px] text-ink-400 dark:text-ink-500">
        Texts and commentaries from{' '}
        <a
          href="https://www.sefaria.org"
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2"
        >
          Sefaria.org
        </a>
        .
      </p>

      {/* ------------------------- Dialogs ------------------------- */}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Delete everything?"
        description="This cannot be undone."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                onReset()
                setConfirmReset(false)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          This clears {plural(bookCount, 'book')} from your library, every bookmark and streak, and
          your reading preferences. Export a backup first if you want to restore any of it.
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-gold-300/20 p-2.5 text-xs text-gold-600 dark:bg-gold-400/10 dark:text-gold-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Chapters cached for offline reading stay in the browser cache until they fall out of it.
        </p>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportError(null)
        }}
        title="Import a backup"
        description="Replaces your current library with the contents of the file."
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setImportOpen(false)
                setImportError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={!canPaste}
              onClick={() => applyImport(importText)}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Import
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-gold-300/20 p-2.5 text-xs text-gold-600 dark:bg-gold-400/10 dark:text-gold-300">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Importing overwrites what is here now, so export a backup first if you are unsure.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFilePicked}
          />
          <Button variant="secondary" fullWidth onClick={() => fileInput.current?.click()}>
            <FileJson className="h-4 w-4" aria-hidden="true" />
            Choose a JSON file
          </Button>

          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
            or paste
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
          </div>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={5}
            spellCheck={false}
            placeholder='{"version":1,"books":[…]}'
            aria-label="Backup JSON"
            className="surface w-full rounded-xl border p-3 font-mono text-[11px] outline-none placeholder:text-ink-400 focus:border-brand-500"
          />

          {importError ? (
            <p className="rounded-lg border border-rose-300/60 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {importError}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon,
  tone = 'default',
  children,
}: {
  title: string
  icon: ReactNode
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <section>
      <h2
        className={cn(
          'mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase',
          tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-ink-500 dark:text-ink-400',
        )}
      >
        {icon}
        {title}
      </h2>
      <Card className="divide-y divide-ink-200/70 p-0 dark:divide-ink-700/70">{children}</Card>
    </section>
  )
}

function Row({
  label,
  hint,
  right,
  children,
}: {
  label: string
  hint?: string
  /** Rendered on the right; overrides `children` when both would be shown. */
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p> : null}
      </div>
      {right ?? children}
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-ink-100/70 px-3 py-2.5 dark:bg-ink-800/70">
      <span className="text-brand-600 dark:text-brand-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm leading-tight font-semibold tabular-nums">{value}</p>
        <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">{label}</p>
      </div>
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
