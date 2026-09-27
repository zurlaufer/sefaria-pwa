import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  resolve: {
    // Mirrors the `@/*` path mapping in tsconfig.app.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'safari-pinned-tab.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
        'offline.html',
      ],
      manifest: {
        id: '/',
        name: 'Sefaria Smart Reader & Bookmark',
        short_name: 'Sefaria Reader',
        description:
          'An offline-capable smart reader, book manager and daily progress tracker for learning Jewish texts with Sefaria commentaries.',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'books', 'lifestyle'],
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        background_color: '#faf7f2',
        theme_color: '#0f766e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'My Library',
            short_name: 'Library',
            url: './#library',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // The app shell (JS/CSS/HTML) is precached by default via globPatterns.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Sefaria text payloads. NetworkFirst keeps content fresh but falls back
            // to the last good response so a chapter that has been read once stays
            // readable with no connection. In practice this pre-caches the current
            // chapter plus the next one, because useSefariaText prefetches `next`.
            urlPattern: ({ url }) =>
              url.origin === 'https://www.sefaria.org' &&
              url.pathname.startsWith('/api/v3/texts/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sefaria-texts',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Commentary links for the open halacha / verse.
            urlPattern: ({ url }) =>
              url.origin === 'https://www.sefaria.org' &&
              url.pathname.startsWith('/api/links/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sefaria-links',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The Sefaria catalogue is large but static: cache it hard.
            urlPattern: ({ url }) =>
              url.origin === 'https://www.sefaria.org' &&
              url.pathname === '/api/index',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sefaria-index',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://www.sefaria.org',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'sefaria-other',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
