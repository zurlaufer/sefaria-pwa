import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/*  Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50',
  secondary:
    'surface border text-[var(--app-fg)] hover:bg-ink-100/70 dark:hover:bg-ink-700/60 disabled:opacity-50',
  ghost: 'text-[var(--app-fg)] hover:bg-ink-200/50 dark:hover:bg-ink-700/50 disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    fullWidth = false,
    loading = false,
    className,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors',
        'disabled:cursor-not-allowed select-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="shrink-0" /> : null}
      {children}
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/*  Spinner                                                                    */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('surface card-shadow rounded-2xl border', className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Progress ring                                                              */
/* -------------------------------------------------------------------------- */

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  className,
  ringClass,
  trackClass = 'text-ink-200 dark:text-ink-700',
  children,
}: {
  /** 0–100. */
  value: number
  size?: number
  stroke?: number
  className?: string
  ringClass?: string
  trackClass?: string
  children?: ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out', ringClass)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Linear progress bar                                                        */
/* -------------------------------------------------------------------------- */

export function ProgressBar({
  value,
  className,
  barClass = 'bg-brand-500',
  trackClass = 'bg-ink-200 dark:bg-ink-700',
  label,
}: {
  /** 0–100. */
  value: number
  className?: string
  barClass?: string
  trackClass?: string
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full', trackClass, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Modal                                                                      */
/* -------------------------------------------------------------------------- */

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Cap the height and let the body scroll. */
  scrollable?: boolean
  labelledBy?: string
}

/**
 * Accessible dialog: focus is moved in on open, Escape closes, and the page
 * behind is inert to pointer events.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  scrollable = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      // Keep Tab inside the dialog.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusTimer = setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-autofocus], input, button, select, textarea')
        ?.focus()
    }, 40)

    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'surface relative flex w-full flex-col overflow-hidden border shadow-2xl',
          'max-h-[92dvh] animate-slide-up sm:max-w-2xl sm:rounded-2xl sm:animate-fade-in',
          'rounded-t-3xl sm:rounded-2xl',
        )}
      >
        {/* Drag affordance on iOS. */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink-300 sm:hidden" />

        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="-mr-2 -mt-1 shrink-0 px-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div
          className={cn(
            'min-h-0 flex-1 px-5 pb-5 sm:px-6',
            scrollable && 'scrollbar-thin overflow-y-auto',
          )}
        >
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        ) : (
          <div className="h-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Skeletons                                                                  */
/* -------------------------------------------------------------------------- */

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} />
}

export function SkeletonParagraph({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          className={cn('h-5', i === lines - 1 ? 'w-2/3' : i % 2 ? 'w-11/12' : 'w-full')}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      {icon ? <div className="text-ink-300 dark:text-ink-600">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Badge                                                                      */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'success' | 'brand' | 'gold'
}) {
  const tones = {
    neutral: 'bg-ink-200/70 text-ink-600 dark:bg-ink-700/70 dark:text-ink-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
    gold: 'bg-gold-300/30 text-gold-600 dark:bg-gold-400/15 dark:text-gold-300',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Copy button                                                                */
/* -------------------------------------------------------------------------- */

/** Copy to clipboard with a transient confirmation state. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  className,
  onCopied,
  ...props
}: Omit<ButtonProps, 'onClick' | 'children'> & {
  value: string
  label?: string
  copiedLabel?: string
  onCopied?: () => void
}) {
  const [copied, markCopied] = useCopiedState()

  const copy = useCallback(async () => {
    const done = await writeToClipboard(value)
    if (!done) return
    markCopied()
    onCopied?.()
  }, [value, onCopied, markCopied])

  return (
    <Button {...props} className={className} onClick={() => void copy()}>
      {copied ? copiedLabel : label}
    </Button>
  )
}

/** Clipboard write with an `execCommand` fallback for insecure contexts. */
async function writeToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // The async Clipboard API is unavailable outside secure contexts.
  }

  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

function useCopiedState() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mark = useCallback(() => {
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return [copied, mark] as const
}
