import type { AccentColor } from '@/types/sefaria'

/**
 * A curated starting library, shown on the empty-library screen and at the top
 * of the "Add book" modal so a new user can be reading in one tap.
 *
 * Every ref below was verified against the live Sefaria catalogue and v3 text
 * API. Pace values are tuned to a realistic daily shiur (chaber / yomed).
 */
export interface StarterBook {
  ref: string
  title: string
  heTitle: string
  category: string
  blurb: string
  /** Suggested segments per day. */
  defaultPace: number
  accent: AccentColor
}

export const STARTER_BOOKS: readonly StarterBook[] = [
  {
    ref: 'Mishneh_Torah,_Human_Dispositions',
    title: 'Mishneh Torah, Human Dispositions',
    heTitle: 'משנה תורה, הלכות דעות',
    category: 'Rambam',
    blurb: 'The Rambam on middot, ethics and refining one’s character.',
    defaultPace: 3,
    accent: 'teal',
  },
  {
    ref: 'Mishneh_Torah,_Testimony',
    title: 'Mishneh Torah, Testimony',
    heTitle: 'משנה תורה, עדויות',
    category: 'Rambam',
    blurb: 'On testimony, belief and the Rambam’s Epilogue to the Mishneh Torah.',
    defaultPace: 2,
    accent: 'indigo',
  },
  {
    ref: 'Berakhot',
    title: 'Berakhot',
    heTitle: 'ברכות',
    category: 'Talmud',
    blurb: 'The first tractate: blessings, waking prayers, and the limits of time.',
    defaultPace: 1,
    accent: 'amber',
  },
  {
    ref: 'Shabbat',
    title: 'Shabbat',
    heTitle: 'שבת',
    category: 'Talmud',
    blurb: 'One daf a day, with the sugya and the Rishonim.',
    defaultPace: 1,
    accent: 'rose',
  },
  {
    ref: 'Mishnah_Berakhot',
    title: 'Mishnah Berakhot',
    heTitle: 'משנה ברכות',
    category: 'Mishnah',
    blurb: 'The Mishnah in its own voice — short, dense, memorisable.',
    defaultPace: 2,
    accent: 'emerald',
  },
  {
    ref: 'Pirkei_Avot',
    title: 'Pirkei Avot',
    heTitle: 'משנה אבות',
    category: 'Mishnah',
    blurb: 'Sayings of the Sages from Shimon HaTzadik onward.',
    defaultPace: 1,
    accent: 'gold',
  },
  {
    ref: 'Genesis',
    title: 'Genesis',
    heTitle: 'בראשית',
    category: 'Tanakh',
    blurb: 'The weekly parashah, with vowel points and cantillation.',
    defaultPace: 1,
    accent: 'teal',
  },
  {
    ref: 'Psalms',
    title: 'Psalms',
    heTitle: 'תהלים',
    category: 'Tanakh',
    blurb: 'A psalm a day, or a whole tehillim chapter.',
    defaultPace: 1,
    accent: 'indigo',
  },
  {
    ref: "Shulchan_Arukh,_Yoreh_De'ah",
    title: 'Shulchan Arukh, Yoreh De’ah',
    heTitle: 'שולחן ערוך, יורה דעה',
    category: 'Halakhah',
    blurb: 'The mainstream code of Jewish law, one se’if at a time.',
    defaultPace: 2,
    accent: 'emerald',
  },
]

/**
 * {@link STARTER_BOOKS} with duplicate refs collapsed, so a volume listed twice
 * (e.g. once for a particular tractate and once for a category) cannot render
 * two identical rows in the "Add a book" browser.
 */
export const UNIQUE_STARTER_BOOKS: readonly StarterBook[] = Array.from(
  new Map(STARTER_BOOKS.map((book) => [book.ref, book])).values(),
)

export const ACCENTS: readonly {
  value: AccentColor
  ring: string
  text: string
  bg: string
  bar: string
}[] = [
  {
    value: 'teal',
    ring: 'stroke-brand-500',
    text: 'text-brand-600 dark:text-brand-300',
    bg: 'bg-brand-500',
    bar: 'bg-brand-500',
  },
  {
    value: 'gold',
    ring: 'stroke-gold-400',
    text: 'text-gold-500 dark:text-gold-300',
    bg: 'bg-gold-400',
    bar: 'bg-gold-400',
  },
  {
    value: 'indigo',
    ring: 'stroke-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-300',
    bg: 'bg-indigo-500',
    bar: 'bg-indigo-500',
  },
  {
    value: 'rose',
    ring: 'stroke-rose-500',
    text: 'text-rose-600 dark:text-rose-300',
    bg: 'bg-rose-500',
    bar: 'bg-rose-500',
  },
  {
    value: 'emerald',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  {
    value: 'amber',
    ring: 'stroke-amber-500',
    text: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
]

const FALLBACK_ACCENT = ACCENTS[0]!

export function accentStyle(accent: AccentColor) {
  return ACCENTS.find((a) => a.value === accent) ?? FALLBACK_ACCENT
}

/** Catalogue categories, in the order they should appear in the browser. */
export const CATEGORY_ORDER: readonly string[] = [
  'Tanakh',
  'Mishnah',
  'Talmud',
  'Halakhah',
  'Midrash',
  'Jewish Thought',
  'Kabbalah',
  'Liturgy',
  'Tosefta',
  'Chasidut',
  'Musar',
  'Responsa',
  'Second Temple',
  'Reference',
]
