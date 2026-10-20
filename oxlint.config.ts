import { defineConfig } from 'oxlint'
import { julrPreset } from '@julr/tooling-configs/oxc/lint'

export default defineConfig({
  extends: [julrPreset({ perfectionist: true })],
  overrides: [
    {
      files: ['simulator/inertia/app/app.ts'],
      // Adonis uses type-only references to share server configuration with Inertia.
      rules: { 'typescript/triple-slash-reference': 'off' },
    },
  ],
})
