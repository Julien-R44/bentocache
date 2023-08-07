import { Memory } from '../src/drivers/memory.js'
import type { MemoryConfig } from '../src/types/options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new memory driver
 */
export function memoryDriver(options: MemoryConfig): CreateDriverResult {
  return { local: { options, factory: (config: MemoryConfig) => new Memory(config) } }
}
