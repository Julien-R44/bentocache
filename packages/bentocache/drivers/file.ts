import { File } from '../src/drivers/file.js'
import type { CreateDriverResult } from '../src/types/main.js'
import type { FileConfig } from '../src/types/options/drivers_options.js'

/**
 * Create a new file driver
 */
export function fileDriver(options: FileConfig): CreateDriverResult<File> {
  return {
    options,
    factory: (config: FileConfig) => new File(config),
  }
}
