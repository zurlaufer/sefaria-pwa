import { useCallback, useEffect, useState } from 'react'
import { canonicalRef, chapterOf, parseRef, stripRange } from '@/utils/ref'

export type AppView = 'library' | 'reader' | 'settings'

export interface Route {
  view: AppView
  /** Canonical book ref when routed into a book, else null. */
  bookRef: string | null
  /** Canonical ref of a specific location, else null. */
  atRef: string | null
}

const DEFAULT_ROUTE: Route = { view: 'library', bookRef: null, atRef: null }

/**
 * Parse the current location into a route.
 *
 * Three notations are supported, so home-screen shortcuts, shared links and
 * in-app navigation all resolve to the same workspace:
 *   `/book/<Book_Ref>/<chapter>/<segment>`   path form
 *   `/?book=<Book_Ref>&at=<Book_Ref.1.2>`    query form
 *   `#library`, `#settings`                  hash tabs
 */
export function parseRoute(location: Location | URL): Route {
  const url = 'pathname' in location ? new URL(location.href) : location

  // Path form: /book/<book>[/<...address>]
  const pathMatch = /\/book\/([^/?#]+)(?:\/([^?#]*))?/.exec(url.pathname)
  if (pathMatch) {
    const book = canonicalRef(decodeURIComponent(pathMatch[1] ?? ''))
    const tail = (pathMatch[2] ?? '').split('/').filter(Boolean)
    if (book) {
      return {
        view: 'reader',
        bookRef: book,
        atRef: tail.length ? stripRange(`${book}.${tail.join('.')}`) : null,
      }
    }
  }

  // Query form.
  const book = url.searchParams.get('book')
  if (book) {
    const bookRef = canonicalRef(book)
    const at = url.searchParams.get('at')
    return {
      view: 'reader',
      bookRef,
      atRef: at ? stripRange(canonicalRef(at)) : chapterOf(bookRef),
    }
  }

  const hash = url.hash.replace(/^#/, '')
  if (hash === 'settings') return { ...DEFAULT_ROUTE, view: 'settings' }
  return DEFAULT_ROUTE
}

/** Serialise a route to a URL the browser can be pushed to. */
export function routeToUrl(route: Route): string {
  if (route.view === 'settings') return '#settings'
  if (route.view === 'reader' && route.bookRef) {
    const { book, path } = parseRef(route.atRef ?? route.bookRef)
    if (!path.length) return `/?book=${encodeURIComponent(book)}`
    return `/book/${book}/${path.join('/')}`
  }
  return '#library'
}

export interface UseRouter {
  route: Route
  /** Push a new route, adding a history entry. */
  navigate: (route: Partial<Route>) => void
  /** Replace the current entry — used for bookmark moves within a book. */
  replace: (route: Partial<Route>) => void
  /** The library tab. */
  goLibrary: () => void
  goSettings: () => void
}

export function useRouter(): UseRouter {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? DEFAULT_ROUTE : parseRoute(window.location),
  )

  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location))
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])

  const apply = useCallback((next: Partial<Route>, replaceEntry: boolean) => {
    const merged: Route = {
      ...(typeof window === 'undefined' ? DEFAULT_ROUTE : parseRoute(window.location)),
      ...next,
    }
    const url = routeToUrl(merged)

    if (replaceEntry) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)

    setRoute(merged)
  }, [])

  const navigate = useCallback((next: Partial<Route>) => apply(next, false), [apply])
  const replace = useCallback((next: Partial<Route>) => apply(next, true), [apply])
  const goLibrary = useCallback(() => navigate({ view: 'library', bookRef: null, atRef: null }), [navigate])
  const goSettings = useCallback(() => navigate({ view: 'settings' }), [navigate])

  return { route, navigate, replace, goLibrary, goSettings }
}
