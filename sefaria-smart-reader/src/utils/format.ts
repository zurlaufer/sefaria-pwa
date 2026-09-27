/* Small, dependency-free formatting helpers. */

/** Join class names, dropping falsy values. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Local-timezone `YYYY-MM-DD` key (never UTC — quotas must follow the user). */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a `YYYY-MM-DD` key back into a local Date. */
export function parseDateKey(key: string): Date {
  const [y = '0', m = '1', d = '1'] = key.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Whole days between two date keys (`b - a`). */
export function daysBetween(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

/** "Today", "Yesterday", or a short date. */
export function relativeDay(key: string, today = dateKey()): string {
  const diff = daysBetween(key, today)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Sortable list of the last `n` date keys, oldest first. */
export function recentDateKeys(n: number, today = dateKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)))
}

/* -------------------------------------------------------------------------- */
/*  Numbers & strings                                                          */
/* -------------------------------------------------------------------------- */

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Naive but sufficient pluraliser for the handful of unit names in use. */
export function plural(count: number, word: string): string {
  if (count === 1) return word
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return clamp(Math.round((done / total) * 100), 0, 100)
}

/** Trim a string to `max` characters on a word boundary. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  const slice = value.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`
}

/** Strip Sefaria's inline HTML so previews render as plain text. */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
