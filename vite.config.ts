import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // shown in Settings so you can tell which deployment you are looking at
  define: { __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PageInk',
        short_name: 'PageInk',
        description: 'Mark up real web pages with Apple Pencil',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//], globIgnores: ['**/eruda-*.js'] },
    }),
  ],
})
