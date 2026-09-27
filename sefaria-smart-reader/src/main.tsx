import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element in index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * Service worker registration.
 *
 * `vite.config.ts` sets `injectRegister: null`, so nothing registers the worker
 * for us. `autoUpdate` means a new build is picked up in the background and
 * taken over on the next load; `onNeedRefresh` is intentionally left empty
 * because the worker calls `skipWaiting` itself and this app has no
 * unsaved-work guard to protect.
 */
registerSW({ immediate: true })
