import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    './index.ts',
    './src/types/main.ts',
    './src/drivers/*.ts',
    './src/drivers/database/database.ts',
    './src/drivers/database/adapters/*.ts',
    './src/drivers/file/file.ts',
    './src/drivers/file/cleaner_worker.js',
    './plugins/*.ts',
    './src/test_suite.ts',
  ],
  outDir: './build',
  clean: true,
  format: 'esm',
  dts: true,
  sourcemap: true,
  target: 'esnext',
})
