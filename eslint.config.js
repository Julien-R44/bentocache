// @ts-check
import { julr } from '@julr/tooling-configs/eslint'

export default await julr({
  typescript: { tsconfigPath: ['./tsconfig.json', './packages/bentocache/tsconfig.json'] },
})
