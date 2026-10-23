import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Servi sur https://mateidelaroche.github.io/grind/
const base = process.env.GRIND_BASE ?? '/grind/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`1.0 · ${new Date().toISOString().slice(0, 10)}`),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      manifest: {
        name: 'Grind',
        short_name: 'Grind',
        description: 'Programme muscu à la maison de Matei',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0e17',
        theme_color: '#0a0e17',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
