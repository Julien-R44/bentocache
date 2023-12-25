import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entrypoints: ['./assets/app.js', './assets/app.css'],
      reload: ['content/**/*', 'templates/**/*.edge'],
    }),
  ],
})
