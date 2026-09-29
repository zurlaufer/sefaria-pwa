export type Lang = 'en' | 'he'

const translations: Record<string, Record<Lang, string>> = {
  library: { en: 'Library', he: 'ספרייה' },
  settings: { en: 'Settings', he: 'הגדרות' },
  addBook: { en: 'Add book', he: 'הוסף ספר' },
  addABook: { en: 'Add a book', he: 'הוסף ספר' },
  addYourFirstBook: { en: 'Add your first book', he: 'הוסף את הספר הראשון שלך' },
  todaysProgress: { en: "Today's progress", he: 'התקדמות היומית' },
  streak: { en: 'day streak', he: 'ימים ברצף' },
  streakSingular: { en: 'day streak', he: 'יום ברצף' },
  unit: { en: 'unit', he: 'יחידה' },
  units: { en: 'units', he: 'יחידות' },
  book: { en: 'book', he: 'ספר' },
  books: { en: 'books', he: 'ספרים' },
  across: { en: 'across', he: 'בתוך' },
  today: { en: 'today', he: 'היום' },
  noBooksYet: {
    en: 'Add your first book to start tracking a daily shiur.',
    he: 'הוסף את הספר הראשון שלך כדי להתחיל לעקוב אחר שיעור יומי.',
  },
  searchPlaceholder: {
    en: 'Search every book — try “Rambam” or “Shevuot”',
    he: 'חפש בכל ספר — נסה "רמב"ם" או "שבועות"',
  },
  searchCatalogue: { en: 'Search the Sefaria catalogue', he: 'חפש בקטלוג ספריא' },
  searchAllOfSefaria: { en: 'Search all of Sefaria, or paste a reference directly.', he: 'חפש בכל ספריא, או הדבק מראה מקום ישירות.' },
  addToLibrary: { en: 'Add to library', he: 'הוסף לספרייה' },
  added: { en: 'Added', he: 'נוסף' },
  saveChanges: { en: 'Save changes', he: 'שמור שינויים' },
  cancel: { en: 'Cancel', he: 'ביטול' },
  save: { en: 'Save', he: 'שמור' },
  appearance: { en: 'Appearance', he: 'מראה' },
  theme: { en: 'Theme', he: 'ערכת נושא' },
  interfaceLanguage: { en: 'Interface Language', he: 'שפת ממשק' },
  hebrewFont: { en: 'Hebrew Typeface', he: 'גופן עברי' },
  fontSize: { en: 'Font Size', he: 'גודל גופן' },
  showVowels: { en: 'Vowels (Nikud)', he: 'ניקוד' },
  showPunctuation: { en: 'Punctuation', he: 'פיסוק' },
  exportLibrary: { en: 'Export library & progress', he: 'ייצא ספרייה והתקדמות' },
  importLibrary: { en: 'Import library & progress', he: 'ייבא ספרייה והתקדמות' },
  resetAll: { en: 'Reset all data', he: 'איפוס כל הנתונים' },
  completeQuota: { en: 'Complete daily quota', he: 'השלם מכסה יומית' },
  undoQuota: { en: 'Undo quota', he: 'בטל השלמה' },
  markUnit: { en: 'Mark unit studied', he: 'סמן כיחידה הנלמדת' },
  previous: { en: 'Previous', he: 'הקודם' },
  next: { en: 'Next', he: 'הבא' },
  backToLibrary: { en: 'Back to Library', he: 'חזרה לספרייה' },
  offlineMode: { en: 'Offline mode', he: 'מצב לא מקוון' },
  retry: { en: 'Retry', he: 'נסה שוב' },
  loading: { en: 'Loading...', he: 'טוען...' },
  suggestedForDailyShiur: { en: 'Suggested for a daily shiur', he: 'מומלץ לשיעור יומי' },
  suggested: { en: 'Suggested', he: 'מומלץ' },
  results: { en: 'results', he: 'תוצאות' },
  result: { en: 'result', he: 'תוצאה' },
  alreadyInLibrary: { en: 'is already in your library.', he: 'כבר נמצא בספרייה שלך.' },
  setYourDailyGoal: { en: 'Set your daily goal', he: 'הגדר את היעד היומי שלך' },
  updateDailyGoal: { en: 'Update daily goal', he: 'עדכן יעד יומי' },
  dailyGoal: { en: 'Daily goal', he: 'יעד יומי' },
  deleteEverything: { en: 'Delete everything?', he: 'למחק הכל?' },
  importBackup: { en: 'Import a backup', he: 'ייבא גיבוי' },
  addToHomeScreen: { en: 'Add this book to your iOS home screen', he: 'הוסף ספר זה למסך הבית באייפון' },
  homeScreenShortcut: { en: 'Home screen shortcut', he: 'קיצור דרך במסך הבית' },
  
  // Categories
  Tanakh: { en: 'Tanakh', he: 'תנ״ך' },
  Mishnah: { en: 'Mishnah', he: 'משנה' },
  Talmud: { en: 'Talmud', he: 'תלמוד' },
  Halakhah: { en: 'Halakhah', he: 'הלכה' },
  Midrash: { en: 'Midrash', he: 'מדרש' },
  Kabbalah: { en: 'Kabbalah', he: 'קבלה' },
  Philosophy: { en: 'Philosophy', he: 'מחשבת ישראל' },
  Liturgy: { en: 'Liturgy', he: 'תפילה' },
  Tosefta: { en: 'Tosefta', he: 'תוספתא' },
  Chasidut: { en: 'Chasidut', he: 'חסידות' },
  Musar: { en: 'Musar', he: 'מוסר' },
  Responsa: { en: 'Responsa', he: 'שאלות ותשובות' },
  Apocrypha: { en: 'Apocrypha', he: 'ספרים חיצוניים' },
  'Second Temple': { en: 'Second Temple', he: 'בית שני' },
  Commentary: { en: 'Commentary', he: 'פרשנות' },
  'Modern Works': { en: 'Modern Works', he: 'מחקר וספרות עכשווית' },
  Rambam: { en: 'Rambam', he: 'רמב״ם' },
}

export function t(key: string, lang: Lang = 'en'): string {
  if (!key) return ''
  const trimmed = key.trim()
  if (translations[trimmed]?.[lang]) {
    return translations[trimmed][lang]
  }
  if (translations[trimmed]?.['en']) {
    return translations[trimmed]['en']
  }
  // Try case-insensitive or exact key lookup
  return key
}
