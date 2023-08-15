/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { File } from '../src/drivers/file.js'
import type { FileConfig } from '../src/types/options/drivers_options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new file driver
 */
export function fileDriver(options: FileConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: FileConfig) => new File(config) },
  }
}
