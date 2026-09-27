import { useMemo, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  Target,
} from 'lucide-react'
import { Badge, Button, ProgressBar, ProgressRing } from './ui'
import { cn, parseDateKey, percent, plural } from '@/utils/format'
import { chapterDisplay, displayRef } from '@/utils/ref'
import type { Pace } from '@/types/sefaria'
import type { BookSummary, HistoryDay } from '@/hooks/useProgress'

export interface ProgressHeaderProps {
  summary: BookSummary
  /** Unit label from the loaded chapter, e.g. "Halakhah" or "Daf". */
  unitName: string
  /** Label for a whole chapter: "Perek", "Chapter", "Daf". */
  chapterName: string
  history: HistoryDay[]
  /** `YYYY-MM-DD`, used to mark today in the week strip. */
  today: string
  /** Position inside the loaded chapter. */
  segmentIndex: number
  segmentCount: number
  atFirstSegment: boolean
  atLastSegment: boolean
  onPrev: () => void
  onNext: () => void
  onCompleteQuota: () => void
  onUndoQuota: () => void
  onMarkUnit: () => void
  onPaceChange: (pace: Pace) => void
}

/**
 * The reading header: today's goal, the bookmark's position, quick navigation
 * and the "complete today's quota" action that advances the bookmark to where
 * the next session should begin.
 */
export function ProgressHeader({
  summary,
  unitName,
  chapterName,
  history,
  today,
  segmentIndex,
  segmentCount,
  atFirstSegment,
  atLastSegment,
  onPrev,
  onNext,
  onCompleteQuota,
  onUndoQuota,
  onMarkUnit,
  onPaceChange,
}: ProgressHeaderProps) {
  const [adjusting, setAdjusting] = useState(false)
  const { book, doneToday, targetToday, quotaMet, percentToday, progress, streak } = summary

  const goalUnit = book.pace.unit === 'chapter' ? chapterName : unitName
  const goalLabel = `${targetToday} ${plural(targetToday, goalUnit.toLowerCase())}`

  const recent = useMemo(() => history.slice(-7), [history])
  const maxDay = Math.max(1, ...recent.map((day) => day.total))

  const paceOptions = useMemo<Pace[]>(
    () => [
      { unit: 'segment', amount: 1 },
      { unit: 'segment', amount: 2 },
      { unit: 'segment', amount: 3 },
      { unit: 'segment', amount: 5 },
      { unit: 'segment', amount: 10 },
      { unit: 'chapter', amount: 1 },
      { unit: 'chapter', amount: 2 },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      {/* ---------------- Today ---------------- */}
      <div className="surface flex items-center gap-3 rounded-2xl border p-3">
        <ProgressRing
          value={percentToday}
          size={52}
          stroke={5}
          ringClass={quotaMet ? 'text-emerald-500' : summary.accent.ring}
        >
          {quotaMet ? (
            <Check className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          ) : (
            <span className="text-xs font-semibold tabular-nums">{percentToday}%</span>
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">
              {quotaMet ? "Today's goal complete" : "Today's goal"}
            </h2>
            {streak > 0 ? (
              <Badge tone="gold">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {streak} {plural(streak, 'day')}
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">
            <span className="font-medium tabular-nums">
              {doneToday} / {targetToday}
            </span>{' '}
            {goalLabel}
            {progress ? ` · ${displayRef(progress.ref)}` : ''}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <ProgressBar
              value={percentToday}
              barClass={quotaMet ? 'bg-emerald-500' : summary.accent.bar}
              label="Today's goal progress"
            />
            <button
              type="button"
              onClick={() => setAdjusting((v) => !v)}
              className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-ink-200/60 hover:text-ink-600 dark:hover:bg-ink-700/60 dark:hover:text-ink-200"
              aria-label="Change daily goal"
              aria-expanded={adjusting}
            >
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- Pace editor ---------------- */}
      {adjusting ? (
        <div className="surface animate-fade-in space-y-2.5 rounded-2xl border p-3">
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
            Daily quota
          </p>
          <div className="flex flex-wrap gap-1.5">
            {paceOptions.map((option) => {
              const active = option.unit === book.pace.unit && option.amount === book.pace.amount
              const label =
                option.unit === 'chapter'
                  ? `${option.amount} ${plural(option.amount, chapterName.toLowerCase())}`
                  : `${option.amount} ${plural(option.amount, unitName.toLowerCase())}`
              return (
                <button
                  key={`${option.unit}-${option.amount}`}
                  type="button"
                  onClick={() => onPaceChange(option)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-ink-500 dark:text-ink-400">Custom</span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={() => onPaceChange({ ...book.pace, amount: Math.max(1, book.pace.amount - 1) })}
                aria-label="Decrease daily goal"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-16 text-center text-sm font-semibold tabular-nums">
                {book.pace.amount} {book.pace.unit === 'chapter' ? chapterName.toLowerCase() : unitName.toLowerCase()}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={() => onPaceChange({ ...book.pace, amount: Math.min(999, book.pace.amount + 1) })}
                aria-label="Increase daily goal"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- Position + navigation ---------------- */}
      <div className="surface flex items-center gap-2 rounded-2xl border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={atFirstSegment}
          aria-label={`Previous ${unitName.toLowerCase()}`}
          className="px-2"
        >
          <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-semibold" dir="auto">
            {progress ? chapterDisplay(progress.ref) : book.title}
          </p>
          <p className="text-[11px] text-ink-500 dark:text-ink-400 tabular-nums">
            {segmentCount > 0
              ? `${unitName} ${segmentIndex + 1} of ${segmentCount}`
              : `${plural(summary.percentBook, '%')} through the book`}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={atLastSegment}
          aria-label={`Next ${unitName.toLowerCase()}`}
          className="px-2"
        >
          <ChevronLeft className="h-4.5 w-4.5" aria-hidden="true" />
        </Button>
      </div>

      {/* ---------------- Complete today's quota ---------------- */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {quotaMet ? (
          <>
            <div className="surface flex flex-1 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {goalLabel} done — bookmark moved to your next session.
              </span>
            </div>
            <Button variant="secondary" onClick={onUndoQuota} className="sm:w-auto">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={onCompleteQuota}
              className="flex-1 shadow-sm"
            >
              <Check className="h-4.5 w-4.5" aria-hidden="true" />
              Complete today&rsquo;s quota
            </Button>
            {book.pace.unit === 'segment' ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={onMarkUnit}
                className="sm:w-auto"
                title="Credit one unit as you read"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Log one
              </Button>
            ) : null}
          </>
        )}
      </div>

      {/* ---------------- Week strip ---------------- */}
      {recent.length ? (
        <div className="surface flex items-end justify-between gap-1 rounded-2xl border px-3 pt-3 pb-2">
          {recent.map((day) => {
            const height = percent(day.total, maxDay)
            return (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-8 w-full items-end">
                  <div
                    className={cn(
                      'w-full rounded-t transition-[height] duration-500',
                      day.total > 0 ? summary.accent.bar : 'bg-ink-200 dark:bg-ink-700',
                    )}
                    style={{ height: `${Math.max(8, height)}%` }}
                    title={`${day.day}: ${day.total} ${plural(day.total, 'unit')}`}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] tabular-nums',
                    day.total > 0
                      ? 'font-semibold text-ink-600 dark:text-ink-300'
                      : 'text-ink-400 dark:text-ink-600',
                    day.day === today && 'underline decoration-dotted underline-offset-2',
                  )}
                >
                  {parseDateKey(day.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
