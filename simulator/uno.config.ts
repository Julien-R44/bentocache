import { defineConfig, presetUno, presetIcons, presetWebFonts, transformerDirectives } from 'unocss'

export default defineConfig({
  safelist: ['font-sans'],
  presets: [
    presetUno(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Geist',
        mono: 'JetBrains Mono',
      },
    }),
    presetIcons({ cdn: 'https://esm.sh/' }),
  ],

  transformers: [transformerDirectives()],
})
