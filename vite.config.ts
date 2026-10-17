/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// O app é publicado em https://caiozuniga.github.io/financas-app/
export default defineConfig({
  base: '/financas-app/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/financas-app/',
        name: 'Finanças',
        short_name: 'Finanças',
        description: 'Cartão, financiamento, dívidas e projeção de caixa. Tudo fica no seu aparelho.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        theme_color: '#07080b',
        background_color: '#07080b',
        display: 'standalone',
        categories: ['finance'],
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,woff2,svg}'],
        // O worker do pdf.js passa de 2 MB.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
