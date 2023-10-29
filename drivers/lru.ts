import { MemoryLru } from '../src/drivers/lru.js'
import type { MemoryConfig } from '../src/types/options/drivers_options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new memory LRU driver
 */
export function lruDriver(options: MemoryConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: MemoryConfig) => new MemoryLru(config) },
  }
}
