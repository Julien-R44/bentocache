import { julr } from '@julr/tooling-configs/eslint'

export default await julr({
  typescript: {
    tsconfigPath: [
      './tsconfig.json',
      './packages/bentocache/tsconfig.json',
      './docs/tsconfig.json',
    ],
  },

  rules: {
    // TODO disable in julr/tooling-configs. useful for vanilla enums
    '@typescript-eslint/no-redeclare': 'off',
  },
})
