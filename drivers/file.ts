import { File } from '../src/drivers/file.js'
import type { FileConfig } from '../src/types/options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new file driver
 */
export function fileDriver(options: FileConfig): CreateDriverResult {
  return { local: { options, factory: (config: FileConfig) => new File(config) } }
}
