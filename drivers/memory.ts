/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Memory } from '../src/drivers/memory.js'
import type { MemoryConfig } from '../src/types/options/drivers_options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new memory driver
 */
export function memoryDriver(options: MemoryConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: MemoryConfig) => new Memory(config) },
  }
}
