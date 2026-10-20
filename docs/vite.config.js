import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [
    adonisjs({
      entryPoints: ['./assets/app.js', './assets/app.css'],
      reload: ['content/**/*', 'templates/**/*.edge'],
    }),
  ],
})
