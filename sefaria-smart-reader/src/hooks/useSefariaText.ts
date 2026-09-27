import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, AsyncState, LoadedText } from '@/types/sefaria'
import { SefariaError, fetchText, prefetchText } from '@/services/sefariaApi'
import { canonicalRef, chapterOf } from '@/utils/ref'

export interface UseSefariaText {
  state: AsyncState<LoadedText>
  /** The chapter that is currently loaded, if any. */
  text: LoadedText | null
  /** Re-request the current ref. */
  reload: () => void
  /** True when the last failure was a connectivity problem. */
  offline: boolean
  /** Set when the loaded chapter was served from cache while offline. */
  fromCache: boolean
}

/**
 * Load a chapter / daf from Sefaria, with cancellation, retry and offline
 * fallback. `ref` should be a chapter-level reference so the whole unit is
 * available for rendering and progress maths.
 */
export function useSefariaText(ref: string | null): UseSefariaText {
  const [state, setState] = useState<AsyncState<LoadedText>>({
    status: ref ? 'loading' : 'idle',
    data: null,
    error: null,
  })
  const [reloadToken, setReloadToken] = useState(0)
  const [offline, setOffline] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const target = ref ? canonicalRef(ref) : ''

    if (!target) {
      setState({ status: 'idle', data: null, error: null })
      return
    }

    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const id = ++requestId.current

    setState((prev) => ({ status: 'loading', data: prev.data, error: null }))

    const run = async (offlineOnly: boolean): Promise<void> => {
      try {
        const text = await fetchText(chapterOf(target), { signal: abort.signal, offlineOnly })
        // Ignore responses from superseded requests.
        if (id !== requestId.current) return
        setState({ status: 'success', data: text, error: null })
        setOffline(false)
        setFromCache(offlineOnly)

        // Warm the next chapter so paging forward works with no connection.
        if (!offlineOnly && text.nextChapter) prefetchText(text.nextChapter)
      } catch (error) {
        if (id !== requestId.current) return
        if (error instanceof DOMException && error.name === 'AbortError') return

        const apiError: ApiError =
          error instanceof SefariaError
            ? error.toApiError()
            : { message: 'Something went wrong loading this text.', status: 0, kind: 'unknown', offline: false }

        // Offline: fall back to the cached copy before showing an error.
        if (apiError.offline) {
          setOffline(true)
          try {
            const cached = await fetchText(chapterOf(target), { signal: abort.signal, offlineOnly: true })
            if (id !== requestId.current) return
            setState({ status: 'success', data: cached, error: null })
            setFromCache(true)
            return
          } catch {
            if (id !== requestId.current) return
            setState((prev) => ({ status: 'error', data: prev.data, error: apiError }))
            return
          }
        }

        setOffline(false)
        setFromCache(false)
        setState((prev) => ({ status: 'error', data: prev.data, error: apiError }))
      }
    }

    void run(false)

    return () => abort.abort()
  }, [ref, reloadToken])

  // Track connectivity so the UI can announce it, and retry once on reconnect.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const online = (): void => {
      setOffline(false)
      setReloadToken((n) => n + 1)
    }
    const offlineEvent = (): void => setOffline(true)

    window.addEventListener('online', online)
    window.addEventListener('offline', offlineEvent)
    if (!navigator.onLine) setOffline(true)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offlineEvent)
    }
  }, [])

  return {
    state,
    text: state.data,
    reload,
    offline,
    fromCache,
  }
}
