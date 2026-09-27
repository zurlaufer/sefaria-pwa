import { useEffect } from 'react'
import type { Settings } from '@/types/sefaria'
import { clamp } from '@/utils/format'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Apply the theme to <html> and keep the browser chrome colour in sync.
 * The iOS status bar and the manifest both read `theme-color`, so it is
 * rewritten whenever the mode changes.
 */
export function useTheme(settings: Settings): void {
  const preference = settings.theme

  useEffect(() => {
    const root = document.documentElement
    const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark())

    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
    if (themeMeta) {
      themeMeta.content = dark ? '#0b0f14' : '#faf7f2'
    } else {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = dark ? '#0b0f14' : '#faf7f2'
      document.head.appendChild(meta)
    }
  }, [preference])

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      document.documentElement.classList.toggle('dark', media.matches)
      document.documentElement.style.colorScheme = media.matches ? 'dark' : 'light'
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])
}

/** Apply the reading size and the Hebrew typeface. */
export function useReadingTypography(settings: Settings): void {
  useEffect(() => {
    const root = document.documentElement
    const size = clamp(Math.trunc(settings.fontSize) || 3, 1, 5)

    for (let i = 1; i <= 5; i += 1) root.classList.remove(`reader-size-${i}`)
    root.classList.add(`reader-size-${size}`)
    root.classList.toggle('hebrew-text--alt', settings.hebrewFont === 'naskh')
  }, [settings.fontSize, settings.hebrewFont])
}
