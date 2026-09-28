import type { ReactNode } from 'react'
import { BookOpen, Library, Moon, Settings as SettingsIcon, Sun, WifiOff } from 'lucide-react'
import { Badge, Button } from './ui'
import { cn } from '@/utils/format'
import { t } from '@/utils/i18n'
import type { AppView } from '@/hooks/useRouter'
import type { Lang } from '@/utils/i18n'

export interface NavbarProps {
  view: AppView
  onNavigate: (view: AppView) => void
  /** `system` resolves to the current OS preference. */
  theme: 'light' | 'dark' | 'system'
  onToggleTheme: () => void
  /** True when the device reports no connectivity. */
  offline: boolean
  bookCount: number
  lang?: Lang
}

export function Navbar({
  view,
  onNavigate,
  theme,
  onToggleTheme,
  offline,
  bookCount,
  lang = 'en',
}: NavbarProps) {
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <header className="app-shell sticky top-0 z-30 border-b bg-[var(--app-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => onNavigate('library')}
          className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1 text-left"
          aria-label="Go to library"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
            <BookOpen className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm leading-tight font-semibold">
              Sefaria Reader
            </span>
            <span className="block truncate text-[11px] leading-tight text-ink-500 dark:text-ink-400">
              {bookCount === 0 ? t('noBooksYet', lang) : `${bookCount} active ${bookCount === 1 ? t('book', lang) : t('books', lang)}`}
            </span>
          </span>
        </button>

        <div className="flex-1" />

        {offline ? (
          <Badge tone="gold" className="mr-1">
            <WifiOff className="h-3 w-3" aria-hidden="true" />
            {t('offlineMode', lang)}
          </Badge>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleTheme}
          aria-label={theme === 'system' ? `Theme: system (${isDark ? 'dark' : 'light'})` : `Theme: ${theme}`}
          title={`Theme: ${theme}`}
          className="px-2"
        >
          {theme === 'system' ? (
            <Sun className={cn('h-4.5 w-4.5', isDark && 'opacity-40')} aria-hidden="true" />
          ) : isDark ? (
            <Moon className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Sun className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </Button>

        <nav className="flex items-center gap-0.5" aria-label="Primary">
          <NavButton
            active={view === 'library'}
            onClick={() => onNavigate('library')}
            label={t('library', lang)}
          >
            <Library className="h-4.5 w-4.5" aria-hidden="true" />
          </NavButton>
          <NavButton
            active={view === 'settings'}
            onClick={() => onNavigate('settings')}
            label={t('settings', lang)}
          >
            <SettingsIcon className="h-4.5 w-4.5" aria-hidden="true" />
          </NavButton>
        </nav>
      </div>
    </header>
  )
}

function NavButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg transition-colors',
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
          : 'text-ink-500 hover:bg-ink-200/60 dark:text-ink-400 dark:hover:bg-ink-700/60',
      )}
    >
      {children}
    </button>
  )
}
